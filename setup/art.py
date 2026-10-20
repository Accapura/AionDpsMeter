# Вся графика установщика рисуется заранее (2×, Manrope со сглаживанием): фоны страниц с текстом, кнопки (4 кадра подсветки),
# переключатели, значки. В окне остаются живыми только путь к папке и проценты.
import os, sys, shutil
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
VER = sys.argv[1]
OUT = 'art'
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
S = 2
W, H = 760, 660
FONTS = {}
def F(px, w='Regular'):
    k = (px, w)
    if k not in FONTS: FONTS[k] = ImageFont.truetype(f'ManropeDPS-{w}.ttf', int(round(px * S)))
    return FONTS[k]
G1 = (58, 40, 92); G2 = (20, 24, 48)
ACC = (255, 198, 107); ORG = (255, 150, 60); TXT = (251, 247, 255); MUT = (203, 194, 220); BODY = (217, 210, 232)
PANEL = (0x1F, 0x18, 0x35); CARD = (0x2A, 0x22, 0x44); DARK = (0x3A, 0x30, 0x58); DARKH = (0x51, 0x45, 0x7A)
GREEN = (126, 226, 168)

def save(im, name):
    im.convert('RGB').save(os.path.join(OUT, name + '.png'), optimize=True)

# ---------------------------------------------------------------- общая основа окна
def make_base():
    w, h = W * S, H * S
    im = Image.new('RGB', (w, h)); px = im.load()
    for y in range(h):
        for x in range(w):
            t = min(1, max(0, 0.55 * y / h + 0.45 * x / w)); px[x, y] = tuple(int(G1[i] + (G2[i] - G1[i]) * t) for i in range(3))
    im = im.convert('RGBA')
    def glow(cx, cy, r, col, a):
        nonlocal im
        g = Image.new('RGBA', im.size, (0, 0, 0, 0)); ImageDraw.Draw(g).ellipse((cx - r, cy - r, cx + r, cy + r), fill=col + (a,))
        im = Image.alpha_composite(im, g.filter(ImageFilter.GaussianBlur(r / 2)))
    glow(70 * S, 40 * S, 130 * S, (150, 110, 255), 80); glow(720 * S, 650 * S, 160 * S, ACC, 26)
    lay = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=16 * S, outline=(255, 255, 255, 46), width=S)
    im = Image.alpha_composite(im, lay)
    L = Image.open('/home/claude/build/AionDps/app/assets/icon.png').convert('RGBA').resize((56 * S, 56 * S), Image.LANCZOS)
    m = Image.new('L', L.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, L.size[0] - 1, L.size[1] - 1), radius=14 * S, fill=255)
    L.putalpha(ImageChops.multiply(L.split()[3], m))
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle((22 * S, 22 * S, 78 * S, 78 * S), radius=14 * S, fill=(0, 0, 0, 150))
    im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(6 * S)))
    im.alpha_composite(L, (22 * S, 18 * S))
    d = ImageDraw.Draw(im)
    d.text((92 * S, 40 * S), 'Aion DPS Meter', font=F(25, 'ExtraBold'), fill=TXT, anchor='lm')
    d.text((93 * S, 63 * S), 'AION 2  ·  DPS METER', font=F(10, 'Bold'), fill=MUT, anchor='lm')
    d.text((738 * S, 40 * S), 'v' + VER, font=F(11, 'Bold'), fill=MUT, anchor='rm')
    lay = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    d.rounded_rectangle((20 * S, 92 * S, 740 * S, 590 * S), radius=18 * S, fill=PANEL + (255,), outline=(255, 255, 255, 34), width=S)
    d.rounded_rectangle((20 * S, 606 * S, 196 * S, 638 * S), radius=16 * S, fill=CARD + (255,), outline=(255, 255, 255, 44), width=S)
    im = Image.alpha_composite(im, lay)
    d = ImageDraw.Draw(im)
    d.text((36 * S, 622 * S), 'Автор', font=F(10.5, 'ExtraBold'), fill=MUT, anchor='lm')
    msk = Image.new('L', im.size, 0); ImageDraw.Draw(msk).text((96 * S, 622 * S), 'Accapura', font=F(15, 'ExtraBold'), fill=255, anchor='lm')
    bb = msk.getbbox(); g = Image.new('RGBA', im.size); gd = ImageDraw.Draw(g)
    for xx in range(bb[0], bb[2] + 1):
        t = (xx - bb[0]) / max(1, bb[2] - bb[0]); gd.line([(xx, 0), (xx, h)], fill=tuple(int(ACC[i] + (TXT[i] - ACC[i]) * t * 0.7) for i in range(3)) + (255,))
    im.paste(g, (0, 0), msk)
    d = ImageDraw.Draw(im)
    d.text((738 * S, 622 * S), 'GPL-3.0  ·  Open source', font=F(10, 'Bold'), fill=MUT, anchor='rm')
    return im
