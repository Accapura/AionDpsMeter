'use strict';
let S = null, D = null, dayOff = 0, editId = null;
const $ = id => document.getElementById(id);
const C = window.ScheduleCore;
const SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const TYPE = { world: ['Мировой', '#ffc66b'], pve: ['PvE', '#7fd0ff'], pvp: ['PvP', '#ffa36b'], reset: ['Сброс', '#c9b6ff'] };
const pad = n => String(n).padStart(2, '0');
// Часы, по которым показывается расписание: часы выбранного сервера или свои.
const TZ = () => (S && S.timeMode === 'local') || !D?.serverTz ? Intl.DateTimeFormat().resolvedOptions().timeZone : D.serverTz;
const hm = t => { const p = C.parts(t, TZ()); return pad(p.h) + ':' + pad(p.mi); };
function left(sec) {
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return (d ? d + ' д ' : '') + pad(h) + ':' + pad(m) + ':' + pad(s);
}
const dayStart = off => { const tz = TZ(), p = C.parts(Date.now(), tz); return C.zoned(p.y, p.mo, p.d + off, 0, 0, tz); };

windowControls('grip', 'bMax');
$('bClose').innerHTML = ICON.close; $('bClose').onclick = () => api.win('close');
$('fDays').innerHTML = SHORT.map((d, i) => `<label><input type="checkbox" value="${i}">${d}</label>`).join('');
$('server').onchange = e => {
  if (e.target.value === '__auto') return api.set({ serverAuto: true });
  const s = (D?.servers || []).find(x => String(x.id) === e.target.value);
  api.set({ serverAuto: false, serverId: s ? s.id : 0, server: s ? s.name : '', region: s ? s.region : S.region });
};
document.querySelectorAll('[data-tm]').forEach(b => b.onclick = () => api.set({ timeMode: b.dataset.tm }));
$('bFeed').onclick = async () => { $('bFeed').disabled = true; await api.feedUpdate(); $('bFeed').disabled = false; };

// Все ивенты: из расписания, свои и полевые боссы сервера.
function events() {
  const out = (D?.feed?.events || []).map(e => ({ ...e, bell: S.bells[e.id] ?? e.bell !== false, src: 'feed' }));
  for (const e of S.events) out.push({ ...C.fromCustom(e), bell: e.bell !== false, src: 'mine' });
  return out;
}
const hourly = e => e.rule?.kind === 'interval' && e.rule.everyMin < 180;

function itemsOfDay(off) {
  const from = dayStart(off), to = dayStart(off + 1) - 1, items = [];
  for (const e of events()) {
    if (hourly(e)) {
      if (off === 0) items.push({ ...e, t: C.occurrences(e, Date.now(), Date.now() + 86400000, D.region).find(t => t > Date.now()), every: true });
      continue;
    }
    for (const t of C.occurrences(e, from, to, D.region)) if (t >= from) items.push({ ...e, t });
  }
  for (const map of Object.values(D?.fieldBosses || {})) for (const sl of map.slots || [])
    if (!sl.alive && sl.atMs >= from && sl.atMs <= to) items.push({ id: 'fb:' + sl.name, name: sl.name + ' · ' + map.map, type: 'world', duration: 0, t: sl.atMs, bell: S.bells['fb:' + sl.name] !== false, src: 'game' });
  // Сверху — идущий и ближайшие ивенты, ниже — по времени, а закончившиеся — в самом низу.
  const now = Date.now();
  const state = e => (!e.t ? 1 : now < e.t ? 1 : (e.duration && now < e.t + e.duration * 60000) ? 0 : 2);
  return items.sort((a, b) => (state(a) - state(b)) || (a.t || 9e15) - (b.t || 9e15));
}

function renderHead() {
  applyTheme(S, 92);
  // Серверы по регионам; время расписания берётся с выбранного сервера.
  const en = getLang() === 'en', sname = s => (en ? s.en : s.name);
  const det = S.serverAuto && D?.selected ? `${sname(D.selected)} · ${C.REGIONS[D.selected.region]?.name || ''}` : (S.detectedServer || 'зайдите в игру');
  const auto = `<option value="__auto">Авто: ${esc(det)}</option>`;
  const groups = {};
  for (const s of D?.servers || []) (groups[s.region] = groups[s.region] || []).push(s);
  $('server').innerHTML = auto + Object.entries(groups).map(([g, ns]) => `<optgroup label="${esc(C.REGIONS[g]?.name || g)}">${ns.map(n => `<option value="${n.id}">${esc(sname(n))} · ${n.side}</option>`).join('')}</optgroup>`).join('');
  $('server').value = S.serverAuto ? '__auto' : String(S.serverId || D?.selected?.id || '__auto');
  document.querySelectorAll('[data-tm]').forEach(b => b.classList.toggle('on', (S.timeMode || 'server') === b.dataset.tm));
  document.querySelectorAll('[data-n]').forEach(c => { c.checked = !!S.notify[c.dataset.n]; c.onchange = () => api.set({ notify: { [c.dataset.n]: c.checked } }); });
  const fs = D?.feedState || {};
  $('feedInfo').textContent = `Версия ${D?.feed?.version ?? '—'}${D?.feed?.updated ? ' от ' + D.feed.updated : ''}` +
    (fs.checkedAt ? ` · проверено в ${hm(fs.checkedAt)} — ${fs.msg}` : ' · проверяется автоматически каждые 3 часа');
}

