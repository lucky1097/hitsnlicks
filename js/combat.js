// Automatic stat-based combat. Pure functions: the real server would run exactly this.
import { CONFIG, F } from './config.js?v=20261023214817';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// fighter: { name, level, stats: {sila, odolnost, obratnost, charizma, stastie}, weapon, cls, armor?, hpMult? }
// cls decides the damage stat, life and damage multipliers, armor cap and special rules (CLASSES in config)
export function makeFighter(name, level, stats, weapon, extra = {}) {
  const hp = Math.round(F.maxHp(stats, level, extra.cls) * (extra.hpMult || 1));
  return { name, level, stats, weapon: weapon || F.fistDmg(level), armor: 0, hp, ...extra };
}

export function simulate(a, b, seed) {
  const rng = mulberry32(seed);
  const hp = [a.hp, b.hp];
  const f = [a, b];
  const rounds = [];
  const first = rng() < 0.5 ? 0 : 1; // who opens is a coin flip
  let winner = -1;
  outer: for (let r = 1; r <= CONFIG.maxRounds; r++) {
    for (const turn of [first, 1 - first]) {
      const att = f[turn], def = f[1 - turn];
      const ev = { round: r, attacker: turn };
      if (rng() < F.dodge(def.cls, att.cls)) {
        ev.dodge = true;
        ev.dmg = 0;
      } else if (rng() < F.block(def.cls, att.cls)) {
        ev.block = true;
        ev.dmg = 0;
      } else {
        const base = F.hitOf(att) * (0.85 + 0.3 * rng());
        ev.crit = rng() < F.crit(att.stats.stastie, def.level);
        const armor = F.cls(att.cls).pierce ? 0 : F.reduction(def.armor || 0, att.level, def.cls);
        ev.dmg = Math.max(1, Math.round(base * (ev.crit ? 2 : 1) * (1 - armor)));
        hp[1 - turn] = Math.max(0, hp[1 - turn] - ev.dmg);
      }
      ev.hp = [hp[0], hp[1]];
      rounds.push(ev);
      if (hp[1 - turn] <= 0) { winner = turn; break outer; }
    }
  }
  if (winner < 0) winner = hp[0] / a.hp >= hp[1] / b.hp ? 0 : 1;
  return { winner, rounds, hp, maxHp: [a.hp, b.hp] };
}
