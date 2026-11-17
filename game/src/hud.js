// EMBERLINE — hud.js. HUD DOM + minimap live + buy menu (baca state tiap frame).
import { WEAPONS, GRENADES, CONFIG } from './config.js';
import { buyItem } from './rounds.js';
import { currentWeapon } from './state.js';

const $ = (id) => document.getElementById(id);
const BUY_ROWS = [
  ...Object.values(WEAPONS).filter((w) => w.slot === 'primary').map((w) => ({ key: w.key, name: w.name, price: w.price })),
  { key: 'Kevlar', name: 'Kevlar (vest+helm)', price: CONFIG.kevlarPrice },
  ...Object.values(GRENADES).map((g) => ({ key: g.key, name: g.key, price: g.price })),
];
export function createHud(state, onBuyOpen) {
  const mm = $('minimap').getContext('2d');
  let lastFeed = 0, lastMm = 0, dmgAt = 0, dmgAng = 0, hitAt = 0, hitKill = false, buyOpen = false, stickyBanner = false;
  const list = $('buy-list');
  BUY_ROWS.forEach((r, i) => {
    const d = document.createElement('div');
    d.className = 'buy-row'; d.dataset.key = r.key;
    d.innerHTML = `<span class="buy-key">${i + 1}</span><span class="buy-name">${r.name}</span><span class="buy-price">$${r.price}</span>`;
    d.addEventListener('click', () => tryBuy(r.key));
    list.appendChild(d);
  });
  function tryBuy(key) {
    const r = buyItem(state, state.agents[0], key);
    if (r.ok) { const el = list.querySelector(`[data-key="${key}"]`); if (el) el.classList.add('owned'); }
    return r.ok;
  }
  function setBuy(open) {
    buyOpen = open && state.round.phase === 'buy';
    $('buy-menu').style.display = buyOpen ? 'block' : 'none';
    if (onBuyOpen) onBuyOpen(buyOpen);
  }
  function drawMinimap() {
    const W = 192, H = 144, sx = W / 72, sz = H / 48;
    mm.clearRect(0, 0, W, H);
    const R = (x, y, w, h, c) => { mm.fillStyle = c; mm.fillRect(x * sx, y * sz, w * sx, h * sz); };
    R(0, 0, 72, 48, 'rgba(10,20,28,0.72)');
    mm.strokeStyle = 'rgba(255,255,255,.65)'; mm.lineWidth = 1.5;
    for (const z of [10, 25, 40]) { mm.beginPath(); mm.moveTo(4 * sx, z * sz); mm.lineTo(68 * sx, z * sz); mm.stroke(); }
    R(56, 32, 13, 12, '#ff7a1a'); R(56, 4, 13, 12, '#2f9dff');
    R(28, 14, 4, 22, '#3a6a4a'); R(29.7, 21, 0.6, 8, '#c9a06a');
    R(29.7, 21 + 2 * state.door.open, 0.6, 6 - 4 * state.door.open, '#e8e8e8');
    mm.font = 'bold 17px sans-serif'; mm.textAlign = 'center'; mm.textBaseline = 'middle';
    mm.lineWidth = 3; mm.strokeStyle = 'rgba(0,0,0,.85)'; mm.fillStyle = '#fff';
    const T = (t, x, y) => { mm.strokeText(t, x * sx, y * sz); mm.fillText(t, x * sx, y * sz); };
    T('A', 62.5, 38); T('B', 62.5, 10);
    const b = state.bomb;
    if (b && b.status === 'planted') { mm.fillStyle = '#ff2222'; mm.beginPath(); mm.arc(b.x * sx, b.z * sz, 5, 0, 7); mm.fill(); }
    else if (b && b.status === 'dropped') { mm.fillStyle = '#ffcc00'; mm.fillRect(b.x * sx - 3, b.z * sz - 3, 6, 6); }
    for (const a of state.agents) {
      if (!a.alive) continue;
      mm.fillStyle = a.team === 'atk' ? '#ff7a1a' : '#2f9dff';
      mm.beginPath(); mm.arc(a.x * sx, a.z * sz, a.isPlayer ? 4 : 3, 0, 7); mm.fill();
      if (a.isPlayer) { mm.strokeStyle = '#fff'; mm.beginPath(); mm.arc(a.x * sx, a.z * sz, 6, 0, 7); mm.stroke(); }
    }
  }
  function update(now) {
    const p = state.agents[0], w = currentWeapon(p);
    $('hp-num').textContent = Math.max(0, Math.ceil(p.hp));
    $('hp-bar').style.width = Math.max(0, p.hp) + '%';
    $('hp-bar').style.background = p.hp > 50 ? '#3ec96a' : p.hp > 25 ? '#f2c200' : '#e83a2f';
    $('ammo-mag').textContent = w ? w.mag : '—';
    $('ammo-res').textContent = w ? '/' + w.reserve : '';
    $('weapon-value').textContent = w ? (WEAPONS[w.key].name + (p.reloadUntil > state.now ? ' • RELOAD' : '')) : '—';
    const t = Math.max(0, state.round.timer);
    $('timer').textContent = state.round.phase === 'bomb' && state.bomb ? '💣 ' + state.bomb.timer.toFixed(1) : String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0');
    $('score-atk').textContent = state.match.scoreAtk;
    $('score-def').textContent = state.match.scoreDef;
    $('money').textContent = '$' + p.money;
    $('round-num').textContent = 'RONDE ' + state.match.round;
    for (const team of ['atk', 'def']) {
      const el = $(team === 'atk' ? 'team-atk' : 'team-def');
      el.textContent = state.agents.filter((a) => a.team === team).map((a) => a.alive ? '●' : '○').join(' ');
    }
    const bs = $('bomb-status');
    if (state.round.phase === 'bomb' && state.bomb) bs.textContent = 'BOM TERPLANT — SITE ' + state.bomb.site + ' • ' + state.bomb.timer.toFixed(1) + ' dtk';
    else if (p.planting) bs.textContent = 'PLANTING… ' + (p.plantProg / CONFIG.timePlant * 100).toFixed(0) + '%';
    else if (p.defusing) bs.textContent = 'DEFUSING… ' + (p.defuseProg / CONFIG.timeDefuse * 100).toFixed(0) + '%';
    else if (state.bomb && state.bomb.status === 'dropped') bs.textContent = 'BOM JATUH — ambil!';
    else bs.textContent = state.round.phase === 'buy' ? 'FASE BELI — tekan B' : '';
    const moving = Math.hypot(p.vx, p.vz) > 1, fired = state.now - p.lastShotAt < 0.12;
    const gap = 6 + (moving ? 8 : 0) + (fired ? 6 : 0) + (p.crouch ? -2 : 0);
    $('crosshair').style.setProperty('--gap', gap + 'px');
    $('crosshair').style.display = p.scoped ? 'none' : 'block';
    $('scope').style.display = p.scoped ? 'block' : 'none';
    for (let i = lastFeed; i < state.events.length; i++) {
      const ev = state.events[i];
      if (ev.type === 'kill') {
        const k = ev.killer >= 0 ? state.agents[ev.killer].name : '—';
        const v = state.agents[ev.victim].name;
        const d = document.createElement('div');
        d.className = 'feed-line'; d.textContent = `${k} ✕ ${v}${ev.zone === 'head' ? ' (HEADSHOT)' : ''}`;
        $('killfeed').appendChild(d);
        while ($('killfeed').children.length > 5) $('killfeed').firstChild.remove();
        setTimeout(() => d.remove(), 6000);
      }
      if (ev.type === 'hit' && ev.target === 0) {
        const from = state.agents[ev.from];
        if (from) { dmgAt = now; dmgAng = Math.atan2(from.z - p.z, from.x - p.x) - p.yaw; }
      }
      if (ev.type === 'hitmarker' && ev.shooter === 0) { hitAt = now; hitKill = ev.kill; }
      if (ev.type === 'round-end' && !stickyBanner) showBanner(ev);
    }
    lastFeed = state.events.length;
    const hm = $('hitmarker');
    hm.style.opacity = now - hitAt < 0.18 ? 1 : 0;
    hm.style.color = hitKill ? '#ff2222' : '#fff';
    const di = $('dmg-ind');
    if (now - dmgAt < 0.9) { di.style.opacity = 1; di.style.transform = `translate(-50%,-50%) rotate(${dmgAng}rad)`; }
    else di.style.opacity = 0;
    if (buyOpen) {
      $('buy-money').textContent = '$' + p.money;
      list.querySelectorAll('.buy-row').forEach((el) => {
        const r = BUY_ROWS.find((x) => x.key === el.dataset.key);
        const owned = r.key === 'Kevlar' ? p.kevlar : r.key === 'P9' ? true
          : p.weapons.primary && p.weapons.primary.key === r.key ? true
          : GRENADES[r.key] ? p.grenades[r.key] > 0 : false;
        el.classList.toggle('cant', p.money < r.price && !owned);
        el.classList.toggle('owned', !!owned);
      });
    }
    if (now - lastMm > 0.1) { drawMinimap(); lastMm = now; }
  }
  function showBanner(ev, sticky) {
    const b = $('banner');
    const win = ev.winner === 'atk';
    b.textContent = win ? '🏆 PENYERANG MENANG — ' + (ev.reason || '') : '🛡️ DEFENDER MENANG — ' + (ev.reason || '');
    b.style.display = 'block'; b.className = 'hud ' + (win ? 'win' : 'lose');
    if (sticky) { stickyBanner = true; return; }
    setTimeout(() => { b.style.display = 'none'; }, 4000);
  }
  return { update, setBuy, tryBuy, isBuyOpen: () => buyOpen, showBanner, buyKeys: BUY_ROWS.map((r) => r.key) };
}
