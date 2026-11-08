"""Local version snapshots. Never modifies the game installation."""
import argparse, datetime, hashlib, json, pathlib, shutil, subprocess, sys, zipfile, os

HERE=pathlib.Path(__file__).resolve().parent
ROOT=pathlib.Path(r'F:\Program Files (x86)\Steam\steamapps\common\Victoria 3')
HISTORY=HERE/'history'
OUTPUTS=['data.js','map-data.js','companies-data.js','cultures-data.js','geopolitics-data.js','laws-data.js','characters-data.js','military-data.js']
BUILDERS=['build_map.py','build_companies.py','build_cultures.py','build_geopolitics.py','build_laws.py','build_characters.py','build_military.py','build_i18n.py']

def read_data(path):
    text=path.read_text('utf-8-sig');return json.loads(text[text.index('=')+1:].rstrip().rstrip(';'))

def atomic_json(path,obj,prefix=''):
    tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_text(prefix+json.dumps(obj,ensure_ascii=False,separators=(',',':'))+(';' if prefix else ''),'utf-8');tmp.replace(path)

def source_files():
    files=[ROOT/'launcher/launcher-settings.json']
    for folder in ['game/common','game/map_data','game/localization/simp_chinese','game/localization/english']:
        files.extend(p for p in (ROOT/folder).rglob('*') if p.is_file() and p.suffix in {'.txt','.yml','.map','.csv','.png'})
    return sorted(set(files))

def fingerprint(files):
    # Hash contents, not modification dates: Steam touching unchanged files creates no update.
    return {p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in files}

def records(bundle):
    result={}
    def add(group,items):
        for key,value in (items.items() if isinstance(items,dict) else ((v['id'],v) for v in items)):
            value=dict(value) if isinstance(value,dict) else {'value':value}
            for field in ['icon','source']:value.pop(field,None)
            result[group+'/'+key]=value
    d=bundle.get('data.js',{});add('建筑',d.get('buildings',[]));add('商品',d.get('goods',{}));add('生产方式',d.get('methods',{}));add('生产方式组',d.get('groups',{}))
    add('州',bundle.get('map-data.js',{}).get('states',[]))
    add('公司',bundle.get('companies-data.js',{}).get('companies',[]))
    c=bundle.get('cultures-data.js',{})
    for group,key in [('文化','cultures'),('宗教','religions'),('法律','laws'),('文化特质','traits'),('接纳等级','statuses')]:add(group,c.get(key,{}))
    add('国家',bundle.get('geopolitics-data.js',{}).get('countries',{}))
    legal=bundle.get('laws-data.js',{})
    for group,key in [('法律','laws'),('法律修正案','amendments'),('机构','institutions')]:add(group,legal.get(key,{}))
    add('人物',bundle.get('characters-data.js',{}).get('characters',[]))
    character_catalog=bundle.get('characters-data.js',{})
    for group,key in [('意识形态','ideologies'),('人物特质','traits')]:add(group,character_catalog.get(key,{}))
    military=bundle.get('military-data.js',{})
    add('军队类型',military.get('units',{}));add('动员选项',military.get('options',{}))
    return result

def changes(before,after):
    out=[]
    for key in sorted(before.keys()|after.keys()):
        a,b=before.get(key),after.get(key)
        if a==b:continue
        fields=[k for k in sorted((a or {}).keys()|(b or {}).keys()) if (a or {}).get(k)!=(b or {}).get(k)]
        out.append({'key':key,'name':(b or a).get('name',key.split('/',1)[1]),'kind':'新增' if a is None else '移除' if b is None else '修改','fields':fields})
    return out

def snapshot(index,source=None,files=None,baseline=False):
    bundle={f:read_data(HERE/f) for f in OUTPUTS if (HERE/f).exists()}
    digest=hashlib.sha256(json.dumps(bundle,sort_keys=True,ensure_ascii=False,default=str).encode()).hexdigest()
    now=datetime.datetime.now().isoformat(timespec='seconds');sid=datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'-'+digest[:8]
    dest=HISTORY/sid;dest.mkdir(parents=True)
    for f in bundle:shutil.copy2(HERE/f,dest/f)
    rec=records(bundle);atomic_json(dest/'records.js',{'id':sid,'records':rec},'window.V3_SNAPSHOT=')
    previous={}
    if index:
        text=(HISTORY/index[-1]['id']/'records.js').read_text('utf-8');previous=json.loads(text.split('=',1)[1][:-1])['records']
    diff=changes(previous,rec) if index else []
    if source is not None:
        atomic_json(dest/'source-hashes.json',source)
        with zipfile.ZipFile(dest/'game-definitions.zip','w',zipfile.ZIP_DEFLATED) as archive:
            for p in files:
                if p.suffix!='.png':archive.write(p,p.relative_to(ROOT).as_posix())
    entry={'id':sid,'version':bundle['data.js']['version'],'captured':now,'generated':bundle['data.js'].get('generated'),'baseline':baseline,'changes':diff,'sourceCaptured':source is not None}
    if source is not None and index:
        prior=HISTORY/index[-1]['id']/'source-hashes.json'
        if prior.exists():
            old=json.loads(prior.read_text('utf-8'));entry['changedSourceFiles']=[key for key in sorted(old.keys()|source.keys()) if old.get(key)!=source.get(key)]
    index.append(entry);atomic_json(HISTORY/'index.json',index);atomic_json(HERE/'history-data.js',index,'window.V3_HISTORY=')
    return entry

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--force',action='store_true');parser.add_argument('--baseline',action='store_true');args=parser.parse_args()
    HISTORY.mkdir(exist_ok=True);index=json.loads((HISTORY/'index.json').read_text('utf-8')) if (HISTORY/'index.json').exists() else []
    if not index:snapshot(index,baseline=True)
    if args.baseline:return
    if not ROOT.exists():print('游戏目录不可用，保留并使用本地快照。');return
    files=source_files();hashes=fingerprint(files)
    last=HISTORY/index[-1]['id']/'source-hashes.json'
    if not args.force and all((HERE/f).exists() for f in OUTPUTS) and last.exists() and json.loads(last.read_text('utf-8'))==hashes:
        print('游戏内容未变化，使用本地数据。');return
    # Preserve all generated outputs before builders overwrite them; restore on failure.
    backup=HISTORY/'pending-backup';backup.mkdir(exist_ok=True)
    saved=[p for p in HERE.iterdir() if p.is_file() and (p.name in OUTPUTS or p.suffix=='.csv')]
    for p in saved:shutil.copy2(p,backup/p.name)
    try:
        for builder in BUILDERS:subprocess.run([sys.executable,'-B',str(HERE/builder),str(ROOT)],cwd=HERE,check=True)
        # Do not label a mixed installation as one version if Steam updates during extraction.
        if fingerprint(source_files())!=hashes:raise RuntimeError('提取期间游戏文件发生变化，请等待 Steam 更新完成再重试。')
        entry=snapshot(index,hashes,files)
        print('快照已保存：',entry['version'],'；变化记录：',len(entry['changes']))
    except Exception:
        for p in saved:shutil.copy2(backup/p.name,p)
        raise
    finally:
        for p in backup.iterdir():p.unlink()
        backup.rmdir()

if __name__=='__main__':
    lock=HERE/'history-update.lock'
    try:handle=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY)
    except FileExistsError:
        print('另一次数据更新正在进行，暂不重复提取。');sys.exit(1)
    try:
        os.write(handle,str(os.getpid()).encode());os.close(handle);main()
    finally:lock.unlink(missing_ok=True)
