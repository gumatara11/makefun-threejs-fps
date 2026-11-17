import * as THREE from 'three';
import { PAL, part, mergeParts } from './palette.js';
const DESIGNS = [
  { name: 'Kuning', accent: 'accY', decor: 'fin', bulk: 1.28, gun: 'cannon' },
  { name: 'Pink', accent: 'accP', decor: 'ears', bulk: 0.85, gun: 'rifle' },
  { name: 'Biru', accent: 'accB', decor: 'antenna', bulk: 1.0, gun: 'rifle' },
  { name: 'Merah', accent: 'accR', decor: 'horn', bulk: 1.06, gun: 'long' },
  { name: 'Hijau', accent: 'accG', decor: 'visor', bulk: 0.9, gun: 'rifle' },
];
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const M = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => part(B(w, h, d), PAL.palm, x, y, z, rx, ry, rz);
const C = (g, m, x, y, z, rx = 0, ry = 0, rz = 0) => part(g, m, x, y, z, rx, ry, rz);
const CYL = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const SPH = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
const SS = (r, sx, sy, sz) => new THREE.SphereGeometry(r, 10, 8).scale(sx, sy, sz);
const CON = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
export function buildRobot(designIdx, team) {
  const P = PAL, d = DESIGNS[designIdx % DESIGNS.length];
  const acc = P[d.accent], visor = team === 'atk' ? P.neonO : P.neonB;
  const bk = d.bulk;
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body); g.userData = { deadT: 0, phase: Math.random() * 6, fallSide: designIdx % 2 ? 1 : -1 };
  const a = (w, h, dd, x, y, z, rx = 0, ry = 0, rz = 0) => part(B(w, h, dd), acc, x, y, z, rx, ry, rz);
  const v = (w, h, dd, x, y, z, rx = 0, ry = 0, rz = 0) => part(B(w, h, dd), visor, x, y, z, rx, ry, rz);
  const mkLeg = (z) => {
    const piv = new THREE.Group(); piv.position.set(0, 0.5, z);
    piv.add(...mergeParts([
      C(CYL(0.11 * bk, 0.085 * bk, 0.3, 8), P.wall, 0, -0.11, 0),
      C(SPH(0.09 * bk), acc, 0, -0.28, 0),
      C(CYL(0.08 * bk, 0.065 * bk, 0.2, 8), P.wall, 0, -0.4, 0),
      C(SPH(0.06 * bk), acc, 0.06, -0.34, 0),
      C(SS(0.13 * bk, 1.15, 0.5, 0.95), acc, 0.03, -0.435, 0),
    ], false));
    body.add(piv); return piv;
  };
  const legL = mkLeg(0.13 * bk), legR = mkLeg(-0.13 * bk);
  const bp = [
    C(CYL(0.13 + 0.1 * bk, 0.11 + 0.08 * bk, 0.36, 8), P.wall, 0, 1.16, 0),
    C(CYL(0.09 + 0.07 * bk, 0.08 + 0.06 * bk, 0.28, 8), P.wall, 0, 0.86, 0),
    C(SPH(0.21), acc, 0.15, 1.16, 0),
    C(CYL(0.2, 0.2, 0.08, 8), acc, 0, 0.94, 0),
    C(new THREE.TorusGeometry(0.11 + 0.09 * bk, 0.032, 6, 12).rotateX(Math.PI / 2), P.steel, 0, 0.98, 0),
    C(SS(0.2, 0.55, 1.05, 1), P.steel, -0.17, 1.1, 0),
    C(CYL(0.025, 0.025, 0.5, 8), P.steel, 0.24, 1.08, 0.19 * bk),
    C(CYL(0.025, 0.025, 0.5, 8), P.steel, 0.24, 1.08, -0.19 * bk),
    C(CYL(0.17, 0.19, 0.07, 10), P.steel, 0, 1.44, 0),
    C(CYL(0.12 + 0.08 * bk, 0.12 + 0.08 * bk, 0.08, 8), acc, 0, 0.84, 0),
    C(CYL(0.12 + 0.09 * bk, 0.1 + 0.08 * bk, 0.2, 8), P.wall, 0, 0.68, 0),
    a(0.1, 0.14, 0.1, 0, 0.68, 0.2 * bk),
    a(0.1, 0.14, 0.1, 0, 0.68, -0.2 * bk),
    v(0.04, 0.2, 0.05, 0.33, 1.2, 0),
    v(0.05, 0.1, 0.1, 0.32, 1.2, 0),
    C(CYL(0.09, 0.09, 0.1), P.steel, 0, 0.56, 0.13 * bk, Math.PI / 2),
    C(CYL(0.09, 0.09, 0.1), P.steel, 0, 0.56, -0.13 * bk, Math.PI / 2),
    C(SPH(0.17), P.wall, 0, 1.65, 0),
    C(CYL(0.07, 0.09, 0.22, 8), acc, 0, 1.43, 0),
    C(CYL(0.12, 0.145, 0.07, 10), acc, 0, 1.5, 0),
    C(new THREE.SphereGeometry(0.178, 10, 6, 0, 6.29, 0, 1.1), acc, 0, 1.65, 0),
    C(SS(0.172, 0.5, 0.92, 0.92), P.palm, 0.1, 1.65, 0),
    C(CYL(0.065, 0.065, 0.025, 12).rotateZ(Math.PI / 2), visor, 0.19, 1.67, 0.085),
    C(CYL(0.065, 0.065, 0.025, 12).rotateZ(Math.PI / 2), visor, 0.19, 1.67, -0.085),
    C(CYL(0.018, 0.018, 0.12, 6), P.palm, 0.19, 1.65, 0),
  ];
  for (const s of [1, -1]) {
    bp.push(C(CYL(0.11, 0.16, 0.14), acc, 0, 1.42, s * 0.24 * bk, Math.PI / 2));
    bp.push(C(CYL(0.145, 0.145, 0.03), P.steel, 0, 1.4, s * 0.185 * bk, Math.PI / 2));
    bp.push(C(SPH(0.13), acc, 0, 1.46, s * 0.24 * bk));
    bp.push(C(CYL(0.06, 0.075, 0.32, 8), acc, 0.18, 1.32, s * 0.21 * bk, 0, s * 0.25, -2.5));
    bp.push(C(SPH(0.07), acc, 0.32, 1.19, s * 0.18 * bk));
    bp.push(C(CYL(0.065, 0.05, 0.26, 8), P.steel, 0.42, 1.15, s * 0.11 * bk, 0, s * 0.25, -1.35));
    bp.push(C(SPH(0.072), P.palm, 0.5, 1.14, s * 0.06 * bk));
  }
  if (d.decor === 'fin') {
    bp.push(C(SS(0.17, 1.25, 0.42, 0.32), acc, 0, 1.85, 0));
    bp.push(C(SPH(0.11), acc, 0.2, 1.36, 0));
  }
  if (d.decor === 'ears') {
    bp.push(C(CON(0.075, 0.22, 6), acc, 0, 1.9, 0.11, 0.3, 0, 0), C(CON(0.075, 0.22, 6), acc, 0, 1.9, -0.11, -0.3, 0, 0));
  }
  if (d.decor === 'antenna') {
    bp.push(C(CYL(0.018, 0.018, 0.3, 6), P.steel, 0, 1.95, 0));
    bp.push(C(SPH(0.06, 8, 6), acc, 0, 2.12, 0));
    bp.push(a(0.06, 0.2, 0.3, 0.26, 1.05, 0));
  }
  if (d.decor === 'horn') {
    bp.push(C(CON(0.07, 0.24), acc, 0, 1.87, 0.12, -0.5));
    bp.push(C(CON(0.07, 0.24), acc, 0, 1.87, -0.12, 0.5));
    bp.push(a(0.06, 0.72, 0.5, -0.3, 1.02, 0));
    bp.push(a(0.34, 0.1, 0.34, 0, 1.38, 0));
  }
  if (d.decor === 'visor') { bp.push(C(CYL(0.028, 0.028, 0.3, 8).rotateX(Math.PI / 2), acc, 0.16, 1.74, 0)); bp.push(C(CYL(0.025, 0.025, 0.24, 8).rotateX(Math.PI / 2), acc, 0.16, 1.56, 0)); }
  if (d.gun === 'cannon') {
    bp.push(C(CYL(0.09, 0.09, 0.5).rotateZ(Math.PI / 2), P.steel, 0.5, 1.15, 0));
    bp.push(a(0.26, 0.2, 0.2, 0.3, 1.15, 0));
    bp.push(C(CYL(0.1, 0.1, 0.06).rotateZ(Math.PI / 2), acc, 0.76, 1.15, 0));
    bp.push(C(CYL(0.1, 0.1, 0.05).rotateZ(Math.PI / 2), acc, 0.26, 1.15, 0));
  } else if (d.gun === 'long') {
    bp.push(a(0.42, 0.11, 0.09, 0.32, 1.15, 0));
    bp.push(C(CYL(0.028, 0.028, 0.5, 8).rotateZ(Math.PI / 2), P.steel, 0.72, 1.15, 0));
    bp.push(C(CYL(0.05, 0.05, 0.05, 8).rotateZ(Math.PI / 2), acc, 0.95, 1.15, 0));
    bp.push(a(0.09, 0.16, 0.07, 0.42, 1.04, 0, 0, 0, 0.18));
    bp.push(a(0.2, 0.04, 0.05, 0.5, 1.23, 0));
    bp.push(C(CYL(0.03, 0.03, 0.2, 8).rotateZ(Math.PI / 2), P.steel, 0.5, 1.27, 0));
    bp.push(a(0.16, 0.1, 0.08, 0.02, 1.15, 0));
    bp.push(M(0.1, 0.16, 0.1, 0.28, 1.12, 0));
  } else {
    bp.push(a(0.4, 0.11, 0.09, 0.3, 1.15, 0));
    bp.push(C(CYL(0.028, 0.028, 0.36, 8).rotateZ(Math.PI / 2), P.steel, 0.66, 1.15, 0));
    bp.push(C(CYL(0.05, 0.05, 0.05, 8).rotateZ(Math.PI / 2), acc, 0.83, 1.15, 0));
    bp.push(a(0.09, 0.15, 0.07, 0.38, 1.05, 0, 0, 0, 0.18));
    bp.push(a(0.06, 0.05, 0.05, 0.5, 1.23, 0));
    bp.push(a(0.16, 0.1, 0.08, 0.0, 1.15, 0));
    bp.push(M(0.08, 0.14, 0.08, 0.3, 1.12, 0));
  }
  const bodyMeshes = mergeParts(bp, false);
  bodyMeshes[0].castShadow = true;
  body.add(...bodyMeshes);
  const pack = new THREE.Mesh(B(0.12, 0.34, 0.3), P.steel);
  pack.position.set(-0.3, 1.1, 0); pack.visible = false; pack.castShadow = true; body.add(pack);
  const beep = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), P.flash);
  beep.position.set(-0.37, 1.32, 0); beep.visible = false; body.add(beep);
  return { group: g, body, legL, legR, pack, beep };
}
export function buildDrone() {
  const P = PAL;
  const g = new THREE.Group();
  const parts = [
    C(SPH(0.22, 12, 10), P.wall, 0, 0, 0),
    part(B(0.3, 0.06, 0.06), P.neonB, 0, 0.02, 0.2),
    C(SPH(0.045, 8, 6), P.neonB, -0.07, 0.05, 0.19),
    C(SPH(0.045, 8, 6), P.neonB, 0.07, 0.05, 0.19),
    C(CYL(0.16, 0.16, 0.02, 10), P.steel, 0, 0.24, 0),
    part(B(0.1, 0.08, 0.1), P.accB, 0, -0.2, 0),
  ];
  g.add(...mergeParts(parts, false));
  return { group: g };
}
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
  const sw = spd > 0.4 ? Math.sin(u.phase) * 0.28 : 0;
  r.legL.rotation.z = sw; r.legR.rotation.z = -sw;
  r.beep.visible = r.pack.visible && Math.floor(now * 3) % 2 === 0;
}
