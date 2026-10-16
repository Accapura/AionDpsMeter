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
  const land = blob(500, 500, 410, 14, .2), seaH = 205, lh = [100, 38, 160, 265, 18][hue % 5];
  let terrain = `<path d="${land}" fill="none" stroke="hsla(${seaH},70%,70%,.22)" stroke-width="38" filter="url(#bl)"/><path d="${land}" fill="none" stroke="hsla(${seaH},70%,75%,.35)" stroke-width="14" filter="url(#bl2)"/>`
    + `<path d="${land}" fill="url(#lg)" stroke="hsla(${lh},35%,80%,.55)" stroke-width="3"/><path d="${land}" fill="url(#hatch)" opacity=".5"/>`;
  for (let i = 0; i < 3; i++) terrain += `<path d="${blob(250 + rnd() * 500, 250 + rnd() * 500, 90 + rnd() * 90, 10, .3)}" fill="hsla(${lh},28%,58%,.16)" stroke="hsla(${lh},30%,80%,.22)" stroke-width="2"/>`;
  for (let c = 0; c < 4; c++) { const fx = 200 + rnd() * 600, fy = 200 + rnd() * 600; for (let i = 0; i < 16; i++) { const a = rnd() * 6.28, d = rnd() * 70; terrain += `<circle cx="${(fx + Math.cos(a) * d).toFixed(0)}" cy="${(fy + Math.sin(a) * d).toFixed(0)}" r="${(7 + rnd() * 8).toFixed(0)}" fill="hsla(125,45%,28%,.7)" stroke="hsla(125,45%,60%,.4)" stroke-width="1.5"/>`; } }
  for (let i = 0; i < 2; i++) { const lx = 250 + rnd() * 500, ly = 250 + rnd() * 500, lr = 40 + rnd() * 45; terrain += `<path d="${blob(lx, ly, lr, 9, .28)}" fill="url(#wg)" stroke="hsla(${seaH},70%,82%,.55)" stroke-width="2.5"/>`; }
  const rx = [150 + rnd() * 700, 150 + rnd() * 700, 150 + rnd() * 700], re = (200 + rnd() * 600).toFixed(0);
  terrain += `<path d="M${rx[0].toFixed(0)} 90C${rx[1].toFixed(0)} 300 ${rx[2].toFixed(0)} 600 ${re} 920" fill="none" stroke="hsla(${seaH},60%,35%,.7)" stroke-width="11" stroke-linecap="round"/><path d="M${rx[0].toFixed(0)} 90C${rx[1].toFixed(0)} 300 ${rx[2].toFixed(0)} 600 ${re} 920" fill="none" stroke="hsla(${seaH},75%,70%,.65)" stroke-width="5" stroke-linecap="round"/>`;
  for (let i = 0; i < 16; i++) { const mx = 120 + rnd() * 760, my = 140 + rnd() * 740, k = 16 + rnd() * 16; terrain += `<path d="M${(mx - k).toFixed(0)} ${my.toFixed(0)}L${mx.toFixed(0)} ${(my - k * 1.5).toFixed(0)}L${(mx + k).toFixed(0)} ${my.toFixed(0)}Z" fill="hsla(${lh},20%,30%,.75)" stroke="hsla(${lh},30%,85%,.45)" stroke-width="2" stroke-linejoin="round"/><path d="M${mx.toFixed(0)} ${(my - k * 1.5).toFixed(0)}L${(mx + k).toFixed(0)} ${my.toFixed(0)}L${(mx + k * .2).toFixed(0)} ${my.toFixed(0)}Z" fill="hsla(${lh},20%,12%,.45)"/><path d="M${(mx - k * .3).toFixed(0)} ${(my - k * 1.05).toFixed(0)}L${mx.toFixed(0)} ${(my - k * 1.5).toFixed(0)}L${(mx + k * .3).toFixed(0)} ${(my - k * 1.05).toFixed(0)}Z" fill="rgba(255,255,255,.7)"/>`; }
  const zones = pts.map(p => `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="150" fill="url(#zg)"/>`).join('');
  let rings = ''; for (let r = 1; r <= 5; r++) rings += `<circle cx="${W / 2}" cy="${H / 2}" r="${r * 100}" fill="none" stroke="hsla(${hue},40%,80%,.07)" stroke-width="1.5" stroke-dasharray="${r % 2 ? '2 8' : '10 10'}"/>`;
  const bg = `<defs><radialGradient id="zg"><stop offset="0" stop-color="hsl(${hue},75%,62%)" stop-opacity=".45"/><stop offset="1" stop-color="hsl(${hue},75%,62%)" stop-opacity="0"/></radialGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${seaH},45%,20%)"/><stop offset="1" stop-color="hsl(${seaH + 15},50%,10%)"/></linearGradient>
    <radialGradient id="lg" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="hsl(${lh},28%,40%)"/><stop offset="1" stop-color="hsl(${lh},30%,22%)"/></radialGradient>
    <radialGradient id="wg"><stop offset="0" stop-color="hsl(${seaH},65%,55%)"/><stop offset="1" stop-color="hsl(${seaH},60%,28%)"/></radialGradient>
    <radialGradient id="vg" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>
    <pattern id="hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V14" stroke="rgba(255,255,255,.07)" stroke-width="3"/></pattern>
    <filter id="bl" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="18"/></filter><filter id="bl2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
    <filter id="sh" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000" flood-opacity=".6"/></filter></defs>
    <rect width="${W}" height="${H}" fill="url(#sea)"/>${terrain}${zones}<rect width="${W}" height="${H}" fill="url(#vg)"/>`;
  const m = 1 / (2 * half) * W, scaleU = [10, 20, 50, 100, 200, 500].find(u => u * m >= 120) || 500;
  const compass = `<g transform="translate(920 90)" fill="none" stroke="hsla(${hue},60%,85%,.55)" stroke-width="3"><circle r="38"/><path d="M0-54L9-10L0-22L-9-10Z" fill="hsla(${hue},60%,85%,.75)"/><path d="M0 54L0 22M-54 0L-22 0M54 0L22 0"/><text y="-62" text-anchor="middle" fill="hsla(${hue},60%,90%,.8)" stroke="none" font-size="24" font-weight="700">С</text></g>
    <g transform="translate(60 950)" stroke="hsla(${hue},60%,85%,.7)" stroke-width="4"><path d="M0 0H${(scaleU * m).toFixed(0)}M0-8V8M${(scaleU * m).toFixed(0)}-8V8"/><text x="0" y="-16" fill="hsla(${hue},60%,90%,.8)" stroke="none" font-size="22">${scaleU} м</text></g>`;
  const mk = (p, sel) => {
    const X = +sx(p.x).toFixed(1), Y = +sy(p.y).toFixed(1), col = sel ? 'var(--accent)' : p.alive ? 'var(--hp)' : '#c9ced8', fs = sel ? 24 : 18, w = String(p.name).length * (sel ? 15.5 : 11.5) + 28;
    const reticle = sel ? `<g stroke="var(--accent)" fill="none" stroke-linecap="round"><path d="M0 ${Y}H${X - 34}M${X + 34} ${Y}H${W}M${X} 0V${Y - 34}M${X} ${Y + 34}V${H}" stroke-width="1.5" stroke-dasharray="3 9" opacity=".7"/><path d="M${X - 30} ${Y - 14}V${Y - 30}H${X - 14}M${X + 14} ${Y - 30}H${X + 30}V${Y - 14}M${X + 30} ${Y + 14}V${Y + 30}H${X + 14}M${X - 14} ${Y + 30}H${X - 30}V${Y + 14}" stroke-width="4"/></g><circle class="ring" cx="${X}" cy="${Y}" r="20"/>` : '';
    return `${reticle}<g filter="url(#sh)"><circle cx="${X}" cy="${Y}" r="${sel ? 12 : 8}" fill="${col}" stroke="#fff" stroke-width="${sel ? 4 : 2.5}"/></g>`
      + `<g transform="translate(${X} ${Y - (sel ? 52 : 28)})" opacity="${sel ? 1 : .8}"><rect x="${-w / 2}" y="${-fs * .85}" width="${w}" height="${fs * 1.5}" rx="${fs * .75}" fill="rgba(12,14,22,.8)" stroke="${sel ? 'var(--accent)' : 'rgba(255,255,255,.22)'}" stroke-width="${sel ? 2.5 : 1.5}"/><text class="lbl" style="font-size:${fs}px" y="${fs * .3}" text-anchor="middle">${esc(p.name)}</text></g>`;
  };
  const dots = pts.filter(p => p.slot !== D.slot).map(p => mk(p, false)).join('') + pts.filter(p => p.slot === D.slot).map(p => mk(p, true)).join('');
  const me = pts.find(p => p.slot === D.slot);
  $('body').innerHTML = `<div class="map"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${bg}${g}${compass}${dots}</svg></div>
    <div class="info"><b>${esc(D.name)}</b> · ${esc(D.map)}${me ? ` · X ${Math.round(me.x)}, Y ${Math.round(me.y)}` : ''}<br>${esc(tr('Схема по координатам из игры: север сверху, масштаб подгоняется под известные точки. Это не карта из игры.'))}</div>`;
  if (typeof translate === 'function') translate(document.body, D.lang);
}
api.on('fbmap-data', d => { D = d; applyTheme({ theme: d.theme }, 94); render(); });
api.on('settings', s => applyTheme(s, 94));
api.state().then(st => applyTheme(st.settings, 94));
