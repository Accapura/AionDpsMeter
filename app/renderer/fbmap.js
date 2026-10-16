'use strict';
// Схема карты: точки появления полевых боссов, выбранный босс подсвечен.
// Это не картинка из игры, а схема по координатам из игровых пакетов; границы подбираются по увиденным точкам.
const $ = id => document.getElementById(id);
windowControls('grip', 'bMax');
$('bClose').innerHTML = ICON.close; $('bClose').onclick = () => api.win('close');
let D = null;
function render() {
  if (!D) return;
  const tr = s => s;
  $('title').textContent = (D.name ? D.name + ' · ' : '') + (D.map || tr('Карта босса'));
  if (!D.known) {
    $('body').innerHTML = `<div class="empty">${esc(tr('Координаты этого босса ещё не известны. Они запоминаются, когда босс появляется в игре, пока вы в этой зоне.'))}</div>`;
    return;
  }
  const pts = D.points;
  let x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
  const span = Math.max(x1 - x0, y1 - y0, 60), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, half = span / 2 * 1.35;
  const W = 1000, H = 1000, sx = x => (x - (cx - half)) / (2 * half) * W, sy = y => H - (y - (cy - half)) / (2 * half) * H;
  let g = '';
  for (let i = 1; i < 8; i++) g += `<line class="g" x1="${i * W / 8}" y1="0" x2="${i * W / 8}" y2="${H}"/><line class="g" x1="0" y1="${i * H / 8}" x2="${W}" y2="${i * H / 8}"/>`;
  // Свой стилизованный фон: оттенок зависит от названия карты, вокруг точек — мягкие зоны, сверху компас и масштаб.
  let h = 0; for (const c of String(D.map || '')) h = (h * 31 + c.charCodeAt(0)) % 360;
  const hue = (h + 360) % 360;
  // Рисованная «местность» (декор): сид — название карты, чтобы у каждой карты был свой узнаваемый рисунок.
  let seed = 7; for (const c of String(D.map || 'x')) seed = (seed * 131 + c.charCodeAt(0)) >>> 0;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const blob = (cx, cy, r, n, j) => {
    const P = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = r * (1 - j + rnd() * j * 2); P.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let d = 'M' + mid(P[n - 1], P[0]).map(v => v.toFixed(1)).join(' ');
    for (let i = 0; i < n; i++) d += 'Q' + P[i].map(v => v.toFixed(1)).join(' ') + ' ' + mid(P[i], P[(i + 1) % n]).map(v => v.toFixed(1)).join(' ');
    return d + 'Z';
  };
  const land = blob(500, 500, 400, 12, .22);
  let terrain = `<path d="${land}" fill="hsla(${hue},30%,45%,.16)" stroke="hsla(${hue},50%,75%,.35)" stroke-width="3"/><path d="${blob(500, 500, 330, 12, .25)}" fill="hsla(${hue},30%,55%,.07)" stroke="hsla(${hue},40%,75%,.15)" stroke-width="2"/>`;
  for (let i = 0; i < 2; i++) terrain += `<path d="${blob(250 + rnd() * 500, 250 + rnd() * 500, 45 + rnd() * 50, 8, .3)}" fill="hsla(205,55%,50%,.22)" stroke="hsla(205,55%,75%,.4)" stroke-width="2"/>`;
  const rx = [150 + rnd() * 700, 150 + rnd() * 700, 150 + rnd() * 700];
  terrain += `<path d="M${rx[0].toFixed(0)} 90C${rx[1].toFixed(0)} 300 ${rx[2].toFixed(0)} 600 ${(200 + rnd() * 600).toFixed(0)} 920" fill="none" stroke="hsla(205,60%,65%,.35)" stroke-width="7" stroke-linecap="round"/>`;
  for (let i = 0; i < 14; i++) { const mx = 120 + rnd() * 760, my = 120 + rnd() * 760, k = 14 + rnd() * 14; terrain += `<path d="M${(mx - k).toFixed(0)} ${my.toFixed(0)}L${mx.toFixed(0)} ${(my - k * 1.3).toFixed(0)}L${(mx + k).toFixed(0)} ${my.toFixed(0)}" fill="none" stroke="hsla(${hue},40%,85%,.3)" stroke-width="3" stroke-linejoin="round"/>`; }
  const zones = pts.map(p => `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="170" fill="url(#zg)"/>`).join('');
  let rings = ''; for (let r = 1; r <= 5; r++) rings += `<circle cx="${W / 2}" cy="${H / 2}" r="${r * 100}" fill="none" stroke="hsla(${hue},40%,70%,.10)" stroke-width="1.5" stroke-dasharray="${r % 2 ? '2 8' : '10 10'}"/>`;
  const bg = `<defs><radialGradient id="zg"><stop offset="0" stop-color="hsl(${hue},55%,55%)" stop-opacity=".38"/><stop offset="1" stop-color="hsl(${hue},55%,55%)" stop-opacity="0"/></radialGradient>
    <linearGradient id="bgg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},35%,18%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},30%,9%)"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#bgg)" opacity=".85"/>${terrain}${rings}${zones}`;
  const m = 1 / (2 * half) * W, scaleU = [10, 20, 50, 100, 200, 500].find(u => u * m >= 120) || 500;
  const compass = `<g transform="translate(920 90)" fill="none" stroke="hsla(${hue},60%,85%,.55)" stroke-width="3"><circle r="38"/><path d="M0-54L9-10L0-22L-9-10Z" fill="hsla(${hue},60%,85%,.75)"/><path d="M0 54L0 22M-54 0L-22 0M54 0L22 0"/><text y="-62" text-anchor="middle" fill="hsla(${hue},60%,90%,.8)" stroke="none" font-size="24" font-weight="700">С</text></g>
    <g transform="translate(60 950)" stroke="hsla(${hue},60%,85%,.7)" stroke-width="4"><path d="M0 0H${(scaleU * m).toFixed(0)}M0-8V8M${(scaleU * m).toFixed(0)}-8V8"/><text x="0" y="-16" fill="hsla(${hue},60%,90%,.8)" stroke="none" font-size="22">${scaleU} ед.</text></g>`;
  const dots = pts.map(p => {
    const sel = p.slot === D.slot, X = sx(p.x).toFixed(1), Y = sy(p.y).toFixed(1);
    return `${sel ? `<circle class="ring" cx="${X}" cy="${Y}" r="22"/>` : ''}<circle class="dot${sel ? ' sel' : p.alive ? ' live' : ''}" cx="${X}" cy="${Y}" r="${sel ? 16 : 11}"/>`
      + `<text class="lbl" x="${X}" y="${(+Y - 26).toFixed(1)}" text-anchor="middle">${esc(p.name)}</text>`;
  }).join('');
  const me = pts.find(p => p.slot === D.slot);
  $('body').innerHTML = `<div class="map"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${bg}${g}${compass}${dots}</svg></div>
    <div class="info"><b>${esc(D.name)}</b> · ${esc(D.map)}${me ? ` · X ${Math.round(me.x)}, Y ${Math.round(me.y)}` : ''}<br>${esc(tr('Схема по координатам из игры: север сверху, масштаб подгоняется под известные точки. Это не карта из игры.'))}</div>`;
  if (typeof translate === 'function') translate(document.body, D.lang);
}
api.on('fbmap-data', d => { D = d; applyTheme({ theme: d.theme }, 94); render(); });
api.on('settings', s => applyTheme(s, 94));
api.state().then(st => applyTheme(st.settings, 94));
