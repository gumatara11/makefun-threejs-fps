// Worst-case sustained: spawn atk, yaw 0 (timur), live + 2 asap + bom plant + bot menembak.
// Banding: buy phase spawn yaw 0. Tracer transient dicatat terpisah.
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8096;
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
    await sleep(1200);
    // spawn view buy
    out.buySpawnEast = await page.evaluate(() => window.__EMBERLINE__.simStats.calls);
    // live + asap + plant, amati 6 dtk (bot menembak -> tracer transient)
    await page.evaluate(() => {
      const E = window.__EMBERLINE__;
      E.state.round.phase = 'live'; E.state.round.timer = 100;
      const p = E.state.agents[0]; p.x = 4; p.z = 21; p.yaw = 0;
      E.state.smokes.push({ x: 20, y: 1, z: 24, r: 3.5, until: E.state.now + 30 });
      E.state.smokes.push({ x: 34, y: 1, z: 25, r: 3.5, until: E.state.now + 30 });
      E.forcePlant();
    });
    const samples = [];
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      samples.push(await page.evaluate(() => {
        const E = window.__EMBERLINE__;
        return { calls: E.simStats.calls, dropped: E.state.dropped.length,
          gren: E.state.grenadesActive.length, smokes: E.state.smokes.length,
          alive: E.state.agents.filter((a) => a.alive).length,
          planted: E.state.bomb && E.state.bomb.status };
      }));
    }
    out.liveSmokePlantSamples = samples.map((s) => s.calls);
    out.liveSmokePlantMax = Math.max(...samples.map((s) => s.calls));
    out.diag = samples;
    out.errors = errors;
    await page.close();
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync('shots/probe-worst.json', JSON.stringify(out, null, 1));
})().catch((e) => { console.error('PROBE FAIL', e); process.exit(1); });
