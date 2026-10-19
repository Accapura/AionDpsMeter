'use strict';
const THEMES = {
  amethyst: { name: 'Аметист', g1: '78,48,138', g2: '28,20,68', accent: '#ffcf6b', accentFg: '#2b1d48', text: '#fbf7ff', muted: '#cdc2e6', line: 'rgba(255,255,255,.18)', hp: '#ff5d73' },
  ocean: { name: 'Океан', g1: '20,84,128', g2: '8,34,70', accent: '#5fe0ff', accentFg: '#06263a', text: '#f1fbff', muted: '#b4d4e6', line: 'rgba(190,235,255,.2)', hp: '#ff6b7a' },
  emerald: { name: 'Изумруд', g1: '18,92,70', g2: '7,42,40', accent: '#5af0a8', accentFg: '#06281c', text: '#f0fff7', muted: '#b0dcc8', line: 'rgba(190,255,225,.2)', hp: '#ff6b6b' },
  ruby: { name: 'Рубин', g1: '122,30,52', g2: '48,12,32', accent: '#ff8fa3', accentFg: '#3a0716', text: '#fff3f5', muted: '#e4b9c2', line: 'rgba(255,200,210,.22)', hp: '#ffb347' },
  sunset: { name: 'Закат', g1: '138,56,66', g2: '52,24,76', accent: '#ffb077', accentFg: '#3a1608', text: '#fff6f1', muted: '#e6c4c4', line: 'rgba(255,215,190,.22)', hp: '#ff5d73' },
  sakura: { name: 'Сакура', g1: '118,50,102', g2: '56,26,76', accent: '#ff9fd8', accentFg: '#3a0d2c', text: '#fff4fb', muted: '#e6bfdc', line: 'rgba(255,200,235,.22)', hp: '#ff6b88' },
  amber: { name: 'Янтарь', g1: '104,66,24', g2: '44,28,18', accent: '#ffc94d', accentFg: '#3a2605', text: '#fff9ee', muted: '#e2cfa6', line: 'rgba(255,225,160,.22)', hp: '#ff6a4d' },
  lavender: { name: 'Лаванда', g1: '72,66,140', g2: '32,34,88', accent: '#c0b8ff', accentFg: '#1f1b4a', text: '#f6f5ff', muted: '#c6c3ea', line: 'rgba(210,205,255,.22)', hp: '#ff7a9a' },
  forest: { name: 'Лес', g1: '44,84,50', g2: '20,42,34', accent: '#b4e06a', accentFg: '#14260a', text: '#f6fff0', muted: '#bdd6b0', line: 'rgba(205,240,170,.22)', hp: '#ff7a6b' },
  teal: { name: 'Бирюза', g1: '16,96,100', g2: '8,46,58', accent: '#6ff2e0', accentFg: '#052a2a', text: '#effffd', muted: '#a9dcd8', line: 'rgba(180,255,245,.2)', hp: '#ff7088' },
  blackflame: { name: 'Чёрное пламя', g1: '52,9,24', g2: '9,5,12', accent: '#ff4057', accentFg: '#1c0307', text: '#fff1f3', muted: '#cfa6ad', line: 'rgba(255,80,100,.26)', hp: '#ff8a3d' },
  midnight: { name: 'Полночь', g1: '34,46,112', g2: '14,18,56', accent: '#86a8ff', accentFg: '#0b1440', text: '#f2f5ff', muted: '#b7c2ec', line: 'rgba(170,190,255,.22)', hp: '#ff6b88' },
};

const CLASS_RU = { Gladiator: 'Гладиатор', Templar: 'Страж', Ranger: 'Стрелок', Assassin: 'Убийца', Sorcerer: 'Волшебник', Elementalist: 'Заклинатель', Cleric: 'Целитель', Chanter: 'Чародей', Brawler: 'Боец', Unknown: 'Класс неизвестен' };
const CLASS_COLOR = { Gladiator: '31,162,200', Templar: '59,124,230', Ranger: '28,174,126', Assassin: '70,184,78', Sorcerer: '134,76,224', Elementalist: '194,63,196', Cleric: '216,162,42', Chanter: '234,125,44', Brawler: '214,51,62', Unknown: '94,107,132' };
const MODES = [['boss', 'Данж: Босс'], ['mob', 'Моб'], ['dummy', 'Манекен']];