BASE = make_base()
BASE_EN = BASE.copy()
# у английских страниц — «Author»
_d = ImageDraw.Draw(BASE_EN)
_d.rounded_rectangle((21 * S, 607 * S, 90 * S, 637 * S), radius=15 * S, fill=CARD)
_d.text((34 * S, 622 * S), 'Author', font=F(10.5, 'ExtraBold'), fill=MUT, anchor='lm')

class Page:
    def __init__(s, lang='ru'):
        s.im = (BASE_EN if lang == 'en' else BASE).copy(); s.d = ImageDraw.Draw(s.im)
    def t(s, x, y, text, px=13, w='Regular', fill=BODY, anchor='la', spacing=0):
        if spacing:
            for ch in text:
                s.d.text((x * S, y * S), ch, font=F(px, w), fill=fill, anchor=anchor); x += F(px, w).getlength(ch) / S + spacing
            return
        s.d.text((x * S, y * S), text, font=F(px, w), fill=fill, anchor=anchor)
    def wrap(s, x, y, text, width, px=13, w='Regular', fill=BODY, lh=19):
        f = F(px, w); lines = []; cur = ''
        for word in text.split(' '):
            nxt = (cur + ' ' + word).strip()
            if f.getlength(nxt) > width * S and cur: lines.append(cur); cur = word
            else: cur = nxt
        lines.append(cur)
        for i, l in enumerate(lines): s.t(x, round(y + i * lh, 1), l, px, w, fill)
        return y + len(lines) * lh
    def box(s, x0, y0, x1, y1, fill=CARD, r=14, outline=(255, 255, 255, 26)):
        lay = Image.new('RGBA', s.im.size, (0, 0, 0, 0))
        ImageDraw.Draw(lay).rounded_rectangle((x0 * S, y0 * S, x1 * S, y1 * S), radius=r * S, fill=fill + (255,), outline=outline, width=S)
        s.im = Image.alpha_composite(s.im.convert('RGBA'), lay); s.d = ImageDraw.Draw(s.im)
    def head(s, x, y, text, fill=ACC):
        s.t(x, y, text, 10.5, 'ExtraBold', fill, spacing=0.6)
    def title(s, y, text, px=21):
        s.t(40, y, text, px, 'ExtraBold', TXT)
    def track(s, y):
        s.box(40, y, 720, y + 12, DARK, r=6, outline=None)
    def save(s, name): save(s.im, 'bg_' + name)

# ---------------------------------------------------------------- значки
def icon(kind, size=34):
    z = 4; n = size * S * z
    im = Image.new('RGBA', (n, n), (0, 0, 0, 0)); d = ImageDraw.Draw(im); u = n / 34
    d.ellipse((0, 0, n - 1, n - 1), fill=DARK + (255,))
    if kind == 'bars':
        for i, hh in enumerate((8, 13, 18)):
            x = 9 + i * 6
            d.rounded_rectangle((x * u, (25 - hh) * u, (x + 4) * u, 25 * u), radius=2 * u, fill=ACC)
    elif kind == 'clock':
        d.ellipse((8 * u, 8 * u, 26 * u, 26 * u), outline=ACC, width=int(2.4 * u))
        d.line([(17 * u, 17 * u), (17 * u, 11.5 * u)], fill=ACC, width=int(2.4 * u))
        d.line([(17 * u, 17 * u), (21 * u, 19.5 * u)], fill=ACC, width=int(2.4 * u))
    elif kind == 'chat':
        d.rounded_rectangle((8 * u, 10 * u, 26 * u, 23 * u), radius=5 * u, fill=ACC)
        d.polygon([(12 * u, 22 * u), (12 * u, 27 * u), (17 * u, 22 * u)], fill=ACC)
        for cx in (13, 17, 21): d.ellipse(((cx - 1.4) * u, 15.1 * u, (cx + 1.4) * u, 17.9 * u), fill=DARK)
    return im.resize((size * S, size * S), Image.LANCZOS)

