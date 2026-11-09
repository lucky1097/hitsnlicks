// Every sound of the game is synthesised here with Web Audio: no files to load, nothing to license.
// sound.play(name, { delay, vol }) plays one effect; sound.weapon(base) / sound.equip(base) pick the
// effect that fits an item. On/off is per device (localStorage), off by default only if the player turned it off.
// Browsers start audio muted until the first touch or key, so nothing plays before that.
import { ITEM_BASES } from './data.js?v=20261109233638';

const KEY = 'hl_sound';
let enabled = true;
try { enabled = localStorage.getItem(KEY) !== '0'; } catch (e) { /* private mode: keep the default */ }

let ctx = null, out = null, noiseBuf = null;
const last = {}; // name -> time it last played (rapid repeats are merged)

function audio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  out = ctx.createGain();
  out.gain.value = 0.55;
  out.connect(comp);
  comp.connect(ctx.destination);
  // one second of white noise, shared by every noisy sound
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

function unlock() {
  if (!enabled) return;
  const c = audio();
  if (c && c.state !== 'running') c.resume().catch(() => {});
}
['pointerdown', 'keydown', 'touchend'].forEach((e) => window.addEventListener(e, unlock, { capture: true, passive: true }));

// ---------------------------------------------------------------- building blocks (t = start time in seconds)
// a = attack, d = decay; volume rises to vol in a, then falls away exponentially over d
function env(g, t, vol, a, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

// an oscillator: f (Hz), f2 = slide target, type, lp = lowpass cutoff
function tone(t, o) {
  const a = o.a ?? 0.005, d = o.d ?? 0.2;
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.slide ?? a + d));
  env(g, t, o.vol ?? 0.2, a, d);
  let node = osc;
  if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
  node.connect(g);
  g.connect(out);
  osc.start(t);
  osc.stop(t + a + d + 0.05);
}

// filtered noise: filter type, f = cutoff/centre, f2 = sweep target, q
function hiss(t, o) {
  const a = o.a ?? 0.003, d = o.d ?? 0.1;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.filter || 'bandpass';
  f.frequency.setValueAtTime(o.f, t);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + a + d);
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  env(g, t, o.vol ?? 0.2, a, d);
  src.connect(f);
  f.connect(g);
  g.connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + a + d + 0.05);
}

// a struck bell / glass: a few inharmonic partials
function bell(t, f, vol = 0.12, d = 0.8) {
  tone(t, { f, vol, a: 0.002, d });
  tone(t, { f: f * 2.76, vol: vol * 0.45, a: 0.002, d: d * 0.6 });
  tone(t, { f: f * 5.4, vol: vol * 0.2, a: 0.002, d: d * 0.35 });
}

