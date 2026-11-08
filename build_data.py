import json, re, pathlib, datetime, sys
from PIL import Image
import hashlib

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv)>1 else r'F:\Program Files (x86)\Steam\steamapps\common\Victoria 3')
HERE = pathlib.Path(__file__).resolve().parent
asset_errors=[]
def icon(source):
    if not source: return ''
    src=ROOT/'game'/source
    dest=HERE/'assets'/(hashlib.sha1(source.encode()).hexdigest()[:16]+'.png')
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
def load(folder):
    result={}
    for p in sorted((ROOT/'game/common'/folder).glob('*.txt')):
        for k,v in parse(p.read_text(encoding='utf-8-sig')):
            if isinstance(v,list): result[k]=(v,str(p.relative_to(ROOT)))
    return result
def get(obj,key,default=None):
    return next((v for k,v in obj if k==key),default)
def ids(obj): return [k for k,v in (obj or [])]
loc={}
for p in sorted((ROOT/'game/localization/simp_chinese').rglob('*.yml')):
    for line in p.read_text(encoding='utf-8-sig').splitlines():
        m=re.match(r'\s*([\w.\-]+):\d*\s*"(.*)"',line)
        if m: loc[m[1]]=m[2]
defines={}
for p in (ROOT/'game/common/defines').glob('*.txt'):
    for key,value in re.findall(r'^\s*(\w+)\s*=\s*([-\d.]+)',p.read_text(encoding='utf-8-sig'),re.M):
        defines[key]=value
unresolved_localization=set()
localization_fallbacks=json.loads((HERE/'localization-fallbacks.json').read_text(encoding='utf-8'))
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
    for scaling,values in get(v,'building_modifiers',[]):
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
    buildings.append({'id':k,'name':name(k),'icon':icon(get(v,'icon')),'category':pathlib.Path(s).stem,'group':name(get(v,'building_group','')),'groups':gs,'source':s})
data={'version':json.loads((ROOT/'launcher/launcher-settings.json').read_text(encoding='utf-8-sig'))['version'],'generated':datetime.datetime.now().isoformat(timespec='seconds'),'root':str(ROOT),'goods':goods,'methods':methods,'groups':groups,'buildings':buildings,'jobs':{k:name(k) for p in methods.values() for k in p['jobs']},'modifierLabels':{x[1]:name(x[1]) for p in methods.values() for x in p['other']},'issues':issues}
assert not issues,issues
(HERE/'data.js').write_text('window.V3_DATA='+json.dumps(data,ensure_ascii=False)+';',encoding='utf-8')
print(f"Generated {len(buildings)} buildings, {len(groups)} groups, {len(methods)} methods, {len(goods)} goods; unresolved numeric values: {len(issues)}")
print(f'Artwork conversion failures: {len(asset_errors)}')
for err in asset_errors: print(err)

