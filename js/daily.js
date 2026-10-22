// Daily missions: three tasks a day played on the map. Finishing all three pays the next day of a
// 15-day reward calendar (cash, a level, gold bars, a legendary item on day 15). A skipped day just waits.
// The map reports progress (dailyStep); the server picks the places, counts and checks the timing.
// Mixed into SimServer, so `this` is the server.
import { CONFIG, F } from './config.js?v=20261022235132';
import { ITEM_BASES, POIS, TURF } from './data.js?v=20261022235132';

const ok = (data = {}) => ({ ok: true, ...data });
const fail = (error) => ({ ok: false, error });
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const seed = () => Math.floor(Math.random() * 2 ** 31);
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// places a task can send you: building doors (city.json marks) of shops, services and gang turf
export const DAILY_SPOTS = [
  ...POIS.filter((p) => p.at && p.at !== 'kladivo').map((p) => ({ id: p.at, name: p.name.split(' · ')[0] })),
  ...TURF.map((t) => ({ id: t.id, name: t.name })),
];
const spotName = (id) => (DAILY_SPOTS.find((s) => s.id === id) || { name: id }).name;

// what each task type is: group (easy / action / hard), how many steps, a title and its text
export const DAILY_TYPES = {
  scout: { group: 'easy', name: 'Prieskum', need: 3, text: (d) => 'Obehni tri miesta: ' + d.spots.map(spotName).join(', ') + '.' },
  stash: { group: 'easy', name: 'Skrýše', need: 5, text: () => 'Pozbieraj 5 balíčkov schovaných po uliciach štvrte.' },
  courier: { group: 'easy', name: 'Kuriér', need: 2, text: (d) => 'Vyzdvihni balík: ' + spotName(d.from) + '. Dones ho do ' + CONFIG.dailyCourierSec / 60 + ' minút: ' + spotName(d.to) + '.' },
  runner: { group: 'action', name: 'Bežec alebo Ripper', need: 1, text: () => 'Zraz šťastného bežca alebo chyť Rippera, ktorý okradol Wexlera.' },
  dlznik: { group: 'action', name: 'Dlžník', need: 1, text: () => 'Dlžník chodí po štvrti a pred tebou uteká. Zbi ho tromi údermi, alebo mu vyhoď do vzduchu auto (obe sú označené).' },
  vreckar: { group: 'action', name: 'Vreckár', need: 1, text: () => 'Chodec s plnou taškou sa prechádza po chodníku. Keď sa priblížiš, dá sa na útek. Dobehni ho a tašku mu vytrhni.' },
  sledovanie: { group: 'action', name: 'Sledovanie', need: 1, text: () => 'Choď ' + CONFIG.dailyFollowSec + ' sekúnd za označeným cieľom. Nepribližuj sa príliš, inak si ťa všimne, a nestrať ho z dohľadu.' },
  graffiti: { group: 'hard', name: 'Graffiti', need: 1, text: (d) => 'Nastriekaj značku na objekt rivalov: ' + spotName(d.spot) + '. Postoj ' + CONFIG.dailySpraySec + ' sekundy pri dverách. Rivali si to všimnú, heat stúpne.' },
  vypalne: { group: 'action', name: 'Výpalné', need: 1, text: () => 'Majiteľ podniku neplatí. Jeho auto je na mape označené zlatým kruhom. Rozbi ho, kým nezačne horieť a nevybuchne.' },
  escape: { group: 'hard', name: 'Útek', need: 1, text: () => 'Keď ťa pri vysokom heate naháňa polícia pešo, vydrž ' + CONFIG.dailyEscapeSec + ' sekúnd, kým ťa nechytí.' },
  razia: { group: 'hard', name: 'Policajná razia', need: 3, text: () => 'Pri vysokom heate zlož 2 policajtov a potom sa ' + CONFIG.dailyEscapeSec + ' sekúnd nedaj chytiť. Za každého zloženého ich príde dvakrát viac.' },
};

