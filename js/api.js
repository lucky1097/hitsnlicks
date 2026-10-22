// The game's server API: one call = one action of one player. Runs on the real server (Supabase Edge
// Function) and can run in the browser against a fake database for testing. It loads the player's state,
// runs the same SimServer rules the offline game uses, saves the result and hands the new state back.
//
// db adapter (all async):
//   loadPlayer(id) -> { state, version, points } | null
//   savePlayer(id, state, version|null, pub) -> boolean   (false: someone saved in between, try again)
//     pub = { name, cls, level, fighter, points (new player), pointsDelta (change made by this action) }
//   nameTaken(name, id) -> boolean
//   arenaPool(id, points, n) -> [{ id, name, level, cls, stats, weapon, armor, points }]
//   ladder(n) -> [{ id, name, points }]
//   hall(n) -> [{ id, name, level, cls, points }]   (highest level first)
//   addPoints(id, delta)
//   deletePlayer(id)
import { SimServer } from './server.js?v=20261022181841';
import { GIVERS, SHOPS } from './data.js?v=20261022181841';

const memStore = { load: () => null, save() {}, clear() {} };
const fail = (error) => ({ ok: false, error });

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
  policeKiller: (s, [choice]) => s.policeKiller(choice),
  catchRipper: (s) => s.catchRipper(),
  takePill: (s, [kind]) => s.takePill(kind),
  hitRunner: (s) => s.hitRunner(),
  crime: (s, [heat]) => { s.crime(Math.max(0, Math.min(10, Number(heat) || 0))); return { ok: true }; },
  fightBoss: (s) => s.fightBoss(),
  fightArena: (s, [i]) => s.fightArena(i),
  createGang: (s, [name, tag, color]) => s.createGang(name, tag, color),
  recruit: (s) => s.recruit(),
  promote: (s, [id]) => s.promote(id),
  deposit: (s, [amount]) => s.deposit(amount),
  buyGangUpgrade: (s, [id]) => s.buyGangUpgrade(id),
  refillTurf: (s, [id]) => s.refillTurf(id),
  toggleDefender: (s, [id, member]) => s.toggleDefender(id, member),
  attackTurf: (s, [id]) => s.attackTurf(id),
};

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
  if (action === 'deleteCharacter') { await db.deletePlayer(userId); return { ok: true, state: null }; }
  // hall of fame: read-only, the caller's own state is neither loaded nor saved
  if (action === 'hallOfFame') return { ok: true, list: (await db.hall(200)).map((r) => ({ ...r, me: r.id === userId })) };
  if (action === 'playerProfile') {
    const id = String(args[0] || '');
    if (!/^[\w-]{1,64}$/.test(id)) return fail('Hráč neexistuje.');
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
    if (row) s.state.pvp.points = row.points; // points live in their own column (other players change them)
    if (s.state && (action === 'arena' || action === 'sync' || action === 'fightArena')) {
      if (action === 'arena' || !s.state.pvp.opponents) s.arenaPool = await db.arenaPool(userId, s.state.pvp.points, 3);
      s.ladderPool = (await db.ladder(13)).filter((r) => r.id !== userId).slice(0, 12);
    }

    let result;
    try { result = fn(s, args); } catch (e) { return fail('Chyba servera: ' + (e && e.message)); }
    if (!s.state) return result;
    refresh(s);

    const pub = { name: s.p.name, cls: s.p.cls, level: s.p.level, fighter: s.publicFighter(), points: s.state.pvp.points, pointsDelta: row ? s.state.pvp.points - row.points : 0 };
    const saved = await db.savePlayer(userId, s.state, row ? row.version : null, pub);
    if (!saved) continue; // another request of this player won the race: run again on fresh state

    if (result && result.result && result.result.defenderId) await db.addPoints(result.result.defenderId, -result.result.defenderLoss);
    return { ...result, state: s.state };
  }
  return fail('Server je zaneprázdnený, skús to znova.');
}

// in-memory database for testing the API in the browser
export function memoryDb() {
  const rows = new Map();
  return {
    rows,
    async loadPlayer(id) { const r = rows.get(id); return r ? { state: JSON.parse(JSON.stringify(r.state)), version: r.version, points: r.points } : null; },
    async savePlayer(id, state, version, pub) {
      const r = rows.get(id);
      const { pointsDelta, ...rest } = pub;
      if (version === null) { if (r) return false; rows.set(id, { id, state: JSON.parse(JSON.stringify(state)), version: 1, ...rest }); return true; }
      if (!r || r.version !== version) return false;
      rows.set(id, { ...r, ...rest, points: Math.max(0, r.points + pointsDelta), state: JSON.parse(JSON.stringify(state)), version: version + 1 });
      return true;
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
