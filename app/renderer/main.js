'use strict';
let S = null, status = {}, page = 'overlay', version = '', showAddr = false, U = null, rpcAvailable = false;
// «Игра найдена, читаю бой · 1.2.3.4:7777» → ['Игра найдена, читаю бой', '1.2.3.4:7777']
const splitStatus = msg => { const i = String(msg || '').indexOf(' · '); return i < 0 ? [msg || '', ''] : [msg.slice(0, i), msg.slice(i + 3)]; };
const $ = id => document.getElementById(id);
$('bMin').innerHTML = ICON.min; $('bClose').innerHTML = ICON.close;
$('bMin').onclick = () => api.win('minimize');
$('authorBadge').onclick = () => api.open('discord');
windowControls('grip', 'bMax');
$('bClose').onclick = () => api.win('close');
document.querySelectorAll('nav button[data-p]').forEach(b => b.onclick = () => {
  if (b.dataset.p === 'schedule') api.open('schedule');
  else { page = b.dataset.p; render(); }
});

function nav() {
  document.querySelectorAll('nav button[data-p]').forEach(b => b.classList.toggle('on', b.dataset.p === page));
  const st = status.state;
  $('dot').style.background = st === 'Capturing' ? '#5ccf8a' : (st === 'WaitingForGame' || st === 'Starting' || st === 'starting') ? '#ffc66b' : '#ff8a7a';
  $('stText').textContent = splitStatus(status.msg)[0];
  $('charLine').innerHTML = S.character ? `Персонаж: <b>${esc(S.character)}</b>` : 'Персонаж: зайдите в игру';
  $('charLine').title = S.character || '';
  document.querySelector('nav button[data-p=about]').classList.toggle('upd', !!U?.available);
  sideSet();
}
// Левое меню: оформление (списком) и язык RU/EN.
function sideSet() {
  const box = $('sideSet');
  const lang = S.lang === 'en' ? 'en' : 'ru';
  box.innerHTML = `<span class="slbl">Оформление</span>
    ${dropList('ddTheme', `${themeSwatch(S.theme)}<span class="dd-v">${esc((THEMES[S.theme] || THEMES.amethyst).name)}</span>`, Object.entries(THEMES).map(([k, t]) => ({ v: k, on: k === S.theme, html: `${themeSwatch(k)}<span class="tn">${esc(t.name)}</span><span class="ck">${ICON.check}</span>` })), { up: true, label: 'Оформление' })}
`;
  bindDropList(box, 'ddTheme', v => { closeDropList('ddTheme'); if (v !== S.theme) api.set({ theme: v }); });
  // Язык — маленький квадрат «RU ▾» под «О программе», по клику раскрывается список.
  const lb = $('langBox');
  lb.innerHTML = dropList('ddLang', `<span class="dd-v">${lang.toUpperCase()}</span>`, [['ru', 'Русский'], ['en', 'English']].map(([k, n]) => ({ v: k, on: k === lang, html: `<b>${k.toUpperCase()}</b><span>${n}</span><span class="ck">${ICON.check}</span>` })), { label: 'Язык · Language' });
  lb.firstElementChild.classList.add('mini');
  lb.setAttribute('data-notr', '');
  bindDropList(lb, 'ddLang', v => { closeDropList('ddLang'); if (v !== lang) setTimeout(() => api.set({ lang: v }), 250); });
}

let WHN = { text: '', cls: '' }; // сообщение под ссылкой вебхука
const NOTIFY_STYLES = [['glass', 'Стекло'], ['solid', 'Плотная'], ['accent', 'Акцент'], ['minimal', 'Минимал'], ['banner', 'Баннер']];
const NOTIFY_POS = [['tl', 'Слева вверху'], ['tc', 'Сверху по центру'], ['tr', 'Справа вверху'], ['bl', 'Слева внизу'], ['bc', 'Снизу по центру'], ['br', 'Справа внизу']];

const DISCORD_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M19.3 5.3A16.6 16.6 0 0 0 15.2 4l-.5 1a15.4 15.4 0 0 0-5.4 0l-.5-1a16.6 16.6 0 0 0-4.1 1.3C2 9.2 1.3 13 1.6 16.8a16.8 16.8 0 0 0 5 2.5l1.1-1.7a10.8 10.8 0 0 1-1.7-.8l.4-.3a11.9 11.9 0 0 0 11.2 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.7a16.7 16.7 0 0 0 5-2.5c.4-4.4-.7-8.2-3.1-11.5zM8.7 14.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2s1.8.9 1.8 2s-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2s1.8.9 1.8 2s-.8 2-1.8 2z"/></svg>';

// Горячие клавиши: id, описание.
const HOTKEYS = [['overlay', 'показать / скрыть оверлей'], ['lock', 'закрепить: клики проходят сквозь оверлей'], ['reset', 'начать подсчёт заново'], ['share', 'скопировать итог боя (картинка и текст)'], ['modeBoss', 'режим «Данж: Босс»'], ['modeWorld', 'режим «Мир: Босс»'], ['modeMob', 'режим «Моб»'], ['modeNext', 'следующий режим по кругу']];
const HOTKEY_DEFAULTS = { overlay: 'Ctrl+Shift+D', lock: 'Ctrl+Shift+L', reset: 'Ctrl+Shift+R', share: 'Ctrl+Shift+C', modeBoss: 'Ctrl+Shift+1', modeWorld: 'Ctrl+Shift+2', modeMob: 'Ctrl+Shift+3', modeNext: 'Ctrl+Shift+M' };
let hkWait = null, hkErr = {};
const hkText = id => ((S.hotkeys || {})[id] || HOTKEY_DEFAULTS[id]);
// Клавиши → имена ускорителей Electron. Можно назначить любую клавишу клавиатуры, включая цифровой блок (Num).
const KEYNAMES = {
  Space: 'Space', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Backquote: '`',
  Comma: ',', Period: '.', Slash: '/', Backslash: '\\', IntlBackslash: '\\',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  Insert: 'Insert', Delete: 'Delete', Backspace: 'Backspace', Tab: 'Tab', Enter: 'Return', CapsLock: 'Capslock', NumLock: 'Numlock',
  ScrollLock: 'Scrolllock', PrintScreen: 'PrintScreen', ContextMenu: 'Menu' /* не все версии Electron */,
  NumpadAdd: 'numadd', NumpadSubtract: 'numsub', NumpadMultiply: 'nummult', NumpadDivide: 'numdiv', NumpadDecimal: 'numdec', NumpadEnter: 'Return',
  MediaPlayPause: 'MediaPlayPause', MediaStop: 'MediaStop', MediaTrackNext: 'MediaNextTrack', MediaTrackPrevious: 'MediaPreviousTrack',
  AudioVolumeUp: 'VolumeUp', AudioVolumeDown: 'VolumeDown', AudioVolumeMute: 'VolumeMute',
};
function accelFrom(e) {
  let k = null;
  if (/^Key[A-Z]$/.test(e.code)) k = e.code.slice(3);
  else if (/^Digit\d$/.test(e.code)) k = e.code.slice(5);
  else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(e.code)) k = e.code;
  else if (/^Numpad\d$/.test(e.code)) k = 'num' + e.code.slice(6);
  else if (KEYNAMES[e.code]) k = KEYNAMES[e.code];
  if (!k || k === 'Menu') return null;
  const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean);
  return [...mods, k].join('+');
}
// Одиночная обычная клавиша (буква, цифра, пробел…) будет перехвачена во всех программах — предупредим.
const plainKey = acc => !/\+/.test(acc) && !/^(F\d+|num|Media|Volume|Insert|Delete|Home|End|PageUp|PageDown|Scrolllock|PrintScreen|Numlock|Capslock)/.test(acc);
document.addEventListener('keydown', e => {
  if (!hkWait) return;
  e.preventDefault(); e.stopPropagation();
  if (e.key === 'Escape') { hkWait = null; api.hotkeysPause(false); render(); return; }
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
  const acc = accelFrom(e);
  if (!acc) { hkErr[hkWait] = 'Эту клавишу назначить нельзя — выберите другую'; render(); return; }
  const id = hkWait; hkWait = null; hkErr[id] = plainKey(acc) ? 'Одиночная клавиша будет срабатывать во всех программах, в том числе в чате игры' : '';
  api.set({ hotkeys: { [id]: acc } });
}, true);

// Заголовок страницы: по центру, с описанием под ним.
const head = (title, lead, rawLead) => `<header class="ph"><h1>${esc(title)}</h1><p>${rawLead ? lead : esc(lead)}</p></header>`;

