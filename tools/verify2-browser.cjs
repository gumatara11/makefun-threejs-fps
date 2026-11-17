// Verifier EMBERLINE — uji browser (tugas A, F, H-sebagian) + HUD/UX (E1-E4).
// Serve lokal + Playwright Chromium eksplisit. Hanya menulis shots/verify-*.jpg + tools/verify2-browser.json.
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8093;
const BASE = `http://127.0.0.1:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [], warnings = [], failedReqs = [];
const out = {};
async function newPage(browser, dsf = 1) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: dsf });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
    if (m.type() === 'warning') warnings.push('WARN: ' + m.text());
  });
  page.on('requestfailed', (r) => failedReqs.push('REQFAIL: ' + r.url() + ' ' + (r.failure() || {}).errorText));
  page.on('response', (r) => { if (r.status() >= 400) failedReqs.push('HTTP' + r.status() + ': ' + r.url()); });
  return page;
}
(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: '/home/hatch/workspace/makefun-threejs-fps-01', stdio: 'pipe' });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    // --- halaman utama + klik Mulai ---
    let page = await newPage(browser);
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    await sleep(2000);
    out.startOverlay = await page.evaluate(() => {
      const o = document.getElementById('start-overlay');
      return { visible: o && getComputedStyle(o).display !== 'none', text: o ? o.innerText.slice(0, 400) : '' };
    });
    await page.screenshot({ path: 'shots/verify-start.jpg', type: 'jpeg', quality: 82 });
    await page.click('#start-btn').catch((e) => { out.startClickErr = e.message; });
    await sleep(2500);
    out.main = await page.evaluate(() => {
      const E = window.__EMBERLINE__;
      return { phase: E.state.round.phase, paused: E.state.paused, started: true, stats: E.simStats, errors: E.errors, audioCtx: null,
        hud: { hp: document.getElementById('hp-num').innerText, ammo: document.getElementById('ammo-mag').innerText, timer: document.getElementById('timer').innerText, scoreAtk: document.getElementById('score-atk').innerText, money: document.getElementById('money').innerText, teamIcons: document.getElementById('team-icons').innerText } };
    });
    // pause saat pointer lock lepas (coba exitPointerLock)
    out.pauseTest = await page.evaluate(async () => {
      const lockedBefore = !!document.pointerLockElement;
      if (document.pointerLockElement) document.exitPointerLock();
      await new Promise((r) => setTimeout(r, 800));
      return { lockedBefore, paused: window.__EMBERLINE__.state.paused, pauseVisible: getComputedStyle(document.getElementById('pause-overlay')).display };
    });
    // E3: killfeed/banner — bunuh semua defender via debug API, tunggu banner
    await page.evaluate(() => { window.__EMBERLINE__.killAll('def'); });
    await sleep(1500);
    out.banner = await page.evaluate(() => ({ banner: document.getElementById('banner').innerText, killfeed: document.getElementById('killfeed').innerText.slice(0, 200) }));
    await page.close();
    // --- tiap ?shot= ---
    for (const mode of ['start', 'play', 'buy', 'bomb', 'win']) {
      page = await newPage(browser);
      await page.goto(BASE + `?shot=${mode}&seed=1`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction('window.__shotReady === true', null, { timeout: 60000 }).catch(() => { out['shot_' + mode + '_ready'] = false; });
      await sleep(1200);
      await page.screenshot({ path: `shots/verify-shot-${mode}.jpg`, type: 'jpeg', quality: 82 });
      out['shot_' + mode] = await page.evaluate(() => ({ ready: window.__shotReady === true, phase: window.__EMBERLINE__.state.round.phase, stats: window.__EMBERLINE__.simStats }));
      await page.close();
    }
    // --- ?debug=1 (waypoint graph) ---
    page = await newPage(browser);
    await page.goto(BASE + '?debug=1', { waitUntil: 'load', timeout: 60000 });
    await sleep(2000);
    await page.screenshot({ path: 'shots/verify-debug.jpg', type: 'jpeg', quality: 82 });
    out.debug = await page.evaluate(() => ({ phase: window.__EMBERLINE__.state.round.phase, stats: window.__EMBERLINE__.simStats }));
    await page.close();
    // --- interior B + service tunnel (teleport pemain) ---
    page = await newPage(browser);
    await page.goto(BASE + '?shot=bomb&seed=1', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction('window.__shotReady === true', null, { timeout: 60000 }).catch(() => {});
    await page.evaluate(() => { const E = window.__EMBERLINE__, p = E.state.agents[0]; p.x = 62; p.z = 10; p.yaw = Math.PI / 2; });
    await sleep(800);
    await page.screenshot({ path: 'shots/verify-interior-b.jpg', type: 'jpeg', quality: 82 });
    await page.evaluate(() => { const E = window.__EMBERLINE__, p = E.state.agents[0]; p.x = 30; p.z = 18; p.yaw = 0; });
    await sleep(800);
    await page.screenshot({ path: 'shots/verify-tunnel.jpg', type: 'jpeg', quality: 82 });
    // minimap terbaca? + robot chibi dekat (teleport ke dekat bot)
    await page.evaluate(() => { const E = window.__EMBERLINE__, p = E.state.agents[0]; p.x = 58; p.z = 37; p.yaw = 0; E.state.agents[5].x = 63; E.state.agents[5].z = 37; E.state.agents[5].yaw = Math.PI; });
    await sleep(800);
    await page.screenshot({ path: 'shots/verify-robot-close.jpg', type: 'jpeg', quality: 82 });
    await page.close();
    // --- ?bench=1 ---
    page = await newPage(browser);
    await page.goto(BASE + '?bench=1', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction('window.__bench !== undefined', null, { timeout: 300000 }).catch(() => { out.benchTimeout = true; });
    out.bench = await page.evaluate(() => window.__bench || null);
    await page.close();
  } finally { await browser.close(); server.kill(); }
  out.errors = errors; out.warnings = warnings; out.failedReqs = failedReqs;
  fs.writeFileSync('tools/verify2-browser.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log('ERRORS:', errors.length, 'WARNINGS:', warnings.length, 'FAILEDREQ:', failedReqs.length);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
