"""Build the 1836 country atlas from installed game definitions."""
import json,re,collections,ast,math
import numpy as np
from PIL import Image
from build_data import ROOT,HERE,parse,get,name,load,icon

def read(path):
    text=path.read_text(encoding='utf-8-sig').replace('?=','=')
    return parse(re.sub(r'\b(?:rgb|hsv360|hsv)\s*(?=\{)','',text))
def files(folder):return sorted((ROOT/'game'/folder).glob('*.txt'))
def keys(v):return [k.strip('"') for k,_ in v or []]
def tag(s):return s.split(':')[-1].strip('"')
def scopes(folder):
    for p in files('common/history/'+folder):
        for _,entries in read(p):
            for k,v in entries:
                if isinstance(v,list):yield k,v,p.relative_to(ROOT).as_posix()
world=json.loads((HERE/'map-data.js').read_text(encoding='utf-8')[14:-1]); states={s['id']:s for s in world['states']}
countries={}; provinces={}; parts=[]
province_sets={k:set(keys(get(v,'provinces',[]))) for p in files('map_data/state_regions') for k,v in read(p) if isinstance(v,list)}
def country(t):
    return countries.setdefault(t,{'id':t,'name':name(t),'cultures':{},'religions':{},'population':0,'buildings':{},'buildingRows':[],'laws':{},'amendments':{},'institutions':{},'states':[],'subjects':[],'overlord':None,'blocs':[],'resources':{},'hidden':{},'arable':0,'sources':[]})
for scope,v,src in scopes('states'):
    sid=tag(scope)
    if sid not in states:continue
    for action,b in v:
        if action!='create_state':continue
        t=tag(get(b,'country'));c=country(t); owned=[p for p in keys(get(b,'owned_provinces',[])) if p in province_sets[sid]]
        if not owned:continue
        c['states'].append({'state':sid,'owned':owned})
        for p in owned:provinces[int(p.lstrip('xX'),16)]=t
for t,c in countries.items():
    for part in c['states']:
        owned=part.pop('owned');count=sum(provinces[int(p.lstrip('xX'),16)]==t for p in set(owned))
        part['provinces']=count;part['share']=count/states[part['state']]['provinceCount']
        state=states[part['state']]
        for field in ['resources','hidden']:
            for r,n in state[field].items():c[field][r]=c[field].get(r,0)+n*part['share']
        c['arable']+=state['arable']*part['share']
culture_defs={k:(v,str(p)) for p in files('common/cultures') for k,v in read(p) if isinstance(v,list)}
for scope,v,src in scopes('pops'):
    for owner,pops in v:
        c=country(tag(owner))
        for action,p in pops:
            if action!='create_pop':raise ValueError(action)
            n=int(get(p,'size',0));cu=get(p,'culture');religion=get(p,'religion') or get(culture_defs[cu][0],'religion')
            c['population']+=n;c['cultures'][cu]=c['cultures'].get(cu,0)+n
            c['religions'][religion]=c['religions'].get(religion,0)+n
laws=load('laws');lawgroups={get(v,'group'):name(get(v,'group')) for v,_ in laws.values()}
law_meta={k:{'name':name(k),'icon':icon(get(v,'icon')),'group':get(v,'group'),'institution':get(v,'institution'),'source':src} for k,(v,src) in laws.items()}
group_meta={k:{'name':name(k),'category':get(v,'law_group_category')} for k,(v,_) in load('law_groups').items()}
institution_meta={k:{'name':name(k),'icon':icon(get(v,'icon')),'source':src} for k,(v,src) in load('institutions').items()}
for meta in law_meta.values():
    if meta['institution']:
        assert meta['institution'] in institution_meta
        group_meta[meta['group']]['institution']=meta['institution']
amendment_defs=load('amendments');amendment_meta={}

def amendment_info(key):
    if key not in amendment_meta:
        v,src=amendment_defs[key];parent=get(v,'parent')
        amendment_meta[key]={'name':name(key),'description':name(key+'_desc'),'icon':law_meta.get(parent,{}).get('icon',''),'source':src}
    return amendment_meta[key]

defaults={}
for k,(v,_) in laws.items():defaults.setdefault(get(v,'group'),k)
definitions={k:v for p in files('common/country_definitions') for k,v in read(p) if isinstance(v,list)}
political_path=ROOT/'game/common/scripted_effects/00_political_setup.txt'
political_setup={k:v for k,v in read(political_path) if isinstance(v,list)}
political_source=political_path.relative_to(ROOT).as_posix()
islamic_trigger=load('scripted_triggers')['country_is_islamic'][0]