export const DailyMixin = {
  // today's tasks (rolled at the first look after midnight) and how far the reward calendar is
  dailyQuests() {
    const key = this.dayKey();
    let q = this.state.dailyQ;
    if (!q || q.key !== key) {
      q = this.state.dailyQ = { key, tasks: this.rollDailyTasks(), done: false };
      this.save();
    }
    return q;
  },

  // one easy, one action and one hard task
  rollDailyTasks() {
    const of = (g) => pick(Object.keys(DAILY_TYPES).filter((t) => DAILY_TYPES[t].group === g));
    return ['easy', 'action', 'hard'].map(of).map((type) => ({ type, have: [], data: this.dailyData(type) }));
  },

  dailyData(type) {
    if (type === 'scout') return { spots: shuffle(DAILY_SPOTS.map((s) => s.id)).slice(0, 3) };
    if (type === 'stash') return { seed: seed() };
    if (type === 'courier') { const [from, to] = shuffle(DAILY_SPOTS.map((s) => s.id)); return { from, to, pickedAt: 0 }; }
    if (type === 'escape' || type === 'razia') return { startedAt: 0 };
    if (type === 'vypalne' || type === 'dlznik' || type === 'vreckar' || type === 'sledovanie') return { seed: seed(), startedAt: 0 }; // where the person starts / which car
    if (type === 'graffiti') { // a building of a rival gang (any turf when you hold them all)
      const objs = this.turf().objects;
      const rival = TURF.filter((t) => objs[t.id] && objs[t.id].owner && objs[t.id].owner !== this.myGangId());
      return { spot: pick(rival.length ? rival : TURF).id, startedAt: 0 };
    }
    return {};
  },

  // day n (1-15) of the cycle: what finishing it pays
  dailyReward(n) {
    const L = this.p.level;
    if (n % 15 === 0) return { type: 'legendary', bars: CONFIG.dailyBars[15] };
    if (n % 5 === 0) return { type: 'bars', bars: CONFIG.dailyBars[n] };
    if (n % 3 === 0) return { type: 'level' };
    return { type: 'cash', cash: Math.round(F.cashPerMin(L) * CONFIG.dailyCashMin * (1 + (n - 1) / 13)) };
  },

  dailyDayNow() { return ((this.state.dailyDay || 0) % 15) + 1; },

  dailyView() {
    const q = this.dailyQuests();
    return {
      day: this.dailyDayNow(),
      done: q.done,
      nextAt: this.nextDayAt(),
      tasks: q.tasks.map((t, i) => {
        const T = DAILY_TYPES[t.type];
        return { i, type: t.type, name: T.name, group: T.group, text: T.text(t.data), have: t.have.length, need: T.need, done: t.have.length >= T.need, data: t.data };
      }),
      calendar: Array.from({ length: 15 }, (_, k) => this.dailyReward(k + 1)),
    };
  },

  // what the map needs every frame: open tasks with the steps already done
  dailyMap() {
    const q = this.dailyQuests();
    return { done: q.done, escapeSec: CONFIG.dailyEscapeSec, courierSec: CONFIG.dailyCourierSec, followSec: CONFIG.dailyFollowSec, spraySec: CONFIG.dailySpraySec, tasks: q.tasks.map((t, i) => ({ i, type: t.type, got: t.have, data: t.data, done: t.have.length >= DAILY_TYPES[t.type].need })) };
  },

  // the map reports one step of task i; step = which spot / package / stage
  dailyStep(i, step) {
    const q = this.dailyQuests();
    const t = q.tasks[Number(i)];
    if (!t || q.done) return fail('Táto úloha už neplatí.');
    const T = DAILY_TYPES[t.type];
    step = Number(step);
    if (t.have.length >= T.need) return ok({ already: true });
    const now = Date.now();
    if (t.type === 'scout') {
      if (!(step >= 0 && step < 3) || t.have.includes(step)) return ok({ already: true });
      if (t.lastAt && now - t.lastAt < 2000) return fail('Príliš rýchlo.');
      t.have.push(step);
    } else if (t.type === 'stash') {
      if (!(step >= 0 && step < T.need) || t.have.includes(step)) return ok({ already: true });
      t.have.push(step);
    } else if (t.type === 'courier') {
      if (step === 0) { // picked up: the clock starts
        if (t.have.length) return ok({ already: true });
        t.data.pickedAt = now;
        t.have.push(0);
      } else {
        const took = now - t.data.pickedAt;
        if (!t.data.pickedAt || t.have.length !== 1) return fail('Najprv vyzdvihni balík.');
        if (took > (CONFIG.dailyCourierSec + 3) * 1000) { // too late: start over
          t.have = []; t.data.pickedAt = 0;
          this.save();
          return ok({ failed: 'Neskoro. Balík sa vrátil na miesto, skús to znova.' });
        }
        if (took < 4000) return fail('Príliš rýchlo.');
        t.have.push(1);
      }
    } else if (t.type === 'escape' || t.type === 'razia') {
      // the raid's escape counts only after its two officers (dailyEvent from copDown)
      if (t.type === 'razia' && t.have.length < 2) return fail('Najprv zlož dvoch policajtov.');
      if (step === 0) { t.data.startedAt = now; this.save(); return ok({ started: true }); }
      if (!t.data.startedAt || now - t.data.startedAt < (CONFIG.dailyEscapeSec - 2) * 1000) return fail('Ešte si neušiel.');
      if (this.heatNow() < CONFIG.raidFrom) return fail('Polícia ťa už nenaháňa.');
      t.have.push(1);
    } else if (t.type === 'vypalne' || t.type === 'dlznik' || t.type === 'vreckar') {
      t.have.push(1); // the marked car blew up / the debtor went down / the bag is yours
    } else if (t.type === 'sledovanie' || t.type === 'graffiti') {
      // timed on the map: step 0 starts the clock, step 1 ends it (too early = refused)
      const sec = t.type === 'sledovanie' ? CONFIG.dailyFollowSec : CONFIG.dailySpraySec;
      if (step === 0) { t.data.startedAt = now; this.save(); return ok({ started: true }); }
      if (!t.data.startedAt || now - t.data.startedAt < (sec - 1.5) * 1000) return fail('Ešte nie.');
      t.have.push(1);
      if (t.type === 'graffiti') this.addHeat(CONFIG.dailySprayHeat);
    } else {
      return fail('Túto úlohu splníš inak.');
    }
    t.lastAt = now;
    const out = { task: Number(i), have: t.have.length, need: T.need, done: t.have.length >= T.need };
    const reward = this.dailyCheckDone();
    this.save();
    return ok({ ...out, reward });
  },

  // street events count for tasks: runner (hitRunner / catchRipper), the raid's officers (copDown)
  dailyEvent(type) {
    const q = this.dailyQuests();
    if (q.done) return null;
    const cap = type === 'razia' ? 2 : null; // the raid's last step is its escape
    const t = q.tasks.find((x) => x.type === type && x.have.length < (cap || DAILY_TYPES[x.type].need));
    if (!t) return null;
    t.have.push(1);
    return { name: DAILY_TYPES[type].name, have: t.have.length, need: DAILY_TYPES[type].need, reward: this.dailyCheckDone() };
  },

  // caught by the police: an escape starts over
  dailyCaught() {
    const q = this.state.dailyQ;
    if (q) q.tasks.forEach((x) => { if (x.type === 'escape' || x.type === 'razia') x.data.startedAt = 0; });
  },

  // all three done: pay the calendar day right away (nothing can be lost at midnight)
  dailyCheckDone() {
    const q = this.state.dailyQ;
    if (q.done || !q.tasks.every((t) => t.have.length >= DAILY_TYPES[t.type].need)) return null;
    q.done = true;
    const n = this.dailyDayNow();
    const r = this.dailyReward(n);
    const out = { day: n, ...r, levelUps: 0 };
    if (r.cash) this.p.cash += r.cash;
    if (r.bars) this.p.chains += r.bars;
    if (r.type === 'level') out.levelUps = this.addXp(Math.max(1, F.xpNext(this.p.level) - this.p.xp));
    if (r.type === 'legendary') {
      const pool = Object.keys(ITEM_BASES).filter((id) => ITEM_BASES[id].rarity === 'legendarny' && !ITEM_BASES[id].shopOnly);
      out.item = this.makeItem(pick(pool), this.p.level, 'legendarny');
      this.giveItem(out.item);
    }
    this.state.dailyDay = (this.state.dailyDay || 0) + 1;
    return out;
  },
};