function arp(t, freqs, step, o) { freqs.forEach((f, i) => tone(t + i * step, { ...o, f })); }
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- the sounds (v = volume scale)
const S = {
  // --- melee: the swing, then what it hits
  // (loudness: a peak of about 0.3–0.6 for guns and blows, 0.1–0.2 for rewards and the street, 0.04 for clicks)
  swing: (t, v) => hiss(t, { f: 500, f2: 1900, q: 1.2, vol: 0.7 * v, a: 0.03, d: 0.12 }),
  fist: (t, v) => { tone(t, { f: 170, f2: 60, vol: 0.5 * v, a: 0.003, d: 0.1 }); hiss(t, { filter: 'lowpass', f: 1300, vol: 0.28 * v, d: 0.05 }); },
  thud: (t, v) => { tone(t, { f: 125, f2: 45, vol: 0.55 * v, a: 0.003, d: 0.14 }); hiss(t, { filter: 'lowpass', f: 750, vol: 0.32 * v, d: 0.08 }); tone(t, { f: 420, f2: 300, type: 'triangle', vol: 0.06 * v, d: 0.06 }); },
  slash: (t, v) => { hiss(t, { filter: 'highpass', f: 2500, f2: 6500, vol: 0.28 * v, a: 0.004, d: 0.09 }); tone(t, { f: 2600, type: 'triangle', vol: 0.05 * v, d: 0.25 }); tone(t, { f: 140, f2: 60, vol: 0.3 * v, d: 0.08 }); },
  glass: (t, v) => {
    hiss(t, { filter: 'highpass', f: 5000, vol: 0.2 * v, d: 0.12 });
    for (let i = 0; i < 6; i++) tone(t + i * 0.022, { f: rnd(2600, 5600), vol: 0.07 * v, a: 0.001, d: rnd(0.12, 0.3) });
    tone(t, { f: 150, f2: 60, vol: 0.35 * v, d: 0.08 });
  },
  chain: (t, v) => {
    hiss(t, { filter: 'highpass', f: 3500, vol: 0.12 * v, d: 0.1 });
    for (let i = 0; i < 5; i++) tone(t + i * 0.035, { f: rnd(1600, 3200), type: 'square', vol: 0.03 * v, a: 0.001, d: 0.06, lp: 5000 });
    tone(t, { f: 130, f2: 55, vol: 0.35 * v, d: 0.1 });
  },
  // --- guns
  pistol: (t, v) => { hiss(t, { f: 1800, q: 0.8, vol: 0.75 * v, a: 0.001, d: 0.11 }); tone(t, { f: 180, f2: 50, vol: 0.55 * v, a: 0.001, d: 0.09 }); hiss(t, { filter: 'highpass', f: 6000, vol: 0.22 * v, a: 0.001, d: 0.03 }); },
  revolver: (t, v) => { hiss(t, { f: 1300, q: 0.8, vol: 0.8 * v, a: 0.001, d: 0.16 }); tone(t, { f: 150, f2: 45, vol: 0.6 * v, a: 0.001, d: 0.12 }); hiss(t + 0.02, { filter: 'lowpass', f: 700, vol: 0.15 * v, d: 0.3 }); },
  heavy: (t, v) => { hiss(t, { f: 1000, q: 0.7, vol: 0.9 * v, a: 0.001, d: 0.2 }); tone(t, { f: 120, f2: 35, vol: 0.8 * v, a: 0.001, d: 0.18 }); hiss(t + 0.02, { filter: 'lowpass', f: 600, vol: 0.22 * v, d: 0.4 }); },
  shotgun: (t, v) => { hiss(t, { filter: 'lowpass', f: 3200, f2: 380, vol: 0.95 * v, a: 0.001, d: 0.42 }); tone(t, { f: 95, f2: 30, vol: 0.85 * v, a: 0.001, d: 0.3 }); },
  rifle: (t, v) => { hiss(t, { f: 2400, q: 1, vol: 0.6 * v, a: 0.001, d: 0.07 }); tone(t, { f: 220, f2: 70, vol: 0.45 * v, a: 0.001, d: 0.06 }); },
  smg: (t, v) => { hiss(t, { f: 1300, q: 0.9, vol: 0.62 * v, a: 0.001, d: 0.09 }); tone(t, { f: 160, f2: 55, vol: 0.5 * v, a: 0.001, d: 0.08 }); },
  // --- what a fight blow does
  hit: (t, v) => { tone(t, { f: 140, f2: 50, vol: 0.45 * v, a: 0.002, d: 0.12 }); hiss(t, { filter: 'lowpass', f: 900, vol: 0.25 * v, d: 0.07 }); },
  crit: (t, v) => { tone(t, { f: 95, f2: 30, vol: 0.6 * v, a: 0.002, d: 0.28 }); hiss(t, { f: 3000, vol: 0.22 * v, d: 0.1 }); tone(t + 0.02, { f: 1900, type: 'triangle', vol: 0.06 * v, d: 0.35 }); },
  whiff: (t, v) => hiss(t, { f: 900, f2: 2800, q: 1.4, vol: 0.6 * v, a: 0.02, d: 0.15 }),
  clang: (t, v) => {
    hiss(t, { filter: 'highpass', f: 3000, vol: 0.25 * v, d: 0.05 });
    tone(t, { f: 520, type: 'square', vol: 0.05 * v, a: 0.001, d: 0.25, lp: 3000 });
    tone(t, { f: 1340, vol: 0.12 * v, a: 0.001, d: 0.45 });
    tone(t, { f: 2310, vol: 0.06 * v, a: 0.001, d: 0.3 });
  },
  body: (t, v) => { tone(t, { f: 130, f2: 50, vol: 0.4 * v, d: 0.1 }); hiss(t, { filter: 'lowpass', f: 800, vol: 0.22 * v, d: 0.06 }); },
  // --- the street
  boom: (t, v) => {
    hiss(t, { filter: 'lowpass', f: 1400, f2: 120, vol: 1 * v, a: 0.004, d: 1.2 });
    tone(t, { f: 70, f2: 25, vol: 0.9 * v, a: 0.004, d: 0.6 });
    hiss(t + 0.05, { f: 300, q: 0.6, vol: 0.35 * v, a: 0.05, d: 1.4 });
  },
  ignite: (t, v) => hiss(t, { filter: 'lowpass', f: 300, f2: 2200, vol: 1 * v, a: 0.12, d: 0.4 }),
  carhit: (t, v) => {
    hiss(t, { f: 1400, q: 2, vol: 0.8 * v, d: 0.12 });
    tone(t, { f: 230, f2: 160, type: 'square', vol: 0.07 * v, d: 0.1, lp: 1500 });
    tone(t, { f: 3100, vol: 0.04 * v, d: 0.22 });
  },
  pill: (t, v) => { tone(t, { f: 500, f2: 1400, vol: 0.25 * v, d: 0.08 }); tone(t + 0.07, { f: 1800, vol: 0.15 * v, d: 0.14 }); },
  sparkle: (t, v) => { for (let i = 0; i < 7; i++) tone(t + i * 0.04, { f: rnd(1800, 4200), vol: 0.13 * v, a: 0.002, d: 0.2 }); },
  siren: (t, v) => {
    for (let i = 0; i < 2; i++) {
      tone(t + i * 1.1, { f: 620, f2: 1250, slide: 0.55, type: 'triangle', vol: 0.2 * v, a: 0.05, d: 0.55 });
      tone(t + i * 1.1 + 0.55, { f: 1250, f2: 620, slide: 0.55, type: 'triangle', vol: 0.2 * v, a: 0.02, d: 0.55 });
    }
  },
  whistle: (t, v) => { tone(t, { f: 2650, vol: 0.2 * v, a: 0.01, d: 0.16 }); tone(t + 0.24, { f: 2650, f2: 2550, vol: 0.22 * v, a: 0.01, d: 0.45 }); },
  tram: (t, v) => { bell(t, 1250, 0.2 * v, 0.9); bell(t + 0.32, 1250, 0.18 * v, 1.1); },
  horn: (t, v) => {
    for (const k of [0, 0.3]) { tone(t + k, { f: 392, type: 'square', vol: 0.11 * v, a: 0.01, d: 0.22, lp: 1500 }); tone(t + k, { f: 494, type: 'square', vol: 0.09 * v, a: 0.01, d: 0.22, lp: 1500 }); }
  },
  // --- menus
  click: (t, v) => tone(t, { f: 1500, f2: 1100, vol: 0.07 * v, a: 0.001, d: 0.035 }),
  back: (t, v) => tone(t, { f: 900, f2: 620, vol: 0.07 * v, a: 0.001, d: 0.045 }),
  error: (t, v) => { tone(t, { f: 150, type: 'square', vol: 0.12 * v, a: 0.005, d: 0.13, lp: 1200 }); tone(t + 0.15, { f: 140, type: 'square', vol: 0.12 * v, a: 0.005, d: 0.16, lp: 1200 }); },
  up: (t, v) => tone(t, { f: 600, f2: 1250, type: 'triangle', vol: 0.18 * v, d: 0.1 }),
  go: (t, v) => { tone(t, { f: 330, type: 'triangle', vol: 0.2 * v, d: 0.14 }); tone(t + 0.09, { f: 494, type: 'triangle', vol: 0.2 * v, d: 0.22 }); },
  cash: (t, v) => {
    hiss(t, { filter: 'highpass', f: 6000, vol: 0.12 * v, d: 0.05 });
    tone(t, { f: 1976, type: 'triangle', vol: 0.2 * v, a: 0.002, d: 0.12 });
    tone(t + 0.07, { f: 2637, type: 'triangle', vol: 0.2 * v, a: 0.002, d: 0.35 });
    for (let i = 0; i < 4; i++) tone(t + 0.12 + i * 0.045, { f: rnd(3000, 4500), vol: 0.06 * v, a: 0.001, d: 0.08 });
  },
  bars: (t, v) => { bell(t, 1180, 0.13 * v, 0.6); bell(t + 0.11, 1480, 0.12 * v, 0.8); tone(t, { f: 160, f2: 90, vol: 0.2 * v, d: 0.08 }); },
  anvil: (t, v) => { S.clang(t, v); S.clang(t + 0.28, v * 0.8); },
  ready: (t, v) => { bell(t, 1046, 0.12 * v, 0.7); bell(t + 0.16, 1318, 0.12 * v, 0.9); },
  reward: (t, v) => arp(t, [784, 988, 1175, 1568], 0.08, { type: 'triangle', vol: 0.2 * v, d: 0.3 }),
  win: (t, v) => {
    arp(t, [523, 659, 784], 0.1, { type: 'triangle', vol: 0.13 * v, d: 0.25 });
    for (const f of [523, 659, 784, 1046]) tone(t + 0.3, { f, type: 'triangle', vol: 0.08 * v, a: 0.01, d: 0.9 });
  },
  lose: (t, v) => {
    arp(t, [392, 330, 262], 0.2, { type: 'sawtooth', vol: 0.2 * v, d: 0.35, lp: 900 });
    tone(t + 0.6, { f: 196, type: 'sawtooth', vol: 0.2 * v, a: 0.01, d: 1, lp: 600 });
  },
  levelup: (t, v) => {
    arp(t, [523, 659, 784, 1046, 1318], 0.07, { type: 'square', vol: 0.09 * v, d: 0.2, lp: 3000 });
    hiss(t + 0.2, { filter: 'highpass', f: 7000, vol: 0.1 * v, a: 0.1, d: 0.6 });
    tone(t + 0.35, { f: 1046, type: 'triangle', vol: 0.18 * v, a: 0.01, d: 0.9 });
  },
  // --- loot by rarity
  loot_bezny: (t, v) => { bell(t, 1318, 0.15 * v, 0.5); bell(t + 0.1, 1760, 0.15 * v, 0.6); },
  loot_epicky: (t, v) => {
    arp(t, [1318, 1568, 1976, 2637, 3136], 0.05, { vol: 0.15 * v, a: 0.002, d: 0.35 });
    hiss(t + 0.1, { filter: 'highpass', f: 7000, vol: 0.1 * v, a: 0.08, d: 0.5 });
  },
  loot_legendarny: (t, v) => {
    for (const f of [523, 659, 784]) tone(t, { f, type: 'triangle', vol: 0.12 * v, a: 0.02, d: 1.3 });
    arp(t + 0.1, [1568, 2093, 2637, 3136, 4186], 0.07, { vol: 0.11 * v, a: 0.002, d: 0.5 });
    hiss(t + 0.1, { filter: 'highpass', f: 7000, vol: 0.1 * v, a: 0.2, d: 1.2 });
    bell(t + 0.45, 1046, 0.18 * v, 1.4);
  },
  // --- putting an item on
  cock: (t, v) => { hiss(t, { filter: 'highpass', f: 2500, vol: 0.3 * v, d: 0.03 }); hiss(t + 0.09, { f: 1800, vol: 0.35 * v, d: 0.04 }); tone(t + 0.09, { f: 900, type: 'square', vol: 0.03 * v, d: 0.02 }); },
  shing: (t, v) => { hiss(t, { filter: 'highpass', f: 4000, f2: 8000, vol: 0.16 * v, a: 0.02, d: 0.25 }); tone(t + 0.02, { f: 3200, vol: 0.05 * v, a: 0.01, d: 0.5 }); tone(t + 0.02, { f: 4800, vol: 0.03 * v, a: 0.01, d: 0.4 }); },
  cloth: (t, v) => { hiss(t, { f: 1200, f2: 2400, q: 0.7, vol: 0.45 * v, a: 0.04, d: 0.12 }); hiss(t + 0.14, { f: 1500, f2: 900, q: 0.7, vol: 0.35 * v, a: 0.03, d: 0.12 }); },
  steps: (t, v) => { for (const k of [0, 0.22]) { tone(t + k, { f: 110, f2: 60, vol: 0.3 * v, d: 0.08 }); hiss(t + k, { filter: 'lowpass', f: 600, vol: 0.18 * v, d: 0.05 }); } },
  jingle: (t, v) => { for (let i = 0; i < 6; i++) tone(t + i * 0.04 + rnd(0, 0.02), { f: rnd(2200, 4200), vol: 0.12 * v, a: 0.001, d: 0.15 }); },
  ting: (t, v) => bell(t, 2637, 0.16 * v, 0.8),
  tick: (t, v) => { for (let i = 0; i < 4; i++) tone(t + i * 0.13, { f: i % 2 ? 2500 : 3000, type: 'square', vol: 0.07 * v, a: 0.001, d: 0.015, lp: 6000 }); },
  engine: (t, v) => {
    tone(t, { f: 2000, type: 'square', vol: 0.04 * v, d: 0.03 }); // the key
    tone(t + 0.12, { f: 50, f2: 150, slide: 0.4, type: 'sawtooth', vol: 0.3 * v, a: 0.04, d: 0.42, lp: 700 });
    tone(t + 0.55, { f: 150, f2: 70, slide: 0.5, type: 'sawtooth', vol: 0.22 * v, a: 0.01, d: 0.55, lp: 600 });
  },
};

