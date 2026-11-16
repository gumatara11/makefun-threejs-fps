// EMBERLINE sim — input.js. State keyboard/mouse saja; tanpa DOM game.
// main.js yang memasang listener (attach) dan melepaskan pointer lock.
export class InputState {
  constructor() {
    this.keys = new Set(); this.mouseDX = 0; this.mouseDY = 0;
    this.mouseDown = false; this.rightDown = false; this.locked = false;
    this.paused = false; this._el = null; this._bound = false;
  }
  attach(el) {
    if (this._bound || !el) return; this._el = el; this._bound = true;
    this._kd = e => { if (e.repeat) return; this.keys.add(e.code); if (['Space'].includes(e.code)) e.preventDefault(); };
    this._ku = e => this.keys.delete(e.code);
    this._md = e => { if (e.button === 0) this.mouseDown = true; if (e.button === 2) this.rightDown = true; };
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
  // AMB-31: kehilangan fokus membersihkan status tombol + pause.
  onFocusLoss() {
    this.keys.clear(); this.mouseDown = false; this.rightDown = false;
    this.mouseDX = 0; this.mouseDY = 0; this.paused = true;
  }
  consumeMouse() { const r = { dx: this.mouseDX, dy: this.mouseDY }; this.mouseDX = 0; this.mouseDY = 0; return r; }
  down(code) { return this.keys.has(code); }
  pressed(code) { if (this.keys.has(code)) { this.keys.delete(code); return true; } return false; }
}
