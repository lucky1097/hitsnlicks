// Which strings of the shared content (data.js, config.js, events.js, daily.js, medals.js) are player-facing text.
// js/i18n.js translates exactly these in place when the game loads in another language, and
// tools/i18n/extract.mjs lists exactly these for the translators, so both use this one rule.
// Slovak stays the source: a dictionary maps the exact Slovak text to the other language.

// fields that hold text wherever they appear
const TEXT_KEYS = new Set(['name', 'title', 'blurb', 'text', 'verb', 'desc', 'quote', 'where', 'hit', 'unit']);
// objects whose every value is text (CITIES.*.names, STAT_NAMES, GANG_RANKS)
const TEXT_MAPS = new Set(['names', 'STAT_NAMES', 'GANG_RANKS']);

// is obj[key] (at path: export name, then keys) player-facing text?
function isText(path, key) {
  const parent = path[path.length - 2];
  if (TEXT_MAPS.has(parent)) return true;
  if (parent === 'go' && key === '0') return true; // GOALS[].go = [button label, screen]
  if (!TEXT_KEYS.has(key)) return false;
  // boss names stay the same in every language (mission rivals' nicknames are translated: the stories use them)
  if (key === 'name' && (path[0] === 'BOSSES' || path[0] === 'BOSSES2') && path.length === 3) return false;
  return true;
}

// visit(obj, key, value, path) for every text string in the modules' exported objects (each object once)
export function walkText(modules, visit) {
  const seen = new WeakSet();
  const go = (obj, path) => {
    if (seen.has(obj)) return;
    seen.add(obj);
    for (const k of Object.keys(obj)) {
      const v = obj[k], p = [...path, k];
      if (typeof v === 'string') { if (isText(p, k)) visit(obj, k, v, p); }
      else if (v && typeof v === 'object') go(v, p);
    }
  };
  for (const mod of modules) for (const [name, v] of Object.entries(mod)) if (v && typeof v === 'object') go(v, [name]);
}
