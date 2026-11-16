# EMBERLINE — Interfaces (Builder A sim ↔ Builder B presentasi)

Sim murni: tanpa three.js, tanpa DOM. Semua modul di `game/src/` bisa di-import Node.
Import order (spec §5): config, state, world, weapons, combat, bots, rounds, player,
input, grenades. (characters/render/audio/hud/shots = Builder B.)

## Exports per modul

- **config.js** — `CONFIG` (waktu, ekonomi, gerakan, persepsi, pendengaran, bot),
  `WEAPONS` (P9/Breacher/Kestrel/VK47/Longbow), `GRENADES` (Frag/Smoke/Flash),
  `BOT_ROLES`, `BUY_TABLE`, `D2_LONGBOW_MIN`.
- **state.js** — `createState()`, `resetMatch(s)`, `resetRound(s, first)`,
  `makeAgent()`, `aliveAgents(s, team?)`, `agentById(s, id)`, `pushEvent(s, ev)`,
  `currentWeapon(a)`.
- **world.js** — `SPAWNS`, `ZONES`, `SOLIDS`, `DOOR_PANEL`, `NODES` (59 node),
  `LINKS`, `collideMove(pos, dx, dy, dz, radius, height, doorOpen)`,
  `losBlocked(ax,ay,az,bx,by,bz, smokes=[], doorOpen=1)`,
  `raySolids(ox,oy,oz,dx,dy,dz, maxDist, doorOpen)`, `inZone(p, name)`,
  `inTunnel(p)`, `nearestNode(x,z)`, `aStar(fromId, toId)`.
- **input.js** — `InputState`: `keys` (Set kode), `mouseDown/rightDown`, `locked`,
  `paused`, `attach(el)`, `detach()`, `onFocusLoss()`, `consumeMouse()`,
  `down(code)`, `pressed(code)` (one-shot).
- **player.js** — `updatePlayer(s, input, dt)` (gerak/crouch/lompat/scope; bunyi langkah
  masuk `s.events` sebagai noise).
- **weapons.js** — `createLoadout(key)`, `spreadFor(a, w, moving)`,
  `fire(a, state, aimDir?)` (satu jalur pemain+bot), `updateWeapons(s)`,
  `startReload(a, now)`, `switchWeapon(a, slot, now)`, `throwGrenade(a, s, kind)`,
  `dropWeapon(a, s)`, `pickupWeapon(a, s)`.
- **grenades.js** — `createProjectile(s, a, kind, dir)`, `updateGrenades(s, dt)`,
  `smokeBlocks(ax,ay,az,bx,by,bz, smokes)`.
- **combat.js** — `dirFromYawPitch(yaw, pitch)`, `eyePos(a)`,
  `shoot(state, shooter, dir, weapon)` → `{hit, target, zone, damage, distance}`,
  `applyDamage(state, target, dmg, attacker, zone, cause)`,
  `explosiveDamage(state, x,y,z, radius, dmgCenter, dmgEdge, attacker)`.
- **bots.js** — `createBotBrain(role)`, `ensureBrains(s)`, `updateBots(s, dt)`,
  `buyBots(s)`, `bombPlaybook(s)`.
- **rounds.js** — `simStep(s, dt, input)` (orkestrator tick), `endRound(s, team, reason)`,
  `buyItem(s, agent, key)` → `{ok, why?}`, `playAgain(s)`,
  debug: `forcePlant(s)`, `forceDefuse(s)`, `killAll(s, team?)`,
  `setMoney(s, id, amt)`, `setRound(s, n)`.

## Bentuk state (ringkas)

