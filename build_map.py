"""Extract original state boundaries and 1836 resource/population records. Offline output."""
import collections, json, pathlib, shutil, math
import numpy as np
from PIL import Image
from build_data import ROOT, HERE, parse, get, ids, name, load, icon
def ids(obj): return [k.strip('"') for k,v in (obj or [])]

OUT=HERE/'assets'; OUT.mkdir(exist_ok=True)
shutil.copyfile(ROOT/'launcher/assets/launcher-logo.png', OUT/'victoria3-logo.png')
states={}; colors={}; resources=set(); cultures=set()
modifier_types=load('modifier_type_definitions')
traits={}
for key,(values,source) in load('state_traits').items():
    effects=[]
    for modifier,value in get(values,'modifier',[]):
        definition=modifier_types.get(modifier)
        if definition is None: raise ValueError(('Unknown state trait modifier',key,modifier))
        properties=definition[0]
        effects.append({'id':modifier,'name':name(modifier),'value':float(value),
                        'percent':get(properties,'percent')=='yes','color':get(properties,'color','neutral')})
    traits[key]={'id':key,'name':name(key),'icon':icon(get(values,'icon')),'effects':effects,'source':source,
                 'disablingTechnologies':[name(t) for t in ids(get(values,'disabling_technologies',[]))],
                 'requiredTechnologies':[name(t) for t in ids(get(values,'required_techs_for_colonization',[]))]}
for file in sorted((ROOT/'game/map_data/state_regions').glob('*.txt')):
    for key,values in parse(file.read_text(encoding='utf-8-sig')):
        if not isinstance(values,list): continue
        provinces=ids(get(values,'provinces',[]))
        if not provinces: continue
        known={k:float(v) for k,v in get(values,'capped_resources',[])}
        hidden={}
        for k,v in values:
            if k=='resource':
                resource=get(v,'type'); discovered=float(get(v,'discovered_amount',0)); undiscovered=float(get(v,'undiscovered_amount',0))
                known[resource]=known.get(resource,0)+discovered
                hidden[resource]=hidden.get(resource,0)+undiscovered
        resources.update(known);resources.update(hidden)
        state={'id':key,'name':name(key),'index':len(states)+1,'arable':float(get(values,'arable_land',0)),'farms':ids(get(values,'arable_resources',[])),'resources':known,'hidden':hidden,'cultures':{},'population':0,'popRecords':0,'source':file.relative_to(ROOT).as_posix(),'provinceCount':len(provinces),'homelands':[]}
        states[key]=state
        state['traits']=ids(get(values,'traits',[]))
        assert all(t in traits for t in state['traits']),(key,state['traits'])
        for color in provinces:
            value=int(color.lstrip('xX'),16)
            assert value not in colors,(key,color)
            colors[value]=state['index']

for file in sorted((ROOT/'game/common/history/pops').glob('*.txt')):
    for top,entries in parse(file.read_text(encoding='utf-8-sig')):
        if top!='POPS': continue
        for scope,owners in entries:
            key=scope.removeprefix('s:'); assert key in states,key
            state=states[key]
            for owner,pops in owners:
                for action,pop in pops:
                    if action!='create_pop': raise ValueError((file,action))
                    culture=get(pop,'culture'); size=int(get(pop,'size',0)); assert culture and size>=0
                    cultures.add(culture)
                    state['cultures'][culture]=state['cultures'].get(culture,0)+size
                    state['population']+=size;state['popRecords']+=1
for file in sorted((ROOT/'game/common/history/states').glob('*.txt')):
    for top,entries in parse(file.read_text(encoding='utf-8-sig')):
        if top!='STATES': continue
        for scope,values in entries:
            state=states.get(scope.removeprefix('s:'))
            if state:
                state['homelands']=list(dict.fromkeys(v.removeprefix('cu:') for k,v in values if k=='add_homeland'))

print('Parsed',len(states),'states;',len(cultures),'cultures; population',sum(s['population'] for s in states.values()),flush=True)
rgb=np.array(Image.open(ROOT/'game/map_data/provinces.png').convert('RGB'),dtype=np.uint32)
codes=(rgb[:,:,0]<<16)|(rgb[:,:,1]<<8)|rgb[:,:,2];del rgb
lut=np.zeros(16777216,dtype=np.uint16)
for code,index in colors.items(): lut[code]=index
labels=lut[codes];del codes,lut
H,W=labels.shape
# Ignore sea/lake state regions: all their province IDs are declared water in default.map.
default=parse((ROOT/'game/map_data/default.map').read_text(encoding='utf-8-sig'))
water={int(c.lstrip('xX'),16) for field in ['sea_starts','lakes'] for c in ids(get(default,field,[]))}
for color in water:
    index=colors.get(color)
    if index: labels[labels==index]=0
