import json, re, pathlib, datetime, sys
from PIL import Image
import hashlib

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv)>1 else r'F:\Program Files (x86)\Steam\steamapps\common\Victoria 3')
HERE = pathlib.Path(__file__).resolve().parent
MOD_ROOT = pathlib.Path(sys.argv[sys.argv.index('--mod')+1]) if '--mod' in sys.argv else None
LANGUAGE = sys.argv[sys.argv.index('--language')+1] if '--language' in sys.argv else 'simp_chinese'
OUTPUT = pathlib.Path(sys.argv[sys.argv.index('--output')+1]) if '--output' in sys.argv else HERE/'data.js'
GLOBAL = 'V3_INDUSTRIAL_CHAIN_DATA' if MOD_ROOT else 'V3_DATA'
mod_metadata = json.loads((MOD_ROOT/'.metadata/metadata.json').read_text('utf-8-sig')) if MOD_ROOT else {}
building_categories = {}
asset_errors=[]
def icon(source):
    if not source: return ''
    src=ROOT/'game'/source
    mod_asset=MOD_ROOT and (MOD_ROOT/source).is_file()
    if mod_asset: src=MOD_ROOT/source
    asset_key=('industrial-chain/'+source) if mod_asset else source
    dest=HERE/'assets'/(hashlib.sha1(asset_key.encode()).hexdigest()[:16]+'.png')
    try:
        if not dest.exists() or src.stat().st_mtime>dest.stat().st_mtime:
            dest.parent.mkdir(exist_ok=True)
            with Image.open(src) as im:
                im=im.convert('RGBA'); im.thumbnail((256,256)); im.save(dest,optimize=True)
        return dest.relative_to(HERE).as_posix()
    except Exception as exc:
        asset_errors.append([source,str(exc)])
        return ''
def parse(text):
    tokens=re.findall(r'"(?:\\.|[^"\\])*"|#[^\n]*|[{}=]|[^\s{}=#]+',text.lstrip('\ufeff'))
    tokens=[t for t in tokens if not t.startswith('#')]; i=0
    def block():
        nonlocal i
        result=[]
        while i<len(tokens):
            key=tokens[i]; i+=1
            if key=='}': break
            if i<len(tokens) and tokens[i]=='=':
                i+=1; value=tokens[i]; i+=1
                if value=='{': value=block()
                else: value=value.strip('"')
                result.append((key,value))
            else: result.append((key,None))
        return result
    return block()
def inject(original, patch):
    """Jomini INJECT appends list members and recursively merges named blocks."""
    result=list(original)
    for key,value in patch:
        matches=[i for i,(k,v) in enumerate(result) if k==key]
        if value is None:
            result.append((key,value))
        elif matches:
            i=matches[-1];old=result[i][1]
            result[i]=(key,inject(old,value) if isinstance(old,list) and isinstance(value,list) else value)
        else: result.append((key,value))
    return result

def load(folder):
    result={}
    mod_files={p.name:p for p in (MOD_ROOT/'common'/folder).glob('*.txt')} if MOD_ROOT else {}
    replace_paths=mod_metadata.get('game_custom_data',{}).get('replace_paths',[])
    replaced=any(('common/'+folder)==p.rstrip('/') or ('common/'+folder).startswith(p.rstrip('/')+'/') for p in replace_paths)
    for p in sorted((ROOT/'game/common'/folder).glob('*.txt')):
        if replaced or p.name in mod_files: continue
        for k,v in parse(p.read_text(encoding='utf-8-sig')):
            if isinstance(v,list):
                result[k]=(v,p.relative_to(ROOT).as_posix())
                if folder=='buildings':building_categories[k]=p.stem
    for p in sorted(mod_files.values()):
        for raw_key,v in parse(p.read_text('utf-8-sig')):
            if not isinstance(v,list):continue
            operation,k=raw_key.split(':',1) if ':' in raw_key else ('CREATE',raw_key)
            source='MOD/3723966801/'+p.relative_to(MOD_ROOT).as_posix()
            if operation not in ['CREATE','REPLACE','REPLACE_OR_CREATE','INJECT']:
                raise ValueError('Unsupported MOD operation: '+raw_key)
            if operation in ['REPLACE','INJECT'] and k not in result:
                raise ValueError('Missing target for MOD operation: '+raw_key)
            if operation=='INJECT':
                old,old_source=result[k];v=inject(old,v);source=old_source+' + '+source
            result[k]=(v,source)
            if folder=='buildings' and k not in building_categories:
                category={'moim_agro':'02_agro','moim_construction':'13_construction','moim_industry':'01_industry','moim_mines':'03_mines','moim_misc_resource':'09_misc_resource','moim_plantations':'04_plantations','moim_private_infrastructure':'11_private_infrastructure','moim_subsistence':'12_subsistence','moim_urban_center':'06_urban_center','zz_moim_commercial_collection':'11_private_infrastructure'}
                group=get(v,'building_group','')
                building_categories[k]=category.get(p.stem,'03_mines' if 'mining' in group else '01_industry')
    return result