// Положение кнопок и форма интерфейса не зависят от темы: их выбирают в вкладке «Оформление».
const NAV_POS = [['left', 'Слева'], ['top', 'Сверху'], ['bottom', 'Снизу'], ['right', 'Справа']];            // главное меню
const BTN_POS = [['left', 'Слева'], ['bottom', 'Снизу'], ['top', 'Сверху'], ['right', 'Справа']];            // кнопки в оверлее
const OV_VIEWS = [['list', 'Список'], ['cards', 'Карточки'], ['big', 'Лидер'], ['ticker', 'Строки'], ['columns', 'Столбцы'], ['rings', 'Кольца'], ['podium', 'Подиум'], ['bars', 'Гистограмма'], ['console', 'Консоль'], ['nearby', 'Я и соседи'], ['donut', 'Пончик']];
const OV_STATS = [['dps', 'DPS'], ['dmg', 'Урон'], ['pct', 'Доля']];
function applyTheme(s, opacityOverride) {
  STREAMER = !!s.streamer;
  const t = THEMES[s.theme] || THEMES.midnight;
  const r = document.documentElement.style;
  r.setProperty('--g1', t.g1); r.setProperty('--g2', t.g2);
  r.setProperty('--accent', t.accent); r.setProperty('--accentFg', t.accentFg);
  r.setProperty('--text', t.text); r.setProperty('--muted', t.muted);
  r.setProperty('--line', t.line); r.setProperty('--hp', t.hp);
  r.setProperty('--a', String((opacityOverride ?? 92) / 100));
  if (document.body) {
    const d = document.body.dataset;
    d.skin = THEMES[s.theme] ? s.theme : 'midnight';
    d.corners = s.corners === 'square' ? 'square' : 'round';
    d.app = { left: 'side', top: 'top', bottom: 'dock', right: 'right' }[s.navPos] || 'side';
    d.hd = { left: 'side', top: 'top', bottom: 'bottom', right: 'rside' }[s.btnPos] || 'top';
    d.ov = OV_VIEWS.some(v => v[0] === s.ovView) ? s.ovView : 'list';
  }
}
// Ротация: по строке на навык, по оси — время боя; золотые штрихи — криты. rot = { names, c: [[мс, навык, урон, флаги]], dur }.
function rotationHtml(rot, maxRows) {
  if (!rot || !rot.c || rot.c.length < 3) return '';
  const dur = Math.max(1000, rot.dur || rot.c[rot.c.length - 1][0]);
  const by = new Map();
  for (const [ms, ix, dmg, fl] of rot.c) {
    let r = by.get(ix); if (!r) by.set(ix, r = { ix, dmg: 0, n: 0, hits: [] });
    r.dmg += dmg; r.n++; r.hits.push([ms, fl]);
  }
  const rows = [...by.values()].sort((a, b) => b.dmg - a.dmg).slice(0, maxRows || 14);
  const tick = ([ms, fl]) => {
    const x = Math.min(999, ms / dur * 1000).toFixed(1);
    const c = fl & 1 ? 'var(--accent)' : (fl & 8 ? 'rgba(130,230,200,.95)' : 'rgba(176,156,255,.9)');
    return `<line x1="${x}" x2="${x}" y1="${fl & 1 ? 1 : 3}" y2="${fl & 1 ? 15 : 13}" stroke="${c}" stroke-width="${fl & 1 ? 2.4 : 1.8}" vector-effect="non-scaling-stroke"/>`;
  };
  const tm = k => clock(dur * k);
  return `<div class="rot">${rows.map(r => `<div class="rrow"><span class="rn" data-notr title="${esc(rot.names[r.ix])}: ${r.n} × · ${fmt(r.dmg)}">${esc(rot.names[r.ix])}<small>${r.n}×</small></span>
    <svg viewBox="0 0 1000 16" preserveAspectRatio="none">${r.hits.map(tick).join('')}</svg></div>`).join('')}
    <div class="rax"><span></span><div><span>${tm(0)}</span><span>${tm(.25)}</span><span>${tm(.5)}</span><span>${tm(.75)}</span><span>${tm(1)}</span></div></div>
    <div class="rleg"><span><i style="background:var(--accent)"></i>критический удар</span><span><i style="background:rgba(130,230,200,.95)"></i>идеальный</span><span><i style="background:rgba(176,156,255,.9)"></i>обычный</span></div></div>`;
}
function fmt(n) {
  if (n == null || !isFinite(n)) return '—';
  let s;
  if (n >= 1e9) s = (n / 1e9).toFixed(2) + 'B';
  else if (n >= 1e6) s = (n / 1e6).toFixed(n >= 1e8 ? 0 : n >= 1e7 ? 1 : 2) + 'M';
  else if (n >= 1e3) s = (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'K';
  else s = String(Math.round(n));
  return typeof getLang === 'function' && getLang() === 'en' ? s : s.replace('.', ',');
}
// Режим стримера: ник заменяется на «Игрок NN» (число зависит от ника, везде одно и то же).
let STREAMER = false;
const aliasOf = n => {
  if (!STREAMER || !n) return n;
  let h = 7; for (const ch of String(n)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (typeof getLang === 'function' && getLang() === 'en' ? 'Player ' : 'Игрок ') + (10 + h % 90);
};
const nt = s => `<span data-notr>${esc(s)}</span>`; // имена из игры не переводим
const nk = s => `<span data-notr>${esc(aliasOf(s))}</span>`; // ник игрока: в режиме стримера скрывается
function clock(ms) { const s = Math.floor((ms || 0) / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function classIcon(cls) {
  if (!cls || cls === 'Unknown' || !CLASS_COLOR[cls]) return '<span class="cls unknown" title="Класс неизвестен">?</span>';
  return `<img class="cls" src="../assets/classes/${cls.toLowerCase()}.png" alt="${esc(CLASS_RU[cls])}" title="${esc(CLASS_RU[cls])}">`;
}
const ICON = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z"/></svg>',
  lock: '<svg class="i" viewBox="0 0 24 24"><path d="M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3"/></svg>',
  unlock: '<svg class="i" viewBox="0 0 24 24"><path d="M6 11h12v9H6zM9 11V8a3 3 0 0 1 5.8-1"/></svg>',
  eyeOff: '<svg class="i" viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 6.2A9.6 9.6 0 0 1 12 6c5 0 8.5 4 9.5 6c-.5 1-1.5 2.4-3 3.6M6.6 7.7C4.6 9 3.3 10.9 2.5 12c1 2 4.5 6 9.5 6c1.5 0 2.8-.4 4-.9M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  eye: '<svg class="i" viewBox="0 0 24 24"><path d="M2.5 12C3.5 10 7 6 12 6s8.5 4 9.5 6c-1 2-4.5 6-9.5 6s-8.5-4-9.5-6z"/><circle cx="12" cy="12" r="3"/></svg>',
  win: '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M6.5 6.5h.01"/></svg>',
  gear: '<svg class="i" viewBox="0 0 24 24"><path d="M12 15a3 3 0 1 0 0-6a3 3 0 0 0 0 6z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3a1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  close: '<svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  min: '<svg class="i" viewBox="0 0 24 24"><path d="M6 12h12"/></svg>',
  max: '<svg class="i" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>',
  restore: '<svg class="i" viewBox="0 0 24 24"><rect x="5" y="8" width="11" height="11" rx="2"/><path d="M8 8V6a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-2"/></svg>',
  reset: '<svg class="i" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"/></svg>',
  clock: '<svg class="i" viewBox="0 0 24 24"><path d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18zM12 7v5l3 2"/></svg>',
  check: '<svg class="i" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  share: '<svg class="i" viewBox="0 0 24 24"><path d="M8 4h8a2 2 0 0 1 2 2v1M6 8h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/><path d="M8 14h6M8 17h4"/></svg>',
  chevUp: '<svg class="i" viewBox="0 0 24 24"><path d="M6 15l6-6l6 6"/></svg>',
  chevDown: '<svg class="i" viewBox="0 0 24 24"><path d="M6 9l6 6l6-6"/></svg>',
  cal: '<svg class="i" viewBox="0 0 24 24"><path d="M4 6h16v14H4zM4 10h16M8 3v5M16 3v5"/></svg>',
  bell: '<svg class="i" viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/></svg>',
  bellOff: '<svg class="i" viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 9.5-4.9M18 11v5l2 2H4M10 21h4M3 3l18 18"/></svg>',
};

// Всплывающее меню выбора оформления.
function themeButton(current) {
  const t = THEMES[current] || THEMES.midnight;
  return `<button type="button" class="themeBtn" aria-haspopup="listbox" data-theme-btn><span class="sw" style="background:linear-gradient(155deg,rgb(${t.g1}),rgb(${t.g2}))"></span><span class="tn">${t.name}</span>${ICON.chevDown}</button>`;
}
function bindThemeButton(root, current, onPick) {
  const btn = root.querySelector('[data-theme-btn]');
  if (!btn) return;
  btn.onclick = e => {
    e.stopPropagation();
    document.querySelector('.themeMenu')?.remove();
    const m = document.createElement('div');
    m.className = 'themeMenu'; m.setAttribute('role', 'listbox'); m.setAttribute('aria-label', 'Оформление');
    m.innerHTML = Object.entries(THEMES).map(([k, t]) => `<button type="button" role="option" aria-selected="${k === current}" data-k="${k}" class="${k === current ? 'sel' : ''}"><span class="sw" style="background:linear-gradient(155deg,rgb(${t.g1}),rgb(${t.g2}));box-shadow:inset 0 0 0 2px ${t.accent}"></span>${t.name}</button>`).join('');
    document.body.appendChild(m);
    const r = btn.getBoundingClientRect();
    const h = Math.min(m.scrollHeight, innerHeight - 16);
    m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + 'px';
    m.style.top = (r.bottom + 4 + h > innerHeight ? Math.max(8, r.top - 4 - h) : r.bottom + 4) + 'px';
    m.style.maxHeight = (innerHeight - 16) + 'px';
    m.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { m.remove(); onPick(b.dataset.k); });
    setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }));
  };
}

