"""Offline archive of named characters and historical templates in the installed game."""
import json,re,collections
from build_data import ROOT,HERE,parse,get,name,icon,load

def read(p):return parse(re.sub(r'\b(?:hsv360|hsv|rgb)\s*(?=\{)','',p.read_text(encoding='utf-8-sig').replace('?=','=')))
def files(folder):return sorted((ROOT/'game'/folder).rglob('*.txt'))
def keys(v):return [k.strip('"') for k,_ in v or []]
def scalar(v,key,default=''):
    value=get(v,key,default)
    return value.split(':')[-1] if isinstance(value,str) else default
geo=json.loads((HERE/'geopolitics-data.js').read_text(encoding='utf-8-sig').split('=',1)[1].rstrip().rstrip(';'))
country_names={k:c['name'] for k,c in geo['countries'].items()}
for p in files('common/country_definitions'):
    for k,v in read(p):
        if isinstance(v,list):country_names.setdefault(k,name(k))
raw={};sources={};duplicates=[]
for p in files('common/character_templates'):
    for k,v in read(p):
        if not isinstance(v,list):continue
        if k in raw:duplicates.append(k)
        raw[k]=v;sources[k]=p.relative_to(ROOT).as_posix()

def resolve(k,seen=()):
    if k in seen:raise ValueError(('template cycle',k))
    v=raw[k];parent=scalar(v,'template')
    if parent in raw:
        own={a for a,_ in v};return [(a,b) for a,b in resolve(parent,seen+(k,)) if a not in own]+v
    return v
refs=collections.defaultdict(list);inline={}
# Country history may contain DLC-conditional character creation. Preserve that distinction.
def scan(entries,p,country='',conditional=False,opening=False,trail=()):
    for index,(action,v) in enumerate(entries):
        if not isinstance(v,list):continue
        current=action[2:] if re.fullmatch(r'c:[A-Z0-9]+',action) else country
        cond=conditional or action in ['if','else_if','else','random_list','random','random_country','every_country']
        if action=='create_character':
            key=scalar(v,'template')
            if not key:
                key='inline:'+p.relative_to(ROOT).as_posix()+':'+'.'.join(map(str,trail+(index,)))
                inline[key]=v;sources[key]=p.relative_to(ROOT).as_posix()
            refs[key].append({'country':current,'opening':opening,'conditional':cond,'source':p.relative_to(ROOT).as_posix(),'overrides':[(a,b) for a,b in v if a not in ['template','on_created']]})
        scan(v,p,current,cond,opening,trail+(index,))
for p in files('common/history/characters'):scan(read(p),p,opening=True)
# Explicit later creation references are displayed as evidence, not as a promise to spawn.
for folder in ['events','common/scripted_effects']:
    for p in files(folder):scan(read(p),p)
