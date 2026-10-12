# Текст соглашения раскладывается заранее по строкам (тем же шрифтом Manrope), чтобы в окне он стоял ровно.
from PIL import ImageFont
RU=[("СТОРОННЕЕ ПРОГРАММНОЕ ОБЕСПЕЧЕНИЕ","Aion DPS Meter считывает сетевые пакеты игрового клиента AION 2 компании NCsoft на вашем компьютере. Программа ничего не отправляет в игру и не изменяет её файлы и память. Мы не связаны с NCsoft Corporation, не одобрены и не спонсируемы ею. AION 2 и связанные с ней товарные знаки являются собственностью NCsoft. Вы используете программу на свой страх и риск в отношении условий обслуживания NCsoft."),
("ЛИЦЕНЗИЯ И ГАРАНТИИ","Aion DPS Meter — бесплатная программа с открытым исходным кодом, она распространяется по лицензии GNU GPL версии 3. Программа предоставляется «как есть», без каких-либо гарантий. Автор не несёт ответственности за последствия её использования, включая действия NCsoft в отношении вашей учётной записи."),
("ПОДДЕРЖКА И ОТКЛЮЧЕНИЕ","Автор может в любое время прекратить поддержку программы и выпуск обновлений. Если NCsoft запретит такие программы, чтение боя будет отключено обновлением. В этом случае рекомендуем удалить программу."),
("КОНТАКТЫ","Автор: Accapura  |  Discord: Accapura  |  id discord: 256419758369538048"),
("СОГЛАШЕНИЕ","Нажимая «Я согласен», вы подтверждаете, что прочитали и поняли настоящее соглашение и принимаете его условия.")]
EN=[("THIRD-PARTY SOFTWARE","Aion DPS Meter reads network packets of the NCsoft AION 2 game client on your computer. The app sends nothing to the game and does not change its files or memory. We are not affiliated with, endorsed or sponsored by NCsoft Corporation. AION 2 and related trademarks are the property of NCsoft. You use the app at your own risk with regard to the NCsoft terms of service."),
("LICENSE AND WARRANTY","Aion DPS Meter is free open-source software distributed under the GNU GPL version 3. The app is provided “as is”, without any warranty. The author is not liable for any consequences of its use, including actions taken by NCsoft regarding your account."),
("SUPPORT AND SHUTDOWN","The author may stop supporting the app and releasing updates at any time. If NCsoft bans such programs, combat reading will be disabled by an update. In that case we recommend uninstalling the app."),
("CONTACTS","Author: Accapura  |  Discord: Accapura  |  Discord id: 256419758369538048"),
("AGREEMENT","By clicking “I agree”, you confirm that you have read and understood this agreement and accept its terms.")]
f=ImageFont.truetype('ManropeDPS-Regular.ttf',14)  # 10pt ≈ 13.3px, берём с запасом
def wrap(t,w=672):
    out=[];cur=''
    for word in t.split(' '):
        nxt=(cur+' '+word).strip()
        if f.getlength(nxt)>w and cur: out.append(cur); cur=word
        else: cur=nxt
    out.append(cur); return out
def block(secs,fn):
    y=136; lines=[f'Function {fn}']
    for h,t in secs:
        lines.append(f'  !insertmacro LABEL $0 "{h}" 40 {y} 680 18 FFC66B 1F1835 $FHead'); y+=19
        n=len(wrap(t)); hh=n*17+2
        tt=t.replace('"','$\\"')
        lines.append(f'  !insertmacro LABEL $0 "{tt}" 40 {y} 680 {hh} D9D2E8 1F1835 $FText'); y+=hh+8
    lines.append('FunctionEnd'); print(fn,'ends at',y)
    return '\n'.join(lines)
# текст соглашения используется в art.py
