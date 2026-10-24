// Weekend events: every weekend from Friday 18:00 to Sunday 23:59 (Bratislava time) two events run at once,
// a better one and a weaker one, following a 6-weekend rotation. Server and client compute them from the date,
// so every player has the same weekend. fx() merges what the active events change; the game reads it where
// rewards, prices and timers are worked out.
import { localParts } from './config.js?v=20261024154006';

const DAY = 86400000;

// fx keys: xp, cash, missionTime, missionHeat, wanted, price, lawyerCost (multipliers);
// barChance, bossBars, legendBoss, legendMission, bmStock (values); reaperEvery, runnerEvery, runnerEpic, pillTime,
// turfReward, turfWins (multipliers); bmAll, freeReroll, bossFree, noDecay, noRetry, lawyerUnlimited (switches)
export const EVENTS = {
  xp2: { name: 'Dvojité XP', tier: 'lepsi', icon: '★', desc: 'Misie, bossovia, aréna aj Gang Wars dávajú dvojnásobné XP.', fx: { xp: 2 } },
  fast: { name: 'Rýchle prachy', tier: 'horsi', icon: '⏱', desc: 'Misie trvajú polovicu času.', fx: { missionTime: 0.5 } },
  gold: { name: 'Zlatá horúčka', tier: 'lepsi', icon: '▰', desc: 'Každá vyhratá misia má 25 % šancu dať 1 až 3 zlaté tehličky. Bossovia pridajú 3 tehličky a Ripper chodí dvakrát častejšie.', fx: { barChance: 0.25, bossBars: 3, reaperEvery: 0.5 } },
  lucky: { name: 'Šťastný víkend', tier: 'horsi', icon: '✦', desc: 'Šťastný bežec chodí každých 15 minút s dvojnásobnou šancou na epický predmet. Tabletky pôsobia dvakrát dlhšie.', fx: { runnerEvery: 0.25, runnerEpic: 2, pillTime: 2 } },
  gangs: { name: 'Víkend gangov', tier: 'lepsi', icon: '⚑', desc: 'Obsadenie objektu dáva dvojnásobnú odmenu a v sieni slávy sa ráta za dve výhry. Obrana objektov neslabne a po neúspešnom útoku sa dá skúsiť hneď.', fx: { turfReward: 2, turfWins: 2, noDecay: true, noRetry: true } },
  amnesty: { name: 'Amnestia', tier: 'horsi', icon: '⚖', desc: 'Právnička je za polovicu a bez denného limitu.', fx: { lawyerCost: 0.5, lawyerUnlimited: true } },
  cash2: { name: 'Dvojité peniaze', tier: 'lepsi', icon: '$', desc: 'Misie, bossovia, aréna aj Gang Wars dávajú dvojnásobné peniaze.', fx: { cash: 2 } },
  strike: { name: 'Policajný štrajk', tier: 'horsi', icon: '✋', desc: 'Hľadanosť na ulici aj heat z misií pribúdajú o polovicu pomalšie.', fx: { wanted: 0.5, missionHeat: 0.5 } },
  bm: { name: 'Čierny trh celý víkend', tier: 'lepsi', icon: '◆', desc: 'Čierny trh je otvorený pre všetkých celý víkend a v každom obchode ponúka o 2 epické kusy viac.', fx: { bmAll: true, bmStock: 2 } },
  sale: { name: 'Výpredaj', tier: 'horsi', icon: '%', desc: 'Obchody aj vylepšenia u mechanika sú o 30 % lacnejšie a nový tovar je zadarmo.', fx: { price: 0.7, freeReroll: true } },
  legend: { name: 'Legendárny víkend', tier: 'lepsi', icon: '♛', desc: 'Šanca na legendárny predmet z bossa je 5 % namiesto 1 % a legendárny predmet môže padnúť aj z misie.', fx: { legendBoss: 0.05, legendMission: 0.005 } },
  bosshunt: { name: 'Hon na bossov', tier: 'horsi', icon: '☠', desc: 'Pokusy na bossov sú bez čakania a bez tehličiek.', fx: { bossFree: true } },
};

// the 6-weekend cycle, [better, weaker]; week 1 is the weekend starting EVENT_START
export const EVENT_ROTATION = [['xp2', 'fast'], ['gold', 'lucky'], ['gangs', 'amnesty'], ['cash2', 'strike'], ['bm', 'sale'], ['legend', 'bosshunt']];
export const EVENT_START = '2026-10-23'; // a Friday
// a different pair for one weekend: { 'YYYY-MM-DD' (its Friday): ['id', 'id'] }
export const EVENT_OVERRIDES = {};
export const EVENT_FROM_HOUR = 18;

const dayNum = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY;

// the weekend's Friday (local date) if t falls inside an event weekend, else null
function weekendFriday(t) {
  const l = localParts(t);
  const back = l.weekday === 5 ? (l.hour >= EVENT_FROM_HOUR ? 0 : -1) : l.weekday === 6 ? 1 : l.weekday === 0 ? 2 : -1;
  return back < 0 ? null : localParts(t - back * DAY).date;
}

function pairFor(friday) {
  if (EVENT_OVERRIDES[friday]) return EVENT_OVERRIDES[friday];
  const n = Math.floor((dayNum(friday) - dayNum(EVENT_START)) / 7);
  return EVENT_ROTATION[((n % EVENT_ROTATION.length) + EVENT_ROTATION.length) % EVENT_ROTATION.length];
}

// when the local clock next reads (date, hour:00); found by stepping, so it is right across DST changes
function localAt(date, hour, from) {
  for (let t = Math.floor(from / 3600000) * 3600000; t < from + 9 * DAY; t += 3600000) {
    const l = localParts(t);
    if (l.date === date && l.hour === hour) return t;
  }
  return from;
}

// { ids, until } of the running weekend, or null
export function activeEvents(t = Date.now()) {
  const fri = weekendFriday(t);
  if (!fri) return null;
  const monday = localParts(dayNum(fri) * DAY + 3.5 * DAY).date;
  return { ids: pairFor(fri), friday: fri, until: localAt(monday, 0, t) };
}

// { ids, from } of the next weekend that has not started yet
export function nextEvents(t = Date.now()) {
  for (let k = 0; k <= 8; k++) {
    const l = localParts(t + k * DAY);
    if (l.weekday !== 5) continue;
    const from = localAt(l.date, EVENT_FROM_HOUR, t);
    if (from > t) return { ids: pairFor(l.date), friday: l.date, from };
  }
  return null;
}

const ONE = { xp: 1, cash: 1, missionTime: 1, missionHeat: 1, wanted: 1, price: 1, lawyerCost: 1, reaperEvery: 1, runnerEvery: 1, runnerEpic: 1, pillTime: 1, turfReward: 1, turfWins: 1 };

// what the running events change, merged: multipliers multiply, the rest take the larger value / switch on
export function eventFx(t = Date.now()) {
  const fx = { ...ONE };
  const a = activeEvents(t);
  if (!a) return fx;
  for (const id of a.ids) {
    for (const [k, v] of Object.entries((EVENTS[id] || {}).fx || {})) {
      if (k in ONE) fx[k] *= v;
      else if (typeof v === 'boolean') fx[k] = fx[k] || v;
      else fx[k] = Math.max(fx[k] || 0, v);
    }
  }
  return fx;
}
