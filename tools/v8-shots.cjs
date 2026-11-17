// v8: screenshot ronde v8 (badan robot membulat, tangan menyatu, genggaman melingkar).
// Pakai: node tools/v8-shots.cjs
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8097;
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
async function shot(browser, url, file, clip, move) {
  const page = await newPage(browser);
  await page.goto(BASE + url, { waitUntil: 'load', timeout: 60000 });
  if (url.includes('shot=')) await page.waitForFunction('window.__shotReady === true', null, { timeout: 60000 }).catch(() => {});
  await sleep(1500);
  if (move) { await page.evaluate(move); await sleep(900); }
  const opts = { path: file, type: 'jpeg', quality: 82 };
  if (clip) opts.clip = clip;
  await page.screenshot(opts);
  const st = await page.evaluate(() => window.__EMBERLINE__.simStats);
  await page.close();
  return st;
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
    await page.screenshot({ path: 'shots/v8-menu.jpg', type: 'jpeg', quality: 82 });
    out.menu = await page.evaluate(() => window.__EMBERLINE__.simStats);
    await page.close();
    out.robots = await shot(browser, '?shot=robots&seed=1', 'shots/v8-robots-close.jpg');
    out.robotsZoom = await shot(browser, '?shot=robots&seed=1', 'shots/v8-robots-zoom.jpg', null,
      () => { const E = window.__EMBERLINE__, p = E.state.agents[0]; p.x = 31.6; p.z = 40.5; p.yaw = 0; });
    out.cover = await shot(browser, '?shot=play&seed=1', 'shots/v8-cover.jpg');
    const clip = { x: 420, y: 380, width: 620, height: 420 };
    out.p9idle = await shot(browser, '?shot=p9&seed=1', 'shots/v8-hands-p9-idle.jpg', clip);
    out.p9reload = await shot(browser, '?shot=p9r&seed=1', 'shots/v8-hands-p9-reload.jpg', clip);
    out.vkidle = await shot(browser, '?shot=play&seed=1', 'shots/v8-hands-vk-idle.jpg', clip);
    out.vkreload = await shot(browser, '?shot=vkr&seed=1', 'shots/v8-hands-vk-reload.jpg', clip);
    page = await newPage(browser);
    await page.goto(BASE + '?bench=1', { waitUntil: 'load', timeout: 60000 });
    await sleep(25000);
    out.benchCalls = await page.evaluate(() => window.__EMBERLINE__.simStats);
    await page.close();
    page = await newPage(browser);
    await page.goto(BASE + '?debug=1', { waitUntil: 'load', timeout: 60000 });
    await sleep(8000);
    out.debug = await page.evaluate(() => window.__EMBERLINE__.simStats);
    await page.close();
  } finally { await browser.close(); server.kill(); }
  out.errors = errors;
  fs.writeFileSync('tools/v8-bench.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log('ERRORS:', errors.length);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