```
s.now, s.tick, s.paused
s.match { scoreAtk, scoreDef, round, over, winner, d2LoseStreak }
s.round { phase: 'buy'|'live'|'bomb'|'end', timer, winner, reason, plantedSite, endTimer, buyDone }
s.agents[10] { id, team, role, isPlayer, x,y,z, vx,vy,vz, yaw, pitch, hp, alive, crouch,
  onGround, weapons:{primary|null, secondary:{key,mag,reserve}}, current, kevlar,
  grenades:{Frag,Smoke,Flash}, money, pending, kills, deaths, plants, defuses,
  reloadUntil, reloadSlot, switchUntil, nextShotAt, recoilShots, scoped, blindUntil,
  planting, defusing, plantProg, defuseProg, bot|null }
s.bomb { carrierId, status:'carried'|'dropped'|'planted'|'exploded'|'defused',
  x,y,z, site, timer, planterId, defuserId, droppedAt }
s.dropped[] {key,mag,reserve,x,z}; s.grenadesActive[]; s.smokes[] {x,y,z,r,until}
s.events[] {t, type, ...}  // kill, hit, hitmarker, noise{kind,x,z,radius,team},
  // muzzle, explosion, smoke, flash, blind, plant, defuse, bomb-drop, bomb-take,
  // round-end, beep, dryclick
s.door { open 0..1, target, emptySince }
```

Agen: id 0 = pemain (atk), 1–4 bot atk (A1–A4), 5–9 bot def (D1–D5).
Yaw: 0 = menghadap +X (timur, ke site), PI = menghadap −X.

## Urutan simStep (tiap fixed-step 60 Hz)

1. `updateDoor` (proximity ≤3 m buka, tutup 4 dtk setelah kosong).
2. Fase `buy`: `buyBots` sekali → timer 12 → `live` (timer 100).
3. Fase `live`/`bomb`: `updatePlayer` → `updateBots` → `playerActions`
   (R/1/2/3/4/5/G/F/klik) → `updateWeapons` (selesai reload) →
   `updateGrenades` → `plantDefuseTick` → `bombPickupTick` →
   `bombPlaybook` tiap 1 dtk → `winCheck` (ledakan → defuse → eliminasi
   kecuali post-plant → timeout).
4. Fase `end`: banner 4 dtk → `nextRound` (atau match over bila skor 8 / ronde 15).

Ekonomi (AMB-24): kill +$300 dicatat ke `pending` saat kill; menang/kalah/plant
(+$300 tiap penyerang)/defuse (+$300) dibukukan ke `pending`; SEMUA dibayar
sekali di `endRound` → `money` (cap $9.000).

## Yang harus disediakan Builder B

- `main.js`: loop fixed-step 60 Hz → `simStep(s, 1/60, input)`; render bebas;
  `window.__EMBERLINE__ = { state, config, ... }` + force/setMoney/setRound.
- `index.html`, render, HUD, audio, viewmodel + tangan robot (di `weapons.js`
  bagian viewmodel — JANGAN ubah fungsi logika di atas), `characters.js`,
  `shots.js` (`?shot=`), minimap (baca `s.agents`, `s.bomb`, `s.door`, `NODES`).
- Suara: baca `s.events` bertipe `noise` (radius = radius reaksi bot; satu
  sumber kebenaran audio §4), `muzzle`, `explosion`, `beep`, `plant`, `defuse`.
- Smoke memutus LOS: `world.losBlocked(..., s.smokes, s.door.open)` sudah
  memeriksa asap; render asap dari `s.smokes`.
- Pintu Mid: render `s.door.open` (0 tertutup → 1 terbuka); panel solid di sim
  bila `open < 0.5`.
- Atap interior Site A/B HANYA visual (bukan collider); langit-langit tunnel
  (3,0 m) + service tunnel (2,6 m) collider.

## Catatan / default AMB yang dipakai

- Falloff: penuh s.d. `falloffStart`, linear ke `falloffMin` di `falloffEnd`
  (default end = start+35 m; Breacher 10→20 m per spec).
- Smoke: fuse 0,8 dtk sejak lempar (aktivasi), lalu zona 12 dtk.
- Frag tidak melukai pelempar (asumsi; spec diam).
- `s.dt` diset `simStep` (dipakai `plantDefuseTick`).
- Test headless: `node tools/sim-test.mjs`.
