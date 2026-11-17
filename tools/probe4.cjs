// Probe 4: fps scene trivial vs game, dan skala viewport/antialias.
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fps(page, ms = 3000) {
  return page.evaluate((m) => new Promise((res) => { let n = 0; const t0 = performance.now(); const t = () => { n++; if (performance.now() - t0 < m) requestAnimationFrame(t); else res(+(n / (m / 1000)).toFixed(1)); }; requestAnimationFrame(t); }), ms);
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  // trivial: 1 kubus, antialias true, 1280x800
  let page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.setContent(`<canvas id="c"></canvas><script type="importmap">{"imports":{"three":"http://127.0.0.1:8080/vendor/three/three.module.min.js"}}</script><script type="module">import * as T from 'three';const r=new T.WebGLRenderer({canvas:document.getElementById('c'),antialias:true});r.setSize(1280,800);const s=new T.Scene();s.add(new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:0xff0000})));const c=new T.PerspectiveCamera(60,1.6,0.1,10);c.position.z=3;s.add(new T.DirectionalLight(0xffffff,2));(function loop(){requestAnimationFrame(loop);r.render(s,c);})();</script>`);
  await sleep(1500);
  console.log('trivial 1280x800 AA: fps', await fps(page));
  await page.close();
  // game di viewport kecil 640x400
  page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  await page.goto('http://127.0.0.1:8080/?shot=play&seed=1', { waitUntil: 'load', timeout: 60000 });
  await sleep(2000);
  console.log('game 640x400: fps', await fps(page), JSON.stringify(await page.evaluate(() => window.__EMBERLINE__.simStats)));
  await page.close();
  // game 1280x800 lagi (kontrol)
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://127.0.0.1:8080/?shot=play&seed=1', { waitUntil: 'load', timeout: 60000 });
  await sleep(2000);
  console.log('game 1280x800: fps', await fps(page), JSON.stringify(await page.evaluate(() => window.__EMBERLINE__.simStats)));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
