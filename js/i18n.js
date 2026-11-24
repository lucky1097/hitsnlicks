// Languages. Slovak is the source: every text in the code is Slovak, and a dictionary js/lang/<id>.js maps the exact
// Slovak text to another language. This module loads before the rest of the client (main.js imports it first; ui.js,
// world.js and remote.js import it too, so they wait for the dictionary): it picks the language, loads the dictionary
// and translates the shared content (data.js, config.js, events.js, daily.js, medals.js; looks.js too) in place.
// The server is never translated: its messages are Slovak and tts() translates them here, by templates.
//   tt('Kúpiť za {cena}', { cena: money(x) })   UI text; the key is the Slovak text with {placeholders}
//   ttn(n, 'hodina|hodiny|hodín')               the plural form for n (Slovak forms: 1 | 2–4 | 5+)
//   tts(msg)                                     a message from the server (exact text, or a template with {…})
// (the names are unusual on purpose: ui.js uses t as a variable in many places)
import * as DATA from './data.js?v=20261124232204';
import * as CONF from './config.js?v=20261124232204';
import * as EVENTS from './events.js?v=20261124232204';
import * as DAILY from './daily.js?v=20261124232204';
import * as MEDALS from './medals.js?v=20261124232204';
import * as LOOKS from './looks.js?v=20261124232204';
import { walkText } from './i18n-walk.js?v=20261124232204';

export const LANGS = [
  { id: 'sk', short: 'SK', name: 'Slovenčina', locale: 'sk-SK' },
  { id: 'cs', short: 'CZ', name: 'Čeština', locale: 'cs-CZ' },
  { id: 'de', short: 'DE', name: 'Deutsch', locale: 'de-DE' },
  { id: 'en', short: 'EN', name: 'English', locale: 'en-US' },
];
const STORE = 'hl_lang';
const MOCK = /[?&]mock/.test(typeof location !== 'undefined' ? location.search : '');
// qq: test language for ?mock only, every translated text in ⟦ ⟧ (the test sets window.__hlPseudo): what shows
// without brackets on a screen was never made translatable
const known = (id) => LANGS.some((l) => l.id === id) || (MOCK && id === 'qq');

// ?lang=xx (for testing) > the player's choice on this device > someone who already played here (Slovak, as before
// languages existed) > the browser's language > English
function pick() {
  try { const q = new URLSearchParams(location.search).get('lang'); if (known(q)) return q; } catch (e) { /* no address */ }
  try {
    const s = localStorage.getItem(STORE);
    if (known(s)) return s;
    if (Object.keys(localStorage).some((k) => (/^sb-.*-auth-token$/.test(k)) || k === 'hitsnlicks.save.v1' || k === 'hl_sound' || k === 'hl_tips')) return 'sk';
  } catch (e) { /* storage off */ }
  const nav = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']).map((x) => String(x).toLowerCase());
  for (const n of nav) {
    const id = n.slice(0, 2) === 'cs' ? 'cs' : n.slice(0, 2);
    if (known(id)) return id;
  }
  return 'en';
}

export const LANG = pick();
export const LOCALE = (LANGS.find((l) => l.id === LANG) || LANGS[3]).locale;

let DICT = {};
if (LANG === 'qq') DICT = (typeof window !== 'undefined' && window.__hlPseudo) || {};
else if (LANG !== 'sk') {
  // the dictionary gets the same ?v= stamp as this file, so a new release never mixes with a cached one
  const url = new URL('./lang/' + LANG + '.js' + new URL(import.meta.url).search, import.meta.url);
  try { DICT = (await import(url.href)).default || {}; } catch (e) { DICT = {}; }
}

// texts the dictionary does not have yet (in ?mock: window.hlMissing in the console)
const missing = new Set();
if (MOCK && typeof window !== 'undefined') window.hlMissing = missing;
const has = (sk) => Object.prototype.hasOwnProperty.call(DICT, sk);
const miss = (sk) => { if (MOCK && LANG !== 'sk' && !has(sk)) missing.add(sk); };

