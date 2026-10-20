// Simulated game server. Every rule about money, rewards and fights lives here, so this module
// can later move to a real backend (Supabase / Nakama) while the client keeps the same calls.
import { CONFIG, F, STATS, STAT_NAMES, CLASSES, RARITIES, clamp, localParts } from './config.js?v=202610201915';
import { ITEM_BASES, SHOPS, MISSIONS, GIVERS, BOSSES, BOT_NAMES, SLOTS } from './data.js?v=202610201915';
import { makeFighter, simulate } from './combat.js?v=202610201915';
import { GangMixin } from './gangs.js?v=202610201915';

const KEY = 'hitsnlicks.save.v1';
const MIN = 60000;

const ok = (data = {}) => ({ ok: true, ...data });
const fail = (error) => ({ ok: false, error });
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const seed = () => Math.floor(Math.random() * 2 ** 31);
const PILLS = ['red', 'blue', 'green'];

// offline play keeps the save in the browser
const localStore = {
  load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && s.version === 1 ? s : null; } catch (e) { return null; } },
  save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage off */ } },
  clear() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } },
};

// opts.store: where the state lives (default: localStorage); opts.state: start from this state;
// opts.live: running on the real server, test switches and fake purchases are off
export class SimServer {
  constructor(opts = {}) {
    this.store = opts.store || localStore;
    this.live = !!opts.live;
    this.dirty = false;
    this.state = opts.state !== undefined ? opts.state : this.store.load();
  }

  // ---------------------------------------------------------------- persistence & time
  save() { this.dirty = true; this.store.save(this.state); }
  hasSave() { return !!this.state; }
  reset() { this.store.clear(); this.state = null; }
  scale() { return this.state && this.state.settings.testMode ? 60 : 1; }
  gameMs(minutes) { return (minutes * MIN) / this.scale(); }
  get p() { return this.state.player; }

  setTestMode(on) { if (this.live) return fail('Testovací režim je len offline.'); this.state.settings.testMode = !!on; this.normalizeHeat(); this.save(); return ok(); }
  setBlackMarket(on) { if (this.live) return fail('Len offline.'); this.state.settings.blackMarket = !!on; this.save(); return ok(); }

  newGame(name, cls) {
    if (!CLASSES[cls]) return fail('Neznáma trieda.');
    const now = Date.now();
    const stats = {}, bought = {};
    STATS.forEach((s) => { stats[s] = CONFIG.startStat; bought[s] = 0; });
    stats[CLASSES[cls].stat] += CONFIG.classStatBonus;
    const equipment = {};
    SLOTS.forEach((s) => { equipment[s.id] = null; });
    this.state = {
      version: 1,
      createdAt: now,
      settings: { testMode: false },
      nextId: 1,
      player: { name: (name || 'Ty').slice(0, 16), cls, level: 1, xp: 0, cash: CONFIG.startCash, chains: CONFIG.startChains, points: 0, stats, bought, equipment, inventory: [] },
      heat: { value: 0, at: now },
      jailUntil: 0,
      mission: null,
      offers: {},
      shops: {},
      boss: { defeated: 0, nextFreeAt: 0 },
      pvp: { points: CONFIG.pvpStartPoints, windowStart: now, used: 0, opponents: null, ladder: null, wins: 0, losses: 0 },
      counters: { missions: 0, fails: 0, raids: 0 },
    };
    const bat = this.makeItem('bat', 1, 'bezny');
    const sneaker = this.makeItem('sneaker', 1, 'bezny');
    this.p.inventory.push(bat, sneaker);
    this.p.equipment.zbran = bat.id;
    this.p.equipment.topanky = sneaker.id;
    this.save();
    return ok();
  }

  // ---------------------------------------------------------------- derived values
  item(id) { return this.p.inventory.find((i) => i.id === id) || null; }

  itemBonus(item) {
    const base = ITEM_BASES[item.base];
    const up = 1 + 0.1 * item.upgrade;
    if (base.kind === 'dmg') return { dmg: Math.round(item.power * base.mult * up * CONFIG.weaponDmgMult) };
    const out = {};
    for (const [s, share] of Object.entries(base.stats)) out[s] = Math.max(1, Math.round(item.power * share * up));
    return out;
  }

