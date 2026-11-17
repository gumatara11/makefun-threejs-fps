// v4-chars: screenshot + bench-calls untuk worktree terisolasi.
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8095;
const BASE = `http://127.0.0.1:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
async function newPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('requestfailed', (r) => errors.push('REQFAIL: ' + r.url()));
  return page;
}
(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: __dirname + '/..', stdio: 'pipe' });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = {};
  try {
    let page = await newPage(browser);
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    await sleep(2000);
    await page.screenshot({ path: 'shots/v4-chars-menu.jpg', type: 'jpeg', quality: 82 });
    await page.close();
    // robots close-up (mode baku) + zoom dekat (teleport pemain 1,9 m dari robot biru)
    page = await newPage(browser);
    await page.goto(BASE + '?shot=robots&seed=1', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction('window.__shotReady === true', null, { timeout: 60000 }).catch(() => { out.robots_ready = false; });
    await sleep(1200);
    await page.screenshot({ path: 'shots/v4-chars-robots-close.jpg', type: 'jpeg', quality: 82 });
    out.robots = await page.evaluate(() => window.__EMBERLINE__.simStats);
    await page.evaluate(() => { const E = window.__EMBERLINE__, p = E.state.agents[0]; p.x = 31.6; p.z = 40.5; p.yaw = 0; });
    await sleep(900);
    await page.screenshot({ path: 'shots/v4-chars-robots-zoom.jpg', type: 'jpeg', quality: 82 });
    await page.evaluate(() => { const E = window.__EMBERLINE__, p = E.state.agents[0]; p.x = 31.7; p.z = 39.2; p.yaw = 0.25; });
    await sleep(900);
    await page.screenshot({ path: 'shots/v4-chars-robots-zoom2.jpg', type: 'jpeg', quality: 82 });
    await page.evaluate(() => { const E = window.__EMBERLINE__, p = E.state.agents[0]; p.x = 31.7; p.z = 41.8; p.yaw = -0.25; });
    await sleep(900);
    await page.screenshot({ path: 'shots/v4-chars-robots-zoom3.jpg', type: 'jpeg', quality: 82 });
    await page.close();
    // gameplay jarak normal
    page = await newPage(browser);
    await page.goto(BASE + '?shot=play&seed=1', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction('window.__shotReady === true', null, { timeout: 60000 }).catch(() => { out.play_ready = false; });
    await sleep(1200);
    await page.screenshot({ path: 'shots/v4-chars-play.jpg', type: 'jpeg', quality: 82 });
    out.play = await page.evaluate(() => window.__EMBERLINE__.simStats);
    await page.close();
    // bench: baca draw calls scene bench tanpa menunggu __bench (150 frame lambat di swiftshader)
    page = await newPage(browser);
    await page.goto(BASE + '?bench=1', { waitUntil: 'load', timeout: 60000 });
    await sleep(25000);
    out.benchCalls = await page.evaluate(() => window.__EMBERLINE__.simStats);
    await page.close();
    // debug view (waypoint + semua robot) — angka acuan 179/180
    page = await newPage(browser);
    await page.goto(BASE + '?debug=1', { waitUntil: 'load', timeout: 60000 });
    await sleep(8000);
    out.debug = await page.evaluate(() => window.__EMBERLINE__.simStats);
    await page.screenshot({ path: 'shots/v4-chars-debug.jpg', type: 'jpeg', quality: 82 });
    await page.close();
  } finally { await browser.close(); server.kill(); }
  out.errors = errors;
  fs.writeFileSync('tools/v4chars-bench.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log('ERRORS:', errors.length);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
