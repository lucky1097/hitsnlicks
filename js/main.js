import { SimServer } from './server.js?v=20261023214817';
import { RemoteServer } from './remote.js?v=20261023214817';
import { ONLINE } from './net.js?v=20261023214817';
import { CONFIG } from './config.js?v=20261023214817';
import { UI } from './ui.js?v=20261023214817';
import { createWorld } from './world.js?v=20261023214817';

// warm the browser cache so screens open without blank images
['maska', 'diler', 'kladivo', 'fightbg', 'it_pistol', 'it_bat', 'it_watch', 'it_duffel', 'it_package', 'it_keys']
  .forEach((n) => { new Image().src = 'assets/art/' + n + '.png'; });
['photo_don', 'photo_don_wide', 'photo_diler', 'photo_diler_wide', 'photo_dlznik', 'photo_wexler', 'photo_svalovec']
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
  // the map's police: wanted stars (lights from 1, officers on foot from CONFIG.wantedChase);
  // in the hideout or in the shadows after it nobody comes on foot
  police: () => {
    const base = { arrestSec: CONFIG.arrestSec, loseSec: CONFIG.wantedLoseSec, sightPx: CONFIG.wantedSightPx, peaceSec: CONFIG.caughtPeaceSec };
    if (!server.hasSave()) return { ...base, stars: 0, chase: false, wanted: 0 };
    const stars = server.wantedStars();
    const hidden = server.hideState().since || server.shadowLeft() > 0;
    return { ...base, stars, chase: !hidden && stars >= CONFIG.wantedChase, wanted: server.copsWanted() };
  },
  onWantedLose: () => ui.wantedLose(),
  weapon: () => (server.hasSave() ? server.streetWeapon() : null),
  onCrime: (kind) => server.crime({ shot: CONFIG.heatShot, hitGun: CONFIG.heatHitGun, hitMelee: CONFIG.heatHitMelee, car: CONFIG.heatCarHit, blast: CONFIG.heatBlast, copHit: CONFIG.heatCopHit }[kind] || 0, kind),
  onCopDown: () => ui.copDown(),
  reaper: () => (server.hasSave() ? server.reaper() : null),
  onRipperCaught: () => ui.reaperCaught(),
  onPill: (kind) => ui.pill(kind),
  runner: () => (server.hasSave() ? server.runner() : null),
  onRunnerHit: () => ui.runnerHit(),
  turf: () => (server.hasSave() ? server.turfView() : null),
  onPoi: (poi) => ui.setPoi(poi),
  onAction: () => ui.action(),
  onPolice: () => ui.police(),
  daily: () => (server.hasSave() ? server.dailyMap() : null),
  onDailyStep: (task, step) => ui.dailyStep(task, step),
  onDailyFail: (msg) => ui.toast(msg, true),
});

// what the map knows about the daily task (nearest target, escape clock) for the HUD
ui.dailyWorld = () => {
  const city = game.scene.getScene('city');
  return city && city.dailyG ? { hint: city.dailyHint, esc: city.dailyEscT || 0, follow: city.dailyFollowT || 0, spray: city.dailySprayT || 0 } : null;
};

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
