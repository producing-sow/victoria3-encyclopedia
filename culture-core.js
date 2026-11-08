(function(root){
'use strict';
function acceptance(data,targetId,primaryIds,citizenshipId,religiousLawId,stateReligionId,targetReligionId,homeland=false,extra=0,noColonialAffairs=false){
 const target=data.cultures[targetId],primaries=[...new Set(primaryIds)].filter(id=>data.cultures[id]).map(id=>data.cultures[id]);
 if(!target||!primaries.length||!data.laws[citizenshipId]||!data.laws[religiousLawId])throw new Error('请选择有效文化和法律');
 const civic=data.laws[citizenshipId].coefficients,faith=data.laws[religiousLawId].coefficients,parts=[];
 const cv=key=>civic['country_acceptance_'+key+'_add']||0,rv=key=>faith['country_acceptance_'+key+'_add']||0;
 function compare(type){let candidates=[];if(primaries.some(p=>p[type]&&p[type]===target[type]))candidates.push({value:cv('shared_'+type+'_trait'),reason:'相同'+(type==='heritage'?'传承':'语言')});const group=data.traits[target[type]]?.group;if(group&&primaries.some(p=>data.traits[p[type]]?.group===group))candidates.push({value:cv('shared_'+type+'_trait_group'),reason:'同'+(type==='heritage'?'传承组':'语系')});return candidates.length?candidates.sort((a,b)=>b.value-a.value)[0]:{value:cv('no_shared_'+type+'_trait'),reason:'无共同'+(type==='heritage'?'传承组':'语系')}}
 if(primaries.some(p=>p.id===target.id)){parts.push({reason:'主体文化（替代传承、语言、传统和家园项）',value:cv('primary_culture')})}
 else{parts.push(compare('heritage'),compare('language'));const shared=primaries.some(p=>p.traditions.some(t=>target.traditions.includes(t)));parts.push({reason:shared?'共享传统':'无共享传统',value:cv(shared?'shared_tradition_trait':'no_shared_tradition_trait')});parts.push({reason:homeland?'位于该文化家园':'不在该文化家园',value:cv(homeland?'homeland':'not_homeland')})}
 if(homeland&&noColonialAffairs)parts.push({reason:'无殖民事务 · 文化家园',value:10});
 const cultural=parts.reduce((s,p)=>s+p.value,0);const sr=data.religions[stateReligionId],tr=data.religions[targetReligionId];
 if(!sr||!tr)throw new Error('请选择国教与目标宗教');let religious;
 if(sr.id===tr.id)religious={reason:'目标宗教与国教相同',value:rv('state_religion')};
 else{let choices=[];if(sr.heritage&&sr.heritage===tr.heritage)choices.push({reason:'与国教共享宗教传承',value:rv('shared_religious_trait')});const group=data.traits[sr.heritage]?.group;if(group&&group===data.traits[tr.heritage]?.group)choices.push({reason:'与国教共享宗教传承组',value:rv('shared_religious_trait_group')});religious=choices.length?choices.sort((a,b)=>b.value-a.value)[0]:{reason:'与国教无共享宗教传承组',value:rv('no_shared_religious_trait')}}
 parts.push(religious);if(extra)parts.push({reason:'手动输入其他修正',value:Number(extra)||0});const raw=parts.reduce((s,p)=>s+p.value,0),score=Math.min(data.maximum,Math.max(data.minimum,raw)),status=[...data.statuses].reverse().find(s=>score>=s.threshold);
 return {score,raw,cultural,religious:religious.value,status,parts};
}
root.CultureCore={acceptance};
})(typeof window==='undefined'?globalThis:window);
