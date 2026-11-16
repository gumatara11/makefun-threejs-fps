// Probe screenshot EMBERLINE (fixer): 4 cover + robot close-up + menu + 4 zoom tangan.
// Serve lokal + Playwright Chromium eksplisit. Menulis screenshots/*.jpg + shots/*.jpg.
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8093;
const BASE = `http://127.0.0.1:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [], warnings = [];
const out = {};
const size = (f) => { try { return Math.round(fs.statSync(f).size / 1024) + ' KiB'; } catch { return '?'; } };
async function newPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); if (m.type() === 'warning') warnings.push('WARN: ' + m.text()); });
  return page;
}
async function shot(browser, url, file, clip) {
  const page = await newPage(browser);
  await page.goto(BASE + url, { waitUntil: 'load', timeout: 60000 });
  if (url.includes('shot=')) await page.waitForFunction('window.__shotReady === true', null, { timeout: 60000 }).catch(() => { out[file + '_ready'] = false; });
  await sleep(1500);
  await page.screenshot({ path: file, type: 'jpeg', quality: 82, clip });
  const st = await page.evaluate(() => ({ stats: window.__EMBERLINE__.simStats, errors: window.__EMBERLINE__.errors }));
  out[file] = { size: size(file), calls: st.stats.calls, tris: st.stats.tris, errors: st.errors };
  await page.close();
}
(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: '/home/hatch/workspace/makefun-threejs-fps-01', stdio: 'pipe' });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    // cover (deliverable)
    await shot(browser, '?shot=play&seed=1', 'screenshots/1-action.jpg');
    await shot(browser, '?shot=buy&seed=1', 'screenshots/2-buy.jpg');
    await shot(browser, '?shot=bomb&seed=1', 'screenshots/3-bomb.jpg');
    await shot(browser, '?shot=win&seed=1', 'screenshots/4-win.jpg');
    // robot close-up + menu
    await shot(browser, '?shot=robots&seed=1', 'shots/robots-close.jpg');
    await shot(browser, '', 'shots/start-menu.jpg');
    // zoom tangan (crop region viewmodel kanan-bawah)
    const clip = { x: 420, y: 380, width: 620, height: 420 };
    await shot(browser, '?shot=p9&seed=1', 'shots/hands-p9-idle.jpg', clip);
    await shot(browser, '?shot=p9r&seed=1', 'shots/hands-p9-reload.jpg', clip);
    await shot(browser, '?shot=play&seed=1', 'shots/hands-vk-idle.jpg', clip);
    await shot(browser, '?shot=vkr&seed=1', 'shots/hands-vk-reload.jpg', clip);
  } finally { await browser.close(); server.kill(); }
  out.errors = errors; out.warnings = warnings;
  console.log(JSON.stringify(out, null, 2));
  console.log('ERRORS:', errors.length, 'WARNINGS:', warnings.length);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
