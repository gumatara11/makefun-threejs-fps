// v7b: full-frame P9 + VK + robots + menu untuk cek ulang viewmodel sesudah pullback.
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8097;
const BASE = `http://127.0.0.1:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
async function shot(browser, url, file, move) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto(BASE + url, { waitUntil: 'load', timeout: 60000 });
  if (url.includes('shot=')) await page.waitForFunction('window.__shotReady === true', null, { timeout: 60000 }).catch(() => {});
  await sleep(1500);
  if (move) { await page.evaluate(move); await sleep(900); }
  await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
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
    out.p9full = await shot(browser, '?shot=p9&seed=1', 'shots/v7b-p9-full.jpg');
    out.vkfull = await shot(browser, '?shot=play&seed=1', 'shots/v7b-vk-full.jpg');
    out.robots = await shot(browser, '?shot=robots&seed=1', 'shots/v7b-robots-close.jpg');
    let page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    await sleep(2000);
    await page.screenshot({ path: 'shots/v7b-menu.jpg', type: 'jpeg', quality: 82 });
    out.menu = await page.evaluate(() => window.__EMBERLINE__.simStats);
    await page.close();
  } finally { await browser.close(); server.kill(); }
  out.errors = errors;
  fs.writeFileSync('tools/v7b-bench.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log('ERRORS:', errors.length);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
