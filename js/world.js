// The open world: pixel-art city, player movement, NPCs, traffic, police. Uses global Phaser.
import { NPCS, POIS, TRAFFIC, POLICE_LOOP, WALKERS, SPAWN, LABELS, REAPER_ROADS, TURF } from './data.js';

const PEOPLE = ['hrac', 'zlodej', 'svalovec', 'dealer', 'boss', 'zadavatel', 'diler', 'mechanik', 'pravnicka', 'lekarka', 'policajt', 'chodkyna', 'chodec'];
const CARS = ['sedan_blue', 'sedan_red', 'sedan_green', 'sedan_white', 'taxi', 'police', 'van', 'pickup'];
const SPEED = 62; // map px per second
const MAX_ZOOM = 4;
const deg = (r) => (r * 180) / Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// hooks: { input:{x,y,fire}, labelLayer:HTMLElement, paused():bool, heatStars():number, readyGiver():string|null,
//          weapon():{attack,cooldown,auto}|null, onCrime('shot'|'hitGun'|'hitMelee'), onPill('red'|'blue'|'green'), onPoi(poi|null), onAction(), onPolice() }
export function createWorld(parent, hooks) {
  class City extends Phaser.Scene {
    constructor() { super('city'); }

    preload() {
      this.load.image('map', 'assets/world/map_base.png');
      this.load.json('mapdata', 'assets/world/map.json');
      PEOPLE.forEach((n) => this.load.image('p_' + n, 'assets/world/p_' + n + '.png'));
      CARS.forEach((n) => this.load.image('car_' + n, 'assets/world/car_' + n + '.png'));
      this.load.image('bubble', 'assets/world/bubble.png');
      this.load.image('bubble_gold', 'assets/world/bubble_gold.png');
    }

    create() {
      const md = this.cache.json.get('mapdata');
      this.W = md.w;
      this.H = md.h;
      this.add.image(0, 0, 'map').setOrigin(0, 0).setDepth(0);
      this.physics.world.setBounds(0, 0, md.w, md.h);

      this.solids = this.physics.add.staticGroup();
      md.solids.forEach(([x, y, w, h]) => {
        const z = this.add.zone(x + w / 2, y + h / 2, w, h);
        this.physics.add.existing(z, true);
        this.solids.add(z);
      });

      // static NPCs
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
      this.walkT = 0;
      this.face = { x: 0, y: 1 };

      // street attacks: slash arcs, bullets, muzzle flashes
      this.solidRects = md.solids;
      this.fx = this.add.graphics().setDepth(12);
      this.bullets = [];
      this.attackCd = 0;

      // pedestrians
      this.walkers = WALKERS.map((w) => {
        const s = this.add.image(w.a[0], w.a[1], w.sprite).setDepth(6);
        return { ...w, s, t: Math.random(), dir: 1, flipT: 0, down: 0 };
      });

      // traffic
      this.cars = TRAFFIC.map((c) => {
        const s = this.add.image(c.from[0], c.from[1], c.sprite).setDepth(8);
        const len = Math.hypot(c.to[0] - c.from[0], c.to[1] - c.from[1]);
        s.setAngle(deg(Math.atan2(c.to[1] - c.from[1], c.to[0] - c.from[0])) + 90);
        return { ...c, s, len, t: c.delay != null ? c.delay : Math.random() };
      });

      // police patrol around the park
      this.loopLen = 0;
      this.loopSegs = POLICE_LOOP.map((p, i) => {
        const q = POLICE_LOOP[(i + 1) % POLICE_LOOP.length];
        const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const seg = { p, q, len, start: this.loopLen };
        this.loopLen += len;
        return seg;
      });
      this.police = this.add.image(POLICE_LOOP[0][0], POLICE_LOOP[0][1], 'car_police').setDepth(8);
      this.policeD = 0;
      this.policeLight = this.add.graphics().setDepth(9);

      // Ripper: a thief running along the street lanes (graph of road nodes)
      const nodes = new Map();
      const node = (x, y) => { const k = x + ',' + y; if (!nodes.has(k)) nodes.set(k, { x, y, n: [] }); return nodes.get(k); };
      const link = (pts) => { for (let i = 0; i + 1 < pts.length; i++) { pts[i].n.push(pts[i + 1]); pts[i + 1].n.push(pts[i]); } };
      REAPER_ROADS.hy.forEach((y) => link(REAPER_ROADS.hx.map((x) => node(x, y))));
      REAPER_ROADS.vx.forEach((x) => link(REAPER_ROADS.vy.map((y) => node(x, y))));
      this.roadNodes = [...nodes.values()];
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
      this.input.on('wheel', (p, over, dx, dy) => {
        this.zoomTarget = clamp(this.zoomTarget * (dy > 0 ? 0.85 : 1.18), this.fitZoom(), MAX_ZOOM);
      });

      // map labels (DOM, so text stays crisp at any zoom)
      this.labels = LABELS.map((l) => this.makeLabel(l));
      this.labels.push(this.makeLabel({ text: 'Ty', kind: 'me', follow: true, maxZoom: 1.6, dy: -16 }));
      this.labels.push(this.makeLabel({ text: 'Ripper', kind: 'boss', reaper: true, dy: -16 }));

      // gang turf: owner graffiti on the roof + a label in the owner's colour
      this.turf = TURF.map((d) => {
        const g = this.add.graphics().setDepth(1);
        const t = this.add.text(d.g[0], d.g[1] + 9, '', { fontFamily: 'Georgia, serif', fontStyle: 'bold italic', fontSize: '9px', color: '#fff' }).setOrigin(0.5).setDepth(1).setResolution(4).setAlpha(0.9);
        const label = this.makeLabel({ text: d.name, kind: 'free', x: d.l[0], y: d.l[1] });
        this.labels.push(label);
        return { d, g, t, label, sig: null };
      });
      this.turfT = 0;

      // keyboard
      this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,F', false);
      this.input.keyboard.on('keydown-E', () => { if (!hooks.paused()) hooks.onAction(); });
      this.input.keyboard.on('keydown-SPACE', () => { if (!hooks.paused()) hooks.onAction(); });

      this.currentPoi = null;
    }

    makeLabel(l) {
      const el = document.createElement('div');
      el.className = 'wl wl-' + l.kind;
      el.innerHTML = (l.npc || l.kind === 'boss' ? '<b>!</b>' : '') + l.text;
      el.hidden = true;
      hooks.labelLayer.appendChild(el);
      return { ...l, el, shown: false };
    }

    defaultZoom() { return clamp(Math.round(this.scale.width / 130), 2, MAX_ZOOM); }

    fitZoom() { return Math.min(this.scale.width / this.W, this.scale.height / this.H); }

    // dir: +1 zoom in, -1 zoom out, 0 back to default
    zoomStep(dir) {
      const fit = this.fitZoom();
      const levels = [fit, 1, 1.5, 2, 3, MAX_ZOOM].filter((z) => z >= fit - 1e-6).sort((a, b) => a - b);
      if (dir === 0) { this.zoomTarget = this.defaultZoom(); return; }
      const cur = this.zoomTarget;
      if (dir > 0) this.zoomTarget = levels.find((z) => z > cur + 0.01) || levels[levels.length - 1];
      else this.zoomTarget = [...levels].reverse().find((z) => z < cur - 0.01) || levels[0];
    }

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
      const a = Math.random() * Math.PI * 2;
      const tx = x + Math.cos(a) * 9, ty = y + Math.sin(a) * 9;
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
        const [cx, cy] = tf.d.g, w = tf.d.kind === 'corner' ? 30 : 44;
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

    // closest point on a street lane, and the lane's direction there
    nearestRoad(x, y) {
      const R = REAPER_ROADS;
      let best = null;
      const consider = (qx, qy, a0, a1, horiz) => {
        const d = Math.hypot(qx - x, qy - y);
        if (!best || d < best.d) best = { x: qx, y: qy, d, a0, a1, horiz };
      };
      const hx0 = Math.min(...R.hx), hx1 = Math.max(...R.hx), vy0 = Math.min(...R.vy), vy1 = Math.max(...R.vy);
      R.hy.forEach((ry) => consider(clamp(x, hx0, hx1), ry, hx0, hx1, true));
      R.vx.forEach((rx) => consider(rx, clamp(y, vy0, vy1), vy0, vy1, false));
      return best;
    }

    callAmbulance(wk) {
      const r = this.nearestRoad(wk.s.x, wk.s.y);
      const along = r.horiz ? r.x : r.y;
      // come from the longer side of the lane, ~170 px out
      const dir = along - r.a0 > r.a1 - along ? -1 : 1; // -1: drive towards the lane start
      const start = clamp(along - dir * 170, r.a0, r.a1);
      const end = clamp(along + dir * 220, r.a0, r.a1);
      const pt = (v) => (r.horiz ? { x: v, y: r.y } : { x: r.x, y: v });
      const from = pt(start), stop = pt(along), out = pt(end);
      const angle = deg(Math.atan2(r.horiz ? 0 : dir, r.horiz ? dir : 0)) + 90;
      const car = this.add.image(from.x, from.y, 'car_ambulance').setDepth(8).setAngle(angle);
      const light = this.add.graphics().setDepth(9);
      this.ambulances.push({ wk, car, light, phase: 'drive', from, stop, out, medics: [], t: 0 });
    }

    updateAmbulances(dt, time) {
      const move = (o, tx, ty, speed) => {
        const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy), step = speed * dt;
        if (d <= step) { o.x = tx; o.y = ty; return true; }
        o.x += (dx / d) * step; o.y += (dy / d) * step;
        return false;
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
          if (move(c, a.stop.x, a.stop.y, 75)) {
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
          if (move(c, a.out.x, a.out.y, 75)) {
            this.tweens.add({ targets: c, alpha: 0, duration: 400, onComplete: () => c.destroy() });
            a.light.destroy();
            return false;
          }
        }
        return true;
      });
    }

    updateRipper(dt, paused) {
      const st = hooks.reaper();
      const rp = this.rp;
      if (st && st.active && !rp.on) {
        rp.on = true; rp.down = 0; rp.prev = null;
        rp.s.setPosition(530, 300).setVisible(true).clearTint();
        rp.to = this.roadNodes.reduce((a, b) => (Math.hypot(b.x - 530, b.y - 300) < Math.hypot(a.x - 530, a.y - 300) ? b : a));
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
      const dx = rp.to.x - rp.s.x, dy = rp.to.y - rp.s.y, d = Math.hypot(dx, dy);
      const step = 56 * dt;
      if (d <= step) {
        rp.s.setPosition(rp.to.x, rp.to.y);
        let options = rp.to.n.filter((n) => n !== rp.prev);
        if (!options.length) options = rp.to.n;
        const near = Math.hypot(rp.s.x - px, rp.s.y - py) < 90;
        const next = near
          ? options.reduce((a, b) => (Math.hypot(b.x - px, b.y - py) > Math.hypot(a.x - px, a.y - py) ? b : a))
          : options[Math.floor(Math.random() * options.length)];
        rp.prev = rp.to;
        rp.to = next;
      } else {
        rp.s.x += (dx / d) * step;
        rp.s.y += (dy / d) * step;
        rp.s.setAngle(deg(Math.atan2(dy, dx)) - 90);
        rp.walkT += dt * 9;
        rp.s.setFlipX(Math.floor(rp.walkT) % 2 === 1);
      }
    }

    // runs the street lanes faster than you can walk, turns away when you get close; leaves sparkles
    updateRunner(dt) {
      const st = hooks.runner();
      const rn = this.rn;
      if (st && st.active && !rn.on) {
        const n = this.roadNodes[Math.floor(Math.random() * this.roadNodes.length)];
        rn.on = true; rn.prev = null; rn.to = n.n[0];
        rn.s.setPosition(n.x, n.y).setVisible(true);
        rn.aura.setVisible(true);
      }
      if ((!st || !st.active) && rn.on) { rn.on = false; rn.s.setVisible(false); rn.aura.setVisible(false); }
      if (!rn.on) return;
      const px = this.player.x, py = this.player.y;
      const dx = rn.to.x - rn.s.x, dy = rn.to.y - rn.s.y, d = Math.hypot(dx, dy);
      const step = 80 * dt;
      if (d <= step) {
        rn.s.setPosition(rn.to.x, rn.to.y);
        let options = rn.to.n.filter((n) => n !== rn.prev);
        if (!options.length) options = rn.to.n;
        const near = Math.hypot(rn.s.x - px, rn.s.y - py) < 110;
        const next = near
          ? options.reduce((a, b) => (Math.hypot(b.x - px, b.y - py) > Math.hypot(a.x - px, a.y - py) ? b : a))
          : options[Math.floor(Math.random() * options.length)];
        rn.prev = rn.to;
        rn.to = next;
      } else {
        rn.s.x += (dx / d) * step;
        rn.s.y += (dy / d) * step;
        rn.s.setAngle(deg(Math.atan2(dy, dx)) - 90);
        rn.walkT += dt * 12;
        rn.s.setFlipX(Math.floor(rn.walkT) % 2 === 1);
      }
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
          if (this.solidRects.some(([x, y, w, h]) => b.x >= x && b.x <= x + w && b.y >= y && b.y <= y + h)) {
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
      const p1 = this.input.pointer1, p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) {
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (!this.pinch) this.pinch = { d, z: this.zoomTarget };
        else this.zoomTarget = clamp(this.pinch.z * (d / Math.max(10, this.pinch.d)), this.fitZoom(), MAX_ZOOM);
      } else this.pinch = null;

      this.zoomTarget = clamp(this.zoomTarget, this.fitZoom(), MAX_ZOOM);
      this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 10);
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
        const inZoom = (!l.minZoom || z >= l.minZoom) && (!l.maxZoom || z < l.maxZoom);
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

      // --- pedestrians
      for (const w of this.walkers) {
        if (w.down > 0) {
          w.down -= dt;
          if (w.down <= 0) w.s.clearTint();
          continue;
        }
        const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
        w.t += (w.dir * w.speed * dt) / len;
        if (w.t >= 1) { w.t = 1; w.dir = -1; }
        if (w.t <= 0) { w.t = 0; w.dir = 1; }
        const x = w.a[0] + (w.b[0] - w.a[0]) * w.t, y = w.a[1] + (w.b[1] - w.a[1]) * w.t;
        w.s.setPosition(x, y);
        w.s.setAngle(deg(Math.atan2((w.b[1] - w.a[1]) * w.dir, (w.b[0] - w.a[0]) * w.dir)) - 90);
        w.flipT += dt * 5;
        w.s.setFlipX(Math.floor(w.flipT) % 2 === 1);
      }

      // --- traffic
      for (const c of this.cars) {
        c.t += (c.speed * dt) / c.len;
        if (c.t > 1) c.t -= 1;
        c.s.setPosition(c.from[0] + (c.to[0] - c.from[0]) * c.t, c.from[1] + (c.to[1] - c.from[1]) * c.t);
      }

      // --- police car loop
      this.policeD = (this.policeD + 34 * dt) % this.loopLen;
      const seg = this.loopSegs.find((s) => this.policeD >= s.start && this.policeD < s.start + s.len) || this.loopSegs[0];
      const f = (this.policeD - seg.start) / seg.len;
      const cx = seg.p[0] + (seg.q[0] - seg.p[0]) * f, cy = seg.p[1] + (seg.q[1] - seg.p[1]) * f;
      this.police.setPosition(cx, cy).setAngle(deg(Math.atan2(seg.q[1] - seg.p[1], seg.q[0] - seg.p[0])) + 90);
      const stars = hooks.heatStars();
      this.policeLight.clear();
      if (stars >= 2) {
        const on = Math.floor(time / 250) % 2 === 0;
        this.policeLight.fillStyle(on ? 0xe0352b : 0x2f6fe0, 0.18).fillCircle(cx, cy, 16);
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
