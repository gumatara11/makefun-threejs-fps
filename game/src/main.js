// EMBERLINE — main.js. Bootstrap + loop fixed-step 60 Hz + debug API.
// Urutan import (spec §5): config, state, world, weapons, combat, bots,
// rounds, player, input, grenades, characters, render, audio, hud, shots.
import { CONFIG } from './config.js';
import { createState } from './state.js';
import './world.js';
import { buildViewmodel, updateViewmodel } from './weapons.js';
import './combat.js';
import './bots.js';
import { simStep, playAgain, forcePlant, forceDefuse, killAll, setMoney, setRound } from './rounds.js';
import './player.js';
import { InputState } from './input.js';
import './grenades.js';
import './characters.js';
import { createRender } from './render.js';
import { initAudio, resumeAudio, drainAudio, playReload, playDoor, setVolume, setMuted, isMuted } from './audio.js';
import { createHud } from './hud.js';
import { applyShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot'), BENCH = params.get('bench') === '1', DEBUG = params.get('debug') === '1';
const SEED = Number(params.get('seed') || 1);

const state = createState();
const input = new InputState();
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => errors.push('reject: ' + String(e.reason)));

const canvas = $('game');
const R = createRender(canvas);
let audioIdx = 0, started = false, benchDone = false, lastDoor = 0; // di atas blok DEBUG (TDZ: DEBUG memakai `started`)
if (DEBUG) R.setDebug(true);
// menu: 5 robot figure tampil di layar awal (bukan di shot/bench/debug); HUD disembunyikan
const setMenuUI = (on) => { R.setMenu(on); document.body.classList.toggle('menu', on); };
setMenuUI(!SHOT && !BENCH && !DEBUG);
if (DEBUG) { // ?debug=1: overlay start JANGAN menutupi waypoint graph
  $('start-overlay').style.display = 'none'; started = true; state.paused = false;
}
input.attach(canvas);
const hud = createHud(state);
const simSamples = []; // ms per simStep
const frameTimes = []; // ms per rAF (bench)
const simStats = { tickAvg: 0, tickP99: 0, calls: 0, tris: 0, fps: 0 };

function startGame() {
  initAudio(); resumeAudio();
  started = true; setMenuUI(false);
  state.paused = false; input.paused = false;
  $('start-overlay').style.display = 'none';
  $('settings-panel').style.display = 'none';
  $('pause-overlay').style.display = 'none';
  $('end-overlay').style.display = 'none';
  canvas.focus();
  canvas.requestPointerLock?.();
}
$('start-btn').addEventListener('click', startGame);
// SETTINGS (menu start): panel VOLUME saja — slider + mute, via audio.js.
$('settings-btn').addEventListener('click', () => { $('settings-panel').style.display = 'block'; });
$('settings-close').addEventListener('click', () => { $('settings-panel').style.display = 'none'; });
$('mute-btn').addEventListener('click', () => { const m = !isMuted(); setMuted(m); $('mute-btn').textContent = m ? '🔊 BUNYI' : '🔇 MUTE'; });
$('vol-slider').addEventListener('input', (e) => { setVolume(e.target.value / 100); $('vol-val').textContent = e.target.value + '%'; if (isMuted()) { setMuted(false); $('mute-btn').textContent = '🔇 MUTE'; } });
$('resume-btn').addEventListener('click', () => { canvas.requestPointerLock?.(); });
$('again-btn').addEventListener('click', () => { playAgain(state); $('end-overlay').style.display = 'none'; $('start-overlay').style.display = 'flex'; started = false; setMenuUI(true); });
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (locked) { input.paused = false; if (started) { state.paused = false; $('pause-overlay').style.display = 'none'; } }
  else if (started && !SHOT && !BENCH && !state.match.over) {
    state.paused = true; input.paused = true; $('pause-overlay').style.display = 'flex';
  }
});
window.addEventListener('focus', resumeAudio);
window.addEventListener('resize', () => {
  R.renderer.setSize(innerWidth, innerHeight);
  R.camera.aspect = innerWidth / innerHeight; R.camera.updateProjectionMatrix();
});
R.renderer.setSize(innerWidth, innerHeight);
R.camera.aspect = innerWidth / innerHeight; R.camera.updateProjectionMatrix();

