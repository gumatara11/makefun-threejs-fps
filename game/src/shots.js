// EMBERLINE — shots.js. Mode ?shot=start|play|buy|bomb|win&seed=1:
// pose kamera + state deterministik (seeded) agar screenshot bisa diulang.
// Dipanggil sekali saat boot; sim dibekukan sesudahnya (main.js).
import { CONFIG } from './config.js';
import { createLoadout } from './weapons.js';

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function applyShot(state, mode, seed = 1) {
  const R = rng(seed), p = state.agents[0];
  const give = (a, key) => { a.weapons.primary = createLoadout(key); a.current = 'primary'; };
  const place = (a, x, z, yaw) => { a.x = x; a.z = z; a.yaw = yaw; a.vx = 0; a.vz = 0; };
  state.match.scoreAtk = 3; state.match.scoreDef = 2;
  if (mode === 'start') {
    state.round.phase = 'buy'; state.round.timer = 11;
    place(p, 4, 21, 0);
  } else if (mode === 'play') {
    state.round.phase = 'live'; state.round.timer = 62;
    give(p, 'VK47'); p.weapons.primary.mag = 27;
    place(p, 16, 25, 0); // Mid, menghadap +X ke musuh
    state.door.open = 1; state.door.target = 1;
    place(state.agents[8], 34, 25, Math.PI); // D4 rotator terlihat di Mid
    place(state.agents[1], 12, 27, 0.3); // A1 sekutu di kiri
    place(state.agents[6], 47, 40, Math.PI); // D2 jauh di A-long
    state.agents[8].hp = 100;
  } else if (mode === 'buy') {
    state.round.phase = 'buy'; state.round.timer = 10.5;
    p.money = 2700; place(p, 5, 23, 0.5);
  } else if (mode === 'bomb') {
    state.round.phase = 'bomb'; state.round.timer = 0;
    give(p, 'VK47');
    state.bomb.status = 'planted'; state.bomb.site = 'A';
    state.bomb.x = 60; state.bomb.z = 40; state.bomb.timer = 22.5;
    state.round.plantedSite = 'A';
    place(p, 57, 37, Math.atan2(40 - 37, 60 - 57)); // dari barat Site A, bom terlihat
    place(state.agents[5], 66, 41, Math.PI); // D1 di site
    place(state.agents[2], 59, 43, 0); // A2 sekutu
    state.door.open = 0;
  } else if (mode === 'win') {
    state.round.phase = 'end'; state.round.winner = 'atk'; state.round.reason = 'elimination';
    state.round.endTimer = 3.5;
    state.match.scoreAtk = 5; state.match.scoreDef = 3;
    give(p, 'VK47'); p.kills = 4; p.deaths = 1; p.plants = 1;
    place(p, 40, 40, 0);
    for (const a of state.agents) if (a.team === 'def') { a.alive = false; a.hp = 0; }
    state.events.push({ t: state.now, type: 'round-end', winner: 'atk', reason: 'elimination', score: [5, 3] });
  }
  void R; void CONFIG;
  return mode;
}