function renderDays() {
  $('days').innerHTML = [0, 1, 2, 3, 4, 5, 6].map(off => {
    const d = C.parts(dayStart(off) + 3600000, TZ());
    const label = off === 0 ? 'Сегодня' : off === 1 ? 'Завтра' : SHORT[d.wd];
    return `<button type="button" role="tab" aria-selected="${off === dayOff}" class="${off === dayOff ? 'on' : ''}" data-d="${off}">${label}<small>${d.d}.${pad(d.mo)}</small></button>`;
  }).join('');
  $('days').querySelectorAll('button').forEach(b => b.onclick = () => { dayOff = +b.dataset.d; renderDays(); renderList(); });
}

function renderList() {
  const items = itemsOfDay(dayOff);
  $('list').innerHTML = items.length ? items.map((e, i) => {
    const t = TYPE[e.type] || TYPE.world;
    const tags = (e.src === 'game' ? '<span class="tag game">из игры</span>' : '') + (e.confirmed === false ? '<span class="tag unc">время не подтверждено</span>' : '') + (e.src === 'mine' ? '<span class="tag mine">свой</span>' : '');
    const meta = e.every ? `каждый час в :${String(e.rule.anchorUtc || '00:00').split(':')[1]}` : `${t[0]}${e.duration ? ' · ' + e.duration + ' мин' : ''}`;
    const note = e.note ? `<div class="meta note">${esc(e.note)}</div>` : '';
    return `<div class="ev" data-i="${i}"><div class="time num">${e.every ? '⟳' : hm(e.t)}</div><div class="stripe" style="background:${t[1]}"></div>
      <div class="evic" style="color:${t[1]}">${eventIcon(e, 18)}</div><div class="info"><div class="name">${esc(e.name)}${tags}</div><div class="meta">${meta}</div>${note}</div>
      <div class="st num" data-t="${e.t || 0}" data-dur="${e.duration || 0}"></div>
      <button class="icon" data-bell="${i}" aria-label="${e.bell ? 'Выключить напоминание' : 'Включить напоминание'}" style="color:${e.bell ? 'var(--accent)' : 'var(--muted)'}">${e.bell ? ICON.bell : ICON.bellOff}</button>
      ${e.src === 'mine' ? `<button class="icon" data-edit="${i}" aria-label="Изменить">${ICON.gear}</button><button class="icon" data-del="${i}" aria-label="Удалить">${ICON.close}</button>` : ''}</div>`;
  }).join('') : '<div class="card small">На этот день ивентов нет.</div>';
  $('list').querySelectorAll('[data-bell]').forEach(b => b.onclick = () => {
    const e = items[+b.dataset.bell];
    if (e.src === 'mine') api.set({ events: S.events.map(x => x.id === e.id ? { ...x, bell: !e.bell } : x) });
    else api.set({ bells: { [e.id]: !e.bell } });
  });
  $('list').querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const e = items[+b.dataset.del]; api.set({ events: S.events.filter(x => x.id !== e.id) }); });
  $('list').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => edit(S.events.find(x => x.id === items[+b.dataset.edit].id)));
  tick();
}

function renderBosses() {
  $('fbServer').textContent = D?.server ? '· ' + D.server : '';
  const rows = [];
  // Слоты без опознанного имени («Полевой босс №N») ничего не говорят игроку — не показываем; как и давно прошедшее время возрождения.
  const known = sl => !/^Полевой босс №/.test(sl.name || '') && (sl.alive || !sl.atMs || sl.atMs > Date.now() - 3600000);
  for (const map of Object.values(D?.fieldBosses || {})) for (const sl of map.slots || []) if (known(sl)) rows.push({ ...sl, map: map.map });
  $('fb').innerHTML = rows.length ? rows.sort((a, b) => (b.alive - a.alive) || (a.atMs || 9e15) - (b.atMs || 9e15)).map(r =>
    `<div class="fb"><span class="fbn"><span class="evic sm">${eventIcon({ id: 'fb' }, 15)}</span>${nt(r.name)} <span class="small" data-notr>${esc(r.map)}</span></span><span class="num" data-fb="${r.alive ? -1 : r.atMs || 0}"></span></div>`).join('')
    : '<div class="small">Откройте в игре карту со списком полевых боссов — таймеры возрождения подтянутся сами.</div>';
}