// --- viewmodel: satu per senjata, tukar saat senjata aktif berubah ---
const vms = {};
let activeVm = null, activeKey = null, lastReload = false;
function syncViewmodel() {
  const p = state.agents[0];
  const w = p.weapons[p.current];
  const key = w ? w.key : 'P9';
  if (key !== activeKey) {
    if (activeVm) R.camera.remove(activeVm.group);
    activeVm = vms[key] ??= buildViewmodel(R.camera, key);
    R.camera.add(activeVm.group); activeKey = key;
  }
  const show = started && p.alive && !p.scoped && !hud.isBuyOpen() && !state.match.over;
  if (activeVm) activeVm.group.visible = show;
  if (activeVm && show) updateViewmodel(1 / 60, state, activeVm);
  const reloading = p.reloadUntil > state.now;
  if (reloading && !lastReload) playReload();
  lastReload = reloading;
}
// --- bench: skenario baku lalu ukur 150 frame ---
function runBench() {
  const p = state.agents[0];
  p.weapons.primary = { key: 'VK47', mag: 30, reserve: 90 }; p.current = 'primary';
  p.x = 40; p.z = 40; p.yaw = 0.35;
  state.round.phase = 'live'; state.round.timer = 100;
  const fake = { keys: new Set(['KeyW']), mouseDown: true, rightDown: false,
    down: (c) => fake.keys.has(c), pressed: () => false, consumeMouse: () => ({ dx: 0, dy: 0 }) };
  const t0 = performance.now();
  for (let i = 0; i < 1800; i++) { const a = performance.now(); simStep(state, 1 / 60, fake); simSamples.push(performance.now() - a); }
  forcePlant(state);
  for (let i = 0; i < 600; i++) { const a = performance.now(); simStep(state, 1 / 60, fake); simSamples.push(performance.now() - a); }
  state.smokes.push({ x: 30, y: 1, z: 25, r: 3.5, until: state.now + 12 });
  console.log('[bench] scripted sim done in', (performance.now() - t0).toFixed(0), 'ms');
}
// --- shot mode ---
if (SHOT) {
  applyShot(state, SHOT, SEED);
  state.paused = true; started = true;
  $('start-overlay').style.display = 'none';
  if (SHOT === 'buy') hud.setBuy(true);
  if (SHOT === 'win') hud.showBanner({ winner: 'atk', reason: 'elimination' }, true);
}
if (BENCH) { started = true; $('start-overlay').style.display = 'none'; runBench(); }

window.__EMBERLINE__ = { state, config: CONFIG, simStats, errors, scene: R.scene, renderer: R.renderer, pick: R.pick,
  forcePlant: () => forcePlant(state), forceDefuse: () => forceDefuse(state),
  killAll: (t) => killAll(state, t), setMoney: (id, a) => setMoney(state, id, a),
  setRound: (n) => setRound(state, n), start: startGame };
// --- loop ---
let acc = 0, last = performance.now(), frames = 0, fpsAt = last;
function loop(now) {
  requestAnimationFrame(loop);
  const dtMs = now - last; last = now;
  frames++;
  if (now - fpsAt > 1000) { simStats.fps = Math.round(frames * 1000 / (now - fpsAt)); frames = 0; fpsAt = now; }
  if (BENCH && !benchDone) frameTimes.push(dtMs);
  // kunci UI (sebelum simStep agar pressed() tidak dimakan playerActions)
  if (!SHOT && input.pressed('KeyB') && state.round.phase === 'buy') hud.setBuy(!hud.isBuyOpen());
  if (hud.isBuyOpen()) {
    for (const k of ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8'])
      if (input.pressed(k)) hud.tryBuy(hud.buyKeys[Number(k.slice(5)) - 1]);
  }
  if (!state.paused && !state.match.over) {
    acc += Math.min(dtMs, 100) / 1000;
    let n = 0;
    while (acc >= 1 / 60 && n < 5) {
      const a = performance.now();
      simStep(state, 1 / 60, input);
      simSamples.push(performance.now() - a);
      if (simSamples.length > 600) simSamples.shift();
      acc -= 1 / 60; n++;
    }
  } else acc = 0;
  // pintu Mid: bunyi slide saat mulai bergerak
  if (Math.abs(state.door.target - state.door.open) > 0.01 && now - lastDoor > 900) { playDoor(); lastDoor = now; }
  // statistik sim
  if (simSamples.length > 20) {
    const s = [...simSamples].sort((a, b) => a - b);
    simStats.tickAvg = +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(3);
    simStats.tickP99 = +s[Math.floor(s.length * 0.99)].toFixed(3);
  }
  audioIdx = drainAudio(state, audioIdx);
  R.render(state, SHOT ? 0 : 1 / 60, SHOT ? 1.0 : now / 1000); // ?shot=: waktu beku (deterministik)
  const rs = R.stats();
  simStats.calls = rs.calls; simStats.tris = rs.tris;
  syncViewmodel();
  hud.update(now / 1000);
  // akhir match
  if (state.match.over && $('end-overlay').style.display !== 'flex') {
    const p = state.agents[0];
    $('end-score').textContent = state.match.scoreAtk + ' — ' + state.match.scoreDef;
    $('end-stats').textContent = `Kill ${p.kills} • Mati ${p.deaths} • Plant ${p.plants} • Defuse ${p.defuses}`;
    $('end-overlay').style.display = 'flex';
    if (document.pointerLockElement) document.exitPointerLock();
  }
  if (BENCH && !benchDone && frameTimes.length >= 150) {
    benchDone = true;
    const f = [...frameTimes].sort((a, b) => a - b);
    const med = f[Math.floor(f.length / 2)], low = f[Math.floor(f.length * 0.99)];
    window.__bench = { fpsMedian: +(1000 / med).toFixed(1), fps1pct: +(1000 / low).toFixed(1),
      tickAvg: simStats.tickAvg, tickP99: simStats.tickP99,
      drawCalls: simStats.calls, tris: simStats.tris, frames: frameTimes.length };
    console.log('[bench]', JSON.stringify(window.__bench));
  }
  if (SHOT && !window.__shotReady) window.__shotReady = true;
}
requestAnimationFrame(loop);