  totalStats(withBuffs = true) {
    const t = { ...this.p.stats, armor: 0 };
    for (const id of Object.values(this.p.equipment)) {
      if (!id) continue;
      const it = this.item(id);
      if (!it) continue;
      for (const [s, v] of Object.entries(this.itemBonus(it))) if (s !== 'dmg') t[s] += v;
    }
    if (withBuffs) {
      const b = this.buffs();
      t.stastie = Math.round(t.stastie * (1 + CONFIG.pillBoost * b.red.length));
      const main = F.mainStat(this.p.cls);
      t[main] = Math.round(t[main] * (1 + CONFIG.pillBoost * b.blue.length));
    }
    return t;
  }

  // ---------------------------------------------------------------- pills (street drops)
  // { red: [expiresAt…], blue: […], green: […] }: each pill is one stack, up to pillMaxStacks per colour
  buffs() {
    const now = Date.now();
    const b = this.state.buffs || (this.state.buffs = { red: [], blue: [], green: [] });
    for (const k of PILLS) b[k] = (b[k] || []).filter((t) => t > now);
    return b;
  }

  hpBuffMult() { return 1 + CONFIG.pillBoost * this.buffs().green.length; }

  // a full colour refreshes its oldest stack instead
  takePill(kind) {
    if (!PILLS.includes(kind)) return fail('Neznáma pilulka.');
    const list = this.buffs()[kind];
    const until = Date.now() + this.gameMs(CONFIG.pillMinutes);
    const refreshed = list.length >= CONFIG.pillMaxStacks;
    if (refreshed) list.sort((a, b) => a - b).shift();
    list.push(until);
    this.save();
    return ok({ kind, stacks: list.length, refreshed });
  }

  weaponDmg() {
    const id = this.p.equipment.zbran;
    const it = id && this.item(id);
    return it ? this.itemBonus(it).dmg : 0;
  }

  maxHp() { return Math.round(F.maxHp(this.totalStats(), this.p.level, this.p.cls) * this.hpBuffMult()); }

  // a game day: the calendar day, or 24 game minutes stretched by test mode (1 day = 24 real minutes there)
  dayKey() {
    return this.state.settings.testMode ? 't' + Math.floor(Date.now() / this.gameMs(1440)) : localParts().date;
  }

  nextDayAt() {
    if (this.state.settings.testMode) { const len = this.gameMs(1440); return (Math.floor(Date.now() / len) + 1) * len; }
    const now = Date.now(), l = localParts(now);
    return now + ((24 - l.hour) * 3600 - l.minute * 60 - l.second) * 1000 - (now % 1000);
  }

  // new day: heat back to zero, lawyer visits back to full
  daily() {
    const key = this.dayKey();
    if (this.state.day && this.state.day.key === key) return this.state.day;
    this.state.day = { key, lawyer: 0 };
    this.state.heat.value = 0;
    this.save();
    return this.state.day;
  }

  normalizeHeat() { this.daily(); }

  heatNow() { this.daily(); return this.state.heat.value; }

  addHeat(v) {
    this.daily();
    this.state.heat.value = clamp(this.state.heat.value + v, 0, CONFIG.heatMax);
    this.state.heat.at = Date.now();
  }

  lawyerLeft() { return Math.max(0, CONFIG.lawyerPerDay - this.daily().lawyer); }

  jailLeft() { return Math.max(0, this.state.jailUntil - Date.now()); }

  view() {
    const p = this.p;
    const m = this.state.mission;
    const heat = this.heatNow();
    return {
      name: p.name,
      cls: p.cls,
      level: p.level,
      xp: p.xp,
      xpNext: F.xpNext(p.level),
      cash: p.cash,
      chains: p.chains,
      points: p.points,
      heat,
      stars: Math.min(5, Math.floor(heat / 20) + (heat > 0 && heat % 20 > 0 ? 1 : 0)),
      jailLeft: this.jailLeft(),
      mission: m ? { ...m, name: MISSIONS[m.tpl].name, left: Math.max(0, m.endsAt - Date.now()), ready: Date.now() >= m.endsAt } : null,
      testMode: this.state.settings.testMode,
    };
  }

