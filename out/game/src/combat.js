// EMBERLINE sim — combat.js. Raycast hit, zona tubuh, damage, kill.
import { CONFIG, WEAPONS } from './config.js';
import { raySolids, losBlocked } from './world.js';
import { pushEvent } from './state.js';

export function dirFromYawPitch(yaw, pitch) {
  const cp = Math.cos(pitch);
  return { x: Math.cos(yaw) * cp, y: Math.sin(pitch), z: Math.sin(yaw) * cp };
}
export function eyePos(a) {
  const h = a.crouch ? CONFIG.agentHeightCrouch : CONFIG.agentHeight;
  return { x: a.x, y: a.y + h - 0.12, z: a.z };
}
// Ray vs silinder agen (r 0,4).
function rayAgent(ox, oy, oz, dx, dy, dz, a) {
  const h = a.crouch ? CONFIG.agentHeightCrouch : CONFIG.agentHeight;
  const cx = a.x - ox, cz = a.z - oz;
  const A = dx * dx + dz * dz;
  if (A < 1e-9) return null;
  const B = 2 * (ox * dx + oz * dz - a.x * dx - a.z * dz);
  const C = (ox - a.x) ** 2 + (oz - a.z) ** 2 - 0.4 * 0.4;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  if (t <= 0.01) return null;
  const y = oy + t * dy, rel = y - a.y;
  if (rel < 0 || rel > h) return null;
  const zone = rel >= h - 0.30 ? 'head' : (rel >= 0.80 * (h / 1.8) ? 'torso' : 'leg');
  return { t, zone };
}
function falloff(w, dist) {
  if (dist <= w.falloffStart) return 1;
  if (dist >= w.falloffEnd) return w.falloffMin;
  const k = (dist - w.falloffStart) / (w.falloffEnd - w.falloffStart);
  return 1 + (w.falloffMin - 1) * k;
}
// Satu peluru. opts: {spreadRad} diterapkan pemanggil.
export function shoot(state, shooter, dir, weapon) {
  const o = eyePos(shooter);
  const maxDist = 120;
  const wall = raySolids(o.x, o.y, o.z, dir.x, dir.y, dir.z, maxDist, state.door.open);
  let best = null, bestT = wall;
  for (const a of state.agents) {
    if (a.id === shooter.id || !a.alive) continue;
    const hit = rayAgent(o.x, o.y, o.z, dir.x, dir.y, dir.z, a);
    if (hit && hit.t < bestT) { best = { target: a, zone: hit.zone, t: hit.t }; bestT = hit.t; }
  }
  if (!best) return { hit: false, wallDist: wall };
  const w = WEAPONS[weapon.key];
  let mul = best.zone === 'head' ? (weapon.key === 'Longbow' ? CONFIG.zoneHeadMulLongbow : CONFIG.zoneHeadMul)
    : best.zone === 'torso' ? CONFIG.zoneTorsoMul : CONFIG.zoneLegMul;
  let dmg = Math.round(w.dmg * mul * falloff(w, bestT) * (best.target.kevlar ? CONFIG.kevlarBulletMul : 1));
  dmg = Math.max(1, dmg);
  state.stats.shots++; state.stats.hits++;
  applyDamage(state, best.target, dmg, shooter, best.zone, 'bullet');
  return { hit: true, target: best.target, zone: best.zone, damage: dmg, distance: bestT, wallDist: wall };
}
export function applyDamage(state, target, dmg, attacker, zone, cause) {
  if (!target.alive) return;
  target.hp -= dmg;
  pushEvent(state, { type: 'hit', target: target.id, from: attacker ? attacker.id : -1, dmg, zone, cause, hp: Math.max(0, target.hp) });
  if (attacker) pushEvent(state, { type: 'hitmarker', shooter: attacker.id, target: target.id, kill: target.hp <= 0 });
  if (target.hp > 0) return;
  target.hp = 0; target.alive = false; target.deaths++; target.scoped = false;
  target.planting = false; target.defusing = false;
  if (attacker && attacker.id !== target.id) {
    attacker.kills++;
    attacker.pending += CONFIG.rewardKill; // AMB-24: dibukukan, dibayar akhir ronde
    pushEvent(state, { type: 'kill', killer: attacker.id, victim: target.id, zone, cause });
  } else pushEvent(state, { type: 'kill', killer: -1, victim: target.id, zone, cause });
  // primer jatuh (P9 tidak pernah jatuh); bom jatuh bila carrier
  if (target.weapons.primary) {
    state.dropped.push({ key: target.weapons.primary.key, mag: target.weapons.primary.mag,
      reserve: target.weapons.primary.reserve, x: target.x, z: target.z });
    target.weapons.primary = null; target.current = 'secondary';
  }
  if (state.bomb && state.bomb.carrierId === target.id && state.bomb.status === 'carried') {
    state.bomb.status = 'dropped'; state.bomb.carrierId = null;
    state.bomb.x = target.x; state.bomb.z = target.z; state.bomb.droppedAt = state.now;
    pushEvent(state, { type: 'bomb-drop', x: target.x, z: target.z });
  }
  if (target.kevlar) target.kevlar = false;
}
// Damage ledakan Frag: LOS dari titik ledak, kevlar x0,75.
export function explosiveDamage(state, x, y, z, radius, dmgCenter, dmgEdge, attacker) {
  for (const a of state.agents) {
    if (!a.alive || (attacker && a.id === attacker.id)) continue;
    const d = Math.hypot(a.x - x, (a.y + 0.9) - y, a.z - z);
    if (d > radius) continue;
    if (losBlocked(x, y, z, a.x, a.y + 0.9, a.z, [], state.door.open)) continue;
    let dmg = Math.round(dmgCenter + (dmgEdge - dmgCenter) * (d / radius));
    if (a.kevlar) dmg = Math.round(dmg * CONFIG.kevlarFragMul);
    applyDamage(state, a, Math.max(1, dmg), attacker, 'torso', 'frag');
  }
}
