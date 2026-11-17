// EMBERLINE sim — config.js
// Satu sumber angka beku (spec §2-§4 + AMB §10).
// Satuan: meter, detik, radian, dolar. Falloff: penuh s.d. falloffStart, linear ke falloffMin di falloffEnd.
export const CONFIG = {
  tickHz: 60, dt: 1 / 60,
  hpMax: 100, teamSize: 5, firstTo: 8, maxRounds: 15,
  moneyStart: 800, moneyCap: 9000,
  rewardKill: 300, rewardWin: 3250, rewardLose: 1900,
  rewardPlant: 300, rewardDefuse: 300,
  timeBuy: 12, timeRound: 100, timePlant: 3.2, timeBomb: 35,
  timeDefuse: 5.0, timeBanner: 4,
  kevlarPrice: 650, kevlarBulletMul: 0.65, kevlarFragMul: 0.75,
  zoneHeadMul: 2, zoneHeadMulLongbow: 4, zoneTorsoMul: 1, zoneLegMul: 0.75,
  moveCrouch: 2.4, gravity: 14, jumpVel: 5.2, accel: 42, friction: 30,
  agentRadius: 0.4, agentHeight: 1.8, agentHeightCrouch: 1.2,
  mouseSens: 1.0, // AMB-32
  fovBase: 74, fovScoped: 30,
  crouchSpreadMul: 0.7, airSpreadMul: 1.6,
  recoilSprayStep: 0.08, recoilSprayMax: 1.8, recoilRecoverDelay: 0.25,
  throwSpeed: 18, grenadeGravity: 9.81, grenadeRestitution: 0.4,
  maxGrenadesPerType: 1, maxGrenadesTotal: 3,
  map: { w: 72, h: 48, wallH: 5.0, tunnelCeil: 3.0, serviceCeil: 2.6 },
  door: { x: 30, zMin: 21, zMax: 29, gapZMin: 23, gapZMax: 27, prox: 3, closeDelay: 4 },
  perception: { fovDeg: 100, periphDeg: 130, periphDist: 6, viewDist: 55,
    losInterval: 0.12, visibleTime: 0.15, memory: 4.0,
    reaction: { rusher: 0.25, holder: 0.30, sniper: 0.35, def: 0.28 } },
  hearing: { longbow: 45, vk47: 45, breacher: 40, kestrel: 35, p9: 35,
    runStep: 12, crouchStep: 4, plant: 15, defuse: 10, reload: 6, grenadeBounce: 8,
    wallMul: 0.5 },
  bot: { burstMin: 3, burstMax: 5, burstPause: 0.4, separation: 0.6,
    bombPickupForceAfter: 10, bombPickupCheck: 1,
    accExtraDeg: [0, 2.2, 2.2, 2.2, 1.8, 1.8, 1.8, 1.8, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5] },
  perf: { maxDrawCalls: 180, maxTris: 350000 },
};

export const WEAPONS = {
  P9: { key: 'P9', name: 'P9', price: 0, dmg: 26, rpm: 400, mag: 12, reserve: 48,
    reload: 1.6, spreadStand: 0.004, spreadMove: 0.026, recoil: 0.006,
    falloffStart: 25, falloffEnd: 60, falloffMin: 0.6, speed: 5.2, draw: 0.45,
    auto: false, pellets: 1, slot: 'secondary' },
  Breacher: { key: 'Breacher', name: 'Breacher', price: 1050, dmg: 9, rpm: 68, mag: 6,
    reserve: 24, reload: 3.2, spreadStand: 0.045, spreadMove: 0.015, recoil: 0.030,
    falloffStart: 10, falloffEnd: 20, falloffMin: 0.25, speed: 5.0, draw: 0.60,
    auto: false, pellets: 8, slot: 'primary', pump: true },
  Kestrel: { key: 'Kestrel', name: 'Kestrel-9', price: 1500, dmg: 22, rpm: 857, mag: 32,
    reserve: 96, reload: 2.0, spreadStand: 0.006, spreadMove: 0.029, recoil: 0.004,
    falloffStart: 18, falloffEnd: 53, falloffMin: 0.55, speed: 5.2, draw: 0.55,
    auto: true, pellets: 1, slot: 'primary' },
  VK47: { key: 'VK47', name: 'VK-47', price: 2700, dmg: 34, rpm: 600, mag: 30, reserve: 90,
    reload: 2.4, spreadStand: 0.0022, spreadMove: 0.028, recoil: 0.011,
    falloffStart: 40, falloffEnd: 75, falloffMin: 0.7, speed: 4.9, draw: 0.65,
    auto: true, pellets: 1, slot: 'primary', spray: true },
  Longbow: { key: 'Longbow', name: 'Longbow', price: 4750, dmg: 110, rpm: 41, mag: 5,
    reserve: 20, reload: 3.4, spreadStand: 0.0005, spreadStandHip: 0.050, spreadMove: 0.055,
    recoil: 0.045, falloffStart: 80, falloffEnd: 80, falloffMin: 1.0, speed: 4.6,
    draw: 0.80, auto: false, pellets: 1, slot: 'primary', bolt: true, scoped: true },
};

export const GRENADES = {
  Frag: { key: 'Frag', price: 300, fuse: 1.5, radius: 6, dmgCenter: 85, dmgEdge: 10, slot: 3 },
  Smoke: { key: 'Smoke', price: 300, fuse: 0.8, radius: 3.5, duration: 12, slot: 4 },
  Flash: { key: 'Flash', price: 200, fuse: 1.2, radius: 15, blindFace: 2.2, blindBack: 0.8, slot: 5 },
};

// Urutan beli bot §4 (harga ambang, item).
export const BUY_TABLE = [
  { min: 3350, weapon: 'VK47', kevlar: true },
  { min: 2150, weapon: 'Kestrel', kevlar: true },
  { min: 1700, weapon: 'Breacher', kevlar: true },
  { min: 650, weapon: null, kevlar: true },
];
export const D2_LONGBOW_MIN = 5400; // Longbow 4750 + kevlar 650

export const BOT_ROLES = {
  A1: { role: 'A1', team: 'atk', kind: 'rusher', weapon: 'Kestrel', reaction: 0.25, lane: 'follow-player' },
  A2: { role: 'A2', team: 'atk', kind: 'rifleman', weapon: 'VK47', reaction: 0.28, lane: 'follow-player' },
  A3: { role: 'A3', team: 'atk', kind: 'lurker', weapon: 'VK47', reaction: 0.28, lane: 'other' },
  A4: { role: 'A4', team: 'atk', kind: 'carrier', weapon: 'VK47', reaction: 0.28, lane: 'mid' },
  D1: { role: 'D1', team: 'def', kind: 'holder', weapon: 'VK47', reaction: 0.30, site: 'A' },
  D2: { role: 'D2', team: 'def', kind: 'sniper', weapon: 'Longbow', reaction: 0.35, site: 'A' },
  D3: { role: 'D3', team: 'def', kind: 'holder', weapon: 'VK47', reaction: 0.30, site: 'B' },
  D4: { role: 'D4', team: 'def', kind: 'rotator', weapon: 'Kestrel', reaction: 0.28, site: 'Mid' },
  D5: { role: 'D5', team: 'def', kind: 'rotator', weapon: 'VK47', reaction: 0.28, site: 'Mid' },
};
export const ROLE_ORDER = ['A1', 'A2', 'A3', 'A4', 'D1', 'D2', 'D3', 'D4', 'D5'];
