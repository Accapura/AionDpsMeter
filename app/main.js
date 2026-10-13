// Aion DPS Meter — счётчик урона для AION 2. Автор: Accapura.
// Главный процесс: окна, настройки, мост чтения трафика (Npcap), расписание и уведомления.
'use strict';

const { app, BrowserWindow, ipcMain, screen, globalShortcut, Tray, Menu, nativeImage, shell, net, clipboard, dialog } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');
const { spawn } = require('child_process');
const zlib = require('zlib');
const readline = require('readline');
const Sched = require('./renderer/schedule-core.js');

app.setAppUserModelId('Accapura.AionDpsMeter');
if (!app.requestSingleInstanceLock()) { app.exit(0); } // вторая копия сразу закрывается, первая покажет уведомление
// Экономим память и процессор на слабых ПК: без лишних служб Chromium и запасного процесса окна.
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService,SpareRendererForSitePerProcess,Translate,AutofillServerCommunication,OptimizationHints');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');

const ROOT = __dirname;
const PKG = require('./package.json');
const APP_VERSION = PKG.version; // версия этой копии программы (у лёгкого обновления — своя)
const SHELL = PKG.shell || '';   // «оболочка»: Electron и модуль чтения, с которыми совместимо лёгкое обновление
const ASSETS = path.join(ROOT, 'assets');
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');

// ---------------------------------------------------------------- настройки
const DEFAULTS = {
  theme: 'amethyst',
  opacity: 85,
  scale: 100,
  count: 10,
  mode: 'boss',                 // boss = Данж: Босс · world = Мир: Босс · mob = Моб
  overlay: { x: null, y: null, width: null, height: null, visible: true },
  compact: false,
  showHeader: true,             // строка с названиями колонок в оверлее
  hotkeys: { overlay: 'Ctrl+Shift+D', lock: 'Ctrl+Shift+L', reset: 'Ctrl+Shift+R', share: 'Ctrl+Shift+C', chat: 'Ctrl+Shift+T', streamer: 'Ctrl+Shift+H', modeBoss: 'Ctrl+Shift+1', modeWorld: 'Ctrl+Shift+2', modeMob: 'Ctrl+Shift+3', modeNext: 'Ctrl+Shift+M' }, // меняются в «Оверлей»
  clickThrough: false,
  autoStart: false,             // запускать вместе с Windows (свёрнутой в трей)
  quitWithGame: false,          // закрываться вместе с игрой
  autoHide: true,               // прятать оверлей, когда игра не на экране
  solo: false,                  // режим «Только я»
  profilesOn: true,             // свои настройки оверлея для каждого режима
  profiles: {},                 // { boss|world|mob: { count, opacity, columns, showHeader, solo, compact, size } }
  discordRpc: true,             // статус в Discord
  updateSkip: '',               // версия, о которой больше не напоминать
  lang: 'ru',                   // язык интерфейса: ru | en
  notify: { m15: true, m5: true, m1: false, sound: true, soundName: 'clear-sky', volume: 50, position: 'br', style: 'glass' }, // position: tl tc tr bl bc br; style: glass solid accent minimal banner
  events: [],
  character: '',               // ник персонажа — приходит из игры
  characterClass: '',
  region: 'EU',                 // регион: время осад и т. п. по местным часам региона
  serverAuto: true,             // сервер берём из игры
  server: '',                   // сервер, выбранный вручную (название)
  serverId: 0,                  // он же — номер (названия повторяются в разных регионах)
  detectedServerId: 0,
  timeMode: 'server',           // расписание по времени сервера или по своему
  detectedServer: '',           // сервер, на котором игра видела персонажа
  feedUrl: 'https://raw.githubusercontent.com/Accapura/AionDpsMeter/main/schedule-feed.json',
  bells: {},                    // включённые/выключенные напоминания ивентов из расписания
  columns: { crit: false, hits: false, maxHit: false, hps: false, gs: false, cp: false }, // доп. колонки оверлея
  seenFeedIds: [],
  whatsNewSeen: '',             // версия, для которой уже показали «Что нового»
  whatsNewFrom: '',             // с какой версии обновлялись (для списка изменений)
  deathToast: true,             // уведомление с разбором смерти
  lagAlert: true,               // предупреждение о скачке пинга
  phaseToast: true,             // уведомление на 75 / 50 / 25 % HP босса
  checklist: null,              // свой список дел (null — стандартный), см. renderer: страница «Дела»
  streamer: false,              // режим стримера: ники заменяются на «Игрок NN»
  pbToast: true,                // уведомление о новом рекорде после боя
  webhook: { url: '', on: false }, // отправка итога боя в Discord-канал
  winBounds: {},                // место и размер окон (главное, расписание, разбивка), как их оставил пользователь
};

