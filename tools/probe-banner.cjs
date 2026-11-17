// Tes (c) banner akhir ronde vs saturasi bus event (lastFeed desync).
// Mekanisme: bus event cap 200 (pushEvent splice dari depan). Saat bus jenuh,
// lastFeed (=length) selalu di ATAS indeks event baru -> hud melewatkan
// semua event baru, termasuk round-end -> banner ronde berikut tak muncul /
// masih menampilkan hasil ronde lama (BASI).
// Skenario: R1 atk menang (banner benar) -> jenuhkan bus (250 noise segar)
// -> R2 def menang (killAll atk) -> banner HARUS 'DEFENDER MENANG'.
// Kode lama: banner R2 hilang / tetap 'PENYERANG MENANG' (basi).
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8097;
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
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    await sleep(1500);
    await page.click('#start-btn');
    await sleep(1200);
    const banner = () => page.evaluate(() => {
      const b = document.getElementById('banner');
      return { text: b.innerText, display: getComputedStyle(b).display };
    });
    const toLive = () => page.evaluate(() => {
      const E = window.__EMBERLINE__;
      if (E.state.round.phase === 'buy') E.state.round.timer = 0.01;
      if (E.state.round.phase === 'end') E.state.round.endTimer = 0.01;
    });
    // --- R1: live, bunuh defender -> atk menang ---
    await toLive(); await sleep(1500); await toLive(); await sleep(1500);
    await page.evaluate(() => window.__EMBERLINE__.killAll('def'));
    await sleep(2000);
    out.bannerR1 = await banner();
    out.scoreR1 = await page.evaluate(() => window.__EMBERLINE__.state.match.scoreAtk + '-' + window.__EMBERLINE__.state.match.scoreDef);
    // --- ke R2, lalu jenuhkan bus TEPAT sebelum R2 berakhir ---
    await toLive(); await sleep(1500); await toLive(); await sleep(1500);
    await page.evaluate(() => {
      const E = window.__EMBERLINE__;
      for (let i = 0; i < 250; i++) E.state.events.push({ t: E.state.now, type: 'noise', kind: 'step', x: 0, y: 0, z: 0, radius: 1, team: 'atk' });
    });
    // TUNGGU hud.update benar-benar menyerap banjir (beberapa frame rAF):
    // sleep() saja tak cukup — headless ~1 fps, 600 ms bisa 0 frame sehingga
    // lastFeed belum naik dan round-end lolos. rAF wait = deterministik.
    await page.evaluate(() => new Promise((res) => {
      let n = 0; const f = () => { if (++n >= 4) res(); else requestAnimationFrame(f); };
      requestAnimationFrame(f);
    }));
    out.eventsSaturated = await page.evaluate(() => window.__EMBERLINE__.state.events.length);
    await page.evaluate(() => window.__EMBERLINE__.killAll('atk')); // R2: def menang eliminasi
    const samples = [];
    for (let i = 0; i < 6; i++) { await sleep(250); samples.push(await banner()); }
    out.bannerR2samples = samples;
    out.scoreR2 = await page.evaluate(() => window.__EMBERLINE__.state.match.scoreAtk + '-' + window.__EMBERLINE__.state.match.scoreDef);
    const last = samples[samples.length - 1];
    out.bannerR2 = last;
    out.pass = last.display !== 'none' && last.text.includes('DEFENDER MENANG');
    await page.screenshot({ path: 'shots/v4-gameplay-banner.jpg', type: 'jpeg', quality: 82 });
    out.errors = errors;
    await page.close();
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync('shots/v4-gameplay-banner.json', JSON.stringify(out, null, 1));
  process.exit(out.pass ? 0 : 1);
})().catch((e) => { console.error('PROBE FAIL', e); process.exit(1); });
