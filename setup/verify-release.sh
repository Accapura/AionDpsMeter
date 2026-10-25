#!/bin/sh
# Проверка опубликованного релиза: ./verify-release.sh 1.3.3  (нужен gh и git в папке репозитория)
V="$1"; [ -z "$V" ] && { echo "версия?"; exit 1; }
R=Accapura/AionDpsMeter; T="v$V"; bad=0
fail(){ echo "ОШИБКА: $1"; bad=1; }
gh api repos/$R/releases/tags/$T >/dev/null 2>&1 || { echo "релиза $T нет (проверь регистр: нужна строчная v)"; exit 1; }
tc=$(gh api repos/$R/git/ref/tags/$T --jq .object.sha); 
tcc=$(gh api repos/$R/commits/$T --jq .sha); mc=$(gh api repos/$R/commits/main --jq .sha)
[ "$tcc" = "$mc" ] || fail "тег $T на $tcc, а main на $mc"
gh api repos/$R/releases/tags/$T --jq '.assets[]|"\(.name) \(.size) \(.digest)"' > /tmp/assets.txt; cat /tmp/assets.txt
grep -q "AionDpsMeter.v$V.exe" /tmp/assets.txt || fail "нет exe версии $V"
grep -q "source-$V.zip" /tmp/assets.txt || fail "нет исходников версии $V"
grep -v "$V" /tmp/assets.txt | grep . && fail "в релизе файлы чужой версии"
F=$(gh api repos/$R/contents/schedule-feed.json --jq .content | base64 -d)
fv=$(echo "$F" | python3 -c 'import json,sys;print(json.load(sys.stdin)["app"]["version"])')
[ "$fv" = "$V" ] || fail "лента указывает на $fv"
fs=$(echo "$F" | python3 -c 'import json,sys;a=json.load(sys.stdin)["app"];print(a["size"],a["sha256"])')
grep "AionDpsMeter.v$V.exe" /tmp/assets.txt | awk -v s="$fs" '{split(s,a," "); if($2!=a[1]||$3!="sha256:"a[2]) print "ОШИБКА: размер/хеш не совпадают с лентой"}'
[ $bad = 0 ] && echo "ВСЁ ВЕРНО для $T"
