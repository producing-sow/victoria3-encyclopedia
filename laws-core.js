(function(root){
'use strict';
function eligible(data,lawId){return Object.values(data.amendments).filter(a=>a.generic||a.allowedLaws.includes(lawId))}
function effects(data,lawId,amendmentIds=[],level=1,tax='medium'){
 const law=data.laws[lawId],allowed=new Set(eligible(data,lawId).map(a=>a.id)),chosen=[...new Set(amendmentIds)].filter(id=>allowed.has(id)).map(id=>data.amendments[id]);
 const fixed=[],institution=[],taxes=[],acceptance=[],sponsor=[];
 function add(target,rows,source,mult=1){for(const e of rows||[])target.push({...e,value:e.boolean?e.value:Number(e.value)*mult,source})}
 for(const item of [law,...chosen]){
  add(fixed,item.effects.modifier,item.name);
  add(taxes,item.effects['tax_modifier_'+tax],item.name);
  add(acceptance,item.effects.acceptance_modifier,item.name);
  add(sponsor,item.effects.sponsor_modifier,item.name);
  if(law.institution&&(!item.institution||item.institution===law.institution))add(institution,item.effects.institution_modifier,item.name,level);
 }
 if(law.institution)add(institution,data.institutions[law.institution]?.effects.modifier,data.institutions[law.institution]?.name,level);
 function sum(rows){const out=new Map();for(const e of rows){const current=out.get(e.id);if(!current)out.set(e.id,{...e,sources:[e.source]});else{current.value=e.boolean?(current.value==='yes'||e.value==='yes'?'yes':'no'):current.value+e.value;current.sources.push(e.source)}}return [...out.values()]}
 return {fixed:sum(fixed),institution:sum(institution),taxes:sum(taxes),acceptance:sum(acceptance),sponsor};
}
function statistics(data,geo,lawId,includeInferred=false){
 const group=data.laws[lawId].group,countries=Object.values(geo.countries).filter(c=>c.states.length>0),counts=new Map(Object.values(data.laws).filter(l=>l.group===group).map(l=>[l.id,0]));
 let unknown=0;const explicit=[],inferred=[];
 for(const c of countries){const id=c.laws[group],known=(c.explicitLaws||[]).includes(group);if(id===lawId)(known?explicit:inferred).push(c);if(counts.has(id)&&(known||includeInferred))counts.set(id,counts.get(id)+1);else unknown++}
 return {total:countries.length,explicit,inferred,adopters:includeInferred?[...explicit,...inferred]:explicit,unknown,distribution:[...counts].map(([id,count])=>({id,count,name:data.laws[id].name})).filter(r=>r.count>0).sort((a,b)=>b.count-a.count)};
}
root.LawCore={eligible,effects,statistics};
})(typeof window==='undefined'?globalThis:window);
