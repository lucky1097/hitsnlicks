// Online client: the same SimServer, but only as a read-only mirror of the state the real server sent.
// Every action goes to the Edge Function "game"; its answer replaces the mirror. Things the server rolls
// at random (mission offers, shop stock, arena opponents, rival gang moves) are never rolled here.
import { SimServer } from './server.js?v=20261124153524';
import { NET } from './net.js?v=20261124153524';
import { CONFIG } from './config.js?v=20261124153524';
import { SHOPS } from './data.js?v=20261124153524';
import { LANG, tt, tts } from './i18n.js?v=20261124153524';

// the server answers in Slovak: names, titles and story lines in an answer are put into the player's language here
// (errors stay Slovak, the UI checks some of them and ui.toast translates what it shows)
const ANSWER_TEXT = new Set(['name', 'title', 'subtitle', 'hit', 'text', 'desc', 'lineName']);
function localize(v, depth = 0) {
  if (LANG === 'sk' || !v || typeof v !== 'object' || depth > 6) return v;
  for (const k of Object.keys(v)) {
    if (k === 'state') continue;
    const x = v[k];
    if (typeof x === 'string') { if (ANSWER_TEXT.has(k)) v[k] = tts(x); } else if (x && typeof x === 'object') localize(x, depth + 1);
  }
  return v;
}

// the official supabase-js UMD build, kept in the repo (js/vendor): no code from a CDN runs in the game
const SUPABASE_JS = 'js/vendor/supabase-js-2.45.4.js';
const loadScript = (src) => new Promise((done, failed) => {
  const el = document.createElement('script');
  el.src = src; el.onload = done; el.onerror = () => failed(new Error('cannot load ' + src));
  document.head.appendChild(el);
});

// actions that change something: they run on the server and are async here
const ACTIONS = ['newGame', 'setLook', 'spendPoint', 'buyStat', 'equip', 'unequip', 'sellItem', 'upgradeItem', 'buyItem', 'rerollShop',
  'startMission', 'skipMission', 'claimMission', 'policeCheck', 'lawyer', 'buyBars', 'buyElixir', 'dailyStep', 'copDown', 'policeKiller', 'hideStart', 'hideEnd', 'travel', 'wantedLose', 'catchRipper', 'takePill', 'hitRunner',
  'fightBoss', 'fightClub', 'fightArena', 'createGang', 'requestJoin', 'cancelRequest', 'acceptInvite', 'declineInvite', 'approveJoin', 'denyJoin',
  'invitePlayer', 'cancelInvite', 'kickMember', 'setRank', 'transferLead', 'leaveGang', 'disbandGang',
  'deposit', 'buyGangUpgrade', 'refillTurf', 'toggleDefender', 'attackTurf', 'tutorialFinish', 'tutorialSkip', 'goalClaim', 'claimMedals', 'reportBug', 'logErrors'];

const noStore = { load: () => null, save() {}, clear() {} };

