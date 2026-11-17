// Probe cepat: 3x baca simStats.calls di ?bench=1 (jeda 25 dtk) untuk melihat variansi.
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const { spawn } = require('child_process');
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8096;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: __dirname + '/..', stdio: 'pipe' });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (let i = 0; i < 3; i++) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.goto(`http://127.0.0.1:${PORT}/?bench=1`, { waitUntil: 'load', timeout: 60000 });
      await sleep(25000);
      const s = await page.evaluate(() => window.__EMBERLINE__.simStats);
      const p = await page.evaluate(() => { const a = window.__EMBERLINE__.state.agents[0]; return { x: +a.x.toFixed(1), z: +a.z.toFixed(1), yaw: +a.yaw.toFixed(2) }; });
      console.log(`sample ${i}: calls=${s.calls} tris=${s.tris} player=`, JSON.stringify(p));
      await page.close();
    }
  } finally { await browser.close(); server.kill(); }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
