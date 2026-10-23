// The game's server API: one call = one action of one player. Runs on the real server (Supabase Edge
// Function) and can run in the browser against a fake database for testing. It loads the player's state,
// his gang and the shared city, runs the same SimServer rules the offline game uses, saves everything
// that changed in one transaction and hands the new state back.
//
// db adapter (all async):
//   loadPlayer(id) -> { state, version, points, gangId } | null
//   saveAll(p) -> boolean   (false: someone saved in between, try again) — one transaction:
//     p = { id, state, version|null, pub, gangs: [{ id, name, tag, color, leader, data, winsDelta, version|null, deleted }],
//           world: data|null, worldVersion|null, members: [{ id, gang|null, expect }] }
//     pub = { name, cls, level, fighter, points (new player), pointsDelta (change made by this action) }
//     members: a player's gang changes only if his gang is still `expect` (null = had none)
//   loadGang(id) -> { id, data, wins, version } | null
//   loadWorld() -> { data, version } | null
//   people(ids) -> [{ id, name, level, cls, fighter, gangId }]
//   findPlayer(name) -> { id, name, level, cls, gangId } | null
//   gangTagTaken(tag) -> boolean
//   gangHall(n) -> [{ id, name, tag, color, wins, members, leaderName }]   (most Gang Wars wins first)
//   inbox(playerId) -> { requests: [gangId], invites: [{ id, name, tag, color }] }
//   addGangLogs([{ gang, entry }])   (diary lines for other gangs, written after the save)
//   nameTaken(name, id) -> boolean
//   arenaPool(id, points, n) -> [{ id, name, level, cls, stats, weapon, armor, points }]
//   ladder(n) -> [{ id, name, points }]
//   hall(n) -> [{ id, name, level, cls, points }]   (highest level first)
//   addPoints(id, delta)
//   deletePlayer(id)
import { SimServer } from './server.js?v=20261023221751';
import { GIVERS, SHOPS } from './data.js?v=20261023221751';

const memStore = { load: () => null, save() {}, clear() {} };
const fail = (error) => ({ ok: false, error });
const json = (v) => JSON.stringify(v === undefined ? null : v);

// everything a player may ask the server to do; args are positional like the SimServer methods
const ACTIONS = {
  sync: () => ({ ok: true }),
  arena: (s) => { s.state.pvp.opponents = null; return { ok: true }; }, // new opponents
  newGame: (s, [name, cls]) => s.newGame(name, cls),
  setLook: (s, [look]) => s.setLook(look),
  spendPoint: (s, [stat]) => s.spendPoint(stat),
  buyStat: (s, [stat]) => s.buyStat(stat),
  equip: (s, [id]) => s.equip(id),
  unequip: (s, [slot]) => s.unequip(slot),
  sellItem: (s, [id]) => s.sellItem(id),
  upgradeItem: (s, [id]) => s.upgradeItem(id),
  buyItem: (s, [shop, id]) => s.buyItem(shop, id),
  rerollShop: (s, [shop]) => s.rerollShop(shop),
  startMission: (s, [giver, tpl]) => s.startMission(giver, tpl),
  skipMission: (s) => s.skipMission(),
  claimMission: (s) => s.claimMission(),
  policeCheck: (s, [choice]) => s.policeCheck(choice),
  lawyer: (s) => s.lawyer(),
  buyBars: (s, [i]) => s.buyBars(i),
  buyElixir: (s) => s.buyElixir(),
  dailyStep: (s, [i, step]) => s.dailyStep(i, step),
  copDown: (s) => s.copDown(),
  hideStart: (s) => s.hideStart(),
  hideEnd: (s) => s.hideEnd(),
  policeKiller: (s, [choice]) => s.policeKiller(choice),
  catchRipper: (s) => s.catchRipper(),
  takePill: (s, [kind]) => s.takePill(kind),
  hitRunner: (s) => s.hitRunner(),
  crime: (s, [heat, kind]) => { s.crime(Math.max(0, Math.min(10, Number(heat) || 0)), String(kind || '')); return { ok: true }; },
  wantedLose: (s) => s.wantedLose(),
  fightBoss: (s) => s.fightBoss(),
  fightArena: (s, [i]) => s.fightArena(i),
  createGang: (s, [name, tag, color]) => s.createGang(name, tag, color),
  requestJoin: (s, [id]) => s.requestJoin(id),
  cancelRequest: (s, [id]) => s.cancelRequest(id),
  acceptInvite: (s, [id]) => s.acceptInvite(id),
  declineInvite: (s, [id]) => s.declineInvite(id),
  approveJoin: (s, [id]) => s.approveJoin(id),
  denyJoin: (s, [id]) => s.denyJoin(id),
  invitePlayer: (s, [name]) => s.invitePlayer(name),
  cancelInvite: (s, [id]) => s.cancelInvite(id),
  kickMember: (s, [id]) => s.kickMember(id),
  setRank: (s, [id, rank]) => s.setRank(id, rank),
  transferLead: (s, [id]) => s.transferLead(id),
  leaveGang: (s) => s.leaveGang(),
  disbandGang: (s) => s.disbandGang(),
  deposit: (s, [amount]) => s.deposit(amount),
  buyGangUpgrade: (s, [id]) => s.buyGangUpgrade(id),
  refillTurf: (s, [id]) => s.refillTurf(id),
  toggleDefender: (s, [id, member]) => s.toggleDefender(id, member),
  attackTurf: (s, [id]) => s.attackTurf(id),
};