const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m)) : s);

export function tt(sk, vars) {
  miss(sk);
  return fill(has(sk) ? DICT[sk] : sk, vars);
}

// plural: forms are 'one|few|many' in Slovak and Czech (1 | 2–4 | 0, 5+), 'one|other' in German and English
export function ttn(n, forms) {
  miss(forms);
  const f = (has(forms) ? DICT[forms] : forms).split('|');
  const a = Math.abs(n);
  if (LANG === 'sk' || LANG === 'cs') return f[a === 1 ? 0 : a >= 2 && a <= 4 ? 1 : 2] || f[f.length - 1];
  return f[a === 1 ? 0 : 1] || f[f.length - 1];
}

// numbers inside a server message are written the Slovak way ("12 345", "1,5"): rewritten for the language
function numberPart(v) {
  if (LANG === 'sk' || !/^-?\d{1,3}(?:[  ]\d{3})*(?:,\d+)?$/.test(v)) return null;
  const n = Number(v.replace(/[  ]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n.toLocaleString(LOCALE, { maximumFractionDigits: 2 }) : null;
}

// templates: dictionary keys with {placeholders} that also have words of their own, longest first
let TEMPLATES = null;
function templates() {
  if (TEMPLATES) return TEMPLATES;
  const rx = (s) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  TEMPLATES = Object.keys(DICT)
    .filter((k) => /\{\w+\}/.test(k) && /\p{L}{2}/u.test(k.replace(/\{\w+\}/g, '')))
    .sort((a, b) => b.replace(/\{\w+\}/g, '').length - a.replace(/\{\w+\}/g, '').length)
    .map((k) => {
      const names = [];
      const src = k.split(/(\{\w+\})/).map((part) => {
        const m = /^\{(\w+)\}$/.exec(part);
        if (!m) return rx(part);
        names.push(m[1]);
        return '([\\s\\S]+?)';
      }).join('');
      return { key: k, names, re: new RegExp('^' + src + '$') };
    });
  return TEMPLATES;
}

// a message from the server (or from the shared rules running here): Slovak text, translated by an exact key or the
// first template it fits; what fills a {placeholder} is looked up too (a name, an item), numbers get the local format
export function tts(msg) {
  if (LANG === 'sk' || typeof msg !== 'string' || !msg) return msg;
  if (has(msg)) return DICT[msg];
  for (const tp of templates()) {
    const m = tp.re.exec(msg);
    if (!m) continue;
    return DICT[tp.key].replace(/\{(\w+)\}/g, (x, k) => {
      const i = tp.names.indexOf(k);
      if (i < 0) return x;
      const v = m[i + 1];
      return has(v) ? DICT[v] : numberPart(v) || v;
    });
  }
  miss(msg);
  return msg;
}

// the shared content, translated in place (the server keeps its own Slovak copy)
if (LANG !== 'sk') walkText([DATA, CONF, EVENTS, DAILY, MEDALS, LOOKS], (obj, key, value) => { if (has(value)) obj[key] = DICT[value]; else miss(value); });

// fixed texts of index.html (HUD): text nodes and labels that are exactly a key
export function tDom(root) {
  if (LANG === 'sk' || !root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const s = n.nodeValue.trim();
    if (s && has(s)) n.nodeValue = n.nodeValue.replace(s, DICT[s]);
  }
  root.querySelectorAll('[title], [alt], [aria-label], [placeholder]').forEach((el) => {
    for (const a of ['title', 'alt', 'aria-label', 'placeholder']) {
      const v = el.getAttribute(a);
      if (v && has(v)) el.setAttribute(a, DICT[v]);
    }
  });
}

// the legal pages exist in every language; the Slovak one is binding
export const legal = (page) => page + (LANG === 'sk' ? '' : '-' + LANG) + '.html';

export function setLang(id) {
  if (!known(id)) return;
  try { localStorage.setItem(STORE, id); } catch (e) { /* only this page view */ }
}

if (typeof document !== 'undefined') document.documentElement.lang = LANG;
