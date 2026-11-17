// Probe cepat: stack pageerror + laju rAF + raycast tengah layar.
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.log('PAGEERROR STACK:\n', e.stack || e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });
  await page.goto('http://127.0.0.1:8080/?shot=play&seed=1', { waitUntil: 'load', timeout: 60000 });
  await sleep(3000);
  const raf = await page.evaluate(() => new Promise((res) => {
    let n = 0; const t0 = performance.now();
    const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res(n / 3); };
    requestAnimationFrame(tick);
  }));
  console.log('rAF fps:', raf);
  console.log('pick center:', JSON.stringify(await page.evaluate(() => window.__EMBERLINE__.pick()), null, 1));
  console.log('stats:', JSON.stringify(await page.evaluate(() => window.__EMBERLINE__.simStats)));
  console.log('errors:', JSON.stringify(await page.evaluate(() => window.__EMBERLINE__.errors)));
  // daftar objek besar di dekat kamera (radius 20 m dari pemain)
  const near = await page.evaluate(() => {
    const E = window.__EMBERLINE__, p = E.state.agents[0], list = [];
    E.scene.traverse((o) => {
      if (!o.isMesh) return;
      const wp = o.getWorldPosition({ x: 0, y: 0, z: 0 });
      const d = Math.hypot(wp.x - p.x, wp.y - p.y, wp.z - p.z);
      if (d < 25 && o.geometry) {
        const g = o.geometry;
        if (!g.boundingBox) g.computeBoundingBox();
        const s = g.boundingBox.getSize({ x: 0, y: 0, z: 0 });
        list.push({ d: +d.toFixed(1), geo: g.type, size: [s.x, s.y, s.z].map((v) => +v.toFixed(2)), pos: [wp.x, wp.y, wp.z].map((v) => +v.toFixed(1)), mat: o.material && o.material.color ? '#' + o.material.color.getHexString() : '?' });
      }
    });
    return list.sort((a, b) => a.d - b.d).slice(0, 25);
  });
  console.log('near objects:', JSON.stringify(near, null, 1));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