// actions about another gang: it is loaded too (args[0] = its id)
const TARGET_GANG = new Set(['requestJoin', 'cancelRequest', 'acceptInvite', 'declineInvite']);
const isId = (v) => typeof v === 'string' && /^[\w-]{1,64}$/.test(v);

// lazily rolled content (offers, shop stock, timers) is created here, never on the client,
// so every player sees exactly what the server decided
function refresh(s) {
  s.daily();
  Object.keys(GIVERS).forEach((g) => s.offers(g));
  Object.keys(SHOPS).forEach((id) => s.shop(id));
  s.reaper();
  s.runner();
  s.turfView();
  s.buffs();
  s.dailyQuests();
  s.arena(); // opponents (real players when loaded) and the ladder
}

export async function handle(db, userId, action, args = []) {
  if (!userId) return fail('Nie si prihlásený.');
  if (action === 'deleteCharacter') {
    // out of the gang first, so it doesn't keep a member who no longer exists
    const row = await db.loadPlayer(userId);
    if (row && row.gangId) await handle(db, userId, 'leaveGang', []);
    await db.deletePlayer(userId);
    return { ok: true, state: null };
  }
  // halls of fame: read-only, the caller's own state is neither loaded nor saved
  if (action === 'hallOfFame') return { ok: true, list: (await db.hall(200)).map((r) => ({ ...r, me: r.id === userId })) };
  if (action === 'gangHall') {
    const row = await db.loadPlayer(userId);
    return { ok: true, list: await db.gangHall(100), mine: row ? row.gangId : null };
  }
  if (action === 'playerProfile') {
    const id = String(args[0] || '');
    if (!isId(id)) return fail('Hráč neexistuje.');
    const row = await db.loadPlayer(id);
    if (!row) return fail('Hráč neexistuje.');
    return { ok: true, profile: new SimServer({ store: memStore, live: true, state: row.state }).publicProfile() };
  }
  const fn = ACTIONS[action];
  if (!fn) return fail('Neznáma akcia.');
  if (!Array.isArray(args)) args = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await db.loadPlayer(userId);
    if (!row && action !== 'newGame') return { ok: false, error: 'Nemáš postavu.', noCharacter: true, state: null };
    if (row && action === 'newGame') return { ok: false, error: 'Postavu už máš.', state: row.state };
    if (action === 'newGame') {
      const name = String(args[0] || '').trim();
      if (name.length < 3) return fail('Prezývka musí mať aspoň 3 znaky.');
      if (await db.nameTaken(name, userId)) return fail('Túto prezývku už niekto má.');
    }

    const s = new SimServer({ store: memStore, live: true, state: row ? row.state : null });
    s.uid = userId;
    if (row) s.state.pvp.points = row.points; // points live in their own column (other players change them)
    if (s.state && (action === 'arena' || action === 'sync' || action === 'fightArena')) {
      if (action === 'arena' || !s.state.pvp.opponents) s.arenaPool = await db.arenaPool(userId, s.state.pvp.points, 3);
      s.ladderPool = (await db.ladder(13)).filter((r) => r.id !== userId).slice(0, 12);
    }

    // ---- the gang and the city around this player
    const ctx = { gang: null, world: null, people: {}, targets: {}, memberChanges: [], otherLogs: [], tagTaken: false, found: null };
    if (row) {
      const legacy = s.state.gang;
      delete s.state.gang; delete s.state.turf; // gangs and turf live in their own rows now
      if (row.gangId) {
        ctx.gang = await db.loadGang(row.gangId);
        if (!ctx.gang || !ctx.gang.data.members.some((m) => m.id === userId)) { ctx.gang = null; ctx.memberChanges.push({ id: userId, gang: null, expect: row.gangId }); }
      } else if (legacy && legacy.name) {
        // a gang from the single-player days becomes a real one, led by this player
        let tag = legacy.tag;
        if (await db.gangTagTaken(tag)) tag = tag.slice(0, 3) + Math.floor(Math.random() * 10);
        s.ctx = ctx;
        const data = s.migrateLegacyGang({ ...legacy, tag });
        const id = globalThis.crypto.randomUUID();
        ctx.gang = { id, data, wins: 0, version: null };
        ctx.memberChanges.push({ id: userId, gang: id, expect: null });
      }
    }
    const w = await db.loadWorld();
    ctx.world = w ? w.data : null;
    if (TARGET_GANG.has(action) && isId(args[0])) { const t = await db.loadGang(args[0]); if (t) ctx.targets[t.id] = t; }
    if (action === 'invitePlayer') ctx.found = await db.findPlayer(String(args[0] || '').trim().slice(0, 30));
    if (action === 'createGang') ctx.tagTaken = await db.gangTagTaken(String(args[1] || '').trim().toUpperCase());
    // members, requests, invites and every defender in the city (their names and fighting form)
    const ids = new Set();
    if (ctx.gang) ctx.gang.data.members.concat(ctx.gang.data.requests).forEach((m) => ids.add(m.id));
    if (ctx.world) Object.values(ctx.world.objects).forEach((o) => (o.defenders || []).forEach((d) => ids.add(d)));
    ids.delete(userId);
    for (const p of ids.size ? await db.people([...ids]) : []) ctx.people[p.id] = p;
    s.ctx = ctx;
    if (s.state) ctx.people[userId] = { id: userId, name: s.p.name, level: s.p.level, cls: s.p.cls, fighter: s.publicFighter(), gangId: ctx.gang ? ctx.gang.id : null };
    const before = { gang: ctx.gang && json(ctx.gang.data), world: json(ctx.world), targets: Object.fromEntries(Object.values(ctx.targets).map((t) => [t.id, json(t.data)])) };

    let result;
    try { result = fn(s, args); } catch (e) { return fail('Chyba servera: ' + (e && e.message)); }
    if (!s.state) return result;
    if (result && result.ok === false) { // nothing to keep but the gang / city ticking on
      ctx.memberChanges = ctx.memberChanges.filter((m) => m.id === userId && m.gang === null);
    }
    refresh(s);

    // ---- save: the player, every gang that changed, the city if it changed, membership moves
    const gangs = [];
    const g = ctx.gang;
    if (g && (g.deleted || g.version === null || g.winsDelta || json(g.data) !== before.gang)) gangs.push(gangRow(g));
    for (const t of Object.values(ctx.targets)) if (json(t.data) !== before.targets[t.id]) gangs.push(gangRow(t));
    const worldChanged = json(ctx.world) !== before.world;
    const pub = { name: s.p.name, cls: s.p.cls, level: s.p.level, fighter: s.publicFighter(), points: s.state.pvp.points, pointsDelta: row ? s.state.pvp.points - row.points : 0 };
    const saved = await db.saveAll({
      id: userId, state: s.state, version: row ? row.version : null, pub, gangs,
      world: worldChanged ? ctx.world : null, worldVersion: w ? w.version : null, members: ctx.memberChanges,
    });
    if (!saved) continue; // someone else won the race: run again on fresh rows

    if (ctx.otherLogs.length) await db.addGangLogs(ctx.otherLogs);
    if (result && result.result && result.result.defenderId) await db.addPoints(result.result.defenderId, -result.result.defenderLoss);

    // ---- what the client mirrors: the save plus its gang, the city and the gang inbox
    const out = JSON.parse(JSON.stringify(s.state));
    out.uid = userId;
    out.turf = ctx.world;
    const mine = g && !g.deleted && !ctx.gangLeft ? g : null;
    if (mine) {
      const people = {};
      for (const id of [...mine.data.members.map((m) => m.id), ...mine.data.requests.map((r) => r.id)]) if (ctx.people[id]) people[id] = ctx.people[id];
      for (const o of Object.values(ctx.world.objects)) for (const id of o.defenders || []) if (ctx.people[id]) people[id] = ctx.people[id];
      out.gang = { ...mine.data, id: mine.id, wins: (mine.wins || 0) + (mine.winsDelta || 0), people };
    } else {
      out.gang = null;
      out.gangInbox = await db.inbox(userId);
      // people of other gangs' defenders, so the turf screens can show who guards what
      out.turfPeople = ctx.people;
    }
    return { ...result, state: out };
  }
  return fail('Server je zaneprázdnený, skús to znova.');
}

