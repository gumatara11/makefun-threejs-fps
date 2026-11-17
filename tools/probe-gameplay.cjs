// Probe gameplay v4-gameplay: bench draw calls + census scene + cek pointer lock.
// Serve worktree sendiri (port 8094), JANGAN pakai repo utama. Hanya baca; tulis shots/probe-*.json.
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8094;
const BASE = `http://127.0.0.1:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: '/home/hatch/workspace/v4gameplay-clean', stdio: 'pipe' });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = {};
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
    // --- bench ---
    await page.goto(BASE + '?bench=1', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction('window.__bench !== undefined', null, { timeout: 300000 }).catch(() => { out.benchTimeout = true; });
    out.bench = await page.evaluate(() => window.__bench || null);
    // --- census: objek visible per kategori (geometri+material) ---
    out.census = await page.evaluate(() => {
      const E = window.__EMBERLINE__;
      const byKey = {};
      let visible = 0, total = 0;
      E.scene.traverse((o) => {
        if (!o.isMesh && !o.isPoints && !o.isLineSegments && !o.isInstancedMesh) return;
        total++;
        if (!o.visible) return;
        // visible di hierarchy?
        let v = o.visible, p = o.parent;
        while (p) { if (!p.visible) { v = false; break; } p = p.parent; }
        if (!v) return;
        visible++;
        const mat = o.material;
        const col = mat && mat.color ? '#' + mat.color.getHexString() : (mat ? mat.type : '?');
        const geo = o.geometry ? o.geometry.type : '?';
        const key = `${o.isInstancedMesh ? 'INST ' : ''}${geo} ${col}`;
        byKey[key] = (byKey[key] || 0) + 1;
      });
      return { total, visible, byKey };
    });
    out.errors = errors;
    await page.close();
    // --- halaman biasa: start + pointer lock? ---
    const p2 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    p2.on('pageerror', (e) => errors.push('PAGEERROR2: ' + e.message));
    await p2.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    await sleep(1500);
    await p2.click('#start-btn').catch((e) => { out.startClickErr = e.message; });
    await sleep(2000);
    out.main = await p2.evaluate(() => ({
      phase: window.__EMBERLINE__.state.round.phase,
      locked: !!document.pointerLockElement,
      paused: window.__EMBERLINE__.state.paused,
      errors: window.__EMBERLINE__.errors,
      calls: window.__EMBERLINE__.simStats.calls,
    }));
    await p2.close();
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync('shots/probe-gameplay.json', JSON.stringify(out, null, 1));
})().catch((e) => { console.error('PROBE FAIL', e); process.exit(1); });