  addXp(n) {
    const p = this.p;
    p.xp += n;
    let ups = 0;
    while (p.xp >= F.xpNext(p.level)) {
      p.xp -= F.xpNext(p.level);
      p.level += 1;
      p.points += CONFIG.pointsPerLevel;
      ups += 1;
    }
    return ups;
  }

  // ---------------------------------------------------------------- items
  // mission loot: common, sometimes rare (luck helps a little)
  rollRarity() {
    const luck = this.totalStats().stastie;
    return Math.random() * 100 < RARITIES[1].weight + luck * 0.1 ? 'vzacny' : 'bezny';
  }

  makeItem(baseId, level, rarityId) {
    const base = ITEM_BASES[baseId];
    const r = RARITIES.find((x) => x.id === (base.rarity || rarityId));
    return { id: 'i' + this.state.nextId++, base: baseId, slot: base.slot, rarity: r.id, level, upgrade: 0, power: F.itemPower(level, r.mult), price: F.itemPrice(level, r.mult) };
  }

  // bases that can appear with the given rarity (fixed-rarity weapons only in their own tier)
  basesFor(rarity, from = Object.keys(ITEM_BASES)) {
    return from.filter((id) => !ITEM_BASES[id].legacy && (!ITEM_BASES[id].rarity || ITEM_BASES[id].rarity === rarity));
  }

  // source: 'shop' (bežné), 'blackmarket' (epické), 'mission' (bežné / vzácne), 'boss' (1 % legendárne, inak vzácne)
  randomItem(level, source, bases) {
    let rarity;
    if (source === 'shop') rarity = 'bezny';
    else if (source === 'blackmarket') rarity = 'epicky';
    else if (source === 'boss') rarity = Math.random() < CONFIG.legendaryBossChance ? 'legendarny' : 'vzacny';
    else rarity = this.rollRarity();
    let pool = this.basesFor(rarity, bases);
    if (rarity === 'legendarny') pool = pool.filter((id) => ITEM_BASES[id].rarity === 'legendarny');
    if (!pool.length) return null;
    return this.makeItem(pick(pool), level, rarity);
  }

  blackMarketOpen() {
    if (this.state.settings.blackMarket) return true;
    const l = localParts();
    return l.weekday === CONFIG.blackMarketDay && l.hour >= CONFIG.blackMarketFromHour;
  }

  // new loot goes to the inventory and is worn right away when its slot is empty
  giveItem(it) {
    this.p.inventory.push(it);
    if (!this.p.equipment[it.slot] && it.slot !== 'auto') this.p.equipment[it.slot] = it.id;
  }

  equip(id) {
    const it = this.item(id);
    if (!it) return fail('Predmet nemáš.');
    if (it.slot === 'auto' && this.p.level < CONFIG.autoUnlockLevel) return fail('Auto sa odomyká na úrovni ' + CONFIG.autoUnlockLevel + '.');
    this.p.equipment[it.slot] = id;
    this.save();
    return ok();
  }

  unequip(slot) { this.p.equipment[slot] = null; this.save(); return ok(); }

  sellItem(id) {
    const it = this.item(id);
    if (!it) return fail('Predmet nemáš.');
    for (const s of Object.keys(this.p.equipment)) if (this.p.equipment[s] === id) this.p.equipment[s] = null;
    this.p.inventory = this.p.inventory.filter((i) => i.id !== id);
    const gain = Math.round(it.price * 0.25 * (1 + 0.2 * it.upgrade));
    this.p.cash += gain;
    this.save();
    return ok({ gain });
  }

  upgradeCost(id) { const it = this.item(id); return it ? F.upgradeCost(it) : 0; }

  upgradeItem(id) {
    const it = this.item(id);
    if (!it) return fail('Predmet nemáš.');
    if (it.upgrade >= CONFIG.maxUpgrade) return fail('Predmet je na maxime.');
    const cost = F.upgradeCost(it);
    if (this.p.cash < cost) return fail('Nemáš dosť peňazí.');
    this.p.cash -= cost;
    it.upgrade += 1;
    this.save();
    return ok({ cost });
  }