const clone = o => JSON.parse(JSON.stringify(o));
function merge(a, b) {
  for (const k of Object.keys(b || {})) {
    const v = b[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], v);
    else a[k] = v;
  }
  return a;
}
const firstRun = !fs.existsSync(SETTINGS_FILE());
let settings;
try { settings = merge(clone(DEFAULTS), JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8'))); } catch { settings = clone(DEFAULTS); }
// Язык, выбранный при установке, — только для самого первого запуска (потом его меняют в «Настройках»).
const langArg = process.argv.find(a => a.startsWith('--lang='));
if (langArg && firstRun && ['ru', 'en'].includes(langArg.slice(7))) settings.lang = langArg.slice(7);

let saveTimer = null;
function saveNow() {
  clearTimeout(saveTimer); saveTimer = null;
  try { fs.mkdirSync(path.dirname(SETTINGS_FILE()), { recursive: true }); fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(settings, null, 2)); } catch { /* не критично */ }
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}
// Место окна — только если оно видно хотя бы на одном экране (монитор могли отключить или сменить разрешение).
function onScreen(r) {
  return r && r.x != null && r.y != null && screen.getAllDisplays().some(d => { const a = d.workArea; return r.x + 60 > a.x && r.x < a.x + a.width - 60 && r.y >= a.y - 10 && r.y < a.y + a.height - 40; });
}
// Профили оверлея: у «Данж: Босс», «Мир: Босс» и «Моб» свои список, прозрачность, колонки и размер.
const PROFILE_KEYS = ['count', 'opacity', 'columns', 'showHeader', 'solo', 'compact'];
function profileOf() {
  const p = {};
  for (const k of PROFILE_KEYS) p[k] = clone(settings[k]);
  const ow = settings.overlay;
  if (ow.width && ow.height) p.size = { width: ow.width, height: ow.height };
  if (ow.x != null && ow.y != null) p.pos = { x: ow.x, y: ow.y }; // и место оверлея на экране
  return p;
}
function applyProfile(mode) {
  const p = settings.profiles[mode];
  if (!p) return;
  for (const k of PROFILE_KEYS) if (p[k] !== undefined) settings[k] = clone(p[k]);
  const w = wins.overlay;
  if ((p.size || p.pos) && w && !w.isDestroyed()) {
    const b = w.getBounds();
    const nb = { x: b.x, y: b.y, width: p.size?.width || b.width, height: p.size?.height || b.height };
    // место — только если оно на одном из экранов (монитор могли отключить)
    if (p.pos && onScreen(p.pos)) { nb.x = p.pos.x; nb.y = p.pos.y; }
    w.setBounds(nb);
    settings.overlay = { ...settings.overlay, ...nb };
  }
}
function patchSettings(patch) {
  const prevMode = settings.mode, prevScale = settings.scale;
  if (settings.profilesOn && patch.mode && patch.mode !== prevMode) settings.profiles[prevMode] = profileOf();
  merge(settings, patch);
  if (settings.profilesOn) {
    if (settings.mode !== prevMode) applyProfile(settings.mode);
    else if (PROFILE_KEYS.some(k => k in patch)) settings.profiles[settings.mode] = profileOf();
  }
  if (Array.isArray(patch.events)) settings.events = patch.events;
  if (Array.isArray(patch.checklist)) settings.checklist = patch.checklist;
  save();
  broadcast('settings', settings);
  if (settings.mode !== prevMode) bridge.setMode(settings.mode);
  if (settings.scale !== prevScale) for (const w of Object.values(wins)) if (w && !w.isDestroyed()) w.webContents.setZoomFactor(settings.scale / 100);
  if ('clickThrough' in patch) applyClickThrough();
  if ('autoHide' in patch) applyOverlayVisibility();
  if ('autoStart' in patch) { try { app.setLoginItemSettings({ openAtLogin: !!settings.autoStart, args: ['--hidden'] }); } catch { /* не критично */ } }
  if ('discordRpc' in patch) rpc.update();
  if ('lang' in patch) { bridge.send('lang ' + settings.lang); buildTray(); broadcastSchedule(); }
  if (patch.hotkeys) registerHotkeys();
  if (['server', 'serverId', 'serverAuto', 'region', 'events', 'bells', 'timeMode'].some(k => k in patch)) broadcastSchedule();
}

// ---------------------------------------------------------------- окна
const wins = {};
function broadcast(ch, data) { for (const w of Object.values(wins)) if (w && !w.isDestroyed()) w.webContents.send(ch, data); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const REMEMBER = ['main', 'schedule', 'breakdown']; // окна, чьи место и размер запоминаются
function makeWindow(name, opts, file) {
  const old = wins[name];
  if (old && !old.isDestroyed()) { if (!opts.showInactive) { old.show(); old.focus(); } return old; }
  const mem = REMEMBER.includes(name) && settings.winBounds?.[name];
  if (mem && mem.width && mem.height) {
    opts = { ...opts, width: Math.max(opts.minWidth || 0, mem.width), height: Math.max(opts.minHeight || 0, mem.height) };
    if (onScreen(mem)) { opts.x = mem.x; opts.y = mem.y; delete opts.center; }
  }
  const w = new BrowserWindow({
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    show: false,
    icon: path.join(ASSETS, 'icon.png'),
    webPreferences: { preload: path.join(ROOT, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: false, autoplayPolicy: 'no-user-gesture-required' },
    ...opts,
  });
  w.loadFile(path.join(ROOT, 'renderer', file));
  w.webContents.on('did-finish-load', () => w.webContents.setZoomFactor(settings.scale / 100));
  w.once('ready-to-show', () => (opts.showInactive ? w.showInactive() : w.show()));
  w.on('closed', () => { delete wins[name]; });
  if (REMEMBER.includes(name)) {
    let t = null;
    const remember = () => { clearTimeout(t); t = setTimeout(() => {
      if (w.isDestroyed() || w.isMaximized() || w.isMinimized() || w.isFullScreen()) return;
      settings.winBounds = { ...(settings.winBounds || {}), [name]: w.getBounds() };
      save();
    }, 400); };
    w.on('move', remember); w.on('resize', remember);
    w.__keep = () => { if (!w.isDestroyed() && !w.isMaximized() && !w.isMinimized()) settings.winBounds = { ...(settings.winBounds || {}), [name]: w.getBounds() }; save(); };
    w.on('close', w.__keep);
  }
  w.on('maximize', () => w.webContents.send('maxed', true));
  w.on('unmaximize', () => w.webContents.send('maxed', false));
  wins[name] = w;
  return w;
}

// Размер оверлея по умолчанию — от рабочей области экрана, чтобы не закрывать игру ни на 1366×768, ни на 4K.
function overlayBounds() {
  const wa = screen.getPrimaryDisplay().workArea;
  const def = {
    width: Math.round(clamp(wa.width * 0.17, 290, 380)),
    height: Math.round(clamp(wa.height * 0.32, 210, 420)),
  };
  const b = settings.overlay;
  const r = { width: b.width || def.width, height: b.height || def.height, x: b.x, y: b.y };
  // размер не больше экрана, на котором окажется оверлей
  const wa2 = onScreen(r) ? screen.getDisplayMatching({ x: r.x, y: r.y, width: r.width, height: r.height }).workArea : wa;
  r.width = Math.min(r.width, wa2.width); r.height = Math.min(r.height, wa2.height);
  if (!onScreen(r)) { r.x = wa.x + wa.width - r.width - 24; r.y = wa.y + Math.round(wa.height * 0.18); }
  return r;
}

function openOverlay() {
  const b = overlayBounds();
  const w = makeWindow('overlay', {
    ...b, minWidth: 240, minHeight: 150,
    resizable: false, // размер — своей ручкой: прозрачные окна Windows не тянутся за край
    alwaysOnTop: true, skipTaskbar: true, maximizable: false, minimizable: false, fullscreenable: false,
  }, 'overlay.html');
  w.setAlwaysOnTop(true, 'screen-saver');
  w.on('show', () => { w.webContents.send('snap', lastSnap); w.webContents.send('ping', { ms: lastPing, est: lastPingEst, dbg: lastPingDbg }); }); // пока оверлей скрыт, снимки ему не шлём
  // Место и размер оверлея запоминаются сразу после перетаскивания или изменения размера (и своей ручкой тоже).
  let kt = null;
  const keepNow = () => {
    clearTimeout(kt);
    if (w.isDestroyed() || w.isMinimized()) return;
    const r = w.getBounds();
    settings.overlay = { ...settings.overlay, x: r.x, y: r.y, width: r.width, height: r.height };
    if (settings.profilesOn) settings.profiles[settings.mode] = profileOf();
    save();
  };
  const keep = () => { clearTimeout(kt); kt = setTimeout(keepNow, 400); };
  w.on('move', keep); w.on('resize', keep);
  w.on('moved', keepNow); w.on('resized', keepNow);
  w.on('close', keepNow);
  w.__keep = keepNow;
  w.webContents.once('did-finish-load', applyClickThrough);
  return w;
}

function openMain(page) {
  const wa = screen.getPrimaryDisplay().workArea;
  const w = makeWindow('main', {
    width: Math.round(clamp(wa.width * 0.62, 720, 1000)), height: Math.round(clamp(wa.height * 0.78, 480, 680)),
    minWidth: 520, minHeight: 420, center: true,
  }, 'main.html');
  if (page) {
    if (w.webContents.isLoading()) w.webContents.once('did-finish-load', () => w.webContents.send('page', page));
    else w.webContents.send('page', page);
  }
}
function openSchedule() {
  const wa = screen.getPrimaryDisplay().workArea;
  makeWindow('schedule', {
    width: Math.round(clamp(wa.width * 0.55, 680, 900)), height: Math.round(clamp(wa.height * 0.74, 460, 640)),
    minWidth: 620, minHeight: 420, center: true,
  }, 'schedule.html');
}

// Окно разбивки по навыкам выбранного игрока.
function openBreakdown(actor) {
  const wa = screen.getPrimaryDisplay().workArea;
  const w = makeWindow('breakdown', {
    width: Math.round(clamp(wa.width * 0.42, 560, 760)), height: Math.round(clamp(wa.height * 0.66, 440, 640)),
    minWidth: 480, minHeight: 360, center: true, alwaysOnTop: true,
  }, 'breakdown.html');
  w.setAlwaysOnTop(true, 'floating');
  const send = () => w.webContents.send('breakdown-actor', actor);
  if (w.webContents.isLoading()) w.webContents.once('did-finish-load', send); else send();
}

function applyClickThrough() {
  const w = wins.overlay;
  if (!w || w.isDestroyed()) return;
  w.setIgnoreMouseEvents(!!settings.clickThrough, { forward: true });
  w.webContents.send('settings', settings);
}
// Видимость оверлея: включён пользователем и (если включено автоскрытие) игра на экране.
// fgState от моста: game — игра впереди, app — наше окно, other — другое окно, none — игра не запущена.
let fgState = 'none';
// «Закрываться вместе с игрой»: игра была запущена, а теперь её нет дольше 20 секунд (чтобы не закрыться при перезапуске клиента).
let gameSeen = false, exitTimer = null;
function watchGameExit() {
  if (fgState !== 'none') { gameSeen = true; if (exitTimer) { clearTimeout(exitTimer); exitTimer = null; } return; }
  if (!gameSeen || !settings.quitWithGame || exitTimer) return;
  exitTimer = setTimeout(() => { exitTimer = null; if (fgState === 'none' && settings.quitWithGame) app.quit(); }, 20000);
}
function applyOverlayVisibility() {
  const w = wins.overlay;
  if (!w || w.isDestroyed()) return;
  const want = settings.overlay.visible !== false && !(settings.autoHide && fgState === 'other');
  if (want && !w.isVisible()) w.showInactive();
  else if (!want && w.isVisible()) w.hide();
}
function toggleOverlay() {
  settings.overlay.visible = settings.overlay.visible === false;
  save();
  if (!wins.overlay || wins.overlay.isDestroyed()) { if (settings.overlay.visible) openOverlay(); }
  else applyOverlayVisibility();
}

// ---------------------------------------------------------------- мост чтения трафика
const BRIDGE_DIR = () => global.__aionBoot?.bridge || (app.isPackaged ? path.join(process.resourcesPath, 'bridge') : path.join(ROOT, '..', 'bridge-out'));
let lastSnap = null;
// Фазы босса: одно уведомление на каждый порог 75 / 50 / 25 % за бой. Пороги, уже пройденные до того, как мы увидели босса, молчат.
const phase = { boss: '', done: new Set(), min: 1 };
function checkPhases(s) {
  const b = s && s.boss;
  if (!b || !(b.maxHp > 0) || !(b.hp >= 0)) { if (!s) { phase.boss = ''; phase.done = new Set(); } return; }
  const frac = Math.max(0, Math.min(1, b.hp / b.maxHp));
  if (b.name !== phase.boss || frac > phase.min + 0.15) { // новый босс или он восстановил HP — новая попытка
    phase.boss = b.name; phase.done = new Set([75, 50, 25].filter(t => frac * 100 <= t)); phase.min = frac;
    return;
  }
  phase.min = Math.min(phase.min, frac);
  if (settings.phaseToast === false) return;
  for (const t of [75, 50, 25]) {
    if (frac * 100 <= t && !phase.done.has(t)) {
      phase.done.add(t);
      showToast({ key: 'phase' + t, type: 'info', icon: 'info', start: null, name: `${b.name || T('Босс')}: ${t}% HP`, text: `${T('Бой')} ${mmss(s.combatMs)}` });
    }
  }
}
let lastPing = -1; // пинг до игрового сервера, мс (-1 — неизвестен)
let lastPingDbg = null; // сколько навыков увидено и сопоставлено (для подсказки)
let lastPingEst = false; // true — это оценка (до адреса сервера), а не замер по навыкам персонажа
let status = { state: 'starting', msg: 'Запуск…' };
const bossLog = [];
function setStatus(s) { status = { ...status, ...s }; broadcast('status', status); }

const bridge = {
  proc: null,
  start() {
    this.stop();
    if (meterDisabled()) return;
    const dir = BRIDGE_DIR();
    const dll = path.join(dir, 'AionDpsBridge.dll');
    if (!fs.existsSync(dll)) { setStatus({ state: 'error', msg: 'Не найден модуль чтения (AionDpsBridge.dll)' }); return; }
    setStatus({ state: 'starting', msg: 'Запуск чтения трафика…' });
    let errText = '';
    const p = spawn('dotnet', [dll, '--host', String(process.pid)], { cwd: dir, windowsHide: true });
    this.proc = p;
    if (settings.lang === 'en') this.send('lang en');
    p.on('error', e => setStatus({ state: 'no-dotnet', msg: e.code === 'ENOENT' ? 'Нужен .NET 10 Runtime' : 'Модуль чтения: ' + e.message }));
    p.stderr.on('data', d => { errText += d; logLine('bridge: ' + String(d).trim().slice(0, 500)); });
    p.on('exit', code => {
      if (this.proc !== p) return;
      lastPing = -1; lastPingEst = false; lastPingDbg = null; { const ov = wins.overlay; if (ov && !ov.isDestroyed()) ov.webContents.send('ping', { ms: -1, est: false, dbg: null }); }
      this.proc = null;
      if (/install or update \.NET|framework.*not found|Microsoft\.NETCore\.App/i.test(errText)) setStatus({ state: 'no-dotnet', msg: 'Нужен .NET 10 Runtime' });
      else setStatus({ state: 'error', msg: 'Модуль чтения остановился (код ' + code + ')' });
    });
    let lastLine = '';
    readline.createInterface({ input: p.stdout }).on('line', line => {
      if (line === lastLine) return; // мост шлёт снимок 4 раза в секунду — одинаковые не пересылаем
      lastLine = line;
      let m;
      try { m = JSON.parse(line); } catch { return; }
      if (m.t === 'snap') {
        lastSnap = m.empty ? null : m;
        const ov = wins.overlay;
        if (ov && !ov.isDestroyed() && ov.isVisible()) ov.webContents.send('snap', lastSnap);
        rpc.update();
        checkPhases(lastSnap);
        const me = lastSnap?.players?.find(x => x.self);
        if (me && me.name && !me.name.startsWith('#') && me.name !== settings.character) patchSettings({ character: me.name });
        if (me && me.cls && me.cls !== 'Unknown' && me.cls !== settings.characterClass) patchSettings({ characterClass: me.cls });
      }
      else if (m.t === 'self') {
        const patch = {};
        if (m.name && m.name !== settings.character) patch.character = m.name;
        if (m.server && m.server !== settings.detectedServer) patch.detectedServer = m.server;
        if (m.serverId && m.serverId !== settings.detectedServerId) patch.detectedServerId = m.serverId;
        if (Object.keys(patch).length) { patchSettings(patch); broadcastSchedule(); }
      }
      else if (m.t === 'fg') { fgState = m.state; applyOverlayVisibility(); watchGameExit(); }
      else if (m.t === 'fieldbosses') onFieldBosses(m);
      else if (m.t === 'detail') broadcast('detail', m);
      else if (m.t === 'fight') { saveRot(m); addFight(m); }
      else if (m.t === 'death') addDeath(m);
      else if (m.t === 'ping') onPing(m);
      else if (m.t === 'status') { setStatus({ state: m.state, msg: m.msg }); logLine('status: ' + m.state + ' · ' + m.msg); }
      else if (m.t === 'boss') { bossLog.unshift({ ...m, at: Date.now() }); bossLog.length = Math.min(bossLog.length, 40); broadcast('boss-log', bossLog); }
    });
    this.setMode(settings.mode);
  },
  send(cmd) { try { this.proc?.stdin.write(cmd + '\n'); } catch { /* мост уже закрыт */ } },
  setMode(mode) { this.send(mode === 'mob' ? 'mode all' : 'mode boss'); },
  reset() { this.send('reset'); },
  stop() {
    const p = this.proc;
    this.proc = null;
    if (!p) return;
    try { p.stdin.write('quit\n'); } catch { /* ignore */ }
    setTimeout(() => { try { p.kill(); } catch { /* ignore */ } }, 800);
  },
};

// ---------------------------------------------------------------- история боёв (для статистики)
// ---------------------------------------------------------------- пинг: журнал, статистика боя, предупреждение о скачке
const pingLog = []; // { t, ms } — только точные замеры (без пометки «~»)
let lastLagAt = 0;
function onPing(m) {
  lastPing = m.ms; lastPingEst = !!m.est; lastPingDbg = { n: m.n | 0 };
  const ov = wins.overlay; if (ov && !ov.isDestroyed()) ov.webContents.send('ping', { ms: lastPing, est: lastPingEst, dbg: lastPingDbg });
  if (lastPingEst || !(m.ms > 0)) return;
  const now = Date.now();
  pingLog.push({ t: now, ms: m.ms });
  while (pingLog.length && now - pingLog[0].t > 45 * 60000) pingLog.shift();
  // скачок: заметно выше обычного уровня за последние минуты (и не меньше 120 мс), не чаще раза в 90 секунд
  const base = pingLog.filter(p => p.t < now - 6000 && p.t > now - 180000).map(p => p.ms).sort((a, b) => a - b);
  if (settings.lagAlert === false || base.length < 6 || now - lastLagAt < 90000) return;
  const usual = base[Math.floor(base.length / 2)];
  if (m.ms >= 120 && m.ms >= Math.max(usual * 2, usual + 80)) {
    lastLagAt = now;
    if (ov && !ov.isDestroyed()) ov.webContents.send('lag', { ms: m.ms, usual });
    showToast({ key: 'lag' + now, type: 'info', icon: 'info', start: null, name: T('Скачок пинга'), text: `${usual} → ${m.ms} ${T('мс')}` });
  }
}
function pingStats(from, to) {
  const a = pingLog.filter(p => p.t >= from && p.t <= to).map(p => p.ms);
  if (!a.length) return null;
  return { avg: Math.round(a.reduce((x, y) => x + y, 0) / a.length), min: Math.min(...a), max: Math.max(...a), n: a.length };
}
function pingAt(t) { // ближайший точный замер к моменту t (не дальше 20 с)
  let best = null;
  for (const p of pingLog) if (Math.abs(p.t - t) < 20000 && (!best || Math.abs(p.t - t) < Math.abs(best.t - t))) best = p;
  return best ? best.ms : null;
}

const FIGHTS_FILE = () => path.join(app.getPath('userData'), 'fights.json');
let fights = null;
function loadFights() { if (!fights) { try { fights = JSON.parse(fs.readFileSync(FIGHTS_FILE(), 'utf8')); } catch { fights = []; } } return fights; }
// Ротация (лента ударов) занимает много места, поэтому лежит отдельными сжатыми файлами; хранятся последние 40 боёв.
const ROT_DIR = () => path.join(app.getPath('userData'), 'rotations');
function saveRot(m) {
  const rot = m.rot; delete m.rot;
  if (!rot || !rot.c || rot.c.length < 5 || !m.id) return;
  try {
    fs.mkdirSync(ROT_DIR(), { recursive: true });
    fs.writeFileSync(path.join(ROT_DIR(), String(m.id).replace(/[^\w-]/g, '') + '.json.gz'), zlib.gzipSync(JSON.stringify(rot)));
    m.hasRot = true;
    const files = fs.readdirSync(ROT_DIR()).map(n => ({ n, t: fs.statSync(path.join(ROT_DIR(), n)).mtimeMs })).sort((x, y) => y.t - x.t);
    for (const x of files.slice(40)) { try { fs.unlinkSync(path.join(ROT_DIR(), x.n)); } catch { /* не критично */ } }
  } catch { /* не критично */ }
}
function loadRot(id) {
  try { return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROT_DIR(), String(id).replace(/[^\w-]/g, '') + '.json.gz'))).toString('utf8')); } catch { return null; }
}
function addFight(f) {
  loadFights();
  if (fights.some(x => x.id === f.id)) return;
  if (!f.ping) { const ps = pingStats(f.at, Date.now()); if (ps) f.ping = ps; }
  const pb = personalBest(f);
  fights.unshift(f);
  fights.length = Math.min(fights.length, 500);
  if (pb) showToast(pb);
  try { fs.writeFileSync(FIGHTS_FILE(), JSON.stringify(fights)); } catch { /* не критично */ }
  broadcast('fights', fights);
  broadcast('records', records());
}
// Системная строка в боковой панели: нагрузка программы, ускоритель, график пинга за последние минуты.
const ACCEL = [['exitlag', 'ExitLag'], ['gearup', 'GearUP'], ['lagofast', 'LagoFast'], ['wtfast', 'WTFast'], ['mudfish', 'Mudfish'], ['noping', 'NoPing'], ['haste', 'Haste'], ['uu.exe', 'UU'], ['uuinterface', 'UU'], ['rzgcm', 'Razer'], ['clash', 'Clash']];
let lastSys = null, accelName = '', accelAt = 0;
function detectAccel(done) {
  if (process.platform !== 'win32') return done();
  let out = '';
  const p = spawn('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true });
  p.stdout.on('data', c => { out += c; });
  p.on('error', () => done());
  p.on('close', () => { const low = out.toLowerCase(); accelName = (ACCEL.find(([k]) => low.includes(k)) || [])[1] || ''; done(); });
}
function sysTick() {
  const w = wins.main;
  if (!w || w.isDestroyed() || !w.isVisible() || w.isMinimized()) return;
  const send = () => {
    let cpu = 0, ram = 0;
    for (const m of app.getAppMetrics()) { cpu += m.cpu?.percentCPUUsage || 0; ram += (m.memory?.workingSetSize || 0) / 1024; }
    const now = Date.now(), from = now - 10 * 60000, n = 40, arr = new Array(n).fill(null), cnt = new Array(n).fill(0);
    for (const q of pingLog) if (q.t >= from) { const i = Math.min(n - 1, Math.floor((q.t - from) / (10 * 60000) * n)); arr[i] = (arr[i] || 0) + q.ms; cnt[i]++; }
    lastSys = { cpu: Math.round(cpu * 10) / 10, ram: Math.round(ram), accel: accelName, ping: arr.map((v, i) => (v == null ? null : Math.round(v / cnt[i]))) };
    broadcast('sys', lastSys);
  };
  if (Date.now() - accelAt > 30000) { accelAt = Date.now(); detectAccel(send); } else send();
}
setInterval(sysTick, 5000);
// Лучший результат побит: сравнение с прежними боями на этом боссе (до добавления нового).
function personalBest(f) {
  if (settings.pbToast === false || !f.boss || f.partial) return null;
  const me = (f.players || []).find(p => p.self);
  if (!me || !(me.dps > 0)) return null;
  const prev = fights.filter(x => x.boss === f.boss && !x.partial);
  const prevMe = prev.map(x => (x.players || []).find(p => p.self)).filter(Boolean);
  const bestPrev = prevMe.reduce((a, p) => Math.max(a, p.dps || 0), 0);
  const kill = f.result === 'Kill';
  const fastPrev = prev.filter(x => x.result === 'Kill' && x.combatMs > 0).reduce((a, x) => Math.min(a, x.combatMs), Infinity);
  const newDps = bestPrev > 0 && me.dps > bestPrev;
  const newFast = kill && isFinite(fastPrev) && f.combatMs > 0 && f.combatMs < fastPrev;
  if (!newDps && !newFast) return null;
  const parts = [];
  if (newDps) parts.push(`${nf(me.dps)} DPS +${((me.dps / bestPrev - 1) * 100).toFixed(1)}%`);
  if (newFast) parts.push(`${T('убийство')} ${mmss(f.combatMs)}`);
  return { key: 'pb' + f.id, name: T('Новый рекорд') + ' · ' + f.boss, type: 'info', icon: 'app', start: null, text: parts.join(' · ') };
}
// Рекорды: лучший свой DPS на каждом боссе (для сравнения прямо в бою).
function records() {
  const r = {};
  for (const f of loadFights()) {
    if (!f.boss || f.partial) continue;
    const me = (f.players || []).find(p => p.self);
    if (me && me.dps > (r[f.boss] || 0)) r[f.boss] = me.dps;
  }
  return r;
}

// ---------------------------------------------------------------- разбор смерти
const DEATHS_FILE = () => path.join(app.getPath('userData'), 'deaths.json');
let deaths = null;
function loadDeaths() { if (!deaths) { try { deaths = JSON.parse(fs.readFileSync(DEATHS_FILE(), 'utf8')); } catch { deaths = []; } } return deaths; }
// Кто добил: последний удар перед смертью (самый близкий к 0 мс).
const killerOf = d => (d.hits || []).filter(h => !h.heal).sort((a, b) => a.ms - b.ms)[0];
function addDeath(m) {
  loadDeaths();
  const d = { id: 'd' + m.at, at: m.at, zone: m.zone || '', boss: m.boss || '', hits: (m.hits || []).slice(0, 300) };
  if (deaths.some(x => x.id === d.id)) return;
  { const pv = pingAt(d.at), ps = pingStats(d.at - 12000, d.at + 2000); if (pv != null) d.ping = { at: pv, max: ps ? ps.max : pv }; }
  deaths.unshift(d);
  deaths.length = Math.min(deaths.length, 50);
  try { fs.writeFileSync(DEATHS_FILE(), JSON.stringify(deaths)); } catch { /* не критично */ }
  broadcast('deaths', deaths);
  if (settings.deathToast !== false) {
    const k = killerOf(d);
    showToast({ key: 'death' + d.at, type: 'death', icon: 'skull', start: null, name: T('Ваш персонаж погиб'), text: k ? `${k.src} · ${k.skill} · ${nf(k.amt)}` : T('Разбор — в «Статистике»'), actions: [{ id: 'death', label: T('Разбор'), primary: true }] });
  }
}

// ---------------------------------------------------------------- журнал для отчёта об ошибке
const LOG = [];
function logLine(t) { LOG.push(new Date().toISOString().slice(11, 19) + ' ' + t); if (LOG.length > 300) LOG.splice(0, LOG.length - 300); }
process.on('uncaughtException', e => logLine('error: ' + (e && e.stack || e)));
process.on('unhandledRejection', e => logLine('promise: ' + (e && e.stack || e)));

// ---------------------------------------------------------------- расписание и уведомления
const USER_FILE = n => path.join(app.getPath('userData'), n);
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const writeJson = (f, o) => { try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o)); } catch { /* не критично */ } };
const validFeed = f => f && Number.isFinite(f.version) && Array.isArray(f.events) && f.events.every(e => e && e.id && e.name && e.rule);

