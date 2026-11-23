// Translation tool. Slovak is the source; translations live in tools/i18n/<lang>.json ({ "Slovak text": "translation" }).
//   node tools/i18n/i18n.mjs extract   -> tools/i18n/keys.json: every text to translate, with where it comes from
//   node tools/i18n/i18n.mjs check     -> OK / FAIL per language: missing keys, {placeholders}, HTML tags, plural forms
//   node tools/i18n/i18n.mjs build     -> js/lang/<lang>.js from tools/i18n/<lang>.json (what the game loads)
//   node tools/i18n/i18n.mjs todo <lang> [n]   -> the keys <lang>.json still lacks (JSON lines, for translators)
// Texts come from: the shared content (js/i18n-walk.js decides which fields), tt('…') / ttn(n, '…') in the client code,
// the fixed HUD texts in index.html, and the server's messages (tools/i18n/server.json, templates with {placeholders}).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const DIR = path.join(ROOT, 'tools/i18n');
const LANGS = ['cs', 'de', 'en'];
const CODE = ['js/ui.js', 'js/world.js', 'js/main.js', 'js/remote.js'];
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const readJson = (f, dflt) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : dflt);
const unq = (s) => s.replace(/\\(.)/g, (m, c) => ({ n: '\n', t: '\t' }[c] || c));

