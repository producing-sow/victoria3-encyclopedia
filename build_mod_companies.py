"""Build an isolated More Unique Companies catalogue; never overwrite vanilla data."""
import argparse,hashlib,json,pathlib,re,struct
from PIL import Image

HERE=pathlib.Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--game-root',type=pathlib.Path,default=pathlib.Path(r'F:\Program Files (x86)\Steam\steamapps\common\Victoria 3'))
parser.add_argument('--mod-root',type=pathlib.Path,default=pathlib.Path(r'F:\Program Files (x86)\Steam\steamapps\workshop\content\529340\3032185644'))
parser.add_argument('--translation-root',type=pathlib.Path,default=pathlib.Path(r'F:\Program Files (x86)\Steam\steamapps\workshop\content\529340\3086429193'))
args=parser.parse_args()
GAME=args.game_root/'game';MOD=args.mod_root;TRANSLATION=args.translation_root
for path in [GAME/'common/company_types',MOD/'common/company_types',TRANSLATION/'localization/simp_chinese']:
    if not path.is_dir():raise FileNotFoundError(path)

def parse(text):
    tokens=[t for t in re.findall(r'"(?:\\.|[^"\\])*"|#[^\n]*|>=|<=|!=|\?=|[{}=<>]|[^\s{}=<>!?#]+',text.lstrip('\ufeff')) if not t.startswith('#')]
    i=0
    def block(nested=False):
        nonlocal i
        entries=[]
        while i<len(tokens):
            key=tokens[i];i+=1
            if key=='{':
                entries.append(['','',block(True)]);continue
            if key=='}':
                if not nested:raise ValueError('Unexpected closing brace near '+str(tokens[max(0,i-18):i+3]))
                return entries
            op='';value=None
            if i<len(tokens) and tokens[i] in ['=','>=','<=','>','<','!=','?=']:
                op=tokens[i];i+=1;value=tokens[i];i+=1
                value=block(True) if value=='{' else value.strip('"')
            entries.append([key.strip('"'),op,value])
        if nested:raise ValueError('Unclosed script block')
        return entries
    return block()

def get(entries,key,default=None):return next((value for k,_,value in entries if k==key),default)
def ids(entries):return [key for key,_,_ in entries or []]
def bundle(path):
    text=path.read_text('utf-8-sig');return json.loads(text.split('=',1)[1].rstrip().rstrip(';'))
def localization(root,language):
    result={}
    for p in sorted((root/'localization'/language).rglob('*.yml')):
        for line in p.read_text('utf-8-sig').splitlines():
            match=re.match(r'\s*([\w.\-]+):\d*\s*"(.*)"',line)
            if match:result[match[1]]=match[2]
    return result

base_zh=localization(GAME,'simp_chinese');base_en=localization(GAME,'english')
mod_en=localization(MOD,'english');mod_zh=localization(MOD,'simp_chinese');translation=localization(TRANSLATION,'simp_chinese')
vanilla=bundle(HERE/'companies-data.js');vanilla_ids={c['id'] for c in vanilla['companies']}
defines={}
for file in (GAME/'common/defines').glob('*.txt'):
    defines.update(re.findall(r'^\s*(\w+)\s*=\s*([-\d.]+)',file.read_text('utf-8-sig'),re.M))
definitions={};duplicates=[]
for file in sorted((MOD/'common/company_types').glob('*.txt')):
    for key,_,value in parse(file.read_text('utf-8-sig')):
        operation,key=key.split(':',1) if ':' in key else ('ADD',key)
        if not key.startswith('company_') or not isinstance(value,list):continue
        if key in definitions:duplicates.append(key)
        if operation not in ['ADD','TRY_REPLACE','REPLACE']:raise ValueError((operation,key))
        definitions[key]=(value,file.relative_to(MOD).as_posix(),operation)
modifiers={};prestige={};triggers={}
for root in [GAME,MOD,TRANSLATION]:
    for folder,target in [('modifier_type_definitions',modifiers),('prestige_goods',prestige),('scripted_triggers',triggers)]:
        for p in sorted((root/'common'/folder).glob('*.txt')):
            try:entries=parse(p.read_text('utf-8-sig'))
            except ValueError as exc:raise ValueError(f'{p}: {exc}') from exc
            for key,_,value in entries:
                if isinstance(value,list):target[key.split(':')[-1]]=value