// Выключатель: если NCSoft запретит такие программы, в файле обновлений ставится meter.disabled — чтение боя отключается.
function meterDisabled() {
  if (!feed?.meter?.disabled) return false;
  setStatus({ state: 'disabled', msg: feed.meter.message || 'Счётчик урона отключён: NCSoft запретила такие программы' });
  return true;
}

// Расписание: встроенное, затем самое свежее из скачанных.
let feed = readJson(path.join(ROOT, 'data', 'schedule-feed.json')) || { version: 0, events: [] };
const cachedFeed = readJson(USER_FILE('schedule-feed.json'));
if (validFeed(cachedFeed) && cachedFeed.version >= feed.version) feed = cachedFeed;
let feedState = { checkedAt: 0, ok: null, msg: '' };

async function updateFeed(manual) {
  if (!settings.feedUrl) return;
  try {
    const r = await net.fetch(settings.feedUrl + (settings.feedUrl.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const f = await r.json();
    if (!validFeed(f)) throw new Error('файл расписания повреждён');
    feedState = { checkedAt: Date.now(), ok: true, msg: f.version > feed.version ? 'Расписание обновлено' : 'Расписание актуально' };
    if (f.version >= feed.version) { feed = f; writeJson(USER_FILE('schedule-feed.json'), f); }
    if (meterDisabled()) bridge.stop();
  } catch (e) {
    clearTimeout(updateFeed.retry);
    if (!manual) updateFeed.retry = setTimeout(() => updateFeed(false), 15 * 60 * 1000); // нет сети — повторим через 15 минут
    feedState = { checkedAt: Date.now(), ok: false, msg: /HTTP 404/.test(e.message) ? 'источник обновлений ещё не опубликован, используется встроенное расписание' : 'нет связи с источником, используется сохранённое расписание' };
  }
  // новые ивенты — уведомить один раз
  const seen = new Set(settings.seenFeedIds);
  const fresh = feed.events.filter(e => !seen.has(e.id));
  if (fresh.length) {
    if (seen.size) showToast({ key: 'feed' + Date.now(), name: 'Новые ивенты в расписании', text: fresh.map(e => e.name).join(', '), type: 'info', icon: 'calendar', start: null });
    patchSettings({ seenFeedIds: feed.events.map(e => e.id) });
  }
  broadcastSchedule();
  checkUpdate();
  if (manual) return feedState;
}

// Полевые боссы из игры (по серверам).
let fieldBosses = readJson(USER_FILE('field-bosses.json')) || {};
function onFieldBosses(m) {
  const server = m.server || settings.detectedServer || '?';
  fieldBosses[server] = fieldBosses[server] || {};
  fieldBosses[server][m.mapId] = { map: m.map, at: Date.now(), slots: m.slots };
  writeJson(USER_FILE('field-bosses.json'), fieldBosses);
  broadcastSchedule();
}

let serverList = null;
// Все серверы Global по регионам (названия повторяются в разных регионах, поэтому выбираем по номеру).
const REGION_CODE = { eu: 'EU', nae: 'NAE', naw: 'NAW', la: 'LA', as: 'AS' };
function servers() {
  if (serverList) return serverList;
  serverList = serversGlobal.filter(x => x.id && x.ru).map(x => ({ id: x.id, name: x.ru, en: x.en || x.ru, side: x.race === 1 ? 'Элийцы' : 'Асмодиане', region: REGION_CODE[x.region] || 'EU' }))
    .sort((a, b) => a.region.localeCompare(b.region) || b.side.localeCompare(a.side) || a.name.localeCompare(b.name, 'ru'));
  return serverList;
}
// Выбранный сервер: «Авто» — тот, на котором игра видела персонажа, иначе выбранный вручную.
function selectedServer() {
  const id = settings.serverAuto ? settings.detectedServerId : settings.serverId;
  const byId = id && servers().find(s => s.id === Number(id));
  if (byId) return byId;
  const name = settings.serverAuto ? settings.detectedServer : settings.server;
  return name ? servers().find(s => s.name === name || s.en === name) || { id: 0, name, en: name, region: settings.region } : null;
}
const currentServer = () => selectedServer()?.name || '';
// Регион и часы сервера: берутся с выбранного сервера; часы региона можно переопределить в файле расписания (serverTz).
const regionNow = () => selectedServer()?.region || settings.region || 'EU';
const serverTz = () => (feed.serverTz && feed.serverTz[regionNow()]) || feed.serverTz?.default || Sched.SERVER_TZ;

function scheduleData() {
  const sel = selectedServer();
  return { feed, feedState, servers: servers(), fieldBosses: fieldBosses[currentServer()] || {}, server: currentServer(), selected: sel, region: regionNow(), serverTz: serverTz() };
}
function broadcastSchedule() { broadcast('schedule-data', scheduleData()); }

// Все ивенты с напоминаниями: из расписания, свои и полевые боссы текущего сервера.
function allEvents() {
  const list = feed.events.map(e => ({ ...e, bell: settings.bells[e.id] ?? e.bell !== false }));
  for (const e of settings.events) list.push({ ...Sched.fromCustom(e), bell: e.bell !== false });
  return list;
}
const notified = new Set();
let toasts = [];
function checkSchedule() {
  const now = Date.now();
  const leads = [['m15', 15], ['m5', 5], ['m1', 1]].filter(([k]) => settings.notify[k]).map(([, m]) => m);
  const fire = (id, name, type, start, icon = id) => {
    for (const m of leads) {
      const at = start - m * 60000, key = id + '@' + start + '@' + m;
      if (now >= at && now < at + 20000 && !notified.has(key)) { notified.add(key); showToast({ key, name, type, start, icon }); }
    }
  };
  for (const ev of allEvents()) {
    if (!ev.bell) continue;
    for (const start of Sched.occurrences(ev, now, now + 16 * 60000, regionNow())) if (start > now) fire(ev.id, ev.name, ev.type, start);
  }
  for (const map of Object.values(fieldBosses[currentServer()] || {})) for (const sl of map.slots || []) {
    const id = 'fb:' + sl.name;
    if (!sl.alive && sl.atMs > now && settings.bells[id] !== false) fire(id, sl.name + ' · ' + map.map, 'world', sl.atMs, 'fieldboss');
  }
}
function showToast(t) {
  toasts = [t, ...toasts.filter(x => x.key !== t.key)].slice(0, 3);
  const wa = screen.getPrimaryDisplay().workArea;
  const st = settings.notify.style || 'glass';
  const per = { minimal: 70, banner: 130 }[st] || 112;
  const extra = t => (t.actions?.length || t.progress != null ? (st === 'minimal' ? 46 : 40) : 0);
  const pos = settings.notify.position || 'br', W = st === 'banner' ? 440 : 380, h = 16 + toasts.reduce((n, t) => n + (t.type === 'update' ? 168 : per + extra(t)), 0), m = 16;
  const x = pos[1] === 'l' ? wa.x + m : pos[1] === 'c' ? wa.x + Math.round((wa.width - W) / 2) : wa.x + wa.width - W - m;
  const y = pos[0] === 't' ? wa.y + m : wa.y + wa.height - h - m;
  const bounds = { width: W, height: h, x, y };
  const w = makeWindow('toast', { ...bounds, alwaysOnTop: true, skipTaskbar: true, focusable: false, resizable: false, showInactive: true }, 'toast.html');
  w.setAlwaysOnTop(true, 'screen-saver');
  w.setBounds(bounds);
  const send = () => w.webContents.send('toasts', { toasts, sound: settings.notify.sound, soundName: settings.notify.soundName || 'clear-sky', volume: settings.notify.volume ?? 50, theme: settings.theme, top: pos[0] === 't', style: settings.notify.style || 'glass', lang: settings.lang });
  if (w.webContents.isLoading()) w.webContents.once('did-finish-load', send); else send();
  clearTimeout(showToast.timer);
  // обычные уведомления исчезают сами; «липкие» (обновление) — только по кнопке
  showToast.timer = setTimeout(() => { toasts = toasts.filter(x => x.sticky); if (!toasts.length) wins.toast?.close(); else showToast(toasts[0]); }, 45000);
}
function closeToast(key) {
  if (!toasts.some(t => t.key === key)) return;
  toasts = toasts.filter(t => t.key !== key);
  if (!toasts.length) wins.toast?.close(); else showToast(toasts[0]);
}

// ---------------------------------------------------------------- Discord автора
const DISCORD_ID = '256419758369538048';
// Ссылка discord:// открывает профиль прямо в приложении Discord; без приложения — профиль на сайте.
async function openDiscord(how) {
  if (how === 'copy') {
    clipboard.writeText('https://discord.com/users/' + DISCORD_ID);
    showToast({ key: 'dc' + Date.now(), name: 'Ссылка на профиль скопирована', type: 'info', icon: 'discord', start: null, text: 'Вставьте её в любой чат Discord — откроется профиль' });
    return;
  }
  if (how === 'web') return shell.openExternal('https://discord.com/users/' + DISCORD_ID);
  let hasApp = true;
  try { hasApp = !!app.getApplicationNameForProtocol('discord://'); } catch { /* нет такой функции — пробуем приложение */ }
  if (hasApp) { try { await shell.openExternal('discord://-/users/' + DISCORD_ID); return; } catch { /* дальше — сайт */ } }
  shell.openExternal('https://discord.com/users/' + DISCORD_ID);
}

// ---------------------------------------------------------------- горячие клавиши
const HOTKEY_DEFAULTS = { overlay: 'Ctrl+Shift+D', lock: 'Ctrl+Shift+L', reset: 'Ctrl+Shift+R', share: 'Ctrl+Shift+C', chat: 'Ctrl+Shift+T', streamer: 'Ctrl+Shift+H', modeBoss: 'Ctrl+Shift+1', modeWorld: 'Ctrl+Shift+2', modeMob: 'Ctrl+Shift+3', modeNext: 'Ctrl+Shift+M' };
const HOTKEY_ACTIONS = {
  overlay: () => toggleOverlay(),
  lock: () => patchSettings({ clickThrough: !settings.clickThrough }),
  reset: () => bridge.reset(),
  share: () => shareFight(),
  chat: () => shareChat(),
  streamer: () => patchSettings({ streamer: !settings.streamer }),
  modeBoss: () => setMode('boss'),
  modeWorld: () => setMode('world'),
  modeMob: () => setMode('mob'),
  modeNext: () => setMode({ boss: 'world', world: 'mob', mob: 'boss' }[settings.mode] || 'boss'),
};
// смена режима подсчёта горячей клавишей (оверлей коротко покажет название режима)
function setMode(m) { if (settings.mode !== m) patchSettings({ mode: m }); }
let hotkeyErrors = {};
function registerHotkeys() {
  globalShortcut.unregisterAll();
  hotkeyErrors = {};
  for (const [id, fn] of Object.entries(HOTKEY_ACTIONS)) {
    const acc = (settings.hotkeys || {})[id] || HOTKEY_DEFAULTS[id];
    if (!acc) continue;
    let ok = false;
    try { ok = globalShortcut.register(acc, fn); } catch { ok = false; }
    if (!ok) hotkeyErrors[id] = 'Сочетание ' + acc.replace(/num(\d)/g, 'Num $1').replace(/numadd/g, 'Num +').replace(/numsub/g, 'Num −') + ' занято другой программой или недопустимо';
  }
  broadcast('hotkey-errors', hotkeyErrors);
}
ipcMain.on('hotkeys-pause', (_e, on) => { if (on) globalShortcut.unregisterAll(); else registerHotkeys(); });

// ---------------------------------------------------------------- IPC
ipcMain.handle('get-state', () => ({ sys: lastSys, settings, status, snap: lastSnap, bossLog, version: APP_VERSION, ping: lastPing, pingEst: lastPingEst, pingDbg: lastPingDbg, records: records(), whatsNew: whatsNew(), update: updateInfo(), rpcAvailable: !!DISCORD_APP_ID }));
ipcMain.handle('schedule-data', () => scheduleData());
ipcMain.handle('fights', () => loadFights());
ipcMain.handle('deaths', () => loadDeaths());
ipcMain.on('deaths-clear', () => { deaths = []; try { fs.writeFileSync(DEATHS_FILE(), '[]'); } catch { /* ignore */ } broadcast('deaths', deaths); });
ipcMain.on('whats-new-seen', () => patchSettings({ whatsNewSeen: APP_VERSION, whatsNewFrom: '' }));
ipcMain.handle('report', () => saveReport());
ipcMain.handle('webhook-test', (_e, url) => webhookSend(url, { content: T('Aion DPS Meter подключён к этому каналу ✓') }));
ipcMain.on('fights-clear', () => { fights = []; try { fs.writeFileSync(FIGHTS_FILE(), '[]'); } catch { /* ignore */ } broadcast('fights', fights); broadcast('records', {}); });
ipcMain.on('share', (_e, fightId) => shareFight(fightId));
ipcMain.on('fight-delete', (_e, id) => {
  loadFights();
  const n = fights.length;
  fights = fights.filter(x => x.id !== id);
  try { fs.unlinkSync(path.join(ROT_DIR(), String(id).replace(/[^\w-]/g, '') + '.json.gz')); } catch { /* нет ленты */ }
  if (fights.length === n) return;
  try { fs.writeFileSync(FIGHTS_FILE(), JSON.stringify(fights)); } catch { /* не критично */ }
  broadcast('fights', fights);
  broadcast('records', records());
});
// Экспорт: 'csv' / 'json' — один бой, 'all' — сводка по всей истории (CSV для Excel: «;» и BOM).
const csvCell = v => { const t = String(v == null ? '' : v); return /[";\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
const csvRow = a => a.map(csvCell).join(';');
const fnameSafe = t => String(t || 'fight').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60);
ipcMain.handle('fight-export', async (_e, id, kind) => {
  loadFights();
  const dtf = ms => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
  let text, name;
  if (kind === 'all') {
    const rows = [csvRow(['Дата', 'Босс / бой', 'Зона', 'Итог', 'Время боя, с', 'DPS группы', 'Ваш DPS', 'Ваше место', 'Игроков'])];
    for (const f of fights) {
      const me = (f.players || []).find(p => p.self);
      rows.push(csvRow([dtf(f.at), f.boss || f.title || '', f.zone || '', f.result || '', Math.round((f.combatMs || 0) / 1000), Math.round(f.partyDps || 0), me ? Math.round(me.dps) : '', me ? f.players.indexOf(me) + 1 : '', (f.players || []).length]));
    }
    text = '\ufeff' + rows.join('\r\n') + '\r\n'; name = 'aion-dps-history.csv';
  } else {
    const f = fights.find(x => x.id === id);
    if (!f) return { ok: false };
    if (kind === 'json') { text = JSON.stringify(f, null, 2); name = fnameSafe((f.boss || f.title) + ' ' + dtf(f.at).slice(0, 10)) + '.json'; }
    else {
      const rows = [csvRow(['Бой', f.boss || f.title || '', 'Дата', dtf(f.at), 'Время боя, с', Math.round((f.combatMs || 0) / 1000), 'DPS группы', Math.round(f.partyDps || 0)]), '',
        csvRow(['#', 'Игрок', 'Класс', 'DPS', 'Урон', 'Доля, %', 'Крит, %', 'Макс. удар', 'HPS'])];
      (f.players || []).forEach((p, i) => rows.push(csvRow([i + 1, p.name, p.cls || '', Math.round(p.dps || 0), Math.round(p.dmg || 0), ((p.share || 0) * 100).toFixed(1), p.crit != null ? Math.round(p.crit * 100) : '', p.maxHit || '', Math.round(p.hps || 0)])));
      text = '\ufeff' + rows.join('\r\n') + '\r\n'; name = fnameSafe((f.boss || f.title) + ' ' + dtf(f.at).slice(0, 10)) + '.csv';
    }
  }
  const r = await dialog.showSaveDialog(wins.main && !wins.main.isDestroyed() ? wins.main : undefined, { defaultPath: path.join(app.getPath('documents'), name), filters: [{ name: name.endsWith('.json') ? 'JSON' : 'CSV', extensions: [name.endsWith('.json') ? 'json' : 'csv'] }] });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };
  try { fs.writeFileSync(r.filePath, text, 'utf8'); } catch (e) { return { ok: false, error: String(e.message || e) }; }
  return { ok: true, path: r.filePath };
});
ipcMain.on('copy-text', (_e, t) => { if (typeof t === 'string' && t) clipboard.writeText(t.slice(0, 64)); });
ipcMain.handle('update-check', async () => { await updateFeed(true); return updateInfo(); });
ipcMain.on('update-install', () => updater.download());
ipcMain.on('update-skip', (_e, v) => patchSettings({ updateSkip: String(v || '') }));
ipcMain.on('detail', (_e, id, casts) => bridge.send('detail ' + (Number(id) >>> 0) + (casts ? ' c' : '')));
// Время ближайших и прошедших сбросов (ежедневный и еженедельный) из расписания.
ipcMain.handle('resets', () => {
  const now = Date.now(), out = {};
  for (const [kind, id] of [['daily', 'reset-daily'], ['weekly', 'reset-weekly']]) {
    let r = feed.events.find(x => x.id === id)?.rule;
    if (!r || r.kind !== 'weekly') r = { kind: 'weekly', days: kind === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : [2], time: '07:00' }; // в фиде нет сброса — берём обычный
    const [hh, mm] = String(r.time || '07:00').split(':').map(Number);
    const days = r.days && r.days.length ? r.days : [0, 1, 2, 3, 4, 5, 6];
    const b = new Date(now), c = [];
    for (let d = -8; d <= 8; d++) {
      const t = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + d, hh || 0, mm || 0);
      if (days.includes((new Date(t).getUTCDay() + 6) % 7)) c.push(t);
    }
    out[kind] = { last: Math.max(...c.filter(t => t <= now)), next: Math.min(...c.filter(t => t > now)) };
  }
  return out;
});
ipcMain.handle('fight-rot', (_e, id) => loadRot(id));

// Официальный сайт персонажей AION 2 (те же запросы, что делает страница aion2.plaync.com/characters).
const https = require('https');
const ARMORY_REGIONS = ['eu', 'nae', 'naw', 'la', 'as'];
function armoryGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.8',
        'Accept-Encoding': 'identity',
        Referer: 'https://aion2.plaync.com/en-us/characters/index',
        Origin: 'https://aion2.plaync.com',
      },
      timeout: 15000,
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => { body += c; });
      res.on('end', () => {
        if (res.statusCode === 404) return reject(new Error('не найдено'));
        if (res.statusCode >= 400) return reject(new Error('сайт NCSoft ответил ошибкой ' + res.statusCode));
        try { resolve(JSON.parse(body)); } catch { reject(new Error('сайт NCSoft прислал неожиданный ответ')); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('сайт NCSoft не отвечает')));
    req.on('error', e => reject(/ENOTFOUND|ECONN|EAI_AGAIN|ETIMEDOUT|не отвечает/.test(e.code + e.message) ? new Error('нет связи с сайтом NCSoft — проверьте интернет') : e));
  });
}
const unhtml = t => String(t || '').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const qs = o => Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');

