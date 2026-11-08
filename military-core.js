(function(root){
  'use strict';
  function createModel(geo){
    const countries=Object.values(geo.countries),units=Object.entries(geo.unitMeta).map(([id,meta])=>({id,...meta,kind:id.startsWith('ship_type_')?'fleet':'army'}));
    const byUnit=Object.fromEntries(units.map(u=>[u.id,u]));
    const sum=(values)=>values.reduce((a,b)=>a+b,0);
    const composition=(country,kind)=>Object.entries(country.military||{}).filter(([id,n])=>n>0&&(country.militaryKinds?.[id]||byUnit[id]?.kind)===kind).map(([id,count])=>({id,name:byUnit[id]?.name||id,count})).sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id));
    const totals=Object.fromEntries(countries.map(c=>[c.id,{army:sum(composition(c,'army').map(u=>u.count)),fleet:sum(composition(c,'fleet').map(u=>u.count))}]));
    const world={army:sum(Object.values(totals).map(c=>c.army)),fleet:sum(Object.values(totals).map(c=>c.fleet))};
    const owners=id=>countries.map(c=>({id:c.id,name:c.name,count:c.military?.[id]||0})).filter(c=>c.count>0).sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id));
    const unitTotals=Object.fromEntries(units.map(u=>[u.id,sum(owners(u.id).map(c=>c.count))]));
    const ranking=(kind,query='',ascending=false)=>countries.filter(c=>(c.name+' '+c.id).toLowerCase().includes(query.toLowerCase().trim())).map(c=>({id:c.id,name:c.name,count:totals[c.id][kind],share:world[kind]?totals[c.id][kind]/world[kind]:0,types:composition(c,kind).length,formations:(c.formations||[]).filter(f=>f.kind===kind).length})).sort((a,b)=>(a.count-b.count)*(ascending?1:-1)||a.id.localeCompare(b.id));
    return {countries,units,byUnit,composition,totals,world,owners,unitTotals,ranking};
  }
  function slices(entries,limit=8){
    const positive=entries.filter(e=>e.count>0).map(e=>({...e})).sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id));
    if(positive.length<=limit)return positive;
    return [...positive.slice(0,limit-1),{id:'other',name:`其他（${positive.length-limit+1} 国）`,count:positive.slice(limit-1).reduce((n,e)=>n+e.count,0)}];
  }
  function clampView(view,width=8192,height=3616){
    if(view.w>=width||view.h>=height)return {x:0,y:0,w:width,h:height};
    const w=Math.max(1,view.w),h=Math.max(1,view.h);
    return {x:Math.max(0,Math.min(width-w,view.x)),y:Math.max(0,Math.min(height-h,view.y)),w,h};
  }
  root.V3_MILITARY={createModel,slices,clampView};
})(typeof window==='undefined'?globalThis:window);
