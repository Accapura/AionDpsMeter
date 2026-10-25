// Aion DPS Meter — загрузчик. Автор: Accapura. GPL-3.0.
// Запускает самую новую исправную версию программы: встроенную или скачанную «лёгким обновлением»
// (файл app-<версия>.asar в папке данных пользователя). Лёгкое обновление не трогает папку установки,
// поэтому работает где бы ни лежала программа и без прав администратора.
'use strict';
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const BASE = require('./package.json');
const newer = (a, b) => { const x = String(a).split('-')[0].split('.').map(Number), y = String(b).split('-')[0].split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

function pick() {
  const dir = path.join(app.getPath('userData'), 'updates');
  const stateFile = path.join(dir, 'state.json');
  let st;
  try { st = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return null; }
  const save = () => { try { fs.writeFileSync(stateFile, JSON.stringify(st)); } catch { /* не критично */ } };
  const asar = st && st.file ? path.join(dir, st.file) : '';
  const usable = st && st.version && newer(st.version, BASE.version) && st.shell === BASE.shell && !(st.bad || []).includes(st.version) && fs.existsSync(asar);
  if (!usable) {
    // обновление устарело (поставили новую версию целиком) или не подходит — убираем
    if (st && st.version && !newer(st.version, BASE.version)) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } }
    return null;
  }
  // Защита: если эта версия дважды не дошла до открытого окна — возвращаемся к встроенной.
  st.tries = st.booting === st.version ? (st.tries || 0) + 1 : 1;
  if (st.tries > 2) { st.bad = [...(st.bad || []), st.version]; st.booting = ''; save(); return null; }
  st.booting = st.version;
  save();
  const bridge = st.bridge && fs.existsSync(path.join(dir, st.bridge, 'AionDpsBridge.dll')) ? path.join(dir, st.bridge) : null;
  return {
    version: st.version, root: asar, bridge,
    ok() { st.booting = ''; st.tries = 0; save(); },
  };
}

let chosen = null;
try { chosen = pick(); } catch { chosen = null; }
global.__aionBoot = chosen
  ? { version: chosen.version, base: BASE.version, bridge: chosen.bridge, ok: chosen.ok }
  : { version: BASE.version, base: BASE.version, bridge: null, ok() { /* встроенная версия */ } };
if (chosen) {
  try { require(path.join(chosen.root, 'main.js')); }
  catch (e) {
    global.__aionBoot = { version: BASE.version, base: BASE.version, bridge: null, ok() {}, failed: String(e && e.message || e) };
    require('./main.js');
  }
} else require('./main.js');