// Серверы: встроенный список (с русскими названиями) + свежий с сайта, если там появились новые.
let serversGlobal = readJson(path.join(ROOT, 'data', 'servers-global.json')) || [];
const ruNames = () => { const d = readJson(path.join(BRIDGE_DIR(), 'data', 'servers.json')); return d?.servers || {}; };
async function refreshServers(region) {
  try {
    const d = await armoryGet('https://aion2.plaync.com/en-us/api/gameinfo/servers?' + qs({ lang: 'en-US', region }));
    const list = Array.isArray(d) ? d : d.serverList || [];
    const ru = ruNames();
    let added = false;
    for (const x of list) {
      if (!x.serverId || serversGlobal.some(s => s.id === x.serverId)) continue;
      serversGlobal.push({ id: x.serverId, region, race: x.raceId || (x.serverId < 2000 ? 1 : 2), ru: ru[x.serverId]?.ru || x.serverName, en: x.serverName });
      added = true;
    }
    return added;
  } catch { return false; }
}
ipcMain.handle('armory', async (_e, kind, p = {}) => {
  const region = ARMORY_REGIONS.includes(p.region) ? p.region : 'eu';
  try {
    if (kind === 'servers') {
      await refreshServers(region);
      return { ok: true, servers: serversGlobal.filter(s => s.region === region) };
    }
    if (kind === 'search') {
      const name = String(p.name || '').trim();
      if (!name) return { ok: false, error: 'введите ник персонажа' };
      const d = await armoryGet('https://api-search.plaync.com/aion2global/search/v2/character?' + qs({ keyword: name, serverId: p.serverId, page: 1, size: 40, region, localeInfo: 'en-US' }));
      const srv = id => serversGlobal.find(s => s.id === id);
      return {
        ok: true,
        list: (d.list || []).map(x => ({
          id: (() => { try { return decodeURIComponent(x.characterId || ''); } catch { return x.characterId || ''; } })(),
          name: unhtml(x.name),
          level: x.level, pcId: x.pcId, race: x.race, serverId: x.serverId,
          server: srv(x.serverId)?.ru || x.serverName,
          image: x.profileImageUrl ? (x.profileImageUrl.startsWith('/') ? 'https://profileimg.plaync.com' + x.profileImageUrl : x.profileImageUrl) : '',
        })),
      };
    }
    if (kind === 'equipment') {
      const d = await armoryGet('https://aion2.plaync.com/api/character/equipment?' + qs({ region, lang: 'en-US', characterId: p.id, serverId: p.serverId }));
      return { ok: true, equipment: d };
    }
    if (kind === 'info') {
      const d = await armoryGet('https://aion2.plaync.com/api/character/info?' + qs({ region, lang: 'en-US', characterId: p.id, serverId: p.serverId }));
      if (!d || !d.profile) return { ok: false, error: 'сайт не прислал данные персонажа' };
      d.profile.characterName = unhtml(d.profile.characterName);
      d.profile.serverNameRu = serversGlobal.find(s => s.id === d.profile.serverId)?.ru;
      return { ok: true, info: d, page: `https://aion2.plaync.com/en-us/characters/${p.serverId}/${encodeURIComponent(p.id)}?region=${region}` };
    }
  } catch (e) { return { ok: false, error: e.message }; }
  return { ok: false, error: 'неизвестный запрос' };
});