def starting_condition(entries,c):
    definition=definitions.get(c['id'],[])
    primary=keys(get(definition,'cultures',[]))
    religion=c.get('religion') or get(definition,'religion') or (get(culture_defs[primary[0]][0],'religion') if primary else None)
    values=[]
    for key,value in entries:
        if key=='OR':result=any(starting_condition([(k,v)],c) for k,v in value)
        elif key=='AND':result=starting_condition(value,c)
        elif key=='country_is_islamic':result=starting_condition(islamic_trigger,c)==(value=='yes')
        elif key=='country_has_state_religion':
            assert religion is not None,('missing starting religion',c['id'])
            result=religion==tag(value)
        elif key=='is_country_type':result=get(definition,'country_type')==value
        else:raise ValueError(('unsupported starting politics condition',key,value))
        values.append(result)
    return all(values)

def set_starting_law(c,value,source,template=None):
    law=tag(value);group=get(laws[law][0],'group');c['laws'][group]=law
    if group not in c['explicitLaws']:c['explicitLaws'].append(group)
    c['lawOrigins'][group]={'source':source,'template':template}

def apply_politics(c,entries,template):
    branch=None
    for action,body in entries:
        if action=='activate_law':set_starting_law(c,body,political_source,template)
        elif action=='if':
            branch=starting_condition(get(body,'limit',[]),c)
            if branch:apply_politics(c,[(k,v) for k,v in body if k!='limit'],template)
        elif action=='else':
            assert branch is not None
            if not branch:apply_politics(c,body,template)
        else:raise ValueError(('unsupported starting politics effect',action))

for c in countries.values():
    c['explicitLaws']=[]
    c['lawOrigins']={}
    c['amendments']={};c['institutions']={}
    c['laws']={g:k for g,k in defaults.items() if g not in ['lawgroup_caste_hegemony','lawgroup_edo_social_system']}
for scope,v,src in scopes('countries'):
    t=tag(scope)
    if t not in countries:continue
    c=countries[t];c['sources'].append(src)
    for action,b in v:
        if action in political_setup:
            assert b=='yes',(t,action,b)
            apply_politics(c,political_setup[action],action)
        if action=='activate_law':
            set_starting_law(c,b,src)
        if action=='set_religion':c['religion']=tag(b)
        if action=='set_institution_investment_level':
            key=get(b,'institution');level=int(get(b,'level'))
            assert key in institution_meta and level>=0,(t,key,level)
            c['institutions'][key]={'level':level,'source':src}
        # Only unconditional history entries: do not flatten event/DLC branches.
        if action.startswith('active_law:') and isinstance(b,list):
            group=tag(action)
            assert group in c['laws'],(t,group)
            for effect,entry in b:
                if effect!='add_amendment':continue
                key=get(entry,'type');amendment_info(key)
                sponsor=tag(get(entry,'sponsor',''))
                c['amendments'].setdefault(group,[]).append({'id':key,'sponsor':sponsor,'sponsorName':name(sponsor),'cooldown':int(get(entry,'cooldown')) if get(entry,'cooldown') is not None else None,'source':src})
for scope,v,src in scopes('buildings'):
    for owner,entries in v:
        c=country(tag(owner))
        for action,b in entries:
            if action!='create_building':continue
            levels=float(get(b,'level',get(b,'levels',0)))
            for k,ownership in b:
                if k=='add_ownership':
                    levels+=sum(float(get(values,'levels',0)) for _,values in ownership if isinstance(values,list))
            key=get(b,'building');c['buildings'][key]=c['buildings'].get(key,0)+levels
            c['buildingRows'].append({'state':tag(scope),'building':key,'levels':levels,'methods':keys(get(b,'activate_production_methods',[])),'source':src})