def get(obj,key,default=None):
    return next((v for k,v in obj if k==key),default)
def ids(obj): return [k for k,v in (obj or [])]
loc={}
for loc_root in [ROOT/'game/localization',*([MOD_ROOT/'localization'] if MOD_ROOT else [])]:
    for p in sorted((loc_root/LANGUAGE).rglob('*.yml')):
        for line in p.read_text(encoding='utf-8-sig').splitlines():
            m=re.match(r'\s*([\w.\-]+):\d*\s*"(.*)"',line)
            if m: loc[m[1]]=m[2]
defines={}
for p in (ROOT/'game/common/defines').glob('*.txt'):
    for key,value in re.findall(r'^\s*(\w+)\s*=\s*([-\d.]+)',p.read_text(encoding='utf-8-sig'),re.M):
        defines[key]=value
unresolved_localization=set()
localization_fallbacks=json.loads((HERE/'localization-fallbacks.json').read_text(encoding='utf-8')) if LANGUAGE=='simp_chinese' else {}
def name(k,depth=0):
    if depth>12:return str(k)
    value=loc.get(k,k)
    if value==k and k in localization_fallbacks:return localization_fallbacks[k]
    if value==k and re.fullmatch(r'(?:ep|ip|rp|mp)\d+_content',k):return '扩展内容 '+k.removesuffix('_content').upper()
    if value==k and k.startswith('prestige_good_generic_') and k.endswith('_var'):
        base=k.removeprefix('prestige_good_generic_').removesuffix('_var')
        return '声望商品解锁状态：'+name(base,depth+1)
    if value==k and k.startswith('building_'):
        heading=re.search(r'#header\s+(.*?)#!',loc.get('MONUMENT_TRIVIA_'+k,''))
        if heading:return heading[1]
    if k.startswith('building_') and ('building_dummy' in value or 'is a dummy building' in value):
        trivia=loc.get('MONUMENT_TRIVIA_'+k,'')
        heading=re.search(r'#header\s+(.*?)#!',trivia)
        fallback=loc.get('pm_default_'+k,'')
        if heading or fallback:return (heading[1] if heading else fallback)+'（景观占位）'
    if value==k and k.startswith('principle_'):
        match=re.fullmatch(r'principle_(.+)_([123])',k)
        if match and 'principle_group_'+match[1] in loc:
            return name('principle_group_'+match[1],depth+1)+' '+['','Ⅰ','Ⅱ','Ⅲ'][int(match[2])]
    def expression(m):
        expr=m[1]
        if expr.lower() in ['nbsp','nbspace']:return ' '
        args=re.findall(r"'([^']*)'",expr)
        if expr.startswith('Concept('):
            return name(args[1] if len(args)>1 else args[0],depth+1) if args else '游戏概念'
        if expr.startswith('GetDefine(') and len(args)>1:
            return defines.get(args[1],args[1])
        if expr.startswith('Get') and args:
            return name(args[0],depth+1)
        if re.fullmatch(r'[\w.]+(?:\|[^\]]+)?',expr):
            return name(expr.split('|')[0],depth+1)
        unresolved_localization.add(expr)
        return '动态游戏文本'
    for _ in range(8):
        old=value
        value=re.sub(r'\$([\w.]+)(?:\|[^$]*)?\$',lambda m:name(m[1],depth+1),value)
        value=re.sub(r'\[([^\[\]]+)\]',expression,value)
        if value==old:break
    return re.sub(r'#[A-Za-z_]+\s?|#!|@[^!]+!', '',value).replace('\\n',' ').strip()
