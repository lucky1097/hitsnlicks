// Medals: 8 kinds, each bronze / silver / gold (24 in all). Shared code: the server counts the progress from the
// save and pays the gold bars once per medal; the client draws the medals (SVG) and the gold frame of the profile
// portrait, which fills from the corners as the medals add up.

export const MEDALS = [
  { id: 'misie', name: 'Misie', unit: 'splnených misií', tiers: [25, 250, 1000] },
  { id: 'bossovia', name: 'Bossovia', unit: 'porazených bossov', tiers: [10, 25, 50] },
  { id: 'arena', name: 'Aréna', unit: 'výhier v Aréne', tiers: [10, 100, 500] },
  { id: 'zapasy', name: 'Podzemné zápasy', unit: 'poschodie Podzemných zápasov', tiers: [10, 50, 100] },
  { id: 'gang', name: 'Gang Wars', unit: 'obsadených objektov', tiers: [1, 10, 50] },
  { id: 'ulica', name: 'Ulica', unit: 'zložených policajtov', tiers: [5, 50, 250] },
  { id: 'denne', name: 'Denné misie', unit: 'dní so splnenými dennými misiami', tiers: [3, 15, 45] },
  { id: 'uroven', name: 'Úroveň', unit: 'úroveň', tiers: [10, 50, 100] },
];

// tier 1..3; bars = what the medal pays when it is reached
export const MEDAL_TIERS = [
  { id: 'bronz', name: 'Bronz', bars: 5 },
  { id: 'striebro', name: 'Striebro', bars: 15 },
  { id: 'zlato', name: 'Zlato', bars: 40 },
];
export const MEDAL_COUNT = MEDALS.length * MEDAL_TIERS.length;

// how far a save is in every kind (old saves count what they already have)
export function medalProgress(state) {
  const c = state.counters || {};
  return {
    misie: c.missions || 0,
    bossovia: ((state.boss && state.boss.defeated) || 0) + ((state.boss2 && state.boss2.defeated) || 0),
    arena: (state.pvp && state.pvp.wins) || 0,
    zapasy: (state.club && state.club.floor) || 0,
    gang: c.turf || 0,
    ulica: c.cops || 0,
    denne: state.dailyDay || 0,
    uroven: (state.player && state.player.level) || 1,
  };
}

// reached tier (0..3) of every kind
export function medalTiers(state) {
  const p = medalProgress(state);
  const out = {};
  for (const m of MEDALS) out[m.id] = m.tiers.filter((t) => p[m.id] >= t).length;
  return out;
}

export const medalTotal = (tiers) => Object.values(tiers || {}).reduce((s, n) => s + n, 0);

// ---------------------------------------------------------------- drawing
// icons on a 24×24 grid, drawn with currentColor
const ICONS = {
  misie: '<rect x="3" y="8" width="18" height="12" rx="1.6"/><path d="M9 8V6.3C9 5.6 9.5 5 10.3 5h3.4c.8 0 1.3.6 1.3 1.3V8" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="3" y="12.6" width="18" height="1.3" fill="#000" opacity=".35"/>',
  bossovia: '<path d="M3.5 17.5 4.6 8.2 9 12.3 12 5.5 15 12.3 19.4 8.2 20.5 17.5Z"/><rect x="3.5" y="18.4" width="17" height="2.2" rx=".5"/>',
  arena: '<path d="M4 4 14.2 12.6 12.6 14.2Z"/><path d="M20 4 9.8 12.6 11.4 14.2Z"/><path d="M13.4 13.4 18.6 18.6M10.6 13.4 5.4 18.6" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/>',
  zapasy: '<path d="M7.5 11c0-4 2.5-6.5 6-6.5s5.8 2.4 5.8 6.2V14c0 3-2 5-4.8 5h-3.4c-2 0-3.6-1.6-3.6-3.6Z"/><rect x="8.4" y="19.6" width="8.6" height="2.6" rx=".6"/><path d="M7.6 12.4c-2.1 0-3.2 1.1-3.2 2.7s1.2 2.7 3.2 2.5" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  gang: '<rect x="7.5" y="9" width="8" height="12.5" rx="1.6"/><rect x="9" y="6" width="5" height="3" rx=".6"/><rect x="10.5" y="4" width="2" height="2"/><circle cx="17" cy="4.2" r=".9"/><circle cx="19.2" cy="5.8" r=".9"/><circle cx="18.6" cy="2.6" r=".7"/><circle cx="20.6" cy="3.6" r=".6"/>',
  ulica: '<circle cx="7" cy="15.2" r="3.8" fill="none" stroke="currentColor" stroke-width="2.3"/><circle cx="17" cy="15.2" r="3.8" fill="none" stroke="currentColor" stroke-width="2.3"/><circle cx="8.6" cy="10.4" r="1.7"/><circle cx="15.4" cy="10.4" r="1.7"/><path d="M10 10.4h4" stroke="currentColor" stroke-width="1.8" stroke-dasharray="1.3 .7" fill="none"/>',
  denne: '<path d="M3 11C3 6.2 6.5 4.6 12 4.6S21 6.2 21 11Z"/><rect x="3" y="11.8" width="18" height="8.4"/><rect x="10.3" y="10.6" width="3.4" height="4.6" fill="#000" opacity=".4"/>',
  uroven: '<path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.8l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7Z"/>',
};