  // ---------------------------------------------------------------- shops
  shop(shopId) {
    const s = SHOPS[shopId];
    let st = this.state.shops[shopId];
    const expired = !st || Date.now() - st.at > this.gameMs(CONFIG.shopRefreshMin) || st.level !== this.p.level;
    if (expired) {
      st = { at: Date.now(), level: this.p.level, list: [] };
      for (let i = 0; i < 4; i++) { const it = this.randomItem(this.p.level, 'shop', s.bases); if (it) st.list.push(it); }
      this.state.shops[shopId] = st;
      this.save();
    }
    // Black Market stock is rolled once per opening and stays until it closes
    const bmOpen = this.blackMarketOpen();
    const bmKey = localParts().date;
    if (bmOpen && st.bmKey !== bmKey) {
      st.bmKey = bmKey;
      st.bm = [];
      // each piece is epic with CONFIG.blackMarketEpicChance, otherwise rare (common if nothing rare fits);
      // every epic base at most once per stall
      let epicLeft = this.basesFor('epicky', s.bases);
      for (let i = 0; i < CONFIG.blackMarketStock; i++) {
        let it = null;
        if (epicLeft.length && Math.random() < CONFIG.blackMarketEpicChance) {
          it = this.randomItem(this.p.level, 'blackmarket', epicLeft);
          epicLeft = epicLeft.filter((b) => b !== it.base);
        } else {
          const rarity = this.basesFor('vzacny', s.bases).length ? 'vzacny' : 'bezny';
          it = this.makeItem(pick(this.basesFor(rarity, s.bases)), this.p.level, rarity);
        }
        st.bm.push(it);
      }
      this.save();
    }
    return { ...s, id: shopId, list: st.list, bm: bmOpen ? st.bm || [] : null, refreshIn: Math.max(0, st.at + this.gameMs(CONFIG.shopRefreshMin) - Date.now()) };
  }

  buyItem(shopId, itemId) {
    const st = this.state.shops[shopId];
    const inBm = !!(st && st.bm && this.blackMarketOpen() && st.bm.find((i) => i.id === itemId));
    const it = st && (inBm ? st.bm : st.list).find((i) => i.id === itemId);
    if (!it) return fail('Tento predmet už nie je na predaj.');
    if (this.p.cash < it.price) return fail('Nemáš dosť peňazí.');
    this.p.cash -= it.price;
    if (inBm) st.bm = st.bm.filter((i) => i.id !== itemId);
    else st.list = st.list.filter((i) => i.id !== itemId);
    this.giveItem(it);
    this.save();
    return ok({ item: it });
  }

  // ---------------------------------------------------------------- stats
  statCost(stat) { return F.statCost(this.p.bought[stat]); }

  spendPoint(stat) {
    if (!STATS.includes(stat)) return fail('Neznámy stat.');
    if (this.p.points <= 0) return fail('Nemáš voľné body.');
    this.p.points -= 1;
    this.p.stats[stat] += 1;
    this.save();
    return ok();
  }

  buyStat(stat) {
    if (!STATS.includes(stat)) return fail('Neznámy stat.');
    const cost = this.statCost(stat);
    if (this.p.cash < cost) return fail('Nemáš dosť peňazí.');
    this.p.cash -= cost;
    this.p.stats[stat] += 1;
    this.p.bought[stat] += 1;
    this.save();
    return ok({ cost });
  }

  // ---------------------------------------------------------------- missions
  // offers are { tpl, v } where v picks one of the mission's story variants
  offers(giverId) {
    const g = GIVERS[giverId];
    let o = this.state.offers[giverId];
    const stale = !o || typeof o.list[0] !== 'object' || o.level !== this.p.level || Date.now() - o.at > this.gameMs(CONFIG.offersRefreshMin);
    if (stale) {
      const pool = g.pool.filter((id) => MISSIONS[id].minLevel <= this.p.level);
      const list = [];
      while (list.length < 3 && pool.length) {
        const tpl = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        list.push({ tpl, v: Math.floor(Math.random() * MISSIONS[tpl].stories.length) });
      }
      list.sort((a, b) => MISSIONS[a.tpl].minutes - MISSIONS[b.tpl].minutes);
      o = { at: Date.now(), level: this.p.level, list };
      this.state.offers[giverId] = o;
      this.save();
    }
    return o.list;
  }

