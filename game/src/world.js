import { CONFIG } from './config.js';
const S = (x0, z0, x1, z1, y0 = 0, y1 = 3.2) =>
  ({ minX: x0, minY: y0, minZ: z0, maxX: x1, maxY: y1, maxZ: z1 });
export const SPAWNS = {
  atk: [{ x: 4, z: 21 }, { x: 4, z: 25 }, { x: 7, z: 23 }, { x: 7, z: 27 }, { x: 9, z: 25 }],
  def: [{ x: 60, z: 22 }, { x: 63, z: 25 }, { x: 66, z: 26 }, { x: 58, z: 27 }, { x: 64, z: 21 }],
};
export const ZONES = {
  spawnAtk: { x0: 2, z0: 19, x1: 10, z1: 29 },
  spawnDef: { x0: 56, z0: 20, x1: 67, z1: 28 },
  plantA: { x0: 57.5, z0: 33.5, x1: 67.5, z1: 42.5 },
  plantB: { x0: 57.5, z0: 5.5, x1: 67.5, z1: 14.5 },
  siteA: { x0: 56, z0: 32, x1: 69, z1: 44 },
  siteB: { x0: 56, z0: 4, x1: 69, z1: 16 },
  tunnel: { x0: 28, z0: 14, x1: 32, z1: 36 },
  btunnel: { x0: 10, z0: 6, x1: 56, z1: 14 },
  mid: { x0: 10, z0: 21, x1: 56, z1: 29 },
  along: { x0: 10, z0: 36, x1: 56, z1: 44 },
};
const WALL_H = 5.0;
export const SOLIDS = [
  S(-1, -1, 0, 49, 0, WALL_H), S(72, -1, 73, 49, 0, WALL_H),
  S(0, -1, 72, 0, 0, WALL_H), S(0, 48, 72, 49, 0, WALL_H),
  S(10, 35.5, 28, 36), S(32, 35.5, 46, 36), S(50, 35.5, 56, 36),
  S(10, 14, 28, 14.5), S(32, 14, 46, 14.5), S(50, 14, 56, 14.5),
  S(45.5, 29, 46, 36), S(50, 29, 50.5, 36),
  S(45.5, 13, 46, 21), S(50, 13, 50.5, 21),
  S(27.5, 14, 28, 21), S(27.5, 29, 28, 36), S(32, 14, 32.5, 21), S(32, 29, 32.5, 36),
  S(10, 6, 56, 14, 3.0, 5.0), S(28, 14, 32, 36, 2.6, 5.0),
  S(29.7, 21, 30.3, 23), S(29.7, 27, 30.3, 29),
  S(55.5, 32, 56, 36), S(55.5, 40, 56, 44),
  S(56, 31.5, 60, 32), S(64, 31.5, 69, 32),
  S(56, 43.5, 69, 44), S(68.5, 32, 69, 44),
  S(55.5, 4, 56, 8), S(55.5, 12, 56, 16),
  S(56, 15.5, 60, 16), S(64, 15.5, 69, 16),
  S(56, 3.5, 69, 4), S(68.5, 4, 69, 16),
  S(58, 34, 64, 36.4, 0, 2.6), S(62, 38, 68, 40.4, 0, 2.6), S(58, 41, 64, 43.4, 0, 2.6),
  S(66, 34, 67.2, 35.2, 0, 1.2), S(59, 37.5, 60.2, 38.7, 0, 1.2),
  S(65, 42, 66.2, 43.2, 0, 1.2), S(57.5, 39.5, 58.7, 40.7, 0, 1.2),
  S(59, 6, 62, 9, 0, 3.0), S(64, 11, 67, 14, 0, 3.0),
  S(57.5, 12, 58.7, 13.2, 0, 1.2), S(62.5, 5, 63.7, 6.2, 0, 1.2),
  S(66, 7, 67.2, 8.2, 0, 1.2), S(59, 13.5, 60.2, 14.7, 0, 1.2),
  S(62, 9.5, 66, 10.7, 0, 1.0),
  S(23.4, 37.4, 24.6, 38.6, 0, 1.2), S(39.4, 37.4, 40.6, 38.6, 0, 1.2),
  S(19.4, 26.4, 20.6, 27.6, 0, 1.2), S(41.4, 26.4, 42.6, 27.6, 0, 1.2),
  S(11.5, 12.2, 12.5, 13.2, 0, 3.0), S(53.5, 12.2, 54.5, 13.2, 0, 3.0),
];
export const DOOR_PANEL = S(29.7, 23, 30.3, 27, 0, 3.2);
function solidsWithDoor(doorOpen) {
  return doorOpen < 0.5 ? [...SOLIDS, DOOR_PANEL] : SOLIDS;
}
const overlap = (ax0, ax1, bx0, bx1) => ax0 < bx1 && ax1 > bx0;
function hitsSolid(x, y, z, r, h, solids) {
  for (const s of solids) {
    if (overlap(x - r, x + r, s.minX, s.maxX) && overlap(y, y + h, s.minY, s.maxY)
      && overlap(z - r, z + r, s.minZ, s.maxZ)) return s;
  }
  return null;
}
export function collideMove(pos, dx, dy, dz, radius, height, doorOpen = 1) {
  const solids = solidsWithDoor(doorOpen);
  let { x, y, z } = pos; let hitX = false, hitY = false, hitZ = false, onGround = false;
  x += dx; if (hitsSolid(x, y, z, radius, height, solids)) { x -= dx; hitX = true; }
  z += dz; if (hitsSolid(x, y, z, radius, height, solids)) { z -= dz; hitZ = true; }
  y += dy;
  if (y <= 0) { y = 0; onGround = true; hitY = true; }
  else if (hitsSolid(x, y, z, radius, height, solids)) { y -= dy; hitY = true; if (dy < 0) onGround = true; }
  return { x, y, z, hitX, hitY, hitZ, onGround };
}
function segAABB(ax, ay, az, bx, by, bz, s) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  let t0 = 0, t1 = 1;
  const axes = [[ax, dx, s.minX, s.maxX], [ay, dy, s.minY, s.maxY], [az, dz, s.minZ, s.maxZ]];
  for (const [o, d, mn, mx] of axes) {
    if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) return null; }
    else {
      let ta = (mn - o) / d, tb = (mx - o) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) return null;
    }
  }
  return t0;
}
function segSphere(ax, ay, az, bx, by, bz, c, r) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const fx = ax - c.x, fy = ay - c.y, fz = az - c.z;
  const a = dx * dx + dy * dy + dz * dz;
  const b = 2 * (fx * dx + fy * dy + fz * dz);
  const cc = fx * fx + fy * fy + fz * fz - r * r;
  const disc = b * b - 4 * a * cc;
  if (disc < 0 || a < 1e-9) return false;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1;
}
export function losBlocked(ax, ay, az, bx, by, bz, smokes = [], doorOpen = 1) {
  for (const s of solidsWithDoor(doorOpen)) if (segAABB(ax, ay, az, bx, by, bz, s) !== null) return true;
  for (const sm of smokes) if (segSphere(ax, ay, az, bx, by, bz, sm, sm.r)) return true;
  return false;
}
export function raySolids(ox, oy, oz, dx, dy, dz, maxDist, doorOpen = 1) {
  let best = Infinity;
  for (const s of solidsWithDoor(doorOpen)) {
    const t = segAABB(ox, oy, oz, ox + dx * maxDist, oy + dy * maxDist, oz + dz * maxDist, s);
    if (t !== null && t * maxDist < best) best = t * maxDist;
  }
  return best;
}
export function inZone(p, name) {
  const z = ZONES[name]; if (!z) return false;
  return p.x >= z.x0 && p.x <= z.x1 && p.z >= z.z0 && p.z <= z.z1;
}
const N = (x, z, tags = []) => ({ x, z, tags });
export const NODES = [
  N(5, 21, ['spawnAtk']), N(5, 25, ['spawnAtk']), N(7, 27, ['spawnAtk']),
  N(60, 22, ['spawnDef']), N(63, 25, ['spawnDef']), N(66, 26, ['spawnDef']),
  N(12, 40, ['along']), N(17, 40, ['along']), N(22, 40, ['along']), N(27, 40, ['along']),
  N(32, 40, ['along']), N(37, 40, ['along']), N(42, 40, ['along']), N(47, 40, ['along']),
  N(52, 40, ['along']), N(57, 40, ['along']),
  N(12, 25, ['mid']), N(17, 25, ['mid']), N(22, 25, ['mid']), N(27, 25, ['mid']),
  N(32, 25, ['mid']), N(37, 25, ['mid']), N(42, 25, ['mid']), N(47, 25, ['mid']),
  N(52, 25, ['mid']), N(55, 25, ['mid']),
  N(12, 10, ['btunnel']), N(17, 10, ['btunnel']), N(22, 10, ['btunnel']), N(27, 10, ['btunnel']),
  N(32, 10, ['btunnel']), N(37, 10, ['btunnel']), N(42, 10, ['btunnel']), N(47, 10, ['btunnel']),
  N(52, 10, ['btunnel']), N(57, 10, ['btunnel']),
  N(48, 32, ['midA']), N(48, 35, ['midA']), N(48, 18, ['midB']), N(48, 15, ['midB']),
  N(59, 33, ['siteA']), N(63, 37, ['siteA']), N(66, 41, ['siteA']), N(57, 42, ['siteA']),
  N(58, 7, ['siteB']), N(63, 11, ['siteB']), N(66, 15, ['siteB']), N(58, 14, ['siteB']),
  N(30, 25, ['door']),
  N(30, 14, ['tunnel']), N(30, 20, ['tunnel']), N(30, 30, ['tunnel']), N(30, 36, ['tunnel']),
  N(60, 37, ['intA']), N(65, 37, ['intA']), N(60, 11, ['intB']), N(63, 13, ['intB']),
  N(61, 31, ['defA']), N(61, 16, ['defB']),
];
NODES.forEach((n, i) => { n.id = i; });
export const LINKS = NODES.map(() => []);
for (let i = 0; i < NODES.length; i++) for (let j = i + 1; j < NODES.length; j++) {
  const a = NODES[i], b = NODES[j];
  const d = Math.hypot(a.x - b.x, a.z - b.z);
  if (d > 9.5 || d < 0.01) continue;
  if (losBlocked(a.x, 1, a.z, b.x, 1, b.z, [], 1)) continue;
  LINKS[i].push(j); LINKS[j].push(i);
}
const force = (a, b) => { if (!LINKS[a].includes(b)) LINKS[a].push(b); if (!LINKS[b].includes(a)) LINKS[b].push(a); };
const byTag = t => NODES.findIndex(n => n.tags.includes(t));
force(byTag('tunnel') , NODES.findIndex(n => n.x === 30 && n.z === 20));
force(NODES.findIndex(n => n.x === 30 && n.z === 20), NODES.findIndex(n => n.x === 30 && n.z === 30));
force(NODES.findIndex(n => n.x === 30 && n.z === 30), NODES.findIndex(n => n.x === 30 && n.z === 36));
force(byTag('door'), NODES.findIndex(n => n.x === 27 && n.z === 25));
force(byTag('door'), NODES.findIndex(n => n.x === 32 && n.z === 25));
export function nearestNode(x, z) {
  let best = 0, bd = Infinity;
  NODES.forEach((n, i) => { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = i; } });
  return best;
}
export function aStar(fromId, toId) {
  if (fromId === toId) return [fromId];
  const open = new Set([fromId]), came = {}, g = { [fromId]: 0 };
  const h = i => Math.hypot(NODES[i].x - NODES[toId].x, NODES[i].z - NODES[toId].z);
  const f = i => (g[i] ?? Infinity) + h(i);
  while (open.size) {
    let cur = [...open].sort((a, b) => f(a) - f(b))[0];
    if (cur === toId) {
      const path = [cur]; let c = cur;
      while (came[c] !== undefined) { c = came[c]; path.unshift(c); }
      return path;
    }
    open.delete(cur);
    for (const nb of LINKS[cur]) {
      const ng = g[cur] + Math.hypot(NODES[cur].x - NODES[nb].x, NODES[cur].z - NODES[nb].z);
      if (ng < (g[nb] ?? Infinity)) { g[nb] = ng; came[nb] = cur; open.add(nb); }
    }
  }
  return [];
}
export { CONFIG };