ipcMain.handle('feed-update', () => updateFeed(true));
ipcMain.on('set-settings', (_e, patch) => patchSettings(patch));
ipcMain.on('win', (e, cmd, arg) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return;
  if (cmd === 'close') w.close();
  else if (cmd === 'minimize') w.minimize();
  else if (cmd === 'hide') { w.hide(); if (w === wins.overlay) { settings.overlay.visible = false; save(); } }
  else if (cmd === 'maximize') { if (w.isMaximized()) w.unmaximize(); else w.maximize(); }
});
ipcMain.on('open', (_e, what, arg) => {
  if (what === 'main') openMain(arg);
  else if (what === 'schedule') openSchedule();
  else if (what === 'breakdown') openBreakdown(arg);
  else if (what === 'overlay') { settings.overlay.visible = true; save(); const w = wins.overlay; if (w && !w.isDestroyed()) w.showInactive(); else openOverlay(); }
  else if (what === 'url' && /^https:\/\//.test(arg)) shell.openExternal(arg);
  else if (what === 'discord') openDiscord(arg);
});
// Изменение размера окна уголком: размер считает главный процесс по курсору на экране —
// так не мешают ни масштаб интерфейса, ни масштаб Windows (125 %, 150 %), ни быстрые движения мыши.
let resizing = null;
function stopResize() {
  if (!resizing) return;
  clearInterval(resizing.timer);
  const { w, wasResizable } = resizing;
  resizing = null;
  // Окно снова «нерастягиваемое» за край (прозрачным окнам Windows это нужно), но размер уже новый.
  if (!w.isDestroyed()) { w.setResizable(wasResizable); w.emit('resized'); }
}
ipcMain.on('resize-start', e => {
  stopResize();
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w || w.isMaximized()) return;
  const wasResizable = w.isResizable();
  // Windows не даёт уменьшать окно с resizable:false — на время перетаскивания разрешаем.
  w.setResizable(true);
  const [bw, bh] = w.getSize(), start = screen.getCursorScreenPoint(), [mw, mh] = w.getMinimumSize();
  const started = Date.now();
  resizing = {
    w, wasResizable,
    timer: setInterval(() => {
      if (w.isDestroyed() || Date.now() - started > 60000) return stopResize();
      const c = screen.getCursorScreenPoint();
      const nw = Math.max(mw || 240, Math.round(bw + c.x - start.x)), nh = Math.max(mh || 150, Math.round(bh + c.y - start.y));
      const b = w.getBounds();
      if (nw !== b.width || nh !== b.height) w.setBounds({ x: b.x, y: b.y, width: nw, height: nh });
    }, 16),
  };
});
ipcMain.on('resize-end', () => stopResize());

ipcMain.on('reset', () => bridge.reset());
ipcMain.on('restart-bridge', () => bridge.start());
ipcMain.on('overlay-reset-size', () => {
  settings.overlay = { ...settings.overlay, x: null, y: null, width: null, height: null };
  const w = wins.overlay;
  if (w && !w.isDestroyed()) w.setBounds(overlayBounds());
  save();
});
ipcMain.on('test-toast', () => showToast({ key: 'test' + Date.now(), name: 'Пространственный разлом', type: 'pvp', icon: 'rift', start: Date.now() + 5 * 60000 }));
ipcMain.on('toast-close', (_e, key) => closeToast(key));
// кнопки в уведомлениях
ipcMain.on('toast-action', (_e, key, id) => {
  if (id === 'upd-go') updater.download();
  else if (id === 'upd-later') closeToast(key);
  else if (id === 'upd-notes') { openMain('about'); }
  else if (id === 'death') { closeToast(key); openMain('stats:death'); }
});

