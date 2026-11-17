// EMBERLINE sim — weapons.js. LOGIKA SAJA (viewmodel = Builder B).
// Satu jalur tembak pemain + bot (AMB-05).
import * as THREE from '../vendor/three/three.module.min.js';
import { PAL } from './palette.js';
import { CONFIG, WEAPONS, GRENADES } from './config.js';
import { shoot, dirFromYawPitch } from './combat.js';
import { createProjectile } from './grenades.js';
import { currentWeapon, pushEvent } from './state.js';

export function createLoadout(key) {
  const w = WEAPONS[key];
  return { key, mag: w.mag, reserve: w.reserve };
}
export function spreadFor(a, w, moving) {
  let base;
  if (w.key === 'Longbow') base = a.scoped ? w.spreadStand : w.spreadStandHip;
  else base = w.spreadStand;
  let sp = base + (moving ? w.spreadMove : 0);
  if (a.crouch) sp *= CONFIG.crouchSpreadMul;
  if (!a.onGround) sp *= CONFIG.airSpreadMul;
  // Recoil spray VK-47/Kestrel: +8%/tembakan s.d. x1,8, pulih 0,25 dtk (AMB-01: non-auto tanpa spray)
  if (w.spray && a.recoilShots > 0) sp *= Math.min(CONFIG.recoilSprayMax, 1 + a.recoilShots * CONFIG.recoilSprayStep);
  if (a.bot) { // akurasi bot per ronde §4 (derajat -> radian)
    const r = a.bot.round || 1;
    const extra = (CONFIG.bot.accExtraDeg[Math.min(r, 15)] || 1.5) * Math.PI / 180;
    sp += extra;
  }
  return sp;
}
function perturb(dir, spread) {
  // simpangan acak simetris (AMB-03), pola vertikal dominan via bias y kecil
  const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
  const ux = -dir.z, uz = dir.x; // vektor samping (tegak lurus, datar)
  const len = Math.hypot(ux, uz) || 1;
  const nx = dir.x + (ux / len) * Math.cos(a) * r;
  const nz = dir.z + (uz / len) * Math.cos(a) * r;
  const ny = dir.y + Math.sin(a) * r * 1.2;
  const nl = Math.hypot(nx, ny, nz) || 1;
  return { x: nx / nl, y: ny / nl, z: nz / nl };
}
// aimDir: arah paksa (bot). Tanpa itu: arah yaw/pitch agen.
export function fire(a, state, aimDir) {
  const now = state.now;
  if (!a.alive || now < a.switchUntil || now < a.reloadUntil) return null;
  const w = currentWeapon(a);
  if (!w) return null;
  const wd = WEAPONS[w.key];
  if (now < a.nextShotAt) return null;
  if (w.mag <= 0) {
    pushEvent(state, { type: 'dryclick', shooter: a.id });
    if (a.bot) startReload(a, now); // bot auto-reload saat aman
    return { dry: true };
  }
  const moving = Math.hypot(a.vx, a.vz) > 0.5;
  const sp = spreadFor(a, wd, moving);
  const base = aimDir || dirFromYawPitch(a.yaw, a.pitch);
  let result = null;
  for (let i = 0; i < wd.pellets; i++) {
    const r = shoot(state, a, perturb(base, sp), w);
    if (r && r.hit) result = r;
  }
  w.mag--;
  a.nextShotAt = now + 60 / wd.rpm;
  if (wd.spray) a.recoilShots++;
  else a.recoilShots = 0; // AMB-01
  a.lastShotAt = now;
  const hearR = CONFIG.hearing[wd.key.toLowerCase()] || 35;
  pushEvent(state, { type: 'noise', kind: 'shot', weapon: w.key, x: a.x, y: 0, z: a.z, radius: hearR, team: a.team });
  pushEvent(state, { type: 'muzzle', shooter: a.id, weapon: w.key });
  return result || { hit: false };
}
export function updateWeapons(s) {
  for (const a of s.agents) {
    if (a.reloadUntil && s.now >= a.reloadUntil) { // reload selesai
      const slot = a.reloadSlot, w = slot === 'primary' ? a.weapons.primary : a.weapons.secondary;
      if (w) {
        const need = WEAPONS[w.key].mag - w.mag, take = Math.min(need, w.reserve);
        w.mag += take; w.reserve -= take;
      }
      a.reloadUntil = 0; a.reloadSlot = null;
    }
    if (a.recoilShots > 0 && s.now - a.lastShotAt > CONFIG.recoilRecoverDelay) a.recoilShots = 0;
  }
}
export function startReload(a, now) {
  const w = currentWeapon(a);
  if (!w || a.reloadUntil || w.mag >= WEAPONS[w.key].mag || w.reserve <= 0) return false;
  a.reloadUntil = now + WEAPONS[w.key].reload;
  a.reloadSlot = a.current;
  return true;
}
// AMB-04: ganti senjata membatalkan reload (ulang dari nol).
// Spec §2: ganti senjata juga membatalkan plant/defuse (progress reset).
export function switchWeapon(a, slot, now) {
  if (slot === a.current) return false;
  if (slot === 'primary' && !a.weapons.primary) return false;
  a.reloadUntil = 0; a.reloadSlot = null;
  a.planting = false; a.plantProg = 0; a.defusing = false; a.defuseProg = 0;
  a.current = slot;
  a.switchUntil = now + WEAPONS[(slot === 'primary' ? a.weapons.primary : a.weapons.secondary).key].draw;
  a.scoped = false;
  return true;
}
export function throwGrenade(a, state, kind) {
  if (!a.alive || a.grenades[kind] <= 0 || state.now < a.switchUntil) return false;
  const w = currentWeapon(a);
  const dir = dirFromYawPitch(a.yaw, a.pitch);
  createProjectile(state, a, kind, dir);
  a.grenades[kind]--;
  a.nextShotAt = state.now + 0.7; // AMB-10: kembali ke senjata sebelumnya (slot tak berubah)
  pushEvent(state, { type: 'noise', kind: 'throw', x: a.x, y: 0, z: a.z, radius: 8, team: a.team });
  return true;
}
export function dropWeapon(a, state) {
  const p = a.weapons.primary;
  if (!p) return false; // G: primer saja; P9 tidak jatuh
  state.dropped.push({ key: p.key, mag: p.mag, reserve: p.reserve, x: a.x, z: a.z });
  a.weapons.primary = null; a.current = 'secondary';
  a.reloadUntil = 0; a.reloadSlot = null;
  a.planting = false; a.plantProg = 0; a.defusing = false; a.defuseProg = 0; // ganti senjata = batal
  return true;
}
export function pickupWeapon(a, state) {
  if (a.weapons.primary) return false;
  let best = null, bd = 1.6;
  for (const d of state.dropped) {
    const dist = Math.hypot(d.x - a.x, d.z - a.z);
    if (dist < bd) { bd = dist; best = d; }
  }
  if (!best) return false;
  a.weapons.primary = { key: best.key, mag: best.mag, reserve: best.reserve };
  state.dropped.splice(state.dropped.indexOf(best), 1);
  a.current = 'primary';
  a.planting = false; a.plantProg = 0; a.defusing = false; a.defuseProg = 0; // ganti senjata = batal
  a.switchUntil = state.now + WEAPONS[best.key].draw;
  return true;
}
export { GRENADES };


