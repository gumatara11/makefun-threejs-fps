// Probe 5: biseksi bottleneck — lampu point, ground, robot, fog.
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fps(page, ms = 2500) {
  return page.evaluate((m) => new Promise((res) => { let n = 0; const t0 = performance.now(); const t = () => { n++; if (performance.now() - t0 < m) requestAnimationFrame(t); else res(+(n / (m / 1000)).toFixed(1)); }; requestAnimationFrame(t); }), ms);
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  await page.goto('http://127.0.0.1:8080/?shot=play&seed=1', { waitUntil: 'load', timeout: 60000 });
  await sleep(2000);
  console.log('base:', await fps(page));
  await page.evaluate(() => { window.__EMBERLINE__.scene.traverse((o) => { if (o.isPointLight) o.visible = false; }); });
  console.log('point lights OFF:', await fps(page));
  await page.evaluate(() => { window.__EMBERLINE__.scene.traverse((o) => { if (o.isPointLight) o.visible = true; }); });
  await page.evaluate(() => { window.__EMBERLINE__.scene.fog = null; });
  console.log('fog OFF:', await fps(page));
  await page.evaluate(() => { const E = window.__EMBERLINE__; E.scene.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry') o.visible = false; }); });
  console.log('ground/apron OFF:', await fps(page));
  await page.evaluate(() => { const E = window.__EMBERLINE__; E.scene.traverse((o) => { if (o.isGroup && o.userData && o.userData.deadT !== undefined) o.visible = false; }); });
  console.log('robots OFF:', await fps(page));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
