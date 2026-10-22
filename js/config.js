// All tunable numbers of the prototype. Formulas follow the "Vzorce prototypu" table in the design doc.

// order matters for the UI: the three class (damage) stats on top, then luck and toughness
export const STATS = ['sila', 'obratnost', 'charizma', 'stastie', 'odolnost'];

export const STAT_NAMES = {
  sila: 'Sila',
  odolnost: 'Odolnosť',
  obratnost: 'Obratnosť',
  charizma: 'Charizma',
  stastie: 'Šťastie',
};

// More life = weaker punch. Solved for long fights so that equal-level classes win ~50 % against each other
// (simulation: 44–54 % on levels 5–150; Svalovec vs Zlodej 35–39 % on levels 5–10).
// armorCap: most damage armor can stop; armorMult: how well the class uses armor (Svalovec is always at his cap);
// dodge / block: chance to avoid hits from the listed attacker classes; pierce: ignores armor.
export const CLASSES = {
  svalovec: { name: 'Svalovec', stat: 'sila', hp: 4.5, dmg: 1.0, armorCap: 0.5, armorMult: 3, block: { zlodej: 0.28, dealer: 0.1 }, blurb: 'Najviac životov, najlepšie brnenie a blok (28 % proti Zlodejovi, 10 % proti Dealerovi), najslabší úder. Úder mu dvíha Sila.' },
  zlodej: { name: 'Zlodej', stat: 'obratnost', hp: 3.6, dmg: 1.39, armorCap: 0.25, dodge: { svalovec: 0.5 }, blurb: 'Stred. Polovici úderov Svalovca sa vyhne. Úder mu dvíha Obratnosť.' },
  dealer: { name: 'Dealer', stat: 'charizma', hp: 2.25, dmg: 2.0, armorCap: 0.1, pierce: true, blurb: 'Najsilnejší úder, ktorý ignoruje brnenie, ale najmenej životov. Úder mu dvíha Charizma.' },
};

export const RARITIES = [
  { id: 'bezny', name: 'bežný', mult: 1.0, weight: 70, color: '#5aa9ff' },
  { id: 'vzacny', name: 'vzácny', mult: 1.3, weight: 30, color: '#e9e4d8' },
  { id: 'epicky', name: 'epický', mult: 1.7, weight: 0, color: '#ff6aa8' },
  { id: 'legendarny', name: 'legendárny', mult: 2.2, weight: 0, color: '#e8c873' },
];

export const CONFIG = {
  startCash: 300,
  startChains: 20,
  startStat: 10,
  classStatBonus: 5,
  pointsPerLevel: 3,
  cityMult: 1, // Mesto 1

  // the fight at the end of a mission: a weak NPC scaled from the player's own numbers
  foeStatMult: 0.55,
  foeHpMult: 0.65,
  foeWeaponMult: 0.5,
  itemDropChance: 0.15,

  // heat is the daily mission budget (like Thirst in S&F): missions fill it, it resets at midnight,
  // the lawyer can lower it only a few times a day; it never drops on its own
  heatMax: 100,
  heatPerMissionMin: 1, // heat per nominal mission minute (less during the fast start)
  raidFrom: 80,
  raidFinePct: 0.1,
  jailMinutes: 5,
  lawyerHeat: 25,
  lawyerPerDay: 3,
  lawyerMinutes: 10,

  skipChainPerMin: 1, // chains to finish a running mission, per remaining minute (min 1)
  offersRefreshMin: 20,
  shopRefreshMin: 30,
  shopStock: 6,
  shopRerollChains: 1, // new goods right away for one gold bar
  elixirChains: 100, // Wexler's elixir: opens the Black Market for one player
  elixirHours: 24,
  bmEpicChains: 10, // an epic piece on the Black Market costs its cash price plus these gold bars
  // rolled item stats: one stat = itemPower(level, rarity mult) × share; common 1 stat, rare 2, epic 3,
  // legendary = class main stat + odolnosť, each twice the epic value
  itemStatCount: { bezny: 1, vzacny: 2, epicky: 3 },
  itemStatShare: { bezny: 0.6, vzacny: 0.45, epicky: 0.4 },

  bossCooldownMin: 240,
  bossRetryChains: 10,
  bossHpMult: 1.5,

  pvpFreePerHour: 5,
  pvpExtraChains: 1,
  pvpStartPoints: 1000,

  maxRounds: 50,
  weaponDmgMult: 3, // weapon damage = item power × this × weapon's own mult
  armorPerLevel: 40, // armor ÷ (attacker level × this) = share of damage stopped (up to the class cap)
  baseLife: 20, // life = (Odolnosť × (level + 1) + baseLife) × class hp × lifeMult
  lifeMult: 3, // longer fights = less luck in who wins
  maxUpgrade: 5,
  autoUnlockLevel: 20,

  // where rarities come from: shops sell common, the Black Market (Friday evening) epic,
  // bosses drop legendary with this chance (otherwise a rare item)
  legendaryBossChance: 0.01,
  // street violence raises heat
  heatShot: 1,
  heatHitGun: 5,
  heatHitMelee: 3,

  // a knocked-down pedestrian drops one pill: red = Šťastie, blue = class stat, green = life
  pillBoost: 0.2, // +20 % per stack
  pillMinutes: 60,
  pillMaxStacks: 1, // per colour: one of each at a time, picking the same colour again restarts its hour

  // Ripper steals a gold bar from Wexler every hour and runs around the city for a while
  reaperFirstMin: 5,
  reaperEveryMin: 60,
  reaperRunMin: 10,

  // lucky runner: a fast sparkling stranger; hitting him has a small chance for an epic item
  runnerFirstMin: 3,
  runnerEveryMin: 60, // counted from the hit
  runnerEpicChance: 0.01,

  // Wexler's gold bar packs (premium currency); real payments via Stripe come later
  barPacks: [
    { bars: 10, price: '0,99 €' },
    { bars: 55, price: '4,99 €' },
    { bars: 120, price: '9,99 €' },
    { bars: 300, price: '19,99 €' },
  ],

  blackMarketDay: 5, // 0 = Sunday … 5 = Friday
  blackMarketFromHour: 18,
  blackMarketStock: 3,
  blackMarketEpicChance: 0.2, // each Black Market piece is epic with this chance, otherwise rare (or common if no rare fits)

  // gangs & Gang Wars
  gangCreateMin: 20, // founding a gang costs this many minutes of mission cash
  gangSlots: 10,
  gangStartMembers: 4, // computer members who join a new gang
  gangRecruitMin: 10, // recruiting one more member, paid from the treasury (minutes of mission cash)
  gangDonationMin: 1, // each computer member puts this many minutes of his cash into the treasury every hour
  gangUpgradeMin: 25, // first upgrade level; level n costs this × n^1.5
  gangUpgradeMax: 5,
  gangBonusCap: 0.5,
  gangAttackSize: 4, // you + up to 3 members
  gangAttackHeat: 8,
  gangRetryMin: 30, // after a lost attack on an object
  gangSafeMin: 60, // a freshly taken object can't be attacked for this long
  gangRaidEveryMin: 60, // rival gangs make their moves once an hour
  gangRaidChance: 0.35, // chance a rival attacks each of your objects that hour
  gangRivalMoveChance: 0.15, // chance a rival / free object changes hands that hour
  turfDecayPerHour: 0.04, // defence strength lost per hour unless refilled
  turfMinStrength: 0.5,
  turfRefillMin: 8, // refilling one object's defence, paid from the treasury
  turfRewardMin: 5, // cash for taking an object (minutes of mission cash)

  // fast start: up to this level missions take seconds and pay extra XP
  fastUntil: 15,
};

