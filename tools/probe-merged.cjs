// Probe merged HEAD v4 (gameplay + mulai-fix): draw call per scene terkontrol.
// Port 8093, cwd repo root, PLAY = #play-btn. Menulis tools/probe-merged.json.
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8093;
const BASE = `http://127.0.0.1:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const out = {};
(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: '/home/hatch/workspace/makefun-threejs-fps-01', stdio: 'pipe' });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    await sleep(2000);
    out.menu = await page.evaluate(() => window.__EMBERLINE__.simStats.calls);
    out.menuButtons = await page.evaluate(() => ({
      play: !!document.getElementById('play-btn'),
      startBtnGone: !document.getElementById('start-btn'),
      settings: !!document.getElementById('settings-btn'),
      menuButtons: [...document.querySelectorAll('#start-overlay button')].map((b) => b.id + ':' + b.innerText.trim()),
    }));
    await page.click('#play-btn');
    await sleep(2000);
    out.buySpawnEast = await page.evaluate(() => window.__EMBERLINE__.simStats.calls);
    // live worst-case: spawn atk, yaw sapu 360, 2 asap, bom plant, bot menembak
    await page.evaluate(() => {
      const E = window.__EMBERLINE__;
      E.state.round.phase = 'live'; E.state.round.timer = 100;
      const p = E.state.agents[0]; p.x = 4; p.z = 21; p.yaw = 0;
      E.state.smokes.push({ x: 20, y: 1, z: 24, r: 3.5, until: E.state.now + 60 });
      E.state.smokes.push({ x: 34, y: 1, z: 25, r: 3.5, until: E.state.now + 60 });
      E.forcePlant();
    });
    const samples = [];
    for (let i = 0; i < 24; i++) {
      await page.evaluate((yaw) => { window.__EMBERLINE__.state.agents[0].yaw = yaw; }, (i / 24) * Math.PI * 2);
      await sleep(400);
      samples.push(await page.evaluate(() => window.__EMBERLINE__.simStats.calls));
    }
    samples.sort((a, b) => a - b);
    out.worstLive = { min: samples[0], median: samples[Math.floor(samples.length / 2)], p95: samples[Math.floor(samples.length * 0.95)], max: samples[samples.length - 1], samples };
    // robot close-up
    await page.evaluate(() => { const E = window.__EMBERLINE__, p = E.state.agents[0]; p.x = 58; p.z = 37; p.yaw = 0; E.state.agents[5].x = 63; E.state.agents[5].z = 37; E.state.agents[5].yaw = Math.PI; });
    await sleep(800);
    out.robotClose = await page.evaluate(() => window.__EMBERLINE__.simStats.calls);
    await page.close();
    // debug scene
    const dbg = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    dbg.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    dbg.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
    await dbg.goto(BASE + '?debug=1', { waitUntil: 'load', timeout: 60000 });
    await sleep(2000);
    out.debug = await dbg.evaluate(() => window.__EMBERLINE__.simStats.calls);
    await dbg.close();
    // bench formal
    const bench = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    bench.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    bench.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
    await bench.goto(BASE + '?bench=1', { waitUntil: 'load', timeout: 60000 });
    await bench.waitForFunction('window.__bench !== undefined', null, { timeout: 300000 }).catch(() => { out.benchTimeout = true; });
    out.bench = await bench.evaluate(() => window.__bench || null);
    await bench.close();
  } finally { await browser.close(); server.kill(); }
  out.errors = errors;
  fs.writeFileSync('tools/probe-merged.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log('ERRORS:', errors.length);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
