'use strict';
const L=window.V3_LAWS,G=window.V3_GEO,K=window.LawCore,$=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=x=>Number(x).toLocaleString('zh-CN',{maximumFractionDigits:3}),pct=(n,t)=>n&&n/t*100<.01?'<0.01%':Number(t?n/t*100:0).toLocaleString('zh-CN',{maximumFractionDigits:2})+'%';
const categories=[['power_structure','权力结构'],['economy','经济'],['human_rights','人权']];
const terms={AND:'全部满足',OR:'满足任一',NOT:'不满足',NOR:'均不满足',NAND:'不同时满足',if:'满足条件时',else:'否则',else_if:'否则满足条件时',limit:'条件',always:'始终',has_law:'已采用法律',has_law_or_variant:'已采用法律或变体',country_has_primary_culture:'主体文化包含',has_dlc_feature:'所需 DLC 功能',exists:'存在',is_subject:'是附属国',is_subject_type:'附属类型',has_technology_researched:'已研究科技',custom_tooltip:'效果说明',hidden_effect:'其他生效效果',text:'说明',possible:'适用条件',can_repeal:'撤销条件',would_sponsor:'发起集团条件',is_visible:'显示条件',can_enact:'颁布条件',unlocking_laws:'解锁法律',disallowing_laws:'不兼容法律',requires_law_or:'所需法律（任一）',enable:'启用条件',change_allowed_trigger:'变更条件',on_enact:'颁布时',on_activate:'生效时',on_deactivate:'失效时',power_bloc_features:'国家集团扩展功能',legitimacy:'正统性',has_government_type:'政府类型',has_social_hierarchy:'社会等级体系',ROOT:'当前对象',THIS:'当前国家',PREV:'上级对象'};
const label=x=>terms[x]||L.labels[x]||G.labels[x]||L.laws[x]?.name||x;
const art=(src,cls='')=>src?`<img class="${cls}" src="${esc(src)}" alt="" loading="lazy">`:'';
let selected=new URLSearchParams(location.search).get('law')||'law_monarchy',reference=new URLSearchParams(location.search).get('country')||'GBR',level=1,tax='medium',chosen=new Set(),includeInferred=false;
if(!L.laws[selected])selected='law_monarchy';if(!G.countries[reference])reference='GBR';

