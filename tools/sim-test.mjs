// EMBERLINE sim-test — headless Node, tanpa DOM/three.
// Uji: (1) match bot-vs-bot, (2) damage, (3) plant/defuse+ledakan,
// (4) ekonomi, (5) bot capai site <=15 dtk, (6) A* tunnel+pintu, (7) asap+pintu.
import { CONFIG, WEAPONS } from '../game/src/config.js';
import { createState, currentWeapon } from '../game/src/state.js';
import { NODES, nearestNode, aStar, losBlocked, inZone } from '../game/src/world.js';
import { createBotBrain } from '../game/src/bots.js';
import { fire, createLoadout } from '../game/src/weapons.js';
import { dirFromYawPitch } from '../game/src/combat.js';
import { simStep, endRound, buyItem } from '../game/src/rounds.js';

const DT = 1 / 60;
let pass = 0, fail = 0;
const check = (name, ok, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ' — ' + info : ''}`);
  ok ? pass++ : fail++;
};
class DummyInput {
  constructor() { this.keys = new Set(); this.mouseDown = false; this.rightDown = false; }
  down(c) { return this.keys.has(c); }
  pressed(c) { if (this.keys.has(c)) { this.keys.delete(c); return true; } return false; }
  consumeMouse() { return { dx: 0, dy: 0 }; }
}
function step(s, input, n) { for (let i = 0; i < n; i++) simStep(s, DT, input); }
function aimAt(shooter, target, yOff = 1.15) {
  const o = { x: shooter.x, y: shooter.y + 1.68, z: shooter.z };
  const dx = target.x - o.x, dy = (target.y + yOff) - o.y, dz = target.z - o.z;
  const l = Math.hypot(dx, dy, dz);
  return { x: dx / l, y: dy / l, z: dz / l };
}
function duelSetup(weaponKey, kevlar = false) {
  const s = createState();
  s.round.phase = 'live'; s.round.timer = 100;
  const sh = s.agents[0], tg = s.agents[5];
  sh.x = 20; sh.z = 25; sh.yaw = 0; tg.x = 25; tg.z = 25; tg.yaw = Math.PI;
  sh.weapons.primary = createLoadout(weaponKey); sh.current = 'primary';
  tg.kevlar = kevlar; tg.hp = 100;
  return { s, sh, tg };
}
function shootTimes(s, sh, tg, n, yOff = 1.15) {
  let last = null;
  for (let i = 0; i < n; i++) {
    s.now += 60 / WEAPONS[currentWeapon(sh).key].rpm + 0.01;
    last = fire(sh, s, aimAt(sh, tg, yOff));
    if (!tg.alive) break;
  }
  return last;
}

// ---------- (2) damage ----------
{
  let t = duelSetup('P9'); shootTimes(t.s, t.sh, t.tg, 4);
  check('P9 4 hit torso = mati', !t.tg.alive, `hp=${t.tg.hp}`);
  t = duelSetup('VK47'); shootTimes(t.s, t.sh, t.tg, 3);
  check('VK-47 3 hit torso = mati', !t.tg.alive, `hp=${t.tg.hp}`);
  t = duelSetup('Longbow'); shootTimes(t.s, t.sh, t.tg, 1);
  check('Longbow 1 hit torso = mati', !t.tg.alive, `hp=${t.tg.hp}`);
  t = duelSetup('P9'); const r = shootTimes(t.s, t.sh, t.tg, 1, 1.62);
  check('Headshot P9 = 52 dmg (x2)', r && r.damage === 52 && r.zone === 'head', `dmg=${r && r.damage} zone=${r && r.zone}`);
  t = duelSetup('Longbow'); t.sh.scoped = true; // optik 2,5x: spread 0,0005 (tanpa optik 0,050 tak bisa headshot presisi)
  const rh = shootTimes(t.s, t.sh, t.tg, 1, 1.62);
  check('Headshot Longbow = 440 dmg (x4)', rh && rh.damage === 440, `dmg=${rh && rh.damage}`);
  t = duelSetup('P9', true); const rk = shootTimes(t.s, t.sh, t.tg, 1);
  check('Kevlar x0,65 (P9 torso 26->17)', rk && rk.damage === 17, `dmg=${rk && rk.damage}`);
  t = duelSetup('P9'); const rl = shootTimes(t.s, t.sh, t.tg, 1, 0.4);
  check('Tembak kaki x0,75 (26->20, zone leg)', rl && rl.damage === 20 && rl.zone === 'leg', `dmg=${rl && rl.damage} zone=${rl && rl.zone}`);
}

// ---------- (6) A* ----------
{
  const tun = aStar(nearestNode(12, 10), nearestNode(12, 40));
  const tunNodes = tun.map(i => NODES[i]);
  const viaTunnel = tunNodes.some(n => n.tags.includes('tunnel'));
  check('A* B-tunnel -> A-long lewat service tunnel', viaTunnel && tun.length > 0,
    `nodes=${tun.length} viaTunnel=${viaTunnel}`);
  const door = aStar(nearestNode(12, 25), nearestNode(52, 25));
  const viaDoor = door.some(i => NODES[i].tags.includes('door'));
  check('A* Mid barat -> timur lewat node pintu', viaDoor, `nodes=${door.length}`);
  check('Waypoint total 59 (48 + 9 amendemen + 2 penghubung)', NODES.length === 59, `n=${NODES.length}`);
}

// ---------- (3) plant / defuse / ledakan ----------
{
  const s = createState(), input = new DummyInput();
  s.round.phase = 'live'; s.round.timer = 100;
  const p = s.agents[0];
  s.bomb.carrierId = 0; p.x = 62; p.z = 38; // zona plant A
  input.keys.add('KeyE');
  step(s, input, Math.ceil(3.2 / DT) + 5);
  check('Plant 3,2 dtk -> fase bomb, timer 35', s.round.phase === 'bomb' && s.bomb.status === 'planted' && Math.abs(s.bomb.timer - 35) < 0.2,
    `phase=${s.round.phase} timer=${s.bomb.timer && s.bomb.timer.toFixed(1)}`);
  // ledakan: timer pendek, defender jauh dari site
  s.bomb.timer = 0.5;
  for (const d of s.agents.filter(a => a.team === 'def')) { d.x = 60; d.z = 22; d.defusing = false; }
  step(s, input, Math.ceil(1 / DT));
  check('Ledakan 35 dtk -> penyerang menang (explosion)', s.round.phase === 'end' && s.round.winner === 'atk' && s.round.reason === 'explosion',
    `winner=${s.round.winner} reason=${s.round.reason}`);
}
{
  const s = createState(), input = new DummyInput();
  s.round.phase = 'live'; s.round.timer = 100;
  const p = s.agents[0];
  s.bomb.carrierId = 0; p.x = 62; p.z = 38;
  input.keys.add('KeyE');
  step(s, input, Math.ceil(3.2 / DT) + 5);
  const d = s.agents[5];
  d.x = 62; d.z = 38; d.bot = createBotBrain('D1'); d.bot.defuseDuty = true; d.defusing = true;
  for (const a of s.agents.filter(a => a.team === 'atk')) { a.x = 5; a.z = 25; } // penyerang jauh
  input.keys.delete('KeyE');
  step(s, input, Math.ceil(5.0 / DT) + 10);
  check('Defuse 5,0 dtk -> defender menang (defuse)', s.round.phase === 'end' && s.round.winner === 'def' && s.round.reason === 'defuse',
    `winner=${s.round.winner} reason=${s.round.reason}`);
}

// ---------- (4) ekonomi ----------
{
  const s = createState();
  const a0 = s.agents[0];
  a0.pending = 600; // 2 kill
  const before = a0.money;
  endRound(s, 'atk', 'elimination');
  check('Ledger: menang +3250 + kill 600 (pending dibayar akhir ronde)',
    a0.money === before + 3250 + 600, `money=${a0.money} (awal ${before})`);
  const d0 = s.agents[5];
  check('Ledger kalah +1900', d0.money === 800 + 1900, `money=${d0.money}`);
  const s2 = createState();
  const r = buyItem(s2, s2.agents[0], 'VK47');
  check('Beli VK-47 fase buy: $800-$2700 ditolak (uang kurang)', !r.ok && s2.agents[0].money === 800, `ok=${r.ok}`);
  const s3 = createState();
  s3.agents[0].money = 5000;
  const r3 = buyItem(s3, s3.agents[0], 'VK47');
  check('Beli VK-47 dgn $5000: ok, sisa $2300', r3.ok && s3.agents[0].money === 2300, `money=${s3.agents[0].money}`);
}

// ---------- (5) bot capai site <= 15 dtk (waktu tempuh rute, spec ~13 dtk) ----------
{
  // Rute murni spawn -> Site A via A-long/service tunnel, tanpa lawan:
  // ukur langsung lewat pathfinding + gerakan bot (bukan firefight).
  const { setPath, moveAlongPath } = await import('../game/src/bots.js');
  const s = createState();
  const a = s.agents[4]; // A4 carrier
  a.bot = createBotBrain('A4');
  a.weapons.primary = createLoadout('VK47'); a.current = 'primary';
  setPath(a, nearestNode(63, 37));
  let tSite = -1;
  for (let i = 0; i < Math.ceil(30 / DT); i++) {
    moveAlongPath(s, a, DT);
    if (inZone(a, 'siteA')) { tSite = i * DT; break; }
  }
  check('Bot capai Site A <= 15 dtk (rute murni, spawn->site)', tSite >= 0 && tSite <= 15, `t=${tSite >= 0 ? tSite.toFixed(1) + ' dtk' : 'tidak sampai'}`);
  // Cek live (longgar, ada lawan): penyerang manapun mencapai site dalam 1 ronde.
  const s2 = createState(), input = new DummyInput();
  for (const ag of s2.agents) if (!ag.isPlayer) ag.bot = createBotBrain(ag.role);
  s2.agents[0].isPlayer = false; s2.agents[0].bot = createBotBrain('A1'); // bot-vs-bot: pemain memimpin
  step(s2, input, Math.ceil(12 / DT));
  let liveSite = false;
  for (let i = 0; i < Math.ceil(100 / DT); i++) {
    simStep(s2, DT, input);
    if (s2.agents.some(ag => ag.team === 'atk' && ag.alive && (inZone(ag, 'siteA') || inZone(ag, 'siteB')))) { liveSite = true; break; }
    if (s2.round.phase === 'end') break;
  }
  check('Live: penyerang mencapai site dalam 1 ronde', liveSite);
}

// ---------- (7) asap memutus LOS + pintu buka ----------
{
  const s = createState();
  const blocked = losBlocked(20, 1.5, 25, 40, 1.5, 25, [{ x: 30, y: 1.5, z: 25, r: 3.5 }], 1);
  const clear = losBlocked(20, 1.5, 25, 40, 1.5, 25, [], 1);
  check('Asap memutus LOS', blocked && !clear, `blocked=${blocked} clear=${clear}`);
  const s2 = createState(), input = new DummyInput();
  s2.agents[0].x = 28; s2.agents[0].z = 25; // dekat pintu
  step(s2, input, Math.ceil(3 / DT));
  check('Pintu Mid terbuka saat agen <=3 m', s2.door.open > 0.5, `open=${s2.door.open.toFixed(2)}`);
}

// ---------- (1) match bot-vs-bot ----------
{
  const input = new DummyInput();
  let matches = 0, roundsSeen = 0;
  for (let m = 0; m < 3 && matches < 3; m++) {
    const s = createState();
    for (const a of s.agents) { if (a.isPlayer) { a.isPlayer = false; a.bot = createBotBrain('A1'); } else a.bot = createBotBrain(a.role); }
    let lastRound = 1, ticks = 0, roundTicks = 0;
    const maxTicks = 60 * 60 * 18; // 18 mnt sim per match
    while (!s.match.over && ticks < maxTicks) {
      simStep(s, DT, input); ticks++; roundTicks++;
      if (s.round.phase === 'end' && s.round.winner) {
        roundsSeen++;
        console.log(`  match ${m + 1} ronde ${s.match.round}: ${s.round.winner} (${s.round.reason}) skor ${s.match.scoreAtk}-${s.match.scoreDef} durasi ${(roundTicks * DT).toFixed(0)} dtk`);
        // tunggu banner selesai -> ronde berikut (tandai agar tak log 2x)
        while (s.round.phase === 'end' && !s.match.over && ticks < maxTicks) { simStep(s, DT, input); ticks++; }
        roundTicks = 0; lastRound = s.match.round;
      }
    }
    matches++;
    console.log(`  match ${m + 1} selesai: skor ${s.match.scoreAtk}-${s.match.scoreDef} over=${s.match.over} ticks=${ticks}`);
    if (s.match.over) break;
  }
  check('Match bot-vs-bot: ada ronde berakhir', roundsSeen > 0, `ronde=${roundsSeen} match=${matches}`);
}

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
