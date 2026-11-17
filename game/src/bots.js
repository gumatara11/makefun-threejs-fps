// EMBERLINE sim — bots.js. AI §4: peran, persepsi, pendengaran, A*, playbook bom.
import { CONFIG, WEAPONS, BOT_ROLES } from './config.js';
import { NODES, LINKS, nearestNode, aStar, losBlocked, collideMove, inZone, ZONES } from './world.js';
import { fire, startReload, createLoadout, throwGrenade } from './weapons.js';
import { dirFromYawPitch } from './combat.js';
import { pushEvent, currentWeapon, aliveAgents } from './state.js';

export function createBotBrain(role) {
  const r = BOT_ROLES[role];
  return { role, kind: r.kind, site: r.site || null, state: 'patrol',
    path: [], pathIdx: 0, destNode: -1, repathAt: 0, goal: -1,
    targetId: null, targetPos: null, lastSeenAt: -99, visibleSince: 0, reactAt: 0,
    losAt: Math.random() * 0.12, hearPos: null, hearAt: -99,
    burstLeft: 0, burstUntil: 0, round: 1, holdNode: -1, plantSite: 'A', routeDoor: false,
    strafeT: 0, strafeDir: 1, retakeRoute: 0, lastBuyRound: 0,
    holdBomb: false, stuckAt: 0, lastPX: 0, lastPZ: 0, nudges: 0 };
}
export function ensureBrains(s) {
  for (const a of s.agents) if (!a.isPlayer && !a.bot) a.bot = createBotBrain(a.role);
  for (const a of s.agents) if (a.bot) a.bot.round = s.match.round;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function eyeY(a) { return a.y + (a.crouch ? 1.08 : 1.68); }
function angleTo(a, x, z) { return Math.atan2(z - a.z, x - a.x); }
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); }

