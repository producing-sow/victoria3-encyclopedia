"""Build offline English data and a UI dictionary; game terms use official English localization."""
import ast,concurrent.futures,json,pathlib,re,time,urllib.parse,urllib.request,sys
HERE=pathlib.Path(__file__).resolve().parent
ROOT=pathlib.Path(sys.argv[1] if len(sys.argv)>1 and not sys.argv[1].startswith('--') else r'F:\Program Files (x86)\Steam\steamapps\common\Victoria 3')
OUT=HERE/'en';OUT.mkdir(exist_ok=True)
HAN=re.compile(r'[\u3400-\u9fff]')
cache_path=HERE/'i18n-ui.json'
cache=json.loads(cache_path.read_text('utf-8')) if cache_path.exists() else {}
curated={'建筑与生产':'Buildings & Production','全州资源地图':'World Resource Atlas','公司百科':'Companies','文化人群百科':'Cultures','地缘政治':'Geopolitics','法律百科':'Laws','人物百科':'Characters','军队百科':'Military','产业百科':'Victoria 3 Encyclopedia','版本档案':'Version Archive','游戏版本对比':'Game Version Comparison','宗教档案':'Religions','全部国家':'All countries','全部意识形态':'All ideologies','全部角色':'All roles','名称搜索':'Search names','意识形态':'Ideology','登场记录':'Appearance','身份角色':'Role','记录范围':'Records','排序':'Sort','名称':'Name','出生时间':'Date of birth','开局人物优先':'Starting characters first','重置筛选':'Reset filters','按国家查看':'Browse by country','选择国家':'Country','全图':'World','聚焦所选':'Focus selected','开局创建':'Created at start','开局条件创建':'Conditional starting character','全部登场记录':'All appearances','后续 / 历史模板':'Later / historical templates','历史及具名人物':'Historical & named characters','特殊 / 测试模板':'Special / test templates','所有具名记录':'All named records','上一页':'Previous','下一页':'Next','导出筛选结果 CSV ↗':'Export filtered CSV ↗','游戏素材背景':'Background','工业时代':'Industrial era','原版纸张':'Original paper','原版世界地图':'Original world map','素色':'Plain','未指定':'Not specified','未记载':'Not recorded','无记录':'No records','动态游戏文本':'Dynamic game text','游戏概念':'Game concept','基础价格':'Base price','生产方式':'Production method','生产方式组':'Production method group','净产值':'Net output value','总投入':'Total inputs','总产出':'Total outputs','满员':'Fully employed','建筑等级':'Building levels','级':'levels','人':'people','营':'battalions','艘':'ships','无':'None','是':'Yes','否':'No','未确定归属':'Unassigned','查看国家档案 ↗':'View country profile ↗','名':'names','未受认可国家':'Unrecognized country','显示':'Show','隐藏':'Hide','默认':'Default','默认补全':'Default inferred','历史设置':'History definition','法律组':'Law group','权力结构':'Power structure','经济':'Economy','人权':'Human rights','附庸':'Subjects','宗主':'Overlord','宗教':'Religion','文化':'Culture','开局':'Starting','中国':'China','日本':'Japan','大不列颠':'Great Britain','与':'and','或':'or','百科导航':'Encyclopedia navigation','未知':'Unknown','全部':'All','未启用':'Inactive','来源':'Source','数据来源':'Data sources','开局档案':'Starting profile','原版':'Base game','历史人物':'Historical character','高级筛选':'Advanced filters','清除筛选':'Clear filters','全部资源':'All resources','全部兵种':'All unit types','统计口径与来源':'Scope & sources','动态 / 未指定':'Dynamic / unspecified','政治力量':'Political strength','吞吐量':'Throughput','家乡':'Home region','出生':'Born','角色与身份':'Roles','男性 / 默认':'Male / default','女性':'Female','人物简介':'Biography','国家关联':'Country associations','人物特质':'Character traits','数据口径与来源':'Data scope & sources','每级':'per level','每周':'per week','总人口':'Total population','万':'×10,000','亿':'×100,000,000','完整州':'State region','未发现':'Undiscovered','已知':'Known','资源容量':'Resource capacity','耕地':'Arable land','资源':'Resources','建筑':'Buildings','开局人口':'Starting population','利润':'Profit','法律':'Laws','每人':'per person','年':'year','月':'month','日':'day','个':'','条':'','种':'types','支':'formations','岁':'years old','所':'','当前':'Current','选择':'Select','记录':'Records','名称搜索':'Search names','详情':'Details','性别':'Gender','修正案':'Amendments','机构':'Institutions'}
curated.update({'治理原则':'Governance principle','主体文化':'Primary cultures','首都州':'Capital state','国家简介':'Country introduction','其他建筑':'Other buildings','包括直属及间接附属国':'Include direct and indirect subjects','仅本国直属领土':'Directly owned territory only','本国':'This country','全球':'Worldwide','开局等级':'Starting levels','等级世界占比':'Global share of levels','容量世界占比':'Global share of capacity','未发现世界占比':'Global share of undiscovered potential','开局军队与舰队':'Starting armies & fleets','兵种':'Unit type','舰种':'Ship type','世界占比':'Global share','陆军编制':'Army formations','海军编制':'Naval formations','海军舰队':'Naval fleets','下辖兵种':'Unit composition','营数':'Battalions','艘数':'Ships','军队':'Armed forces','舰队':'Fleets','国':'country','原理':'Principle','国家':'Country','简介':'Introduction','座':'','景观占位':'Scenery placeholder','应用到':'Apply to ','国家主体文化':'Primary culture','待接纳人群':'Target population','国教':'State religion','本国开局军队 · 不含附属国':'Starting forces · excludes subjects','国家完整档案 ↗':'Full country profile ↗','陆军总数':'Total battalions','海军总数':'Total ships','占全球陆军':'Share of global battalions','占全球海军':'Share of global ships','按数量占比':'Share by count','悬停或点击查看数量；点击兵种查看图鉴':'Hover or click for counts; select a unit to open its entry.','全世界':'Worldwide','总数':'Total'})
cache={k:v for k,v in cache.items() if not HAN.search(v)}
curated.update({'州':'State','可查阅':'available to inspect','项':'items','必需':'required','须具备':' requires ','供应':'supply','须':' requires ','不能同时启用':'Cannot be enabled together','不能同时':'Cannot combine ','（景观占位）':' (scenery placeholder)','01　建筑与生产':'01　Buildings & Production','02　全州资源地图':'02　World Resource Atlas','03　公司百科':'03　Companies','04　文化人群百科':'04　Cultures','05　地缘政治':'05　Geopolitics','06　法律百科':'06　Laws','07　人物百科':'07　Characters','08　军队百科':'08　Military','中文名、英文名或模板标识…':'Chinese or English name, or template ID…','原版纸质地图与省份边界':'Original paper map & province borders','1836 开局 · 完整州口径':'1836 start · state-region totals','统治者':'Ruler','继承人':'Heir','鼓动者':'Agitator','陆军将领':'General','海军将领':'Admiral'})
cache.update(curated)
# Reuse the exact text resolver used by extractors without executing its data-writing code.
module=ast.parse((HERE/'build_data.py').read_text('utf-8-sig'))
functions=[n for n in module.body if isinstance(n,ast.FunctionDef) and n.name=='name']
fallbacks=json.loads((HERE/'localization-fallbacks.json').read_text('utf-8'))
def loadloc(language):
 result={}
 for p in sorted((ROOT/'game/localization'/language).rglob('*.yml')):
  for line in p.read_text('utf-8-sig').splitlines():
   m=re.match(r'\s*([\w.\-]+):\d*\s*"(.*)"',line)
   if m:result[m[1]]=m[2]
 return result
