// HTML interface: HUD, menus, screens, modals. Talks only to the (simulated) server.
import { STATS, STAT_NAMES, CLASSES, RARITIES, CONFIG, F } from './config.js?v=20261124232204';
import { SLOTS, ITEM_BASES, SHOPS, MISSIONS, GIVERS, BOSSES, GANG_COLORS, GANG_RANKS, GANG_UPGRADES, CITIES } from './data.js?v=20261124232204';
import { EVENTS, EVENT_ROTATION, activeEvents, nextEvents } from './events.js?v=20261124232204';
import { DAILY_TYPES } from './daily.js?v=20261124232204';
import { LOOK_BASE, LOOK_PARTS } from './looks.js?v=20261124232204';
import { sound } from './sound.js?v=20261124232204';
import { CAPTCHA } from './net.js?v=20261124232204';
import { MEDALS, MEDAL_TIERS, MEDAL_COUNT, medalSvg, frameHtml, medalTotal } from './medals.js?v=20261124232204';
import { tt, ttn, tts, LANG, LANGS, LOCALE, legal, setLang } from './i18n.js?v=20261124232204';

const $ = (sel, el = document) => el.querySelector(sel);
const fmt = (n) => Math.round(n).toLocaleString(LOCALE);
const euro = (cents) => (cents / 100).toLocaleString(LOCALE, { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 ? 2 : 0 }); // 0,99 € · 5 €
// the top bar has little room: big sums shortened (1,2 M / 123 k); screens show them in full
const short = (n) => (n >= 1e6 ? (Math.floor(n / 1e5) / 10).toLocaleString(LOCALE) + ' M' : n >= 1e5 ? Math.floor(n / 1000) + ' k' : fmt(n));
const money = (n) => '$ ' + fmt(n);
const pct = (x) => Math.round(x * 100) + ' %';
const hours = (min) => { const n = Math.round(min / 60); return n + ' ' + ttn(n, 'hodina|hodiny|hodín'); };
const art = (n) => 'assets/art/' + n + (/^(photo_|w_|x_)/.test(n) ? '.jpg' : '.png');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const rar = (id) => RARITIES.find((r) => r.id === id) || RARITIES[0];
const BACK = '<svg width="12" height="20" viewBox="0 0 12 20" aria-hidden="true"><path d="M10 2 L2 10 L10 18" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>';
const BOT_ART = { svalovec: 'photo_svalovec', zlodej: 'photo_zlodej', dealer: 'photo_dealer' };
// the street behind every fight, one per city
const FIGHT_BG = { mesto1: 'photo_fightbg', mesto2: 'photo_fightbg2' };
// where the face sits in each class artwork (CSS object-position)
const BOT_FOCUS = {};
// fight animation: weapon cut-outs live in assets/fx (tools/cutout.ps1); guns drawn pointing left get
// flipped so the muzzle faces the foe; fighters without a known weapon carry their class's usual one
const FX_MUZZLE_LEFT = new Set(['w_deagle', 'w_gold1911', 'w_kalach', 'w_revolver', 'w_tommy_gold']);
// melee pictures are drawn diagonally; the swing expects the handle down-left and the striking end up-right
// (bat, katana, crowbar, bike chain), these have the handle up-right; they are mirrored across the diagonal
// (not turned round), so the cutting edge keeps leading the swing
const FX_TIP_DOWN_LEFT = new Set(['w_knife', 'w_hockey', 'w_bottle', 'w_oar', 'w_cane_sword']);
const CLASS_WEAPON = { svalovec: 'bat', zlodej: 'knife', dealer: 'glock' };
const fxArt = (n) => 'assets/fx/' + n + '.png';
// class artwork shown when picking a class (more classes as their art arrives)
const CLASS_ART = { svalovec: 'photo_svalovec', zlodej: 'photo_zlodej', dealer: 'photo_dealer' };

// street pills: red = Šťastie, blue = class stat, green = life
const PILL_ICON = {
  red: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="5" width="14" height="7" rx="3.5" fill="#f2ece0"/><path d="M4.5 5H8v7H4.5a3.5 3.5 0 0 1 0-7z" fill="#d42a22"/></svg>',
  blue: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="5" width="14" height="7" rx="3.5" fill="#f2ece0"/><path d="M4.5 5H8v7H4.5a3.5 3.5 0 0 1 0-7z" fill="#2f6fe0"/></svg>',
  green: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14 2 8a3.3 3.3 0 0 1 6-4 3.3 3.3 0 0 1 6 4z" fill="#3ccf4e"/></svg>',
};
// a hooded silhouette (in the shadows) and a small chest (daily missions) for the buff row
const SHADOW_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5C5 1.5 3.6 4 3.6 6.6V9L2 14.5h12L12.4 9V6.6C12.4 4 11 1.5 8 1.5z" fill="#2a2826" stroke="#b9b4a8" stroke-width="1"/><path d="M5.6 7.6h4.8" stroke="#e9e4d8" stroke-width="1" opacity=".7"/></svg>';
const CHEST_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 7C1.5 3.5 4 2.5 8 2.5S14.5 3.5 14.5 7z" fill="#5a3d1f" stroke="#f0c95a" stroke-width="1"/><rect x="1.5" y="7" width="13" height="7" fill="#6b4a26" stroke="#f0c95a" stroke-width="1"/><rect x="6.6" y="7.8" width="2.8" height="3.2" fill="#f0c95a"/></svg>';
const pillName = (kind, cls) => ({ red: tt('Červená pilulka'), blue: tt('Modrá pilulka'), green: tt('Zelené srdce') }[kind]);
const pillEffect = (kind, cls) => ({ red: STAT_NAMES.stastie, blue: STAT_NAMES[CLASSES[cls].stat], green: tt('Životy') }[kind]);
// new-player tutorial (server: SimServer.tutorial): what each step asks; go = [button label, screen it opens]
const TUT = {
  don: { text: tt('Choď za Donom do parku (zlatý kruh, biela „!“) a vezmi si misiu.') },
  claim: { text: (t) => (t.missionReady ? tt('Misia je hotová. Vráť sa za Donom a vyzdvihni si odmenu.') : tt('Misia beží. Kým skončí, prejdi sa po meste.')) },
  stat: { text: tt('Otvor Postavu a zvýš si niektorý stat.'), go: [tt('Postava'), 'character'] },
  buy: { text: tt('Choď do obchodu Zbrane (zlatý kruh) a kúp si novú zbraň.') },
  equip: { text: tt('V Postave ťukni na zbraň a nasaď si tú novú.'), go: [tt('Postava'), 'character'] },
};

// what a new level opens (CONFIG.unlock): shown once in a big window when the level is reached while playing;
// go = [button, 'guide' (map arrow to a POI) or 'open' (a screen), target]
const UNLOCKS = [
  { id: 'arena', name: tt('Aréna'), text: tt('Bojuj s inými hráčmi o body a miesto v rebríčku. Päť zápasov za hodinu máš zadarmo.'), go: [tt('Ukáž cestu'), 'guide', 'arena'] },
  { id: 'club', name: tt('Podzemné zápasy'), text: tt('Sto súperov v pivnici pod klubom, každý silnejší ako ten pred ním. Jeden zápas za hodinu, každé desiate poschodie platí zlaté tehličky.'), go: [tt('Otvoriť'), 'open', 'club'] },
  { id: 'gang', name: tt('Gangy'), text: tt('Založ si vlastný gang alebo sa pridaj k inému. Spolu obsadíte objekty v meste a celý gang má z nich bonusy k misiám.'), go: [tt('Otvoriť'), 'open', 'gang'] },
  { id: 'blackMarket', name: tt('Čierny trh'), text: tt('Každý piatok od 18:00 majú obchody aj epické kúsky. U Wexlera si za tehličky kúpiš elixír, ktorý ti Čierny trh otvorí hocikedy na 24 hodín.'), go: null },
];

function dur(ms) {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return s + ' s';
  return Math.floor(s / 60) + ' min' + (s % 60 ? ' ' + (s % 60) + ' s' : '');
}

function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? h + ':' + pad(m) + ':' + pad(x) : m + ':' + pad(x);
}

const MENU = [
  { id: 'character', name: tt('Postava'), desc: tt('Staty, výbava a vylepšenia tvojej postavy.') },
  { id: 'inventory', name: tt('Inventár'), desc: tt('Všetky predmety, ktoré nosíš so sebou.') },
  { id: 'missions', name: tt('Misie'), desc: tt('Aktívna misia a kde nájdeš zadávateľov.') },
  { id: 'daily', name: tt('Denné misie'), desc: tt('Tri úlohy na mape každý deň a 15-dňový kalendár odmien.') },
  { id: 'events', name: tt('Víkendové eventy'), desc: tt('Každý víkend dva eventy naraz: čo platí teraz a čo príde.') },
  { id: 'policehelp', name: tt('Polícia a heat'), desc: tt('Heat, hviezdy, kontrola, basa, právnička a skrýša na jednom mieste.') },
  { id: 'arena', name: tt('Aréna'), desc: tt('Súboje s inými hráčmi a rebríček.') },
  { id: 'club', name: tt('Podzemné zápasy'), desc: tt('Sto súperov v pivnici pod klubom, každý silnejší. Jeden zápas za hodinu.') },
  { id: 'boss', name: tt('Boss fights'), desc: tt('Bossovia mesta, v ktorom si: Kladivo v Meste 1, Radničná veža v Meste 2.') },
  { id: 'gang', name: tt('Gang'), desc: tt('Tvoj gang, pokladnica, členovia a boje o územie.') },
  { id: 'hall', name: tt('Sieň slávy'), desc: tt('Všetci registrovaní hráči. Klikni na hráča a uvidíš jeho staty a výbavu.') },
  { id: 'settings', name: tt('Nastavenia'), desc: tt('Zvuk, účet a nahlásenie chyby.') },
  { id: 'title', name: tt('Hlavné menu'), desc: tt('Späť na úvodnú obrazovku. Hra sa ukladá sama.') },
];

export class UI {
  constructor(server) {
    this.s = server;
    this.input = { x: 0, y: 0, fire: false };
    this.name = null;
    this.arg = null;
    this.stack = [];
    this.poi = null;
    this.sel = { cls: 'zlodej', approach: null, offer: null };
    this.errors = []; // the last browser errors (sent with a bug report)
    this.errorsOut = []; // waiting to be sent to the server
    this.captcha = { id: null, token: null, failed: false }; // Turnstile in the login form (captchaMount)
    this.errorsSent = 0;
    this.errorsAt = 0;
    this.modalOpen = false;
    this.readyNotified = false;
    this.fightTimer = null;
    this.el = { hud: $('#hud'), screen: $('#screen'), modal: $('#modal'), toasts: $('#toasts'), action: $('#action'), poiTag: $('#poi-tag') };
    this.bind();
    this.bindJoystick();
  }

  paused() { return !!this.name || this.modalOpen; }