// Список с плавным раскрытием: заголовок с текущим значением, по клику — пункты съезжают вниз (или вверх, class up).
// Открытые списки помнятся между перерисовками окна.
const DD_OPEN = new Set();
function dropList(id, head, items, opts = {}) {
  const open = DD_OPEN.has(id);
  return `<div class="dd${opts.up ? ' up' : ''}${open ? ' open' : ''}" id="${id}"><button type="button" class="dd-head" aria-expanded="${open}"${opts.label ? ` aria-label="${esc(opts.label)}"` : ''}>${head}<span class="dd-ch">${ICON.chevDown}</span></button>
    <div class="dd-body"><div class="dd-in" role="listbox">${items.map((it, i) => `<button type="button" role="option" class="dd-opt${it.on ? ' on' : ''}" aria-selected="${!!it.on}" data-v="${esc(it.v)}" style="--i:${i}">${it.html}</button>`).join('')}</div></div></div>`;
}
function bindDropList(root, id, onPick) {
  const dd = root.querySelector('#' + id);
  if (!dd) return;
  dd.querySelector('.dd-head').onclick = e => {
    e.stopPropagation();
    const open = !dd.classList.contains('open');
    dd.classList.toggle('open', open);
    dd.querySelector('.dd-head').setAttribute('aria-expanded', String(open));
    if (open) DD_OPEN.add(id); else DD_OPEN.delete(id);
  };
  dd.querySelectorAll('.dd-opt').forEach(b => b.onclick = e => { e.stopPropagation(); onPick(b.dataset.v, b, dd); });
}
function closeDropList(id) { DD_OPEN.delete(id); const dd = document.getElementById(id); if (dd) { dd.classList.remove('open'); dd.querySelector('.dd-head')?.setAttribute('aria-expanded', 'false'); } }
const themeSwatch = k => { const t = THEMES[k] || THEMES.midnight; return `<span class="sw" style="background:linear-gradient(155deg,rgb(${t.g1}),rgb(${t.g2}));box-shadow:inset 0 0 0 2px ${t.accent}"></span>`; };

