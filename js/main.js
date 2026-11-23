import { tDom, tt } from './i18n.js?v=20261124001158'; // first: picks the language and translates the shared content
import { SimServer } from './server.js?v=20261124001158';
import { RemoteServer } from './remote.js?v=20261124001158';
import { ONLINE } from './net.js?v=20261124001158';
import { CONFIG } from './config.js?v=20261124001158';
import { UI } from './ui.js?v=20261124001158';
import { createWorld } from './world.js?v=20261124001158';
import { sound } from './sound.js?v=20261124001158';

tDom(document.getElementById('hud'));

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
  onCrime: (kind) => server.crime(kind), // street crimes add wanted stars only, never heat
  onCopDown: () => ui.copDown(),
  reaper: () => (server.hasSave() ? server.reaper() : null),
  onRipperCaught: () => ui.reaperCaught(),
  onPill: (kind) => ui.pill(kind),
  runner: () => (server.hasSave() ? server.runner() : null),
  onRunnerHit: () => ui.runnerHit(),
  turf: () => (server.hasSave() ? server.turfView() : null),
  onPoi: (poi) => ui.setPoi(poi),
  onAction: () => ui.action(),
  hudBottom: () => ui.hudBottom(), // where the HUD column (heat, mission, tutorial or goal) ends, in px from the top
  onPolice: () => ui.police(),
  daily: () => (server.hasSave() ? server.dailyMap() : null),
  onDailyStep: (task, step) => ui.dailyStep(task, step),
  onDailyFail: (msg) => ui.toast(msg, true),
  cityId: () => (server.hasSave() ? server.city() : 'mesto1'),
  // the place the tutorial sends you to (a POI id of this city), or null
  tutorialTarget: () => {
    const t = server.hasSave() && server.tutorial ? server.tutorial() : null;
    // "Návod a ciele" switched off in Nastavenia: no ring or arrow, except a "Ukáž cestu" the player asked for
    if (!ui.tipsOn()) return ui.guide && Date.now() < ui.guide.until && server.city() === 'mesto1' ? ui.guide.poi : null;
    if (!t) {
      // "Ukáž cestu" in an unlock window wins for a few minutes or until you get there
      if (ui.guide && Date.now() < ui.guide.until && server.city() === 'mesto1') return ui.guide.poi;
      // after the tutorial: the place of the current first-hour goal (not once it is reached: the reward is in the HUD)
      const g = server.hasSave() && server.goal ? server.goal() : null;
      return g && !g.ready && g.at && server.city() === 'mesto1' ? g.at : null;
    }
    if (t.id === 'don' || (t.id === 'claim' && t.missionReady)) return 'don';
    if (t.id === 'buy') return 'zbrane';
    return null;
  },
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
  server.init().then(() => { ui.open('title'); ui.authBack(server.authBack); }, () => ui.info(tt('Bez spojenia'), tt('Server sa nepodarilo načítať. Skús obnoviť stránku.')));
}
ui.open('title');
setInterval(() => ui.tick(), 250);

// beta: script errors, rejected promises and server failures are collected and sent to the server now and then
window.addEventListener('error', (e) => ui.logError((e.message || 'error') + ' @ ' + String(e.filename || '').split('/').pop().split('?')[0] + ':' + (e.lineno || 0)));
window.addEventListener('unhandledrejection', (e) => ui.logError('promise: ' + String((e.reason && (e.reason.message || e.reason)) || 'rejected')));
server.onError = (msg) => ui.logError(msg);

// handy in the browser console while testing
window.hl = { server, ui, game, sound };