asset_issues=[]
def open_artwork(source):
    try:return Image.open(source)
    except NotImplementedError:
        # Some mod logos use uncompressed DX10 BGRA sRGB, unsupported by Pillow's DDS plugin.
        data=source.read_bytes()
        if data[:4]!=b'DDS ' or data[84:88]!=b'DX10' or struct.unpack_from('<I',data,128)[0] not in [87,91]:raise
        flags,height,width,pitch=struct.unpack_from('<4I',data,8)
        stride=pitch if flags&8 else width*4
        return Image.frombytes('RGBA',(width,height),data[148:],'raw','BGRA',stride,1)

def artwork(relative,background=False):
    if not relative:return ''
    for root,layer in [(TRANSLATION,'translation'),(MOD,'mod'),(GAME,'vanilla')]:
        source=root/relative
        if not source.is_file():continue
        key=hashlib.sha1((layer+'/'+relative).encode()).hexdigest()[:20]
        dest=HERE/'assets'/('more-companies-'+key+('.jpg' if background else '.png'))
        if not dest.exists() or source.stat().st_mtime>dest.stat().st_mtime:
            with open_artwork(source) as image:
                image=image.convert('RGB' if background else 'RGBA');image.thumbnail((1400,800) if background else (256,256))
                image.save(dest,**({'quality':88} if background else {'optimize':True}))
        return dest.relative_to(HERE).as_posix()
    if relative not in asset_issues:asset_issues.append(relative)
    return ''

regions_zh=dict(zip('Algeria Zimbabwe WestAfrica Vietnam USA Uruguay Uganda Tunisia Switzerland Sweden Spain SouthAndean SouthAfrica Siam Serbia Russia Romania Portugal Poland Philippines Persia Ottomans Norway NorthAndean Netherlands Morocco Mexico Malta Malaysia Malawi Madagascar Luxembourg Lithuania Latvia Korea Kenya Japan Jamaica Italy Ireland Iceland Haiti Greece Germany GB France Finland Ethiopia Estonia EIC Egypt EastIndies Denmark Cuba Congo China CentralAmerica Canada Brazil Belgium Austria Australia Argentina Arabian_Peninsula Angola'.split(),'阿尔及利亚 津巴布韦 西非 越南 美国 乌拉圭 乌干达 突尼斯 瑞士 瑞典 西班牙 南安第斯 南非 暹罗 塞尔维亚 俄罗斯 罗马尼亚 葡萄牙 波兰 菲律宾 波斯 奥斯曼 挪威 北安第斯 荷兰 摩洛哥 墨西哥 马耳他 马来亚 马拉维 马达加斯加 卢森堡 立陶宛 拉脱维亚 朝鲜 肯尼亚 日本 牙买加 意大利 爱尔兰 冰岛 海地 希腊 德意志 英国 法国 芬兰 埃塞俄比亚 爱沙尼亚 东印度公司 埃及 东印度 丹麦 古巴 刚果 中国 中美洲 加拿大 巴西 比利时 奥地利 澳大利亚 阿根廷 阿拉伯半岛 安哥拉'.split()))
metadata=json.loads((MOD/'.metadata/metadata.json').read_text('utf-8-sig'));translation_metadata=json.loads((TRANSLATION/'.metadata/metadata.json').read_text('utf-8-sig'))

