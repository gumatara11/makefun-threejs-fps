// EMBERLINE — audio.js. Synth WebAudio SEMUA.
// Satu sumber kebenaran: events 'noise'/'muzzle'/'explosion'/'beep'/'plant'/'defuse'/'round-end'/'hit'.
import { CONFIG } from './config.js';

let ctx = null, master = null, noiseBuf = null, active = 0, vol = 0.5, muted = false;
const MAX_VOICES = 8;
function ensure() {
  if (ctx) return ctx;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = muted ? 0 : vol; master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
export function initAudio() { ensure(); resumeAudio(); }
export function setVolume(v) { vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = muted ? 0 : vol; }
export function setMuted(m) { muted = !!m; if (master) master.gain.value = muted ? 0 : vol; }
export function isMuted() { return muted; }
function env(g, t, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}
function burst(dur, freq, type, peak, vol) { // noise burst + filter
  if (!ctx || active >= MAX_VOICES) return;
  active++;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain(); env(g, t, 0.004, peak, dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + 0.05);
  src.onended = () => active--;
  void vol;
}
function tone(freq, dur, type, peak, slideTo) {
  if (!ctx || active >= MAX_VOICES) return;
  active++;
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  env(g, t, 0.005, peak, dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  o.onended = () => active--;
}
const SHOT = {
  P9: () => { burst(0.09, 1800, 'lowpass', 0.5); tone(180, 0.07, 'square', 0.18, 70); },
  Breacher: () => { burst(0.22, 900, 'lowpass', 0.7); tone(90, 0.18, 'square', 0.25, 45); },
  Kestrel: () => { burst(0.06, 2400, 'bandpass', 0.4); tone(240, 0.05, 'square', 0.12, 120); },
  VK47: () => { burst(0.12, 1400, 'lowpass', 0.6); tone(140, 0.1, 'square', 0.22, 55); },
  Longbow: () => { burst(0.3, 700, 'lowpass', 0.8); tone(70, 0.25, 'sine', 0.3, 35); },
};
function volFor(dist) { return Math.max(0.05, 1 / (1 + dist / 18)); }
export function drainAudio(state, idx) {
  if (!ctx) return state.events.length;
  const p = state.agents[0];
  for (let i = idx; i < state.events.length; i++) {
    const ev = state.events[i];
    const d = ev.x !== undefined ? Math.hypot(p.x - ev.x, p.z - ev.z) : 0;
    const v = volFor(d);
    if (v < 0.06 && ev.type !== 'round-end') continue;
    if (ev.type === 'muzzle' && SHOT[ev.weapon]) { if (d < 60) SHOT[ev.weapon](); }
    else if (ev.type === 'noise' && ev.kind === 'step') { if (d < 14) burst(0.05, 500, 'lowpass', 0.12 * v); }
    else if (ev.type === 'noise' && ev.kind === 'plant') { tone(880, 0.1, 'square', 0.2); tone(880, 0.1, 'square', 0.2); }
    else if (ev.type === 'noise' && ev.kind === 'throw') { burst(0.08, 800, 'bandpass', 0.15 * v); }
    else if (ev.type === 'explosion') { burst(0.7, 400, 'lowpass', 0.9 * v); tone(55, 0.6, 'sine', 0.4 * v, 30); }
    else if (ev.type === 'beep') { tone(1200, 0.07, 'square', 0.18); }
    else if (ev.type === 'plant') { tone(660, 0.12, 'square', 0.2); tone(990, 0.18, 'square', 0.2); }
    else if (ev.type === 'defuse') { tone(990, 0.12, 'square', 0.2); tone(660, 0.18, 'square', 0.2); }
    else if (ev.type === 'round-end') { // stinger menang/kalah
      const win = ev.winner === 'atk';
      [523, 659, 784].forEach((f, k) => setTimeout(() => tone(f, 0.22, 'triangle', 0.25), k * 110));
      if (!win) setTimeout(() => tone(392, 0.4, 'triangle', 0.25), 330);
    }
    else if (ev.type === 'hitmarker' && ev.shooter === 0) { tone(ev.kill ? 1400 : 1000, 0.05, 'square', ev.kill ? 0.25 : 0.15); }
  }
  return state.events.length;
}
export function playReload() { if (!ctx) return; tone(1500, 0.04, 'square', 0.15); setTimeout(() => tone(900, 0.05, 'square', 0.18), 180); }
export function playDoor() { if (!ctx) return; burst(0.5, 300, 'bandpass', 0.2); tone(120, 0.4, 'sawtooth', 0.06, 90); }
export { CONFIG };
