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
  const dots = pts.map(p => {
    const sel = p.slot === D.slot, X = sx(p.x).toFixed(1), Y = sy(p.y).toFixed(1);
    return `${sel ? `<circle class="ring" cx="${X}" cy="${Y}" r="22"/>` : ''}<circle class="dot${sel ? ' sel' : p.alive ? ' live' : ''}" cx="${X}" cy="${Y}" r="${sel ? 16 : 11}"/>`
      + `<text class="lbl" x="${X}" y="${(+Y - 26).toFixed(1)}" text-anchor="middle">${esc(p.name)}</text>`;
  }).join('');
  const me = pts.find(p => p.slot === D.slot);
  $('body').innerHTML = `<div class="map"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${g}${dots}</svg></div>
    <div class="info"><b>${esc(D.name)}</b> · ${esc(D.map)}${me ? ` · X ${Math.round(me.x)}, Y ${Math.round(me.y)}` : ''}<br>${esc(tr('Схема по координатам из игры: север сверху, масштаб подгоняется под известные точки. Это не карта из игры.'))}</div>`;
  if (typeof translate === 'function') translate(document.body, D.lang);
}
api.on('fbmap-data', d => { D = d; applyTheme({ theme: d.theme }, 94); render(); });
api.on('settings', s => applyTheme(s, 94));
api.state().then(st => applyTheme(st.settings, 94));