active={int(i) for i in np.unique(labels) if i}
print('Land states',len(active),'map',W,H,flush=True)

def simplify(points,epsilon=.65):
    # Remove collinear vertices first, then simplify two open arcs of the ring.
    pts=[p for i,p in enumerate(points) if (p[0]-points[i-1][0])*(points[(i+1)%len(points)][1]-p[1])!=(p[1]-points[i-1][1])*(points[(i+1)%len(points)][0]-p[0])]
    if len(pts)<4:return pts
    def rdp(ps):
        if len(ps)<=2:return ps
        keep={0,len(ps)-1}; stack=[(0,len(ps)-1)]
        while stack:
            a,b=stack.pop();x,y=ps[a];dx=ps[b][0]-x;dy=ps[b][1]-y;den=math.hypot(dx,dy)
            maxdist=epsilon;idx=None
            for i in range(a+1,b):
                dist=abs(dx*(y-ps[i][1])-(x-ps[i][0])*dy)/den if den else math.hypot(ps[i][0]-x,ps[i][1]-y)
                if dist>maxdist:maxdist=dist;idx=i
            if idx is not None:keep.add(idx);stack.extend([(a,idx),(idx,b)])
        return [ps[i] for i in sorted(keep)]
    mid=len(pts)//2
    return rdp(pts[:mid+1])[:-1]+rdp(pts[mid:]+pts[:1])[:-1]

def outline(mask,x0,y0):
    pad=np.pad(mask,1); core=pad[1:-1,1:-1]
    edges=collections.defaultdict(list)
    for side,neighbor in enumerate([pad[:-2,1:-1],pad[1:-1,2:],pad[2:,1:-1],pad[1:-1,:-2]]):
        ys,xs=np.nonzero(core & ~neighbor)
        for y,x in zip(ys.tolist(),xs.tolist()):
            x+=x0;y+=y0
            a,b=[((x,y),(x+1,y)),((x+1,y),(x+1,y+1)),((x+1,y+1),(x,y+1)),((x,y+1),(x,y))][side]
            edges[a].append(b)
    paths=[]
    while edges:
        start=next(iter(edges));point=start;points=[]
        while True:
            points.append(point);targets=edges[point];nxt=targets.pop()
            if not targets:del edges[point]
            point=nxt
            if point==start:break
        points=simplify(points)
        if len(points)>=3:paths.append('M'+'L'.join(f'{x},{y}' for x,y in points)+'Z')
    return ''.join(paths)

# Bounding boxes in one image pass, avoiding a full-world mask for every state.
ys,xs=np.nonzero(labels); vals=labels[ys,xs]
n=len(states)+1;minx=np.full(n,W);miny=np.full(n,H);maxx=np.zeros(n,dtype=int);maxy=np.zeros(n,dtype=int)
np.minimum.at(minx,vals,xs);np.minimum.at(miny,vals,ys);np.maximum.at(maxx,vals,xs);np.maximum.at(maxy,vals,ys)
del ys,xs,vals
land=[]
for state in states.values():
    i=state['index']
    if i not in active:continue
    x,y=int(minx[i]),int(miny[i]);right,bottom=int(maxx[i])+1,int(maxy[i])+1
    state['bounds']=[x,y,right-x,bottom-y]
    state['path']=outline(labels[y:bottom,x:right]==i,x,y)
    assert state['path'],state['id']
    land.append(state)
    if len(land)%100==0:print('Traced',len(land),'states',flush=True)

# Original paper-map artwork retains the exact province-map aspect ratio.
with Image.open(ROOT/'game/gfx/map/textures/flatmap.dds') as im:
    im=im.convert('RGB');im.resize((4096,1808),Image.Resampling.LANCZOS).save(OUT/'world-paper.jpg',quality=90)
data={'width':W,'height':H,'states':land,'resources':{k:name(k) for k in sorted(resources)},'cultures':{k:name(k) for k in sorted(cultures)},'farms':{k:name(k) for s in land for k in s['farms']},'source':'map_data/provinces.png + map_data/state_regions + common/history/pops','populationSource':'1836 开局 create_pop 原始人数，按完整州合并；不含存档变化或运行时脚本修正。'}
data['traits']=traits
(HERE/'map-data.js').write_text('window.V3_MAP='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';',encoding='utf-8')
assert all(sum(s['cultures'].values())==s['population'] for s in land)
print('Saved',len(land),'land state polygons; total path chars',sum(len(s['path']) for s in land),flush=True)