  preview(tplId, v = 0) {
    const t = MISSIONS[tplId];
    const L = this.p.level;
    const story = t.stories[v] || t.stories[0];
    const gb = this.gangBonus(); // turf and gang upgrades
    return {
      tpl: tplId, v, minutes: t.minutes,
      durationMs: Math.round(this.gameMs(t.minutes * F.durationFactor(L)) * (1 - gb.time)),
      cash: Math.round(F.missionCash(L, t.minutes) * (1 + gb.cash)),
      xp: Math.round(F.missionXp(L, t.minutes) * (1 + gb.xp)),
      heat: Math.max(1, Math.round(t.minutes * CONFIG.heatPerMissionMin * F.heatFactor(L))),
      foe: story.foe,
    };
  }

  startMission(giverId, tplId) {
    if (this.state.mission) return fail('Už máš rozbehnutú misiu.');
    if (this.jailLeft() > 0) return fail('Si zavretý. Misie počkajú.');
    const offer = this.offers(giverId).find((o) => o.tpl === tplId);
    if (!offer) return fail('Táto misia už neplatí.');
    const pv = this.preview(tplId, offer.v);
    if (this.heatNow() + pv.heat > CONFIG.heatMax) return fail('Heat je takmer plný. Polícia ťa sleduje, na dnes stačilo. Skús právničku alebo počkaj do polnoci.');
    this.addHeat(pv.heat); // the day's budget is spent when the job starts
    const now = Date.now();
    this.state.mission = { giver: giverId, ...pv, startedAt: now, endsAt: now + pv.durationMs };
    this.save();
    return ok({ mission: this.state.mission });
  }

  // the weak NPC at the end of a mission, scaled from the player's own numbers
  missionFoe(story) {
    const me = this.totalStats(false); // pill boosts should help the player, not the foe
    const stats = {};
    STATS.forEach((s) => { stats[s] = Math.max(3, Math.round(me[s] * CONFIG.foeStatMult)); });
    return makeFighter(story.foe.name, this.p.level, stats, Math.round(this.weaponDmg() * CONFIG.foeWeaponMult), { hpMult: CONFIG.foeHpMult, portrait: story.foe.art, title: story.foe.title, cls: this.p.cls, armor: Math.round(me.armor * CONFIG.foeWeaponMult) });
  }

  skipCost() {
    const m = this.state.mission;
    if (!m) return 0;
    const leftMin = ((m.endsAt - Date.now()) / MIN) * this.scale();
    return Math.max(1, Math.ceil(leftMin * CONFIG.skipChainPerMin));
  }

  skipMission() {
    const m = this.state.mission;
    if (!m) return fail('Nemáš misiu.');
    if (Date.now() >= m.endsAt) return ok();
    const cost = this.skipCost();
    if (this.p.chains < cost) return fail('Nemáš dosť zlatých tehličiek.');
    this.p.chains -= cost;
    m.endsAt = Date.now();
    this.save();
    return ok({ cost });
  }

  claimMission() {
    const m = this.state.mission;
    if (!m) return fail('Nemáš misiu.');
    if (Date.now() < m.endsAt) return fail('Misia ešte beží.');
    const t = MISSIONS[m.tpl];
    const story = t.stories[m.v || 0] || t.stories[0];
    const me = this.playerFighter();
    const foe = this.missionFoe(story);
    const fight = simulate(me, foe, seed());
    const win = fight.winner === 0;
    const res = { tpl: m.tpl, name: t.name, win, cash: 0, xp: 0, item: null, heat: m.heat || 0, raid: null, levelUps: 0 };
    if (win) {
      res.cash = m.cash;
      res.xp = m.xp;
      if (Math.random() < CONFIG.itemDropChance + this.totalStats().stastie / 1000) {
        res.item = this.randomItem(this.p.level, 'mission');
        if (res.item) this.giveItem(res.item);
      }
      // holding a Sklad: a chance for an extra epic piece
      const epic = this.gangBonus().epic;
      if (epic > 0 && Math.random() < epic) {
        res.epic = this.randomItem(this.p.level, 'blackmarket');
        if (res.epic) this.giveItem(res.epic);
      }
      this.state.counters.missions += 1;
    } else {
      this.state.counters.fails += 1;
    }
    this.p.cash += res.cash;
    res.levelUps = this.addXp(res.xp);
    res.raid = this.rollRaid();
    this.state.mission = null;
    delete this.state.offers[m.giver];
    this.save();
    return ok({ fight, a: me, b: foe, story, result: res });
  }

