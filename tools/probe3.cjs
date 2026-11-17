// Probe 3: fps shadow on vs off + draw calls.
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fps(page, ms = 3000) {
  return page.evaluate((m) => new Promise((res) => { let n = 0; const t0 = performance.now(); const t = () => { n++; if (performance.now() - t0 < m) requestAnimationFrame(t); else res(+(n / (m / 1000)).toFixed(1)); }; requestAnimationFrame(t); }), ms);
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  await page.goto('http://127.0.0.1:8080/?shot=play&seed=1', { waitUntil: 'load', timeout: 60000 });
  await sleep(2500);
  console.log('shadow ON : fps', await fps(page), JSON.stringify(await page.evaluate(() => window.__EMBERLINE__.simStats)));
  await page.evaluate(() => { const E = window.__EMBERLINE__; E.scene.traverse((o) => { if (o.isDirectionalLight) o.castShadow = false; }); });
  await sleep(500);
  console.log('shadow OFF: fps', await fps(page), JSON.stringify(await page.evaluate(() => window.__EMBERLINE__.simStats)));
  await page.evaluate(() => { const E = window.__EMBERLINE__; E.scene.traverse((o) => { if (o.isDirectionalLight) { o.castShadow = true; o.shadow.mapSize.set(1024, 1024); o.shadow.map?.dispose(); o.shadow.map = null; } }); });
  await sleep(500);
  console.log('shadow 1024: fps', await fps(page), JSON.stringify(await page.evaluate(() => window.__EMBERLINE__.simStats)));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