goods={k:{'id':k,'name':name(k),'icon':icon(get(v,'texture')),'price':float(get(v,'cost',0)),'category':get(v,'category'),'source':s} for k,(v,s) in load('goods').items()}
methods={}; issues=[]
for k,(v,s) in load('production_methods').items():
    pm={'id':k,'name':name(k),'input':{},'output':{},'jobs':{},'other':[],'tech':[name(x) for x in ids(get(v,'unlocking_technologies',[]))],'conditions':[],'source':s}
    for key in ['unlocking_laws','disallowing_laws','unlocking_principles','unlocking_religions']:
        if get(v,key): pm['conditions'].append({'unlocking_laws':'需要法律','disallowing_laws':'不允许的法律','unlocking_principles':'需要集团原则','unlocking_religions':'需要宗教'}[key]+'：'+', '.join(name(x) for x in ids(get(v,key))))
    # Repeated building_modifiers blocks are legal (e.g. MOD bakery jobs).
    modifier_blocks=[pair for field,block in v if field=='building_modifiers' for pair in block]
    if MOD_ROOT:pm.update(inputMult={},outputMult={},throughput=0)
    for scaling,values in modifier_blocks:
        if not isinstance(values,list): continue
        for modifier,value in values:
            m=re.fullmatch(r'goods_(input|output)_(.+)_add',modifier)
            j=re.fullmatch(r'building_employment_(.+)_add',modifier)
            if m or j:
                try: n=float(value)
                except (ValueError,TypeError): issues.append([k,modifier,value]); continue
                target,good=(m[1],m[2]) if m else ('jobs',j[1])
                if m and good not in goods: raise ValueError('Unknown good '+good)
                pm[target][good]=pm[target].get(good,0)+n
            elif MOD_ROOT and scaling=='unscaled' and (re.fullmatch(r'goods_(input|output)_(.+)_mult',modifier) or modifier=='building_throughput_add'):
                try:n=float(value)
                except (ValueError,TypeError):issues.append([k,modifier,value]);continue
                mult=re.fullmatch(r'goods_(input|output)_(.+)_mult',modifier)
                if mult:
                    direction,good=mult.groups()
                    if good not in goods:raise ValueError('Unknown multiplier good '+good)
                    target=pm[direction+'Mult'];target[good]=target.get(good,0)+n
                else:pm['throughput']+=n
            else: pm['other'].append([scaling,modifier,value])
    pm['icon']=icon(get(v,'texture'))
    methods[k]=pm
groups={k:{'id':k,'name':name(k),'methods':ids(get(v,'production_methods',[]))} for k,(v,s) in load('production_method_groups').items()}
buildings=[]
for k,(v,s) in load('buildings').items():
    gs=ids(get(v,'production_method_groups',[]))
    if not gs: continue
    for g in gs:
        assert g in groups,(k,g)
        for p in groups[g]['methods']: assert p in methods,(g,p)
    buildings.append({'id':k,'name':name(k),'icon':icon(get(v,'icon')),'category':building_categories[k],'group':name(get(v,'building_group','')),'groups':gs,'source':s})
data={'version':json.loads((ROOT/'launcher/launcher-settings.json').read_text(encoding='utf-8-sig'))['version'],'generated':datetime.datetime.now().isoformat(timespec='seconds'),'root':str(ROOT),'goods':goods,'methods':methods,'groups':groups,'buildings':buildings,'jobs':{k:name(k) for p in methods.values() for k in p['jobs']},'modifierLabels':{x[1]:name(x[1]) for p in methods.values() for x in p['other']},'issues':issues}
assert not issues,issues
if MOD_ROOT:
    data.update(dataset='industrial-chain',mod={'id':'3723966801','name':'工业之链 MOD' if LANGUAGE=='simp_chinese' else 'Chains of Industry MOD','version':mod_metadata['version'],'supportedGameVersion':mod_metadata.get('supported_game_version',''),'root':str(MOD_ROOT)},calculation='pm-goods-multipliers')
OUTPUT.parent.mkdir(exist_ok=True,parents=True)
temporary=OUTPUT.with_suffix(OUTPUT.suffix+'.tmp')
temporary.write_text('window.'+GLOBAL+'='+json.dumps(data,ensure_ascii=False)+';',encoding='utf-8')
temporary.replace(OUTPUT)
print(f"Generated {len(buildings)} buildings, {len(groups)} groups, {len(methods)} methods, {len(goods)} goods; unresolved numeric values: {len(issues)}")
print(f'Artwork conversion failures: {len(asset_errors)}')
for err in asset_errors: print(err)

