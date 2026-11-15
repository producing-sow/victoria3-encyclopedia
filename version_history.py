"""Local version snapshots. Never modifies the game installation."""
import argparse, datetime, hashlib, json, pathlib, shutil, subprocess, sys, zipfile, os, tempfile, contextlib

HERE=pathlib.Path(__file__).resolve().parent
ROOT=pathlib.Path(r'F:\Program Files (x86)\Steam\steamapps\common\Victoria 3')
HISTORY=HERE/'history'
OUTPUTS=['data.js','map-data.js','companies-data.js','cultures-data.js','geopolitics-data.js','laws-data.js','characters-data.js','military-data.js']
BUILDERS=['build_map.py','build_companies.py','build_cultures.py','build_geopolitics.py','build_laws.py','build_characters.py','build_military.py']

def read_data(path):
    text=path.read_text('utf-8-sig');return json.loads(text[text.index('=')+1:].rstrip().rstrip(';'))

def atomic_json(path,obj,prefix=''):
    tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_text(prefix+json.dumps(obj,ensure_ascii=False,separators=(',',':'))+(';' if prefix else ''),'utf-8');tmp.replace(path)

def source_files():
    files=[ROOT/'launcher/launcher-settings.json']
    for folder in ['game/common','game/events','game/map_data','game/localization/simp_chinese','game/localization/english']:
        files.extend(p for p in (ROOT/folder).rglob('*') if p.is_file() and p.suffix in {'.txt','.yml','.map','.csv','.png'})
    files.extend(p for p in (ROOT/'game/gfx/interface').rglob('*') if p.is_file())
    files.extend([ROOT/'game/gfx/map/textures/flatmap.dds', ROOT/'game/gfx/loadingscreens/victoria3_load_1.dds', ROOT/'launcher/assets/launcher-logo.png'])
    return sorted(set(p for p in files if p.is_file()))

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

def snapshot(index,source=None,files=None,baseline=False,base=None):
    HERE=base or globals()["HERE"]
    HISTORY=HERE/"history"
    HISTORY.mkdir(exist_ok=True)
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
                if p.suffix in {'.txt','.yml','.map','.csv','.json'}:archive.write(p,p.relative_to(ROOT).as_posix())
    entry={'id':sid,'version':bundle['data.js']['version'],'captured':now,'generated':bundle['data.js'].get('generated'),'baseline':baseline,'changes':diff,'sourceCaptured':source is not None}
    if source is not None and index:
        prior=HISTORY/index[-1]['id']/'source-hashes.json'
        if prior.exists():
            old=json.loads(prior.read_text('utf-8'));entry['changedSourceFiles']=[key for key in sorted(old.keys()|source.keys()) if old.get(key)!=source.get(key)]
    index.append(entry);atomic_json(HISTORY/'index.json',index);atomic_json(HERE/'history-data.js',index,'window.V3_HISTORY=')
    return entry

def validate_root(value):
    root=pathlib.Path(str(value).strip().strip('"')).expanduser().resolve()
    required=['launcher/launcher-settings.json','game/common','game/map_data/provinces.png',
              'game/localization/english','game/localization/simp_chinese']
    if not all((root/name).exists() for name in required):
        raise ValueError('请选择 Victoria 3 游戏根目录（内含 game 和 launcher 文件夹），不是 MOD 目录。')
    version=json.loads((root/required[0]).read_text('utf-8-sig')).get('version')
    if not version:raise ValueError('无法读取游戏版本。')
    return root


@contextlib.contextmanager
def update_lock():
    lock=HERE/'history-update.lock'
    try:handle=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY)
    except FileExistsError:raise RuntimeError('另一次数据更新正在进行；若上次被强制终止，请关闭更新程序后删除 history-update.lock。')
    try:
        os.write(handle,str(os.getpid()).encode());os.close(handle)
        yield
    finally:lock.unlink(missing_ok=True)


def sources_changed(old,new):
    # Older archives did not hash artwork. Adding that coverage is not a game update.
    if not any(k.startswith('game/gfx/') for k in old):
        new={k:v for k,v in new.items() if not k.startswith('game/gfx/') and k!='launcher/assets/launcher-logo.png'}
    if not any(k.startswith('game/events/') for k in old):
        new={k:v for k,v in new.items() if not k.startswith('game/events/')}
    if 'game/gfx/loadingscreens/victoria3_load_1.dds' not in old:
        new={k:v for k,v in new.items() if k!='game/gfx/loadingscreens/victoria3_load_1.dds'}
    return old!=new


def publish(stage, paths):
    # Keep replacements recoverable if any filesystem operation fails.
    with tempfile.TemporaryDirectory(prefix='.v3-rollback-',dir=HERE) as temp:
        backup=pathlib.Path(temp);done=[]
        try:
            for rel in paths:
                src=stage/rel;dest=HERE/rel
                if dest.exists() and src.read_bytes()==dest.read_bytes():continue
                existed=dest.exists()
                if existed:
                    (backup/rel).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(dest,backup/rel)
                dest.parent.mkdir(parents=True,exist_ok=True)
                done.append((rel,existed))
                tmp=dest.with_name(dest.name+'.tmp');shutil.copy2(src,tmp);tmp.replace(dest)
        except Exception:
            for rel,existed in reversed(done):
                if existed:shutil.copy2(backup/rel,HERE/rel)
                else:(HERE/rel).unlink(missing_ok=True)
            raise


