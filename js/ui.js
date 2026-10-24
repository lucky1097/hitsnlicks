// HTML interface: HUD, menus, screens, modals. Talks only to the (simulated) server.
import { STATS, STAT_NAMES, CLASSES, RARITIES, CONFIG, F } from './config.js?v=20261024154006';
import { SLOTS, ITEM_BASES, SHOPS, MISSIONS, GIVERS, BOSSES, GANG_COLORS, GANG_RANKS, GANG_UPGRADES } from './data.js?v=20261024154006';
import { EVENTS, EVENT_ROTATION, activeEvents, nextEvents } from './events.js?v=20261024154006';
import { DAILY_TYPES } from './daily.js?v=20261024154006';
import { LOOK_BASE, LOOK_PARTS } from './looks.js?v=20261024154006';

const $ = (sel, el = document) => el.querySelector(sel);
const fmt = (n) => Math.round(n).toLocaleString('sk-SK');
const money = (n) => '$ ' + fmt(n);
const pct = (x) => Math.round(x * 100) + ' %';
const hours = (min) => { const n = Math.round(min / 60); return n + (n === 1 ? ' hodina' : n < 5 ? ' hodiny' : ' hodín'); };
const art = (n) => 'assets/art/' + n + (/^(photo_|w_|x_)/.test(n) ? '.jpg' : '.png');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const rar = (id) => RARITIES.find((r) => r.id === id) || RARITIES[0];
const BACK = '<svg width="12" height="20" viewBox="0 0 12 20" aria-hidden="true"><path d="M10 2 L2 10 L10 18" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>';
const BOT_ART = { svalovec: 'photo_svalovec', zlodej: 'diler', dealer: 'photo_dlznik' };
// where the face sits in each class artwork (CSS object-position)
const BOT_FOCUS = { svalovec: '32% 7%' };
// fight animation: weapon cut-outs live in assets/fx (tools/cutout.ps1); guns drawn pointing left get
// flipped so the muzzle faces the foe; fighters without a known weapon carry their class's usual one
const FX_MUZZLE_LEFT = new Set(['w_deagle', 'w_glock', 'w_gold1911', 'w_kalach', 'w_revolver', 'w_tommy_gold']);
// melee pictures are drawn diagonally; the swing expects the handle down-left and the striking end up-right
// (bat, katana, crowbar, bike chain), these have the handle up-right; they are mirrored across the diagonal
// (not turned round), so the cutting edge keeps leading the swing
const FX_TIP_DOWN_LEFT = new Set(['w_knife', 'w_machete', 'w_hockey', 'w_bottle']);
const CLASS_WEAPON = { svalovec: 'bat', zlodej: 'knife', dealer: 'glock' };
const fxArt = (n) => 'assets/fx/' + n + '.png';
// class artwork shown when picking a class (more classes as their art arrives)
const CLASS_ART = { svalovec: 'photo_svalovec' };

