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
    const row = must(await admin.from('players').select('state, version, pvp_points, gang_id').eq('id', id).maybeSingle()) as any;
    return row ? { state: row.state, version: row.version, points: row.pvp_points, gangId: row.gang_id } : null;
  },
  async saveAll(p: any) {
    return must(await admin.rpc('save_all', {
      p_id: p.id, p_state: p.state, p_version: p.version, p_name: p.pub.name, p_cls: p.pub.cls, p_level: p.pub.level,
      p_fighter: p.pub.fighter, p_points: p.pub.points, p_delta: p.pub.pointsDelta,
      p_gangs: p.gangs, p_world: p.world, p_world_version: p.worldVersion, p_members: p.members,
    })) as boolean;
  },
  async loadGang(id: string) {
    const g = must(await admin.from('gangs').select('id, data, wins, version').eq('id', id).maybeSingle()) as any;
    return g || null;
  },
  async loadWorld() {
    return (must(await admin.from('world').select('data, version').eq('id', 'mesto1').maybeSingle()) as any) || null;
  },
  async people(ids: string[]) {
    const rows = must(await admin.from('players').select('id, name, level, cls, fighter, gang_id').in('id', ids)) as any[];
    return rows.map((r) => ({ id: r.id, name: r.name, level: r.level, cls: r.cls, fighter: r.fighter, gangId: r.gang_id }));
  },
  async findPlayer(name: string) {
    const rows = must(await admin.from('players').select('id, name, level, cls, gang_id').ilike('name', name.replace(/[%_\\]/g, '\\$&')).limit(1)) as any[];
    const r = rows[0];
    return r ? { id: r.id, name: r.name, level: r.level, cls: r.cls, gangId: r.gang_id } : null;
  },
  async gangTagTaken(tag: string) {
    const rows = must(await admin.from('gangs').select('id').ilike('tag', tag.replace(/[%_\\]/g, '\\$&')).limit(1)) as any[];
    return rows.length > 0;
  },
  async gangHall(n: number) {
    const rows = must(await admin.from('gangs').select('id, name, tag, color, wins, leader, members:data->members').order('wins', { ascending: false }).limit(n)) as any[];
    const leaders = rows.map((r) => r.leader).filter(Boolean);
    const names = leaders.length ? must(await admin.from('players').select('id, name').in('id', leaders)) as any[] : [];
    const byId = Object.fromEntries(names.map((p) => [p.id, p.name]));
    return rows.map((r) => ({ id: r.id, name: r.name, tag: r.tag, color: r.color, wins: r.wins, members: (r.members || []).length, leaderName: byId[r.leader] || '' }));
  },
  async inbox(pid: string) {
    const req = must(await admin.from('gangs').select('id').contains('data', { requests: [{ id: pid }] })) as any[];
    const inv = must(await admin.from('gangs').select('id, name, tag, color').contains('data', { invites: [{ id: pid }] })) as any[];
    return { requests: req.map((g) => g.id), invites: inv };
  },
  async addGangLogs(list: any[]) {
    for (const l of list) must(await admin.rpc('add_gang_log', { p_gang: l.gang, p_entry: l.entry }));
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
