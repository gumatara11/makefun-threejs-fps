// EMBERLINE sim — grenades.js. Fisika proyektil + efek Frag/Smoke/Flash.
import { CONFIG, GRENADES } from './config.js';
import { collideMove, losBlocked } from './world.js';
import { explosiveDamage } from './combat.js';
import { pushEvent } from './state.js';

export function createProjectile(state, a, kind, dir) {
  const g = GRENADES[kind];
  const p = { kind, owner: a.id, team: a.team,
    x: a.x + dir.x * 0.6, y: a.y + 1.4, z: a.z + dir.z * 0.6,
    vx: dir.x * CONFIG.throwSpeed + a.vx * 0.5,
    vy: dir.y * CONFIG.throwSpeed + 2.0, vz: dir.z * CONFIG.throwSpeed + a.vz * 0.5,
    fuseAt: state.now + g.fuse, landed: false, smokeAt: 0 };
  state.grenadesActive.push(p);
  return p;
}
export function updateGrenades(s, dt) {
  for (let i = s.grenadesActive.length - 1; i >= 0; i--) {
    const p = s.grenadesActive[i];
    p.vy -= CONFIG.grenadeGravity * dt;
    const r = collideMove(p, p.vx * dt, p.vy * dt, p.vz * dt, 0.15, 0.3, s.door.open);
    if (r.hitX) { p.vx = -p.vx * CONFIG.grenadeRestitution; p.landed = true; }
    if (r.hitZ) { p.vz = -p.vz * CONFIG.grenadeRestitution; p.landed = true; }
    if (r.hitY) { p.vy = -p.vy * CONFIG.grenadeRestitution; if (Math.abs(p.vy) < 0.8) p.vy = 0; p.landed = true; }
    p.x = r.x; p.y = r.y; p.z = r.z;
    if (r.onGround) p.landed = true;
    if (s.now >= p.fuseAt) { detonate(s, p); s.grenadesActive.splice(i, 1); }
  }
  // asap kedaluwarsa
  s.smokes = s.smokes.filter(sm => s.now < sm.until);
}
function detonate(s, p) {
  const g = GRENADES[p.kind];
  const owner = s.agents[p.owner];
  if (p.kind === 'Frag') {
    pushEvent(s, { type: 'explosion', x: p.x, y: p.y, z: p.z, kind: 'frag' });
    explosiveDamage(s, p.x, p.y + 0.3, p.z, g.radius, g.dmgCenter, g.dmgEdge, owner);
  } else if (p.kind === 'Smoke') {
    // berkembang 0,8 dtk dari aktivasi (fuse) jadi bola r 3,5 selama 12 dtk (AMB-08: linear)
    s.smokes.push({ x: p.x, y: Math.max(0.5, p.y), z: p.z, r: g.radius, until: s.now + g.duration });
    pushEvent(s, { type: 'smoke', x: p.x, y: p.y, z: p.z });
  } else if (p.kind === 'Flash') {
    pushEvent(s, { type: 'flash', x: p.x, y: p.y, z: p.z });
    for (const a of s.agents) {
      if (!a.alive) continue;
      const d = Math.hypot(a.x - p.x, (a.y + 1.5) - p.y, a.z - p.z);
      if (d > g.radius) continue;
      if (losBlocked(p.x, p.y, p.z, a.x, a.y + 1.5, a.z, [], s.door.open)) continue;
      // menghadap flash (dot arah pandang ke flash > 0) -> 2,2 dtk, membelakangi -> 0,8
      const fx = p.x - a.x, fz = p.z - a.z, fl = Math.hypot(fx, fz) || 1;
      const dot = Math.cos(a.yaw) * (fx / fl) + Math.sin(a.yaw) * (fz / fl);
      a.blindUntil = s.now + (dot > 0 ? g.blindFace : g.blindBack);
      pushEvent(s, { type: 'blind', target: a.id, until: a.blindUntil });
    }
  }
}
