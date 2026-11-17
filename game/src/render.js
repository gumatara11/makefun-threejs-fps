// EMBERLINE — render.js. Kota anime TERANG spec §1, geometri DARI world.js SOLIDS
// (bukan angka spec) agar render == collider sim. InstancedMesh per kelas material.
import * as THREE from '../vendor/three/three.module.min.js';
import { SOLIDS, DOOR_PANEL, NODES, LINKS, ZONES } from './world.js';
import { PAL, part, mergeParts } from './palette.js';
import { buildRobot, buildDrone, updateRobot } from './characters.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function classify(s) {
  const w = s.maxX - s.minX, d = s.maxZ - s.minZ, h = s.maxY - s.minY;
  if (s.minY >= 2.6) return 'wall';
  if (h === 2.6 && w >= 5.9) return 'contR';
  if (w === 1.2 && d === 1.2 && h === 1.2) return 'crate';
  if (w === 3 && d === 3 && h === 3) return 'tankB';
  if (h === 1.0) return 'crate';
  if (w === 1 && d === 1 && h === 3) return 'pipe';
  return 'wall';
}
function instanced(scene, mat, list) {
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, Math.max(1, list.length));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  list.forEach((s, i) => {
    p.set((s.minX + s.maxX) / 2, (s.minY + s.maxY) / 2, (s.minZ + s.maxZ) / 2);
    sc.set(s.maxX - s.minX, s.maxY - s.minY, s.maxZ - s.minZ);
    m.compose(p, q, sc); im.setMatrixAt(i, m);
  });
  im.castShadow = true; im.receiveShadow = true; scene.add(im); return im;
}
function letter(scene, mat, x, z, isA) {
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const parts = [];
  const add = (w, h, d, px, py, pz, rz = 0) => parts.push(part(B(w, h, d), mat, px, py, pz, 0, 0, rz));
  if (isA) { add(0.3, 4.4, 0.3, -0.9, 2.2, 0, 0.42); add(0.3, 4.4, 0.3, 0.9, 2.2, 0, -0.42); add(1.6, 0.3, 0.3, 0, 1.6, 0); }
  else { add(0.3, 4.4, 0.3, -0.8, 2.2, 0); add(1.4, 0.3, 0.3, 0, 4.1, 0); add(1.4, 0.3, 0.3, 0, 2.2, 0); add(1.4, 0.3, 0.3, 0, 0.3, 0); add(0.3, 1.9, 0.3, 0.7, 3.15, 0); add(0.3, 1.9, 0.3, 0.7, 1.25, 0); }
  const g = new THREE.Group();
  g.add(...mergeParts(parts, false));
  g.position.set(x, 0, z); g.rotation.y = Math.PI / 2; scene.add(g);
}
export function createRender(canvas) {
  const P = PAL;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(1280, 800);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ec9ee);
  scene.fog = new THREE.Fog(0xcfe8f5, 25, 70);
  const camera = new THREE.PerspectiveCamera(74, 1280 / 800, 0.05, 200);
  camera.rotation.order = 'YXZ'; scene.add(camera);
  // cahaya: 1 dir berbayang 2048 + 1 hemi + 3 point interior/tunnel + 1 muzzle = 6
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
  sun.position.set(20, 42, -6); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, far: 120 });
  scene.add(sun); scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x9a8a68, 0.95));
  const pt = (x, y, z, c) => { const l = new THREE.PointLight(c, 14, 16, 1.6); l.position.set(x, y, z); scene.add(l); return l; };
  pt(62, 2.8, 38, 0xffd9a0); pt(62, 2.8, 10, 0x9fd4ff); pt(30, 2.2, 25, 0x9ff5e8);
  const muzzleLight = new THREE.PointLight(0xffc860, 0, 9, 2); scene.add(muzzleLight);
  // --- lantai + marka ---
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(72, 48), P.ground);
  ground.rotation.x = -Math.PI / 2; ground.position.set(36, 0, 24); ground.receiveShadow = true; scene.add(ground);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(110, 86), P.crate);
  apron.rotation.x = -Math.PI / 2; apron.position.set(36, -0.05, 24); scene.add(apron);
  const mark = (x0, z0, x1, z1) => { // garis lantai (marka / zona site)
    const w = Math.abs(x1 - x0) || 0.18, d = Math.abs(z1 - z0) || 0.18;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), P.accY);
    m.position.set((x0 + x1) / 2, 0.01, (z0 + z1) / 2); scene.add(m);
  };
  for (let x = 12; x < 56; x += 6) { mark(x, 39.9, x + 3, 40.1); mark(x, 24.9, x + 3, 25.1); mark(x, 9.9, x + 3, 10.1); }
  // garis zona plant oranye / biru
  const zoneLine = (z, mat) => {
    const mk = (x0, z0, x1, z1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0) || 0.15, 0.02, Math.abs(z1 - z0) || 0.15), mat); m.position.set((x0 + x1) / 2, 0.02, (z0 + z1) / 2); scene.add(m); };
    mk(z.x0, z.z0, z.x1, z.z0); mk(z.x0, z.z1, z.x1, z.z1); mk(z.x0, z.z0, z.x0, z.z1); mk(z.x1, z.z0, z.x1, z.z1);
  };
  zoneLine(ZONES.plantA, P.neonO); zoneLine(ZONES.plantB, P.neonB);
  // --- solids dari world.js, dikelompokkan per material ---
  const byClass = {};
  for (const s of SOLIDS) (byClass[classify(s)] ??= []).push(s);
  for (const [k, list] of Object.entries(byClass)) instanced(scene, P[k], list);
  // trim neon di atas dinding perimeter (visual)
  const trim = (x0, z0, x1, z1, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0) || 0.2, 0.18, Math.abs(z1 - z0) || 0.2), mat);
    m.position.set((x0 + x1) / 2, 5.05, (z0 + z1) / 2); scene.add(m);
  };
  trim(0, 0, 72, 0, P.trimC); trim(0, 48, 72, 48, P.trimM); trim(0, 0, 0, 48, P.trimC); trim(72, 0, 72, 48, P.trimM);
  // trim neon di atas dinding lane interior (pecah dinding abu-abu polos)
  const laneTrim = [];
  laneTrim.push(part(new THREE.BoxGeometry(18, 0.18, 0.2), P.trimC, 19, 3.3, 35.75));
  laneTrim.push(part(new THREE.BoxGeometry(14, 0.18, 0.2), P.trimC, 39, 3.3, 35.75));
  laneTrim.push(part(new THREE.BoxGeometry(6, 0.18, 0.2), P.trimC, 53, 3.3, 35.75));
  laneTrim.push(part(new THREE.BoxGeometry(18, 0.18, 0.2), P.trimM, 19, 3.3, 14.25));
  laneTrim.push(part(new THREE.BoxGeometry(14, 0.18, 0.2), P.trimM, 39, 3.3, 14.25));
  laneTrim.push(part(new THREE.BoxGeometry(6, 0.18, 0.2), P.trimM, 53, 3.3, 14.25));
  scene.add(...mergeParts(laneTrim, false));
  // huruf site + atap interior (visual, tanpa shadow) + lampu gantung
  // huruf site PUTIH BESAR (foto map: A putih di kontainer merah, B putih di biru)
  letter(scene, P.wall, 68, 38, true); letter(scene, P.wall, 68, 10, false);
  const roof = (x, z, w, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), P.wall); m.position.set(x, 3.4, z); scene.add(m); };
  roof(62.5, 38, 13, 12); roof(62.5, 10, 13, 12);
  const lampParts = [];
  const lamp = (x, z) => lampParts.push(part(new THREE.BoxGeometry(0.5, 0.08, 0.5), P.flash, x, 3.1, z));
  lamp(60, 36); lamp(65, 40); lamp(60, 8); lamp(65, 12);
  scene.add(...mergeParts(lampParts, false));
  // --- sakura: batang + canopy instanced; awan putih ---
  const trees = [[12, 46], [24, 46], [48, 46], [60, 46], [12, 2], [36, 2], [60, 2], [6, 33], [6, 15], [20, 32], [40, 32], [20, 16], [40, 16]];
  const trunkIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.2, 1.8, 6), P.trunk, trees.length);
  const canIM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.15, 0), P.sakura, trees.length * 3);
  const cloudIM = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), P.flash, 6); // awan PUTIH terang (basic, tak berbayang)
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    trees.forEach((t, i) => {
      m.compose(V3(t[0], 0.9, t[1]), q, V3(1, 1, 1)); trunkIM.setMatrixAt(i, m);
      for (let k = 0; k < 3; k++) {
        e.set(0, 0, 0); q.setFromEuler(e);
        m.compose(V3(t[0] + (k - 1) * 0.7, 2.1 + (k % 2) * 0.5, t[1] + (k === 1 ? 0.5 : -0.3)), q, V3(1, 0.75, 1));
        canIM.setMatrixAt(i * 3 + k, m);
      }
    });
    [[10, 18, -14], [30, 22, -18], [55, 16, -12], [20, 20, 58], [50, 18, 56], [68, 24, 20]].forEach((c, i) => {
      m.compose(V3(c[0], c[1], c[2]), q, V3(4, 1.2, 2.2)); cloudIM.setMatrixAt(i, m);
    });
  }
  trunkIM.castShadow = canIM.castShadow = true;
  scene.add(trunkIM, canIM, cloudIM);
  // kelopak di tanah + planter + bangku + skuter + hazard + zebra + genangan (visual saja)
  const srand = (() => { let a = 1234567; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const gp = [];
  for (let i = 0; i < 46; i++) { // kelopak pink diam di tanah
    const x = 4 + srand() * 64, z = 3 + srand() * 42;
    gp.push(part(new THREE.PlaneGeometry(0.22, 0.14).rotateX(-Math.PI / 2).rotateY(srand() * 6.28), P.sakura, x, 0.02, z));
  }
  const planterAt = (x, z) => {
    gp.push(part(new THREE.BoxGeometry(1.6, 0.5, 0.7), P.crate, x, 0.25, z));
    gp.push(part(new THREE.BoxGeometry(1.5, 0.25, 0.6), P.accG, x, 0.6, z));
  };
  planterAt(36, 46.5); planterAt(36, 1.5); planterAt(3, 25); planterAt(69, 25);
  const benchAt = (x, z) => {
    gp.push(part(new THREE.BoxGeometry(1.8, 0.08, 0.5), P.crate, x, 0.45, z));
    gp.push(part(new THREE.BoxGeometry(0.08, 0.45, 0.45), P.steel, x - 0.7, 0.22, z));
    gp.push(part(new THREE.BoxGeometry(0.08, 0.45, 0.45), P.steel, x + 0.7, 0.22, z));
  };
  benchAt(20, 46.5); benchAt(52, 1.5);
  // skuter parkir (foto gameplay) di dekat spawn atk
  gp.push(part(new THREE.BoxGeometry(0.9, 0.18, 0.3), P.accB, 4, 0.55, 32));
  gp.push(part(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 10).rotateX(Math.PI / 2), P.palm, 3.6, 0.22, 32));
  gp.push(part(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 10).rotateX(Math.PI / 2), P.palm, 4.4, 0.22, 32));
  gp.push(part(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), P.steel, 4.45, 0.85, 32, 0, 0, 0.4));
  // strip hazard kuning di kontainer Site A / tangki Site B / crate lane
  const haz = (x, y, z, w, d) => gp.push(part(new THREE.BoxGeometry(w, 0.03, d), P.accY, x, y, z));
  haz(61, 2.62, 35.2, 6, 0.3); haz(65, 2.62, 39.2, 6, 0.3); haz(61, 2.62, 42.2, 6, 0.3);
  haz(60.5, 3.02, 7.5, 3, 0.3); haz(65.5, 3.02, 12.5, 3, 0.3);
  haz(24, 1.22, 38, 1.2, 0.25); haz(40, 1.22, 38, 1.2, 0.25); haz(20, 1.22, 27, 1.2, 0.25); haz(42, 1.22, 27, 1.2, 0.25);
  // zebra cross di tengah lane
  for (const [x, z] of [[20, 25], [42, 25], [20, 40], [42, 10]]) for (let k = -2; k <= 2; k++)
    gp.push(part(new THREE.BoxGeometry(0.5, 0.02, 1.1), P.wall, x + k * 1.1, 0.015, z));
  // genangan ringan
  gp.push(part(new THREE.CircleGeometry(1.4, 12).rotateX(-Math.PI / 2), P.steel, 26, 0.012, 33));
  gp.push(part(new THREE.CircleGeometry(1.1, 12).rotateX(-Math.PI / 2), P.steel, 46, 0.012, 17));
  scene.add(...mergeParts(gp, false));
  // kelopak jatuh (Points pool 120) — posisi awal SEEDED agar ?shot= deterministik
  const petN = 120, petPos = new Float32Array(petN * 3), petVel = [];
  for (let i = 0; i < petN; i++) {
    const t = trees[i % trees.length];
    petPos.set([t[0] + (srand() - 0.5) * 4, srand() * 3, t[1] + (srand() - 0.5) * 4], i * 3);
    petVel.push(0.25 + srand() * 0.3);
  }
  const petGeo = new THREE.BufferGeometry();
  petGeo.setAttribute('position', new THREE.BufferAttribute(petPos, 3));
  const petals = new THREE.Points(petGeo, new THREE.PointsMaterial({ color: 0xf7a8c4, size: 0.14, transparent: true, opacity: 0.9 }));
  scene.add(petals);
  // --- menara cincin + skybridge (prop visual, tanpa collision) ---
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 20, 10), P.wall);
  tower.position.set(36, 10, -9); scene.add(tower);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.5, 8, 24), P.trimC);
  ring.position.set(36, 16, -9); scene.add(ring);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.9, 9), P.trimC);
  bridge.position.set(30, 5.6, 25); scene.add(bridge);
  const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.15, 9), P.wall);
  bridgeDeck.position.set(30, 5.1, 25); scene.add(bridgeDeck);
  // logo segitiga di menara cincin (foto map: segitiga di dalam cincin)
  const triLogo = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.3, 3), P.neonB);
  triLogo.rotation.x = Math.PI / 2; triLogo.position.set(36, 16, -8.5); scene.add(triLogo);
  // matahari (cakram terang di langit)
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(3, 20), P.flash);
  sunDisc.position.set(58, 34, -28); sunDisc.lookAt(36, 0, 24); scene.add(sunDisc);
  // --- skyline kota: gedung futuristik di luar perimeter + jendela bercahaya ---
  const skyB = [[-14, -14, 10, 18], [-14, 8, 8, 12], [-14, 30, 12, 22], [-14, 52, 9, 14],
    [78, -12, 11, 16], [80, 12, 9, 20], [78, 34, 13, 24], [80, 56, 8, 12],
    [8, -18, 9, 14], [30, -20, 12, 26], [52, -18, 10, 18], [10, 62, 10, 15], [34, 64, 12, 20], [58, 62, 9, 14]];
  const skyIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), P.wall, skyB.length);
  const winParts = [];
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    skyB.forEach((b) => {
      const cx = b[0] + b[2] / 2, cz = b[1] + b[2] / 2;
      p.set(cx, b[3] / 2, cz); sc.set(b[2], b[3], b[2]);
      m.compose(p, q, sc); skyIM.setMatrixAt(skyB.indexOf(b), m);
      const xFace = Math.abs(cx - 36) > Math.abs(cz - 24);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
        const wy = 3 + r * 4;
        if (xFace) winParts.push(part(new THREE.BoxGeometry(0.1, 1.2, 1.6), P.flash, cx + (cx < 36 ? 1 : -1) * (b[2] / 2 + 0.05), wy, b[1] + 2 + c * 3));
        else winParts.push(part(new THREE.BoxGeometry(1.6, 1.2, 0.1), P.flash, b[0] + 2 + c * 3, wy, cz + (cz < 24 ? 1 : -1) * (b[2] / 2 + 0.05)));
      }
    });
  }
  scene.add(skyIM, ...mergeParts(winParts, false));
  // airship di langit jauh (prop ambient, melayang pelan)
  const ship = new THREE.Group();
  const shipBody = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8), P.wall);
  shipBody.scale.set(2.2, 0.8, 0.8); ship.add(shipBody);
  const shipGond = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1), P.steel);
  shipGond.position.y = -2.2; ship.add(shipGond);
  const shipFin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 1.4), P.trimM);
  shipFin.position.set(-5.5, 0.6, 0); ship.add(shipFin);
  ship.position.set(20, 26, -30); scene.add(ship);
  // papan EMBERLINE menyala di atas jembatan Mid (canvas texture, 1 mesh)
  const signC = document.createElement('canvas'); signC.width = 512; signC.height = 96;
  const sg = signC.getContext('2d');
  sg.fillStyle = '#0a1a2c'; sg.fillRect(0, 0, 512, 96);
  sg.strokeStyle = '#19c8e8'; sg.lineWidth = 4; sg.strokeRect(3, 3, 506, 90);
  sg.fillStyle = '#ffd23c'; sg.font = 'bold 54px system-ui, sans-serif';
  sg.textAlign = 'center'; sg.textBaseline = 'middle';
  sg.fillText('EMBERLINE', 256, 50);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.3),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(signC) }));
  sign.position.set(27.4, 6.2, 25); sign.rotation.y = -Math.PI / 2; scene.add(sign);
  // --- pintu Mid: 2 panel geser + rel hazard ---
  const doorL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.2, 2), P.steel);
  const doorR = doorL.clone(); doorL.castShadow = doorR.castShadow = true; scene.add(doorL, doorR);
  const stripL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 2), P.neonO);
  const stripR = stripL.clone(); scene.add(stripL, stripR);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 8), P.accY);
  rail.position.set(30, 0.015, 25); scene.add(rail);
  // strip neon tunnel + pipa dinding (visual) — merge jadi 1 mesh masing-masing
  const stripParts = [], pipeParts = [];
  const neonStrip = (x, z0, z1) => stripParts.push(part(new THREE.BoxGeometry(0.08, 0.12, Math.abs(z1 - z0)), P.trimC, x, 2.2, (z0 + z1) / 2));
  neonStrip(28.1, 14, 21); neonStrip(28.1, 29, 36); neonStrip(31.9, 14, 21); neonStrip(31.9, 29, 36);
  scene.add(...mergeParts(stripParts, false));
  const pipeV = (x, z) => pipeParts.push(part(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 8), P.pipe, x, 1.3, z));
  pipeV(28.2, 18); pipeV(31.8, 32); pipeV(28.2, 33); pipeV(31.8, 17);
  scene.add(...mergeParts(pipeParts, false));
  // --- robot (10), tracer pool, ledakan, asap, bom, granat, drop ---
  const robots = [];
  for (let i = 0; i < 10; i++) {
    const r = buildRobot(i % 5, i < 5 ? 'atk' : 'def');
    scene.add(r.group); robots.push(r);
  }
  robots[0].group.visible = false; // robot pemain sendiri: kamera ada di dalamnya
  // drone kecil melayang di atas Mid (prop ambient, foto menu)
  const drone = buildDrone();
  drone.group.position.set(30, 6.8, 25); scene.add(drone.group);
  // menu: 5 robot di dalam map, kota + menara jadi latar
  let menuMode = false;
  const menuRobots = [];
  for (let i = 0; i < 5; i++) {
    const r = buildRobot(i, 'atk');
    r.group.position.set(33.2 + i * 1.4, 0, 29.5);
    r.group.rotation.y = -Math.PI / 2;
    r.group.visible = false;
    scene.add(r.group); menuRobots.push(r);
  }
  const menuDrone = buildDrone();
  menuDrone.group.position.set(34.8, 3, 30.2); menuDrone.group.visible = false;
  scene.add(menuDrone.group);
  const tracerGeo = new THREE.BoxGeometry(0.03, 0.03, 1);
  const tracers = [];
  for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(tracerGeo, P.flash); m.visible = false; scene.add(m); tracers.push({ m, life: 0 }); }
  const exN = 300, exPos = new Float32Array(exN * 3), exVel = new Float32Array(exN * 3);
  const exGeo = new THREE.BufferGeometry();
  exGeo.setAttribute('position', new THREE.BufferAttribute(exPos, 3));
  const explosion = new THREE.Points(exGeo, new THREE.PointsMaterial({ color: 0xff9a3c, size: 0.22, transparent: true, opacity: 0 }));
  explosion.frustumCulled = false; scene.add(explosion);
  let exLife = 0;
  const smokes = [];
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), P.smoke); m.visible = false; scene.add(m); smokes.push(m); }
  // bom 3D: perangkat (badan baja + panel + keypad + kabel + display timer +
  // antena + lampu beep), bukan kubus merah polos
  const bombParts = [
    part(new THREE.BoxGeometry(0.46, 0.2, 0.34), P.steel, 0, 0.1, 0),
    part(new THREE.BoxGeometry(0.4, 0.05, 0.28), P.palm, 0, 0.22, 0),
    part(new THREE.BoxGeometry(0.16, 0.03, 0.12), P.palm, -0.1, 0.26, 0.05),
    part(new THREE.BoxGeometry(0.025, 0.02, 0.3), P.neonO, 0.14, 0.25, 0),
    part(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 6), P.steel, 0.2, 0.32, -0.1),
  ];
  const bombMesh = new THREE.Group();
  bombMesh.add(...mergeParts(bombParts, false));
  const bombLight = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), P.flash);
  bombLight.position.set(-0.18, 0.3, -0.08); bombMesh.add(bombLight);
  scene.add(bombMesh);
  const grenMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), P.steel); scene.add(grenMesh);
  const dropMeshes = [];
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.12), P.steel); m.visible = false; scene.add(m); dropMeshes.push(m); }
  // debug graph (waypoint) — hanya ?debug=1
  const dg = new THREE.BufferGeometry(), dv = [];
  LINKS.forEach((list, i) => list.forEach((j) => { if (j > i) { dv.push(NODES[i].x, 0.15, NODES[i].z, NODES[j].x, 0.15, NODES[j].z); } }));
  dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dv), 3));
  const dbg = new THREE.LineSegments(dg, new THREE.LineBasicMaterial({ color: 0x00ff88 }));
  dbg.visible = false; scene.add(dbg);
  const dbgNodes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 6, 5), P.neonB, NODES.length);
  { const m = new THREE.Matrix4(); NODES.forEach((n, i) => { m.makeTranslation(n.x, 0.15, n.z); dbgNodes.setMatrixAt(i, m); }); }
  dbgNodes.visible = false; scene.add(dbgNodes);
  // --- API ---
  let lastMuzzle = 0;
  function spawnExplosion(x, y, z) {
    for (let i = 0; i < exN; i++) {
      exPos[i * 3] = x; exPos[i * 3 + 1] = y; exPos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, s = 2 + Math.random() * 7;
      exVel[i * 3] = Math.cos(a) * Math.cos(b) * s; exVel[i * 3 + 1] = Math.abs(Math.sin(b)) * s + 2; exVel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * s;
    }
    exGeo.attributes.position.needsUpdate = true; exLife = 0.9;
    explosion.material.opacity = 1;
  }
  function spawnTracer(ax, ay, az, bx, by, bz) {
    const t = tracers.find((o) => o.life <= 0) || tracers[0];
    const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz) || 0.01;
    t.m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    t.m.scale.set(1, 1, len);
    t.m.lookAt(bx, by, bz); t.m.visible = true; t.life = 0.07;
  }
  const _v = new THREE.Vector3();
  function render(state, dt, now) {
    const p = state.agents[0];
    if (menuMode) { // menu: robot + kota + menara
      camera.position.set(36, 2.1, 34.3); camera.lookAt(36, 1.93, 29.5);
      if (Math.abs(camera.fov - 60) > 0.1) { camera.fov = 60; camera.updateProjectionMatrix(); }
    } else {
      const eyeH = p.crouch ? 1.08 : 1.68;
      camera.position.set(p.x, p.y + eyeH, p.z);
      camera.rotation.y = -p.yaw - Math.PI / 2; camera.rotation.x = p.pitch;
      const targetFov = p.scoped ? 30 : 74;
      if (Math.abs(camera.fov - targetFov) > 0.1) { camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 12); camera.updateProjectionMatrix(); }
    }
    // robot (kecuali pemain sendiri — sudah disembunyikan); di menu, robot agen disembunyikan
    state.agents.forEach((a, i) => {
      if (i === 0) return;
      const r = robots[i]; if (!r) return;
      if (menuMode) { r.group.visible = false; return; }
      updateRobot(r, a, dt, now);
      r.pack.visible = state.bomb && state.bomb.carrierId === a.id && state.bomb.status === 'carried';
    });
    // drone melayang (Mid) + airship melayang + drone menu
    drone.group.position.y = 6.8 + Math.sin(now * 1.1) * 0.3;
    drone.group.rotation.y = now * 0.3;
    ship.position.x = 20 + Math.sin(now * 0.05) * 8;
    if (menuMode) menuDrone.group.position.y = 3 + Math.sin(now * 1.2) * 0.25;
    // pintu Mid mengikuti s.door.open (0 tutup -> 1 buka)
    const o = state.door.open;
    doorL.position.set(30, 1.6, 24 - o * 2); doorR.position.set(30, 1.6, 26 + o * 2);
    stripL.position.set(30.35, 1.6, 24 - o * 2); stripR.position.set(30.35, 1.6, 26 + o * 2);
    // kelopak jatuh
    for (let i = 0; i < petN; i++) {
      petPos[i * 3 + 1] -= petVel[i] * dt;
      petPos[i * 3] += Math.sin(now * 2 + i) * dt * 0.3;
      if (petPos[i * 3 + 1] < 0) petPos[i * 3 + 1] = 2.5 + Math.random();
    }
    petGeo.attributes.position.needsUpdate = true;
    // asap dari s.smokes
    smokes.forEach((m, i) => {
      const sm = state.smokes[i];
      if (sm) { m.visible = true; m.position.set(sm.x, sm.y, sm.z); const k = Math.min(1, (sm.until - state.now) / 12); m.scale.setScalar(sm.r * (0.7 + 0.3 * k)); }
      else m.visible = false;
    });
    // bom
    const b = state.bomb;
    if (b && (b.status === 'planted' || b.status === 'dropped')) {
      bombMesh.visible = true; bombMesh.position.set(b.x, 0, b.z);
      // beep makin cepat 10 dtk terakhir (spec §2)
      const blinkRate = (b.status === 'planted' && b.timer < 10) ? 10 : 4;
      bombLight.visible = Math.floor(now * blinkRate) % 2 === 0;
    } else bombMesh.visible = false;
    // granat aktif + senjata jatuh
    if (state.grenadesActive.length) { const g = state.grenadesActive[0]; grenMesh.visible = true; grenMesh.position.set(g.x, g.y, g.z); }
    else grenMesh.visible = false;
    dropMeshes.forEach((m, i) => {
      const d = state.dropped[i];
      if (d) { m.visible = true; m.position.set(d.x, 0.06, d.z); m.rotation.y = i; } else m.visible = false;
    });
    // tracer + muzzle + ledakan: konsumsi events
    for (const ev of state.events) {
      if (ev.t < now - 0.12) continue;
      if (ev.type === 'muzzle') {
        const a = state.agents[ev.shooter]; if (!a || !a.alive) continue;
        const ey = a.y + (a.crouch ? 1.08 : 1.68);
        const dx = Math.cos(a.yaw), dz = Math.sin(a.yaw);
        const mx = a.x + dx * 0.8, mz = a.z + dz * 0.8;
        muzzleLight.position.set(mx, ey - 0.1, mz); muzzleLight.intensity = 6; lastMuzzle = now;
        spawnTracer(mx, ey - 0.1, mz, mx + dx * 8, ey - 0.1 + Math.sin(a.pitch) * 8, mz + dz * 8);
      }
      if (ev.type === 'explosion') spawnExplosion(ev.x, (ev.y || 0) + 0.5, ev.z);
    }
    if (now - lastMuzzle > 0.06) muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 60);
    for (const t of tracers) { if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.m.visible = false; } }
    if (exLife > 0) {
      exLife -= dt;
      for (let i = 0; i < exN; i++) {
        exVel[i * 3 + 1] -= 6 * dt;
        exPos[i * 3] += exVel[i * 3] * dt; exPos[i * 3 + 1] += exVel[i * 3 + 1] * dt; exPos[i * 3 + 2] += exVel[i * 3 + 2] * dt;
        if (exPos[i * 3 + 1] < 0) exPos[i * 3 + 1] = 0;
      }
      exGeo.attributes.position.needsUpdate = true;
      explosion.material.opacity = Math.max(0, exLife / 0.9);
    } else explosion.material.opacity = 0;
    renderer.render(scene, camera);
  }
  function setDebug(on) { dbg.visible = on; dbgNodes.visible = on; }
  function setMenu(on) { menuMode = on; menuRobots.forEach((r) => { r.group.visible = on; }); menuDrone.group.visible = on; }
  function pick() { // raycast dari tengah kamera: apa yang menutupi pandangan?
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = rc.intersectObjects(scene.children, true).slice(0, 5);
    return hits.map((h) => ({
      dist: +h.distance.toFixed(2), mat: h.object.material && h.object.material.color
        ? '#' + h.object.material.color.getHexString() : '?',
      geo: h.object.geometry ? h.object.geometry.type : '?',
      pos: h.object.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(1)),
      point: h.point.toArray().map((v) => +v.toFixed(1)),
    }));
  }
  return { renderer, scene, camera, render, setDebug, setMenu, pick, palette: P,
    stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }) };
}
