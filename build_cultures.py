"""Extract version-specific culture traits and legal acceptance coefficients."""
import json,re
from build_data import ROOT,HERE,parse,get,ids,name,icon,defines
def read_folder(folder):
    output={}
    for file in sorted((ROOT/'game/common'/folder).glob('*.txt')):
        text=re.sub(r'\b(?:rgb|hsv360|hsv)\s*(?=\{)','',file.read_text(encoding='utf-8-sig'))
        for key,value in parse(text):
            if isinstance(value,list):output[key]=(value,file.relative_to(ROOT).as_posix())
    return output
def keys(obj):return [k.strip('"') for k,v in obj or []]
traits={k:{'id':k,'name':name(k),'type':get(v,'type'),'group':get(v,'trait_group',''),'groupName':name(get(v,'trait_group',''))} for k,(v,s) in read_folder('discrimination_traits').items()}
groups={k:name(k) for k in read_folder('discrimination_trait_groups')}
religions={k:{'id':k,'name':name(k),'heritage':get(v,'heritage'),'icon':icon(get(v,'icon')),'source':s} for k,(v,s) in read_folder('religions').items()}
cultures={}
for k,(v,s) in read_folder('cultures').items():
    if not get(v,'heritage') or not get(v,'language'):continue
    cultures[k]={'id':k,'name':name(k),'heritage':get(v,'heritage'),'language':get(v,'language'),'traditions':keys(get(v,'traditions',[])),'religion':get(v,'religion'),'obsessions':keys(get(v,'obsessions',[])),'source':s}
    assert cultures[k]['heritage'] in traits and cultures[k]['language'] in traits,k
laws={}
for k,(v,s) in read_folder('laws').items():
    group=get(v,'group')
    if group not in ['lawgroup_citizenship','lawgroup_church_and_state']:continue
    mods={a:float(b) for a,b in get(v,'modifier',[]) if a.startswith('country_acceptance_')}
    if not mods:continue
    laws[k]={'id':k,'name':name(k),'description':name(k+'_desc') if name(k+'_desc')!=k+'_desc' else '', 'group':group,'icon':icon(get(v,'icon')),'coefficients':mods,'effects':[(a,b) for a,b in get(v,'modifier',[]) if not isinstance(b,list) and not a.startswith('country_acceptance_')],'rights':get(v,'acceptance_modifier',[]),'source':s}
statuses=[]
for k,(v,s) in read_folder('acceptance_statuses').items():
    statuses.append({'id':k,'name':name(k),'threshold':float(get(v,'threshold')),'icon':icon(get(v,'large_icon')),'source':s})
statuses.sort(key=lambda s:s['threshold'])
world=json.loads((HERE/'map-data.js').read_text(encoding='utf-8')[14:-1])
english={}
for p in sorted((ROOT/'game/localization/english').rglob('*.yml')):
    for line in p.read_text(encoding='utf-8-sig').splitlines():
        match=re.match(r'\s*([\w.\-]+):\d*\s*"(.*)"',line)
        if match:english[match[1]]=match[2]
def english_name(key):
    value=english.get(key,key)
    for _ in range(6):value=re.sub(r'\$([\w.]+)(?:\|[^$]*)?\$',lambda m:english.get(m[1],m[1]),value)
    return value
continent_files={'00_west_europe':'europe','01_south_europe':'europe','02_east_europe':'europe','15_russia':'europe','03_north_africa':'africa','04_subsaharan_africa':'africa','05_north_america':'north_america','06_central_america':'north_america','07_south_america':'south_america','08_middle_east':'asia','09_central_asia':'asia','10_india':'asia','11_east_asia':'asia','12_indonesia':'asia','13_australasia':'oceania','14_siberia':'asia'}
assert all(c in cultures for s in world['states'] for c in s['cultures'])
for c in cultures.values():
    c['population']=sum(s['cultures'].get(c['id'],0) for s in world['states'])
    c['stateCount']=sum(s['cultures'].get(c['id'],0)>0 for s in world['states'])
    c['englishName']=english_name(c['id'])
    c['continentPopulation']={}
    for s in world['states']:
        pop=s['cultures'].get(c['id'],0)
        if pop:
            continent=continent_files.get(s['source'].split('/')[-1].replace('.txt',''),'unknown')
            c['continentPopulation'][continent]=c['continentPopulation'].get(continent,0)+pop
    c['mainContinent']=max(c['continentPopulation'],key=c['continentPopulation'].get) if c['continentPopulation'] else 'unrecorded'
data={'cultures':cultures,'traits':traits,'groups':groups,'religions':religions,'laws':laws,'statuses':statuses,'labels':{k:name(k) for law in laws.values() for k in list(law['coefficients'])+[a for a,b in law['rights']]+[a for a,b in law['effects']]},'goods':{k:name(k) for c in cultures.values() for k in c['obsessions']},'minimum':float(defines['MIN_ACCEPTANCE_VALUE']),'maximum':float(defines['MAX_ACCEPTANCE_VALUE'])}
data['englishReligions']={k:english_name(k) for k in religions}
(HERE/'cultures-data.js').write_text('window.V3_CULTURES='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';',encoding='utf-8')
print('Cultures',len(cultures),'religions',len(religions),'laws',len(laws),'statuses',len(statuses),'population',sum(c['population'] for c in cultures.values()))
