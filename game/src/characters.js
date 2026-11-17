// EMBERLINE — characters.js. Robot chibi ORIGINAL (5 desain, foto menu Gito).
// Tinggi 1,80 m; kepala kotak 0,30 (1,50-1,80 = zona head sim); torso 0,80-1,50;
// kaki 0-0,80 — hitbox visual cocok dengan zona combat. Muka +X.
// Kelima desain TERBEDAKAN dari ±20 m: warna + siluet + senjata masing-masing.
// R1 kuning bulky + cannon berat; R2 pink telinga kucing; R3 biru leader + antena
// tinggi + chest core; R4 merah bertanduk + jubah merah; R5 hijau visor lebar.
// Pembeda tim = visor/stripe/panel (oranye penyerang, biru defender) di atas warna individu.
// Geometri di-merge per material (8 mesh/robot) agar draw calls rendah.
import * as THREE from 'three';
import { PAL, ACCENT_KEYS, part, mergeParts } from './palette.js';

export const DESIGNS = [
  { name: 'Kuning', accent: 'accY', decor: 'fin', bulk: 1.28, gun: 'cannon' },
  { name: 'Pink', accent: 'accP', decor: 'ears', bulk: 0.85, gun: 'rifle' },
  { name: 'Biru', accent: 'accB', decor: 'antenna', bulk: 1.0, gun: 'rifle' },
  { name: 'Merah', accent: 'accR', decor: 'horn', bulk: 1.06, gun: 'long' },
  { name: 'Hijau', accent: 'accG', decor: 'visor', bulk: 0.9, gun: 'rifle' },
];
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// Satu robot. refs: body (inner, untuk pose mati), legL/R, armL/R, beep, pack.
export function buildRobot(designIdx, team) {
  const P = PAL, d = DESIGNS[designIdx % DESIGNS.length];
  const acc = P[d.accent], visor = team === 'atk' ? P.neonO : P.neonB;
  const bk = d.bulk; // lebar badan per desain (R1 paling gemuk)
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body); g.userData = { deadT: 0, phase: Math.random() * 6, fallSide: designIdx % 2 ? 1 : -1 };
  // kaki (pivot di pinggul y 0,50; ayun rotasi z) — lebar ikut bulk (R1 chunky)
  const mkLeg = (z) => {
    const piv = new THREE.Group(); piv.position.set(0, 0.5, z);
    piv.add(...mergeParts([part(B(0.2 * bk, 0.5, 0.16 * bk), P.wall, 0, -0.25, 0), part(B(0.21 * bk, 0.08, 0.17 * bk), acc, 0, -0.46, 0)], false));
    body.add(piv); return piv;
  };
  const legL = mkLeg(0.13 * bk), legR = mkLeg(-0.13 * bk);
  // badan: torso + panel dada tim (besar, menyala) + visor mata tim + stripe bahu tim
  const bp = [
    part(B(0.5, 0.55, 0.44 * bk), P.wall, 0, 1.05, 0),
    part(B(0.08, 0.34, 0.34 * bk), visor, 0.26, 1.05, 0), // panel dada tim
    part(B(0.1, 0.14, 0.14), visor, 0.28, 1.05, 0), // chest core tim menyala
    part(B(0.52, 0.1, 0.1), visor, 0, 1.32, 0.17 * bk),
    part(B(0.52, 0.1, 0.1), visor, 0, 1.32, -0.17 * bk),
    part(B(0.3, 0.3, 0.3), P.wall, 0, 1.65, 0),
    part(B(0.18, 0.24, 0.18), P.steel, 0, 1.42, 0), // leher: sambung torso (1,33) ke kepala (1,50), jangan melayang
    part(B(0.32, 0.14, 0.32), acc, 0, 1.8, 0), // helm aksen warna individu (terbaca dari jauh)
    part(B(0.05, 0.12, 0.26), visor, 0.16, 1.66, 0), // visor mata tim (lebar)
    part(B(0.2, 0.12, 0.2), acc, 0, 1.36, 0.18 * bk), // shoulder pad aksen
    part(B(0.2, 0.12, 0.2), acc, 0, 1.36, -0.18 * bk),
  ];
  // dekor siluet per desain (terbaca dari jauh)
  if (d.decor === 'fin') { // R1: fin helm besar + pelat bahu kuning
    bp.push(part(B(0.4, 0.12, 0.06), acc, 0, 1.86, 0));
    bp.push(part(B(0.1, 0.2, 0.46 * bk), acc, 0, 1.3, 0));
  }
  if (d.decor === 'ears') { // R2: telinga kucing besar
    bp.push(part(B(0.1, 0.17, 0.1), acc, 0, 1.88, 0.11), part(B(0.1, 0.17, 0.1), acc, 0, 1.88, -0.11));
    bp.push(part(B(0.05, 0.1, 0.2), acc, 0.16, 1.66, 0)); // mata pink
  }
  if (d.decor === 'antenna') { // R3 leader: antena tinggi + bola + fin dada
    bp.push(part(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 6), P.steel, 0, 1.95, 0));
    bp.push(part(new THREE.SphereGeometry(0.06, 8, 6), acc, 0, 2.12, 0));
    bp.push(part(B(0.06, 0.2, 0.3), acc, 0.26, 1.05, 0)); // core biru vertikal
  }
  if (d.decor === 'horn') { // R4: tanduk + jubah merah mengalir
    bp.push(part(new THREE.ConeGeometry(0.06, 0.2, 6), acc, 0, 1.87, 0.12, -0.5));
    bp.push(part(new THREE.ConeGeometry(0.06, 0.2, 6), acc, 0, 1.87, -0.12, 0.5));
    bp.push(part(B(0.06, 0.72, 0.5), acc, -0.3, 1.02, 0)); // jubah belakang
    bp.push(part(B(0.34, 0.1, 0.34), acc, 0, 1.38, 0)); // syal
  }
  if (d.decor === 'visor') bp.push(part(B(0.06, 0.06, 0.4), acc, 0.16, 1.74, 0)); // R5: visor hijau lebar
  // lengan kotak menunjuk ke depan (+X), menyatu dengan badan (statis; ayun jalan hanya kaki)
  bp.push(part(B(0.42, 0.14, 0.14), P.wall, 0.3, 1.23, 0.28 * bk, 0, 0, -0.25));
  bp.push(part(B(0.42, 0.14, 0.14), P.wall, 0.3, 1.23, -0.28 * bk, 0, 0, -0.25));
  bp.push(part(B(0.1, 0.15, 0.15), acc, 0.48, 1.18, 0.28 * bk));
  bp.push(part(B(0.1, 0.15, 0.15), acc, 0.48, 1.18, -0.28 * bk));
  // SENJATA di tangan (terlihat, bukan tangan kosong) — per desain
  if (d.gun === 'cannon') { // R1: cannon berat
    bp.push(part(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8).rotateZ(Math.PI / 2), P.steel, 0.5, 1.15, 0));
    bp.push(part(B(0.22, 0.18, 0.18), P.palm, 0.3, 1.15, 0));
    bp.push(part(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 8).rotateZ(Math.PI / 2), acc, 0.76, 1.15, 0));
  } else if (d.gun === 'long') { // R4: rifle panjang
    bp.push(part(B(0.92, 0.08, 0.06), P.steel, 0.5, 1.15, 0));
    bp.push(part(B(0.14, 0.1, 0.08), acc, 0.9, 1.15, 0));
    bp.push(part(B(0.1, 0.16, 0.1), P.palm, 0.28, 1.12, 0));
  } else { // rifle standar (R2/R3/R5)
    bp.push(part(B(0.72, 0.09, 0.07), P.steel, 0.48, 1.15, 0));
    bp.push(part(B(0.12, 0.11, 0.09), acc, 0.82, 1.15, 0));
    bp.push(part(B(0.08, 0.14, 0.08), P.palm, 0.3, 1.12, 0));
  }
  const bodyMeshes = mergeParts(bp, false);
  bodyMeshes[0].castShadow = true; // hanya mesh dinding badan yang melempar bayangan
  body.add(...bodyMeshes);
  // ransel pembawa bom (mesh sendiri agar bisa disembunyikan) + lampu beep
  const pack = new THREE.Mesh(B(0.12, 0.34, 0.3), P.steel);
  pack.position.set(-0.3, 1.1, 0); pack.visible = false; pack.castShadow = true; body.add(pack);
  const beep = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), P.flash);
  beep.position.set(-0.37, 1.32, 0); beep.visible = false; body.add(beep);
  return { group: g, body, legL, legR, pack, beep };
}
// Drone kecil melayang (foto menu, tengah atas): bundar berwajah, biru/putih.
// refs: group (bob di render), eyeL/eyeR.
export function buildDrone() {
  const P = PAL;
  const g = new THREE.Group();
  const parts = [
    part(new THREE.SphereGeometry(0.22, 12, 10), P.wall, 0, 0, 0),
    part(B(0.3, 0.06, 0.06), P.neonB, 0, 0.02, 0.2),
    part(new THREE.SphereGeometry(0.045, 8, 6), P.neonB, -0.07, 0.05, 0.19),
    part(new THREE.SphereGeometry(0.045, 8, 6), P.neonB, 0.07, 0.05, 0.19),
    part(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 10), P.steel, 0, 0.24, 0),
    part(B(0.1, 0.08, 0.1), P.accB, 0, -0.2, 0),
  ];
  g.add(...mergeParts(parts, false));
  return { group: g };
}
// Update per frame: posisi/yaw, walk cycle sinus, pose mati (jatuh 0,4 dtk lalu sembunyi 2 dtk).
export function updateRobot(r, a, dt, now) {
  const g = r.group, u = g.userData;
  g.position.set(a.x, a.y, a.z);
  g.rotation.y = -a.yaw;
  if (!a.alive) {
    u.deadT += dt;
    const k = Math.min(1, u.deadT / 0.4);
    r.body.rotation.z = k * Math.PI * 0.5 * u.fallSide;
    r.body.position.y = -k * 0.25;
    if (u.deadT > 2.4) g.visible = false;
    return;
  }
  g.visible = true; u.deadT = 0; r.body.rotation.z = 0; r.body.position.y = 0;
  const spd = Math.hypot(a.vx, a.vz);
  u.phase += dt * (2 + spd * 1.6);
  const sw = spd > 0.4 ? Math.sin(u.phase) * 0.5 : 0;
  r.legL.rotation.z = sw; r.legR.rotation.z = -sw;
  r.beep.visible = r.pack.visible && Math.floor(now * 3) % 2 === 0;
}
export { ACCENT_KEYS };