export const F = {
  xpNext: (L) => Math.round(80 * Math.pow(L, 1.8)),
  cashPerMin: (L) => 20 * Math.pow(L, 1.3) + 30,
  missionXp: (L, minutes) => Math.round(F.xpNext(L) * 0.025 * minutes * F.xpBoost(L)),
  // fast start (levels below CONFIG.fastUntil): shorter missions, bigger XP share, less heat
  durationFactor: (L) => (L >= CONFIG.fastUntil ? 1 : 0.06 + 0.94 * Math.pow((L - 1) / (CONFIG.fastUntil - 1), 3)),
  xpBoost: (L) => (L >= CONFIG.fastUntil ? 1 : 1 + (3 * (CONFIG.fastUntil - L)) / (CONFIG.fastUntil - 1)),
  heatFactor: (L) => Math.max(0.15, F.durationFactor(L)),
  missionCash: (L, minutes) => Math.round(F.cashPerMin(L) * minutes * CONFIG.cityMult),
  statCost: (k) => Math.round(25 + 8 * Math.pow(k, 1.6)),
  // Shakes & Fidget style: stats multiply things that grow with level, so a point is worth more later
  cls: (cls) => CLASSES[cls] || CLASSES.svalovec,
  maxHp: (stats, L, cls) => Math.round((stats.odolnost * (L + 1) + CONFIG.baseLife) * F.cls(cls).hp * CONFIG.lifeMult),
  mainStat: (cls) => F.cls(cls).stat,
  // average hit before armor: weapon × (1 + class stat / 10) × class damage
  hitOf: (f) => f.weapon * (1 + f.stats[F.mainStat(f.cls)] / 10) * F.cls(f.cls).dmg,
  fistDmg: (L) => Math.round(F.itemPower(L, 1) * CONFIG.weaponDmgMult * 0.5),
  reduction: (armor, attackerL, defCls) => Math.min(F.cls(defCls).armorCap, (armor * (F.cls(defCls).armorMult || 1)) / (attackerL * CONFIG.armorPerLevel)),
  dodge: (defCls, attCls) => (F.cls(defCls).dodge && F.cls(defCls).dodge[attCls]) || 0,
  block: (defCls, attCls) => (F.cls(defCls).block && F.cls(defCls).block[attCls]) || 0,
  crit: (stastie, enemyL) => Math.min(0.5, (stastie * 5) / (enemyL * 2) / 100),
  difficulty: (L) => 8 + 2.2 * L,
  missionChance: (stat, L) => clamp(0.5 + 0.5 * (stat - F.difficulty(L)) / F.difficulty(L), 0.15, 0.95),
  raidChance: (heat) => (heat >= CONFIG.raidFrom ? (heat - 70) / 150 : 0),
  lawyerCost: (L) => Math.round(F.cashPerMin(L) * CONFIG.lawyerMinutes),
  itemPower: (L, rarityMult) => Math.round((1.5 * L + 5) * rarityMult),
  itemPrice: (L, rarityMult) => Math.round(F.cashPerMin(L) * 6 * rarityMult * rarityMult),
  upgradeCost: (item) => Math.round(item.price * 0.35 * (item.upgrade + 1)),
  bossLevel: (k) => 4 * k + 2,
  bossStat: (Lb) => 10 + 2.5 * Lb,
  npcStat: (L) => 10 + 2.2 * L,
};

// the game's clock: everyone plays on Slovak time, wherever the server runs
export const TIME_ZONE = 'Europe/Bratislava';
const TZ_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hourCycle: 'h23' });
export function localParts(t = Date.now()) {
  const o = {};
  for (const p of TZ_FMT.formatToParts(new Date(t))) o[p.type] = p.value;
  return { date: o.year + '-' + o.month + '-' + o.day, weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday), hour: +o.hour, minute: +o.minute, second: +o.second };
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
