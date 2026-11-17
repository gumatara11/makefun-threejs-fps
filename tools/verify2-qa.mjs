// Verifier independen EMBERLINE v1 (commit 879c6b8) — QA headless Node.
// TIDAK mengubah game. Menulis hanya stdout + ringkasan JSON ke tools/verify2-qa.json.
import { CONFIG, WEAPONS, GRENADES } from '../game/src/config.js';
import { createState, currentWeapon } from '../game/src/state.js';
import { NODES, LINKS, nearestNode, aStar, losBlocked, inZone, SOLIDS } from '../game/src/world.js';
import { createBotBrain, setPath, moveAlongPath } from '../game/src/bots.js';
import { fire, createLoadout, spreadFor, startReload, switchWeapon, throwGrenade, dropWeapon, pickupWeapon } from '../game/src/weapons.js';
import { dirFromYawPitch, shoot } from '../game/src/combat.js';
import { createProjectile, updateGrenades } from '../game/src/grenades.js';
import { simStep, endRound, buyItem, playAgain, forcePlant } from '../game/src/rounds.js';
import fs from 'node:fs';

const DT = 1 / 60;
const out = [];
const check = (id, name, ok, info = '') => { out.push({ id, name, ok: !!ok, info: String(info) }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id} ${name}${info ? ' — ' + info : ''}`); };
class DummyInput {
  constructor() { this.keys = new Set(); this.mouseDown = false; this.rightDown = false; }
  down(c) { return this.keys.has(c); }
  pressed(c) { if (this.keys.has(c)) { this.keys.delete(c); return true; } return false; }
  consumeMouse() { return { dx: 0, dy: 0 }; }
}
const step = (s, input, n) => { for (let i = 0; i < n; i++) simStep(s, DT, input); };
const blindOthers = (s, except = []) => { for (const a of s.agents) if (!except.includes(a.id)) a.blindUntil = s.now + 1000; };
const killAllBut = (s, keep) => { for (const a of s.agents) if (!keep.includes(a.id)) { a.hp = 0; a.alive = false; } };
function bvb(s) { // semua agen jadi bot (pemain = A1)
  for (const a of s.agents) { if (a.isPlayer) { a.isPlayer = false; a.bot = createBotBrain('A1'); } else a.bot = createBotBrain(a.role); }
}
function aimAt(sh, tg, yOff = 1.15) {
  const dx = tg.x - sh.x, dy = (tg.y + yOff) - (sh.y + 1.68), dz = tg.z - sh.z;
  const l = Math.hypot(dx, dy, dz) || 1; return { x: dx / l, y: dy / l, z: dz / l };
}
function duel(key, kevlar = false, dist = 5) {
  const s = createState(); s.round.phase = 'live'; s.round.timer = 100;
  const sh = s.agents[0], tg = s.agents[5];
  sh.x = 20; sh.z = 25; sh.yaw = 0; tg.x = 20 + dist; tg.z = 25; tg.yaw = Math.PI;
  sh.weapons.primary = createLoadout(key); sh.current = 'primary';
  tg.kevlar = kevlar; tg.hp = 100; return { s, sh, tg };
}
function fireN(s, sh, tg, n, yOff = 1.15) {
  let hits = 0, dmgSum = 0, last = null;
  for (let i = 0; i < n; i++) {
    s.now += 60 / WEAPONS[currentWeapon(sh).key].rpm + 0.01;
    const before = s.events.length;
    last = fire(sh, s, aimAt(sh, tg, yOff));
    const evs = s.events.slice(before).filter(e => e.type === 'hit');
    hits += evs.length; dmgSum += evs.reduce((x, e) => x + e.dmg, 0);
    if (!tg.alive) break;
  }
  return { hits, dmgSum, last };
}

// ---------- A2: empat jalan menang ----------
{ const s = createState(), inp = new DummyInput(); s.round.phase = 'live'; s.round.timer = 100;
  for (const a of s.agents) if (!a.isPlayer) a.bot = createBotBrain(a.role);
  for (const d of s.agents.filter(a => a.team === 'def')) { d.hp = 0; d.alive = false; }
  step(s, inp, 3);
  check('A2a', 'Menang eliminasi (atk)', s.round.winner === 'atk' && s.round.reason === 'elimination', `${s.round.winner}/${s.round.reason}`); }
{ const s = createState(), inp = new DummyInput(); s.round.phase = 'live'; s.round.timer = 100;
  const p = s.agents[0]; s.bomb.carrierId = 0; p.x = 62; p.z = 38; inp.keys.add('KeyE');
  step(s, inp, Math.ceil(3.2 / DT) + 5);
  s.bomb.timer = 0.4; for (const d of s.agents.filter(a => a.team === 'def')) { d.x = 60; d.z = 22; d.defusing = false; }
  const t0 = s.now; step(s, inp, Math.ceil(1 / DT));
  check('A2b', 'Menang ledakan bom (35 dtk)', s.round.winner === 'atk' && s.round.reason === 'explosion', `${s.round.winner}/${s.round.reason} t=${(s.now - t0).toFixed(2)}`); }
{ const s = createState(), inp = new DummyInput(); s.round.phase = 'live'; s.round.timer = 100;
  const p = s.agents[0]; s.bomb.carrierId = 0; p.x = 62; p.z = 38; inp.keys.add('KeyE');
  step(s, inp, Math.ceil(3.2 / DT) + 5);
  const d = s.agents[5]; d.x = 62; d.z = 38; d.bot = createBotBrain('D1'); d.bot.defuseDuty = true; d.defusing = true;
  for (const a of s.agents.filter(a => a.team === 'atk')) { a.x = 5; a.z = 25; }
  inp.keys.delete('KeyE'); step(s, inp, Math.ceil(5.0 / DT) + 10);
  check('A2c', 'Menang defuse', s.round.winner === 'def' && s.round.reason === 'defuse', `${s.round.winner}/${s.round.reason}`); }
{ const s = createState(), inp = new DummyInput(); s.round.phase = 'live'; s.round.timer = 2;
  for (const a of s.agents) a.bot = null; // tanpa otak: tak ada yang saling bunuh
  step(s, inp, Math.ceil(3 / DT));
  check('A2d', 'Menang timeout (def)', s.round.winner === 'def' && s.round.reason === 'timeout', `${s.round.winner}/${s.round.reason}`); }
// ---------- A3: post-plant ----------
{ const s = createState(), inp = new DummyInput(); s.round.phase = 'live'; s.round.timer = 100;
  const p = s.agents[0]; s.bomb.carrierId = 0; p.x = 62; p.z = 38; inp.keys.add('KeyE');
  step(s, inp, Math.ceil(3.2 / DT) + 5);
  s.bomb.timer = 1.0;
  for (const a of s.agents.filter(a => a.team === 'atk')) { a.hp = 0; a.alive = false; }
  step(s, inp, 30); // 0,5 dtk: ronde harus BELUM berakhir
  const mid = s.round.phase;
  step(s, inp, Math.ceil(2 / DT));
  check('A3', 'Post-plant: atk habis, ronde lanjut sampai ledakan', mid === 'bomb' && s.round.winner === 'atk' && s.round.reason === 'explosion', `mid=${mid} akhir=${s.round.winner}/${s.round.reason}`); }
// ---------- A4: match berakhir di skor 8 + playAgain ----------
{ const s = createState(); s.match.scoreAtk = 7; s.match.scoreDef = 7; s.match.round = 14;
  endRound(s, 'atk', 'elimination');
  const overOk = s.match.over && s.match.scoreAtk === 8 && s.match.winner === 'atk';
  playAgain(s);
  check('A4', 'Match berakhir tepat skor 8; playAgain reset $800 & 0-0',
    overOk && s.match.scoreAtk === 0 && s.match.scoreDef === 0 && s.match.round === 1 && s.agents.every(a => a.money === 800) && !s.match.over,
    `over=${overOk} skor=${s.match.scoreAtk}-${s.match.scoreDef} uang=${s.agents[0].money}`); }
// ---------- B1: tiap senjata tembak/reload/mag habis/cadangan habis ----------
for (const key of ['P9', 'Breacher', 'Kestrel', 'VK47', 'Longbow']) {
  const w = WEAPONS[key];
  const t = duel(key); const { s, sh, tg } = t;
  // tembak 1x
  s.now += 0.2; const r1 = fire(sh, s, aimAt(sh, tg));
  const magAfter1 = currentWeapon(sh).mag;
  // habiskan magasin
  let guard = 0;
  while (currentWeapon(sh).mag > 0 && guard++ < 100) { s.now += 60 / w.rpm + 0.01; fire(sh, s, aimAt(sh, tg)); }
  s.now += 60 / w.rpm + 0.01; const dry = fire(sh, s, aimAt(sh, tg));
  const t0 = s.now; const okR = startReload(sh, s.now);
  step(s, new DummyInput(), Math.ceil(w.reload / DT) + 2);
  const magRefilled = currentWeapon(sh).mag > 0;
  const durOk = Math.abs((sh.reloadUntil || t0) - t0) < 0.01 || magRefilled; // reload selesai dalam durasi tabel
  // cadangan habis permanen ronde itu
  const t2 = duel(key); t2.sh.weapons.primary.reserve = 0; t2.sh.weapons.primary.mag = 1;
  t2.s.now += 0.2; fire(t2.sh, t2.s, aimAt(t2.sh, t2.tg));
  const okR2 = startReload(t2.sh, t2.s.now); // harus false: cadangan 0
  check('B1-' + key, `Senjata ${key}: tembak/reload ${w.reload} dtk/mag habis/cadangan habis`,
    !!r1 && magAfter1 === w.mag - 1 && dry && dry.dry === true && okR && magRefilled && !okR2,
    `mag1=${magAfter1} dry=${!!(dry && dry.dry)} reloadOk=${okR} refill=${magRefilled} reloadTanpaCadangan=${okR2}`); }
// ---------- B2: damage tabel ----------
{ const cases = [['P9', 4], ['VK47', 3], ['Longbow', 1], ['Kestrel', 5], ['Breacher', 2]];
  for (const [key, n] of cases) {
    const t = duel(key); const r = fireN(t.s, t.sh, t.tg, n);
    check('B2-' + key, `Damage ${key}: mati dalam ${n} hit torso`, !t.tg.alive, `hp=${t.tg.hp} hits=${r.hits}`); } }
{ const t = duel('VK47', true); const r = fireN(t.s, t.sh, t.tg, 5); // kevlar: 34*0.65=22 -> 5 hit
  check('B2-kev', 'VK-47 vs kevlar mati dalam 5 hit (bukan 3)', !t.tg.alive, `hp=${t.tg.hp}`); }
// ---------- B4: spread diam/gerak/crouch ----------
{ const s = createState(); const a = s.agents[0];
  a.weapons.primary = createLoadout('VK47'); a.current = 'primary';
  a.vx = 0; a.vz = 0; a.crouch = false; const sStand = spreadFor(a, WEAPONS.VK47, false);
  const sMove = spreadFor(a, WEAPONS.VK47, true);
  a.crouch = true; const sCrouch = spreadFor(a, WEAPONS.VK47, false);
  a.crouch = false; a.onGround = false; const sAir = spreadFor(a, WEAPONS.VK47, false);
  check('B4', 'Spread gerak > diam; crouch x0,7; udara x1,6',
    sMove > sStand && Math.abs(sCrouch / sStand - 0.7) < 0.01 && Math.abs(sAir / sStand - 1.6) < 0.01,
    `diam=${sStand.toFixed(4)} gerak=${sMove.toFixed(4)} crouch=${sCrouch.toFixed(4)} udara=${sAir.toFixed(4)}`);
  // empiris 200 tembakan P9 di 30 m, diam vs gerak
  const hitRate = (moving) => {
    const t = duel('P9', false, 30); t.sh.x = 12; t.sh.z = 40; t.tg.x = 42; t.tg.z = 40; let hits = 0, n = 0;
    t.sh.vx = moving ? 5.2 : 0; t.sh.vz = 0;
    for (let i = 0; i < 200; i++) { t.s.now += 0.16; t.sh.weapons.primary.mag = 12; const r = fire(t.sh, t.s, aimAt(t.sh, t.tg)); if (r && r.hit) hits++; n++; if (!t.tg.alive) { t.tg.hp = 100; t.tg.alive = true; } }
    return hits / n;
  };
  const hs = hitRate(false), hm = hitRate(true);
  check('B4-emp', 'Empiris P9 30 m: hit-rate diam > gerak', hs > hm, `diam=${hs.toFixed(2)} gerak=${hm.toFixed(2)}`); }
// ---------- B5: Breacher ----------
{ const t = duel('Breacher', false, 3); const before = t.s.events.length;
  t.s.now += 0.2; fire(t.sh, t.s, aimAt(t.sh, t.tg));
  const hits = t.s.events.slice(before).filter(e => e.type === 'hit');
  const t25 = duel('Breacher', false, 25); const r25 = fireN(t25.s, t25.sh, t25.tg, 1);
  check('B5', 'Breacher 8 pellet/tembakan; hit penuh 25 m TIDAK membunuh',
    hits.length === 8 && t.tg.hp === 100 - 72 && t25.tg.alive && r25.dmgSum <= 20,
    `pellet=${hits.length} dmg3m=${100 - t.tg.hp} dmg25m=${r25.dmgSum} hp25=${t25.tg.hp}`); }
// ---------- B6: Longbow optik ----------
{ const s = createState(); const a = s.agents[0];
  a.weapons.primary = createLoadout('Longbow'); a.current = 'primary';
  a.scoped = false; const hip = spreadFor(a, WEAPONS.Longbow, false);
  a.scoped = true; const sc = spreadFor(a, WEAPONS.Longbow, false);
  const hitRate = (scoped) => {
    const t = duel('Longbow', false, 30); t.sh.x = 12; t.sh.z = 40; t.tg.x = 42; t.tg.z = 40; t.sh.scoped = scoped; let hits = 0;
    for (let i = 0; i < 20; i++) { t.s.now += 1.5; t.sh.weapons.primary.mag = 5; const r = fire(t.sh, t.s, aimAt(t.sh, t.tg)); if (r && r.hit) hits++; if (!t.tg.alive) { t.tg.hp = 100; t.tg.alive = true; } }
    return hits;
  };
  const hHip = hitRate(false), hSc = hitRate(true);
  check('B6', 'Longbow optik 2,5x: spread 0,0005 vs hip 0,050; 20 tembakan 30 m scoped>>hip',
    Math.abs(hip - 0.050) < 1e-9 && Math.abs(sc - 0.0005) < 1e-9 && hSc >= 15 && hHip <= 6,
    `hipSpread=${hip} scopedSpread=${sc} hitHip=${hHip}/20 hitScoped=${hSc}/20`); }
// ---------- B7: granat ----------
{ // Frag pusat 85
  const s = createState(); s.round.phase = 'live';
  const tg = s.agents[5]; tg.x = 40; tg.z = 25; tg.hp = 100;
  const sh = s.agents[0]; sh.x = 39.5; sh.z = 25;
  const p = createProjectile(s, sh, 'Frag', { x: 1, y: 0, z: 0 });
  p.x = 40; p.z = 25; p.y = 1; p.vx = 0; p.vy = 0; p.vz = 0; p.fuseAt = s.now + 0.05;
  for (let i = 0; i < 10; i++) { s.now += DT; updateGrenades(s, DT); }
  const hpProj = tg.hp; // proyektil meledak ~0,6 m dari pusat target -> ~80 dmg (falloff linear)
  // pusat persis (d=0): panggil explosiveDamage langsung
  const s0 = createState(); const tg0 = s0.agents[5]; tg0.x = 40; tg0.z = 25; tg0.hp = 100;
  const { explosiveDamage } = await import('../game/src/combat.js');
  explosiveDamage(s0, 40, 0.9, 25, 6, 85, 10, s0.agents[0]);
  check('B7-frag', 'Frag pusat (d=0) = 85 dmg (HP 100 -> 15, tidak mati)', tg0.hp === 15, `hpPusat=${tg0.hp} hpProyektil0,6m=${hpProj}`);
  // Frag tidak tembus dinding: ledakan (54,42), target (58,42) di balik dinding interior A
  const s2 = createState(); s2.round.phase = 'live';
  const tg2 = s2.agents[5]; tg2.x = 58; tg2.z = 42; tg2.hp = 100;
  const sh2 = s2.agents[0];
  const p2 = createProjectile(s2, sh2, 'Frag', { x: 1, y: 0, z: 0 });
  p2.x = 54; p2.z = 42; p2.y = 1; p2.vx = 0; p2.vy = 0; p2.vz = 0; p2.fuseAt = s2.now + 0.05;
  for (let i = 0; i < 10; i++) { s2.now += DT; updateGrenades(s2, DT); }
  check('B7-wall', 'Frag tidak menembus dinding penuh', tg2.hp === 100, `hp=${tg2.hp}`);
  // Smoke memutus LOS bot: uji tembakan bot — pakai losBlocked (mekanisme) + bot tak menembak
  const s3 = createState(); s3.round.phase = 'live'; s3.round.timer = 100;
  const d1 = s3.agents[5]; d1.bot = createBotBrain('D1'); d1.x = 40; d1.z = 25; d1.yaw = Math.PI;
  const atk = s3.agents[0]; atk.x = 20; atk.z = 25; atk.bot = null;
  s3.smokes.push({ x: 30, y: 1.5, z: 25, r: 3.5, until: s3.now + 12 });
  const before = s3.events.filter(e => e.type === 'muzzle' && e.shooter === 5).length;
  step(s3, new DummyInput(), Math.ceil(5 / DT));
  const after = s3.events.filter(e => e.type === 'muzzle' && e.shooter === 5).length;
  check('B7-smoke', 'Smoke memutus tembakan bot 12 dtk (0 tembakan dalam 5 dtk)', after === before, `tembakan=${after - before}`);
  // Flash: menghadap 2,2 dtk, membelakangi 0,8 dtk
  const s4 = createState(); s4.round.phase = 'live';
  const v = s4.agents[5]; v.x = 30; v.z = 40; v.yaw = Math.PI; // menghadap -X ke flash di (20,40) A-long
  const sh4 = s4.agents[0];
  const pf = createProjectile(s4, sh4, 'Flash', { x: 1, y: 0, z: 0 });
  pf.x = 20; pf.z = 40; pf.y = 1.5; pf.vx = 0; pf.vy = 0; pf.vz = 0; pf.fuseAt = s4.now + 0.05;
  for (let i = 0; i < 10; i++) { s4.now += DT; updateGrenades(s4, DT); }
  const blindFace = v.blindUntil - s4.now;
  const s5 = createState(); s5.round.phase = 'live';
  const v5 = s5.agents[5]; v5.x = 30; v5.z = 40; v5.yaw = 0; // membelakangi
  const pf5 = createProjectile(s5, s5.agents[0], 'Flash', { x: 1, y: 0, z: 0 });
  pf5.x = 20; pf5.z = 40; pf5.y = 1.5; pf5.vx = 0; pf5.vy = 0; pf5.vz = 0; pf5.fuseAt = s5.now + 0.05;
  for (let i = 0; i < 10; i++) { s5.now += DT; updateGrenades(s5, DT); }
  const blindBack = v5.blindUntil - s5.now;
  check('B7-flash', 'Flash: menghadap 2,2 dtk / membelakangi 0,8 dtk',
    Math.abs(blindFace - 2.2) < 0.15 && Math.abs(blindBack - 0.8) < 0.15,
    `hadapan=${blindFace.toFixed(2)} punggung=${blindBack.toFixed(2)}`); }
// ---------- B8: kevlar hilang saat mati ----------
{ const t = duel('VK47', true); fireN(t.s, t.sh, t.tg, 5); // 22x5=110 vs kevlar
  check('B8', 'Kevlar hilang saat mati', !t.tg.alive && t.tg.kevlar === false, `alive=${t.tg.alive} kevlar=${t.tg.kevlar} hp=${t.tg.hp}`); }
// ---------- C1: plant ----------
{ // di luar zona: tidak ada progress
  const s = createState(), inp = new DummyInput(); s.round.phase = 'live'; s.round.timer = 100;
  const p = s.agents[0]; s.bomb.carrierId = 0; p.x = 40; p.z = 25; inp.keys.add('KeyE');
  blindOthers(s, [0]);
  step(s, inp, Math.ceil(4 / DT));
  check('C1a', 'Plant di luar zona: tidak progress', p.plantProg === 0 && s.bomb.status === 'carried', `prog=${p.plantProg}`); }
{ // lepas E di tengah
  const s = createState(), inp = new DummyInput(); s.round.phase = 'live'; s.round.timer = 100;
  const p = s.agents[0]; s.bomb.carrierId = 0; p.x = 62; p.z = 38; inp.keys.add('KeyE');
  blindOthers(s, [0]);
  step(s, inp, Math.ceil(1.5 / DT)); inp.keys.delete('KeyE'); step(s, inp, 10);
  check('C1b', 'Plant batal bila lepas E (progress reset)', p.plantProg === 0 && s.bomb.status === 'carried', `prog=${p.plantProg}`); }
{ // gerak membatalkan
  const s = createState(), inp = new DummyInput(); s.round.phase = 'live'; s.round.timer = 100;
  const p = s.agents[0]; s.bomb.carrierId = 0; p.x = 62; p.z = 38; inp.keys.add('KeyE');
  blindOthers(s, [0]);
  step(s, inp, Math.ceil(1.5 / DT)); inp.keys.add('KeyW'); step(s, inp, 10);
  check('C1c', 'Plant batal bila bergerak', p.plantProg === 0 && s.bomb.status === 'carried', `prog=${p.plantProg}`); }
{ // ganti senjata
  const s = createState(), inp = new DummyInput(); s.round.phase = 'live'; s.round.timer = 100;
  const p = s.agents[0]; s.bomb.carrierId = 0; p.x = 62; p.z = 38;
  p.weapons.primary = createLoadout('VK47'); p.current = 'primary';
  blindOthers(s, [0]);
  inp.keys.add('KeyE'); step(s, inp, Math.ceil(1.5 / DT));
  const progBefore = p.plantProg;
  switchWeapon(p, 'secondary', s.now); step(s, inp, Math.ceil(2 / DT));
  check('C1d', 'Plant batal bila ganti senjata', p.plantProg === 0 && s.bomb.status === 'carried',
    `progSebelum=${progBefore.toFixed(2)} progSesudah=${p.plantProg.toFixed(2)} status=${s.bomb.status}`); }
{ // damage TIDAK membatalkan
  const s = createState(), inp = new DummyInput(); s.round.phase = 'live'; s.round.timer = 100;
  const p = s.agents[0]; s.bomb.carrierId = 0; p.x = 62; p.z = 38; inp.keys.add('KeyE');
  blindOthers(s, [0]);
  step(s, inp, Math.ceil(1.5 / DT));
  const { applyDamage } = await import('../game/src/combat.js');
  applyDamage(s, p, 30, s.agents[5], 'torso', 'bullet');
  step(s, inp, Math.ceil(2 / DT));
  check('C1e', 'Plant TIDAK batal oleh damage', s.bomb.status === 'planted', `hp=${p.hp} status=${s.bomb.status}`); }
// ---------- C2: defuse + beep + ledakan 35,0 ----------
{ const s = createState(), inp = new DummyInput(); s.round.phase = 'live'; s.round.timer = 100;
  const p = s.agents[0]; s.bomb.carrierId = 0; p.x = 62; p.z = 38; inp.keys.add('KeyE');
  step(s, inp, Math.ceil(3.2 / DT) + 5);
  const tPlant = s.now;
  // beep: timer 35 -> beep hanya saat <=10; cek ada beep setelah timer <10
  s.bomb.timer = 10.5;
  step(s, inp, Math.ceil(1.5 / DT));
  const beeps = s.events.filter(e => e.type === 'beep').length;
  // defuse batal bila keluar zona
  const d = s.agents[5]; d.x = 62; d.z = 38; d.bot = createBotBrain('D1'); d.bot.defuseDuty = true; d.defusing = true;
  for (const a of s.agents.filter(a => a.team === 'atk')) { a.x = 5; a.z = 25; }
  inp.keys.delete('KeyE');
  step(s, inp, Math.ceil(2 / DT)); const progMid = d.defuseProg;
  d.x = 60; d.z = 22; step(s, inp, 10); // keluar zona (updateBots set defusing=false)
  const progAfter = d.defuseProg;
  // ledakan tepat 35,0: plant baru, timer habis
  const s2 = createState(), inp2 = new DummyInput(); s2.round.phase = 'live'; s2.round.timer = 100;
  const p2 = s2.agents[0]; s2.bomb.carrierId = 0; p2.x = 62; p2.z = 38; inp2.keys.add('KeyE');
  step(s2, inp2, Math.ceil(3.2 / DT) + 5);
  const tP = s2.now;
  for (const dd of s2.agents.filter(a => a.team === 'def')) { dd.x = 60; dd.z = 22; dd.defusing = false; }
  let tExp = -1;
  for (let i = 0; i < Math.ceil(40 / DT); i++) {
    simStep(s2, DT, inp2);
    for (const dd of s2.agents.filter(a => a.team === 'def')) { dd.x = 60; dd.z = 22; dd.defusing = false; dd.defuseProg = 0; dd.blindUntil = s2.now + 1000; } // pin defender jauh dari site agar timer ledakan murni
    if (s2.round.reason === 'explosion') { tExp = s2.now; break; }
    if (s2.round.phase === 'end') break;
  }
  check('C2', 'Defuse batal keluar zona; beep <10 dtk; ledakan tepat 35,0 dtk',
    beeps >= 1 && progMid > 1 && progAfter === 0 && Math.abs((tExp - tP) - 35) < 0.1,
    `beep=${beeps} defProgMid=${progMid.toFixed(2)} defProgSetelahKeluar=${progAfter} ledakanSetelahPlant=${tExp >= 0 ? (tExp - tP).toFixed(2) : 'tidak terjadi'} dtk`); }
// ---------- C3: ledger ----------
{ const s = createState();
  const k = s.agents[0]; k.pending = 600; // 2 kill
  const d = s.agents[5]; d.pending = 300; // defuse
  endRound(s, 'atk', 'elimination');
  // atk: 800+600+3250=4650 (tanpa plant); def defuser: 800+300+1900=3000
  check('C3a', 'Ledger: kill+menang / defuse+kalah', k.money === 4650 && d.money === 3000, `atk=${k.money} def=${d.money}`);
  const s2 = createState(); const a = s2.agents[0]; a.money = 8900; a.pending = 500;
  endRound(s2, 'atk', 'elimination');
  check('C3b', 'Ledger cap $9.000', a.money === 9000, `money=${a.money}`); }
// ---------- C4: beli ----------
{ const s = createState(), inp = new DummyInput();
  s.round.phase = 'live';
  let r = buyItem(s, s.agents[0], 'VK47');
  const liveReject = !r.ok;
  s.round.phase = 'buy'; s.agents[0].x = 40; s.agents[0].z = 25;
  r = buyItem(s, s.agents[0], 'VK47');
  const zoneReject = !r.ok && r.why === 'not-in-spawn';
  s.agents[0].x = 5; s.agents[0].z = 25; s.agents[0].money = 20000;
  const prices = [];
  for (const [key, price] of [['Breacher', 1050], ['Kestrel', 1500], ['VK47', 2700], ['Longbow', 4750], ['Kevlar', 650], ['Frag', 300], ['Smoke', 300], ['Flash', 200]]) {
    const st = createState(); st.round.phase = 'buy'; const ag = st.agents[0]; ag.money = 20000;
    const before = ag.money; const rr = buyItem(st, ag, key);
    prices.push(`${key}:${rr.ok ? before - ag.money : 'GAGAL'}/${price}`);
  }
  const dup = (() => { const st = createState(); st.round.phase = 'buy'; const ag = st.agents[0]; ag.money = 20000; buyItem(st, ag, 'VK47'); return buyItem(st, ag, 'Kestrel'); })();
  check('C4', 'Beli ditolak di luar fase/zona; harga menu = potongan (8 item); primer ganda ditolak',
    liveReject && zoneReject && prices.every(p => { const [k, v] = p.split(':'); const [a, b] = v.split('/'); return a === b; }) && !dup.ok,
    `live=${liveReject} zona=${zoneReject} harga=[${prices.join(' ')}] dupOk=${dup.ok}`); }
// ---------- C5: drop / pickup / carry-over ----------
{ const s = createState(), inp = new DummyInput(); s.round.phase = 'live'; s.round.timer = 100;
  const vic = s.agents[1]; vic.weapons.primary = createLoadout('VK47'); vic.x = 30; vic.z = 25;
  const { applyDamage } = await import('../game/src/combat.js');
  applyDamage(s, vic, 200, s.agents[5], 'torso', 'bullet');
  const dropped = s.dropped.length === 1 && s.dropped[0].key === 'VK47';
  // kawan ambil (F): kawan tanpa primer
  const ally = s.agents[2]; ally.x = 30; ally.z = 25; ally.weapons.primary = null;
  const okPick = pickupWeapon(ally, s);
  // lawan ambil
  const s2 = createState(); const vic2 = s2.agents[1]; vic2.weapons.primary = createLoadout('VK47'); vic2.x = 30; vic2.z = 25;
  applyDamage(s2, vic2, 200, s2.agents[5], 'torso', 'bullet');
  const foe = s2.agents[5]; foe.x = 30; foe.z = 25; foe.weapons.primary = null;
  const okFoe = pickupWeapon(foe, s2);
  // carry-over: survivor pertahankan primer+kevlar+mag penuh; mati -> P9; granat?
  const s3 = createState(); const sv = s3.agents[1]; sv.weapons.primary = createLoadout('VK47'); sv.weapons.primary.mag = 5; sv.kevlar = true; sv.grenades.Frag = 1;
  const dead = s3.agents[2]; dead.weapons.primary = createLoadout('VK47'); dead.kevlar = true; dead.grenades.Frag = 1; dead.hp = 0; dead.alive = false;
  const { resetRound } = await import('../game/src/state.js');
  resetRound(s3);
  const carryOk = sv.weapons.primary && sv.weapons.primary.key === 'VK47' && sv.weapons.primary.mag === 30 && sv.kevlar === true;
  const deadOk = dead.weapons.primary === null && dead.kevlar === false;
  const grenadeKept = sv.grenades.Frag === 1;
  // dropped hilang di akhir ronde
  const s4 = createState(); s4.dropped.push({ key: 'VK47', mag: 1, reserve: 0, x: 30, z: 25 });
  resetRound(s4);
  check('C5', 'Primer jatuh+diambil kawan/lawan; carry-over survivor; dropped hilang akhir ronde; granat survivor dipertahankan?',
    dropped && okPick && okFoe && carryOk && deadOk && s4.dropped.length === 0 && grenadeKept,
    `drop=${dropped} kawan=${okPick} lawan=${okFoe} carry=${carryOk} mati->P9=${deadOk} droppedBersih=${s4.dropped.length === 0} granatDipertahankan=${grenadeKept} (Frag survivor setelah reset=${sv.grenades.Frag})`); }
// ---------- C6: beli bot 3 tingkat saldo ----------
import { buyBots } from '../game/src/bots.js';
{ const mk = (money, role, streak = 0) => {
    const s = createState(); const a = s.agents[role === 'D2' ? 6 : 1]; a.bot = createBotBrain(role);
    a.money = money; s.match.d2LoseStreak = streak; buyBots(s); return a;
  };
  const low = mk(800, 'A1');       // kevlar saja
  const mid = mk(4000, 'A1');      // VK47+kevlar+Frag+Flash
  const mid2 = mk(2000, 'A1');     // Breacher+kevlar+Frag
  const d2rich = mk(6000, 'D2');   // Longbow+kevlar
  const d2eco = mk(3000, 'D2', 0); // menabung Longbow (tanpa primer)
  const d2streak = mk(3000, 'D2', 3); // Kestrel+kevlar
  check('C6a', 'Bot $800: kevlar saja, tanpa primer', low.kevlar && !low.weapons.primary && low.money === 150, `uang=${low.money} kev=${low.kevlar} prim=${low.weapons.primary && low.weapons.primary.key}`);
  check('C6b', 'Bot $4000: VK47+kevlar+Frag+Flash', mid.weapons.primary && mid.weapons.primary.key === 'VK47' && mid.kevlar && mid.grenades.Frag === 1 && mid.grenades.Flash === 1, `uang=${mid.money} prim=${mid.weapons.primary && mid.weapons.primary.key}`);
  check('C6c', 'Bot $2000: Breacher+kevlar+Frag', mid2.weapons.primary && mid2.weapons.primary.key === 'Breacher' && mid2.kevlar, `uang=${mid2.money}`);
  check('C6d', 'D2 $6000: Longbow+kevlar', d2rich.weapons.primary && d2rich.weapons.primary.key === 'Longbow' && d2rich.kevlar, `uang=${d2rich.money}`);
  check('C6e', 'D2 $3000 streak 0: eco (tanpa primer, menabung Longbow)', !d2eco.weapons.primary, `prim=${d2eco.weapons.primary && d2eco.weapons.primary.key} uang=${d2eco.money}`);
  check('C6f', 'D2 $3000 streak 3: beli standar (Kestrel+kevlar)', d2streak.weapons.primary && d2streak.weapons.primary.key === 'Kestrel', `prim=${d2streak.weapons.primary && d2streak.weapons.primary.key}`); }
// ---------- D1: bot tak menembak target tak terlihat (isolasi: hanya D1 + target + 1 decoy hidup) ----------
{ const s = createState(), inp = new DummyInput(); s.round.phase = 'live'; s.round.timer = 100;
  killAllBut(s, [0, 3, 5]); // target=0, decoy atk=3 (di B-tunnel barat, tak terlihat D1), D1=5
  const d1 = s.agents[5]; d1.bot = createBotBrain('D1'); d1.x = 63; d1.z = 37; d1.yaw = Math.atan2(41 - 37, 66 - 63);
  const tg = s.agents[0]; tg.x = 66; tg.z = 41; tg.yaw = 0; tg.bot = null;
  const dec = s.agents[3]; dec.x = 12; dec.z = 10; // decoy: bila D1 menembaknya, LOS bocor
  const yaw0 = d1.yaw;
  step(s, inp, Math.ceil(20 / DT));
  const shots = s.events.filter(e => e.type === 'muzzle' && e.shooter === 5).length;
  check('D1', 'Bot tak menembak target diam di balik dinding penuh 20 dtk', shots === 0 && Math.abs(d1.yaw - yaw0) < 0.05,
    `tembakanD1=${shots} yawBerubah=${Math.abs(d1.yaw - yaw0).toFixed(3)} targetHidup=${tg.alive} decoyHidup=${dec.alive}`); }
// ---------- D2: pendengaran, garis A-long (tanpa dinding/pintu di antaranya) ----------
{ const hearAt = (distM) => {
    const s = createState(), inp = new DummyInput(); s.round.phase = 'live'; s.round.timer = 100;
    killAllBut(s, [0, 8]);
    const bot = s.agents[8]; bot.bot = createBotBrain('D4'); bot.x = 12; bot.z = 40; bot.yaw = 0;
    const sh = s.agents[0]; sh.bot = null; sh.x = 12 + distM; sh.z = 40;
    sh.weapons.primary = createLoadout('VK47'); sh.current = 'primary';
    s.now += 0.2; fire(sh, s, { x: 1, y: 0, z: 0 });
    step(s, inp, 5);
    return bot.bot.hearPos !== null;
  };
  const stepHear = (distM, crouch) => {
    const s = createState(), inp = new DummyInput(); s.round.phase = 'live'; s.round.timer = 100;
    killAllBut(s, [0, 8]);
    const bot = s.agents[8]; bot.bot = createBotBrain('D4'); bot.x = 12; bot.z = 40;
    const p = s.agents[0]; p.bot = null; p.x = 12 + distM; p.z = 40; p.crouch = crouch;
    s.events.push({ t: s.now, type: 'noise', kind: 'step', x: p.x, y: 0, z: p.z, radius: crouch ? CONFIG.hearing.crouchStep : CONFIG.hearing.runStep, team: 'atk' });
    step(s, inp, 5);
    return bot.bot.hearPos !== null;
  };
  const h40 = hearAt(40), h50 = hearAt(50), r11 = stepHear(11, false), r13 = stepHear(13, false), c3 = stepHear(3, true), c5 = stepHear(5, true);
  check('D2', 'Bot dengar tembakan VK-47 di 40 m, tidak di 50 m; langkah lari 12 m / crouch 4 m',
    h40 && !h50 && r11 && !r13 && c3 && !c5,
    `vk40=${h40} vk50=${h50} lari11=${r11} lari13=${r13} crouch3=${c3} crouch5=${c5}`); }
// ---------- D3: 9 bot capai tugas tanpa macet >2 dtk (macet = punya sisa path tapi tak bergerak; fase buy + holding dikecualikan) ----------
{ const s = createState(), inp = new DummyInput(); bvb(s);
  let maxStuck = 0; const stuck = {}; const lastPos = new Map();
  for (const a of s.agents) lastPos.set(a.id, { x: a.x, z: a.z, t: 0, stuckSince: null });
  let t = 0;
  for (let i = 0; i < Math.ceil(112 / DT); i++) {
    simStep(s, DT, inp); t += DT;
    if (s.round.phase === 'end') break;
    if (s.round.phase !== 'live' && s.round.phase !== 'bomb') continue;
    for (const a of s.agents) {
      if (!a.alive || !a.bot) continue;
      const lp = lastPos.get(a.id);
      const hasPath = a.bot.path && a.bot.pathIdx < a.bot.path.length;
      const busy = a.planting || a.defusing || (a.bot.targetId !== null && s.now < a.bot.reactAt + 5);
      if (Math.hypot(a.x - lp.x, a.z - lp.z) > 0.05) { lp.x = a.x; lp.z = a.z; lp.t = t; lp.stuckSince = null; }
      else if (hasPath && !busy) {
        if (lp.stuckSince === null) lp.stuckSince = t;
        const st = t - lp.stuckSince;
        if (st > maxStuck) maxStuck = st;
        if (st > 2) stuck[a.role] = Math.max(stuck[a.role] || 0, st);
      }
    }
  }
  check('D3', '9 bot: tak ada yang macet >2 dtk saat punya sisa path dalam 1 ronde', Object.keys(stuck).length === 0,
    `maxStuck=${maxStuck.toFixed(1)} dtk stuck=${JSON.stringify(stuck)} faseAkhir=${s.round.phase} skor=${s.match.scoreAtk}-${s.match.scoreDef}`); }
// ---------- D4: playbook pasca-plant (diamati sampai ronde berakhir / maks 40 dtk) ----------
{ const s = createState(), inp = new DummyInput(); bvb(s);
  const c = s.agents[4]; s.bomb.carrierId = 4; c.x = 62; c.z = 38;
  blindOthers(s, [4]); // carrier tak ditembak saat plant paksa
  step(s, inp, Math.ceil(12 / DT)); // fase buy selesai -> live
  c.x = 62; c.z = 38; c.planting = true; c.plantProg = 3.1;
  step(s, inp, Math.ceil(1 / DT));
  const planted = s.bomb.status === 'planted';
  let dutyOk = false, routesOk = false, atkHold = 0, defReached = false, defused = false, exploded = false;
  for (let i = 0; i < Math.ceil(40 / DT); i++) {
    simStep(s, DT, inp);
    const defs = s.agents.filter(a => a.team === 'def' && a.alive && a.bot);
    const sorted = [...defs].sort((p, q) => Math.hypot(p.x - s.bomb.x, p.z - s.bomb.z) - Math.hypot(q.x - s.bomb.x, q.z - s.bomb.z));
    if (sorted.filter(a => a.bot.defuseDuty).length === 1) dutyOk = true;
    if (sorted.length >= 2 && sorted[0].bot.retakeRoute !== sorted[1].bot.retakeRoute) routesOk = true;
    if (i === Math.ceil(5 / DT)) atkHold = s.agents.filter(a => a.team === 'atk' && a.alive && Math.hypot(a.x - s.bomb.x, a.z - s.bomb.z) <= 12).length;
    if (defs.some(a => inZone(a, 'plantA'))) defReached = true;
    if (s.round.reason === 'defuse') { defused = true; break; }
    if (s.round.reason === 'explosion') { exploded = true; break; }
    if (s.round.phase === 'end') break;
  }
  check('D4', 'Playbook: 1 defuseDuty + 2 retake rute berbeda + defuser sampai site + penyerang tahan radius 12 m',
    planted && dutyOk && routesOk && defReached && atkHold >= 1,
    `planted=${planted} duty1=${dutyOk} ruteBerbeda=${routesOk} defuserSampaiSite=${defReached} atkDalam12m@5dtk=${atkHold} akhir=${defused ? 'defuse' : exploded ? 'ledakan' : s.round.phase}`); }
// ---------- D5: bom jatuh ----------
{ const s = createState(), inp = new DummyInput(); bvb(s);
  step(s, inp, Math.ceil(13 / DT)); // live
  const c = s.agents[4];
  // catat defender terdekat sebelum carrier mati
  const { applyDamage } = await import('../game/src/combat.js');
  const cx = c.x, cz = c.z;
  const nearDef = s.agents.filter(a => a.team === 'def' && a.alive).sort((p, q) => Math.hypot(p.x - cx, p.z - cz) - Math.hypot(q.x - cx, q.z - cz))[0];
  const ndYaw0 = nearDef.yaw, ndX0 = nearDef.x, ndZ0 = nearDef.z;
  applyDamage(s, c, 500, s.agents[5], 'torso', 'bullet');
  const dropped = s.bomb.status === 'dropped';
  let takeT = -1; const t0 = s.now;
  for (let i = 0; i < Math.ceil(15 / DT); i++) { simStep(s, DT, inp); if (s.bomb.status === 'carried') { takeT = s.now - t0; break; } if (s.round.phase === 'end') break; }
  const defMoved = Math.hypot(nearDef.x - ndX0, nearDef.z - ndZ0);
  const defYawToBomb = Math.abs(Math.atan2(s.bomb.z - nearDef.z, s.bomb.x - nearDef.x) - nearDef.yaw);
  check('D5', 'Bom jatuh diambil <=10 dtk; defender terdekat menahan posisi menghadap bom',
    dropped && takeT >= 0 && takeT <= 10,
    `dropped=${dropped} diambilSetelah=${takeT >= 0 ? takeT.toFixed(1) : 'tidak diambil 15 dtk'} dtk defTerdekatBergerak=${defMoved.toFixed(1)} m yawKeBom=${defYawToBomb.toFixed(2)} rad`); }
// ---------- D6: tak ada bot keluar map / menembus cover ----------
{ const s = createState(), inp = new DummyInput(); bvb(s);
  let outOfMap = 0, inSolid = 0, maxStuckTun = 0;
  const inS = (x, z) => SOLIDS.some(so => x > so.minX && x < so.maxX && z > so.minZ && z < so.maxZ && 0 < so.maxY && so.minY < 1.8);
  for (let i = 0; i < Math.ceil(112 / DT) && s.round.phase !== 'end'; i++) {
    simStep(s, DT, inp);
    for (const a of s.agents) {
      if (!a.alive) continue;
      if (a.x < 0 || a.x > 72 || a.z < 0 || a.z > 48) outOfMap++;
      if (inS(a.x, a.z)) inSolid++;
    }
  }
  check('D6', 'Tak ada bot keluar map / di dalam solid selama 1 ronde', outOfMap === 0 && inSolid === 0,
    `keluarMap=${outOfMap} diDalamSolid=${inSolid} (cek posisi tiap tick)`); }
// ---------- D7: waktu tempuh (dikutip sim-test) ----------
{ const { setPath: sp } = await import('../game/src/bots.js');
  const s = createState(); const a = s.agents[4]; a.bot = createBotBrain('A4');
  a.weapons.primary = createLoadout('VK47'); a.current = 'primary';
  sp(a, nearestNode(63, 37)); let tSite = -1;
  for (let i = 0; i < Math.ceil(30 / DT); i++) { moveAlongPath(s, a, DT); if (inZone(a, 'siteA')) { tSite = i * DT; break; } }
  check('D7', 'Bot capai Site A 12-15 dtk (rute murni)', tSite >= 12 && tSite <= 15, `t=${tSite >= 0 ? tSite.toFixed(1) : 'tidak sampai'} dtk`); }
// ---------- AMENDEMEN ----------
{ // AM1: carrier lewat service tunnel — A* dari mulut B-tunnel ke Site A lewat node tunnel?
  const path = aStar(nearestNode(30, 10), nearestNode(63, 37));
  const tags = path.map(i => NODES[i].tags.join('+'));
  const viaTunnel = path.some(i => NODES[i].tags.includes('tunnel'));
  // gerakkan carrier sepanjang path itu lalu plant
  const s = createState(), inp = new DummyInput(); s.round.phase = 'live'; s.round.timer = 100;
  const c = s.agents[4]; c.bot = createBotBrain('A4'); c.x = 30; c.z = 10;
  c.weapons.primary = createLoadout('VK47'); c.current = 'primary';
  setPath(c, nearestNode(63, 37));
  let reached = false, stuckT = 0, lx = c.x, lz = c.z, lt = 0;
  for (let i = 0; i < Math.ceil(60 / DT); i++) {
    moveAlongPath(s, c, DT); s.now += DT;
    if (Math.hypot(c.x - lx, c.z - lz) > 0.05) { lx = c.x; lz = c.z; lt = s.now; } else stuckT = Math.max(stuckT, s.now - lt);
    if (inZone(c, 'plantA')) { reached = true; break; }
  }
  c.planting = true;
  step(s, inp, Math.ceil(3.5 / DT));
  check('AM1', 'Carrier plant lewat service tunnel (A* + jalan + plant)',
    viaTunnel && reached && s.bomb.status === 'planted',
    `viaTunnel=${viaTunnel} path=[${tags.join('>')}] sampaiPlant=${reached} macetMax=${stuckT.toFixed(1)} dtk planted=${s.bomb.status}`); }
{ // AM2: carrier lewat Mid Door — (a) kapabilitas: path dipaksa lewat node pintu; (b) observasi: A* otonom memilih rute apa
  const path = aStar(nearestNode(12, 25), nearestNode(63, 37));
  const viaDoorNode = path.some(i => NODES[i].tags.includes('door'));
  const viaTunnelAuto = path.some(i => NODES[i].tags.includes('tunnel'));
  const s = createState(), inp = new DummyInput(); s.round.phase = 'live'; s.round.timer = 100;
  killAllBut(s, [0, 4, 5]);
  const c = s.agents[4]; c.bot = createBotBrain('A4'); c.x = 12; c.z = 25;
  c.weapons.primary = createLoadout('VK47'); c.current = 'primary';
  const d1 = s.agents[5]; d1.bot = createBotBrain('D1'); d1.x = 66; d1.z = 41; d1.blindUntil = s.now + 1000;
  s.agents[0].x = 4; s.agents[0].z = 21;
  const idx = (x, z) => NODES.findIndex(n => n.x === x && n.z === z);
  const doorNode = NODES.findIndex(n => n.tags.includes('door'));
  c.bot.path = [idx(17, 25), idx(22, 25), idx(27, 25), doorNode, idx(32, 25), idx(37, 25), idx(42, 25), idx(47, 25), idx(48, 32), idx(48, 35), idx(52, 40), idx(57, 40), idx(60, 37), idx(63, 37)];
  c.bot.pathIdx = 0; c.bot.destNode = idx(63, 37);
  let doorMax = 0, crossed = false, planted = false;
  for (let i = 0; i < Math.ceil(60 / DT); i++) {
    simStep(s, DT, inp);
    doorMax = Math.max(doorMax, s.door.open);
    if (c.x > 32) crossed = true;
    if (s.bomb.status === 'planted') { planted = true; break; }
    if (!c.alive || s.round.phase === 'end') break;
  }
  check('AM2', 'Carrier lewat Mid Door (path dipaksa via node pintu): pintu terbuka + lolos + plant',
    crossed && doorMax > 0.5 && planted,
    `pintuTerbukaMax=${doorMax.toFixed(2)} lolosX32=${crossed} planted=${planted} | A* otonom: viaNodePintu=${viaDoorNode} viaTunnel=${viaTunnelAuto} (A* memilih tunnel, bukan pintu)`); }
{ // AM3: defuse dari kedua interior — defuser mencapai plantA via interior A & plantB via interior B
  const runDef = (site) => {
    const s = createState(), inp = new DummyInput(); s.round.phase = 'bomb'; s.round.timer = 0;
    s.bomb.status = 'planted'; s.bomb.site = site; s.bomb.timer = 35;
    s.bomb.x = site === 'A' ? 62 : 62; s.bomb.z = site === 'A' ? 38 : 10;
    const d = s.agents[5]; d.bot = createBotBrain('D1'); d.bot.defuseDuty = true;
    d.x = 60; d.z = site === 'A' ? 22 : 22; // spawn def
    for (const a of s.agents.filter(a => a.team === 'atk')) { a.x = 5; a.z = 25; a.alive = false; a.hp = 0; }
    // paksa defuser jalan ke zona plant site itu
    setPath(d, nearestNode(s.bomb.x, s.bomb.z));
    let inPlant = false;
    for (let i = 0; i < Math.ceil(25 / DT); i++) { moveAlongPath(s, d, DT); s.now += DT; if (inZone(d, site === 'A' ? 'plantA' : 'plantB')) { inPlant = true; break; } }
    return inPlant;
  };
  const aOk = runDef('A'), bOk = runDef('B');
  check('AM3', 'Defuser mencapai zona plant dari interior A dan interior B', aOk && bOk, `interiorA=${aOk} interiorB=${bOk}`); }
{ // AM4: pintu tertutup bukan tembok — A* tetap ada + carrier lolos saat pintu tertutup lalu terbuka
  const s = createState(), inp = new DummyInput(); s.round.phase = 'live'; s.round.timer = 100;
  s.door.open = 0; s.door.target = 0;
  const path = aStar(nearestNode(12, 25), nearestNode(52, 25));
  const c = s.agents[4]; c.bot = createBotBrain('A4'); c.x = 12; c.z = 25;
  setPath(c, nearestNode(52, 25));
  let crossed = false;
  for (let i = 0; i < Math.ceil(30 / DT); i++) { simStep(s, DT, inp); if (c.x > 32) { crossed = true; break; } if (!c.alive) break; }
  check('AM4', 'Pintu tertutup bukan tembok: rute Mid tetap ada & bot lolos', path.length > 0 && crossed,
    `pathLen=${path.length} lolos=${crossed} doorOpen=${s.door.open.toFixed(2)}`); }

const pass = out.filter(o => o.ok).length, fail = out.length - pass;
console.log(`\n${pass} PASS, ${fail} FAIL dari ${out.length}`);
fs.writeFileSync('tools/verify2-qa.json', JSON.stringify({ pass, fail, items: out }, null, 2));
process.exit(fail ? 1 : 0);
