// EMBERLINE sim — rounds.js. Fase ronde, menang, ekonomi, plant/defuse.
// simStep = orkestrator per tick (main.js, fixed-step).
import { CONFIG, WEAPONS, GRENADES } from './config.js';
import { inZone } from './world.js';
import { updatePlayer } from './player.js';
import { updateBots, buyBots, bombPlaybook } from './bots.js';
import { updateWeapons, startReload, switchWeapon, throwGrenade, dropWeapon, pickupWeapon, fire } from './weapons.js';
import { updateGrenades } from './grenades.js';
import { resetRound, pushEvent, currentWeapon, aliveAgents } from './state.js';

function payRoundEnd(s, winnerTeam) {
  for (const a of s.agents) {
    const won = a.team === winnerTeam;
    a.pending += won ? CONFIG.rewardWin : CONFIG.rewardLose;
    a.money = Math.min(CONFIG.moneyCap, a.money + a.pending);
    a.pending = 0;
  }
}
export function endRound(s, winnerTeam, reason) {
  if (s.round.phase === 'end') return;
  const planted = s.bomb && s.bomb.status === 'planted';
  if (planted && winnerTeam === 'atk') { /* plant reward sudah dibukukan saat plant */ }
  payRoundEnd(s, winnerTeam);
  if (winnerTeam === 'atk') s.match.scoreAtk++; else s.match.scoreDef++;
  s.match.d2LoseStreak = winnerTeam === 'def' ? s.match.d2LoseStreak + 1 : 0;
  s.round.phase = 'end'; s.round.winner = winnerTeam; s.round.reason = reason;
  s.round.endTimer = CONFIG.timeBanner;
  pushEvent(s, { type: 'round-end', winner: winnerTeam, reason,
    score: [s.match.scoreAtk, s.match.scoreDef] });
  if (s.match.scoreAtk >= CONFIG.firstTo || s.match.scoreDef >= CONFIG.firstTo
    || s.match.round >= CONFIG.maxRounds) {
    s.match.over = true;
    s.match.winner = s.match.scoreAtk > s.match.scoreDef ? 'atk' : 'def';
  }
}
function nextRound(s) {
  if (s.match.over) return;
  s.match.round++;
  resetRound(s);
}
// --- buy menu: fase buy + di spawn sendiri; tanpa refund ---
export function buyItem(s, a, key) {
  if (s.round.phase !== 'buy') return { ok: false, why: 'not-buy-phase' };
  const zone = a.team === 'atk' ? 'spawnAtk' : 'spawnDef';
  if (!inZone(a, zone)) return { ok: false, why: 'not-in-spawn' };
  if (key === 'Kevlar') {
    if (a.kevlar || a.money < CONFIG.kevlarPrice) return { ok: false, why: 'cant' };
    a.kevlar = true; a.money -= CONFIG.kevlarPrice; return { ok: true };
  }
  if (GRENADES[key]) {
    const g = GRENADES[key];
    if (a.grenades[key] >= CONFIG.maxGrenadesPerType || a.money < g.price) return { ok: false, why: 'cant' };
    if (Object.values(a.grenades).reduce((x, y) => x + y, 0) >= CONFIG.maxGrenadesTotal) return { ok: false, why: 'max-grenades' };
    a.grenades[key]++; a.money -= g.price; return { ok: true };
  }
  const w = WEAPONS[key];
  if (!w || w.slot !== 'primary') return { ok: false, why: 'not-primary' };
  if (a.weapons.primary) return { ok: false, why: 'has-primary' }; // jatuhkan dulu dengan G
  if (a.weapons.primary && a.weapons.primary.key === key) return { ok: false, why: 'same' };
  if (a.money < w.price) return { ok: false, why: 'cant' };
  a.weapons.primary = { key, mag: w.mag, reserve: w.reserve };
  a.current = 'primary'; a.money -= w.price;
  a.switchUntil = s.now + w.draw;
  return { ok: true };
}
// --- plant/defuse: tahan E; batal bila gerak/ganti/lepas E ---
function plantDefuseTick(s, input) {
  const p = s.agents[0];
  const eDown = input.down('KeyE');
  const eEdge = eDown && !p.ePrev; // tekan E baru: plant/defuse hanya mulai dari
  p.ePrev = eDown; // tekanan baru; setelah batal (gerak/ganti/lepas E) harus tekan ulang
  // pemain: E ditahan + carrier + di zona plant + live
  if (s.round.phase === 'live' && p.alive && s.bomb && s.bomb.carrierId === 0) {
    const site = inZone(p, 'plantA') ? 'A' : inZone(p, 'plantB') ? 'B' : null;
    const moving = input.down('KeyW') || input.down('KeyA') || input.down('KeyS') || input.down('KeyD');
    if (site && eDown && !moving && (p.planting || eEdge)) {
      p.planting = true; p.plantProg += s.dt;
      p.vx = 0; p.vz = 0;
      if (p.plantProg >= CONFIG.timePlant) {
        p.planting = false; p.plantProg = 0; p.plants++;
        s.bomb.status = 'planted'; s.bomb.site = site; s.bomb.timer = CONFIG.timeBomb;
        s.bomb.planterId = 0; s.round.phase = 'bomb'; s.round.plantedSite = site;
        for (const a of s.agents) if (a.team === 'atk') a.pending += CONFIG.rewardPlant;
        pushEvent(s, { type: 'plant', site, by: 0 });
        pushEvent(s, { type: 'noise', kind: 'plant', x: p.x, y: 0, z: p.z, radius: CONFIG.hearing.plant, team: 'atk' });
      }
    } else { p.planting = false; p.plantProg = 0; }
  }
  // bot carrier plant
  for (const a of s.agents) {
    if (a.isPlayer || !a.alive || !a.planting) continue;
    if (s.round.phase !== 'live' || !s.bomb || s.bomb.carrierId !== a.id) { a.planting = false; a.plantProg = 0; continue; }
    const site = inZone(a, 'plantA') ? 'A' : inZone(a, 'plantB') ? 'B' : null;
    if (!site) { a.planting = false; a.plantProg = 0; continue; }
    a.vx = 0; a.vz = 0; a.plantProg += s.dt;
    if (a.plantProg >= CONFIG.timePlant) {
      a.planting = false; a.plantProg = 0; a.plants++;
      s.bomb.status = 'planted'; s.bomb.site = site; s.bomb.timer = CONFIG.timeBomb;
      s.bomb.planterId = a.id; s.round.phase = 'bomb'; s.round.plantedSite = site;
      for (const ag of s.agents) if (ag.team === 'atk') ag.pending += CONFIG.rewardPlant;
      pushEvent(s, { type: 'plant', site, by: a.id });
      pushEvent(s, { type: 'noise', kind: 'plant', x: a.x, y: 0, z: a.z, radius: CONFIG.hearing.plant, team: 'atk' });
    }
  }
  // defuse: fase bomb, di zona plant site yg ditanam
  if (s.round.phase === 'bomb' && s.bomb && s.bomb.status === 'planted') {
    const siteZone = s.bomb.site === 'A' ? 'plantA' : 'plantB';
    for (const a of s.agents) {
      if (!a.alive || a.team !== 'def') continue;
      const isPlayer = a.isPlayer;
      const want = isPlayer ? (eDown && (a.defusing || eEdge)) : a.defusing;
      const moving = isPlayer && (input.down('KeyW') || input.down('KeyA') || input.down('KeyS') || input.down('KeyD'));
      if (want && !moving && inZone(a, siteZone)) {
        a.defusing = true; a.defuseProg += s.dt; a.vx = 0; a.vz = 0;
        if (a.defuseProg >= CONFIG.timeDefuse) {
          a.defusing = false; a.defuseProg = 0; a.defuses++;
          s.bomb.status = 'defused'; s.bomb.defuserId = a.id;
          a.pending += CONFIG.rewardDefuse;
          pushEvent(s, { type: 'defuse', site: s.bomb.site, by: a.id });
          endRound(s, 'def', 'defuse');
          return;
        }
      } else { a.defusing = false; a.defuseProg = 0; }
    }
  }
}
// Urutan menang beku: ledakan -> defuse -> eliminasi -> timeout.
function winCheck(s) {
  if (s.round.phase === 'end') return;
  const b = s.bomb;
  if (s.round.phase === 'bomb' && b && b.status === 'planted' && b.timer <= 0) { // AMB-23: ledakan menang
    b.status = 'exploded';
    pushEvent(s, { type: 'explosion', x: b.x, y: b.y, z: b.z, kind: 'bomb' });
    endRound(s, 'atk', 'explosion'); return;
  }
  const atkAlive = aliveAgents(s, 'atk').length, defAlive = aliveAgents(s, 'def').length;
  const planted = b && b.status === 'planted';
  if (defAlive === 0) { endRound(s, 'atk', 'elimination'); return; }
  if (atkAlive === 0 && !planted) { endRound(s, 'def', 'elimination'); return; }
  if (s.round.phase === 'live' && s.round.timer <= 0) { endRound(s, 'def', 'timeout'); }
}
function updateDoor(s, dt) {
  const d = s.door;
  const near = s.agents.some(a => a.alive && Math.hypot(a.x - 30, a.z - 25) <= CONFIG.door.prox);
  if (near) { d.target = 1; d.emptySince = 0; }
  else {
    if (d.emptySince === 0) d.emptySince = s.now;
    if (s.now - d.emptySince > CONFIG.door.closeDelay) d.target = 0;
  }
  d.open += Math.sign(d.target - d.open) * dt * 0.5;
  d.open = Math.max(0, Math.min(1, d.open));
}
function playerActions(s, input) {
  const p = s.agents[0];
  if (!p.alive || s.round.phase === 'end') return;
  if (input.pressed('KeyR')) startReload(p, s.now);
  if (input.pressed('Digit1') && p.weapons.primary) switchWeapon(p, 'primary', s.now);
  if (input.pressed('Digit2')) switchWeapon(p, 'secondary', s.now);
  if (input.pressed('Digit3')) throwGrenade(p, s, 'Frag');
  if (input.pressed('Digit4')) throwGrenade(p, s, 'Smoke');
  if (input.pressed('Digit5')) throwGrenade(p, s, 'Flash');
  if (input.pressed('KeyG')) dropWeapon(p, s);
  if (input.pressed('KeyF')) pickupWeapon(p, s);
  if (input.mouseDown) {
    const w = currentWeapon(p);
    if (w && WEAPONS[w.key].auto) fire(p, s);
    else if (w && !s._prevMouse) fire(p, s); // semi-otomatis: hanya rising edge
  }
  s._prevMouse = input.mouseDown;
}
function bombPickupTick(s) {
  const b = s.bomb;
  if (!b) return;
  // pemain ambil alih dari A4 di spawn saat fase beli
  if (s.round.phase === 'buy' && b.status === 'carried' && b.carrierId !== 0) {
    const c = s.agents[b.carrierId], p = s.agents[0];
    if (c && Math.hypot(p.x - c.x, p.z - c.z) < 1.2) { b.carrierId = 0; pushEvent(s, { type: 'bomb-take', by: 0 }); }
  }
  if (b.status === 'dropped') {
    for (const a of aliveAgents(s, 'atk')) {
      if (Math.hypot(a.x - b.x, a.z - b.z) < 1.2) {
        b.status = 'carried'; b.carrierId = a.id;
        pushEvent(s, { type: 'bomb-take', by: a.id });
        break;
      }
    }
  }
  if (b.status === 'carried' && b.carrierId !== null) {
    const c = s.agents[b.carrierId];
    if (c) { b.x = c.x; b.z = c.z; }
  }
}
export function simStep(s, dt, input) {
  s.dt = dt; s.now += dt; s.tick++;
  if (s.paused) return;
  if (s.match.over && s.round.phase === 'end' && s.round.endTimer <= 0) return;
  updateDoor(s, dt);
  const ph = s.round.phase;
  if (ph === 'buy') {
    if (!s.round.buyDone) { buyBots(s); bombPlaybook(s); s.round.buyDone = true; }
    s.round.timer -= dt;
    bombPickupTick(s);
    if (s.round.timer <= 0) { s.round.phase = 'live'; s.round.timer = CONFIG.timeRound; }
  } else if (ph === 'live' || ph === 'bomb') {
    if (ph === 'live') s.round.timer -= dt;
    else {
      s.bomb.timer -= dt;
      if (s.bomb.timer <= 10 && Math.floor(s.bomb.timer * 2) !== Math.floor((s.bomb.timer + dt) * 2))
        pushEvent(s, { type: 'beep', t: s.bomb.timer });
    }
    updatePlayer(s, input, dt);
    updateBots(s, dt);
    playerActions(s, input);
    updateWeapons(s);
    updateGrenades(s, dt);
    plantDefuseTick(s, input);
    bombPickupTick(s);
    if (s.tick % 60 === 0) bombPlaybook(s); // playbook bom tiap 1 dtk
    winCheck(s);
  } else if (ph === 'end') {
    s.round.endTimer -= dt;
    updateGrenades(s, dt);
    if (s.round.endTimer <= 0) nextRound(s);
  }
  // buang noise lama (bot hanya butuh 0,15 dtk terakhir)
  if (s.events.length > 200) s.events = s.events.filter(e => e.type !== 'noise' || s.now - e.t < 1);
}
export function playAgain(s) { // AMB-26: reset peran/penghitung/skala akurasi/uang/skor
  s.match.scoreAtk = 0; s.match.scoreDef = 0; s.match.round = 1; s.match.over = false;
  s.match.winner = null; s.match.d2LoseStreak = 0;
  for (const a of s.agents) { a.money = CONFIG.moneyStart; a.pending = 0; a.kills = 0; a.deaths = 0; a.plants = 0; a.defuses = 0; if (a.bot) a.bot.round = 1; }
  resetRound(s, true);
}
// Debug API (dipakai Builder B window.__EMBERLINE__).
export function forcePlant(s) {
  const c = s.agents[s.bomb.carrierId];
  if (!c || s.round.phase !== 'live') return false;
  const site = 'plantA'; c.x = 62; c.z = 38; c.planting = true; c.plantProg = CONFIG.timePlant;
  return true;
}
export function forceDefuse(s) {
  if (s.round.phase !== 'bomb') return false;
  const d = aliveAgents(s, 'def')[0]; if (!d) return false;
  d.x = s.bomb.x; d.z = s.bomb.z; d.defusing = true; d.defuseProg = CONFIG.timeDefuse;
  return true;
}
export function killAll(s, team) { for (const a of s.agents) if ((!team || a.team === team) && a.alive) { a.hp = 0; a.alive = false; a.deaths++; } }
export function setMoney(s, id, amt) { s.agents[id].money = amt; }
export function setRound(s, n) { s.match.round = n; }
