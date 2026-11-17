// Ukur draw call GAMEPLAY nyata: halaman utama, fase live, sapu yaw 360 + asap + bom.
// (Angka ?bench=1 = 36 adalah artefak frustum kamera pojok, bukan gameplay.)
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8095;
const BASE = `http://127.0.0.1:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: '/home/hatch/workspace/v4gameplay-clean', stdio: 'pipe' });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = {};
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    await sleep(1500);
    await page.click('#start-btn');
    await sleep(1500);
    out.started = await page.evaluate(() => ({ phase: window.__EMBERLINE__.state.round.phase, locked: !!document.pointerLockElement, calls: window.__EMBERLINE__.simStats.calls }));
    // paksa fase live di spawn, sapu yaw
    await page.evaluate(() => {
      const E = window.__EMBERLINE__;
      E.state.round.phase = 'live'; E.state.round.timer = 100;
      E.state.agents[0].x = 8; E.state.agents[0].z = 24; E.state.agents[0].yaw = 0;
    });
    const sweep = [];
    for (let i = 0; i < 8; i++) {
      await page.evaluate((yaw) => { window.__EMBERLINE__.state.agents[0].yaw = yaw; }, i * Math.PI / 4);
      await sleep(400);
      sweep.push(await page.evaluate(() => window.__EMBERLINE__.simStats.calls));
    }
    out.sweepLive = sweep;
    // + asap di depan pemain + bom terplant
    await page.evaluate(() => {
      const E = window.__EMBERLINE__;
      E.state.smokes.push({ x: 20, y: 1, z: 24, r: 3.5, until: E.state.now + 12 });
      E.forcePlant();
    });
    await sleep(800);
    out.withSmokePlant = await page.evaluate(() => window.__EMBERLINE__.simStats.calls);
    // fase buy (menu tutup) untuk banding
    await page.evaluate(() => { const E = window.__EMBERLINE__; E.state.round.phase = 'buy'; E.state.round.timer = 12; });
    await sleep(500);
    out.buyPhase = await page.evaluate(() => window.__EMBERLINE__.simStats.calls);
    out.errors = errors;
    await page.close();
    // ?debug=1 untuk banding klaim v4-map (153)
    const pd = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await pd.goto(BASE + '?debug=1', { waitUntil: 'load', timeout: 60000 });
    await sleep(2500);
    out.debug = await pd.evaluate(() => window.__EMBERLINE__.simStats.calls);
    await pd.close();
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync('shots/probe-calls.json', JSON.stringify(out, null, 1));
})().catch((e) => { console.error('PROBE FAIL', e); process.exit(1); });