raw.update(inline)
characters=[];skipped=[]
role_labels={'ruler':'统治者','heir':'继承人','general':'陆军将领','admiral':'海军将领','agitator':'鼓动者','politician':'政治家','executive':'企业高管','other':'其他人物'}
for k in raw:
    v=resolve(k)
    opening_overrides=[r for r in refs[k] if r['opening'] and not r['conditional']]
    # Apply a history override only when every unconditional creation agrees.
    for field in ['first_name','last_name','culture','religion','ideology','interest_group','birth_date','female']:
        values=[get(r['overrides'],field) for r in opening_overrides]
        if values and values[0] is not None and all(x==values[0] for x in values) and isinstance(values[0],str):v=[(a,b) for a,b in v if a!=field]+[(field,values[0])]
    first=scalar(v,'first_name');last=scalar(v,'last_name');historical=scalar(v,'historical')=='yes'
    fixed=first not in ['', 'culture','random'] or last not in ['', 'culture','random']
    if not fixed or (k.startswith('inline:') and first in ['', 'culture','random']):skipped.append(k);continue
    first='' if first in ['culture','random'] else first;last='' if last in ['culture','random'] else last
    culture=scalar(v,'culture');religion=scalar(v,'religion');given=name(first);family=name(last)
    display=(family+given if culture in ['japanese','han','manchu','korean','vietnamese'] else ' '.join(s for s in [given,family] if s)).strip() or name(k)
    opening=[r for r in refs[k] if r['opening']]
    status='opening' if any(not r['conditional'] for r in opening) else 'conditional' if opening else 'historical'
    roles=keys(get(v,'roles',[]))+[b for a,b in v if a=='role' and isinstance(b,str)]
    roles += [a for a in role_labels if scalar(v,a)=='yes' or scalar(v,'is_'+a)=='yes']
    for r in opening:
        roles += [a.removeprefix('is_') for a,b in r['overrides'] if a.removeprefix('is_') in role_labels and b=='yes']
        roles += [b for a,b in r['overrides'] if a=='role' and isinstance(b,str)]
    roles=list(dict.fromkeys(roles))
    associations=[]
    def associate(tag,reason):
        if tag and tag in country_names and not any(a['country']==tag and a['reason']==reason for a in associations):associations.append({'country':tag,'reason':reason})
    for r in refs[k]:associate(r['country'],'开局创建（条件分支）' if r['opening'] and r['conditional'] else '开局创建' if r['opening'] else '后续创建脚本')
    prefix=k.split('_')[0].upper()
    if prefix in country_names:associate(prefix,'模板标识所属国家')
    filetag=re.search(r'/country_([a-z0-9]+)\.txt$',sources[k])
    if filetag:associate(filetag[1].upper(),'国家模板文件归类')
    # Usage triggers may explicitly select a country; negative tests are not country ownership evidence.
    def usage_country(entries):
        for a,b in entries:
            if a in ['NOT','NOR','limit']:continue
            if re.fullmatch(r'c:[A-Z0-9]+',a) and isinstance(b,str) and b.lower()=='this':associate(a[2:],'登场条件指定国家')
            if isinstance(b,list):usage_country(b)
    for a,b in v:
        if a.endswith('_usage') and isinstance(b,list):usage_country(b)
    home=scalar(v,'home_region')
    if not associations and home.startswith('STATE_'):
        for t,c in geo['countries'].items():
            if any(s['state']==home for s in c['states']):associate(t,'家乡开局所属国家（推定）')
    desc=name(k+'_desc');desc='' if desc==k+'_desc' else desc
    usage=[{'kind':a,'earliest':scalar(b,'earliest_usage_date'),'latest':scalar(b,'latest_usage_date')} for a,b in v if a.endswith('_usage') and isinstance(b,list)]
    ideology=scalar(v,'ideology')
    if ideology in ['random','random_accepted']:ideology=''
    characters.append({'id':k,'name':display,'firstName':given,'lastName':family,'searchNames':' '.join([k,first,last,given,family,display]).replace('_',' '),'historical':historical,'kind':'special' if any(part in sources[k] for part in ['spooky_templates','test_template','00_default_template']) else 'named','status':status,'countries':associations,'openingCountries':list(dict.fromkeys(r['country'] for r in opening if r['country'])),'ideology':ideology,'culture':culture,'religion':religion,'birthDate':scalar(v,'birth_date'),'deathDate':scalar(v,'death_date'),'age':scalar(v,'age'),'female':scalar(v,'female')=='yes','roles':roles,'interestGroup':scalar(v,'interest_group'),'home':home,'traits':keys(get(v,'traits',[])),'description':desc,'usage':usage,'references':[{a:b for a,b in r.items() if a!='overrides'} for r in refs[k]],'source':sources[k],'definition':v,'creationOverrides':[{'country':r['country'],'conditional':r['conditional'],'values':r['overrides']} for r in opening if r['overrides']]})

def metadata(folder,used):
    defs={k:(v,p.relative_to(ROOT).as_posix()) for p in files('common/'+folder) for k,v in read(p) if isinstance(v,list)};out={}
    for k in used:
        fallback=next(((v,s) for v,s in defs.values() if get(v,'type')==k),([],'')) if folder=='character_roles' else ([], '')
        v,src=defs.get(k,fallback);desc=name(k+'_desc')
        out[k]={'name':role_labels.get(k,name(k)),'icon':icon(get(v,'icon') or get(v,'texture')),'description':desc if desc!=k+'_desc' else '','source':src}
    return out
# Catalogs also include entries not assigned to a named character template.
ideology_defs=load('ideologies');trait_defs=load('character_traits');modifier_defs=load('modifier_type_definitions')
ideologies=metadata('ideologies',set(ideology_defs)|{c['ideology'] for c in characters if c['ideology']})
traits=metadata('character_traits',set(trait_defs)|{k for c in characters for k in c['traits']})

