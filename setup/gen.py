# Собирает setup.nsi: файлы программы (движок — частями, чтобы полоса шла плавно) и список для удаления.
import os, sys, shutil
VER=sys.argv[1]; SRC=sys.argv[2]
STAGE='/tmp/setupsrc'
shutil.rmtree(STAGE, ignore_errors=True); shutil.copytree(SRC, STAGE)
exe=os.path.join(STAGE,'AionDpsMeter.exe'); data=open(exe,'rb').read(); os.remove(exe)
N=12; step=(len(data)+N-1)//N
for i in range(N): open(os.path.join(STAGE,'AionDpsMeter.exe.%03d'%i),'wb').write(data[i*step:(i+1)*step])
files=[]
for root,_,fs in os.walk(STAGE):
    for f in sorted(fs):
        p=os.path.join(root,f); files.append((os.path.relpath(p,STAGE), os.path.getsize(p)))
files.sort(key=lambda x:(x[0].count(os.sep), x[0]))
total=sum(s for _,s in files)
win=lambda r: r.replace('/','\\')
L=[]; cum=0; curdir=None
for rel,sz in files:
    d=os.path.dirname(rel)
    if d!=curdir:
        curdir=d; L.append(f'  SetOutPath "$INSTDIR{chr(92)+win(d) if d else ""}"')
    L.append(f'  File "{STAGE}/{rel}"'); cum+=sz
    L.append(f'  Push {int(cum*950/total)}'); L.append('  Call SetProgress')
L.append('  SetOutPath "$INSTDIR"')
# удаление: итоговые имена (exe уже склеен), затем пустые папки — от глубоких к корню
final=sorted({r for r,_ in files if not r.startswith('AionDpsMeter.exe.')}|{'AionDpsMeter.exe'})
U=[]
for i,r in enumerate(final):
    U.append(f'  Delete "$INSTDIR\\{win(r)}"')
    if i%8==7: U+= [f'  Push {int((i+1)*900/len(final))}','  Call un.SetProgress']
dirs=sorted({os.path.dirname(r) for r in final if os.path.dirname(r)}, key=lambda d:-d.count('/'))
alld=set()
for d in dirs:
    while d: alld.add(d); d=os.path.dirname(d)
for d in sorted(alld,key=lambda d:-d.count('/')): U.append(f'  RMDir "$INSTDIR\\{win(d)}"')
nsi=(open('setup.nsi.in').read().replace('@VER@',VER).replace('@FILES@','\n'.join(L))
     .replace('@UNFILES@','\n'.join(U)).replace('@NPARTS@',str(N)).replace('@SIZEKB@',str(len(data)//1024+sum(s for r,s in files if not r.startswith('AionDpsMeter.exe.'))//1024)))
open('setup.nsi','w').write(nsi)
print(len(files),'files',total)