zh=loadloc('simp_chinese');en=loadloc('english')
resolvers=[]
for loc,fb in [(zh,fallbacks),(en,{})]:
 ns={'re':re,'loc':loc,'localization_fallbacks':fb,'defines':{},'unresolved_localization':set()}
 exec(compile(ast.Module(body=functions,type_ignores=[]),'build_data.py','exec'),ns)
 resolvers.append(ns['name'])
cn_name,en_name=resolvers
pairs={};english_keys={}
for key in zh.keys()|en.keys()|fallbacks.keys():
 try:a=cn_name(key);b=en_name(key)
 except (TypeError,ValueError,RecursionError):continue
 b=b.replace('（景观占位）',' (scenery placeholder)')
 if key in en and b!=key:english_keys[key]=b
 if HAN.search(str(a)) and not HAN.search(str(b)) and b!=key:pairs.setdefault(a,b)
print('Official bilingual strings:',len(pairs),flush=True)
DATA=['data.js','map-data.js','companies-data.js','cultures-data.js','geopolitics-data.js','laws-data.js','characters-data.js','military-data.js','history-data.js']
raw={};residual=set(json.loads((HERE/'i18n-pending.json').read_text('utf-8')))
# Translate composite names from official first/last names; other editorial strings go to the UI cache.
def translate(value):
 if not isinstance(value,str) or not HAN.search(value):return value
 if value in pairs:return pairs[value]
 if '（景观占位）' in value:return translate(value.replace('（景观占位）',''))+' (scenery placeholder)'
 if value in cache:return cache[value]
 residual.add(value);return value