def build(language):
    loc={**base_en,**(base_zh if language=='zh' else {}),**mod_en,**(mod_zh if language=='zh' else {}),**(translation if language=='zh' else {})}
    base=bundle(HERE/('companies-data.js' if language=='zh' else 'en/companies-data.js'))
    fallback=base['labels'];labels={};used_triggers={}
    def name(key,depth=0):
        key=str(key)
        if depth>12:return key
        value=loc.get(key,fallback.get(key,key))
        def expression(match):
            expr=match[1];quoted=re.findall(r"'([^']*)'",expr)
            if expr in ['nbsp','nbspace']:return ' '
            if expr.startswith('GetDefine(') and len(quoted)>1:return defines.get(quoted[1],quoted[1])
            if expr.startswith('Concept(') and quoted:return name(quoted[-1],depth+1)
            if quoted:return name(quoted[0],depth+1)
            if re.fullmatch(r'[\w.]+(?:\|[^\]]+)?',expr):return name(expr.split('|')[0],depth+1)
            return '动态游戏文本' if language=='zh' else 'Dynamic game text'
        for _ in range(8):
            old=value
            value=re.sub(r'\$([\w.]+)(?:\|[^$]*)?\$',lambda m:name(m[1],depth+1),value)
            value=re.sub(r'\[([^\[\]]+)\]',expression,value)
            if old==value:break
        return re.sub(r'#[A-Za-z_]+\s?|#!|@[^!]+!','',value).replace('\\n',' ').replace('\\"','"').strip()
    def collect(entries,seen=None):
        seen=set() if seen is None else seen
        for key,_,value in entries:
            labels[key]=name(key.split(':')[-1])
            if key in triggers and key not in seen:
                used_triggers[key]=triggers[key];collect(triggers[key],seen|{key})
            if isinstance(value,list):collect(value,seen)
            elif value is not None:labels[value]=name(value.split(':')[-1])
    companies=[]
    for key,(v,source,operation) in definitions.items():
        collect(v);region=pathlib.Path(source).stem.removeprefix('00_flavoured_companies_').replace('00_MUC_basic_companies','basic')
        change='override' if key in vanilla_ids else 'missing_target' if operation=='TRY_REPLACE' else 'added'
        description=name(key+'_desc');description='' if description==key+'_desc' else description
        prosperity=get(v,'prosperity_modifier',[])
        valid_prosperity=[entry for entry in prosperity if entry[1]=='=' and isinstance(entry[2],str) and re.fullmatch(r'-?\d+(?:\.\d+)?',entry[2])]
        invalid_prosperity=[entry for entry in prosperity if entry not in valid_prosperity]
        row={'id':key,'name':name(key),'description':description,'icon':artwork(get(v,'icon')),'background':artwork(get(v,'background'),True),
             'historical':get(v,'flavored_company')=='yes','dynamic':get(v,'uses_dynamic_naming')=='yes','category':get(v,'category','default'),'region':region,
             'buildings':ids(get(v,'building_types',[])),'extensions':ids(get(v,'extension_building_types',[])),'headquarters':ids(get(v,'preferred_headquarters',[])),'prestige':ids(get(v,'possible_prestige_goods',[])),
             'prosperity':valid_prosperity,'sourceIssues':invalid_prosperity,'conditions':{field:get(v,field,[]) for field in ['potential','attainable','possible','can_establish_in','prestige_goods_trigger']},
             'definition':v,'source':source,'changeType':change,'operation':operation,'nameTranslated':key in translation or key in mod_zh,'nameSource':'translation' if key in translation else 'mod' if key in mod_en or key in mod_zh else 'vanilla'}
        for item in row['buildings']+row['extensions']+row['headquarters']+row['prestige']:labels[item]=name(item)
        labels[key]=row['name'];companies.append(row)
    prestige_ids={key for c in companies for key in c['prestige']}
    prestige_meta={key:{'name':name(key),'icon':artwork(get(prestige[key],'texture'))} for key in prestige_ids if key in prestige}
    modifier_meta={key:{'percent':get(modifiers.get(key,[]),'percent')=='yes'} for c in companies for key,_,_ in c['prosperity'] if key in modifiers}
    stats={change:sum(c['changeType']==change for c in companies) for change in ['added','override','missing_target']}
    result={'companies':companies,'labels':labels,'prestigeGoods':prestige_meta,'modifierMeta':modifier_meta,'scriptedTriggers':used_triggers,
            'regions':{key:regions_zh.get(key,'通用' if key=='basic' else key) if language=='zh' else {'GB':'Great Britain','USA':'United States','EIC':'East India Company','basic':'Generic'}.get(key,re.sub(r'(?<=[a-z])(?=[A-Z])',' ',key)) for key in {c['region'] for c in companies}},
            'meta':{'name':metadata['name'],'translationName':translation_metadata['name'],'modId':'3032185644','translationId':'3086429193','modRoot':str(MOD),'translationRoot':str(TRANSLATION),'stats':stats,'translatedNames':sum(c['nameTranslated'] for c in companies),'duplicates':duplicates,'missingAssets':asset_issues,'supportedGameVersion':metadata.get('supported_game_version','')}}
    dest=HERE/('mod-companies-data.js' if language=='zh' else 'en/mod-companies-data.js');dest.parent.mkdir(exist_ok=True)
    dest.write_text('window.V3_MOD_COMPANIES='+json.dumps(result,ensure_ascii=False,separators=(',',':'))+';',encoding='utf-8')
    return result

result=build('zh');build('en')
print(json.dumps({'companies':len(result['companies']),**result['meta']['stats'],'translatedNames':result['meta']['translatedNames'],'missingAssets':asset_issues,'duplicates':duplicates},ensure_ascii=False))