// ---------------------------------------------------------------- «Поделиться боем»
const nf = n => {
  if (n == null || !isFinite(n)) return '—';
  const f = (v, d) => (settings.lang === 'en' ? v.toFixed(d) : v.toFixed(d).replace('.', ','));
  return n >= 1e9 ? f(n / 1e9, 2) + 'B' : n >= 1e6 ? f(n / 1e6, n >= 1e8 ? 0 : n >= 1e7 ? 1 : 2) + 'M' : n >= 1e3 ? f(n / 1e3, n >= 1e5 ? 0 : 1) + 'K' : String(Math.round(n));
};
const mmss = ms => { const t = Math.floor((ms || 0) / 1000); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
function fightText(f) {
  const ps = (f.players || []).filter(p => p.dmg > 0).slice(0, 10);
  const head = `⚔ ${f.boss || f.title || T('Бой')} · ${mmss(f.combatMs)} · ${T('DPS группы')} ${nf(f.partyDps)}`;
  const rows = ps.map((p, i) => `${i + 1}. ${p.name}${p.self ? ' ★' : ''} — ${nf(p.dps)} DPS · ${nf(p.dmg)} · ${((p.share || 0) * 100).toFixed(1)}%${p.hps > 0 ? ` · ${nf(p.hps)} HPS` : ''}`);
  return [head, ...rows, '— Aion DPS Meter'].join('\n');
}
// Одна короткая строка для чата игры (в чате игры нет переносов строк).
function chatLine(f) {
  const ps = (f.players || []).filter(p => p.dmg > 0);
  const i = ps.findIndex(p => p.self);
  const me = i >= 0 ? ps[i] : null;
  const head = `${f.boss || f.title || T('Бой')} ${mmss(f.combatMs)}`;
  const mine = me ? ` · ${T('Я')} ${nf(me.dps)} DPS (#${i + 1}/${ps.length}, ${((me.share || 0) * 100).toFixed(0)}%)` : '';
  return `${head}${mine} · ${T('группа')} ${nf(f.partyDps)}`;
}
function shareChat() {
  let f = (lastSnap && lastSnap.players?.length) ? { boss: lastSnap.boss?.name || lastSnap.target?.name, title: lastSnap.title, combatMs: lastSnap.combatMs, partyDps: lastSnap.partyDps, players: lastSnap.players } : (loadFights()[0] || null);
  if (!f) { showToast({ key: 'chat' + Date.now(), name: 'Нечем поделиться', type: 'info', icon: 'info', start: null, text: 'Сначала проведите бой' }); return; }
  const line = chatLine(f);
  clipboard.writeText(line);
  showToast({ key: 'chat' + Date.now(), name: T('Строка для чата скопирована'), type: 'info', icon: 'app', start: null, text: line });
}
// ---------------------------------------------------------------- карточка боя (картинка)
const escH = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const medianOf = a => { if (!a.length) return 0; const q = [...a].sort((x, y) => x - y), m = q.length >> 1; return q.length % 2 ? q[m] : (q[m - 1] + q[m]) / 2; };
// медиана DPS класса на этом боссе по всем записанным боям (кроме текущего); нужно не меньше 5 игроков
function classMedian(f, cls) {
  if (!f.boss || !cls || cls === 'Unknown') return null;
  const v = [];
  for (const x of loadFights()) if (x.id !== f.id && x.boss === f.boss && !x.partial) for (const p of x.players || []) if (p.cls === cls && p.dps > 0) v.push(p.dps);
  return v.length >= 5 ? { med: medianOf(v), n: v.length } : null;
}
function cardHtml(f) {
  const ps = (f.players || []).filter(p => p.dmg > 0).slice(0, 8);
  const top = Math.max(1, ...ps.map(p => p.dps));
  const me = (f.players || []).find(p => p.self);
  let badge = '';
  if (me && f.boss && !f.partial) {
    const prev = Math.max(0, ...loadFights().filter(x => x.id !== f.id && x.boss === f.boss && !x.partial).map(x => (x.players || []).find(p => p.self)?.dps || 0));
    if (prev > 0 && me.dps > prev) badge = `<div class="b rec">★ ${escH(T('Новый рекорд по боссу'))}: ${nf(me.dps)} DPS <i>(${escH(T('было'))} ${nf(prev)})</i></div>`;
    else if (prev > 0) badge = `<div class="b">${escH(T('Ваш рекорд по боссу'))}: ${nf(Math.max(prev, me.dps))} DPS</div>`;
    const last = loadFights().filter(x => x.id !== f.id && x.boss === f.boss && !x.partial && (x.at || 0) < (f.at || Date.now())).sort((a, b) => b.at - a.at).map(x => (x.players || []).find(p => p.self)).find(Boolean);
    if (last && last.dps > 0) { const d = Math.round((me.dps / last.dps - 1) * 100); badge += `<div class="b ${d >= 0 ? 'up' : 'dn'}">${escH(T('К прошлому бою'))}: ${d >= 0 ? '+' : ''}${d}%</div>`; }
    const cm = classMedian(f, me.cls);
    if (cm && cm.med > 0) { const d = Math.round((me.dps / cm.med - 1) * 100); badge += `<div class="b ${d >= 0 ? 'up' : 'dn'}">${escH(T('К медиане класса'))}: ${d >= 0 ? '+' : ''}${d}%</div>`; }
  }
  const rank = me ? (f.players || []).indexOf(me) + 1 : 0, ntot = (f.players || []).filter(p => p.dmg > 0).length;
  const hero = me ? `<div class="hero"><div class="hd">${me.cls && me.cls !== 'Unknown' ? `<img src="${pathToFileURL(path.join(ASSETS, 'classes', String(me.cls).toLowerCase() + '.png')).href}">` : ''}<div><div class="hn">${escH(me.name)}</div><div class="hdps">${nf(me.dps)}<small> DPS</small></div></div><div class="rk">#${rank}<small>/ ${ntot}</small></div></div>
    <div class="st"><div><span>${escH(T('Урон'))}</span><b>${nf(me.dmg)}</b></div><div><span>${escH(T('Доля'))}</span><b>${((me.share || 0) * 100).toFixed(1)}%</b></div>${me.crit != null ? `<div><span>${escH(T('Крит'))}</span><b>${Math.round(me.crit * 100)}%</b></div>` : ''}${me.maxHit ? `<div><span>${escH(T('Макс. удар'))}</span><b>${nf(me.maxHit)}</b></div>` : ''}${me.hps > 0 ? `<div><span>HPS</span><b>${nf(me.hps)}</b></div>` : ''}</div></div>` : '';
  // график DPS по секундам (сглаживание за 5 с)
  let chart = '';
  const tl = f.timeline;
  const sm = a => a.map((_, i) => { let t = 0, c = 0; for (let k = Math.max(0, i - 2); k <= Math.min(a.length - 1, i + 2); k++) { t += a[k]; c++; } return t / c; });
  if (tl && tl.self && tl.self.length > 2) {
    const W = 700, H = 120, series = [[tl.party, 'rgba(170,150,255,.9)', 'rgba(150,120,255,.18)'], [tl.self, '#ffc66b', null]].filter(x => x[0] && x[0].length > 2);
    const mx = Math.max(1, ...series.flatMap(x => x[0]));
    const n = Math.max(...series.map(x => x[0].length));
    let g = '';
    for (const [d, c, fill] of series) {
      const q = sm(d), pts = q.map((v, i) => `${(i / (n - 1) * W).toFixed(1)},${(H - 6 - v / mx * (H - 14)).toFixed(1)}`).join(' ');
      if (fill) g += `<polygon points="0,${H} ${pts} ${(q.length - 1) / (n - 1) * W},${H}" fill="${fill}"/>`;
      g += `<polyline points="${pts}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"/>`;
    }
    chart = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="none">${g}</svg>`;
  }
  const rows = ps.map((p, i) => `<div class="r ${p.self ? 'me' : ''}"><span class="n">${i + 1}</span>${p.cls && p.cls !== 'Unknown' ? `<img src="${pathToFileURL(path.join(ASSETS, 'classes', String(p.cls).toLowerCase() + '.png')).href}">` : '<img>'}<span class="nm">${escH(p.name)}</span><span class="bar"><i style="width:${(p.dps / top * 100).toFixed(1)}%"></i></span><b>${nf(p.dps)}</b><span class="pc">${((p.share || 0) * 100).toFixed(1)}%</span></div>`).join('');
  const date = f.at ? new Date(f.at).toLocaleString(settings.lang === 'en' ? 'en-GB' : 'ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  return `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}html{overflow:hidden}body{width:760px;overflow:hidden;background:linear-gradient(135deg,#1b1233,#2b1a4f 60%,#1a1030);font:14px 'Manrope','Segoe UI',sans-serif;color:#efe9ff;padding:22px}
.h{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px}.t{font-size:26px;font-weight:800;color:#ffc66b}.s{color:#b9a9e6;font-size:13px;margin-top:2px}
.k{text-align:right}.k b{font-size:30px;color:#fff}.k span{display:block;color:#b9a9e6;font-size:12px}
.bs{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.b{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:5px 12px;font-weight:700;font-size:13px}.b i{font-style:normal;color:#b9a9e6;font-weight:500}
.rec{background:rgba(255,198,107,.18);border-color:#ffc66b;color:#ffc66b}.up{color:#7fe0a8}.dn{color:#ff9a8a}
.hero{background:linear-gradient(135deg,rgba(155,108,255,.22),rgba(255,198,107,.12));border:1px solid rgba(255,198,107,.35);border-radius:16px;padding:14px;margin:8px 0}.hd{display:flex;align-items:center;gap:12px}.hd img{width:44px;height:44px}.hn{font-weight:700;font-size:15px}.hdps{font-size:38px;font-weight:800;color:#ffc66b;line-height:1.05}.hdps small{font-size:15px;color:#b9a9e6;font-weight:600}.rk{margin-left:auto;font-size:34px;font-weight:800;color:#ffc66b}.rk small{font-size:15px;color:#b9a9e6;margin-left:3px}.st{display:flex;gap:8px;margin-top:12px}.st div{flex:1;background:rgba(0,0,0,.25);border-radius:11px;padding:8px 10px}.st span{display:block;color:#b9a9e6;font-size:11.5px}.st b{font-size:17px}
.c{background:rgba(0,0,0,.22);border-radius:14px;padding:10px;margin:8px 0}svg{display:block;width:100%}
.r{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:9px}.r.me{background:rgba(255,198,107,.14)}
.n{width:18px;color:#b9a9e6;text-align:right}.r img{width:22px;height:22px}.nm{width:150px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-weight:600}
.bar{flex:1;height:8px;background:rgba(255,255,255,.08);border-radius:5px;overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,#9b6cff,#ffc66b)}
.r b{width:70px;text-align:right}.pc{width:48px;text-align:right;color:#b9a9e6}.f{display:flex;justify-content:space-between;color:#8f7fc0;font-size:12px;margin-top:6px}
</style><body><div class="h"><div><div class="t">${escH(f.boss || f.title || T('Бой'))}</div><div class="s">${escH(date)}${f.zone ? ' · ' + escH(f.zone) : ''} · ${escH(T('бой'))} ${mmss(f.combatMs)}</div></div>
<div class="k"><b>${nf(f.partyDps)}</b><span>${escH(T('DPS группы'))}</span></div></div>
<div class="bs">${badge}</div>${hero}${chart ? `<div class="c">${chart}</div>` : ''}<div class="c">${rows}</div>
<div class="f"><span>Aion DPS Meter</span><span>${escH(settings.character || '')}</span></div></body>`;
}
async function cardPng(f) {
  const file = path.join(app.getPath('userData'), 'card.html');
  let win;
  try {
    fs.writeFileSync(file, cardHtml(f));
    win = new BrowserWindow({ show: false, width: 1520, height: 800, useContentSize: true, webPreferences: { zoomFactor: 2, backgroundThrottling: false } });
    await win.loadFile(file);
    await new Promise(r => setTimeout(r, 250));
    const h = await win.webContents.executeJavaScript('document.body.scrollHeight');
    win.setContentSize(1520, Math.max(400, h * 2));
    await new Promise(r => setTimeout(r, 150));
    return await win.webContents.capturePage();
  } catch { return null; } finally { try { if (win && !win.isDestroyed()) win.destroy(); } catch { /* ignore */ } try { fs.unlinkSync(file); } catch { /* ignore */ } }
}
async function shareFight(fightId) {
  let f = fightId ? loadFights().find(x => x.id === fightId) : null;
  if (!f && !fightId && !(lastSnap && lastSnap.players?.length)) f = loadFights()[0] || null; // боя сейчас нет — делимся последним записанным
  if (!f && lastSnap && lastSnap.players?.length) {
    const s = lastSnap;
    f = { at: Date.now(), boss: s.boss?.name || s.target?.name, title: s.title, combatMs: s.combatMs, partyDps: s.partyDps, players: s.players };
  }
  if (!f) { showToast({ key: 'share' + Date.now(), name: 'Нечем поделиться', type: 'info', icon: 'info', start: null, text: 'Сначала проведите бой' }); return; }
  const data = { text: fightText(f) };
  const ov = wins.overlay;
  { const img = await cardPng(f); if (img && !img.isEmpty()) data.image = img; }
  if (!data.image && ov && !ov.isDestroyed() && ov.isVisible()) {
    try { data.image = await ov.webContents.capturePage(); } catch { /* только текст */ }
  }
  clipboard.write(data);
  if (settings.webhook?.on && WEBHOOK_RE.test(settings.webhook.url || '')) {
    const r = await webhookSend(settings.webhook.url, fightEmbed(f, !!data.image), data.image ? data.image.toPNG() : null);
    showToast({ key: 'share' + Date.now(), name: r.ok ? T('Итог боя отправлен в Discord') : T('Не удалось отправить в Discord'), type: 'info', icon: 'discord', start: null, text: r.ok ? T('И скопирован: Ctrl+V') : r.error });
    return;
  }
  showToast({ key: 'share' + Date.now(), name: 'Итог боя скопирован', type: 'info', icon: 'app', start: null, text: data.image ? 'Картинка и текст · Ctrl+V' : 'Текст · Ctrl+V' });
}

// ---------------------------------------------------------------- отправка в Discord-канал (вебхук канала)
const WEBHOOK_RE = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;
const padR = (t, n) => { t = String(t); return t.length >= n ? t.slice(0, n) : t + ' '.repeat(n - t.length); };
const padL = (t, n) => { t = String(t); return t.length >= n ? t : ' '.repeat(n - t.length) + t; };
function fightEmbed(f, cardOnly) {
  const ps = (f.players || []).filter(p => p.dmg > 0).slice(0, 12);
  const rows = ps.map((p, i) => `${padL(i + 1, 2)} ${padR(p.name + (p.self ? '*' : ''), 16)} ${padL(nf(p.dps), 7)} ${padL(nf(p.dmg), 7)} ${padL(((p.share || 0) * 100).toFixed(1).replace('.', settings.lang === 'en' ? '.' : ','), 5)}`);
  const table = '```\n' + [` # ${padR(T('Игрок'), 16)} ${padL('DPS', 7)} ${padL(T('Урон'), 7)} ${padL('%', 5)}`, ...rows].join('\n') + '\n```';
  const embed = {
    title: '⚔ ' + (f.boss || f.title || T('Бой')),
    description: `${T('Время боя')}: **${mmss(f.combatMs)}** · ${T('DPS группы')}: **${nf(f.partyDps)}**${cardOnly ? '' : '\n' + table}`,
    color: 0xFFC66B,
    footer: { text: 'Aion DPS Meter · ' + (settings.character || 'AION 2') },
    timestamp: new Date(f.at || Date.now()).toISOString(),
  };
  return { username: 'Aion DPS Meter', embeds: [embed] };
}
async function webhookSend(url, payload, png) {
  if (!WEBHOOK_RE.test(String(url || ''))) return { ok: false, error: T('Неверная ссылка вебхука') };
  try {
    let body;
    if (png) {
      body = new FormData();
      if (payload.embeds) payload.embeds[0].image = { url: 'attachment://fight.png' };
      body.append('payload_json', JSON.stringify(payload));
      body.append('files[0]', new Blob([png], { type: 'image/png' }), 'fight.png');
    }
    // net.fetch идёт через системный прокси и сеть Chromium (как браузер), обычный fetch Node прокси игнорирует, и Discord без VPN-режима не открывался
    const opts = png ? { method: 'POST', body, signal: AbortSignal.timeout(20000) }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) };
    let r;
    try { r = await net.fetch(url, opts); }
    catch (e1) { r = await fetch(url, opts); }
    if (r.status === 404 || r.status === 401) return { ok: false, error: T('Вебхук не найден — создайте новую ссылку в настройках канала') };
    if (!r.ok) return { ok: false, error: 'Discord: ' + r.status };
    return { ok: true };
  } catch (e) { const c = String((e && (e.cause && (e.cause.code || e.cause.message))) || (e && e.message) || '').slice(0, 60); return { ok: false, error: T('нет связи с Discord') + (c ? ' (' + c + ')' : '') }; }
}

// ---------------------------------------------------------------- «Что нового»
// Список изменений встроен в программу (data/changelog.json) и показывается один раз после обновления.
function whatsNew() {
  if (firstRun || settings.whatsNewSeen === APP_VERSION) return null;
  const log = readJson(path.join(ROOT, 'data', 'changelog.json')) || [];
  const from = settings.whatsNewFrom || settings.whatsNewSeen || '';
  const list = log.filter(v => newer(v.version, from || '0.0.0') && !newer(v.version, APP_VERSION));
  if (!settings.whatsNewSeen && !settings.whatsNewFrom) return list.length ? { version: APP_VERSION, list: list.slice(0, 1) } : null;
  return list.length ? { version: APP_VERSION, list } : null;
}

// ---------------------------------------------------------------- отчёт об ошибке
// Один текстовый файл на рабочем столе: версия, система, состояние чтения, последние сообщения модуля.
// Ссылка вебхука и адрес сервера игры в отчёт не попадают.
async function saveReport() {
  const os = require('os');
  const home = os.homedir();
  const hide = t => String(t ?? '').split(home).join('%USERPROFILE%');
  const runtimes = await new Promise(res => {
    let out = '';
    try {
      const p = spawn('dotnet', ['--list-runtimes'], { windowsHide: true });
      p.stdout.on('data', d => { out += d; });
      p.on('error', () => res('dotnet не найден'));
      p.on('exit', () => res(out.trim() || '—'));
      setTimeout(() => { try { p.kill(); } catch { /* ignore */ } res(out.trim() || 'нет ответа'); }, 5000);
    } catch { res('dotnet не найден'); }
  });
  const sysdir = process.env.SystemRoot ? path.join(process.env.SystemRoot, 'System32', 'Npcap', 'wpcap.dll') : '';
  const safe = clone(settings);
  if (safe.webhook) safe.webhook.url = safe.webhook.url ? '(задан)' : '';
  const lines = [
    'Aion DPS Meter — отчёт об ошибке',
    'Создан: ' + new Date().toString(),
    '',
    '[Программа]',
    'Версия: ' + APP_VERSION + (global.__aionBoot?.base && global.__aionBoot.base !== APP_VERSION ? ' (лёгкое обновление поверх ' + global.__aionBoot.base + ')' : ''),
    'Оболочка: ' + SHELL + ' · Electron ' + process.versions.electron + ' · Chrome ' + process.versions.chrome,
    'Папка программы: ' + hide(path.dirname(process.execPath)),
    'Модуль чтения: ' + hide(BRIDGE_DIR()),
    global.__aionBoot?.failed ? 'Загрузчик: ' + global.__aionBoot.failed : null,
    '',
    '[Система]',
    'Windows: ' + os.release() + ' · ' + os.arch() + ' · ОЗУ ' + Math.round(os.totalmem() / 1073741824) + ' ГБ',
    'Npcap: ' + (sysdir && fs.existsSync(sysdir) ? 'установлен' : 'не найден'),
    '.NET: ' + runtimes.replace(/\[.*?\]/g, '').split('\n').map(x => x.trim()).filter(Boolean).join('; '),
    '',
    '[Чтение боя]',
    'Состояние: ' + status.state + ' · ' + String(status.msg || '').replace(/\s·\s[\d.:]+$/, ''),
    'Персонаж: ' + (settings.character || '—') + ' · сервер: ' + (settings.detectedServer || '—'),
    'Сохранено боёв: ' + loadFights().length,
    '',
    '[Журнал]',
    ...LOG.map(hide).map(l => l.replace(/\b\d{1,3}(\.\d{1,3}){3}(:\d+)?\b/g, '•.•.•.•')),
    '',
    '[Настройки]',
    hide(JSON.stringify(safe, null, 1)),
  ].filter(l => l !== null);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  let dir = app.getPath('desktop');
  try { fs.accessSync(dir, fs.constants.W_OK); } catch { dir = app.getPath('userData'); }
  const file = path.join(dir, `AionDpsMeter-report-${stamp}.txt`);
  try {
    fs.writeFileSync(file, '\ufeff' + lines.join('\r\n'), 'utf8');
    shell.showItemInFolder(file);
    showToast({ key: 'rep' + Date.now(), type: 'info', icon: 'info', start: null, name: T('Отчёт сохранён на рабочем столе'), text: T('Отправьте файл автору в Discord') });
    return { ok: true, file };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ---------------------------------------------------------------- автообновление
// В файле расписания (feed) есть блок app: { version, url, sha256, size, notes, patch: { url, sha256, size, shell } }.
// Лёгкое обновление (patch, ~2 МБ): новая программа и модуль чтения скачиваются в папку данных пользователя
// и подхватываются загрузчиком boot.js при перезапуске — папка установки не трогается, где бы она ни была.
// Если новая версия требует другой «оболочки» (Electron), скачивается установщик и ставится тихо в текущую папку.
// Всё скачивается с докачкой при обрыве и проверяется по SHA-256.
const newer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
const UPDATE_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(github\.com|githubusercontent\.com)\//;
const UPD_DIR = () => path.join(app.getPath('userData'), 'updates');
const updater = { state: 'idle', progress: 0, error: '' };
function updatePlan() {
  const a = feed?.app;
  if (!a || !a.version || !newer(a.version, APP_VERSION)) return null;
  const p = a.patch;
  if (p && p.url && UPDATE_HOSTS.test(p.url) && p.shell === SHELL) return { kind: 'patch', version: a.version, url: p.url, sha256: p.sha256, size: p.size || 0 };
  if (a.url && UPDATE_HOSTS.test(a.url) && app.isPackaged) return { kind: 'full', version: a.version, url: a.url, sha256: a.sha256, size: a.size || 0 };
  return null;
}
function updateInfo() {
  const plan = updatePlan(), a = feed?.app;
  return { current: APP_VERSION, available: !!plan, version: plan ? plan.version : null, kind: plan?.kind || null, notes: plan ? a.notes || '' : '', size: plan?.size || 0, state: updater.state, progress: updater.progress, error: updater.error, checkedAt: feedState.checkedAt };
}
const MB = n => (n / 1048576).toFixed(n < 10485760 ? 1 : 0).replace('.', settings.lang === 'en' ? '.' : ',') + ' ' + T('МБ');
// Уведомление об обновлении — в стиле приложения, с кнопками и полосой загрузки.
function updateToast() {
  const u = updateInfo();
  if (!u.available && updater.state !== 'installing') { closeToast('upd'); return; }
  // своя карточка обновления: версии «было → станет», размер, кнопки и полоса загрузки
  const base = { key: 'upd', type: 'update', icon: 'update', start: null, sticky: true, name: 'Aion DPS Meter ' + (u.version || ''), cur: u.current, ver: u.version,
    kind: u.kind === 'patch' ? T('За секунды, без установщика') : T('Через установщик, в ту же папку'), size: u.size ? MB(u.size) : '', state: updater.state, progress: updater.progress };
  if (updater.state === 'error') showToast({ ...base, text: u.error, actions: [{ id: 'upd-go', label: T('Повторить'), primary: true }, { id: 'upd-later', label: T('Позже') }] });
  else showToast({ ...base, actions: updater.state === 'idle' ? [{ id: 'upd-go', label: T('Обновить сейчас'), primary: true }, { id: 'upd-later', label: T('Позже') }] : [] });
}
function sendUpdate() {
  broadcast('update', updateInfo());
  if (toasts.some(t => t.key === 'upd')) updateToast();
}
let updateToastFor = '';
function checkUpdate() {
  const u = updateInfo();
  sendUpdate();
  if (u.available && u.version !== settings.updateSkip && u.version !== updateToastFor) { updateToastFor = u.version; updateToast(); }
}
// Скачивание с докачкой: url → file (с проверкой SHA-256).
// Сначала — сетевым модулем Chromium (как браузер: системный прокси, VPN, защищённый DNS), при неудаче — модулем Node.
function fetchFile(url, file, sha256, onProgress) {
  const part = file + '.part';
  const attempt = engine => new Promise((resolve, reject) => {
    let have = 0, settled = false, idle = null;
    try { have = fs.statSync(part).size; } catch { /* нет части */ }
    const ok = () => { if (!settled) { settled = true; clearTimeout(idle); resolve(); } };
    const bad = e => { if (!settled) { settled = true; clearTimeout(idle); reject(e); } };
    let abort = () => {};
    const touch = () => { clearTimeout(idle); idle = setTimeout(() => { abort(); bad(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })); }, 45000); };
    const onResponse = (status, header, stream) => {
      if (status === 416) { stream.resume?.(); return ok(); }
      if (status !== 200 && status !== 206) { stream.resume?.(); return bad(Object.assign(new Error(T('сервер ответил') + ' ' + status), { code: 'HTTP' + status, final: true })); }
      if (status === 200) have = 0;
      const total = have + Number(header('content-length') || 0);
      const out = fs.createWriteStream(part, { flags: have ? 'a' : 'w' });
      let got = have, last = 0;
      out.on('error', bad);
      stream.on('data', c => { touch(); got += c.length; out.write(c); if (total && Date.now() - last > 250) { last = Date.now(); onProgress(Math.min(1, got / total)); } });
      stream.on('end', () => out.end(ok));
      stream.on('error', e => { out.end(); bad(e); });
      stream.on('aborted', () => { out.end(); bad(Object.assign(new Error('aborted'), { code: 'ABORTED' })); });
    };
    const headers = { 'User-Agent': 'AionDpsMeter/' + APP_VERSION, ...(have ? { Range: `bytes=${have}-` } : {}) };
    touch();
    if (engine === 'net') {
      const req = net.request({ url, redirect: 'manual', cache: 'no-store' });
      for (const [k, v] of Object.entries(headers)) req.setHeader(k, v);
      abort = () => { try { req.abort(); } catch { /* ignore */ } };
      req.on('redirect', (_st, _m, to) => { if (UPDATE_HOSTS.test(to)) req.followRedirect(); else { abort(); bad(Object.assign(new Error(T('недопустимый адрес обновления')), { final: true })); } });
      req.on('response', res => onResponse(res.statusCode, h => { const v = res.headers[h]; return Array.isArray(v) ? v[0] : v; }, res));
      req.on('error', bad);
      req.end();
    } else {
      const get = (u, hops) => {
        if (!UPDATE_HOSTS.test(u) || hops > 6) return bad(Object.assign(new Error(T('недопустимый адрес обновления')), { final: true }));
        const req = https.get(u, { headers }, res => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) { res.resume(); return get(new URL(res.headers.location, u).href, hops + 1); }
          onResponse(res.statusCode, h => res.headers[h], res);
        });
        abort = () => req.destroy();
        req.on('error', bad);
      };
      get(url, 0);
    }
  });
  return (async () => {
    if (!UPDATE_HOSTS.test(url)) throw new Error(T('недопустимый адрес обновления'));
    try { await attempt('net'); }
    catch (e1) {
      logLine('update (chromium): ' + (e1.code || '') + ' ' + e1.message);
      if (e1.final) throw e1;
      try { await attempt('node'); }
      catch (e2) {
        logLine('update (node): ' + (e2.code || '') + ' ' + e2.message);
        if (e2.final) throw e2;
        throw new Error(T('связь прервалась — нажмите «Повторить», загрузка продолжится') + ' (' + String(e1.code || e1.message).slice(0, 32) + ')');
      }
    }
    const buf = fs.readFileSync(part);
    if (sha256 && require('crypto').createHash('sha256').update(buf).digest('hex').toLowerCase() !== String(sha256).toLowerCase()) {
      fs.rmSync(part, { force: true });
      throw new Error(T('файл повреждён при загрузке — нажмите «Повторить»'));
    }
    fs.rmSync(file, { force: true });
    fs.renameSync(part, file);
    return file;
  })();
}
// Лёгкое обновление: распаковать пакет в папку данных и перезапуститься.
function applyPatch(gzFile, version) {
  const dir = UPD_DIR();
  const buf = require('zlib').gunzipSync(fs.readFileSync(gzFile));
  const name = 'app-' + version + '.asar', target = path.join(dir, name);
  const noAsar = process.noAsar;
  process.noAsar = true; // пишем архив как обычный файл
  try { fs.writeFileSync(target + '.tmp', buf); fs.rmSync(target, { force: true }); fs.renameSync(target + '.tmp', target); }
  finally { process.noAsar = noAsar; }
  // проверка: архив читается и это нужная версия
  const pkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
  if (pkg.version !== version || pkg.shell !== SHELL) throw new Error(T('пакет обновления не подходит к этой версии'));
  // модуль чтения — рядом, обычными файлами (dotnet не читает из архива)
  let bridgeName = null;
  const src = path.join(target, 'bridge');
  if (fs.existsSync(path.join(src, 'AionDpsBridge.dll'))) {
    bridgeName = 'bridge-' + version;
    const out = path.join(dir, bridgeName);
    fs.mkdirSync(out, { recursive: true });
    for (const f of ['AionDpsBridge.dll', 'AionDpsBridge.runtimeconfig.json']) fs.writeFileSync(path.join(out, f), fs.readFileSync(path.join(src, f)));
  }
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ version, file: name, bridge: bridgeName, shell: SHELL }));
  // старые пакеты (кроме запущенного сейчас) больше не нужны
  const running = global.__aionBoot?.version;
  process.noAsar = true;
  try {
    for (const f of fs.readdirSync(dir)) {
      const m = /^(?:app|bridge)-(\d+\.\d+\.\d+)/.exec(f);
      if (m && m[1] !== version && m[1] !== running) { try { fs.rmSync(path.join(dir, f), { recursive: true, force: true }); } catch { /* занят */ } }
    }
  } finally { process.noAsar = noAsar; }
  fs.rmSync(gzFile, { force: true });
}
updater.download = async function () {
  const plan = updatePlan();
  if (!plan || this.state === 'downloading' || this.state === 'installing') return;
  this.state = 'downloading'; this.progress = 0; this.error = '';
  sendUpdate(); updateToast();
  try {
    fs.mkdirSync(UPD_DIR(), { recursive: true });
    const file = plan.kind === 'patch' ? path.join(UPD_DIR(), `patch-${plan.version}.gz`) : path.join(app.getPath('temp'), `AionDpsMeter-setup-${plan.version}.exe`);
    await fetchFile(plan.url, file, plan.sha256, p => { this.progress = p; sendUpdate(); });
    this.state = 'installing'; this.progress = 1; sendUpdate();
    settings.whatsNewFrom = APP_VERSION; save();
    if (plan.kind === 'patch') {
      applyPatch(file, plan.version);
      bridge.stop(); rpc.stop();
      setTimeout(() => { app.relaunch(); app.exit(0); }, 700);
    } else {
      // Установщик ставит новую версию в ту же папку, где программа сейчас (даже если её перенесли), и запускает её.
      const dir = path.dirname(process.execPath);
      spawn(file, ['/S', '/D=' + dir], { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true, argv0: `"${file}"` }).unref();
      setTimeout(() => app.quit(), 600);
    }
  } catch (e) {
    this.state = 'error'; this.error = e.message || String(e); sendUpdate();
  }
};

// ---------------------------------------------------------------- статус в Discord (Rich Presence)
// Нужен Application ID приложения «Aion DPS Meter» на discord.com/developers (картинка logo загружается туда же).
const DISCORD_APP_ID = '1559103936114327564'; // приложение «Aion DPS Meter» на discord.com/developers, картинка — logo
const rpc = {
  sock: null, ready: false, startAt: 0, lastKey: '', timer: null, retry: null,
  start() {
    if (!DISCORD_APP_ID || process.platform !== 'win32') return;
    if (!settings.discordRpc) return;
    this.connect(0);
  },
  connect(i) {
    clearTimeout(this.retry);
    if (i > 9) { this.retry = setTimeout(() => this.connect(0), 60000); return; }
    const net = require('net');
    const sock = net.createConnection('\\\\?\\pipe\\discord-ipc-' + i);
    sock.once('error', () => { sock.destroy(); this.connect(i + 1); });
    sock.once('connect', () => {
      this.sock = sock;
      this.send(0, { v: 1, client_id: DISCORD_APP_ID });
      sock.on('data', () => { if (!this.ready) { this.ready = true; this.lastKey = ''; this.update(); } });
      sock.on('close', () => { this.sock = null; this.ready = false; this.retry = setTimeout(() => this.connect(0), 30000); });
    });
  },
  send(op, obj) {
    if (!this.sock) return;
    const body = Buffer.from(JSON.stringify(obj));
    const head = Buffer.alloc(8); head.writeInt32LE(op, 0); head.writeInt32LE(body.length, 4);
    try { this.sock.write(Buffer.concat([head, body])); } catch { /* Discord закрыт */ }
  },
  activity() {
    if (!settings.discordRpc) return null;
    const s = lastSnap;
    const assets = { large_image: 'logo', large_text: 'Aion DPS Meter · ' + T('Счётчик урона для AION 2') };
    const server = currentServer();
    if (s && s.active && s.players?.length) {
      if (!this.startAt) this.startAt = Date.now() - (s.combatMs || 0);
      // Aion DPS Meter · Бой с боссом · «Имя босса» · 02:14 — время Discord считает сам от начала боя.
      const target = s.boss?.name || s.target?.name;
      return { details: s.boss ? T('Бой с боссом') : T('В бою'), state: target ? String(target).slice(0, 120) : undefined, timestamps: { start: this.startAt }, assets };
    }
    this.startAt = 0;
    return { details: status.state === 'Capturing' ? T('Ждёт боя') : T('Не в игре'), state: server ? 'AION 2 · ' + server : 'AION 2', assets };
  },
  update() {
    if (!this.ready) { if (settings.discordRpc && !this.sock && DISCORD_APP_ID) this.start(); return; }
    if (this.timer) return; // не чаще раза в 1,5 с
    this.timer = setTimeout(() => {
      this.timer = null;
      const act = this.activity();
      const key = JSON.stringify(act);
      if (key === this.lastKey) return;
      this.lastKey = key; this.sentAt = Date.now();
      this.send(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: act || undefined }, nonce: String(Date.now()) });
    }, 1500);
  },
  stop() { try { if (this.ready) this.send(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid }, nonce: 'x' }); this.sock?.end(); } catch { /* ignore */ } },
};

// ---------------------------------------------------------------- запуск
let tray = null;
const { tr: trLang } = require('./renderer/i18n.js');
const T = s => trLang(s, settings.lang);
function buildTray() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: T('показать / скрыть оверлей').replace(/^./, c => c.toUpperCase()), click: toggleOverlay },
    { label: T('Главное окно'), click: () => openMain() },
    { label: T('Расписание'), click: openSchedule },
    { type: 'separator' },
    { label: T('Выход'), click: () => app.quit() },
  ]));
}
app.whenReady().then(() => {
  if (firstRun) patchSettings({ whatsNewSeen: APP_VERSION }); // при первой установке «Что нового» не нужно
  if (settings.overlay.visible !== false) openOverlay();
  if (!process.argv.includes('--hidden')) openMain();
  bridge.start();

  tray = new Tray(nativeImage.createFromPath(path.join(ASSETS, 'tray.png')));
  tray.setToolTip('Aion DPS Meter');
  buildTray();
  tray.on('click', () => openMain());

  registerHotkeys();

  rpc.start();
  setInterval(checkSchedule, 5000);
  setTimeout(() => updateFeed(false), 4000);
  // загрузчик: эта версия запустилась нормально (иначе после двух неудач он вернётся к встроенной)
  setTimeout(() => { try { global.__aionBoot?.ok?.(); } catch { /* ignore */ } }, 15000);
  setInterval(() => updateFeed(false), 3 * 3600 * 1000);
});
// Повторный запуск: второй экземпляр закрывается, а этот открывает главное окно и показывает уведомление.
app.on('second-instance', () => {
  openMain();
  showToast({ key: 'dup' + Date.now(), name: 'Aion DPS Meter уже запущен', type: 'info', icon: 'app', start: null, text: 'Окно программы открыто' });
});
app.on('window-all-closed', () => { /* программа живёт в трее */ });
app.on('before-quit', () => { for (const w of Object.values(wins)) if (w && !w.isDestroyed() && w.__keep) w.__keep(); saveNow(); });
app.on('will-quit', () => { saveNow(); globalShortcut.unregisterAll(); bridge.stop(); rpc.stop(); });