async function extract() {
  const keys = new Map(); // key -> { kind, ctx: [] }
  const add = (k, kind, ctx) => {
    if (!/\p{L}/u.test(k)) return;
    const e = keys.get(k) || { kind, ctx: [] };
    if (kind === 'plural') e.kind = 'plural';
    if (e.ctx.length < 4 && !e.ctx.includes(ctx)) e.ctx.push(ctx);
    keys.set(k, e);
  };
  const errors = [];

  // 1. shared content
  const { walkText } = await import(pathToFileURL(path.join(ROOT, 'js/i18n-walk.js')).href);
  const mods = [];
  for (const m of ['data', 'config', 'events', 'daily', 'medals', 'looks']) mods.push(await import(pathToFileURL(path.join(ROOT, 'js/' + m + '.js')).href));
  walkText(mods, (obj, key, value, p) => add(value, 'data', p.join('.')));

  // 2. client code: tt('…') and ttn(n, '…'); the first text argument must be a literal
  for (const f of CODE) {
    const lines = read(f).split('\n');
    let fn = '';
    lines.forEach((line, i) => {
      const m = /^ {2,6}(?:async )?(?:'([\w-]+)'|([a-zA-Z_]\w*))\s*\([^)]*\)\s*\{/.exec(line);
      if (m && !/^(if|for|while|switch|catch|function|return)$/.test(m[2] || '')) fn = m[1] || m[2];
      const ctx = f.replace('js/', '') + ':' + (i + 1) + (fn ? ' ' + fn : '');
      for (const x of line.matchAll(/\btt\(\s*'((?:[^'\\]|\\.)*)'/g)) add(unq(x[1]), 'ui', ctx);
      for (const x of line.matchAll(/\bttn\([^,]+,\s*'((?:[^'\\]|\\.)*)'/g)) add(unq(x[1]), 'plural', ctx);
      for (const x of line.matchAll(/\btt\(\s*(?![\s'])/g)) if (!/function tt\(/.test(line)) errors.push(ctx + ': tt( without a text literal');
      for (const x of line.matchAll(/\bttn\(([^,()]+),\s*(?![\s'])/g)) if (!/function ttn\(/.test(line)) errors.push(ctx + ': ttn( without a text literal');
    });
  }

  // 3. index.html: the HUD's text and labels (js/i18n.js tDom translates exactly these)
  const html = read('index.html');
  const hud = html.slice(html.indexOf('<div id="hud"'), html.indexOf('<div id="screen"'));
  for (const x of hud.replace(/<!--[\s\S]*?-->/g, '').matchAll(/>([^<>]+)</g)) { const s = x[1].trim(); if (s) add(s, 'html', 'index.html #hud'); }
  for (const x of hud.matchAll(/\b(?:title|alt|aria-label|placeholder)="([^"]+)"/g)) add(x[1], 'html', 'index.html #hud');

  // 4. server messages (written by hand from js/server.js, gangs.js, daily.js, api.js, remote.js)
  for (const e of readJson(path.join(DIR, 'server.json'), [])) add(e.k, 'server', e.ctx || 'server');

  const out = [...keys].map(([k, e]) => ({ k, kind: e.kind, ctx: e.ctx.join(' | ') }));
  fs.writeFileSync(path.join(DIR, 'keys.json'), JSON.stringify(out, null, 1) + '\n');
  const by = {};
  out.forEach((e) => { by[e.kind] = (by[e.kind] || 0) + 1; });
  console.log('keys', out.length, JSON.stringify(by), 'chars', out.reduce((a, e) => a + e.k.length, 0));
  if (errors.length) { console.log('FAIL code:\n  ' + errors.join('\n  ')); process.exitCode = 1; }
}

const holes = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const tags = (s) => [...s.matchAll(/<\/?([a-z]+)\b/gi)].map((m) => m[0].toLowerCase()).sort().join(',');

// what is wrong with one translation (null when fine)
function problem(L, k, kind, v) {
  if (typeof v !== 'string' || !v.trim()) return 'empty: ' + k;
  if (holes(k) !== holes(v)) return 'placeholders {' + holes(k) + '} vs {' + holes(v) + '}: ' + k;
  if (tags(k) !== tags(v)) return 'html tags: ' + k;
  if (kind === 'plural' && v.split('|').length !== (L === 'cs' ? 3 : 2)) return 'plural needs ' + (L === 'cs' ? 3 : 2) + ' forms: ' + k;
  if (kind !== 'plural' && k.includes('|') !== v.includes('|')) return 'a | where the Slovak has none (or the other way): ' + k;
  return null;
}

function check() {
  const keys = readJson(path.join(DIR, 'keys.json'), null);
  if (!keys) { console.log('FAIL no keys.json (run extract)'); process.exitCode = 1; return; }
  let bad = false;
  for (const L of LANGS) {
    const dict = readJson(path.join(DIR, L + '.json'), {});
    const problems = [];
    let missing = 0;
    for (const { k, kind } of keys) {
      if (!Object.prototype.hasOwnProperty.call(dict, k)) { missing++; continue; }
      const p = problem(L, k, kind, dict[k]);
      if (p) problems.push(p);
    }
    const stale = Object.keys(dict).filter((k) => !keys.some((e) => e.k === k)).length;
    const built = fs.existsSync(path.join(ROOT, 'js/lang/' + L + '.js')) && read('js/lang/' + L + '.js') === render(dict);
    const ok = !missing && !problems.length && built;
    if (!ok) bad = true;
    console.log((ok ? 'OK ' : 'FAIL ') + L + ' ' + (keys.length - missing) + '/' + keys.length + (missing ? ' missing ' + missing : '') + (problems.length ? ' problems ' + problems.length : '') + (stale ? ' (unused ' + stale + ')' : '') + (built ? '' : ' (js/lang/' + L + '.js not built)'));
    problems.slice(0, 15).forEach((p) => console.log('   ' + p));
  }
  if (bad) process.exitCode = 1;
}

// the file the game loads: only keys still in use, in keys.json order
function render(dict) {
  const keys = readJson(path.join(DIR, 'keys.json'), []);
  const o = {};
  for (const { k } of keys) if (Object.prototype.hasOwnProperty.call(dict, k)) o[k] = dict[k];
  return '// generated by tools/i18n/i18n.mjs build from tools/i18n/<lang>.json: do not edit by hand\nexport default {\n' +
    Object.entries(o).map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(',\n') + '\n};\n';
}

// translators' work files: one JSON object { "Slovak": "translation" } per chunk
//   chunk <dir> <kind|all> <chars>   writes <dir>/in-<kind>-NN.json: the keys no language has yet, in pieces
//   verify <lang> <file>             OK <n> / FAIL with each problem (unknown key, placeholders, tags, plural forms)
//   merge <lang> <dir>               adds every <dir>/<lang>-*.json that verifies into tools/i18n/<lang>.json
function chunk(dir, kind, size = 6000) {
  const keys = readJson(path.join(DIR, 'keys.json'), []);
  const done = (k) => LANGS.every((L) => Object.prototype.hasOwnProperty.call(readJson(path.join(DIR, L + '.json'), {}), k));
  const list = keys.filter((e) => (kind === 'all' || e.kind === kind) && !done(e.k));
  fs.mkdirSync(dir, { recursive: true });
  let part = [], chars = 0, n = 0;
  const flush = () => {
    if (!part.length) return;
    const f = path.join(dir, 'in-' + kind + '-' + String(++n).padStart(2, '0') + '.json');
    fs.writeFileSync(f, JSON.stringify(part, null, 1) + '\n');
    console.log(f, part.length, 'keys', chars, 'chars');
    part = []; chars = 0;
  };
  for (const e of list) { part.push({ k: e.k, kind: e.kind, ctx: e.ctx }); chars += e.k.length; if (chars >= +size) flush(); }
  flush();
}

function verifyFile(L, f) {
  const keys = new Map(readJson(path.join(DIR, 'keys.json'), []).map((e) => [e.k, e.kind]));
  let obj;
  try { obj = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return { ok: false, problems: ['not valid JSON: ' + e.message] }; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, problems: ['not a JSON object { "Slovak": "translation" }'] };
  const problems = [];
  for (const [k, v] of Object.entries(obj)) {
    if (!keys.has(k)) { problems.push('unknown key (must be copied exactly): ' + k.slice(0, 80)); continue; }
    const p = problem(L, k, keys.get(k), v);
    if (p) problems.push(p);
  }
  return { ok: !problems.length, n: Object.keys(obj).length, obj, problems };
}

function verify(L, f) {
  const r = verifyFile(L, f);
  console.log(r.ok ? 'OK ' + r.n : 'FAIL ' + r.problems.length + ' problems');
  r.problems.slice(0, 30).forEach((p) => console.log('   ' + p));
  if (!r.ok) process.exitCode = 1;
}

function merge(L, dir) {
  const target = path.join(DIR, L + '.json');
  const dict = readJson(target, {});
  for (const f of fs.readdirSync(dir).filter((x) => x.startsWith(L + '-') && x.endsWith('.json')).sort()) {
    const r = verifyFile(L, path.join(dir, f));
    if (!r.ok) { console.log('skip ' + f + ': ' + r.problems.length + ' problems'); continue; }
    Object.assign(dict, r.obj);
    console.log('merged ' + f + ' ' + r.n);
  }
  const sorted = {};
  for (const k of Object.keys(dict).sort()) sorted[k] = dict[k];
  fs.writeFileSync(target, JSON.stringify(sorted, null, 1) + '\n');
  console.log(L + '.json now ' + Object.keys(sorted).length + ' keys');
}

function build() {
  fs.mkdirSync(path.join(ROOT, 'js/lang'), { recursive: true });
  for (const L of LANGS) {
    const dict = readJson(path.join(DIR, L + '.json'), {});
    fs.writeFileSync(path.join(ROOT, 'js/lang/' + L + '.js'), render(dict));
    console.log('built js/lang/' + L + '.js', Object.keys(dict).length);
  }
}

function todo(L, n = 1e9) {
  const keys = readJson(path.join(DIR, 'keys.json'), []);
  const dict = readJson(path.join(DIR, L + '.json'), {});
  keys.filter((e) => !Object.prototype.hasOwnProperty.call(dict, e.k)).slice(0, +n).forEach((e) => console.log(JSON.stringify(e)));
}

const [cmd, a, b, c] = process.argv.slice(2);
if (cmd === 'extract') await extract();
else if (cmd === 'check') check();
else if (cmd === 'build') build();
else if (cmd === 'todo') todo(a, b);
else if (cmd === 'chunk') chunk(a, b || 'all', c);
else if (cmd === 'verify') verify(a, b);
else if (cmd === 'merge') merge(a, b);
else console.log('usage: node tools/i18n/i18n.mjs extract | check | build | todo <lang> [n] | chunk <dir> <kind> [chars] | verify <lang> <file> | merge <lang> <dir>');
