// The open world: pixel-art city, player movement, NPCs, traffic, police. Uses global Phaser.
// The city (Mesto 1) comes from assets/world/city.json, made by tools/art/City.cs: a collision grid,
// a street graph that cars, police, walkers, the Ripper and the runner move on, and the buildings (marks).
import { NPCS, POIS, SPAWN, LABELS, TURF, TRAFFIC_CARS, POLICE_CARS, WALKER_SPRITES, WALKER_COUNT } from './data.js?v=20261020194200';

const PEOPLE = ['hrac', 'zlodej', 'svalovec', 'dealer', 'boss', 'zadavatel', 'diler', 'mechanik', 'pravnicka', 'lekarka', 'policajt', 'chodkyna', 'chodec'];
const CARS = ['sedan_blue', 'sedan_red', 'sedan_green', 'sedan_white', 'taxi', 'police', 'van', 'pickup'];
const SPEED = 62; // map px per second
const MAX_ZOOM = 4;
const deg = (r) => (r * 180) / Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// hooks: { input:{x,y,fire}, labelLayer:HTMLElement, paused():bool, heatStars():number, readyGiver():string|null,
//          weapon():{attack,cooldown,auto}|null, onCrime('shot'|'hitGun'|'hitMelee'), onPill('red'|'blue'|'green'), onPoi(poi|null), onAction(), onPolice() }
export function createWorld(parent, hooks) {
  class City extends Phaser.Scene {
    constructor() { super('city'); }

    preload() {
      // the same ?v= stamp as this module, so a phone never mixes an old map picture with new map data
      const v = new URL(import.meta.url).search;
      this.load.image('map', 'assets/world/map_base.png' + v);
      this.load.json('city', 'assets/world/city.json' + v);
      PEOPLE.forEach((n) => this.load.image('p_' + n, 'assets/world/p_' + n + '.png'));
      CARS.forEach((n) => this.load.image('car_' + n, 'assets/world/car_' + n + '.png'));
      this.load.image('bubble', 'assets/world/bubble.png');
      this.load.image('bubble_gold', 'assets/world/bubble_gold.png');
    }

    create() {
      const city = this.cache.json.get('city');
      this.city = city;
      this.W = city.w;
      this.H = city.h;
      this.add.image(0, 0, 'map').setOrigin(0, 0).setDepth(0);
      this.physics.world.setBounds(0, 0, city.w, city.h);
      this.buildGrid(city);
      this.buildGraph(city);

      // things placed at a building's door (at: id) or on its roof (roof: id)
      const mark = (id, roof) => { const m = city.marks[id]; return m ? (roof ? { x: m[2], y: m[3] } : { x: m[0], y: m[1] }) : null; };
      const place = (o) => {
        const p = o.at ? mark(o.at) : o.roof ? mark(o.roof, true) : null;
        if (p) { o.x = p.x; o.y = p.y; }
      };
      NPCS.forEach(place); POIS.forEach(place); LABELS.forEach(place);

      // static NPCs
      this.solids = this.physics.add.staticGroup();
      NPCS.forEach((n) => {
        this.add.image(n.x, n.y, n.sprite).setAngle(n.angle).setDepth(5);
        const z = this.add.zone(n.x, n.y, 8, 8);
        this.physics.add.existing(z, true);
        this.solids.add(z);
        if (n.bubble) {
          const b = this.add.image(n.x, n.y - 9, n.bubble).setOrigin(0.5, 1).setDepth(20);
          this.tweens.add({ targets: b, y: n.y - 12, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        }
      });

      // player
      this.ring = this.add.graphics().setDepth(4);
      this.player = this.physics.add.sprite(SPAWN.x, SPAWN.y, 'p_hrac').setDepth(10);
      this.player.body.setCircle(4, 4, 4);
      this.player.setCollideWorldBounds(true);
      this.physics.add.collider(this.player, this.solids);
      this.physics.add.collider(this.player, this.colLayer);
      this.walkT = 0;
      this.face = { x: 0, y: 1 };

      // street attacks: slash arcs, bullets, muzzle flashes
      this.fx = this.add.graphics().setDepth(12);
      this.bullets = [];
      this.attackCd = 0;

      // pedestrians on the sidewalks, cars and police in the right-hand lane
      this.walkers = [];
      for (let i = 0; i < WALKER_COUNT; i++) {
        const a = this.spawnAgent('walk', 11 + Math.random() * 5);
        a.s = this.add.image(0, 0, WALKER_SPRITES[i % WALKER_SPRITES.length]).setDepth(6);
        a.flipT = 0; a.down = 0;
        this.walkers.push(a);
      }
      this.cars = TRAFFIC_CARS.map((sprite) => {
        const a = this.spawnAgent('car', 30 + Math.random() * 14);
        a.s = this.add.image(0, 0, sprite).setDepth(8);
        return a;
      });
      this.policeCars = [];
      for (let i = 0; i < POLICE_CARS; i++) {
        const a = this.spawnAgent('car', 34);
        a.s = this.add.image(0, 0, 'car_police').setDepth(8);
        a.light = this.add.graphics().setDepth(9);
        this.policeCars.push(a);
      }

      // Ripper: a thief running along the streets
      this.rp = { s: this.add.image(0, 0, 'p_zlodej').setDepth(9).setVisible(false), on: false, down: 0, to: null, prev: null, walkT: 0 };

      // lucky runner: a fast nameless figure with a sparkling aura, once an hour
      this.rn = { s: this.add.image(0, 0, 'p_chodec').setDepth(9).setVisible(false).setTint(0xfff2c8), aura: this.add.circle(0, 0, 9, 0xf0d27a, 0.22).setDepth(8.5).setVisible(false), on: false, down: 0, to: null, prev: null, walkT: 0, sparkT: 0 };
      this.tweens.add({ targets: this.rn.aura, scale: 1.5, alpha: 0.08, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

      // knocked-down pedestrians: blood, a pill drop and an ambulance that picks them back up
      this.makeTextures();
      this.pills = [];
      this.ambulances = [];

      // officer on foot (spawned at high heat)
      this.officer = null;
      this.officerCooldown = 0;

      // camera: we place it ourselves so the whole map can be shown when zoomed out
      this.cameras.main.setRoundPixels(true);
      this.zoom = this.zoomTarget = this.defaultZoom();
      this.camX = this.player.x;
      this.camY = this.player.y;
      this.linear = null;
      this.input.addPointer(1);
      this.pinch = null;
      this.bindPinch();
      this.input.on('wheel', (p, over, dx, dy) => {
        this.zoomTarget = clamp(this.zoomTarget * (dy > 0 ? 0.85 : 1.18), this.fitZoom(), MAX_ZOOM);
      });

      // map labels (DOM, so text stays crisp at any zoom)
      this.labels = LABELS.map((l) => this.makeLabel(l));
      this.labels.push(this.makeLabel({ text: 'Ty', kind: 'me', follow: true, maxZoom: 1.6, dy: -16 }));
      this.labels.push(this.makeLabel({ text: 'Ripper', kind: 'boss', reaper: true, dy: -16 }));

      // gang turf: owner graffiti on the roof + a label in the owner's colour
      this.turf = TURF.map((d) => {
        const m = city.marks[d.id];
        const gx = m[2], gy = m[3] + 16;
        const g = this.add.graphics().setDepth(1);
        const t = this.add.text(gx, gy + 9, '', { fontFamily: 'Georgia, serif', fontStyle: 'bold italic', fontSize: '9px', color: '#fff' }).setOrigin(0.5).setDepth(1).setResolution(4).setAlpha(0.9);
        const label = this.makeLabel({ text: d.name, kind: 'free', x: m[2], y: m[3] - 26 });
        this.labels.push(label);
        return { d, gx, gy, g, t, label, sig: null };
      });
      this.turfT = 0;

      // keyboard
      this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,F', false);
      this.input.keyboard.on('keydown-E', () => { if (!hooks.paused()) hooks.onAction(); });
      this.input.keyboard.on('keydown-SPACE', () => { if (!hooks.paused()) hooks.onAction(); });

      this.currentPoi = null;
    }

    // ---------------------------------------------------------------- city data
    // collision: a grid of CELL px cells (1 = wall, water, tree...) turned into an invisible tile layer
    buildGrid(city) {
      const cell = city.cell, gw = city.w / cell, gh = city.h / cell;
      const bin = atob(city.grid);
      const grid = new Uint8Array(gw * gh);
      for (let i = 0; i < gw * gh; i++) grid[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
      this.grid = grid; this.gw = gw; this.gh = gh; this.cell = cell;
      const data = [];
      for (let y = 0; y < gh; y++) data.push(Array.from(grid.subarray(y * gw, (y + 1) * gw)));
      const tg = this.make.graphics({ x: 0, y: 0 }, false);
      tg.fillStyle(0xffffff, 1).fillRect(0, 0, cell * 2, cell);
      tg.generateTexture('coltiles', cell * 2, cell);
      tg.destroy();
      const map = this.make.tilemap({ data, tileWidth: cell, tileHeight: cell });
      const ts = map.addTilesetImage('coltiles', 'coltiles', cell, cell, 0, 0);
      this.colLayer = map.createLayer(0, ts, 0, 0).setVisible(false);
      map.setCollision(1);
    }

    solidAt(x, y) {
      const cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell);
      if (cx < 0 || cy < 0 || cx >= this.gw || cy >= this.gh) return true;
      return this.grid[cy * this.gw + cx] === 1;
    }

    // street graph: nodes sit exactly on crossings (r = half the widest street there, 0 on a bend);
    // links carry the street's half width and whether cars use it. n / cn = neighbours for walkers / cars.
    buildGraph(city) {
      this.sw = city.sw || 14;
      this.gnodes = city.nodes.map(([x, y, r]) => ({ x, y, r, links: [], n: [], cn: [] }));
      for (const [a, b, hw, car] of city.edges) {
        const A = this.gnodes[a], B = this.gnodes[b];
        A.links.push({ node: B, hw, car: !!car }); B.links.push({ node: A, hw, car: !!car });
        A.n.push(B); B.n.push(A);
        if (car) { A.cn.push(B); B.cn.push(A); }
      }
      this.carNodes = this.gnodes.filter((n) => n.cn.length);
      this.walkNodes = this.gnodes.filter((n) => n.n.length);
    }

    nearestNode(x, y, list = this.gnodes) {
      let best = list[0], bd = 1e18;
      for (const n of list) { const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = n; } }
      return best;
    }

    // the straight piece an agent follows on one street: cars in the right-hand lane, walkers on their
    // sidewalk; both stop short of a crossing, and the gap is bridged by a short "turn" piece
    // (end of this street -> start of the next), so nobody ever jumps
    edgeSeg(kind, side, A, link) {
      const B = link.node;
      let dx = B.x - A.x, dy = B.y - A.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const nx = -dy, ny = dx;
      let off, cutA, cutB;
      if (kind === 'car') {
        off = link.hw * 0.5;
        cutA = A.r; cutB = B.r;
      } else {
        off = link.car ? side * (link.hw + this.sw * 0.65) : side * 3; // the outer part of the sidewalk: trees and lamps stand at the curb
        cutA = A.r > 0 ? A.r + (link.car ? this.sw * 0.65 : 0) : 0;
        cutB = B.r > 0 ? B.r + (link.car ? this.sw * 0.65 : 0) : 0;
      }
      if (cutA + cutB > len * 0.9) { const k = (len * 0.9) / (cutA + cutB); cutA *= k; cutB *= k; }
      return { x0: A.x + dx * cutA + nx * off, y0: A.y + dy * cutA + ny * off, x1: B.x - dx * cutB + nx * off, y1: B.y - dy * cutB + ny * off };
    }

    setSeg(a, s) { a.seg = s; a.seg.len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0); }

    // where the lines through two pieces cross (null when they are parallel)
    lineCross(s, t) {
      const rx = s.x1 - s.x0, ry = s.y1 - s.y0, qx = t.x1 - t.x0, qy = t.y1 - t.y0;
      const den = rx * qy - ry * qx;
      if (Math.abs(den) < 1e-6 * Math.hypot(rx, ry) * Math.hypot(qx, qy)) return null;
      const u = ((t.x0 - s.x0) * qy - (t.y0 - s.y0) * qx) / den;
      return { x: s.x0 + rx * u, y: s.y0 + ry * u };
    }

    linksFor(a, node) { return a.kind === 'car' ? node.links.filter((l) => l.car) : node.links; }

    spawnAgent(kind, speed) {
      const from = pick(kind === 'car' ? this.carNodes : this.walkNodes);
      const a = { kind, speed, side: Math.random() < 0.5 ? 1 : -1, from, phase: 'edge', d: 0, hx: 0, hy: 1 };
      a.link = pick(this.linksFor(a, from));
      a.to = a.link.node;
      this.setSeg(a, this.edgeSeg(kind, a.side, from, a.link));
      a.d = Math.random() * a.seg.len;
      return a;
    }

    // move along the pieces; at a crossing pick the next street (no U-turn unless it is a dead end)
    stepAgent(a, dt) {
      a.d += a.speed * dt;
      let guard = 0;
      while (a.d >= a.seg.len && guard++ < 6) {
        a.d -= a.seg.len;
        if (a.phase === 'edge') {
          const B = a.to;
          let options = this.linksFor(a, B).filter((l) => l.node !== a.from);
          if (!options.length) options = this.linksFor(a, B);
          const link = pick(options);
          const next = this.edgeSeg(a.kind, a.side, B, link);
          a.next = { from: B, link, seg: next };
          // go round the real corner where the two lanes / sidewalks meet, not diagonally through a building
          const c = this.lineCross(a.seg, next);
          a.turnPts = c && Math.hypot(c.x - B.x, c.y - B.y) < B.r + 70 ? [c, { x: next.x0, y: next.y0 }] : [{ x: next.x0, y: next.y0 }];
          const p = a.turnPts.shift();
          this.setSeg(a, { x0: a.seg.x1, y0: a.seg.y1, x1: p.x, y1: p.y });
          a.phase = 'turn';
        } else if (a.turnPts.length) {
          const p = a.turnPts.shift();
          this.setSeg(a, { x0: a.seg.x1, y0: a.seg.y1, x1: p.x, y1: p.y });
        } else {
          a.from = a.next.from; a.link = a.next.link; a.to = a.link.node;
          this.setSeg(a, a.next.seg);
          a.phase = 'edge';
        }
      }
    }

    // position and heading on the current piece
    agentPos(a) {
      const s = a.seg, t = s.len > 0 ? Math.min(1, a.d / s.len) : 1;
      if (s.len > 0.5) { a.hx = (s.x1 - s.x0) / s.len; a.hy = (s.y1 - s.y0) / s.len; }
      return { x: s.x0 + (s.x1 - s.x0) * t, y: s.y0 + (s.y1 - s.y0) * t, dx: a.hx, dy: a.hy };
    }

    // ---------------------------------------------------------------- labels, zoom, input
    makeLabel(l) {
      const el = document.createElement('div');
      el.className = 'wl wl-' + l.kind;
      el.innerHTML = (l.npc || l.kind === 'boss' ? '<b>!</b>' : '') + l.text;
      el.hidden = true;
      hooks.labelLayer.appendChild(el);
      return { ...l, el, shown: false };
    }

    // two fingers on the map: spread = closer, pinch = further, like zooming a photo.
    // Read straight from the touch events, and the browser's own page zoom is blocked
    // (iOS Safari ignores user-scalable=no and would otherwise zoom the whole page instead).
    bindPinch() {
      const el = this.game.canvas;
      const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
      el.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) { this.pinch = { d: Math.max(10, dist(e.touches)), z: this.zoomTarget }; e.preventDefault(); }
      }, { passive: false });
      el.addEventListener('touchmove', (e) => {
        if (e.touches.length !== 2 || !this.pinch) return;
        e.preventDefault();
        this.zoomTarget = clamp(this.pinch.z * (dist(e.touches) / this.pinch.d), this.fitZoom(), MAX_ZOOM);
      }, { passive: false });
      const end = (e) => { if (e.touches.length < 2) this.pinch = null; };
      el.addEventListener('touchend', end);
      el.addEventListener('touchcancel', end);
      ['gesturestart', 'gesturechange', 'gestureend'].forEach((n) => document.addEventListener(n, (e) => e.preventDefault(), { passive: false }));
      document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
    }

    defaultZoom() { return clamp(Math.round(this.scale.width / 130), 2, MAX_ZOOM); }

    fitZoom() { return Math.min(this.scale.width / this.W, this.scale.height / this.H); }

    // dir: +1 zoom in, -1 zoom out, 0 back to default
    zoomStep(dir) {
      const fit = this.fitZoom();
      const levels = [fit, 0.5, 1, 1.5, 2, 3, MAX_ZOOM].filter((z) => z >= fit - 1e-6).sort((a, b) => a - b);
      if (dir === 0) { this.zoomTarget = this.defaultZoom(); return; }
      const cur = this.zoomTarget;
      if (dir > 0) this.zoomTarget = levels.find((z) => z > cur + 0.01) || levels[levels.length - 1];
      else this.zoomTarget = [...levels].reverse().find((z) => z < cur - 0.01) || levels[0];
    }

    // ---------------------------------------------------------------- fighting on the street
    attack(w) {
      const px = this.player.x, py = this.player.y, f = this.face;
      const a = Math.atan2(f.y, f.x);
      if (w.attack === 'gun') {
        this.bullets.push({ x: px + f.x * 9, y: py + f.y * 9, vx: f.x * 300, vy: f.y * 300, life: 0.55 });
        const flash = this.add.circle(px + f.x * 10, py + f.y * 10, 4, 0xffe2a0, 0.95).setDepth(13);
        this.tweens.add({ targets: flash, alpha: 0, scale: 1.8, duration: 90, onComplete: () => flash.destroy() });
        hooks.onCrime('shot');
        return;
      }
      // melee: a white arc in front of the player, hits anyone close inside the arc
      const g = this.add.graphics().setDepth(13);
      g.lineStyle(2, 0xf0e6cc, 0.95);
      g.beginPath();
      g.arc(px, py, 13, a - 1.1, a + 1.1);
      g.strokePath();
      g.lineStyle(1, 0xffffff, 0.5);
      g.beginPath();
      g.arc(px, py, 10, a - 0.8, a + 0.8);
      g.strokePath();
      this.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
      for (const wk of this.targets()) {
        if (wk.down > 0) continue;
        const dx = wk.s.x - px, dy = wk.s.y - py, d = Math.hypot(dx, dy);
        if (d > 20) continue;
        let diff = Math.abs(Math.atan2(dy, dx) - a);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        if (diff < 1.25) this.knock(wk, 'hitMelee');
      }
    }

    // everyone a swing or a bullet can hit
    targets() {
      const t = [...this.walkers];
      if (this.rp.on) t.push(this.rp);
      if (this.rn.on) t.push(this.rn);
      return t;
    }

    knock(wk, kind) {
      if (wk === this.rn) { // the lucky runner vanishes in a burst of sparkles
        wk.on = false;
        wk.s.setVisible(false);
        wk.aura.setVisible(false);
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          const st = this.add.image(wk.s.x, wk.s.y, 'fx_star').setDepth(14).setTint(i % 2 ? 0xffffff : 0xf0d27a);
          this.tweens.add({ targets: st, x: wk.s.x + Math.cos(a) * 18, y: wk.s.y + Math.sin(a) * 18, alpha: 0, scale: 0.4, angle: 180, duration: 600, ease: 'Cubic.out', onComplete: () => st.destroy() });
        }
        hooks.onRunnerHit();
        return;
      }
      if (wk === this.rp) { // stopping the thief is not a crime
        wk.down = 5;
        wk.s.setAngle(wk.s.angle + 90).setTint(0xff9a8a);
        return;
      }
      wk.down = Infinity; // lies there until the medics come
      wk.s.setAngle(wk.s.angle + 90).setTint(0xff5040);
      this.time.delayedCall(220, () => { if (wk.down > 0) wk.s.setTint(0xb8b0a8); });
      const blood = this.add.image(wk.s.x, wk.s.y, 'fx_blood').setDepth(5.5).setAngle(Math.random() * 360).setScale(0.25).setAlpha(0.95);
      this.tweens.add({ targets: blood, scale: 1, duration: 1400, ease: 'Cubic.out' });
      this.time.delayedCall(45000, () => this.tweens.add({ targets: blood, alpha: 0, duration: 4000, onComplete: () => blood.destroy() }));
      this.dropPill(wk.s.x, wk.s.y);
      this.time.delayedCall(2500, () => this.callAmbulance(wk));
      hooks.onCrime(kind);
    }

    makeTextures() {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      // blood pool: an irregular dark red splat
      g.fillStyle(0x4a0606, 1).fillCircle(12, 12, 8).fillCircle(6, 9, 4).fillCircle(18, 15, 4).fillCircle(14, 5, 3).fillCircle(5, 17, 2).fillCircle(20, 7, 2);
      g.fillStyle(0x7a0c0a, 1).fillCircle(11, 12, 5).fillCircle(15, 14, 3);
      g.fillStyle(0xa3201a, 0.8).fillCircle(10, 10, 2);
      g.generateTexture('fx_blood', 24, 24).clear();
      // pills: capsules (red, blue) and a green heart
      const capsule = (key, dark, light) => {
        g.fillStyle(0x000000, 0.6).fillRoundedRect(0, 2, 10, 6, 3);
        g.fillStyle(dark, 1).fillRoundedRect(0, 1, 5, 6, { tl: 3, bl: 3, tr: 0, br: 0 });
        g.fillStyle(0xf2ece0, 1).fillRoundedRect(5, 1, 5, 6, { tl: 0, bl: 0, tr: 3, br: 3 });
        g.fillStyle(light, 1).fillRect(1, 2, 3, 1);
        g.generateTexture(key, 10, 9).clear();
      };
      capsule('pill_red', 0xd42a22, 0xff9a8a);
      capsule('pill_blue', 0x2f6fe0, 0x9cc4ff);
      g.fillStyle(0x0a2a0a, 0.8).fillCircle(3, 4, 3).fillCircle(7, 4, 3).fillTriangle(0, 5, 10, 5, 5, 10);
      g.fillStyle(0x3ccf4e, 1).fillCircle(3, 3, 3).fillCircle(7, 3, 3).fillTriangle(0, 4, 10, 4, 5, 9);
      g.fillStyle(0xb8ffb0, 1).fillRect(2, 2, 2, 1);
      g.generateTexture('pill_green', 10, 10).clear();
      // four-point sparkle
      g.fillStyle(0xffffff, 1).fillTriangle(3, 0, 2, 3, 4, 3).fillTriangle(3, 7, 2, 4, 4, 4).fillTriangle(0, 3, 3, 2, 3, 4).fillTriangle(7, 3, 4, 2, 4, 4).fillRect(2, 2, 3, 3);
      g.generateTexture('fx_star', 7, 7).clear();
      // ambulance (front = top, like the other cars)
      g.fillStyle(0x000000, 0.45).fillRect(2, 3, 16, 29);
      g.fillStyle(0xeeeae0, 1).fillRect(1, 2, 16, 28);
      g.fillStyle(0x2a3440, 1).fillRect(3, 5, 12, 4); // windscreen
      g.fillStyle(0xd8d3c7, 1).fillRect(2, 10, 14, 19);
      g.fillStyle(0xd42a22, 1).fillRect(7, 13, 4, 12).fillRect(3, 17, 12, 4); // red cross on the roof
      g.fillStyle(0xd42a22, 1).fillRect(1, 27, 16, 2);
      g.fillStyle(0xe0352b, 1).fillRect(3, 9, 5, 2);
      g.fillStyle(0x2f6fe0, 1).fillRect(10, 9, 5, 2);
      g.generateTexture('car_ambulance', 18, 32).clear();
      g.destroy();
    }

    dropPill(x, y) {
      const kind = ['red', 'blue', 'green'][Math.floor(Math.random() * 3)];
      // land only where the player can walk: try a few directions, otherwise it stays at the person's feet
      const blocked = (px, py) => [[0, 0], [-6, 0], [6, 0], [0, -6], [0, 6]].some(([ox, oy]) => this.solidAt(px + ox, py + oy));
      const a0 = Math.random() * Math.PI * 2;
      let tx = x, ty = y;
      for (let i = 0; i < 8; i++) {
        const a = a0 + (i * Math.PI) / 4;
        const cx = x + Math.cos(a) * 9, cy = y + Math.sin(a) * 9;
        if (!blocked(cx, cy)) { tx = cx; ty = cy; break; }
      }
      const glow = this.add.circle(tx, ty, 6, { red: 0xd42a22, blue: 0x2f6fe0, green: 0x3ccf4e }[kind], 0.25).setDepth(6.5);
      const s = this.add.image(x, y, 'pill_' + kind).setDepth(7);
      this.tweens.add({ targets: s, x: tx, duration: 380 });
      this.tweens.add({ targets: s, y: ty - 8, duration: 190, ease: 'Quad.out', yoyo: false, onComplete: () => {
        this.tweens.add({ targets: s, y: ty, duration: 190, ease: 'Bounce.out', onComplete: () => {
          this.tweens.add({ targets: s, y: ty - 2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        } });
      } });
      this.tweens.add({ targets: glow, alpha: 0.5, scale: 1.4, duration: 700, yoyo: true, repeat: -1 });
      this.pills.push({ kind, s, glow, x: tx, y: ty, ttl: 90, ready: 0.5 });
    }

    updatePills(dt, paused) {
      const px = this.player.x, py = this.player.y;
      this.pills = this.pills.filter((p) => {
        p.ttl -= dt; p.ready -= dt;
        const take = !paused && p.ready <= 0 && Math.hypot(p.x - px, p.y - py) < 9;
        if (take) hooks.onPill(p.kind);
        if (take || p.ttl <= 0) {
          this.tweens.killTweensOf([p.s, p.glow]);
          this.tweens.add({ targets: [p.s, p.glow], alpha: 0, scale: take ? 2.2 : 0.5, y: p.y - (take ? 10 : 0), duration: 260, onComplete: () => { p.s.destroy(); p.glow.destroy(); } });
          return false;
        }
        return true;
      });
    }

    updateTurf(dt) {
      this.turfT -= dt;
      if (this.turfT > 0) return;
      this.turfT = 0.5;
      const view = hooks.turf();
      if (!view) return;
      for (const tf of this.turf) {
        const v = view.find((x) => x.id === tf.d.id);
        const o = v && v.owner;
        const sig = o ? o.id + o.color + o.tag : 'free';
        if (sig === tf.sig) continue;
        tf.sig = sig;
        tf.g.clear();
        tf.t.setText(o ? o.tag : '');
        const kind = v.kindInfo.name;
        tf.label.el.innerHTML = (o && o.mine ? '<b>★</b>' : '') + kind + ' · ' + (o ? o.tag : 'voľný');
        tf.label.el.className = 'wl wl-turf' + (o ? (o.mine ? ' mine' : '') : ' free');
        tf.label.el.style.borderColor = o ? o.color : '';
        tf.label.el.style.color = o ? o.color : '';
        tf.label.w = 0;
        if (!o) continue;
        // a wavy spray-paint tag, like the ones on the map art
        const c = Phaser.Display.Color.HexStringToColor(o.color).color;
        const cx = tf.gx, cy = tf.gy, w = tf.d.kind === 'corner' ? 30 : 44;
        let ph = 0;
        for (const ch of o.id) ph += ch.charCodeAt(0);
        tf.g.lineStyle(2, c, 0.85).beginPath();
        for (let i = 0; i <= w; i += 2) {
          const x = cx - w / 2 + i, y = cy + Math.sin(i * 0.45 + ph) * (w / 9) + Math.sin(i * 0.15) * 2;
          if (i === 0) tf.g.moveTo(x, y); else tf.g.lineTo(x, y);
        }
        tf.g.strokePath();
        tf.g.lineStyle(1, c, 0.6).lineBetween(cx - w / 2, cy + w / 6, cx + w / 2, cy + w / 6 - 2);
        tf.g.fillStyle(c, 0.5);
        for (let i = 0; i < 8; i++) tf.g.fillRect(cx - w / 2 + ((i * 37 + ph) % w), cy - 6 + ((i * 13 + ph) % 12), 1, 1);
      }
    }

    // ---------------------------------------------------------------- ambulance
    // a few streets away along the graph, so it arrives driving instead of appearing next to the body
    routeFrom(start, steps, avoid) {
      const path = [start];
      let prev = avoid || null, cur = start;
      for (let i = 0; i < steps; i++) {
        let options = cur.cn.filter((n) => n !== prev && !path.includes(n));
        if (!options.length) break;
        const next = pick(options);
        path.push(next); prev = cur; cur = next;
      }
      return path;
    }

    // node path -> points in the right-hand lane (the same pieces traffic uses)
    lanePoints(path) {
      const pts = [];
      for (let i = 0; i + 1 < path.length; i++) {
        const link = path[i].links.find((l) => l.node === path[i + 1]);
        const s = this.edgeSeg('car', 1, path[i], link);
        pts.push({ x: s.x0, y: s.y0 }, { x: s.x1, y: s.y1 });
      }
      return pts;
    }

    callAmbulance(wk) {
      const stopNode = this.nearestNode(wk.s.x, wk.s.y, this.carNodes);
      const approach = this.routeFrom(stopNode, 6).reverse(); // ends at stopNode
      const leave = this.routeFrom(stopNode, 6, approach[approach.length - 2]);
      const inPts = this.lanePoints(approach), outPts = this.lanePoints(leave);
      if (!inPts.length) inPts.push({ x: stopNode.x, y: stopNode.y });
      const car = this.add.image(inPts[0].x, inPts[0].y, 'car_ambulance').setDepth(8);
      const light = this.add.graphics().setDepth(9);
      this.ambulances.push({ wk, car, light, phase: 'drive', route: inPts, out: outPts, medics: [], t: 0 });
    }

    updateAmbulances(dt, time) {
      const move = (o, tx, ty, speed) => {
        const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy), step = speed * dt;
        if (d <= step) { o.x = tx; o.y = ty; return true; }
        o.x += (dx / d) * step; o.y += (dy / d) * step;
        return false;
      };
      // follow a list of points; true when the last one is reached
      const drive = (c, pts) => {
        if (!pts.length) return true;
        const p = pts[0];
        if (Math.hypot(p.x - c.x, p.y - c.y) > 0.5) c.setAngle(deg(Math.atan2(p.y - c.y, p.x - c.x)) + 90);
        if (move(c, p.x, p.y, 75)) pts.shift();
        return !pts.length;
      };
      const walk = (m, tx, ty) => {
        const s = m.s;
        const arrived = move(s, tx, ty, 30);
        if (!arrived) {
          s.setAngle(deg(Math.atan2(ty - s.y, tx - s.x)) - 90);
          m.walkT += dt * 6;
          s.setFlipX(Math.floor(m.walkT) % 2 === 1);
        }
        return arrived;
      };
      this.ambulances = this.ambulances.filter((a) => {
        const c = a.car, wk = a.wk;
        const on = Math.floor(time / 180) % 2 === 0;
        a.light.clear().fillStyle(on ? 0xe0352b : 0x2f6fe0, 0.22).fillCircle(c.x, c.y, 14);
        if (a.phase === 'drive') {
          if (drive(c, a.route)) {
            a.phase = 'out';
            a.medics = [-1, 1].map((side) => {
              const s = this.add.image(c.x + side * 6, c.y + side * 3, 'p_lekarka').setDepth(9);
              return { s, side, walkT: 0, home: { x: c.x + side * 6, y: c.y + side * 3 } };
            });
          }
        } else if (a.phase === 'out') {
          const done = a.medics.map((m) => walk(m, wk.s.x + m.side * 6, wk.s.y + 2)).every(Boolean);
          if (done) {
            a.phase = 'help'; a.t = 1.8;
            a.medics.forEach((m) => m.s.setAngle(deg(Math.atan2(wk.s.y - m.s.y, wk.s.x - m.s.x)) - 90));
            const plus = this.add.text(wk.s.x, wk.s.y - 8, '+', { fontFamily: 'monospace', fontSize: '10px', color: '#ff5a50' }).setOrigin(0.5).setDepth(14).setResolution(4);
            this.tweens.add({ targets: plus, y: wk.s.y - 20, alpha: 0, duration: 1600, onComplete: () => plus.destroy() });
          }
        } else if (a.phase === 'help') {
          a.t -= dt;
          if (a.t <= 0) {
            wk.down = 0; // back on his feet; the walker loop takes over again
            wk.s.clearTint();
            a.phase = 'back';
          }
        } else if (a.phase === 'back') {
          const done = a.medics.map((m) => walk(m, m.home.x, m.home.y)).every(Boolean);
          if (done) { a.medics.forEach((m) => m.s.destroy()); a.medics = []; a.phase = 'leave'; }
        } else if (a.phase === 'leave') {
          if (drive(c, a.out)) {
            this.tweens.add({ targets: c, alpha: 0, duration: 400, onComplete: () => c.destroy() });
            a.light.destroy();
            return false;
          }
        }
        return true;
      });
    }

    // ---------------------------------------------------------------- Ripper and the lucky runner
    // run from node to node; when the player is close, take the street that leads away from him
    runStep(r, dt, speed, fleeDist) {
      const px = this.player.x, py = this.player.y;
      const dx = r.to.x - r.s.x, dy = r.to.y - r.s.y, d = Math.hypot(dx, dy);
      const step = speed * dt;
      if (d <= step) {
        r.s.setPosition(r.to.x, r.to.y);
        let options = r.to.n.filter((n) => n !== r.prev);
        if (!options.length) options = r.to.n;
        const near = Math.hypot(r.s.x - px, r.s.y - py) < fleeDist;
        const next = near
          ? options.reduce((a, b) => (Math.hypot(b.x - px, b.y - py) > Math.hypot(a.x - px, a.y - py) ? b : a))
          : pick(options);
        r.prev = r.to;
        r.to = next;
      } else {
        r.s.x += (dx / d) * step;
        r.s.y += (dy / d) * step;
        r.s.setAngle(deg(Math.atan2(dy, dx)) - 90);
        r.walkT += dt * (speed / 7);
        r.s.setFlipX(Math.floor(r.walkT) % 2 === 1);
      }
    }

    updateRipper(dt, paused) {
      const st = hooks.reaper();
      const rp = this.rp;
      if (st && st.active && !rp.on) {
        const wex = NPCS.find((n) => n.id === 'wexler');
        rp.on = true; rp.down = 0; rp.prev = null;
        rp.s.setPosition(wex.x, wex.y + 10).setVisible(true).clearTint();
        rp.to = this.nearestNode(wex.x, wex.y);
      }
      if ((!st || !st.active) && rp.on) { rp.on = false; rp.s.setVisible(false); }
      if (!rp.on) return;
      const px = this.player.x, py = this.player.y;
      if (rp.down > 0) {
        rp.down -= dt;
        if (!paused && Math.hypot(rp.s.x - px, rp.s.y - py) < 12) {
          rp.on = false; rp.s.setVisible(false);
          hooks.onRipperCaught();
        } else if (rp.down <= 0) rp.s.clearTint();
        return;
      }
      this.runStep(rp, dt, 56, 90);
    }

    // runs the streets faster than you can walk, turns away when you get close; leaves sparkles
    updateRunner(dt) {
      const st = hooks.runner();
      const rn = this.rn;
      if (st && st.active && !rn.on) {
        const n = pick(this.gnodes);
        rn.on = true; rn.prev = null; rn.to = pick(n.n);
        rn.s.setPosition(n.x, n.y).setVisible(true);
        rn.aura.setVisible(true);
      }
      if ((!st || !st.active) && rn.on) { rn.on = false; rn.s.setVisible(false); rn.aura.setVisible(false); }
      if (!rn.on) return;
      this.runStep(rn, dt, 80, 110);
      rn.aura.setPosition(rn.s.x, rn.s.y);
      rn.sparkT -= dt;
      if (rn.sparkT <= 0) {
        rn.sparkT = 0.06;
        const sp = this.add.image(rn.s.x + (Math.random() - 0.5) * 8, rn.s.y + (Math.random() - 0.5) * 8, 'fx_star').setDepth(8.6).setTint(Math.random() < 0.5 ? 0xffffff : 0xf0d27a).setScale(0.5 + Math.random() * 0.6);
        this.tweens.add({ targets: sp, alpha: 0, scale: 0.1, y: sp.y - 4, angle: 90, duration: 700, onComplete: () => sp.destroy() });
      }
    }

    updateBullets(dt) {
      this.fx.clear();
      this.bullets = this.bullets.filter((b) => {
        const steps = 3;
        for (let i = 0; i < steps; i++) {
          b.x += (b.vx * dt) / steps;
          b.y += (b.vy * dt) / steps;
          if (b.x < 0 || b.y < 0 || b.x > this.W || b.y > this.H) return false;
          if (this.solidAt(b.x, b.y)) {
            const s = this.add.circle(b.x, b.y, 2, 0xffd28a, 1).setDepth(13);
            this.tweens.add({ targets: s, alpha: 0, scale: 2, duration: 120, onComplete: () => s.destroy() });
            return false;
          }
          for (const wk of this.targets()) {
            if (wk.down <= 0 && Math.hypot(wk.s.x - b.x, wk.s.y - b.y) < 7) { this.knock(wk, 'hitGun'); return false; }
          }
        }
        b.life -= dt;
        if (b.life <= 0) return false;
        this.fx.fillStyle(0xfff0b8, 1).fillRect(b.x - 1, b.y - 1, 2, 2);
        this.fx.fillStyle(0xffb04a, 0.5).fillRect(b.x - b.vx * 0.012 - 1, b.y - b.vy * 0.012 - 1, 2, 2);
        return true;
      });
    }

    updateCamera(dt) {
      this.zoomTarget = clamp(this.zoomTarget, this.fitZoom(), MAX_ZOOM);
      // while pinching the map follows the fingers directly, like a photo; buttons and the wheel ease in
      if (this.pinch) this.zoom = this.zoomTarget;
      else this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 10);
      const z = this.zoom;
      const sw = this.scale.width, sh = this.scale.height;
      const vw = sw / z, vh = sh / z;
      const tx = vw >= this.W ? this.W / 2 : clamp(this.player.x, vw / 2, this.W - vw / 2);
      // a fully visible map sits in the free band between the top HUD and the joystick
      const freeMid = (150 + (sh - 230)) / 2;
      const ty = vh >= this.H ? this.H / 2 - (freeMid - sh / 2) / z : clamp(this.player.y, vh / 2, this.H - vh / 2);
      const k = Math.min(1, dt * 8);
      this.camX += (tx - this.camX) * k;
      this.camY += (ty - this.camY) * k;
      const cam = this.cameras.main;
      cam.setZoom(z);
      cam.centerOn(this.camX, this.camY);

      // smooth the map when zoomed out, keep it crisp up close
      const lin = z < 1.5;
      if (lin !== this.linear) {
        this.linear = lin;
        this.textures.get('map').setFilter(lin ? Phaser.Textures.FilterMode.LINEAR : Phaser.Textures.FilterMode.NEAREST);
      }

      const ready = hooks.readyGiver();
      for (const l of this.labels) {
        const src = l.follow ? this.player : l.reaper ? this.rp.s : l;
        const wx = src.x;
        const wy = src.y + (l.dy || 0);
        let sx = (wx - this.camX) * z + sw / 2;
        const sy = (wy - this.camY) * z + sh / 2;
        // the whole city at once: only district names (and you), everything else would pile up
        const far = z < 0.55 && l.kind !== 'district' && !l.follow;
        const inZoom = !far && (!l.minZoom || z >= l.minZoom) && (!l.maxZoom || z < l.maxZoom);
        const show = inZoom && (!l.reaper || this.rp.on) && sx > -80 && sx < sw + 80 && sy > -30 && sy < sh + 30;
        if (show !== l.shown) { l.el.hidden = !show; l.shown = show; }
        if (show) {
          if (!l.w) l.w = l.el.offsetWidth;
          sx = clamp(sx, l.w / 2 + 4, sw - l.w / 2 - 4);
          l.el.style.transform = 'translate(' + Math.round(sx) + 'px,' + Math.round(sy) + 'px) translate(-50%,-50%)';
        }
        if (l.npc) l.el.classList.toggle('ready', ready === l.npc);
      }
    }

    update(time, deltaMs) {
      const dt = Math.min(0.05, deltaMs / 1000);
      const paused = hooks.paused();

      // --- player
      let vx = hooks.input.x, vy = hooks.input.y;
      const k = this.keys;
      if (k.A.isDown || k.LEFT.isDown) vx -= 1;
      if (k.D.isDown || k.RIGHT.isDown) vx += 1;
      if (k.W.isDown || k.UP.isDown) vy -= 1;
      if (k.S.isDown || k.DOWN.isDown) vy += 1;
      let mag = Math.hypot(vx, vy);
      if (paused || mag < 0.15) { vx = 0; vy = 0; mag = 0; }
      if (mag > 1) { vx /= mag; vy /= mag; mag = 1; }
      this.player.setVelocity(vx * SPEED, vy * SPEED);
      if (mag > 0) {
        this.face = { x: vx / mag, y: vy / mag };
        this.player.setAngle(deg(Math.atan2(vy, vx)) - 90);
        this.walkT += dt * (4 + 6 * mag);
        this.player.setFlipX(Math.floor(this.walkT) % 2 === 1);
      }
      const px = this.player.x, py = this.player.y;
      this.ring.clear();
      this.ring.lineStyle(1, 0xe0b444, 0.95).strokeEllipse(px, py + 2, 18, 10);
      this.ring.lineStyle(1, 0xe0b444, 0.35).strokeEllipse(px, py + 2, 22, 13);

      // --- attacking with the equipped weapon
      this.attackCd -= dt;
      const weapon = hooks.weapon();
      if (!paused && weapon && (hooks.input.fire || k.F.isDown) && this.attackCd <= 0) {
        this.attack(weapon);
        this.attackCd = weapon.cooldown;
        if (!weapon.auto) hooks.input.fire = false; // a tap is one swing / one shot
      }
      this.updateBullets(dt);
      this.updateRipper(dt, paused);
      this.updatePills(dt, paused);
      this.updateRunner(dt);
      this.updateAmbulances(dt, time);
      this.updateTurf(dt);

      // --- points of interest
      let best = null, bestD = 1e9;
      for (const poi of POIS) {
        const d = Math.hypot(poi.x - px, poi.y - py);
        if (d < poi.r && d < bestD) { best = poi; bestD = d; }
      }
      if (best !== this.currentPoi) { this.currentPoi = best; hooks.onPoi(best); }

      // --- pedestrians on the sidewalks
      for (const w of this.walkers) {
        if (w.down > 0) {
          w.down -= dt;
          if (w.down <= 0) w.s.clearTint();
          continue;
        }
        this.stepAgent(w, dt);
        const p = this.agentPos(w);
        w.s.setPosition(p.x, p.y).setAngle(deg(Math.atan2(p.dy, p.dx)) - 90);
        w.flipT += dt * 5;
        w.s.setFlipX(Math.floor(w.flipT) % 2 === 1);
      }

      // --- traffic and police in the right-hand lane
      const stars = hooks.heatStars();
      const lights = stars >= 2, on = Math.floor(time / 250) % 2 === 0;
      for (const c of [...this.cars, ...this.policeCars]) {
        this.stepAgent(c, dt);
        const p = this.agentPos(c);
        // steer smoothly through a turn instead of snapping to the new heading
        const target = deg(Math.atan2(p.dy, p.dx)) + 90;
        if (c.ang === undefined) c.ang = target;
        c.ang += Phaser.Math.Angle.ShortestBetween(c.ang, target) * Math.min(1, dt * 9);
        c.s.setPosition(p.x, p.y).setAngle(c.ang);
        if (c.light) {
          c.light.clear();
          if (lights) c.light.fillStyle(on ? 0xe0352b : 0x2f6fe0, 0.18).fillCircle(p.x, p.y, 16);
        }
      }

      // --- officer chase at high heat
      this.officerCooldown -= dt;
      if (!this.officer && !paused && stars >= 3 && this.officerCooldown <= 0) {
        const ang = Math.random() * Math.PI * 2;
        this.officer = this.add.image(px + Math.cos(ang) * 90, py + Math.sin(ang) * 90, 'p_policajt').setDepth(9);
        this.officerT = 0;
      }
      if (this.officer) {
        if (stars < 3) { this.officer.destroy(); this.officer = null; }
        else if (!paused) {
          const dx = px - this.officer.x, dy = py - this.officer.y, d = Math.hypot(dx, dy);
          if (d < 9) {
            this.officer.destroy(); this.officer = null; this.officerCooldown = 60;
            hooks.onPolice();
          } else {
            this.officer.x += (dx / d) * 44 * dt;
            this.officer.y += (dy / d) * 44 * dt;
            this.officer.setAngle(deg(Math.atan2(dy, dx)) - 90);
            this.officerT += dt * 6;
            this.officer.setFlipX(Math.floor(this.officerT) % 2 === 1);
          }
        }
      }

      this.updateCamera(dt);
    }
  }

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#080808',
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth || 390, height: parent.clientHeight || 844 },
    physics: { default: 'arcade', arcade: { debug: false } },
    input: { keyboard: true },
    scene: City,
  });
}