// [light, mid, dark] of the disc, the engraving, the ribbon stripe
const METAL = {
  0: { disc: ['#262421', '#191816', '#0f0f0e'], rim: '#3a3631', ink: '#34312c', stripe: '#2a2826' },
  1: { disc: ['#f0b47a', '#ad6a33', '#5c3013'], rim: '#4a250c', ink: '#3a1c08', stripe: '#ad6a33' },
  2: { disc: ['#fbfcfd', '#b3b9bf', '#5d6369'], rim: '#3c4146', ink: '#2a2e32', stripe: '#c9ced3' },
  3: { disc: ['#fff3bf', '#e2b648', '#7a5410'], rim: '#4e3606', ink: '#433005', stripe: '#e0b444' },
};

// one medal: kind id, reached tier 0..3 (0 = not yet, a dark silhouette)
export function medalSvg(id, tier, size = 44) {
  const m = METAL[tier] || METAL[0];
  const gid = 'hlm' + tier;
  const icon = ICONS[id] || ICONS.uroven;
  const glow = tier === 3 ? '<circle cx="24" cy="38" r="20" fill="none" stroke="#f3d98a" stroke-opacity=".35" stroke-width="2"/>' : '';
  return '<svg class="medal t' + tier + '" width="' + size + '" height="' + Math.round(size * 1.25) + '" viewBox="0 0 48 60" aria-hidden="true">' +
    '<defs><radialGradient id="' + gid + '" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="' + m.disc[0] + '"/><stop offset=".55" stop-color="' + m.disc[1] + '"/><stop offset="1" stop-color="' + m.disc[2] + '"/></radialGradient></defs>' +
    // the ribbon: black with a stripe in the medal's metal
    '<path d="M13 0h9l4 21h-9Z" fill="#141210" stroke="#000" stroke-width=".8"/><path d="M35 0h-9l-4 21h9Z" fill="#141210" stroke="#000" stroke-width=".8"/>' +
    '<path d="M16.6 0h1.8l4 21h-1.8Z" fill="' + m.stripe + '"/><path d="M31.4 0h-1.8l-4 21h1.8Z" fill="' + m.stripe + '"/>' +
    glow +
    '<circle cx="24" cy="38" r="17" fill="url(#' + gid + ')" stroke="' + m.rim + '" stroke-width="1.6"/>' +
    '<circle cx="24" cy="38" r="13.6" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1"/>' +
    // the engraving: a light edge under a dark icon
    (tier ? '<g transform="translate(12.6 27.4) scale(.95)" fill="#fff" color="#fff" opacity=".35">' + icon + '</g>' : '') +
    '<g transform="translate(12.6 26.6) scale(.95)" fill="' + m.ink + '" color="' + m.ink + '">' + icon + '</g>' +
    '</svg>';
}

// the portrait frame: gold runs from the four corners along the edges (len = % of each side from every corner);
// stage 3+ adds corner jewels, 4+ a second inner line, 5 (all 24) a slow glow
export function frameStage(n) { return n >= MEDAL_COUNT ? 5 : n >= 20 ? 4 : n >= 16 ? 3 : n >= 8 ? 2 : n >= 1 ? 1 : 0; }
export function frameHtml(n) {
  const len = n <= 0 ? 0 : Math.min(50, 6 + n * 2.2);
  const bars = ['h tl', 'h tr', 'h bl', 'h br', 'v tl', 'v tr', 'v bl', 'v br'].map((c) => '<i class="' + c + '"></i>').join('');
  const gems = ['tl', 'tr', 'bl', 'br'].map((c) => '<b class="' + c + '"></b>').join('');
  return '<span class="mframe st' + frameStage(n) + '" style="--len:' + len.toFixed(1) + '%" aria-hidden="true">' + bars + gems + '</span>';
}
