// Edge Function "game": the authoritative game server. POST { action, args } with the player's login token.
// The rules are the same modules the browser uses (copied into ./game by tools/deploy.ps1).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { handle } from './game/api.js';

const URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const must = <T>(r: { data: T; error: unknown }) => { if (r.error) throw r.error; return r.data; };

const db = {
  async loadPlayer(id: string) {
    const row = must(await admin.from('players').select('state, version, pvp_points').eq('id', id).maybeSingle()) as any;
    return row ? { state: row.state, version: row.version, points: row.pvp_points } : null;
  },
  async savePlayer(id: string, state: unknown, version: number | null, pub: any) {
    return must(await admin.rpc('save_player', {
      p_id: id, p_state: state, p_version: version, p_name: pub.name, p_cls: pub.cls, p_level: pub.level,
      p_fighter: pub.fighter, p_points: pub.points, p_delta: pub.pointsDelta,
    })) as boolean;
  },
  async nameTaken(name: string, id: string) {
    const rows = must(await admin.from('players').select('id').ilike('name', name.replace(/[%_\\]/g, '\\$&')).neq('id', id).limit(1)) as any[];
    return rows.length > 0;
  },
  async arenaPool(id: string, points: number, n: number) {
    const rows = must(await admin.rpc('arena_pool', { p_id: id, p_points: points, p_n: n })) as any[];
    return rows.map((r) => ({ id: r.id, ...r.fighter, name: r.name, points: r.points }));
  },
  async ladder(n: number) {
    const rows = must(await admin.from('players').select('id, name, pvp_points').order('pvp_points', { ascending: false }).limit(n)) as any[];
    return rows.map((r) => ({ id: r.id, name: r.name, points: r.pvp_points }));
  },
  async hall(n: number) {
    const rows = must(await admin.from('players').select('id, name, level, cls, pvp_points').order('level', { ascending: false }).order('pvp_points', { ascending: false }).limit(n)) as any[];
    return rows.map((r) => ({ id: r.id, name: r.name, level: r.level, cls: r.cls, points: r.pvp_points }));
  },
  async addPoints(id: string, delta: number) { must(await admin.rpc('add_pvp_points', { p_id: id, p_delta: delta })); },
  async deletePlayer(id: string) { must(await admin.from('players').delete().eq('id', id)); },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  const auth = req.headers.get('Authorization') || '';
  const userClient = createClient(URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ ok: false, error: 'Nie si prihlásený.', auth: true }, 401);
  try {
    const body = await req.json();
    const out = await handle(db, user.id, String(body.action || ''), body.args || []);
    return json({ ...out, now: Date.now() });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: 'Chyba servera.' }, 500);
  }
});
