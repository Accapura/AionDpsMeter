'use strict';
// Разбивка по навыкам: вклад каждого умения, попадания, криты, максимальный удар.
let actor = null, D = null, sortKey = 'dmg', sortDir = -1, showRot = false, rotAt = 0;
const $ = id => document.getElementById(id);
windowControls('grip', 'bMax');
$('bClose').innerHTML = ICON.close; $('bClose').onclick = () => api.win('close');
const pct = v => (v == null ? '—' : (v * 100).toFixed(1).replace('.', ',') + '%');
const COLS = [
  ['name', 'Навык'], ['dmg', 'Урон'], ['share', '% урона'], ['dps', 'DPS'], ['hits', 'Удары'], ['avg', 'Средний'], ['max', 'Макс.'], ['crit', 'Крит'], ['back', 'Спина'], ['perfect', 'Идеал.'], ['heavy', 'Тяж.'], ['multi', 'Мульти'], ['dbl', 'Дабл'],
];

function spark(arr) {
  if (!arr || arr.length < 2) return '';
  const max = Math.max(...arr, 1), w = 100, h = 40;
  const pts = arr.map((v, i) => `${(i / (arr.length - 1) * w).toFixed(2)},${(h - v / max * (h - 2) - 1).toFixed(2)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="Урон по секундам"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>`;
}

function render() {
  if (!D) return;
  if (D.missing) { $('body').innerHTML = '<div class="empty">Этого игрока нет в текущем бою.</div>'; return; }
  $('title').innerHTML = `${classIcon(D.cls)}${nk(D.name)}<span class="muted" style="font-weight:400;font-size:12px">${esc(CLASS_RU[D.cls] || '')}</span>`;
  const q = D.q || {};
  const met = (k, v) => `<div><span>${k}</span><b class="num">${v}</b></div>`;
  const skills = [...(D.skills || [])].sort((a, b) => {
    const x = a[sortKey], y = b[sortKey];
    return (typeof x === 'string' ? String(x).localeCompare(y, 'ru') : (x ?? -1) - (y ?? -1)) * sortDir;
  });
  const top = Math.max(...skills.map(k => k.share || 0), 0.0001);
  $('body').innerHTML = `
    <div class="mets">${met('Урон', fmt(D.dmg))}${met('DPS', fmt(D.dps))}${met('Доля урона', pct(D.share))}${met('Время боя', clock(D.combatMs))}
      ${met('Удары', q.hits ?? '—')}${met('Крит', pct(q.crit))}${met('В спину', pct(q.back))}${met('Идеальные', pct(q.perfect))}${q.heavy != null ? met('Тяжёлые', pct(q.heavy)) : ''}${q.multi != null ? met('Мульти-удар', pct(q.multi)) : ''}${q.dbl != null ? met('Двойной урон', pct(q.dbl)) : ''}
      ${met('Макс. удар', fmt(q.maxHit))}${met('Получено урона', fmt(D.taken))}${D.heal ? met('Лечение', fmt(D.heal)) + met('HPS', fmt(D.heal / Math.max(1, D.combatMs / 1000))) : ''}</div>
    ${q.maxHitSkill ? `<div class="muted" style="font-size:12px">Самый сильный удар: ${nt(q.maxHitSkill)}</div>` : ''}
    ${D.perSecond && D.perSecond.length > 1 ? `<div class="spark">${spark(D.perSecond)}</div>` : ''}
    <div class="tw"><table><thead><tr>${COLS.map(([k, n]) => `<th data-k="${k}" class="${sortKey === k ? 'on' : ''}">${n}${sortKey === k ? (sortDir < 0 ? ' ↓' : ' ↑') : ''}</th>`).join('')}</tr></thead>
    <tbody>${skills.map(k => `<tr><td class="sk" data-notr title="${esc(k.name)}">${esc(k.name)}</td><td class="num">${fmt(k.dmg)}</td>
      <td class="bar num"><i style="width:${((k.share || 0) / top * 100).toFixed(1)}%"></i><span>${pct(k.share)}</span></td>
      <td class="num">${fmt(k.dps)}</td><td class="num">${k.hits}${k.dots ? ' +' + k.dots : ''}</td><td class="num">${fmt(k.avg)}</td><td class="num">${fmt(k.max)}</td><td class="num">${pct(k.crit)}</td><td class="num">${pct(k.back)}</td><td class="num">${pct(k.perfect)}</td><td class="num">${pct(k.heavy)}</td><td class="num">${pct(k.multi)}</td><td class="num">${pct(k.dbl)}</td></tr>`).join('')}</tbody></table></div>
    <div class="rotbox"><button type="button" id="rotBtn" class="btn">${showRot ? 'Скрыть ротацию' : 'Показать ротацию (лента ударов по навыкам)'}</button>${showRot ? (D.rot ? rotationHtml(D.rot) : '<div class="muted">Собираю ленту ударов…</div>') : ''}</div>`;
  const rb = $('rotBtn'); if (rb) rb.onclick = () => { showRot = !showRot; rotAt = 0; if (showRot) api.detail(actor, true); render(); };
  $('body').querySelectorAll('th[data-k]').forEach(th => th.onclick = () => {
    if (sortKey === th.dataset.k) sortDir = -sortDir; else { sortKey = th.dataset.k; sortDir = th.dataset.k === 'name' ? 1 : -1; }
    render();
  });
}

api.on('breakdown-actor', a => { actor = a; D = null; $('body').innerHTML = '<div class="empty">Загрузка…</div>'; api.detail(actor); });
api.on('detail', d => { if (d.id === actor) { if (!d.rot && D && D.id === d.id && D.rot) d.rot = D.rot; D = d; render(); } });
api.on('settings', s => applyTheme(s, 94));
api.state().then(st => applyTheme(st.settings, 94));
setInterval(() => { if (actor == null) return; const wantRot = showRot && Date.now() - rotAt > 3000; if (wantRot) rotAt = Date.now(); api.detail(actor, wantRot); }, 1000);