  rollRaid() {
    const heat = this.heatNow();
    if (Math.random() >= F.raidChance(heat)) return null;
    this.state.counters.raids += 1;
    if (this.p.cash > 0 && Math.random() < 0.5) {
      const fine = Math.max(1, Math.round(this.p.cash * CONFIG.raidFinePct));
      this.p.cash -= fine;
      return { type: 'fine', fine };
    }
    this.state.jailUntil = Date.now() + this.gameMs(CONFIG.jailMinutes);
    return { type: 'jail', minutes: CONFIG.jailMinutes };
  }

  // ---------------------------------------------------------------- police & lawyer
  policeBribeCost() {
    return Math.round(F.cashPerMin(this.p.level) * 5 * (1 - this.totalStats().charizma / (this.totalStats().charizma + 80)));
  }

  policeRunChance() { return F.missionChance(this.totalStats().obratnost, this.p.level); }

  policeCheck(choice) {
    let out;
    if (choice === 'utiect') {
      if (Math.random() < this.policeRunChance()) { this.addHeat(5); out = { type: 'escaped' }; }
      else {
        const fine = Math.round(this.p.cash * CONFIG.raidFinePct);
        this.p.cash -= fine;
        this.state.jailUntil = Date.now() + this.gameMs(CONFIG.jailMinutes);
        out = { type: 'caught', fine, minutes: CONFIG.jailMinutes };
      }
    } else if (choice === 'podplatit') {
      const cost = this.policeBribeCost();
      if (this.p.cash < cost) return fail('Na úplatok nemáš dosť peňazí.');
      this.p.cash -= cost;
      out = { type: 'bribed', cost };
    } else {
      this.state.jailUntil = Date.now() + this.gameMs(CONFIG.jailMinutes);
      out = { type: 'jail', minutes: CONFIG.jailMinutes };
    }
    this.save();
    return ok({ result: out });
  }

  // ---------------------------------------------------------------- Wexler & Ripper
  // test purchase until Stripe is wired up: the pack is credited right away
  buyBars(index) {
    if (this.live) return fail('Platby cez Stripe ešte nie sú zapojené.');
    const pack = CONFIG.barPacks[index];
    if (!pack) return fail('Neznámy balíček.');
    this.p.chains += pack.bars;
    this.save();
    return ok({ bars: pack.bars });
  }

  // { active, until, nextAt }: Ripper runs from nextAt for reaperRunMin, once per reaperEveryMin
  reaper() {
    const now = Date.now();
    let r = this.state.reaper;
    if (!r) r = this.state.reaper = { nextAt: now + this.gameMs(CONFIG.reaperFirstMin), caught: false };
    const run = this.gameMs(CONFIG.reaperRunMin), every = this.gameMs(CONFIG.reaperEveryMin);
    let changed = false;
    while (now >= r.nextAt + run) { r.nextAt += every; r.caught = false; changed = true; }
    if (changed) this.save();
    return { active: now >= r.nextAt && !r.caught, until: r.nextAt + run, nextAt: r.nextAt };
  }

  catchRipper() {
    if (!this.reaper().active) return fail('Ripper už ušiel.');
    this.state.reaper.caught = true;
    this.p.chains += 1;
    this.save();
    return ok();
  }

  // lucky runner: shows up, stays until hit, then the next one comes an hour after the hit
  runner() {
    let r = this.state.runner;
    if (!r) { r = this.state.runner = { nextAt: Date.now() + this.gameMs(CONFIG.runnerFirstMin) }; this.save(); }
    return { active: Date.now() >= r.nextAt, nextAt: r.nextAt };
  }

  hitRunner() {
    if (!this.runner().active) return fail('Už je preč.');
    this.state.runner.nextAt = Date.now() + this.gameMs(CONFIG.runnerEveryMin);
    let item = null;
    if (Math.random() < CONFIG.runnerEpicChance) {
      item = this.randomItem(this.p.level, 'blackmarket');
      if (item) this.giveItem(item);
    }
    this.save();
    return ok({ item });
  }

