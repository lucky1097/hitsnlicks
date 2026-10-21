import { SimServer } from './server.js?v=20261021203711';
import { RemoteServer } from './remote.js?v=20261021203711';
import { ONLINE } from './net.js?v=20261021203711';
import { CONFIG } from './config.js?v=20261021203711';
import { UI } from './ui.js?v=20261021203711';
import { createWorld } from './world.js?v=20261021203711';

// warm the browser cache so screens open without blank images
['maska', 'don', 'diler', 'kladivo', 'fightbg', 'it_pistol', 'it_bat', 'it_jacket', 'it_pants', 'it_sneaker', 'it_chain', 'it_ring', 'it_watch', 'it_duffel', 'it_package', 'it_keys']
  .forEach((n) => { new Image().src = 'assets/art/' + n + '.png'; });
['photo_don', 'photo_don_wide', 'photo_diler', 'photo_diler_wide', 'photo_rival', 'photo_dlznik', 'photo_kazatel', 'photo_kazatel_wide', 'photo_kozuch', 'photo_kozuch_wide', 'photo_wexler', 'photo_svalovec', 'photo_ziletka', 'photo_charlie', 'photo_charlie_wide']
  .forEach((n) => { new Image().src = 'assets/art/' + n + '.jpg'; });

// online: the real server decides everything; offline: the prototype runs in this browser
const server = ONLINE ? new RemoteServer() : new SimServer();
const ui = new UI(server);

const game = createWorld(document.getElementById('game'), {
  input: ui.input,
  labelLayer: document.getElementById('labels'),
  readyGiver: () => {
    const m = server.hasSave() && server.state.mission;
    return m && Date.now() >= m.endsAt ? m.giver : null;
  },
  paused: () => ui.paused() || !server.hasSave(),
  // the map's police: lights from 40 %, an officer on foot only near the top of the bar
  heatStars: () => {
    if (!server.hasSave()) return 0;
    const h = server.heatNow();
    return h >= CONFIG.raidFrom ? 3 : h >= 40 ? 2 : h > 0 ? 1 : 0;
  },
  weapon: () => (server.hasSave() ? server.streetWeapon() : null),
  onCrime: (kind) => server.crime({ shot: CONFIG.heatShot, hitGun: CONFIG.heatHitGun, hitMelee: CONFIG.heatHitMelee }[kind] || 0),
  reaper: () => (server.hasSave() ? server.reaper() : null),
  onRipperCaught: () => ui.reaperCaught(),
  onPill: (kind) => ui.pill(kind),
  runner: () => (server.hasSave() ? server.runner() : null),
  onRunnerHit: () => ui.runnerHit(),
  turf: () => (server.hasSave() ? server.turfView() : null),
  onPoi: (poi) => ui.setPoi(poi),
  onAction: () => ui.action(),
  onPolice: () => ui.police(),
});

ui.zoom = (dir) => {
  const city = game.scene.getScene('city');
  if (city && city.zoomStep) city.zoomStep(dir);
};

if (ONLINE) {
  server.onChange = () => ui.tick();
  server.init().then(() => ui.open('title'), () => ui.info('Bez spojenia', 'Server sa nepodarilo načítať. Skús obnoviť stránku.'));
}
ui.open('title');
setInterval(() => ui.tick(), 250);

// handy in the browser console while testing
window.hl = { server, ui, game };