// street pills: red = Šťastie, blue = class stat, green = life
const PILL_ICON = {
  red: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="5" width="14" height="7" rx="3.5" fill="#f2ece0"/><path d="M4.5 5H8v7H4.5a3.5 3.5 0 0 1 0-7z" fill="#d42a22"/></svg>',
  blue: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="5" width="14" height="7" rx="3.5" fill="#f2ece0"/><path d="M4.5 5H8v7H4.5a3.5 3.5 0 0 1 0-7z" fill="#2f6fe0"/></svg>',
  green: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14 2 8a3.3 3.3 0 0 1 6-4 3.3 3.3 0 0 1 6 4z" fill="#3ccf4e"/></svg>',
};
// a hooded silhouette (in the shadows) and a small chest (daily missions) for the buff row
const SHADOW_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5C5 1.5 3.6 4 3.6 6.6V9L2 14.5h12L12.4 9V6.6C12.4 4 11 1.5 8 1.5z" fill="#2a2826" stroke="#b9b4a8" stroke-width="1"/><path d="M5.6 7.6h4.8" stroke="#e9e4d8" stroke-width="1" opacity=".7"/></svg>';
const CHEST_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 7C1.5 3.5 4 2.5 8 2.5S14.5 3.5 14.5 7z" fill="#5a3d1f" stroke="#f0c95a" stroke-width="1"/><rect x="1.5" y="7" width="13" height="7" fill="#6b4a26" stroke="#f0c95a" stroke-width="1"/><rect x="6.6" y="7.8" width="2.8" height="3.2" fill="#f0c95a"/></svg>';
const pillName = (kind, cls) => ({ red: 'Červená pilulka', blue: 'Modrá pilulka', green: 'Zelené srdce' }[kind]);
const pillEffect = (kind, cls) => ({ red: STAT_NAMES.stastie, blue: STAT_NAMES[CLASSES[cls].stat], green: 'Životy' }[kind]);

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
  { id: 'character', name: 'Postava', desc: 'Staty, výbava a vylepšenia tvojej postavy.' },
  { id: 'inventory', name: 'Inventár', desc: 'Všetky predmety, ktoré nosíš so sebou.' },
  { id: 'missions', name: 'Misie', desc: 'Aktívna misia a kde nájdeš zadávateľov.' },
  { id: 'daily', name: 'Denné misie', desc: 'Tri úlohy na mape každý deň a 15-dňový kalendár odmien.' },
  { id: 'events', name: 'Víkendové eventy', desc: 'Každý víkend dva eventy naraz: čo platí teraz a čo príde.' },
  { id: 'policehelp', name: 'Polícia a heat', desc: 'Heat, hviezdy, kontrola, basa, právnička a skrýša na jednom mieste.' },
  { id: 'arena', name: 'Aréna', desc: 'Súboje s inými hráčmi a rebríček.' },
  { id: 'boss', name: 'Boss fights', desc: 'Línia bossov Mesta 1. Kladivo čaká v uličke za obchodmi.' },
  { id: 'gang', name: 'Gang', desc: 'Tvoj gang, pokladnica, členovia a boje o územie.' },
  { id: 'hall', name: 'Sieň slávy', desc: 'Všetci registrovaní hráči. Klikni na hráča a uvidíš jeho staty a výbavu.' },
  { id: 'settings', name: 'Nastavenia', desc: 'Testovací režim a uložená hra.' },
  { id: 'title', name: 'Hlavné menu', desc: 'Späť na úvodnú obrazovku. Hra sa ukladá sama.' },
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
      const t = e.target.closest('[data-act]');
      if (!t || t.disabled) return;
      const fn = this.acts[t.dataset.act];
      if (fn) fn.call(this, t.dataset.arg, t);
    });
    $('#app').addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-desc]');
      const d = $('#menu-desc');
      if (t && d) d.textContent = t.dataset.desc;
    });
    this.el.action.addEventListener('click', () => this.action());
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
    const end = () => { id = null; knob.style.transform = ''; this.input.x = 0; this.input.y = 0; };
    pad.addEventListener('pointerdown', (e) => { id = e.pointerId; pad.setPointerCapture(id); move(e); });
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
    return '<header class="hdr"><button class="back" data-act="back" aria-label="Späť">' + BACK + '</button><h1>' + title + '</h1><span class="right num">' + right + '</span></header>';
  }

  // ---------------------------------------------------------------- HUD & ticking
  tick() {
    const now = Date.now();
    if (this.s.online) this.s.maybeSync();
    document.querySelectorAll('[data-until]').forEach((e) => { e.textContent = clock(Number(e.dataset.until) - now); });
    if (!this.s.hasSave()) return;
    const v = this.s.view();
    $('#hud-lvl').textContent = v.level;
    const lookKey = LOOK_BASE ? JSON.stringify(this.s.p.look || {}) : '';
    if (lookKey && lookKey !== this.hudLook) { this.hudLook = lookKey; $('#hud-face').innerHTML = this.lookHtml(this.s.p.look, 'in-avatar'); }
    $('#hud-cash').textContent = fmt(v.cash);
    $('#hud-chains').textContent = fmt(v.chains);
    const xp = v.xp / v.xpNext;
    $('#hud-xpbar').style.width = Math.min(100, xp * 100) + '%';
    $('#hud-xptext').textContent = pct(xp) + ' XP';
    $('#hud-heatbar').style.width = Math.min(100, v.heat) + '%';
    $('#hud-heatpct').textContent = Math.round(v.heat) + ' %';
    $('#hud-heat').classList.toggle('hot', v.heat >= CONFIG.raidFrom);

    const trk = $('#hud-tracker');
    if (v.jailLeft > 0) {
      trk.hidden = false;
      trk.classList.remove('ready');
      $('#hud-trk-label').textContent = 'Zatknutý';
      $('#hud-trk-name').textContent = 'Pauza od misií';
      $('#hud-trk-time').textContent = clock(v.jailLeft);
    } else if (v.mission) {
      trk.hidden = false;
      trk.classList.toggle('ready', v.mission.ready);
      $('#hud-trk-label').textContent = v.mission.ready ? 'Hotovo · vyzdvihni' : 'Aktívna misia';
      $('#hud-trk-name').textContent = v.mission.name;
      $('#hud-trk-time').textContent = v.mission.ready ? 'odmena čaká' : clock(v.mission.left);
      if (v.mission.ready && !this.readyNotified) {
        this.readyNotified = true;
        this.toast('Misia „' + v.mission.name + '“ je hotová. Vyzdvihni si odmenu.');
        if (this.name === 'missions') this.render();
      }
    } else {
      trk.hidden = true;
    }
    const rp = this.s.reaper();
    const rtag = $('#hud-reaper');
    rtag.hidden = !rp.active;
    if (rp.active) rtag.innerHTML = 'Ripper ukradol tehličku · <b>' + clock(rp.until - Date.now()) + '</b>';
    if (rp.active && !this.reaperWas) this.toast('Ripper ukradol Wexlerovi zlatú tehličku! Zasiahni ho a dobehni, kým neujde.', true);
    this.reaperWas = rp.active;
    const g = this.s.gang();
    if (g && g.log.length && g.log[0].at !== this.lastGangLog) {
      if (this.lastGangLog !== undefined && g.log[0].bad && this.name !== 'war') this.toast('Gang: ' + g.log[0].text, true);
      this.lastGangLog = g.log[0].at;
    }
    this.dailyHud();
    this.hideHud();
    // tabs of features the player has not reached yet look dim (the screen says from which level)
    for (const f of ['arena', 'gang']) $('.tabs [data-arg="' + f + '"]').classList.toggle('locked', !!this.s.locked(f) && !(f === 'gang' && g));
    // wanted stars (0–5): only while the police are interested
    const ws = this.s.wantedStars(), wel = $('#hud-wanted');
    wel.hidden = !ws;
    if (ws) {
      const html = '<b>' + '★'.repeat(ws) + '</b>' + '★'.repeat(5 - ws);
      if (wel.dataset.html !== html) { wel.innerHTML = html; wel.dataset.html = html; }
      wel.classList.toggle('chase', ws >= CONFIG.wantedChase);
    }
    const bl = $('#hud-buffs');
    const chips = this.buffChips();
    bl.hidden = !chips;
    if (chips !== bl.dataset.html) { bl.innerHTML = chips; bl.dataset.html = chips; }
    this.updateAction();
  }

  // ---------------------------------------------------------------- weekend events
  evCard(id, on) {
    const e = EVENTS[id];
    return '<div class="evcard ' + e.tier + (on ? ' on' : '') + '"><span class="ic">' + e.icon + '</span><span class="mid"><span class="t">' + e.name + ' <small>' + (e.tier === 'lepsi' ? 'hlavný' : 'bonus') + '</small></span><span class="s">' + e.desc + '</span></span></div>';
  }

  scr_events() {
    const a = activeEvents(), n = nextEvents();
    let h = '<p class="p">Každý víkend od piatku ' + 18 + ':00 do nedele polnoci bežia dva eventy naraz: jeden hlavný a jeden bonus. Poradie sa opakuje každých ' + EVENT_ROTATION.length + ' týždňov.</p>';
    if (a) {
      h += '<div class="sec sc" style="color:#e8c873">Teraz · ešte <span data-until="' + a.until + '"></span></div>' + a.ids.map((id) => this.evCard(id, true)).join('');
    } else if (n) {
      h += '<div class="sec sc">Najbližší víkend · začína o <span data-until="' + n.from + '"></span></div>' + n.ids.map((id) => this.evCard(id, false)).join('');
    }
    if (a && n) h += '<div class="sec sc">Budúci víkend</div><p class="note" style="text-align:left">' + n.ids.map((id) => EVENTS[id].icon + ' ' + EVENTS[id].name).join(' · ') + '</p>';
    // the whole cycle, the current / next pair marked
    const cur = (a || n || {}).ids;
    h += '<div class="sec sc">Poradie</div><ol class="ladder">' + EVENT_ROTATION.map((pr, i) => '<li class="' + (cur && cur[0] === pr[0] ? 'me' : '') + '"><span>' + (i + 1) + '. ' + EVENTS[pr[0]].name + ' + ' + EVENTS[pr[1]].name + '</span></li>').join('') + '</ol>';
    return { html: this.hdr('Víkendové eventy') + '<div class="body">' + h + '</div>' };
  }

  // ---------------------------------------------------------------- hideout
  // a buff chip while in the shadows; the hiding time is up (or you walked out of the screen): settle it
  hideHud() {
    const h = this.s.hideState();
    if (h.since && !this.hideBusy && (this.s.hidingLeft() <= 0 || (this.name !== 'hideout' && this.name !== 'title'))) this.hideFinish();
    const left = this.s.shadowLeft();
    this.shadowChip = left ? '<span class="buff shadow" title="V tieni: polícia ťa nehľadá">' + SHADOW_ICON + '<small>' + clock(left) + '</small></span>' : '';
  }

  async hideFinish() {
    if (this.hideBusy || !this.s.hideState().since) return;
    this.hideBusy = true;
    const r = await this.s.hideEnd();
    this.hideBusy = false;
    if (!r.ok) return;
    if (r.shadow) this.toast('Teraz sa skrývaš v tieni. Polícia ťa ' + CONFIG.shadowMin + ' minút nebude naháňať.');
    else this.toast('Odišiel si zo skrýše príliš skoro. Polícia ťa stále hľadá.', true);
    if (this.name === 'hideout') this.render();
  }

  scr_hideout() {
    const h = this.s.hideState(), stars = this.s.wantedStars();
    let inner;
    if (h.since) {
      inner = '<span class="sc" style="color:#9b968b">Skrýša</span><span class="bl">Skrývaš sa v tieni</span>' +
        '<span class="clock" data-until="' + (Date.now() + this.s.hidingLeft()) + '"></span>' +
        '<p>Vonku hliadkuje polícia. Vydrž tu ' + CONFIG.hideMin + ' minút a potom ťa ' + CONFIG.shadowMin + ' minút nebude nikto naháňať, ani pri vysokom heate.</p>' +
        '<button class="btn wide" data-act="hide-leave">Odísť skôr (bez ochrany)</button>';
    } else if (this.s.shadowLeft() > 0) {
      inner = '<span class="sc" style="color:#9b968b">Skrýša</span><span class="bl">Si v tieni</span>' +
        '<span class="clock" data-until="' + (Date.now() + this.s.shadowLeft()) + '"></span>' +
        '<p>Polícia ťa teraz nehľadá. Keď čas vyprší, pri vysokom heate ťa začnú znova naháňať.</p>' +
        '<button class="btn gold wide" data-act="back">Vyjsť von</button>';
    } else {
      inner = '<span class="sc" style="color:#9b968b">Skrýša</span><span class="bl">Zadný vchod</span>' +
        '<p>Pivnica bez okien, matrac a zámok z vnútornej strany. Keď ťa hľadá polícia, schovaj sa tu na ' + CONFIG.hideMin + ' minút. Hľadanosť zmizne a ' + CONFIG.shadowMin + ' minút ťa polícia nebude naháňať.</p>' +
        '<p class="num">Hľadanosť teraz: ' + (stars ? '★'.repeat(stars) : 'žiadna') + '</p>' +
        '<button class="btn gold wide" data-act="hide-start"' + (stars < 1 ? ' disabled' : '') + '>Skryť sa</button>' +
        (stars < 1 ? '<p style="font-size:15px">Polícia ťa teraz nehľadá, nie je pred kým sa skrývať.</p>' : '');
    }
    return { html: this.hdr('Skrýša') + '<div class="body" style="padding:0"><div class="hide-scr">' + inner + '</div></div>' };
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
      if (t.type === 'courier' && t.got.length) live.push('kuriér ' + clock(Math.max(0, t.data.pickedAt + v.courierSec * 1000 - Date.now())));
      if ((t.type === 'escape' || t.type === 'razia') && w && w.esc > 0) live.push('útek ' + Math.min(v.escapeSec, Math.floor(w.esc)) + '/' + v.escapeSec + ' s');
      if (t.type === 'sledovanie' && w && w.follow > 0) live.push('sleduješ ' + Math.min(v.followSec, Math.floor(w.follow)) + '/' + v.followSec + ' s');
      if (t.type === 'graffiti' && w && w.spray > 0) live.push('sprej ' + Math.min(v.spraySec, Math.floor(w.spray)) + '/' + v.spraySec + ' s');
    }
    if (live.length) this.dailyChip = '<span class="buff daily" title="Denná misia">' + CHEST_ICON + '<small>' + [...new Set(live)].join(' · ') + '</small></span>';
  }

  // the map stepped on a target / picked a parcel / survived the escape
  async dailyStep(task, step) {
    const r = await this.s.dailyStep(task, step);
    if (!r.ok) { if (!/Príliš rýchlo|Ešte si neušiel|Ešte nie/.test(r.error)) this.toast(r.error, true); return; }
    if (r.started) {
      const type = this.s.dailyMap().tasks[task].type;
      this.toast(type === 'sledovanie' ? 'Sleduješ ho. Drž sa za ním ' + CONFIG.dailyFollowSec + ' sekúnd.' : type === 'graffiti' ? 'Sprejuješ. Nehýb sa.' : 'Útek: vydrž ' + CONFIG.dailyEscapeSec + ' sekúnd, kým ťa policajt nechytí.');
      return;
    }
    if (r.already) return;
    if (r.failed) { this.toast(r.failed, true); return; }
    const t = this.s.dailyMap().tasks[task];
    const T = DAILY_TYPES[t.type];
    if (t.type === 'courier' && r.have === 1) this.toast('Balík máš. Dones ho do ' + CONFIG.dailyCourierSec / 60 + ' minút, sleduj šípku.');
    else this.toast(T.name + ': ' + r.have + ' / ' + r.need + (r.done ? ' · splnené' : ''));
    if (r.reward) this.dailyRewardModal(r.reward);
    if (this.name === 'daily') this.render();
  }

  // a runner / Ripper hit counted for today (the hit's own window shows first)
  dailyAfter(d) {
    if (!d) return;
    this.toast(d.name + ': splnené');
    if (d.reward) this.dailyRewardModal(d.reward);
  }

  dailyRewardText(r) {
    if (r.type === 'cash') return money(r.cash);
    if (r.type === 'level') return 'Nová úroveň';
    if (r.type === 'bars') return r.bars + ' zlatých tehličiek';
    return 'Legendárny predmet + ' + r.bars + ' tehličiek';
  }

  dailyRewardModal(rw) {
    if (this.modalOpen) { this.pendingDaily = rw; return; } // after the window that is open now
    this.modal('<h2 class="win">Denné misie splnené</h2><p class="sub">Deň ' + rw.day + ' z 15</p>' +
      '<div class="rew"><span class="gold">' + this.dailyRewardText(rw) + '</span></div>' + (rw.item ? this.lootHtml(rw.item) : '') + this.levelUpText(rw.levelUps || 0) +
      '<p class="sub" style="font-size:16px;color:#9b968b">Nové úlohy o polnoci.</p><div class="acts"><button class="btn gold" data-act="modal-close">Pokračovať</button></div>');
    if (this.name === 'daily') this.render();
  }

  scr_daily() {
    const v = this.s.dailyView();
    const GROUP = { easy: 'Ľahká', action: 'Akčná', hard: 'Ťažká' };
    let h = '<p class="p">Tri úlohy priamo na mape. Ciele ukazujú zlaté kruhy a šípka na kraji obrazovky. Keď splníš všetky tri, dostaneš odmenu dňa z kalendára.</p>';
    for (const t of v.tasks) {
      const timer = t.type === 'courier' && t.have === 1 && !t.done ? '<div class="s gold">Zostáva <b data-until="' + (t.data.pickedAt + CONFIG.dailyCourierSec * 1000) + '"></b></div>' : '';
      h += '<div class="dtask' + (t.done ? ' done' : '') + '"><div class="top"><span class="t">' + (t.done ? '✓ ' : '') + t.name + '</span><span class="sc g-' + t.group + '">' + GROUP[t.group] + '</span></div>' +
        '<div class="s">' + esc(t.text) + '</div>' + timer +
        '<div class="bar" style="height:6px;margin-top:6px"><i style="width:' + Math.round((t.have / t.need) * 100) + '%"></i></div><div class="num s" style="text-align:right">' + t.have + ' / ' + t.need + '</div></div>';
    }
    h += v.done ? '<p class="note gold">Dnes máš hotovo. Nové úlohy o <span data-until="' + v.nextAt + '"></span>.</p>' : '<p class="note">Úlohy sa menia o polnoci (<span data-until="' + v.nextAt + '"></span>). Vynechaný deň nevadí, kalendár počká.</p>';
    // the 15-day calendar: the day the next finished set pays is highlighted
    const cur = v.done ? v.day - 1 || 15 : v.day;
    h += '<div class="sec sc">Kalendár odmien</div><div class="dcal">' + v.calendar.map((r, k) => {
      const n = k + 1;
      const label = r.type === 'cash' ? money(r.cash) : r.type === 'level' ? '+1 úroveň' : r.type === 'bars' ? r.bars + ' tehl.' : 'Legendárka';
      const cls = (n < v.day ? ' past' : '') + (n === cur && !v.done ? ' now' : '') + (n === cur && v.done ? ' got' : '') + ' t-' + r.type;
      return '<div class="dday' + cls + '"><small>Deň ' + n + '</small><b>' + label + '</b></div>';
    }).join('') + '</div>';
    return { html: this.hdr('Denné misie', 'deň <span class="gold">' + (v.done ? cur : v.day) + '</span> / 15') + '<div class="body">' + h + '</div>' };
  }

  // one chip per pill colour: icon, stacks, time until the next stack runs out
  buffChips() {
    const b = this.s.buffs(), cls = this.s.p.cls, now = Date.now();
    return (this.dailyChip || '') + (this.shadowChip || '') + ['red', 'blue', 'green'].filter((k) => b[k].length).map((k) => {
      const n = b[k].length;
      return '<span class="buff ' + k + '" title="' + pillName(k) + ': +' + pct(CONFIG.pillBoost * n) + ' ' + pillEffect(k, cls) + '">' + PILL_ICON[k] +
        '<b>+' + Math.round(CONFIG.pillBoost * n * 100) + ' %</b><small>' + clock(Math.min(...b[k]) - now) + '</small></span>';
    }).join('');
  }

  async pill(kind) {
    const r = await this.s.takePill(kind);
    if (!this.check(r)) return;
    this.toast(pillName(kind) + ': +' + pct(CONFIG.pillBoost * r.stacks) + ' ' + pillEffect(kind, this.s.p.cls) + (r.refreshed ? ', čas obnovený na hodinu.' : ' na hodinu.'));
    this.tick();
  }

  setPoi(poi) { this.poi = poi; this.updateAction(); }

  updateAction() {
    const show = !!this.poi && !this.paused() && this.s.hasSave();
    this.el.action.hidden = !show;
    this.el.poiTag.hidden = !show;
    if (show) {
      this.el.action.textContent = this.poi.verb;
      let name = this.poi.name;
      if (this.poi.action === 'turf') {
        const v = this.s.turfView().find((x) => x.id === this.poi.arg);
        name += ' · ' + (v.owner ? v.owner.name : 'voľný');
      }
      this.el.poiTag.textContent = name;
    }
    const w = this.s.hasSave() && !this.paused() ? this.s.streetWeapon() : null;
    const atk = $('#attack');
    atk.hidden = !w;
    if (w) atk.textContent = w.attack === 'gun' ? 'Výstrel' : 'Úder';
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
    else this.info(p.name, p.arg);
  }

  async reaperCaught() {
    const r = await this.s.catchRipper();
    if (!this.check(r)) return;
    this.modal('<h2 class="win">Chytil si ho</h2><p class="sub">Ripper ležal na zemi a tehličku pustil.</p><div class="rew"><span class="gold">+1 zlatá tehlička</span></div>' +
      '<p class="sub" style="font-style:italic;font-size:17px;color:#d8d3c7">Wexler: „Dobrá práca. Nechaj si ju, zaslúžil si si ju.“</p>' +
      '<div class="acts"><button class="btn gold" data-act="modal-close">Pokračovať</button></div>');
    this.dailyAfter(r.daily); // the day's reward waits until this window closes
  }

  async runnerHit() {
    const r = await this.s.hitRunner();
    if (!this.check(r)) return;
    if (r.item) {
      this.modal('<h2 class="win">Šťastný zásah</h2><p class="sub">Zmizol v oblaku iskier a niečo po ňom ostalo na zemi.</p>' + this.lootHtml(r.item) +
        '<div class="acts"><button class="btn gold" data-act="modal-close">Pokračovať</button></div>');
    } else {
      this.toast('Zmizol v oblaku iskier. Tentoraz nič nepustil.');
    }
    this.dailyAfter(r.daily);
  }

  // heat bar with the selected mission's share drawn on top
  heatMeter(heat, add) {
    const a = Math.min(100, heat), b = Math.max(0, Math.min(100 - a, add));
    return '<div style="margin:12px 0 4px"><div style="display:flex;justify-content:space-between;font-size:15px" class="num"><span class="red sc">Heat dnes</span><span>' + Math.round(heat) + (add ? ' → ' + Math.round(heat + add) : '') + ' %</span></div>' +
      '<div class="bar hp" style="margin-top:5px;display:flex"><i style="width:' + a + '%"></i><i style="width:' + b + '%;background:rgba(224,53,43,.35)"></i></div></div>';
  }

  toast(msg, bad = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.textContent = msg;
    this.el.toasts.appendChild(t);
    setTimeout(() => t.remove(), 3200);
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
    this.modal('<h2>' + esc(title) + '</h2><p class="sub" style="font-size:17px;color:#c9c4b8">' + esc(text) + '</p><div class="acts"><button class="btn gold" data-act="modal-close">Rozumiem</button></div>');
  }

  // nobody saw you for a while: a star less
  async wantedLose() {
    const r = await this.s.wantedLose();
    if (!r.ok) return;
    this.toast(r.stars ? 'Polícia stratila stopu. Hľadanosť klesla.' : 'Stratil si sa polícii. Nikto ťa nehľadá.');
  }

  // an officer on foot went down: more come, maybe an epic item, maybe a raid step
  async copDown() {
    const r = await this.s.copDown();
    if (!r.ok) return; // the chase already ended
    this.toast('Policajt na zemi. Teraz ťa naháňa ' + r.wanted + ' policajtov.', true);
    if (r.item) {
      this.modal('<h2 class="win">Z policajta niečo vypadlo</h2><p class="sub">Na zemi ostal epický kus.</p>' + this.lootHtml(r.item) +
        '<div class="acts"><button class="btn gold" data-act="modal-close">Pokračovať</button></div>');
    }
    if (r.daily) {
      if (r.daily.have < r.daily.need) this.toast(r.daily.name + ': ' + r.daily.have + ' / 2 policajti' + (r.daily.have >= 2 ? '. Teraz ujdi!' : ''));
      if (r.daily.reward) this.dailyRewardModal(r.daily.reward);
    }
  }

  police() {
    if (this.paused() || !this.s.hasSave()) return;
    const v = this.s.view();
    // an officer is down: no bribe, no running; half your cash, or a while without missions
    if (this.s.copKills() > 0) {
      this.modal('<h2 class="lose">Zatknutý</h2><p class="sub">Zložil si policajta. Tentoraz sa to nedá vybaviť pokutou.</p>' +
        '<div class="acts">' +
        '<button class="btn wide" data-act="police-killer" data-arg="peniaze">Prísť o ' + Math.round(CONFIG.killCashShare * 100) + ' % peňazí · ' + money(this.s.killCashLoss()) + '</button>' +
        '<button class="btn wide" data-act="police-killer" data-arg="basa">' + hours(CONFIG.killJailMin) + ' bez misií od Dona a Dílera</button>' +
        '</div><p class="sub" style="font-size:15px;color:#9b968b">Denné misie môžeš robiť aj v base.</p>');
      return;
    }
    this.modal(
      '<h2 class="lose">Kontrola</h2><p class="sub">Policajt ťa chytil. Potom bude ' + Math.round(CONFIG.caughtPeaceSec / 60) + ' minút pokoj.</p>' +
      '<div class="acts">' +
      '<button class="btn wide" data-act="police" data-arg="utiect">Utiecť · Obratnosť ' + pct(this.s.policeRunChance()) + '</button>' +
      '<button class="btn wide" data-act="police" data-arg="podplatit">Podplatiť · ' + money(this.s.policeBribeCost()) + '</button>' +
      '<button class="btn wide" data-act="police" data-arg="vzdat">Vzdať sa · ' + CONFIG.jailMinutes + ' min bez misií</button>' +
      '</div>'
    );
  }

  levelUpText(n) {
    return n > 0 ? '<p class="sub gold" style="font-size:18px">Nová úroveň ' + this.s.p.level + '! +' + n * CONFIG.pointsPerLevel + ' voľné body.</p>' : '';
  }

  itemName(it) { return ITEM_BASES[it.base].name + (it.upgrade ? ' +' + it.upgrade : ''); }

  bonusText(it) {
    const b = this.s.itemBonus(it);
    const car = ITEM_BASES[it.base].car;
    return (car ? ['Heat −' + pct(car.heat), 'čas misií −' + pct(car.time)] : []).concat(Object.entries(b).map(([k, v]) => (k === 'dmg' ? 'Zbraň +' + v : k === 'armor' ? 'Brnenie +' + v : STAT_NAMES[k] + ' +' + v))).join(' · ');
  }

  // flavour text of an item (ITEM_BASES desc)
  descHtml(it) {
    const d = ITEM_BASES[it.base] && ITEM_BASES[it.base].desc;
    return d ? '<div class="desc">' + esc(d) + '</div>' : '';
  }

  lootHtml(it) {
    const r = rar(it.rarity);
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
        const name = ($('#name-input') && $('#name-input').value.trim()) || (this.s.online ? '' : 'Ty');
        if (this.s.hasSave() && !confirm('Naozaj začať odznova? Uložená hra sa zmaže.')) return;
        if (!this.check(await this.s.newGame(name, this.sel.cls))) return;
        this.sel.newGame = false;
        this.readyNotified = false;
        this.close();
        this.info('Vitaj v Meste 1', 'Choď za Donom do parku (biela bublina „!“) a vezmi si prvú misiu. Pohyb: joystick vľavo dole alebo klávesy WASD, akcia: tlačidlo vpravo alebo E.');
      },
      async continue() { this.close(); },
      async spend(a) { if (this.check(await this.s.spendPoint(a))) this.render(); },
      async 'buy-stat'(a) { if (this.check(await this.s.buyStat(a))) this.render(); },
      async slot(a) {
        if (a === 'auto' && this.s.p.level < CONFIG.autoUnlockLevel) { this.toast('Auto sa odomyká na úrovni ' + CONFIG.autoUnlockLevel + '.'); return; }
        this.open('inventory', a, true);
      },
      async equip(a) { if (this.check(await this.s.equip(a))) this.render(); },
      async unequip(a) { if (this.check(await this.s.unequip(a))) this.render(); },
      async sell(a) {
        const r = await this.s.sellItem(a);
        if (this.check(r)) { this.toast('Predané za ' + money(r.gain) + '.'); this.render(); }
      },
      async upgrade(a) { const r = await this.s.upgradeItem(a); if (this.check(r)) { this.toast('Vylepšené za ' + money(r.cost) + '.'); this.render(); } },
      async offer(a) { this.sel.offer = a; this.render(); },
      async accept() {
        const r = await this.s.startMission(this.arg, this.sel.offer);
        if (this.check(r)) { this.readyNotified = false; this.toast('Misia beží. Medzitým sa môžeš túlať mestom.'); this.close(); }
      },
      async skip() { const r = await this.s.skipMission(); if (this.check(r)) { this.render(); } },
      async claim() {
        const r = await this.s.claimMission();
        if (!this.check(r)) return;
        this.readyNotified = false;
        this.open('fight', { kind: 'mission', ...r, artB: r.b.portrait, title: r.b.name, subtitle: r.b.title, intro: r.story.hit }, true);
      },
      async 'buy-elixir'() { if (this.check(await this.s.buyElixir())) { this.toast('Čierny trh je otvorený na ' + CONFIG.elixirHours + ' hodín.'); this.render(); } },
      async 'shop-reroll'(a) { if (this.check(await this.s.rerollShop(a))) { this.toast('Nový tovar je v obchode.'); this.render(); } },
      async 'buy-item'(a) {
        const r = await this.s.buyItem(this.arg, a);
        if (this.check(r)) { this.toast('Kúpené: ' + this.itemName(r.item) + '.'); this.render(); }
      },
      async lawyer() { const r = await this.s.lawyer(); if (this.check(r)) { this.toast('Heat znížený o ' + CONFIG.lawyerHeat + ' %. Dnes ešte ' + this.s.lawyerLeft() + '×.'); this.render(); } },
      async 'boss-fight'() {
        const r = await this.s.fightBoss();
        if (!this.check(r)) return;
        const b = this.s.bossInfo();
        this.open('fight', { kind: 'boss', ...r, artB: r.b.portrait || 'kladivo', silhouette: !r.b.portrait, title: r.b.name, subtitle: r.b.title, next: b }, true);
      },
      async 'arena-fight'(a) {
        const opp = this.s.arena().opponents[Number(a)];
        const r = await this.s.fightArena(Number(a));
        if (!this.check(r)) return;
        this.open('fight', { kind: 'arena', ...r, artB: BOT_ART[opp.cls] || 'maska', focusB: BOT_FOCUS[opp.cls], title: opp.name, subtitle: CLASSES[opp.cls].name + ' · úroveň ' + opp.level }, true);
      },
      async 'arena-new'() { if (this.check(await this.s.refreshArena())) this.render(); },
      async 'fight-skip'() { this.finishFight(true); },
      async 'war-skip'() { this.finishWar(true); },
      async 'fight-done'() { this.closeModal(); this.back(); },
      async police(a) {
        const r = await this.s.policeCheck(a);
        if (!this.check(r)) return;
        const x = r.result;
        const msg = { escaped: 'Ušiel si. Heat +5.', caught: 'Chytili ťa. Pokuta ' + money(x.fine || 0) + ' a ' + CONFIG.jailMinutes + ' min bez misií.', bribed: 'Policajt zobral ' + money(x.cost || 0) + ' a odišiel.', jail: 'Vzdal si sa. ' + CONFIG.jailMinutes + ' min bez misií.' }[x.type];
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
        this.toast(x.type === 'cash' ? 'Zobrali ti ' + money(x.lost) + '.' : hours(x.minutes) + ' bez misií od Dona a Dílera.', true);
      },
      async 'test-mode'() { await this.s.setTestMode(!this.s.state.settings.testMode); this.render(); },
      async 'test-bm'() { await this.s.setBlackMarket(!this.s.state.settings.blackMarket); this.render(); },
      async 'buy-bars'(a) {
        const r = await this.s.buyBars(Number(a));
        if (this.check(r)) { this.toast('+' + r.bars + ' zlatých tehličiek (testovacia kúpa).'); this.render(); }
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
      async 'look-save'() { if (this.check(await this.s.setLook(this.sel.look))) { this.toast('Vzhľad uložený.'); this.back(); } },
      async 'gang-color'(a) { this.sel.gangName = $('#gang-name').value; this.sel.gangTag = $('#gang-tag').value; this.sel.gangColor = a; this.render(); },
      async 'gang-create'() {
        const r = await this.s.createGang($('#gang-name').value, $('#gang-tag').value, this.sel.gangColor || 'gold');
        if (this.check(r)) { this.toast('Gang založený za ' + money(r.cost) + '.'); this.render(); }
      },
      async deposit(a) { const r = await this.s.deposit(Number(a)); if (this.check(r)) { this.toast('Vložené do pokladnice: ' + money(r.amount) + '.'); this.render(); } },
      async 'gang-ask'(a) { if (this.check(await this.s.requestJoin(a))) { this.toast('Žiadosť odoslaná. Počkaj, kým ju šéf schváli.'); this.render(); } },
      async 'gang-unask'(a) { if (this.check(await this.s.cancelRequest(a))) this.render(); },
      async 'gang-accept'(a) { const r = await this.s.acceptInvite(a); if (this.check(r)) { this.toast('Si v gangu ' + r.name + '.'); this.render(); } },
      async 'gang-decline'(a) { if (this.check(await this.s.declineInvite(a))) this.render(); },
      async 'gang-approve'(a) {
        const r = await this.s.approveJoin(a);
        if (!this.check(r)) return;
        this.toast(r.gone ? 'Tento hráč je už v inom gangu.' : r.name + ' je nový člen gangu.');
        this.render();
      },
      async 'gang-deny'(a) { if (this.check(await this.s.denyJoin(a))) this.render(); },
      async 'gang-invite'() {
        const name = ($('#gang-invite') && $('#gang-invite').value.trim()) || '';
        if (!name) return;
        const r = await this.s.invitePlayer(name);
        if (this.check(r)) { this.toast('Pozvánka pre ' + r.name + ' odoslaná.'); this.render(); }
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
      async 'gang-lead'(a) { if (this.check(await this.s.transferLead(a))) { this.closeModal(); this.toast('Vedenie gangu je odovzdané.'); this.render(); } },
      async 'gang-kick'(a) { const r = await this.s.kickMember(a); if (this.check(r)) { this.closeModal(); this.toast(r.name + ' už nie je v gangu.', true); this.render(); } },
      async 'gang-leave'() {
        this.modal('<h2>Odísť z gangu?</h2><p class="sub">' + (this.s.gang().members.length <= 1 ? 'Si posledný člen, gang sa tým rozpustí a jeho objekty ostanú voľné.' : this.s.myRank() === 'boss' ? 'Vedenie prevezme pravá ruka alebo najstarší člen.' : 'Do gangu sa môžeš vrátiť len na novú žiadosť.') + '</p>' +
          '<div class="acts"><button class="btn" data-act="modal-close">Zostať</button><button class="btn gold" data-act="gang-leave-yes">Odísť</button></div>');
      },
      async 'gang-leave-yes'() { if (this.check(await this.s.leaveGang())) { this.closeModal(); this.sel.gangList = null; this.toast('Už nie si v gangu.'); this.render(); } },
      async 'gang-disband'() {
        this.modal('<h2>Rozpustiť gang?</h2><p class="sub">Všetci členovia budú bez gangu, pokladnica prepadne a objekty gangu ostanú voľné. Nedá sa to vrátiť.</p>' +
          '<div class="acts"><button class="btn" data-act="modal-close">Nie</button><button class="btn gold" data-act="gang-disband-yes">Rozpustiť</button></div>');
      },
      async 'gang-disband-yes'() { if (this.check(await this.s.disbandGang())) { this.closeModal(); this.sel.gangList = null; this.toast('Gang je rozpustený.', true); this.render(); } },
      async 'gang-up'(a) { if (this.check(await this.s.buyGangUpgrade(a))) { this.toast('Vylepšené.'); this.render(); } },
      async turf(a) { this.open('turf', a, true); },
      async 'turf-refill'() { const r = await this.s.refillTurf(this.arg); if (this.check(r)) { this.toast('Obrana doplnená za ' + money(r.cost) + '.'); this.render(); } },
      async 'turf-def'(a) { if (this.check(await this.s.toggleDefender(this.arg, a || undefined))) this.render(); },
      async 'turf-attack'() {
        const r = await this.s.attackTurf(this.arg);
        if (!this.check(r)) return;
        if (!r.D.length) { this.toast(r.turf.name + ' je váš. ' + money(r.result.cash) + ', +' + fmt(r.result.xp) + ' XP.'); this.render(); return; }
        this.open('war', r, true);
      },
      // online account
      async login(mode) {
        const email = $('#auth-email').value.trim(), pass = $('#auth-pass') ? $('#auth-pass').value : '';
        this.sel.authEmail = email;
        if (!email) { this.toast('Zadaj email.', true); return; }
        if (mode === 'reset') { const r = await this.s.resetPassword(email); if (this.check(r)) this.info('Obnova hesla', 'Poslali sme ti email s odkazom na nové heslo.'); return; }
        const r = mode === 'up' ? await this.s.signUp(email, pass) : await this.s.signIn(email, pass);
        if (!this.check(r)) return;
        if (r.confirm) { this.info('Potvrď email', 'Na ' + email + ' sme poslali odkaz. Po potvrdení sa tu prihlás.'); this.sel.authMode = 'in'; this.render(); return; }
        this.render();
      },
      async 'auth-mode'(a) { this.sel.authEmail = $('#auth-email') ? $('#auth-email').value : ''; this.sel.authMode = a; this.render(); },
      async logout() { await this.s.signOut(); this.open('title'); },
      async reset() {
        if (!confirm(this.s.online ? 'Naozaj zmazať postavu na serveri? Tento krok sa nedá vrátiť.' : 'Naozaj zmazať uloženú hru? Tento krok sa nedá vrátiť.')) return;
        if (this.s.online) await this.s.deleteCharacter(); else this.s.reset();
        this.sel.newGame = true;
        this.open('title');
      },
    };
  }

  // ---------------------------------------------------------------- screens
  scr_title() {
    const has = this.s.hasSave();
    // the poster carries the logo, so the title shows only the tagline under it
    let inner = '<h1 class="logo sr">Hits &amp; Licks</h1><p class="tag">Od pešiaka po bossa mesta</p>';
    const evNow = activeEvents();
    if (evNow) inner += '<div class="ev-banner">' + evNow.ids.map((id) => EVENTS[id].icon + ' ' + EVENTS[id].name).join(' · ') + '<small>Víkendový event</small></div>';
    if (this.s.online && !this.s.loggedIn()) {
      const mode = this.sel.authMode || 'in';
      inner += '<div class="field"><label for="auth-email">Email</label><input id="auth-email" type="email" autocomplete="email" value="' + esc(this.sel.authEmail || '') + '"></div>';
      if (mode !== 'reset') inner += '<div class="field"><label for="auth-pass">Heslo' + (mode === 'up' ? ' (aspoň 6 znakov)' : '') + '</label><input id="auth-pass" type="password" autocomplete="' + (mode === 'up' ? 'new-password' : 'current-password') + '"></div>';
      inner += '<button class="btn gold wide" data-act="login" data-arg="' + mode + '">' + { in: 'Prihlásiť sa', up: 'Vytvoriť účet', reset: 'Poslať odkaz na nové heslo' }[mode] + '</button>';
      inner += '<div class="menu" style="margin-top:6px">' + (mode !== 'in' ? '<button data-act="auth-mode" data-arg="in">Mám účet, prihlásiť sa</button>' : '<button data-act="auth-mode" data-arg="up">Nový hráč? Vytvoriť účet</button><button data-act="auth-mode" data-arg="reset">Zabudnuté heslo</button>') + '</div>';
    } else if (has && !this.sel.newGame) {
      const p = this.s.p;
      inner += '<div class="orn"><i></i></div><div class="menu">' +
        '<button class="sel" data-act="continue">Pokračovať</button>' +
        (this.s.online ? '' : '<button data-act="new-game">Nová hra</button>') +
        '<button data-act="menu-go" data-arg="settings">Nastavenia</button></div><div class="orn"><i></i></div>' +
        '<p class="note" style="color:#b9b4a8;font-size:16px">' + esc(p.name) + ' · úroveň ' + p.level + ' · ' + CLASSES[p.cls].name + '</p>';
    } else {
      inner += '<div class="field"><label for="name-input">Prezývka</label><input id="name-input" maxlength="16" placeholder="' + (this.s.online ? 'aspoň 3 znaky' : 'Ty') + '" autocomplete="off" value="' + esc(this.sel.newName || '') + '"></div>';
      inner += '<div class="classes">' + Object.entries(CLASSES).map(([id, c]) =>
        '<button class="' + (this.sel.cls === id ? 'sel' : '') + '" data-act="pick-class" data-arg="' + id + '"><span class="bl">' + c.name + '</span><small>' + STAT_NAMES[c.stat] + '</small></button>').join('') + '</div>';
      if (CLASS_ART[this.sel.cls]) inner += '<img class="cls-art" src="' + art(CLASS_ART[this.sel.cls]) + '" alt="' + CLASSES[this.sel.cls].name + '" style="object-position:' + (BOT_FOCUS[this.sel.cls] || '50% 20%') + '">';
      inner += '<p class="note" style="margin:0 0 12px;color:#b9b4a8;font-size:16px">' + CLASSES[this.sel.cls].blurb + '</p>';
      inner += '<button class="btn gold wide" data-act="start-game">Začať</button>';
      if (has) inner += '<button class="btn wide" style="margin-top:8px" data-act="cancel-new">Späť</button>';
    }
    return {
      html: '<div class="title-scr"><div class="poster"><img src="' + art('photo_title') + '" alt="Hits &amp; Licks: traja chlapi z gangu v nočnej ulici"></div><div class="inner">' + inner + '</div></div>',
    };
  }

  scr_menu() {
    return {
      overlay: true,
      html: '<button class="menu-x" data-act="back" aria-label="Zavrieť menu">' + BACK + '<span>Späť</span></button>' +
        '<div class="pause">' +
        '<svg width="300" height="26" viewBox="0 0 330 26" aria-hidden="true"><path d="M0 13 H128" stroke="#e9e4d8" stroke-opacity=".4"/><path d="M202 13 H330" stroke="#e9e4d8" stroke-opacity=".4"/><path d="M128 13 C136 4 146 4 150 13 C146 22 136 22 128 13 Z M202 13 C194 4 184 4 180 13 C184 22 194 22 202 13 Z M165 3 L175 13 L165 23 L155 13 Z" fill="none" stroke="#c9a24a"/><circle cx="165" cy="13" r="2.2" fill="#c9a24a"/></svg>' +
        '<h2 class="sc" style="margin:8px 0 6px;font-weight:500;font-size:18px;letter-spacing:4px;color:#b9b4a8">Menu</h2>' +
        '<div class="menu">' + MENU.map((m, i) => {
          const lv = (m.id === 'arena' || (m.id === 'gang' && !this.s.gang())) ? this.s.locked(m.id) : 0;
          const note = m.locked ? 'od verzie 2' : lv ? 'od úrovne ' + lv : '';
          return '<button class="' + (i === 0 ? 'sel' : '') + (m.locked || lv ? ' locked' : '') + '" data-act="menu-go" data-arg="' + m.id + '" data-desc="' + esc(m.desc) + '">' + m.name + (note ? ' <small style="font-size:14px;font-style:italic">· ' + note + '</small>' : '') + '</button>';
        }).join('') + '</div>' +
        '<p class="desc" id="menu-desc">' + MENU[0].desc + '</p>' +
        '<div class="hints"><span><i class="dot"></i>Ťukni: vybrať</span><span><i class="dot o"></i>Späť: zavrieť</span></div>' +
        '<button class="btn" style="margin-top:16px" data-act="back">Zavrieť</button></div>',
    };
  }

  scr_character() {
    const p = this.s.p, v = this.s.view(), ts = this.s.totalStats();
    const slotHtml = (id) => {
      const s = SLOTS.find((x) => x.id === id);
      const it = p.equipment[id] && this.s.item(p.equipment[id]);
      let box;
      if (it) box = '<span class="box rar-' + it.rarity + '"><img src="' + art(ITEM_BASES[it.base].art) + '" alt="' + esc(this.itemName(it)) + '">' + (it.upgrade ? '<span class="up">+' + it.upgrade + '</span>' : '') + '</span>';
      else if (id === 'auto' && p.level < CONFIG.autoUnlockLevel) box = '<span class="box empty" style="font-size:12px;font-style:italic;color:#4f4c46">od Lv ' + CONFIG.autoUnlockLevel + '</span>';
      else box = '<span class="box empty">+</span>';
      return '<button class="slot" data-act="slot" data-arg="' + id + '">' + box + '<small>' + s.name + '</small></button>';
    };
    const w = this.s.weaponDmg();
    const me = this.s.playerFighter();
    const hb = F.hitOf(me);
    const c = CLASSES[p.cls];
    const special = c.pierce ? ' · úder ignoruje brnenie' : c.dodge ? ' · úhyb 50 % proti Svalovcom' : c.block ? ' · blok ' + pct(c.block.zlodej) + ' proti Zlodejom, ' + pct(c.block.dealer) + ' proti Dealerom' : '';
    let rows = '';
    for (const st of STATS) {
      const bonus = ts[st] - p.stats[st];
      const cost = this.s.statCost(st);
      const isCls = CLASSES[p.cls].stat === st;
      rows += '<div class="statrow' + (isCls ? ' cls' : '') + '"><span class="n sc">' + STAT_NAMES[st] + (isCls ? ' <small style="font-variant-caps:normal;letter-spacing:0;font-style:italic;color:#9b968b">· triedny, dvíha úder</small>' : '') + '</span>' +
        '<span class="v">' + ts[st] + (bonus ? '<small>+' + bonus + '</small>' : '') + '</span>' +
        (p.points > 0 ? '<button class="btn small gold" data-act="spend" data-arg="' + st + '" aria-label="Pridať bod do ' + STAT_NAMES[st] + '">+1</button>' : '') +
        '<button class="btn small num" style="min-width:96px" data-act="buy-stat" data-arg="' + st + '"' + (p.cash < cost ? ' disabled' : '') + '>+ ' + money(cost) + '</button></div>';
    }
    return {
      html: this.hdr('Postava', 'Úroveň <span class="gold">' + p.level + '</span> · ' + CLASSES[p.cls].name) +
        '<div class="body"><div class="char">' +
        '<div class="slots">' + ['zbran', 'bunda', 'nohavice', 'topanky'].map(slotHtml).join('') + '</div>' +
        '<div class="portrait">' + (LOOK_BASE ? this.lookHtml(p.look, 'in-portrait') : '<img src="' + art('maska') + '" alt="Tvoja postava">') + (LOOK_BASE ? '<button class="btn small look-edit" data-act="open-look">Vzhľad</button>' : '') + '<div class="cap"><span class="bl" style="font-size:32px;color:#efe9dc">' + esc(p.name) + '</span><span class="sc" style="font-size:13px;color:#9b968b">Pešiak · Mesto 1</span></div></div>' +
        '<div class="slots">' + ['retiazka', 'prsten', 'hodinky', 'auto'].map(slotHtml).join('') + '</div></div>' +
        '<div style="margin-top:12px"><div style="display:flex;justify-content:space-between;font-size:15px;color:#9b968b" class="num"><span>Skúsenosti</span><span style="color:#e9e4d8">' + fmt(v.xp) + ' / ' + fmt(v.xpNext) + '</span></div><div class="bar" style="height:8px;margin-top:4px"><i style="width:' + Math.min(100, (v.xp / v.xpNext) * 100) + '%"></i></div></div>' +
        '<p class="note num" style="text-align:left;color:#b9b4a8;font-size:15px">Životy ' + fmt(this.s.maxHp()) + ' · úder ' + Math.round(hb * 0.85) + '–' + Math.round(hb * 1.15) + ' · krit ' + pct(F.crit(ts.stastie, p.level)) + ' · brnenie ' + pct(F.reduction(ts.armor, p.level, p.cls)) + ' (max ' + pct(c.armorCap) + ')' + special + '</p>' +
        (this.buffChips() ? '<div class="buffs-list">' + this.buffChips() + '</div>' : '') +
        '<div style="margin-top:8px;border-top:1px solid var(--line)">' + rows + '</div>' +
        (p.points > 0 ? '<p class="note gold" style="font-size:16px">Voľné body: ' + p.points + '</p>' : '<p class="note">Staty si dokupuješ za peniaze, cena s každým bodom rastie.</p>') +
        '</div>',
    };
  }

  // hall of fame: registered players, highest level first; a tap opens their profile
  // two tabs: players (highest level first) and gangs (most Gang Wars wins first)
  scr_hall(list) {
    list = list || [];
    const tab = this.sel.hallTab || 'players';
    const tabs = '<div class="seg"><button class="' + (tab === 'players' ? 'on' : '') + '" data-act="hall-tab" data-arg="players">Hráči</button><button class="' + (tab === 'gangs' ? 'on' : '') + '" data-act="hall-tab" data-arg="gangs">Gangy</button></div>';
    let rows, count;
    if (tab === 'gangs') {
      const gl = this.sel.hallGangs || { list: [], mine: null };
      count = gl.list.length + ' gangov';
      rows = gl.list.map((x, i) => '<div class="hrow ghrow' + (x.id === gl.mine ? ' me' : '') + '"><span class="num rk">' + (i + 1) + '.</span><span class="nm">' + this.tagBox(x) + ' ' + esc(x.name) + (x.id === gl.mine ? ' <small>· tvoj</small>' : '') + '</span>' +
        '<span class="cl num">' + x.members + ' čl.</span><span class="num lv">' + x.wins + ' výh.</span></div>').join('');
      if (!rows) rows = '<p class="p">Zatiaľ tu nie je žiadny gang.</p>';
    } else {
      count = list.length + ' hráčov';
      rows = list.map((r, i) => '<button class="hrow' + (r.me ? ' me' : '') + '" data-act="profile" data-arg="' + esc(r.id) + '">' +
        '<span class="num rk">' + (i + 1) + '.</span><span class="nm">' + esc(r.name) + (r.me ? ' <small>· ty</small>' : '') + '</span>' +
        '<span class="cl">' + (CLASSES[r.cls] ? CLASSES[r.cls].name : '') + '</span><span class="num lv">úr. ' + r.level + '</span></button>').join('') || '<p class="p">Zatiaľ tu nikto nie je.</p>';
    }
    return {
      html: this.hdr('Sieň slávy', count) + '<div class="body">' + tabs + rows +
        (tab === 'gangs' ? '<p class="note">Poradie podľa vyhratých bojov o územie (Gang Wars).</p>' : '') +
        (this.s.online ? '' : '<p class="note">Offline hra: ostatných hráčov a gangy uvidíš po prihlásení.</p>') + '</div>',
    };
  }

  // another player's card: look, stats with gear and every worn item
  scr_profile(pr) {
    const bonusStr = (b) => Object.entries(b).map(([k, v]) => (k === 'dmg' ? 'Zbraň +' + v : k === 'armor' ? 'Brnenie +' + v : STAT_NAMES[k] + ' +' + v)).join(' · ');
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
      return '<div class="item rar-' + it.rarity + '"><img src="' + art(base.art) + '" alt=""><div class="mid"><div class="t">' + esc(base.name) + (it.upgrade ? ' +' + it.upgrade : '') + '</div><div class="s"><span style="color:' + r.color + '">' + r.name + '</span> · úr. ' + it.level + ' · ' + s.name + '</div><div class="s" style="color:#c9c4b8">' + bonusStr(it.bonus) + '</div></div></div>';
    }).join('');
    return {
      html: this.hdr(esc(pr.name), 'Úroveň <span class="gold">' + pr.level + '</span> · ' + (c ? c.name : '')) +
        '<div class="body"><div class="char">' +
        '<div class="slots">' + ['zbran', 'bunda', 'nohavice', 'topanky'].map(slotHtml).join('') + '</div>' +
        '<div class="portrait">' + (LOOK_BASE ? this.lookHtml(pr.look, 'in-portrait') : '<img src="' + art('maska') + '" alt="">') + '<div class="cap"><span class="bl" style="font-size:32px;color:#efe9dc">' + esc(pr.name) + '</span><span class="sc" style="font-size:13px;color:#9b968b">' + (c ? c.name : '') + ' · úroveň ' + pr.level + '</span></div></div>' +
        '<div class="slots">' + ['retiazka', 'prsten', 'hodinky', 'auto'].map(slotHtml).join('') + '</div></div>' +
        '<p class="note num" style="text-align:left;color:#b9b4a8;font-size:15px">Životy ' + fmt(pr.hp) + ' · zbraň ' + fmt(pr.weapon) + ' · brnenie ' + fmt(pr.armor) + '</p>' +
        '<div style="margin-top:8px;border-top:1px solid var(--line)">' + stats + '</div>' +
        '<div class="sec sc">Výbava</div>' + (items || '<p class="p">Nemá nasadenú žiadnu výbavu.</p>') +
        '</div>',
    };
  }

  scr_inventory(slot) {
    const p = this.s.p;
    const list = p.inventory.filter((i) => !slot || i.slot === slot)
      .sort((a, b) => SLOTS.findIndex((s) => s.id === a.slot) - SLOTS.findIndex((s) => s.id === b.slot) || b.power - a.power);
    const title = slot ? SLOTS.find((s) => s.id === slot).name : 'Inventár';
    let h = '';
    for (const it of list) {
      const r = rar(it.rarity);
      const on = p.equipment[it.slot] === it.id;
      h += '<div class="item rar-' + it.rarity + '"><img src="' + art(ITEM_BASES[it.base].art) + '" alt=""><div class="mid"><div class="t">' + this.itemName(it) + (on ? ' <span class="sc gold" style="font-size:13px">· nasadené</span>' : '') + '</div>' +
        '<div class="s"><span style="color:' + r.color + '">' + r.name + '</span> · úr. ' + it.level + ' · ' + SLOTS.find((s) => s.id === it.slot).name + '</div><div class="s" style="color:#c9c4b8">' + this.bonusText(it) + '</div>' + this.descHtml(it) + '</div>' +
        '<div class="acts">' + (on ? '<button class="btn small" data-act="unequip" data-arg="' + it.slot + '">Zložiť</button>' : '<button class="btn small gold" data-act="equip" data-arg="' + it.id + '">Nasadiť</button>') +
        '<button class="btn small num" data-act="sell" data-arg="' + it.id + '">Predať ' + money(Math.round(it.price * 0.25 * (1 + 0.2 * it.upgrade))) + '</button></div></div>';
    }
    if (!list.length) h = '<p class="p">Nemáš žiadne predmety' + (slot ? ' pre tento slot' : '') + '. Kúp ich v obchodoch na ulici: Zbrane, Oblečenie, Šperky (sever štvrte). Niekedy padnú aj z misií a bossov.</p>';
    return { html: this.hdr(title, money(p.cash)) + '<div class="body">' + h + '</div>' };
  }

  scr_missions(giverId) {
    const v = this.s.view();
    const m = this.s.state.mission;
    if (!giverId) {
      const dv = this.s.dailyMap();
      const dn = dv.tasks.filter((t) => t.done).length;
      let h = '<button class="card daily-card" data-act="open" data-arg="daily"><span class="dbadge">D</span><span class="mid"><span class="t">Denné misie</span><span class="s">' +
        (dv.done ? 'Dnes hotovo · nové o polnoci' : dn + ' / ' + dv.tasks.length + ' splnené · úlohy na mape') + '</span></span><span class="end"><span class="s">deň ' + this.s.dailyDayNow() + ' / 15</span></span></button>' +
        (() => { const a = activeEvents(); return a ? '<button class="card" data-act="open" data-arg="events"><span class="dbadge" style="color:#e8c873;border-color:#e8c873">' + EVENTS[a.ids[0]].icon + '</span><span class="mid"><span class="t">Víkendový event</span><span class="s">' + a.ids.map((id) => EVENTS[id].name).join(' · ') + '</span></span><span class="end"><span class="s">ešte <span data-until="' + a.until + '"></span></span></span></button>' : ''; })() +
        '<p class="p">Misie zadávajú postavy v meste. Hľadaj bielu bublinu „!“ nad hlavou. Každá misia sa končí súbojom.</p>' +
        '<div class="card" style="cursor:default"><img class="ph" src="' + art('photo_don') + '" alt=""><div class="mid"><span class="t">Don</span><span class="s">Park v strede štvrte, pri fontáne</span></div></div>' +
        '<div class="card" style="cursor:default"><img class="ph" src="' + art('photo_diler') + '" alt=""><div class="mid"><span class="t">Díler</span><span class="s">Chodník pri corneri, západ štvrte</span></div></div>';
      if (v.jailLeft > 0) h += '<p class="warn" style="padding:8px 10px;border:1px solid rgba(168,35,28,.6);color:#e6a49c">Si zatknutý. Misie až o <b data-until="' + this.s.state.jailUntil + '"></b>.</p>';
      return { html: this.hdr('Misie', money(v.cash)) + '<div class="body">' + h + '</div>' };
    }
    const g = GIVERS[giverId];
    let h = this.hdr('Misie', money(v.cash)) + '<section class="giver photo"><img src="' + art(g.photo) + '" alt="' + g.name + '" style="object-position:' + g.focus + '"><div class="shade"></div><div class="txt"><span class="bl" style="font-size:34px;color:#efe9dc">' + g.name + '</span><q>' + g.quote + '</q><span class="sc" style="font-size:13px;color:#b9b4a8">' + g.title + '</span></div></section><div class="body">';
    if (m) {
      const t = MISSIONS[m.tpl];
      const ready = Date.now() >= m.endsAt;
      const story = t.stories[m.v || 0] || t.stories[0];
      h += '<div class="card sel" style="cursor:default"><img src="' + art(t.art) + '" alt=""><div class="mid"><span class="t">' + t.name + '</span><span class="s">' + (m.giver !== giverId ? 'od: ' + GIVERS[m.giver].name + ' · ' : '') + 'na konci súboj: ' + esc(story.foe.name) + '</span></div><div class="end"><span class="gold" style="font-size:18px">' + money(m.cash) + '</span><span class="s">' + fmt(m.xp) + ' XP</span></div></div>';
      h += '<p class="story">' + story.text + '</p>';
      if (ready) {
        h += '<button class="btn gold wide" style="margin-top:6px" data-act="claim">Dokončiť misiu · súboj</button>';
      } else {
        h += '<p class="p" style="text-align:center;margin-top:10px">Misia beží, hotovo o <b class="gold num" data-until="' + m.endsAt + '"></b></p>';
        h += '<button class="btn wide" data-act="skip">Skrátiť za ' + this.s.skipCost() + ' zlatých tehličiek</button>';
        h += '<p class="note">Kým misia beží, môžeš sa túlať mestom, nakupovať a bojovať.</p>';
      }
      return { html: h + '</div>' };
    }
    const offers = this.s.offers(giverId);
    if (!offers.some((o) => o.tpl === this.sel.offer)) this.sel.offer = offers[0].tpl;
    const sel = offers.find((o) => o.tpl === this.sel.offer);
    for (const o of offers) {
      const t = MISSIONS[o.tpl];
      const pv = this.s.preview(o.tpl, o.v);
      h += '<button class="card' + (o.tpl === this.sel.offer ? ' sel' : '') + '" data-act="offer" data-arg="' + o.tpl + '"><img src="' + art(t.art) + '" alt=""><span class="mid"><span class="t">' + t.name + '</span><span class="s num">' + dur(pv.durationMs) + ' · ' + '<span class="red">heat +' + pv.heat + ' %</span>' + '</span></span><span class="end"><span class="gold" style="font-size:18px">' + money(pv.cash) + '</span><span class="s">' + fmt(pv.xp) + ' XP</span></span></button>';
    }
    const story = MISSIONS[sel.tpl].stories[sel.v];
    h += '<p class="story">' + story.text + '</p>';
    h += '<div class="foe"><img class="ph" src="' + art(story.foe.art) + '" alt=""><span><span class="sc" style="font-size:12px;color:#8a857a">Na konci ťa čaká</span><br><b>' + esc(story.foe.name) + '</b> <span class="muted">· ' + esc(story.foe.title) + '</span></span></div>';
    const selPv = this.s.preview(sel.tpl, sel.v);
    const tooHot = v.heat + selPv.heat > CONFIG.heatMax;
    h += this.heatMeter(v.heat, selPv.heat);
    if (v.jailLeft > 0) h += '<p class="note red">Si zatknutý, misie až o <b data-until="' + this.s.state.jailUntil + '"></b>.</p>';
    if (tooHot) h += '<p class="note red">Na túto misiu máš dnes priveľký heat. Vyber kratšiu, zájdi za právničkou (dnes ešte ' + this.s.lawyerLeft() + '×) alebo počkaj do polnoci (<span data-until="' + this.s.nextDayAt() + '"></span>).</p>';
    h += '<button class="btn gold wide" style="margin-top:12px" data-act="accept"' + (v.jailLeft > 0 || tooHot ? ' disabled' : '') + '>Prijať misiu</button>';
    h += '<p class="note">Heat je tvoj denný limit na misie. Dvíha sa už pri prijatí misie a o polnoci spadne na nulu.</p>';
    if (this.s.p.level < CONFIG.fastUntil) h += '<p class="note gold">Rýchly štart do úrovne ' + CONFIG.fastUntil + ': misie trvajú len chvíľu a dávajú viac XP.</p>';
    const locked = g.pool.filter((id) => MISSIONS[id].minLevel > this.s.p.level).sort((a, b) => MISSIONS[a].minLevel - MISSIONS[b].minLevel);
    if (locked.length) h += '<p class="note">Neskôr: ' + locked.map((id) => MISSIONS[id].name + ' (úr. ' + MISSIONS[id].minLevel + ')').join(' · ') + '</p>';
    return { html: h + '</div>' };
  }

  scr_shop(shopId) {
    const sh = this.s.shop(shopId);
    const p = this.s.p;
    const row = (it, where = 'list') => {
      const r = rar(it.rarity);
      const c = this.s.shopPrice(it, where);
      const cur = p.equipment[it.slot] && this.s.item(p.equipment[it.slot]);
      const label = (c.cash ? money(c.cash) : '') + (c.bars ? (c.cash ? '<br>+ ' : '') + c.bars + ' tehličiek' : '');
      return '<div class="item rar-' + it.rarity + '"><img src="' + art(ITEM_BASES[it.base].art) + '" alt=""><div class="mid"><div class="t">' + this.itemName(it) + '</div><div class="s"><span style="color:' + r.color + '">' + r.name + '</span> · úr. ' + it.level + '</div><div class="s" style="color:#c9c4b8">' + this.bonusText(it) + '</div>' + this.descHtml(it) + (cur ? '<div class="s">Teraz: ' + this.bonusText(cur) + '</div>' : '') + '</div>' +
        '<div class="acts"><button class="btn small gold num" data-act="buy-item" data-arg="' + it.id + '"' + (p.cash < c.cash || p.chains < c.bars ? ' disabled' : '') + '>' + label + '</button></div></div>';
    };
    let h = '';
    if (this.s.ev().price < 1) h += '<p class="note gold" style="margin-top:0">Výpredaj: všetko o ' + Math.round((1 - this.s.ev().price) * 100) + ' % lacnejšie, nový tovar zadarmo.</p>';
    if (sh.premium) h += '<div class="sec sc" style="margin-top:0;color:#e8c873">Prémiové autá · stále v ponuke</div>' + sh.premium.map((it) => row(it, 'premium')).join('') + '<div class="sec sc">Ojazdené autá</div>';
    if (sh.bm) {
      const el = this.s.elixirLeft();
      const evb = this.s.ev();
      h += '<div class="bm"><div class="sec sc" style="margin-top:0;color:#ff6aa8">Čierny trh · ' + (el > 0 ? 'elixír ešte <span data-until="' + (Date.now() + el) + '"></span>' : evb.bmAll ? 'celý víkend' : 'len dnes večer') + ' · len epické kusy</div>' +
        (sh.bm.length ? sh.bm.map((it) => row(it, 'bm')).join('') : '<p class="p">Čierny trh je vypredaný.</p>') + '</div>';
    }
    h += '<p class="p" style="font-style:italic">„' + sh.blurb + '“</p>';
    h += sh.list.map((it) => row(it)).join('');
    if (!sh.list.length) h += '<p class="p">Všetko vypredané.</p>';
    if (!sh.bm && sh.hasBm) h += '<p class="note" style="color:#ff6aa8">Čierny trh: v piatok od ' + CONFIG.blackMarketFromHour + ':00, len epické kusy. Každý stojí peniaze a ' + CONFIG.bmEpicChains + ' zlatých tehličiek.' + (this.s.locked('blackMarket') ? ' Odomyká sa na úrovni ' + this.s.locked('blackMarket') + '.' : '') + '</p>';
    const rc = this.s.rerollCost();
    h += '<button class="btn wide" data-act="shop-reroll" data-arg="' + shopId + '"' + (p.chains < rc ? ' disabled' : '') + '>Nový tovar hneď · ' + (rc ? rc + ' zlatá tehlička' : 'zadarmo') + '</button>';
    h += '<p class="note">Nový tovar o <span data-until="' + (Date.now() + sh.refreshIn) + '"></span> alebo po novej úrovni.</p>';
    return { html: this.hdr(sh.name, money(p.cash)) + '<div class="body">' + h + '</div>' };
  }

  scr_upgrade() {
    const p = this.s.p;
    let h = '<button class="card" data-act="open-shop" data-arg="autobazar"><img src="' + art('x_car_hatch') + '" alt=""><span class="mid"><span class="t">Autobazár</span><span class="s">Auto znižuje heat zo všetkého aj čas misií. Nasadiť ho môžeš od úrovne ' + CONFIG.autoUnlockLevel + '.</span></span></button>';
    h += '<p class="p">Mechanik vylepší tvoje nasadené veci. Každé vylepšenie pridá 10 % bonusu, najviac +' + CONFIG.maxUpgrade + '. Garáž drží tvoj gang.</p>';
    let any = false;
    for (const s of SLOTS) {
      const it = p.equipment[s.id] && this.s.item(p.equipment[s.id]);
      if (!it) continue;
      any = true;
      const max = it.upgrade >= CONFIG.maxUpgrade;
      const cost = this.s.upgradeCost(it.id);
      h += '<div class="item rar-' + it.rarity + '"><img src="' + art(ITEM_BASES[it.base].art) + '" alt=""><div class="mid"><div class="t">' + this.itemName(it) + '</div><div class="s">' + s.name + ' · ' + this.bonusText(it) + '</div></div><div class="acts">' +
        (max ? '<span class="sc gold" style="font-size:14px">maximum</span>' : '<button class="btn small gold num" data-act="upgrade" data-arg="' + it.id + '"' + (p.cash < cost ? ' disabled' : '') + '>+1 · ' + money(cost) + '</button>') + '</div></div>';
    }
    if (!any) h += '<p class="p">Nemáš nasadené žiadne predmety.</p>';
    return { html: this.hdr('Garáž', money(p.cash)) + '<div class="body">' + h + '</div>' };
  }

  scr_lawyer() {
    const v = this.s.view();
    const cost = this.s.lawyerCost();
    let h = '<p class="p">„Polícia ťa má v hľadáčiku? Za správnu cenu sa papiere stratia.“</p>';
    const left = this.s.lawyerLeft();
    h += this.heatMeter(v.heat, 0);
    h += '<p class="p">Heat je tvoj denný limit na misie a sám od seba neklesá. O polnoci spadne na nulu (o <span data-until="' + this.s.nextDayAt() + '"></span>). Od ' + CONFIG.raidFrom + ' % hrozí po misii razia.</p>';
    h += '<button class="btn gold wide num" data-act="lawyer"' + (v.cash < cost || v.heat <= 0 || left <= 0 ? ' disabled' : '') + '>Znížiť heat o ' + CONFIG.lawyerHeat + ' % · ' + money(cost) + '</button>';
    h += '<p class="note">' + (this.s.ev().lawyerUnlimited ? '<span class="gold">Amnestia: za polovicu a bez denného limitu.</span>' : left > 0 ? 'Dnes ešte ' + left + ' z ' + CONFIG.lawyerPerDay + '.' : 'Dnes už nie. Ďalšie ' + CONFIG.lawyerPerDay + ' o polnoci.') + '</p>';
    return { html: this.hdr('Právnička', money(v.cash)) + '<div class="body">' + h + '</div>' };
  }

  scr_boss() {
    const info = this.s.bossInfo();
    if (info.done) return { html: this.hdr('Boss fights') + '<div class="body"><p class="p">Všetci bossovia Mesta 1 sú porazení. Ďalšie mesto príde vo verzii 3.</p></div>' };
    const f = info.fighter, me = this.s.playerFighter();
    const b = info.boss;
    let scene;
    if (b.wide) scene = '<img class="bg full" src="' + art(b.wide) + '" alt="' + b.name + '" style="object-position:' + (b.focus || '50% 30%') + '">';
    else if (b.art) scene = '<img class="bg" src="' + art('fightbg') + '" alt=""><img class="fb" src="' + art(b.art) + '" alt="' + b.name + '">';
    else scene = '<img class="bg" src="' + art('fightbg') + '" alt=""><img class="fb" src="' + art('kladivo') + '" alt="" style="filter:brightness(0) drop-shadow(0 0 1px #6b675f)">';
    let h = '<div class="stage">' + scene + '<div class="fade-t"></div><div class="fade-b"></div>' +
      '<div class="title" style="align-items:flex-start;left:16px;' + (b.titleLow ? 'top:auto;bottom:14px' : 'top:60px') + '"><span class="sc" style="font-size:14px;color:#b9b4a8">Boss ' + (info.index + 1) + ' / ' + info.total + '</span><span class="bl" style="font-size:46px;font-weight:900;color:#efe9dc;text-shadow:0 3px 0 #000">' + info.boss.name + '</span><span class="sc" style="font-size:14px;color:#e05a4f;text-shadow:0 1px 2px #000,0 0 8px #000,0 0 12px #000">' + info.boss.title + '</span></div></div>';
    h += '<div class="body"><div class="hpgrid" style="padding:0">' +
      '<div><div class="top"><span class="bl">Ty</span><span class="num muted" style="font-size:14px">úr. ' + me.level + '</span></div><p class="note num" style="text-align:left;margin:0">Životy ' + fmt(me.hp) + '<br>Úder ' + Math.round(F.hitOf(me)) + '</p></div>' +
      '<div><div class="top"><span class="bl">' + info.boss.name + '</span><span class="num muted" style="font-size:14px">úr. ' + f.level + '</span></div><p class="note num" style="text-align:left;margin:0">Životy ' + fmt(f.hp) + '<br>Úder ' + Math.round(F.hitOf(f)) + '</p></div></div>';
    const legendPct = Math.round(Math.max(CONFIG.legendaryBossChance, this.s.ev().legendBoss || 0) * 100);
    h += '<p class="note num" style="color:#b9b4a8;font-size:15px">Odmena: <span class="gold">' + money(info.reward.cash) + ' · ' + fmt(info.reward.xp) + ' XP' + (info.reward.bars ? ' · ' + info.reward.bars + ' tehl.' : '') + '</span> · predmet: ' + Math.round(CONFIG.bossEpicChance * 100) + ' % epický, ' + legendPct + ' % legendárny</p>';
    h += info.hunt ? '<button class="btn gold wide" style="margin-top:10px" data-act="boss-fight">Bojovať · Hon na bossov, bez čakania</button>'
      : info.free ? '<button class="btn gold wide" style="margin-top:10px" data-act="boss-fight">Bojovať · pokus zadarmo</button>'
      : '<button class="btn gold wide" style="margin-top:10px" data-act="boss-fight"' + (info.paidLeft ? '' : ' disabled') + '>Bojovať za ' + CONFIG.bossRetryChains + ' zlatých tehličiek</button><p class="note">' +
        (info.paidLeft ? 'Platené pokusy dnes: ' + info.paidLeft + ' / ' + CONFIG.bossPaidPerDay + '. ' : 'Platené pokusy sú na dnes minuté. ') + 'Ďalší pokus zadarmo o <span data-until="' + info.freeAt + '"></span></p>';
    h += '<div class="sec sc">Línia bossov Mesta 1</div><div class="boss-list">' + BOSSES.map((b, i) => '<span class="' + (i < info.index ? 'done' : i === info.index ? 'now' : '') + '">' + (i <= info.index ? b.name : '?') + '</span>').join('') + '</div>';
    h += '<p class="note">Do tímu si môžeš zobrať 1–2 členov gangu (príde s gangmi).</p></div>';
    return { html: this.hdr('Boss fights', money(this.s.p.cash)) + h };
  }

  // every police term on one screen (a tap on the heat bar or the stars opens it)
  scr_policehelp() {
    const C = CONFIG;
    const row = (t, s) => '<div><b>' + t + '</b><span>' + s + '</span></div>';
    const h = '<p class="p">Polícia má dve strany: <b class="gold">heat</b> sleduje tvoje misie počas dňa, <b class="gold">hviezdy</b> sú naháňačka na ulici práve teraz.</p>' +
      '<div class="help-list">' +
      row('Heat', 'Denný limit na misie. Každá misia ho zdvihne, násilie na ulici tiež. Keď je plný, misie od Dona a Dílera na dnes končia. O polnoci spadne na nulu. Auto ho znižuje.') +
      row('Razia', 'Od ' + C.raidFrom + ' % heatu ťa po misii môže čakať razia: pokuta ' + pct(C.raidFinePct) + ' peňazí alebo ' + C.jailMinutes + ' minút v base.') +
      row('Právnička', 'Zníži heat o ' + C.lawyerHeat + ' %, najviac ' + C.lawyerPerDay + '-krát za deň. Platí sa peniazmi.') +
      row('Hviezdy', 'Hľadanosť na ulici. Pribúdajú za streľbu, bitku, autá a výbuchy, pri vyššom heate rýchlejšie. Od ' + C.wantedChase + ' hviezd ťa naháňajú policajti. Keď ťa nevidia, každých ' + C.wantedLoseSec + ' s stratíš hviezdu.') +
      row('Kontrola', 'Keď ťa policajt chytí, vyberieš si: utiecť (šanca podľa Obratnosti), podplatiť (Charizma zlacňuje) alebo sa vzdať (' + C.jailMinutes + ' minút bez misií). Potom máš ' + Math.round(C.caughtPeaceSec / 60) + ' minút pokoj.') +
      row('Zložený policajt', 'Každý zložený policajt zdvojnásobí, koľko ich po tebe ide. Môže z neho padnúť epický predmet (' + pct(C.copEpicChance) + ', najviac ' + C.copEpicPerDay + ' za deň). Ak ťa potom chytia, prídeš o ' + pct(C.killCashShare) + ' peňazí alebo máš ' + hours(C.killJailMin) + ' bez misií.') +
      row('Basa', 'Kým si v base, nedostaneš misie od Dona a Dílera. Denné misie na mape robiť môžeš.') +
      row('Skrýša a tieň', 'Keď ťa hľadajú, schovaj sa v skrýši na ' + C.hideMin + ' minút. Hviezdy zmiznú a ďalších ' + C.shadowMin + ' minút si v tieni: polícia ťa nenaháňa.') +
      '</div>';
    return { html: this.hdr('Ako funguje polícia') + '<div class="body">' + h + '</div>' };
  }

  // a feature the player has not reached yet: what it is and from which level
  lockedScr(title, feature, text) {
    return { html: this.hdr(title) + '<div class="body"><div class="locked-scr"><span class="sc">Zamknuté</span><span class="bl">Od úrovne ' + this.s.locked(feature) + '</span><p>' + text + '</p><p class="note">Teraz máš úroveň ' + this.s.p.level + '. Úrovne získaš za misie, denné misie a bossov.</p></div></div>' };
  }

  scr_arena() {
    if (this.s.locked('arena')) return this.lockedScr('Aréna', 'arena', 'V aréne sa biješ s inými hráčmi o body v rebríčku. Najprv sa trochu otrkaj na misiách.');
    const a = this.s.arena();
    let h = '<p class="p num">Súboje prebehnú automaticky podľa statov a výbavy. Zadarmo ešte <span class="gold">' + a.freeLeft + ' z ' + CONFIG.pvpFreePerHour + '</span>' + (a.freeLeft < CONFIG.pvpFreePerHour ? ', obnova o <span data-until="' + a.windowEnds + '"></span>' : '') + '. ' + (this.s.online ? 'Súperi s hviezdičkou sú skutoční hráči.' : 'Súperi sú zatiaľ počítačoví.') + '</p>';
    a.opponents.forEach((o, i) => {
      const hp = F.maxHp(o.stats, o.level, o.cls);
      h += '<div class="card" style="cursor:default"><img src="' + art(BOT_ART[o.cls] || 'maska') + '" alt="" style="object-fit:cover;object-position:' + (BOT_FOCUS[o.cls] || '50% 20%') + ';background:#1a1714"><span class="mid"><span class="t">' + esc(o.name) + (o.id ? ' <span class="gold">★</span>' : '') + '</span><span class="s num">' + CLASSES[o.cls].name + ' · úr. ' + o.level + ' · ' + fmt(o.points) + ' b.</span><span class="s num">Životy ' + fmt(hp) + ' · úder ' + Math.round(F.hitOf(o)) + '</span></span>' +
        '<button class="btn small gold" data-act="arena-fight" data-arg="' + i + '">' + (a.freeLeft > 0 ? 'Vyzvať' : 'Vyzvať · ' + CONFIG.pvpExtraChains) + '</button></div>';
    });
    if (this.s.online) h += '<button class="btn wide" data-act="arena-new">Noví súperi</button>';
    h += '<div class="sec sc">Rebríček · sezóna 1</div><ol class="ladder">' + a.ladder.slice(0, 12).map((r, i) => '<li class="' + (r.me ? 'me' : '') + '"><span>' + (i + 1) + '. ' + esc(r.name) + '</span><span class="num">' + fmt(r.points) + '</span></li>').join('') + '</ol>';
    const myRank = a.ladder.findIndex((r) => r.me) + 1;
    if (myRank > 12) h += '<p class="note gold">Ty: ' + myRank + '. miesto · ' + fmt(a.points) + ' b.</p>';
    h += '<p class="note">Výhry ' + a.wins + ' · prehry ' + a.losses + '</p>';
    return { html: this.hdr('Aréna', fmt(a.points) + ' b.') + '<div class="body">' + h + '</div>' };
  }

  scr_wexler() {
    const p = this.s.p, rp = this.s.reaper();
    const top = '<section class="giver photo"><img src="' + art('photo_wexler') + '" alt="Wexler" style="object-position:50% 42%"><div class="shade"></div><div class="txt"><span class="bl" style="font-size:34px;color:#efe9dc">Wexler</span><q>Zlato nikdy nestráca hodnotu. Na rozdiel od ľudí.</q><span class="sc" style="font-size:13px;color:#b9b4a8">Zlaté tehličky</span></div></section>';
    let h = rp.active
      ? '<p class="warn" style="padding:8px 10px;border:1px solid rgba(208,71,61,.6);color:#e6a49c">Ripper mi práve ukradol tehličku! Chyť ho do <b data-until="' + rp.until + '"></b> a je tvoja.</p>'
      : '<p class="note" style="text-align:left">Ripper sa sem chodí kradnúť približne raz za hodinu. Ďalší pokus o <span data-until="' + rp.nextAt + '"></span>.</p>';
    h += '<div class="sec sc">Zlaté tehličky</div>';
    CONFIG.barPacks.forEach((pk, i) => {
      h += '<div class="item rar-legendarny"><img class="px" src="assets/icons/i_bar.png" alt="" style="width:48px;height:48px;margin:8px"><div class="mid"><div class="t num">' + pk.bars + ' zlatých tehličiek</div><div class="s">Skracovanie misií, ďalšie pokusy na bossov a v aréne</div></div>' +
        '<div class="acts"><button class="btn small gold num" data-act="buy-bars" data-arg="' + i + '">' + pk.price + '</button></div></div>';
    });
    h += '<p class="note">Testovacia kúpa: tehličky sa pripíšu hneď. Skutočná platba cez Stripe príde neskôr.</p>';
    // the elixir: Black Market (epic goods) in every shop for elixirHours, only for this player
    const left = this.s.elixirLeft();
    h += '<div class="sec sc">Elixír Čierneho trhu</div>' +
      '<div class="item rar-epicky"><img src="' + art('x_elixir_bm') + '" alt=""><div class="mid"><div class="t">Elixír Čierneho trhu</div>' +
      '<div class="s">Na ' + CONFIG.elixirHours + ' hodín ti otvorí Čierny trh vo všetkých obchodoch. Epické kusy ťa čakajú hocikedy, nielen v piatok večer.</div>' +
      (left > 0 ? '<div class="s gold">Účinkuje ešte <b data-until="' + (Date.now() + left) + '"></b>. Ďalší elixír čas predĺži.</div>' : '') +
      (this.s.locked('blackMarket') ? '<div class="s red">Čierny trh sa odomyká na úrovni ' + this.s.locked('blackMarket') + '.</div>' : '') +
      '<div class="desc">Čierny ako noc, zapečatený pešiakom. Kto sa napije, nájde dvere, ktoré ostatní nevidia.</div></div>' +
      '<div class="acts"><button class="btn small gold num" data-act="buy-elixir"' + (p.chains < CONFIG.elixirChains || this.s.locked('blackMarket') ? ' disabled' : '') + '>' + CONFIG.elixirChains + ' tehličiek</button></div></div>';
    return { html: this.hdr('Wexler', '<span class="gold">' + fmt(p.chains) + '</span> tehličiek') + top + '<div class="body">' + h + '</div>' };
  }

  scr_settings() {
    const on = this.s.hasSave() && this.s.state.settings.testMode;
    let h = '';
    if (this.s.online) {
      if (this.s.loggedIn()) h += '<div class="switch"><span>Účet<br><small class="muted" style="font-size:14px">' + esc(this.s.email()) + '</small></span><button class="btn small" data-act="logout">Odhlásiť</button></div>';
      if (this.s.hasSave()) h += '<div class="switch"><span>Postava<br><small class="muted" style="font-size:14px">Uložená na serveri.</small></span><button class="btn small" data-act="reset">Zmazať</button></div>';
      h += '<p class="note" style="margin-top:20px">Hits &amp; Licks · online</p>';
      return { html: this.hdr('Nastavenia') + '<div class="body">' + h + '</div>' };
    }
    if (this.s.hasSave()) {
      h += '<div class="switch"><span>Testovací režim<br><small class="muted" style="font-size:14px">Čas beží 60× rýchlejšie: misie, heat, bossovia, obchody.</small></span><button class="btn small ' + (on ? 'gold' : '') + '" data-act="test-mode">' + (on ? 'Zapnutý' : 'Vypnutý') + '</button></div>';
      const bm = this.s.state.settings.blackMarket;
      h += '<div class="switch"><span>Čierny trh vždy otvorený<br><small class="muted" style="font-size:14px">Na testovanie. Normálne len v piatok od ' + CONFIG.blackMarketFromHour + ':00.</small></span><button class="btn small ' + (bm ? 'gold' : '') + '" data-act="test-bm">' + (bm ? 'Zapnutý' : 'Vypnutý') + '</button></div>';
      h += '<div class="switch"><span>Uložená hra<br><small class="muted" style="font-size:14px">Ukladá sa v tomto prehliadači.</small></span><button class="btn small" data-act="reset">Zmazať</button></div>';
    }
    h += '<p class="note" style="margin-top:20px">Hits &amp; Licks · prototyp 0.1</p>';
    return { html: this.hdr('Nastavenia') + '<div class="body">' + h + '</div>' };
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
      h += '<div class="lookrow"><button class="btn small" data-act="look-step" data-arg="' + part.id + ':-1" aria-label="Predchádzajúce">‹</button>' +
        '<span class="mid"><span class="sc">' + part.name + '</span><b>' + (it ? esc(it.name) : 'nič') + '</b><small class="num">' + (opts.indexOf(id) + 1) + ' / ' + opts.length + '</small></span>' +
        '<button class="btn small" data-act="look-step" data-arg="' + part.id + ':1" aria-label="Ďalšie">›</button></div>';
    }
    h += '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn wide" data-act="look-random">Náhodne</button><button class="btn gold wide" data-act="look-save">Uložiť</button></div>';
    h += '<p class="note">Ďalšie časti (pleť, ústa, brada, čiapky…) sa tu objavia, keď pribudnú ich vrstvy.</p>';
    return { html: this.hdr('Vzhľad') + '<div class="body">' + h + '</div>' };
  }

  tagBox(o) {
    return o ? '<span class="gtag" style="border-color:' + o.color + ';color:' + o.color + '">' + esc(o.tag) + '</span>' : '<span class="gtag free">—</span>';
  }

  turfCard(v) {
    const o = v.owner;
    return '<button class="card turf' + (o && o.mine ? ' mine' : '') + '" data-act="turf" data-arg="' + v.id + '">' + this.tagBox(o) +
      '<span class="mid"><span class="t">' + esc(v.name) + '</span><span class="s">' + v.kindInfo.text + '</span>' +
      '<span class="s">' + (o ? '<span style="color:' + o.color + '">' + esc(o.name) + '</span> · obrana ' + pct(v.strength) : 'Voľný, stačí ho obsadiť') + '</span></span></button>';
  }

  fighterRow(f, extra = '') {
    return '<div class="grow"><span class="mid"><span class="t">' + esc(f.name) + '</span><span class="s num">' + CLASSES[f.cls].name + ' · úr. ' + f.level + ' · životy ' + fmt(f.hp) + ' · úder ' + Math.round(F.hitOf(f)) + '</span></span>' + extra + '</div>';
  }

  // the gang: without one, found a gang or ask to join one; in one, members, requests, treasury, upgrades, city
  scr_gang() {
    const g = this.s.gang(), p = this.s.p;
    if (!g && this.s.locked('gang')) return this.lockedScr('Gang', 'gang', 'Gang je tvoj cech: s ostatnými hráčmi držíte objekty v meste a bojujete o územie. Do gangu sa dá vstúpiť alebo ho založiť, keď ťa už v meste poznajú.');
    const turf = this.s.turfView();
    const turfList = '<div class="sec sc">Územie Mesta 1</div>' + turf.map((v) => this.turfCard(v)).join('');
    if (!g) {
      const cost = this.s.gangCreateCost();
      const col = this.sel.gangColor || 'gold';
      const inbox = this.s.gangInbox();
      let h = '<p class="p">Gang je tvoj cech. Spolu s ostatnými hráčmi držíte objekty v meste a kým ich držíte, celý gang má ich bonus. Ostatné gangy aj počítačoví rivali vám ich budú chcieť zobrať.</p>';
      if (inbox.invites.length) {
        h += '<div class="sec sc">Pozvánky</div>' + inbox.invites.map((i) => '<div class="grow">' + this.tagBox(i) + '<span class="mid"><span class="t">' + esc(i.name) + '</span><span class="s">ťa pozýva do gangu</span></span>' +
          '<button class="btn small gold" data-act="gang-accept" data-arg="' + i.id + '">Vstúpiť</button><button class="btn small" data-act="gang-decline" data-arg="' + i.id + '">Nie</button></div>').join('');
      }
      h += '<div class="sec sc">Gangy v meste</div>';
      const list = this.sel.gangList;
      if (!list) h += '<p class="note">Načítavam…</p>';
      else if (!list.length) h += '<p class="note">Zatiaľ tu nie je žiadny gang. Založ prvý.</p>';
      else h += list.map((x) => {
        const asked = inbox.requests.includes(x.id), full = x.members >= CONFIG.gangSlots;
        return '<div class="grow">' + this.tagBox(x) + '<span class="mid"><span class="t">' + esc(x.name) + '</span><span class="s num">' + x.members + ' / ' + CONFIG.gangSlots + ' členov · ' + x.wins + ' výhier' + (x.leaderName ? ' · šéf ' + esc(x.leaderName) : '') + '</span></span>' +
          (asked ? '<button class="btn small" data-act="gang-unask" data-arg="' + x.id + '">Zrušiť žiadosť</button>' : '<button class="btn small gold" data-act="gang-ask" data-arg="' + x.id + '"' + (full ? ' disabled' : '') + '>' + (full ? 'Plný' : 'Požiadať') + '</button>') + '</div>';
      }).join('');
      if (!this.s.online) h += '<p class="note">Offline hra: ostatné gangy uvidíš po prihlásení.</p>';
      h += '<div class="sec sc">Založiť vlastný gang</div>';
      h += '<div class="field"><label for="gang-name">Meno gangu</label><input id="gang-name" maxlength="20" placeholder="napr. Nočné Mory" autocomplete="off" value="' + esc(this.sel.gangName || '') + '"></div>';
      h += '<div class="field"><label for="gang-tag">Skratka (2–4 znaky, uvidíš ju na mape)</label><input id="gang-tag" maxlength="4" placeholder="NM" autocomplete="off" style="text-transform:uppercase" value="' + esc(this.sel.gangTag || '') + '"></div>';
      h += '<div class="field"><label>Farba graffiti</label><div class="swatches">' + GANG_COLORS.map((c) => '<button class="sw' + (c.id === col ? ' sel' : '') + '" data-act="gang-color" data-arg="' + c.id + '" style="background:' + c.color + '" aria-label="' + c.name + '"></button>').join('') + '</div></div>';
      h += '<button class="btn gold wide" data-act="gang-create"' + (p.cash < cost ? ' disabled' : '') + '>Založiť gang · ' + money(cost) + '</button>';
      return { html: this.hdr('Gang', money(p.cash)) + '<div class="body">' + h + turfList + '</div>', after: () => this.loadGangList() };
    }
    const me = this.s.selfId(), rank = this.s.myRank(), can = (w) => this.s.can(w);
    const b = this.s.gangBonus();
    const chips = [b.cash && '+' + pct(b.cash) + ' peňazí', b.xp && '+' + pct(b.xp) + ' XP', b.time && '−' + pct(b.time) + ' čas misií', b.epic && '+' + pct(b.epic) + ' epický drop'].filter(Boolean);
    let h = '<div class="ghead"><span class="gtag big" style="border-color:' + g.color + ';color:' + g.color + '">' + esc(g.tag) + '</span><div><div class="bl" style="font-size:30px;color:#efe9dc">' + esc(g.name) + '</div><div class="s muted num">' + g.members.length + ' / ' + CONFIG.gangSlots + ' členov · ' + turf.filter((v) => v.owner && v.owner.mine).length + ' objektov · ' + (g.wins || 0) + ' výhier · ty: ' + GANG_RANKS[rank] + '</div></div></div>';
    h += '<div class="chips">' + (chips.length ? chips.map((c) => '<span class="chip">' + c + '</span>').join('') : '<span class="note" style="margin:0">Zatiaľ žiadny bonus. Obsaďte nejaký objekt.</span>') + '</div>';

    const d1 = Math.round(F.cashPerMin(p.level) * 10), d2 = Math.round(F.cashPerMin(p.level) * 60);
    h += '<div class="sec sc">Pokladnica</div><div class="switch" style="border:none;padding-top:0"><span class="num gold" style="font-size:24px">' + money(g.treasury) + '</span><span style="display:flex;gap:6px">' +
      '<button class="btn small num" data-act="deposit" data-arg="' + d1 + '"' + (p.cash < 1 ? ' disabled' : '') + '>+ ' + money(d1) + '</button><button class="btn small num" data-act="deposit" data-arg="' + d2 + '"' + (p.cash < 1 ? ' disabled' : '') + '>+ ' + money(d2) + '</button></span></div>';
    h += '<p class="note" style="text-align:left;margin-top:0">Vkladať môže každý člen. Z pokladnice sa platia vylepšenia a obrana objektov.</p>';

    // members: boss and right hand first, then by level; your own buttons by your rank
    const where = {};
    turf.forEach((v) => (v.defenders || []).forEach((id) => { if (v.owner && v.owner.mine) where[id] = v.name; }));
    const order = { boss: 0, ruka: 1, vojak: 2, novacik: 3 };
    const who = (id) => this.s.person(id) || { name: '?', level: 0, cls: 'svalovec' };
    h += '<div class="sec sc">Členovia ' + g.members.length + ' / ' + CONFIG.gangSlots + '</div>';
    [...g.members].sort((a, b2) => order[a.rank] - order[b2.rank] || who(b2.id).level - who(a.id).level).forEach((m) => {
      const pp = who(m.id), self = m.id === me;
      let btns = '';
      if (!self && can('rank') && m.rank !== 'boss') btns += '<button class="btn small" data-act="gang-member" data-arg="' + m.id + '">Upraviť</button>';
      h += '<div class="grow"><span class="mid"><span class="t' + (self ? ' gold' : '') + '">' + esc(pp.name) + (self ? ' <small class="muted">· ty</small>' : '') + '</span><span class="s num">' + GANG_RANKS[m.rank] + ' · ' + (CLASSES[pp.cls] ? CLASSES[pp.cls].name : '') + ' · úr. ' + pp.level + (where[m.id] ? ' · bráni ' + esc(where[m.id]) : '') + '</span></span>' + btns + '</div>';
    });

    if (can('recruit')) {
      h += '<div class="sec sc">Žiadosti o vstup</div>';
      h += g.requests.length ? g.requests.map((r) => '<div class="grow"><span class="mid"><span class="t">' + esc(r.name) + '</span><span class="s num">' + (CLASSES[r.cls] ? CLASSES[r.cls].name : '') + ' · úr. ' + r.level + ' · ' + this.ago(r.at) + '</span></span>' +
        '<button class="btn small gold" data-act="gang-approve" data-arg="' + r.id + '"' + (g.members.length >= CONFIG.gangSlots ? ' disabled' : '') + '>Prijať</button><button class="btn small" data-act="gang-deny" data-arg="' + r.id + '">Odmietnuť</button></div>').join('')
        : '<p class="note" style="text-align:left">Žiadne žiadosti. Hráči bez gangu ťa nájdu v zozname gangov.</p>';
      h += '<div class="field" style="margin-top:8px"><label for="gang-invite">Pozvať hráča (prezývka)</label><div style="display:flex;gap:6px"><input id="gang-invite" maxlength="16" autocomplete="off" style="flex:1"><button class="btn small gold" data-act="gang-invite"' + (g.members.length >= CONFIG.gangSlots ? ' disabled' : '') + '>Pozvať</button></div></div>';
      if (g.invites.length) h += g.invites.map((i) => '<div class="grow"><span class="mid"><span class="t">' + esc(i.name) + '</span><span class="s">pozvaný · ' + this.ago(i.at) + '</span></span><button class="btn small" data-act="gang-uninvite" data-arg="' + i.id + '">Zrušiť</button></div>').join('');
    }

    h += '<div class="sec sc">Vylepšenia gangu</div>';
    for (const [id, u] of Object.entries(GANG_UPGRADES)) {
      const n = g.upgrades[id], max = n >= CONFIG.gangUpgradeMax, cost = max ? 0 : this.s.gangUpgradeCost(id);
      h += '<div class="grow"><span class="mid"><span class="t">' + u.name + ' <small class="muted num">' + n + ' / ' + CONFIG.gangUpgradeMax + '</small></span><span class="s">' + (n ? u.text(n) : 'zatiaľ nič') + (max ? '' : ' → ' + u.text(n + 1)) + '</span></span>' +
        (max ? '<span class="gold s">max</span>' : can('upgrade') ? '<button class="btn small num" data-act="gang-up" data-arg="' + id + '"' + (g.treasury < cost ? ' disabled' : '') + '>' + money(cost) + '</button>' : '<span class="s muted num">' + money(cost) + '</span>') + '</div>';
    }
    if (!can('upgrade')) h += '<p class="note">Vylepšenia kupuje šéf alebo pravá ruka.</p>';

    h += turfList;
    h += '<div class="sec sc">Denník</div><ol class="ladder">' + (g.log.length ? g.log.slice(0, 15).map((l) => '<li' + (l.bad ? ' style="color:#e6a49c"' : '') + '><span>' + esc(l.text) + '</span><span class="num muted" style="flex:none;margin-left:8px">' + this.ago(l.at) + '</span></li>').join('') : '<li>Zatiaľ ticho.</li>') + '</ol>';
    h += '<div style="display:flex;gap:8px;margin-top:14px"><button class="btn wide" data-act="gang-leave">Odísť z gangu</button>' + (can('lead') ? '<button class="btn wide" data-act="gang-disband">Rozpustiť gang</button>' : '') + '</div>';
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
    const rk = (r) => '<button class="btn wide' + (m.rank === r ? ' gold' : '') + '" data-act="gang-rank" data-arg="' + id + ':' + r + '">' + GANG_RANKS[r] + (r === 'ruka' ? ' (len jedna)' : '') + '</button>';
    this.modal('<h2>' + esc(pp.name) + '</h2><p class="sub">' + GANG_RANKS[m.rank] + '</p><div class="acts" style="flex-direction:column">' + rk('ruka') + rk('vojak') + rk('novacik') +
      '<button class="btn wide" data-act="gang-lead" data-arg="' + id + '">Odovzdať mu vedenie</button>' +
      '<button class="btn wide" data-act="gang-kick" data-arg="' + id + '" style="color:#e6a49c">Vyhodiť z gangu</button>' +
      '<button class="btn wide" data-act="modal-close">Zavrieť</button></div>' +
      '<p class="sub" style="font-size:15px;color:#9b968b">Nováčik môže vkladať do pokladnice a brániť. Vojak aj útočí a dopĺňa obranu. Pravá ruka navyše prijíma členov a kupuje vylepšenia.</p>');
  }
  ago(t) {
    const m = Math.floor((Date.now() - t) / 60000);
    return m < 1 ? 'teraz' : m < 60 ? m + ' min' : Math.floor(m / 60) + ' h';
  }

  scr_turf(id) {
    const v = this.s.turfView().find((x) => x.id === id);
    const g = this.s.gang(), o = v.owner, now = Date.now();
    let h = '<div class="ghead">' + this.tagBox(o).replace('gtag', 'gtag big') + '<div><div class="bl" style="font-size:28px;color:#efe9dc">' + esc(v.name) + '</div><div class="s muted">' + v.kindInfo.name + ' · drží ' + (o ? '<span style="color:' + o.color + '">' + esc(o.name) + '</span>' : 'nikto') + '</div></div></div>';
    h += '<p class="p">Bonus pre celý gang: <span class="gold">' + v.kindInfo.text + '</span></p>';
    if (o) h += '<div class="switch" style="border:none;padding:0 0 4px"><span style="font-size:16px">Sila obrany</span><span class="num">' + pct(v.strength) + '</span></div><div class="bar" style="height:8px"><i style="width:' + Math.min(100, (v.strength / 1.5) * 100) + '%"></i></div>';

    if (o && o.mine) {
      const full = this.s.fullStrength(), cost = this.s.refillCost();
      if (v.strength < full - 0.005) h += '<button class="btn wide num" style="margin-top:10px" data-act="turf-refill"' + (g.treasury < cost ? ' disabled' : '') + '>Doplniť obranu na ' + pct(full) + ' · ' + money(cost) + ' z pokladnice</button>';
      else h += '<p class="note">Obrana je plná. Bez doplnenia slabne o ' + pct(CONFIG.turfDecayPerHour) + ' za hodinu.</p>';
      if (now < v.safeUntil) h += '<p class="note">Pod ochranou ešte <span data-until="' + v.safeUntil + '"></span>.</p>';
      const me = this.s.selfId();
      let mineElsewhere = null;
      this.s.turfView().forEach((x) => { if (x.owner && x.owner.mine && x.id !== id && x.defenders.includes(me)) mineElsewhere = x.name; });
      h += '<div class="sec sc">Obrancovia ' + v.defenders.length + ' / ' + v.kindInfo.slots + '</div>';
      if (!v.defenders.length) h += '<p class="warn" style="color:#e6a49c">Objekt nikto nebráni. Prvý útok ho zoberie.</p>';
      v.defenders.forEach((pid) => {
        const f = this.s.memberFighter(pid, v.strength);
        if (!f) return;
        const off = pid === me || this.s.can('kick');
        h += this.fighterRow(f, off ? '<button class="btn small" data-act="turf-def" data-arg="' + pid + '">' + (pid === me ? 'Odísť' : 'Stiahnuť') + '</button>' : '');
      });
      if (!v.defenders.includes(me)) {
        h += v.defenders.length < v.kindInfo.slots
          ? '<button class="btn gold wide" style="margin-top:8px" data-act="turf-def" data-arg="">' + (mineElsewhere ? 'Presunúť sa sem (teraz bránim ' + esc(mineElsewhere) + ')' : 'Brániť tento objekt') + '</button>'
          : '<p class="note">Na objekte je plno obrancov.</p>';
      }
      h += '<p class="note">Každý člen bráni jeden objekt a bojuje v ňom so svojou výbavou, aj keď nie je online. Počítačoví rivali skúšajú objekty prebrať zhruba raz za hodinu, iné gangy kedykoľvek.</p>';
      return { html: this.hdr(v.kindInfo.name, g ? '<span class="gold">' + money(g.treasury) + '</span>' : '') + '<div class="body">' + h + '</div>' };
    }

    if (o && o.rival) {
      h += '<div class="sec sc">Obrancovia</div>' + this.s.rivalSquad(this.s.turfObj(id), v.kind).map((f) => this.fighterRow(f)).join('');
    } else if (o) {
      const ds = v.defenders.map((pid) => this.s.memberFighter(pid, v.strength)).filter(Boolean);
      h += '<div class="sec sc">Obrancovia gangu ' + esc(o.name) + '</div>' + (ds.length ? ds.map((f) => this.fighterRow(f)).join('') : '<p class="note" style="text-align:left">Nikto ho nebráni. Stačí prísť a zobrať ho.</p>');
    } else {
      h += '<p class="note" style="text-align:left">Objekt nikto nedrží. Stačí prísť s gangom a obsadiť ho.</p>';
    }
    if (!g) {
      h += '<p class="warn" style="color:#e6a49c;margin-top:12px">Na boj o územie potrebuješ gang.</p><button class="btn gold wide" data-act="tab" data-arg="gang">Založiť gang</button>';
    } else {
      if (o) h += '<div class="sec sc">Tvoj tím</div>' + this.s.attackSquad().map((f) => this.fighterRow(f)).join('');
      if (now < v.retryAt) h += '<p class="note">Ďalší útok o <span data-until="' + v.retryAt + '"></span>.</p>';
      else if (now < v.safeUntil) h += '<p class="note">Objekt bol práve obsadený. Pod ochranou ešte <span data-until="' + v.safeUntil + '"></span>.</p>';
      else if (!this.s.can('attack')) h += '<p class="note">Ako nováčik ešte útočiť nemôžeš. Hodnosť vojaka ti dá šéf.</p>';
      else h += '<button class="btn gold wide" style="margin-top:12px" data-act="turf-attack">' + (o ? 'Zaútočiť' : 'Obsadiť') + '</button>' + (o ? '<p class="note">Útok zvýši heat o ' + CONFIG.gangAttackHeat + '. S tebou idú najsilnejší ďalší členovia gangu (aj keď nie sú online).</p>' : '');
    }
    return { html: this.hdr(v.kindInfo.name, g ? '<span class="gold">' + money(g.treasury) + '</span>' : '') + '<div class="body">' + h + '</div>' };
  }

  // team fight: duels one after another, the winner keeps his remaining life; each duel plays like a normal fight
  scr_war(d) {
    const col = (list, side) => list.map((f, i) => '<div class="wrow" id="w' + side + i + '"><div class="top"><span>' + esc(f.name) + '</span><span class="num muted" id="w' + side + 't' + i + '">' + fmt(f.hp) + '</span></div><div class="bar hp"><i id="w' + side + 'b' + i + '" style="width:100%"></i></div></div>').join('');
    const prev = d.result.prev;
    const h = '<div class="stage" id="stage"><img class="bg" src="' + art('fightbg') + '" alt=""><div class="fade-t"></div><div class="fade-b"></div>' +
      '<div class="title"><span class="bl" id="wtitle">Duel 1</span><span class="sc" style="font-size:14px;color:#d0473d;text-shadow:0 1px 0 #000">' + esc(d.turf.name) + (prev ? ' · ' + esc(prev.name) : '') + '</span></div>' +
      '<figure class="fcard me" id="fa"></figure><span class="vs">vs</span><figure class="fcard foe" id="fb"></figure></div>' +
      '<div class="hpgrid"><div><div class="top"><span class="bl" id="wna"></span><span class="num muted" id="hpa" style="font-size:14px"></span></div><div class="bar hp"><i id="hpba" style="width:100%"></i></div></div>' +
      '<div><div class="top"><span class="bl" id="wnb"></span><span class="num muted" id="hpb" style="font-size:14px"></span></div><div class="bar hp"><i id="hpbb" style="width:100%"></i></div></div></div>' +
      '<div class="body tight" style="flex:1;overflow-y:auto"><div class="war"><div><div class="sec sc" style="margin-top:0">Tvoj gang</div>' + col(d.A, 'a') + '</div><div><div class="sec sc" style="margin-top:0;color:' + (prev ? prev.color : '') + '">' + (prev ? esc(prev.name) : 'Obrana') + '</div>' + col(d.D, 'd') + '</div></div>' +
      '<ol class="flog" id="wlog" style="margin-top:10px"></ol></div>' +
      '<div style="flex:none;padding:10px 14px calc(14px + env(safe-area-inset-bottom))"><button class="btn wide" data-act="war-skip" id="fskip">Preskočiť</button></div>';
    return { html: '<header class="hdr"><span style="width:12px"></span><h1 style="font-size:24px" class="sc">Gang Wars</h1></header>' + h, after: () => this.playWar(d) };
  }

  // fight card of a gang fighter: you wear your own look, members and rivals their class art
  warCard(f, me) {
    if (me && LOOK_BASE) return this.lookHtml(this.s.p.look, 'in-fcard');
    const focus = !me && BOT_FOCUS[f.cls];
    return '<img src="' + art(me ? 'maska' : BOT_ART[f.cls] || 'maska') + '" alt="' + esc(f.name) + '"' + (focus ? ' style="object-position:' + focus + '"' : '') + '>';
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
      $('#wtitle').textContent = 'Duel ' + (w.k + 1);
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
        const line = win ? (me ? '<span class="gold">Vyhral si</span> nad ' + esc(D.name) : '<span class="gold">' + esc(A.name) + '</span> vyhral nad ' + esc(D.name))
          : (me ? '<span class="red">' + esc(D.name) + '</span> ťa porazil' : '<span class="red">' + esc(D.name) + '</span> vyhral nad ' + esc(A.name));
        li.innerHTML = '<span class="r">Duel ' + (w.k + 1) + '</span><span>' + line + '</span>';
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
    let h = r.win ? '<h2 class="win">Územie je vaše</h2>' : '<h2 class="lose">Útok zlyhal</h2>';
    h += '<p class="sub">' + (r.win ? esc(r.name) + ' teraz drží tvoj gang. Bojovníci ostali na mieste ako obrancovia.' : (r.prev ? esc(r.prev.name) : 'Obrancovia') + ' ' + esc(r.name) + ' udržali. Ďalší pokus o ' + CONFIG.gangRetryMin + ' min.') + '</p>';
    if (r.win) h += '<div class="rew"><span class="gold">' + money(r.cash) + '</span><span>+' + fmt(r.xp) + ' XP</span><span class="red">heat +' + CONFIG.gangAttackHeat + '</span></div>';
    else h += '<div class="rew"><span class="red">heat +' + CONFIG.gangAttackHeat + '</span></div>';
    h += this.levelUpText(r.levelUps || 0);
    h += '<div class="acts"><button class="btn gold" data-act="fight-done">Pokračovať</button></div>';
    this.modal(h);
  }

  // ---------------------------------------------------------------- fight playback
  scr_fight(d) {
    const nameA = esc(d.a.name), nameB = esc(d.b.name);
    const head = d.kind === 'boss' ? 'Boss fight' : d.kind === 'arena' ? 'Aréna' : MISSIONS[d.result.tpl].name;
    const h = '<div class="stage" id="stage"><img class="bg" src="' + art('fightbg') + '" alt=""><div class="fade-t"></div><div class="fade-b"></div>' +
      '<div class="title"><span class="bl">' + esc(d.title) + '</span><span class="sc" style="font-size:14px;color:#d0473d;text-shadow:0 1px 0 #000">' + esc(d.subtitle || '') + '</span></div>' +
      '<figure class="fcard me" id="fa">' + (LOOK_BASE ? this.lookHtml(this.s.p.look, 'in-fcard') : '<img src="' + art('maska') + '" alt="' + nameA + '">') + '</figure>' +
      '<span class="vs">vs</span>' +
      '<figure class="fcard foe" id="fb"><img src="' + art(d.artB) + '" alt="' + nameB + '"' + (d.silhouette ? ' style="filter:brightness(.15)"' : d.focusB ? ' style="object-position:' + d.focusB + '"' : '') + '></figure></div>' +
      '<div class="hpgrid"><div><div class="top"><span class="bl">' + nameA + '</span><span class="num muted" id="hpa" style="font-size:14px"></span></div><div class="bar hp"><i id="hpba" style="width:100%"></i></div></div>' +
      '<div><div class="top"><span class="bl">' + nameB + '</span><span class="num muted" id="hpb" style="font-size:14px"></span></div><div class="bar hp"><i id="hpbb" style="width:100%"></i></div></div></div>' +
      (d.intro ? '<p class="story" style="margin:0 14px 6px">' + esc(d.intro) + '</p>' : '') +
      '<div class="body tight" style="flex:1;overflow-y:auto"><ol class="flog" id="flog"></ol></div>' +
      '<div style="flex:none;padding:10px 14px calc(14px + env(safe-area-inset-bottom))"><button class="btn wide" data-act="fight-skip" id="fskip">Preskočiť</button></div>';
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
    if (!base) { setTimeout(onHit, dur * 0.5); return; }
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
    if (ev.block) return ev.attacker === 0 ? B + ' tvoj úder zablokoval.' : 'Zablokoval si úder.';
    if (ev.attacker === 0) return ev.dodge ? B + ' sa uhol.' : ev.crit ? 'Kritický zásah za <span class="gold">' + ev.dmg + '</span>!' : 'Zasiahol si za <b>' + ev.dmg + '</b>.';
    return ev.dodge ? 'Uhol si sa.' : ev.crit ? B + ': kritický úder za <span class="red">' + ev.dmg + '</span>!' : B + ' ťa zasiahol za <span class="red">' + ev.dmg + '</span>.';
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
      li.innerHTML = '<span class="r">Kolo ' + ev.round + '</span><span>' + this.fightLine(ev, f.d) + '</span>';
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
    target.classList.remove('hit');
    void target.offsetWidth;
    if (!miss) target.classList.add('hit');
    const n = document.createElement('span');
    n.className = 'dmg' + (crit ? ' crit' : '') + (miss ? ' miss' : '');
    n.textContent = text;
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
    let h;
    if (d.kind === 'mission') {
      h = r.win ? '<h2 class="win">Misia splnená</h2>' : '<h2 class="lose">Misia zlyhala</h2>';
      h += '<p class="sub">' + (r.win ? esc(d.b.name) + ' leží na zemi. ' + r.name + ' je hotová.' : esc(d.b.name) + ' ťa dnes premohol. Tentoraz bez odmeny.') + '</p>';
      h += '<div class="rew">' + (r.win ? '<span class="gold">' + money(r.cash) + '</span><span>+' + fmt(r.xp) + ' XP</span>' : '') + (r.bars ? '<span class="gold">+' + r.bars + ' tehl.</span>' : '') + (r.heat > 0 ? '<span class="red">heat +' + r.heat + '</span>' : '') + '</div>';
      if (r.item) h += this.lootHtml(r.item);
      if (r.epic) h += '<p class="note" style="color:#ff6aa8">Sklad tvojho gangu: epický kúsok navyše!</p>' + this.lootHtml(r.epic);
      if (r.legend) h += '<p class="note gold">Legendárny víkend: legendárny kúsok z misie!</p>' + this.lootHtml(r.legend);
      if (r.raid) h += '<p class="warn">' + (r.raid.type === 'fine' ? 'Razia! Polícia ti zobrala ' + money(r.raid.fine) + '.' : 'Razia! Zatkli ťa, ' + r.raid.minutes + ' min bez misií.') + '</p>';
      h += this.levelUpText(r.levelUps || 0);
      h += '<div class="acts"><button class="btn gold" data-act="fight-done">Pokračovať</button></div>';
      this.modal(h);
      return;
    }
    h = r.win ? '<h2 class="win">Víťazstvo</h2>' : '<h2 class="lose">Prehra</h2>';
    if (d.kind === 'boss') {
      h += '<p class="sub">' + (r.win ? esc(d.b.name) + ' je porazený.' + (d.next && !d.next.done ? ' Ďalší boss: ' + d.next.boss.name + '.' : '') : esc(d.b.name) + ' bol silnejší. Vylepši staty a výbavu a skús to znova.') + '</p>';
      if (r.win) h += '<div class="rew"><span class="gold">' + money(r.cash) + '</span><span>+' + fmt(r.xp) + ' XP</span>' + (r.bars ? '<span class="gold">+' + r.bars + ' tehl.</span>' : '') + '</div>' + (r.item ? this.lootHtml(r.item) : '');
    } else {
      h += '<p class="sub">' + (r.win ? 'Rebríček ťa posunul vyššie.' : 'Body si stratil, peniaze nie.') + '</p>';
      h += '<div class="rew"><span class="' + (r.points >= 0 ? 'gold' : 'red') + '">' + (r.points >= 0 ? '+' : '') + r.points + ' b.</span>' + (r.win ? '<span class="gold">' + money(r.cash) + '</span><span>+' + fmt(r.xp) + ' XP</span>' : '') + '</div>';
    }
    h += this.levelUpText(r.levelUps || 0);
    h += '<div class="acts"><button class="btn gold" data-act="fight-done">Pokračovať</button></div>';
    this.modal(h);
  }
}