function scriptTree(entries){return `<ul>${(entries||[]).map(([k,op,v])=>`<li><span class="law-script-label">${esc(label(k))}</span>${Array.isArray(v)?scriptTree(v):v!==null?` ${esc(op)} ${esc(v==='yes'?'是':v==='no'?'否':label(v))}`:''}</li>`).join('')}</ul>`}
function rawScript(entries,depth=0){return entries.map(([k,op,v])=>'  '.repeat(depth)+k+(Array.isArray(v)?` ${op} {\n${rawScript(v,depth+1)}\n${'  '.repeat(depth)}}`:v===null?'':` ${op} ${v}`)).join('\n')}
function effectValue(e){if(e.boolean)return e.value==='yes'?'启用':'禁用';const n=Number(e.value)*(e.percent?100:1);return (n>0?'+':'')+num(n)+(e.percent?'%':'')}
function effectColor(e){if(e.color==='neutral')return 'neutral';const positive=e.boolean?e.value==='yes':Number(e.value)>0;return (e.color==='good')===positive?'good':'bad'}
function effectList(rows,empty='无固定数值效果'){return rows?.length?`<ul class="law-effect-list">${rows.map(e=>`<li><span>${esc(e.name)}${e.sources?`<small>${esc(e.sources.join(' + '))}</small>`:''}</span><strong class="effect-${effectColor(e)}">${esc(effectValue(e))}</strong></li>`).join('')}</ul>`:`<p class="muted">${empty}</p>`}
function conditionBlocks(conditions){return Object.entries(conditions).map(([k,v])=>`<details><summary>${esc(label(k))}</summary><div class="law-script-tree">${scriptTree(v)}</div></details>`).join('')}
function resetPreview(){
 const law=L.laws[selected],c=G.countries[reference],matches=c.laws[law.group]===selected;
 level=matches&&c.institutions[law.institution]?c.institutions[law.institution].level:1;
 chosen=new Set(matches?(c.amendments[law.group]||[]).map(a=>a.id).filter(id=>K.eligible(L,selected).some(a=>a.id===id)):[]);
}
function renderCatalog(){
 const query=$('#law-search').value.trim().toLowerCase(),special=$('#law-kind').value==='special',c=G.countries[reference];let found=0;
 $('#law-catalog').innerHTML=categories.map(([category,title])=>{
  const groups=Object.values(L.groups).filter(g=>g.category===category).map(group=>{
   const laws=Object.values(L.laws).filter(l=>l.group===group.id&&(!special||l.special)&&(!query||(l.name+' '+l.id+' '+l.description+' '+group.name+' '+Object.values(l.effects).flat().map(e=>e.name).join(' ')).toLowerCase().includes(query)));
   if(!laws.length)return '';found+=laws.length;
   const current=L.laws[c.laws[group.id]],origin=current?((c.explicitLaws||[]).includes(group.id)?'历史设置':'默认推定'):'无开局记录';
   return `<details class="law-group" ${query||special||group.id===L.laws[selected].group?'open':''}><summary>${art(current?.icon||laws[0].icon)}<span><small>${esc(group.name)}${group.special?' · 特殊制度':''}</small><strong>${esc(current?.name||'未设置或无记录')}</strong><small>${esc(c.name)} · ${origin} · ${laws.length} 项可查阅</small></span></summary><div class="law-group-options">${laws.map(l=>`<button type="button" class="law-option${l.id===selected?' selected':''}" data-law="${l.id}" aria-pressed="${l.id===selected}">${art(l.icon)}<span class="law-option-name">${esc(l.name)}</span>${l.special?'<em>特殊</em>':''}${current?.id===l.id?'<em>开局</em>':''}</button>`).join('')}</div></details>`;
  }).join('');return `<section class="law-category"><h2>${title}</h2>${groups||'<p class="empty">无匹配法律</p>'}</section>`;
 }).join('');
 $('#catalog-count').textContent=`${found} / ${Object.keys(L.laws).length} 项法律 · ${Object.keys(L.amendments).length} 项修正案`;
}
function renderEffects(){
 const law=L.laws[selected],e=K.effects(L,selected,[...chosen],level,tax),institution=L.institutions[law.institution];
 $('#law-effect-results').innerHTML=`<h3>法律效果${chosen.size?' · 含所选修正案':''}</h3>${effectList(e.fixed)}${institution?`<h3 class="law-institution-title">${art(institution.icon)}${esc(institution.name)} · ${level} 级效果</h3><p class="muted">机构自身与法律的每级效果 × ${level}；固定法律效果不随等级重复。</p>${effectList(e.institution,'本等级没有固定机构效果')}`:''}${e.taxes.length?`<h3>税收效果 · ${{very_low:'极低',low:'低',medium:'中等',high:'高',very_high:'极高'}[tax]}税负</h3>${effectList(e.taxes)}`:''}${e.acceptance.length?`<h3>接纳等级相关效果</h3>${effectList(e.acceptance)}`:''}${e.sponsor.length?`<h3>发起利益集团效果</h3><p class="muted">各修正案分别作用于其发起集团，不合并为同一集团的加成。</p>${effectList(e.sponsor.map(e=>({...e,sources:[e.source]})))}`:''}`;
}
function amendmentEntries(amendments){
 const entries=[],concessions=[];
 for(const a of amendments){
  if(a.generic&&a.id.startsWith('amendment_generic_sponsor_polstr_')){if(!concessions.length)entries.push(concessions);concessions.push(a)}
  else entries.push([a]);
 }
 return entries;
}
function concessionLabel(a){
 const value=(scope,id)=>a.effects[scope]?.find(e=>e.id===id)?.value||0;
 return `政治力量 +${num(Number(value('sponsor_modifier','interest_group_pol_str_mult'))*100)}% · 执政支持度 +${num(value('sponsor_modifier','interest_group_in_government_approval_add'))} · 权威力花费 ${num(value('modifier','country_authority_cost_add'))}`;
}
function amendmentEntry(variants,hist,c,activeId){
 const a=variants.find(a=>a.id===activeId)||variants.find(a=>chosen.has(a.id))||variants[0],record=hist.find(h=>h.id===a.id);
 return `<article class="amendment-option${chosen.has(a.id)?' is-chosen':''}"><label>${art(a.icon)}<input type="checkbox" data-amendment="${a.id}" ${chosen.has(a.id)?'checked':''}><span>${esc(a.name)}</span>${a.generic?'<span class="law-mark">通用</span>':''}</label>${record?`<p>${esc(c.name)}开局 · 发起：${esc(record.sponsorName)}${record.cooldown!==null?` · 冷却 ${record.cooldown} 个月`:''}</p>`:''}<p>${esc(a.description||'具体效果见下方。')}</p>${variants.length>1?`<label class="concession-variant">让步方案<select data-amendment-variant data-variants="${variants.map(a=>a.id).join(',')}" aria-label="政治让步方案">${variants.map(v=>`<option value="${v.id}" ${v.id===a.id?'selected':''}>${esc(concessionLabel(v))}</option>`).join('')}</select></label>`:''}<details><summary>效果与适用条件</summary>${effectList(a.effects.modifier)}${a.effects.sponsor_modifier?`<p>发起集团</p>${effectList(a.effects.sponsor_modifier)}`:''}${conditionBlocks(a.conditions)}${Object.keys(a.events).length?`<details><summary>其他生效效果（不计入数值预览）</summary>${conditionBlocks(a.events)}</details>`:''}<details><summary>原版定义</summary><pre>${esc(rawScript(a.definition))}</pre></details></details></article>`;
}
function renderDetail(){
 const law=L.laws[selected],group=L.groups[law.group],c=G.countries[reference],matches=c.laws[law.group]===selected,institution=L.institutions[law.institution],amendments=K.eligible(L,selected),hasTax=[law,...amendments].some(a=>Object.keys(a.effects).some(k=>k.startsWith('tax_modifier_'))),hist=matches?c.amendments[law.group]||[]:[];
 $('#law-detail').innerHTML=`<div class="law-detail-heading">${art(law.icon)}<div><small class="muted">${esc(group.name)}</small><h2>${esc(law.name)}</h2>${law.special?'<span class="law-mark">特殊法律／变体</span>':''}${matches?`<span class="law-mark">${esc(c.name)}开局 · ${(c.explicitLaws||[]).includes(group.id)?'历史设置':'默认推定'}</span>`:''}${law.parent?`<span class="law-mark">立场继承：${esc(L.laws[law.parent]?.name||label(law.parent))}</span>`:''}<a href="#law-statistics" class="muted">查看采用国家 ↓</a></div></div><p class="law-description">${esc(law.description||'原版未提供文字简介；具体效果与适用条件见下方。')}</p>
 <div class="law-detail-grid"><div class="law-effects"><div class="law-preview-controls">${institution?`<label>机构等级预览 <select id="institution-level">${Array.from({length:Math.max(6,level+1)},(_,i)=>`<option value="${i}" ${i===level?'selected':''}>${i} 级</option>`).join('')}</select></label>`:'<span>该法律不设机构</span>'}${hasTax?`<label>税负预览 <select id="tax-level">${Object.entries({very_low:'极低',low:'低',medium:'中等',high:'高',very_high:'极高'}).map(([k,v])=>`<option value="${k}" ${k===tax?'selected':''}>${v}</option>`).join('')}</select></label>`:''}</div>${institution?`<p class="muted">${matches&&c.institutions[law.institution]?`${esc(c.name)}开局显式等级：${c.institutions[law.institution].level} 级。`:'当前使用预览等级，不代表开局实际等级。'}预览范围 0–5 级；实际可投资上限受科技和其他修正影响。</p>`:''}<div id="law-effect-results"></div><div class="law-conditions"><h3>解锁与特殊条件</h3>${law.technologies.length?`<p class="muted">解锁科技：${law.technologies.map(k=>esc(label(k))).join('、')}</p>`:''}${group.special?`<p class="muted">关联社会体系：${esc(group.hierarchy)}。仅在满足该体系条件的国家适用。</p>`:''}${conditionBlocks(group.conditions)}${conditionBlocks(law.conditions)||'<p class="muted">未定义额外显示或颁布条件。</p>'}${Object.keys(law.events).length?`<details><summary>颁布与生效时的其他效果</summary><p class="muted">以下效果依赖条件、事件或当前国家，不计入固定数值预览。</p>${conditionBlocks(law.events)}</details>`:''}<details><summary>原版定义与来源</summary><p class="muted">${esc(law.source)}</p><pre>${esc(rawScript(law.definition))}</pre></details></div></div>
 <section class="law-amendment-panel"><h3>修正案 · ${amendmentEntries(amendments).length} 项</h3><p class="muted">勾选预览固定效果；能否实际添加仍取决于适用条件。已勾选的开局项来自所选参照国。</p><div class="law-amendment-list">${amendmentEntries(amendments).map(variants=>amendmentEntry(variants,hist,c)).join('')||'<p class="muted">无适用修正案定义</p>'}</div></section></div>`;
 renderEffects();
 $('#institution-level')?.addEventListener('change',e=>{level=Number(e.target.value);renderEffects()});
 $('#tax-level')?.addEventListener('change',e=>{tax=e.target.value;renderEffects()});
 $('.law-amendment-list').onchange=e=>{
  const el=e.target;
  if(el.matches('[data-amendment-variant]')){
   const ids=el.dataset.variants.split(','),enabled=ids.some(id=>chosen.has(id)),article=el.closest('article'),open=article.querySelector('details').open;
   ids.forEach(id=>chosen.delete(id));if(enabled)chosen.add(el.value);
   const replacement=document.createElement('div');replacement.innerHTML=amendmentEntry(ids.map(id=>L.amendments[id]),hist,c,el.value);
   const next=replacement.firstElementChild;next.querySelector('details').open=open;article.replaceWith(next);next.querySelector('select').focus();renderEffects();
  }else if(el.matches('[data-amendment]')){el.checked?chosen.add(el.dataset.amendment):chosen.delete(el.dataset.amendment);el.closest('article').classList.toggle('is-chosen',el.checked);renderEffects()}
 };
}

