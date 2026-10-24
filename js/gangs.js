// Gangs (guilds like in Shakes & Fidget) and Gang Wars, shared by real players.
// Online the server (js/api.js) loads three things around every action and hands them in as this.ctx:
//   ctx.gang   = { id, data, wins, version } of the player's gang (null without one)
//   ctx.world  = the shared city: 12 turf objects every gang fights over, plus the computer rivals
//   ctx.people = { playerId: { name, level, cls, fighter, gangId } } for members, requests and defenders
// and saves whatever changed in one go. Offline (no server) the gang and the city live in the save itself
// and the player is the only member. Mixed into SimServer, so `this` is the server.
import { CONFIG, F, STATS, CLASSES } from './config.js?v=20261024115302';
import { TURF, TURF_KINDS, RIVAL_GANGS, GANG_COLORS, GANG_UPGRADES, BOT_NAMES } from './data.js?v=20261024115302';
import { makeFighter, simulate, mulberry32 } from './combat.js?v=20261024115302';

const MIN = 60000;
const ok = (data = {}) => ({ ok: true, ...data });
const fail = (error) => ({ ok: false, error });
const seed = () => Math.floor(Math.random() * 2 ** 31);
const newId = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : 'g' + Date.now() + Math.floor(Math.random() * 1e6));

// what each rank may do (boss = the founder or whoever got the lead)
const CAN = {
  attack: ['boss', 'ruka', 'vojak'],
  refill: ['boss', 'ruka', 'vojak'],
  upgrade: ['boss', 'ruka'],
  recruit: ['boss', 'ruka'], // answer requests, invite players
  kick: ['boss'],
  rank: ['boss'],
  lead: ['boss'],
};
const ONLINE_ONLY = 'Funguje len online, s inými hráčmi.';

