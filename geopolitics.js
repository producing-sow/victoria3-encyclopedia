'use strict';
const G=window.V3_GEO,M=window.V3_MAP,D=window.V3_DATA,$=s=>document.querySelector(s),C=G.countries;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number(n||0).toLocaleString('zh-CN',{maximumFractionDigits:2}),label=k=>G.labels[k]||M.resources[k]||M.cultures[k]||k;
const states=Object.fromEntries(M.states.map(s=>[s.id,s])),buildings=Object.fromEntries(D.buildings.map(b=>[b.id,b]));
const link=t=>C[t]?`<button class="country-link" data-country="${esc(t)}">${countryBadge(t)}${esc(C[t].name)} <small>${esc(t)}</small></button>`:esc(t);
const sorted=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]);
const art=k=>buildings[k]?.icon?`<img class="game-art" src="${esc(buildings[k].icon)}" alt="" loading="lazy">`:'';
const table=(head,rows,sortValues=[])=>{
  const sortable=head.map((_,i)=>sortValues.some(row=>Number.isFinite(row[i])));
  return `<div class="tablewrap"><table${sortable.some(Boolean)?' class="geo-sortable-table"':''}><thead><tr>${head.map((h,i)=>sortable[i]?`<th class="num" aria-sort="none"><button type="button" class="sort-header" data-geo-sort-col="${i}" aria-label="${esc(h)}：点击从大到小排序">${h}<span aria-hidden="true"> ↕</span></button></th>`:`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r,row)=>`<tr>${r.map((v,i)=>`<td class="${i?'num':''}"${sortable[i]?` data-sort-value="${Number.isFinite(sortValues[row]?.[i])?sortValues[row][i]:''}"`:''}>${v}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${head.length}">无显式开局记录</td></tr>`}</tbody></table></div>`;
};
let selected=null,view={x:0,y:0,w:M.width,h:M.height},drag=null;
const svg=$('#world');
function color(t){let h=0;for(const c of t)h=(h*31+c.charCodeAt(0))|0;return `hsl(${(h%360+360)%360} 29% 49%)`}
function root(t){const seen=new Set();while(C[t]?.overlord&&!seen.has(t)){seen.add(t);t=C[t].overlord.country}return t}
function paint(){const mode=$('#geo-layer').value,q=$('#country-search').value.trim().toLowerCase();for(const c of Object.values(C)){const p=$('#country-'+c.id);if(!p)continue;let key=c.id;if(mode==='bloc')key=c.blocs.length?'bloc'+c.blocs[0]:'unaffiliated';if(mode==='subjects')key=root(c.id);p.setAttribute('fill',key==='unaffiliated'?'#c9c9b9':color(key));p.classList.toggle('selected',selected===c.id);p.classList.toggle('dimmed',!!q&&!(c.name+' '+c.id).toLowerCase().includes(q))}$('#geo-legend').textContent={country:'每种颜色表示一个开局国家；金色边线表示所选国家。',bloc:'同一国家集团同色；灰色为未加入集团。点击国家可查看集团领袖、成员和基础原则。',subjects:'宗主及其直接、间接附庸同色；独立国家各自着色。'}[mode]}
function populationPercent(n,total){const value=total?n/total*100:0;return value>0&&value<.01?'<0.01%':num(value)+'%'}
function populationSlices(o){
 const palette=['#537c63','#ba9052','#638fa5','#b86e62','#8c79a6','#91a65d','#c18ca0','#a6aaa0'];
 const entries=sorted(o).filter(([,n])=>n>0),grouped=entries.length>8;
 const slices=entries.slice(0,grouped?7:8).map(([id,count],i)=>({id,count,name:label(id),color:palette[i]}));
 if(grouped)slices.push({id:'other',count:entries.slice(7).reduce((sum,[,n])=>sum+n,0),name:`其他（${entries.length-7} 种）`,color:palette[7]});
 return slices;
}
function populationPie(slices,total,kind){
 let angle=-Math.PI/2;
 const title=kind==='culture'?'文化人口占比':'宗教人口占比';
 const sectors=slices.map((s,i)=>{
  const next=angle+s.count/total*Math.PI*2,start=[120+108*Math.cos(angle),120+108*Math.sin(angle)],end=[120+108*Math.cos(next),120+108*Math.sin(next)];
  const shape=slices.length===1?'circle cx="120" cy="120" r="108"':`path d="M120 120 L${start.join(' ')} A108 108 0 ${next-angle>Math.PI?1:0} 1 ${end.join(' ')} Z"`;
  angle=next;
  return `<${shape} fill="${s.color}" class="population-sector" data-slice="${i}" tabindex="0" role="button" aria-pressed="false" aria-label="${esc(s.name)}：${num(s.count)} 人，占 ${esc(populationPercent(s.count,total))}"><title>${esc(s.name)} · ${num(s.count)} 人 · ${esc(populationPercent(s.count,total))}</title></${slices.length===1?'circle':'path'}>`;
 }).join('');
 return `<figure class="population-chart"><figcaption><strong>${title}</strong><span>总人口 ${num(total)} 人</span></figcaption><div class="population-chart-body"><svg class="population-pie" viewBox="0 0 240 240" role="group" aria-label="${title}">${sectors}</svg><div class="population-legend">${slices.map((s,i)=>`<button type="button" data-slice="${i}" data-name="${esc(s.name)}" data-count="${s.count}" data-percent="${esc(populationPercent(s.count,total))}" aria-pressed="false"><span class="population-swatch" style="background:${s.color}"></span><span>${esc(s.name)}</span><b>${esc(populationPercent(s.count,total))}</b></button>`).join('')}</div></div><p class="population-readout" aria-live="polite">${esc(slices[0].name)} · ${num(slices[0].count)} 人 · ${esc(populationPercent(slices[0].count,total))}</p><p class="population-chart-help">悬停、点击或键盘选择查看人数${slices.some(s=>s.id==='other')?' · 其他项合并显示，完整分类见下方':''}</p></figure>`;
}
function composition(o,total,kind='culture'){
 const slices=populationSlices(o);
 if(!slices.length||!total)return '<p class="muted">无开局人口记录</p>';
 const colors=Object.fromEntries(slices.map(s=>[s.id,s.color]));
 return `<div class="population-composition" data-population-kind="${kind}">${populationPie(slices,total,kind)}<div class="population-breakdown">${sorted(o).map(([k,n])=>`<div class="culture-line"><div class="culture-caption"><span class="population-name">${kind==='culture'?`<span class="culture-symbol" aria-hidden="true">◈</span> <a href="cultures.html?culture=${encodeURIComponent(k)}">${esc(label(k))}</a>`:religionLink(k)}</span><span>${num(n)} · ${esc(populationPercent(n,total))}</span></div><div class="culture-bar"><i style="width:${n/total*100}%;background:${colors[k]||colors.other}"></i></div></div>`).join('')}</div></div>`;
}
function bindPopulationCharts(){
 document.querySelectorAll('.population-chart').forEach(chart=>{
  function choose(index){
   const entry=chart.querySelector(`.population-legend [data-slice="${index}"]`);
   chart.querySelectorAll('[data-slice]').forEach(el=>{const active=el.dataset.slice===index;el.classList.toggle('is-active',active);el.setAttribute('aria-pressed',String(active))});
   chart.querySelector('.population-readout').textContent=`${entry.dataset.name} · ${num(entry.dataset.count)} 人 · ${entry.dataset.percent}`;
  }
  chart.querySelectorAll('[data-slice]').forEach(el=>{
   el.addEventListener('pointerenter',()=>choose(el.dataset.slice));
   el.addEventListener('focus',()=>choose(el.dataset.slice));
   el.addEventListener('click',()=>choose(el.dataset.slice));
   if(el.tagName.toLowerCase()!=='button')el.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();choose(el.dataset.slice)}});
  });
 });
}
function tree(t,seen=new Set()){
  if(seen.has(t))return '';
  const next=new Set(seen);next.add(t);
  const subjects=(C[t]?.subjects||[]).filter(r=>!next.has(r.country));
  if(!subjects.length)return '';
  return `<ul class="geo-tree">${subjects.map(r=>{const children=(C[r.country]?.subjects||[]).filter(n=>!next.has(n.country)&&n.country!==r.country);return `<li class="relation-node"><div class="relation-node-heading">${link(r.country)}<span class="muted">${relationIcon(r.type)}${esc(label(r.type))}</span></div>${children.length?`<details class="relation-branch"><summary>下属附庸 · ${children.length} 国</summary>${tree(r.country,next)}</details>`:''}</li>`}).join('')}</ul>`;
}
function render(c){const totalLevels=Object.values(c.buildings).reduce((a,b)=>a+b,0),resources=Object.keys(M.resources);$('#country-detail').innerHTML=`<section class="panel geo-summary"><span class="pill">1836 开局 · 直属领土</span><h2>${esc(c.name)} <small class="muted">${esc(c.id)}</small></h2><div class="metrics"><div class="metric"><small>总人口</small><strong>${num(c.population)}</strong></div><div class="metric"><small>持有州 / 分割州</small><strong>${c.states.length}</strong></div><div class="metric"><small>显式开局建筑等级</small><strong>${num(totalLevels)}</strong></div><div class="metric"><small>直属附庸</small><strong>${c.subjects.length}</strong></div></div><nav class="geo-tabs"><a href="#geo-population">人口结构</a><a href="#geo-resources">全部资源</a><a href="#geo-laws">法律</a><a href="#geo-relations">集团与附庸</a></nav></section><section class="panel geo-section" id="geo-population"><h3>人口结构</h3><div class="geo-grid"><div><h4>文化 · ${Object.keys(c.cultures).length} 种</h4>${populationLaw(c,'lawgroup_citizenship')}${composition(c.cultures,c.population)}</div><div><h4>宗教</h4>${populationLaw(c,'lawgroup_church_and_state')}<p class="muted">未指定宗教的人口采用文化默认信仰。</p>${composition(c.religions,c.population,'religion')}</div></div></section><section class="panel geo-section" id="geo-resources"><h3>资源、建筑与军队</h3><p class="muted">完整州容量直接汇总；分割州按持有省份数量占比估算，不等同于运行时容量取整。耕地估算：${num(c.arable)}。</p>${resourcePanels(c)}<details><summary>逐州资源与占有比例 · ${c.states.length} 个州</summary>${table(['州','省份占比','整州已知资源（建筑等级）','整州未发现潜力'],c.states.map(p=>{const s=states[p.state];return [`<a href="map.html?state=${encodeURIComponent(s.id)}">${esc(s.name)}</a>`,num(p.share*100)+'%',sorted(s.resources).map(([k,n])=>esc(M.resources[k])+' '+num(n)).join('、')||'无',sorted(s.hidden).filter(([,n])=>n>0).map(([k,n])=>esc(M.resources[k])+' '+num(n)).join('、')||'无']}))}</details></section><section class="panel geo-section" id="geo-laws"><h3>开局法律</h3><p class="muted">历史设置优先；未写入国家历史的常规法律组按定义首项补全并标注。已展开开局政治模板及其国教、国家类型条件；其他默认补全为安装文件推定，未模拟其余条件脚本；种姓和江户制度仅在国家有显式设置时展示。修正案可展开查看说明、发起集团与冷却期；机构等级取开局显式投资设置，未记录时标为“未显式设定”，不等同于 0 级。</p>${lawColumns(c)}</section>${relationPanel(c)}`;bindCountryDetail();bindPopulationCharts();}
function select(t,focus=false){if(!C[t])return;selected=t;$('#country-select').value=t;$('#map-caption').textContent=C[t].name+' · '+num(C[t].population)+' 人';render(C[t]);$('#country-profile').innerHTML=countryProfile(C[t])+`<p><a href="characters.html?country=${encodeURIComponent(t)}">查看该国历史人物 ↗</a></p>`;paint();const url=new URL(location.href);url.searchParams.set('country',t);history.replaceState(null,'',url);if(focus)focusCountry();}
function apply(){if(view.w>M.width||view.h>M.height)view={x:0,y:0,w:M.width,h:M.height};view.x=Math.max(0,Math.min(M.width-view.w,view.x));view.y=Math.max(0,Math.min(M.height-view.h,view.y));svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);$('#scale-label').textContent=(M.width/view.w).toFixed(1)+'× · 滚轮缩放 / 拖动平移'}
function fit(){view={x:0,y:0,w:M.width,h:M.height};apply()}
function focusCountry(){const b=C[selected]?.bounds;if(!b)return;const ratio=svg.clientWidth/svg.clientHeight;let [x,y,w,h]=b;h=Math.max(h*1.25,w*1.25/ratio,120);w=h*ratio;view={x:x+b[2]/2-w/2,y:y+b[3]/2-h/2,w,h};apply()}
function zoom(f,at){const center=at||{x:view.x+view.w/2,y:view.y+view.h/2},w=Math.max(M.width/64,Math.min(M.width,view.w/f)),r=w/view.w;view={x:center.x-(center.x-view.x)*r,y:center.y-(center.y-view.y)*r,w,h:view.h*r};apply()}
const fragment=document.createDocumentFragment();for(const c of Object.values(C)){if(!c.path)continue;const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.id='country-'+c.id;p.dataset.country=c.id;p.setAttribute('d',c.path);p.setAttribute('class','country-shape');fragment.append(p)}$('#countries').append(fragment);
function options(){const q=$('#country-search').value.trim().toLowerCase(),list=Object.values(C).filter(c=>(c.name+' '+c.id).toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));$('#country-select').innerHTML='<option value="">选择国家…</option>'+list.map(c=>`<option value="${c.id}">${esc(c.name)} · ${c.id}</option>`).join('');if(list.some(c=>c.id===selected))$('#country-select').value=selected;$('#country-count').textContent=list.length+' / '+Object.keys(C).length+' 个政体';paint()}
svg.addEventListener('wheel',e=>{e.preventDefault();const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;zoom(e.deltaY<0?1.18:1/1.18,p.matrixTransform(svg.getScreenCTM().inverse()));$('#map-tooltip').hidden=true},{passive:false});
svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,view:{...view},scale:svg.getScreenCTM().a,country:e.target.dataset.country,moved:false};svg.setPointerCapture(e.pointerId);svg.classList.add('dragging')});
svg.addEventListener('pointermove',e=>{if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4)drag.moved=true;if(drag.moved){view={...drag.view,x:drag.view.x-dx/drag.scale,y:drag.view.y-dy/drag.scale};apply()}return}const t=e.target.dataset.country,tip=$('#map-tooltip');if(!t){tip.hidden=true;return}const rect=$('#viewport').getBoundingClientRect();tip.innerHTML=`<strong>${esc(C[t].name)}</strong><br>${num(C[t].population)} 人<br>点击查看国家档案`;tip.hidden=false;tip.style.left=Math.max(5,Math.min(e.clientX-rect.left+15,rect.width-tip.offsetWidth-8))+'px';tip.style.top=Math.max(5,Math.min(e.clientY-rect.top+15,rect.height-tip.offsetHeight-8))+'px'});
svg.addEventListener('pointerup',e=>{if(drag&&!drag.moved&&drag.country)select(drag.country);drag=null;svg.classList.remove('dragging');if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId)});svg.addEventListener('pointercancel',()=>{drag=null;svg.classList.remove('dragging')});svg.addEventListener('pointerleave',()=>$('#map-tooltip').hidden=true);
svg.addEventListener('keydown',e=>{if(['+','=','-','0','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.key==='0')fit();else if(e.key==='-')zoom(1/1.3);else if(['+','='].includes(e.key))zoom(1.3);else{view.x+=e.key==='ArrowLeft'?-view.w*.1:e.key==='ArrowRight'?view.w*.1:0;view.y+=e.key==='ArrowUp'?-view.h*.1:e.key==='ArrowDown'?view.h*.1:0;apply()}}});
$('#country-search').oninput=options;$('#country-select').onchange=e=>select(e.target.value);$('#geo-layer').onchange=paint;$('#focus-country').onclick=focusCountry;$('#zoom-in').onclick=()=>zoom(1.4);$('#zoom-out').onclick=()=>zoom(1/1.4);$('#fit').onclick=fit;
$('#export-country').onclick=()=>{if(!selected)return;const blob=new Blob([JSON.stringify({country:C[selected],blocs:C[selected].blocs.map(i=>G.blocs[i]),labels:G.labels,lawMeta:G.lawMeta,principleMeta:G.principleMeta,amendmentMeta:G.amendmentMeta,institutionMeta:G.institutionMeta,source:G.source},null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='1836-'+selected+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('#version').textContent=D.version;$('#geo-source').textContent=G.source;options();apply();select(new URLSearchParams(location.search).get('country')||'CHI');