# ---------------------------------------------------------------- кнопки: 4 кадра (обычная → под курсором)
def button(name, w, h, text, kind, bg=PANEL, sub=None, px=13.5):
    frames = []
    for state in (0, 1):
        n = 3
        im = Image.new('RGBA', (w * S * n, h * S * n), bg + (255,)); d = ImageDraw.Draw(im)
        r = min(12, h // 2) * S * n
        box = (0, 0, w * S * n - 1, h * S * n - 1)
        if kind == 'gold':
            top, bot = ((255, 214, 140), (255, 172, 82)) if state == 0 else ((255, 228, 170), (255, 190, 110))
            gr = Image.new('RGBA', im.size); gd = ImageDraw.Draw(gr)
            for y in range(im.size[1]):
                t = y / im.size[1]; gd.line([(0, y), (im.size[0], y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,))
            m = Image.new('L', im.size, 0); ImageDraw.Draw(m).rounded_rectangle(box, radius=r, fill=255)
            im.paste(gr, (0, 0), m)
            fg, fs = (0x26, 0x1B, 0x3C), (0x4A, 0x37, 0x5C)
        else:
            fill = {'dark': (DARK, DARKH), 'quiet': (CARD, DARK)}[kind][state]
            k = 0.16 if state else 0.09
            ol = tuple(int(fill[i] + (255 - fill[i]) * k) for i in range(3))
            d.rounded_rectangle(box, radius=r, fill=ol)
            d.rounded_rectangle((S * n, S * n, box[2] - S * n, box[3] - S * n), radius=r - S * n, fill=fill)
            fg = TXT if (kind == 'dark' or state) else MUT; fs = MUT
        fT = ImageFont.truetype('ManropeDPS-ExtraBold.ttf' if sub else 'ManropeDPS-Bold.ttf', int(px * S * n))
        cy = h * S * n / 2
        if sub:
            d.text((w * S * n / 2, cy - 9 * S * n), text, font=fT, fill=fg, anchor='mm')
            d.text((w * S * n / 2, cy + 20 * S * n), sub, font=ImageFont.truetype('ManropeDPS-Regular.ttf', int(12 * S * n)), fill=fs, anchor='mm')
        else:
            d.text((w * S * n / 2, cy), text, font=fT, fill=fg, anchor='mm')
        frames.append(im.resize((w * S, h * S), Image.LANCZOS))
    for i in range(4):
        save(Image.blend(frames[0], frames[1], i / 3), f'b_{name}_{i}')

def toggle(name, text, lang_bg=PANEL):
    for on in (0, 1):
        w, h = 460, 26; n = 3
        im = Image.new('RGBA', (w * S * n, h * S * n), lang_bg + (255,)); d = ImageDraw.Draw(im); u = S * n
        bx = (1 * u, 1 * u, 25 * u, 25 * u)
        if on:
            d.rounded_rectangle(bx, radius=7 * u, fill=ACC)
            d.line([(7 * u, 13.5 * u), (11.5 * u, 18 * u), (19 * u, 9 * u)], fill=(0x26, 0x1B, 0x3C), width=int(2.6 * u), joint='curve')
        else:
            d.rounded_rectangle(bx, radius=7 * u, fill=CARD, outline=DARKH, width=int(1.5 * u))
        d.text((38 * u, 13 * u), text, font=ImageFont.truetype('ManropeDPS-Regular.ttf', int(13.5 * u)), fill=TXT, anchor='lm')
        save(im.resize((w * S, h * S), Image.LANCZOS), f't_{name}_{on}')

def badge(name, text):
    w, h = 150, 30; n = 3; u = S * n
    im = Image.new('RGBA', (w * u, h * u), CARD + (255,)); d = ImageDraw.Draw(im)
    d.ellipse((2 * u, 4 * u, 24 * u, 26 * u), fill=(0x2E, 0x5A, 0x4A))
    d.line([(8 * u, 15.5 * u), (11.5 * u, 19 * u), (18 * u, 11.5 * u)], fill=GREEN, width=int(2.4 * u), joint='curve')
    d.text((32 * u, 15 * u), text, font=ImageFont.truetype('ManropeDPS-Bold.ttf', int(13.5 * u)), fill=GREEN, anchor='lm')
    save(im.resize((w * S, h * S), Image.LANCZOS), name)

def fill_bar():
    w, h = 680, 12; n = 3; u = S * n
    im = Image.new('RGBA', (w * u, h * u), DARK + (255,))
    gr = Image.new('RGBA', im.size); gd = ImageDraw.Draw(gr)
    for x in range(im.size[0]):
        t = x / im.size[0]; gd.line([(x, 0), (x, im.size[1])], fill=tuple(int(ACC[i] + (ORG[i] - ACC[i]) * t) for i in range(3)) + (255,))
    hl = ImageDraw.Draw(gr); hl.rectangle((0, 0, im.size[0], im.size[1] * 0.35), fill=None)
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, im.size[0] - 1, im.size[1] - 1), radius=6 * u, fill=255)
    im.paste(gr, (0, 0), m)
    save(im.resize((w * S, h * S), Image.LANCZOS), 'fill')

