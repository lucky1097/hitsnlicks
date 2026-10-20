// Online client: the same SimServer, but only as a read-only mirror of the state the real server sent.
// Every action goes to the Edge Function "game"; its answer replaces the mirror. Things the server rolls
// at random (mission offers, shop stock, arena opponents, rival gang moves) are never rolled here.
import { SimServer } from './server.js?v=202610201856';
import { NET } from './net.js?v=202610201856';
import { CONFIG } from './config.js?v=202610201856';
import { SHOPS } from './data.js?v=202610201856';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

// actions that change something: they run on the server and are async here
const ACTIONS = ['newGame', 'spendPoint', 'buyStat', 'equip', 'unequip', 'sellItem', 'upgradeItem', 'buyItem',
  'startMission', 'skipMission', 'claimMission', 'policeCheck', 'lawyer', 'buyBars', 'catchRipper', 'takePill', 'hitRunner',
  'fightBoss', 'fightArena', 'createGang', 'recruit', 'promote', 'deposit', 'buyGangUpgrade', 'refillTurf', 'toggleDefender', 'attackTurf'];

const noStore = { load: () => null, save() {}, clear() {} };

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
  }

  // ?mock in the address: no Supabase, the server API runs in this browser against an in-memory database
  async initMock() {
    const { handle, memoryDb } = await import('./api.js?v=202610201856');
    const db = memoryDb();
    const fake = { user: { id: 'mock-user', email: 'test@mock' } };
    this.sb = { auth: { signOut: async () => {}, signInWithPassword: async () => ({ data: { session: fake } }), signUp: async () => ({ data: { session: fake } }), resetPasswordForEmail: async () => ({}) } };
    this.call = async (action, ...args) => {
      if (!this.session) return { ok: false, error: 'Nie si prihlásený.' };
      const out = await handle(db, this.session.user.id, action, args);
      if ('state' in out) this.state = JSON.parse(JSON.stringify(out.state));
      this.lastSync = Date.now();
      this.onChange();
      return out;
    };
    this.mockDb = db;
  }

  async init() {
    if (/[?&]mock/.test(location.search)) return this.initMock();
    const { createClient } = await import(SUPABASE_JS);
    this.sb = createClient(NET.url, NET.anonKey);
    const { data } = await this.sb.auth.getSession();
    this.session = data.session;
    this.sb.auth.onAuthStateChange((_e, session) => { this.session = session; });
    if (this.session) await this.call('sync');
  }

  loggedIn() { return !!this.session; }
  email() { return this.session && this.session.user.email; }

  async signIn(email, password) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: authError(error) };
    this.session = data.session;
    await this.call('sync');
    return { ok: true };
  }

  async signUp(email, password) {
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split('#')[0] } });
    if (error) return { ok: false, error: authError(error) };
    if (data.session) { this.session = data.session; return { ok: true }; }
    return { ok: true, confirm: true }; // the project wants the email confirmed first
  }

  async resetPassword(email) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
    return error ? { ok: false, error: authError(error) } : { ok: true };
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
      if (out.auth) { this.session = null; this.state = null; }
      if ('state' in out) this.state = out.state;
      if (out.now) this.clockSkew = out.now - Date.now();
      this.lastSync = Date.now();
      this.onChange();
      return out;
    } catch (e) {
      return { ok: false, error: 'Bez spojenia so serverom.' };
    } finally {
      this.busy = false;
    }
  }

  async deleteCharacter() { return this.call('deleteCharacter'); }
  async refreshArena() { return this.call('arena'); }

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
    if (!st) return { ...base, id: shopId, list: [], bm: null, refreshIn: 0 };
    const bmOpen = this.blackMarketOpen();
    return { ...base, id: shopId, list: st.list, bm: bmOpen ? st.bm || [] : null, refreshIn: Math.max(0, st.at + this.gameMs(CONFIG.shopRefreshMin) - Date.now()) };
  }
  arena() {
    const v = this.state.pvp;
    const ladder = [...(v.ladder || []), { name: this.p.name, points: v.points, me: true }].sort((a, b) => b.points - a.points);
    return { opponents: v.opponents || [], ladder, points: v.points, freeLeft: Math.max(0, CONFIG.pvpFreePerHour - v.used), windowEnds: v.windowStart + this.gameMs(60), wins: v.wins, losses: v.losses };
  }
  gangTick() {} // rival gangs move on the server
  crime(heat) { this.call('crime', heat); } // fire and forget
}

ACTIONS.forEach((name) => {
  RemoteServer.prototype[name] = function (...args) { return this.call(name, ...args); };
});

function authError(e) {
  const m = (e && e.message) || '';
  if (/Invalid login/i.test(m)) return 'Nesprávny email alebo heslo.';
  if (/Email not confirmed/i.test(m)) return 'Najprv potvrď email, poslali sme ti odkaz.';
  if (/already registered/i.test(m)) return 'Tento email už má účet. Prihlás sa.';
  if (/Password should be/i.test(m)) return 'Heslo musí mať aspoň 6 znakov.';
  if (/rate limit/i.test(m)) return 'Priveľa pokusov, skús to o chvíľu.';
  return m || 'Prihlásenie zlyhalo.';
}
