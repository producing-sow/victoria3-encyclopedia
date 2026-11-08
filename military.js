'use strict';
const Military=window.V3_MILITARY,geo=window.V3_GEO,model=Military.createModel(geo),$=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=value=>Number(value||0).toLocaleString('zh-CN',{maximumFractionDigits:2});
const percent=(count,total)=>!total?'—':count>0&&count/total*100<.01?'<0.01%':num(count/total*100)+'%';
const unitLabel=kind=>kind==='army'?'营':'艘',kindLabel=kind=>kind==='army'?'陆军':'海军';
const palette=['#537c63','#ba9052','#638fa5','#b86e62','#8c79a6','#91a65d','#c18ca0','#788b8a','#d09b69','#516d97','#9c6569','#848956'];
function color(id){if(id==='other')return '#a6aaa0';let hash=0;for(const char of id)hash=(hash*31+char.charCodeAt(0))|0;return palette[(hash>>>0)%palette.length]}
// Give each unit a stable color in every country chart and legend.
const unitColors=Object.fromEntries(model.units.map((unit,i)=>[unit.id,palette[i%palette.length]]));
let selected=geo.countries[new URLSearchParams(location.search).get('country')]?.id||'CHI',selectedType='combat_unit_type_irregular_infantry',rankingAscending=false,mapController;
function countryButton(id,name){return `<button type="button" data-select-country="${esc(id)}">${esc(name)} <small>${esc(id)}</small></button>`}
function pieChart(entries,{title,kind,mode='unit',caption=''}){
  const total=entries.reduce((sum,item)=>sum+item.count,0),slices=mode==='country'?Military.slices(entries):entries.filter(e=>e.count>0);
  if(!total)return `<figure class="military-pie-card"><h3>${esc(title)}</h3><div class="military-no-forces"><b>0</b><p>无显式开局${kindLabel(kind)}记录</p></div></figure>`;
  let angle=-Math.PI/2;
  const sectors=slices.map((item,i)=>{const next=angle+item.count/total*2*Math.PI,start=[110+100*Math.cos(angle),110+100*Math.sin(angle)],end=[110+100*Math.cos(next),110+100*Math.sin(next)],single=slices.length===1;const shape=single?'circle cx="110" cy="110" r="100"':`path d="M110 110 L${start.join(' ')} A100 100 0 ${next-angle>Math.PI?1:0} 1 ${end.join(' ')} Z"`;angle=next;return `<${shape} class="military-sector" fill="${unitColors[item.id]||color(item.id)}" data-pie-slice="${i}" tabindex="0" role="button" aria-pressed="false" aria-label="${esc(item.name)} ${num(item.count)} ${unitLabel(kind)}，${esc(percent(item.count,total))}"><title>${esc(item.name)} · ${num(item.count)} ${unitLabel(kind)} · ${esc(percent(item.count,total))}</title></${single?'circle':'path'}>`}).join('');
  return `<figure class="military-pie-card" data-pie-mode="${mode}"><h3>${esc(title)}</h3><div class="pie-caption">${esc(caption||`共 ${num(total)} ${unitLabel(kind)} · 按数量占比`)}</div><div class="military-pie-body"><svg class="military-pie" viewBox="0 0 220 220" role="group" aria-label="${esc(title)}">${sectors}</svg><div class="military-pie-legend">${slices.map((item,i)=>`<button type="button" data-pie-slice="${i}" data-pie-id="${esc(item.id)}" data-readout="${esc(item.name)} · ${num(item.count)} ${unitLabel(kind)} · ${esc(percent(item.count,total))}" aria-pressed="false"><i style="background:${unitColors[item.id]||color(item.id)}"></i><span>${esc(item.name)}</span><b>${esc(percent(item.count,total))}</b></button>`).join('')}</div></div><p class="military-pie-readout" aria-live="polite">悬停或点击查看数量${mode==='country'?'；点击国家切换档案':'；点击兵种查看图鉴'}</p></figure>`;
}
function bindPies(container){
  container.querySelectorAll('[data-pie-mode]').forEach(chart=>{
    function highlight(index){const entry=chart.querySelector(`.military-pie-legend [data-pie-slice="${index}"]`);chart.querySelectorAll('[data-pie-slice]').forEach(el=>{const active=el.dataset.pieSlice===index;el.classList.toggle('is-active',active);el.setAttribute('aria-pressed',String(active))});chart.querySelector('.military-pie-readout').textContent=entry.dataset.readout;return entry.dataset.pieId}
    function choose(index){const id=highlight(index);if(id==='other')return;if(chart.dataset.pieMode==='country')selectCountry(id);else selectUnit(id,true)}
    chart.querySelectorAll('[data-pie-slice]').forEach(el=>{el.addEventListener('pointerenter',()=>highlight(el.dataset.pieSlice));el.addEventListener('focus',()=>highlight(el.dataset.pieSlice));el.addEventListener('click',()=>choose(el.dataset.pieSlice));if(el.tagName.toLowerCase()!=='button')el.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();choose(el.dataset.pieSlice)}})});
  });
}
function renderCountry(){
  const country=geo.countries[selected],totals=model.totals[selected],army=model.composition(country,'army'),fleet=model.composition(country,'fleet');
  $('#country-overview').innerHTML=`<span class="pill">本国开局军队 · 不含附属国</span><div class="country-heading"><h2 id="country-title">${esc(country.name)}<span class="country-code">${esc(country.id)}</span></h2><a href="geopolitics.html?country=${encodeURIComponent(country.id)}">国家完整档案 ↗</a></div><div class="force-metrics"><div><small>陆军总数</small><strong>${num(totals.army)}<span>营</span></strong></div><div><small>占全球陆军</small><strong>${esc(percent(totals.army,model.world.army))}</strong></div><div><small>海军总数</small><strong>${num(totals.fleet)}<span>艘</span></strong></div><div><small>占全球海军</small><strong>${esc(percent(totals.fleet,model.world.fleet))}</strong></div></div>`;
  $('#country-charts').innerHTML=pieChart(army,{title:'陆军兵种构成',kind:'army'})+pieChart(fleet,{title:'海军舰种构成',kind:'fleet'});bindPies($('#country-charts'));
  const formations=country.formations||[];$('#formation-summary').textContent=`军队与舰队编制 · ${formations.filter(f=>f.kind==='army').length} 支军队 / ${formations.filter(f=>f.kind==='fleet').length} 支舰队`;
  $('#country-formations').innerHTML=formations.length?['army','fleet'].map(kind=>{const items=formations.filter(f=>f.kind===kind);return items.length?`<h3>${kindLabel(kind)}编制</h3><div class="military-formations">${items.map(f=>`<article class="military-formation"><h4>${esc(f.name)}</h4><p class="muted">总部：${esc(f.hq||'未指定')} · ${num(Object.values(f.units).reduce((a,b)=>a+b,0))} ${unitLabel(kind)}</p><ul>${Object.entries(f.units).sort((a,b)=>b[1]-a[1]).map(([id,n])=>`<li><button class="unit-link" data-open-unit="${esc(id)}">${esc(model.byUnit[id]?.name||id)}</button><span>${num(n)} ${unitLabel(kind)}</span></li>`).join('')||'<li>未指定开局单位</li>'}</ul>${f.ships.length?`<details><summary>指定舰名 · ${f.ships.length} 艘</summary>${f.ships.map(ship=>`<p>${esc(ship.name)} · ${esc(model.byUnit[ship.type]?.name||ship.type)}</p>`).join('')}</details>`:''}</article>`).join('')}</div>`:''}).join(''):'<p class="muted">无显式开局编制记录。</p>';
  $('#country-formations').querySelectorAll('[data-open-unit]').forEach(button=>button.onclick=()=>selectUnit(button.dataset.openUnit,true));
  $('#map-country-summary').innerHTML=`<h3>${esc(country.name)} <small class="muted">${esc(selected)}</small></h3><div class="map-country-counts"><p>陆军 <strong>${num(totals.army)}</strong> 营</p><p>海军 <strong>${num(totals.fleet)}</strong> 艘</p></div><p class="muted">${army.length} 种陆军兵种 · ${fleet.length} 种舰艇</p>${country.path?'':'<p class="muted">该国家无可显示的开局领土，仍可通过下拉框查看记录。</p>'}<a href="#country-forces">查看该国军队构成 ↑</a>`;
  $('#military-focus').disabled=!country.bounds;
}
function renderCatalog(){
  const kind=$('#unit-kind').value,query=$('#unit-search').value.trim().toLowerCase(),units=model.units.filter(u=>(kind==='all'||u.kind===kind)&&(u.name+' '+u.id).toLowerCase().includes(query));
  $('#unit-count').textContent=`${units.length} / ${model.units.length} 种类型`;
  if(!units.some(u=>u.id===selectedType))selectedType=units[0]?.id||null;
  $('#unit-list').innerHTML=units.map(unit=>`<button type="button" class="unit-card${unit.id===selectedType?' selected':''}" data-unit="${unit.id}" aria-pressed="${unit.id===selectedType}">${unit.profile||unit.icon?`<img src="${esc(unit.profile||unit.icon)}" alt="" loading="lazy">`:''}<span><strong>${esc(unit.name)}</strong><small>全球 ${num(model.unitTotals[unit.id])} ${unitLabel(unit.kind)} · 本国 ${num(geo.countries[selected].military[unit.id])} ${unitLabel(unit.kind)}</small></span></button>`).join('')||'<p class="empty">没有匹配的兵种或舰种。</p>';
  $('#unit-list').querySelectorAll('[data-unit]').forEach(button=>button.onclick=()=>selectUnit(button.dataset.unit));renderUnitDetail();
}
function renderUnitDetail(){
  const unit=model.byUnit[selectedType];if(!unit){$('#unit-detail').innerHTML='<p class="muted">调整搜索条件以浏览类型。</p>';return}
  const owners=model.owners(unit.id),total=model.unitTotals[unit.id],own=geo.countries[selected].military[unit.id]||0;
  $('#unit-detail').innerHTML=`${unitIdentityAndAttributes(unit)}<div class="unit-stats"><div><small>开局全球部署</small><strong>${num(total)}</strong> ${unitLabel(unit.kind)}</div><div><small>${esc(geo.countries[selected].name)}</small><strong>${num(own)}</strong> ${unitLabel(unit.kind)}</div></div><p class="muted">占本国${kindLabel(unit.kind)} ${esc(percent(own,model.totals[selected][unit.kind]))} · 占全球同类型 ${esc(percent(own,total))}</p><h4>开局拥有国家 · ${owners.length} 国</h4><div class="unit-owners">${owners.map(c=>`<div class="unit-owner">${countryButton(c.id,c.name)}<span>${num(c.count)} ${unitLabel(unit.kind)} · ${esc(percent(c.count,total))}</span></div>`).join('')||'<p class="muted">开局历史记录中没有国家部署此类型；此类型仍存在于游戏定义中。</p>'}</div>`;bindCountryButtons($('#unit-detail'));
}
function selectUnit(id,scroll=false){if(!model.byUnit[id])return;selectedType=id;if(scroll){$('#unit-kind').value=model.byUnit[id].kind;$('#unit-search').value='';renderCatalog();$('#unit-catalog').scrollIntoView({behavior:'smooth',block:'start'});$('#unit-list').querySelector(`[data-unit="${id}"]`)?.scrollIntoView({block:'nearest'})}else{$('#unit-list').querySelectorAll('[data-unit]').forEach(button=>{const active=button.dataset.unit===id;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active))});renderUnitDetail()}}
function renderRanking(){
  const kind=$('#world-kind').value,rows=model.ranking(kind,$('#ranking-search').value,rankingAscending);
  $('#ranking-count').textContent=`${rows.length} / ${model.countries.length} 国 · 全球 ${num(model.world[kind])} ${unitLabel(kind)}`;
  $('#ranking-sort-header').setAttribute('aria-sort',rankingAscending?'ascending':'descending');$('#ranking-sort').innerHTML=`开局${kind==='army'?'营数':'艘数'} <span aria-hidden="true">${rankingAscending?'↑':'↓'}</span>`;$('#ranking-sort').setAttribute('aria-label',`点击按开局数量${rankingAscending?'从大到小':'从小到大'}排序`);
  $('#ranking-body').innerHTML=rows.map(c=>`<tr class="${c.id===selected?'selected-country':''}"><td>${countryButton(c.id,c.name)}</td><td class="num">${num(c.count)}</td><td class="num">${esc(percent(c.count,model.world[kind]))}</td><td class="num">${c.types}</td><td class="num">${c.formations}</td></tr>`).join('')||'<tr><td colspan="5">没有匹配的国家。</td></tr>';bindCountryButtons($('#ranking-body'));
}
function renderWorld(){const kind=$('#world-kind').value;$('#world-chart').innerHTML=pieChart(model.ranking(kind),{title:`各国开局${kindLabel(kind)}占比`,kind,mode:'country',caption:`全球 ${num(model.world[kind])} ${unitLabel(kind)} · 前七国与其他国家合计（国家较少时全部显示）`});bindPies($('#world-chart'));renderRanking()}
function bindCountryButtons(container){container.querySelectorAll('[data-select-country]').forEach(button=>button.onclick=()=>selectCountry(button.dataset.selectCountry))}
function selectCountry(id){if(!geo.countries[id])return;selected=id;$('#military-country').value=id;renderCountry();const top=$('#unit-list').scrollTop;renderCatalog();$('#unit-list').scrollTop=top;renderRanking();mapController?.paint();const url=new URL(location.href);url.searchParams.set('country',id);history.replaceState(null,'',url)}

function initMilitary(){
  $('#version').textContent=window.V3_DATA.version;
  initMilitaryEquipment();
  $('#military-country').innerHTML=[...model.countries].sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')).map(c=>`<option value="${c.id}">${esc(c.name)} · ${c.id}</option>`).join('');
  $('#military-country').onchange=event=>selectCountry(event.target.value);$('#unit-kind').onchange=renderCatalog;$('#unit-search').oninput=renderCatalog;$('#world-kind').onchange=()=>{rankingAscending=false;renderWorld()};$('#ranking-search').oninput=renderRanking;$('#ranking-sort').onclick=()=>{rankingAscending=!rankingAscending;renderRanking();$('.military-ranking').scrollTop=0};
  mapController=window.createMilitaryMap({model,onSelect:selectCountry,getSelected:()=>selected,color,format:num});renderWorld();selectCountry(selected);
}
initMilitary();
