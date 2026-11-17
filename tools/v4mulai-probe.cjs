// Probe v4-mulai-fix: menu hanya PLAY + SETTINGS, klik PLAY mulai game, SETTINGS buka panel volume.
// Pakai: node tools/v4mulai-probe.cjs
// Serve worktree lokal + Playwright Chromium headless. Tulis shots/v4-mulai-menu.jpg,
// shots/v4-mulai-settings.jpg, shots/v4-mulai-after-play.jpg. Exit 1 bila ada cek gagal.
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const { spawn } = require('child_process');
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const REPO = process.env.REPO || __dirname + '/..';
const PORT = +(process.env.PORT || 8099);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = [];
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ' — ' + info : ''}`); if (!ok) fail.push(name); };
(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: REPO, stdio: 'pipe' });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load', timeout: 60000 });
    await sleep(2000);
    const menu = await page.evaluate(() => {
      const o = document.getElementById('start-overlay');
      const btns = [...o.querySelectorAll('button')].map((b) => ({ id: b.id || null, text: b.innerText.trim() }));
      return {
        overlayVisible: getComputedStyle(o).display !== 'none',
        startBtnGone: !document.getElementById('start-btn'),
        playBtn: !!document.getElementById('play-btn'),
        settingsBtn: !!document.getElementById('settings-btn'),
        btns,
        menuText: o.innerText.replace(/\n+/g, ' | ').slice(0, 300),
      };
    });
    console.log('MENU:', JSON.stringify(menu, null, 2));
    check('tombol start-btn TIDAK ADA di DOM', menu.startBtnGone);
    check('tombol PLAY (#play-btn) ada', menu.playBtn);
    check('tombol SETTINGS (#settings-btn) ada', menu.settingsBtn);
    check('menu hanya 2 tombol', menu.btns.length === 2, JSON.stringify(menu.btns));
    check('tidak ada teks MULAI di menu', !/MULAI/.test(menu.menuText), menu.menuText);
    await page.screenshot({ path: REPO + '/shots/v4-mulai-menu.jpg', type: 'jpeg', quality: 82 });
    // SETTINGS: buka panel volume, lalu tutup
    await page.click('#settings-btn');
    await sleep(400);
    const setOpen = await page.evaluate(() => ({
      visible: document.getElementById('settings-panel').style.display === 'block',
      vol: document.getElementById('vol-val').innerText,
    }));
    check('SETTINGS membuka panel volume', setOpen.visible, JSON.stringify(setOpen));
    await page.screenshot({ path: REPO + '/shots/v4-mulai-settings.jpg', type: 'jpeg', quality: 82 });
    await page.click('#settings-close');
    await sleep(300);
    const setClosed = await page.evaluate(() => document.getElementById('settings-panel').style.display === 'none');
    check('SETTINGS TUTUP menutup panel', setClosed);
    // PLAY: klik, game harus mulai
    await page.click('#play-btn');
    await sleep(2500);
    const after = await page.evaluate(() => {
      const E = window.__EMBERLINE__;
      return {
        overlayHidden: document.getElementById('start-overlay').style.display === 'none',
        hudVisible: !document.body.classList.contains('menu'),
        phase: E.state.round.phase, paused: E.state.paused,
        errors: E.errors, stats: E.simStats,
      };
    });
    console.log('AFTER PLAY:', JSON.stringify(after, null, 2));
    check('overlay start hilang setelah PLAY', after.overlayHidden);
    check('HUD tampil (keluar mode menu)', after.hudVisible);
    check('game jalan (tidak paused)', after.paused === false, 'phase=' + after.phase);
    check('0 error JS setelah PLAY', after.errors.length === 0, JSON.stringify(after.errors));
    await page.screenshot({ path: REPO + '/shots/v4-mulai-after-play.jpg', type: 'jpeg', quality: 82 });
    check('0 console/page error selama probe', errors.length === 0, JSON.stringify(errors));
  } finally { await browser.close(); server.kill(); }
  console.log(fail.length ? `HASIL: ${fail.length} GAGAL — ${fail.join(', ')}` : 'HASIL: SEMUA LOLOS');
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
