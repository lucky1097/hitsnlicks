// Turns the generated sounds (zdroj_art/sfx_raw/<name>.mp3, local only) into the game's files (assets/sfx/<name>.mp3):
// trims silence at both ends, brings each to a loudness by kind (RMS target, peak limited), short fade-out, mono mp3.
// Needs ffmpeg + ffprobe on PATH. Prompts for the generator: tools/sfx/sfx_list.json (Higgsfield mirelo_text_to_audio).
//   node tools/sfx/sfx_process.mjs          all sounds
//   node tools/sfx/sfx_process.mjs a b c    only these
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RAW = path.join(ROOT, 'zdroj_art/sfx_raw'); // generated originals (local only)
const OUT = path.join(ROOT, 'assets/sfx');
const TMP = path.join(os.tmpdir(), 'hl_sfx_tmp');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

// mean loudness target (dB RMS) by kind
const KIND = {
  blow: -16, gun: -15, whoosh: -21, street: -20, reward: -20, equip: -22, ui: -27,
};
const OF = {
  fist: 'blow', thud: 'blow', slash: 'blow', glass: 'blow', chain: 'blow', hit: 'blow', crit: 'blow', clang: 'blow', body: 'blow',
  pistol: 'gun', silenced: 'gun', revolver: 'gun', heavy: 'gun', shotgun: 'gun', rifle: 'gun', smg: 'gun', boom: 'gun',
  swing: 'whoosh', whiff: 'whoosh',
  ignite: 'street', carhit: 'street', siren: 'street', whistle: 'street', tram: 'street', horn: 'street', engine: 'street',
  cash: 'reward', bars: 'reward', anvil: 'reward', ready: 'reward', reward: 'reward', win: 'reward', lose: 'reward', levelup: 'reward',
  loot_bezny: 'reward', loot_epicky: 'reward', loot_legendarny: 'reward', sparkle: 'reward', pill: 'reward',
  cock: 'equip', shing: 'equip', cloth: 'equip', steps: 'equip', jingle: 'equip', ting: 'equip', tick: 'equip',
  click: 'ui', back: 'ui', up: 'ui', go: 'ui', error: 'ui',
};
const MAXLEN = { siren: 2.6, boom: 2.5 }; // seconds; the rest keep their generated length

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
// volumedetect writes to stderr: mean and peak in dB, plus the length from ffprobe
const measure = (file) => {
  const txt = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const mean = Number((txt.match(/mean_volume: ([-0-9.]+)/) || [])[1]);
  const max = Number((txt.match(/max_volume: ([-0-9.]+)/) || [])[1]);
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }));
  return { mean, max, dur };
};

const only = process.argv.slice(2);
const names = Object.keys(OF).filter((n) => !only.length || only.includes(n));
const report = [];
for (const n of names) {
  const src = path.join(RAW, n + '.mp3');
  if (!fs.existsSync(src)) { report.push(n + ' MISSING'); continue; }
  const raw = measure(src);
  // 1) peak to -1 dB, cut silence at the start and the end (below -50 dB), cap the length
  const t1 = path.join(TMP, n + '_1.wav');
  const pre = -1 - raw.max;
  const trim = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.005,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse';
  ff(['-i', src, '-ac', '1', '-af', `volume=${pre.toFixed(2)}dB,${trim}` + (MAXLEN[n] ? `,atrim=0:${MAXLEN[n]}` : ''), t1]);
  const m = measure(t1);
  // 2) loudness by kind: gain to the RMS target, a limiter keeps the peak under -1 dB, 30 ms fade-out
  const gain = KIND[OF[n]] - m.mean;
  const fadeAt = Math.max(0, m.dur - 0.03);
  const dst = path.join(OUT, n + '.mp3');
  ff(['-i', t1, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.89:attack=1:release=20:level=false,afade=t=out:st=${fadeAt.toFixed(3)}:d=0.03`, '-ar', '44100', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '96k', dst]);
  const f = measure(dst);
  report.push(`${n.padEnd(16)} ${OF[n].padEnd(7)} raw ${raw.dur.toFixed(2)}s peak ${raw.max} → ${f.dur.toFixed(2)}s mean ${f.mean} peak ${f.max} ${(fs.statSync(dst).size / 1024).toFixed(1)}k`);
}
console.log(report.join('\n'));
const total = fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log('files', fs.readdirSync(OUT).length, 'total', (total / 1024).toFixed(0) + 'k');