function gangRow(g) {
  return { id: g.id, name: g.data.name, tag: g.data.tag, color: g.data.color, leader: g.data.leader, data: g.data, winsDelta: g.winsDelta || 0, version: g.version, deleted: !!g.deleted };
}

// in-memory database for testing the API in the browser
export function memoryDb() {
  const rows = new Map();
  const gangs = new Map();
  let world = null;
  const copy = (v) => JSON.parse(JSON.stringify(v));
  return {
    rows,
    gangs,
    get world() { return world; },
    async loadPlayer(id) { const r = rows.get(id); return r ? { state: copy(r.state), version: r.version, points: r.points, gangId: r.gangId || null } : null; },
    async saveAll(p) {
      // check everything first, then write: all or nothing like the database transaction
      const r = rows.get(p.id);
      if (p.version === null ? !!r : !r || r.version !== p.version) return false;
      for (const g of p.gangs) {
        const cur = gangs.get(g.id);
        if (g.version === null ? !!cur || [...gangs.values()].some((x) => x.tag.toUpperCase() === g.tag.toUpperCase()) : !cur || cur.version !== g.version) return false;
      }
      if (p.world && (p.worldVersion === null ? !!world : !world || world.version !== p.worldVersion)) return false;
      for (const m of p.members) {
        const t = m.id === p.id ? r : rows.get(m.id);
        if (!t && m.id !== p.id) return false;
        if ('expect' in m && t && (t.gangId || null) !== m.expect) return false;
      }
      const { pointsDelta, ...rest } = p.pub;
      if (p.version === null) rows.set(p.id, { id: p.id, state: copy(p.state), version: 1, gangId: null, ...rest });
      else rows.set(p.id, { ...r, ...rest, points: Math.max(0, r.points + pointsDelta), state: copy(p.state), version: r.version + 1 });
      for (const g of p.gangs) {
        if (g.deleted) { gangs.delete(g.id); continue; }
        const cur = gangs.get(g.id);
        gangs.set(g.id, { id: g.id, name: g.name, tag: g.tag, color: g.color, leader: g.leader, data: copy(g.data), wins: (cur ? cur.wins : 0) + g.winsDelta, version: cur ? cur.version + 1 : 1 });
      }
      if (p.world) world = { data: copy(p.world), version: world ? world.version + 1 : 1 };
      for (const m of p.members) { const t = rows.get(m.id); if (t) t.gangId = m.gang; }
      return true;
    },
    async loadGang(id) { const g = gangs.get(id); return g ? { id: g.id, data: copy(g.data), wins: g.wins, version: g.version } : null; },
    async loadWorld() { return world ? { data: copy(world.data), version: world.version } : null; },
    async people(ids) { return ids.map((id) => rows.get(id)).filter(Boolean).map((r) => ({ id: r.id, name: r.name, level: r.level, cls: r.cls, fighter: r.fighter, gangId: r.gangId || null })); },
    async findPlayer(name) { const r = [...rows.values()].find((x) => x.name.toLowerCase() === name.toLowerCase()); return r ? { id: r.id, name: r.name, level: r.level, cls: r.cls, gangId: r.gangId || null } : null; },
    async gangTagTaken(tag) { return [...gangs.values()].some((g) => g.tag.toUpperCase() === tag.toUpperCase()); },
    async gangHall(n) {
      return [...gangs.values()].sort((a, b) => b.wins - a.wins).slice(0, n)
        .map((g) => ({ id: g.id, name: g.name, tag: g.tag, color: g.color, wins: g.wins, members: g.data.members.length, leaderName: (rows.get(g.leader) || {}).name || '' }));
    },
    async inbox(pid) {
      const list = [...gangs.values()];
      return {
        requests: list.filter((g) => g.data.requests.some((r) => r.id === pid)).map((g) => g.id),
        invites: list.filter((g) => g.data.invites.some((i) => i.id === pid)).map((g) => ({ id: g.id, name: g.name, tag: g.tag, color: g.color })),
      };
    },
    async addGangLogs(list) {
      for (const { gang, entry } of list) {
        const g = gangs.get(gang);
        if (!g) continue;
        g.data.log.unshift(entry); g.data.log.length = Math.min(g.data.log.length, 30); g.version += 1;
      }
    },
    async nameTaken(name, id) { return [...rows.values()].some((r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase()); },
    async arenaPool(id, points, n) {
      return [...rows.values()].filter((r) => r.id !== id).sort((a, b) => Math.abs(a.points - points) - Math.abs(b.points - points)).slice(0, n)
        .map((r) => ({ id: r.id, ...r.fighter, points: r.points }));
    },
    async ladder(n) { return [...rows.values()].sort((a, b) => b.points - a.points).slice(0, n).map((r) => ({ id: r.id, name: r.name, points: r.points })); },
    async hall(n) {
      return [...rows.values()].sort((a, b) => b.level - a.level || b.points - a.points).slice(0, n)
        .map((r) => ({ id: r.id, name: r.name, level: r.level, cls: r.cls, points: r.points }));
    },
    async addPoints(id, delta) { const r = rows.get(id); if (r) r.points = Math.max(0, r.points + delta); },
    async deletePlayer(id) { rows.delete(id); },
  };
}
