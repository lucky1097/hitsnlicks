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
  { id: 'bezny', name: 'bežný', mult: 1.0, color: '#5aa9ff' },
  { id: 'epicky', name: 'epický', mult: 1.7, color: '#ff6aa8' },
  { id: 'legendarny', name: 'legendárny', mult: 2.2, color: '#e8c873' },
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
  // daily missions (js/daily.js): cash day = this many minutes of mission cash (day 14 pays twice day 1),
  // gold bars on days 5 / 10 / 15, courier and escape time limits in seconds
  dailyCashMin: 30,
  dailyBars: { 5: 20, 10: 35, 15: 50 },
  dailyCourierSec: 120,
  // police on foot (heat >= raidFrom): every officer you put down doubles how many chase you, up to copMax;
  // an officer may drop an epic item (copEpicChance, at most copEpicPerDay a day); caught after a kill = lose
  // killCashShare of your cash or killJailMin without Don / Díler missions
  copMax: 8,
  // wanted level (stars): what each street crime adds (×(1 + heat/100)), chase from wantedChase stars,
  // a star lost every wantedLoseSec out of the officers' sight (and on its own after wantedIdleSec of quiet),
  // the officer must hold you arrestSec to arrest you, then peace for caughtPeaceSec
  wantedGain: { shot: 0.25, hitMelee: 0.6, hitGun: 0.8, car: 0.15, blast: 1, copHit: 0.5, copKill: 1, spray: 1 },
  wantedChase: 2,
  wantedLoseSec: 20,
  wantedIdleSec: 120,
  wantedSightPx: 150,
  arrestSec: 2.5,
  caughtPeaceSec: 300,
  // hideout: stay hideMin minutes and the police on foot leave you alone for shadowMin, even at high heat
  hideMin: 5,
  shadowMin: 20,
  copEpicChance: 0.1, // per officer put down
  copEpicPerDay: 5, // cap per day: it also limits what a modified client could farm
  copKillGapMs: 250,
  heatCopHit: 4,
  heatCopKill: 15,
  killJailMin: 120,
  killCashShare: 0.5,
  // cars on the street: heat for a hit and for a blown-up car
  heatCarHit: 1,
  heatBlast: 10,
  dailyEscapeSec: 30,
  dailyFollowSec: 45, // tracking: stay behind the target this long
  dailySpraySec: 3, // graffiti: stand at the rival's door this long
  dailySprayHeat: 8,
  // premium cars in the Autobazár: epic = cash + bars, legendary = bars only
  carBars: { epicky: 100, legendarny: 500 },
  elixirChains: 100, // Wexler's elixir: opens the Black Market for one player
  elixirHours: 24,
  bmEpicChains: 10, // an epic piece on the Black Market costs its cash price plus these gold bars
  // rolled item stats: one stat = itemPower(level, rarity mult) × share; common 1 stat, epic 3,
  // legendary = class main stat + odolnosť, each twice the epic value
  itemStatCount: { bezny: 1, epicky: 3 },
  itemStatShare: { bezny: 0.6, epicky: 0.4 },

  bossCooldownMin: 240,
  bossRetryChains: 10,
  bossPaidPerDay: 3, // attempts for gold bars a day; the free one every bossCooldownMin comes on top
  bossHpMult: 1.5,

  pvpFreePerHour: 5,
  pvpExtraChains: 1,
  pvpStartPoints: 1000,

  maxRounds: 50,
  weaponDmgMult: 3, // weapon damage = item power × this × weapon's own mult
  botGearMults: [1, 1.3, 1.7], // computer fighters (arena bots, rival gangsters) carry gear of one of these strengths
  armorPerLevel: 40, // armor ÷ (attacker level × this) = share of damage stopped (up to the class cap)
  baseLife: 20, // life = (Odolnosť × (level + 1) + baseLife) × class hp × lifeMult
  lifeMult: 3, // longer fights = less luck in who wins
  maxUpgrade: 5,
  autoUnlockLevel: 20,
  unlock: { arena: 5, club: 8, gang: 10, blackMarket: 15 },
  // Podzemné zápasy: an endless-feeling ladder for when the bosses are done; fighters grow with F.clubLevel
  clubFloors: 100,
  clubCooldownMin: 60, // one fight an hour, won or lost
  clubHpMult: 1.2,
  clubCashMin: 15, // cash per win = this many minutes of mission cash at your level
  clubXpShare: 0.08, // XP per win = this share of your current level
  clubBarsEvery: 10, // every 10th floor pays clubBars gold bars
  clubBars: 10,
  clubEpicEvery: 25, // every 25th floor an epic piece; the last floor a legendary one // features open step by step, so a new player is not flooded

  // where rarities come from: shops and missions common, the Black Market (Friday evening) only epic,
  // bosses drop legendary with this chance, else epic with bossEpicChance, else a common item
  legendaryBossChance: 0.01,
  bossEpicChance: 0.2,
  bossGearMult: 1.7, // a boss's weapon and armour are as strong as epic gear of his level
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
  blackMarketStock: 3, // epic pieces per shop, every base at most once

  // gangs & Gang Wars
  gangCreateMin: 20, // founding a gang costs this many minutes of mission cash
  gangSlots: 10,
  gangUpgradeMin: 25, // first upgrade level; level n costs this × n^1.5
  gangUpgradeMax: 5,
  gangBonusCap: 0.5,
  gangAttackSize: 5, // you + up to 4 other members (their saved arena form)
  gangAttackHeat: 8,
  gangRetryMin: 30, // after a lost attack on an object
  gangSafeMin: 60, // a freshly taken object can't be attacked for this long
  gangRaidEveryMin: 60, // rival gangs make their moves once an hour
  gangRaidChance: 0.35, // chance a computer rival attacks each object a players' gang holds that hour
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
  bossLevel: (k) => Math.round(6 + (k - 1) * 1.8), // 25 bosses of Mesto 1: level 6 … 49
  // grows like a player who also buys stats: a level-30 player is about even with a level-29 boss
  clubLevel: (n) => Math.round(5 + 0.75 * (n - 1)), // Podzemné zápasy floor 1 … 100: level 5 … 79
  bossStat: (Lb) => 10 + 2.5 * Lb + 0.25 * Lb * Lb,
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