// Изменение размера окна уголком (прозрачные окна Windows не тянутся за край) и развёртывание на весь экран.
function windowControls(gripId, maxId) {
  const grip = gripId && document.getElementById(gripId);
  if (grip) resizeGrip(grip);
  const mx = maxId && document.getElementById(maxId);
  const paint = on => { document.body.classList.toggle('maxed', on); if (mx) { mx.innerHTML = on ? ICON.restore : ICON.max; mx.setAttribute('aria-label', on ? 'Восстановить' : 'Развернуть'); } };
  if (mx) mx.onclick = () => api.win('maximize');
  api.on('maxed', paint);
  paint(false);
  document.querySelector('.top.drag')?.addEventListener('dblclick', e => { if (mx && !e.target.closest('button')) api.win('maximize'); });
}

// Выпадающие списки в цвет темы: вместо системного списка Windows — своё меню.
// Сам <select> остаётся (скрытым): значение и onchange работают как раньше.
function enhanceSelects(root = document) {
  root.querySelectorAll('select').forEach(sel => {
    let btn = sel.nextElementSibling;
    if (!btn || !btn.classList.contains('sel-btn')) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sel-btn';
      btn.setAttribute('aria-haspopup', 'listbox');
      if (sel.getAttribute('aria-label')) btn.setAttribute('aria-label', sel.getAttribute('aria-label'));
      sel.after(btn);
      sel.classList.add('sel-native');
      btn.onclick = e => { e.stopPropagation(); openSelectMenu(sel, btn); };
      if (sel.id) { const lab = document.querySelector(`label[for="${sel.id}"]`); if (lab) lab.onclick = e => { e.preventDefault(); btn.click(); }; }
    }
    const o = sel.options[sel.selectedIndex];
    btn.innerHTML = `<span class="sel-t">${esc(o ? o.textContent : '')}</span>${ICON.chevDown}`;
    btn.disabled = sel.disabled;
  });
}
function openSelectMenu(sel, btn) {
  const old = document.querySelector('.sel-menu');
  if (old) { old.remove(); if (old.dataset.for === sel.id && sel.id) return; }
  const m = document.createElement('div');
  m.className = 'sel-menu'; m.setAttribute('role', 'listbox'); m.dataset.for = sel.id || '';
  const many = sel.options.length > 12;
  let html = many ? '<input type="text" class="sel-find" placeholder="Поиск…" aria-label="Поиск по списку">' : '';
  html += '<div class="sel-list">';
  for (const node of sel.children) {
    if (node.tagName === 'OPTGROUP') {
      html += `<div class="sel-group">${esc(node.label)}</div>`;
      for (const op of node.children) html += item(op, true);
    } else html += item(node, false);
  }
  html += '</div>';
  function item(op, inGroup) {
    const on = op.value === sel.value;
    return `<button type="button" role="option" aria-selected="${on}" class="sel-opt${on ? ' on' : ''}${inGroup ? ' in' : ''}" data-v="${esc(op.value)}">${esc(op.textContent)}</button>`;
  }
  m.innerHTML = html;
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect();
  m.style.minWidth = r.width + 'px';
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + 'px';
  const below = innerHeight - r.bottom - 12, above = r.top - 12;
  const h = Math.min(m.scrollHeight, Math.max(below, above, 160));
  m.style.maxHeight = h + 'px';
  m.style.top = (below >= Math.min(m.scrollHeight, 220) || below >= above ? r.bottom + 4 : r.top - 4 - h) + 'px';
  const pick = v => {
    m.remove();
    if (sel.value !== v) { sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    enhanceSelects(sel.parentElement || document);
    btn.focus();
  };
  m.querySelectorAll('.sel-opt').forEach(b => b.onclick = e => { e.stopPropagation(); pick(b.dataset.v); });
  m.querySelector('.sel-opt.on')?.scrollIntoView({ block: 'center' });
  const find = m.querySelector('.sel-find');
  if (find) {
    find.onclick = e => e.stopPropagation();
    find.oninput = () => {
      const q = find.value.trim().toLowerCase();
      m.querySelectorAll('.sel-opt').forEach(b => { b.hidden = q && !b.textContent.toLowerCase().includes(q); });
      m.querySelectorAll('.sel-group').forEach(g => {
        let n = g.nextElementSibling, any = false;
        while (n && !n.classList.contains('sel-group')) { if (!n.hidden) any = true; n = n.nextElementSibling; }
        g.hidden = !any;
      });
    };
    find.onkeydown = e => { if (e.key === 'Enter') { const f = m.querySelector('.sel-opt:not([hidden])'); if (f) pick(f.dataset.v); } };
    setTimeout(() => find.focus(), 0);
  }
  m.addEventListener('keydown', e => {
    if (e.key === 'Escape') { m.remove(); btn.focus(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const opts = [...m.querySelectorAll('.sel-opt:not([hidden])')], i = opts.indexOf(document.activeElement);
      (opts[Math.max(0, Math.min(opts.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))] || opts[0])?.focus();
    }
  });
  setTimeout(() => document.addEventListener('click', function close(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('click', close); } }));
}

// Уголок изменения размера: начало и конец — здесь, сам размер считает программа по курсору.
function resizeGrip(grip) {
  grip.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    grip.setPointerCapture(e.pointerId);
    api.resizeStart();
  });
  const end = () => api.resizeEnd();
  grip.addEventListener('pointerup', end);
  grip.addEventListener('lostpointercapture', end);
  window.addEventListener('blur', end);
}