  // equipped weapon as the city sees it: { attack: 'melee'|'gun', cooldown, auto } or null
  streetWeapon() {
    const id = this.p.equipment.zbran;
    const it = id && this.item(id);
    if (!it) return null;
    const b = ITEM_BASES[it.base];
    return { base: it.base, attack: b.attack || 'melee', cooldown: b.cooldown || 0.4, auto: !!b.auto };
  }

  // shooting or hitting people on the street
  crime(heat) {
    this.addHeat(heat);
    this.save();
  }

  lawyerCost() { return F.lawyerCost(this.p.level); }

  lawyer() {
    const cost = this.lawyerCost();
    if (this.heatNow() <= 0) return fail('Heat je na nule. Právnička nemá čo riešiť.');
    if (this.lawyerLeft() <= 0) return fail('Právnička ti dnes už pomohla ' + CONFIG.lawyerPerDay + '×. Príď zajtra.');
    if (this.p.cash < cost) return fail('Nemáš dosť peňazí.');
    this.p.cash -= cost;
    this.addHeat(-CONFIG.lawyerHeat);
    this.state.day.lawyer += 1;
    this.save();
    return ok({ cost });
  }

  // ---------------------------------------------------------------- fights
  // what other players fight against in the arena (no temporary pill boosts)
  publicFighter() {
    const ts = this.totalStats(false);
    const stats = {};
    STATS.forEach((s) => { stats[s] = ts[s]; });
    return { name: this.p.name, level: this.p.level, cls: this.p.cls, stats, weapon: this.weaponDmg(), armor: ts.armor };
  }

  playerFighter() {
    const ts = this.totalStats();
    return makeFighter(this.p.name, this.p.level, ts, this.weaponDmg(), { portrait: 'maska', cls: this.p.cls, armor: ts.armor, hpMult: this.hpBuffMult() });
  }

  bossFighter(index) {
    const b = BOSSES[index];
    const Lb = F.bossLevel(index + 1);
    const base = F.bossStat(Lb);
    const stats = {};
    STATS.forEach((s) => { stats[s] = Math.round(base * b.profile[s]); });
    // a boss fights like the class whose stat his profile favours most
    const cls = Object.keys(CLASSES).reduce((best, c) => (b.profile[CLASSES[c].stat] > b.profile[CLASSES[best].stat] ? c : best), 'svalovec');
    return makeFighter(b.name, Lb, stats, F.itemPower(Lb, 1.3) * CONFIG.weaponDmgMult, { hpMult: CONFIG.bossHpMult, portrait: b.art || null, title: b.title, cls, armor: F.itemPower(Lb, 1.3) * 5 });
  }

  bossInfo() {
    const i = this.state.boss.defeated;
    if (i >= BOSSES.length) return { done: true, total: BOSSES.length };
    const f = this.bossFighter(i);
    const L = this.p.level;
    return {
      done: false, index: i, total: BOSSES.length, boss: BOSSES[i], fighter: f,
      freeAt: this.state.boss.nextFreeAt, free: Date.now() >= this.state.boss.nextFreeAt,
      reward: { cash: Math.round(F.cashPerMin(L) * 30), xp: Math.round(F.xpNext(L) * 0.25) },
    };
  }

  fightBoss() {
    const info = this.bossInfo();
    if (info.done) return fail('Všetci bossovia Mesta 1 sú porazení.');
    if (!info.free) {
      if (this.p.chains < CONFIG.bossRetryChains) return fail('Nemáš dosť zlatých tehličiek.');
      this.p.chains -= CONFIG.bossRetryChains;
    } else {
      this.state.boss.nextFreeAt = Date.now() + this.gameMs(CONFIG.bossCooldownMin);
    }
    const me = this.playerFighter();
    const fight = simulate(me, info.fighter, seed());
    const win = fight.winner === 0;
    const res = { win, cash: 0, xp: 0, item: null, levelUps: 0 };
    if (win) {
      this.state.boss.defeated += 1;
      res.cash = info.reward.cash;
      res.xp = info.reward.xp;
      res.item = this.randomItem(this.p.level, 'boss');
      if (res.item) this.giveItem(res.item);
      this.p.cash += res.cash;
      res.levelUps = this.addXp(res.xp);
    }
    this.save();
    return ok({ fight, a: me, b: info.fighter, result: res });
  }