for c in countries.values():c['military']={};c['militaryKinds']={};c['formations']=[]
for scope,v,src in scopes('military_formations'):
    t=tag(scope)
    if t not in countries:continue
    c=countries[t];saved={}
    for action,formation in v:
        if action!='create_military_formation':continue
        f={'id':get(formation,'save_scope_as'),'name':name(get(formation,'name','未命名编制')),'kind':get(formation,'type'),'hq':name(tag(get(formation,'hq_region',''))),'units':{},'ships':[],'source':src}
        c['formations'].append(f)
        if f['id']:saved[f['id']]=f
        for action,unit in formation:
            if action not in ['combat_unit','ship']:continue
            key=tag(get(unit,'type'));n=int(get(unit,'count',1))
            f['units'][key]=f['units'].get(key,0)+n
            if action=='ship' and get(unit,'name'):f['ships'].append({'name':name(get(unit,'name')),'type':key})
    for action,unit in v:
        if action!='create_ship':continue
        fleet=tag(get(unit,'fleet',''));key=tag(get(unit,'type'));n=int(get(unit,'count',1))
        if fleet not in saved:raise ValueError(('unresolved fleet',t,fleet))
        f=saved[fleet];f['units'][key]=f['units'].get(key,0)+n
        if get(unit,'name'):f['ships'].append({'name':name(get(unit,'name')),'type':key})
for c in countries.values():
    for f in c['formations']:
        for key,n in f['units'].items():
            c['military'][key]=c['military'].get(key,0)+n;c['militaryKinds'][key]=f['kind']
unit_meta={}
for folder in ['combat_unit_types','ship_types']:
    for key,(v,_) in load(folder).items():unit_meta[key]={'name':name(key),'icon':icon(get(v,'icon')),'profile':icon(get(v,'profile_texture') or next((get(block,'texture') for action,block in reversed(v) if action=='combat_unit_image' and not get(block,'trigger')),None))}
principle_meta={};mod_types=load('modifier_type_definitions')
for group,(v,_) in load('power_bloc_principle_groups').items():
    for level,key in enumerate(keys(get(v,'levels',[])),1):
        principle_meta[key]={'name':name(group),'level':level}
for key,(v,src) in load('power_bloc_principles').items():
    meta=principle_meta.setdefault(key,{'name':name(key),'level':1})
    meta.update({'icon':icon(get(v,'icon')),'background':icon(get(v,'background')),'description':name(key+'_desc'),'effects':[]})
    for scope in ['power_bloc_modifier','participant_modifier','leader_modifier','member_modifier','institution_modifier']:
        for mod,value in get(v,scope,[]):
            props=mod_types.get(mod,([],''))[0]
            meta['effects'].append({'scope':scope,'name':name(mod),'value':value,'percent':get(props,'percent')=='yes','institution':name(get(v,'institution')) if scope=='institution_modifier' else None})
subject_types={'colony','dominion','puppet','protectorate','tributary','vassal','personal_union','chartered_company'}
for scope,v,src in scopes('diplomacy'):
    t=tag(scope)
    if t not in countries:continue
    for action,b in v:
        if action=='create_diplomatic_pact' and get(b,'type') in subject_types:
            child=tag(get(b,'country'));relation={'country':child,'type':get(b,'type')}
            if relation not in countries[t]['subjects']:countries[t]['subjects'].append(relation)
            if child in countries:countries[child]['overlord']={'country':t,'type':get(b,'type')}
blocs=[]
def conditional_principles(entries,source):
    result=[]
    for action,block in entries:
        if action!='if':continue
        additions=[value for effect,body in block if effect=='power_bloc' for key,value in body if key=='add_principle']
        if not additions:continue
        limit=get(block,'limit',[])
        # Preserve the DLC requirement instead of assuming the feature is active.
        assert limit and all(key=='has_dlc_feature' and isinstance(value,str) for key,value in limit),(source,limit)
        features=[value for _,value in limit]
        for key in additions:
            assert key in principle_meta,(source,key)
            result.append({'id':key,'requiredFeatures':features,'condition':'需启用国家集团扩展功能（DLC）' if features==['power_bloc_features'] else '所需 DLC 功能：'+', '.join(features),'source':source})
    return result

for scope,v,src in scopes('power_blocs'):
    t=tag(scope)
    for action,b in v:
        if action!='create_power_bloc':continue
        members=[t]+[tag(val) for k,val in b if k=='member'];seen=set()
        def subjects(parent):
            if parent in seen:return
            seen.add(parent)
            for rel in countries.get(parent,{}).get('subjects',[]):
                if rel['country'] not in members:members.append(rel['country'])
                subjects(rel['country'])
        subjects(t)
        bloc={'name':name(get(b,'name')),'leader':t,'members':members,'identity':name(get(b,'identity')),'principles':[val for k,val in b if k=='principle'],'conditionalPrinciples':conditional_principles(v,src),'source':src}
        blocs.append(bloc)
        for m in members:
            if m in countries:countries[m]['blocs'].append(len(blocs)-1)