def convert(value,context=None):
 if isinstance(value,list):return [convert(v) for v in value]
 if not isinstance(value,dict):return value if context in ['kind','searchNames','key'] else translate(value)
 out={k:convert(v,k) for k,v in value.items()}
 identity=value.get('id') or context
 if 'name' in value and identity in english_keys:out['name']=english_keys[identity]
 if 'firstName' in value and 'lastName' in value:
  definition=value.get('definition',[]);props={k:v for k,v in definition if isinstance(v,str)} if isinstance(definition,list) else {}
  for field,key in [('firstName','first_name'),('lastName','last_name')]:
   original=props.get(key,'')
   if original and original not in ['culture','random'] and not HAN.search(original):out[field]=english_keys.get(original,original.replace('_',' '))
  out['name']=' '.join(str(out.get(k,'')) for k in ['firstName','lastName']).strip() or out.get('name','')
 return out
for file in DATA:
 p=HERE/file
 if not p.exists():continue
 text=p.read_text('utf-8-sig');prefix=text.split('=',1)[0]+'='
 try:obj=json.loads(text.split('=',1)[1].rstrip().rstrip(';'))
 except json.JSONDecodeError:continue
 raw[file]=(prefix,obj);convert(obj)
pending=[v for v in residual if v not in cache and v not in pairs and HAN.search(v)]
print('Editorial strings needing translation:',len(pending),flush=True)
# This option is only used while authoring translations. Normal rebuilds and the website are offline.
def batch_translate(batch):
 text='\n'.join('ZXQ'+str(i).zfill(6)+'ZXQ '+value for i,value in batch)
 query=urllib.parse.urlencode({'client':'gtx','sl':'zh-CN','tl':'en','dt':'t','q':text})
 for attempt in range(4):
  try:
   request=urllib.request.Request('https://translate.googleapis.com/translate_a/single?'+query,headers={'User-Agent':'Mozilla/5.0'})
   with urllib.request.urlopen(request,timeout=30) as response:data=json.load(response)
   translated=''.join(row[0] or '' for row in data[0])
   chunks=re.split(r'ZXQ\s*(\d{6})\s*ZXQ\s*',translated)
   found={int(chunks[i]):chunks[i+1].strip() for i in range(1,len(chunks)-1,2)}
   if len(found)!=len(batch):raise ValueError('Translation markers missing')
   return {value:found[i] for i,value in batch}
  except Exception:
   if attempt==3:raise
   time.sleep(1+attempt)
if '--translate' in sys.argv and pending:
 batches=[];batch=[];size=0
 for i,value in enumerate(sorted(pending)):
  if len(value)>4500:continue
  if batch and size+len(value)>2200:batches.append(batch);batch=[];size=0
  batch.append((i,value));size+=len(value)+20
 if batch:batches.append(batch)
 errors=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  futures={pool.submit(batch_translate,b):n for n,b in enumerate(batches)}
  for done,future in enumerate(concurrent.futures.as_completed(futures),1):
   try:cache.update(future.result())
   except Exception as exc:errors.append(str(exc))
   cache_path.write_text(json.dumps(cache,ensure_ascii=False,indent=2),encoding='utf-8')
   if done%10==0:print('Translated batches',done,'/',len(batches),flush=True)
 if errors:print('Translation errors:',errors,flush=True)
cache.update(curated)
# UI strings have their own meaning; game data uses the official dictionary first.
cache_path.write_text(json.dumps(cache,ensure_ascii=False,indent=2),encoding='utf-8')
missing=set()
for file,(prefix,obj) in raw.items():
 converted=convert(obj)
 def inspect(v):
  if isinstance(v,dict):
   for k,x in v.items():
    if k not in ['searchNames','kind','key']:inspect(x)
  elif isinstance(v,list):
   for x in v:inspect(x)
  elif isinstance(v,str) and HAN.search(v):missing.add(v)
 inspect(converted)
 (OUT/file).write_text(prefix+json.dumps(converted,ensure_ascii=False,separators=(',',':'))+';',encoding='utf-8')
# Only ship terminology actually required by visible UI literals, rather than the entire game localization.
ui={**pairs,**cache}
needed=dict(pairs)
for key in json.loads((HERE/'i18n-pending.json').read_text('utf-8')):
 if key in ui:needed[key]=ui[key]
needed.update(cache)
(HERE/'i18n-dictionary.js').write_text('window.V3_UI_EN='+json.dumps(needed,ensure_ascii=False,separators=(',',':'))+';',encoding='utf-8')
(HERE/'i18n-report.json').write_text(json.dumps({'officialPairs':len(pairs),'uiEntries':len(needed),'untranslatedData':sorted(missing),'language':'en'},ensure_ascii=False,indent=2),encoding='utf-8')
print('Built English modules:',len(raw),'UI entries:',len(needed),'untranslated data strings:',len(missing),flush=True)
