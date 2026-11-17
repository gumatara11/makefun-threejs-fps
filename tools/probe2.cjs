// Probe 2: cari NaN di geometri/matrix + isolasi viewmodel/shadow.
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  await page.goto('http://127.0.0.1:8080/?shot=play&seed=1', { waitUntil: 'load', timeout: 60000 });
  await sleep(2500);
  const nan = await page.evaluate(() => {
    const E = window.__EMBERLINE__, bad = [];
    E.scene.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
      const p = o.geometry.attributes.position;
      let n = 0;
      for (let i = 0; i < p.count; i++) if (!isFinite(p.getX(i)) || !isFinite(p.getY(i)) || !isFinite(p.getZ(i))) n++;
      const m = o.matrixWorld.elements;
      const badM = m.some((v) => !isFinite(v));
      if (n || badM) bad.push({ geo: o.geometry.type, nanVerts: n, badMatrix: badM, mat: o.material && o.material.color ? '#' + o.material.color.getHexString() : '?' });
    });
    return bad;
  });
  console.log('NaN meshes:', JSON.stringify(nan));
  // fps baseline
  const fps1 = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const t = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(t); else res(n / 2); }; requestAnimationFrame(t); }));
  console.log('fps baseline:', fps1);
  // sembunyikan viewmodel (semua child kamera)
  await page.evaluate(() => { const E = window.__EMBERLINE__; E.scene.traverse((o) => { if (o.parent && o.parent.isCamera) o.visible = false; }); });
  await sleep(500);
  const fps2 = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const t = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(t); else res(n / 2); }; requestAnimationFrame(t); }));
  console.log('fps tanpa viewmodel:', fps2, 'calls:', JSON.stringify(await page.evaluate(() => window.__EMBERLINE__.simStats)));
  await page.screenshot({ path: 'shots/probe-novm.jpg', type: 'jpeg', quality: 80 });
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