  // ---------------------------------------------------------------- wiring
  bind() {
    $('#app').addEventListener('click', (e) => {
      // computer: a click on the dimmed map around a window (#app::after) closes the window
      if (e.target === e.currentTarget) {
        if (this.name && this.name !== 'title' && this.name !== 'fight' && !this.modalOpen && !this.el.screen.classList.contains('overlay')) { sound.play('back'); this.close(); }
        return;
      }
      const t = e.target.closest('[data-act]');
      if (!t || t.disabled) return;
      sound.play(t.dataset.act === 'back' || t.dataset.act === 'modal-close' ? 'back' : 'click');
      const fn = this.acts[t.dataset.act];
      if (fn) fn.call(this, t.dataset.arg, t);
    });
    $('#app').addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-desc]');
      const d = $('#menu-desc');
      if (t && d) d.textContent = t.dataset.desc;
    });
    this.el.action.addEventListener('click', () => { sound.play('click'); this.action(); });
    // keyboard (computer): 1-5 = the tabs, Esc = back / close a plain message (never while typing)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'Escape') {
        if (this.modalOpen) { const x = $('#modal [data-act="modal-close"]'); if (x) x.click(); return; }
        if (this.name && this.name !== 'title' && this.name !== 'fight') { const b = $('#screen [data-act="back"]'); if (b) b.click(); }
        return;
      }
      const n = '12345'.indexOf(e.key);
      if (n < 0 || this.modalOpen || !this.s.hasSave() || this.name === 'title' || this.name === 'fight' || this.el.hud.hidden) return;
      const tab = document.querySelectorAll('.tabs button')[n];
      if (tab) tab.click();
    });
  }

  bindJoystick() {
    const pad = $('#joystick'), knob = $('#knob');
    let id = null;
    const move = (e) => {
      const r = pad.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy), max = 40;
      if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      this.input.x = dx / max;
      this.input.y = dy / max;
    };
    // while the stick is held the line under the bar fades (css #hud.walking), so the map is clear when you run
    const end = () => { id = null; knob.style.transform = ''; this.input.x = 0; this.input.y = 0; this.el.hud.classList.remove('walking'); };
    pad.addEventListener('pointerdown', (e) => { this.el.hud.classList.add('walking'); id = e.pointerId; pad.setPointerCapture(id); move(e); });
    pad.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);

    // attack button: tap = one swing / shot, hold = keeps firing automatic weapons
    const atk = $('#attack');
    atk.addEventListener('pointerdown', (e) => { e.preventDefault(); atk.setPointerCapture(e.pointerId); this.input.fire = true; });
    const stop = () => { this.input.fire = false; };
    atk.addEventListener('pointerup', stop);
    atk.addEventListener('pointercancel', stop);
  }

  // ---------------------------------------------------------------- navigation
  open(name, arg = null, push = false) {
    if (push && this.name) this.stack.push([this.name, this.arg]);
    if (!push) this.stack = [];
    this.stopFight();
    this.name = name;
    this.arg = arg;
    this.input.x = 0; this.input.y = 0;
    this.render();
  }

  back() {
    const prev = this.stack.pop();
    if (prev) { this.name = prev[0]; this.arg = prev[1]; this.render(); }
    else this.close();
  }

  close() {
    this.stopFight();
    this.name = null; this.arg = null; this.stack = []; this.renderKey = null;
    this.el.screen.hidden = true;
    this.el.screen.innerHTML = '';
    delete this.el.screen.dataset.scr;
    this.el.hud.hidden = !this.s.hasSave();
    this.setTab('city');
    this.tick();
  }

  render() {
    const fn = this['scr_' + this.name];
    if (!fn) { this.close(); return; }
    const out = fn.call(this, this.arg);
    // re-rendering the same screen (e.g. after +1 on a stat) keeps the scroll position
    // (remembered while scrolling, and put back again on the next frame: iOS can lose it otherwise)
    const key = this.name + '|' + (typeof this.arg === 'object' && this.arg ? 'obj' : String(this.arg));
    const oldBody = this.el.screen.querySelector('.body');
    const keep = key === this.renderKey ? Math.max(this.scrollMem || 0, oldBody ? oldBody.scrollTop : 0) : 0;
    this.renderKey = key;
    this.scrollMem = keep;
    this.el.screen.className = out.overlay ? 'overlay' : '';
    this.el.screen.dataset.scr = this.name; // the desktop layout sizes the window per screen (css #screen[data-scr])
    this.el.screen.innerHTML = out.html;
    const body = this.el.screen.querySelector('.body');
    if (body) {
      body.addEventListener('scroll', () => { this.scrollMem = body.scrollTop; }, { passive: true });
      if (keep) {
        body.scrollTop = keep;
        requestAnimationFrame(() => { if (body.isConnected && Math.abs(body.scrollTop - keep) > 1) body.scrollTop = keep; });
      }
    }
    this.el.screen.hidden = false;
    this.el.hud.hidden = !this.s.hasSave() || this.name === 'title';
    if (out.after) out.after();
    this.setTab({ character: 'character', inventory: 'character', missions: 'missions', daily: 'missions', arena: 'arena', gang: 'gang', turf: 'gang', war: 'gang' }[this.name] || 'city');
    this.tick();
  }

  setTab(id) {
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.arg === id));
  }

  hdr(title, right = '') {
    return '<header class="hdr"><button class="back" data-act="back" aria-label="' + tt('Späť') + '">' + BACK + '</button><h1>' + title + '</h1><span class="right num">' + right + '</span></header>';
  }

  // ---------------------------------------------------------------- HUD & ticking
  tick() {
    this.flushErrors();
    const now = Date.now();
    if (this.s.online) this.s.maybeSync();
    document.querySelectorAll('[data-until]').forEach((e) => { e.textContent = clock(Number(e.dataset.until) - now); });
    if (!this.s.hasSave()) return;
    const v = this.s.view();
    $('#hud-lvl').textContent = v.level;
    const lookKey = LOOK_BASE ? JSON.stringify(this.s.p.look || {}) : '';
    if (lookKey && lookKey !== this.hudLook) { this.hudLook = lookKey; $('#hud-face').innerHTML = this.lookHtml(this.s.p.look, 'in-avatar'); }
    $('#hud-cash').textContent = short(v.cash);
    $('#hud-chains').textContent = short(v.chains);
    const xp = v.xp / v.xpNext;
    $('#hud-xpbar').style.width = Math.min(100, xp * 100) + '%';
    $('#hud-xptext').textContent = pct(xp) + ' XP';
    $('#hud-heatbar').style.width = Math.min(100, v.heat) + '%';
    $('#hud-heatpct').textContent = tt('{n} % heat', { n: Math.round(v.heat) });
    $('#hud-heat').classList.toggle('hot', v.heat >= CONFIG.raidFrom);
    $('#hud-heat').title = tt('Heat {n} %: denný limit na misie', { n: Math.round(v.heat) });

    // the running mission is a clock in the bar: its time under it, gold "!" when the reward waits, red while jailed
    const mb = $('#hud-mission');
    const mission = v.jailLeft > 0 ? { cls: 'jail', badge: clock(v.jailLeft), label: tt('Zatknutý: pauza od misií') }
      : v.mission ? { cls: v.mission.ready ? 'ready' : '', badge: v.mission.ready ? '!' : clock(v.mission.left), label: v.mission.ready ? tt('Misia {name}: vyzdvihni odmenu', { name: v.mission.name }) : tt('Misia {name}', { name: v.mission.name }) }
        : null;
    mb.hidden = !mission;
    if (mission) {
      mb.classList.toggle('ready', mission.cls === 'ready');
      mb.classList.toggle('jail', mission.cls === 'jail');
      if ($('#hud-mtime').textContent !== mission.badge) $('#hud-mtime').textContent = mission.badge;
      if (mb.title !== mission.label) { mb.title = mission.label; mb.setAttribute('aria-label', mission.label); }
    }
    if (v.mission && v.mission.ready && !this.readyNotified) {
      this.readyNotified = true;
      sound.play('ready'); // the glowing clock says the rest, no message over the map
      if (this.name === 'missions') this.render();
    }
    const rp = this.s.reaper();
    this.reaperLine = rp.active ? tt('Ripper ukradol tehličku · <b>{cas}</b>', { cas: clock(rp.until - Date.now()) }) : '';
    if (rp.active && !this.reaperWas) this.toast(tt('Ripper ukradol Wexlerovi tehličku! Zasiahni ho, kým neujde.'), true);
    this.reaperWas = rp.active;
    const g = this.s.gang();
    if (g && g.log.length && g.log[0].at !== this.lastGangLog) {
      if (this.lastGangLog !== undefined && g.log[0].bad && this.name !== 'war') this.toast(tt('Gang: {text}', { text: tts(g.log[0].text) }), true);
      this.lastGangLog = g.log[0].at;
    }
    this.dailyHud();
    this.tutHud();
    this.medalCheck();
    this.unlockCheck();
    this.hideHud();
    // tabs of features the player has not reached yet look dim (the screen says from which level)
    for (const f of ['arena', 'gang']) $('.tabs [data-arg="' + f + '"]').classList.toggle('locked', !!this.s.locked(f) && !(f === 'gang' && g));
    // wanted stars (0–5): a badge on the avatar's corner, only while the police are interested
    const ws = this.s.wantedStars(), wel = $('#hud-wanted');
    wel.hidden = !ws;
    if (ws) {
      const txt = '★ ' + ws;
      if (wel.textContent !== txt) { wel.textContent = txt; wel.title = tt('Hľadanosť {n} z 5: polícia na ulici', { n: ws }); }
      wel.classList.toggle('chase', ws >= CONFIG.wantedChase);
    }
    // running pills: only a dot per colour on the avatar (the effects and times are in Postava)
    const b = this.s.buffs(), dots = ['red', 'blue', 'green'].filter((k) => b[k].length).map((k) => '<i class="' + k + '"></i>').join('');
    const pd = $('#hud-pills');
    pd.hidden = !dots;
    if (pd.dataset.html !== dots) { pd.innerHTML = dots; pd.dataset.html = dots; }
    this.statusHud();
    this.updateAction();
  }

  // the one line under the bar: a timed daily step first, then the Ripper, then the hideout shadow;
  // while it shows, the tutorial / goal line waits
  statusHud() {
    const el = $('#hud-status');
    const pick = this.dailyChip ? ['', this.dailyChip] : this.reaperLine ? ['reaper', this.reaperLine] : this.shadowChip ? ['shadow', this.shadowChip] : null;
    el.hidden = !pick;
    if (pick) {
      el.className = 'status' + (pick[0] ? ' ' + pick[0] : '');
      if (el.dataset.html !== pick[1]) { el.innerHTML = pick[1]; el.dataset.html = pick[1]; }
    }
    if (pick) $('#hud-tut').hidden = true;
  }

  // the tutorial and first-hour goal line (and its map arrow) can be switched off per device (Nastavenia or its ✕)
  tipsOn() {
    if (this.tips === undefined) { try { this.tips = localStorage.getItem('hl_tips') !== 'off'; } catch (e) { this.tips = true; } }
    return this.tips;
  }

  setTips(on) {
    this.tips = on;
    try { localStorage.setItem('hl_tips', on ? 'on' : 'off'); } catch (e) { /* still applies until the page reloads */ }
  }

  // ---------------------------------------------------------------- weekend events
  evCard(id, on) {
    const e = EVENTS[id];
    return '<div class="evcard ' + e.tier + (on ? ' on' : '') + '"><span class="ic">' + e.icon + '</span><span class="mid"><span class="t">' + e.name + ' <small>' + (e.tier === 'lepsi' ? tt('hlavný') : tt('bonus')) + '</small></span><span class="s">' + e.desc + '</span></span></div>';
  }

  scr_events() {
    const a = activeEvents(), n = nextEvents();
    let h = '<p class="p">' + tt('Každý víkend od piatku {hod}:00 do nedele polnoci bežia dva eventy naraz: jeden hlavný a jeden bonus. Poradie sa opakuje každých {n} týždňov.', { hod: 18, n: EVENT_ROTATION.length }) + '</p>';
    if (a) {
      h += '<div class="sec sc" style="color:#e8c873">' + tt('Teraz · ešte {cas}', { cas: '<span data-until="' + a.until + '"></span>' }) + '</div>' + a.ids.map((id) => this.evCard(id, true)).join('');
    } else if (n) {
      h += '<div class="sec sc">' + tt('Najbližší víkend · začína o {cas}', { cas: '<span data-until="' + n.from + '"></span>' }) + '</div>' + n.ids.map((id) => this.evCard(id, false)).join('');
    }
    if (a && n) h += '<div class="sec sc">' + tt('Budúci víkend') + '</div><p class="note" style="text-align:left">' + n.ids.map((id) => EVENTS[id].icon + ' ' + EVENTS[id].name).join(' · ') + '</p>';
    // the whole cycle, the current / next pair marked
    const cur = (a || n || {}).ids;
    h += '<div class="sec sc">' + tt('Poradie') + '</div><ol class="ladder">' + EVENT_ROTATION.map((pr, i) => '<li class="' + (cur && cur[0] === pr[0] ? 'me' : '') + '"><span>' + (i + 1) + '. ' + EVENTS[pr[0]].name + ' + ' + EVENTS[pr[1]].name + '</span></li>').join('') + '</ol>';
    return { html: this.hdr(tt('Víkendové eventy')) + '<div class="body">' + h + '</div>' };
  }

  // ---------------------------------------------------------------- hideout
  // a buff chip while in the shadows; the hiding time is up (or you walked out of the screen): settle it
  hideHud() {
    const h = this.s.hideState();
    if (h.since && !this.hideBusy && (this.s.hidingLeft() <= 0 || (this.name !== 'hideout' && this.name !== 'title'))) this.hideFinish();
    const left = this.s.shadowLeft();
    this.shadowChip = left ? SHADOW_ICON + '<span>' + tt('V tieni, polícia ťa nehľadá · <b>{cas}</b>', { cas: clock(left) }) + '</span>' : '';
  }

  async hideFinish() {
    if (this.hideBusy || !this.s.hideState().since) return;
    this.hideBusy = true;
    const r = await this.s.hideEnd();
    this.hideBusy = false;
    if (!r.ok) return;
    if (r.shadow) this.toast(tt('Teraz sa skrývaš v tieni. Polícia ťa {min} minút nebude naháňať.', { min: CONFIG.shadowMin }));
    else this.toast(tt('Odišiel si zo skrýše príliš skoro. Polícia ťa stále hľadá.'), true);
    if (this.name === 'hideout') this.render();
  }

  scr_hideout() {
    const h = this.s.hideState(), stars = this.s.wantedStars();
    let inner;
    if (h.since) {
      inner = '<span class="sc" style="color:#9b968b">' + tt('Skrýša') + '</span><span class="bl">' + tt('Skrývaš sa v tieni') + '</span>' +
        '<span class="clock" data-until="' + (Date.now() + this.s.hidingLeft()) + '"></span>' +
        '<p>' + tt('Vonku hliadkuje polícia. Vydrž tu {hide} minút a potom ťa {shadow} minút nebude nikto naháňať, ani keď budeš mať hviezdy.', { hide: CONFIG.hideMin, shadow: CONFIG.shadowMin }) + '</p>' +
        '<button class="btn wide" data-act="hide-leave">' + tt('Odísť skôr (bez ochrany)') + '</button>';
    } else if (this.s.shadowLeft() > 0) {
      inner = '<span class="sc" style="color:#9b968b">' + tt('Skrýša') + '</span><span class="bl">' + tt('Si v tieni') + '</span>' +
        '<span class="clock" data-until="' + (Date.now() + this.s.shadowLeft()) + '"></span>' +
        '<p>' + tt('Polícia ťa teraz nehľadá. Keď čas vyprší a budeš mať hviezdy, začnú ťa znova naháňať.') + '</p>' +
        '<button class="btn gold wide" data-act="back">' + tt('Vyjsť von') + '</button>';
    } else {
      inner = '<span class="sc" style="color:#9b968b">' + tt('Skrýša') + '</span><span class="bl">' + tt('Zadný vchod') + '</span>' +
        '<p>' + tt('Pivnica bez okien, matrac a zámok z vnútornej strany. Keď ťa hľadá polícia, schovaj sa tu na {hide} minút. Hľadanosť zmizne a {shadow} minút ťa polícia nebude naháňať.', { hide: CONFIG.hideMin, shadow: CONFIG.shadowMin }) + '</p>' +
        '<p class="num">' + tt('Hľadanosť teraz: {stars}', { stars: stars ? '★'.repeat(stars) : tt('žiadna') }) + '</p>' +
        '<button class="btn gold wide" data-act="hide-start"' + (stars < 1 ? ' disabled' : '') + '>' + tt('Skryť sa') + '</button>' +
        (stars < 1 ? '<p style="font-size:15px">' + tt('Polícia ťa teraz nehľadá, nie je pred kým sa skrývať.') + '</p>' : '');
    }
    return { html: this.hdr(tt('Skrýša')) + '<div class="body" style="padding:0"><div class="hide-scr">' + inner + '</div></div>' };
  }

  // the 8 medals under the portrait (yours can be tapped for their progress) and how many of the 24 there are
  medalRow(tiers, mine) {
    const n = medalTotal(tiers);
    return '<div class="medals-wrap"><div class="medals">' + MEDALS.map((m) => {
      const t = tiers[m.id] || 0;
      const label = m.name + (t ? ' · ' + MEDAL_TIERS[t - 1].name : '');
      return mine ? '<button class="medal-b" data-act="medal" data-arg="' + m.id + '" aria-label="' + esc(label) + '">' + medalSvg(m.id, t, 34) + '</button>'
        : '<span class="medal-b" title="' + esc(label) + '">' + medalSvg(m.id, t, 34) + '</span>';
    }).join('') + '</div><div class="medals-cap"><span class="sc">' + tt('Medaily') + '</span><span class="num">' + n + ' / ' + MEDAL_COUNT + '</span></div></div>';
  }

  // new medals are paid as soon as you are on the map with nothing open: one window for all of them
  async medalCheck() {
    if (this.medalBusy || this.modalOpen || this.name || !this.s.medals) return;
    const v = this.s.medals();
    if (!v || !v.unpaid) return;
    this.medalBusy = true;
    try {
      const r = await this.s.claimMedals();
      if (!r.ok) return;
      sound.play('loot_legendarny');
      const items = r.got.map((g) => {
        const m = MEDALS.find((x) => x.id === g.id);
        return '<div class="mgot">' + medalSvg(g.id, g.tier, 48) + '<span>' + esc(m.name) + '<br><small>' + MEDAL_TIERS[g.tier - 1].name + '</small></span></div>';
      }).join('');
      this.modal('<h2 class="win">' + (r.got.length > 1 ? tt('Nové medaily') : tt('Nová medaila')) + '</h2><div class="mgots">' + items + '</div>' +
        '<div class="rew">' + tt('<span class="gold">+{bars} tehl.</span>', { bars: r.bars }) + '</div>' +
        '<p class="sub" style="font-size:15px;color:#9b968b">' + tt('Zlatý rám na profile: {total} / {count} medailí.', { total: r.total, count: MEDAL_COUNT }) + '</p>' +
        '<div class="acts"><button class="btn gold" data-act="modal-close">' + tt('Pokračovať') + '</button></div>');
    } finally { this.medalBusy = false; }
  }

  // a level that opens something (UNLOCKS) gets its own window on the map, after any result screen is closed
  unlockCheck() {
    const L = this.s.p.level;
    if (this.seenLevel === undefined || L < this.seenLevel) { this.seenLevel = L; this.unlockQueue = []; return; }
    if (L > this.seenLevel) {
      for (const u of UNLOCKS) { const at = CONFIG.unlock[u.id]; if (at > this.seenLevel && at <= L) this.unlockQueue.push(u); }
      this.seenLevel = L;
    }
    if (!this.unlockQueue.length || this.modalOpen || this.name || this.medalBusy) return;
    const u = this.unlockQueue.shift();
    sound.play('levelup');
    this.modal('<p class="sc unlock-k">' + tt('Úroveň {n}', { n: CONFIG.unlock[u.id] }) + '</p><h2 class="win">' + tt('Odomknuté: {name}', { name: u.name }) + '</h2><p class="sub">' + u.text + '</p>' +
      '<div class="acts">' + (u.go ? '<button class="btn" data-act="modal-close">' + tt('Neskôr') + '</button><button class="btn gold" data-act="unlock-go" data-arg="' + u.id + '">' + u.go[0] + '</button>'
        : '<button class="btn gold" data-act="modal-close">' + tt('Rozumiem') + '</button>') + '</div>');
  }

  // new-player tutorial: one line under the HUD, a gold ring + edge arrow on the map (world.js), the reward at the end
  tutHud() {
    const el = $('#hud-tut');
    const t = this.s.tutorial ? this.s.tutorial() : null;
    if (!t) { this.goalHud(el); return; }
    el.classList.remove('goal', 'ready');
    el.querySelector('.tut-x').hidden = false;
    $('#hud-tut-go').dataset.act = 'tut-go';
    el.hidden = t.id === 'finish' || !this.tipsOn(); // switched off: the steps still count, the line and the arrow are gone
    if (this.tutStep !== undefined && t.step > this.tutStep) sound.play('go');
    this.tutStep = t.step;
    if (t.id === 'finish') {
      if (!this.modalOpen && !this.name && !this.tutShown) { this.tutShown = true; this.tutFinishModal(); }
      return;
    }
    const st = TUT[t.id];
    const text = typeof st.text === 'function' ? st.text(t) : st.text;
    $('#hud-tut-n').textContent = tt('Návod {n}/{total}', { n: t.step + 1, total: t.total });
    if ($('#hud-tut-text').textContent !== text) $('#hud-tut-text').textContent = text;
    const go = $('#hud-tut-go');
    go.hidden = !st.go;
    if (st.go) { go.textContent = st.go[0]; go.dataset.arg = st.go[1]; }
  }

  // bottom edge of the HUD (the status / tutorial line if one shows, else the top bar), px from the top of the game,
  // read at most every 300 ms
  hudBottom() {
    const now = Date.now();
    if (!this.hudB || now - this.hudB.at > 300) {
      const top = $('#app').getBoundingClientRect().top;
      const r = $('#hud-stack').getBoundingClientRect();
      const bar = $('.hud-top').getBoundingClientRect();
      this.hudB = { at: now, v: Math.round((r.height ? r.bottom : bar.bottom + 10) - top) || 96 };
    }
    return this.hudB.v;
  }

  // after the tutorial the same card shows the current first-hour goal (data.js GOALS) and, once it is reached,
  // a button for its reward; the map arrow points to the goal's place (main.js tutorialTarget)
  goalHud(el) {
    const g = this.s.goal ? this.s.goal() : null;
    el.hidden = !g || (!this.tipsOn() && !g.ready); // switched off: only a reached goal shows, so its reward is not lost
    if (!g) return;
    el.classList.add('goal');
    el.classList.toggle('ready', g.ready);
    if (g.ready && this.goalReady !== g.i) { this.goalReady = g.i; sound.play('go'); }
    const rew = [g.reward.cash ? money(g.reward.cash) : '', g.reward.bars ? tt('{n} tehl.', { n: g.reward.bars }) : ''].filter(Boolean).join(' + ');
    const text = g.ready ? tt('Splnené! Odmena: {rew}', { rew: rew })
      : g.text + (g.n > 1 && g.kind !== 'level' ? ' (' + g.have + ' / ' + g.n + ')' : '');
    $('#hud-tut-n').textContent = tt('Cieľ {n}/{total}', { n: g.i + 1, total: g.total });
    if ($('#hud-tut-text').textContent !== text) $('#hud-tut-text').textContent = text;
    el.querySelector('.tut-x').hidden = g.ready;
    const go = $('#hud-tut-go');
    const btn = g.ready ? [tt('Vyzdvihnúť'), 'goal-claim', ''] : g.go ? [g.go[0], 'tut-go', g.go[1]] : null;
    go.hidden = !btn;
    if (btn) { go.textContent = btn[0]; go.dataset.act = btn[1]; go.dataset.arg = btn[2]; }
  }

  tutFinishModal() {
    const r = CONFIG.tutorialReward, u = CONFIG.unlock;
    this.modal('<h2 class="win">' + tt('Návod hotový') + '</h2><p class="sub">' + tt('Základy máš. Ďalej ťa čakajú denné misie (truhlica hore), Aréna od úrovne {arena}, Podzemné zápasy od úrovne {club} a gang od úrovne {gang}.', { arena: u.arena, club: u.club, gang: u.gang }) + '</p>' +
      '<div class="rew"><span class="gold">' + money(r.cash) + '</span>' + tt('<span class="gold">+{bars} tehl.</span>', { bars: r.bars }) + '</div>' +
      '<div class="acts"><button class="btn gold" data-act="tut-finish">' + tt('Vyzdvihnúť') + '</button></div>');
  }

  // ---------------------------------------------------------------- daily missions
  // the chest next to the money: how many of today's tasks are done (a tap opens them); while a timed step
  // runs (courier, escape, following, spraying) its clock shows as a buff chip under the heat bar
  dailyHud() {
    const el = $('#hud-chest');
    const v = this.s.dailyMap();
    this.dailyChip = '';
    if (!v.tasks.length) { el.hidden = true; return; }
    el.hidden = false;
    const doneN = v.tasks.filter((t) => t.done).length;
    el.classList.toggle('ready', v.done);
    const badge = v.done ? '✓' : doneN + '/' + v.tasks.length;
    if ($('#hud-chest-n').textContent !== badge) $('#hud-chest-n').textContent = badge;
    if (v.done) return;
    const w = this.dailyWorld ? this.dailyWorld() : null;
    const live = [];
    for (const t of v.tasks.filter((x) => !x.done)) {
      if (t.type === 'courier' && t.got.length) live.push(tt('kuriér {cas}', { cas: clock(Math.max(0, t.data.pickedAt + v.courierSec * 1000 - Date.now())) }));
      if ((t.type === 'escape' || t.type === 'razia') && w && w.esc > 0) live.push(tt('útek {n}/{total} s', { n: Math.min(v.escapeSec, Math.floor(w.esc)), total: v.escapeSec }));
      if (t.type === 'sledovanie' && w && w.follow > 0) live.push(tt('sleduješ {n}/{total} s', { n: Math.min(v.followSec, Math.floor(w.follow)), total: v.followSec }));
      if (t.type === 'graffiti' && w && w.spray > 0) live.push(tt('sprej {n}/{total} s', { n: Math.min(v.spraySec, Math.floor(w.spray)), total: v.spraySec }));
    }
    if (live.length) this.dailyChip = CHEST_ICON + '<span>' + tt('Denná misia') + ' · <b>' + [...new Set(live)].join(' · ') + '</b></span>';
  }

  // the map stepped on a target / picked a parcel / survived the escape
  async dailyStep(task, step) {
    const r = await this.s.dailyStep(task, step);
    if (!r.ok) { if (!/Príliš rýchlo|Ešte si neušiel|Ešte nie/.test(r.error)) this.toast(r.error, true); return; }
    if (r.started) {
      const type = this.s.dailyMap().tasks[task].type;
      this.toast(type === 'sledovanie' ? tt('Sleduješ ho. Drž sa za ním {n} sekúnd.', { n: CONFIG.dailyFollowSec }) : type === 'graffiti' ? tt('Sprejuješ. Nehýb sa.') : tt('Útek: vydrž {n} sekúnd, kým ťa policajt nechytí.', { n: CONFIG.dailyEscapeSec }));
      return;
    }
    if (r.already) return;
    if (r.failed) { this.toast(r.failed, true); return; }
    const t = this.s.dailyMap().tasks[task];
    const T = DAILY_TYPES[t.type];
    if (t.type === 'courier' && r.have === 1) this.toast(tt('Balík máš. Dones ho do {min} minút, sleduj šípku.', { min: CONFIG.dailyCourierSec / 60 }));
    else this.toast(tt('{name}: {have} / {need}', { name: T.name, have: r.have, need: r.need }) + (r.done ? ' · ' + tt('splnené') : ''));
    if (r.reward) this.dailyRewardModal(r.reward);
    if (this.name === 'daily') this.render();
  }

  // a runner / Ripper hit counted for today (the hit's own window shows first)
  dailyAfter(d) {
    if (!d) return;
    this.toast(d.name + ': ' + tt('splnené'));
    if (d.reward) this.dailyRewardModal(d.reward);
  }

  dailyRewardText(r) {
    if (r.type === 'cash') return money(r.cash);
    if (r.type === 'level') return tt('Nová úroveň');
    if (r.type === 'bars') return tt('{n} zlatých tehličiek', { n: r.bars });
    return tt('Legendárny predmet + {n} tehličiek', { n: r.bars });
  }

  dailyRewardModal(rw) {
    if (this.modalOpen) { this.pendingDaily = rw; return; } // after the window that is open now
    sound.play('reward');
    this.modal('<h2 class="win">' + tt('Denné misie splnené') + '</h2><p class="sub">' + tt('Deň {n} z 15', { n: rw.day }) + '</p>' +
      '<div class="rew"><span class="gold">' + this.dailyRewardText(rw) + '</span></div>' + (rw.item ? this.lootHtml(rw.item) : '') + this.levelUpText(rw.levelUps || 0) +
      '<p class="sub" style="font-size:16px;color:#9b968b">' + tt('Nové úlohy o polnoci.') + '</p><div class="acts"><button class="btn gold" data-act="modal-close">' + tt('Pokračovať') + '</button></div>');
    if (this.name === 'daily') this.render();
  }

  scr_daily() {
    const v = this.s.dailyView();
    const GROUP = { easy: tt('Ľahká'), action: tt('Akčná'), hard: tt('Ťažká') };
    let h = '<p class="p">' + tt('Tri úlohy priamo na mape. Ciele ukazujú zlaté kruhy a šípka na kraji obrazovky. Keď splníš všetky tri, dostaneš odmenu dňa z kalendára.') + '</p>';
    for (const t of v.tasks) {
      const timer = t.type === 'courier' && t.have === 1 && !t.done ? '<div class="s gold">' + tt('Zostáva {cas}', { cas: '<b data-until="' + (t.data.pickedAt + CONFIG.dailyCourierSec * 1000) + '"></b>' }) + '</div>' : '';
      h += '<div class="dtask' + (t.done ? ' done' : '') + '"><div class="top"><span class="t">' + (t.done ? '✓ ' : '') + tts(t.name) + '</span><span class="sc g-' + t.group + '">' + GROUP[t.group] + '</span></div>' +
        '<div class="s">' + esc(tts(t.text)) + '</div>' + timer +
        '<div class="bar" style="height:6px;margin-top:6px"><i style="width:' + Math.round((t.have / t.need) * 100) + '%"></i></div><div class="num s" style="text-align:right">' + t.have + ' / ' + t.need + '</div></div>';
    }
    h += v.done ? '<p class="note gold">' + tt('Dnes máš hotovo. Nové úlohy o {cas}.', { cas: '<span data-until="' + v.nextAt + '"></span>' }) + '</p>' : '<p class="note">' + tt('Úlohy sa menia o polnoci ({cas}). Vynechaný deň nevadí, kalendár počká.', { cas: '<span data-until="' + v.nextAt + '"></span>' }) + '</p>';
    // the 15-day calendar: the day the next finished set pays is highlighted
    const cur = v.done ? v.day - 1 || 15 : v.day;
    h += '<div class="sec sc">' + tt('Kalendár odmien') + '</div><div class="dcal">' + v.calendar.map((r, k) => {
      const n = k + 1;
      const label = r.type === 'cash' ? money(r.cash) : r.type === 'level' ? tt('+1 úroveň') : r.type === 'bars' ? tt('{n} tehl.', { n: r.bars }) : tt('Legendárka');
      const cls = (n < v.day ? ' past' : '') + (n === cur && !v.done ? ' now' : '') + (n === cur && v.done ? ' got' : '') + ' t-' + r.type;
      return '<div class="dday' + cls + '"><small>' + tt('Deň {n}', { n: n }) + '</small><b>' + label + '</b></div>';
    }).join('') + '</div>';
    return { html: this.hdr(tt('Denné misie'), tt('deň <span class="gold">{n}</span> / 15', { n: v.done ? cur : v.day })) + '<div class="body">' + h + '</div>' };
  }

  // the running pills for Postava: one row per colour with its effect, stacks and the time until the next stack runs out
  pillRows() {
    const b = this.s.buffs(), cls = this.s.p.cls, now = Date.now();
    return ['red', 'blue', 'green'].filter((k) => b[k].length).map((k) => {
      const n = b[k].length;
      return '<div class="pillrow"><span class="buff ' + k + '">' + PILL_ICON[k] + '<b>+' + Math.round(CONFIG.pillBoost * n * 100) + ' %</b></span>' +
        '<span class="pe">' + pillName(k) + ': ' + pillEffect(k, cls) + '</span><span class="num muted" data-until="' + Math.min(...b[k]) + '">' + clock(Math.min(...b[k]) - now) + '</span></div>';
    }).join('');
  }

  async pill(kind) {
    const r = await this.s.takePill(kind);
    if (!this.check(r)) return;
    this.toast(r.refreshed
      ? tt('{name}: +{n} {effect}, čas obnovený na hodinu.', { name: pillName(kind), n: pct(CONFIG.pillBoost * r.stacks), effect: pillEffect(kind, this.s.p.cls) })
      : tt('{name}: +{n} {effect} na hodinu.', { name: pillName(kind), n: pct(CONFIG.pillBoost * r.stacks), effect: pillEffect(kind, this.s.p.cls) }));
    this.tick();
  }

  setPoi(poi) {
    this.poi = poi;
    if (poi && this.guide && poi.id === this.guide.poi) this.guide = null; // arrived where the unlock window sent you
    this.updateAction();
  }

  updateAction() {
    const show = !!this.poi && !this.paused() && this.s.hasSave();
    this.el.action.hidden = !show;
    this.el.poiTag.hidden = !show;
    if (show) {
      this.el.action.textContent = this.poi.verb;
      let name = this.poi.name;
      if (this.poi.action === 'turf') {
        const v = this.s.turfView().find((x) => x.id === this.poi.arg);
        name += ' · ' + (v.owner ? v.owner.name : tt('voľný'));
      }
      this.el.poiTag.textContent = name;
    }
    const w = this.s.hasSave() && !this.paused() ? this.s.streetWeapon() : null;
    const atk = $('#attack');
    atk.hidden = !w;
    if (w) atk.textContent = w.attack === 'gun' ? tt('Výstrel') : tt('Úder');
  }

  action() {
    if (!this.poi || this.paused()) return;
    const p = this.poi;
    if (p.action === 'missions') this.open('missions', p.arg);
    else if (p.action === 'boss') this.open('boss');
    else if (p.action === 'shop') this.open('shop', p.arg);
    else if (p.action === 'character') this.open('character');
    else if (p.action === 'arena') this.open('arena');
    else if (p.action === 'upgrade') this.open('upgrade');
    else if (p.action === 'lawyer') this.open('lawyer');
    else if (p.action === 'wexler') this.open('wexler');
    else if (p.action === 'turf') this.open('turf', p.arg);
    else if (p.action === 'hideout') this.open('hideout');
    else if (p.action === 'travel') this.open('travel');
    else this.info(p.name, p.arg);
  }

  async reaperCaught() {
    const r = await this.s.catchRipper();
    if (!this.check(r)) return;
    sound.play('bars');
    this.modal('<h2 class="win">' + tt('Chytil si ho') + '</h2><p class="sub">' + tt('Ripper ležal na zemi a tehličku pustil.') + '</p><div class="rew"><span class="gold">' + tt('+1 zlatá tehlička') + '</span></div>' +
      '<p class="sub" style="font-style:italic;font-size:17px;color:#d8d3c7">' + tt('Wexler: „Dobrá práca. Nechaj si ju, zaslúžil si si ju.“') + '</p>' +
      '<div class="acts"><button class="btn gold" data-act="modal-close">' + tt('Pokračovať') + '</button></div>');
    this.dailyAfter(r.daily); // the day's reward waits until this window closes
  }

  async runnerHit() {
    const r = await this.s.hitRunner();
    if (!this.check(r)) return;
    if (r.item) {
      this.modal('<h2 class="win">' + tt('Šťastný zásah') + '</h2><p class="sub">' + tt('Zmizol v oblaku iskier a niečo po ňom ostalo na zemi.') + '</p>' + this.lootHtml(r.item) +
        '<div class="acts"><button class="btn gold" data-act="modal-close">' + tt('Pokračovať') + '</button></div>');
    } else {
      this.toast(tt('Zmizol v oblaku iskier. Tentoraz nič nepustil.'));
    }
    this.dailyAfter(r.daily);
  }

  // heat bar with the selected mission's share drawn on top
  heatMeter(heat, add) {
    const a = Math.min(100, heat), b = Math.max(0, Math.min(100 - a, add));
    return '<div style="margin:12px 0 4px"><div style="display:flex;justify-content:space-between;font-size:15px" class="num"><span class="red sc">' + tt('Heat dnes') + '</span><span>' + Math.round(heat) + (add ? ' → ' + Math.round(heat + add) : '') + ' %</span></div>' +
      '<div class="bar hp" style="margin-top:5px;display:flex"><i style="width:' + a + '%"></i><i style="width:' + b + '%;background:rgba(224,53,43,.35)"></i></div></div>';
  }

  toast(msg, bad = false) {
    msg = tts(msg); // a server message (Slovak) or a text already in the player's language
    const t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.textContent = msg;
    if (bad) sound.play('error');
    // on the map: one message at a time, low above the controls, so the top of the map stays clear
    const onMap = !this.name && !this.el.hud.hidden;
    this.el.toasts.classList.toggle('onmap', onMap);
    if (onMap) this.el.toasts.querySelectorAll('.toast').forEach((x) => x.remove());
    this.el.toasts.appendChild(t);
    setTimeout(() => t.remove(), Math.min(5000, 2400 + msg.length * 30));
  }

  // ---------------------------------------------------------------- beta: errors and bug reports
  // one error line from the browser or a failed server call; the same line twice in a row counts once
  logError(msg) {
    msg = String(msg).slice(0, 300);
    if (this.errors[this.errors.length - 1] === msg) return;
    this.errors.push(msg);
    if (this.errors.length > 20) this.errors.shift();
    if (this.errorsSent + this.errorsOut.length < 20 && !this.errorsOut.includes(msg)) this.errorsOut.push(msg);
  }

  // waiting errors go to the server at most once a minute and 20 a session, so a loop of errors cannot flood it
  flushErrors() {
    if (!this.errorsOut.length || !this.s.hasSave() || this.s.busy || Date.now() - this.errorsAt < 60000) return;
    this.errorsAt = Date.now();
    const lines = this.errorsOut.splice(0);
    this.errorsSent += lines.length;
    Promise.resolve(this.s.logErrors(lines)).catch(() => {});
  }

  // what a bug report carries besides the player's words
  bugInfo() {
    const v = (import.meta.url.match(/v=(\d+)/) || [])[1] || 'dev';
    return { v, screen: this.name || (this.modalOpen ? 'okno' : 'mapa'), size: innerWidth + 'x' + innerHeight, ua: navigator.userAgent, errors: this.errors.slice(-10) };
  }

  check(res) {
    if (!res.ok) this.toast(res.error, true);
    return res.ok;
  }

  // ---------------------------------------------------------------- modals
  modal(html) {
    this.modalOpen = true;
    this.el.modal.innerHTML = '<div class="mbox" role="dialog" aria-modal="true">' + html + '</div>';
    this.el.modal.hidden = false;
    this.updateAction();
  }

  closeModal() {
    this.modalOpen = false;
    this.el.modal.hidden = true;
    this.el.modal.innerHTML = '';
    this.updateAction();
    if (this.pendingDaily) { const rw = this.pendingDaily; this.pendingDaily = null; this.dailyRewardModal(rw); }
  }

  info(title, text) {
    this.modal('<h2>' + esc(tts(title)) + '</h2><p class="sub" style="font-size:17px;color:#c9c4b8">' + esc(tts(text)) + '</p><div class="acts"><button class="btn gold" data-act="modal-close">' + tt('Rozumiem') + '</button></div>');
  }

  // Cloudflare Turnstile in the login form (#captcha): the script loads once, the widget is drawn again after each
  // render of the title screen; its token goes with sign-in / sign-up / new password and works only once
  captchaMount() {
    const el = $('#captcha');
    if (!el || el.childElementCount) return;
    if (!this.captchaScript) {
      this.captchaScript = new Promise((done, failed) => {
        const s = document.createElement('script');
        s.src = CAPTCHA.script; s.async = true;
        s.onload = done; s.onerror = () => failed(new Error('captcha script'));
        document.head.appendChild(s);
      });
    }
    this.captchaScript.then(() => {
      if (!el.isConnected || !window.turnstile) return;
      if (this.captcha.id != null) { try { window.turnstile.remove(this.captcha.id); } catch (e) { /* its element is gone already */ } }
      this.captcha.token = null; this.captcha.ask = false;
      this.captcha.id = window.turnstile.render(el, {
        sitekey: CAPTCHA.siteKey, theme: 'dark', size: 'flexible', language: LANG,
        callback: (t) => { this.captcha.token = t; this.captcha.failed = false; },
        'expired-callback': () => { this.captcha.token = null; },
        'error-callback': () => { this.captcha.token = null; },
        'before-interactive-callback': () => { this.captcha.ask = true; }, // Cloudflare wants the box ticked
        'after-interactive-callback': () => { this.captcha.ask = false; },
      });
    }, () => { this.captcha.failed = true; this.logError('captcha script did not load'); });
  }

  captchaReset() {
    this.captcha.token = null;
    if (this.captcha.id != null && window.turnstile) { try { window.turnstile.reset(this.captcha.id); } catch (e) { /* redrawn on the next render */ } }
  }

  // the page was opened from an account email (remote.js authReturn): confirmed, a new password, or a dead link
  authBack(b) {
    if (!b) return;
    if (b.error) {
      this.info(tt('Odkaz už neplatí'), tt('Odkaz z e-mailu vypršal alebo už bol použitý. Ak si e-mail už potvrdil, stačí sa prihlásiť. Ak nie, zaregistruj sa znova a pošleme ti nový odkaz.'));
    } else if (b.type === 'signup' && b.session) {
      this.info(tt('E-mail je potvrdený'), this.s.hasSave() ? tt('Si prihlásený, môžeš hrať.') : tt('Vitaj v Hits & Licks! Si prihlásený. Teraz si vyber prezývku a triedu a začni.'));
    } else if (b.type === 'recovery' && b.session) {
      this.modal('<h2>' + tt('Nové heslo') + '</h2><p class="sub" style="font-size:17px;color:#c9c4b8">' + tt('Si prihlásený cez odkaz z e-mailu. Zadaj nové heslo, ktorým sa budeš odteraz prihlasovať.') + '</p>' +
        '<div class="field"><label for="new-pass">' + tt('Nové heslo (aspoň 8 znakov)') + '</label><input id="new-pass" type="password" autocomplete="new-password"></div>' +
        '<div class="acts"><button class="btn" data-act="modal-close">' + tt('Neskôr') + '</button><button class="btn gold" data-act="pass-save">' + tt('Uložiť heslo') + '</button></div>');
      setTimeout(() => { const t = $('#new-pass'); if (t) t.focus(); }, 50);
    }
  }

  // back from Stripe's payment page (remote.js payBack): the bars come with a sync once Stripe confirms the payment
  payBack(b) {
    if (!b) return;
    if (b.cancel) { this.toast(tt('Platba bola zrušená, nič sa nezaplatilo.')); return; }
    if (!this.paidCount) this.waitPaid(); // (the first sync after loading may have brought them already)
  }

  // ask the server a few times; a payment Stripe confirms later still comes with the next sync (every half minute)
  async waitPaid() {
    const start = this.paidCount || 0;
    this.toast(tt('Platba prebehla. Čakám na potvrdenie od Stripe…'));
    for (let i = 0; i < 10 && (this.paidCount || 0) === start; i++) {
      await new Promise((r) => setTimeout(r, i ? 3000 : 1200));
      if ((this.paidCount || 0) === start && !this.s.busy) await this.s.call('sync');
    }
    if ((this.paidCount || 0) === start) this.info(tt('Platba sa ešte spracúva'), tt('Tehličky sa pripíšu samy, hneď ako Stripe platbu potvrdí. Zvyčajne to trvá pár sekúnd, pri niektorých spôsoboch platby aj dlhšie. Ak tu nebudú do hodiny, napíš nám na hitsnlickssupport@gmail.com.'));
  }

  // the server credited bars paid through Stripe (remote.js onPaid)
  paid(bars) {
    this.paidCount = (this.paidCount || 0) + 1;
    sound.play('bars');
    this.toast(tt('+{bars} zlatých tehličiek. Vďaka za nákup!', { bars: fmt(bars) }));
    if (this.name === 'wexler') this.render();
  }

  // nobody saw you for a while: a star less
  async wantedLose() {
    const r = await this.s.wantedLose();
    if (!r.ok) return;
    this.toast(r.stars ? tt('Polícia stratila stopu. Hľadanosť klesla.') : tt('Stratil si sa polícii. Nikto ťa nehľadá.'));
  }

  // an officer on foot went down: more come, maybe an epic item, maybe a raid step
  async copDown() {
    const r = await this.s.copDown();
    if (!r.ok) return; // the chase already ended
    this.toast(tt('Policajt na zemi. Teraz ťa naháňa {n} policajtov.', { n: r.wanted }), true);
    if (r.item) {
      this.modal('<h2 class="win">' + tt('Z policajta niečo vypadlo') + '</h2><p class="sub">' + tt('Na zemi ostal epický kus.') + '</p>' + this.lootHtml(r.item) +
        '<div class="acts"><button class="btn gold" data-act="modal-close">' + tt('Pokračovať') + '</button></div>');
    }
    if (r.daily) {
      if (r.daily.have < r.daily.need) this.toast(tt('{name}: {have} / 2 policajti', { name: r.daily.name, have: r.daily.have }) + (r.daily.have >= 2 ? '. ' + tt('Teraz ujdi!') : ''));
      if (r.daily.reward) this.dailyRewardModal(r.daily.reward);
    }
  }

  police() {
    if (this.paused() || !this.s.hasSave()) return;
    sound.play('whistle');
    const v = this.s.view();
    // an officer is down: no bribe, no running; half your cash, or a while without missions
    if (this.s.copKills() > 0) {
      this.modal('<h2 class="lose">' + tt('Zatknutý') + '</h2><p class="sub">' + tt('Zložil si policajta. Tentoraz sa to nedá vybaviť pokutou.') + '</p>' +
        '<div class="acts">' +
        '<button class="btn wide" data-act="police-killer" data-arg="peniaze">' + tt('Prísť o {n} % peňazí · {cena}', { n: Math.round(CONFIG.killCashShare * 100), cena: money(this.s.killCashLoss()) }) + '</button>' +
        '<button class="btn wide" data-act="police-killer" data-arg="basa">' + tt('{cas} bez misií od Dona a Dílera', { cas: hours(CONFIG.killJailMin) }) + '</button>' +
        '</div><p class="sub" style="font-size:15px;color:#9b968b">' + tt('Denné misie môžeš robiť aj v base.') + '</p>');
      return;
    }
    this.modal(
      '<h2 class="lose">' + tt('Kontrola') + '</h2><p class="sub">' + tt('Policajt ťa chytil. Potom bude {n} minút pokoj.', { n: Math.round(CONFIG.caughtPeaceSec / 60) }) + '</p>' +
      '<div class="acts">' +
      '<button class="btn wide" data-act="police" data-arg="utiect">' + tt('Utiecť · Obratnosť {n}', { n: pct(this.s.policeRunChance()) }) + '</button>' +
      '<button class="btn wide" data-act="police" data-arg="podplatit">' + tt('Podplatiť · {cena}', { cena: money(this.s.policeBribeCost()) }) + '</button>' +
      '<button class="btn wide" data-act="police" data-arg="vzdat">' + tt('Vzdať sa · {n} min bez misií', { n: CONFIG.jailMinutes }) + '</button>' +
      '</div>'
    );
  }

  // (both are only shown as a reward, so showing one also plays its sound, after the win fanfare)
  levelUpText(n) {
    if (n > 0) sound.play('levelup', { delay: 1.1 });
    return n > 0 ? '<p class="sub gold" style="font-size:18px">' + tt('Nová úroveň {level}! +{n} voľné body.', { level: this.s.p.level, n: n * CONFIG.pointsPerLevel }) + '</p>' : '';
  }

  itemName(it) { return ITEM_BASES[it.base].name + (it.upgrade ? ' +' + it.upgrade : ''); }

  bonusText(it) {
    const b = this.s.itemBonus(it);
    const car = ITEM_BASES[it.base].car;
    return (car ? [tt('Heat −{n}', { n: pct(car.heat) }), tt('čas misií −{n}', { n: pct(car.time) })] : []).concat(Object.entries(b).map(([k, v]) => (k === 'dmg' ? tt('Zbraň +{n}', { n: v }) : k === 'armor' ? tt('Brnenie +{n}', { n: v }) : STAT_NAMES[k] + ' +' + v))).join(' · ');
  }

  // flavour text of an item (ITEM_BASES desc)
  descHtml(it) {
    const d = ITEM_BASES[it.base] && ITEM_BASES[it.base].desc;
    return d ? '<div class="desc">' + esc(d) + '</div>' : '';
  }

  lootHtml(it) {
    const r = rar(it.rarity);
    sound.play('loot_' + r.id, { delay: 0.6 });
    return '<div class="loot rar-' + it.rarity + '"><img src="' + art(ITEM_BASES[it.base].art) + '" alt=""><div><div style="font-size:18px">' + this.itemName(it) + '</div><div style="font-size:14px;color:' + r.color + '">' + r.name + ' · ' + this.bonusText(it) + '</div>' + this.descHtml(it) + '</div></div>';
  }

  // ---------------------------------------------------------------- actions
  get acts() {
    return {
      async open(a) {
        if (a === 'inventory' || a === 'boss' || a === 'settings') this.open(a, null);
        else this.open(a);
      },
      async back() { this.back(); },
      async zoom(a) { if (this.zoom) this.zoom(Number(a)); },
      async tab(a) {
        if (a === 'city') this.close();
        else if (a === 'missions') this.open('missions', this.s.state.mission ? this.s.state.mission.giver : null);
        else this.open(a);
      },
      async 'modal-close'() { this.closeModal(); },
      async profile(a) { const r = await this.s.playerProfile(a); if (this.check(r)) this.open('profile', r.profile, true); },
      async 'menu-go'(a) {
        if (a === 'title') { this.open('title'); return; }
        if (a === 'missions') { this.open('missions', this.s.state.mission ? this.s.state.mission.giver : null); return; }
        if (a === 'hall') { const r = await this.s.hallOfFame(); if (this.check(r)) this.open('hall', r.list, true); return; }
        this.open(a, null, true);
      },
      async 'pick-class'(a) { if ($('#name-input')) this.sel.newName = $('#name-input').value; this.sel.cls = a; this.render(); },
      async 'new-game'() { this.sel.newGame = true; this.render(); },
      async 'cancel-new'() { this.sel.newGame = false; this.render(); },
      async 'start-game'() {
        const name = ($('#name-input') && $('#name-input').value.trim()) || (this.s.online ? '' : 'Hráč');
        if (this.s.hasSave() && !confirm(tt('Naozaj začať odznova? Uložená hra sa zmaže.'))) return;
        if (!this.check(await this.s.newGame(name, this.sel.cls))) return;
        this.sel.newGame = false;
        this.readyNotified = false;
        this.tutShown = false; this.tutStep = undefined; // a new character gets the tutorial (and its reward window) again
        this.close();
        // a computer with a mouse has no joystick on screen (css), so it gets only the keys
        const keysOnly = window.matchMedia && matchMedia('(min-width: 900px) and (min-height: 560px) and (hover: hover) and (pointer: fine)').matches;
        this.info(tt('Vitaj v Meste 1'), keysOnly ? tt('Návod hore na obrazovke ťa prevedie prvými krokmi. Pohyb: klávesy WASD alebo šípky, akcia: E, útok: F, záložky: 1 až 5.') : tt('Návod hore na obrazovke ťa prevedie prvými krokmi. Pohyb: joystick vľavo dole alebo klávesy WASD, akcia: tlačidlo vpravo alebo E.'));
      },
      async continue() { this.close(); },
      async spend(a) { if (this.check(await this.s.spendPoint(a))) { sound.play('up'); this.render(); } },
      async 'buy-stat'(a) { if (this.check(await this.s.buyStat(a))) { sound.play('up'); this.render(); } },
      async slot(a) {
        if (a === 'auto' && this.s.p.level < CONFIG.autoUnlockLevel) { this.toast(tt('Auto sa odomyká na úrovni {level}.', { level: CONFIG.autoUnlockLevel })); return; }
        this.open('inventory', a, true);
      },
      async equip(a) {
        const it = this.s.item(a);
        if (this.check(await this.s.equip(a))) { if (it) sound.equip(it.base); this.render(); }
      },
      async unequip(a) { if (this.check(await this.s.unequip(a))) { sound.play('cloth', { vol: 0.6 }); this.render(); } },
      async sell(a) {
        const r = await this.s.sellItem(a);
        if (this.check(r)) { sound.play('cash'); this.toast(tt('Predané za {cena}.', { cena: money(r.gain) })); this.render(); }
      },
      async upgrade(a) { const r = await this.s.upgradeItem(a); if (this.check(r)) { sound.play('anvil'); this.toast(tt('Vylepšené za {cena}.', { cena: money(r.cost) })); this.render(); } },
      async offer(a) { this.sel.offer = a; this.render(); },
      async accept() {
        const r = await this.s.startMission(this.arg, this.sel.offer);
        if (this.check(r)) { sound.play('go'); this.readyNotified = false; this.toast(tt('Misia beží. Čas vidíš hore pri hodinách.')); this.close(); }
      },
      async skip() { const r = await this.s.skipMission(); if (this.check(r)) { this.render(); } },
      async claim() {
        const r = await this.s.claimMission();
        if (!this.check(r)) return;
        this.readyNotified = false;
        this.open('fight', { kind: 'mission', ...r, artB: r.b.portrait, title: r.b.name, subtitle: r.b.title, intro: r.story.hit }, true);
      },
      async 'buy-elixir'() { if (this.check(await this.s.buyElixir())) { sound.play('bars'); this.toast(tt('Čierny trh je otvorený na {hours} hodín.', { hours: CONFIG.elixirHours })); this.render(); } },
      async 'shop-reroll'(a) { if (this.check(await this.s.rerollShop(a))) { this.toast(tt('Nový tovar je v obchode.')); this.render(); } },
      async 'buy-item'(a) {
        const r = await this.s.buyItem(this.arg, a);
        if (this.check(r)) { sound.play(ITEM_BASES[r.item.base].car ? 'engine' : 'cash'); this.toast(tt('Kúpené: {item}.', { item: this.itemName(r.item) })); this.render(); }
      },
      async lawyer() { const r = await this.s.lawyer(); if (this.check(r)) { sound.play('cash'); this.toast(tt('Heat znížený o {heat} %. Dnes ešte {left}×.', { heat: CONFIG.lawyerHeat, left: this.s.lawyerLeft() })); this.render(); } },
      async 'boss-fight'() {
        const r = await this.s.fightBoss();
        if (!this.check(r)) return;
        const b = this.s.bossInfo();
        this.open('fight', { kind: 'boss', ...r, artB: r.b.portrait || 'photo_zlodej', silhouette: !r.b.portrait, title: r.b.name, subtitle: r.b.title, next: b }, true);
      },
      async travel(a) {
        const r = await this.s.travel(a);
        if (!this.check(r)) return;
        sound.play(a === 'mesto2' ? 'tram' : 'horn'); // the tram stop in the Old Town, a taxi back home
        this.close();
        this.toast(tt('Vitaj: {mesto}.', { mesto: CITIES[a].name }));
      },
      async 'club-fight'() {
        const r = await this.s.fightClub();
        if (!this.check(r)) return;
        this.open('fight', { kind: 'club', ...r, artB: r.b.portrait, title: r.b.name, subtitle: tt('Poschodie {floor} · {title}', { floor: r.result.floor, title: r.b.title }) }, true);
      },
      async 'arena-fight'(a) {
        const opp = this.s.arena().opponents[Number(a)];
        const r = await this.s.fightArena(Number(a));
        if (!this.check(r)) return;
        this.open('fight', { kind: 'arena', ...r, artB: BOT_ART[opp.cls] || 'photo_zlodej', focusB: BOT_FOCUS[opp.cls], title: opp.name, subtitle: tt('{trieda} · úroveň {level}', { trieda: CLASSES[opp.cls].name, level: opp.level }) }, true);
      },
      async 'arena-new'() { if (this.check(await this.s.refreshArena())) this.render(); },
      async 'fight-skip'() { this.finishFight(true); },
      async 'war-skip'() { this.finishWar(true); },
      async 'fight-done'() { this.closeModal(); this.back(); },
      async police(a) {
        const r = await this.s.policeCheck(a);
        if (!this.check(r)) return;
        const x = r.result;
        if (x.type === 'escaped') sound.play('whiff'); else if (x.type === 'bribed') sound.play('cash');
        const msg = { escaped: tt('Ušiel si, ale polícia si ťa zapamätala: +1 hviezda.'), caught: tt('Chytili ťa. Pokuta {fine} a {min} min bez misií.', { fine: money(x.fine || 0), min: CONFIG.jailMinutes }), bribed: tt('Policajt zobral {cena} a odišiel.', { cena: money(x.cost || 0) }), jail: tt('Vzdal si sa. {min} min bez misií.', { min: CONFIG.jailMinutes }) }[x.type];
        this.closeModal();
        this.toast(msg, x.type === 'caught' || x.type === 'jail');
      },
      async 'hide-start'() { if (this.check(await this.s.hideStart())) this.render(); },
      async 'hide-leave'() { await this.hideFinish(); this.back(); },
      async 'police-killer'(a) {
        const r = await this.s.policeKiller(a);
        if (!this.check(r)) return;
        this.closeModal();
        const x = r.result;
        this.toast(x.type === 'cash' ? tt('Zobrali ti {cena}.', { cena: money(x.lost) }) : tt('{cas} bez misií od Dona a Dílera.', { cas: hours(x.minutes) }), true);
      },
      async medal(a) {
        const v = this.s.medals ? this.s.medals() : null;
        const m = v && v.list.find((x) => x.id === a);
        if (!m) return;
        const steps = m.tiers.map((need, k) => '<div class="mstep' + (m.tier > k ? ' on' : '') + '">' + medalSvg(m.id, k + 1, 30) + '<span>' + MEDAL_TIERS[k].name + ' · ' + fmt(need) + '</span><span class="gold">' + tt('+{bars} tehl.', { bars: MEDAL_TIERS[k].bars }) + '</span></div>').join('');
        this.modal('<div style="text-align:center">' + medalSvg(m.id, m.tier, 64) + '</div><h2>' + esc(m.name) + '</h2>' +
          '<p class="sub">' + (m.next ? tt('Máš {have} / {next} ({unit}).', { have: fmt(m.have), next: fmt(m.next), unit: m.unit }) : tt('Všetky tri stupne máš ({unit}: {have}).', { unit: m.unit, have: fmt(m.have) })) + '</p>' +
          '<div class="msteps">' + steps + '</div><div class="acts"><button class="btn gold" data-act="modal-close">' + tt('Zavrieť') + '</button></div>');
      },
      async 'tut-go'(a) { this.open(a, null, true); },
      async 'tut-skip'() {
        this.modal('<h2>' + tt('Preskočiť návod?') + '</h2><p class="sub">' + tt('Odmenu za návod potom nedostaneš.') + '</p><div class="acts"><button class="btn" data-act="modal-close">' + tt('Pokračovať v návode') + '</button><button class="btn gold" data-act="tut-skip-yes">' + tt('Preskočiť') + '</button></div>');
      },
      async 'unlock-go'(a) {
        const u = UNLOCKS.find((x) => x.id === a);
        this.closeModal();
        if (!u || !u.go) return;
        if (u.go[1] === 'open') { this.open(u.go[2], null, true); return; }
        this.guide = { poi: u.go[2], until: Date.now() + 10 * 60000 }; // main.js tutorialTarget points the arrow there
        this.toast(tt('Šípka „!“ ťa dovedie: {name}.', { name: u.name }));
      },
      async 'goal-claim'() {
        const r = await this.s.goalClaim();
        if (!this.check(r)) return;
        sound.play('reward');
        this.toast(r.cash && r.bars ? tt('Cieľ splnený: {cena} a {bars} tehličiek.', { cena: money(r.cash), bars: r.bars }) : r.cash ? tt('Cieľ splnený: {cena}.', { cena: money(r.cash) }) : r.bars ? tt('Cieľ splnený: {bars} tehličiek.', { bars: r.bars }) : tt('Cieľ splnený: .'));
        if (r.last) {
          this.modal('<h2 class="win">' + tt('Prvé ciele máš za sebou') + '</h2><p class="sub">' + tt('Si na nohách. Odteraz si ciele určuješ sám: každý deň denné misie, bossovia mesta, Aréna a Podzemné zápasy, gang a jeho rajón. V piatok večer od úrovne {level} sa otvára Čierny trh.', { level: CONFIG.unlock.blackMarket }) + '</p>' +
            '<div class="acts"><button class="btn gold" data-act="modal-close">' + tt('Rozumiem') + '</button></div>');
        }
      },
      async 'tut-skip-yes'() { if (this.check(await this.s.tutorialSkip())) { this.closeModal(); if (this.name) this.render(); this.toast(tt('Návod preskočený.')); } },
      async 'tut-finish'() {
        const r = await this.s.tutorialFinish();
        if (!this.check(r)) return;
        sound.play('reward');
        this.closeModal();
        this.toast(tt('Odmena za návod: {cash} a {bars} tehličiek.', { cash: money(r.cash), bars: r.bars }));
      },
      async lang(id) {
        if (id === LANG) return;
        setLang(id);
        if (this.s.saveLang) await this.s.saveLang(id);
        location.reload();
      },
      async 'sound-toggle'() { sound.set(!sound.on); setTimeout(() => sound.play('cash'), 80); this.render(); },
      'tips-toggle'() { this.setTips(!this.tipsOn()); this.render(); },
      'tips-off'() { this.setTips(false); this.tick(); this.toast(tt('Návod a ciele sú skryté. Zapneš ich v Nastaveniach.')); },
      async 'test-mode'() { await this.s.setTestMode(!this.s.state.settings.testMode); this.render(); },
      async 'test-bm'() { await this.s.setBlackMarket(!this.s.state.settings.blackMarket); this.render(); },
      async 'buy-bars'(a) {
        const r = await this.s.buyBars(Number(a));
        if (this.check(r)) { sound.play('bars'); this.toast(tt('+{bars} zlatých tehličiek (testovacia kúpa).', { bars: r.bars })); this.render(); }
      },
      // online: Stripe's payment page; the bars come back with a sync once Stripe confirms the payment
      async 'pay-bars'(a) {
        if (this.paying) return;
        this.paying = true;
        const r = await this.s.checkout(Number(a));
        if (!this.check(r)) { this.paying = false; return; }
        if (r.url) {
          this.toast(tt('Otváram platbu cez Stripe…'));
          location.href = r.url;
          setTimeout(() => { this.paying = false; }, 8000); // (if the page did not leave)
        } else { this.paying = false; this.waitPaid(); } // ?mock: recorded at once
      },
      // gangs
      // character creator
      async 'open-look'() { this.sel.look = null; this.open('look', null, true); },
      async 'look-step'(a) {
        const [id, dir] = a.split(':');
        const part = LOOK_PARTS.find((x) => x.id === id);
        const opts = (part.optional ? [null] : []).concat(part.items.map((i) => i.id));
        const cur = opts.indexOf(this.lookPick(this.sel.look, part));
        this.sel.look = { ...this.sel.look, [id]: opts[(cur + Number(dir) + opts.length) % opts.length] };
        this.render();
      },
      async 'look-random'() {
        const look = {};
        for (const part of LOOK_PARTS) {
          const opts = (part.optional ? [null] : []).concat(part.items.map((i) => i.id));
          look[part.id] = opts[Math.floor(Math.random() * opts.length)];
        }
        this.sel.look = look;
        this.render();
      },
      async 'look-save'() { if (this.check(await this.s.setLook(this.sel.look))) { this.toast(tt('Vzhľad uložený.')); this.back(); } },
      async 'gang-color'(a) { this.sel.gangName = $('#gang-name').value; this.sel.gangTag = $('#gang-tag').value; this.sel.gangColor = a; this.render(); },
      async 'gang-create'() {
        const r = await this.s.createGang($('#gang-name').value, $('#gang-tag').value, this.sel.gangColor || 'gold');
        if (this.check(r)) { sound.play('cash'); this.toast(tt('Gang založený za {cena}.', { cena: money(r.cost) })); this.render(); }
      },
      async deposit(a) { const r = await this.s.deposit(Number(a)); if (this.check(r)) { sound.play('cash'); this.toast(tt('Vložené do pokladnice: {cena}.', { cena: money(r.amount) })); this.render(); } },
      async 'gang-ask'(a) { if (this.check(await this.s.requestJoin(a))) { this.toast(tt('Žiadosť odoslaná. Počkaj, kým ju šéf schváli.')); this.render(); } },
      async 'gang-unask'(a) { if (this.check(await this.s.cancelRequest(a))) this.render(); },
      async 'gang-accept'(a) { const r = await this.s.acceptInvite(a); if (this.check(r)) { this.toast(tt('Si v gangu {name}.', { name: r.name })); this.render(); } },
      async 'gang-decline'(a) { if (this.check(await this.s.declineInvite(a))) this.render(); },
      async 'gang-approve'(a) {
        const r = await this.s.approveJoin(a);
        if (!this.check(r)) return;
        this.toast(r.gone ? tt('Tento hráč je už v inom gangu.') : tt('{name} je nový člen gangu.', { name: r.name }));
        this.render();
      },
      async 'gang-deny'(a) { if (this.check(await this.s.denyJoin(a))) this.render(); },
      async 'gang-invite'() {
        const name = ($('#gang-invite') && $('#gang-invite').value.trim()) || '';
        if (!name) return;
        const r = await this.s.invitePlayer(name);
        if (this.check(r)) { this.toast(tt('Pozvánka pre {name} odoslaná.', { name: r.name })); this.render(); }
      },
      async 'gang-uninvite'(a) { if (this.check(await this.s.cancelInvite(a))) this.render(); },
      async 'gang-member'(a) { this.gangMemberModal(a); },
      async 'open-shop'(a) { this.open('shop', a, true); },
      async 'hall-tab'(a) {
        if (a === 'gangs') { const r = await this.s.gangHall(); if (!this.check(r)) return; this.sel.hallGangs = { list: r.list, mine: r.mine }; }
        this.sel.hallTab = a;
        this.render();
      },
      async 'gang-rank'(a) { const [id, rank] = a.split(':'); if (this.check(await this.s.setRank(id, rank))) { this.closeModal(); this.render(); } },
      async 'gang-lead'(a) { if (this.check(await this.s.transferLead(a))) { this.closeModal(); this.toast(tt('Vedenie gangu je odovzdané.')); this.render(); } },
      async 'gang-kick'(a) { const r = await this.s.kickMember(a); if (this.check(r)) { this.closeModal(); this.toast(tt('{name} už nie je v gangu.', { name: r.name }), true); this.render(); } },
      async 'gang-leave'() {
        this.modal('<h2>' + tt('Odísť z gangu?') + '</h2><p class="sub">' + (this.s.gang().members.length <= 1 ? tt('Si posledný člen, gang sa tým rozpustí a jeho objekty ostanú voľné.') : this.s.myRank() === 'boss' ? tt('Vedenie prevezme pravá ruka alebo najstarší člen.') : tt('Do gangu sa môžeš vrátiť len na novú žiadosť.')) + '</p>' +
          '<div class="acts"><button class="btn" data-act="modal-close">' + tt('Zostať') + '</button><button class="btn gold" data-act="gang-leave-yes">' + tt('Odísť') + '</button></div>');
      },
      async 'gang-leave-yes'() { if (this.check(await this.s.leaveGang())) { this.closeModal(); this.sel.gangList = null; this.toast(tt('Už nie si v gangu.')); this.render(); } },
      async 'gang-disband'() {
        this.modal('<h2>' + tt('Rozpustiť gang?') + '</h2><p class="sub">' + tt('Všetci členovia budú bez gangu, pokladnica prepadne a objekty gangu ostanú voľné. Nedá sa to vrátiť.') + '</p>' +
          '<div class="acts"><button class="btn" data-act="modal-close">' + tt('Nie') + '</button><button class="btn gold" data-act="gang-disband-yes">' + tt('Rozpustiť') + '</button></div>');
      },
      async 'gang-disband-yes'() { if (this.check(await this.s.disbandGang())) { this.closeModal(); this.sel.gangList = null; this.toast(tt('Gang je rozpustený.'), true); this.render(); } },
      async 'gang-up'(a) { if (this.check(await this.s.buyGangUpgrade(a))) { this.toast(tt('Vylepšené.')); this.render(); } },
      async turf(a) { this.open('turf', a, true); },
      async 'turf-refill'() { const r = await this.s.refillTurf(this.arg); if (this.check(r)) { this.toast(tt('Obrana doplnená za {cena}.', { cena: money(r.cost) })); this.render(); } },
      async 'turf-def'(a) { if (this.check(await this.s.toggleDefender(this.arg, a || undefined))) this.render(); },
      async 'turf-attack'() {
        const r = await this.s.attackTurf(this.arg);
        if (!this.check(r)) return;
        if (!r.D.length) { sound.play('win'); this.toast(tt('{turf} je váš. {cash}, +{xp} XP.', { turf: r.turf.name, cash: money(r.result.cash), xp: fmt(r.result.xp) })); this.render(); return; }
        this.open('war', r, true);
      },
      // online account
      async login(mode) {
        const email = $('#auth-email').value.trim(), pass = $('#auth-pass') ? $('#auth-pass').value : '';
        this.sel.authEmail = email;
        if (!email) { this.toast(tt('Zadaj email.'), true); return; }
        if (mode === 'up' && !($('#auth-agree') && $('#auth-agree').checked)) { this.toast(tt('Potvrď, že máš aspoň 18 rokov a súhlasíš s podmienkami.'), true); return; }
        const needCaptcha = this.s.needsCaptcha && this.s.needsCaptcha();
        if (needCaptcha && !this.captcha.token) {
          this.toast(this.captcha.failed ? tt('Overenie sa nenačítalo. Obnov stránku, prípadne vypni blokovanie reklám pre túto stránku.')
            : this.captcha.ask ? tt('Zaškrtni políčko „Overte, že ste človek“ nad tlačidlom.') : tt('Chvíľu počkaj, kým sa overí, že nie si robot.'), true);
          return;
        }
        const token = this.captcha.token;
        if (needCaptcha) this.captchaReset(); // a token works only once
        if (mode === 'reset') { const r = await this.s.resetPassword(email, token); if (this.check(r)) this.info(tt('Obnova hesla'), tt('Poslali sme ti email s odkazom na nové heslo.')); return; }
        const r = mode === 'up' ? await this.s.signUp(email, pass, token) : await this.s.signIn(email, pass, token);
        if (!this.check(r)) return;
        if (r.confirm) { this.info(tt('Potvrď email'), tt('Na {email} sme poslali odkaz. Po potvrdení sa tu prihlás.', { email })); this.sel.authMode = 'in'; this.render(); return; }
        this.render();
      },
      async 'pass-save'() {
        const t = $('#new-pass');
        const r = await this.s.setPassword(t ? t.value : '');
        if (!this.check(r)) return;
        this.closeModal();
        this.toast(tt('Heslo je zmenené.'));
      },
      async 'auth-mode'(a) { this.sel.authEmail = $('#auth-email') ? $('#auth-email').value : ''; this.sel.authMode = a; this.render(); },
      async logout() { await this.s.signOut(); this.open('title'); },
      async 'account-delete'() {
        this.modal('<h2>' + tt('Zmazať účet?') + '</h2><p class="sub" style="font-size:17px;color:#c9c4b8">' + tt('Zmaže sa tvoja postava so všetkými vecami, miesto v gangu, e-mail aj heslo. Nedá sa to vrátiť.') + '</p>' +
          '<div class="acts"><button class="btn" data-act="modal-close">' + tt('Nechať') + '</button><button class="btn danger" data-act="account-delete-go">' + tt('Zmazať navždy') + '</button></div>');
      },
      async 'account-delete-go'() {
        const r = await this.s.deleteAccount();
        this.closeModal();
        if (!this.check(r)) return;
        this.sel.newGame = false;
        this.sel.authMode = 'in';
        this.open('title');
        this.info(tt('Účet je zmazaný'), tt('Tvoju postavu, e-mail aj heslo sme vymazali. Ďakujeme, že si hral.'));
      },
      async 'bug-open'() {
        this.modal('<h2>' + tt('Nahlásiť chybu') + '</h2><p class="sub" style="font-size:16px;color:#c9c4b8">' + tt('Čo sa stalo a čo si práve robil? Každá chyba nám pomôže.') + '</p>' +
          '<div class="field"><textarea id="bug-text" maxlength="' + CONFIG.bugReportMax + '" rows="6" placeholder="' + tt('Napríklad: v obchode Zbrane som kúpil nôž a peniaze sa odpočítali dvakrát.') + '"></textarea></div>' +
          '<p class="note" style="text-align:left">' + tt('Spolu s textom pošleme verziu hry, tvoju úroveň, obrazovku, typ zariadenia a posledné chyby hry.') + '</p>' +
          '<div class="acts"><button class="btn" data-act="modal-close">' + tt('Zrušiť') + '</button><button class="btn gold" data-act="bug-send">' + tt('Odoslať') + '</button></div>');
        setTimeout(() => { const t = $('#bug-text'); if (t) t.focus(); }, 50);
      },
      async 'bug-send'() {
        const t = $('#bug-text');
        const r = await this.s.reportBug(t ? t.value : '', this.bugInfo());
        if (!this.check(r)) return;
        this.closeModal();
        this.toast(tt('Ďakujeme, hlásenie sme dostali.'));
      },
      async reset() {
        if (!confirm(this.s.online ? tt('Naozaj zmazať postavu na serveri? Tento krok sa nedá vrátiť.') : tt('Naozaj zmazať uloženú hru? Tento krok sa nedá vrátiť.'))) return;
        if (this.s.online) await this.s.deleteCharacter(); else this.s.reset();
        this.sel.newGame = true;
        this.open('title');
      },
    };
  }

  // ---------------------------------------------------------------- screens
  // SK · CZ · DE · EN: on the title screen and in Nastavenia (the page loads again in the new language)
  langPicker() {
    return '<div class="langs" role="group" aria-label="' + tt('Jazyk') + '">' + LANGS.map((l) =>
      '<button class="' + (l.id === LANG ? 'on' : '') + '" data-act="lang" data-arg="' + l.id + '" lang="' + l.id + '" title="' + l.name + '">' + l.short + '</button>').join('') + '</div>';
  }

  scr_title() {
    const has = this.s.hasSave();
    // the poster carries the logo, so the title shows only the tagline under it
    let inner = '<h1 class="logo sr">Hits &amp; Licks</h1><p class="tag">' + tt('Od pešiaka po bossa mesta') + '</p>' + this.langPicker();
    const evNow = activeEvents();
    if (evNow) inner += '<div class="ev-banner">' + evNow.ids.map((id) => EVENTS[id].icon + ' ' + EVENTS[id].name).join(' · ') + '<small>' + tt('Víkendový event') + '</small></div>';
    if (this.s.online && !this.s.loggedIn()) {
      const mode = this.sel.authMode || 'in';
      inner += '<div class="field"><label for="auth-email">' + tt('Email') + '</label><input id="auth-email" type="email" autocomplete="email" value="' + esc(this.sel.authEmail || '') + '"></div>';
      if (mode !== 'reset') inner += '<div class="field"><label for="auth-pass">' + tt('Heslo') + (mode === 'up' ? ' (' + tt('aspoň 8 znakov') + ')' : '') + '</label><input id="auth-pass" type="password" autocomplete="' + (mode === 'up' ? 'new-password' : 'current-password') + '"></div>';
      if (mode === 'up') inner += '<label class="agree"><input type="checkbox" id="auth-agree"><span>' + tt('Mám aspoň 18 rokov a súhlasím s <a href="{terms}" target="_blank" rel="noopener">podmienkami používania</a>. Ako chránime tvoje údaje: <a href="{privacy}" target="_blank" rel="noopener">ochrana osobných údajov</a>.', { terms: legal('podmienky'), privacy: legal('sukromie') }) + '</span></label>';
      if (this.s.needsCaptcha && this.s.needsCaptcha()) inner += '<div id="captcha" class="captcha"></div>';
      inner += '<button class="btn gold wide" data-act="login" data-arg="' + mode + '">' + { in: tt('Prihlásiť sa'), up: tt('Vytvoriť účet'), reset: tt('Poslať odkaz na nové heslo') }[mode] + '</button>';
      inner += '<div class="menu" style="margin-top:6px">' + (mode !== 'in' ? '<button data-act="auth-mode" data-arg="in">' + tt('Mám účet, prihlásiť sa') + '</button>' : '<button data-act="auth-mode" data-arg="up">' + tt('Nový hráč? Vytvoriť účet') + '</button><button data-act="auth-mode" data-arg="reset">' + tt('Zabudnuté heslo') + '</button>') + '</div>';
    } else if (has && !this.sel.newGame) {
      const p = this.s.p;
      inner += '<div class="orn"><i></i></div><div class="menu">' +
        '<button class="sel" data-act="continue">' + tt('Pokračovať') + '</button>' +
        (this.s.online ? '' : '<button data-act="new-game">' + tt('Nová hra') + '</button>') +
        '<button data-act="menu-go" data-arg="settings">' + tt('Nastavenia') + '</button></div><div class="orn"><i></i></div>' +
        '<p class="note" style="color:#b9b4a8;font-size:16px">' + esc(p.name) + ' · ' + tt('úroveň {n}', { n: p.level }) + ' · ' + CLASSES[p.cls].name + '</p>';
    } else {
      inner += '<div class="field"><label for="name-input">' + tt('Prezývka') + '</label><input id="name-input" maxlength="16" placeholder="' + (this.s.online ? tt('aspoň 3 znaky') : tt('Ty')) + '" autocomplete="off" value="' + esc(this.sel.newName || '') + '"></div>';
      inner += '<div class="classes">' + Object.entries(CLASSES).map(([id, c]) =>
        '<button class="' + (this.sel.cls === id ? 'sel' : '') + '" data-act="pick-class" data-arg="' + id + '"><span class="bl">' + c.name + '</span><small>' + STAT_NAMES[c.stat] + '</small></button>').join('') + '</div>';
      if (CLASS_ART[this.sel.cls]) inner += '<img class="cls-art" src="' + art(CLASS_ART[this.sel.cls]) + '" alt="' + CLASSES[this.sel.cls].name + '" style="object-position:' + (BOT_FOCUS[this.sel.cls] || '50% 20%') + '">';
      inner += '<p class="note" style="margin:0 0 12px;color:#b9b4a8;font-size:16px">' + CLASSES[this.sel.cls].blurb + '</p>';
      inner += '<button class="btn gold wide" data-act="start-game">' + tt('Začať') + '</button>';
      if (has) inner += '<button class="btn wide" style="margin-top:8px" data-act="cancel-new">' + tt('Späť') + '</button>';
    }
    return {
      after: () => this.captchaMount(),
      html: '<div class="title-scr"><div class="poster"><img src="' + art('photo_title') + '" alt="' + tt('Hits &amp; Licks: traja chlapi z gangu v nočnej ulici') + '"></div><div class="inner">' + inner + '<p class="legal">' + tt('Len pre dospelých (18+)') + ' · ' + '<a href="' + legal('podmienky') + '" target="_blank" rel="noopener">' + tt('Podmienky používania') + '</a> · <a href="' + legal('sukromie') + '" target="_blank" rel="noopener">' + tt('Ochrana osobných údajov') + '</a>' + '</p></div></div>',
    };
  }

  scr_menu() {
    return {
      overlay: true,
      html: '<button class="menu-x" data-act="back" aria-label="' + tt('Zavrieť menu') + '">' + BACK + '<span>' + tt('Späť') + '</span></button>' +
        '<div class="pause">' +
        '<svg width="300" height="26" viewBox="0 0 330 26" aria-hidden="true"><path d="M0 13 H128" stroke="#e9e4d8" stroke-opacity=".4"/><path d="M202 13 H330" stroke="#e9e4d8" stroke-opacity=".4"/><path d="M128 13 C136 4 146 4 150 13 C146 22 136 22 128 13 Z M202 13 C194 4 184 4 180 13 C184 22 194 22 202 13 Z M165 3 L175 13 L165 23 L155 13 Z" fill="none" stroke="#c9a24a"/><circle cx="165" cy="13" r="2.2" fill="#c9a24a"/></svg>' +
        '<h2 class="sc" style="margin:8px 0 6px;font-weight:500;font-size:18px;letter-spacing:4px;color:#b9b4a8">' + tt('Menu') + '</h2>' +
        '<div class="menu">' + MENU.map((m, i) => {
          const lv = (m.id === 'arena' || m.id === 'club' || (m.id === 'gang' && !this.s.gang())) ? this.s.locked(m.id) : 0;
          const note = m.locked ? tt('od verzie 2') : lv ? tt('od úrovne {n}', { n: lv }) : '';
          return '<button class="' + (i === 0 ? 'sel' : '') + (m.locked || lv ? ' locked' : '') + '" data-act="menu-go" data-arg="' + m.id + '" data-desc="' + esc(m.desc) + '">' + m.name + (note ? ' <small style="font-size:14px;font-style:italic">· ' + note + '</small>' : '') + '</button>';
        }).join('') + '</div>' +
        '<p class="desc" id="menu-desc">' + MENU[0].desc + '</p>' +
        '<div class="hints"><span><i class="dot"></i>' + tt('Ťukni: vybrať') + '</span><span><i class="dot o"></i>' + tt('Späť: zavrieť') + '</span></div>' +
        '<button class="btn" style="margin-top:16px" data-act="back">' + tt('Zavrieť') + '</button></div>',
    };
  }

  scr_character() {
    const p = this.s.p, v = this.s.view(), ts = this.s.totalStats();
    const md = this.s.medals ? this.s.medals() : null, myTiers = md ? Object.fromEntries(md.list.map((m) => [m.id, m.tier])) : {};
    const slotHtml = (id) => {
      const s = SLOTS.find((x) => x.id === id);
      const it = p.equipment[id] && this.s.item(p.equipment[id]);
      let box;
      if (it) box = '<span class="box rar-' + it.rarity + '"><img src="' + art(ITEM_BASES[it.base].art) + '" alt="' + esc(this.itemName(it)) + '">' + (it.upgrade ? '<span class="up">+' + it.upgrade + '</span>' : '') + '</span>';
      else if (id === 'auto' && p.level < CONFIG.autoUnlockLevel) box = '<span class="box empty" style="font-size:12px;font-style:italic;color:#4f4c46">' + tt('od Lv {n}', { n: CONFIG.autoUnlockLevel }) + '</span>';
      else box = '<span class="box empty">+</span>';
      return '<button class="slot" data-act="slot" data-arg="' + id + '">' + box + '<small>' + s.name + '</small></button>';
    };
    const w = this.s.weaponDmg();
    const me = this.s.playerFighter();
    const hb = F.hitOf(me);
    const c = CLASSES[p.cls];
    const special = c.pierce ? ' · ' + tt('úder ignoruje brnenie') : c.dodge ? ' · ' + tt('úhyb 50 % proti Svalovcom') : c.block ? ' · ' + tt('blok {zlodej} proti Zlodejom, {dealer} proti Dealerom', { zlodej: pct(c.block.zlodej), dealer: pct(c.block.dealer) }) : '';
    let rows = '';
    for (const st of STATS) {
      const bonus = ts[st] - p.stats[st];
      const cost = this.s.statCost(st);
      const isCls = CLASSES[p.cls].stat === st;
      rows += '<div class="statrow' + (isCls ? ' cls' : '') + '"><span class="n sc">' + STAT_NAMES[st] + (isCls ? ' <small style="font-variant-caps:normal;letter-spacing:0;font-style:italic;color:#9b968b">· ' + tt('triedny, dvíha úder') + '</small>' : '') + '</span>' +
        '<span class="v">' + ts[st] + (bonus ? '<small>+' + bonus + '</small>' : '') + '</span>' +
        (p.points > 0 ? '<button class="btn small gold" data-act="spend" data-arg="' + st + '" aria-label="' + tt('Pridať bod do {stat}', { stat: STAT_NAMES[st] }) + '">+1</button>' : '') +
        '<button class="btn small num" style="min-width:96px" data-act="buy-stat" data-arg="' + st + '"' + (p.cash < cost ? ' disabled' : '') + '>+ ' + money(cost) + '</button></div>';
    }
    return {
      html: this.hdr(tt('Postava'), tt('Úroveň <span class="gold">{n}</span>', { n: p.level }) + ' · ' + CLASSES[p.cls].name) +
        '<div class="body"><div class="char">' +
        '<div class="slots">' + ['zbran', 'bunda', 'nohavice', 'topanky'].map(slotHtml).join('') + '</div>' +
        '<div class="pframe"><div class="portrait">' + (LOOK_BASE ? this.lookHtml(p.look, 'in-portrait') : '<img src="' + art('photo_zlodej') + '" alt="' + tt('Tvoja postava') + '">') + (LOOK_BASE ? '<button class="btn small look-edit" data-act="open-look">' + tt('Vzhľad') + '</button>' : '') + '<div class="cap"><span class="bl" style="font-size:32px;color:#efe9dc">' + esc(p.name) + '</span><span class="sc" style="font-size:13px;color:#9b968b">' + tt('Pešiak') + ' · ' + CITIES[this.s.city()].name + '</span></div></div>' + frameHtml(medalTotal(myTiers)) + '</div>' +
        '<div class="slots">' + ['retiazka', 'prsten', 'hodinky', 'auto'].map(slotHtml).join('') + '</div></div>' +
        this.medalRow(myTiers, true) +
        '<div style="margin-top:12px"><div style="display:flex;justify-content:space-between;font-size:15px;color:#9b968b" class="num"><span>' + tt('Skúsenosti') + '</span><span style="color:#e9e4d8">' + fmt(v.xp) + ' / ' + fmt(v.xpNext) + '</span></div><div class="bar" style="height:8px;margin-top:4px"><i style="width:' + Math.min(100, (v.xp / v.xpNext) * 100) + '%"></i></div></div>' +
        '<p class="note num" style="text-align:left;color:#b9b4a8;font-size:15px">' + tt('Životy {hp} · úder {lo}–{hi} · krit {krit} · brnenie {brn} (max {max})', { hp: fmt(this.s.maxHp()), lo: Math.round(hb * 0.85), hi: Math.round(hb * 1.15), krit: pct(F.crit(ts.stastie, p.level)), brn: pct(F.reduction(ts.armor, p.level, p.cls)), max: pct(c.armorCap) }) + special + '</p>' +
        (this.pillRows() ? '<div class="sec sc" style="margin-top:12px">' + tt('Aktívne tabletky') + '</div><div class="pills-list">' + this.pillRows() + '</div>' : '') +
        '<div style="margin-top:8px;border-top:1px solid var(--line)">' + rows + '</div>' +
        (p.points > 0 ? '<p class="note gold" style="font-size:16px">' + tt('Voľné body: {n}', { n: p.points }) + '</p>' : '<p class="note">' + tt('Staty si dokupuješ za peniaze, cena s každým bodom rastie.') + '</p>') +
        '</div>',
    };
  }

  // hall of fame: registered players, highest level first; a tap opens their profile
  // two tabs: players (highest level first) and gangs (most Gang Wars wins first)
  scr_hall(list) {
    list = list || [];
    const tab = this.sel.hallTab || 'players';
    const tabs = '<div class="seg"><button class="' + (tab === 'players' ? 'on' : '') + '" data-act="hall-tab" data-arg="players">' + tt('Hráči') + '</button><button class="' + (tab === 'club' ? 'on' : '') + '" data-act="hall-tab" data-arg="club">' + tt('Zápasy') + '</button><button class="' + (tab === 'gangs' ? 'on' : '') + '" data-act="hall-tab" data-arg="gangs">' + tt('Gangy') + '</button></div>';
    let rows, count;
    if (tab === 'club') {
      // Podzemné zápasy: the highest floor first
      const cl = list.filter((r) => r.club > 0).sort((a, b) => b.club - a.club || b.level - a.level);
      count = tt('{n} hráčov', { n: cl.length });
      rows = cl.map((r, i) => '<button class="hrow' + (r.me ? ' me' : '') + '" data-act="profile" data-arg="' + esc(r.id) + '">' +
        '<span class="num rk">' + (i + 1) + '.</span><span class="nm">' + esc(r.name) + (r.me ? ' <small>· ' + tt('ty') + '</small>' : '') + '</span>' +
        '<span class="cl num">' + tt('úr. {n}', { n: r.level }) + '</span><span class="num lv">' + r.club + ' / ' + CONFIG.clubFloors + '</span></button>').join('') || '<p class="p">' + tt('Zatiaľ nikto nevyhral ani jeden zápas.') + '</p>';
    } else if (tab === 'gangs') {
      const gl = this.sel.hallGangs || { list: [], mine: null };
      count = tt('{n} gangov', { n: gl.list.length });
      rows = gl.list.map((x, i) => '<div class="hrow ghrow' + (x.id === gl.mine ? ' me' : '') + '"><span class="num rk">' + (i + 1) + '.</span><span class="nm">' + this.tagBox(x) + ' ' + esc(x.name) + (x.id === gl.mine ? ' <small>· ' + tt('tvoj') + '</small>' : '') + '</span>' +
        '<span class="cl num">' + tt('{n} čl.', { n: x.members }) + '</span><span class="num lv">' + tt('{n} výh.', { n: x.wins }) + '</span></div>').join('');
      if (!rows) rows = '<p class="p">' + tt('Zatiaľ tu nie je žiadny gang.') + '</p>';
    } else {
      count = tt('{n} hráčov', { n: list.length });
      rows = list.map((r, i) => '<button class="hrow' + (r.me ? ' me' : '') + '" data-act="profile" data-arg="' + esc(r.id) + '">' +
        '<span class="num rk">' + (i + 1) + '.</span><span class="nm">' + esc(r.name) + (r.me ? ' <small>· ' + tt('ty') + '</small>' : '') + '</span>' +
        '<span class="cl">' + (CLASSES[r.cls] ? CLASSES[r.cls].name : '') + '</span><span class="num lv">' + tt('úr. {n}', { n: r.level }) + '</span></button>').join('') || '<p class="p">' + tt('Zatiaľ tu nikto nie je.') + '</p>';
    }
    return {
      html: this.hdr(tt('Sieň slávy'), count) + '<div class="body">' + tabs + rows +
        (tab === 'gangs' ? '<p class="note">' + tt('Poradie podľa vyhratých bojov o územie (Gang Wars).') + '</p>' : '') +
        (tab === 'club' ? '<p class="note">' + tt('Poradie podľa najvyššieho poschodia v Podzemných zápasoch.') + '</p>' : '') +
        (this.s.online ? '' : '<p class="note">' + tt('Offline hra: ostatných hráčov a gangy uvidíš po prihlásení.') + '</p>') + '</div>',
    };
  }

  // another player's card: look, stats with gear and every worn item
  scr_profile(pr) {
    const bonusStr = (b) => Object.entries(b).map(([k, v]) => (k === 'dmg' ? tt('Zbraň +{n}', { n: v }) : k === 'armor' ? tt('Brnenie +{n}', { n: v }) : STAT_NAMES[k] + ' +' + v)).join(' · ');
    const slotHtml = (id) => {
      const s = SLOTS.find((x) => x.id === id);
      const it = pr.gear[id];
      const box = it ? '<span class="box rar-' + it.rarity + '"><img src="' + art(ITEM_BASES[it.base].art) + '" alt="' + esc(ITEM_BASES[it.base].name) + '">' + (it.upgrade ? '<span class="up">+' + it.upgrade + '</span>' : '') + '</span>' : '<span class="box empty"></span>';
      return '<div class="slot">' + box + '<small>' + s.name + '</small></div>';
    };
    const c = CLASSES[pr.cls];
    const stats = STATS.map((st) => '<div class="statrow' + (c && c.stat === st ? ' cls' : '') + '"><span class="n sc">' + STAT_NAMES[st] + '</span><span class="v">' + fmt(pr.stats[st]) + '</span></div>').join('');
    const items = SLOTS.filter((s) => pr.gear[s.id]).map((s) => {
      const it = pr.gear[s.id], r = rar(it.rarity), base = ITEM_BASES[it.base];
      return '<div class="item rar-' + it.rarity + '"><img src="' + art(base.art) + '" alt=""><div class="mid"><div class="t">' + esc(base.name) + (it.upgrade ? ' +' + it.upgrade : '') + '</div><div class="s"><span style="color:' + r.color + '">' + r.name + '</span> · ' + tt('úr. {n}', { n: it.level }) + ' · ' + s.name + '</div><div class="s" style="color:#c9c4b8">' + bonusStr(it.bonus) + '</div></div></div>';
    }).join('');
    return {
      html: this.hdr(esc(pr.name), tt('Úroveň <span class="gold">{n}</span>', { n: pr.level }) + ' · ' + (c ? c.name : '')) +
        '<div class="body"><div class="char">' +
        '<div class="slots">' + ['zbran', 'bunda', 'nohavice', 'topanky'].map(slotHtml).join('') + '</div>' +
        '<div class="pframe"><div class="portrait">' + (LOOK_BASE ? this.lookHtml(pr.look, 'in-portrait') : '<img src="' + art('photo_zlodej') + '" alt="">') + '<div class="cap"><span class="bl" style="font-size:32px;color:#efe9dc">' + esc(pr.name) + '</span><span class="sc" style="font-size:13px;color:#9b968b">' + (c ? c.name : '') + ' · ' + tt('úroveň {n}', { n: pr.level }) + '</span></div></div>' + frameHtml(medalTotal(pr.medals || {})) + '</div>' +
        '<div class="slots">' + ['retiazka', 'prsten', 'hodinky', 'auto'].map(slotHtml).join('') + '</div></div>' +
        this.medalRow(pr.medals || {}, false) +
        '<p class="note num" style="text-align:left;color:#b9b4a8;font-size:15px">' + tt('Životy {hp} · zbraň {zbran} · brnenie {brn}', { hp: fmt(pr.hp), zbran: fmt(pr.weapon), brn: fmt(pr.armor) }) + '</p>' +
        '<div style="margin-top:8px;border-top:1px solid var(--line)">' + stats + '</div>' +
        '<div class="sec sc">' + tt('Výbava') + '</div>' + (items || '<p class="p">' + tt('Nemá nasadenú žiadnu výbavu.') + '</p>') +
        '</div>',
    };
  }

  scr_inventory(slot) {
    const p = this.s.p;
    const list = p.inventory.filter((i) => !slot || i.slot === slot)
      .sort((a, b) => SLOTS.findIndex((s) => s.id === a.slot) - SLOTS.findIndex((s) => s.id === b.slot) || b.power - a.power);
    const title = slot ? SLOTS.find((s) => s.id === slot).name : tt('Inventár');
    let h = '';
    for (const it of list) {
      const r = rar(it.rarity);
      const on = p.equipment[it.slot] === it.id;
      h += '<div class="item rar-' + it.rarity + '"><img src="' + art(ITEM_BASES[it.base].art) + '" alt=""><div class="mid"><div class="t">' + this.itemName(it) + (on ? ' <span class="sc gold" style="font-size:13px">· ' + tt('nasadené') + '</span>' : '') + '</div>' +
        '<div class="s"><span style="color:' + r.color + '">' + r.name + '</span> · ' + tt('úr. {n}', { n: it.level }) + ' · ' + SLOTS.find((s) => s.id === it.slot).name + '</div><div class="s" style="color:#c9c4b8">' + this.bonusText(it) + '</div>' + this.descHtml(it) + '</div>' +
        '<div class="acts">' + (on ? '<button class="btn small" data-act="unequip" data-arg="' + it.slot + '">' + tt('Zložiť') + '</button>' : '<button class="btn small gold" data-act="equip" data-arg="' + it.id + '">' + tt('Nasadiť') + '</button>') +
        '<button class="btn small num" data-act="sell" data-arg="' + it.id + '">' + tt('Predať {cena}', { cena: money(Math.round(it.price * 0.25 * (1 + 0.2 * it.upgrade))) }) + '</button></div></div>';
    }
    if (!list.length) h = slot
      ? '<p class="p">' + tt('Nemáš žiadne predmety pre tento slot. Kúp ich v obchodoch na ulici: Zbrane, Oblečenie, Šperky (sever štvrte). Niekedy padnú aj z misií a bossov.') + '</p>'
      : '<p class="p">' + tt('Nemáš žiadne predmety. Kúp ich v obchodoch na ulici: Zbrane, Oblečenie, Šperky (sever štvrte). Niekedy padnú aj z misií a bossov.') + '</p>';
    return { html: this.hdr(title, money(p.cash)) + '<div class="body">' + h + '</div>' };
  }

  scr_missions(giverId) {
    const v = this.s.view();
    const m = this.s.state.mission;
    if (!giverId) {
      const dv = this.s.dailyMap();
      const dn = dv.tasks.filter((t) => t.done).length;
      let h = '<button class="card daily-card" data-act="open" data-arg="daily"><span class="dbadge">D</span><span class="mid"><span class="t">' + tt('Denné misie') + '</span><span class="s">' +
        (dv.done ? tt('Dnes hotovo · nové o polnoci') : tt('{n} / {total} splnené · úlohy na mape', { n: dn, total: dv.tasks.length })) + '</span></span><span class="end"><span class="s">' + tt('deň {n} / 15', { n: this.s.dailyDayNow() }) + '</span></span></button>' +
        (() => { const a = activeEvents(); return a ? '<button class="card" data-act="open" data-arg="events"><span class="dbadge" style="color:#e8c873;border-color:#e8c873">' + EVENTS[a.ids[0]].icon + '</span><span class="mid"><span class="t">' + tt('Víkendový event') + '</span><span class="s">' + a.ids.map((id) => EVENTS[id].name).join(' · ') + '</span></span><span class="end"><span class="s">' + tt('ešte {cas}', { cas: '<span data-until="' + a.until + '"></span>' }) + '</span></span></button>' : ''; })() +
        '<p class="p">' + tt('Misie zadávajú postavy v meste. Hľadaj bielu bublinu „!“ nad hlavou. Každá misia sa končí súbojom.') + '</p>' +
        // the givers of the city you are in
        Object.values(GIVERS).filter((g) => g.city === this.s.city()).map((g) => '<div class="card" style="cursor:default"><img class="ph" src="' + art(g.portrait) + '" alt=""><div class="mid"><span class="t">' + g.name + '</span><span class="s">' + g.where + '</span></div></div>').join('');
      if (v.jailLeft > 0) h += '<p class="warn" style="padding:8px 10px;border:1px solid rgba(168,35,28,.6);color:#e6a49c">' + tt('Si zatknutý. Misie až o {cas}.', { cas: '<b data-until="' + this.s.state.jailUntil + '"></b>' }) + '</p>';
      return { html: this.hdr(tt('Misie'), money(v.cash)) + '<div class="body">' + h + '</div>' };
    }
    const g = GIVERS[giverId];
    // the giver page has two columns on a computer (.split: cards | story and buttons); on a phone the .col divs are plain blocks
    let h = this.hdr(tt('Misie'), money(v.cash)) + '<section class="giver photo"><img src="' + art(g.photo) + '" alt="' + g.name + '" style="object-position:' + g.focus + '"><div class="shade"></div><div class="txt"><span class="bl" style="font-size:34px;color:#efe9dc">' + g.name + '</span><q>' + g.quote + '</q><span class="sc" style="font-size:13px;color:#b9b4a8">' + g.title + '</span></div></section>';
    if (m) {
      const t = MISSIONS[m.tpl];
      const ready = Date.now() >= m.endsAt;
      const story = t.stories[m.v || 0] || t.stories[0];
      h += '<div class="body split"><div class="col"><div class="card sel" style="cursor:default"><img src="' + art(t.art) + '" alt=""><div class="mid"><span class="t">' + t.name + '</span>' + (m.hot ? '<span class="hot">' + tt('Horúca · {n}× odmena', { n: CONFIG.hotReward }) + '</span>' : '') + '<span class="s">' + (m.giver !== giverId ? tt('od: {giver} · na konci súboj: {foe}', { giver: GIVERS[m.giver].name, foe: esc(story.foe.name) }) : tt('na konci súboj: {foe}', { foe: esc(story.foe.name) })) + '</span></div><div class="end"><span class="gold" style="font-size:18px">' + money(m.cash) + '</span><span class="s">' + fmt(m.xp) + ' XP</span></div></div></div><div class="col">';
      h += '<p class="story">' + story.text + '</p>';
      if (ready) {
        h += '<button class="btn gold wide" style="margin-top:6px" data-act="claim">' + tt('Dokončiť misiu · súboj') + '</button>';
      } else {
        h += '<p class="p" style="text-align:center;margin-top:10px">' + tt('Misia beží, hotovo o {cas}', { cas: '<b class="gold num" data-until="' + m.endsAt + '"></b>' }) + '</p>';
        h += '<button class="btn wide" data-act="skip">' + tt('Skrátiť za {n} zlatých tehličiek', { n: this.s.skipCost() }) + '</button>';
        h += '<p class="note">' + tt('Kým misia beží, môžeš sa túlať mestom, nakupovať a bojovať.') + '</p>';
      }
      return { html: h + '</div></div>' };
    }
    const offers = this.s.offers(giverId);
    // a giver of a later city may have nothing for you yet: say from which level
    if (!offers.length) {
      const first = Math.min(...g.pool.map((id) => MISSIONS[id].minLevel));
      h += '<div class="body"><p class="story">' + tt('Zatiaľ pre teba nemám nič, na čo by si stačil. Vráť sa, keď budeš mať úroveň {n}.', { n: first }) + '</p>' +
        '<p class="note">' + tt('Neskôr: {zoznam}', { zoznam: g.pool.map((id) => MISSIONS[id].name + ' (' + tt('úr. {n}', { n: MISSIONS[id].minLevel }) + ')').join(' · ') }) + '</p>';
      return { html: h + '</div>' };
    }
    if (!offers.some((o) => o.tpl === this.sel.offer)) this.sel.offer = offers[0].tpl;
    const sel = offers.find((o) => o.tpl === this.sel.offer);
    h += '<div class="body split"><div class="col">';
    for (const o of offers) {
      const t = MISSIONS[o.tpl];
      const pv = this.s.preview(o.tpl, o.v, o.hot);
      h += '<button class="card' + (o.tpl === this.sel.offer ? ' sel' : '') + (o.hot ? ' hotcard' : '') + '" data-act="offer" data-arg="' + o.tpl + '"><img src="' + art(t.art) + '" alt=""><span class="mid"><span class="t">' + t.name + '</span>' + (o.hot ? '<span class="hot">' + tt('Horúca · {n}× odmena', { n: CONFIG.hotReward }) + '</span>' : '') + '<span class="s num">' + dur(pv.durationMs) + ' · ' + '<span class="red">' + tt('heat +{n} %', { n: pv.heat }) + '</span>' + '</span></span><span class="end"><span class="gold" style="font-size:18px">' + money(pv.cash) + '</span><span class="s">' + fmt(pv.xp) + ' XP</span></span></button>';
    }
    const story = MISSIONS[sel.tpl].stories[sel.v];
    h += '</div><div class="col"><p class="story">' + story.text + '</p>';
    h += '<div class="foe"><img class="ph" src="' + art(story.foe.art) + '" alt=""><span><span class="sc" style="font-size:12px;color:#8a857a">' + tt('Na konci ťa čaká') + '</span><br><b>' + esc(story.foe.name) + '</b> <span class="muted">· ' + esc(story.foe.title) + '</span></span></div>';
    if (sel.hot) {
      const chance = Math.round(this.s.winChance(this.s.missionFoe(story, true)) * 20) * 5;
      h += '<p class="note hotnote">' + tt('Horúca misia: súper je zhruba rovnako silný ako ty, takže môžeš prehrať. Za výhru {n}× peniaze aj XP. Šanca na výhru: asi {sanca} %.', { n: CONFIG.hotReward, sanca: chance }) + '</p>';
    }
    const selPv = this.s.preview(sel.tpl, sel.v, sel.hot);
    const tooHot = v.heat + selPv.heat > CONFIG.heatMax;
    h += this.heatMeter(v.heat, selPv.heat);
    if (v.jailLeft > 0) h += '<p class="note red">' + tt('Si zatknutý, misie až o {cas}.', { cas: '<b data-until="' + this.s.state.jailUntil + '"></b>' }) + '</p>';
    if (tooHot) h += '<p class="note red">' + tt('Na túto misiu máš dnes priveľký heat. Vyber kratšiu, zájdi za právničkou (dnes ešte {n}×) alebo počkaj do polnoci ({cas}).', { n: this.s.lawyerLeft(), cas: '<span data-until="' + this.s.nextDayAt() + '"></span>' }) + '</p>';
    h += '<button class="btn gold wide" style="margin-top:12px" data-act="accept"' + (v.jailLeft > 0 || tooHot ? ' disabled' : '') + '>' + (sel.hot ? tt('Prijať horúcu misiu') : tt('Prijať misiu')) + '</button>';
    h += '<p class="note">' + tt('Heat je tvoj denný limit na misie. Dvíha sa už pri prijatí misie a o polnoci spadne na nulu.') + '</p>';
    if (this.s.p.level < CONFIG.fastUntil) h += '<p class="note gold">' + tt('Rýchly štart do úrovne {n}: misie trvajú len chvíľu a dávajú viac XP.', { n: CONFIG.fastUntil }) + '</p>';
    const locked = g.pool.filter((id) => MISSIONS[id].minLevel > this.s.p.level).sort((a, b) => MISSIONS[a].minLevel - MISSIONS[b].minLevel);
    if (locked.length) h += '<p class="note">' + tt('Neskôr: {zoznam}', { zoznam: locked.map((id) => MISSIONS[id].name + ' (' + tt('úr. {n}', { n: MISSIONS[id].minLevel }) + ')').join(' · ') }) + '</p>';
    return { html: h + '</div></div>' };
  }

  scr_shop(shopId) {
    const sh = this.s.shop(shopId);
    const p = this.s.p;
    const row = (it, where = 'list') => {
      const r = rar(it.rarity);
      const c = this.s.shopPrice(it, where);
      const cur = p.equipment[it.slot] && this.s.item(p.equipment[it.slot]);
      const label = (c.cash ? money(c.cash) : '') + (c.bars ? (c.cash ? '<br>+ ' : '') + tt('{n} tehličiek', { n: c.bars }) : '');
      return '<div class="item rar-' + it.rarity + '"><img src="' + art(ITEM_BASES[it.base].art) + '" alt=""><div class="mid"><div class="t">' + this.itemName(it) + '</div><div class="s"><span style="color:' + r.color + '">' + r.name + '</span> · ' + tt('úr. {n}', { n: it.level }) + '</div><div class="s" style="color:#c9c4b8">' + this.bonusText(it) + '</div>' + this.descHtml(it) + (cur ? '<div class="s">' + tt('Teraz: {bonus}', { bonus: this.bonusText(cur) }) + '</div>' : '') + '</div>' +
        '<div class="acts"><button class="btn small gold num" data-act="buy-item" data-arg="' + it.id + '"' + (p.cash < c.cash || p.chains < c.bars ? ' disabled' : '') + '>' + label + '</button></div></div>';
    };
    let h = '';
    if (this.s.ev().price < 1) h += '<p class="note gold" style="margin-top:0">' + tt('Výpredaj: všetko o {n} % lacnejšie, nový tovar zadarmo.', { n: Math.round((1 - this.s.ev().price) * 100) }) + '</p>';
    if (sh.premium) h += '<div class="sec sc" style="margin-top:0;color:#e8c873">' + tt('Prémiové autá · stále v ponuke') + '</div>' + sh.premium.map((it) => row(it, 'premium')).join('') + '<div class="sec sc">' + tt('Ojazdené autá') + '</div>';
    if (sh.bm) {
      const el = this.s.elixirLeft();
      const evb = this.s.ev();
      h += '<div class="bm"><div class="sec sc" style="margin-top:0;color:#ff6aa8">' + (el > 0 ? tt('Čierny trh · elixír ešte <span data-until="{until}"></span> · len epické kusy', { until: Date.now() + el }) : tt('Čierny trh · {kedy} · len epické kusy', { kedy: evb.bmAll ? tt('celý víkend') : tt('len dnes večer') })) + '</div>' +
        (sh.bm.length ? sh.bm.map((it) => row(it, 'bm')).join('') : '<p class="p">' + tt('Čierny trh je vypredaný.') + '</p>') + '</div>';
    }
    h += '<p class="p" style="font-style:italic">„' + sh.blurb + '“</p>';
    h += sh.list.map((it) => row(it)).join('');
    if (!sh.list.length) h += '<p class="p">' + tt('Všetko vypredané.') + '</p>';
    if (!sh.bm && sh.hasBm) h += '<p class="note" style="color:#ff6aa8">' + tt('Čierny trh: v piatok od {h}:00, len epické kusy. Každý stojí peniaze a {n} zlatých tehličiek.', { h: CONFIG.blackMarketFromHour, n: CONFIG.bmEpicChains }) + (this.s.locked('blackMarket') ? ' ' + tt('Odomyká sa na úrovni {n}.', { n: this.s.locked('blackMarket') }) : '') + '</p>';
    const rc = this.s.rerollCost();
    h += '<button class="btn wide" data-act="shop-reroll" data-arg="' + shopId + '"' + (p.chains < rc ? ' disabled' : '') + '>' + (rc ? tt('Nový tovar hneď · {n} zlatá tehlička', { n: rc }) : tt('Nový tovar hneď · zadarmo')) + '</button>';
    h += '<p class="note">' + tt('Nový tovar o <span data-until="{until}"></span> alebo po novej úrovni.', { until: Date.now() + sh.refreshIn }) + '</p>';
    return { html: this.hdr(sh.name, money(p.cash)) + '<div class="body">' + h + '</div>' };
  }

  scr_upgrade() {
    const p = this.s.p;
    let h = '<button class="card" data-act="open-shop" data-arg="autobazar"><img src="' + art('x_car_hatch') + '" alt=""><span class="mid"><span class="t">' + tt('Autobazár') + '</span><span class="s">' + tt('Auto znižuje heat z misií aj ich čas. Nasadiť ho môžeš od úrovne {n}.', { n: CONFIG.autoUnlockLevel }) + '</span></span></button>';
    h += '<p class="p">' + tt('Mechanik vylepší tvoje nasadené veci. Každé vylepšenie pridá 10 % bonusu, najviac +{n}. Garáž drží tvoj gang.', { n: CONFIG.maxUpgrade }) + '</p>';
    let any = false;
    for (const s of SLOTS) {
      const it = p.equipment[s.id] && this.s.item(p.equipment[s.id]);
      if (!it) continue;
      any = true;
      const max = it.upgrade >= CONFIG.maxUpgrade;
      const cost = this.s.upgradeCost(it.id);
      h += '<div class="item rar-' + it.rarity + '"><img src="' + art(ITEM_BASES[it.base].art) + '" alt=""><div class="mid"><div class="t">' + this.itemName(it) + '</div><div class="s">' + s.name + ' · ' + this.bonusText(it) + '</div></div><div class="acts">' +
        (max ? '<span class="sc gold" style="font-size:14px">' + tt('maximum') + '</span>' : '<button class="btn small gold num" data-act="upgrade" data-arg="' + it.id + '"' + (p.cash < cost ? ' disabled' : '') + '>+1 · ' + money(cost) + '</button>') + '</div></div>';
    }
    if (!any) h += '<p class="p">' + tt('Nemáš nasadené žiadne predmety.') + '</p>';
    return { html: this.hdr(tt('Garáž'), money(p.cash)) + '<div class="body">' + h + '</div>' };
  }

  scr_lawyer() {
    const v = this.s.view();
    const cost = this.s.lawyerCost();
    let h = '<p class="p">' + tt('„Polícia ťa má v hľadáčiku? Za správnu cenu sa papiere stratia.“') + '</p>';
    const left = this.s.lawyerLeft();
    h += this.heatMeter(v.heat, 0);
    h += '<p class="p">' + tt('Heat je tvoj denný limit na misie a sám od seba neklesá. O polnoci spadne na nulu (o <span data-until="{until}"></span>). Od {n} % hrozí po misii razia.', { until: this.s.nextDayAt(), n: CONFIG.raidFrom }) + '</p>';
    h += '<button class="btn gold wide num" data-act="lawyer"' + (v.cash < cost || v.heat <= 0 || left <= 0 ? ' disabled' : '') + '>' + tt('Znížiť heat o {n} % · {cena}', { n: CONFIG.lawyerHeat, cena: money(cost) }) + '</button>';
    h += '<p class="note">' + (this.s.ev().lawyerUnlimited ? '<span class="gold">' + tt('Amnestia: za polovicu a bez denného limitu.') + '</span>' : left > 0 ? tt('Dnes ešte {n} z {total}.', { n: left, total: CONFIG.lawyerPerDay }) : tt('Dnes už nie. Ďalšie {total} o polnoci.', { total: CONFIG.lawyerPerDay })) + '</p>';
    return { html: this.hdr(tt('Právnička'), money(v.cash)) + '<div class="body">' + h + '</div>' };
  }

  scr_boss() {
    const info = this.s.bossInfo();
    if (info.done) return { html: this.hdr(tt('Boss fights')) + '<div class="body"><p class="p">' + tt('Všetci bossovia {place} sú porazení.', { place: tts(info.lineName) }) + ' ' + (this.s.city() === 'mesto1' ? tt('Zo stanice sa dá odísť do Mesta 2, ak máš úroveň {n}.', { n: CONFIG.unlock.mesto2 }) : tt('Ďalšie mesto príde neskôr.')) + '</p></div>' };
    const f = info.fighter, me = this.s.playerFighter();
    const b = info.boss;
    let scene;
    if (b.wide) scene = '<img class="bg full" src="' + art(b.wide) + '" alt="' + b.name + '" style="object-position:' + (b.focus || '50% 30%') + '">';
    else if (b.art) scene = '<img class="bg" src="' + this.fightBg() + '" alt=""><img class="fb" src="' + art(b.art) + '" alt="' + b.name + '">';
    else scene = '<img class="bg" src="' + this.fightBg() + '" alt=""><img class="fb" src="' + art('photo_zlodej') + '" alt="" style="filter:brightness(0) drop-shadow(0 0 1px #6b675f)">';
    let h = '<div class="stage">' + scene + '<div class="fade-t"></div><div class="fade-b"></div>' +
      '<div class="title" style="align-items:flex-start;left:16px;' + (b.titleLow ? 'top:auto;bottom:14px' : 'top:60px') + '"><span class="sc" style="font-size:14px;color:#b9b4a8">' + tt('Boss {n} / {total}', { n: info.index + 1, total: info.total }) + '</span><span class="bl" style="font-size:46px;font-weight:900;color:#efe9dc;text-shadow:0 3px 0 #000">' + info.boss.name + '</span><span class="sc" style="font-size:14px;color:#e05a4f;text-shadow:0 1px 2px #000,0 0 8px #000,0 0 12px #000">' + info.boss.title + '</span></div></div>';
    h += '<div class="body"><div class="hpgrid" style="padding:0">' +
      '<div><div class="top"><span class="bl">' + tt('Ty') + '</span><span class="num muted" style="font-size:14px">' + tt('úr. {n}', { n: me.level }) + '</span></div><p class="note num" style="text-align:left;margin:0">' + tt('Životy {hp}<br>Úder {dmg}', { hp: fmt(me.hp), dmg: Math.round(F.hitOf(me)) }) + '</p></div>' +
      '<div><div class="top"><span class="bl">' + info.boss.name + '</span><span class="num muted" style="font-size:14px">' + tt('úr. {n}', { n: f.level }) + '</span></div><p class="note num" style="text-align:left;margin:0">' + tt('Životy {hp}<br>Úder {dmg}', { hp: fmt(f.hp), dmg: Math.round(F.hitOf(f)) }) + '</p></div></div>';
    // how often you would win with what you wear now (200 test fights), so nobody walks into a hopeless fight
    const chance = Math.round(this.s.winChance(f) * 20) * 5;
    h += '<p class="chance num ' + (chance < 25 ? 'red' : 'gold') + '">' + (chance === 0 ? tt('Šanca na výhru: takmer žiadna') : chance === 100 ? tt('Šanca na výhru: takmer istá') : tt('Šanca na výhru: asi {n} %', { n: chance })) + '</p>' +
      (chance < 25 ? '<p class="note">' + tt('Najprv zosilnej: misie, body v Posilňovni a lepšia výbava v obchodoch.') + '</p>' : '');
    const legendPct = Math.round(Math.max(CONFIG.legendaryBossChance, this.s.ev().legendBoss || 0) * 100);
    h += '<p class="note num" style="color:#b9b4a8;font-size:15px">' + tt('Odmena: <span class="gold">{cash} · {xp} XP{bars}</span> · predmet: {drop}', {
      cash: money(info.reward.cash), xp: fmt(info.reward.xp), bars: info.reward.bars ? ' · ' + tt('{n} tehl.', { n: info.reward.bars }) : '',
      drop: info.index === 0 && this.s.city() === 'mesto1' ? tt('<span style="color:#ff6aa8">istý epický</span> (prvý boss)') : tt('{epic} % epický, {legend} % legendárny', { epic: Math.round(CONFIG.bossEpicChance * 100), legend: legendPct }),
    }) + '</p>';
    h += info.hunt ? '<button class="btn gold wide" style="margin-top:10px" data-act="boss-fight">' + tt('Bojovať · Hon na bossov, bez čakania') + '</button>'
      : info.free ? '<button class="btn gold wide" style="margin-top:10px" data-act="boss-fight">' + tt('Bojovať · pokus zadarmo') + '</button>'
      : '<button class="btn gold wide" style="margin-top:10px" data-act="boss-fight"' + (info.paidLeft ? '' : ' disabled') + '>' + tt('Bojovať za {n} zlatých tehličiek', { n: CONFIG.bossRetryChains }) + '</button><p class="note">' +
        (info.paidLeft ? tt('Platené pokusy dnes: {left} / {max}.', { left: info.paidLeft, max: CONFIG.bossPaidPerDay }) : tt('Platené pokusy sú na dnes minuté.')) + ' ' + tt('Ďalší pokus zadarmo o <span data-until="{until}"></span>', { until: info.freeAt }) + '</p>';
    h += '<div class="sec sc">' + tt('Línia bossov {place}', { place: tts(info.lineName) }) + '</div><div class="boss-list">' + info.line.map((b, i) => '<span class="' + (i < info.index ? 'done' : i === info.index ? 'now' : '') + '">' + (i <= info.index ? b.name : '?') + '</span>').join('') + '</div>';
    h += '<p class="note">' + tt('Do tímu si môžeš zobrať 1–2 členov gangu (príde s gangmi).') + '</p></div>';
    return { html: this.hdr(tt('Boss fights'), money(this.s.p.cash)) + h };
  }

  // the station: every city, where you are, what still keeps one closed
  scr_travel() {
    const here = this.s.city();
    let h = '<p class="p">' + tt('Taxík alebo električka ťa odvezie do iného mesta. Kým ťa naháňa polícia alebo sedíš v skrýši, nikam sa nejde.') + '</p>';
    for (const [id, c] of Object.entries(CITIES)) {
      const lock = this.s.travelLock(id);
      const act = id === here ? '<span class="s gold">' + tt('Tu si') + '</span>'
        : lock ? '<span class="s red">' + tt('Zamknuté') + '</span>'
          : '<button class="btn small gold" data-act="travel" data-arg="' + id + '">' + tt('Cestovať') + '</button>';
      h += '<div class="grow"><span class="mid"><span class="t">' + c.name + '</span><span class="s">' + c.blurb + '</span>' + (lock && id !== here ? '<span class="s red">' + tts(lock) + '</span>' : '') + '</span>' + act + '</div>';
    }
    return { html: this.hdr(tt('Cestovať')) + '<div class="body">' + h + '</div>' };
  }

  // Podzemné zápasy: the next fighter of the ladder, the clock to the next fight, milestones ahead
  scr_club() {
    if (this.s.locked('club')) return this.lockedScr(tt('Podzemné zápasy'), 'club', tt('Pivnica pod klubom, kde sa bije o peniaze a meno. Sto súperov, každý silnejší ako ten pred ním.'));
    const info = this.s.clubInfo();
    const hdr = this.hdr(tt('Podzemné zápasy'), money(this.s.p.cash));
    if (info.done) return { html: hdr + '<div class="body"><p class="p">' + tt('Porazil si všetkých {total} súperov. V pivnici pod klubom už nie je nikto, kto by sa ti postavil.', { total: info.total }) + '</p></div>' };
    const f = info.fighter, me = this.s.playerFighter(), rw = info.reward;
    let h = '<div class="stage"><img class="bg full" src="' + art(f.portrait) + '" alt="' + esc(f.name) + '" style="object-position:50% 25%">' +
      '<div class="fade-t"></div><div class="fade-b"></div>' +
      '<div class="title" style="align-items:flex-start;left:16px;top:60px"><span class="sc" style="font-size:14px;color:#b9b4a8">' + tt('Poschodie {n} / {total}', { n: info.floor, total: info.total }) + '</span><span class="bl" style="font-size:42px;font-weight:900;color:#efe9dc;text-shadow:0 3px 0 #000">' + esc(f.name) + '</span><span class="sc" style="font-size:14px;color:#e05a4f;text-shadow:0 1px 2px #000,0 0 8px #000">' + esc(f.title) + '</span></div></div>';
    h += '<div class="body"><div class="hpgrid" style="padding:0">' +
      '<div><div class="top"><span class="bl">' + tt('Ty') + '</span><span class="num muted" style="font-size:14px">' + tt('úr. {n}', { n: me.level }) + '</span></div><p class="note num" style="text-align:left;margin:0">' + tt('Životy {hp}<br>Úder {dmg}', { hp: fmt(me.hp), dmg: Math.round(F.hitOf(me)) }) + '</p></div>' +
      '<div><div class="top"><span class="bl">' + esc(f.name) + '</span><span class="num muted" style="font-size:14px">' + tt('úr. {n}', { n: f.level }) + '</span></div><p class="note num" style="text-align:left;margin:0">' + tt('Životy {hp}<br>Úder {dmg}', { hp: fmt(f.hp), dmg: Math.round(F.hitOf(f)) }) + '</p></div></div>';
    const extra = (rw.bars ? ' · ' + tt('{n} tehl.', { n: rw.bars }) : '') + (rw.item === 'legendarny' ? ' · ' + tt('legendárny predmet') : rw.item === 'epicky' ? ' · ' + tt('epický predmet') : '');
    h += '<p class="note num" style="color:#b9b4a8;font-size:15px">' + tt('Odmena za výhru: <span class="gold">{cash} · {xp} XP{extra}</span>', { cash: money(rw.cash), xp: fmt(rw.xp), extra: extra }) + '</p>';
    h += info.ready ? '<button class="btn gold wide" style="margin-top:10px" data-act="club-fight">' + tt('Nastúpiť do ringu') + '</button>'
      : '<button class="btn gold wide" style="margin-top:10px" disabled>' + tt('Ďalší zápas o <span data-until="{until}"></span>', { until: info.nextAt }) + '</button>';
    // the next milestones on the ladder
    const next = [];
    for (let n = info.floor; n <= info.total && next.length < 3; n++) {
      if (n === info.total) next.push(n + ': ' + tt('legendárny predmet'));
      else if (n % CONFIG.clubEpicEvery === 0) next.push(n + ': ' + (n % CONFIG.clubBarsEvery === 0 ? tt('epický predmet a {n} tehl.', { n: CONFIG.clubBars }) : tt('epický predmet')));
      else if (n % CONFIG.clubBarsEvery === 0) next.push(n + ': ' + tt('{n} tehličiek', { n: CONFIG.clubBars }));
    }
    h += '<div class="sec sc">' + tt('Poschodia s odmenou navyše') + '</div><p class="note" style="text-align:left">' + next.join(' · ') + '</p>';
    h += '<p class="note">' + tt('Jeden zápas za {n} minút, vyhraný aj prehraný. Prehra ťa nevráti späť. Poradie nájdeš v Sieni slávy.', { n: CONFIG.clubCooldownMin }) + '</p></div>';
    return { html: this.hdr(tt('Podzemné zápasy'), money(this.s.p.cash)) + h };
  }

  // every police term on one screen (a tap on the heat bar or the stars opens it)
  scr_policehelp() {
    const C = CONFIG;
    const row = (t, s) => '<div><b>' + t + '</b><span>' + s + '</span></div>';
    const h = '<p class="p">' + tt('Polícia má dve oddelené strany: <b class="gold">heat</b> sleduje len tvoje misie počas dňa, <b class="gold">hviezdy</b> sú naháňačka na ulici za všetko ostatné. Jedno druhé neovplyvňuje.') + '</p>' +
      '<div class="help-list">' +
      row(tt('Heat'), tt('Denný limit na misie. Zdvihne ho iba misia, nič na ulici. Keď je plný, misie od Dona a Dílera na dnes končia. O polnoci spadne na nulu. Auto ho znižuje.')) +
      row(tt('Razia'), tt('Od {n} % heatu ťa po misii môže čakať razia: pokuta {fine} peňazí alebo {min} minút v base.', { n: C.raidFrom, fine: pct(C.raidFinePct), min: C.jailMinutes })) +
      row(tt('Právnička'), tt('Zníži heat o {n} %, najviac {max}-krát za deň. Platí sa peniazmi.', { n: C.lawyerHeat, max: C.lawyerPerDay })) +
      row(tt('Hviezdy'), tt('Hľadanosť na ulici. Pribúdajú za všetko mimo misií: streľbu, bitku, autá, výbuchy, policajtov, graffiti, útok gangu aj útek z kontroly. Od {n} hviezd ťa naháňajú policajti. Keď ťa nevidia, každých {sec} s stratíš hviezdu.', { n: C.wantedChase, sec: C.wantedLoseSec })) +
      row(tt('Kontrola'), tt('Keď ťa policajt chytí, vyberieš si: utiecť (šanca podľa Obratnosti), podplatiť (Charizma zlacňuje) alebo sa vzdať ({min} minút bez misií). Potom máš {peace} minút pokoj.', { min: C.jailMinutes, peace: Math.round(C.caughtPeaceSec / 60) })) +
      row(tt('Zložený policajt'), tt('Každý zložený policajt zdvojnásobí, koľko ich po tebe ide. Môže z neho padnúť epický predmet ({chance}, najviac {max} za deň). Ak ťa potom chytia, prídeš o {share} peňazí alebo máš {hours} bez misií.', { chance: pct(C.copEpicChance), max: C.copEpicPerDay, share: pct(C.killCashShare), hours: hours(C.killJailMin) })) +
      row(tt('Basa'), tt('Kým si v base, nedostaneš misie od Dona a Dílera. Denné misie na mape robiť môžeš.')) +
      row(tt('Skrýša a tieň'), tt('Keď ťa hľadajú, schovaj sa v skrýši na {min} minút. Hviezdy zmiznú a ďalších {shadow} minút si v tieni: polícia ťa nenaháňa.', { min: C.hideMin, shadow: C.shadowMin })) +
      '</div>';
    return { html: this.hdr(tt('Ako funguje polícia')) + '<div class="body">' + h + '</div>' };
  }

  // a feature the player has not reached yet: what it is and from which level
  lockedScr(title, feature, text) {
    return { html: this.hdr(title) + '<div class="body"><div class="locked-scr"><span class="sc">' + tt('Zamknuté') + '</span><span class="bl">' + tt('Od úrovne {n}', { n: this.s.locked(feature) }) + '</span><p>' + text + '</p><p class="note">' + tt('Teraz máš úroveň {n}. Úrovne získaš za misie, denné misie a bossov.', { n: this.s.p.level }) + '</p></div></div>' };
  }

  scr_arena() {
    if (this.s.locked('arena')) return this.lockedScr(tt('Aréna'), 'arena', tt('V aréne sa biješ s inými hráčmi o body v rebríčku. Najprv sa trochu otrkaj na misiách.'));
    const a = this.s.arena();
    let h = '<p class="p num">' + tt('Súboje prebehnú automaticky podľa statov a výbavy.') + ' ' + (a.freeLeft < CONFIG.pvpFreePerHour
      ? tt('Zadarmo ešte <span class="gold">{left} z {max}</span>, obnova o <span data-until="{until}"></span>.', { left: a.freeLeft, max: CONFIG.pvpFreePerHour, until: a.windowEnds })
      : tt('Zadarmo ešte <span class="gold">{left} z {max}</span>.', { left: a.freeLeft, max: CONFIG.pvpFreePerHour })) + ' ' + (this.s.online ? tt('Súperi s hviezdičkou sú skutoční hráči.') : tt('Súperi sú zatiaľ počítačoví.')) + '</p>';
    a.opponents.forEach((o, i) => {
      const hp = F.maxHp(o.stats, o.level, o.cls);
      h += '<div class="card" style="cursor:default"><img src="' + art(BOT_ART[o.cls] || 'photo_zlodej') + '" alt="" style="object-fit:cover;object-position:' + (BOT_FOCUS[o.cls] || '50% 20%') + ';background:#1a1714"><span class="mid"><span class="t">' + esc(o.name) + (o.id ? ' <span class="gold">★</span>' : '') + '</span><span class="s num">' + CLASSES[o.cls].name + ' · ' + tt('úr. {n}', { n: o.level }) + ' · ' + tt('{n} b.', { n: fmt(o.points) }) + '</span><span class="s num">' + tt('Životy {hp} · úder {dmg}', { hp: fmt(hp), dmg: Math.round(F.hitOf(o)) }) + '</span></span>' +
        '<button class="btn small gold" data-act="arena-fight" data-arg="' + i + '">' + (a.freeLeft > 0 ? tt('Vyzvať') : tt('Vyzvať · {n}', { n: CONFIG.pvpExtraChains })) + '</button></div>';
    });
    if (this.s.online) h += '<button class="btn wide" data-act="arena-new">' + tt('Noví súperi') + '</button>';
    h += '<div class="sec sc">' + tt('Rebríček · sezóna 1') + '</div><ol class="ladder">' + a.ladder.slice(0, 12).map((r, i) => '<li class="' + (r.me ? 'me' : '') + '"><span>' + (i + 1) + '. ' + esc(r.name) + '</span><span class="num">' + fmt(r.points) + '</span></li>').join('') + '</ol>';
    const myRank = a.ladder.findIndex((r) => r.me) + 1;
    if (myRank > 12) h += '<p class="note gold">' + tt('Ty: {rank}. miesto · {points} b.', { rank: myRank, points: fmt(a.points) }) + '</p>';
    h += '<p class="note">' + tt('Výhry {wins} · prehry {losses}', { wins: a.wins, losses: a.losses }) + '</p>';
    return { html: this.hdr(tt('Aréna'), tt('{n} b.', { n: fmt(a.points) })) + '<div class="body">' + h + '</div>' };
  }

  scr_wexler() {
    const p = this.s.p, rp = this.s.reaper();
    const top = '<section class="giver photo"><img src="' + art('photo_wexler') + '" alt="Wexler" style="object-position:50% 42%"><div class="shade"></div><div class="txt"><span class="bl" style="font-size:34px;color:#efe9dc">Wexler</span><q>' + tt('Zlato nikdy nestráca hodnotu. Na rozdiel od ľudí.') + '</q><span class="sc" style="font-size:13px;color:#b9b4a8">' + tt('Zlaté tehličky') + '</span></div></section>';
    let h = rp.active
      ? '<p class="warn" style="padding:8px 10px;border:1px solid rgba(208,71,61,.6);color:#e6a49c">' + tt('Ripper mi práve ukradol tehličku! Chyť ho do <b data-until="{until}"></b> a je tvoja.', { until: rp.until }) + '</p>'
      : '<p class="note" style="text-align:left">' + tt('Ripper sa sem chodí kradnúť približne raz za hodinu. Ďalší pokus o <span data-until="{until}"></span>.', { until: rp.nextAt }) + '</p>';
    h += '<div class="sec sc">' + tt('Zlaté tehličky') + '</div>';
    // online the packs are sold through Stripe once the pay function says so (pay/status); offline it is a test purchase
    const pay = this.s.online ? this.s.payInfo() : { ready: true };
    if (!pay) {
      h += '<p class="note" style="text-align:left">' + tt('Načítavam ponuku…') + '</p>';
      this.s.payStatus().then(() => { if (this.name === 'wexler') this.render(); });
    } else if (!pay.ready) h += '<p class="note" style="text-align:left">' + tt('Zlaté tehličky sa zatiaľ nepredávajú. Získaš ich v misiách, od bossov, za denné úlohy a za medaily.') + '</p>';
    else CONFIG.barPacks.forEach((pk, i) => {
      h += '<div class="item rar-legendarny"><img class="px" src="assets/icons/i_bar.png" alt="" style="width:48px;height:48px;margin:8px"><div class="mid"><div class="t num">' + tt('{n} zlatých tehličiek', { n: fmt(pk.bars) }) + '</div><div class="s">' + tt('Skracovanie misií, ďalšie pokusy na bossov a v aréne') + '</div></div>' +
        '<div class="acts"><button class="btn small gold num" data-act="' + (this.s.online ? 'pay-bars' : 'buy-bars') + '" data-arg="' + i + '">' + euro(pk.cents) + '</button></div></div>';
    });
    if (!this.s.online) h += '<p class="note">' + tt('Testovacia kúpa (len offline): tehličky sa pripíšu hneď.') + '</p>';
    else if (pay && pay.ready) {
      if (pay.test) h += '<p class="note gold">' + tt('Testovací režim: platí sa len testovacou kartou Stripe, nič sa nestrhne.') + '</p>';
      h += '<p class="note">' + tt('Ceny sú konečné. Platbu spracúva Stripe, údaje o karte nevidíme. Tehličky sa pripíšu hneď po zaplatení, preto pri nich nemožno odstúpiť od zmluvy. <a href="{url}" target="_blank" rel="noopener">Podmienky</a>', { url: legal('podmienky') }) + '</p>';
    }
    // the elixir: Black Market (epic goods) in every shop for elixirHours, only for this player
    const left = this.s.elixirLeft();
    h += '<div class="sec sc">' + tt('Elixír Čierneho trhu') + '</div>' +
      '<div class="item rar-epicky"><img src="' + art('x_elixir_bm') + '" alt=""><div class="mid"><div class="t">' + tt('Elixír Čierneho trhu') + '</div>' +
      '<div class="s">' + tt('Na {n} hodín ti otvorí Čierny trh vo všetkých obchodoch. Epické kusy ťa čakajú hocikedy, nielen v piatok večer.', { n: CONFIG.elixirHours }) + '</div>' +
      (left > 0 ? '<div class="s gold">' + tt('Účinkuje ešte <b data-until="{until}"></b>. Ďalší elixír čas predĺži.', { until: Date.now() + left }) + '</div>' : '') +
      (this.s.locked('blackMarket') ? '<div class="s red">' + tt('Čierny trh sa odomyká na úrovni {n}.', { n: this.s.locked('blackMarket') }) + '</div>' : '') +
      '<div class="desc">' + tt('Čierny ako noc, zapečatený pešiakom. Kto sa napije, nájde dvere, ktoré ostatní nevidia.') + '</div></div>' +
      '<div class="acts"><button class="btn small gold num" data-act="buy-elixir"' + (p.chains < CONFIG.elixirChains || this.s.locked('blackMarket') ? ' disabled' : '') + '>' + tt('{n} tehličiek', { n: CONFIG.elixirChains }) + '</button></div></div>';
    return { html: this.hdr('Wexler', tt('<span class="gold">{n}</span> tehličiek', { n: fmt(p.chains) })) + top + '<div class="body">' + h + '</div>' };
  }

  scr_settings() {
    const on = this.s.hasSave() && this.s.state.settings.testMode;
    const onOff = (x) => (x ? tt('Zapnutý') : tt('Vypnutý'));
    let h = '<div class="switch"><span>' + tt('Jazyk') + '<br><small class="muted" style="font-size:14px">' + LANGS.map((l) => l.name).join(' · ') + '</small></span>' + this.langPicker() + '</div>';
    h += this.s.hasSave() ? '<div class="switch"><span>' + tt('Nahlásiť chybu') + '<br><small class="muted" style="font-size:14px">' + tt('Niečo nefunguje alebo vyzerá zle? Napíš nám.') + '</small></span>' + '<button class="btn small gold" data-act="bug-open">' + tt('Nahlásiť') + '</button>' + '</div>' : '';
    h += '<div class="switch"><span>' + tt('Zvuk') + '<br><small class="muted" style="font-size:14px">' + tt('Údery, výstrely, peniaze, korisť. Platí pre toto zariadenie.') + '</small></span>' + '<button class="btn small ' + (sound.on ? 'gold' : '') + '" data-act="sound-toggle">' + onOff(sound.on) + '</button>' + '</div>';
    if (this.s.hasSave()) {
      const tips = this.tipsOn(), tut = this.s.tutorial ? this.s.tutorial() : null;
      h += '<div class="switch"><span>' + tt('Návod a ciele na mape') + '<br><small class="muted" style="font-size:14px">' + tt('Riadok pod lištou a šípka k cieľu. Splnený cieľ sa ukáže vždy, aby si neprišiel o odmenu.') + '</small></span>' + '<button class="btn small ' + (tips ? 'gold' : '') + '" data-act="tips-toggle">' + (tips ? tt('Zapnuté') : tt('Vypnuté')) + '</button>' + '</div>';
      if (tut && tut.id !== 'finish') h += '<div class="switch"><span>' + tt('Návod pre nováčikov') + '<br><small class="muted" style="font-size:14px">' + tt('Krok {n} z {total}. Preskočený návod nedá odmenu.', { n: tut.step + 1, total: tut.total }) + '</small></span>' + '<button class="btn small" data-act="tut-skip">' + tt('Preskočiť') + '</button>' + '</div>';
    }
    if (this.s.online) {
      if (this.s.loggedIn()) h += '<div class="switch"><span>' + tt('Účet') + '<br><small class="muted" style="font-size:14px">' + esc(this.s.email()) + '</small></span>' + '<button class="btn small" data-act="logout">' + tt('Odhlásiť') + '</button>' + '</div>';
      if (this.s.hasSave()) h += '<div class="switch"><span>' + tt('Postava') + '<br><small class="muted" style="font-size:14px">' + tt('Uložená na serveri.') + '</small></span>' + '<button class="btn small" data-act="reset">' + tt('Zmazať') + '</button>' + '</div>';
      if (this.s.loggedIn()) h += '<div class="switch"><span>' + tt('Zmazať účet') + '<br><small class="muted" style="font-size:14px">' + tt('Zmaže postavu, e-mail aj heslo. Nedá sa to vrátiť.') + '</small></span>' + '<button class="btn small danger" data-act="account-delete">' + tt('Zmazať účet') + '</button>' + '</div>';
      h += '<p class="note" style="margin-top:20px">Hits &amp; Licks · beta<br>' + '<a href="' + legal('podmienky') + '" target="_blank" rel="noopener">' + tt('Podmienky používania') + '</a> · <a href="' + legal('sukromie') + '" target="_blank" rel="noopener">' + tt('Ochrana osobných údajov') + '</a>' + '</p>';
      return { html: this.hdr(tt('Nastavenia')) + '<div class="body">' + h + '</div>' };
    }
    if (this.s.hasSave()) {
      h += '<div class="switch"><span>' + tt('Testovací režim') + '<br><small class="muted" style="font-size:14px">' + tt('Čas beží 60× rýchlejšie: misie, heat, bossovia, obchody.') + '</small></span>' + '<button class="btn small ' + (on ? 'gold' : '') + '" data-act="test-mode">' + onOff(on) + '</button>' + '</div>';
      const bm = this.s.state.settings.blackMarket;
      h += '<div class="switch"><span>' + tt('Čierny trh vždy otvorený') + '<br><small class="muted" style="font-size:14px">' + tt('Na testovanie. Normálne len v piatok od {h}:00.', { h: CONFIG.blackMarketFromHour }) + '</small></span>' + '<button class="btn small ' + (bm ? 'gold' : '') + '" data-act="test-bm">' + onOff(bm) + '</button>' + '</div>';
      h += '<div class="switch"><span>' + tt('Uložená hra') + '<br><small class="muted" style="font-size:14px">' + tt('Ukladá sa v tomto prehliadači.') + '</small></span>' + '<button class="btn small" data-act="reset">' + tt('Zmazať') + '</button>' + '</div>';
    }
    h += '<p class="note" style="margin-top:20px">Hits &amp; Licks · beta (offline)<br>' + '<a href="' + legal('podmienky') + '" target="_blank" rel="noopener">' + tt('Podmienky používania') + '</a> · <a href="' + legal('sukromie') + '" target="_blank" rel="noopener">' + tt('Ochrana osobných údajov') + '</a>' + '</p>';
    return { html: this.hdr(tt('Nastavenia')) + '<div class="body">' + h + '</div>' };
  }

  // ---------------------------------------------------------------- gangs
  // ---------------------------------------------------------------- character look (layers from js/looks.js)
  // the chosen item id of a part; parts never picked get their first option (optional parts: nothing)
  lookPick(look, part) {
    const v = look ? look[part.id] : undefined;
    if (v === null && part.optional) return null;
    if (part.items.some((i) => i.id === v)) return v;
    return part.optional ? null : part.items[0].id;
  }

  lookHtml(look, cls = '') {
    const picked = {};
    for (const part of LOOK_PARTS) {
      const id = this.lookPick(look, part);
      const it = id && part.items.find((i) => i.id === id);
      if (it) picked[part.id] = it;
    }
    // flags from tools/looks.ps1: a hat covers the head (no hair under it, nothing gets cut off);
    // "under: part" draws an extra below that part (neck tattoo / chain under the beard, earrings under the hair)
    const hideHair = Object.values(picked).some((it) => it.hideHair);
    const unders = Object.values(picked).filter((it) => it.under);
    const srcs = LOOK_BASE ? [LOOK_BASE] : [];
    for (const part of LOOK_PARTS) {
      unders.filter((it) => it.under === part.id).forEach((it) => srcs.push(it.src));
      const it = picked[part.id];
      if (!it || it.under || (part.id === 'ucesy' && hideHair)) continue;
      srcs.push(it.src);
    }
    return '<div class="look ' + cls + '">' + srcs.map((s) => '<img src="' + s + '" alt="">').join('') + '</div>';
  }

  scr_look() {
    const p = this.s.p;
    if (!this.sel.look) this.sel.look = { ...(p.look || {}) };
    const look = this.sel.look;
    let h = this.lookHtml(look, 'big');
    for (const part of LOOK_PARTS) {
      const id = this.lookPick(look, part);
      const opts = (part.optional ? [null] : []).concat(part.items.map((i) => i.id));
      const it = id && part.items.find((i) => i.id === id);
      h += '<div class="lookrow"><button class="btn small" data-act="look-step" data-arg="' + part.id + ':-1" aria-label="' + tt('Predchádzajúce') + '">‹</button>' +
        '<span class="mid"><span class="sc">' + part.name + '</span><b>' + (it ? esc(it.name) : tt('nič')) + '</b><small class="num">' + (opts.indexOf(id) + 1) + ' / ' + opts.length + '</small></span>' +
        '<button class="btn small" data-act="look-step" data-arg="' + part.id + ':1" aria-label="' + tt('Ďalšie') + '">›</button></div>';
    }
    h += '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn wide" data-act="look-random">' + tt('Náhodne') + '</button><button class="btn gold wide" data-act="look-save">' + tt('Uložiť') + '</button></div>';
    h += '<p class="note">' + tt('Ďalšie časti (pleť, ústa, brada, čiapky…) sa tu objavia, keď pribudnú ich vrstvy.') + '</p>';
    return { html: this.hdr(tt('Vzhľad')) + '<div class="body">' + h + '</div>' };
  }

  tagBox(o) {
    return o ? '<span class="gtag" style="border-color:' + o.color + ';color:' + o.color + '">' + esc(o.tag) + '</span>' : '<span class="gtag free">—</span>';
  }

  turfCard(v) {
    const o = v.owner;
    return '<button class="card turf' + (o && o.mine ? ' mine' : '') + '" data-act="turf" data-arg="' + v.id + '">' + this.tagBox(o) +
      '<span class="mid"><span class="t">' + esc(v.name) + '</span><span class="s">' + v.kindInfo.text + '</span>' +
      '<span class="s">' + (o ? '<span style="color:' + o.color + '">' + esc(o.name) + '</span> · ' + tt('obrana {p}', { p: pct(v.strength) }) : tt('Voľný, stačí ho obsadiť')) + '</span></span></button>';
  }

  fighterRow(f, extra = '') {
    return '<div class="grow"><span class="mid"><span class="t">' + esc(f.name) + '</span><span class="s num">' + CLASSES[f.cls].name + ' · ' + tt('úr. {n}', { n: f.level }) + ' · ' + tt('životy {n}', { n: fmt(f.hp) }) + ' · ' + tt('úder {n}', { n: Math.round(F.hitOf(f)) }) + '</span></span>' + extra + '</div>';
  }

  // the gang: without one, found a gang or ask to join one; in one, members, requests, treasury, upgrades, city
  scr_gang() {
    const g = this.s.gang(), p = this.s.p;
    if (!g && this.s.locked('gang')) return this.lockedScr('Gang', 'gang', tt('Gang je tvoj cech: s ostatnými hráčmi držíte objekty v meste a bojujete o územie. Do gangu sa dá vstúpiť alebo ho založiť, keď ťa už v meste poznajú.'));
    const turf = this.s.turfView();
    const here = this.s.city();
    const turfList = '<div class="sec sc">' + tt('Územie: {mesto}', { mesto: CITIES[here].name }) + '</div>' + turf.filter((v) => v.city === here).map((v) => this.turfCard(v)).join('') +
      turf.filter((v) => v.city !== here && v.owner && v.owner.mine).map((v, i) => (i ? '' : '<div class="sec sc">' + tt('Držíte aj inde') + '</div>') + this.turfCard(v)).join('');
    if (!g) {
      const cost = this.s.gangCreateCost();
      const col = this.sel.gangColor || 'gold';
      const inbox = this.s.gangInbox();
      let h = '<p class="p">' + tt('Gang je tvoj cech. Spolu s ostatnými hráčmi držíte objekty v meste a kým ich držíte, celý gang má ich bonus. Ostatné gangy aj počítačoví rivali vám ich budú chcieť zobrať.') + '</p>';
      if (inbox.invites.length) {
        h += '<div class="sec sc">' + tt('Pozvánky') + '</div>' + inbox.invites.map((i) => '<div class="grow">' + this.tagBox(i) + '<span class="mid"><span class="t">' + esc(i.name) + '</span><span class="s">' + tt('ťa pozýva do gangu') + '</span></span>' +
          '<button class="btn small gold" data-act="gang-accept" data-arg="' + i.id + '">' + tt('Vstúpiť') + '</button><button class="btn small" data-act="gang-decline" data-arg="' + i.id + '">' + tt('Nie') + '</button></div>').join('');
      }
      h += '<div class="sec sc">' + tt('Gangy v meste') + '</div>';
      const list = this.sel.gangList;
      if (!list) h += '<p class="note">' + tt('Načítavam…') + '</p>';
      else if (!list.length) h += '<p class="note">' + tt('Zatiaľ tu nie je žiadny gang. Založ prvý.') + '</p>';
      else h += list.map((x) => {
        const asked = inbox.requests.includes(x.id), full = x.members >= CONFIG.gangSlots;
        return '<div class="grow">' + this.tagBox(x) + '<span class="mid"><span class="t">' + esc(x.name) + '</span><span class="s num">' + tt('{n} / {slots} členov', { n: x.members, slots: CONFIG.gangSlots }) + ' · ' + tt('{n} výhier', { n: x.wins }) + (x.leaderName ? ' · ' + tt('šéf {meno}', { meno: esc(x.leaderName) }) : '') + '</span></span>' +
          (asked ? '<button class="btn small" data-act="gang-unask" data-arg="' + x.id + '">' + tt('Zrušiť žiadosť') + '</button>' : '<button class="btn small gold" data-act="gang-ask" data-arg="' + x.id + '"' + (full ? ' disabled' : '') + '>' + (full ? tt('Plný') : tt('Požiadať')) + '</button>') + '</div>';
      }).join('');
      if (!this.s.online) h += '<p class="note">' + tt('Offline hra: ostatné gangy uvidíš po prihlásení.') + '</p>';
      h += '<div class="sec sc">' + tt('Založiť vlastný gang') + '</div>';
      h += '<div class="field"><label for="gang-name">' + tt('Meno gangu') + '</label><input id="gang-name" maxlength="20" placeholder="' + tt('napr. Nočné Mory') + '" autocomplete="off" value="' + esc(this.sel.gangName || '') + '"></div>';
      h += '<div class="field"><label for="gang-tag">' + tt('Skratka (2–4 znaky, uvidíš ju na mape)') + '</label><input id="gang-tag" maxlength="4" placeholder="NM" autocomplete="off" style="text-transform:uppercase" value="' + esc(this.sel.gangTag || '') + '"></div>';
      h += '<div class="field"><label>' + tt('Farba graffiti') + '</label><div class="swatches">' + GANG_COLORS.map((c) => '<button class="sw' + (c.id === col ? ' sel' : '') + '" data-act="gang-color" data-arg="' + c.id + '" style="background:' + c.color + '" aria-label="' + c.name + '"></button>').join('') + '</div></div>';
      h += '<button class="btn gold wide" data-act="gang-create"' + (p.cash < cost ? ' disabled' : '') + '>' + tt('Založiť gang · {cena}', { cena: money(cost) }) + '</button>';
      return { html: this.hdr('Gang', money(p.cash)) + '<div class="body">' + h + turfList + '</div>', after: () => this.loadGangList() };
    }
    const me = this.s.selfId(), rank = this.s.myRank(), can = (w) => this.s.can(w);
    const b = this.s.gangBonus();
    const chips = [b.cash && tt('+{p} peňazí', { p: pct(b.cash) }), b.xp && tt('+{p} XP', { p: pct(b.xp) }), b.time && tt('−{p} čas misií', { p: pct(b.time) }), b.epic && tt('+{p} epický drop', { p: pct(b.epic) })].filter(Boolean);
    let h = '<div class="ghead"><span class="gtag big" style="border-color:' + g.color + ';color:' + g.color + '">' + esc(g.tag) + '</span><div><div class="bl" style="font-size:30px;color:#efe9dc">' + esc(g.name) + '</div><div class="s muted num">' + tt('{n} / {slots} členov', { n: g.members.length, slots: CONFIG.gangSlots }) + ' · ' + tt('{n} objektov', { n: turf.filter((v) => v.owner && v.owner.mine).length }) + ' · ' + tt('{n} výhier', { n: g.wins || 0 }) + ' · ' + tt('ty: {rank}', { rank: GANG_RANKS[rank] }) + '</div></div></div>';
    h += '<div class="chips">' + (chips.length ? chips.map((c) => '<span class="chip">' + c + '</span>').join('') : '<span class="note" style="margin:0">' + tt('Zatiaľ žiadny bonus. Obsaďte nejaký objekt.') + '</span>') + '</div>';

    const d1 = Math.round(F.cashPerMin(p.level) * 10), d2 = Math.round(F.cashPerMin(p.level) * 60);
    h += '<div class="sec sc">' + tt('Pokladnica') + '</div><div class="switch" style="border:none;padding-top:0"><span class="num gold" style="font-size:24px">' + money(g.treasury) + '</span><span style="display:flex;gap:6px">' +
      '<button class="btn small num" data-act="deposit" data-arg="' + d1 + '"' + (p.cash < 1 ? ' disabled' : '') + '>+ ' + money(d1) + '</button><button class="btn small num" data-act="deposit" data-arg="' + d2 + '"' + (p.cash < 1 ? ' disabled' : '') + '>+ ' + money(d2) + '</button></span></div>';
    h += '<p class="note" style="text-align:left;margin-top:0">' + tt('Vkladať môže každý člen. Z pokladnice sa platia vylepšenia a obrana objektov.') + '</p>';

    // members: boss and right hand first, then by level; your own buttons by your rank
    const where = {};
    turf.forEach((v) => (v.defenders || []).forEach((id) => { if (v.owner && v.owner.mine) where[id] = v.name; }));
    const order = { boss: 0, ruka: 1, vojak: 2, novacik: 3 };
    const who = (id) => this.s.person(id) || { name: '?', level: 0, cls: 'svalovec' };
    h += '<div class="sec sc">' + tt('Členovia {n} / {slots}', { n: g.members.length, slots: CONFIG.gangSlots }) + '</div>';
    [...g.members].sort((a, b2) => order[a.rank] - order[b2.rank] || who(b2.id).level - who(a.id).level).forEach((m) => {
      const pp = who(m.id), self = m.id === me;
      let btns = '';
      if (!self && can('rank') && m.rank !== 'boss') btns += '<button class="btn small" data-act="gang-member" data-arg="' + m.id + '">' + tt('Upraviť') + '</button>';
      h += '<div class="grow"><span class="mid"><span class="t' + (self ? ' gold' : '') + '">' + esc(pp.name) + (self ? ' <small class="muted">· ' + tt('ty') + '</small>' : '') + '</span><span class="s num">' + GANG_RANKS[m.rank] + ' · ' + (CLASSES[pp.cls] ? CLASSES[pp.cls].name : '') + ' · ' + tt('úr. {n}', { n: pp.level }) + (where[m.id] ? ' · ' + tt('bráni {objekt}', { objekt: esc(where[m.id]) }) : '') + '</span></span>' + btns + '</div>';
    });

    if (can('recruit')) {
      h += '<div class="sec sc">' + tt('Žiadosti o vstup') + '</div>';
      h += g.requests.length ? g.requests.map((r) => '<div class="grow"><span class="mid"><span class="t">' + esc(r.name) + '</span><span class="s num">' + (CLASSES[r.cls] ? CLASSES[r.cls].name : '') + ' · ' + tt('úr. {n}', { n: r.level }) + ' · ' + this.ago(r.at) + '</span></span>' +
        '<button class="btn small gold" data-act="gang-approve" data-arg="' + r.id + '"' + (g.members.length >= CONFIG.gangSlots ? ' disabled' : '') + '>' + tt('Prijať') + '</button><button class="btn small" data-act="gang-deny" data-arg="' + r.id + '">' + tt('Odmietnuť') + '</button></div>').join('')
        : '<p class="note" style="text-align:left">' + tt('Žiadne žiadosti. Hráči bez gangu ťa nájdu v zozname gangov.') + '</p>';
      h += '<div class="field" style="margin-top:8px"><label for="gang-invite">' + tt('Pozvať hráča (prezývka)') + '</label><div style="display:flex;gap:6px"><input id="gang-invite" maxlength="16" autocomplete="off" style="flex:1"><button class="btn small gold" data-act="gang-invite"' + (g.members.length >= CONFIG.gangSlots ? ' disabled' : '') + '>' + tt('Pozvať') + '</button></div></div>';
      if (g.invites.length) h += g.invites.map((i) => '<div class="grow"><span class="mid"><span class="t">' + esc(i.name) + '</span><span class="s">' + tt('pozvaný') + ' · ' + this.ago(i.at) + '</span></span><button class="btn small" data-act="gang-uninvite" data-arg="' + i.id + '">' + tt('Zrušiť') + '</button></div>').join('');
    }

    h += '<div class="sec sc">' + tt('Vylepšenia gangu') + '</div>';
    for (const [id, u] of Object.entries(GANG_UPGRADES)) {
      const n = g.upgrades[id], max = n >= CONFIG.gangUpgradeMax, cost = max ? 0 : this.s.gangUpgradeCost(id);
      h += '<div class="grow"><span class="mid"><span class="t">' + u.name + ' <small class="muted num">' + n + ' / ' + CONFIG.gangUpgradeMax + '</small></span><span class="s">' + (n ? tts(u.text(n)) : tt('zatiaľ nič')) + (max ? '' : ' → ' + tts(u.text(n + 1))) + '</span></span>' +
        (max ? '<span class="gold s">' + tt('max') + '</span>' : can('upgrade') ? '<button class="btn small num" data-act="gang-up" data-arg="' + id + '"' + (g.treasury < cost ? ' disabled' : '') + '>' + money(cost) + '</button>' : '<span class="s muted num">' + money(cost) + '</span>') + '</div>';
    }
    if (!can('upgrade')) h += '<p class="note">' + tt('Vylepšenia kupuje šéf alebo pravá ruka.') + '</p>';

    h += turfList;
    h += '<div class="sec sc">' + tt('Denník') + '</div><ol class="ladder">' + (g.log.length ? g.log.slice(0, 15).map((l) => '<li' + (l.bad ? ' style="color:#e6a49c"' : '') + '><span>' + esc(tts(l.text)) + '</span><span class="num muted" style="flex:none;margin-left:8px">' + this.ago(l.at) + '</span></li>').join('') : '<li>' + tt('Zatiaľ ticho.') + '</li>') + '</ol>';
    h += '<div style="display:flex;gap:8px;margin-top:14px"><button class="btn wide" data-act="gang-leave">' + tt('Odísť z gangu') + '</button>' + (can('lead') ? '<button class="btn wide" data-act="gang-disband">' + tt('Rozpustiť gang') + '</button>' : '') + '</div>';
    return { html: this.hdr('Gang', '<span class="gold">' + money(g.treasury) + '</span>') + '<div class="body">' + h + '</div>' };
  }

  // the list of gangs to ask, fetched each time the screen opens without a gang
  async loadGangList() {
    if (this.gangListBusy) return;
    this.gangListBusy = true;
    const r = await this.s.gangHall();
    this.gangListBusy = false;
    if (!r.ok) return;
    const json = JSON.stringify(r.list);
    if (json === JSON.stringify(this.sel.gangList)) return;
    this.sel.gangList = r.list;
    if (this.name === 'gang' && !this.s.gang()) this.render();
  }

  // boss: one member's options
  gangMemberModal(id) {
    const g = this.s.gang(), m = g && g.members.find((x) => x.id === id);
    if (!m) return;
    const pp = this.s.person(id) || { name: '?' };
    const rk = (r) => '<button class="btn wide' + (m.rank === r ? ' gold' : '') + '" data-act="gang-rank" data-arg="' + id + ':' + r + '">' + GANG_RANKS[r] + (r === 'ruka' ? ' (' + tt('len jedna') + ')' : '') + '</button>';
    this.modal('<h2>' + esc(pp.name) + '</h2><p class="sub">' + GANG_RANKS[m.rank] + '</p><div class="acts" style="flex-direction:column">' + rk('ruka') + rk('vojak') + rk('novacik') +
      '<button class="btn wide" data-act="gang-lead" data-arg="' + id + '">' + tt('Odovzdať mu vedenie') + '</button>' +
      '<button class="btn wide" data-act="gang-kick" data-arg="' + id + '" style="color:#e6a49c">' + tt('Vyhodiť z gangu') + '</button>' +
      '<button class="btn wide" data-act="modal-close">' + tt('Zavrieť') + '</button></div>' +
      '<p class="sub" style="font-size:15px;color:#9b968b">' + tt('Nováčik môže vkladať do pokladnice a brániť. Vojak aj útočí a dopĺňa obranu. Pravá ruka navyše prijíma členov a kupuje vylepšenia.') + '</p>');
  }
  ago(t) {
    const m = Math.floor((Date.now() - t) / 60000);
    return m < 1 ? tt('teraz') : m < 60 ? tt('{n} min', { n: m }) : tt('{n} h', { n: Math.floor(m / 60) });
  }

  scr_turf(id) {
    const v = this.s.turfView().find((x) => x.id === id);
    const g = this.s.gang(), o = v.owner, now = Date.now();
    let h = '<div class="ghead">' + this.tagBox(o).replace('gtag', 'gtag big') + '<div><div class="bl" style="font-size:28px;color:#efe9dc">' + esc(v.name) + '</div><div class="s muted">' + v.kindInfo.name + ' · ' + tt('drží {majitel}', { majitel: o ? '<span style="color:' + o.color + '">' + esc(o.name) + '</span>' : tt('nikto') }) + '</div></div></div>';
    h += '<p class="p">' + tt('Bonus pre celý gang: <span class="gold">{bonus}</span>', { bonus: v.kindInfo.text }) + '</p>';
    if (o) h += '<div class="switch" style="border:none;padding:0 0 4px"><span style="font-size:16px">' + tt('Sila obrany') + '</span><span class="num">' + pct(v.strength) + '</span></div><div class="bar" style="height:8px"><i style="width:' + Math.min(100, (v.strength / 1.5) * 100) + '%"></i></div>';

    if (o && o.mine) {
      const full = this.s.fullStrength(), cost = this.s.refillCost();
      if (v.strength < full - 0.005) h += '<button class="btn wide num" style="margin-top:10px" data-act="turf-refill"' + (g.treasury < cost ? ' disabled' : '') + '>' + tt('Doplniť obranu na {p} · {cena} z pokladnice', { p: pct(full), cena: money(cost) }) + '</button>';
      else h += '<p class="note">' + tt('Obrana je plná. Bez doplnenia slabne o {p} za hodinu.', { p: pct(CONFIG.turfDecayPerHour) }) + '</p>';
      if (now < v.safeUntil) h += '<p class="note">' + tt('Pod ochranou ešte {cas}.', { cas: '<span data-until="' + v.safeUntil + '"></span>' }) + '</p>';
      const me = this.s.selfId();
      let mineElsewhere = null;
      this.s.turfView().forEach((x) => { if (x.owner && x.owner.mine && x.id !== id && x.defenders.includes(me)) mineElsewhere = x.name; });
      h += '<div class="sec sc">' + tt('Obrancovia {n} / {slots}', { n: v.defenders.length, slots: v.kindInfo.slots }) + '</div>';
      if (!v.defenders.length) h += '<p class="warn" style="color:#e6a49c">' + tt('Objekt nikto nebráni. Prvý útok ho zoberie.') + '</p>';
      v.defenders.forEach((pid) => {
        const f = this.s.memberFighter(pid, v.strength);
        if (!f) return;
        const off = pid === me || this.s.can('kick');
        h += this.fighterRow(f, off ? '<button class="btn small" data-act="turf-def" data-arg="' + pid + '">' + (pid === me ? tt('Odísť') : tt('Stiahnuť')) + '</button>' : '');
      });
      if (!v.defenders.includes(me)) {
        h += v.defenders.length < v.kindInfo.slots
          ? '<button class="btn gold wide" style="margin-top:8px" data-act="turf-def" data-arg="">' + (mineElsewhere ? tt('Presunúť sa sem (teraz bránim {objekt})', { objekt: esc(mineElsewhere) }) : tt('Brániť tento objekt')) + '</button>'
          : '<p class="note">' + tt('Na objekte je plno obrancov.') + '</p>';
      }
      h += '<p class="note">' + tt('Každý člen bráni jeden objekt a bojuje v ňom so svojou výbavou, aj keď nie je online. Počítačoví rivali skúšajú objekty prebrať zhruba raz za hodinu, iné gangy kedykoľvek.') + '</p>';
      return { html: this.hdr(v.kindInfo.name, g ? '<span class="gold">' + money(g.treasury) + '</span>' : '') + '<div class="body">' + h + '</div>' };
    }

    if (o && o.rival) {
      h += '<div class="sec sc">' + tt('Obrancovia') + '</div>' + this.s.rivalSquad(this.s.turfObj(id), v.kind).map((f) => this.fighterRow(f)).join('');
    } else if (o) {
      const ds = v.defenders.map((pid) => this.s.memberFighter(pid, v.strength)).filter(Boolean);
      h += '<div class="sec sc">' + tt('Obrancovia gangu {gang}', { gang: esc(o.name) }) + '</div>' + (ds.length ? ds.map((f) => this.fighterRow(f)).join('') : '<p class="note" style="text-align:left">' + tt('Nikto ho nebráni. Stačí prísť a zobrať ho.') + '</p>');
    } else {
      h += '<p class="note" style="text-align:left">' + tt('Objekt nikto nedrží. Stačí prísť s gangom a obsadiť ho.') + '</p>';
    }
    if (!g) {
      h += '<p class="warn" style="color:#e6a49c;margin-top:12px">' + tt('Na boj o územie potrebuješ gang.') + '</p><button class="btn gold wide" data-act="tab" data-arg="gang">' + tt('Založiť gang') + '</button>';
    } else {
      if (o) h += '<div class="sec sc">' + tt('Tvoj tím') + '</div>' + this.s.attackSquad().map((f) => this.fighterRow(f)).join('');
      if (now < v.retryAt) h += '<p class="note">' + tt('Ďalší útok o {cas}.', { cas: '<span data-until="' + v.retryAt + '"></span>' }) + '</p>';
      else if (now < v.safeUntil) h += '<p class="note">' + tt('Objekt bol práve obsadený. Pod ochranou ešte {cas}.', { cas: '<span data-until="' + v.safeUntil + '"></span>' }) + '</p>';
      else if (v.city !== this.s.city()) h += '<p class="note">' + tt('Objekt je v inom meste ({mesto}). Zaútočiť sa dá len na mieste.', { mesto: CITIES[v.city].name }) + '</p>';
      else if (!this.s.can('attack')) h += '<p class="note">' + tt('Ako nováčik ešte útočiť nemôžeš. Hodnosť vojaka ti dá šéf.') + '</p>';
      else h += '<button class="btn gold wide" style="margin-top:12px" data-act="turf-attack">' + (o ? tt('Zaútočiť') : tt('Obsadiť')) + '</button>' + (o ? '<p class="note">' + tt('Po útoku ťa bude hľadať polícia: +1 hviezda. S tebou idú najsilnejší ďalší členovia gangu (aj keď nie sú online).') + '</p>' : '');
    }
    return { html: this.hdr(v.kindInfo.name, g ? '<span class="gold">' + money(g.treasury) + '</span>' : '') + '<div class="body">' + h + '</div>' };
  }

  // team fight: duels one after another, the winner keeps his remaining life; each duel plays like a normal fight
  scr_war(d) {
    const col = (list, side) => list.map((f, i) => '<div class="wrow" id="w' + side + i + '"><div class="top"><span>' + esc(f.name) + '</span><span class="num muted" id="w' + side + 't' + i + '">' + fmt(f.hp) + '</span></div><div class="bar hp"><i id="w' + side + 'b' + i + '" style="width:100%"></i></div></div>').join('');
    const prev = d.result.prev;
    const h = '<div class="stage" id="stage"><img class="bg" src="' + this.fightBg() + '" alt=""><div class="fade-t"></div><div class="fade-b"></div>' +
      '<div class="title"><span class="bl" id="wtitle">' + tt('Duel {n}', { n: 1 }) + '</span><span class="sc" style="font-size:14px;color:#d0473d;text-shadow:0 1px 0 #000">' + esc(d.turf.name) + (prev ? ' · ' + esc(prev.name) : '') + '</span></div>' +
      '<figure class="fcard me" id="fa"></figure><span class="vs">vs</span><figure class="fcard foe" id="fb"></figure></div>' +
      '<div class="hpgrid"><div><div class="top"><span class="bl" id="wna"></span><span class="num muted" id="hpa" style="font-size:14px"></span></div><div class="bar hp"><i id="hpba" style="width:100%"></i></div></div>' +
      '<div><div class="top"><span class="bl" id="wnb"></span><span class="num muted" id="hpb" style="font-size:14px"></span></div><div class="bar hp"><i id="hpbb" style="width:100%"></i></div></div></div>' +
      '<div class="body tight" style="flex:1;overflow-y:auto"><div class="war"><div><div class="sec sc" style="margin-top:0">' + tt('Tvoj gang') + '</div>' + col(d.A, 'a') + '</div><div><div class="sec sc" style="margin-top:0;color:' + (prev ? prev.color : '') + '">' + (prev ? esc(prev.name) : tt('Obrana')) + '</div>' + col(d.D, 'd') + '</div></div>' +
      '<ol class="flog" id="wlog" style="margin-top:10px"></ol></div>' +
      '<div style="flex:none;padding:10px 14px calc(14px + env(safe-area-inset-bottom))"><button class="btn wide" data-act="war-skip" id="fskip">' + tt('Preskočiť') + '</button></div>';
    return { html: '<header class="hdr"><span style="width:12px"></span><h1 style="font-size:24px" class="sc">Gang Wars</h1></header>' + h, after: () => this.playWar(d) };
  }

  fightBg() { return art(FIGHT_BG[this.s.city()] || FIGHT_BG.mesto1); }

  // fight card of a gang fighter: you wear your own look, members and rivals their class art
  warCard(f, me) {
    if (me && LOOK_BASE) return this.lookHtml(this.s.p.look, 'in-fcard');
    const focus = !me && BOT_FOCUS[f.cls];
    return '<img src="' + art(me ? 'photo_zlodej' : BOT_ART[f.cls] || 'photo_zlodej') + '" alt="' + esc(f.name) + '"' + (focus ? ' style="object-position:' + focus + '"' : '') + '>';
  }

  playWar(d) {
    const total = d.battle.duels.reduce((s, x) => s + (x.ev || []).length + 3, 0);
    const step = Math.max(90, Math.min(420, 25000 / Math.max(1, total)));
    this.war = { d, k: -1, i: 0, pause: 0, step };
    if (!this.nextDuel()) { this.war.ended = true; this.finishWar(); return; }
    this.fightTimer = setInterval(() => this.warStep(), step);
  }

  nextDuel(silent = false) {
    const w = this.war;
    w.k += 1;
    w.i = 0;
    const duel = w.d.battle.duels[w.k];
    if (!duel) return false;
    const A = w.d.A[duel.a], D = w.d.D[duel.d];
    // you carry your own weapon, gang members and rivals the usual one of their class
    w.cur = { A, D, duel, w: [duel.a === 0 ? this.myWeapon() : this.fighterWeapon(A), this.fighterWeapon(D)] };
    this.preloadFx(w.cur.w);
    document.querySelectorAll('.wrow.on').forEach((e) => e.classList.remove('on'));
    const ra = $('#wa' + duel.a), rd = $('#wd' + duel.d);
    if (ra) ra.classList.add('on');
    if (rd) rd.classList.add('on');
    if (!silent) {
      $('#fa').classList.remove('out');
      $('#fb').classList.remove('out');
      $('#fa').innerHTML = this.warCard(A, duel.a === 0); // you always go first
      $('#fb').innerHTML = this.warCard(D, false);
      $('#wna').textContent = A.name;
      $('#wnb').textContent = D.name;
      $('#wtitle').textContent = tt('Duel {n}', { n: w.k + 1 });
    }
    this.warHp(duel.from[0], duel.from[1]);
    return true;
  }

  warHp(a, b) {
    const { A, D, duel } = this.war.cur;
    const row = (side, i, hp, max) => {
      const bar = $('#w' + side + 'b' + i), t = $('#w' + side + 't' + i);
      if (bar) bar.style.width = (hp / max) * 100 + '%';
      if (t) t.textContent = fmt(hp);
      if (hp <= 0) { const r = $('#w' + side + i); if (r) r.classList.add('out'); }
    };
    row('a', duel.a, a, A.hp);
    row('d', duel.d, b, D.hp);
    $('#hpa').textContent = fmt(a) + ' / ' + fmt(A.hp);
    $('#hpb').textContent = fmt(b) + ' / ' + fmt(D.hp);
    $('#hpba').style.width = (a / A.hp) * 100 + '%';
    $('#hpbb').style.width = (b / D.hp) * 100 + '%';
  }

  warStep(silent = false) {
    const w = this.war;
    if (!w || !w.cur || w.ended) return;
    if (w.pause > 0) {
      w.pause -= 1;
      if (!w.pause && !this.nextDuel(silent)) { w.ended = true; if (!silent) this.finishWar(); }
      return;
    }
    const { A, D, duel } = w.cur;
    const ev = (duel.ev || [])[w.i];
    if (!ev) {
      this.warHp(duel.to[0], duel.to[1]);
      const log = $('#wlog');
      if (log) {
        const li = document.createElement('li');
        const win = duel.winner === 0;
        const me = duel.a === 0;
        const line = win ? (me ? tt('<span class="gold">Vyhral si</span> nad {name}', { name: esc(D.name) }) : tt('<span class="gold">{a}</span> vyhral nad {name}', { a: esc(A.name), name: esc(D.name) }))
          : (me ? tt('<span class="red">{name}</span> ťa porazil', { name: esc(D.name) }) : tt('<span class="red">{name}</span> vyhral nad {a}', { name: esc(D.name), a: esc(A.name) }));
        li.innerHTML = '<span class="r">' + tt('Duel {n}', { n: w.k + 1 }) + '</span><span>' + line + '</span>';
        log.prepend(li);
      }
      if (!silent) { const loser = $(duel.winner === 0 ? '#fb' : '#fa'); if (loser) loser.classList.add('out'); }
      w.pause = silent ? 1 : 4;
      return;
    }
    w.i += 1;
    const [att, dmg, crit, ha, hb] = ev;
    if (silent) { this.warHp(ha, hb); return; }
    const cur = w.cur;
    this.weaponFx(att, cur.w[att], Math.min(w.step * 0.95, 460), () => {
      if (this.war !== w || w.done || w.cur !== cur) return;
      this.warHp(ha, hb);
      this.hitMark(att, dmg === -1 ? 'úhyb' : dmg === -2 ? 'blok' : dmg, crit, dmg < 0);
    });
  }

  finishWar(skip) {
    const w = this.war;
    if (!w || w.done) return;
    this.stopFight();
    if (skip) while (!w.ended) this.warStep(true);
    w.done = true;
    const sk = $('#fskip');
    if (sk) sk.remove();
    const r = w.d.result;
    sound.play(r.win ? 'win' : 'lose');
    let h = r.win ? '<h2 class="win">' + tt('Územie je vaše') + '</h2>' : '<h2 class="lose">' + tt('Útok zlyhal') + '</h2>';
    h += '<p class="sub">' + (r.win ? tt('{name} teraz drží tvoj gang. Bojovníci ostali na mieste ako obrancovia.', { name: esc(r.name) }) : tt('{obrancovia} {name} udržali. Ďalší pokus o {min} min.', { obrancovia: r.prev ? esc(r.prev.name) : tt('Obrancovia'), name: esc(r.name), min: CONFIG.gangRetryMin })) + '</p>';
    if (r.win) h += '<div class="rew"><span class="gold">' + money(r.cash) + '</span><span>+' + fmt(r.xp) + ' XP</span><span class="red">+1 ★</span></div>';
    else h += '<div class="rew"><span class="red">+1 ★</span></div>';
    h += this.levelUpText(r.levelUps || 0);
    h += '<div class="acts"><button class="btn gold" data-act="fight-done">' + tt('Pokračovať') + '</button></div>';
    this.modal(h);
  }

  // ---------------------------------------------------------------- fight playback
  scr_fight(d) {
    const nameA = esc(d.a.name), nameB = esc(d.b.name);
    const head = d.kind === 'boss' ? 'Boss fight' : d.kind === 'arena' ? tt('Aréna') : d.kind === 'club' ? tt('Podzemné zápasy') : MISSIONS[d.result.tpl].name;
    const h = '<div class="stage" id="stage"><img class="bg" src="' + this.fightBg() + '" alt=""><div class="fade-t"></div><div class="fade-b"></div>' +
      '<div class="title"><span class="bl">' + esc(d.title) + '</span><span class="sc" style="font-size:14px;color:#d0473d;text-shadow:0 1px 0 #000">' + esc(d.subtitle || '') + '</span></div>' +
      '<figure class="fcard me" id="fa">' + (LOOK_BASE ? this.lookHtml(this.s.p.look, 'in-fcard') : '<img src="' + art('photo_zlodej') + '" alt="' + nameA + '">') + '</figure>' +
      '<span class="vs">vs</span>' +
      '<figure class="fcard foe" id="fb"><img src="' + art(d.artB) + '" alt="' + nameB + '"' + (d.silhouette ? ' style="filter:brightness(.15)"' : d.focusB ? ' style="object-position:' + d.focusB + '"' : '') + '></figure></div>' +
      '<div class="hpgrid"><div><div class="top"><span class="bl">' + nameA + '</span><span class="num muted" id="hpa" style="font-size:14px"></span></div><div class="bar hp"><i id="hpba" style="width:100%"></i></div></div>' +
      '<div><div class="top"><span class="bl">' + nameB + '</span><span class="num muted" id="hpb" style="font-size:14px"></span></div><div class="bar hp"><i id="hpbb" style="width:100%"></i></div></div></div>' +
      (d.intro ? '<p class="story" style="margin:0 14px 6px">' + esc(d.intro) + '</p>' : '') +
      '<div class="body tight" style="flex:1;overflow-y:auto"><ol class="flog" id="flog"></ol></div>' +
      '<div style="flex:none;padding:10px 14px calc(14px + env(safe-area-inset-bottom))"><button class="btn wide" data-act="fight-skip" id="fskip">' + tt('Preskočiť') + '</button></div>';
    return { html: '<header class="hdr"><span style="width:12px"></span><h1 style="font-size:24px" class="sc">' + head + '</h1></header>' + h, after: () => this.playFight(d) };
  }

  playFight(d) {
    // long fights play faster so a playback never takes much more than ~12 s
    const step = Math.max(90, Math.min(480, 12000 / Math.max(1, d.fight.rounds.length)));
    this.fight = { d, i: 0, step, w: [this.myWeapon(), this.fighterWeapon(d.b)] };
    this.preloadFx(this.fight.w);
    this.setHp(d.a.hp, d.b.hp);
    this.fightTimer = setInterval(() => this.fightStep(), step);
  }

  // ---------------------------------------------------------------- weapon animation
  myWeapon() { const id = this.s.p.equipment.zbran; const it = id && this.s.item(id); return it ? it.base : null; }
  fighterWeapon(f) { return (f && (f.wbase || CLASS_WEAPON[f.cls])) || null; }
  preloadFx(bases) { bases.forEach((b) => { if (b && ITEM_BASES[b]) new Image().src = fxArt(ITEM_BASES[b].art); }); }

  // one exchange: the attacker leans in and its weapon swings at (melee) or fires at (gun) the other card;
  // onHit runs at the moment of impact
  weaponFx(att, baseId, dur, onHit) {
    const stage = $('#stage'), from = $(att === 0 ? '#fa' : '#fb'), to = $(att === 0 ? '#fb' : '#fa');
    if (!stage || !from || !to) { onHit(); return; }
    const dir = att === 0 ? 1 : -1;
    from.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(' + 16 * dir + 'px)', offset: 0.5 }, { transform: 'translateX(0)' }], { duration: dur, easing: 'ease-out' });
    const base = baseId && ITEM_BASES[baseId];
    // the blow that lands (hitMark) sounds like this weapon: a gun's bullet just hits, a blade cuts, a bat thuds
    const sfx = sound.weaponSfx(base ? baseId : null);
    this.blowSfx = base && base.attack === 'gun' ? 'hit' : sfx;
    if (!base) { setTimeout(onHit, dur * 0.5); return; }
    if (base.attack !== 'gun') setTimeout(() => sound.play('swing', { vol: 0.7 }), dur * 0.3);
    const sr = stage.getBoundingClientRect(), fr = from.getBoundingClientRect(), tr = to.getBoundingClientRect();
    const size = Math.round(base.attack === 'gun' ? Math.min(130, fr.width * 0.9) : Math.min(110, fr.width * 0.75));
    const img = document.createElement('img');
    img.className = 'wfx';
    img.src = fxArt(base.art);
    img.alt = '';
    img.style.width = img.style.height = size + 'px';
    // a gun is held out past the card's edge toward the foe, a melee weapon starts on the edge
    const out = base.attack === 'gun' ? 0.25 : 0.5;
    const sx = dir > 0 ? fr.right - sr.left - size * out : fr.left - sr.left - size * (1 - out);
    const sy = fr.top - sr.top + fr.height * (base.attack === 'gun' ? 0.55 : 0.42) - size / 2;
    img.style.left = sx + 'px';
    img.style.top = sy + 'px';
    stage.appendChild(img);
    setTimeout(() => img.remove(), dur + 60);
    const tx = (dir > 0 ? tr.left + tr.width * 0.3 : tr.right - tr.width * 0.3) - sr.left;
    const ty = tr.top - sr.top + tr.height * 0.42;
    if (base.attack === 'gun') {
      const flip = FX_MUZZLE_LEFT.has(base.art) === (dir > 0) ? ' scaleX(-1)' : '';
      img.animate([
        { transform: 'translateX(0) rotate(0deg)' + flip, opacity: 0 },
        { transform: 'translateX(0) rotate(0deg)' + flip, opacity: 1, offset: 0.15 },
        { transform: 'translateX(' + -10 * dir + 'px) rotate(' + -14 * dir + 'deg)' + flip, opacity: 1, offset: 0.4 },
        { transform: 'translateX(0) rotate(0deg)' + flip, opacity: 1, offset: 0.75 },
        { transform: 'translateX(0) rotate(0deg)' + flip, opacity: 0 },
      ], { duration: dur, easing: 'ease-out' });
      const mx = dir > 0 ? sx + size * 0.95 : sx + size * 0.05, my = sy + size * 0.36;
      const shots = base.auto ? 3 : 1;
      for (let k = 0; k < shots; k++) {
        setTimeout(() => {
          sound.play(sfx, { vol: 0.7 });
          const fl = document.createElement('span');
          fl.className = 'mflash';
          fl.style.left = mx + 'px';
          fl.style.top = my + 'px';
          stage.appendChild(fl);
          fl.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.4)', opacity: 0 }], { duration: 120 });
          setTimeout(() => fl.remove(), 130);
          const b = document.createElement('span');
          b.className = 'bullet';
          b.style.left = mx + 'px';
          b.style.top = my + 'px';
          stage.appendChild(b);
          b.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(' + (tx - mx) + 'px,' + (ty - my + (k - 1) * 8) + 'px)' }], { duration: Math.max(60, dur * 0.2), easing: 'linear' });
          setTimeout(() => b.remove(), Math.max(60, dur * 0.2));
        }, dur * (0.3 + k * 0.12));
      }
      setTimeout(onHit, dur * 0.5);
    } else {
      // melee: wind up, swing across into the foe, pull back
      // m (applied first): striking end up-right, mirrored for the foe so it points at you
      const dx = tx - sx - size / 2, dy = ty - sy - size / 2;
      const m = (dir > 0 ? '' : ' scaleX(-1)') + (FX_TIP_DOWN_LEFT.has(base.art) ? ' matrix(0,1,1,0,0,0)' : '');
      img.animate([
        { transform: 'translate(0,0) rotate(' + -30 * dir + 'deg)' + m, opacity: 0 },
        { transform: 'translate(' + dx * 0.3 + 'px,' + (dy - 40) + 'px) rotate(' + -75 * dir + 'deg)' + m, opacity: 1, offset: 0.3 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + 45 * dir + 'deg)' + m, opacity: 1, offset: 0.55 },
        { transform: 'translate(' + dx * 0.85 + 'px,' + (dy + 6) + 'px) rotate(' + 35 * dir + 'deg)' + m, opacity: 1, offset: 0.75 },
        { transform: 'translate(' + dx * 0.2 + 'px,0) rotate(0deg)' + m, opacity: 0 },
      ], { duration: dur, easing: 'ease-in-out' });
      setTimeout(onHit, dur * 0.55);
    }
  }

  setHp(a, b) {
    const d = this.fight.d;
    $('#hpa').textContent = fmt(a) + ' / ' + fmt(d.a.hp);
    $('#hpb').textContent = fmt(b) + ' / ' + fmt(d.b.hp);
    $('#hpba').style.width = (a / d.a.hp) * 100 + '%';
    $('#hpbb').style.width = (b / d.b.hp) * 100 + '%';
  }

  fightLine(ev, d) {
    const A = esc(d.a.name), B = esc(d.b.name);
    if (ev.block) return ev.attacker === 0 ? tt('{b} tvoj úder zablokoval.', { b: B }) : tt('Zablokoval si úder.');
    if (ev.attacker === 0) return ev.dodge ? tt('{b} sa uhol.', { b: B }) : ev.crit ? tt('Kritický zásah za <span class="gold">{dmg}</span>!', { dmg: ev.dmg }) : tt('Zasiahol si za <b>{dmg}</b>.', { dmg: ev.dmg });
    return ev.dodge ? tt('Uhol si sa.') : ev.crit ? tt('{b}: kritický úder za <span class="red">{dmg}</span>!', { b: B, dmg: ev.dmg }) : tt('{b} ťa zasiahol za <span class="red">{dmg}</span>.', { b: B, dmg: ev.dmg });
  }

  fightStep(silent = false) {
    const f = this.fight;
    if (!f) return;
    const ev = f.d.fight.rounds[f.i];
    if (!ev) { this.finishFight(false); return; }
    f.i += 1;
    const log = $('#flog');
    if (log) {
      const li = document.createElement('li');
      if (ev.crit) li.className = 'crit';
      li.innerHTML = '<span class="r">' + tt('Kolo {n}', { n: ev.round }) + '</span><span>' + this.fightLine(ev, f.d) + '</span>';
      log.prepend(li);
    }
    if (silent) { this.setHp(ev.hp[0], ev.hp[1]); return; }
    // the hit lands (life bar, shake, number) when the weapon reaches the other card
    this.weaponFx(ev.attacker, f.w[ev.attacker], Math.min(f.step * 0.95, 460), () => {
      if (this.fight !== f || f.done) return;
      this.setHp(ev.hp[0], ev.hp[1]);
      this.hitMark(ev.attacker, ev.dodge ? 'úhyb' : ev.block ? 'blok' : ev.dmg, ev.crit, ev.dodge || ev.block);
    });
  }

  // shake the struck card and float the damage (or úhyb / blok) above it
  hitMark(att, text, crit, miss) {
    const target = $(att === 0 ? '#fb' : '#fa');
    const stage = $('#stage');
    if (!target || !stage) return;
    if (text === 'blok') sound.play('clang');
    else if (miss) sound.play('whiff');
    else { sound.play(this.blowSfx || 'hit'); if (crit) sound.play('crit'); }
    target.classList.remove('hit');
    void target.offsetWidth;
    if (!miss) target.classList.add('hit');
    const n = document.createElement('span');
    n.className = 'dmg' + (crit ? ' crit' : '') + (miss ? ' miss' : '');
    n.textContent = text === 'blok' ? tt('blok') : text === 'úhyb' ? tt('úhyb') : text;
    n.style.left = att === 0 ? '70%' : '14%';
    n.style.top = '170px';
    stage.appendChild(n);
    setTimeout(() => n.remove(), 900);
  }

  stopFight() {
    if (this.fightTimer) clearInterval(this.fightTimer);
    this.fightTimer = null;
  }

  finishFight(skip) {
    const f = this.fight;
    if (!f || f.done) return;
    this.stopFight();
    if (skip) while (f.i < f.d.fight.rounds.length) this.fightStep(true);
    f.done = true;
    const sk = $('#fskip');
    if (sk) sk.remove();
    const r = f.d.result, d = f.d;
    sound.play(r.win ? 'win' : 'lose');
    let h;
    if (d.kind === 'mission') {
      h = r.win ? '<h2 class="win">' + tt('Misia splnená') + '</h2>' : '<h2 class="lose">' + tt('Misia zlyhala') + '</h2>';
      h += '<p class="sub">' + (r.win ? tt('{b} leží na zemi. {name} je hotová.', { b: esc(d.b.name), name: r.name }) : tt('{b} ťa dnes premohol. Tentoraz bez odmeny.', { b: esc(d.b.name) })) + '</p>';
      if (r.hot) h += '<p class="note hotnote">' + (r.win ? tt('Horúca misia: {x}× odmena!', { x: CONFIG.hotReward }) : tt('Horúca misia nevyšla. Zosilnej a skús ďalšiu.')) + '</p>';
      h += '<div class="rew">' + (r.win ? '<span class="gold">' + money(r.cash) + '</span><span>+' + fmt(r.xp) + ' XP</span>' : '') + (r.bars ? '<span class="gold">' + tt('+{n} tehl.', { n: r.bars }) + '</span>' : '') + (r.heat > 0 ? '<span class="red">' + tt('heat +{n}', { n: r.heat }) + '</span>' : '') + '</div>';
      if (r.item) h += this.lootHtml(r.item);
      if (r.epic) h += '<p class="note" style="color:#ff6aa8">' + tt('Sklad tvojho gangu: epický kúsok navyše!') + '</p>' + this.lootHtml(r.epic);
      if (r.legend) h += '<p class="note gold">' + tt('Legendárny víkend: legendárny kúsok z misie!') + '</p>' + this.lootHtml(r.legend);
      if (r.raid) h += '<p class="warn">' + (r.raid.type === 'fine' ? tt('Razia! Polícia ti zobrala {cena}.', { cena: money(r.raid.fine) }) : tt('Razia! Zatkli ťa, {n} min bez misií.', { n: r.raid.minutes })) + '</p>';
      h += this.levelUpText(r.levelUps || 0);
      h += '<div class="acts"><button class="btn gold" data-act="fight-done">' + tt('Pokračovať') + '</button></div>';
      this.modal(h);
      return;
    }
    h = r.win ? '<h2 class="win">' + tt('Víťazstvo') + '</h2>' : '<h2 class="lose">' + tt('Prehra') + '</h2>';
    if (d.kind === 'boss') {
      h += '<p class="sub">' + (r.win ? (d.next && !d.next.done ? tt('{b} je porazený. Ďalší boss: {next}.', { b: esc(d.b.name), next: d.next.boss.name }) : tt('{b} je porazený.', { b: esc(d.b.name) })) : tt('{b} bol silnejší. Vylepši staty a výbavu a skús to znova.', { b: esc(d.b.name) })) + '</p>';
      if (r.win) h += '<div class="rew"><span class="gold">' + money(r.cash) + '</span><span>+' + fmt(r.xp) + ' XP</span>' + (r.bars ? '<span class="gold">' + tt('+{n} tehl.', { n: r.bars }) + '</span>' : '') + '</div>' +
        (r.first ? '<p class="note" style="color:#ff6aa8">' + tt('Prvý boss: istý epický kúsok!') + '</p>' : '') + (r.item ? this.lootHtml(r.item) : '');
    } else if (d.kind === 'club') {
      h += '<p class="sub">' + (r.win ? (r.floor < CONFIG.clubFloors ? tt('Poschodie {n} je tvoje. Ďalší súper o hodinu.', { n: r.floor }) : tt('Poschodie {n} je tvoje. Porazil si všetkých.', { n: r.floor })) : tt('{b} ťa poslal na zem. Ďalší pokus o hodinu.', { b: esc(d.b.name) })) + '</p>';
      if (r.win) h += '<div class="rew"><span class="gold">' + money(r.cash) + '</span><span>+' + fmt(r.xp) + ' XP</span>' + (r.bars ? '<span class="gold">' + tt('+{n} tehl.', { n: r.bars }) + '</span>' : '') + '</div>' + (r.item ? this.lootHtml(r.item) : '');
    } else {
      h += '<p class="sub">' + (r.win ? tt('Rebríček ťa posunul vyššie.') : tt('Body si stratil, peniaze nie.')) + '</p>';
      h += '<div class="rew"><span class="' + (r.points >= 0 ? 'gold' : 'red') + '">' + tt('{n} b.', { n: (r.points >= 0 ? '+' : '') + r.points }) + '</span>' + (r.win ? '<span class="gold">' + money(r.cash) + '</span><span>+' + fmt(r.xp) + ' XP</span>' : '') + '</div>';
    }
    h += this.levelUpText(r.levelUps || 0);
    h += '<div class="acts"><button class="btn gold" data-act="fight-done">' + tt('Pokračovať') + '</button></div>';
    this.modal(h);
  }
}