const palette=['#557b62','#bd9559','#6b91a4','#b87465','#8e7ca2','#9da960','#c0929f','#7f9a94','#bdac86','#a1a5a0'];
function distributionChart(stats){
 const slices=stats.distribution.map((s,i)=>({...s,color:palette[i%palette.length]}));if(stats.unknown)slices.push({id:'unknown',name:includeInferred?'未设置或无记录':'未明确记录',count:stats.unknown,color:'#d0cec2'});
 let angle=-Math.PI/2;
 const shapes=slices.map(s=>{const delta=s.count/stats.total*Math.PI*2,next=angle+delta,start=[120+108*Math.cos(angle),120+108*Math.sin(angle)],end=[120+108*Math.cos(next),120+108*Math.sin(next)],attrs=`fill="${s.color}" class="law-pie-sector${s.id===selected?' chosen':''}" data-stat-law="${s.id}" data-readout="${esc(s.name)} · ${s.count} 国 · ${esc(pct(s.count,stats.total))}" tabindex="0" role="button" aria-label="${esc(s.name)}，${s.count} 国，占 ${esc(pct(s.count,stats.total))}"`;angle=next;return slices.length===1?`<circle cx="120" cy="120" r="108" ${attrs}/>`:`<path d="M120 120 L${start.join(' ')} A108 108 0 ${delta>Math.PI?1:0} 1 ${end.join(' ')} Z" ${attrs}/>`}).join('');
 return `<figure class="law-distribution"><figcaption>${esc(L.groups[L.laws[selected].group].name)} · 各法律采用国分布</figcaption><div class="law-distribution-body"><svg class="law-pie" viewBox="0 0 240 240" role="group" aria-label="同组法律采用国家数量饼图">${shapes}</svg><div class="law-pie-legend">${slices.map(s=>`<button type="button" data-stat-law="${s.id}" data-readout="${esc(s.name)} · ${s.count} 国 · ${esc(pct(s.count,stats.total))}" aria-pressed="${s.id===selected}"><i style="background:${s.color}"></i><span>${esc(s.name)}</span><b>${s.count} 国 · ${esc(pct(s.count,stats.total))}</b></button>`).join('')}</div></div><p class="law-pie-readout" aria-live="polite">${esc(L.laws[selected].name)} · ${stats.adopters.length} 国 · ${esc(pct(stats.adopters.length,stats.total))}</p><p class="muted">按国家数量统计，每国权重相同；点击有记录的扇区或图例切换法律。</p></figure>`;
}
function renderStatistics(){
 const law=L.laws[selected],stats=K.statistics(L,G,selected,includeInferred),countries=[...stats.adopters].sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
 $('#law-statistics').innerHTML=`<div class="law-stat-heading"><div><h2>开局采用统计</h2><p class="muted">${esc(law.name)} · 1836 年有直属领土的国家／政体，含附属国与分散式政体</p></div><label><input id="include-inferred" type="checkbox" ${includeInferred?'checked':''}> 纳入默认推定法律</label></div><div class="law-stat-metrics"><div><small>当前口径采用国家</small><strong>${stats.adopters.length}</strong></div><div><small>历史明确记录</small><strong>${stats.explicit.length}</strong></div><div><small>默认推定采用（可选计入）</small><strong>${stats.inferred.length}</strong></div><div><small>统计国家总数</small><strong>${stats.total}</strong></div></div><p class="muted">${includeInferred?'当前包含按定义首项补全的常规法律；推定不等于已核验存档。':'当前计入国家历史和开局政治模板中明确设置的法律，其余归入“未明确记录”。'}特殊制度未设置时不自动补全；未记录不代表没有采用。下方统计不受机构等级或修正案预览影响。</p><div class="law-stat-layout">${distributionChart(stats)}<section><div class="law-stat-country-title"><h3>采用国家 · ${countries.length}</h3><button id="law-country-export" type="button">导出 CSV</button></div><div class="law-country-list">${countries.map(c=>{const explicit=(c.explicitLaws||[]).includes(law.group),inst=c.institutions[law.institution],amendments=c.amendments[law.group]||[];return `<div class="law-country-row"><div><a href="geopolitics.html?country=${encodeURIComponent(c.id)}">${esc(c.name)} <small style="display:inline">${c.id}</small> ↗</a><span>${explicit?(c.lawOrigins?.[law.group]?.template?'历史设置 · 开局模板':'历史设置'):'默认推定'}</span></div>${law.institution?`<small>${esc(L.institutions[law.institution].name)}：${inst?inst.level+' 级':'等级未显式设置'}</small>`:''}${amendments.length?`<small>修正案：${amendments.map(a=>esc(L.amendments[a.id]?.name||a.id)).join('、')}</small>`:''}</div>`}).join('')||'<p class="muted">当前统计口径下无采用国家。</p>'}</div></section></div>`;
 $('#include-inferred').onchange=e=>{includeInferred=e.target.checked;renderStatistics()};
 $('#law-country-export').onclick=()=>{const rows=[['国家','代码','法律','记录来源','机构等级'],...countries.map(c=>[c.name,c.id,law.name,(c.explicitLaws||[]).includes(law.group)?'历史设置':'默认推定',c.institutions[law.institution]?.level??'未记录'])],csv='\ufeff'+rows.map(r=>r.map(v=>'"'+(window.V3I18n?.t(String(v))??String(v)).replace(/"/g,'""')+'"').join(',')).join('\r\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=selected+'-1836.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 document.querySelectorAll('[data-stat-law]').forEach(el=>{const show=()=>{$('.law-pie-readout').textContent=el.dataset.readout};el.onpointerenter=show;el.onfocus=show;el.onclick=()=>{if(L.laws[el.dataset.statLaw])selectLaw(el.dataset.statLaw,false);else show()};if(el.tagName.toLowerCase()!=='button')el.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();el.onclick()}}});
}
function selectLaw(id,scroll=true){selected=id;resetPreview();renderCatalog();renderDetail();renderStatistics();const url=new URL(location.href);url.searchParams.set('law',selected);url.searchParams.set('country',reference);history.replaceState(null,'',url);if(scroll)$('#law-detail').scrollIntoView({block:'start'})}
$('#law-catalog').onclick=e=>{const button=e.target.closest('[data-law]');if(button)selectLaw(button.dataset.law)};
$('#law-search').oninput=renderCatalog;$('#law-kind').onchange=renderCatalog;
$('#law-country').innerHTML=Object.values(G.countries).filter(c=>c.states.length).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')).map(c=>`<option value="${c.id}">${esc(c.name)} · ${c.id}</option>`).join('');$('#law-country').value=reference;
$('#law-country').onchange=e=>{reference=e.target.value;selectLaw(G.countries[reference].laws[L.laws[selected].group]||selected,false)};
$('#version').textContent=window.V3_DATA.version;$('#law-source').textContent=L.source;selectLaw(selected,false);
