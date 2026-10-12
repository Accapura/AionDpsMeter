#!/bin/sh
# Лёгкое обновление: архив программы (app.asar) + модуль чтения, сжатый gzip. Использование: patch.sh <папка app> <папка bridge-out> <выход.gz>
set -e
APP="$1"; BR="$2"; OUT="$3"
T=$(mktemp -d)
mkdir -p "$T/src/bridge"
cp -r "$APP/assets" "$APP/data" "$APP/renderer" "$APP/boot.js" "$APP/main.js" "$APP/preload.js" "$APP/package.json" "$T/src/"
cp "$BR/AionDpsBridge.dll" "$BR/AionDpsBridge.runtimeconfig.json" "$T/src/bridge/"
node /tmp/apptest/node_modules/@electron/asar/bin/asar.js pack "$T/src" "$T/app.asar"
gzip -9 -n -c "$T/app.asar" > "$OUT"
rm -rf "$T"
