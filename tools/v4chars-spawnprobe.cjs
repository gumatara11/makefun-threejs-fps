// A/B spawn view: baca calls SEGERA setelah load ?bench=1 (pemain masih di spawn,
// menghadap map terbuka = worst case), sebelum runBench selesai.
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const { spawn } = require('child_process');
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = Number(process.argv[2] || 8098);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: process.argv[3] || __dirname + '/..', stdio: 'pipe' });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`http://127.0.0.1:${PORT}/?bench=1`, { waitUntil: 'load', timeout: 60000 });
    for (const t of [3000, 8000, 15000]) {
      await sleep(t === 3000 ? 3000 : t - (t === 8000 ? 3000 : 8000));
      const s = await page.evaluate(() => window.__EMBERLINE__.simStats);
      const p = await page.evaluate(() => { const a = window.__EMBERLINE__.state.agents[0]; return { x: +a.x.toFixed(1), z: +a.z.toFixed(1) }; });
      console.log(`t=${t}ms calls=${s.calls} tris=${s.tris} player=`, JSON.stringify(p));
    }
    await page.close();
  } finally { await browser.close(); server.kill(); }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
