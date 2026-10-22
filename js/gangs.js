// Gangs (guilds like in Shakes & Fidget) and Gang Wars: turf objects on the map give the whole gang
// a bonus while it holds them. Rival gangs are computer-run until a real server brings real players.
// Mixed into SimServer, so `this` is the server.
import { CONFIG, F, STATS, CLASSES, RARITIES } from './config.js?v=20261022181841';
import { TURF, TURF_KINDS, RIVAL_GANGS, GANG_COLORS, GANG_UPGRADES, BOT_NAMES } from './data.js?v=20261022181841';
import { makeFighter, simulate, mulberry32 } from './combat.js?v=20261022181841';

const MIN = 60000;
const ok = (data = {}) => ({ ok: true, ...data });
const fail = (error) => ({ ok: false, error });
const seed = () => Math.floor(Math.random() * 2 ** 31);
const RANK_ORDER = ['novacik', 'vojak', 'ruka'];

export const GangMixin = {
  gang() { return this.state.gang || null; },

  // ---------------------------------------------------------------- turf state
  turf() {
    let t = this.state.turf;
    if (!t) {
      const now = Date.now();
      t = this.state.turf = { objects: {}, nextRaidAt: now + this.gameMs(CONFIG.gangRaidEveryMin) };
      TURF.forEach((o) => { t.objects[o.id] = { owner: o.start, strength: 1, at: now, defenders: [], seed: seed(), retryAt: 0, safeUntil: 0 }; });
    }
    // the map changed (new or removed objects): saves follow the current list
    const ids = new Set(TURF.map((o) => o.id));
    if (Object.keys(t.objects).some((id) => !ids.has(id)) || TURF.some((o) => !t.objects[o.id])) {
      for (const id of Object.keys(t.objects)) if (!ids.has(id)) delete t.objects[id];
      TURF.forEach((o) => { if (!t.objects[o.id]) t.objects[o.id] = { owner: o.start, strength: 1, at: Date.now(), defenders: [], seed: seed(), retryAt: 0, safeUntil: 0 }; });
    }
    return t;
  },

  turfObj(id) { return this.turf().objects[id]; },

  strengthNow(o) {
    const hours = ((Date.now() - o.at) / MIN / 60) * this.scale();
    return Math.max(CONFIG.turfMinStrength, o.strength - hours * CONFIG.turfDecayPerHour);
  },

  setStrength(o, v) { o.strength = v; o.at = Date.now(); },

  ownerInfo(owner) {
    if (owner === 'player') { const g = this.gang(); return { id: 'player', name: g.name, tag: g.tag, color: g.color, mine: true }; }
    if (owner && RIVAL_GANGS[owner]) return { id: owner, ...RIVAL_GANGS[owner], mine: false };
    return null;
  },

  // what the map and screens need: one entry per object
  turfView() {
    this.gangTick();
    return TURF.map((d) => {
      const o = this.turfObj(d.id);
      return { ...d, kindInfo: TURF_KINDS[d.kind], owner: this.ownerInfo(o.owner), strength: this.strengthNow(o), defenders: o.defenders, retryAt: o.retryAt, safeUntil: o.safeUntil };
    });
  },

  // ---------------------------------------------------------------- fighters
  // a computer gangster: stats like arena bots, shaped by a seeded rng so a squad stays the same
  botFrom(rng, level, name) {
    const raw = STATS.map(() => 0.6 + rng() * 0.8);
    const classes = Object.keys(CLASSES);
    const rm = RARITIES[Math.floor(rng() * 3)].mult;
    return { name: name || BOT_NAMES[Math.floor(rng() * BOT_NAMES.length)], cls: classes[Math.floor(rng() * classes.length)], raw, wr: rm, off: 0, level };
  },

  // defence strength (decays, refilled from the treasury) toughens defenders: life × √strength
  fighterOf(b, level, strength = 1) {
    const sum = b.raw.reduce((a, x) => a + x, 0);
    const stats = {};
    STATS.forEach((s, i) => { stats[s] = Math.max(5, Math.round(F.npcStat(level) * b.raw[i] * (5 / sum))); });
    const power = F.itemPower(level, b.wr);
    return makeFighter(b.name, level, stats, Math.round(power * CONFIG.weaponDmgMult), { cls: b.cls, armor: Math.round(power * 5), hpMult: Math.sqrt(strength), portrait: 'bot' });
  },

  memberLevel(m) { return Math.max(1, this.p.level + m.off); },
  memberFighter(m, strength = 1) { return this.fighterOf(m, this.memberLevel(m), strength); },

  rivalSquad(o, kind) {
    const rng = mulberry32(o.seed);
    const k = TURF_KINDS[kind];
    const s = this.strengthNow(o);
    return Array.from({ length: k.defenders }, (_, i) => {
      const b = this.botFrom(rng);
      return this.fighterOf(b, Math.max(1, this.p.level + k.lvl[i % 2]), s);
    });
  },

  defenderSquad(o) {
    const g = this.gang();
    const s = this.strengthNow(o);
    return o.defenders.map((id) => g.members.find((m) => m.id === id)).filter(Boolean).map((m) => this.memberFighter(m, s));
  },

  // sequential duels like a S&F guild fight: the winner keeps his remaining life and faces the next one
  teamBattle(As, Ds) {
    const hpA = As.map((f) => f.hp), hpD = Ds.map((f) => f.hp);
    const duels = [];
    let i = 0, j = 0;
    while (i < As.length && j < Ds.length) {
      const fight = simulate({ ...As[i], hp: hpA[i] }, { ...Ds[j], hp: hpD[j] }, seed());
      // ev: the duel's exchanges, so the client can replay it like a normal fight
      const d = { a: i, d: j, winner: fight.winner, rounds: fight.rounds.length, from: [hpA[i], hpD[j]], ev: fight.rounds.map((e) => [e.attacker, e.dodge ? -1 : e.block ? -2 : e.dmg, e.crit ? 1 : 0, e.hp[0], e.hp[1]]) };
      hpA[i] = fight.winner === 0 ? fight.hp[0] : 0;
      hpD[j] = fight.winner === 1 ? fight.hp[1] : 0;
      d.to = [hpA[i], hpD[j]];
      duels.push(d);
      if (fight.winner === 0) j++; else i++;
    }
    return { win: j >= Ds.length, duels };
  },

  // ---------------------------------------------------------------- gang management
  gangCreateCost() { return Math.round(F.cashPerMin(this.p.level) * CONFIG.gangCreateMin); },

  createGang(name, tag, colorId) {
    if (this.gang()) return fail('Už máš gang.');
    name = String(name || '').trim().slice(0, 20);
    tag = String(tag || '').trim().toUpperCase().replace(/[^A-Z0-9ÁČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ]/g, '').slice(0, 4);
    if (name.length < 3) return fail('Meno gangu musí mať aspoň 3 znaky.');
    if (tag.length < 2) return fail('Skratka musí mať 2 až 4 znaky.');
    if (Object.values(RIVAL_GANGS).some((r) => r.tag === tag)) return fail('Túto skratku už má iný gang.');
    const color = (GANG_COLORS.find((c) => c.id === colorId) || GANG_COLORS[0]).color;
    const cost = this.gangCreateCost();
    if (this.p.cash < cost) return fail('Založenie gangu stojí ' + cost + ' $.');
    this.p.cash -= cost;
    this.turf();
    this.state.gang = { name, tag, color, createdAt: Date.now(), treasury: 0, upgrades: { vycvik: 0, vypalne: 0, opevnenie: 0 }, members: [], log: [], nextMemberId: 1, lastDonationAt: Date.now() };
    for (let i = 0; i < CONFIG.gangStartMembers; i++) this.addMember();
    this.gangLog('Gang ' + name + ' [' + tag + '] je založený. Pridali sa prví ' + CONFIG.gangStartMembers + ' členovia.');
    this.save();
    return ok({ cost });
  },

  addMember() {
    const g = this.gang();
    const used = new Set(g.members.map((m) => m.name));
    const names = BOT_NAMES.filter((n) => !used.has(n));
    const b = this.botFrom(Math.random, 0, names.length ? names[Math.floor(Math.random() * names.length)] : 'Nováčik ' + g.nextMemberId);
    const m = { id: 'm' + g.nextMemberId++, name: b.name, cls: b.cls, raw: b.raw, wr: b.wr, off: Math.floor(Math.random() * 4) - 2, rank: 'novacik' };
    g.members.push(m);
    return m;
  },

  recruitCost() { return Math.round(F.cashPerMin(this.p.level) * CONFIG.gangRecruitMin); },

  recruit() {
    const g = this.gang();
    if (!g) return fail('Nemáš gang.');
    if (g.members.length + 1 >= CONFIG.gangSlots) return fail('Gang je plný (' + CONFIG.gangSlots + ' miest).');
    const cost = this.recruitCost();
    if (g.treasury < cost) return fail('V pokladnici chýbajú peniaze.');
    g.treasury -= cost;
    const m = this.addMember();
    this.gangLog(m.name + ' sa pridal do gangu.');
    this.save();
    return ok({ member: m });
  },

  promote(id) {
    const g = this.gang();
    const m = g && g.members.find((x) => x.id === id);
    if (!m) return fail('Taký člen nie je.');
    let next = RANK_ORDER[(RANK_ORDER.indexOf(m.rank) + 1) % RANK_ORDER.length];
    if (next === 'ruka' && g.members.some((x) => x.rank === 'ruka' && x !== m)) next = 'novacik'; // only one right hand
    m.rank = next;
    this.save();
    return ok({ rank: next });
  },

  deposit(amount) {
    const g = this.gang();
    if (!g) return fail('Nemáš gang.');
    amount = Math.min(Math.round(amount), this.p.cash);
    if (amount <= 0) return fail('Nemáš peniaze na vklad.');
    this.p.cash -= amount;
    g.treasury += amount;
    this.save();
    return ok({ amount });
  },

  gangUpgradeCost(id) { const n = this.gang().upgrades[id] + 1; return Math.round(F.cashPerMin(this.p.level) * CONFIG.gangUpgradeMin * Math.pow(n, 1.5)); },

  buyGangUpgrade(id) {
    const g = this.gang();
    if (!g || !GANG_UPGRADES[id]) return fail('Neznáme vylepšenie.');
    if (g.upgrades[id] >= CONFIG.gangUpgradeMax) return fail('Vylepšenie je na maxime.');
    const cost = this.gangUpgradeCost(id);
    if (g.treasury < cost) return fail('V pokladnici chýbajú peniaze.');
    g.treasury -= cost;
    g.upgrades[id] += 1;
    this.gangLog(GANG_UPGRADES[id].name + ' vylepšené na úroveň ' + g.upgrades[id] + '.');
    this.save();
    return ok();
  },

  gangLog(text, bad = false) {
    const g = this.gang();
    if (!g) return;
    g.log.unshift({ at: Date.now(), text, bad });
    g.log.length = Math.min(g.log.length, 30);
    if (bad) g.unseenBad = (g.unseenBad || 0) + 1;
  },

  // ---------------------------------------------------------------- bonuses
  // summed over held objects and gang upgrades, each capped
  gangBonus() {
    const b = { cash: 0, xp: 0, time: 0, epic: 0 };
    const g = this.gang();
    if (!g) return b;
    this.gangTick();
    for (const d of TURF) {
      if (this.turfObj(d.id).owner !== 'player') continue;
      for (const [k, v] of Object.entries(TURF_KINDS[d.kind].bonus)) b[k] += v;
    }
    b.xp += g.upgrades.vycvik * GANG_UPGRADES.vycvik.per;
    b.cash += g.upgrades.vypalne * GANG_UPGRADES.vypalne.per;
    for (const k of Object.keys(b)) b[k] = Math.min(CONFIG.gangBonusCap, b[k]);
    return b;
  },

  // ---------------------------------------------------------------- objects
  refillCost() { return Math.round(F.cashPerMin(this.p.level) * CONFIG.turfRefillMin); },
  fullStrength() { const g = this.gang(); return 1 + (g ? g.upgrades.opevnenie * GANG_UPGRADES.opevnenie.per : 0); },

  refillTurf(id) {
    const g = this.gang();
    const o = this.turfObj(id);
    if (!g || !o || o.owner !== 'player') return fail('Tento objekt nedržíte.');
    if (this.strengthNow(o) >= this.fullStrength() - 0.005) return fail('Obrana je plná.');
    const cost = this.refillCost();
    if (g.treasury < cost) return fail('V pokladnici chýbajú peniaze.');
    g.treasury -= cost;
    this.setStrength(o, this.fullStrength());
    this.save();
    return ok({ cost });
  },

  // members defend one object at a time
  toggleDefender(id, memberId) {
    const g = this.gang();
    const o = this.turfObj(id);
    if (!g || !o || o.owner !== 'player') return fail('Tento objekt nedržíte.');
    const d = TURF.find((x) => x.id === id);
    if (o.defenders.includes(memberId)) { o.defenders = o.defenders.filter((x) => x !== memberId); this.save(); return ok(); }
    if (o.defenders.length >= TURF_KINDS[d.kind].slots) return fail('Na objekte je plno obrancov.');
    for (const other of Object.values(this.turf().objects)) other.defenders = other.defenders.filter((x) => x !== memberId);
    o.defenders.push(memberId);
    this.save();
    return ok();
  },

  attackSquad() {
    const g = this.gang();
    const team = [this.playerFighter()];
    [...g.members].sort((a, b) => b.off - a.off).slice(0, CONFIG.gangAttackSize - 1).forEach((m) => team.push(this.memberFighter(m)));
    return team;
  },

  attackTurf(id) {
    const g = this.gang();
    if (!g) return fail('Na boj o územie potrebuješ gang.');
    const d = TURF.find((x) => x.id === id);
    const o = this.turfObj(id);
    if (!d) return fail('Neznámy objekt.');
    this.gangTick();
    if (o.owner === 'player') return fail('Tento objekt už držíte.');
    const now = Date.now();
    if (now < o.retryAt) return fail('Ďalší útok na tento objekt až o chvíľu.');
    if (now < o.safeUntil) return fail('Objekt bol práve obsadený. Chvíľu je pod ochranou.');
    const A = this.attackSquad();
    const prev = o.owner;
    const D = prev ? this.rivalSquad(o, d.kind) : [];
    const battle = this.teamBattle(A, D);
    const L = this.p.level;
    const res = { win: battle.win, cash: 0, xp: 0, levelUps: 0, prev: this.ownerInfo(prev), name: d.name };
    this.addHeat(CONFIG.gangAttackHeat);
    if (battle.win) {
      o.owner = 'player';
      this.setStrength(o, this.fullStrength());
      o.safeUntil = now + this.gameMs(CONFIG.gangSafeMin);
      o.retryAt = 0;
      // the members who fought move in as defenders (if they don't guard something else)
      const busy = new Set(Object.values(this.turf().objects).flatMap((x) => x.defenders));
      o.defenders = [...g.members].sort((a, b) => b.off - a.off).filter((m) => !busy.has(m.id)).slice(0, TURF_KINDS[d.kind].slots).map((m) => m.id);
      res.cash = Math.round(F.cashPerMin(L) * CONFIG.turfRewardMin);
      res.xp = Math.round(F.xpNext(L) * 0.03);
      this.p.cash += res.cash;
      res.levelUps = this.addXp(res.xp);
      this.gangLog(prev ? 'Prebrali ste ' + d.name + ' gangu ' + RIVAL_GANGS[prev].name + '.' : 'Obsadili ste ' + d.name + '.');
    } else {
      o.retryAt = now + this.gameMs(CONFIG.gangRetryMin);
      this.gangLog('Útok na ' + d.name + ' nevyšiel.', true);
      g.unseenBad = Math.max(0, (g.unseenBad || 1) - 1); // you saw this one yourself
    }
    this.save();
    return ok({ A, D, battle, result: res, turf: d });
  },

  // ---------------------------------------------------------------- the world moves on (once per game hour)
  gangTick() {
    const t = this.turf();
    const now = Date.now();
    let changed = false, n = 0;
    while (now >= t.nextRaidAt && n < 6) {
      this.gangHour();
      t.nextRaidAt += this.gameMs(CONFIG.gangRaidEveryMin);
      changed = true; n++;
    }
    if (now >= t.nextRaidAt) t.nextRaidAt = now + this.gameMs(CONFIG.gangRaidEveryMin); // long absence: skip the rest
    if (changed) this.save();
  },

  gangHour() {
    const g = this.gang();
    const rivals = Object.keys(RIVAL_GANGS);
    const now = Date.now();
    if (g) {
      // computer members chip into the treasury
      const sum = g.members.reduce((a, m) => a + F.cashPerMin(this.memberLevel(m)) * CONFIG.gangDonationMin, 0);
      g.treasury += Math.round(sum);
    }
    for (const d of TURF) {
      const o = this.turfObj(d.id);
      if (o.owner === 'player') {
        if (now < o.safeUntil || Math.random() >= CONFIG.gangRaidChance) continue;
        const attacker = rivals[Math.floor(Math.random() * rivals.length)];
        const rng = mulberry32(seed());
        const A = Array.from({ length: TURF_KINDS[d.kind].defenders }, () => this.fighterOf(this.botFrom(rng), Math.max(1, this.p.level - 1)));
        const D = this.defenderSquad(o);
        const lost = !D.length || !this.teamBattle(D, A).win;
        if (lost) {
          o.owner = attacker; o.defenders = []; o.seed = seed(); this.setStrength(o, 1);
          o.safeUntil = now + this.gameMs(CONFIG.gangSafeMin);
          this.gangLog(RIVAL_GANGS[attacker].name + ' vám prebrali ' + d.name + (D.length ? '.' : ' – nikto ho nebránil.'), true);
        } else {
          this.setStrength(o, Math.max(CONFIG.turfMinStrength, this.strengthNow(o) - 0.05));
          this.gangLog('Ubránili ste ' + d.name + ' pred gangom ' + RIVAL_GANGS[attacker].name + '.');
        }
      } else if (now >= o.safeUntil && Math.random() < CONFIG.gangRivalMoveChance) {
        const others = rivals.filter((r) => r !== o.owner);
        o.owner = others[Math.floor(Math.random() * others.length)];
        o.seed = seed(); this.setStrength(o, 1);
      }
    }
  },
};