// which sound each weapon makes; new weapons get a `sfx` field in ITEM_BASES or fall back by attack type
const WEAPON_SFX = {
  bat: 'thud', hockey: 'thud', crowbar: 'thud', knuckles: 'fist', bottle: 'glass', bikechain: 'chain',
  knife: 'slash', machete: 'slash', katana: 'slash',
  glock: 'pistol', revolver: 'revolver', deagle: 'heavy', gold1911: 'heavy', sawnoff: 'shotgun',
  kalach: 'rifle', ak: 'rifle', kalash_wood: 'rifle', tommy_gold: 'smg',
};
const SLOT_SFX = { bunda: 'cloth', nohavice: 'cloth', topanky: 'steps', retiazka: 'jingle', prsten: 'ting', hodinky: 'tick', auto: 'engine' };

export const sound = {
  get on() { return enabled; },
  get state() { return ctx ? ctx.state : 'none'; }, // for testing in the console (hl.sound)
  names: () => Object.keys(S),
  set(on) {
    enabled = !!on;
    try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch (e) { /* not saved, still applies now */ }
    if (enabled) unlock();
    else if (ctx) ctx.suspend().catch(() => {});
  },
  play(name, o = {}) {
    if (!enabled || !S[name] || document.hidden || !audio() || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (!o.delay && last[name] && now - last[name] < 0.03) return; // two in the same instant sound as one, only louder
    last[name] = now;
    try { S[name](now + 0.005 + (o.delay || 0), o.vol ?? 1); } catch (e) { console.warn('sound', name, e); } // a sound must never break the game
  },
  // the strike sound of a weapon base id ('fist' for bare hands)
  weaponSfx(base) {
    if (!base || !ITEM_BASES[base]) return 'fist';
    const b = ITEM_BASES[base];
    return b.sfx || WEAPON_SFX[base] || (b.attack === 'gun' ? 'pistol' : 'thud');
  },
  isGun(base) { return !!(base && ITEM_BASES[base] && ITEM_BASES[base].attack === 'gun'); },
  // putting on an item: a gun is cocked, a blade drawn, a bat taken in hand, clothes rustle, a ring rings…
  equip(base) {
    const b = ITEM_BASES[base];
    if (!b) return;
    if (b.slot === 'zbran') {
      const s = this.weaponSfx(base);
      this.play(b.attack === 'gun' ? 'cock' : s === 'slash' ? 'shing' : s === 'chain' ? 'jingle' : 'thud', { vol: b.attack === 'gun' ? 1 : 0.6 });
    } else this.play(SLOT_SFX[b.slot] || 'cloth');
  },
};