// ---- VIEWMODEL TANGAN ROBOT + SENJATA — v4-hands (tangan) + detail senjata ----
// v4: 3 jari ditumpuk sepanjang grip, cascade ke sisi kamera, telapak gunmetal
// gelap (jari terang terbaca), lengan lathe belly v14 + cuff overlap v15.
// Senjata: detail laras/pisir/picu/rel (material lama saja, merge -> 0 draw call baru).
// Reload: tilt + yaw ke kamera, dip kecil agar tangan tetap di frame.
import { part, mergeParts } from './palette.js';
const VB = { x: 0.18, y: -0.16, z: -0.55, s: 1.05, yaw: -0.35 }; // v4r2: viewmodel lebih besar/dekat (+10%) — tangan terbaca
let sleeveMat = null;
function weaveMat() {
  if (sleeveMat) return sleeveMat;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f5f6'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(60,60,60,0.10)'; g.lineWidth = 1;
  for (let i = 0; i <= 128; i += 8) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  g.strokeStyle = 'rgba(60,60,60,0.28)';
  for (const x of [42, 86]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1);
  sleeveMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
  return sleeveMat;
}
// Displace geometri lengan ke arah kamera (+z lokal) dengan bump Gaussian.
function hug(geo, slim) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(x, z) || 1e-6, w = Math.max(0, z / r);
    const bump = 0.024 * slim * Math.exp(-(((y + 0.19) / 0.10) ** 2)) * w;
    const k = (r + bump) / r;
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  geo.computeVertexNormals(); return geo;
}
function forearm(slim, wristR, wristZ) {
  const g = new THREE.Group();
  const prof = [[0.066, -0.31], [0.064, -0.26], [0.074, -0.19], [0.072, -0.13],
    [0.062, -0.07], [0.048, -0.02], [0.040, 0.03], [0.036, 0.06]];
  const pts = prof.map(([r, y]) => new THREE.Vector2(r * slim, y));
  g.add(new THREE.Mesh(hug(new THREE.LatheGeometry(pts, 12), slim), weaveMat()));
  const fold = [part(hug(new THREE.CylinderGeometry(0.0555 * slim, 0.0605 * slim, 0.018, 12, 1, true), slim), PAL.fold, 0, -0.048, 0)];
  for (const [y, r] of [[-0.10, 0.0685], [-0.155, 0.0743], [-0.24, 0.0698]])
    fold.push(part(hug(new THREE.TorusGeometry(r * slim, 0.005, 6, 16).rotateX(Math.PI / 2), slim), PAL.fold, 0, y, 0));
  g.add(...mergeParts(fold, false));
  const wrist = new THREE.Mesh(new THREE.SphereGeometry(wristR, 10, 8), PAL.hand);
  wrist.scale.set(1.05, 0.42, 0.85); wrist.position.set(0, 0.058, wristZ); g.add(wrist);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.05, 0.04, 12), PAL.neonO);
  cuff.position.y = 0.02; g.add(cuff);
  return g;
}
function robotHand(cfg, isLeft, armRot) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.075, 0.05), PAL.steel)); // telapak gunmetal GELAP (v4r2): jari terang terbaca di atasnya, bukan menyatu
  const hand = [], tips = [];
  const sx = isLeft ? 1 : -1; // sisi tumpukan jari: tangan kanan -x (sisi kamera), kiri cermin
  // v4r3: jari CASCADE menyamping — ruas 2 + ujung bergeser ke luar (sisi
  // kamera) agar keluar dari siluet telapak; ujung pink lebih besar
  for (let i = 0; i < 3; i++) {
    const fy = -0.006 - i * 0.031, fx = sx * 0.036;
    hand.push(part(new THREE.BoxGeometry(0.028, 0.024, 0.042), PAL.hand, fx, fy, -0.048, -0.35, sx * 0.35, 0));
    hand.push(part(new THREE.BoxGeometry(0.028, 0.056, 0.024), PAL.hand, fx + sx * 0.012, fy - 0.032, -0.08, -0.15));
    tips.push(part(new THREE.BoxGeometry(0.034, 0.026, 0.038), PAL.accP, fx + sx * 0.022, fy - 0.058, -0.066, -1.1));
    hand.push(part(new THREE.BoxGeometry(0.026, 0.02, 0.02), PAL.hand, fx, fy + 0.014, -0.03));
  }
  // telunjuk lurus di sisi frame (jari picu), lebih besar
  hand.push(part(new THREE.BoxGeometry(0.024, 0.024, 0.052), PAL.hand, 0.055, 0.014, -0.065, -0.15, -0.5, 0));
  hand.push(part(new THREE.BoxGeometry(0.024, 0.024, 0.044), PAL.hand, 0.055, 0.012, -0.098, -0.15, -0.5, 0));
  tips.push(part(new THREE.BoxGeometry(0.024, 0.024, 0.034), PAL.accP, 0.055, 0.01, -0.122, -0.15, -0.5, 0));
  // ibu jari menekan sisi grip (sisi kamera)
  const tx = isLeft ? -0.062 : 0.062;
  hand.push(part(new THREE.BoxGeometry(0.022, 0.022, 0.06), PAL.hand, tx, -0.015, -0.05, -0.3, isLeft ? 0.5 : -0.5, 0));
  g.add(...mergeParts(hand, false), ...mergeParts(tips, false));
  const arm = forearm(cfg.slim, cfg.wristR || 0.03, cfg.wristZ || 0.004);
  arm.position.set(0, -0.048, 0.004);
  arm.rotation.x = -0.35; arm.rotation.z = armRot;
  g.add(arm);
  return g;
}
function buildGun(key) {
  const parts = []; let mag = null;
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const add = (geo, mat, x, y, z, rx = 0) => parts.push(part(geo, mat, x, y, z, rx));
  const cyl = (r, len) => new THREE.CylinderGeometry(r, r, len, 8);
  if (key === 'P9') {
    add(box(0.05, 0.045, 0.24), PAL.steel, 0, 0.06, -0.08);
    add(box(0.052, 0.012, 0.24), PAL.accP, 0, 0.085, -0.08);
    add(box(0.045, 0.14, 0.06), PAL.palm, 0, -0.04, 0.02, 0.25);
    add(cyl(0.013, 0.035), PAL.steel, 0, 0.06, -0.205, Math.PI / 2); // laras
    add(box(0.008, 0.022, 0.012), PAL.accP, 0, 0.096, -0.185); // pisir depan
    add(box(0.032, 0.016, 0.012), PAL.steel, 0, 0.094, 0.025); // pisir belakang
    add(box(0.004, 0.028, 0.05), PAL.palm, -0.026, 0.06, -0.03); // serration kiri
    add(box(0.004, 0.028, 0.05), PAL.palm, 0.026, 0.06, -0.03); // serration kanan
    add(box(0.008, 0.028, 0.014), PAL.steel, 0, -0.008, -0.03, 0.25); // picu
    add(box(0.01, 0.008, 0.05), PAL.steel, 0, -0.028, -0.015); // guard picu
    mag = new THREE.Mesh(box(0.04, 0.1, 0.05), PAL.steel); mag.position.set(0, -0.08, 0.03); mag.rotation.x = 0.25;
  } else if (key === 'Breacher') {
    add(cyl(0.026, 0.5), PAL.steel, 0, 0.05, -0.22, Math.PI / 2);
    add(box(0.07, 0.09, 0.3), PAL.steel, 0, 0.02, 0);
    add(box(0.072, 0.015, 0.24), PAL.accP, 0, 0.068, 0); // strip pink
    add(box(0.06, 0.07, 0.18), PAL.crate, 0, -0.01, -0.25);
    add(box(0.05, 0.12, 0.06), PAL.palm, 0, -0.05, 0.08, 0.2);
    add(box(0.06, 0.09, 0.16), PAL.crate, 0, 0.01, 0.2);
  } else if (key === 'Kestrel') {
    add(box(0.06, 0.09, 0.34), PAL.steel, 0, 0.03, -0.1);
    add(box(0.062, 0.02, 0.2), PAL.accB, 0, 0.08, -0.1);
    add(cyl(0.02, 0.22), PAL.steel, 0, 0.03, -0.36, Math.PI / 2);
    add(box(0.05, 0.11, 0.06), PAL.palm, 0, -0.04, 0.06, 0.2);
    mag = new THREE.Mesh(box(0.04, 0.13, 0.06), PAL.steel); mag.position.set(0, -0.08, -0.05); mag.rotation.x = 0.15;
  } else if (key === 'VK47') {
    add(box(0.07, 0.1, 0.42), PAL.steel, 0, 0.03, -0.08);
    add(box(0.072, 0.015, 0.3), PAL.accP, 0, 0.085, -0.08);
    add(box(0.012, 0.06, 0.28), PAL.accB, 0.038, 0.03, -0.08);
    add(cyl(0.018, 0.42), PAL.steel, 0, 0.04, -0.48, Math.PI / 2);
    add(box(0.05, 0.06, 0.14), PAL.palm, 0, -0.045, -0.3);
    add(box(0.055, 0.12, 0.06), PAL.palm, 0, -0.045, 0.1, 0.2);
    add(box(0.035, 0.06, 0.08), PAL.crate, 0, 0.01, 0.25);
    add(cyl(0.024, 0.07), PAL.steel, 0, 0.04, -0.68, Math.PI / 2); // muzzle brake
    add(box(0.02, 0.012, 0.03), PAL.steel, 0, 0.055, -0.6); // alas pisir depan
    add(box(0.008, 0.035, 0.01), PAL.steel, 0, 0.075, -0.6); // pisir depan
    add(box(0.03, 0.018, 0.025), PAL.steel, 0, 0.088, 0.06); // pisir belakang
    add(box(0.024, 0.01, 0.2), PAL.steel, 0, 0.065, -0.33); // rel atas
    add(box(0.008, 0.028, 0.014), PAL.steel, 0, -0.015, 0.03, 0.2); // picu
    add(box(0.01, 0.008, 0.05), PAL.steel, 0, -0.035, 0.045); // guard picu
    add(box(0.04, 0.07, 0.015), PAL.palm, 0, 0.01, 0.295); // butt plate
    add(box(0.022, 0.014, 0.03), PAL.steel, 0.042, 0.05, -0.02); // charging handle
    mag = new THREE.Mesh(box(0.045, 0.16, 0.07), PAL.steel); mag.position.set(0, -0.09, -0.08); mag.rotation.x = 0.35;
  } else { // Longbow
    add(cyl(0.014, 0.72), PAL.steel, 0, 0.04, -0.42, Math.PI / 2);
    add(cyl(0.028, 0.2), PAL.palm, 0, 0.1, -0.05, Math.PI / 2);
    add(box(0.06, 0.09, 0.4), PAL.steel, 0, 0.03, -0.05);
    add(box(0.062, 0.015, 0.3), PAL.accB, 0, 0.078, -0.05); // strip biru
    add(box(0.06, 0.09, 0.2), PAL.crate, 0, 0.01, 0.22);
    add(box(0.05, 0.11, 0.06), PAL.palm, 0, -0.04, 0.1, 0.2);
    add(box(0.05, 0.06, 0.12), PAL.palm, 0, -0.04, -0.32);
    mag = new THREE.Mesh(box(0.04, 0.1, 0.06), PAL.steel); mag.position.set(0, -0.08, -0.02); mag.rotation.x = 0.1;
  }
  const g = new THREE.Group();
  g.add(...mergeParts(parts, false));
  if (mag) g.add(mag);
  return { group: g, mag };
}
const VM_CFG = {
  // rhZ/lhZ: posisi tangan agar muka grip/foregrip di z lokal tangan -0,08 (jari membungkus)
  P9: { slim: 0.88, left: 'support', rRot: 0.38, lRot: -0.62, rhZ: 0.07, lhZ: -0.02 },
  Breacher: { slim: 1, left: 'fore', rRot: 0.15, lRot: -0.6, rhZ: 0.13, lhZ: -0.26 },
  Kestrel: { slim: 0.95, left: 'fore', rRot: 0.22, lRot: -0.62, rhZ: 0.11, lhZ: -0.3 },
  VK47: { slim: 1, left: 'fore', rRot: 0.02, lRot: -0.8, wristR: 0.038, wristZ: 0.01, rhZ: 0.15, lhZ: -0.33 },
  Longbow: { slim: 1, left: 'fore', rRot: 0.1, lRot: -0.6, rhZ: 0.15, lhZ: -0.3 },
};
export function buildViewmodel(camera, key) {
  const cfg = VM_CFG[key] || VM_CFG.P9;
  const group = new THREE.Group();
  group.position.set(VB.x, VB.y, VB.z); group.scale.setScalar(VB.s); group.rotation.y = VB.yaw;
  const gun = buildGun(key);
  group.add(gun.group);
  const rh = robotHand(cfg, false, cfg.rRot);
  rh.position.set(0, -0.05, cfg.rhZ); rh.rotation.y = 0; // di tengah grip, jari membungkus
  group.add(rh);
  const lh = robotHand(cfg, true, cfg.lRot);
  if (cfg.left === 'support') { lh.position.set(-0.09, -0.15, cfg.lhZ); lh.rotation.set(0.5, 0.5, cfg.lRot); }
  else { lh.position.set(0, -0.05, cfg.lhZ); lh.rotation.set(0.15, 0, cfg.lRot); }
  group.add(lh);
  return { group, key, mag: gun.mag, kick: 0, lastShot: -99, phase: 0 };
}
export function updateViewmodel(dt, state, vm) {
  const p = state.agents[0];
  const w = p.weapons[p.current];
  if (!w) return;
  if (p.lastShotAt !== vm.lastShot) { vm.lastShot = p.lastShotAt; vm.kick = 1; }
  vm.kick = Math.max(0, vm.kick - dt * 6);
  let dip = 0, tilt = 0, magDrop = 0, ryaw = 0;
  if (p.reloadUntil > state.now) {
    const total = WEAPONS[w.key].reload;
    const prog = 1 - (p.reloadUntil - state.now) / total;
    const s = Math.sin(Math.min(1, Math.max(0, prog)) * Math.PI);
    dip = s * 0.07; tilt = s * 0.45; magDrop = s * 0.09; ryaw = s * 0.5; // v4: putar senjata ke kamera saat reload — tangan terlihat profil, bukan vertikal; dip kecil
  }
  let sw = 0;
  if (state.now < p.switchUntil) {
    const total = WEAPONS[w.key].draw;
    sw = (1 - (p.switchUntil - state.now) / total) * 0.16;
  }
  const bob = Math.hypot(p.vx, p.vz) > 0.5 ? Math.sin(state.now * 9) * 0.005 : 0;
  vm.group.position.set(VB.x, VB.y - dip - sw + bob, VB.z + vm.kick * 0.03);
  vm.group.rotation.x = tilt + vm.kick * 0.05 + 0.06; // senjata nyaris datar: jari tidak foreshorten
  vm.group.rotation.y = VB.yaw + ryaw;
  if (vm.mag) vm.mag.position.y = (vm.mag.userData.y0 ??= vm.mag.position.y) - magDrop;
  void dt;
}
