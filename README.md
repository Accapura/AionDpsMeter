<div align="center">

<img src="docs/screenshots/hero-ru.png" alt="Aion DPS Meter" width="100%">

# Aion DPS Meter

**Счётчик урона, расписание ивентов и статистика боёв для AION 2**

[![Версия](https://img.shields.io/github/v/release/Accapura/AionDpsMeter?label=%D0%B2%D0%B5%D1%80%D1%81%D0%B8%D1%8F&color=ffc66b&style=for-the-badge)](https://github.com/Accapura/AionDpsMeter/releases/latest)
[![Скачать](https://img.shields.io/badge/%D1%81%D0%BA%D0%B0%D1%87%D0%B0%D1%82%D1%8C-Windows%20x64-7c5cff?style=for-the-badge&logo=windows)](https://github.com/Accapura/AionDpsMeter/releases/latest)
[![Лицензия](https://img.shields.io/badge/%D0%BB%D0%B8%D1%86%D0%B5%D0%BD%D0%B7%D0%B8%D1%8F-GPL--3.0-3a3058?style=for-the-badge)](LICENSE)

**Русский** · [English](README.en.md)

</div>

---

## ✨ Возможности

| | |
|---|---|
| ⚔️ **Оверлей поверх игры** | DPS, урон, доля, крит и лечение каждого игрока группы в реальном времени. HP босса, таймер боя, сравнение с вашим рекордом. Режимы «Данж: Босс», «Мир: Босс», «Моб». |
| 🎯 **«Только я»** | Крупно свой DPS, место в группе, урон, доля и крит — вместо списка. |
| 📅 **Расписание** | Ивенты, разломы и мировые боссы по времени выбранного сервера, напоминания за 15 / 5 / 1 минуту, свои ивенты, таймеры полевых боссов прямо из игры. |
| 📈 **Статистика** | История боёв, график DPS по секундам с фазами босса, сравнение двух боёв, рекорды по боссам, DPS по классам. |
| ☠️ **Разбор смерти** | Кто и чем ударил за последние 12 секунд перед смертью. |
| 💬 **Discord** | Статус «Бой с боссом» в профиле и отправка итога боя в канал гильдии одной кнопкой. |
| ⚡ **Лёгкие обновления** | Новые версии (~1,5 МБ) скачиваются и ставятся сами за пару секунд. |
| 🎨 **Оформление** | 11 тем, 5 стилей уведомлений, русский и английский язык. |

## 📸 Скриншоты

<table>
<tr>
<td width="50%"><img src="docs/screenshots/ru-overlay.png" alt="Оверлей"><br><sub><b>Оверлей</b> — урон группы в бою</sub></td>
<td width="50%"><img src="docs/screenshots/ru-solo.png" alt="Только я"><br><sub><b>«Только я»</b> — свой DPS и место</sub><br><br><img src="docs/screenshots/ru-toast.png" alt="Обновление"><br><sub><b>Обновление</b> — одной кнопкой</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/ru-chart.png" alt="График боя"><br><sub><b>График боя</b> — DPS по секундам, HP босса и фазы</sub></td>
<td><img src="docs/screenshots/ru-compare.png" alt="Сравнение боёв"><br><sub><b>Сравнение боёв</b> — где потерян урон</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/ru-death.png" alt="Разбор смерти"><br><sub><b>Разбор смерти</b> — последние 12 секунд</sub></td>
<td><img src="docs/screenshots/ru-schedule.png" alt="Расписание"><br><sub><b>Расписание</b> — ивенты по времени сервера</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/ru-settings.png" alt="Настройки"><br><sub><b>Настройки</b> — уведомления и Discord-канал</sub></td>
<td><img src="docs/screenshots/ru-whatsnew.png" alt="Что нового"><br><sub><b>«Что нового»</b> после обновления</sub></td>
</tr>
</table>

<p align="center"><img src="docs/screenshots/ru-installer.png" alt="Установщик" width="100%"><br><sub><b>Установщик</b> в стиле программы</sub></p>

## 📥 Установка

1. Скачайте установщик **`AionDpsMeter.vX.Y.Z.exe`** со страницы [**Releases**](https://github.com/Accapura/AionDpsMeter/releases/latest) и запустите.
2. Выберите язык, примите соглашение и папку — программа появится в меню «Пуск».
3. Для чтения боя нужны (установщик сам проверит и даст ссылки):
   - [**Npcap**](https://npcap.com/#download) — драйвер захвата трафика, ставьте с настройками по умолчанию;
   - [**.NET 10 Runtime**](https://dotnet.microsoft.com/download/dotnet/10.0) — для модуля чтения боя (Windows x64).
4. Запускайте Aion DPS Meter **до входа в подземелье** — имена игроков игра присылает на экране загрузки.

**Поддерживаемые клиенты:** AION 2 Global · Steam, AION 2 Global · PURPLE. Windows 10 / 11 x64.

Дальше программа обновляется сама: появится уведомление «Доступно обновление» — нажмите **«Обновить сейчас»**.

## ⌨️ Горячие клавиши

| Сочетание | Действие |
|---|---|
| `Ctrl+Shift+D` | показать / скрыть оверлей |
| `Ctrl+Shift+L` | закрепить оверлей (клики проходят сквозь) |
| `Ctrl+Shift+R` | начать подсчёт заново |
| `Ctrl+Shift+C` | поделиться итогом боя (картинка и текст, или в Discord-канал) |
| `Ctrl+Shift+1` / `2` / `3` | режим «Данж: Босс» / «Мир: Босс» / «Моб» |
| `Ctrl+Shift+M` | следующий режим по кругу |

Любое сочетание меняется в «Оверлей → Горячие клавиши».

## 🛡️ Как это работает

Aion DPS Meter **только читает** сетевой трафик игры на вашем компьютере (через Npcap): ничего не отправляет в игру, не читает и не изменяет её память и файлы.

> [!IMPORTANT]
> Программа не связана с NCSoft и не одобрена ею. NCSoft публично не запрещала такие счётчики урона, но и официального разрешения не давала — вы используете программу на свой страх и риск в отношении условий обслуживания NCSoft. Если NCSoft объявит запрет, чтение боя будет отключено обновлением. AION 2, названия и эмблемы классов — собственность NCSoft.

## 🔧 Сборка из исходников

```
app/      — программа (Electron 33): окна, оверлей, расписание, статистика
bridge/   — модуль чтения боя (.NET 10): разбор пакетов игры, JSON в stdout
setup/    — установщик (NSIS) и лёгкие обновления
```

```bash
# модуль чтения
cd bridge && dotnet publish -c Release -o ../bridge-out -p:UseAppHost=false
# программа (для запуска из исходников)
cd app && npm install && npm start
# установщик: art.py рисует графику, gen.py собирает setup.nsi, затем makensis
cd setup && python3 art.py <версия> && python3 gen.py <версия> <папка_с_программой> && makensis setup.nsi
```

## 🙏 Благодарности и лицензии

Aion DPS Meter распространяется по лицензии **GNU GPL v3** — см. [LICENSE](LICENSE).

- **AionMeter.Core** — [cyberbadger6969/aion2-dps-meter](https://github.com/cyberbadger6969/aion2-dps-meter) (GPL-3.0) — разбор протокола игры.
- Таблицы данных игры — [taengu/A2Tools-DPS-Meter](https://github.com/taengu/A2Tools-DPS-Meter) (GPL-3.0); id лечащих навыков и эмблемы классов — [Kuroukihime/AIon2-Dps-Meter](https://github.com/Kuroukihime/AIon2-Dps-Meter) (GPL-3.0). Данные игры AION 2 © NCSOFT.
- SharpPcap, PacketDotNet (MIT), Electron (MIT), Chromium, шрифт Manrope (SIL OFL 1.1).

## 💬 Автор

<table><tr>
<td><img src="app/assets/logo.png" width="72" alt=""></td>
<td><b>Accapura</b><br>Разработка, идеи и поддержка<br>Discord: <b>Accapura</b> · <a href="https://discord.com/users/256419758369538048">написать</a></td>
</tr></table>

Нашли ошибку? В программе: **«Настройки» → «Отчёт об ошибке»** — пришлите файл автору в Discord или откройте [Issue](https://github.com/Accapura/AionDpsMeter/issues).
