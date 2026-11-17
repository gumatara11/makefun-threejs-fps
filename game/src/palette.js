// EMBERLINE — palette.js. Satu palet material terang (<=24 unik, dipakai
// render/characters/viewmodel bersama agar hitungan material tetap di bawah cap).
import * as THREE from '../vendor/three/three.module.min.js';

export function makePalette() {
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0.05, ...o });
  const bas = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });
  return {
    ground: std(0xd8e2e8), wall: std(0xf2f5f6), trimC: std(0x19c8e8, { emissive: 0x0a5a6a, emissiveIntensity: 0.4 }),
    trimM: std(0xe84fa8, { emissive: 0x5a0a3a, emissiveIntensity: 0.35 }),
    contR: std(0xd8433a), crate: std(0xc9a06a), tankB: std(0x2f7fd0),
    pipe: std(0x8a939c, { metalness: 0.6, roughness: 0.4 }),
    steel: std(0x3a4046, { metalness: 0.5, roughness: 0.5 }),
    neonO: bas(0xff7a1a), neonB: bas(0x2f9dff),
    sakura: std(0xf9b1cd, { emissive: 0x8a2440, emissiveIntensity: 0.5 }), trunk: std(0x7a5230),
    smoke: bas(0xe8e8e8, { transparent: true, opacity: 0.55 }),
    cloud: bas(0xffffff),
    flash: bas(0xffe08a),
    accY: std(0xf2c200), accP: std(0xf27fb0), accB: std(0x2f9dff), accR: std(0xe83a2f), accG: std(0x3ec96a),
    hand: std(0xdfe3e6, { metalness: 0.55, roughness: 0.35 }),
    palm: std(0x2a2d30, { metalness: 0.3, roughness: 0.6 }),
    fold: std(0x3d2c17),
  };
}
// Gabung banyak geometri per material -> sedikit Mesh (draw calls rendah).
export function part(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
  return { geo, mat, mtx: m };
}
export function mergeParts(parts, shadow = true) {
  const byMat = new Map();
  for (const p of parts) {
    const g = p.geo.clone().applyMatrix4(p.mtx);
    if (!byMat.has(p.mat)) byMat.set(p.mat, []);
    byMat.get(p.mat).push(g);
  }
  const out = [];
  for (const [mat, geos] of byMat) {
    let vc = 0, ic = 0;
    for (const g of geos) { vc += g.attributes.position.count; ic += g.index.count; }
    const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2);
    const idx = new Uint32Array(ic);
    let vo = 0, io = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, vo * 3);
      nor.set(g.attributes.normal.array, vo * 3);
      uv.set(g.attributes.uv.array, vo * 2);
      const gi = g.index.array;
      for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
      vo += g.attributes.position.count; io += gi.length;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; out.push(m);
  }
  return out;
}
// Singleton: satu instans material dipakai render/characters/viewmodel bersama.
export const PAL = makePalette();