// Ползунки в цвет темы: заливка до текущего значения.
function paintRanges(root = document) {
  root.querySelectorAll('input[type=range]').forEach(r => {
    const p = ((r.value - (r.min || 0)) / ((r.max || 100) - (r.min || 0))) * 100;
    r.style.setProperty('--p', p + '%');
  });
}
document.addEventListener('input', e => { if (e.target.matches && e.target.matches('input[type=range]')) paintRanges(e.target.parentElement); });

// Горячая клавиша для показа: «Ctrl + Shift + Num 1» вместо «Ctrl+Shift+num1».
const HK_NAMES = { numadd: 'Num +', numsub: 'Num −', nummult: 'Num *', numdiv: 'Num /', numdec: 'Num .', Return: 'Enter', Super: 'Win',
  Up: '↑', Down: '↓', Left: '←', Right: '→', Capslock: 'Caps Lock', Numlock: 'Num Lock', Scrolllock: 'Scroll Lock', PrintScreen: 'Print Screen',
  PageUp: 'Page Up', PageDown: 'Page Down', Space: 'Пробел', MediaPlayPause: 'Play/Pause', MediaNextTrack: 'Next', MediaPreviousTrack: 'Prev',
  MediaStop: 'Stop', VolumeUp: 'Vol +', VolumeDown: 'Vol −', VolumeMute: 'Mute' };
