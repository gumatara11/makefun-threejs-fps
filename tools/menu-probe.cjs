// Probe menu: mesh terlihat dekat kamera + raycast titik layar (filter invisible).
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const { spawn } = require('child_process');
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8095;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: '/home/hatch/workspace/makefun-threejs-fps-01', stdio: 'pipe' });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load', timeout: 60000 });
    await sleep(2000);
    const out = await page.evaluate(() => {
      const E = window.__EMBERLINE__;
      let cam = null; E.scene.traverse((o) => { if (o.isCamera) cam = o; });
      const cp = cam.position;
      const vis = (o) => { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; };
      const list = [];
      E.scene.traverse((o) => {
        if (!o.isMesh || !vis(o)) return;
        const wp = new (o.position.constructor)(0, 0, 0);
        o.getWorldPosition(wp);
        const d = Math.hypot(wp.x - cp.x, wp.y - cp.y, wp.z - cp.z);
        if (d > 45) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const s = o.geometry.boundingBox.getSize(new (o.position.constructor)(0, 0, 0));
        // skala world kasar: pakai matrixWorld
        const sc = new (o.position.constructor)(0, 0, 0); o.getWorldScale(sc);
        list.push({ d: +d.toFixed(1), geo: o.geometry.type, size: [s.x * sc.x, s.y * sc.y, s.z * sc.z].map((v) => +v.toFixed(1)), pos: [wp.x, wp.y, wp.z].map((v) => +v.toFixed(1)), mat: o.material && o.material.color ? '#' + o.material.color.getHexString() : '?' });
      });
      const fwd = [5.5, -0.4, 0]; const fl = Math.hypot(...fwd); fwd.forEach((v, i) => fwd[i] = v / fl);
      const inFront = list.filter((o) => {
        const dx = o.pos[0] - cp.x, dy = o.pos[1] - cp.y, dz = o.pos[2] - cp.z;
        const dl = Math.hypot(dx, dy, dz) || 1;
        return (dx * fwd[0] + dy * fwd[1] + dz * fwd[2]) / dl > 0.55;
      });
      return { cam: cp.toArray().map((v) => +v.toFixed(1)), near: inFront.filter((o) => Math.max(...o.size) >= 2 && o.d >= 8).sort((a, b) => a.d - b.d).slice(0, 30) };
    });
    console.log(JSON.stringify(out, null, 1));
    // raycast dari titik layar: atas-tengah dinding (640,300), kiri (200,300), kanan (1100,300)
    const rays = await page.evaluate(() => {
      const E = window.__EMBERLINE__;
      const THREE = window.__THREE__ || null;
      return 'skip';
    });
    void rays;
  } finally { await browser.close(); server.kill(); }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
