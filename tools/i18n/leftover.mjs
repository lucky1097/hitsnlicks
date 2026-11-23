// Slovak text that is not yet translatable.
//   node tools/i18n/leftover.mjs js/ui.js 1 520        string literals in those lines that look like player-facing text
//                                                     but are not the text argument of tt( / ttn(
//   node tools/i18n/leftover.mjs server                every Slovak piece of the server files that no template in
//                                                     tools/i18n/server.json contains
import fs from 'node:fs';

const SK = /[áäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]/;
const LIT = /'((?:[^'\\\n]|\\.)*)'/g;
// the words of a literal without markup: whole tags, a tag left open at the end, the tail of a tag it starts inside
const words = (s) => s.replace(/^[^<>]*>/, ' ').replace(/<[^>]*>/g, ' ').replace(/<[^>]*$/, ' ').replace(/&\w+;/g, ' ').replace(/\{\w+\}/g, ' ');
// Phaser easings, camelCase names, font lists
const CODEY = /^([A-Z][a-z]+\.[a-z]\w*|[a-z]+[A-Z]\w*|[\w-]+(\s[\w-]+)?,\s?serif|bold italic|wl wl-\w*)$/;
const looksText = (s) => {
  const w = words(s).trim();
  if (!/\p{L}{2}/u.test(w) || CODEY.test(w)) return false;
  return SK.test(w) || /\p{Lu}\p{Ll}/u.test(w) || /\p{L}{2,}\s+\p{L}{2,}/u.test(w);
};
// the code of a line without comments (a // inside a string is kept)
const code = (line) => {
  let out = '', q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { out += c; if (c === '\\') { out += line[++i] || ''; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; out += c; continue; }
    if (c === '/' && line[i + 1] === '/') break;
    out += c;
  }
  return out;
};

const [a, from, to] = process.argv.slice(2);
if (a === 'server') {
  const keys = JSON.parse(fs.readFileSync('tools/i18n/server.json', 'utf8')).map((e) => e.k);
  let n = 0;
  for (const f of ['js/server.js', 'js/gangs.js', 'js/daily.js', 'js/api.js', 'js/remote.js']) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const m of code(line).matchAll(LIT)) {
        const piece = m[1].replace(/\\(.)/g, '$1').trim().replace(/^[.,:;·\s]+|[\s]+$/g, '');
        if (!SK.test(piece) || piece.length < 2) continue;
        if (!keys.some((k) => k.includes(piece))) { n++; console.log(f + ':' + (i + 1) + '  ' + JSON.stringify(piece)); }
      }
    });
  }
  console.log(n ? 'FAIL ' + n + ' pieces in no template' : 'OK every Slovak piece is in a template');
} else {
  const lines = fs.readFileSync(a, 'utf8').split('\n');
  // a range is line numbers or marker texts (the first line containing the text; the end marker's line is excluded)
  const at = (x, dflt) => (x === undefined ? dflt : /^\d+$/.test(x) ? +x : lines.findIndex((l) => l.includes(x)) + 1);
  const lo = at(from, 1), hi = /^\d+$/.test(to || '') ? +to : at(to, lines.length + 1) - 1;
  if (lo < 1 || hi < lo) { console.log('FAIL range not found'); process.exit(1); }
  let n = 0;
  for (let i = lo - 1; i < Math.min(lines.length, hi); i++) {
    const c = code(lines[i]);
    for (const m of c.matchAll(LIT)) {
      const before = c.slice(0, m.index);
      if (/\btt\(\s*$/.test(before) || /\bttn\([^,()]+,\s*$/.test(before)) continue;
      if (!looksText(m[1])) continue;
      n++;
      console.log((i + 1) + ': ' + JSON.stringify(m[1]).slice(0, 140));
    }
  }
  console.log(n ? n + ' literals left' : 'OK none left');
}
