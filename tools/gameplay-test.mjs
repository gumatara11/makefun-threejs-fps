// Tes gameplay-feel v4-gameplay (headless Node, tanpa DOM/three):
// (a) input buffer antar-frame, (b) mouse fase beli tak melompat, (c) banner ikut seq event.
// Jalankan: node tools/gameplay-test.mjs — keluar 0 bila semua PASS.
import { createState } from '../game/src/state.js';
import { simStep } from '../game/src/rounds.js';

// --- stub DOM minimal untuk InputState.attach ---
const listeners = {};
const fakeEl = {
  addEventListener(t, fn) { (listeners[t] ??= []).push(fn); },
  removeEventListener() {},
};
globalThis.document = { addEventListener() {}, removeEventListener() {}, pointerLockElement: fakeEl };
globalThis.window = { addEventListener() {}, removeEventListener() {} };

const { InputState } = await import('../game/src/input.js');

let pass = 0, fail = 0;
const check = (name, ok, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ' — ' + info : ''}`);
  ok ? pass++ : fail++;
};
const fire = (type, ev) => { for (const fn of listeners[type] || []) fn(ev); };
const keyEv = (code) => ({ code, repeat: false, preventDefault() {} });

function freshInput() {
  for (const k of Object.keys(listeners)) listeners[k] = [];
  const inp = new InputState();
  inp.attach(fakeEl);
  inp.locked = true; // simulasi pointer lock aktif
  return inp;
}

// ---------- (a) tekan-cepat antar-frame ----------
{
  const inp = freshInput();
  // Skenario bukti (a): fps rendah — keydown+keyup terjadi SEBELUM loop membaca.
  fire('keydown', keyEv('KeyR'));
  fire('keyup', keyEv('KeyR'));
  check('(a) tekan-cepat R (<1 frame) tetap terbaca loop', inp.pressed('KeyR') === true);
  check('(a) tekan yang sama hanya dikonsumsi sekali', inp.pressed('KeyR') === false);
}
{
  const inp = freshInput();
  fire('keydown', keyEv('KeyR')); // tahan, tanpa keyup
  check('(a) tekan saat tombol masih ditahan terbaca', inp.pressed('KeyR') === true);
  check('(a) down() tetap true selama tombol ditahan', inp.down('KeyR') === true);
  fire('keyup', keyEv('KeyR'));
  check('(a) down() false setelah keyup', inp.down('KeyR') === false);
}
{
  const inp = freshInput();
  fire('keydown', keyEv('KeyR'));
  inp._pressed.set('KeyR', performance.now() - 1500); // tekan basi >1000 ms
  check('(a) tekan basi (>1 dtk) kedaluwarsa, tak bocor ke ronde berikut', inp.pressed('KeyR') === false);
}
{
  const inp = freshInput();
  fire('keydown', keyEv('KeyR'));
  inp.onFocusLoss();
  check('(a) focus-loss membersihkan buffer tekan', inp.pressed('KeyR') === false);
}
{
  const inp = freshInput();
  // Klik-cepat mouse (semi-otomatis P9): mousedown+mouseup antar-frame.
  fire('mousedown', { button: 0 });
  fire('mouseup', { button: 0 });
  check('(a) klik-cepat mouse tetap terbaca loop', inp.consumeClick() === true);
  check('(a) klik yang sama hanya dikonsumsi sekali', inp.consumeClick() === false);
}
{
  // Bukti kontrol: perilaku LAMA (keyup menghapus key) akan gagal di tes pertama.
  // Simulasi: Set murni + keyup menghapus = pressed() false setelah keyup.
  const keys = new Set();
  keys.add('KeyR'); keys.delete('KeyR'); // keydown lalu keyup sebelum loop
  const oldPressed = keys.has('KeyR') ? (keys.delete('KeyR'), true) : false;
  check('(a) kontrol: model lama memang kehilangan tekan-cepat', oldPressed === false);
}

// ---------- (b) mouse fase beli tak melompat saat live ----------
class BuyMouseInput {
  constructor() { this.keys = new Set(); this.mouseDown = false; this.rightDown = false; this._dx = 0; this._click = false; }
  down(c) { return this.keys.has(c); }
  pressed(c) { return false; }
  consumeMouse() { const r = { dx: this._dx, dy: 0 }; this._dx = 0; return r; }
  consumeClick() { const c = this._click; this._click = false; return c; }
  move(dx) { this._dx += dx; }
}
const DT = 1 / 60;
{
  const s = createState();
  const inp = new BuyMouseInput();
  s.round.timer = 0.2; // 12 tick buy lalu live
  const yaw0 = s.agents[0].yaw;
  for (let i = 0; i < 12; i++) { inp.move(70); simStep(s, DT, inp); } // 840 px selama buy (~106 derajat)
  for (let i = 0; i < 5; i++) simStep(s, DT, inp);
  const dyaw = Math.abs(s.agents[0].yaw - yaw0);
  check('(b) gerak mouse selama buy tak melompatkan yaw saat live', dyaw < 0.01, `dyaw=${dyaw.toFixed(3)} rad (tanpa fix: ~1,85 rad / 106 derajat)`);
}
{
  const s = createState();
  s.round.phase = 'live'; s.round.timer = 100;
  const inp = new BuyMouseInput();
  const yaw0 = s.agents[0].yaw;
  inp.move(100); simStep(s, DT, inp);
  const dyaw = s.agents[0].yaw - yaw0;
  check('(b) gerak mouse saat live tetap memutar pandangan', Math.abs(dyaw + 100 * 0.0022) < 0.001, `dyaw=${dyaw.toFixed(3)} rad`);
}
{
  const s = createState();
  const inp = new BuyMouseInput();
  s.round.timer = 0.2;
  inp._click = true; // klik kanvas selama fase beli
  for (let i = 0; i < 12; i++) simStep(s, DT, inp);
  for (let i = 0; i < 5; i++) simStep(s, DT, inp);
  check('(b) klik selama buy tak menembak saat live', s.agents[0].weapons.secondary.mag === 12, `mag=${s.agents[0].weapons.secondary.mag}`);
}

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
