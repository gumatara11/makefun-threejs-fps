// EMBERLINE sim — input.js. State keyboard/mouse saja.
// main.js memasang listener (attach) + lepas pointer lock.
export class InputState {
  constructor() {
    this.keys = new Set(); this.mouseDX = 0; this.mouseDY = 0;
    this.mouseDown = false; this.rightDown = false; this.locked = false;
    this.paused = false; this._el = null; this._bound = false;
    this._pressed = new Map(); this._click = false; // (a) buffer tekan antar-frame
  }
  attach(el) {
    if (this._bound || !el) return; this._el = el; this._bound = true;
    this._kd = e => { if (e.repeat) return; this.keys.add(e.code); this._pressed.set(e.code, performance.now()); if (['Space'].includes(e.code)) e.preventDefault(); };
    this._ku = e => this.keys.delete(e.code);
    this._md = e => { if (e.button === 0) { this.mouseDown = true; this._click = true; } if (e.button === 2) this.rightDown = true; };
    this._mu = e => { if (e.button === 0) this.mouseDown = false; if (e.button === 2) this.rightDown = false; };
    this._mm = e => { if (this.locked) { this.mouseDX += e.movementX || 0; this.mouseDY += e.movementY || 0; } };
    this._lc = () => { this.locked = document.pointerLockElement === el; if (!this.locked) this.onFocusLoss(); };
    this._bl = () => this.onFocusLoss();
    el.addEventListener('keydown', this._kd); el.addEventListener('keyup', this._ku);
    el.addEventListener('mousedown', this._md); el.addEventListener('mouseup', this._mu);
    el.addEventListener('mousemove', this._mm);
    document.addEventListener('pointerlockchange', this._lc);
    window.addEventListener('blur', this._bl);
  }
  detach() {
    if (!this._bound) return; const el = this._el;
    el.removeEventListener('keydown', this._kd); el.removeEventListener('keyup', this._ku);
    el.removeEventListener('mousedown', this._md); el.removeEventListener('mouseup', this._mu);
    el.removeEventListener('mousemove', this._mm);
    document.removeEventListener('pointerlockchange', this._lc);
    window.removeEventListener('blur', this._bl); this._bound = false;
  }
  // AMB-31: kehilangan fokus bersihkan tombol + pause.
  onFocusLoss() {
    this.keys.clear(); this._pressed.clear(); this._click = false; this.mouseDown = false; this.rightDown = false;
    this.mouseDX = 0; this.mouseDY = 0; this.paused = true;
  }
  consumeMouse() { const r = { dx: this.mouseDX, dy: this.mouseDY }; this.mouseDX = 0; this.mouseDY = 0; return r; }
  consumeClick() { const c = this._click; this._click = false; return c; }
  down(code) { return this.keys.has(code); }
  // (a) tekan-cepat antar-frame: keyup hanya melepas keys, buffer _pressed tetap
  // dibaca loop (kedaluwarsa 1000 ms agar tak menembak ronde berikutnya).
  pressed(code) { const t = this._pressed.get(code); if (t == null) return false; this._pressed.delete(code); return performance.now() - t < 1000; }
}
