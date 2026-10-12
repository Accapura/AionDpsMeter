'use strict';
let data = { toasts: [] }, played = new Set();
const TYPE = { world: 'Мировой ивент', pve: 'PvE', pvp: 'PvP', reset: 'Сброс', info: 'Aion DPS Meter', update: 'Обновление', death: 'Разбор смерти' };
// кнопки и полоса загрузки под текстом уведомления
function foot(t) {
  const bar = t.progress != null ? `<div class="pbar"><i style="width:${Math.round(Math.max(0, Math.min(1, t.progress)) * 100)}%"></i></div>` : '';
  const acts = (t.actions || []).map(a => `<button class="ta${a.primary ? ' pri' : ''}" data-key="${esc(t.key)}" data-act="${esc(a.id)}">${esc(a.label)}</button>`).join('');
  return bar + (acts ? `<div class="acts">${acts}</div>` : '');
}
// Карточка обновления — одна для всех стилей уведомлений.
function updCard(t) {
  const busy = t.state === 'downloading' || t.state === 'installing';
  const pr = Math.round(Math.max(0, Math.min(1, t.progress || 0)) * 100);
  const line = t.state === 'downloading' ? `<span>Загрузка</span> <b class="num">${pr}%</b>` : t.state === 'installing' ? '<span>Перезапуск…</span>' : t.state === 'error' ? `<span class="err">${esc(t.text || '')}</span>` : `<span>${esc(t.kind)}</span>`;
  return `<div class="upd${busy ? ' busy' : ''}">
    <div class="uh"><div class="uic">${eventIcon({ icon: 'update' }, 22)}</div>
      <div class="ut"><div class="uk"><span>Доступно обновление</span></div><div class="un">Aion DPS Meter <b>${esc(t.ver)}</b></div>
      <div class="uv"><span class="old">${esc(t.cur)}</span><span class="ar">→</span><span class="new">${esc(t.ver)}</span>${t.size ? `<span class="dot">·</span><span>${esc(t.size)}</span>` : ''}</div>
      <div class="ul">${line}</div></div>
      <button class="icon x" data-k="${esc(t.key)}" aria-label="Закрыть уведомление">${ICON.close}</button></div>
    ${busy ? `<div class="ubar"><i style="width:${t.state === 'installing' ? 100 : pr}%"></i></div>` : `<div class="uacts">${(t.actions || []).map(a => `<button class="ta${a.primary ? ' pri' : ''}" data-key="${esc(t.key)}" data-act="${esc(a.id)}">${a.primary ? '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5l5-5M5 20h14"/></svg>' : ''}${esc(a.label)}</button>`).join('')}<button class="link" data-key="${esc(t.key)}" data-act="upd-notes">Что нового ›</button></div>`}
  </div>`;
}
function render() {
  applyTheme({ theme: data.theme }, 94);
  document.body.style.justifyContent = data.top ? 'flex-start' : 'flex-end';
  const st = data.style || 'glass', icSize = st === 'banner' ? 44 : st === 'minimal' ? 20 : 24;
  document.body.innerHTML = data.toasts.map(t => {
    if (t.type === 'update') return updCard(t);
    const left = t.start ? Math.max(0, Math.floor((t.start - Date.now()) / 1000)) : 0;
    const at = t.start ? ' · в ' + new Date(t.start).toLocaleTimeString(data.lang === 'en' ? 'en-GB' : 'ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
    const line = t.start ? `Начало через <b class="num">${left >= 3600 ? Math.floor(left / 3600) + ' ч ' : ''}${clock((left % 3600) * 1000)}</b>` : esc(t.text || 'Смотрите окно «Расписание»');
    return `<div class="t s-${st}${t.actions?.length || t.progress != null ? ' tall' : ''}"><div class="ic">${eventIcon(t, icSize)}</div><div class="b"><div class="k">${TYPE[t.type] || 'Ивент'}${at}</div>
      <div class="n">${esc(t.name)}</div><div class="l">${line}</div>${foot(t)}</div>
      <button class="icon x" data-k="${esc(t.key)}" aria-label="Закрыть уведомление">${ICON.close}</button></div>`;
  }).join('');
  document.querySelectorAll('[data-k]').forEach(b => b.onclick = () => api.toastClose(b.dataset.k));
  document.querySelectorAll('[data-act]').forEach(b => b.onclick = () => api.toastAction(b.dataset.key, b.dataset.act));
  if (typeof translate === 'function') translate(document.body, data.lang);
}
api.on('toasts', d => {
  data = d; render();
  let fresh = false;
  for (const t of d.toasts) if (!played.has(t.key)) { played.add(t.key); fresh = true; }
  if (d.sound && fresh) playSound(d.soundName, d.volume);
});
setInterval(render, 1000);