def catalog_script(text):
    tokens=[t for t in re.findall(r'"(?:\\.|[^"\\])*"|#[^\n]*|>=|<=|!=|\?=|[{}=<>]|[^\s{}=<>!?#]+',text.lstrip('\ufeff')) if not t.startswith('#')];i=0
    def block():
        nonlocal i
        out=[]
        while i<len(tokens):
            key=tokens[i];i+=1
            if key=='}':return out
            op='';value=None
            if i<len(tokens) and tokens[i] in ['=','>=','<=','>','<','!=','?=']:
                op=tokens[i];i+=1;value=tokens[i];i+=1
                value=block() if value=='{' else value.strip('"')
            out.append([key.strip('"'),op,value])
        return out
    return block()

catalog_labels={}
def catalog_collect(entries):
    for key,_,value in entries:
        catalog_labels[key]=name(key.split(':')[-1])
        if isinstance(value,list):catalog_collect(value)
        elif value is not None:catalog_labels[value]=name(value.split(':')[-1])
def catalog_effects(v):
    result={}
    for scope,values in v:
        if not scope.endswith('_modifier') or not isinstance(values,list):continue
        result[scope]=[]
        for key,value in values:
            props=modifier_defs.get(key,([],''))[0]
            result[scope].append({'id':key,'name':name(key),'value':value,'percent':get(props,'percent')=='yes','color':get(props,'color','neutral')})
    return result

for folder_name,meta,definitions in [('ideologies',ideologies,ideology_defs),('character_traits',traits,trait_defs)]:
    scripts={k:v for p in files('common/'+folder_name) for k,_,v in catalog_script(p.read_text('utf-8-sig')) if isinstance(v,list)}
    for key,m in meta.items():
        v,src=definitions.get(key,([],''));definition=scripts.get(key,[]);catalog_collect(definition)
        m.update({'id':key,'effects':catalog_effects(v),'definition':definition})
        if folder_name=='ideologies':
            m['kind']='character' if get(v,'character_ideology')=='yes' else 'group'
            m['stances']=[{'group':group,'law':law,'stance':stance} for group,values in v if group.startswith('lawgroup_') and isinstance(values,list) for law,stance in values]
            m['conditions']={k:b for k,op,b in definition if k in ['country_trigger','interest_group_leader_trigger','non_interest_group_leader_trigger']}
        else:
            m['kind']=get(v,'type','other');m['replaces']=keys(get(v,'replace',[]))
            m['missions']=keys(get(v,'affected_naval_mission_types',[]))
            m['conditions']={k:b for k,op,b in definition if k=='possible'}
        m['characterCount']=sum(c['ideology']==key if folder_name=='ideologies' else key in c['traits'] for c in characters)
roles=metadata('character_roles',set(role_labels)|{k for c in characters for k in c['roles']})
igs=metadata('interest_groups',{c['interestGroup'] for c in characters if c['interestGroup']})
labels={k:name(k) for c in characters for k in [c['culture'],c['religion'],c['home']] if k}
labels.update(catalog_labels)
result={'version':json.loads((HERE/'data.js').read_text(encoding='utf-8-sig').split('=',1)[1].rstrip().rstrip(';'))['version'],'cultureIds':sorted({k for p in files('common/cultures') for k,v in read(p) if isinstance(v,list)}),'characters':characters,'countries':country_names,'ideologies':ideologies,'traits':traits,'roles':roles,'interestGroups':igs,'labels':labels,'counts':{'templates':len(raw)-len(inline),'inline':len(inline),'excludedGeneric':len(skipped),'duplicateDefinitions':duplicates},'source':'原版 common/character_templates + common/history/characters；后续创建引用来自 events 和 common/scripted_effects。开局条件分支未执行；模板国家归类与家乡推定不代表实际国籍或必然登场。人物肖像由游戏 DNA 实时生成，本页不伪造画像。'}
(HERE/'characters-data.js').write_text('window.V3_CHARACTERS='+json.dumps(result,ensure_ascii=False,separators=(',',':'))+';',encoding='utf-8')
assert len({c['id'] for c in characters})==len(characters)
print('Character archive:',len(characters),'records;',collections.Counter(c['status'] for c in characters),'generic excluded',len(skipped),'unassociated',sum(not c['countries'] for c in characters))