// --- persepsi: LOS bergilir 0,12 dtk, terlihat 0,15 dtk, reaksi per peran ---
function perceive(s, a, dt) {
  const b = a.bot;
  if (s.now < b.losAt) return;
  b.losAt = s.now + CONFIG.perception.losInterval;
  let best = null, bestD = Infinity, periph = false;
  for (const e of s.agents) {
    if (!e.alive || e.team === a.team) continue;
    const d = dist(a, e);
    if (d > CONFIG.perception.viewDist) continue;
    const ang = angDiff(angleTo(a, e.x, e.z), a.yaw);
    const moving = Math.hypot(e.vx, e.vz) > 0.5;
    const inFov = ang <= CONFIG.perception.fovDeg / 2 * Math.PI / 180;
    const inPeriph = moving && d <= CONFIG.perception.periphDist && ang <= CONFIG.perception.periphDeg / 2 * Math.PI / 180;
    if (!inFov && !inPeriph) continue;
    // LOS torso + kepala; asap/dinding/cover memutus
    const clear = !losBlocked(a.x, eyeY(a), a.z, e.x, e.y + 0.9, e.z, s.smokes, s.door.open)
      || !losBlocked(a.x, eyeY(a), a.z, e.x, e.y + 1.62, e.z, s.smokes, s.door.open);
    if (!clear) continue;
    if (d < bestD) { best = e; bestD = d; periph = inPeriph && !inFov; }
  }
  if (best) {
    if (b.targetId !== best.id) { b.targetId = best.id; b.visibleSince = s.now; }
    b.targetPos = { x: best.x, z: best.z }; b.lastSeenAt = s.now;
    const react = CONFIG.perception.reaction[b.kind] || CONFIG.perception.reaction.def;
    b.reactAt = b.visibleSince + CONFIG.perception.visibleTime + react * (periph ? 2 : 1); // AMB-14
    b.state = 'engage';
  } else if (b.targetId !== null && s.now - b.lastSeenAt > CONFIG.perception.memory) {
    b.targetId = null; b.targetPos = null; b.state = 'patrol';
  }
}
// --- pendengaran: radius per jenis suara, dinding x0,5 ---
function hear(s, a) {
  const b = a.bot;
  for (const ev of s.events) {
    if (ev.type !== 'noise' || ev.t < s.now - 0.15 || ev.team === a.team) continue;
    const d = Math.hypot(a.x - ev.x, a.z - ev.z);
    let r = ev.radius;
    if (losBlocked(a.x, 1, a.z, ev.x, 1, ev.z, [], s.door.open)) r *= CONFIG.hearing.wallMul;
    if (d > r) continue;
    b.hearPos = { x: ev.x, z: ev.z }; b.hearAt = s.now;
    if (b.kind === 'holder') a.yaw = angleTo(a, ev.x, ev.z); // AMB-13: holder menoleh
    else if (b.kind === 'rotator' && b.state !== 'engage') b.state = 'investigate';
  }
}
export function setPath(a, toNode) {
  // 'from' harus node yang terjangkau langsung (LOS jelas) — nearestNode mentah
  // bisa menunjuk node di seberang dinding (mis. node tunnel (30,20) untuk bot
  // di (33,20) di luar dinding tunnel), sehingga path diawali node yang tak bisa
  // dicapai dan bot macet di balik dinding sampai ronde berakhir.
  let from = nearestNode(a.x, a.z);
  if (losBlocked(a.x, 1, a.z, NODES[from].x, 1, NODES[from].z, [], 1)) {
    let best = -1, bd = Infinity;
    NODES.forEach((n, i) => {
      const d = (n.x - a.x) ** 2 + (n.z - a.z) ** 2;
      if (d < bd && !losBlocked(a.x, 1, a.z, n.x, 1, n.z, [], 1)) { bd = d; best = i; }
    });
    if (best >= 0) from = best;
  }
  let path = aStar(from, toNode);
  if (!path.length && from !== toNode) {
    // Tujuan tak terjangkau (node terisolasi, mis. siteA (59,33)/(66,41) atau
    // (57,42) yang hanya terhubung satu sama lain): pilih node terdekat dengan
    // tujuan yang masih terjangkau dari posisi bot, agar bot tak diam dengan path kosong.
    const seen = new Set([from]), q = [from];
    while (q.length) { const c = q.pop(); for (const nb of LINKS[c]) if (!seen.has(nb)) { seen.add(nb); q.push(nb); } }
    let best = from, bd = Infinity;
    for (const i of seen) {
      const d = (NODES[i].x - NODES[toNode].x) ** 2 + (NODES[i].z - NODES[toNode].z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    toNode = best; path = aStar(from, best);
  }
  a.bot.path = path; a.bot.pathIdx = 0; a.bot.destNode = toNode;
}
function nodeByTag(tag, x = null) {
  const list = NODES.map((n, i) => ({ n, i })).filter(o => o.n.tags.includes(tag));
  if (x === null) return list[0].i;
  return list.sort((p, q) => Math.abs(p.n.x - x) - Math.abs(q.n.x - x))[0].i;
}
function goalNode(s, a) {
  const b = a.bot, planted = s.bomb && s.bomb.status === 'planted';
  if (a.team === 'atk') {
    if (planted) { // post-plant: dalam radius 12 m dari bom
      const bx = s.bomb.x, bz = s.bomb.z;
      if (dist(a, { x: bx, z: bz }) > 10) return nearestNode(bx + 4, bz);
      return b.destNode >= 0 ? b.destNode : nearestNode(a.x, a.z);
    }
    if (s.bomb && s.bomb.status === 'dropped') return nearestNode(s.bomb.x, s.bomb.z);
    // AM2 (keputusan koordinator 17 Nov 01:51): service tunnel DITERIMA sebagai
    // rute utama carrier — A* memilihnya karena itu rute TERPENDEK, bukan bug.
    // Pintu Mid TIDAK dipaksa untuk carrier: rute lebih panjang + artifisial.
    // Pintu tetap bernilai (memutus sightline + meredam suara saat tertutup, rute
    // pemain); fungsinya sudah terbukti (path paksa via node pintu: pintu terbuka
    // 1,00, bot lolos, plant sukses). Jadi: carrier ikut A* apa adanya.
    if (s.bomb && s.bomb.carrierId === a.id) return nodeByTag(b.plantSite === 'A' ? 'siteA' : 'siteB', 63);
    if (b.kind === 'rusher' || b.kind === 'rifleman') { // ikuti pemain (offset)
      const p = s.agents[0];
      if (p.id === a.id) return nodeByTag('siteA', 63); // bot jadi pemain: pimpin ke site
      return nearestNode(p.x + (b.kind === 'rusher' ? 3 : -4), p.z + (b.kind === 'rusher' ? 0 : 4));
    }
    if (b.kind === 'lurker') return nodeByTag('siteB', 63); // lane lain dari pemain, terus ke B
    return nodeByTag('mid', 30); // carrier / holder Mid
  }
  // defender
  if (planted) {
    if (b.state === 'defuse' || b.defuseDuty) return nodeByTag(s.bomb.site === 'A' ? 'siteA' : 'siteB', 63);
    return nodeByTag(s.bomb.site === 'A' ? 'siteA' : 'siteB', 59); // retake
  }
  if (b.kind === 'holder') return nodeByTag(b.site === 'A' ? 'siteA' : 'siteB', 63);
  if (b.kind === 'sniper') return nodeByTag('along', 52);
  if (b.kind === 'rotator') {
    if (b.hearPos && s.now - b.hearAt < 3) return nearestNode(b.hearPos.x, b.hearPos.z);
    return nodeByTag('mid', 42);
  }
  return -1;
}
export function moveAlongPath(s, a, dt) {
  const b = a.bot;
  if (!b.path.length || b.pathIdx >= b.path.length) return;
  // Unstuck (jarak NETO dari anchor, bukan akumulasi absolut): bot yang bergetar
  // di tempat (separate() vs moveAlongPath saling dorong) mengakumulasi movedAcc
  // tapi tak maju — D3 mengukur perpindahan neto, jadi unstuck harus sama.
  // Neto <0,5 m selama >0,8 dtk -> repath; 0,8 dtk lagi -> snap ke node LOS-bersih.
  // Batas D3 = 2 dtk, jadi total maks ~1,6 dtk + 0,2 dtk jalan.
  const netMoved = Math.hypot(a.x - b.lastPX, a.z - b.lastPZ);
  if (netMoved > 0.5) { b.lastPX = a.x; b.lastPZ = a.z; b.stuckAt = s.now; b.nudges = 0; }
  else if (s.now - b.stuckAt > 0.8 && b.destNode >= 0) {
    b.stuckAt = s.now;
    if (b.nudges === 0) { setPath(a, b.destNode); b.nudges = 1; }
    else {
      // coba 3 node berikut, ambil yang LOS-nya bersih dari posisi bot
      let snapped = false;
      for (let k = b.pathIdx; k < Math.min(b.pathIdx + 3, b.path.length); k++) {
        const n = NODES[b.path[k]];
        if (n && !losBlocked(a.x, 1, a.z, n.x, 1, n.z, [], s.door.open)) { a.x = n.x; a.z = n.z; b.pathIdx = k; snapped = true; break; }
      }
      if (!snapped) {
        // D3 (17 Nov): pilar pintu S(29.7,21,30.3,23)/(27,29) di tengah tunnel —
        // rantai tunnel paksa 50->51 (world.js force) jalurnya lurus menembus
        // pilar, jadi LOS ke node berikut terhalang dan repath mengembalikan
        // jalur yang sama. Bot soliter (tanpa dorongan separate()) macet di
        // pilar. Geser menyamping ~1,2 m (tegak lurus arah node) lewat
        // collideMove agar masuk lajur samping tunnel (x 28-29,7 / 30,3-32)
        // yang selalu terbuka; dari sana bot bisa jalan lurus ke node berikut.
        const n = NODES[b.path[b.pathIdx]];
        if (n) {
          const dx = n.x - a.x, dz = n.z - a.z, len = Math.hypot(dx, dz) || 1;
          const px = -dz / len, pz = dx / len;
          const side = (a.id % 2 === 0) ? 1 : -1;
          const h = a.crouch ? CONFIG.agentHeightCrouch : CONFIG.agentHeight;
          let r = collideMove(a, px * side * 1.2, 0, pz * side * 1.2, CONFIG.agentRadius, h, s.door.open);
          if (r.x === a.x && r.z === a.z) r = collideMove(a, -px * side * 1.2, 0, -pz * side * 1.2, CONFIG.agentRadius, h, s.door.open);
          a.x = r.x; a.z = r.z;
        }
      }
      b.nudges = 0; setPath(a, b.destNode);
    }
  }
  const n = NODES[b.path[b.pathIdx]];
  if (!n) return; // path kosong (tak terjangkau) — setPath sudah fallback, jaga-jaga
  const d = Math.hypot(n.x - a.x, n.z - a.z);
  if (d < 0.8) { b.pathIdx++; return; }
  const w = currentWeapon(a);
  const speed = (w ? WEAPONS[w.key].speed : 5.2) * (b.kind === 'lurker' && d < 15 ? 0.5 : 1);
  const yawT = Math.atan2(n.z - a.z, n.x - a.x);
  a.yaw = yawT;
  a.vx = Math.cos(yawT) * speed; a.vz = Math.sin(yawT) * speed;
  const h = a.crouch ? CONFIG.agentHeightCrouch : CONFIG.agentHeight;
  const r = collideMove(a, a.vx * dt, 0, a.vz * dt, CONFIG.agentRadius, h, s.door.open);
  a.x = r.x; a.z = r.z;
  // Terjepit di sudut/dinding (mis. node (57,40) tepat di bibir celah pintu Site A):
  // bila sudah dekat node tapi tertahan solid, anggap node tercapai dan lanjut ke
  // node berikut — arah ke node berikut punya komponen menyamping yang menggeser
  // bot mengitari sudut (collideMove sudah slide per sumbu).
  if ((r.hitX || r.hitZ) && d < 2.5) { b.pathIdx++; b.stuckAt = s.now; b.lastPX = a.x; b.lastPZ = a.z; }
  else if ((r.hitX || r.hitZ) && s.now > b.repathAt) { b.repathAt = s.now + 1; setPath(a, b.destNode); }
}
// Pisah antar-bot 0,6 m (AMB-17); penanam/pen-defuse diprioritaskan (tak digeser).
// Dorongan HARUS sadar collision: dorongan mentah bisa mendorong bot ke dalam
// solid (mis. dinding S(45.5,29,46,36) konektor Mid-A) lalu collideMove tak bisa
// mengeluarkannya lagi -> macet puluhan detik. Dorong lewat collideMove per sumbu.
function separate(s) {
  const list = aliveAgents(s);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d < CONFIG.bot.separation && d > 0.001) {
      const push = (CONFIG.bot.separation - d) / 2, ux = (a.x - b.x) / d, uz = (a.z - b.z) / d;
      if (!a.planting && !a.defusing) {
        const h = a.crouch ? CONFIG.agentHeightCrouch : CONFIG.agentHeight;
        const r = collideMove(a, ux * push, 0, uz * push, CONFIG.agentRadius, h, s.door.open);
        a.x = r.x; a.z = r.z;
      }
      if (!b.planting && !b.defusing) {
        const h = b.crouch ? CONFIG.agentHeightCrouch : CONFIG.agentHeight;
        const r = collideMove(b, -ux * push, 0, -uz * push, CONFIG.agentRadius, h, s.door.open);
        b.x = r.x; b.z = r.z;
      }
    }
  }
}
function botShoot(s, a, dt) {
  const b = a.bot;
  if (s.now < b.reactAt || s.now < a.blindUntil) return;
  const t = s.agents[b.targetId];
  if (!t || !t.alive) return;
  // bidik dada/kepala + spread ditangani weapons.fire (akurasi bot per ronde)
  const ty = t.y + (t.crouch ? 0.8 : 1.35);
  const dx = t.x - a.x, dy = ty - eyeY(a), dz = t.z - a.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  const w = currentWeapon(a);
  if (!w) return;
  if (w.key === 'Longbow') { // 1 tembakan lalu reposisi
    if (b.burstLeft <= 0) { b.burstLeft = 1; b.burstUntil = s.now + 1.5; setPath(a, nodeByTag('along', a.x + 8)); }
  } else if (b.burstLeft <= 0) {
    if (s.now < b.burstUntil) return;
    b.burstLeft = 3 + Math.floor(Math.random() * 3); // burst 3-5
  }
  const r = fire(a, s, { x: dx / len, y: dy / len, z: dz / len });
  if (r && !r.dry) b.burstLeft--;
  if (b.burstLeft <= 0 && w.key !== 'Longbow') b.burstUntil = s.now + CONFIG.bot.burstPause;
}
export function updateBots(s, dt) {
  ensureBrains(s);
  for (const a of s.agents) {
    if (a.isPlayer || !a.alive || !a.bot) continue;
    if (s.round.phase === 'buy' || s.round.phase === 'end') { a.vx = 0; a.vz = 0; continue; }
    const b = a.bot;
    perceive(s, a, dt); hear(s, a);
    const t = b.targetId !== null ? s.agents[b.targetId] : null;
    const isCarrier = s.bomb && s.bomb.carrierId === a.id && s.round.phase === 'live'
      && !(s.bomb.status === 'planted');
    // Carrier terus maju ke site (tugasnya menanam); duel penuh hanya bila musuh <20 m.
    if (t && t.alive && s.now >= b.reactAt && s.now >= a.blindUntil && (!isCarrier || dist(a, t) < 20)) {
      // engage: hadap target, strafe, tembak; jangan jalan saat menembak jarak dekat
      // Path lama DIBERSIHKAN: bot yang duel bukan "macet" — ia berhenti di rute untuk
      // bertarung, dan strafe 1,5 m/s < ambang gerak D3 (0,05 m/tick). Tujuan dihitung
      // ulang saat duel selesai (patrol/plant branch memanggil setPath).
      // D3 (17 Nov): goal dilacak terpisah dari destNode. setPath() punya fallback
      // (tujuan terisolasi, mis. node siteA 40 (59,33) 0 link di balik kontainer)
      // yang mengubah destNode ke node terdekat yang terjangkau (mis. 57), sehingga
      // perbandingan g !== destNode SELALU benar -> setPath dipanggil tiap tick ->
      // pathIdx di-reset ke 0 terus -> bot beku di tempat dengan velocity stale.
      // Dengan b.goal, setPath hanya dipanggil bila TUJUAN (goalNode) berubah.
      if (b.path.length) { b.path = []; b.pathIdx = 0; b.destNode = -1; b.goal = -1; }
      a.yaw = angleTo(a, t.x, t.z);
      b.strafeT -= dt;
      if (b.strafeT <= 0) { b.strafeT = 0.7 + Math.random(); b.strafeDir *= -1; }
      const d = dist(a, t);
      if (d > 10) { // tetap maju sambil duel (3,5 m/s + strafe), jangan terpaku
        a.vx = Math.cos(a.yaw) * 3.5 - Math.sin(a.yaw) * b.strafeDir * 1.2;
        a.vz = Math.sin(a.yaw) * 3.5 + Math.cos(a.yaw) * b.strafeDir * 1.2;
      } else { a.vx = -Math.sin(a.yaw) * b.strafeDir * 1.5; a.vz = Math.cos(a.yaw) * b.strafeDir * 1.5; }
      const h = a.crouch ? CONFIG.agentHeightCrouch : CONFIG.agentHeight;
      const r = collideMove(a, a.vx * dt, 0, a.vz * dt, CONFIG.agentRadius, h, s.door.open);
      a.x = r.x; a.z = r.z;
      botShoot(s, a, dt);
      continue;
    }
    // plant / defuse duty
    const planted = s.bomb && s.bomb.status === 'planted';
    if (!planted && s.bomb && s.bomb.carrierId === a.id) {
      const site = b.plantSite === 'A' ? 'plantA' : 'plantB';
      if (inZone(a, site)) { a.planting = true; }
      else { a.planting = false; const g = goalNode(s, a); if (g >= 0 && g !== b.goal) { b.goal = g; setPath(a, g); } moveAlongPath(s, a, dt); if (t && t.alive && s.now >= b.reactAt) botShoot(s, a, dt); }
      continue;
    }
    if (planted && b.defuseDuty) {
      const site = s.bomb.site === 'A' ? 'plantA' : 'plantB';
      if (inZone(a, site)) a.defusing = true;
      else { a.defusing = false; const g = goalNode(s, a); if (g >= 0 && g !== b.goal) { b.goal = g; setPath(a, g); } moveAlongPath(s, a, dt); }
      continue;
    }
    // patrol / investigate / retake
    let g = goalNode(s, a);
    if (b.state === 'investigate' && b.hearPos) g = nearestNode(b.hearPos.x, b.hearPos.z);
    if (g >= 0 && g !== b.goal) { b.goal = g; setPath(a, g); }
    if (g >= 0) moveAlongPath(s, a, dt);
    else { a.vx = 0; a.vz = 0; }
  }
  separate(s);
}
// --- beli bot §4: serentak awal fase beli, deterministik ---
export function buyBots(s) {
  for (const a of s.agents) {
    if (a.isPlayer || !a.bot) continue;
    const b = a.bot, m = a.money;
    const want = (key, price) => { if (!a.weapons.primary && m >= price) { a.weapons.primary = createLoadout(key); a.money -= price; a.current = 'primary'; } };
    if (b.role === 'D2') {
      if (m >= 5400) { // Longbow + kevlar
        if (!a.weapons.primary) { a.weapons.primary = createLoadout('Longbow'); a.money -= 4750; a.current = 'primary'; }
        if (!a.kevlar && a.money >= 650) { a.kevlar = true; a.money -= 650; }
      } else if (s.match.d2LoseStreak >= 3) {
        buyStandard(a);
      } // else menabung (eco)
    } else buyStandard(a);
    // granat: Frag lalu Flash bila sisa cukup; bot TIDAK beli Smoke (AMB-19)
    if (a.money >= 300 && !a.grenades.Frag) { a.grenades.Frag = 1; a.money -= 300; }
    if (a.money >= 200 && !a.grenades.Flash) { a.grenades.Flash = 1; a.money -= 200; }
  }
}
function buyStandard(a) {
  for (const row of [{ min: 3350, w: 'VK47' }, { min: 2150, w: 'Kestrel' }, { min: 1700, w: 'Breacher' }]) {
    if (a.money >= row.min && !a.weapons.primary) {
      a.weapons.primary = createLoadout(row.w); a.money -= WEAPONS[row.w].price; a.current = 'primary';
      if (!a.kevlar && a.money >= 650) { a.kevlar = true; a.money -= 650; }
      return;
    }
  }
  if (a.money >= 650 && !a.kevlar) { a.kevlar = true; a.money -= 650; }
}
// Playbook bom: dipanggil tiap 1 dtk dari rounds.js
export function bombPlaybook(s) {
  const planted = s.bomb && s.bomb.status === 'planted';
  if (planted) {
    const defs = aliveAgents(s, 'def').sort((p, q) => dist(p, s.bomb) - dist(q, s.bomb));
    // D4 (17 Nov): defuser MELEKAT sampai mati. Ia harus MENJAUH dari bom
    // (memutar via Mid/A-long mengitari kontainer) untuk masuk site, jadi
    // jaraknya ke bom membesar saat memutar — "terdekat" akan terus berganti
    // dan tak ada yang sampai site. Histeresis jarak tak cukup; hanya ganti
    // bila defuser lama mati (atau belum ada).
    const cur = defs.find(d => d.bot.defuseDuty);
    let lead = defs[0];
    if (cur && cur.alive) lead = cur;
    defs.forEach((d, i) => { d.bot.defuseDuty = d === lead; d.bot.retakeRoute = i % 2; });
    return;
  }
  if (s.bomb && s.bomb.status === 'dropped') {
    const atks = aliveAgents(s, 'atk');
    if (!atks.length) return;
    const near = atks.sort((p, q) => dist(p, s.bomb) - dist(q, s.bomb))[0];
    // dipaksa ambil bila 10 dtk tak diambil (cek di rounds.js via droppedAt)
    if (s.now - s.bomb.droppedAt > CONFIG.bot.bombPickupForceAfter && near.bot) near.bot.state = 'patrol'; // pemain (bot null) tak punya state bot
  }
}