// what a link from an account email brought back in the address: after "#" a session (type signup = the email was
// confirmed, recovery = a new password is wanted) or, for a used or expired link, an error (also after "?")
export function authReturn(loc) {
  const h = new URLSearchParams(String(loc.hash || '').replace(/^#/, ''));
  const q = new URLSearchParams(String(loc.search || ''));
  const err = h.get('error_code') || q.get('error_code') || h.get('error') || q.get('error');
  if (err) return { error: err };
  return h.get('access_token') && h.get('type') ? { type: h.get('type') } : null;
}

// the address without the email link's tokens and error params (the rest, like ?mock, stays)
function cleanAddress(keys = ['error', 'error_code', 'error_description', 'code']) {
  const q = new URLSearchParams(location.search);
  keys.forEach((k) => q.delete(k));
  const s = q.toString();
  history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
}

// back from Stripe's payment page: ?paid=<Checkout Session id> after paying, ?paid=cancel after going back
export function payReturn(loc) {
  const v = new URLSearchParams(String(loc.search || '')).get('paid');
  if (!v) return null;
  return v === 'cancel' ? { cancel: true } : { id: v.slice(0, 200) };
}

// what the pay function's error codes mean for the player
function payError(code) {
  if (code === 'off') return tt('Platby sú teraz vypnuté. Skús to neskôr.');
  if (code === 'busy') return tt('Priveľa pokusov, skús to o chvíľu.');
  if (code === 'nochar') return tt('Najprv si vytvor postavu.');
  if (code === 'auth') return tt('Nie si prihlásený.');
  return tt('Platbu sa nepodarilo pripraviť. Skús to znova o chvíľu.');
}

export class RemoteServer extends SimServer {
  // (see main.js: used when js/net.js has a project, or with ?mock for testing)
  constructor() {
    super({ store: noStore, state: null, live: true });
    this.online = true;
    this.sb = null;
    this.session = null;
    this.busy = false;
    this.lastSync = 0;
    this.onChange = () => {};
    this.onError = () => {}; // a server failure the player met (logged for the beta, see ui.logError)
    this.authBack = null; // { type, session } or { error } when the page was opened from an account email (see ui.authBack)
    this.payBack = null; // { id } or { cancel } when the page was opened from Stripe's payment page (see ui.payBack)
    this.onPaid = () => {}; // bars paid through Stripe were just credited (an answer carries paid: <bars>)
    this.pay = null; // { ready, test, at }: can this player buy bars now (pay/status, kept 5 minutes)
    this.payAsk = null;
  }

  // server failures worth logging: a crash in the rules or an answer that was not JSON
  noteError(action, out) {
    if (action !== 'logErrors' && out && out.ok === false && /^(Chyba servera|Server neodpovedá)/.test(out.error || '')) this.onError('server ' + action + ': ' + out.error);
  }

  // ?mock in the address: no Supabase, the server API runs in this browser against an in-memory database
  async initMock() {
    const { handle, memoryDb } = await import('./api.js?v=20261124153524');
    const db = memoryDb();
    const fake = { user: { id: 'mock-user', email: 'test@mock' } };
    this.sb = { auth: { signOut: async () => {}, signInWithPassword: async () => ({ data: { session: fake } }), signUp: async () => ({ data: { session: fake } }), resetPasswordForEmail: async () => ({}),
      updateUser: async (u) => (String(u.password || '').length < 8 ? { error: { message: 'Password should be at least 8 characters.' } } : { data: {}, error: null }) } };
    this.call = async (action, ...args) => {
      if (!this.session) return { ok: false, error: 'Nie si prihlásený.' };
      const out = await handle(db, this.session.user.id, action, args);
      this.noteError(action, out);
      if ('state' in out) this.state = JSON.parse(JSON.stringify(out.state));
      this.lastSync = Date.now();
      this.onChange();
      if (out.paid) this.onPaid(out.paid);
      return localize(out);
    };
    // payments: always on, in Stripe's test mode; a purchase is recorded at once, as if Stripe's webhook came
    this.payStatus = async () => (this.pay = { ready: true, test: true, at: Date.now() });
    this.checkout = async (i) => {
      const pack = CONFIG.barPacks[Number(i)];
      if (!this.session || !this.state) return { ok: false, error: payError('nochar') };
      if (!pack) return { ok: false, error: payError('pack') };
      db.addPurchase(this.session.user.id, pack.bars);
      return { ok: true, mock: true };
    };
    this.mockDb = db;
  }

  async init() {
    if (/[?&]mock/.test(location.search)) return this.initMock();
    const back = authReturn(location); // read before supabase-js takes the tokens out of the address
    this.payBack = payReturn(location);
    if (this.payBack) cleanAddress(['paid']);
    await loadScript(SUPABASE_JS);
    const { createClient } = window.supabase;
    this.sb = createClient(NET.url, NET.anonKey);
    const { data } = await this.sb.auth.getSession();
    this.session = data.session;
    if (back) { this.authBack = { ...back, session: !!this.session }; cleanAddress(); }
    this.sb.auth.onAuthStateChange((_e, session) => { this.session = session; });
    if (this.session) await this.call('sync');
  }

  loggedIn() { return !!this.session; }
  email() { return this.session && this.session.user.email; }

  // the captcha is checked by Supabase (Attack Protection); ?mock needs none
  needsCaptcha() { return !/[?&]mock/.test(location.search); } // (the address, not mockDb: the title is drawn before init)

  async signIn(email, password, captchaToken) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password, options: { captchaToken } });
    if (error) return { ok: false, error: authError(error) };
    this.session = data.session;
    await this.call('sync');
    return { ok: true };
  }

  async signUp(email, password, captchaToken) {
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split('#')[0], captchaToken, data: { lang: LANG } } }); // lang: the language of the account emails
    if (error) return { ok: false, error: authError(error) };
    if (data.session) { this.session = data.session; return { ok: true }; }
    return { ok: true, confirm: true }; // the project wants the email confirmed first
  }

  async resetPassword(email, captchaToken) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0], captchaToken });
    return error ? { ok: false, error: authError(error) } : { ok: true };
  }

  // a new password after the "Zabudnuté heslo" email link (that link logs the player in)
  async setPassword(password) {
    if (!this.session) return { ok: false, error: 'Nie si prihlásený.' };
    const { error } = await this.sb.auth.updateUser({ password });
    return error ? { ok: false, error: authError(error) } : { ok: true };
  }

  // the account emails (new password) follow the language chosen here
  async saveLang(lang) {
    if (!this.session || !this.sb.auth.updateUser) return;
    try { await Promise.race([this.sb.auth.updateUser({ data: { lang } }), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* the game still switches */ }
  }

  async signOut() { await this.sb.auth.signOut(); this.session = null; this.state = null; }

  // one round trip to the server; the answer's state becomes the mirror
  async call(action, ...args) {
    if (!this.session) return { ok: false, error: 'Nie si prihlásený.' };
    this.busy = true;
    try {
      const res = await fetch(NET.url + '/functions/v1/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.session.access_token, apikey: NET.anonKey },
        body: JSON.stringify({ action, args }),
      });
      const out = await res.json().catch(() => ({ ok: false, error: 'Server neodpovedá.' }));
      this.noteError(action, out);
      if (out.auth) { this.session = null; this.state = null; }
      if ('state' in out) this.state = out.state;
      if (out.now) this.clockSkew = out.now - Date.now();
      this.lastSync = Date.now();
      this.onChange();
      if (out.paid) this.onPaid(out.paid);
      return localize(out);
    } catch (e) {
      return { ok: false, error: 'Bez spojenia so serverom.' };
    } finally {
      this.busy = false;
    }
  }

  // ---------------------------------------------------------------- gold bars through Stripe (Edge Function "pay")
  payHeaders() { return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.session.access_token, apikey: NET.anonKey }; }
  payInfo() { return this.pay && Date.now() - this.pay.at < 300000 ? this.pay : null; }
  // can this player buy now (payments switched on, and while Stripe is in test mode only for testers)
  payStatus() {
    if (this.payAsk) return this.payAsk;
    this.payAsk = (async () => {
      let info = { ready: false, test: false };
      try {
        if (this.session) {
          const res = await fetch(NET.url + '/functions/v1/pay/status', { method: 'POST', headers: this.payHeaders(), body: '{}' });
          const out = await res.json();
          if (out && out.ok) info = { ready: !!out.ready, test: !!out.test };
        }
      } catch (e) { /* no answer: shown as not on sale, asked again in 5 minutes */ }
      this.pay = { ...info, at: Date.now() };
      this.payAsk = null;
      return this.pay;
    })();
    return this.payAsk;
  }
  // a Stripe payment page for one pack: { ok, url } (the UI goes there) or { ok: false, error }
  async checkout(i) {
    if (!this.session) return { ok: false, error: payError('auth') };
    try {
      const res = await fetch(NET.url + '/functions/v1/pay/checkout', { method: 'POST', headers: this.payHeaders(), body: JSON.stringify({ pack: Number(i), lang: LANG }) });
      const out = await res.json().catch(() => ({}));
      if (out.ok && String(out.url).startsWith('https://checkout.stripe.com/')) return { ok: true, url: out.url }; // only ever Stripe's own page
      return { ok: false, error: payError(out.code) };
    } catch (e) {
      return { ok: false, error: tt('Bez spojenia so serverom.') };
    }
  }

  async deleteCharacter() { return this.call('deleteCharacter'); }
  // the whole account: character, email and password; the login on this device ends with it
  async deleteAccount() {
    const r = await this.call('deleteAccount');
    if (r.ok) {
      try { await this.sb.auth.signOut({ scope: 'local' }); } catch (e) { /* the user is gone already */ }
      this.session = null; this.state = null;
    }
    return r;
  }
  async refreshArena() { return this.call('arena'); }
  // hall of fame reads other players from the database; the answers carry no state, so the mirror stays as it is
  async hallOfFame() { return this.call('hallOfFame'); }
  async playerProfile(id) { return this.call('playerProfile', id); }
  async gangHall() { return this.call('gangHall'); }
  gangInbox() { return this.state.gangInbox || { requests: [], invites: [] }; }

  // keep the mirror fresh (offers expire, rivals move, timers tick on the server)
  maybeSync(everyMs = 30000) {
    if (this.session && !this.busy && Date.now() - this.lastSync > everyMs) this.call('sync');
  }

  // ---------------------------------------------------------------- mirror: never roll anything locally
  save() {}
  reset() { this.state = null; }
  offers(giverId) { const o = this.state.offers[giverId]; return o ? o.list : []; }
  shop(shopId) {
    const st = this.state.shops[shopId];
    const base = SHOPS[shopId];
    const hasBm = this.bmBases(shopId).length > 0;
    if (!st) return { ...base, id: shopId, list: [], hasBm, bm: null, refreshIn: 0 };
    const bmOpen = this.blackMarketOpen() && hasBm;
    return { ...base, id: shopId, list: st.list, premium: st.premium || null, hasBm, bm: bmOpen ? st.bm || [] : null, refreshIn: Math.max(0, st.at + this.gameMs(CONFIG.shopRefreshMin) - Date.now()) };
  }
  arena() {
    const v = this.state.pvp;
    const ladder = [...(v.ladder || []), { name: this.p.name, points: v.points, me: true }].sort((a, b) => b.points - a.points);
    return { opponents: v.opponents || [], ladder, points: v.points, freeLeft: Math.max(0, CONFIG.pvpFreePerHour - v.used), windowEnds: v.windowStart + this.gameMs(60), wins: v.wins, losses: v.losses };
  }
  gangTick() {} // rival gangs move on the server
  dailyQuests() { return this.state.dailyQ || { key: '', tasks: [], done: false }; } // rolled on the server
  crime(kind) { this.call('crime', kind); } // fire and forget
}

ACTIONS.forEach((name) => {
  RemoteServer.prototype[name] = function (...args) { return this.call(name, ...args); };
});

function authError(e) {
  const m = (e && e.message) || '';
  if (/Invalid login/i.test(m)) return 'Nesprávny email alebo heslo.';
  if (/Email not confirmed/i.test(m)) return 'Najprv potvrď email, poslali sme ti odkaz.';
  if (/already registered/i.test(m)) return 'Tento email už má účet. Prihlás sa.';
  if (/Password should be/i.test(m)) return 'Heslo musí mať aspoň 8 znakov.';
  if (/should be different/i.test(m)) return 'Nové heslo musí byť iné ako staré.';
  if (/captcha/i.test(m)) return 'Overenie, že nie si robot, neprešlo. Počkaj na fajku nad tlačidlom a skús znova.';
  if (/rate limit/i.test(m)) return 'Priveľa pokusov, skús to o chvíľu.';
  return m || 'Prihlásenie zlyhalo.';
}