function hkLabel(acc) {
  return String(acc || '').split('+').filter(Boolean).map(p => (/^num\d$/.test(p) ? 'Num ' + p.slice(3) : HK_NAMES[p] || p)).join(' + ') || '—';
}
// Иконки ивентов (по id ивента, иначе по типу).
const EV_ICON = {
  rift: '<path d="M12 3c4.5 0 8 4 8 9s-3.5 9-8 9s-8-4-8-9s3.5-9 8-9z"/><path d="M12 7c2.2 0 4 2.2 4 5s-1.8 5-4 5s-4-2.2-4-5s1.8-5 4-5z"/><path d="M12 11v2"/>',
  boss: '<path d="M12 3c4 0 7 3 7 7c0 2.5-1.2 4-3 5v3H8v-3c-1.8-1-3-2.5-3-5c0-4 3-7 7-7z"/><path d="M9.5 11h.01M14.5 11h.01M10 18v3M14 18v3"/>',
  siege: '<path d="M4 21V10l3-2v3h3V7l2-2l2 2v4h3V8l3 2v11z"/><path d="M10 21v-4h4v4"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4M12 8v4l3 2"/>',
  shugo: '<path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13"/><path d="M12 7c-2-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3-2-5 1"/>',
  invasion: '<path d="M14.5 4.5l5 5L9 20H4v-5zM12 7l5 5"/><path d="M4 4l6 6"/>',
  pvp: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M9.5 6.5L13 3h3v3l-3.5 3.5M5 14l-2 2l3 3l2-2"/>',
  pve: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9c-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2l4-4"/>',
  world: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  app: '<rect x="3" y="4" width="18" height="13" rx="3"/><path d="M8 21h8M12 17v4M8 12l2-3l2 2l3-4"/>',
  discord: '<path d="M7 7c3-1.3 7-1.3 10 0l2 9c-1.5 1.2-3 1.8-4 2l-1-2M10 16l-1 2c-1-.2-2.5-.8-4-2l2-9"/><path d="M9.5 12h.01M14.5 12h.01"/>',
  mine: '<path d="M12 3l2.6 5.5l6 .8l-4.4 4.2l1.1 6l-5.3-2.9l-5.3 2.9l1.1-6L3.4 9.3l6-.8z"/>',
  update: '<path d="M12 3v12M7 10l5 5l5-5"/><path d="M5 19h14"/>',
  chart: '<path d="M4 19V5M4 19h16"/><path d="M7 15l4-5l3 3l5-7"/>',
  compare: '<path d="M8 4v16M16 4v16"/><path d="M4 8h4M16 12h4M4 16h4"/>',
  skull: '<path d="M12 3c4.4 0 8 3.2 8 7.4c0 2.4-1.2 4.2-3 5.3V19h-2v-2h-2v2h-2v-2H9v2H7v-3.3c-1.8-1.1-3-2.9-3-5.3C4 6.2 7.6 3 12 3z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/>',
};
// Звуки уведомлений: свои мелодии из assets/sounds и простой сигнал.
const SOUNDS = [['stars', 'Stars'], ['stars-lite', 'Stars Lite'], ['clear-sky', 'Clear Sky'], ['ma-bae', 'Ma Bae'], ['kark', 'Kark'], ['chime', 'Chime'], ['drop', 'Drop'], ['glass', 'Glass'], ['marimba', 'Marimba'], ['harp', 'Harp'], ['pulse', 'Pulse'], ['beep', 'Простой сигнал']];
let _snd = null;
function playSound(name, volume = 80) {
  const v = Math.max(0, Math.min(100, +volume || 0)) / 100;
  try { if (_snd) { _snd.pause(); _snd = null; } } catch { /* ignore */ }
  if (name === 'beep' || !SOUNDS.some(s => s[0] === name)) {
    try {
      const ctx = new AudioContext(), o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.3 * v), ctx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.65);
    } catch { /* звук не обязателен */ }
    return;
  }
  try { _snd = new Audio('../assets/sounds/' + name + '.mp3'); _snd.volume = v; _snd.play().catch(() => {}); } catch { /* звук не обязателен */ }
}
function eventIconKey(e) {
  const id = String(e.icon || e.id || '');
  if (/rift/.test(id)) return 'rift';
  if (/siege/.test(id) && !/boss/.test(id)) return 'siege';
  if (/reset/.test(id)) return 'reset';
  if (/shugo/.test(id)) return 'shugo';
  if (/invasion|beritra/.test(id)) return 'invasion';
  if (/kaira|nahma|boss|executor|^fb/.test(id)) return 'boss';
  if (/field-events/.test(id)) return 'shugo';
  if (EV_ICON[id]) return id;
  if (e.custom || e.src === 'mine') return 'mine';
  return { pvp: 'pvp', pve: 'pve', world: 'world', reset: 'reset', info: 'info' }[e.type] || 'calendar';
}
function eventIcon(e, size = 18) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${EV_ICON[eventIconKey(e)]}</svg>`;
}

// Тема «Чёрное пламя»: мягкое пятно света следует за курсором (координаты берёт CSS).
(() => {
  let raf = 0, x = 0, y = 0;
  const set = (a, b) => { document.body.style.setProperty('--mx', a + 'px'); document.body.style.setProperty('--my', b + 'px'); };
  addEventListener('mousemove', e => {
    if (!document.body || document.body.dataset.skin !== 'blackflame') return;
    x = e.clientX; y = e.clientY;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; set(x, y); });
  }, { passive: true });
  document.addEventListener('mouseleave', () => set(-300, -300));
})();
