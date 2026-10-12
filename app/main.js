// Aion DPS Meter — счётчик урона для AION 2. Автор: Accapura.
// Главный процесс: окна, настройки, мост чтения трафика (Npcap), расписание и уведомления.
'use strict';

const { app, BrowserWindow, ipcMain, screen, globalShortcut, Tray, Menu, nativeImage, shell, net, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
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
  hotkeys: { overlay: 'Ctrl+Shift+D', lock: 'Ctrl+Shift+L', reset: 'Ctrl+Shift+R', share: 'Ctrl+Shift+C', modeBoss: 'Ctrl+Shift+1', modeWorld: 'Ctrl+Shift+2', modeMob: 'Ctrl+Shift+3', modeNext: 'Ctrl+Shift+M' }, // меняются в «Оверлей»
  clickThrough: false,
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
  columns: { crit: false, hits: false, maxHit: false, hps: false }, // доп. колонки оверлея
  seenFeedIds: [],
  whatsNewSeen: '',             // версия, для которой уже показали «Что нового»
  whatsNewFrom: '',             // с какой версии обновлялись (для списка изменений)
  deathToast: true,             // уведомление с разбором смерти
  webhook: { url: '', on: false }, // отправка итога боя в Discord-канал
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
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.mkdirSync(path.dirname(SETTINGS_FILE()), { recursive: true }); fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(settings, null, 2)); } catch { /* не критично */ }
  }, 300);
}
// Профили оверлея: у «Данж: Босс», «Мир: Босс» и «Моб» свои список, прозрачность, колонки и размер.
const PROFILE_KEYS = ['count', 'opacity', 'columns', 'showHeader', 'solo', 'compact'];
function profileOf() {
  const p = {};
  for (const k of PROFILE_KEYS) p[k] = clone(settings[k]);
  const ow = settings.overlay;
  if (ow.width && ow.height) p.size = { width: ow.width, height: ow.height };
  return p;
}
function applyProfile(mode) {
  const p = settings.profiles[mode];
  if (!p) return;
  for (const k of PROFILE_KEYS) if (p[k] !== undefined) settings[k] = clone(p[k]);
  const w = wins.overlay;
  if (p.size && w && !w.isDestroyed()) {
    const b = w.getBounds();
    w.setBounds({ x: b.x, y: b.y, width: p.size.width, height: p.size.height });
    settings.overlay = { ...settings.overlay, width: p.size.width, height: p.size.height };
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
  save();
  broadcast('settings', settings);
  if (settings.mode !== prevMode) bridge.setMode(settings.mode);
  if (settings.scale !== prevScale) for (const w of Object.values(wins)) if (w && !w.isDestroyed()) w.webContents.setZoomFactor(settings.scale / 100);
  if ('clickThrough' in patch) applyClickThrough();
  if ('autoHide' in patch) applyOverlayVisibility();
  if ('discordRpc' in patch) rpc.update();
  if ('lang' in patch) { bridge.send('lang ' + settings.lang); buildTray(); broadcastSchedule(); }
  if (patch.hotkeys) registerHotkeys();
  if (['server', 'serverId', 'serverAuto', 'region', 'events', 'bells', 'timeMode'].some(k => k in patch)) broadcastSchedule();
}

// ---------------------------------------------------------------- окна
const wins = {};
function broadcast(ch, data) { for (const w of Object.values(wins)) if (w && !w.isDestroyed()) w.webContents.send(ch, data); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function makeWindow(name, opts, file) {
  const old = wins[name];
  if (old && !old.isDestroyed()) { if (!opts.showInactive) { old.show(); old.focus(); } return old; }
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
  const visible = r.x != null && screen.getAllDisplays().some(d => {
    const a = d.workArea;
    return r.x + 60 > a.x && r.x < a.x + a.width - 60 && r.y >= a.y - 10 && r.y < a.y + a.height - 40;
  });
  if (!visible) { r.x = wa.x + wa.width - r.width - 24; r.y = wa.y + Math.round(wa.height * 0.18); }
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
  w.on('show', () => w.webContents.send('snap', lastSnap)); // пока оверлей скрыт, снимки ему не шлём
  const keep = () => {
    if (w.isDestroyed()) return;
    const r = w.getBounds();
    settings.overlay = { ...settings.overlay, x: r.x, y: r.y, width: r.width, height: r.height };
    if (settings.profilesOn) settings.profiles[settings.mode] = profileOf();
    save();
  };
  w.on('moved', keep);
  w.on('resized', keep);
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
let breakdownActor = null;
function openBreakdown(actor) {
  breakdownActor = actor;
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
      else if (m.t === 'fg') { fgState = m.state; applyOverlayVisibility(); }
      else if (m.t === 'fieldbosses') onFieldBosses(m);
      else if (m.t === 'detail') broadcast('detail', m);
      else if (m.t === 'fight') addFight(m);
      else if (m.t === 'death') addDeath(m);
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
const FIGHTS_FILE = () => path.join(app.getPath('userData'), 'fights.json');
let fights = null;
function loadFights() { if (!fights) { try { fights = JSON.parse(fs.readFileSync(FIGHTS_FILE(), 'utf8')); } catch { fights = []; } } return fights; }
function addFight(f) {
  loadFights();
  if (fights.some(x => x.id === f.id)) return;
  fights.unshift(f);
  fights.length = Math.min(fights.length, 500);
  try { fs.writeFileSync(FIGHTS_FILE(), JSON.stringify(fights)); } catch { /* не критично */ }
  broadcast('fights', fights);
  broadcast('records', records());
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
const HOTKEY_DEFAULTS = { overlay: 'Ctrl+Shift+D', lock: 'Ctrl+Shift+L', reset: 'Ctrl+Shift+R', share: 'Ctrl+Shift+C', modeBoss: 'Ctrl+Shift+1', modeWorld: 'Ctrl+Shift+2', modeMob: 'Ctrl+Shift+3', modeNext: 'Ctrl+Shift+M' };
const HOTKEY_ACTIONS = {
  overlay: () => toggleOverlay(),
  lock: () => patchSettings({ clickThrough: !settings.clickThrough }),
  reset: () => bridge.reset(),
  share: () => shareFight(),
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
    if (!ok) hotkeyErrors[id] = 'Сочетание ' + acc + ' занято другой программой или недопустимо';
  }
  broadcast('hotkey-errors', hotkeyErrors);
}
ipcMain.on('hotkeys-pause', (_e, on) => { if (on) globalShortcut.unregisterAll(); else registerHotkeys(); });

// ---------------------------------------------------------------- IPC
ipcMain.handle('get-state', () => ({ settings, status, snap: lastSnap, bossLog, version: APP_VERSION, records: records(), whatsNew: whatsNew(), update: updateInfo(), rpcAvailable: !!DISCORD_APP_ID }));
ipcMain.handle('schedule-data', () => scheduleData());
ipcMain.handle('fights', () => loadFights());
ipcMain.handle('deaths', () => loadDeaths());
ipcMain.on('deaths-clear', () => { deaths = []; try { fs.writeFileSync(DEATHS_FILE(), '[]'); } catch { /* ignore */ } broadcast('deaths', deaths); });
ipcMain.handle('whats-new', () => whatsNew());
ipcMain.on('whats-new-seen', () => patchSettings({ whatsNewSeen: APP_VERSION, whatsNewFrom: '' }));
ipcMain.handle('report', () => saveReport());
ipcMain.handle('webhook-test', (_e, url) => webhookSend(url, { content: T('Aion DPS Meter подключён к этому каналу ✓') }));
ipcMain.on('fights-clear', () => { fights = []; try { fs.writeFileSync(FIGHTS_FILE(), '[]'); } catch { /* ignore */ } broadcast('fights', fights); broadcast('records', {}); });
ipcMain.on('share', (_e, fightId) => shareFight(fightId));
ipcMain.handle('update-check', async () => { await updateFeed(true); return updateInfo(); });
ipcMain.on('update-install', () => updater.download());
ipcMain.on('update-skip', (_e, v) => patchSettings({ updateSkip: String(v || '') }));
ipcMain.on('detail', (_e, id) => bridge.send('detail ' + (Number(id) >>> 0)));

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
  if (!w.isDestroyed()) w.setResizable(wasResizable);
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
async function shareFight(fightId) {
  let f = fightId ? loadFights().find(x => x.id === fightId) : null;
  if (!f && lastSnap && lastSnap.players?.length) {
    const s = lastSnap;
    f = { boss: s.boss?.name || s.target?.name, title: s.title, combatMs: s.combatMs, partyDps: s.partyDps, players: s.players };
  }
  if (!f) { showToast({ key: 'share' + Date.now(), name: 'Нечем поделиться', type: 'info', icon: 'info', start: null, text: 'Сначала проведите бой' }); return; }
  const data = { text: fightText(f) };
  const ov = wins.overlay;
  if (!fightId && ov && !ov.isDestroyed() && ov.isVisible()) {
    try { data.image = await ov.webContents.capturePage(); } catch { /* только текст */ }
  }
  clipboard.write(data);
  if (settings.webhook?.on && WEBHOOK_RE.test(settings.webhook.url || '')) {
    const r = await webhookSend(settings.webhook.url, fightEmbed(f), data.image ? data.image.toPNG() : null);
    showToast({ key: 'share' + Date.now(), name: r.ok ? T('Итог боя отправлен в Discord') : T('Не удалось отправить в Discord'), type: 'info', icon: 'discord', start: null, text: r.ok ? T('И скопирован: Ctrl+V') : r.error });
    return;
  }
  showToast({ key: 'share' + Date.now(), name: 'Итог боя скопирован', type: 'info', icon: 'app', start: null, text: data.image ? 'Картинка и текст · Ctrl+V' : 'Текст · Ctrl+V' });
}

// ---------------------------------------------------------------- отправка в Discord-канал (вебхук канала)
const WEBHOOK_RE = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;
const padR = (t, n) => { t = String(t); return t.length >= n ? t.slice(0, n) : t + ' '.repeat(n - t.length); };
const padL = (t, n) => { t = String(t); return t.length >= n ? t : ' '.repeat(n - t.length) + t; };
function fightEmbed(f) {
  const ps = (f.players || []).filter(p => p.dmg > 0).slice(0, 12);
  const rows = ps.map((p, i) => `${padL(i + 1, 2)} ${padR(p.name + (p.self ? '*' : ''), 16)} ${padL(nf(p.dps), 7)} ${padL(nf(p.dmg), 7)} ${padL(((p.share || 0) * 100).toFixed(1).replace('.', settings.lang === 'en' ? '.' : ','), 5)}`);
  const table = '```\n' + [` # ${padR(T('Игрок'), 16)} ${padL('DPS', 7)} ${padL(T('Урон'), 7)} ${padL('%', 5)}`, ...rows].join('\n') + '\n```';
  const embed = {
    title: '⚔ ' + (f.boss || f.title || T('Бой')),
    description: `${T('Время боя')}: **${mmss(f.combatMs)}** · ${T('DPS группы')}: **${nf(f.partyDps)}**\n${table}`,
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
    const r = await fetch(url, png ? { method: 'POST', body, signal: AbortSignal.timeout(20000) }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
    if (r.status === 404 || r.status === 401) return { ok: false, error: T('Вебхук не найден — создайте новую ссылку в настройках канала') };
    if (!r.ok) return { ok: false, error: 'Discord: ' + r.status };
    return { ok: true };
  } catch (e) { return { ok: false, error: T('нет связи с Discord') }; }
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
// Скачивание с докачкой: url → file (с проверкой SHA-256)
function fetchFile(url, file, sha256, onProgress) {
  return new Promise((resolve, reject) => {
    const part = file + '.part';
    const get = (u, hops = 0) => {
      if (!UPDATE_HOSTS.test(u) && hops === 0) return reject(new Error(T('недопустимый адрес обновления')));
      if (hops > 6) return reject(new Error(T('недопустимый адрес обновления')));
      let have = 0;
      try { have = fs.statSync(part).size; } catch { /* нет части */ }
      const req = https.get(u, { headers: { 'User-Agent': 'AionDpsMeter/' + APP_VERSION, ...(have ? { Range: `bytes=${have}-` } : {}) }, timeout: 30000 }, res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) { res.resume(); return get(new URL(res.headers.location, u).href, hops + 1); }
        if (res.statusCode === 416) { res.resume(); return done(); }
        if (res.statusCode !== 200 && res.statusCode !== 206) { res.resume(); return reject(new Error(T('сервер ответил') + ' ' + res.statusCode)); }
        if (res.statusCode === 200) have = 0;
        const total = have + Number(res.headers['content-length'] || 0);
        const out = fs.createWriteStream(part, { flags: have ? 'a' : 'w' });
        let got = have, lastSent = 0;
        res.on('data', c => { got += c.length; if (total && Date.now() - lastSent > 250) { lastSent = Date.now(); onProgress(got / total); } });
        res.pipe(out);
        out.on('finish', done);
        res.on('error', () => reject(new Error(T('связь прервалась — нажмите «Повторить», загрузка продолжится'))));
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', () => reject(new Error(T('связь прервалась — нажмите «Повторить», загрузка продолжится'))));
    };
    const done = () => {
      try {
        const buf = fs.readFileSync(part);
        if (sha256 && require('crypto').createHash('sha256').update(buf).digest('hex').toLowerCase() !== String(sha256).toLowerCase()) {
          fs.rmSync(part, { force: true });
          return reject(new Error(T('файл повреждён при загрузке — нажмите «Повторить»')));
        }
        fs.rmSync(file, { force: true });
        fs.renameSync(part, file);
        resolve(file);
      } catch (e) { reject(e); }
    };
    get(url);
  });
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
  openMain();
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
app.on('will-quit', () => { globalShortcut.unregisterAll(); bridge.stop(); rpc.stop(); });
