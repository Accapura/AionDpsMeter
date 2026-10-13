'use strict';
let S = null, status = {}, snap = null, records = {};
const $ = id => document.getElementById(id);
$('bGear').innerHTML = ICON.gear; $('bHide').innerHTML = ICON.close; $('bReset').innerHTML = ICON.reset;
$('bShare').innerHTML = ICON.share;
$('bShare').onclick = () => api.share();
$('bHide').onclick = () => api.win('hide');
$('bReset').onclick = () => api.reset();
$('bLock').onclick = () => api.set({ clickThrough: !S.clickThrough });
$('bCompact').onclick = () => api.set({ compact: !S.compact });
$('bGear').onclick = e => { e.stopPropagation(); togglePanel(); };
$('pMain').onclick = () => { togglePanel(false); api.open('main'); };
$('pSched').onclick = () => { togglePanel(false); api.open('schedule'); };
$('pSize').onclick = () => api.overlayResetSize();
$('count').oninput = e => { S.count = +e.target.value; $('countV').value = S.count; render(); api.set({ count: S.count }); };
$('opacity').oninput = e => { S.opacity = +e.target.value; $('opV').value = S.opacity + '%'; applyTheme(S, S.opacity); api.set({ opacity: S.opacity }); };
$('scale').onchange = e => api.set({ scale: +e.target.value });
$('showHead').onchange = e => api.set({ showHeader: e.target.checked });
$('solo').onchange = e => api.set({ solo: e.target.checked });
$('autoHide').onchange = e => api.set({ autoHide: e.target.checked });
document.querySelectorAll('[data-col]').forEach(c => c.onchange = () => api.set({ columns: { [c.dataset.col]: c.checked } }));
$('scale').oninput = e => { $('scV').value = e.target.value + '%'; };
function togglePanel(force) {
  const p = $('panel'), open = force ?? p.hidden;
  p.hidden = !open; $('bGear').setAttribute('aria-expanded', String(open));
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') togglePanel(false); });

// Уголок изменения размера (прозрачные окна Windows не тянутся за край).
resizeGrip($('resize'));
const fit = () => { document.body.classList.toggle('narrow', innerWidth < 300); document.body.classList.toggle('short', innerHeight < 240); };
addEventListener('resize', fit); fit();

// Режим сменили (горячей клавишей или кнопкой) — коротко показываем его название.
let lastMode = null, flashT = null;
function flashMode() {
  if (lastMode !== null && lastMode !== S.mode) {
    const f = $('mflash'), m = MODES.find(x => x[0] === S.mode);
    f.textContent = m ? m[1] : S.mode;
    if (typeof translate === 'function') translate(f, S.lang);
    f.classList.add('on'); clearTimeout(flashT); flashT = setTimeout(() => f.classList.remove('on'), 1100);
  }
  lastMode = S.mode;
}
function chrome() {
  flashMode();
  applyTheme(S, S.opacity);
  $('nick').textContent = S.character || '';
  document.body.classList.toggle('hasnick', !!S.character);
  document.body.classList.toggle('locked', !!S.clickThrough);
  document.body.classList.toggle('compact', !!S.compact);
  document.body.classList.toggle('nohead', S.showHeader === false);
  $('showHead').checked = S.showHeader !== false;
  $('solo').checked = !!S.solo; $('autoHide').checked = S.autoHide !== false;
  $('bLock').innerHTML = S.clickThrough ? ICON.lock : ICON.unlock;
  $('bLock').style.color = S.clickThrough ? 'var(--accent)' : '';
  const hk0 = Object.assign({ overlay: 'Ctrl+Shift+D', lock: 'Ctrl+Shift+L', reset: 'Ctrl+Shift+R', share: 'Ctrl+Shift+C' }, S.hotkeys || {});
  const hk = Object.fromEntries(Object.entries(hk0).map(([k, v]) => [k, hkLabel(v)]));
  $('bShare').title = 'Поделиться боем (' + hk.share + ')'; $('bShare').setAttribute('aria-label', 'Скопировать итог боя (' + hk.share + ')');
  $('bLock').setAttribute('aria-label', (S.clickThrough ? 'Снять закрепление (' : 'Закрепить: клики сквозь оверлей (') + hk.lock + ')');
  $('bLock').title = S.clickThrough ? 'Закреплён — ' + hk.lock : 'Закрепить (' + hk.lock + ')';
  $('bReset').title = 'Начать заново (' + hk.reset + ')'; $('bReset').setAttribute('aria-label', 'Начать подсчёт заново (' + hk.reset + ')');
  $('bHide').title = 'Скрыть (' + hk.overlay + ')'; $('bHide').setAttribute('aria-label', 'Скрыть оверлей (' + hk.overlay + ')');
  $('bCompact').innerHTML = S.compact ? ICON.chevDown : ICON.chevUp;
  $('bCompact').setAttribute('aria-label', S.compact ? 'Показать режимы' : 'Скрыть режимы');
  $('bCompact').title = S.compact ? 'Показать режимы' : 'Компактно';
  $('modes').innerHTML = MODES.map(([k, l]) => `<button type="button" data-m="${k}" class="${S.mode === k ? 'on' : ''}" aria-pressed="${S.mode === k}">${l}</button>`).join('');
  $('modes').querySelectorAll('button').forEach(b => b.onclick = () => api.set({ mode: b.dataset.m }));
  $('count').value = S.count; $('countV').value = S.count;
  $('opacity').value = S.opacity; $('opV').value = S.opacity + '%';
  $('scale').value = S.scale; $('scV').value = S.scale + '%';
  document.querySelectorAll('[data-col]').forEach(c => { c.checked = !!(S.columns || {})[c.dataset.col]; });
  paintRanges();
  $('themeSlot').innerHTML = themeButton(S.theme);
  bindThemeButton($('themeSlot'), S.theme, k => api.set({ theme: k }));
}

const fmtHp = n => Math.round(n).toLocaleString(LOC());
// Своя строка: если игра ещё не прислала имя, показываем ник персонажа.
const nm = p => (p.self && String(p.name).startsWith('#') && S.character ? S.character : p.name);

// Показываем только то, что выбрано в режиме.
function matches(s) {
  if (!s || !s.players || !s.players.length) return false;
  if (S.mode === 'boss') return !!s.boss && s.dungeon;
  if (S.mode === 'world') return !!s.boss && !s.dungeon;
  return true;
}

function empty() {
  const bad = ['no-npcap', 'no-dotnet', 'error', 'Error', 'disabled'].includes(status.state);
  const wait = S.mode === 'boss' ? 'Ждём босса подземелья' : S.mode === 'world' ? 'Ждём мирового босса' : 'Ждём боя';
  const msg = String(status.msg || '').split(' · ')[0];
  const text = bad ? msg : (status.state === 'Capturing' ? wait : (msg || wait));
  return `<div class="empty"><div>${esc(text)}</div>${bad ? '<button type="button" class="primary" data-a="conn">Подробнее</button>' : ''}</div>`;
}

function render() {
  if (!S) return;
  const body = $('body');
  if (!matches(snap)) {
    body.innerHTML = empty();
    const b = body.querySelector('[data-a]');
    if (b) b.onclick = () => api.open('main', 'connect');
    $('stats').textContent = '';
    return;
  }
  const ps = snap.players, top = ps[0].dmg || 1;
  // Дополнительные колонки (включаются в настройках оверлея).
  const extra = [
    S.columns?.crit && { h: 'Крит', t: 'Доля критических ударов', w: '38px', v: p => p.crit != null ? Math.round(p.crit * 100) + '%' : '—' },
    S.columns?.hits && { h: 'Удары', t: 'Количество ударов', w: '40px', v: p => p.hits ?? '—' },
    S.columns?.maxHit && { h: 'Макс', t: 'Самый сильный удар', w: '46px', v: p => p.maxHit ? fmt(p.maxHit) : '—' },
    S.columns?.hps && { h: 'HPS', t: 'Лечение в секунду', w: '44px', v: p => p.hps ? fmt(p.hps) : '—' },
  ].filter(Boolean);
  const narrow = innerWidth < 300;
  document.body.style.setProperty('--cols', (narrow ? '14px 20px minmax(0,1fr) 48px' : '16px 20px minmax(0,1fr) 50px 50px') + extra.map(c => ' ' + c.w).join('') + ' 38px');
  const shown = ps.slice(0, S.count), rest = ps.length - shown.length;
  const restShare = ps.slice(S.count).reduce((a, p) => a + (p.share || 0), 0);
  const boss = snap.boss, tg = snap.target;
  // Цель: босс, иначе основная цель боя (больше всего урона).
  const tName = boss?.name || tg?.name || (tg && tg.count > 1 ? 'Несколько целей' : 'Цель без имени');
  const src = boss ? { hp: boss.hp, max: boss.maxHp } : (tg && tg.hp >= 0 && tg.maxHp > 0 ? { hp: tg.hp, max: tg.maxHp } : null);
  const hp = src ? Math.max(0, Math.min(1, src.hp / src.max)) * 100 : null;
  const more = tg && tg.count > 1 ? ` <span class="more-t">+${tg.count - 1}</span>` : '';
  // свой персонаж: по метке игры, иначе по нику персонажа, с которого запущен счётчик
  const meName = String(S.character || '').toLowerCase();
  const me = ps.find(p => p.self) || (meName ? ps.find(p => String(p.name).toLowerCase() === meName) : null);
  const rec = recordLine(me);
  const targetHtml = `
    <div class="target" title="${esc(snap.zone || '')}">
      <div class="trow"><div class="tname">${boss?.name || tg?.name ? nt(tName) : esc(tName)}${more}</div>
        ${hp != null ? `<span class="hpp num">${hp.toFixed(1).replace('.', ',')}%</span>` : ''}
        <span class="timer num">${ICON.clock}${clock(snap.combatMs)}</span></div>
      ${hp != null ? `<div class="hpbar"><i style="width:${hp.toFixed(2)}%"></i><span class="num">${fmtHp(src.hp)} / ${fmtHp(src.max)}</span></div>` : ''}
    </div>`;
  if (S.solo && !me) {
    // «Только я»: пока свой персонаж не нанёс урон — не показываем чужой список, ждём свой
    // ни HP моба, ни таймер, ни суммы чужого боя не показываем: бой «начинается» для оверлея, когда урон нанёс сам персонаж
    body.innerHTML = `<div class="solo"><div class="empty"><div>${esc(S.character ? 'Ждём ваш урон — ' : 'Ждём ваш урон')}${S.character ? `<b data-notr>${esc(S.character)}</b>` : ''}</div></div></div>`;
    $('stats').innerHTML = '';
    return;
  }
  if (S.solo && me) {
    const place = ps.indexOf(me) + 1;
    body.innerHTML = targetHtml + `<div class="solo"><div class="me1" data-id="${me.id ?? ''}" data-nick="${esc(nm(me))}" title="Нажмите — разбивка по навыкам, правая кнопка — меню">${classIcon(me.cls)}
      <div class="who"><span class="name" data-notr>${esc(nm(me))}</span><span class="bigdps num">${fmt(me.dps)}<small>DPS</small></span></div>
      <div class="place num">#${place}<small> / ${ps.length}</small></div></div>
      <div class="kv num"><div><span>Урон</span><b>${fmt(me.dmg)}</b></div><div><span>Доля</span><b>${((me.share || 0) * 100).toFixed(1).replace('.', ',')}%</b></div>
      <div><span>Крит</span><b>${me.crit != null ? Math.round(me.crit * 100) + '%' : '—'}</b></div><div><span>Макс. удар</span><b>${fmt(me.maxHit)}</b></div>
      ${me.hps ? `<div><span>HPS</span><b>${fmt(me.hps)}</b></div>` : ''}</div>${rec ? `<div style="text-align:center">${rec}</div>` : ''}</div>`;
    body.querySelector('.me1').onclick = () => { if (me.id != null) api.open('breakdown', +me.id); };
    $('stats').innerHTML = `<b>${fmt(snap.partyDps)}</b>/с · всего <b>${fmt(snap.total)}</b> · ${snap.fighting || ps.length} в бою`;
    return;
  }
  body.innerHTML = targetHtml + `
    <div class="cols"><span class="r" title="Место по урону">#</span><span title="Класс">Кл.</span><span title="Ник игрока">Игрок</span><span class="r" title="Урон в секунду">DPS</span><span class="r c-total" title="Общий урон за бой">Урон</span>${extra.map(c => `<span class="r" title="${c.t}">${c.h}</span>`).join('')}<span class="r" title="Доля от урона всей группы">%</span></div>
    <div class="list">${shown.map((p, i) => {
      const c = CLASS_COLOR[p.cls] || CLASS_COLOR.Unknown;
      return `<div class="row${p === me ? ' me' : ''}" data-id="${p.id ?? ''}" data-nick="${esc(nm(p))}" title="Нажмите — разбивка по навыкам, правая кнопка — меню"><div class="bar" style="width:${(p.dmg / top * 100).toFixed(1)}%;background:linear-gradient(90deg,rgba(${c},.55),rgba(${c},.22))"></div>
      <div class="grid num"><span class="rank">${i + 1}</span>${classIcon(p.cls)}<span class="name" data-notr title="${esc(nm(p))}">${esc(nm(p))}</span>
      <span class="r dps">${fmt(p.dps)}</span><span class="r muted c-total">${fmt(p.dmg)}</span>${extra.map(c => `<span class="r muted">${c.v(p)}</span>`).join('')}<span class="r pct">${((p.share || 0) * 100).toFixed(1).replace('.', ',')}</span></div></div>`;
    }).join('')}${rest > 0 ? `<div class="more">+ ещё ${rest} · ${(restShare * 100).toFixed(1).replace('.', ',')}%</div>` : ''}</div>`;
  body.querySelectorAll('.row[data-id]').forEach(r => r.onclick = () => { if (r.dataset.id) api.open('breakdown', +r.dataset.id); });
  $('stats').innerHTML = `<b>${fmt(snap.partyDps)}</b>/с · всего <b>${fmt(snap.total)}</b> · ${snap.fighting || ps.length} в бою${snap.partial ? ' · неполные данные' : ''}`;
  if (rec) $('stats').insertAdjacentHTML('beforeend', ' ' + rec);
}

// Меню игрока по правой кнопке: скопировать ник (вставить в игре в поиск друзей, приглашение или чат) и разбивка по навыкам.
// Программа только читает трафик игры и ничего в неё не отправляет, поэтому «в друзья» и «пригласить» делаются в самой игре.
let pmenu = null;
function closeMenu() { if (pmenu) { pmenu.remove(); pmenu = null; } }
document.addEventListener('mousedown', e => { if (pmenu && !pmenu.contains(e.target)) closeMenu(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
window.addEventListener('blur', closeMenu);
document.addEventListener('contextmenu', e => {
  const r = e.target.closest && e.target.closest('.row[data-nick], .me1[data-nick]');
  if (!r) return;
  e.preventDefault();
  closeMenu();
  const nick = r.dataset.nick || '', known = nick && !nick.startsWith('#');
  const m = document.createElement('div');
  m.className = 'pmenu';
  m.innerHTML = `<div class="pm-h" data-notr>${esc(nick)}</div>
    <button type="button" data-a="copy"${known ? '' : ' disabled'}>${known ? 'Скопировать ник' : 'Ник пока неизвестен'}</button>
    <button type="button" data-a="skills"${r.dataset.id ? '' : ' disabled'}>Разбивка по навыкам</button>`;
  document.body.appendChild(m);
  const x = Math.min(e.clientX, innerWidth - m.offsetWidth - 4), y = Math.min(e.clientY, innerHeight - m.offsetHeight - 4);
  m.style.left = Math.max(2, x) + 'px'; m.style.top = Math.max(2, y) + 'px';
  m.onclick = ev => {
    const a = ev.target.closest('button[data-a]');
    if (!a || a.disabled) return;
    if (a.dataset.a === 'copy') { api.copy(nick); a.textContent = 'Скопировано ✓'; setTimeout(closeMenu, 700); }
    else { api.open('breakdown', +r.dataset.id); closeMenu(); }
  };
  pmenu = m;
  setTimeout(() => { if (pmenu === m) closeMenu(); }, 8000);
});

// Сравнение своего DPS с рекордом на этом боссе (после первых 20 секунд боя — раньше цифры скачут).
function recordLine(me) {
  const best = me && snap.boss?.name ? records[snap.boss.name] : 0;
  if (!best || !me.dps || (snap.combatMs || 0) < 20000) return '';
  const d = me.dps / best - 1, pct = Math.round(Math.abs(d) * 100);
  return `<span class="rec ${d >= 0 ? 'up' : 'down'}" title="Ваш рекорд на этом боссе: ${fmt(best)} DPS">${d >= 0 ? '▲' : '▼'} ${pct}% к рекорду</span>`;
}

api.on('settings', s => { S = s; chrome(); render(); });
api.on('status', s => { status = s; if (!matches(snap)) render(); });
api.on('snap', s => { snap = s; render(); });
api.on('records', r => { records = r || {}; });
// Пинг до игрового сервера (считается по трафику игры): полоски сигнала и миллисекунды.
function showPing(ms, est, dbg) {
  const dt = dbg ? '\nОтветов игры на пинг: ' + (dbg.n | 0) : '';
  const el = $('ping');
  if (ms === -2) {
    // игра идёт через ускоритель/VPN: он сам подтверждает пакеты, настоящий пинг знает только он
    el.className = 'ping vpn';
    el.innerHTML = `<svg width="11" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9c-4.6-1-8-4.5-8-9V6z"/></svg>VPN`;
    el.title = 'Игра идёт через ускоритель или VPN — пинг появится после первого ответа игры (до 10 секунд)' + dt;
    el.hidden = false; return;
  }
  if (ms == null || ms < 0) { el.hidden = true; return; }
  const q = ms < 80 ? 'good' : ms < 150 ? 'mid' : 'bad', n = ms < 80 ? 3 : ms < 150 ? 2 : 1;
  const bars = [0, 1, 2].map(i => `<rect x="${1 + i * 4}" y="${8 - i * 3}" width="2.6" height="${3 + i * 3}" rx="1" fill="currentColor" opacity="${i < n ? 1 : .28}"/>`).join('');
  el.className = 'ping ' + q;
  el.innerHTML = `<svg width="13" height="12" viewBox="0 0 13 12" aria-hidden="true">${bars}</svg>${est ? '~' : ''}${ms}<span class="u">мс</span>`;
  el.title = est ? 'Примерный пинг до адреса сервера: ' + ms + ' мс. Точный — по ответу игры на её пинг-запрос — появится в течение 10 секунд' + dt : 'Пинг до игрового сервера (весь путь, с ускорителем): ' + ms + ' мс. Точный замер игра даёт раз в 10 секунд, между ними число меняется вместе с задержкой соединения' + dt;
  el.hidden = false;
}
api.on('ping', p => showPing(p && p.ms, p && p.est, p && p.dbg));
api.on('lag', () => { const el = $('ping'); if (!el) return; el.classList.add('spike'); setTimeout(() => el.classList.remove('spike'), 9000); });
api.state().then(st => { showPing(st.ping, st.pingEst, st.pingDbg); records = st.records || {}; S = st.settings; status = st.status; snap = st.snap; chrome(); render(); });
