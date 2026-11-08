"""Audit display labels; technical IDs and immutable historical raw data are excluded."""
import json,re,pathlib
issues=[]
fields={'name','description','groupName','government','recognition','sponsorName'}
maps=('.labels','.modifierLabels','.goods','.resources','.farms','.groups','.jobs')
pattern=re.compile(r'is a dummy|should never|动态游戏文本|\[.*(?:Get|concept_)|^[a-z][a-z0-9]*_[a-z0-9_]+$')
def walk(value,path):
    if isinstance(value,dict):
        for key,item in value.items():
            if isinstance(item,str) and (key in fields or path.endswith(maps)) and pattern.search(item):issues.append((path+'.'+key,item))
            walk(item,path+'.'+key)
    elif isinstance(value,list):
        for i,item in enumerate(value):walk(item,f'{path}[{i}]')
for filename in ['data.js','map-data.js','companies-data.js','cultures-data.js','geopolitics-data.js']:
    file=pathlib.Path(filename)
    text=file.read_text('utf-8-sig');walk(json.loads(text.split('=',1)[1].rstrip(';')),file.name)
assert not issues,issues
d=json.loads(pathlib.Path('data.js').read_text('utf-8').split('=',1)[1].rstrip(';'))
assert sum('景观占位' in b['name'] for b in d['buildings'])==14
assert all(not re.search(r'unlocking_|disallowing_|principle_',c) for p in d['methods'].values() for c in p['conditions'])
assert all(d['modifierLabels'].get(x[1])!=x[1] for p in d['methods'].values() for x in p['other'])
print('PASS: current display labels across all datasets; 14 monument names; all PM conditions and 197 extra effect labels. Technical IDs and historical raw snapshots retained.')