# ================================================================ тексты
T = {
 'ru': dict(agree='Я согласен', cancel='Отмена', back='Назад', browse='Обзор…', install='Установить', launch='Запустить', close='Закрыть',
   get='Скачать', uninst='Удалить', have='Установлен',
   eula='Лицензионное соглашение',
   path='Куда установить Aion DPS Meter', pathhint='Нужно около 240 МБ свободного места.',
   desk='Создать ярлык на рабочем столе',
   todo='ЧТО БУДЕТ СДЕЛАНО', todo1='Программа появится в меню «Пуск»', todo2='Её можно удалить через «Установка и удаление программ»',
   todo3='Настройки и история боёв хранятся отдельно и сохраняются при обновлениях',
   inst='Установка Aion DPS Meter', upd='Обновление до ' + VER, instsub='Это займёт меньше минуты', updsub='Настройки и история боёв сохраняются',
   done='Aion DPS Meter установлен', doneupd='Aion DPS Meter обновлён до ' + VER,
   donetext='Программа есть в меню «Пуск». Запускайте её до игры или во время — оверлей появится поверх AION 2.',
   need='ДЛЯ ЧТЕНИЯ БОЯ НУЖНЫ', netsub='Среда для модуля чтения боя', pcapsub='Драйвер захвата трафика — ставьте с настройками по умолчанию',
   later='Если чего-то не хватает, программа подскажет в «Настройках».',
   fail='Не удалось установить', failtext='Закройте Aion DPS Meter, проверьте папку и свободное место на диске и запустите установку ещё раз.',
   untitle='Удаление Aion DPS Meter', untext='Программа будет удалена из папки:', undata='Удалить также настройки и историю боёв',
   unnote='Ярлыки и запись в «Установка и удаление программ» тоже будут удалены.',
   unwork='Удаление Aion DPS Meter', unworksub='Это займёт пару секунд',
   undone='Aion DPS Meter удалён', undonetext='Спасибо, что пользовались программой!'),
 'en': dict(agree='I agree', cancel='Cancel', back='Back', browse='Browse…', install='Install', launch='Launch', close='Close',
   get='Download', uninst='Uninstall', have='Installed',
   eula='License agreement',
   path='Where to install Aion DPS Meter', pathhint='About 240 MB of free space is needed.',
   desk='Create a desktop shortcut',
   todo='WHAT WILL BE DONE', todo1='The app will appear in the Start menu', todo2='You can remove it in “Apps & features”',
   todo3='Settings and fight history are stored separately and are kept on updates',
   inst='Installing Aion DPS Meter', upd='Updating to ' + VER, instsub='This takes less than a minute', updsub='Your settings and fight history are kept',
   done='Aion DPS Meter is installed', doneupd='Aion DPS Meter is updated to ' + VER,
   donetext='You will find the app in the Start menu. Launch it before the game or during it — the overlay appears on top of AION 2.',
   need='TO READ FIGHTS THE APP NEEDS', netsub='Runtime for the fight reading module', pcapsub='Traffic capture driver — install with default options',
   later='If something is missing, the app will remind you in Settings.',
   fail='Could not install', failtext='Close Aion DPS Meter, check the folder and free disk space, then run the setup again.',
   untitle='Uninstall Aion DPS Meter', untext='The app will be removed from this folder:', undata='Also delete settings and fight history',
   unnote='Shortcuts and the “Apps & features” entry will be removed too.',
   unwork='Removing Aion DPS Meter', unworksub='This takes a couple of seconds',
   undone='Aion DPS Meter is removed', undonetext='Thank you for using the app!'),
}
from eula import RU as EULA_RU, EN as EULA_EN

# ---------------------------------------------------------------- 1. язык
p = Page()
p.title(110, 'Выберите язык  ·  Choose language')
p.t(40, 146, 'Язык установки и программы. Его можно сменить позже в «Настройках».', 13, fill=MUT)
p.t(40, 166, 'The language of setup and of the app. You can change it later in Settings.', 13, fill=MUT)
p.head(40, 350, 'ВОЗМОЖНОСТИ  ·  FEATURES')
for i, (ic, ru, en) in enumerate((('bars', 'Урон и лечение в бою', 'Live damage & healing'),
                                  ('clock', 'Расписание и напоминания', 'Event timers & alerts'),
                                  ('chat', 'Статус в Discord', 'Discord status'))):
    x0 = 40 + i * 232
    p.box(x0, 374, x0 + 216, 494)
    p.im.alpha_composite(icon(ic), ((x0 + 18) * S, 392 * S)); p.d = ImageDraw.Draw(p.im)
    p.t(x0 + 18, 440, ru, 13, 'Bold', TXT)
    p.t(x0 + 18, 462, en, 12, fill=MUT)
