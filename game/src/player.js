import { CONFIG, WEAPONS } from './config.js';
import { collideMove } from './world.js';
import { currentWeapon } from './state.js';
export function updatePlayer(s, input, dt) {
  const p = s.agents[0];
  if (!p.alive || s.round.phase === 'buy' || s.round.phase === 'end' || s.paused) return;
  const m = input.consumeMouse();
  p.yaw -= m.dx * 0.0022 * CONFIG.mouseSens;
  p.pitch -= m.dy * 0.0022 * CONFIG.mouseSens;
  p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch));
  p.crouch = input.down('ControlLeft') || input.down('ControlRight');
  const w = currentWeapon(p);
  p.scoped = !!(w && w.key === 'Longbow' && input.rightDown);
  const speed = (w ? WEAPONS[w.key].speed : 5.2) * (p.crouch ? CONFIG.moveCrouch / 5.2 : 1);
  const fwd = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
  const str = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
  let wx = Math.cos(p.yaw) * fwd - Math.sin(p.yaw) * str;
  let wz = Math.sin(p.yaw) * fwd + Math.cos(p.yaw) * str;
  const len = Math.hypot(wx, wz) || 1; wx /= len; wz /= len;
  const tx = wx * speed, tz = wz * speed;
  const a = Math.min(1, CONFIG.accel * dt / 5.2);
  p.vx += (tx - p.vx) * a;
  p.vz += (tz - p.vz) * a;
  if (!fwd && !str && p.onGround) {
    const f = Math.max(0, 1 - CONFIG.friction * dt / 5.2);
    p.vx *= f; p.vz *= f;
  }
  if (input.down('Space') && p.onGround) { p.vy = CONFIG.jumpVel; p.onGround = false; }
  p.vy -= CONFIG.gravity * dt;
  const h = p.crouch ? CONFIG.agentHeightCrouch : CONFIG.agentHeight;
  const r = collideMove(p, p.vx * dt, p.vy * dt, p.vz * dt, CONFIG.agentRadius, h, s.door.open);
  p.x = r.x; p.y = r.y; p.z = r.z;
  if (r.hitY && p.vy < 0) { p.vy = 0; p.onGround = true; }
  if (r.hitY && p.vy > 0) p.vy = 0;
  if (r.onGround) p.onGround = true;
  if (p.onGround && Math.hypot(p.vx, p.vz) > 1 && s.now - p.stepAt > 0.45) {
    p.stepAt = s.now;
    const r0 = p.crouch ? CONFIG.hearing.crouchStep : CONFIG.hearing.runStep;
    s.events.push({ t: s.now, type: 'noise', kind: 'step', x: p.x, y: 0, z: p.z, radius: r0, team: p.team });
  }
}
