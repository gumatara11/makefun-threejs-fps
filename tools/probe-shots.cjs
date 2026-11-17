// Screenshot visual (d): spawn timur (pintu Mid + huruf + menara + robot)
// + site A, untuk bukti tak ada regresi visual setelah merge/instancing.
const { chromium } = require('/home/hatch/workspace/makefun-token-radar/pwtest/node_modules/playwright-core');
const { spawn } = require('child_process');
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8099;
const BASE = `http://127.0.0.1:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: '/home/hatch/workspace/v4gameplay-clean', stdio: 'pipe' });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    await sleep(1500);
    await page.click('#start-btn');
    await sleep(1500);
    // spawn, hadap timur (pintu Mid di tengah, menara di kanan)
    await page.evaluate(() => {
      const E = window.__EMBERLINE__;
      const p = E.state.agents[0]; p.x = 8; p.z = 25; p.yaw = 0;
      E.state.round.phase = 'live'; E.state.round.timer = 100;
    });
    await sleep(1200);
    await page.screenshot({ path: 'shots/v4-gameplay-mid.jpg', type: 'jpeg', quality: 82 });
    // site A: huruf A + tower + ring
    await page.evaluate(() => {
      const E = window.__EMBERLINE__;
      const p = E.state.agents[0]; p.x = 52; p.z = 38; p.yaw = 0;
    });
    await sleep(1200);
    await page.screenshot({ path: 'shots/v4-gameplay-sitea.jpg', type: 'jpeg', quality: 82 });
    // pintu dari dekat (buka): cek panel pintu + strip bergerak
    await page.evaluate(() => {
      const E = window.__EMBERLINE__;
      const p = E.state.agents[0]; p.x = 26; p.z = 25; p.yaw = 0;
      E.state.door.open = 1; E.state.door.target = 1;
    });
    await sleep(800);
    await page.screenshot({ path: 'shots/v4-gameplay-door.jpg', type: 'jpeg', quality: 82 });
    const calls = await page.evaluate(() => window.__EMBERLINE__.simStats.calls);
    console.log(JSON.stringify({ calls, errors: await page.evaluate(() => window.__EMBERLINE__.errors) }));
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => { console.error('SHOT FAIL', e); process.exit(1); });