export const GangMixin = {
  // ---------------------------------------------------------------- whose gang, who am I
  selfId() { return this.uid || (this.state && this.state.uid) || 'me'; },
  gangRow() {
    if (this.ctx) return this.ctx.gang;
    let g = this.state && this.state.gang;
    if (g && !g.leader) g = this.state.gang = this.migrateLegacyGang(g); // an offline save from the computer-member days
    return g ? { id: g.id || 'local', data: g, wins: g.wins || 0 } : null;
  },
  gang() { const r = this.gangRow(); return r ? r.data : null; },
  myGangId() { const r = this.gangRow(); return r ? r.id : null; },
  myRank() { const g = this.gang(); const m = g && g.members.find((x) => x.id === this.selfId()); return m ? m.rank : null; },
  can(what) { return CAN[what].includes(this.myRank()); },

  // name, level, class and arena snapshot of the players around the gang
  people() {
    if (this.ctx) return this.ctx.people;
    const g = this.state.gang;
    if (g && g.people) return g.people; // the online mirror: sent by the server
    if (this.state.turfPeople) return this.state.turfPeople; // mirror without a gang: who guards the city
    return { [this.selfId()]: { name: this.p.name, level: this.p.level, cls: this.p.cls, fighter: this.publicFighter(), gangId: this.myGangId() } };
  },
  person(id) { return this.people()[id] || null; },

  // city timers run on real time on the server (test mode only speeds up the offline game)
  wMs(min) { return this.ctx ? min * MIN : this.gameMs(min); },
  wScale() { return this.ctx ? 1 : this.scale(); },

  // ---------------------------------------------------------------- the city
  freshObj(owner) { return { owner, og: null, strength: 1, at: Date.now(), defenders: [], seed: seed(), retry: {}, safeUntil: 0 }; },

  turf() {
    let t = this.ctx ? this.ctx.world : this.state.turf;
    if (!t) {
      t = { objects: {}, nextRaidAt: Date.now() + this.wMs(CONFIG.gangRaidEveryMin) };
      TURF.forEach((o) => { t.objects[o.id] = this.freshObj(o.start); });
      if (this.ctx) this.ctx.world = t; else this.state.turf = t;
    }
    // the map changed (new or removed objects): saves follow the current list
    const ids = new Set(TURF.map((o) => o.id));
    for (const id of Object.keys(t.objects)) if (!ids.has(id)) delete t.objects[id];
    TURF.forEach((o) => { if (!t.objects[o.id]) t.objects[o.id] = this.freshObj(o.start); });
    // saves from the single-player gangs: owner 'player', one retry time
    for (const o of Object.values(t.objects)) {
      if (o.owner === 'player') o.owner = this.myGangId() || null;
      if (!o.retry) { o.retry = {}; delete o.retryAt; }
    }
    return t;
  },

  turfObj(id) { return this.turf().objects[id]; },

  strengthNow(o) {
    if (this.ev().noDecay) return o.strength; // Víkend gangov: defence doesn't wear off
    const hours = ((Date.now() - o.at) / MIN / 60) * this.wScale();
    return Math.max(CONFIG.turfMinStrength, o.strength - hours * CONFIG.turfDecayPerHour);
  },

  setStrength(o, v) { o.strength = v; o.at = Date.now(); },

  ownerInfo(o) {
    const ow = o && o.owner;
    if (!ow) return null;
    if (RIVAL_GANGS[ow]) return { id: ow, ...RIVAL_GANGS[ow], mine: false, rival: true };
    const mine = ow === this.myGangId();
    const g = mine ? this.gang() : o.og || { name: 'Gang', tag: '?', color: '#9b968b' };
    return { id: ow, name: g.name, tag: g.tag, color: g.color, mine };
  },

  // what the map and screens need: one entry per object
  turfView() {
    this.gangTick();
    const gid = this.myGangId();
    return TURF.map((d) => {
      const o = this.turfObj(d.id);
      return { ...d, kindInfo: TURF_KINDS[d.kind], owner: this.ownerInfo(o), strength: this.strengthNow(o), defenders: o.defenders, retryAt: (gid && o.retry[gid]) || 0, safeUntil: o.safeUntil };
    });
  },

  // ---------------------------------------------------------------- fighters
  // a computer gangster: stats like arena bots, shaped by a seeded rng so a squad stays the same
  botFrom(rng, level, name) {
    const raw = STATS.map(() => 0.6 + rng() * 0.8);
    const classes = Object.keys(CLASSES);
    const rm = CONFIG.botGearMults[Math.floor(rng() * CONFIG.botGearMults.length)];
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

  // a real member as he stands in his last saved arena snapshot (you: as you are now)
  memberFighter(id, strength = 1) {
    if (id === this.selfId()) { const f = this.playerFighter(); return { ...f, hp: Math.round(f.hp * Math.sqrt(strength)), pid: id }; }
    const p = this.person(id);
    if (!p || !p.fighter) return null;
    const f = p.fighter;
    return { ...makeFighter(p.name, f.level, f.stats, f.weapon, { cls: f.cls, armor: f.armor || 0, hpMult: Math.sqrt(strength), wbase: f.wbase || null }), pid: id };
  },

  rivalSquad(o, kind, level = this.p.level) {
    const rng = mulberry32(o.seed);
    const k = TURF_KINDS[kind];
    const s = this.strengthNow(o);
    return Array.from({ length: k.defenders }, (_, i) => this.fighterOf(this.botFrom(rng), Math.max(1, level + k.lvl[i % 2]), s));
  },

  defenderSquad(o) {
    const s = this.strengthNow(o);
    return o.defenders.map((id) => this.memberFighter(id, s)).filter(Boolean);
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

  // ---------------------------------------------------------------- founding a gang
  gangCreateCost() { return Math.round(F.cashPerMin(this.p.level) * CONFIG.gangCreateMin); },

  createGang(name, tag, colorId) {
    if (this.gang()) return fail('Už máš gang.');
    name = String(name || '').trim().slice(0, 20);
    tag = String(tag || '').trim().toUpperCase().replace(/[^A-Z0-9ÁČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ]/g, '').slice(0, 4);
    if (name.length < 3) return fail('Meno gangu musí mať aspoň 3 znaky.');
    if (tag.length < 2) return fail('Skratka musí mať 2 až 4 znaky.');
    if (Object.values(RIVAL_GANGS).some((r) => r.tag === tag) || (this.ctx && this.ctx.tagTaken)) return fail('Túto skratku už má iný gang.');
    const color = (GANG_COLORS.find((c) => c.id === colorId) || GANG_COLORS[0]).color;
    const cost = this.gangCreateCost();
    if (this.p.cash < cost) return fail('Založenie gangu stojí ' + cost + ' $.');
    this.p.cash -= cost;
    const me = this.selfId();
    const data = { name, tag, color, createdAt: Date.now(), leader: me, treasury: 0, upgrades: { vycvik: 0, vypalne: 0, opevnenie: 0 }, members: [{ id: me, rank: 'boss', joinedAt: Date.now() }], requests: [], invites: [], log: [] };
    if (this.ctx) {
      const id = newId();
      this.ctx.gang = { id, data, wins: 0, version: null };
      this.ctx.memberChanges.push({ id: me, gang: id, expect: null });
    } else {
      this.state.gang = data;
    }
    this.turf();
    this.gangLog('Gang ' + name + ' [' + tag + '] je založený.');
    this.save();
    return ok({ cost });
  },

  // an old single-player gang (computer members) becomes a real one led by this player
  migrateLegacyGang(old) {
    const me = this.selfId();
    return {
      name: old.name, tag: old.tag, color: old.color, createdAt: old.createdAt || Date.now(), leader: me,
      treasury: old.treasury || 0, upgrades: old.upgrades || { vycvik: 0, vypalne: 0, opevnenie: 0 },
      members: [{ id: me, rank: 'boss', joinedAt: old.createdAt || Date.now() }], requests: [], invites: [],
      log: [{ at: Date.now(), text: 'Počítačoví členovia odišli. Do gangu teraz vstupujú skutoční hráči.', bad: false }].concat(old.log || []).slice(0, 30),
    };
  },

  // ---------------------------------------------------------------- joining and leaving
  targetGang(gangId) { return (this.ctx && this.ctx.targets[gangId]) || null; },

  // a player without a gang asks to join
  requestJoin(gangId) {
    if (!this.ctx) return fail(ONLINE_ONLY);
    if (this.gang()) return fail('Už si v gangu.');
    const t = this.targetGang(gangId);
    if (!t) return fail('Taký gang už neexistuje.');
    const me = this.selfId();
    if (t.data.members.length >= CONFIG.gangSlots) return fail('Gang je plný.');
    if (t.data.requests.some((r) => r.id === me)) return ok({ already: true });
    t.data.requests.push({ id: me, name: this.p.name, level: this.p.level, cls: this.p.cls, at: Date.now() });
    t.data.requests = t.data.requests.slice(-20);
    return ok();
  },

  cancelRequest(gangId) {
    const t = this.targetGang(gangId);
    if (!t) return fail('Taký gang už neexistuje.');
    t.data.requests = t.data.requests.filter((r) => r.id !== this.selfId());
    return ok();
  },

  // join a gang that invited you
  acceptInvite(gangId) {
    if (!this.ctx) return fail(ONLINE_ONLY);
    if (this.gang()) return fail('Už si v gangu.');
    const t = this.targetGang(gangId);
    const me = this.selfId();
    if (!t || !t.data.invites.some((i) => i.id === me)) return fail('Pozvánka už neplatí.');
    if (t.data.members.length >= CONFIG.gangSlots) return fail('Gang je medzitým plný.');
    t.data.invites = t.data.invites.filter((i) => i.id !== me);
    t.data.requests = t.data.requests.filter((r) => r.id !== me);
    t.data.members.push({ id: me, rank: 'novacik', joinedAt: Date.now() });
    this.ctx.memberChanges.push({ id: me, gang: gangId, expect: null });
    this.logTo(gangId, this.p.name + ' prijal pozvánku a je v gangu.');
    return ok({ name: t.data.name });
  },

  declineInvite(gangId) {
    const t = this.targetGang(gangId);
    if (!t) return ok();
    t.data.invites = t.data.invites.filter((i) => i.id !== this.selfId());
    return ok();
  },

  // boss / right hand: take a requesting player in, or turn him down
  approveJoin(playerId) {
    if (!this.ctx) return fail(ONLINE_ONLY);
    const g = this.gang();
    if (!g) return fail('Nemáš gang.');
    if (!this.can('recruit')) return fail('Žiadosti vybavuje šéf alebo pravá ruka.');
    const r = g.requests.find((x) => x.id === playerId);
    if (!r) return fail('Táto žiadosť už neplatí.');
    g.requests = g.requests.filter((x) => x.id !== playerId);
    const p = this.person(playerId);
    if (!p || p.gangId) { this.save(); return ok({ gone: true }); } // joined another gang meanwhile
    if (g.members.length >= CONFIG.gangSlots) return fail('Gang je plný (' + CONFIG.gangSlots + ' členov).');
    g.members.push({ id: playerId, rank: 'novacik', joinedAt: Date.now() });
    g.invites = g.invites.filter((i) => i.id !== playerId);
    this.ctx.memberChanges.push({ id: playerId, gang: this.myGangId(), expect: null });
    this.gangLog(r.name + ' je nový člen gangu.');
    this.save();
    return ok({ name: r.name });
  },

  denyJoin(playerId) {
    const g = this.gang();
    if (!g || !this.can('recruit')) return fail('Žiadosti vybavuje šéf alebo pravá ruka.');
    g.requests = g.requests.filter((x) => x.id !== playerId);
    this.save();
    return ok();
  },

  // boss / right hand: invite a player by nickname
  invitePlayer(name) {
    if (!this.ctx) return fail(ONLINE_ONLY);
    const g = this.gang();
    if (!g) return fail('Nemáš gang.');
    if (!this.can('recruit')) return fail('Pozývať môže šéf alebo pravá ruka.');
    const f = this.ctx.found;
    if (!f) return fail('Hráč s takou prezývkou nie je.');
    if (f.id === this.selfId() || g.members.some((m) => m.id === f.id)) return fail(f.name + ' už je v tvojom gangu.');
    if (f.gangId) return fail(f.name + ' už je v inom gangu.');
    if (g.members.length >= CONFIG.gangSlots) return fail('Gang je plný.');
    if (!g.invites.some((i) => i.id === f.id)) g.invites.push({ id: f.id, name: f.name, at: Date.now() });
    g.invites = g.invites.slice(-20);
    this.save();
    return ok({ name: f.name });
  },

  cancelInvite(playerId) {
    const g = this.gang();
    if (!g || !this.can('recruit')) return fail('Pozvánky ruší šéf alebo pravá ruka.');
    g.invites = g.invites.filter((i) => i.id !== playerId);
    this.save();
    return ok();
  },

  // a member leaves: off every object he defended, out of the gang
  dropMember(id) {
    const g = this.gang(), gid = this.myGangId();
    g.members = g.members.filter((m) => m.id !== id);
    for (const o of Object.values(this.turf().objects)) if (o.owner === gid) o.defenders = o.defenders.filter((x) => x !== id);
    if (this.ctx) this.ctx.memberChanges.push({ id, gang: null, expect: gid });
  },

  kickMember(id) {
    const g = this.gang();
    if (!g) return fail('Nemáš gang.');
    if (!this.can('kick')) return fail('Vyhodiť člena môže len šéf.');
    if (id === this.selfId()) return fail('Sám seba nevyhodíš. Môžeš z gangu odísť.');
    const m = g.members.find((x) => x.id === id);
    if (!m) return fail('Taký člen nie je.');
    const name = (this.person(id) || {}).name || 'Člen';
    this.dropMember(id);
    this.gangLog(name + ' bol vyhodený z gangu.', true);
    this.save();
    return ok({ name });
  },

  // boss sets a rank; one right hand at a time
  setRank(id, rank) {
    const g = this.gang();
    if (!g) return fail('Nemáš gang.');
    if (!this.can('rank')) return fail('Hodnosti mení len šéf.');
    if (!['ruka', 'vojak', 'novacik'].includes(rank)) return fail('Neznáma hodnosť.');
    const m = g.members.find((x) => x.id === id);
    if (!m || m.rank === 'boss') return fail('Tomuto členovi hodnosť nezmeníš.');
    if (rank === 'ruka') g.members.forEach((x) => { if (x.rank === 'ruka') x.rank = 'vojak'; });
    m.rank = rank;
    this.save();
    return ok();
  },

  transferLead(id) {
    const g = this.gang();
    if (!g || !this.can('lead')) return fail('Vedenie môže odovzdať len šéf.');
    const m = g.members.find((x) => x.id === id);
    if (!m || id === this.selfId()) return fail('Taký člen nie je.');
    g.members.forEach((x) => { if (x.rank === 'ruka') x.rank = 'vojak'; });
    g.members.find((x) => x.id === this.selfId()).rank = 'ruka';
    m.rank = 'boss';
    g.leader = id;
    this.gangLog(((this.person(id) || {}).name || 'Člen') + ' je novým šéfom gangu.');
    this.save();
    return ok();
  },

  // the boss's lead passes to the right hand, else to the longest-serving member; the last one out closes the gang
  leaveGang() {
    const g = this.gang();
    if (!g) return fail('Nie si v gangu.');
    const me = this.selfId();
    if (g.members.length <= 1) return this.disbandGang(true);
    const wasBoss = this.myRank() === 'boss';
    this.dropMember(me);
    if (wasBoss) {
      const next = g.members.find((x) => x.rank === 'ruka') || [...g.members].sort((a, b) => a.joinedAt - b.joinedAt)[0];
      next.rank = 'boss';
      g.leader = next.id;
    }
    this.gangLog(this.p.name + ' odišiel z gangu.' + (wasBoss ? ' Vedenie prebral ' + ((this.person(g.leader) || {}).name || 'ďalší člen') + '.' : ''), true);
    if (this.ctx) this.ctx.gangLeft = true; else delete this.state.gang;
    this.save();
    return ok();
  },

  // boss closes the gang: everyone out, its objects stand free
  disbandGang(lastOne = false) {
    const g = this.gang();
    if (!g) return fail('Nie si v gangu.');
    if (!lastOne && !this.can('lead')) return fail('Gang môže rozpustiť len šéf.');
    const gid = this.myGangId();
    for (const o of Object.values(this.turf().objects)) {
      if (o.owner !== gid) continue;
      Object.assign(o, this.freshObj(null));
    }
    if (this.ctx) {
      g.members.forEach((m) => this.ctx.memberChanges.push({ id: m.id, gang: null, expect: gid }));
      this.ctx.gang.deleted = true;
    } else {
      delete this.state.gang;
    }
    this.save();
    return ok();
  },

  // ---------------------------------------------------------------- treasury and upgrades
  deposit(amount) {
    const g = this.gang();
    if (!g) return fail('Nemáš gang.');
    amount = Math.min(Math.round(amount), this.p.cash);
    if (amount <= 0) return fail('Nemáš peniaze na vklad.');
    this.p.cash -= amount;
    g.treasury += amount;
    if (amount >= F.cashPerMin(this.p.level) * 30) this.gangLog(this.p.name + ' vložil do pokladnice ' + amount + ' $.');
    this.save();
    return ok({ amount });
  },

  gangUpgradeCost(id) { const n = this.gang().upgrades[id] + 1; return Math.round(F.cashPerMin(this.p.level) * CONFIG.gangUpgradeMin * Math.pow(n, 1.5)); },

  buyGangUpgrade(id) {
    const g = this.gang();
    if (!g || !GANG_UPGRADES[id]) return fail('Neznáme vylepšenie.');
    if (!this.can('upgrade')) return fail('Vylepšenia kupuje šéf alebo pravá ruka.');
    if (g.upgrades[id] >= CONFIG.gangUpgradeMax) return fail('Vylepšenie je na maxime.');
    const cost = this.gangUpgradeCost(id);
    if (g.treasury < cost) return fail('V pokladnici chýbajú peniaze.');
    g.treasury -= cost;
    g.upgrades[id] += 1;
    this.gangLog(GANG_UPGRADES[id].name + ' vylepšené na úroveň ' + g.upgrades[id] + '.');
    this.save();
    return ok();
  },

  // a line in a gang's diary: yours right here, another gang's through the server after the save
  logTo(gangId, text, bad = false) {
    if (!gangId) return;
    const entry = { at: Date.now(), text, bad };
    if (gangId === this.myGangId()) { const g = this.gang(); g.log.unshift(entry); g.log.length = Math.min(g.log.length, 30); return; }
    const t = this.targetGang(gangId);
    if (t) { t.data.log.unshift(entry); t.data.log.length = Math.min(t.data.log.length, 30); return; }
    if (this.ctx) this.ctx.otherLogs.push({ gang: gangId, entry });
  },

  gangLog(text, bad = false) { this.logTo(this.myGangId(), text, bad); },

  // ---------------------------------------------------------------- bonuses
  // summed over held objects and gang upgrades, each capped
  gangBonus() {
    const b = { cash: 0, xp: 0, time: 0, epic: 0 };
    const g = this.gang();
    if (!g) return b;
    this.gangTick();
    const gid = this.myGangId();
    for (const d of TURF) {
      if (this.turfObj(d.id).owner !== gid) continue;
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
    if (!g || !o || o.owner !== this.myGangId()) return fail('Tento objekt nedržíte.');
    if (!this.can('refill')) return fail('Nováčik obranu dopĺňať nemôže.');
    if (this.strengthNow(o) >= this.fullStrength() - 0.005) return fail('Obrana je plná.');
    const cost = this.refillCost();
    if (g.treasury < cost) return fail('V pokladnici chýbajú peniaze.');
    g.treasury -= cost;
    this.setStrength(o, this.fullStrength());
    this.save();
    return ok({ cost });
  },

  // every member defends one object at a time; you post yourself, the boss can take anyone off
  toggleDefender(id, memberId) {
    const g = this.gang();
    const o = this.turfObj(id);
    const gid = this.myGangId();
    memberId = memberId || this.selfId();
    if (!g || !o || o.owner !== gid) return fail('Tento objekt nedržíte.');
    if (!g.members.some((m) => m.id === memberId)) return fail('Taký člen nie je.');
    const d = TURF.find((x) => x.id === id);
    if (o.defenders.includes(memberId)) {
      if (memberId !== this.selfId() && !this.can('kick')) return fail('Iného člena z obrany stiahne len šéf.');
      o.defenders = o.defenders.filter((x) => x !== memberId);
      this.save();
      return ok();
    }
    if (memberId !== this.selfId()) return fail('Brániť sa prihlasuje každý sám.');
    if (o.defenders.length >= TURF_KINDS[d.kind].slots) return fail('Na objekte je plno obrancov.');
    for (const other of Object.values(this.turf().objects)) if (other.owner === gid) other.defenders = other.defenders.filter((x) => x !== memberId);
    o.defenders.push(memberId);
    this.save();
    return ok();
  },

  // you and the strongest other members (their saved arena form; they don't have to be online)
  attackSquad() {
    const g = this.gang();
    const team = [this.memberFighter(this.selfId())];
    const others = g.members.filter((m) => m.id !== this.selfId()).map((m) => this.memberFighter(m.id)).filter(Boolean)
      .sort((a, b) => b.level - a.level).slice(0, CONFIG.gangAttackSize - 1);
    return team.concat(others);
  },

  attackTurf(id) {
    const g = this.gang();
    if (!g) return fail('Na boj o územie potrebuješ gang.');
    if (!this.can('attack')) return fail('Nováčik ešte na územie útočiť nemôže. Šéf ti musí dať hodnosť.');
    const d = TURF.find((x) => x.id === id);
    const o = this.turfObj(id);
    if (!d) return fail('Neznámy objekt.');
    this.gangTick();
    const gid = this.myGangId();
    if (o.owner === gid) return fail('Tento objekt už držíte.');
    const now = Date.now();
    if (now < (o.retry[gid] || 0)) return fail('Ďalší útok na tento objekt až o chvíľu.');
    if (now < o.safeUntil) return fail('Objekt bol práve obsadený. Chvíľu je pod ochranou.');
    const A = this.attackSquad();
    const prev = o.owner;
    const prevInfo = this.ownerInfo(o);
    const D = !prev ? [] : RIVAL_GANGS[prev] ? this.rivalSquad(o, d.kind) : this.defenderSquad(o);
    const battle = this.teamBattle(A, D);
    const L = this.p.level;
    const res = { win: battle.win, cash: 0, xp: 0, levelUps: 0, prev: prevInfo, name: d.name };
    this.addHeat(CONFIG.gangAttackHeat);
    if (battle.win) {
      if (prev && !RIVAL_GANGS[prev]) this.logTo(prev, 'Gang ' + g.name + ' [' + g.tag + '] vám prebral ' + d.name + '.', true);
      o.owner = gid;
      o.og = { name: g.name, tag: g.tag, color: g.color };
      this.setStrength(o, this.fullStrength());
      o.safeUntil = now + this.wMs(CONFIG.gangSafeMin);
      o.retry = {};
      o.seed = seed();
      // the members who fought move in as defenders (if they don't guard something else)
      const busy = new Set(Object.values(this.turf().objects).filter((x) => x.owner === gid).flatMap((x) => x.defenders));
      o.defenders = A.map((f) => f.pid).filter((pid) => pid && !busy.has(pid)).slice(0, TURF_KINDS[d.kind].slots);
      const ev = this.ev(); // weekend events: double cash / XP, Víkend gangov
      res.cash = Math.round(F.cashPerMin(L) * CONFIG.turfRewardMin * ev.cash * ev.turfReward);
      res.xp = Math.round(F.xpNext(L) * 0.03 * ev.xp);
      this.p.cash += res.cash;
      res.levelUps = this.addXp(res.xp);
      const row = this.gangRow();
      if (this.ctx) row.winsDelta = (row.winsDelta || 0) + ev.turfWins; else g.wins = (g.wins || 0) + ev.turfWins;
      this.gangLog(this.p.name + (prev ? ' prebral ' + d.name + ' gangu ' + prevInfo.name + '.' : ' obsadil ' + d.name + '.'));
    } else {
      if (!this.ev().noRetry) o.retry[gid] = now + this.wMs(CONFIG.gangRetryMin);
      if (prev && !RIVAL_GANGS[prev]) this.logTo(prev, 'Ubránili ste ' + d.name + ' pred gangom ' + g.name + '.');
      this.gangLog(this.p.name + ': útok na ' + d.name + ' nevyšiel.', true);
    }
    this.save();
    return ok({ A, D, battle, result: res, turf: d });
  },

  // ---------------------------------------------------------------- the city moves on (once an hour)
  gangTick() {
    const t = this.turf();
    const now = Date.now();
    let changed = false, n = 0;
    while (now >= t.nextRaidAt && n < 6) {
      this.gangHour();
      t.nextRaidAt += this.wMs(CONFIG.gangRaidEveryMin);
      changed = true; n++;
    }
    if (now >= t.nextRaidAt) t.nextRaidAt = now + this.wMs(CONFIG.gangRaidEveryMin); // long quiet: skip the rest
    if (changed) this.save();
  },

  // the computer rivals raid objects held by players' gangs and shuffle the rest among themselves
  gangHour() {
    const rivals = Object.keys(RIVAL_GANGS);
    const now = Date.now();
    const keep = this.ev().noDecay;
    for (const d of TURF) {
      const o = this.turfObj(d.id);
      if (keep) o.at = now; // the weekend's hours won't count once the decay is back
      if (o.owner && !RIVAL_GANGS[o.owner]) {
        if (now < o.safeUntil || Math.random() >= CONFIG.gangRaidChance) continue;
        const attacker = rivals[Math.floor(Math.random() * rivals.length)];
        const D = this.defenderSquad(o);
        const lvl = D.length ? Math.round(D.reduce((a, f) => a + f.level, 0) / D.length) : this.p.level;
        const rng = mulberry32(seed());
        const A = Array.from({ length: TURF_KINDS[d.kind].defenders }, () => this.fighterOf(this.botFrom(rng), Math.max(1, lvl - 1)));
        const lost = !D.length || !this.teamBattle(D, A).win;
        const owner = o.owner;
        if (lost) {
          Object.assign(o, this.freshObj(attacker));
          o.safeUntil = now + this.wMs(CONFIG.gangSafeMin);
          this.logTo(owner, RIVAL_GANGS[attacker].name + ' vám prebrali ' + d.name + (D.length ? '.' : ' – nikto ho nebránil.'), true);
        } else {
          this.setStrength(o, Math.max(CONFIG.turfMinStrength, this.strengthNow(o) - 0.05));
          this.logTo(owner, 'Ubránili ste ' + d.name + ' pred gangom ' + RIVAL_GANGS[attacker].name + '.');
        }
      } else if (now >= o.safeUntil && Math.random() < CONFIG.gangRivalMoveChance) {
        const others = rivals.filter((r) => r !== o.owner);
        Object.assign(o, this.freshObj(others[Math.floor(Math.random() * others.length)]));
      }
    }
  },
};
