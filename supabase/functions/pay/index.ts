// Edge Function "pay": gold bars for real money through Stripe Checkout, VAT handled by Stripe Tax.
//   POST .../pay/status    player's login token                -> { ok, ready, test }   can this player buy now?
//   POST .../pay/checkout  player's login token, { pack, lang } -> { ok, url }          Stripe's payment page for one pack
//   POST .../pay/webhook   from Stripe, signed                  -> a paid Checkout Session becomes a row in public.purchases
// The bars are added to the save by the game function on the player's next sync (js/api.js), never here: only one
// function writes the save. Pack sizes and prices come from js/config.js (copied next to this file by tools/deploy.ps1),
// the same numbers the game shows.
//
// Secrets (Lucky sets them in Supabase, they are never in the repo):
//   STRIPE_SECRET_KEY      a secret or restricted key: sk_/rk_test_... while testing, sk_/rk_live_... for real money
//   STRIPE_WEBHOOK_SECRET  whsec_... of the webhook endpoint https://<project>.supabase.co/functions/v1/pay/webhook
//   PAY_TESTERS            player ids (comma-separated). While it is set, only these players may buy, with a test key
//                          or a live key (first real purchase before opening). Not set: live key = everyone, test key = nobody
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { CONFIG } from './config.js';

const SB_URL = Deno.env.get('SUPABASE_URL')!; // (not "URL": that name is needed for new URL())
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
const HOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
const TESTERS = (Deno.env.get('PAY_TESTERS') || '').split(',').map((s) => s.trim()).filter(Boolean);
const TEST = /_test_/.test(KEY);
const SITE = 'https://hitsnlicks.online';
const APP = 'hitsnlicks'; // marks our Checkout Sessions, in case the Stripe account ever sells anything else
const admin = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// what Stripe's page and receipt call the pack, and the consent to get the bars at once (EU: no 14-day withdrawal then)
const LANGS = ['sk', 'cs', 'de', 'en'];
const NAME: Record<string, (n: number) => string> = {
  sk: (n) => n + ' zlatých tehličiek',
  cs: (n) => n + ' zlatých cihliček',
  de: (n) => n + ' Goldbarren',
  en: (n) => n + ' gold bars',
};
const CONSENT: Record<string, string> = {
  sk: 'Súhlasím s [podmienkami](' + SITE + '/podmienky) a žiadam, aby sa tehličky pripísali hneď. Beriem na vedomie, že tým strácam právo odstúpiť od zmluvy do 14 dní.',
  cs: 'Souhlasím s [podmínkami](' + SITE + '/podmienky-cs) a žádám, aby se cihličky připsaly hned. Beru na vědomí, že tím ztrácím právo odstoupit od smlouvy do 14 dnů.',
  de: 'Ich stimme den [Bedingungen](' + SITE + '/podmienky-de) zu und verlange, dass die Goldbarren sofort gutgeschrieben werden. Mir ist bekannt, dass ich dadurch mein 14-tägiges Widerrufsrecht verliere.',
  en: 'I agree to the [terms](' + SITE + '/podmienky-en) and ask for the gold bars to be credited right away. I understand that I thereby lose my 14-day right of withdrawal.',
};

// at most 10 payment pages a minute per player on one instance
const hits = new Map<string, { start: number; n: number }>();
function allowed(id: string) {
  const now = Date.now();
  let h = hits.get(id);
  if (!h || now - h.start > 60000) { h = { start: now, n: 0 }; hits.set(id, h); }
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start > 60000) hits.delete(k);
  return ++h.n <= 10;
}

const ready = () => !!KEY && !!HOOK_SECRET;
// testers set: only they buy (test or live key); none set: everyone with a live key, nobody with a test key
const mayBuy = (id: string) => ready() && (TESTERS.length ? TESTERS.includes(id) : !TEST);

async function player(req: Request) {
  const auth = req.headers.get('Authorization') || '';
  const userClient = createClient(SB_URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user } } = await userClient.auth.getUser();
  return user;
}

