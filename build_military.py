"""Extract unit attributes and mobilization costs/effects from the installed game."""
import json,re
from build_data import ROOT,HERE,parse,get,name,icon,load

def definitions(folder):
    return {key:(value,p.relative_to(ROOT).as_posix())
            for p in sorted((ROOT/'game/common'/folder).glob('*.txt'))
            for key,value in parse(p.read_text('utf-8-sig').replace('?=','=')) if isinstance(value,list)}

def ids(values):return [key for key,_ in values or []]
def refs(values):return [{'id':key,'name':name(key)} for key in ids(values)]
modifiers=load('modifier_type_definitions')

def effects(values):
    result=[]
    for key,value in values or []:
        props=modifiers.get(key,([],''))[0]
        result.append({'id':key,'name':name(key),'value':float(value),'percent':get(props,'percent')=='yes','color':get(props,'color','neutral')})
    return result

def costs(values,scope):
    result=[]
    for key,value in values or []:
        match=re.fullmatch(r'goods_input_(.+)_(add|mult)',key)
        if not match:raise ValueError(('Unhandled goods modifier',key,value))
        result.append({'good':match[1],'name':name(match[1]),'mode':match[2],'value':float(value),'scope':scope})
    return result

units={}
for folder,kind in [('combat_unit_types','army'),('ship_types','fleet')]:
    for key,(v,source) in definitions(folder).items():
        group=get(v,'group' if kind=='army' else 'ship_group')
        units[key]={'id':key,'name':name(key),'kind':kind,'group':group,'groupName':name(group),'source':source,
            'attributes':effects(get(v,'battle_modifier' if kind=='army' else 'modifier',[])),
            'upkeep':costs(get(v,'upkeep_modifier' if kind=='army' else 'materiel_goods',[]),'base'),
            'construction':costs(get(v,'construction_goods',[]),'construction'),
            'technologies':refs(get(v,'unlocking_technologies',[])),
            'maxManpower':float(get(v,'max_manpower')) if get(v,'max_manpower') is not None else None,
            'supplyCapacity':float(get(v,'supply_capacity')) if get(v,'supply_capacity') is not None else None}

def requirements(values):
    required,excluded,market=[],[],[]
    def walk(entries,negative=False):
        for key,value in entries or []:
            if key=='has_mobilization_option':
                (excluded if negative else required).append(value.split(':')[-1])
            elif key.startswith('mg:'):
                if get(value,'has_potential_supply')=='yes':market.append(key.split(':')[-1])
            elif isinstance(value,list):walk(value,not negative if key in ['NOT','NOR'] else negative)
    walk(values)
    return {'requires':list(dict.fromkeys(required)),'excludes':list(dict.fromkeys(excluded)),'market':list(dict.fromkeys(market))}

def transitions(values):
    result=[]
    def walk(entries):
        for key,value in entries or []:
            if key in ['add_morale','add_organization']:
                assert get(value,'value') in ['morale','organization']
                result.append({'stat':'morale' if key=='add_morale' else 'organization','value':float(get(value,'multiply'))})
            elif isinstance(value,list):walk(value)
    walk(values)
    return result

groups={key:{'id':key,'name':name(key)} for key in definitions('mobilization_option_groups')}
options={}
for key,(v,source) in definitions('mobilization_options').items():
    options[key]={'id':key,'name':name(key),'icon':icon(get(v,'texture')),'group':get(v,'group'),'source':source,
        'kind':get(v,'military_formation_type','army'),'costs':costs(get(v,'upkeep_modifier',[]),'scaled')+costs(get(v,'upkeep_modifier_unscaled',[]),'unscaled'),
        'effects':effects(get(v,'unit_modifier',[])),'technologies':refs(get(v,'unlocking_technologies',[])),
        'laws':refs(get(v,'unlocking_laws',[])),'principles':refs(get(v,'unlocking_principles',[])),
        'conditions':requirements(get(v,'possible',[])),
        'mandatory':any(k=='always' and value=='no' for _,block in get(v,'can_be_turned_off',[]) if isinstance(block,list) for k,value in block),
        'transitions':{action:transitions(get(v,action,[])) for action in ['on_activate','on_deactivate','on_activate_while_mobilized','on_deactivate_while_mobilized']}}
    assert options[key]['group'] in groups
for option in options.values():
    for key in option['conditions']['requires']+option['conditions']['excludes']:assert key in options

data={'version':json.loads((ROOT/'launcher/launcher-settings.json').read_text('utf-8-sig'))['version'],
      'units':units,'options':options,'groups':groups,
      'source':'game/common/{combat_unit_types,ship_types,mobilization_options,mobilization_option_groups,modifier_type_definitions}'}
(HERE/'military-data.js').write_text('window.V3_MILITARY_DATA='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';',encoding='utf-8')
print(f'Generated {len(units)} unit attribute definitions and {len(options)} mobilization options in {len(groups)} groups.')
