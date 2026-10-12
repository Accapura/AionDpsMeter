'use strict';
// Язык интерфейса. Окна рисуются по-русски, а при выборе English текст
// переводится прямо в документе: точные фразы — по словарю, составные строки —
// по шаблонам и кусочкам. Работает и в главном процессе (меню трея).
(function (root) {
  const EXACT = {
    'Уведомление об обновлении без мигания': 'Update notification no longer flickers', 'Карточка больше не перерисовывается каждую секунду — плавное появление один раз, подсветка кнопок не сбрасывается': 'The card is no longer redrawn every second — it fades in once and button highlights stay put',
    'Кнопки панели оверлея наверху': 'Overlay panel buttons on top', '«Главное окно», «Размер по умолчанию» и «Расписание» — сразу под шестерёнкой': '“Main window”, “Default size” and “Schedule” — right under the gear',
    'Горячие клавиши режимов': 'Mode hotkeys', 'Ctrl+Shift+1 / 2 / 3 — «Данж: Босс», «Мир: Босс», «Моб»; Ctrl+Shift+M — по кругу': 'Ctrl+Shift+1 / 2 / 3 — “Dungeon: Boss”, “World: Boss”, “Mobs”; Ctrl+Shift+M — cycle',
    'режим «Данж: Босс»': 'mode “Dungeon: Boss”', 'режим «Мир: Босс»': 'mode “World: Boss”', 'режим «Моб»': 'mode “Mobs”', 'следующий режим по кругу': 'next mode (cycle)',
    'За секунды, без установщика': 'In seconds, no installer', 'Через установщик, в ту же папку': 'Via the installer, same folder',
    'Доступно обновление': 'Update available', 'Что нового ›': 'What’s new ›',
    'Отчёт об ошибке': 'Error report',
    'Что-то не работает? «Отчёт об ошибке» сохранит на рабочий стол файл с версией, состоянием чтения и последними сообщениями — отправьте его автору в Discord.': 'Something is not working? “Error report” saves a file with the version, reader state and recent messages to your desktop — send it to the author on Discord.',
    'Разбор смерти': 'Death recap',
    '— уведомление, кто и чем добил персонажа, с кнопкой «Разбор»': '— a notification with who killed your character and with what, plus a “Recap” button',
    'Итог боя в Discord-канал': 'Fight summary to a Discord channel',
    'Вставьте ссылку вебхука канала — и кнопка «Поделиться»': 'Paste the channel webhook link — the “Share” button and',
    'будут отправлять таблицу боя прямо в чат гильдии.': 'will post the fight table straight to your guild chat.',
    'Проверить': 'Test',
    'Отправлять в канал': 'Send to the channel',
    'при нажатии «Поделиться»': 'when you press “Share”',
    'Где взять ссылку': 'Where to get the link',
    'В Discord откройте настройки канала → «Интеграции» → «Вебхуки».': 'In Discord open the channel settings → “Integrations” → “Webhooks”.',
    'Нажмите «Новый вебхук», затем «Копировать URL вебхука».': 'Click “New Webhook”, then “Copy Webhook URL”.',
    'Вставьте ссылку сюда и нажмите «Проверить» — в канале появится сообщение.': 'Paste the link here and click “Test” — a message will appear in the channel.',
    'Ссылка хранится только на этом компьютере. Кто знает ссылку, может писать в канал — не публикуйте её.': 'The link is stored only on this computer. Anyone who has it can post to the channel — do not share it.',
    'Это не ссылка вебхука Discord': 'This is not a Discord webhook link',
    'Отправляю…': 'Sending…',
    'Готово — сообщение появилось в канале': 'Done — the message is in the channel',
    'Собираю…': 'Collecting…',
    'Сравнение': 'Compare',
    'Сравнить': 'Compare',
    'График боя · DPS по секундам': 'Fight chart · DPS per second',
    'Группа': 'Group',
    'Вы': 'You',
    'HP босса': 'Boss HP',
    'Сглажено за 5 секунд. Пунктир — HP босса, вертикальные линии — фазы 75 / 50 / 25 %.': 'Smoothed over 5 seconds. Dashed line — boss HP, vertical lines — phases 75 / 50 / 25 %.',
    'А': 'A',
    'Б': 'B',
    'Бой А': 'Fight A',
    'Бой Б': 'Fight B',
    'С чем сравнить (тот же босс)': 'Compare with (same boss)',
    'Разница': 'Difference',
    'Ваш урон': 'Your damage',
    'Ваш DPS по секундам': 'Your DPS per second',
    'Навыки: урон в секунду боя': 'Skills: damage per second of fight',
    'Урон навыка, делённый на длительность боя, — так бои разной длины сравниваются честно.': 'Skill damage divided by fight length — so fights of different length compare fairly.',
    'Для сравнения нужно хотя бы два ваших боя с одним и тем же боссом.': 'To compare you need at least two of your fights against the same boss.',
    'Больше всего урона в секунду потеряно на:': 'Most damage per second was lost on:',
    'нет в А': 'not in A',
    'нет в Б': 'not in B',
    'Где': 'Where',
    'Добивающий удар': 'Killing blow',
    'Урон за 12 с': 'Damage in 12 s',
    'Очистить': 'Clear',
    '← Ко всем смертям': '← All deaths',
    'Получено урона за 12 с': 'Damage taken in 12 s',
    'Лечение за 12 с': 'Healing in 12 s',
    'Удар': 'Hit',
    'Критический удар': 'Critical hit',
    'Больше всего урона:': 'Most damage from:',
    'Удары по порядку': 'Hits in order',
    'До смерти': 'Before death',
    'Кто': 'Who',
    'Урон / лечение': 'Damage / healing',
    'крит': 'crit',
    'Смерть': 'Death',
    'Смертей пока не было — так держать!': 'No deaths yet — keep it up!',
    'Когда персонаж погибнет, здесь появится, кто и чем ударил за последние 12 секунд.': 'When your character dies, you will see here who hit you and with what during the last 12 seconds.',
    'Лёгкое обновление: скачается за секунды и поставится само, без установщика.': 'Light update: downloads in seconds and installs itself, no installer needed.',
    'Скачается установщик и поставит новую версию в ту же папку.': 'The installer will be downloaded and will put the new version into the same folder.',
    'Обновление установлено': 'Update installed',
    'Что нового в версии': 'What’s new in version',
    'Отлично': 'Great',
    'Что нового': 'What’s new',
    'Обновление': 'Update',
    'Позже': 'Later',
    'Загрузка': 'Downloading',
    'Перезапуск…': 'Restarting…',
    'Лёгкое обновление': 'Light update',
    'Установщик': 'Installer',
    'пакет обновления не подходит к этой версии': 'the update package does not fit this version',
    'Ваш персонаж погиб': 'Your character died',
    'Разбор — в «Статистике»': 'Recap is in “Statistics”',
    'Разбор': 'Recap',
    'Итог боя отправлен в Discord': 'Fight summary sent to Discord',
    'Не удалось отправить в Discord': 'Could not send to Discord',
    'И скопирован: Ctrl+V': 'Also copied: Ctrl+V',
    'Неверная ссылка вебхука': 'Invalid webhook link',
    'Вебхук не найден — создайте новую ссылку в настройках канала': 'Webhook not found — create a new link in the channel settings',
    'нет связи с Discord': 'no connection to Discord',
    'Aion DPS Meter подключён к этому каналу ✓': 'Aion DPS Meter is connected to this channel ✓',
    'Отчёт сохранён на рабочем столе': 'Report saved to the desktop',
    'Отправьте файл автору в Discord': 'Send the file to the author on Discord',
    'Лёгкие обновления': 'Light updates',
    'Новые версии скачиваются за секунды (~2 МБ) и ставятся сами — без установщика и где бы ни лежала программа': 'New versions download in seconds (~2 MB) and install themselves — no installer, wherever the app is',
    'График боя': 'Fight chart',
    'DPS по секундам — ваш и группы, HP босса и отметки фаз 75 / 50 / 25 %': 'DPS per second — yours and the group’s, boss HP and phase marks at 75 / 50 / 25 %',
    'Сравнение боёв': 'Fight comparison',
    'Два боя на одном боссе рядом: время, DPS и где по навыкам потерян урон': 'Two fights on the same boss side by side: time, DPS and which skills lost damage',
    'Вставьте ссылку вебхука канала — «Поделиться» отправит таблицу боя в чат гильдии': 'Paste a channel webhook link — “Share” posts the fight table to your guild chat',
    'Кто и чем ударил за последние 12 секунд перед смертью — в «Статистике» и в уведомлении': 'Who hit you and with what in the last 12 seconds before death — in “Statistics” and in a notification',
    'Одна кнопка в «Настройках» собирает всё нужное автору в один файл': 'One button in “Settings” collects everything the author needs into one file',
    'Установщик в стиле программы': 'Installer in the app’s style',
    'Выбор папки, ярлыки, удаление через «Приложения»': 'Folder choice, shortcuts, removal via “Apps”',
    'Расписание по времени сервера': 'Schedule in server time',
    'Ивенты и мировые боссы по часам выбранного сервера': 'Events and world bosses by the clock of the selected server',
    'Бой с боссом, его имя и время боя': 'Boss fight, the boss name and fight time',
    'Авто:': 'Auto:', 'Автор': 'Author', 'Автор — написать в Discord': 'Author — message on Discord',
    'Адрес сервера игры:': 'Game server address:', 'Азия': 'Asia', 'Акцент': 'Accent', 'Аметист': 'Amethyst',
    'Асмодиане': 'Asmodians', 'Багрянец': 'Crimson', 'Баннер': 'Banner', 'Боевая сила': 'Combat power',
    'Боец': 'Brawler', 'Бой': 'Fight', 'Босс': 'Boss', 'Боёв': 'Fights', 'Боёв с боссами пока не было.': 'No boss fights yet.',
    'Быстрейшая победа': 'Fastest kill', 'В спину': 'Back attack', 'Ваш DPS': 'Your DPS', 'Ваш лучший DPS': 'Your best DPS',
    'Ваш средний': 'Your average', 'Ваше место': 'Your rank', 'Ваши бои, рекорды по боссам и DPS по классам': 'Your fights, boss records and DPS by class',
    'Ваши навыки в этом бою': 'Your skills in this fight', 'Вернуть стандартные': 'Restore defaults', 'Версия': 'Version',
    'Включить напоминание': 'Turn reminder on', 'Внешний вид и поведение окна урона поверх игры': 'Look and behaviour of the damage window over the game',
    'Волшебник': 'Sorcerer', 'Восстановить': 'Restore', 'Время': 'Time', 'Время боя': 'Fight time',
    'Вс': 'Sun', 'Пн': 'Mon', 'Вт': 'Tue', 'Ср': 'Wed', 'Чт': 'Thu', 'Пт': 'Fri', 'Сб': 'Sat',
    'Все серверы региона': 'All servers in region', 'Выберите регион и сервер, введите ник персонажа и нажмите «Найти».': 'Pick a region and server, enter a character name and press “Search”.',
    'Выключить напоминание': 'Turn reminder off', 'Выход': 'Quit',
    'Где на экране показывать уведомления перед ивентами и о новых событиях в расписании:': 'Where on screen to show notifications before events and about schedule updates:',
    'Главное окно': 'Main window', 'Гладиатор': 'Gladiator', 'Горячие клавиши': 'Hotkeys', 'Графит': 'Graphite',
    'Данж: Босс': 'Dungeon: Boss', 'Мир: Босс': 'World: Boss', 'Моб': 'Mobs', 'Длительность, мин': 'Duration, min',
    'Для правильной работы приложения необходимо': 'Required for the app to work', 'Дни': 'Days',
    'Доля критических ударов': 'Critical hit rate', 'Доля от урона всей группы': 'Share of the whole group damage', 'Доля урона': 'Damage share',
    'Европа': 'Europe', 'Ждём босса подземелья': 'Waiting for a dungeon boss', 'Ждём боя': 'Waiting for combat', 'Ждём мирового босса': 'Waiting for a world boss',
    'За 1 минуту': '1 minute before', 'За 15 минут': '15 minutes before', 'За 5 минут': '5 minutes before', 'Завтра': 'Tomorrow',
    'Загрузка…': 'Loading…', 'Закат': 'Sunset', 'Заклинатель': 'Elementalist', 'Закрепить (клики сквозь)': 'Lock (click-through)',
    'Закрыть': 'Close', 'Закрыть окно (программа останется в трее)': 'Close window (the app stays in the tray)', 'Закрыть уведомление': 'Close notification',
    'Запуск чтения трафика…': 'Starting traffic reader…', 'Запускайте Aion DPS Meter': 'Start Aion DPS Meter', 'Запуск…': 'Starting…',
    'Звуковой сигнал': 'Sound', 'Звук уведомления:': 'Notification sound:', 'Звук уведомления': 'Notification sound', 'Простой сигнал': 'Simple beep', 'Громкость': 'Volume', 'Ивент': 'Event', 'Игрок': 'Player', 'Игроков': 'Players', 'Игроков в списке': 'Players in list',
    'Идеальные': 'Perfect', 'Изменить': 'Edit', 'Изменить свой ивент': 'Edit custom event', 'Изумруд': 'Emerald',
    'История боёв': 'Fight history', 'Итог': 'Total', 'К результатам': 'Back to results', 'Кл.': 'Cls', 'Класс': 'Class',
    'Класс неизвестен': 'Unknown class', 'Ко всем боям': 'All fights', 'Когда': 'When', 'Количество ударов': 'Number of hits',
    'Колонки': 'Columns', 'Колонки оверлея': 'Overlay columns', 'Компактно': 'Compact', 'Крит': 'Crit', 'Крит %': 'Crit %',
    'Легион': 'Legion', 'Лучший DPS в группе': 'Best DPS in group', 'Макс': 'Max', 'Макс.': 'Max', 'Макс. удар': 'Max hit',
    'Масштаб': 'Scale', 'Медианный DPS по классам в боях с боссами (все игроки из ваших боёв)': 'Median DPS by class in boss fights (all players from your fights)',
    'Медиана меньше зависит от случайных выбросов, чем среднее. n — сколько раз класс встречался в ваших боях; при малом n цифры неточные.': 'The median is less affected by outliers than the average. n — how many times the class appeared in your fights; with small n the numbers are rough.',
    'Места в рейтингах': 'Ranking positions', 'Место': 'Rank', 'Место по урону': 'Damage rank', 'Место уведомления': 'Notification position',
    'Минимал': 'Minimal', 'Мировой': 'World', 'Мировой ивент': 'World event', 'Модуль чтения:': 'Reader:',
    'На сегодня NCSoft публично не запрещала такие счётчики урона, но и официального разрешения не давала. Если NCSoft объявит запрет, работа счётчика будет отключена через обновление.': 'As of today NCSoft has not publicly banned such damage meters, but has not officially allowed them either. If NCSoft announces a ban, the meter will be disabled by an update.',
    'На этот день ивентов нет.': 'No events on this day.', 'Наведите курсор на название колонки в оверлее — появится подсказка, что она показывает.': 'Hover a column title in the overlay to see what it shows.',
    'Навык': 'Skill', 'Нажмите ещё раз, чтобы удалить': 'Click again to delete', 'Нажмите и затем нужное сочетание клавиш': 'Click, then press the key combination',
    'Нажмите на сочетание, затем новое (например Ctrl+Alt+F2). Esc — отмена.': 'Click a shortcut, then press a new one (e.g. Ctrl+Alt+F2). Esc cancels.',
    'Нажмите сочетание…': 'Press keys…', 'Нажмите — разбивка по навыкам': 'Click — skill breakdown', 'Название': 'Name',
    'Названия колонок': 'Column titles', 'Названия колонок (#, Игрок, DPS, Урон, %)': 'Column titles (#, Player, DPS, Damage, %)',
    'Найдено:': 'Found:', 'Найти': 'Search', 'Написать в Discord': 'Message on Discord', 'Настройки': 'Settings', 'Настройки оверлея': 'Overlay settings',
    'Начать заново': 'Reset', 'Начать подсчёт заново (Ctrl+Shift+R)': 'Reset meter (Ctrl+Shift+R)', 'Не найден модуль чтения (AionDpsBridge.dll)': 'Reader module not found (AionDpsBridge.dll)',
    'Не получилось:': 'Failed:', 'Несколько целей': 'Multiple targets', 'Нет ивентов с напоминанием': 'No events with reminders', 'Ник': 'Name',
    'Ник игрока': 'Player name', 'Ник персонажа': 'Character name', 'Никого не нашлось. Проверьте ник, регион и сервер.': 'Nobody found. Check the name, region and server.',
    'Новые ивенты в расписании': 'New events in schedule', 'Нужен .NET 10 Runtime': '.NET 10 Runtime required',
    'Нужно сочетание с Ctrl, Alt или Shift (или клавиша F1–F24)': 'Use Ctrl, Alt or Shift (or an F1–F24 key)', 'О программе': 'About',
    'Обновить сейчас': 'Update now', 'Обновление расписания': 'Schedule update', 'Общий урон за бой': 'Total damage in the fight', 'Оверлей': 'Overlay', 'Океан': 'Ocean',
    'Откройте в игре карту со списком полевых боссов — таймеры возрождения подтянутся сами.': 'Open the map with the field boss list in game — respawn timers will load automatically.',
    'Открыть на официальном сайте': 'Open on the official site', 'Отмена': 'Cancel', 'Отчёт до ивента': 'Countdown to event', 'Оформление': 'Theme',
    'Оформление уведомления': 'Notification style', 'Оформление уведомления:': 'Notification style:', 'Очистить историю': 'Clear history', 'Очки': 'Points',
    'Перезапустить чтение': 'Restart reader', 'Персонаж:': 'Character:', 'Персонаж: зайдите в игру': 'Character: log into the game', 'Персонажи': 'Characters',
    'Плотная': 'Solid', 'Побед': 'Kills', 'Победа': 'Kill', 'Поддерживаемые клиенты:': 'Supported clients:', 'Подключение': 'Connection', 'Чтение боя, уведомления и что нужно для работы программы': 'Combat reader, notifications and what the app needs to work', 'Подробнее': 'Details',
    'Поиск персонажей на официальном сайте AION 2': 'Character search on the official AION 2 site', 'Поиск по списку': 'Search list', 'Поиск…': 'Searching…',
    'Пока мало данных: нужны бои с боссами в группе.': 'Not enough data yet: group boss fights are needed.',
    'Пока нет сохранённых боёв. Бои с боссами и бои дольше минуты записываются сюда сами.': 'No saved fights yet. Boss fights and fights longer than a minute are saved here automatically.',
    'Показать': 'Show', 'Показать оверлей': 'Show overlay', 'Показать режимы': 'Show modes', 'Полевые боссы': 'Field bosses', 'Получено урона': 'Damage taken',
    'Поражение': 'Wipe', 'Прервано': 'Aborted', 'Проверить уведомление': 'Test notification', 'Программа и NCSoft': 'The app and NCSoft',
    'Программа не связана с NCSoft и не одобрена ею. AION 2, названия и эмблемы классов — собственность NCSoft.': 'The app is not affiliated with or endorsed by NCSoft. AION 2, class names and emblems are property of NCSoft.',
    'Прозрачность': 'Opacity', 'Прозрачность фона': 'Background opacity', 'Разбивка по навыкам': 'Skill breakdown', 'Развернуть': 'Maximize', 'Разделы': 'Sections',
    'Размер и место по умолчанию': 'Default size and position', 'Размер по умолчанию': 'Default size', 'Разработка, идеи и поддержка программы': 'Development, ideas and support',
    'Ранг': 'Grade', 'Расписание': 'Schedule', 'Расписание актуально': 'Schedule is up to date', 'Расписание ивентов': 'Event schedule', 'Расписание обновлено': 'Schedule updated',
    'Регион': 'Region', 'Режим': 'Mode', 'Режим подсчёта': 'Counting mode', 'Рейтинг': 'Ranking', 'Рекорды по боссам': 'Boss records', 'Сакура': 'Sakura', 'Аврора': 'Aurora', 'Полночь': 'Midnight', 'Янтарь': 'Amber',
    'Самый сильный удар': 'Strongest hit', 'Самый сильный удар:': 'Strongest hit:', 'Сброс': 'Reset', 'Сброшено': 'Reset done', 'Свернуть': 'Minimize',
    'Сверху по центру': 'Top center', 'Свой ивент': 'Custom event', '+ Свой ивент': '+ Custom event', 'Северная Америка — Восток': 'North America — East', 'Северная Америка — Запад': 'North America — West',
    'Сегодня': 'Today', 'Сервер': 'Server', 'Скопировать ID': 'Copy ID', 'Скрыть': 'Hide', 'Скрыть оверлей (Ctrl+Shift+D)': 'Hide overlay (Ctrl+Shift+D)',
    'Скрыть режимы': 'Hide modes', 'Слева вверху': 'Top left', 'Слева внизу': 'Bottom left', 'Следующий ивент': 'Next event', 'Смотрите окно «Расписание»': 'See the “Schedule” window',
    'Снизу по центру': 'Bottom center', 'Снять закрепление': 'Unlock', 'Состояние': 'Status', 'Состояние чтения боя и что нужно для работы программы': 'Combat reader status and what the app needs to work',
    'Сохранить': 'Save', 'Сочетание': 'Shortcut', 'Список, прозрачность и масштаб': 'List, opacity and scale', 'Справа вверху': 'Top right', 'Справа внизу': 'Bottom right',
    'Средний': 'Average', 'Статистика': 'Statistics', 'Стекло': 'Glass', 'Страж': 'Templar', 'Стрелок': 'Ranger',
    'Счётчик урона отключён: NCSoft запретила такие программы': 'Damage meter disabled: NCSoft has banned such programs',
    'Тип': 'Type', 'Титул': 'Title', 'Убийца': 'Assassin', 'Уведомления о событиях': 'Event notifications', 'Удалить': 'Delete', 'Удары': 'Hits',
    'Уровень предметов': 'Item level', 'Урон': 'Damage', 'Урон в секунду': 'Damage per second', 'Урон по секундам': 'Damage per second over time',
    'Целитель': 'Cleric', 'Цель без имени': 'Unnamed target', 'Чародей': 'Chanter', 'Через браузер': 'In browser', 'Элийцы': 'Elyos',
    'Этого игрока нет в текущем бою.': 'This player is not in the current fight.', 'Эфир': 'Aether', 'Южная Америка': 'South America', 'Япония': 'Japan',
    'Язык интерфейса · Language': 'Language · Язык', 'Русский': 'Русский', 'время не подтверждено': 'time not confirmed', 'время неизвестно': 'time unknown',
    'должен появиться': 'should spawn', 'жив': 'alive', 'зайдите в игру': 'log into the game', 'из игры': 'from game', 'свой': 'custom', 'прошёл': 'over',
    'неполные данные': 'incomplete data', 'сервер прислал не весь урон': 'the server did not send all damage', 'закрепить: клики проходят сквозь оверлей': 'lock: clicks pass through the overlay',
    'показать / скрыть оверлей': 'show / hide overlay', 'начать подсчёт заново': 'reset the meter', 'разбивка по навыкам': 'skill breakdown',
    'Мировой босс': 'World boss', 'Сброс подсчёта': 'Reset meter', 'Ежедневный сброс': 'Daily reset', 'Еженедельный сброс': 'Weekly reset',
    'Пространственный разлом': 'Dimensional Rift', 'Страж Кайра (Бездна)': 'Guardian Kaira (Abyss)', 'Фестиваль шуго': 'Shugo Festival',
    'Пространственное вторжение': 'Dimensional Invasion', 'Осада артефактов': 'Artifact Siege', 'Боссы после осады': 'Post-siege bosses', 'Лорд-хранитель Нахма': 'Guardian Lord Nahma', 'Каратели Бездны: Арго, Кайра, Тамаса': 'Abyss Executors: Argo, Kaira, Tamasa', 'Босс осады Бездны': 'Abyss Siege Boss', 'Полевые ивенты и мини-игры': 'Field events and minigames', 'Налёт Беритры': 'Beritra Air Raid', 'Вход открыт первые 3 минуты': 'Entry is open for the first 3 minutes', 'Дозорщик Кайра': 'Watcher Kaira', 'Исполнители: Агро, Кайра, Тамаса': 'Executors: Argo, Kaira, Tamasa', 'Нижний уровень Арэшурата хаоса': 'Chaotic Lower Reshanta', 'Время сервера': 'Server time', 'Моё время': 'My time', 'Ваше время': 'Your time',
    '«Данж: Босс» — только бои с боссами подземелий, «Мир: Босс» — только мировые боссы, «Моб» — весь урон по всем целям.': '“Dungeon: Boss” — only dungeon boss fights, “World: Boss” — only world bosses, “Mobs” — all damage to all targets.',
    'Лечение (HPS)': 'Healing (HPS)',
    'Вид': 'View',
    'Только я': 'Only me',
    'Прятать, когда игра свёрнута': 'Hide when the game is minimized',
    'Лечение в секунду': 'Healing per second',
    'Доля': 'Share',
    'Лечение': 'Healing',
    'Поведение': 'Behaviour',
    '— крупно свой DPS, место, урон и крит вместо списка группы': '— your own DPS, rank, damage and crit in large type instead of the group list',
    'Прятать оверлей': 'Hide the overlay',
    ', когда игра свёрнута или открыто другое окно': ', when the game is minimized or another window is open',
    'Свои настройки для каждого режима': 'Separate settings for each mode',
    '— список, прозрачность, колонки, «Только я» и размер запоминаются отдельно для «Данж: Босс», «Мир: Босс» и «Моб»': '— list, opacity, columns, “Only me” and size are remembered separately for “Dungeon: Boss”, “World: Boss” and “Mobs”',
    'скопировать итог боя (картинка и текст)': 'copy the fight summary (image and text)',
    'Поделиться': 'Share',
    'Обновления': 'Updates',
    'Загружаю версию': 'Downloading version',
    'Если связь оборвётся, загрузка продолжится с того же места.': 'If the connection drops, the download resumes where it stopped.',
    'Устанавливаю обновление — программа перезапустится сама.': 'Installing the update — the app will restart by itself.',
    'Доступна версия': 'Version available:',
    'Повторить': 'Retry',
    'Обновить': 'Update',
    'Не напоминать об этой версии': 'Don’t remind me about this version',
    'У вас последняя версия —': 'You have the latest version —',
    'Проверить сейчас': 'Check now',
    'Проверяю…': 'Checking…',
    'Показывать в Discord статус «Aion DPS Meter · Бой с боссом» и время боя': 'Show “Aion DPS Meter · Boss fight” status and fight time in Discord', 'Бой с боссом': 'Boss fight', 'Статус в Discord': 'Discord status', 'Играет': 'Playing', '02:14 прошло': '02:14 elapsed', 'Показывать в Discord': 'Show in Discord', ', во что вы играете: бой с боссом, его имя и время боя': ' what you are doing: boss fight, boss name and fight time', 'Работает с запущенным приложением Discord на этом компьютере. Между боями — «Ждёт боя» и ваш сервер.': 'Works with the Discord app running on this computer. Between fights it shows “Waiting for combat” and your server.', 'Не в игре': 'Not in game', 'Счётчик урона для AION 2': 'Damage meter for AION 2',
    'Нечем поделиться': 'Nothing to share',
    'Сначала проведите бой': 'Fight something first',
    'Итог боя скопирован': 'Fight summary copied',
    'Картинка и текст · Ctrl+V': 'Image and text · Ctrl+V',
    'Текст · Ctrl+V': 'Text · Ctrl+V',
    'Обновить — в «О программе»': 'Update in “About”',
    'DPS группы': 'Group DPS',
    'В бою': 'In combat',
    'место': 'rank',
    'Ждёт боя': 'Waiting for combat',
    // модуль чтения
    'AION 2 не запущена': 'AION 2 is not running', 'Npcap не установлен — скачайте с npcap.com': 'Npcap is not installed — download it from npcap.com',
    'Жду подключения игры…': 'Waiting for the game…', 'Запуск захвата…': 'Starting capture…', 'Захват остановлен': 'Capture stopped', 'Игра найдена': 'Game found',
    'Не найден сетевой адаптер с трафиком игры (VPN?)': 'No network adapter with game traffic found (VPN?)', 'Подключено, но игра пока ничего не присылает': 'Connected, but the game is not sending anything yet',
    'Aion DPS Meter уже запущен': 'Aion DPS Meter is already running', 'Окно программы открыто': 'The app window is open',
    'Ссылка на профиль скопирована': 'Profile link copied', 'Вставьте её в любой чат Discord — откроется профиль': 'Paste it into any Discord chat — it opens the profile', 'Скопировать ссылку': 'Copy link', 'только читает': 'only reads', 'Пример уведомления': 'Sample notification',
  };
  // Кусочки внутри составных строк — длинные раньше коротких.
  const PARTS = [
    ['Счётчик урона для AION 2 · версия', 'Damage meter for AION 2 · version'],
    ['бесплатная программа с открытым исходным кодом для игроков. Она', 'a free open-source program for players. It'],
    ['зайдите в игру', 'log into the game'],
    ['Время сервера', 'Server time'], ['Ваше время', 'Your time'],
    ['← Ко всем боям', '← All fights'], ['← К результатам', '← Back to results'], ['DPS группы', 'group DPS'],
    ['Поделиться боем (', 'Share the fight ('],
    ['Скопировать итог боя (', 'Copy the fight summary ('],
    ['Ваш рекорд на этом боссе:', 'Your record on this boss:'],
    ['к рекорду', 'vs record'],
    ['(у вас', '(you have'],
    ['МБ', 'MB'],
    ['Доступна версия', 'Version available:'],
    ['недопустимый адрес обновления', 'invalid update address'],
    ['сервер ответил', 'server responded'],
    ['связь прервалась — нажмите «Повторить», загрузка продолжится', 'connection lost — press “Retry” and the download will continue'],
    ['файл повреждён при загрузке — нажмите «Повторить»', 'the file was damaged while downloading — press “Retry”'],
    ['Ваши бои, рекорды по боссам и DPS по классам', 'Your fights, boss records and DPS by class'],
    ['нет связи с сайтом NCSoft — проверьте интернет', 'no connection to the NCSoft site — check your internet'],
    ['сайт NCSoft не отвечает', 'the NCSoft site is not responding'], ['сайт NCSoft ответил ошибкой', 'the NCSoft site returned error'],
    ['сайт NCSoft прислал неожиданный ответ', 'the NCSoft site sent an unexpected response'], ['не найдено', 'not found'],
    ['трафик игры на вашем компьютере: ничего не отправляет в игру, не читает её память и не влияет на игровой процесс.', 'the game traffic on your computer: it sends nothing to the game, does not read its memory and does not affect gameplay.'],
    ['имена игроков игра присылает на экране загрузки.', 'the game sends player names on the loading screen.'],
    ['Открытый исходный код · лицензия GPL-3.0 ·', 'Open source · GPL-3.0 license ·'], ['текст лицензии', 'license text'],
    ['источник обновлений ещё не опубликован, используется встроенное расписание', 'update source is not published yet, using the built-in schedule'],
    ['нет связи с источником, используется сохранённое расписание', 'no connection to the source, using the saved schedule'],
    ['файл расписания повреждён', 'schedule file is damaged'], ['проверяется автоматически каждые 3 часа', 'checked automatically every 3 hours'],
    ['Модуль чтения остановился (код', 'Reader stopped (code'], ['Не удалось загрузить данные игры:', 'Could not load game data:'],
    ['Захват не запустился:', 'Capture failed to start:'], ['Ошибка захвата:', 'Capture error:'], ['Полевой босс №', 'Field boss #'],
    ['Начать подсчёт заново', 'Reset meter'], ['Закрепить: клики сквозь оверлей', 'Lock: click-through overlay'], ['Скрыть оверлей', 'Hide overlay'],
    ['Снять закрепление', 'Unlock'], ['Закрепить', 'Lock'], ['Начать заново', 'Reset'], ['Закреплён', 'Locked'],
    ['Персонаж: зайдите в игру', 'Character: log into the game'], ['Персонаж:', 'Character:'],
    ['до входа в подземелье', 'before entering a dungeon'], ['Для правильной работы', 'To work properly'],
    ['драйвер для захвата трафика. Установите с настройками по умолчанию.', 'traffic capture driver. Install with default settings.'],
    ['для модуля чтения боя (раздел «.NET Runtime», Windows x64).', 'for the combat reader (“.NET Runtime” section, Windows x64).'],
    ['сохранено боёв:', 'fights saved:'], ['Начало через', 'Starts in'], ['каждый час в :', 'every hour at :'], ['идёт · ещё', 'live · '],
    ['проверено в', 'checked at'], ['Версия', 'Version'], ['Авто:', 'Auto:'], ['Найдено:', 'Found:'], ['Самый сильный удар:', 'Strongest hit:'],
    ['Не получилось:', 'Failed:'], ['Карта', 'Map'], ['Добавить в друзья» не нужен: вставьте ID в поиск или в ссылку discord.com/users/…', 'Add friend” is not needed: paste the ID into search or into discord.com/users/…'],
    ['с · всего', 's · total'], ['ур. ·', 'lv. ·'], ['мин длится', 'min long'], ['в бою', 'in fight'], ['по классам', 'by class'],
    ['Мировой ивент', 'World event'], ['Ежедневный сброс', 'Daily reset'], ['Еженедельный сброс', 'Weekly reset'], ['Пространственный разлом', 'Dimensional Rift'],
    ['Страж Кайра (Бездна)', 'Guardian Kaira (Abyss)'], ['Фестиваль шуго', 'Shugo Festival'], ['Пространственное вторжение', 'Dimensional Invasion'],
    ['Осада артефактов', 'Artifact Siege'], ['Боссы после осады', 'Post-siege bosses'], ['Лорд-хранитель Нахма', 'Guardian Lord Nahma'],
    ['Игра найдена', 'Game found'], ['Мировой', 'World'], ['Сброс', 'Reset'], ['Скрыть', 'Hide'], ['Показать', 'Show'],
    ['Элийцы', 'Elyos'], ['Асмодиане', 'Asmodians'], ['Победа', 'Kill'], ['Поражение', 'Wipe'], ['Прервано', 'Aborted'],
    ['ивентов', 'events'], ['ивент', 'event'], ['через', 'in'], ['прошёл', 'over'], ['урона', 'damage'], ['группы', 'group'],
    ['бой', 'fight'], ['мин', 'min'], ['от', 'from'], ['из', 'of'], ['ещё', 'more'], ['ч', 'h'], ['д', 'd'], ['в', 'at'], ['с', 's'],
  ].map(([ru, en]) => [new RegExp((/^\p{L}/u.test(ru) ? '(?<![\\p{L}])' : '') + ru.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (/\p{L}$/u.test(ru) ? '(?![\\p{L}])' : ''), 'gu'), en]);
  const CYR = /[А-Яа-яЁё]/;

  function tr(s, lang) {
    if (lang !== 'en' || !s || !CYR.test(s)) return s;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), core = m[2];
    if (EXACT[core] != null) return m[1] + EXACT[core] + m[3];
    let out = core;
    for (const [re, en] of PARTS) { if (!CYR.test(out)) break; out = out.replace(re, en); }
    return m[1] + out + m[3];
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { tr, EXACT }; return; }

  let LANG = 'ru';
  const ATTRS = ['title', 'placeholder', 'aria-label'];
  function node(n) {
    if (n.nodeType === 3) {
      if (n.parentNode && (n.parentNode.closest?.('[data-notr],script,style,code,input,textarea'))) return;
      const was = n.__tr !== undefined && n.nodeValue === n.__tr;
      const src = was ? n.__ru : n.nodeValue;
      if (LANG === 'ru') { if (was) { n.__tr = undefined; n.nodeValue = src; } return; }
      const t = tr(src, 'en');
      if (t === src) return;
      n.__ru = src; n.__tr = t;
      if (n.nodeValue !== t) n.nodeValue = t;
    } else if (n.nodeType === 1) {
      if (n.closest('[data-notr]')) return;
      for (const a of ATTRS) if (n.hasAttribute(a)) {
        const key = '__ru_' + a, cur = n.getAttribute(a);
        const src = n[key] !== undefined && cur === n['__tr_' + a] ? n[key] : cur;
        const t = LANG === 'en' ? tr(src, 'en') : src;
        n[key] = src; n['__tr_' + a] = t;
        if (t !== cur) n.setAttribute(a, t);
      }
      for (const c of n.childNodes) node(c);
    }
  }
  function translate(rootEl, lang) {
    if (lang) setLang(lang, false);
    node(rootEl || document.documentElement);
  }
  function setLang(l, run = true) {
    l = l === 'en' ? 'en' : 'ru';
    const changed = l !== LANG;
    LANG = l; document.documentElement.lang = l;
    if (changed && run) node(document.documentElement);
    if (changed) window.dispatchEvent(new Event('langchange'));
  }
  // Всё, что окна дорисовывают сами (таймеры, новые строки), переводится сразу.
  const mo = new MutationObserver(list => {
    if (LANG === 'ru') return;
    for (const r of list) {
      if (r.type === 'characterData') node(r.target);
      else if (r.type === 'attributes') node(r.target);
      else r.addedNodes.forEach(node);
    }
  });
  mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  root.tr = s => tr(s, LANG);
  root.LOC = () => (LANG === 'en' ? 'en-GB' : 'ru-RU');
  root.getLang = () => LANG;
  root.translate = translate;
  root.setLang = setLang;
  if (root.api) {
    root.api.state().then(st => setLang(st.settings?.lang)).catch(() => {});
    root.api.on('settings', s => setLang(s.lang));
  }
})(typeof window !== 'undefined' ? window : globalThis);
