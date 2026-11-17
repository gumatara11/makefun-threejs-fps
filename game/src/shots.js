import { CONFIG, WEAPONS } from './config.js';
import { createLoadout } from './weapons.js';
function rng(seed) {
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
    place(p, 18, 42, 0.1);
    state.door.open = 1; state.door.target = 1;
    place(state.agents[8], 28, 42, Math.PI);
    place(state.agents[1], 12, 44, 0.1);
    place(state.agents[6], 58, 40, Math.PI);
    state.agents[8].hp = 100;
  } else if (mode === 'robots') {
    state.round.phase = 'live'; state.round.timer = 62;
    give(p, 'VK47'); p.weapons.primary.mag = 27;
    place(p, 30, 40, 0);
    const row = [[5, 37.5], [1, 39], [2, 40.5], [3, 42], [4, 43.5]];
    for (const [i, z] of row) { place(state.agents[i], 33.5, z, Math.PI); state.agents[i].hp = 100; }
    state.door.open = 1; state.door.target = 1;
  } else if (mode === 'p9' || mode === 'p9r' || mode === 'vkr') {
    state.round.phase = 'live'; state.round.timer = 62;
    const key = mode === 'vkr' ? 'VK47' : 'P9';
    give(p, key); p.weapons.primary.mag = mode === 'vkr' ? 27 : 9;
    if (mode !== 'p9') p.reloadUntil = state.now + WEAPONS[key].reload * 0.5;
    place(p, 24, 40, -Math.PI / 2);
    state.door.open = 1; state.door.target = 1;
    place(state.agents[8], 26, 28, Math.PI / 2);
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
    place(p, 57, 37, Math.atan2(40 - 37, 60 - 57));
    place(state.agents[5], 66, 41, Math.PI);
    place(state.agents[2], 59, 43, 0);
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
