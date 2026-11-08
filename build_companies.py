"""Company encyclopedia with lossless operators and nested prerequisite logic."""
import json,re,pathlib
from PIL import Image
from build_data import ROOT,HERE,name,icon,load,unresolved_localization

def parse_company(text):
    ts=[t for t in re.findall(r'"(?:\\.|[^"\\])*"|#[^\n]*|>=|<=|!=|\?=|[{}=<>]|[^\s{}=<>!?#]+',text.lstrip('\ufeff')) if not t.startswith('#')];i=0
    def block():
        nonlocal i
        entries=[]
        while i<len(ts):
            k=ts[i];i+=1
            if k=='}':return entries
            op='';v=None
            if i<len(ts) and ts[i] in ['=','>=','<=','>','<','!=','?=']:
                op=ts[i];i+=1;v=ts[i];i+=1
                v=block() if v=='{' else v.strip('"')
            entries.append([k.strip('"'),op,v])
        return entries
    return block()
def get(o,k,default=None):return next((v for key,op,v in o if key==k),default)
def ids(o):return [k for k,op,v in (o or [])]
def artwork(src):
    if not src:return ''
    dest=HERE/'assets'/('company-bg-'+pathlib.Path(src).stem+'.jpg')
    if not dest.exists():
        with Image.open(ROOT/'game'/src) as im:
            im=im.convert('RGB');im.thumbnail((1400,800));im.save(dest,quality=88)
    return dest.relative_to(HERE).as_posix()
companies=[];labels={}
def collect(entries):
    for k,op,v in entries:
        labels[k]=name(k)
        if isinstance(v,list):collect(v)
        elif v is not None:
            labels[v]=name(v.split(':',1)[-1])
for file in sorted((ROOT/'game/common/company_types').glob('*.txt')):
    for k,op,v in parse_company(file.read_text(encoding='utf-8-sig')):
        if not k.startswith('company_') or not isinstance(v,list):continue
        collect(v)
        companies.append({'id':k,'name':name(k),'description':name(k+'_desc') if name(k+'_desc')!=k+'_desc' else '',
          'icon':icon(get(v,'icon')),'background':artwork(get(v,'background')),
          'historical':get(v,'flavored_company')=='yes','dynamic':get(v,'uses_dynamic_naming')=='yes',
          'category':get(v,'category','default'),'region':file.stem.replace('00_companies_','').replace('99_basic_companies','basic'),
          'buildings':ids(get(v,'building_types',[])),'extensions':ids(get(v,'extension_building_types',[])),
          'headquarters':ids(get(v,'preferred_headquarters',[])),'prestige':ids(get(v,'possible_prestige_goods',[])),
          'prosperity':get(v,'prosperity_modifier',[]),
          'conditions':{key:get(v,key,[]) for key in ['potential','attainable','possible','can_establish_in','prestige_goods_trigger']},
          'definition':v,'source':file.relative_to(ROOT).as_posix()})
for c in companies:
    for k in c['buildings']+c['extensions']+c['headquarters']+c['prestige']:labels[k]=name(k)
assert len({c['id'] for c in companies})==len(companies)
prestige_goods={k:{'name':name(k),'icon':icon(next((v for key,v in values if key=='texture'),None))} for k,(values,source) in load('prestige_goods').items()}
(HERE/'companies-data.js').write_text('window.V3_COMPANIES='+json.dumps({'companies':companies,'labels':labels,'prestigeGoods':prestige_goods},ensure_ascii=False,separators=(',',':'))+';',encoding='utf-8')
for src,dest in [('gfx/loadingscreens/victoria3_load_1.dds','industry-background.jpg'),('gfx/interface/backgrounds/paper_texture.dds','paper-background.jpg')]:
    with Image.open(ROOT/'game'/src) as im:
        im=im.convert('RGB');im.thumbnail((1920,1080));im.save(HERE/'assets'/dest,quality=87)
print('Companies:',len(companies),'historical:',sum(c['historical'] for c in companies),'icons:',sum(bool(c['icon']) for c in companies))
print('Unresolved localization expressions:',sorted(unresolved_localization))
