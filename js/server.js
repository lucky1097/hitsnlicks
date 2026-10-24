// Simulated game server. Every rule about money, rewards and fights lives here, so this module
// can later move to a real backend (Supabase / Nakama) while the client keeps the same calls.
import { CONFIG, F, STATS, STAT_NAMES, CLASSES, RARITIES, clamp, localParts } from './config.js?v=20261024154006';
import { eventFx } from './events.js?v=20261024154006';
import { ITEM_BASES, SHOPS, MISSIONS, GIVERS, BOSSES, BOT_NAMES, SLOTS } from './data.js?v=20261024154006';
import { makeFighter, simulate } from './combat.js?v=20261024154006';
import { GangMixin } from './gangs.js?v=20261024154006';
import { DailyMixin } from './daily.js?v=20261024154006';

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
    if (this.state) this.dropRemovedItems();
  }

  // items whose base was taken out of the game (old placeholder art) vanish from saves and shop stock;
  // the old rare tier is gone: such pieces stay as they are but count as common, and a Black Market stall
  // that still holds anything but epic pieces is rolled again
  dropRemovedItems() {
    const known = (it) => !!ITEM_BASES[it.base];
    const relabel = (it) => { if (!RARITIES.some((r) => r.id === it.rarity)) it.rarity = 'bezny'; };
    const p = this.state.player;
    if (p && p.inventory && !p.inventory.every(known)) {
      p.inventory = p.inventory.filter(known);
      for (const s of Object.keys(p.equipment)) if (p.equipment[s] && !p.inventory.some((i) => i.id === p.equipment[s])) p.equipment[s] = null;
    }
    if (p && p.inventory) p.inventory.forEach(relabel);
    for (const st of Object.values(this.state.shops || {})) {
      if (st.list) { st.list = st.list.filter(known); st.list.forEach(relabel); }
      if (st.premium) st.premium.forEach(relabel);
      if (st.bm) st.bm = st.bm.filter(known);
      if (st.bm && st.bm.some((it) => it.rarity !== 'epicky')) { st.bm = []; st.bmKey = null; }
    }
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
    const sneaker = this.makeItem('sneaker_black', 1, 'bezny');
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
    const out = {};
    if (base.kind === 'dmg') out.dmg = Math.round(item.power * base.mult * up * CONFIG.weaponDmgMult);
    if (item.stats) {
      // rolled stats; clothing keeps its armor from the base
      for (const [s, v] of Object.entries(item.stats)) out[s] = Math.max(1, Math.round(v * up));
      if (base.stats && base.stats.armor) out.armor = Math.max(1, Math.round(item.power * base.stats.armor * up));
    } else if (base.stats) {
      // items made before rolled stats
      for (const [s, share] of Object.entries(base.stats)) out[s] = Math.max(1, Math.round(item.power * share * up));
    }
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
    const until = Date.now() + this.gameMs(CONFIG.pillMinutes * this.ev().pillTime);
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

  // the worn car (from level CONFIG.autoUnlockLevel): { heat, time } shares taken off
  carBonus() {
    const id = this.p.equipment.auto;
    const it = id && this.p.level >= CONFIG.autoUnlockLevel && this.item(id);
    const c = it && ITEM_BASES[it.base].car;
    return c ? { heat: c.heat, time: c.time } : { heat: 0, time: 0 };
  }

  // what this weekend's events change (js/events.js); all ones on a normal day
  ev() { return eventFx(); }

  // new heat from anything is cut by the car; pre = already cut (a mission's own preview)
  addHeat(v, pre = false) {
    this.daily();
    if (v > 0 && !pre) v *= 1 - this.carBonus().heat;
    this.state.heat.value = clamp(this.state.heat.value + v, 0, CONFIG.heatMax);
    this.state.heat.at = Date.now();
  }

  lawyerLeft() { return this.ev().lawyerUnlimited ? 99 : Math.max(0, CONFIG.lawyerPerDay - this.daily().lawyer); }

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
  makeItem(baseId, level, rarityId) {
    const base = ITEM_BASES[baseId];
    const r = RARITIES.find((x) => x.id === (base.rarity || rarityId));
    return { id: 'i' + this.state.nextId++, base: baseId, slot: base.slot, rarity: r.id, level, upgrade: 0, power: F.itemPower(level, r.mult), price: F.itemPrice(level, r.mult), stats: this.rollStats(level, r.id) };
  }

  // common: 1 random stat; epic: class main stat + odolnosť + šťastie; legendary: class main stat + odolnosť
  // at twice the epic value
  rollStats(level, rarity) {
    const one = (rid) => Math.max(1, Math.round(F.itemPower(level, RARITIES.find((x) => x.id === rid).mult) * CONFIG.itemStatShare[rid]));
    if (rarity === 'legendarny') {
      const v = one('epicky') * 2;
      return { [F.mainStat(this.p.cls)]: v, odolnost: v };
    }
    if (rarity === 'epicky') {
      const v = one('epicky');
      return { [F.mainStat(this.p.cls)]: v, odolnost: v, stastie: v };
    }
    const pool = [...STATS];
    const out = {};
    for (let i = 0; i < (CONFIG.itemStatCount[rarity] || 1); i++) out[pool.splice(Math.floor(Math.random() * pool.length), 1)[0]] = one(rarity);
    return out;
  }

  // bases that can appear with the given rarity: fixed-rarity bases only in their own tier
  basesFor(rarity, from = Object.keys(ITEM_BASES)) {
    return from.filter((id) => {
      const b = ITEM_BASES[id];
      return !b.legacy && (!b.rarity || b.rarity === rarity);
    });
  }

  // source: 'shop' and 'mission' (bežné), 'blackmarket' (epické), 'boss' (1 % legendárne, 20 % epické, inak bežné)
  randomItem(level, source, bases) {
    let rarity;
    if (source === 'blackmarket') rarity = 'epicky';
    else if (source === 'boss') {
      const r = Math.random();
      const legend = Math.max(CONFIG.legendaryBossChance, this.ev().legendBoss || 0);
      rarity = r < legend ? 'legendarny' : r < legend + CONFIG.bossEpicChance ? 'epicky' : 'bezny';
    }
    else rarity = 'bezny';
    let pool = this.basesFor(rarity, bases).filter((id) => !ITEM_BASES[id].shopOnly);
    if (rarity === 'legendarny') pool = pool.filter((id) => ITEM_BASES[id].rarity === 'legendarny');
    if (!pool.length) return null;
    return this.makeItem(pick(pool), level, rarity);
  }

  // a random legendary piece of any slot (never one of the cars sold only in the Autobazár)
  legendaryItem() {
    const pool = Object.keys(ITEM_BASES).filter((id) => ITEM_BASES[id].rarity === 'legendarny' && !ITEM_BASES[id].shopOnly);
    return pool.length ? this.makeItem(pick(pool), this.p.level, 'legendarny') : null;
  }

  // features that open with level (CONFIG.unlock): the level still missing for it, 0 when open
  locked(feature) { const L = CONFIG.unlock[feature] || 0; return this.p.level < L ? L : 0; }
  lockedFail(feature, what) { return fail(what + ' sa odomyká na úrovni ' + this.locked(feature) + '.'); }

  blackMarketOpen() {
    if (this.state.settings.blackMarket) return true;
    if (this.locked('blackMarket')) return false;
    if (this.elixirLeft() > 0 || this.ev().bmAll) return true;
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

  upgradeCost(id) { const it = this.item(id); return it ? Math.round(F.upgradeCost(it) * this.ev().price) : 0; }

  upgradeItem(id) {
    const it = this.item(id);
    if (!it) return fail('Predmet nemáš.');
    if (it.upgrade >= CONFIG.maxUpgrade) return fail('Predmet je na maxime.');
    const cost = this.upgradeCost(id);
    if (this.p.cash < cost) return fail('Nemáš dosť peňazí.');
    this.p.cash -= cost;
    it.upgrade += 1;
    this.save();
    return ok({ cost });
  }

  // ---------------------------------------------------------------- shops
  // what the shop's Black Market stall can hold: its epic goods; a shop without them (Autobazár) has no stall
  bmBases(shopId) { return this.basesFor('epicky', SHOPS[shopId].bases).filter((id) => ITEM_BASES[id].rarity === 'epicky'); }

  shop(shopId) {
    const s = SHOPS[shopId];
    let st = this.state.shops[shopId];
    const expired = !st || Date.now() - st.at > this.gameMs(CONFIG.shopRefreshMin) || st.level !== this.p.level;
    if (expired) st = this.restock(shopId);
    // premium pieces (Autobazár): always all of them, made for your level; a bought one comes back with the restock
    if (s.premium && (!st.premium || st.premiumLevel !== this.p.level)) {
      st.premium = s.premium.map((b) => this.makeItem(b, this.p.level, ITEM_BASES[b].rarity));
      st.premiumLevel = this.p.level;
      this.save();
    }
    // Black Market stock is rolled once per opening and stays until it closes
    const epicBases = this.bmBases(shopId);
    const bmOpen = this.blackMarketOpen() && epicBases.length > 0;
    // Friday: one stall per evening; with Wexler's elixir it restocks with the regular goods
    const bmKey = this.elixirLeft() > 0 ? 'e' + st.at : localParts().date;
    if (bmOpen && st.bmKey !== bmKey) {
      st.bmKey = bmKey;
      st.bm = [];
      // only epic pieces, every epic base at most once per stall
      let epicLeft = epicBases;
      for (let i = 0; i < CONFIG.blackMarketStock + (this.ev().bmStock || 0) && epicLeft.length; i++) {
        const it = this.randomItem(this.p.level, 'blackmarket', epicLeft);
        if (!it) break;
        epicLeft = epicLeft.filter((b) => b !== it.base);
        st.bm.push(it);
      }
      this.save();
    }
    return { ...s, id: shopId, list: st.list, premium: st.premium || null, hasBm: epicBases.length > 0, bm: bmOpen ? st.bm || [] : null, refreshIn: Math.max(0, st.at + this.gameMs(CONFIG.shopRefreshMin) - Date.now()) };
  }

  // fresh common goods; keeps the Black Market stall as it is
  restock(shopId) {
    const old = this.state.shops[shopId] || {};
    const st = { ...old, at: Date.now(), level: this.p.level, list: [] };
    // different pieces first; a base repeats only when the shop has fewer kinds than places
    for (let i = 0; i < CONFIG.shopStock; i++) {
      const fresh = SHOPS[shopId].bases.filter((b) => !st.list.some((x) => x.base === b));
      const it = this.randomItem(this.p.level, 'shop', fresh.length ? fresh : SHOPS[shopId].bases) || this.randomItem(this.p.level, 'shop', SHOPS[shopId].bases);
      if (it) st.list.push(it);
    }
    this.state.shops[shopId] = st;
    this.save();
    return st;
  }

  rerollShop(shopId) {
    if (!SHOPS[shopId]) return fail('Neznámy obchod.');
    const cost = this.rerollCost();
    if (this.p.chains < cost) return fail('Nemáš zlatú tehličku.');
    this.p.chains -= cost;
    const st = this.restock(shopId);
    // an open Black Market stall is rolled again together with the regular goods
    if (this.blackMarketOpen()) { st.bmKey = null; this.shop(shopId); }
    return ok();
  }

  rerollCost() { return this.ev().freeReroll ? 0 : CONFIG.shopRerollChains; }

  // what a piece costs right there: Black Market epics add bars, premium cars are bars (+ cash for the epic ones);
  // the Výpredaj weekend takes a share off the cash
  shopPrice(it, where) {
    const off = this.ev().price;
    if (where === 'premium') return { cash: it.rarity === 'legendarny' ? 0 : Math.round(it.price * off), bars: CONFIG.carBars[it.rarity] || 0 };
    return { cash: Math.round(it.price * off), bars: where === 'bm' && it.rarity === 'epicky' ? CONFIG.bmEpicChains : 0 };
  }

  buyItem(shopId, itemId) {
    const st = this.state.shops[shopId];
    if (!st) return fail('Tento predmet už nie je na predaj.');
    const inBm = !!(st.bm && this.blackMarketOpen() && st.bm.find((i) => i.id === itemId));
    const inPremium = !!(st.premium && st.premium.find((i) => i.id === itemId));
    const where = inBm ? 'bm' : inPremium ? 'premium' : 'list';
    const it = (inBm ? st.bm : inPremium ? st.premium : st.list).find((i) => i.id === itemId);
    if (!it) return fail('Tento predmet už nie je na predaj.');
    const cost = this.shopPrice(it, where);
    if (this.p.cash < cost.cash) return fail('Nemáš dosť peňazí.');
    if (this.p.chains < cost.bars) return fail('Stojí aj ' + cost.bars + ' zlatých tehličiek.');
    this.p.cash -= cost.cash;
    this.p.chains -= cost.bars;
    if (inBm) st.bm = st.bm.filter((i) => i.id !== itemId);
    else if (inPremium) st.premium = st.premium.map((i) => (i.id === itemId ? this.makeItem(i.base, this.p.level, i.rarity) : i)); // another one waits there
    else st.list = st.list.filter((i) => i.id !== itemId);
    this.giveItem(it);
    this.save();
    return ok({ item: it });
  }

  // ---------------------------------------------------------------- stats
  statCost(stat) { return F.statCost(this.p.bought[stat]); }

  // character creator: the picked layer of each part (file ids from js/looks.js; null = nothing in an optional part)
  setLook(look) {
    if (!look || typeof look !== 'object' || Array.isArray(look)) return fail('Neplatný vzhľad.');
    const out = {};
    for (const [k, v] of Object.entries(look).slice(0, 16)) {
      if (!/^[a-z_]{1,16}$/.test(k)) continue;
      if (v === null) out[k] = null;
      else if (typeof v === 'string' && /^[\w-]{1,48}$/.test(v)) out[k] = v;
    }
    this.p.look = out;
    this.save();
    return ok();
  }

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
    const car = this.carBonus();
    const ev = this.ev(); // weekend events: rewards, time and heat are fixed when the job starts
    return {
      tpl: tplId, v, minutes: t.minutes,
      durationMs: Math.round(this.gameMs(t.minutes * F.durationFactor(L)) * (1 - gb.time) * (1 - car.time) * ev.missionTime),
      cash: Math.round(F.missionCash(L, t.minutes) * (1 + gb.cash) * ev.cash),
      xp: Math.round(F.missionXp(L, t.minutes) * (1 + gb.xp) * ev.xp),
      heat: Math.max(1, Math.round(t.minutes * CONFIG.heatPerMissionMin * F.heatFactor(L) * (1 - car.heat) * ev.missionHeat)),
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
    this.addHeat(pv.heat, true); // the day's budget is spent when the job starts (the car is already in pv.heat)
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
      // weekend events: gold bars, a legendary piece
      const ev = this.ev();
      if (ev.barChance && Math.random() < ev.barChance) { res.bars = 1 + Math.floor(Math.random() * 3); this.p.chains += res.bars; }
      if (ev.legendMission && Math.random() < ev.legendMission) {
        res.legend = this.legendaryItem();
        if (res.legend) this.giveItem(res.legend);
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

  // ---------------------------------------------------------------- hideout
  // { since } while you sit in the hideout; { shadowUntil } = no police on foot until then
  hideState() { return this.state.hide || (this.state.hide = { since: 0, shadowUntil: 0 }); }
  shadowLeft() { return Math.max(0, this.hideState().shadowUntil - Date.now()); }
  hidingLeft() { const h = this.hideState(); return h.since ? Math.max(0, h.since + this.gameMs(CONFIG.hideMin) - Date.now()) : 0; }

  hideStart() {
    const h = this.hideState();
    if (h.since) return ok({ since: h.since });
    if (this.shadowLeft() > 0) return fail('Už si v tieni. Polícia ťa nenaháňa.');
    if (this.wantedStars() < 1) return fail('Polícia ťa nehľadá, nie je pred kým sa skrývať.');
    h.since = Date.now();
    this.save();
    return ok({ since: h.since });
  }

  // leaving the hideout: after hideMin you are in the shadows for shadowMin; earlier it was for nothing
  hideEnd() {
    const h = this.hideState();
    if (!h.since) return fail('Nie si v skrýši.');
    const done = Date.now() - h.since >= this.gameMs(CONFIG.hideMin) - 1000;
    h.since = 0;
    if (done) {
      h.shadowUntil = Date.now() + this.gameMs(CONFIG.shadowMin);
      this.clearWanted(); // the chase is over
    }
    this.save();
    return ok({ shadow: done, until: h.shadowUntil });
  }

  // officers put down in the current chase; the chase (and the count) ends when the stars are gone
  copKills() {
    const c = this.state.cops;
    if (c && c.kills && this.wantedStars() < 1) c.kills = 0;
    return (c && c.kills) || 0;
  }

  // officers on foot from wantedChase stars on: one more per star, doubled for every one you put down
  copsWanted() {
    const s = this.wantedStars();
    if (s < CONFIG.wantedChase) return 0;
    return Math.min(CONFIG.copMax, (s - CONFIG.wantedChase + 1) * 2 ** this.copKills());
  }

  // an officer on foot went down: more of them come, maybe an epic item (copEpicChance each, at most
  // copEpicPerDay a day), counts for the raid task
  copDown() {
    if (this.wantedStars() < CONFIG.wantedChase) return fail('Nikto ťa nenaháňa.');
    const c = this.state.cops || (this.state.cops = { kills: 0, lastAt: 0 });
    const now = Date.now();
    // a blast can drop several officers at once, so only a flood of calls is refused
    if (now - c.lastAt < CONFIG.copKillGapMs) return fail('Príliš rýchlo.');
    c.lastAt = now;
    this.addWanted(CONFIG.wantedGain.copKill);
    c.kills += 1;
    this.addHeat(CONFIG.heatCopKill);
    const day = this.daily();
    let item = null;
    if ((day.copEpic || 0) < CONFIG.copEpicPerDay && Math.random() < CONFIG.copEpicChance) {
      item = this.randomItem(this.p.level, 'blackmarket');
      if (item) { this.giveItem(item); day.copEpic = (day.copEpic || 0) + 1; }
    }
    const daily = this.dailyEvent('razia');
    this.save();
    return ok({ kills: c.kills, wanted: this.copsWanted(), item, daily });
  }

  // caught after putting an officer down: a share of your cash, or a while without Don's and the Díler's missions
  policeKiller(choice) {
    if (!this.copKills()) return fail('Nie je za čo.');
    this.dailyCaught();
    let out;
    if (choice === 'peniaze') { const lost = this.killCashLoss(); out = { type: 'cash', lost }; this.p.cash -= lost; }
    else { this.state.jailUntil = Date.now() + this.gameMs(CONFIG.killJailMin); out = { type: 'jail', minutes: CONFIG.killJailMin }; }
    this.clearWanted();
    this.save();
    return ok({ result: out });
  }

  killCashLoss() { return Math.floor(this.p.cash * CONFIG.killCashShare); }

  policeCheck(choice) {
    let out;
    if (this.copKills()) return fail('Zložil si policajta. Tu už úplatok nepomôže.');
    this.dailyCaught();
    this.clearWanted(); // caught: whatever comes next, this chase is over
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
  // Wexler's elixir: the Black Market stays open for this player for elixirHours (a second one adds time)
  elixirLeft() { return Math.max(0, (this.state.bmUntil || 0) - Date.now()); }

  buyElixir() {
    if (this.locked('blackMarket')) return this.lockedFail('blackMarket', 'Čierny trh');
    if (this.p.chains < CONFIG.elixirChains) return fail('Elixír stojí ' + CONFIG.elixirChains + ' zlatých tehličiek.');
    this.p.chains -= CONFIG.elixirChains;
    this.state.bmUntil = Date.now() + this.elixirLeft() + CONFIG.elixirHours * 3600000;
    this.save();
    return ok({ until: this.state.bmUntil });
  }

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
    const run = this.gameMs(CONFIG.reaperRunMin), every = this.gameMs(CONFIG.reaperEveryMin * this.ev().reaperEvery);
    let changed = false;
    while (now >= r.nextAt + run) { r.nextAt += every; r.caught = false; changed = true; }
    if (changed) this.save();
    return { active: now >= r.nextAt && !r.caught, until: r.nextAt + run, nextAt: r.nextAt };
  }

  catchRipper() {
    if (!this.reaper().active) return fail('Ripper už ušiel.');
    this.state.reaper.caught = true;
    this.p.chains += 1;
    const daily = this.dailyEvent('runner');
    this.save();
    return ok({ daily });
  }

  // lucky runner: shows up, stays until hit, then the next one comes an hour after the hit
  runner() {
    let r = this.state.runner;
    if (!r) { r = this.state.runner = { nextAt: Date.now() + this.gameMs(CONFIG.runnerFirstMin) }; this.save(); }
    return { active: Date.now() >= r.nextAt, nextAt: r.nextAt };
  }

  hitRunner() {
    if (!this.runner().active) return fail('Už je preč.');
    const ev = this.ev();
    this.state.runner.nextAt = Date.now() + this.gameMs(CONFIG.runnerEveryMin * ev.runnerEvery);
    let item = null;
    if (Math.random() < CONFIG.runnerEpicChance * ev.runnerEpic) {
      item = this.randomItem(this.p.level, 'blackmarket');
      if (item) this.giveItem(item);
    }
    const daily = this.dailyEvent('runner');
    this.save();
    return ok({ item, daily });
  }

  // equipped weapon as the city sees it: { attack: 'melee'|'gun', cooldown, auto } or null
  streetWeapon() {
    const id = this.p.equipment.zbran;
    const it = id && this.item(id);
    if (!it) return null;
    const b = ITEM_BASES[it.base];
    return { base: it.base, attack: b.attack || 'melee', cooldown: b.cooldown || 0.4, auto: !!b.auto };
  }

  // shooting or hitting people on the street: heat for the day, stars for the police (kind = what they saw)
  crime(heat, kind) {
    this.addHeat(heat);
    if (CONFIG.wantedGain[kind]) this.addWanted(CONFIG.wantedGain[kind]);
    this.save();
  }

  // ---------------------------------------------------------------- wanted level (police stars, 0–5)
  // Rises only from street crimes, a little faster at high heat. Falls one star for every wantedLoseSec the
  // police lose sight of you (the map reports it), on its own after wantedIdleSec without new trouble,
  // and to zero when you are caught or come out of the hideout.
  wanted() {
    const w = this.state.wanted || (this.state.wanted = { stars: 0, at: 0 });
    const idle = (Date.now() - w.at) / 1000 - CONFIG.wantedIdleSec;
    if (w.stars > 0 && idle > 0) {
      const drop = Math.floor(idle / CONFIG.wantedLoseSec) + 1;
      w.stars = Math.max(0, Math.floor(w.stars) - drop);
      w.at = Date.now() - CONFIG.wantedIdleSec * 1000;
    }
    return w;
  }

  wantedStars() { return Math.floor(this.wanted().stars); }

  addWanted(v) {
    const w = this.wanted();
    w.stars = Math.min(5, w.stars + v * (1 + this.heatNow() / 100) * this.ev().wanted);
    w.at = Date.now();
  }

  clearWanted() { const w = this.wanted(); w.stars = 0; w.at = Date.now(); if (this.state.cops) this.state.cops.kills = 0; }

  // the map: no officer has seen you for wantedLoseSec -> one star less
  wantedLose() {
    const w = this.wanted();
    if (w.stars <= 0) return ok({ stars: 0 });
    if (Date.now() - w.at < (CONFIG.wantedLoseSec - 2) * 1000) return fail('Ešte ťa hľadajú.');
    w.stars = Math.max(0, Math.floor(w.stars) - 1); // always one whole star of what the HUD shows
    w.at = Date.now();
    if (w.stars <= 0 && this.state.cops) this.state.cops.kills = 0;
    this.save();
    return ok({ stars: w.stars });
  }

  lawyerCost() { return Math.round(F.lawyerCost(this.p.level) * this.ev().lawyerCost); }

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
    const w = this.p.equipment.zbran && this.item(this.p.equipment.zbran);
    // wbase: the worn weapon, so others see it swing or fire in the fight animation
    return { name: this.p.name, level: this.p.level, cls: this.p.cls, stats, weapon: this.weaponDmg(), armor: ts.armor, wbase: w ? w.base : null };
  }

  // what other players see in the hall of fame: look, stats with gear, worn items (never cash or the inventory)
  publicProfile() {
    const ts = this.totalStats(false);
    const stats = {};
    STATS.forEach((s) => { stats[s] = ts[s]; });
    const gear = {};
    for (const [slot, id] of Object.entries(this.p.equipment)) {
      const it = id && this.item(id);
      if (it) gear[slot] = { base: it.base, rarity: it.rarity, level: it.level, upgrade: it.upgrade, bonus: this.itemBonus(it) };
    }
    return { name: this.p.name, cls: this.p.cls, level: this.p.level, look: this.p.look || null, stats, armor: ts.armor, weapon: this.weaponDmg(), hp: this.maxHp(), gear };
  }

  // offline there is nobody else: the hall lists only you (online the server answers these from the database)
  hallOfFame() { return ok({ list: [{ id: 'me', name: this.p.name, level: this.p.level, cls: this.p.cls, points: this.state.pvp.points, me: true }] }); }
  playerProfile() { return ok({ profile: this.publicProfile() }); }
  gangHall() { const g = this.gang(); return ok({ list: g ? [{ id: this.myGangId(), name: g.name, tag: g.tag, color: g.color, wins: g.wins || 0, members: g.members.length, leaderName: this.p.name }] : [], mine: this.myGangId() }); }
  gangInbox() { return { requests: [], invites: [] }; }

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
    return makeFighter(b.name, Lb, stats, F.itemPower(Lb, CONFIG.bossGearMult) * CONFIG.weaponDmgMult, { hpMult: CONFIG.bossHpMult, portrait: b.art || null, title: b.title, cls, armor: F.itemPower(Lb, CONFIG.bossGearMult) * 5 });
  }

  bossInfo() {
    const i = this.state.boss.defeated;
    if (i >= BOSSES.length) return { done: true, total: BOSSES.length };
    const f = this.bossFighter(i);
    const L = this.p.level;
    const ev = this.ev();
    return {
      done: false, index: i, total: BOSSES.length, boss: BOSSES[i], fighter: f,
      freeAt: this.state.boss.nextFreeAt, free: ev.bossFree || Date.now() >= this.state.boss.nextFreeAt, hunt: !!ev.bossFree,
      paidLeft: Math.max(0, CONFIG.bossPaidPerDay - (this.daily().bossPaid || 0)),
      reward: { cash: Math.round(F.cashPerMin(L) * 30 * ev.cash), xp: Math.round(F.xpNext(L) * 0.25 * ev.xp), bars: ev.bossBars || 0 },
    };
  }

  fightBoss() {
    const info = this.bossInfo();
    if (info.done) return fail('Všetci bossovia Mesta 1 sú porazení.');
    if (!info.free) {
      // paid attempts are capped per day, so gold bars cannot buy the whole boss line in one evening
      if (!info.paidLeft) return fail('Dnes už si použil všetky ' + CONFIG.bossPaidPerDay + ' platené pokusy. Počkaj na pokus zadarmo.');
      if (this.p.chains < CONFIG.bossRetryChains) return fail('Nemáš dosť zlatých tehličiek.');
      this.p.chains -= CONFIG.bossRetryChains;
      const day = this.daily();
      day.bossPaid = (day.bossPaid || 0) + 1;
    } else if (!info.hunt) { // Hon na bossov: no cooldown at all
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
      if (info.reward.bars) { res.bars = info.reward.bars; this.p.chains += res.bars; }
    }
    this.save();
    return ok({ fight, a: me, b: info.fighter, result: res });
  }

  makeBot(level, points) {
    const raw = STATS.map(() => 0.6 + Math.random() * 0.8);
    const sum = raw.reduce((a, b) => a + b, 0);
    const stats = {};
    STATS.forEach((s, i) => { stats[s] = Math.max(5, Math.round(F.npcStat(level) * raw[i] * (5 / sum))); });
    const gear = pick(CONFIG.botGearMults);
    return { name: pick(BOT_NAMES), cls: pick(Object.keys(CLASSES)), level, stats, weapon: F.itemPower(level, gear) * CONFIG.weaponDmgMult, armor: F.itemPower(level, gear) * 5, points };
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
    if (this.locked('arena')) return this.lockedFail('arena', 'Aréna');
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
    const other = makeFighter(opp.name, opp.level, opp.stats, opp.weapon, { portrait: 'bot', cls: opp.cls, armor: opp.armor || 0, wbase: opp.wbase || null });
    const fight = simulate(me, other, seed());
    const win = fight.winner === 0;
    const L = this.p.level;
    const res = { win, points: 0, cash: 0, xp: 0, levelUps: 0 };
    if (win) {
      res.points = Math.round(20 * clamp(1 + (opp.points - v.points) / 400, 0.5, 1.5));
      const ev = this.ev();
      res.cash = Math.round(F.cashPerMin(L) * 3 * ev.cash);
      res.xp = Math.round(F.xpNext(L) * 0.03 * ev.xp);
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
Object.assign(SimServer.prototype, DailyMixin);

export { STAT_NAMES };
