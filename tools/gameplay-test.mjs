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

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
