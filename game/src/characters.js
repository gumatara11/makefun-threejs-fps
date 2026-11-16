// EMBERLINE — characters.js. Robot chibi ORIGINAL (5 desain spec §1).
// Tinggi 1,80 m; kepala kotak 0,30 (1,50-1,80 = zona head sim); torso 0,80-1,50;
// kaki 0-0,80 — hitbox visual cocok dengan zona combat. Muka +X.
// Geometri di-merge per material (8 mesh/robot) agar draw calls rendah.
import * as THREE from 'three';
import { PAL, ACCENT_KEYS, part, mergeParts } from './palette.js';

export const DESIGNS = [
  { name: 'Kuning', accent: 'accY', decor: 'fin' },
  { name: 'Pink', accent: 'accP', decor: 'ears' },
  { name: 'Biru', accent: 'accB', decor: 'antenna' },
  { name: 'Merah', accent: 'accR', decor: 'horn' },
  { name: 'Hijau', accent: 'accG', decor: 'visor' },
];
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// Satu robot. refs: body (inner, untuk pose mati), legL/R, armL/R, beep, pack.
export function buildRobot(designIdx, team) {
  const P = PAL, d = DESIGNS[designIdx % DESIGNS.length];
  const acc = P[d.accent], visor = team === 'atk' ? P.neonO : P.neonB;
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body); g.userData = { deadT: 0, phase: Math.random() * 6, fallSide: designIdx % 2 ? 1 : -1 };
  // kaki (pivot di pinggul y 0,50; ayun rotasi z) — 1 mesh/kaki (tanpa shadow)
  const mkLeg = (z) => {
    const piv = new THREE.Group(); piv.position.set(0, 0.5, z);
    piv.add(...mergeParts([part(B(0.2, 0.5, 0.16), P.wall, 0, -0.25, 0), part(B(0.21, 0.08, 0.17), P.wall, 0, -0.46, 0)], false));
    body.add(piv); return piv;
  };
  const legL = mkLeg(0.13), legR = mkLeg(-0.13);
  // badan statis: torso + kepala + dekor + senjata + ransel, merge per material
  const bp = [
    part(B(0.5, 0.55, 0.44), P.wall, 0, 1.05, 0),
    part(B(0.06, 0.3, 0.3), visor, 0.26, 1.05, 0),
    part(B(0.52, 0.07, 0.1), visor, 0, 1.32, 0.17),
    part(B(0.52, 0.07, 0.1), visor, 0, 1.32, -0.17),
    part(B(0.3, 0.3, 0.3), P.wall, 0, 1.65, 0),
    part(B(0.04, 0.09, 0.24), visor, 0.16, 1.66, 0),
    part(B(0.5, 0.09, 0.07), P.steel, 0.42, 1.12, 0), // senjata di tangan
  ];
  if (d.decor === 'fin') bp.push(part(B(0.34, 0.1, 0.05), acc, 0, 1.84, 0));
  if (d.decor === 'ears') { bp.push(part(B(0.08, 0.12, 0.08), acc, 0, 1.86, 0.1), part(B(0.08, 0.12, 0.08), acc, 0, 1.86, -0.1)); }
  if (d.decor === 'antenna') {
    bp.push(part(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 6), P.steel, 0, 1.88, 0));
    bp.push(part(new THREE.SphereGeometry(0.045, 8, 6), acc, 0, 1.97, 0));
  }
  if (d.decor === 'horn') {
    bp.push(part(new THREE.ConeGeometry(0.05, 0.16, 6), acc, 0, 1.85, 0.11, -0.5));
    bp.push(part(new THREE.ConeGeometry(0.05, 0.16, 6), acc, 0, 1.85, -0.11, 0.5));
    bp.push(part(B(0.32, 0.09, 0.32), acc, 0, 1.38, 0)); // syal
  }
  if (d.decor === 'visor') bp.push(part(B(0.05, 0.05, 0.34), acc, 0.16, 1.74, 0));
  // lengan kotak menunjuk ke depan (+X), menyatu dengan badan (statis; ayun jalan hanya kaki)
  bp.push(part(B(0.42, 0.14, 0.14), P.wall, 0.3, 1.23, 0.28, 0, 0, -0.25));
  bp.push(part(B(0.42, 0.14, 0.14), P.wall, 0.3, 1.23, -0.28, 0, 0, -0.25));
  bp.push(part(B(0.1, 0.15, 0.15), acc, 0.48, 1.18, 0.28));
  bp.push(part(B(0.1, 0.15, 0.15), acc, 0.48, 1.18, -0.28));
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
