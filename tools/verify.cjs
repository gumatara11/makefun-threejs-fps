// Builder B verify: 0 console error + 4 screenshot ?shot= + bench + zoom tangan.
// Usage: node tools/verify.cjs [base]  (server harus sudah jalan di 8080)
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8080/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const errors = [];
const out = {};
async function newPage(browser, dsf = 1) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: dsf });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  return page;
}
async function shot(browser, url, file, waitMs = 2500) {
  const page = await newPage(browser);
  await page.goto(BASE + url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__shotReady === true', null, { timeout: 60000 }).catch(() => {});
  await sleep(waitMs);
  await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
  const stats = await page.evaluate(() => window.__EMBERLINE__ && window.__EMBERLINE__.simStats);
  console.log(url, '->', file, JSON.stringify(stats));
  await page.close();
}
async function hands(browser, weapon, reload, file) {
  const page = await newPage(browser, 2);
  await page.goto(BASE + '?shot=play&seed=1', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__shotReady === true', null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(({ weapon, reload }) => {
    const E = window.__EMBERLINE__, p = E.state.agents[0];
    if (weapon === 'P9') { p.weapons.primary = null; p.current = 'secondary'; }
    else { p.weapons.primary = { key: 'VK47', mag: 30, reserve: 90 }; p.current = 'primary'; }
    if (reload) {
      const total = weapon === 'P9' ? 1.6 : 2.4;
      p.reloadUntil = E.state.now + total * 0.6; // prog 40%
      p.reloadSlot = p.current;
    }
  }, { weapon, reload });
  await sleep(600);
  await page.screenshot({ path: file, type: 'jpeg', quality: 85, clip: { x: 620, y: 380, width: 660, height: 420 } });
  console.log('hands', weapon, reload ? 'reload40' : 'idle', '->', file);
  await page.close();
}
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    // main page: start overlay + klik Mulai
    let page = await newPage(browser);
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    await sleep(2000);
    await page.click('#play-btn').catch((e) => console.log('start click failed:', e.message));
    await sleep(2500);
    out.mainStats = await page.evaluate(() => window.__EMBERLINE__ && window.__EMBERLINE__.simStats);
    out.mainPhase = await page.evaluate(() => window.__EMBERLINE__.state.round.phase);
    out.mainPaused = await page.evaluate(() => window.__EMBERLINE__.state.paused);
    console.log('main:', JSON.stringify(out.mainStats), 'phase=', out.mainPhase, 'paused=', out.mainPaused);
    await page.close();
    // 4 shot
    await shot(browser, '?shot=play&seed=1', 'screenshots/1-action.jpg');
    await shot(browser, '?shot=buy&seed=1', 'screenshots/2-buy.jpg');
    await shot(browser, '?shot=bomb&seed=1', 'screenshots/3-bomb.jpg');
    await shot(browser, '?shot=win&seed=1', 'screenshots/4-win.jpg');
    // zoom tangan
    await hands(browser, 'P9', false, 'shots/hands-p9-idle.jpg');
    await hands(browser, 'P9', true, 'shots/hands-p9-reload.jpg');
    await hands(browser, 'VK47', false, 'shots/hands-vk-idle.jpg');
    await hands(browser, 'VK47', true, 'shots/hands-vk-reload.jpg');
    // bench
    page = await newPage(browser);
    await page.goto(BASE + '?bench=1', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction('window.__bench !== undefined', null, { timeout: 300000 }).catch(() => console.log('bench timeout'));
    out.bench = await page.evaluate(() => window.__bench || null);
    console.log('bench:', JSON.stringify(out.bench));
    await page.close();
  } finally { await browser.close(); }
  out.errors = errors;
  fs.writeFileSync('tools/verify-result.json', JSON.stringify(out, null, 2));
  console.log('ERRORS:', errors.length ? errors : 'NONE (0)');
  for (const f of ['screenshots/1-action.jpg', 'screenshots/2-buy.jpg', 'screenshots/3-bomb.jpg', 'screenshots/4-win.jpg', 'shots/hands-p9-idle.jpg', 'shots/hands-p9-reload.jpg', 'shots/hands-vk-idle.jpg', 'shots/hands-vk-reload.jpg']) {
    try { console.log(f, fs.statSync(f).size, 'bytes'); } catch { console.log(f, 'MISSING'); }
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
