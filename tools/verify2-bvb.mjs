// Verifier EMBERLINE — studi bot-vs-bot v2 (tugas D), pelacakan BERBASIS STATE.
// Event log sim di-splice (>200) sehingga indeks event tak bisa dipakai; semua
// yang penting dibaca dari state tiap tick. Output: tools/verify2-bvb.json
import { CONFIG } from '../game/src/config.js';
import { createState, currentWeapon } from '../game/src/state.js';
import { inZone } from '../game/src/world.js';
import { createBotBrain } from '../game/src/bots.js';
import { simStep } from '../game/src/rounds.js';
import fs from 'node:fs';

const DT = 1 / 60;
class DI { constructor() { this.keys = new Set(); this.mouseDown = false; this.rightDown = false; } down(c) { return this.keys.has(c); } pressed(c) { if (this.keys.has(c)) { this.keys.delete(c); return true; } return false; } consumeMouse() { return { dx: 0, dy: 0 }; } }
const laneOf = (x, z) => {
  if (x >= 56) return z >= 32 ? 'siteA' : z <= 16 ? 'siteB' : 'spawnDef';
  if (z >= 36) return 'A-long';
  if (z >= 21 && z <= 29) return 'Mid';
  if (z >= 14 && z < 21) return (x >= 28 && x <= 32) ? 'service-tunnel' : 'Mid-B-conn';
  if (z >= 29 && z < 36) return 'Mid-A-conn';
  if (z < 14) return 'B-tunnel';
  return 'spawnAtk';
};
const N_MATCH = 4;
const all = { matches: [], carrierDeaths: [], kills: [], rounds: 0, timeouts: 0, plants: 0 };
for (let m = 0; m < N_MATCH; m++) {
  const s = createState(), inp = new DI();
  for (const a of s.agents) { if (a.isPlayer) { a.isPlayer = false; a.bot = createBotBrain('A1'); } else a.bot = createBotBrain(a.role); }
  const M = { match: m + 1, rounds: [] };
  let R = null, roundStart = 0, prevAlive = {}, prevBomb = 'carried', prevPlanting = false, prevPhase = 'buy';
  const newRound = () => ({
    n: s.match.round, plants: 0, plantAttempts: 0, carrierDeath: null, carrierPath: [],
    carrierFirstSiteAt: -1, firstAtkSiteAt: -1, firstContactAt: -1, carrierMaxX: 0,
    weaponsAtLive: {}, posAt50: {}, posAtEnd: {}, shots: {}, hits: {}, kills: 0,
  });
  let ticks = 0; const maxTicks = 60 * 60 * 20;
  const seenEvents = new Set();
  while (!s.match.over && ticks < maxTicks) {
    simStep(s, DT, inp); ticks++;
    const now = s.now;
    if (s.round.phase === 'live' && prevPhase !== 'live') {
      R = newRound(); roundStart = now;
      for (const a of s.agents) R.weaponsAtLive[a.role] = a.weapons.primary ? a.weapons.primary.key : 'P9';
      for (const a of s.agents) prevAlive[a.id] = a.alive;
      prevBomb = s.bomb.status;
    }
    if (!R) { prevPhase = s.round.phase; continue; }
    // kematian (transisi alive) — catat posisi + lane + jarak ke penembak terdekat tak diketahui -> catat posisi saja + killer dari event kill
    for (const a of s.agents) {
      if (prevAlive[a.id] && !a.alive) {
        R.kills++;
        if (a.role === 'A4') {
          // cari killer dari event kill terbaru
          const ke = [...s.events].reverse().find(e => e.type === 'kill' && e.victim === 4);
          const k = ke && ke.killer >= 0 ? s.agents[ke.killer] : null;
          const d = k ? Math.hypot(k.x - a.x, k.z - a.z) : -1;
          R.carrierDeath = { by: k ? k.role : '?', weapon: k && currentWeapon(k) ? currentWeapon(k).key : '?', dist: +d.toFixed(1), lane: laneOf(a.x, a.z), pos: [+a.x.toFixed(1), +a.z.toFixed(1)], t: +(now - roundStart).toFixed(1) };
          all.carrierDeaths.push({ ...R.carrierDeath, match: m + 1, round: R.n });
        }
        all.kills.push({ match: m + 1, round: R.n, victim: a.role, pos: [+a.x.toFixed(1), +a.z.toFixed(1)], lane: laneOf(a.x, a.z), t: +(now - roundStart).toFixed(1) });
      }
      prevAlive[a.id] = a.alive;
    }
    // plant / drop via transisi status bom
    if (prevBomb !== s.bomb.status) {
      if (s.bomb.status === 'planted') { R.plants++; all.plants++; }
      prevBomb = s.bomb.status;
    }
    // event baru (pakai Set identitas objek — tahan splice)
    for (const e of s.events) {
      if (seenEvents.has(e)) continue; seenEvents.add(e);
      if (e.type === 'muzzle') R.shots[e.shooter] = (R.shots[e.shooter] || 0) + 1;
      if (e.type === 'hit') R.hits[e.from] = (R.hits[e.from] || 0) + 1;
      if (e.type === 'kill' && e.killer >= 0) { /* killer dicatat di atas */ }
    }
    if (seenEvents.size > 20000) { /* jangan tumbuh tanpa batas: event lama tak akan muncul lagi */ }
    if (s.round.phase === 'live' || s.round.phase === 'bomb') {
      const c = s.agents[4];
      if (c.planting && !prevPlanting) R.plantAttempts++;
      prevPlanting = c.planting;
      if (Math.floor(now * 2) !== Math.floor((now - DT) * 2) && c.alive && s.round.phase === 'live') {
        R.carrierPath.push([Math.round(c.x), Math.round(c.z)]);
        R.carrierMaxX = Math.max(R.carrierMaxX, c.x);
        if (R.carrierFirstSiteAt < 0 && (inZone(c, 'siteA') || inZone(c, 'siteB'))) R.carrierFirstSiteAt = +(now - roundStart).toFixed(1);
      }
      if (R.firstAtkSiteAt < 0 && s.agents.some(a => a.team === 'atk' && a.alive && (inZone(a, 'siteA') || inZone(a, 'siteB')))) R.firstAtkSiteAt = +(now - roundStart).toFixed(1);
      if (R.firstContactAt < 0) {
        outer: for (const a of s.agents.filter(x => x.team === 'atk' && x.alive)) for (const d of s.agents.filter(x => x.team === 'def' && x.alive)) {
          if (Math.hypot(a.x - d.x, a.z - d.z) < 20) { R.firstContactAt = +(now - roundStart).toFixed(1); break outer; }
        }
      }
      const el = now - roundStart;
      if (Math.abs(el - 50) < DT / 2) for (const a of s.agents) R.posAt50[a.role] = [Math.round(a.x), Math.round(a.z), a.alive ? '' : 'X'];
    }
    if (s.round.phase === 'end' && s.round.winner && prevPhase !== 'end') {
      R.winner = s.round.winner; R.reason = s.round.reason; R.duration = +(now - roundStart).toFixed(1);
      for (const a of s.agents) R.posAtEnd[a.role] = [Math.round(a.x), Math.round(a.z), a.alive ? '' : 'X', a.bot && a.bot.targetId !== null ? 'tgt' + a.bot.targetId : ''];
      M.rounds.push(R); all.rounds++;
      if (R.reason === 'timeout') all.timeouts++;
      while (s.round.phase === 'end' && !s.match.over && ticks < maxTicks) { simStep(s, DT, inp); ticks++; }
      R = null;
    }
    prevPhase = s.round.phase;
  }
  M.score = `${s.match.scoreAtk}-${s.match.scoreDef}`; M.over = s.match.over;
  all.matches.push(M);
  console.log(`match ${m + 1}: skor ${M.score} over=${M.over} ronde=${M.rounds.length}`);
  for (const r of M.rounds) {
    console.log(`  r${r.n}: ${r.winner} (${r.reason}) ${r.duration} dtk | plant=${r.plants} usaha=${r.plantAttempts} kill=${r.kills} kontak1=${r.firstContactAt} dtk atkSite=${r.firstAtkSiteAt} carrierSite=${r.carrierFirstSiteAt} carrierMati=${r.carrierDeath ? JSON.stringify(r.carrierDeath) : '-'} | pos@50=${JSON.stringify(r.posAt50)}`);
  }
}
const cd = all.carrierDeaths;
const byKiller = {}, byLane = {}, byWeapon = {};
for (const d of cd) { byKiller[d.by] = (byKiller[d.by] || 0) + 1; byLane[d.lane] = (byLane[d.lane] || 0) + 1; byWeapon[d.weapon] = (byWeapon[d.weapon] || 0) + 1; }
const shotsByRole = {}, hitsByRole = {};
for (const M of all.matches) for (const r of M.rounds) {
  for (const [id, n] of Object.entries(r.shots)) { const role = ['P', 'A1', 'A2', 'A3', 'A4', 'D1', 'D2', 'D3', 'D4', 'D5'][+id]; shotsByRole[role] = (shotsByRole[role] || 0) + n; }
  for (const [id, n] of Object.entries(r.hits)) { const role = ['P', 'A1', 'A2', 'A3', 'A4', 'D1', 'D2', 'D3', 'D4', 'D5'][+id]; hitsByRole[role] = (hitsByRole[role] || 0) + n; }
}
const acc = {};
for (const role of Object.keys(shotsByRole)) acc[role] = `${hitsByRole[role] || 0}/${shotsByRole[role]}=${(((hitsByRole[role] || 0) / shotsByRole[role]) * 100).toFixed(1)}%`;
console.log('\nAGREGAT:');
console.log(`skor: ${all.matches.map(m => m.score).join(', ')} | ronde=${all.rounds} timeout=${all.timeouts} plant=${all.plants} killTotal=${all.kills.length}`);
console.log(`kematian carrier: n=${cd.length} oleh=${JSON.stringify(byKiller)} lane=${JSON.stringify(byLane)} senjata=${JSON.stringify(byWeapon)}`);
console.log('akurasi (hit/tembakan):', JSON.stringify(acc));
console.log('kill per korban (lane):', JSON.stringify(all.kills.reduce((o, k) => { o[k.lane] = (o[k.lane] || 0) + 1; return o; }, {})));
fs.writeFileSync('tools/verify2-bvb.json', JSON.stringify(all, null, 2));
