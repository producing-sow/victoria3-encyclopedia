"""Offline law encyclopedia, retaining conditions and original effect scopes."""
import json,re
from build_data import ROOT,HERE,name,icon,load,get,defines

def parse_script(text):
    tokens=[t for t in re.findall(r'"(?:\\.|[^"\\])*"|#[^\n]*|>=|<=|!=|\?=|[{}=<>]|[^\s{}=<>!?#]+',text.lstrip('\ufeff')) if not t.startswith('#')]
    i=0
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

def field(entries,key,default=None):return next((v for k,_,v in entries if k==key),default)
def keys(entries):return [k for k,_,v in entries or []]
def folder(path):
    return {k:(v,p.relative_to(ROOT).as_posix()) for p in sorted((ROOT/'game/common'/path).glob('*.txt')) for k,_,v in parse_script(p.read_text('utf-8-sig')) if isinstance(v,list)}

labels={};modifiers=load('modifier_type_definitions')
def collect(entries):
    for k,_,v in entries:
        labels[k]=name(k.split(':')[-1])
        if isinstance(v,list):collect(v)
        elif v is not None:labels[v]=name(v.split(':')[-1])

def effects(entries):
    out={}
    for scope,_,values in entries:
        if scope not in ['modifier','institution_modifier','acceptance_modifier','sponsor_modifier'] and not scope.startswith('tax_modifier_'):continue
        if not isinstance(values,list):continue
        rows=[]
        for k,op,v in values:
            props=modifiers.get(k,([],''))[0]
            rows.append({'id':k,'name':name(k),'value':v,'percent':get(props,'percent')=='yes','color':get(props,'color','neutral'),'boolean':v in ['yes','no'] if isinstance(v,str) else False})
        out[scope]=rows
    return out

def description(key):
    text=name(key+'_desc')
    return '' if text==key+'_desc' else text

groups={}
for key,(v,src) in folder('law_groups').items():
    collect(v)
    groups[key]={'id':key,'name':name(key),'category':field(v,'law_group_category'),'special':bool(field(v,'linked_social_hierarchy')),'hierarchy':name(field(v,'linked_social_hierarchy','')),'conditions':{k:field(v,k) for k in ['enable','change_allowed_trigger'] if field(v,k)},'source':src}

laws={}
for key,(v,src) in folder('laws').items():
    collect(v);group=field(v,'group');parent=field(v,'parent')
    laws[key]={'id':key,'name':name(key),'description':description(key),'group':group,'icon':icon(field(v,'icon')),'parent':parent,'special':bool(parent or groups[group]['special']),
      'institution':field(v,'institution'),'effects':effects(v),'technologies':keys(field(v,'unlocking_technologies',[])),
      'conditions':{k:field(v,k) for k in ['is_visible','can_enact','unlocking_laws','disallowing_laws','requires_law_or'] if field(v,k)},
      'events':{k:field(v,k) for k in ['on_enact','on_activate','on_deactivate'] if field(v,k)},'definition':v,'source':src}

institutions={}
for key,(v,src) in folder('institutions').items():
    collect(v);institutions[key]={'id':key,'name':name(key),'icon':icon(field(v,'icon')),'effects':effects(v),'source':src}
amendments={}
for key,(v,src) in folder('amendments').items():
    collect(v);parent=field(v,'parent');allowed=keys(field(v,'allowed_laws',[]))
    assert all(k in laws for k in allowed),(key,allowed)
    amendments[key]={'id':key,'name':name(key),'description':description(key),'icon':laws.get(parent,{}).get('icon',''),'parent':parent,'allowedLaws':allowed,'generic':field(v,'allowed_laws') is None,'institution':field(v,'institution'),'effects':effects(v),
      'conditions':{k:field(v,k) for k in ['possible','can_repeal','would_sponsor'] if field(v,k)},'events':{k:field(v,k) for k in ['on_activate','on_deactivate'] if field(v,k)},'definition':v,'source':src}
output={'laws':laws,'groups':groups,'amendments':amendments,'institutions':institutions,'labels':labels,'source':'本机原版定义；效果按原始作用域展示，条件与脚本效果不作为无条件数值叠加。采用统计含国家历史和确定的开局政治模板设置，未设置项可单独选择是否纳入默认推定。机构等级仅作预览，实际等级上限还受科技、法律与其他修正影响。'}
(HERE/'laws-data.js').write_text('window.V3_LAWS='+json.dumps(output,ensure_ascii=False,separators=(',',':'))+';','utf-8')
print('Law encyclopedia:',len(laws),'laws,',len(groups),'groups,',len(amendments),'amendments,',len(institutions),'institutions')