# Static starting profile; runtime economy and prestige ranks are not guessed.
definitions={k:v for p in files('common/country_definitions') for k,v in read(p) if isinstance(v,list)}
for t,c in countries.items():
    definition=definitions.get(t,[])
    primary=keys(get(definition,'cultures',[]))
    religion=c.get('religion') or get(definition,'religion')
    religion_source='国家定义'
    if not religion and primary:
        religion=get(culture_defs.get(primary[0],([],''))[0],'religion');religion_source='主体文化默认信仰'
    description=name(t+'_FLAVOR_TEXT')
    if description==t+'_FLAVOR_TEXT':description=''
    c['profile']={'primaryCultures':primary,'religion':religion,'religionSource':religion_source,
      'capital':get(definition,'capital'),'recognition':name(get(definition,'country_type','未知')),
      'tier':name(get(definition,'tier','')),'description':description,
      'government':name('gov_shogunate') if 'japanese' in primary and c['laws'].get('lawgroup_distribution_of_power')=='law_bakufu' else None}
# Reuse the resource atlas boundary simplifier; trace actual province ownership.
module=ast.parse((HERE/'build_map.py').read_text(encoding='utf-8'))
for node in module.body:
    if isinstance(node,ast.FunctionDef) and node.name in ['simplify','outline']:exec(compile(ast.Module(body=[node],type_ignores=[]),'build_map.py','exec'))
rgb=np.array(Image.open(ROOT/'game/map_data/provinces.png').convert('RGB'),dtype=np.uint32);codes=(rgb[:,:,0]<<16)|(rgb[:,:,1]<<8)|rgb[:,:,2];del rgb
lut=np.zeros(16777216,dtype=np.uint16);tags=sorted(countries)
for code,t in provinces.items():lut[code]=tags.index(t)+1
labels=lut[codes];del codes,lut
ys,xs=np.nonzero(labels);vals=labels[ys,xs];n=len(tags)+1;h,w=labels.shape
minx=np.full(n,w);miny=np.full(n,h);maxx=np.zeros(n,dtype=int);maxy=np.zeros(n,dtype=int)
np.minimum.at(minx,vals,xs);np.minimum.at(miny,vals,ys);np.maximum.at(maxx,vals,xs);np.maximum.at(maxy,vals,ys)
del ys,xs,vals
for i,t in enumerate(tags,1):
    if minx[i]==w:continue
    x,y=int(minx[i]),int(miny[i]);right,bottom=int(maxx[i])+1,int(maxy[i])+1
    countries[t]['bounds']=[x,y,right-x,bottom-y];countries[t]['path']=outline(labels[y:bottom,x:right]==i,x,y)
print('Traced',len(countries),'countries',flush=True)
labels_out={k:name(k) for c in countries.values() for field in ['cultures','religions','buildings','laws','military'] for k in c[field]}
labels_out.update({law:name(law) for c in countries.values() for law in c['laws'].values()})
labels_out.update({k:name(k) for k in subject_types});labels_out.update(lawgroups)
religion_meta={k:{'name':name(k),'icon':icon(get(v,'icon')),'heritage':name(get(v,'heritage')),'description':name(k+'_desc') if name(k+'_desc')!=k+'_desc' else ''} for k,(v,_) in load('religions').items()}
output={'unitMeta':unit_meta,'principleMeta':principle_meta,'lawMeta':law_meta,'groupMeta':group_meta,'institutionMeta':institution_meta,'amendmentMeta':amendment_meta,'religionMeta':religion_meta,'countries':countries,'blocs':blocs,'labels':labels_out,'lawGroups':lawgroups,'source':'1836 · 原版开局定义；分割州资源按省份数量占比估算；宗教缺省取文化默认信仰；法律含国家历史、开局政治模板（国教／国家类型分支）与定义顺序默认补全（默认项标注来源）；修正案与机构等级取国家历史中的无条件显式设置，机构缺省不推定为 0 级；建筑为 create_building 定义等级，不含运行时自动生成。'}
(HERE/'geopolitics-data.js').write_text('window.V3_GEO='+json.dumps(output,ensure_ascii=False,separators=(',',':'))+';',encoding='utf-8')
assert sum(c['population'] for c in countries.values())==sum(s['population'] for s in world['states'])
print('Saved country atlas; population',sum(c['population'] for c in countries.values()),'building records',sum(len(c['buildingRows']) for c in countries.values()))