async function checkout(user: { id: string; email?: string }, body: any) {
  if (!mayBuy(user.id)) return json({ ok: false, code: 'off' });
  if (!allowed(user.id)) return json({ ok: false, code: 'busy' }, 429);
  const i = Number(body.pack);
  const pack = Number.isInteger(i) ? CONFIG.barPacks[i] : null;
  if (!pack) return json({ ok: false, code: 'pack' });
  const { data: row, error } = await admin.from('players').select('id').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (!row) return json({ ok: false, code: 'nochar' });
  const lang = LANGS.includes(body.lang) ? body.lang : 'en';

  const f = new URLSearchParams();
  const put = (k: string, v: string | number) => f.append(k, String(v));
  put('mode', 'payment');
  put('line_items[0][quantity]', 1);
  put('line_items[0][price_data][currency]', 'eur');
  put('line_items[0][price_data][unit_amount]', pack.cents);
  put('line_items[0][price_data][tax_behavior]', 'inclusive'); // the price is final, VAT is inside it
  put('line_items[0][price_data][product_data][name]', NAME[lang](pack.bars));
  put('line_items[0][price_data][product_data][tax_code]', 'txcd_10000000'); // electronically supplied services
  put('automatic_tax[enabled]', 'true');
  // vollgas s.r.o. sells (not Stripe as merchant of record): Managed Payments is on by default on the account and
  // refuses custom_text, which carries the withdrawal-waiver consent
  put('managed_payments[enabled]', 'false');
  put('client_reference_id', user.id);
  for (const [k, v] of Object.entries({ app: APP, user_id: user.id, pack: i, bars: pack.bars })) {
    put('metadata[' + k + ']', v);
    put('payment_intent_data[metadata][' + k + ']', v); // refunds and disputes point at the payment intent
  }
  if (user.email) put('customer_email', user.email);
  put('locale', lang);
  put('submit_type', 'pay');
  put('consent_collection[terms_of_service]', 'required');
  put('custom_text[terms_of_service_acceptance][message]', CONSENT[lang]);
  put('success_url', SITE + '/?paid={CHECKOUT_SESSION_ID}');
  put('cancel_url', SITE + '/?paid=cancel');

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: f,
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.url) {
    console.error('stripe checkout failed', res.status, out && out.error && out.error.message);
    return json({ ok: false, code: 'stripe' }, 502);
  }
  return json({ ok: true, url: out.url });
}

// ---------------------------------------------------------------- webhook
const enc = new TextEncoder();
function sameText(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
// Stripe-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body" with the endpoint secret>[,v1=...]
async function signedByStripe(body: string, header: string) {
  let t = '';
  const sigs: string[] = [];
  for (const kv of header.split(',')) {
    const at = kv.indexOf('=');
    const k = kv.slice(0, at).trim(), v = kv.slice(at + 1).trim();
    if (k === 't') t = v; else if (k === 'v1') sigs.push(v);
  }
  if (!/^\d+$/.test(t) || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // an old message sent again
  const key = await crypto.subtle.importKey('raw', enc.encode(HOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(t + '.' + body)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
  return sigs.some((s) => sameText(s, hex));
}

async function record(o: any) {
  const md = o.metadata || {};
  const bars = Math.floor(Number(md.bars));
  if (md.app !== APP) return; // not a gold bar payment
  if (o.mode !== 'payment' || !UUID.test(String(o.client_reference_id || '')) || !(bars > 0)) {
    console.error('webhook: session without a player or bars', o.id);
    return;
  }
  if (o.currency !== 'eur' || !(o.amount_total > 0)) { console.error('webhook: not a euro payment', o.id, o.currency, o.amount_total); return; }
  // sessions are made only by checkout() above; a different amount means the packs changed in between (still credited)
  const pack = CONFIG.barPacks[Number(md.pack)];
  if (!pack || pack.cents !== o.amount_total || pack.bars !== bars) console.error('webhook: amount differs from the pack today', o.id, md.pack, o.amount_total, bars);
  const { error } = await admin.from('purchases').upsert({
    id: o.id, user_id: o.client_reference_id, bars, amount: o.amount_total, currency: o.currency,
    payment_intent: o.payment_intent || null, livemode: !!o.livemode,
  }, { onConflict: 'id', ignoreDuplicates: true }); // Stripe may send the same event more than once
  if (error && error.code === '23503') { console.error('webhook: the player deleted the account', o.id); return; }
  if (error) throw error;
}

async function mark(paymentIntent: unknown, status: string) {
  if (typeof paymentIntent !== 'string' || !paymentIntent) return;
  const { error } = await admin.from('purchases').update({ status }).eq('payment_intent', paymentIntent);
  if (error) throw error;
}

async function webhook(req: Request) {
  if (!HOOK_SECRET) return json({ ok: false }, 503);
  const body = await req.text();
  if (!(await signedByStripe(body, req.headers.get('Stripe-Signature') || ''))) return json({ ok: false }, 400);
  const ev = JSON.parse(body);
  const o = ev.data && ev.data.object || {};
  if (ev.type === 'checkout.session.completed' && o.payment_status === 'paid') await record(o);
  else if (ev.type === 'checkout.session.async_payment_succeeded') await record(o);
  else if (ev.type === 'charge.refunded') await mark(o.payment_intent, 'refunded');
  else if (ev.type === 'charge.dispute.created') await mark(o.payment_intent, 'disputed');
  return json({ received: true }); // anything else: received, nothing to do
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false }, 405);
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop();
  try {
    if (route === 'webhook') return await webhook(req); // a failure answers 500 and Stripe sends it again later
    const user = await player(req);
    if (!user) return json({ ok: false, code: 'auth' }, 401);
    if (route === 'status') return json({ ok: true, ready: mayBuy(user.id), test: TEST });
    if (route === 'checkout') return await checkout(user, await req.json().catch(() => ({})));
    return json({ ok: false }, 404);
  } catch (e) {
    console.error(e);
    return json({ ok: false, code: 'error' }, 500);
  }
});
