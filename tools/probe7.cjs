// Probe 7: scene.visible=false — apakah bottleneck di 3D atau di loop/DOM?
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
  await sleep(2000);
  console.log('base:', await fps(page));
  await page.evaluate(() => { window.__EMBERLINE__.scene.visible = false; });
  await sleep(1000);
  console.log('scene HIDDEN:', await fps(page));
  await page.evaluate(() => { window.__EMBERLINE__.scene.visible = true; document.getElementById('game').style.display = 'none'; });
  await sleep(1000);
  console.log('canvas display:none:', await fps(page));
  await page.evaluate(() => { document.getElementById('game').style.display = 'block'; });
  // ukur waktu JS murni: rAF tanpa render (stop loop? tidak bisa) — ukur durasi 1 frame via longtask
  const timing = await page.evaluate(() => new Promise((res) => {
    const samples = [];
    let last = performance.now(), n = 0;
    const t = () => { const now = performance.now(); samples.push(now - last); last = now; if (++n < 10) requestAnimationFrame(t); else res(samples.map((v) => +v.toFixed(0))); };
    requestAnimationFrame(t);
  }));
  console.log('frame deltas ms:', JSON.stringify(timing));
  console.log('programs:', await page.evaluate(() => window.__EMBERLINE__.renderer.info.programs.length));
  console.log('memory:', JSON.stringify(await page.evaluate(() => window.__EMBERLINE__.renderer.info.memory)));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