function tick() {
  if (!S) return;
  const now = Date.now();
  document.querySelectorAll('[data-t]').forEach(el => {
    const t = +el.dataset.t, dur = +el.dataset.dur * 60000;
    let txt, col = 'var(--muted)';
    if (!t) txt = '—';
    else if (now < t) { txt = 'через ' + left(Math.floor((t - now) / 1000)); col = 'var(--accent)'; }
    else if (dur && now < t + dur) { txt = 'идёт · ещё ' + Math.ceil((t + dur - now) / 60000) + ' мин'; col = '#7ff0b0'; }
    else { txt = 'прошёл'; el.closest('.ev')?.classList.add('past'); }
    el.textContent = txt; el.style.color = col;
  });
  document.querySelectorAll('[data-fb]').forEach(el => {
    const t = +el.dataset.fb;
    if (t === -1) { el.textContent = 'жив'; el.style.color = '#7ff0b0'; }
    else if (!t) { el.textContent = 'время неизвестно'; el.style.color = 'var(--muted)'; }
    else if (t > now) { el.textContent = 'через ' + left(Math.floor((t - now) / 1000)); el.style.color = 'var(--accent)'; }
    else { el.textContent = 'должен появиться'; el.style.color = '#7ff0b0'; }
  });
  // следующий ивент с напоминанием (без ежечасных)
  let best = null;
  for (const e of events()) {
    if (!e.bell || hourly(e)) continue;
    const t = C.occurrences(e, now, now + 8 * 86400000, D.region).find(x => x > now);
    if (t && (!best || t < best.t)) best = { e, t };
  }
  for (const map of Object.values(D?.fieldBosses || {})) for (const sl of map.slots || [])
    if (!sl.alive && sl.atMs > now && !/^Полевой босс №/.test(sl.name || '') && (!best || sl.atMs < best.t)) best = { e: { id: 'fb', name: sl.name + ' · ' + map.map }, t: sl.atMs };
  $('nName').textContent = best ? best.e.name : '—';
  $('nIc').innerHTML = eventIcon(best ? (best.e.id ? best.e : { id: 'fb' }) : { id: 'calendar' }, 22);
  $('nWhen').textContent = best ? new Date(best.t).toLocaleString(LOC(), { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: TZ() }) : 'Нет ивентов с напоминанием';
  $('clock').textContent = hm(now);
  $('clock').title = (S.timeMode === 'local' ? 'Ваше время' : 'Время сервера') + ' · ' + TZ();
  $('nLeft').textContent = best ? left(Math.floor((best.t - now) / 1000)) : '';
}

function edit(e) {
  editId = e ? e.id : null;
  $('addBox').open = !!e || $('addBox').open;
  $('fTitle').textContent = e ? 'Изменить свой ивент' : '+ Свой ивент';
  $('fName').value = e?.name || ''; $('fType').value = e?.type || 'world'; $('fTime').value = e?.time || '20:00'; $('fDur').value = e?.duration ?? 30;
  const today = C.parts(dayStart(dayOff) + 3600000, TZ()).wd;
  $('fDays').querySelectorAll('input').forEach(c => { c.checked = e ? e.days.includes(+c.value) : +c.value === today; });
  enhanceSelects();
}
$('fCancel').onclick = () => { edit(null); $('addBox').open = false; };
$('form').onsubmit = ev => {
  ev.preventDefault();
  const days = [...$('fDays').querySelectorAll('input:checked')].map(c => +c.value);
  const item = { id: editId || 'my' + Date.now(), name: $('fName').value.trim() || 'Ивент', type: $('fType').value, time: $('fTime').value, duration: +$('fDur').value || 0, days: days.length ? days : [0], bell: true };
  api.set({ events: editId ? S.events.map(e => e.id === editId ? { ...e, ...item } : e) : [...S.events, item] });
  edit(null); $('addBox').open = false;
};

function renderAll() { if (!S || !D) return; renderHead(); renderDays(); renderList(); renderBosses(); tick(); enhanceSelects(); }
api.on('settings', s => { S = s; renderAll(); });
api.on('schedule-data', d => { D = d; renderAll(); });
Promise.all([api.state(), api.schedule()]).then(([st, d]) => { S = st.settings; D = d; renderAll(); edit(null); });
setInterval(tick, 1000);
setInterval(() => { if (S && D) renderList(); }, 60000);