p.save('lang')
for lg, txt, sub in (('ru', 'Русский', 'Установка и программа на русском'), ('en', 'English', 'Setup and app in English')):
    button(f'card_{lg}_g', 330, 130, txt, 'gold', sub=sub, px=24)
    button(f'card_{lg}_d', 330, 130, txt, 'dark', sub=sub, px=24)
button('cancel_bi', 200, 38, 'Отмена  ·  Cancel', 'quiet')

for lg in ('ru', 'en'):
    t = T[lg]
    # ---------------------------------------------------------------- 2. соглашение
    p = Page(lg); p.title(104, t['eula'])
    y = 140
    for h, body in (EULA_RU if lg == 'ru' else EULA_EN):
        p.head(40, y, h); y += 18
        y = p.wrap(40, y, body, 680, 12.5, fill=BODY, lh=17.5) + 9
    assert y < 535, ('eula overflow', lg, y)
    p.save('eula_' + lg)
    # ---------------------------------------------------------------- 3. папка
    p = Page(lg); p.title(104, t['path'])
    p.box(40, 160, 600, 204, CARD, r=12, outline=(255, 255, 255, 34))
    p.t(40, 218, t['pathhint'], 13, fill=MUT)
    p.box(40, 312, 720, 446)
    p.head(60, 330, t['todo'])
    for i, k in enumerate(('todo1', 'todo2', 'todo3')):
        yy = 360 + i * 26
        p.d.ellipse((62 * S, (yy + 6) * S, 68 * S, (yy + 12) * S), fill=ACC)
        p.t(80, yy, t[k], 13, fill=BODY)
    p.save('path_' + lg)
    toggle('desk_' + lg, t['desk'])
    # ---------------------------------------------------------------- 4. установка
    for mode in ('inst', 'upd'):
        p = Page(lg); p.title(232, t[mode], 24)
        p.t(40, 272, t[mode + 'sub'], 13, fill=MUT)
        p.track(304)
        p.save(f'work_{mode}_{lg}')
    # ---------------------------------------------------------------- 5. готово / ошибка
    for mode in ('done', 'doneupd'):
        p = Page(lg); p.title(108, t[mode])
        p.wrap(40, 144, t['donetext'], 680, 13, fill=MUT)
        p.head(40, 206, t['need'])
        for i, (nm, sub) in enumerate((('.NET 10 Runtime', t['netsub']), ('Npcap', t['pcapsub']))):
            y0 = 234 + i * 76
            p.box(40, y0, 720, y0 + 64)
            p.t(60, y0 + 12, nm, 14, 'Bold', TXT)
            p.t(60, y0 + 36, sub, 12, fill=MUT)
        p.t(40, 396, t['later'], 12.5, fill=MUT)
        p.save(f'{mode}_{lg}')
    p = Page(lg); p.title(232, t['fail'], 24)
    p.wrap(40, 272, t['failtext'], 680, 13, fill=(255, 160, 140))
    p.save('fail_' + lg)
    # ---------------------------------------------------------------- удаление
    p = Page(lg); p.title(104, t['untitle'])
    p.t(40, 146, t['untext'], 13, fill=MUT)
    p.box(40, 172, 720, 212, CARD, r=12, outline=(255, 255, 255, 34))
    p.t(40, 284, t['unnote'], 12.5, fill=MUT)
    p.save('un_' + lg)
    toggle('wipe_' + lg, t['undata'])
    p = Page(lg); p.title(232, t['unwork'], 24); p.t(40, 272, t['unworksub'], 13, fill=MUT); p.track(304); p.save('unwork_' + lg)
    p = Page(lg); p.title(232, t['undone'], 24); p.t(40, 272, t['undonetext'], 13, fill=MUT); p.save('undone_' + lg)
    # ---------------------------------------------------------------- кнопки
    for k, w, kind in (('agree', 160, 'gold'), ('install', 160, 'gold'), ('launch', 160, 'gold'), ('uninst', 160, 'gold'),
                       ('cancel', 160, 'dark'), ('close', 160, 'dark'), ('back', 120, 'quiet'), ('browse', 110, 'dark')):
        button(f'{k}_{lg}', w, 44 if k == 'browse' else 38, t[k], kind)
    button('get_' + lg, 124, 38, t['get'], 'dark', bg=CARD)
    badge('have_' + lg, t['have'])
fill_bar()
print(len(os.listdir(OUT)), 'files', sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) // 1024, 'KB')