def update(root, force=True, log=print):
    global ROOT
    ROOT=validate_root(root)
    with update_lock():
        log('正在校验原版游戏文件；不加载创意工坊和用户 MOD。')
        files=source_files();hashes=fingerprint(files)
        index=json.loads((HISTORY/'index.json').read_text('utf-8')) if (HISTORY/'index.json').exists() else []
        old={}
        if index:
            prior=HISTORY/index[-1]['id']/'source-hashes.json'
            if prior.exists():old=json.loads(prior.read_text('utf-8'))
        state=HERE/'updater-source.json'
        if state.exists():
            previous=json.loads(state.read_text('utf-8'))
            if previous.get('snapshot')==(index[-1]['id'] if index else None):old=previous['hashes']
        changed=not old or sources_changed(old,hashes)
        if not force and not changed and all((HERE/f).exists() and (HERE/'en'/f).exists() for f in OUTPUTS):
            log('原版数据没有变化，无需更新。');return {'changed':False,'snapshot':None}
        with tempfile.TemporaryDirectory(prefix='.v3-update-',dir=HERE) as temp:
            stage=pathlib.Path(temp)
            for p in HERE.iterdir():
                if p.is_file() and p.suffix in {'.py','.json','.js','.csv'}:shutil.copy2(p,stage/p.name)
            # Generate artwork afresh, so changed icons with old timestamps also update.
            (stage/'assets').mkdir();(stage/'en').mkdir();(stage/'history').mkdir()
            if index:
                prior=stage/'history'/index[-1]['id'];prior.mkdir()
                for name in ['records.js','source-hashes.json']:
                    src=HISTORY/index[-1]['id']/name
                    if src.exists():shutil.copy2(src,prior/name)
            original_ids={e['id'] for e in index}
            if not index and (stage/'data.js').exists():snapshot(index,baseline=True,base=stage)
            env={**os.environ,'PYTHONIOENCODING':'utf-8','PYTHONUNBUFFERED':'1'}
            def run(builder):
                log('正在生成：'+builder)
                with subprocess.Popen([sys.executable,'-B',str(stage/builder),str(ROOT)],cwd=stage,env=env,
                                      stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace') as proc:
                    for line in proc.stdout:log(line.rstrip())
                    if proc.wait():raise RuntimeError(builder+' 生成失败；当前百科保持不变。')
            for builder in BUILDERS:run(builder)
            for name in OUTPUTS:
                if not read_data(stage/name):raise RuntimeError('生成的数据为空：'+name)
            if fingerprint(source_files())!=hashes:raise RuntimeError('提取期间游戏文件发生变化，请等待 Steam 更新完成再重试。')
            entry=snapshot(index,hashes,files,base=stage) if changed else None
            atomic_json(stage/'history-data.js',index,'window.V3_HISTORY=')
            run('build_i18n.py')
            for name in OUTPUTS:read_data(stage/'en'/name)
            atomic_json(stage/'updater-source.json',{'snapshot':index[-1]['id'],'hashes':hashes})
            paths=[pathlib.Path(f) for f in OUTPUTS+['history-data.js','i18n-dictionary.js','i18n-ui.json','i18n-report.json','updater-source.json']]
            paths.extend(p.relative_to(stage) for folder in ['assets','en'] for p in (stage/folder).rglob('*') if p.is_file())
            paths.extend(p.relative_to(stage) for p in stage.glob('*.csv'))
            for item in index:
                if item['id'] not in original_ids:
                    paths.extend(p.relative_to(stage) for p in (stage/'history'/item['id']).rglob('*') if p.is_file())
            if (stage/'history/index.json').exists():paths.append(pathlib.Path('history/index.json'))
            if fingerprint(source_files())!=hashes:raise RuntimeError('更新期间游戏文件发生变化，请等待 Steam 更新完成再重试。')
            log('生成与校验完成，正在保存更新。')
            publish(stage,paths)
        log('整站中英文更新完成；'+('已保存新的原版快照。' if entry else '原版内容未变化，不重复创建快照。'))
        return {'changed':changed,'snapshot':entry['id'] if entry else None,'version':read_data(HERE/'data.js')['version']}


def main():
    parser=argparse.ArgumentParser()
    settings=HERE/'updater-settings.json'
    default_root=json.loads(settings.read_text('utf-8')).get('root',str(ROOT)) if settings.exists() else str(ROOT)
    parser.add_argument('--root',default=default_root);parser.add_argument('--force',action='store_true');parser.add_argument('--baseline',action='store_true')
    args=parser.parse_args()
    if args.baseline:
        with update_lock():
            HISTORY.mkdir(exist_ok=True)
            index=json.loads((HISTORY/'index.json').read_text('utf-8')) if (HISTORY/'index.json').exists() else []
            if not index:snapshot(index,baseline=True)
        return
    update(args.root,force=args.force)

if __name__=='__main__':main()