const pages = {
  overlay: () => `${head('Оверлей', 'Внешний вид и поведение окна урона поверх игры')}
    <div class="card field"><span class="lbl">Режим подсчёта</span><div class="seg" id="mModes">${MODES.map(([k, l]) => `<button type="button" data-m="${k}" class="${S.mode === k ? 'on' : ''}" aria-pressed="${S.mode === k}">${l}</button>`).join('')}</div>
      <div class="muted" style="font-size:12px">«Данж: Босс» — только бои с боссами подземелий, «Мир: Босс» — только мировые боссы, «Моб» — весь урон по всем целям.</div>
      ${S.profilesOn !== false ? `<div class="profnote"><span>Настройки ниже сохраняются отдельно для режима</span> <b>${esc((MODES.find(m => m[0] === S.mode) || MODES[0])[1])}</b><span>: список, прозрачность, колонки, «Только я», размер и место оверлея.</span></div>` : ''}</div>
    <div class="card field"><span class="lbl">Колонки оверлея</span>
      <div class="row" style="gap:18px">
        <label class="row" style="gap:7px"><input type="checkbox" id="cHead" ${S.showHeader !== false ? 'checked' : ''}> Названия колонок (#, Игрок, DPS, Урон, %)</label>
        <label class="row" style="gap:7px"><input type="checkbox" data-mcol="crit" ${S.columns?.crit ? 'checked' : ''}> Крит %</label>
        <label class="row" style="gap:7px"><input type="checkbox" data-mcol="hits" ${S.columns?.hits ? 'checked' : ''}> Удары</label>
        <label class="row" style="gap:7px"><input type="checkbox" data-mcol="maxHit" ${S.columns?.maxHit ? 'checked' : ''}> Макс. удар</label>
        <label class="row" style="gap:7px"><input type="checkbox" data-mcol="hps" ${S.columns?.hps ? 'checked' : ''}> Лечение (HPS)</label>
      </div>
      <div class="muted" style="font-size:12px">Наведите курсор на название колонки в оверлее — появится подсказка, что она показывает.</div></div>
    <div class="card field"><span class="lbl">Поведение</span>
      <label class="opt"><input type="checkbox" id="oSolo" ${S.solo ? 'checked' : ''}> <span><b>Только я</b> — крупно свой DPS, место, урон и крит вместо списка группы</span></label>
      <label class="opt"><input type="checkbox" id="oAuto" ${S.autoHide !== false ? 'checked' : ''}> <span><b>Прятать оверлей</b>, когда игра свёрнута или открыто другое окно</span></label>
      <label class="opt"><input type="checkbox" id="oStart" ${S.autoStart ? 'checked' : ''}> <span><b>Запускать вместе с Windows</b> — программа стартует свёрнутой в трей, оверлей появится, когда откроется игра</span></label>
      <label class="opt"><input type="checkbox" id="oQuit" ${S.quitWithGame ? 'checked' : ''}> <span><b>Закрываться вместе с игрой</b> — через 20 секунд после выхода из игры</span></label>
      <label class="opt"><input type="checkbox" id="oProf" ${S.profilesOn !== false ? 'checked' : ''}> <span><b>Свои настройки для каждого режима</b> — список, прозрачность, колонки, «Только я», размер и место оверлея запоминаются отдельно для «Данж: Босс», «Мир: Босс» и «Моб»</span></label></div>
    <div class="card field"><span class="lbl">Список, прозрачность и масштаб</span>
      <div class="sliders">
        <div class="sl"><label for="mCount">Игроков в списке</label><b class="num" id="vCount">${S.count}</b><input id="mCount" type="range" min="1" max="50" value="${S.count}"></div>
        <div class="sl"><label for="mOp">Прозрачность фона</label><b class="num" id="vOp">${S.opacity}%</b><input id="mOp" type="range" min="20" max="100" step="5" value="${S.opacity}"></div>
        <div class="sl"><label for="mSc">Масштаб</label><b class="num" id="vSc">${S.scale}%</b><input id="mSc" type="range" min="70" max="150" step="5" value="${S.scale}"></div>
      </div></div>
    <div class="card row" style="justify-content:center"><button type="button" class="primary" id="showOv">Показать оверлей</button><button type="button" id="resetSize">Размер и место по умолчанию</button>
      <button type="button" id="ct">${S.clickThrough ? 'Снять закрепление' : 'Закрепить (клики сквозь)'}</button></div>
    <div class="card field"><span class="lbl">Горячие клавиши</span>
      <div class="keys">${HOTKEYS.map(([id, text]) => `<div class="hk"><button type="button" class="kbd hkb${hkWait === id ? ' wait' : ''}" data-hk="${id}" title="Нажмите и затем нужное сочетание клавиш">${hkWait === id ? 'Нажмите сочетание…' : esc(hkLabel(hkText(id)))}</button><span>${text}</span>${hkErr[id] ? `<span class="hkerr">${esc(hkErr[id])}</span>` : ''}</div>`).join('')}</div>
      <div class="row"><button type="button" id="hkReset">Вернуть стандартные</button><span class="muted" style="font-size:12px">Нажмите на сочетание, затем любую клавишу или сочетание — подойдут и клавиши цифрового блока (Num 1, Num +). Esc — отмена.</span></div></div>`,

  connect: () => {
    const [main, addr] = splitStatus(status.msg);
    return `${head('Настройки', 'Чтение боя, уведомления и что нужно для работы программы')}
    <div class="card field center"><span class="lbl">Состояние</span><div class="big">${esc(main || '—')}</div>
      ${addr ? `<div class="addr" style="justify-content:center"><span class="muted">Адрес сервера игры:</span><code>${showAddr ? esc(addr) : '••••••••••••'}</code><button type="button" id="addrToggle">${showAddr ? 'Скрыть' : 'Показать'}</button></div>` : ''}
      <div class="row" style="justify-content:center"><button type="button" id="restart">Перезапустить чтение</button><button type="button" id="report">Отчёт об ошибке</button></div>
      <div class="muted" style="font-size:12px">Что-то не работает? «Отчёт об ошибке» сохранит на рабочий стол файл с версией, состоянием чтения и последними сообщениями — отправьте его автору в Discord.</div>
    <div class="card field center"><span class="lbl">Уведомления о событиях</span>
      <div>Где на экране показывать уведомления перед ивентами и о новых событиях в расписании:</div>
      <div class="ddwrap ddpos">${(() => { const cur = S.notify.position || 'br', n = (NOTIFY_POS.find(x => x[0] === cur) || NOTIFY_POS[5])[1];
        return dropList('ddPos', `<i class="pd ${cur}"></i><span class="dd-v">${n}</span>`, NOTIFY_POS.map(([k, t]) => ({ v: k, on: k === cur, html: `<i class="pd ${k}"></i><span>${t}</span><span class="ck">${ICON.check}</span>` })), { label: 'Место уведомления' }); })()}</div>
      <div>Оформление уведомления:</div>
      <div class="ddwrap ddst">${(() => { const cur = S.notify.style || 'glass', n = (NOTIFY_STYLES.find(x => x[0] === cur) || NOTIFY_STYLES[0])[1];
        const pv = k => `<i class="pv pv-${k}"><i class="pi">${eventIcon({ id: 'rift' }, k === 'banner' ? 16 : 11)}</i><i class="pl"><i></i><i></i></i></i>`;
        return dropList('ddSt', `${pv(cur)}<span class="dd-v">${n}</span>`, NOTIFY_STYLES.map(([k, t]) => ({ v: k, on: k === cur, html: `${pv(k)}<span>${t}</span><span class="ck">${ICON.check}</span>` })), { label: 'Оформление уведомления' }); })()}</div>
      <div>Звук уведомления:</div>
      <div class="ddwrap ddsnd ${S.notify.sound ? '' : 'off'}">${(() => { const cur = S.notify.soundName || 'clear-sky', n = (SOUNDS.find(x => x[0] === cur) || SOUNDS[0])[1];
        return dropList('ddSnd', `<span class="pl">${ICON.play}</span><span class="dd-v"${cur === 'beep' ? '' : ' data-notr'}>${n}</span>`, SOUNDS.map(([k, t]) => ({ v: k, on: k === cur, html: `<span class="pl">${ICON.play}</span><span${k === 'beep' ? '' : ' data-notr'}>${t}</span><span class="ck">${ICON.check}</span>` })), { label: 'Звук уведомления' }); })()}</div>
      <div class="sl vol"><label for="nVol">Громкость</label><b id="nVolV">${S.notify.volume ?? 50}%</b><input type="range" id="nVol" min="0" max="100" step="5" value="${S.notify.volume ?? 50}"></div>
      <div class="row" style="justify-content:center"><button type="button" class="primary" id="tt">Проверить уведомление</button><label class="row" style="gap:7px"><input type="checkbox" id="nSound" ${S.notify.sound ? 'checked' : ''}> Звуковой сигнал</label></div>
      <label class="opt" style="max-width:560px;margin:0 auto;text-align:left"><input type="checkbox" id="nDeath" ${S.deathToast !== false ? 'checked' : ''}> <span><b>Разбор смерти</b> — уведомление, кто и чем добил персонажа, с кнопкой «Разбор»</span></label>
      <label class="opt" style="max-width:560px;margin:8px auto 0;text-align:left"><input type="checkbox" id="nLag" ${S.lagAlert !== false ? 'checked' : ''}> <span><b>Скачок пинга</b> — пинг на панели вспыхивает красным и приходит уведомление, когда связь с сервером резко ухудшилась</span></label></div>
    <div class="card field center"><span class="lbl">Итог боя в Discord-канал</span>
      <div style="max-width:600px;margin:0 auto"><span>Вставьте ссылку вебхука канала — и кнопка «Поделиться»</span> <b class="kbd" data-notr>${esc(hkLabel(hkText('share')))}</b> <span>будут отправлять таблицу боя прямо в чат гильдии.</span></div>
      <div class="whrow"><input type="password" id="whUrl" value="${esc(S.webhook?.url || '')}" placeholder="https://discord.com/api/webhooks/…" autocomplete="off" spellcheck="false"><button type="button" id="whTest">Проверить</button></div>
      <div id="whMsg" class="${WHN.cls || 'muted'}" style="font-size:12px;min-height:16px">${esc(WHN.text)}</div>
      <label class="opt" style="max-width:560px;margin:0 auto;text-align:left"><input type="checkbox" id="whOn" ${S.webhook?.on ? 'checked' : ''}> <span><b>Отправлять в канал</b> при нажатии «Поделиться»</span></label>
      <details class="how"><summary>Где взять ссылку</summary><ol><li>В Discord откройте настройки канала → «Интеграции» → «Вебхуки».</li><li>Нажмите «Новый вебхук», затем «Копировать URL вебхука».</li><li>Вставьте ссылку сюда и нажмите «Проверить» — в канале появится сообщение.</li></ol><div class="muted">Ссылка хранится только на этом компьютере. Кто знает ссылку, может писать в канал — не публикуйте её.</div></details></div>
    <div class="card field center"><span class="lbl">Для правильной работы приложения необходимо</span>
      <div class="steps" style="max-width:600px;margin:0 auto;text-align:left">
        <div class="step"><span class="n">1</span><div><b><a href="#" data-url="https://npcap.com/#download">Npcap</a></b> — драйвер для захвата трафика. Установите с настройками по умолчанию.</div></div>
        <div class="step"><span class="n">2</span><div><b><a href="#" data-url="https://dotnet.microsoft.com/download/dotnet/10.0">.NET 10 Runtime</a></b> — для модуля чтения боя (раздел «.NET Runtime», Windows x64).</div></div>
        <div class="step"><span class="n">3</span><div>Запускайте Aion DPS Meter <b>до входа в подземелье</b>: имена игроков игра присылает на экране загрузки.</div></div>
      </div>
      <div class="row" style="justify-content:center"><span class="muted">Поддерживаемые клиенты:</span><span class="tags"><span>AION 2 Global · Steam</span><span>AION 2 Global · PURPLE</span></span></div></div>
    ${rpcAvailable ? `<div class="card field center"><span class="lbl">Статус в Discord</span>
      <div class="dcrow">
        <div class="dcprev${S.discordRpc === false ? ' off' : ''}" aria-hidden="true">
          <div class="dch">Играет</div>
          <div class="dcb"><img src="../assets/icon.png" width="60" height="60" alt=""><div class="dct"><b>Aion DPS Meter</b><span>Бой с боссом</span><span>Дозорщик Кайра</span><span class="dcel num">02:14 прошло</span></div></div>
        </div>
        <div class="dcinfo">
          <label class="opt"><input type="checkbox" id="rpcOn" ${S.discordRpc !== false ? 'checked' : ''}> <span><b>Показывать в Discord</b>, во что вы играете: бой с боссом, его имя и время боя</span></label>
          <div class="muted" style="font-size:12px">Работает с запущенным приложением Discord на этом компьютере. Между боями — «Ждёт боя» и ваш сервер.</div>
        </div>
      </div></div>` : ''}`;
  },

  stats: () => {
    const tabs = [['history', 'История боёв'], ['compare', 'Сравнение'], ['deaths', 'Разбор смерти'], ['bosses', 'Рекорды по боссам'], ['classes', 'DPS по классам']];
    return `${head('Статистика', 'Ваши бои, рекорды по боссам и DPS по классам' + (F.list && F.list.length ? ' · сохранено боёв: ' + F.list.length : ''))}
      <div class="seg tabs">${tabs.map(([k, l]) => `<button type="button" data-st="${k}" class="${statTab === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      ${statTab === 'deaths' ? deathsBody() : !F.list ? '<div class="card emptyBox">Загрузка…</div>' : !F.list.length ? '<div class="card emptyBox">Пока нет сохранённых боёв. Бои с боссами и бои дольше минуты записываются сюда сами.</div>' : statsBody()}`;
  },

  chars: () => {
    const servers = R.servers || [];
    const byRace = r => servers.filter(x => x.race === r).sort((a, b) => (getLang() === 'en' ? a.en.localeCompare(b.en) : a.ru.localeCompare(b.ru, 'ru')));
    const opt = x => `<option value="${x.id}" ${String(R.serverId) === String(x.id) ? 'selected' : ''}>${esc(getLang() === 'en' ? x.en : x.ru)}</option>`;
    return `${head('Персонажи', 'Поиск персонажей на официальном сайте AION 2')}
    <form class="card row" id="rForm" style="align-items:flex-end">
      <label class="field" style="flex:1 1 170px"><span class="lbl">Регион</span><select id="rRegion">${ARMORY_REGIONS.map(([k, n]) => `<option value="${k}" ${R.region === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field" style="flex:1 1 190px"><span class="lbl">Сервер</span><select id="rServer"><option value="">Все серверы региона</option>
        ${servers.length ? `<optgroup label="Элийцы">${byRace(1).map(opt).join('')}</optgroup><optgroup label="Асмодиане">${byRace(2).map(opt).join('')}</optgroup>` : ''}</select></label>
      <label class="field" style="flex:2 1 220px"><span class="lbl">Ник персонажа</span><input type="text" id="rName" value="${esc(R.name)}" placeholder="${esc(S.character || 'Ник')}" autocomplete="off" spellcheck="false"></label>
      <button type="submit" class="primary">Найти</button>
    </form>
    ${charsBody()}`;
  },

  about: () => `${head('Aion DPS Meter', 'Счётчик урона для AION 2 · версия ' + esc(version), true)}
    <div class="card field"><span class="lbl">Программа и NCSoft</span>
      <div class="note"><div>
        <div>Aion DPS Meter — бесплатная программа с открытым исходным кодом для игроков. Она <b>только читает</b> трафик игры на вашем компьютере: ничего не отправляет в игру, не читает её память и не влияет на игровой процесс.</div>
        <div style="margin-top:6px">На сегодня NCSoft публично не запрещала такие счётчики урона, но и официального разрешения не давала. Если NCSoft объявит запрет, работа счётчика будет отключена через обновление.</div>
        <div style="margin-top:6px" class="muted">Программа не связана с NCSoft и не одобрена ею. AION 2, названия и эмблемы классов — собственность NCSoft.</div>
      </div></div>
      <div class="muted" style="font-size:12px;text-align:center">Открытый исходный код · лицензия GPL-3.0 · <a href="#" data-url="https://www.gnu.org/licenses/gpl-3.0.html">текст лицензии</a></div></div>
    ${updateCard()}
    <div class="card authorCard">
      <img src="../assets/logo.png" width="64" height="64" alt="">
      <div class="who"><span class="lbl">Автор</span><b>Accapura</b><span class="muted">Разработка, идеи и поддержка программы</span></div>
      <button type="button" class="primary discord" data-dc="app">${DISCORD_ICON}Написать в Discord</button>
    </div>`,
};

// ---------------------------------------------------------------- обновления
function updateCard() {
  const u = U || { current: version };
  let body;
  if (u.state === 'downloading') body = `<div>Загружаю версию <b>${esc(u.version)}</b>… ${Math.round((u.progress || 0) * 100)}%</div><div class="ubar"><i style="width:${((u.progress || 0) * 100).toFixed(1)}%"></i></div><div class="muted" style="font-size:12px">Если связь оборвётся, загрузка продолжится с того же места.</div>`;
  else if (u.state === 'installing') body = '<div>Устанавливаю обновление — программа перезапустится сама.</div>';
  else if (u.available) body = `<div>Доступна версия <b>${esc(u.version)}</b> (у вас ${esc(u.current)})${u.size ? ` · ${(u.size / 1048576).toFixed(u.size < 10485760 ? 1 : 0).replace('.', getLang() === 'en' ? '.' : ',')} МБ` : ''}</div>
      <div class="muted" style="font-size:12px">${u.kind === 'patch' ? 'Лёгкое обновление: скачается за секунды и поставится само, без установщика.' : 'Скачается установщик и поставит новую версию в ту же папку.'}</div>${u.notes ? `<div class="note" style="white-space:pre-line">${esc(u.notes)}</div>` : ''}
      ${u.state === 'error' ? `<div class="hkerr">Не получилось: ${esc(u.error)}</div>` : ''}
      <div class="row" style="justify-content:center"><button type="button" class="primary" id="uGo">${u.state === 'error' ? 'Повторить' : 'Обновить'}</button>${S.updateSkip !== u.version ? '<button type="button" id="uSkip">Не напоминать об этой версии</button>' : ''}</div>`;
  else body = `<div>У вас последняя версия — <b>${esc(u.current || version)}</b>.</div><div class="row" style="justify-content:center"><button type="button" id="uCheck">Проверить сейчас</button></div>`;
  return `<div class="card field center"><span class="lbl">Обновления</span>${body}</div>`;
}

// ---------------------------------------------------------------- статистика
const F = { list: null, open: null };
let statTab = 'history';
const RES = { Kill: 'Победа', Wipe: 'Поражение', Idle: 'Прервано', Manual: 'Сброшено', ZoneChange: 'Выход' };
const dt = ms => new Date(ms).toLocaleString(LOC(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const meOf = f => (f.players || []).find(p => p.self);
const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function statsBody() {
  const list = F.list;
  if (statTab === 'history') {
    if (F.open) {
      const f = list.find(x => x.id === F.open);
      if (f) {
        const me = (f.details || [])[0];
        const hasHeal = f.players.some(p => p.hps > 0);
        const canCmp = f.boss && meOf(f) && list.filter(x => x.boss === f.boss && meOf(x)).length > 1;
        return `<div class="card field"><div class="row"><button type="button" id="fBack">← Ко всем боям</button><button type="button" id="fShare" data-share="${esc(f.id)}">Поделиться</button>${canCmp ? `<button type="button" id="fCmp" data-cmp="${esc(f.id)}">Сравнить</button>` : ''}<span style="flex:1"></span><span class="res ${f.result}">${RES[f.result] || f.result}</span></div>
          <div style="font-size:20px;font-weight:700">${nt(f.boss || f.title)}</div>
          <div class="muted">${dt(f.at)} · ${esc(f.zone || '')} · бой ${clock(f.combatMs)} · DPS группы ${fmt(f.partyDps)}${pingStat(f.ping)}${f.partial ? ' · сервер прислал не весь урон' : ''}</div>
          ${classLine(f)}
          <div class="scroll"><table class="ft"><tr><th>#</th><th>Игрок</th><th>Класс</th><th class="r">DPS</th><th class="r">Урон</th><th class="r">%</th><th class="r">Крит</th><th class="r">Макс. удар</th>${hasHeal ? '<th class="r">HPS</th>' : ''}</tr>
          ${f.players.map((p, i) => `<tr class="${p.self ? 'me' : ''}"><td>${i + 1}</td><td>${nt(p.name)}</td><td>${classIcon(p.cls)} ${esc(CLASS_RU[p.cls] || '')}</td><td class="r num">${fmt(p.dps)}</td><td class="r num">${fmt(p.dmg)}</td><td class="r num">${(p.share * 100).toFixed(1).replace('.', ',')}</td><td class="r num">${p.crit != null ? Math.round(p.crit * 100) + '%' : '—'}</td><td class="r num">${fmt(p.maxHit)}</td>${hasHeal ? `<td class="r num">${p.hps ? fmt(p.hps) : '—'}</td>` : ''}</tr>`).join('')}</table></div></div>
          ${fightChart(f)}
          ${me && me.skills?.length ? `<div class="card field"><span class="lbl">Ваши навыки в этом бою</span><div class="scroll"><table class="ft"><tr><th>Навык</th><th class="r">Урон</th><th class="r">%</th><th class="r">Удары</th><th class="r">Крит</th><th class="r">Макс.</th></tr>
          ${me.skills.map(k => `<tr><td data-notr>${esc(k.name)}</td><td class="r num">${fmt(k.dmg)}</td><td class="r num">${(k.share * 100).toFixed(1).replace('.', ',')}</td><td class="r num">${k.hits}</td><td class="r num">${k.crit != null ? Math.round(k.crit * 100) + '%' : '—'}</td><td class="r num">${fmt(k.max)}</td></tr>`).join('')}</table></div></div>` : ''}`;
      }
    }
    return `<div class="card scroll"><table class="ft"><tr><th>Когда</th><th>Бой</th><th>Итог</th><th class="r">Время</th><th class="r">DPS группы</th><th class="r">Ваш DPS</th><th class="r">Ваше место</th></tr>
      ${list.map(f => { const me = meOf(f); const place = me ? f.players.indexOf(me) + 1 : null;
        return `<tr class="click" data-f="${esc(f.id)}"><td>${dt(f.at)}</td><td>${nt(f.boss || f.title)}</td><td><span class="res ${f.result}">${RES[f.result] || f.result}</span></td><td class="r num">${clock(f.combatMs)}</td><td class="r num">${fmt(f.partyDps)}</td><td class="r num">${me ? fmt(me.dps) : '—'}</td><td class="r num">${place ? place + ' из ' + f.players.length : '—'}</td></tr>`; }).join('')}</table></div>
      <div class="row"><button type="button" id="fClear">Очистить историю</button></div>`;
  }
  if (statTab === 'compare') return compareBody();
  if (statTab === 'bosses') {
    const by = {};
    for (const f of list) if (f.boss) (by[f.boss] = by[f.boss] || []).push(f);
    const rows = Object.entries(by).map(([boss, fs]) => {
      const kills = fs.filter(f => f.result === 'Kill');
      const mine = fs.map(f => ({ f, me: meOf(f) })).filter(x => x.me);
      const best = mine.reduce((a, x) => (!a || x.me.dps > a.me.dps ? x : a), null);
      const fastest = kills.reduce((a, f) => (!a || f.combatMs < a.combatMs ? f : a), null);
      const topAny = fs.flatMap(f => f.players.map(p => ({ ...p, f }))).reduce((a, p) => (!a || p.dps > a.dps ? p : a), null);
      return { boss, n: fs.length, kills: kills.length, best, avg: mine.length ? mine.reduce((a, x) => a + x.me.dps, 0) / mine.length : 0, fastest, topAny };
    }).sort((a, b) => b.n - a.n);
    if (!rows.length) return '<div class="card emptyBox">Боёв с боссами пока не было.</div>';
    return `<div class="card scroll"><table class="ft"><tr><th>Босс</th><th class="r">Боёв</th><th class="r">Побед</th><th class="r">Ваш лучший DPS</th><th class="r">Ваш средний</th><th class="r">Быстрейшая победа</th><th>Лучший DPS в группе</th></tr>
      ${rows.map(r => `<tr><td><b>${nt(r.boss)}</b></td><td class="r num">${r.n}</td><td class="r num">${r.kills}</td><td class="r num">${r.best ? '<b>' + fmt(r.best.me.dps) + '</b><div class="muted" style="font-size:11px">' + dt(r.best.f.at) + '</div>' : '—'}</td><td class="r num">${r.avg ? fmt(r.avg) : '—'}</td><td class="r num">${r.fastest ? clock(r.fastest.combatMs) : '—'}</td><td>${r.topAny ? '<b class="num">' + fmt(r.topAny.dps) + '</b><div class="muted" style="font-size:11px">' + nt(r.topAny.name) + ', <span>' + esc(CLASS_RU[r.topAny.cls] || '') + '</span></div>' : '—'}</td></tr>`).join('')}</table></div>`;
  }
  // classes
  const per = {};
  for (const f of list) {
    if (!f.boss || f.partial) continue;
    for (const p of f.players) if (p.cls && p.cls !== 'Unknown' && p.dps > 0) (per[p.cls] = per[p.cls] || []).push(p.dps);
  }
  const rows = Object.entries(per).map(([cls, a]) => ({ cls, n: a.length, med: median(a), avg: a.reduce((x, y) => x + y, 0) / a.length })).sort((a, b) => b.med - a.med);
  if (!rows.length) return '<div class="card emptyBox">Пока мало данных: нужны бои с боссами в группе.</div>';
  const max = rows[0].med || 1;
  return `<div class="card field"><span class="lbl">Медианный DPS по классам в боях с боссами (все игроки из ваших боёв)</span>
    ${rows.map(r => `<div class="cbar"><span>${classIcon(r.cls)} ${esc(CLASS_RU[r.cls] || r.cls)}</span><span class="b"><i style="width:${(r.med / max * 100).toFixed(1)}%;background:rgb(${CLASS_COLOR[r.cls] || CLASS_COLOR.Unknown})"></i></span><b class="num" style="text-align:right">${fmt(r.med)}</b><span class="muted num" style="font-size:12px">n = ${r.n}</span></div>`).join('')}
    <div class="muted" style="font-size:12px">Медиана меньше зависит от случайных выбросов, чем среднее. n — сколько раз класс встречался в ваших боях; при малом n цифры неточные.</div></div>`;
}

// ---------------------------------------------------------------- график боя
// DPS по секундам (сглажено за 5 с): группа — заливка, свой — линия; HP босса — пунктир по правой шкале, фазы 75/50/25 %.
const smooth = (a, w = 5) => a.map((_, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - w + 1); j <= i; j++) { s += a[j] || 0; n++; } return s / n; });
const niceMax = v => { const p = Math.pow(10, Math.floor(Math.log10(v || 1))); for (const k of [1, 1.2, 1.6, 2, 2.4, 3.2, 4, 6, 8, 10]) if (k * p >= v) return k * p; return 10 * p; };
function chartSvg(series, opts = {}) {
  // series: [{ data, color, fill?, width?, dash?, label }], opts.boss — HP ×1000 по секундам
  const W = 760, H = opts.h || 230, PL = 52, PR = opts.boss ? 44 : 14, PT = 14, PB = 28;
  const n = Math.max(2, ...series.map(x => x.data.length), opts.boss ? opts.boss.length : 0);
  const max = niceMax(Math.max(1, ...series.flatMap(x => x.data)));
  const X = i => PL + (i / (n - 1)) * (W - PL - PR), Y = v => PT + (1 - v / max) * (H - PT - PB);
  const line = d => d.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('');
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = max * k / 4, y = Y(v); g += `<line x1="${PL}" x2="${W - PR}" y1="${y}" y2="${y}" class="gl"/><text x="${PL - 8}" y="${y + 4}" class="ax" text-anchor="end">${fmt(v)}</text>`; }
  const step = [10, 15, 30, 60, 120, 300, 600].find(s => n / s <= 8) || 900;
  for (let t = 0; t < n; t += step) g += `<text x="${X(t)}" y="${H - 8}" class="ax" text-anchor="middle">${clock(t * 1000)}</text>`;
  if (opts.boss) {
    const B = v => PT + (1 - v / 1000) * (H - PT - PB);
    for (const p of [100, 50, 0]) g += `<text x="${W - PR + 8}" y="${B(p * 10) + 4}" class="ax">${p}%</text>`;
    for (const th of [75, 50, 25]) {
      const i = opts.boss.findIndex(v => v <= th * 10);
      if (i > 0) g += `<line x1="${X(i)}" x2="${X(i)}" y1="${PT}" y2="${H - PB}" class="ph"/><text x="${X(i) + 4}" y="${PT + 11}" class="phl">${th}%</text>`;
    }
  }
  let body = '';
  for (const [a, b] of opts.gaps || []) body += `<rect x="${X(a).toFixed(1)}" y="${PT}" width="${Math.max(1, X(b) - X(a)).toFixed(1)}" height="${H - PT - PB}" class="gap"/>`;
  for (const sr of series) {
    if (!sr.data.length) continue;
    if (sr.fill) body += `<path d="${line(sr.data)}L${X(sr.data.length - 1)} ${H - PB}L${X(0)} ${H - PB}Z" fill="${sr.fill}"/>`;
    body += `<path d="${line(sr.data)}" fill="none" stroke="${sr.color}" stroke-width="${sr.width || 2}" stroke-linejoin="round"${sr.dash ? ` stroke-dasharray="${sr.dash}"` : ''}/>`;
  }
  if (opts.boss) { const B = v => PT + (1 - v / 1000) * (H - PT - PB); body += `<path d="${opts.boss.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + B(v).toFixed(1)).join('')}" fill="none" stroke="#ff7a7a" stroke-width="1.6" stroke-dasharray="5 4"/>`; }
  const legend = [...series.filter(x => x.data.length)[opts.revLegend ? 'reverse' : 'slice'](), ...(opts.boss ? [{ color: '#ff7a7a', label: 'HP босса', dash: 1 }] : [])]
    .map(x => `<span><i style="background:${x.color}${x.dash ? ';height:2px' : ''}"></i>${esc(x.label)}</span>`).join('');
  const data = esc(JSON.stringify({ n, series: series.map(x => ({ l: x.label, c: x.color, d: x.data.map(Math.round) })), boss: opts.boss || null }));
  return `<div class="chart" data-chart="${data}" data-pl="${PL}" data-pr="${PR}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="aspect-ratio:${W}/${H}">${g}${body}<line class="cur" x1="0" x2="0" y1="${PT}" y2="${H - PB}" style="display:none"/></svg><div class="tip" style="display:none"></div></div><div class="legend">${legend}</div>`;
}
// простои: серии секунд без вашего урона (>= 3 с) между первым и последним ударом
function idleOf(tl) {
  const a = tl && tl.self;
  if (!a || a.length < 5) return null;
  let first = a.findIndex(v => v > 0), last = a.length - 1;
  while (last > 0 && !(a[last] > 0)) last--;
  if (first < 0 || last - first < 4) return null;
  const gaps = [];
  for (let i = first; i <= last;) {
    if (a[i] > 0) { i++; continue; }
    let j = i; while (j <= last && !(a[j] > 0)) j++;
    if (j - i >= 3) gaps.push([i, j]);
    i = j;
  }
  const span = last - first + 1, idle = gaps.reduce((t, g) => t + g[1] - g[0], 0);
  const longest = gaps.reduce((m, g) => (!m || g[1] - g[0] > m[1] - m[0] ? g : m), null);
  return { span, idle, pct: Math.round(idle / span * 100), gaps, longest };
}
function fightChart(f) {
  const tl = f.timeline;
  if (!tl || !((tl.party && tl.party.length > 2) || (tl.self && tl.self.length > 2))) return '';
  const idle = idleOf(tl);
  const series = [];
  if (tl.party?.length) series.push({ data: smooth(tl.party), color: 'rgba(170,150,255,.9)', fill: 'rgba(150,120,255,.16)', width: 1.5, label: 'Группа' });
  if (tl.self?.length) series.push({ data: smooth(tl.self), color: 'var(--accent)', width: 2.4, label: 'Вы' });
  return `<div class="card field"><span class="lbl">График боя · DPS по секундам</span>${idleStat(idle)}${chartSvg(series, { boss: tl.boss && tl.boss.length > 2 ? tl.boss : null, gaps: idle ? idle.gaps : null })}
    <div class="muted" style="font-size:12px">Сглажено за 5 секунд. Пунктир — HP босса, вертикальные линии — фазы 75 / 50 / 25 %.${idle && idle.gaps.length ? ' Затемнённые участки — паузы в вашем уроне от 3 секунд (они бывают и из-за механик босса).' : ''}</div></div>`;
}
// медиана DPS класса на этом боссе по всем записанным боям (без текущего); нужно не меньше 5 игроков
function classLine(f) {
  const me = meOf(f);
  if (!me || !f.boss || f.partial || !me.cls || me.cls === 'Unknown') return '';
  const v = [];
  for (const x of F.list) if (x.id !== f.id && x.boss === f.boss && !x.partial) for (const p of x.players || []) if (p.cls === me.cls && p.dps > 0) v.push(p.dps);
  if (v.length < 5) return '';
  const med = median(v), d = Math.round((me.dps / med - 1) * 100);
  return `<div class="muted">Ваш DPS ${d >= 0 ? 'выше' : 'ниже'} медианы класса «${esc(CLASS_RU[me.cls] || '')}» на ${Math.abs(d)}% · медиана ${fmt(med)} (по ${v.length} игрокам из ваших записанных боёв с этим боссом)</div>`;
}
function idleStat(i) {
  if (!i) return '';
  return `<div class="dchips"><div><span>Простой (без вашего урона)</span><b class="num ${i.pct >= 25 ? 'bad' : ''}">${i.pct}%</b><small>${i.idle} из ${i.span} с</small></div>
    <div><span>Самая долгая пауза</span><b class="num">${i.longest ? (i.longest[1] - i.longest[0]) + ' с' : '—'}</b><small>${i.longest ? 'на ' + clock(i.longest[0] * 1000) : 'пауз от 3 с нет'}</small></div>
    <div><span>Пауз от 3 секунд</span><b class="num">${i.gaps.length}</b></div></div>`;
}
function pingStat(p) {
  if (!p || !(p.n > 0)) return '';
  return ` · пинг ${Math.round(p.avg)} мс (${Math.round(p.min)}–${Math.round(p.max)})`;
}
// подсказка при наведении на график
function bindCharts(root) {
  root.querySelectorAll('[data-chart]').forEach(el => {
    const d = JSON.parse(el.dataset.chart), svg = el.querySelector('svg'), tip = el.querySelector('.tip'), cur = el.querySelector('.cur');
    const PL = +el.dataset.pl, PR = +el.dataset.pr;
    el.onmousemove = e => {
      const r = svg.getBoundingClientRect(), xs = (e.clientX - r.left) / r.width * 760;
      const i = Math.round((xs - PL) / (760 - PL - PR) * (d.n - 1));
      if (i < 0 || i >= d.n) { tip.style.display = 'none'; cur.style.display = 'none'; return; }
      const x = PL + i / (d.n - 1) * (760 - PL - PR);
      cur.setAttribute('x1', x); cur.setAttribute('x2', x); cur.style.display = '';
      tip.innerHTML = `<b>${clock(i * 1000)}</b>` + d.series.map(s => `<div><i style="background:${s.c}"></i>${esc(T(s.l))}: <b class="num">${fmt(s.d[i] ?? 0)}</b></div>`).join('') + (d.boss && d.boss[i] != null ? `<div><i style="background:#ff7a7a"></i>${esc(T('HP босса'))}: <b class="num">${(d.boss[i] / 10).toFixed(1).replace('.', getLang() === 'en' ? '.' : ',')}%</b></div>` : '');
      tip.style.display = '';
      const left = e.clientX - el.getBoundingClientRect().left;
      tip.style.left = Math.min(left + 14, el.clientWidth - tip.offsetWidth - 4) + 'px';
    };
    el.onmouseleave = () => { tip.style.display = 'none'; cur.style.display = 'none'; };
  });
}
const T = s => (typeof tr === 'function' ? tr(s, S?.lang) : s);

// ---------------------------------------------------------------- сравнение боёв
const C = { a: null, b: null };
const DEC = () => (getLang() === 'en' ? '.' : ',');
const pct = (a, b) => (b ? (a - b) / b * 100 : 0);
function delta(a, b, lowerBetter, f = fmt) {
  if (a == null || b == null || !b) return '';
  const d = pct(a, b), good = lowerBetter ? d < 0 : d > 0;
  if (Math.abs(d) < 0.5) return '<span class="dl">≈</span>';
  return `<span class="dl ${good ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1).replace('.', DEC())}%</span>`;
}
function compareBody() {
  const mine = F.list.filter(f => f.boss && meOf(f));
  const bosses = {};
  for (const f of mine) (bosses[f.boss] = bosses[f.boss] || []).push(f);
  const eligible = mine.filter(f => bosses[f.boss].length > 1);
  if (!eligible.length) return '<div class="card emptyBox">Для сравнения нужно хотя бы два ваших боя с одним и тем же боссом.</div>';
  let A = eligible.find(f => f.id === C.a) || eligible[0];
  const same = bosses[A.boss].filter(f => f.id !== A.id);
  let B = same.find(f => f.id === C.b) || same.reduce((x, f) => (!x || meOf(f).dps > meOf(x).dps ? f : x), null);
  C.a = A.id; C.b = B.id;
  const ma = meOf(A), mb = meOf(B);
  const place = f => { const m = meOf(f); return m ? f.players.indexOf(m) + 1 : null; };
  const label = f => `${dt(f.at)} · ${clock(f.combatMs)} · ${fmt(meOf(f).dps)} DPS · ${RES[f.result] || f.result}`;
  const optA = eligible.map(f => `<option value="${esc(f.id)}" ${f.id === A.id ? 'selected' : ''}>${esc(f.boss)} — ${esc(label(f))}</option>`).join('');
  const optB = same.map(f => `<option value="${esc(f.id)}" ${f.id === B.id ? 'selected' : ''}>${esc(label(f))}</option>`).join('');
  const rows = [
    ['Итог', `<span class="res ${A.result}">${RES[A.result] || A.result}</span>`, `<span class="res ${B.result}">${RES[B.result] || B.result}</span>`, ''],
    ['Время боя', clock(A.combatMs), clock(B.combatMs), delta(A.combatMs, B.combatMs, true)],
    ['Ваш DPS', `<b>${fmt(ma.dps)}</b>`, `<b>${fmt(mb.dps)}</b>`, delta(ma.dps, mb.dps)],
    ['Ваш урон', fmt(ma.dmg), fmt(mb.dmg), delta(ma.dmg, mb.dmg)],
    ['Доля урона', (ma.share * 100).toFixed(1).replace('.', DEC()) + '%', (mb.share * 100).toFixed(1).replace('.', DEC()) + '%', delta(ma.share, mb.share)],
    ['Место', `${place(A)} из ${A.players.length}`, `${place(B)} из ${B.players.length}`, ''],
    ['Крит', ma.crit != null ? Math.round(ma.crit * 100) + '%' : '—', mb.crit != null ? Math.round(mb.crit * 100) + '%' : '—', delta(ma.crit, mb.crit)],
    ['Макс. удар', fmt(ma.maxHit), fmt(mb.maxHit), delta(ma.maxHit, mb.maxHit)],
    ['DPS группы', fmt(A.partyDps), fmt(B.partyDps), delta(A.partyDps, B.partyDps)],
  ];
  // навыки: урон в секунду боя
  const sk = f => { const m = {}; const sec = Math.max(1, f.combatMs / 1000); for (const k of (f.details || [])[0]?.skills || []) m[k.name] = { dps: k.dmg / sec, dmg: k.dmg, hits: k.hits, crit: k.crit }; return m; };
  const sa = sk(A), sb = sk(B);
  const names = [...new Set([...Object.keys(sa), ...Object.keys(sb)])].sort((x, y) => Math.max(sa[y]?.dps || 0, sb[y]?.dps || 0) - Math.max(sa[x]?.dps || 0, sb[x]?.dps || 0)).slice(0, 25);
  const top = Math.max(1, ...names.map(n => Math.max(sa[n]?.dps || 0, sb[n]?.dps || 0)));
  const lost = names.map(n => ({ n, d: (sa[n]?.dps || 0) - (sb[n]?.dps || 0) })).filter(x => x.d < 0).sort((x, y) => x.d - y.d).slice(0, 3);
  const chart = A.timeline?.self?.length > 2 && B.timeline?.self?.length > 2
    ? `<div class="card field"><span class="lbl">Ваш DPS по секундам</span>${chartSvg([{ data: smooth(B.timeline.self), color: '#7fb6ff', width: 2, label: 'Бой Б' }, { data: smooth(A.timeline.self), color: 'var(--accent)', width: 2.4, label: 'Бой А' }], { h: 200, revLegend: true })}</div>` : '';
  return `<div class="card field"><div class="cmpsel">
      <label class="field"><span class="lbl"><i class="ba">А</i> Бой</span><select id="cA">${optA}</select></label>
      <label class="field"><span class="lbl"><i class="bb">Б</i> С чем сравнить (тот же босс)</span><select id="cB">${optB}</select></label></div>
      <div style="font-size:20px;font-weight:700">${nt(A.boss)}</div>
      <div class="scroll"><table class="ft cmp"><tr><th></th><th class="r"><i class="ba">А</i> ${dt(A.at)}</th><th class="r"><i class="bb">Б</i> ${dt(B.at)}</th><th class="r">Разница</th></tr>
      ${rows.map(([k, a, b, d]) => `<tr><td class="muted">${k}</td><td class="r num">${a}</td><td class="r num">${b}</td><td class="r num">${d}</td></tr>`).join('')}</table></div>
      ${lost.length ? `<div class="note">Больше всего урона в секунду потеряно на: ${lost.map(x => `<b data-notr>${esc(x.n)}</b> (${fmt(-x.d)} DPS)`).join(', ')}</div>` : ''}</div>
    ${chart}
    ${names.length ? `<div class="card field"><span class="lbl">Навыки: урон в секунду боя</span><div class="scroll"><table class="ft cmp"><tr><th>Навык</th><th style="width:34%"></th><th class="r"><i class="ba">А</i></th><th class="r"><i class="bb">Б</i></th><th class="r">Разница</th></tr>
      ${names.map(n => { const a = sa[n]?.dps || 0, b = sb[n]?.dps || 0; return `<tr><td data-notr>${esc(n)}</td><td><div class="duo"><i class="a" style="width:${(a / top * 100).toFixed(1)}%"></i><i class="b" style="width:${(b / top * 100).toFixed(1)}%"></i></div></td><td class="r num">${a ? fmt(a) : '—'}</td><td class="r num">${b ? fmt(b) : '—'}</td><td class="r num">${a && b ? delta(a, b) : !a ? '<span class="dl down">нет в А</span>' : '<span class="dl up">нет в Б</span>'}</td></tr>`; }).join('')}</table></div>
      <div class="muted" style="font-size:12px">Урон навыка, делённый на длительность боя, — так бои разной длины сравниваются честно.</div></div>` : ''}`;
}

// ---------------------------------------------------------------- разбор смерти
const D = { list: null, open: null };
function deathsBody() {
  if (!D.list) return '<div class="card emptyBox">Загрузка…</div>';
  if (!D.list.length) return `<div class="card emptyBox">${eventIcon({ icon: 'skull' }, 34)}<div>Смертей пока не было — так держать!</div><div style="font-size:12px">Когда персонаж погибнет, здесь появится, кто и чем ударил за последние 12 секунд.</div></div>`;
  const d = D.list.find(x => x.id === D.open);
  if (!d) {
    return `<div class="card scroll"><table class="ft"><tr><th>Когда</th><th>Где</th><th>Добивающий удар</th><th class="r">Урон за 12 с</th></tr>
      ${D.list.map(x => { const k = killerOf(x), taken = x.hits.filter(h => !h.heal).reduce((a, h) => a + h.amt, 0);
        return `<tr class="click" data-death="${esc(x.id)}"><td>${dt(x.at)}</td><td>${nt(x.boss || x.zone || '—')}</td><td>${k ? `${nt(k.src)} · <span data-notr>${esc(k.skill)}</span>` : '—'}</td><td class="r num">${fmt(taken)}</td></tr>`; }).join('')}</table></div>
      <div class="row"><button type="button" id="dClear">Очистить</button></div>`;
  }
  const hits = [...d.hits].sort((a, b) => b.ms - a.ms);
  const dmg = hits.filter(h => !h.heal), heal = hits.filter(h => h.heal);
  const taken = dmg.reduce((a, h) => a + h.amt, 0), healed = heal.reduce((a, h) => a + h.amt, 0);
  const k = killerOf(d), big = dmg.reduce((a, h) => (!a || h.amt > a.amt ? h : a), null);
  const bySrc = {};
  for (const h of dmg) bySrc[h.src] = (bySrc[h.src] || 0) + h.amt;
  const srcTop = Object.entries(bySrc).sort((a, b) => b[1] - a[1]).slice(0, 4);
  // полоса времени: −12 с … 0
  const W = 760, H = 86, X = ms => 16 + (1 - Math.min(12000, ms) / 12000) * (W - 32);
  const maxA = Math.max(1, ...hits.map(h => h.amt));
  const dots = hits.map(h => { const r = 4 + Math.sqrt(h.amt / maxA) * 12; return `<circle cx="${X(h.ms).toFixed(1)}" cy="${h.heal ? 64 : 34}" r="${r.toFixed(1)}" class="${h.heal ? 'hl' : h.crit ? 'cr' : 'dm'}"><title>−${(h.ms / 1000).toFixed(1)} с · ${esc(h.src)} · ${esc(h.skill)} · ${fmt(h.amt)}</title></circle>`; }).join('');
  let ticks = '';
  for (let s = 12; s >= 0; s -= 2) ticks += `<text x="${X(s * 1000)}" y="${H - 2}" class="ax" text-anchor="middle">${s ? '−' + s + ' с' : '0 с'}</text>`;
  return `<div class="card field"><div class="row"><button type="button" id="dBack">← Ко всем смертям</button><span style="flex:1"></span><span class="muted">${dt(d.at)}</span></div>
      <div style="font-size:20px;font-weight:700">${nt(d.boss || d.zone || 'Смерть')}</div>
      <div class="dchips">
        <div><span>Получено урона за 12 с</span><b class="num bad">${fmt(taken)}</b></div>
        <div><span>Лечение за 12 с</span><b class="num good">${fmt(healed)}</b></div>
        <div><span>Добивающий удар</span><b class="num bad">${k ? fmt(k.amt) : '—'}</b><small>${k ? `<span data-notr>${esc(k.skill)}</span> · ${nt(k.src)}` : ''}</small></div>
        ${d.ping && d.ping.at > 0 ? `<div><span>Пинг в момент смерти</span><b class="num ${d.ping.at >= 150 ? 'bad' : ''}">${Math.round(d.ping.at)} мс</b><small>${d.ping.max > 0 ? 'максимум рядом: ' + Math.round(d.ping.max) + ' мс' : ''}</small></div>` : ''}
        <div><span>Самый сильный удар</span><b class="num bad">${big ? fmt(big.amt) : '—'}</b><small>${big ? `<span data-notr>${esc(big.skill)}</span> · ${nt(big.src)}` : ''}</small></div>
      </div>
      <svg class="dtl" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="16" x2="${W - 16}" y1="34" y2="34" class="gl"/><line x1="16" x2="${W - 16}" y1="64" y2="64" class="gl"/>${dots}${ticks}</svg>
      <div class="legend"><span><i style="background:#ff8a7a"></i>Удар</span><span><i style="background:#ffc66b"></i>Критический удар</span><span><i style="background:#7fe0a8"></i>Лечение</span></div>
      ${srcTop.length ? `<div class="note">Больше всего урона: ${srcTop.map(([n, v]) => `<b data-notr>${esc(n)}</b> — ${fmt(v)} (${Math.round(v / taken * 100)}%)`).join(', ')}</div>` : ''}</div>
    <div class="card field"><span class="lbl">Удары по порядку</span><div class="scroll"><table class="ft"><tr><th class="r">До смерти</th><th>Кто</th><th>Навык</th><th class="r">Урон / лечение</th></tr>
      ${hits.map(h => `<tr><td class="r num muted">−${(h.ms / 1000).toFixed(1).replace('.', DEC())} с</td><td>${nt(h.src)}</td><td data-notr>${esc(h.skill)}</td><td class="r num ${h.heal ? 'good' : 'bad'}">${h.heal ? '+' : '−'}${fmt(h.amt)}${h.crit ? ' <span class="crit">крит</span>' : ''}</td></tr>`).join('')}</table></div></div>`;
}
const killerOf = d => (d.hits || []).filter(h => !h.heal).sort((a, b) => a.ms - b.ms)[0];

// ---------------------------------------------------------------- «Что нового»
let WN = null;
function whatsNewModal() {
  if (!WN || !WN.list?.length) return '';
  const items = WN.list.flatMap(v => v.items);
  return `<div class="wn-back" id="wnBack"><div class="wn" role="dialog" aria-modal="true" aria-labelledby="wnT">
    <div class="wn-h"><img src="../assets/icon.png" width="56" height="56" alt=""><div><span class="lbl">Обновление установлено</span><h2 id="wnT"><span>Что нового в версии</span> <span data-notr>${esc(WN.version)}</span></h2></div></div>
    <div class="wn-l">${items.map(([ic, t, d], i) => `<div class="wn-i" style="--i:${i}"><span class="wn-ic">${eventIcon({ icon: ic }, 20)}</span><div><b>${esc(t)}</b><span>${esc(d)}</span></div></div>`).join('')}</div>
    <div class="row" style="justify-content:center"><button type="button" class="primary" id="wnOk">Отлично</button></div>
  </div></div>`;
}

// ---------------------------------------------------------------- персонажи
const ARMORY_REGIONS = [['eu', 'Европа'], ['nae', 'Северная Америка — Восток'], ['naw', 'Северная Америка — Запад'], ['la', 'Южная Америка'], ['as', 'Азия']];
const R = { region: '', servers: null, serverId: '', name: '', list: null, busy: false, error: '', info: null, autoDone: false };
const PC_CLASS = ['Gladiator', 'Templar', 'Ranger', 'Assassin', 'Elementalist', 'Sorcerer', 'Cleric', 'Chanter'];
const NAME_CLASS = { gladiator: 'Gladiator', templar: 'Templar', ranger: 'Ranger', assassin: 'Assassin', spiritmaster: 'Elementalist', elementalist: 'Elementalist', sorcerer: 'Sorcerer', cleric: 'Cleric', chanter: 'Chanter', brawler: 'Brawler' };
const clsOf = (pcId, name) => NAME_CLASS[String(name || '').toLowerCase()] || (pcId >= 5 && PC_CLASS[Math.floor((pcId - 5) / 4)]) || 'Unknown';
const regionDefault = () => ({ EU: 'eu', NAE: 'nae', NAW: 'naw', LA: 'la', AS: 'as', JP: 'as' }[S.region] || 'eu');

async function loadServers() {
  if (!R.region) R.region = regionDefault();
  const region = R.region;
  const r = await api.armory('servers', { region });
  if (region !== R.region) return;
  R.servers = r.ok ? r.servers : [];
  if (!R.serverId) {
    const mine = R.servers.find(x => [x.ru, x.en].includes(S.detectedServer) || [x.ru, x.en].includes(S.server));
    if (mine) R.serverId = String(mine.id);
  }
  if (page === 'chars') render();
  // свой персонаж — сразу при первом открытии
  if (!R.autoDone && S.character) {
    R.autoDone = true;
    const res = await search(S.character);
    const me = res.ok && res.list.filter(c => c.name.toLowerCase() === S.character.toLowerCase());
    if (me && me.length === 1) openChar(me[0]);
  }
}
async function search(name) {
  R.name = name; R.busy = true; R.error = ''; R.info = null; render();
  const r = await api.armory('search', { name, serverId: R.serverId || undefined, region: R.region });
  R.busy = false;
  if (r.ok) R.list = r.list; else { R.list = null; R.error = r.error; }
  render();
  return r;
}
async function openChar(c) {
  R.busy = true; R.error = ''; render();
  const r = await api.armory('info', { id: c.id, serverId: c.serverId, region: R.region });
  R.busy = false;
  if (r.ok) R.info = { ...r.info, page: r.page, image: c.image }; else R.error = r.error;
  render();
}
function charsBody() {
  if (R.busy) return '<div class="card emptyBox">Загрузка…</div>';
  if (R.error) return `<div class="card emptyBox">Не получилось: ${esc(R.error)}</div>`;
  if (R.info) {
    const p = R.info.profile || {}, cls = clsOf(p.pcId, p.className);
    const ranks = (R.info.ranking && R.info.ranking.rankingList) || [];
    const kv = (k, v) => v == null || v === '' ? '' : `<div><span>${k}</span><b>${esc(v)}</b></div>`;
    return `<div class="card field"><div class="row"><button type="button" id="back">← К результатам</button><span style="flex:1"></span><a href="#" data-url="${esc(R.info.page)}">Открыть на официальном сайте</a></div>
      <div class="prof"><img class="big" loading="lazy" decoding="async" src="${esc(p.profileImage || R.info.image || '')}" alt="">
        <div style="flex:1;min-width:240px"><div style="font-size:22px;font-weight:700;display:flex;align-items:center;gap:8px">${esc(p.characterName)} ${classIcon(cls)}</div>
        <div class="muted">${esc(CLASS_RU[cls] || p.className || '')} · ${p.characterLevel || '?'} ур. · ${esc(p.serverNameRu || p.serverName || '')} · ${p.raceId === 1 ? 'Элийцы' : p.raceId === 2 ? 'Асмодиане' : ''}</div>
        <div class="kv" style="margin-top:10px">${kv('Боевая сила', p.combatPower != null ? Number(p.combatPower).toLocaleString(LOC()) : null)}${kv('Уровень предметов', p.itemLevel)}${kv('Легион', p.guildName || p.legionName)}${kv('Титул', p.titleName)}</div></div></div></div>
      ${ranks.length ? `<div class="card field"><span class="lbl">Места в рейтингах</span><table class="rk"><tr><th>Рейтинг</th><th>Место</th><th>Очки</th><th>Ранг</th></tr>${ranks.map(r => `<tr><td>${esc(r.rankingContentsName || '')}</td><td class="num"><b>${r.rank ?? '—'}</b></td><td class="num">${r.point != null ? Number(r.point).toLocaleString(LOC()) : '—'}</td><td>${esc(r.gradeName || '')}</td></tr>`).join('')}</table></div>` : ''}`;
  }
  if (!R.list) return '<div class="card emptyBox">Выберите регион и сервер, введите ник персонажа и нажмите «Найти».</div>';
  if (!R.list.length) return '<div class="card emptyBox">Никого не нашлось. Проверьте ник, регион и сервер.</div>';
  return `<div class="muted" style="font-size:12px">Найдено: ${R.list.length}</div><div class="chars">${R.list.map((c, i) => {
    const cls = clsOf(c.pcId);
    return `<button type="button" class="ch" data-ch="${i}"><span class="avw"><img class="av" loading="lazy" decoding="async" src="${esc(c.image)}" alt=""></span><span style="min-width:0;flex:1"><b>${esc(c.name)}</b><span class="muted" style="font-size:12px;display:flex;align-items:center;gap:4px">${classIcon(cls)} ${c.level || '?'} ур. · ${esc(c.server || '')}</span></span></button>`;
  }).join('')}</div>`;
}

function render() {
  if (!S) return;
  applyTheme(S, 92);
  nav();
  const m = $('main');
  m.innerHTML = `<div class="page">${(pages[page] || pages.overlay)()}</div>${whatsNewModal()}`;
  bindCharts(m);
  if (WN) { const close = () => { WN = null; api.whatsNewSeen(); const b = $('wnBack'); if (b) { b.classList.add('out'); setTimeout(render, 220); } else render(); }; on2('wnOk', close); }
  enhanceSelects(m);
  paintRanges(m);
  const on = (id, ev, fn) => { const el = $(id); if (el) el[ev] = fn; };
  function on2(id, fn) { const el = $(id); if (el) el.onclick = fn; }
  const slot = $('themeSlot');
  if (slot) { slot.innerHTML = themeButton(S.theme); bindThemeButton(slot, S.theme, k => api.set({ theme: k })); }
  m.querySelectorAll('[data-m]').forEach(b => b.onclick = () => api.set({ mode: b.dataset.m }));
  m.querySelectorAll('[data-url]').forEach(a => a.onclick = e => { e.preventDefault(); api.open('url', a.dataset.url); });
  on('mCount', 'oninput', e => { $('vCount').textContent = e.target.value; });
  on('mCount', 'onchange', e => api.set({ count: +e.target.value }));
  on('mOp', 'oninput', e => { $('vOp').textContent = e.target.value + '%'; });
  on('mOp', 'onchange', e => api.set({ opacity: +e.target.value }));
  on('mSc', 'oninput', e => { $('vSc').textContent = e.target.value + '%'; });
  on('mSc', 'onchange', e => api.set({ scale: +e.target.value }));
  on('showOv', 'onclick', () => api.open('overlay'));
  m.querySelectorAll('[data-hk]').forEach(b => b.onclick = () => { hkWait = b.dataset.hk; hkErr[hkWait] = ''; api.hotkeysPause(true); render(); });
  on('hkReset', 'onclick', () => { hkErr = {}; api.set({ hotkeys: { ...HOTKEY_DEFAULTS } }); });
  on('cHead', 'onchange', e => api.set({ showHeader: e.target.checked }));
  m.querySelectorAll('[data-mcol]').forEach(c => c.onchange = () => api.set({ columns: { [c.dataset.mcol]: c.checked } }));
  on('resetSize', 'onclick', () => api.overlayResetSize());
  on('oSolo', 'onchange', e => api.set({ solo: e.target.checked }));
  on('oAuto', 'onchange', e => api.set({ autoHide: e.target.checked }));
  on('oStart', 'onchange', e => api.set({ autoStart: e.target.checked }));
  on('oQuit', 'onchange', e => api.set({ quitWithGame: e.target.checked }));
  on('oProf', 'onchange', e => api.set({ profilesOn: e.target.checked }));
  on('rpcOn', 'onchange', e => api.set({ discordRpc: e.target.checked }));
  on('fShare', 'onclick', e => api.share(e.currentTarget.dataset.share));
  on('uCheck', 'onclick', async () => { $('uCheck').disabled = true; $('uCheck').textContent = 'Проверяю…'; U = await api.updateCheck(); render(); });
  on('uGo', 'onclick', () => api.updateInstall());
  on('uSkip', 'onclick', () => api.updateSkip(U.version));
  on('ct', 'onclick', () => api.set({ clickThrough: !S.clickThrough }));
  on('restart', 'onclick', () => api.restartBridge());
  on('tt', 'onclick', () => api.testToast());
  on('nSound', 'onchange', e => api.set({ notify: { sound: e.target.checked } }));
  on('nDeath', 'onchange', e => api.set({ deathToast: e.target.checked }));
  on('nLag', 'onchange', e => api.set({ lagAlert: e.target.checked }));
  on('report', 'onclick', async () => { const b = $('report'); b.disabled = true; b.textContent = T('Собираю…'); await api.report(); b.disabled = false; b.textContent = T('Отчёт об ошибке'); });
  const whValid = v => /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(v.trim());
  on('whUrl', 'onchange', e => { const v = e.target.value.trim(); if (!v || whValid(v)) api.set({ webhook: { url: v, on: v ? (S.webhook?.on || true) : false } }); else { WHN = { text: T('Это не ссылка вебхука Discord'), cls: 'bad' }; render(); } });
  on('whOn', 'onchange', e => api.set({ webhook: { on: e.target.checked } }));
  on('whTest', 'onclick', async () => {
    const v = $('whUrl').value.trim();
    if (!whValid(v)) { WHN = { text: T('Это не ссылка вебхука Discord'), cls: 'bad' }; render(); return; }
    WHN = { text: T('Отправляю…'), cls: 'muted' }; render();
    const r = await api.webhookTest(v);
    WHN = r.ok ? { text: T('Готово — сообщение появилось в канале'), cls: 'good' } : { text: r.error, cls: 'bad' };
    if (r.ok) api.set({ webhook: { url: v, on: true } }); else render();
  });
  bindDropList(m, 'ddSnd', (v, b) => { playSound(v, S.notify.volume ?? 50); if (v !== S.notify.soundName || !S.notify.sound) api.set({ notify: { soundName: v, sound: true } }); });
  bindDropList(m, 'ddPos', v => { closeDropList('ddPos'); api.set({ notify: { position: v } }); setTimeout(() => api.testToast(), 350); });
  on('nVol', 'oninput', e => { $('nVolV').textContent = e.target.value + '%'; });
  on('nVol', 'onchange', e => { api.set({ notify: { volume: +e.target.value } }); playSound(S.notify.soundName || 'clear-sky', +e.target.value); });
  bindDropList(m, 'ddSt', v => { closeDropList('ddSt'); api.set({ notify: { style: v } }); setTimeout(() => api.testToast(), 350); });
  m.querySelectorAll('[data-dc]').forEach(b => b.onclick = () => api.open('discord', b.dataset.dc));
  on('addrToggle', 'onclick', () => { showAddr = !showAddr; render(); });
  if (page === 'stats') {
    if (!F.list) api.fights().then(l => { F.list = l || []; if (page === 'stats') render(); });
    m.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { statTab = b.dataset.st; F.open = null; render(); });
    m.querySelectorAll('[data-f]').forEach(r => r.onclick = () => { F.open = r.dataset.f; render(); });
    on('fBack', 'onclick', () => { F.open = null; render(); });
    on('fClear', 'onclick', () => { if (F.clearArmed) { api.fightsClear(); F.clearArmed = false; } else { F.clearArmed = true; $('fClear').textContent = 'Нажмите ещё раз, чтобы удалить'; } });
    if (statTab === 'deaths' && !D.list) api.deaths().then(l => { D.list = l || []; if (page === 'stats') render(); });
    m.querySelectorAll('[data-death]').forEach(r => r.onclick = () => { D.open = r.dataset.death; render(); });
    on('dBack', 'onclick', () => { D.open = null; render(); });
    on('dClear', 'onclick', () => { if (D.clearArmed) { api.deathsClear(); D.clearArmed = false; } else { D.clearArmed = true; $('dClear').textContent = 'Нажмите ещё раз, чтобы удалить'; } });
    on('fCmp', 'onclick', e => { C.a = e.currentTarget.dataset.cmp; C.b = null; statTab = 'compare'; F.open = null; render(); });
    on('cA', 'onchange', e => { C.a = e.target.value; C.b = null; render(); });
    on('cB', 'onchange', e => { C.b = e.target.value; render(); });
  }
  if (page === 'chars') {
    if (!R.servers) loadServers();
    on('rRegion', 'onchange', e => { R.region = e.target.value; R.servers = null; R.serverId = ''; R.list = null; R.info = null; render(); });
    on('rServer', 'onchange', e => { R.serverId = e.target.value; });
    on('rForm', 'onsubmit', e => { e.preventDefault(); const n = $('rName').value.trim(); if (n) search(n); else { R.error = 'введите ник персонажа'; render(); } });
    on('back', 'onclick', () => { R.info = null; render(); });
    m.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => openChar(R.list[+b.dataset.ch]));
    // портрет не загрузился — показываем пустую плашку вместо значка «битой» картинки
    m.querySelectorAll('img.av, img.big').forEach(i => { const off = () => { if (i.classList.contains('big')) i.style.display = 'none'; else i.style.visibility = 'hidden'; }; if (!i.getAttribute('src')) off(); else i.addEventListener('error', off); });
  }
}

api.on('settings', s => { S = s; render(); });
api.on('status', s => { status = s; if (!S) return; if (page === 'connect') render(); else nav(); });
api.on('page', p => {
  if (p === 'stats:death') { page = 'stats'; statTab = 'deaths'; D.list = null; api.deaths().then(l => { D.list = l || []; D.open = D.list[0]?.id || null; render(); }); }
  else page = p;
  render();
});
api.on('deaths', l => { D.list = l; if (page === 'stats' && statTab === 'deaths') render(); });
api.on('hotkey-errors', e => { hkErr = { ...hkErr, ...e }; for (const k of Object.keys(hkErr)) if (!e[k] && hkErr[k] && hkErr[k].startsWith('Сочетание')) hkErr[k] = ''; if (page === 'overlay') render(); });
api.on('fights', l => { F.list = l; if (page === 'stats') render(); });
api.on('update', u => { const was = U?.available; U = u; if (page === 'about' || was !== u.available) render(); });
api.state().then(st => { S = st.settings; status = st.status; version = st.version; U = st.update; rpcAvailable = !!st.rpcAvailable; WN = st.whatsNew || null; render(); });
