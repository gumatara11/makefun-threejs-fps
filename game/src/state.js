// EMBERLINE sim — state.js. Satu tempat state; modul lain tidak menyimpan state.
import { CONFIG, WEAPONS, ROLE_ORDER } from './config.js';
import { SPAWNS } from './world.js';

export function makeAgent(id, team, role, isPlayer, x, z) {
  return {
    id, team, role, isPlayer, name: isPlayer ? 'Kamu' : role,
    x, z, y: 0, vx: 0, vy: 0, vz: 0, yaw: team === 'atk' ? 0 : Math.PI, pitch: 0,
    hp: CONFIG.hpMax, alive: true, crouch: false, onGround: true,
    weapons: { primary: null, secondary: { key: 'P9', mag: 12, reserve: 48 } },
    current: 'secondary', kevlar: false,
    grenades: { Frag: 0, Smoke: 0, Flash: 0 },
    money: CONFIG.moneyStart, pending: 0,
    kills: 0, deaths: 0, plants: 0, defuses: 0,
    reloadUntil: 0, reloadSlot: null, switchUntil: 0, nextShotAt: 0,
    recoilShots: 0, lastShotAt: -99, spraySeed: Math.random() * 1000,
    scoped: false, blindUntil: 0, planting: false, defusing: false,
    plantProg: 0, defuseProg: 0, stepAt: 0, ePrev: false,
    bot: null, // diisi bots.createBotBrain(role) untuk bot
  };
}

export function createState() {
  const s = {
    now: 0, tick: 0, paused: false,
    match: { scoreAtk: 0, scoreDef: 0, round: 1, over: false, winner: null, d2LoseStreak: 0 },
    round: { phase: 'buy', timer: CONFIG.timeBuy, winner: null, reason: null,
      buyDone: false, plantedSite: null, endTimer: 0 },
    agents: [], bomb: null, dropped: [], grenadesActive: [], smokes: [],
    events: [], // {t,type,...} killfeed / hitmarker / suara (satu bus, dipakai bots+audio+hud)
    door: { open: 0, target: 0, emptySince: 0 },
    stats: { shots: 0, hits: 0 },
  };
  resetMatch(s);
  return s;
}

export function resetMatch(s) {
  s.match.scoreAtk = 0; s.match.scoreDef = 0; s.match.round = 1;
  s.match.over = false; s.match.winner = null; s.match.d2LoseStreak = 0;
  s.agents = [];
  // pemain = id 0 penyerang; bot 1-4 penyerang, 5-9 defender
  const atk = SPAWNS.atk, def = SPAWNS.def;
  s.agents.push(makeAgent(0, 'atk', 'P', true, atk[0].x, atk[0].z));
  for (let i = 0; i < 4; i++) {
    const r = ROLE_ORDER[i];
    s.agents.push(makeAgent(i + 1, 'atk', r, false, atk[i + 1].x, atk[i + 1].z));
  }
  for (let i = 0; i < 5; i++) {
    const r = ROLE_ORDER[4 + i];
    s.agents.push(makeAgent(5 + i, 'def', r, false, def[i].x, def[i].z));
  }
  for (const a of s.agents) { a.money = CONFIG.moneyStart; a.pending = 0; a.kills = 0; a.deaths = 0; a.plants = 0; a.defuses = 0; }
  s.events = []; s.dropped = []; s.grenadesActive = []; s.smokes = [];
  resetRound(s, true);
}

// AMB-25: satu daftar reset antar-ronde.
export function resetRound(s, first = false) {
  const atk = SPAWNS.atk, def = SPAWNS.def;
  s.round.phase = 'buy'; s.round.timer = CONFIG.timeBuy; s.round.winner = null;
  s.round.reason = null; s.round.buyDone = false; s.round.plantedSite = null; s.round.endTimer = 0;
  s.dropped = []; s.grenadesActive = []; s.smokes = [];
  s.door.open = 0; s.door.target = 0; s.door.emptySince = 0;
  s.agents.forEach((a, i) => {
    const wasAlive = a.alive; // carry-over §2: mati -> respawn P9 saja
    const sp = a.team === 'atk' ? atk[i % atk.length] : def[(i - 5 + 5) % def.length];
    a.x = sp.x; a.z = sp.z; a.y = 0; a.vx = 0; a.vy = 0; a.vz = 0;
    a.yaw = a.team === 'atk' ? 0 : Math.PI; a.pitch = 0;
    a.hp = CONFIG.hpMax; a.alive = true; a.crouch = false; a.onGround = true;
    a.reloadUntil = 0; a.reloadSlot = null; a.switchUntil = 0; a.nextShotAt = 0;
    a.recoilShots = 0; a.scoped = false; a.blindUntil = 0;
    a.planting = false; a.defusing = false; a.plantProg = 0; a.defuseProg = 0;
    // granat: survivor pertahankan yang tak terpakai (§2); hanya yang mati yang kehilangan
    if (first || !wasAlive) a.grenades = { Frag: 0, Smoke: 0, Flash: 0 };
    if (a.bot) { // reset penuh otak: destNode/pathIdx HARUS ikut direset, kalau tidak
      // bot yang tujuannya sama dengan ronde lalu tak pernah memanggil setPath lagi
      // (path sudah dikosongkan) dan berdiri diam sepanjang ronde
      a.bot.targetId = null; a.bot.targetPos = null; a.bot.lastSeenAt = -99;
      a.bot.visibleSince = 0; a.bot.reactAt = 0; a.bot.hearPos = null; a.bot.hearAt = -99;
      a.bot.path = []; a.bot.pathIdx = 0; a.bot.destNode = -1; a.bot.repathAt = 0; a.bot.goal = -1;
      a.bot.burstLeft = 0; a.bot.burstUntil = 0; a.bot.state = 'patrol';
      a.bot.defuseDuty = false; a.bot.holdBomb = false; a.bot.retakeRoute = 0;
      a.bot.stuckAt = 0; a.bot.nudges = 0;
      a.bot.lastPX = a.x; a.bot.lastPZ = a.z;
    }
    if (first || !wasAlive) { a.kevlar = false; a.weapons.primary = null; a.weapons.secondary = { key: 'P9', mag: 12, reserve: 48 }; a.current = 'secondary'; }
    else { // selamat: magasin primer diisi penuh gratis, cadangan tidak ditambah
      const p = a.weapons.primary;
      if (p) p.mag = WEAPONS[p.key].mag;
      a.weapons.secondary.mag = 12;
    }
  });
  // carry-over: yang hidup pertahankan primer+kevlar+granat; yang mati -> P9.
  // (Dipanggil setelah ekonomi ronde lalu; resetRound dipakai juga di awal match.)
  s.bomb = { carrierId: 4, status: 'carried', x: 0, y: 0, z: 0, site: null,
    timer: CONFIG.timeBomb, planterId: null, defuserId: null, droppedAt: 0 };
}

export function aliveAgents(s, team) {
  return s.agents.filter(a => a.alive && (!team || a.team === team));
}
export function agentById(s, id) { return s.agents[id]; }
export function pushEvent(s, ev) { ev.t = s.now; s.events.push(ev); if (s.events.length > 200) s.events.splice(0, s.events.length - 200); }
export function currentWeapon(a) {
  return a.current === 'primary' ? a.weapons.primary : a.weapons.secondary;
}
