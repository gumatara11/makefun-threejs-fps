// Diagnosis: apakah event muzzle/explosion pernah sampai ke render?
// render() membandingkan ev.t (detik GAME, state.now) dengan `now` (detik
// WALL, rAF/1000) — dua jam berbeda. Bila benar, tracer/muzzle/explosion
// tak pernah muncul di gameplay nyata.
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const { spawn } = require('child_process');
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8098;
const BASE = `http://127.0.0.1:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: '/home/hatch/workspace/v4gameplay-clean', stdio: 'pipe' });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    await sleep(1500);
    await page.click('#start-btn');
    await sleep(1500);
    const out = await page.evaluate(async () => {
      const E = window.__EMBERLINE__;
      const wallNow = performance.now() / 1000;
      // dorong 1 muzzle event "baru" (t = detik game sekarang) seperti combat.js
      E.state.events.push({ t: E.state.now, type: 'muzzle', shooter: 5, weapon: 'VK47' });
      E.state.events.push({ t: E.state.now, type: 'explosion', x: 30, y: 0, z: 25, kind: 'bomb' });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 300));
      // baca matriks tracerIM: slot hidup = ada elemen basis/posisi tak-nol
      // (makeScale(0,0,0) hanya menyisakan te[15]=1 -> mati).
      let tracerAlive = 0, tracerTotal = 0, explosionOpacity = null;
      E.scene.traverse((o) => {
        if (o.isInstancedMesh && o.geometry && o.geometry.type === 'BoxGeometry' && o.count === 8) {
          tracerTotal = o.count;
          const a = o.instanceMatrix.array;
          for (let i = 0; i < o.count; i++) {
            let nz = false;
            for (const k of [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14]) if (a[i * 16 + k] !== 0) { nz = true; break; }
            if (nz) tracerAlive++;
          }
        }
        if (o.isPoints && o.material && o.material.color && o.material.color.getHexString() === 'ff9a3c') explosionOpacity = o.material.opacity;
      });
      return { gameNow: +E.state.now.toFixed(2), wallNow: +wallNow.toFixed(2),
        gap: +(wallNow - E.state.now).toFixed(2), tracerAlive, tracerTotal,
        explosionOpacity, calls: E.simStats.calls };
    });
    console.log(JSON.stringify(out, null, 1));
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => { console.error('PROBE FAIL', e); process.exit(1); });