  makeBot(level, points) {
    const raw = STATS.map(() => 0.6 + Math.random() * 0.8);
    const sum = raw.reduce((a, b) => a + b, 0);
    const stats = {};
    STATS.forEach((s, i) => { stats[s] = Math.max(5, Math.round(F.npcStat(level) * raw[i] * (5 / sum))); });
    const r = pick(RARITIES.slice(0, 3));
    return { name: pick(BOT_NAMES), cls: pick(Object.keys(CLASSES)), level, stats, weapon: F.itemPower(level, r.mult) * CONFIG.weaponDmgMult, armor: F.itemPower(level, r.mult) * 5, points };
  }

  pvpWindow() {
    const v = this.state.pvp;
    if (Date.now() - v.windowStart >= this.gameMs(60)) { v.windowStart = Date.now(); v.used = 0; }
    return v;
  }

  arena() {
    const v = this.pvpWindow();
    const L = this.p.level;
    if (!v.opponents) {
      // live: real players near your points (this.arenaPool, loaded by the API); bots fill the gaps
      const real = this.arenaPool || [];
      const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
      v.opponents = [0, 1, 2].map((i) => (real[i] ? { ...real[i] } : { ...this.makeBot(Math.max(1, L - 1 + i), Math.max(0, v.points - 60 + i * 60 + Math.round(Math.random() * 40))), name: names[i] }));
    }
    if (this.ladderPool) v.ladder = this.ladderPool;
    else if (!v.ladder) {
      v.ladder = BOT_NAMES.slice(0, 12).map((n, i) => ({ name: n, points: 1400 - i * 45 - Math.round(Math.random() * 30) }));
    }
    this.save();
    const ladder = [...v.ladder, { name: this.p.name, points: v.points, me: true }].sort((a, b) => b.points - a.points);
    return { opponents: v.opponents, ladder, points: v.points, freeLeft: Math.max(0, CONFIG.pvpFreePerHour - v.used), windowEnds: v.windowStart + this.gameMs(60), wins: v.wins, losses: v.losses };
  }

  fightArena(index) {
    const v = this.pvpWindow();
    const opp = v.opponents && v.opponents[index];
    if (!opp) return fail('Súper už odišiel.');
    if (v.used >= CONFIG.pvpFreePerHour) {
      if (this.p.chains < CONFIG.pvpExtraChains) return fail('Nemáš dosť zlatých tehličiek.');
      this.p.chains -= CONFIG.pvpExtraChains;
    } else {
      v.used += 1;
    }
    const me = this.playerFighter();
    const other = makeFighter(opp.name, opp.level, opp.stats, opp.weapon, { portrait: 'bot', cls: opp.cls, armor: opp.armor || 0 });
    const fight = simulate(me, other, seed());
    const win = fight.winner === 0;
    const L = this.p.level;
    const res = { win, points: 0, cash: 0, xp: 0, levelUps: 0 };
    if (win) {
      res.points = Math.round(20 * clamp(1 + (opp.points - v.points) / 400, 0.5, 1.5));
      res.cash = Math.round(F.cashPerMin(L) * 3);
      res.xp = Math.round(F.xpNext(L) * 0.03);
      this.p.cash += res.cash;
      res.levelUps = this.addXp(res.xp);
      v.wins += 1;
    } else {
      res.points = -Math.min(10, v.points);
      v.losses += 1;
    }
    v.points += res.points;
    v.opponents = null;
    if (opp.id && res.points > 0) { res.defenderId = opp.id; res.defenderLoss = Math.round(res.points / 2); } // a real player loses half of what you won
    if (v.ladder && !this.live) v.ladder.forEach((b) => { b.points = Math.max(0, b.points + Math.round((Math.random() - 0.45) * 30)); });
    this.save();
    return ok({ fight, a: me, b: other, result: res });
  }
}

Object.assign(SimServer.prototype, GangMixin);

export { STAT_NAMES };
