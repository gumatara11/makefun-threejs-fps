// Screenshot menu EMBERLINE (v4-menu): serve lokal + Playwright Chromium.
// Pakai: node tools/menu-shot.cjs <nama-file> [url]
// Default url = '' (menu awal). Tulis ke shots/<nama-file>.
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const { spawn } = require('child_process');
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const REPO = process.env.REPO || '/home/hatch/workspace/makefun-threejs-fps-01';
const PORT = +(process.env.PORT || 8094);
const OUTDIR = process.env.OUTDIR || (REPO + '/shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const name = process.argv[2] || 'v4-menu-00.jpg';
  const url = process.argv[3] || '';
  const file = OUTDIR + '/' + name;
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: REPO, stdio: 'pipe' });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
    await page.goto(`http://127.0.0.1:${PORT}/${url}`, { waitUntil: 'load', timeout: 60000 });
    await sleep(2000);
    await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
    const st = await page.evaluate(() => ({
      stats: window.__EMBERLINE__.simStats,
      errors: window.__EMBERLINE__.errors,
      cam: (() => { let c = null; window.__EMBERLINE__.scene.traverse((o) => { if (o.isCamera) c = o; }); return c ? c.position.toArray().map((v) => +v.toFixed(2)) : null; })(),
      pick: window.__EMBERLINE__.pick(),
    }));
    console.log(JSON.stringify({ file, ...st }, null, 2));
  } finally { await browser.close(); server.kill(); }
  console.log('ERRORS:', errors.length, JSON.stringify(errors));
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
