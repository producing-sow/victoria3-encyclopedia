function geoIcon(src,alt=''){return src?`<img class="geo-icon" src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`:''}
function lawAmendments(c,group){
 const entries=c.amendments?.[group]||[];
 return `<div class="law-amendments"><small>修正案</small>${entries.length?entries.map(entry=>{
  const meta=G.amendmentMeta[entry.id];
  return `<details class="law-amendment"><summary>${esc(meta.name)}</summary><div class="law-amendment-body">${meta.description&&meta.description!==entry.id+'_desc'?`<p>${esc(meta.description)}</p>`:''}${entry.sponsorName?`<p>发起：${esc(entry.sponsorName)}</p>`:''}${entry.cooldown!==null?`<p>开局冷却：${num(entry.cooldown)} 个月</p>`:''}<span class="law-origin" title="${esc(entry.source)}">历史设置</span></div></details>`;
 }).join(''):'<span class="law-empty">无开局记录</span>'}</div>`;
}
function lawInstitution(c,group,meta){
 const id=meta.institution||G.groupMeta[group]?.institution;
 if(!id)return '';
 const institution=G.institutionMeta[id],record=c.institutions?.[id];
 const active=Boolean(meta.institution),known=active&&record!==undefined;
 return `<div class="law-institution"><small>机构等级</small><span class="institution-value${known?'':' is-unknown'}"${known?` title="${esc(record.source)}"`:''}>${known?`<b>${num(record.level)}</b> 级`:active?'未显式设定':'未设立'}</span><span class="institution-name">${esc(institution.name)}</span>${known?'<span class="law-origin">历史设置</span>':''}</div>`;
}
function lawCard(c,group,withDetails=false){const id=c.laws[group],meta=G.lawMeta[id];if(!meta)return '';return `<div class="geo-law-card${withDetails?' law-card-detailed':''}" data-law-group="${esc(group)}"><div class="law-identity">${geoIcon(meta.icon)}<div><small>${esc(label(group))}</small><strong><a href="laws.html?law=${encodeURIComponent(id)}&amp;country=${encodeURIComponent(c.id)}">${esc(meta.name)}</a></strong><span class="law-origin">${c.explicitLaws.includes(group)?'历史设置':'默认补全 · 定义首项'}</span></div></div>${withDetails?`<div class="law-extra">${lawAmendments(c,group)}${lawInstitution(c,group,meta)}</div>`:''}</div>`}
function lawColumns(c){return `<div class="law-columns">${[['power_structure','权力结构'],['economy','经济'],['human_rights','人权']].map(([cat,title])=>`<div><h4>${title}</h4>${Object.keys(G.groupMeta).filter(g=>G.groupMeta[g].category===cat&&c.laws[g]).map(g=>lawCard(c,g,true)).join('')}</div>`).join('')}</div>`}
function populationLaw(c,g){return `<div class="population-law">${lawCard(c,g)}</div>`}
function worldTotal(field,k){return Object.values(C).reduce((n,c)=>n+(c[field]?.[k]||0),0)}
function share(n,total){return total?num(n/total*100)+'%':'—'}
function buildingLink(k){return `<a class="geo-building-link" href="index.html?building=${encodeURIComponent(k)}">${art(k)}${esc(buildings[k]?.name||label(k))}</a>`}
function buildingSortValues(c,keys,resources=false){return keys.map(k=>{const n=c.buildings[k]||0,total=worldTotal('buildings',k);return [null,n,total?n/total:null,...(resources?[c.resources[k]||0,c.hidden[k]||0]:[])]})}
function compareGeoSortValues(a,b,ascending){
  if(a===null||b===null)return a===b?0:a===null?1:-1;
  return (a-b)*(ascending?1:-1);
}
function bindGeoTableSorting(){
  document.querySelectorAll('#country-detail .geo-sortable-table').forEach(table=>{
    const body=table.tBodies[0],rows=[...body.rows],buttons=[...table.querySelectorAll('[data-geo-sort-col]')];
    let active=-1,ascending=false;
    buttons.forEach(button=>button.onclick=()=>{
      const column=Number(button.dataset.geoSortCol);
      ascending=active===column?!ascending:false;active=column;
      const ordered=rows.map((row,index)=>{const value=row.cells[column].dataset.sortValue;return {row,index,value:value===''?null:Number(value)}});
      ordered.sort((a,b)=>compareGeoSortValues(a.value,b.value,ascending)||a.index-b.index);
      body.append(...ordered.map(item=>item.row));
      buttons.forEach(control=>{
        const selected=Number(control.dataset.geoSortCol)===active,next=selected&&!ascending?'从小到大':'从大到小';
        control.closest('th').setAttribute('aria-sort',selected?(ascending?'ascending':'descending'):'none');
        const name=control.textContent.replace(/[↕↑↓]/g,'').trim();
        control.querySelector('span').textContent=selected?(ascending?' ↑':' ↓'):' ↕';
        control.setAttribute('aria-label',`${name}：点击${next}排序`);
      });
      table.closest('.tablewrap').scrollTop=0;
    });
  });
}
const geoIndustryScope={resources:false,buildings:false};
function industryCountries(c,includeSubjects=false){const seen=new Set(),result=[];function walk(id){if(seen.has(id)||!C[id])return;seen.add(id);result.push(C[id]);if(includeSubjects)for(const relation of C[id].subjects||[])walk(relation.country)}walk(c.id);return result}
function industryAggregate(c,includeSubjects=false){const members=industryCountries(c,includeSubjects),result={buildings:{},resources:{},hidden:{},arable:0,members:members.map(c=>c.id)};for(const country of members){result.arable+=country.arable||0;for(const field of ['buildings','resources','hidden'])for(const [key,n] of Object.entries(country[field]||{}))result[field][key]=(result[field][key]||0)+n}return result}
function worldResourceTotal(field,key){return M.states.reduce((sum,state)=>sum+(state[field]?.[key]||0),0)}
function industryTables(c){const resourceKeys=Object.keys(M.resources),r=industryAggregate(c,geoIndustryScope.resources),b=industryAggregate(c,geoIndustryScope.buildings),other=sorted(b.buildings).filter(([k])=>!resourceKeys.includes(k));
 const scope=(kind,data)=>`<div class="geo-industry-heading"><h4>${kind==='resources'?'资源建筑':'其他建筑'}</h4><label class="geo-subject-option"><input type="checkbox" data-industry-subjects="${kind}" ${geoIndustryScope[kind]?'checked':''}><span>包括直属及间接附属国</span></label></div><p class="muted geo-industry-caption">${geoIndustryScope[kind]?'本国及附属国':'仅本国直属领土'} · ${data.members.length} 国${kind==='resources'?' · 耕地估算 '+num(data.arable):''}</p>`;
 const resourceValues=resourceKeys.map(k=>{const levels=r.buildings[k]||0,capacity=r.resources[k]||0,hidden=r.hidden[k]||0,worldLevels=worldTotal('buildings',k),worldCapacity=worldResourceTotal('resources',k),worldHidden=worldResourceTotal('hidden',k);return [null,levels,worldLevels?levels/worldLevels:null,capacity,worldCapacity?capacity/worldCapacity:null,hidden,worldHidden?hidden/worldHidden:null]});
 return `<div>${scope('resources',r)}${table(['资源','开局等级','等级世界占比','已知容量¹','容量世界占比','未发现¹','未发现世界占比'],resourceKeys.map(k=>[buildingLink(k),num(r.buildings[k]),share(r.buildings[k]||0,worldTotal('buildings',k)),num(r.resources[k]),share(r.resources[k]||0,worldResourceTotal('resources',k)),num(r.hidden[k]),share(r.hidden[k]||0,worldResourceTotal('hidden',k))]),resourceValues)}</div><div>${scope('buildings',b)}${table(['建筑','开局等级','等级世界占比'],other.map(([k,n])=>[buildingLink(k),num(n),share(n,worldTotal('buildings',k))]),buildingSortValues(b,other.map(([k])=>k)))}</div>`
}
function bindIndustryScope(c){document.querySelectorAll('[data-industry-subjects]').forEach(input=>input.onchange=()=>{geoIndustryScope[input.dataset.industrySubjects]=input.checked;$('#geo-industry-stats').innerHTML=industryTables(c);bindIndustryScope(c);bindGeoTableSorting()})}
function resourcePanels(c){return `<div class="industry-columns"><div id="geo-industry-stats">${industryTables(c)}</div><div class="military-section">${militaryPanel(c)}</div></div><p class="muted">等级世界占比＝统计范围内该类型开局等级 / 全球同类型开局等级；容量与未发现占比分别以全球完整州已知容量、未发现储量为分母，包含未归属国家的州。全球总量为 0 时显示 —。¹ 分割州容量按持有省份数量占比估算。附属国选项仅影响上方两张表，军队仍为本国开局记录。</p><details><summary>本国直属领土 · 逐州建筑与生产方式明细</summary>${table(['州','建筑','等级','生产方式'],c.buildingRows.map(r=>[esc(states[r.state]?.name||r.state),buildingLink(r.building),num(r.levels),r.methods.map(methodChip).join('')]))}</details>`}

function countryBadge(t){const c=C[t];if(!c?.path||!c.bounds)return '';const [x,y,w,h]=c.bounds,p=Math.max(w,h)*.06;return `<svg class="country-badge" viewBox="${x-p} ${y-p} ${w+2*p} ${h+2*p}" role="img" aria-label="${esc(c.name)}国土徽标"><path d="${c.path}" fill="${color(t)}"/></svg>`}
function relationIcon(type){return `<span class="relation-icon" title="${esc(label(type))}" aria-hidden="true">${{personal_union:'♛',colony:'⚑',chartered_company:'⚓',tributary:'◇',protectorate:'♜',puppet:'◆',dominion:'◈',vassal:'♟'}[type]||'◇'}</span>`}
function relatedCountries(c){const ids=new Set([c.id]),visited=new Set();for(const i of c.blocs)for(const t of G.blocs[i].members)ids.add(t);if(c.overlord)ids.add(c.overlord.country);function walk(t){if(visited.has(t))return;visited.add(t);for(const r of C[t]?.subjects||[]){ids.add(r.country);walk(r.country)}}walk(c.id);return ids}
function relationMap(c){
  const ids=relatedCountries(c),bounds=[...ids].map(t=>C[t]?.bounds).filter(Boolean);
  if(!bounds.length)return '<div class="relation-map-wrap"><h4>集团与附庸分布</h4><p class="muted">暂无可显示的领土数据。</p></div>';
  const x=Math.min(...bounds.map(b=>b[0])),y=Math.min(...bounds.map(b=>b[1])),right=Math.max(...bounds.map(b=>b[0]+b[2])),bottom=Math.max(...bounds.map(b=>b[1]+b[3])),pad=Math.max(right-x,bottom-y)*.08+20;
  return `<div class="relation-map-wrap"><div class="relation-map-heading"><h4>集团与附庸分布</h4><span class="muted" id="relation-map-scale">1.0×</span></div><div class="relation-map-viewport"><svg id="relation-mini-map" viewBox="${x-pad} ${y-pad} ${right-x+pad*2} ${bottom-y+pad*2}" tabindex="0" role="group" aria-label="集团与附庸关系小地图" aria-describedby="relation-map-help"><image href="assets/world-paper.jpg" width="8192" height="3616"/>${Object.values(C).filter(n=>n.path).map(n=>`<path d="${n.path}" data-country="${n.id}" tabindex="0" role="button" aria-label="查看${esc(n.name)}" fill="${ids.has(n.id)?color(n.id):'#c8cabe'}" fill-opacity="${ids.has(n.id)?.9:.25}" stroke="${n.id===c.id?'#fff0a0':'#526959'}" stroke-width="${n.id===c.id?2:.4}" vector-effect="non-scaling-stroke"><title>${esc(n.name)} · ${ids.has(n.id)?'当前关系成员':'其他国家'} · 点击查看档案</title></path>`).join('')}</svg><div class="map-tools" aria-label="小地图控制"><button type="button" data-relation-map="in" aria-label="放大小地图">＋</button><button type="button" data-relation-map="out" aria-label="缩小小地图">−</button><button type="button" data-relation-map="reset">关系全览</button><button type="button" data-relation-map="country">定位所选</button></div></div><p class="muted" id="relation-map-help">滚轮缩放 · 拖动平移 · 点击国家查看档案<br>彩色：关系成员；金边：所选国家。键盘 + / − 缩放，方向键平移，0 复位。</p></div>`;
}
function relationPanel(c){return `<section class="panel geo-section" id="geo-relations"><h3>国家集团与附庸结构</h3><div class="relations-layout"><div class="relations-info"><div class="relation-blocs"><h4>国家集团</h4>${c.blocs.map(i=>{const b=G.blocs[i];return `<article><h4>${esc(b.name)}</h4><p>领袖：${link(b.leader)}</p><p>集团认同：${esc(b.identity)}</p><details class="relation-principles"><summary>开局原则 · ${b.principles.length} 项基础${b.conditionalPrinciples?.length?` + ${b.conditionalPrinciples.length} 项条件追加`:""}</summary>${principleCards(b.principles)}${(b.conditionalPrinciples||[]).map(entry=>`<div class="conditional-principle"><p class="principle-condition" title="${esc(entry.source)}">${esc(entry.condition)}</p>${principleCards([entry.id])}</div>`).join("")}</details><details class="relation-members" open><summary>集团成员 · ${b.members.length} 国</summary><div class="relation-chips">${b.members.map(link).join('')}</div></details></article>`}).join('')||'<p class="muted">未加入初始国家集团</p>'}</div><div class="relation-subjects"><h4>宗主与附庸</h4><p>${c.overlord?'宗主：'+link(c.overlord.country)+' · '+esc(label(c.overlord.type)):'独立国家 / 无开局宗主记录'}</p><div class="relation-root">${link(c.id)}<span class="muted">所选国家</span></div>${c.subjects.length?`<details class="relation-branch relation-root-branch" open><summary>直属附庸 · ${c.subjects.length} 国</summary><div class="relation-tree-actions"><button type="button" data-relations-expand="true">展开全部层级</button><button type="button" data-relations-expand="false">收起全部层级</button></div>${tree(c.id)}</details>`:'<p class="muted">无直属附庸</p>'}</div></div>${relationMap(c)}</div></section>`}
function bindRelationMap(){
  const map=$('#relation-mini-map');if(!map)return;
  const initial=map.getAttribute('viewBox').split(/\s+/).map(Number),home={x:initial[0],y:initial[1],w:initial[2],h:initial[3]};
  let box={...home},pan=null,suppressClick=false;
  const apply=()=>{map.setAttribute('viewBox',`${box.x} ${box.y} ${box.w} ${box.h}`);$('#relation-map-scale').textContent=(home.w/box.w).toFixed(1)+'×'};
  const point=e=>{const p=map.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(map.getScreenCTM().inverse())};
  const zoom=(factor,at={x:box.x+box.w/2,y:box.y+box.h/2})=>{const w=Math.max(Math.min(home.w,M.width/128),Math.min(Math.max(home.w,M.width*1.2),box.w/factor)),r=w/box.w;box={x:at.x-(at.x-box.x)*r,y:at.y-(at.y-box.y)*r,w,h:box.h*r};apply()};
  const reset=()=>{box={...home};apply()};
  const focus=()=>{const b=C[selected]?.bounds;if(!b)return;const ratio=map.clientWidth/map.clientHeight,h=Math.max(b[3]*1.3,b[2]*1.3/ratio,40),w=h*ratio;box={x:b[0]+b[2]/2-w/2,y:b[1]+b[3]/2-h/2,w,h};apply()};
  map.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.18:1/1.18,point(e))},{passive:false});
  map.addEventListener('pointerdown',e=>{if(e.button!==0||pan)return;suppressClick=false;pan={id:e.pointerId,x:e.clientX,y:e.clientY,box:{...box},scale:map.getScreenCTM().a,moved:false};map.setPointerCapture(e.pointerId)});
  map.addEventListener('pointermove',e=>{if(!pan||pan.id!==e.pointerId)return;const dx=e.clientX-pan.x,dy=e.clientY-pan.y;if(Math.hypot(dx,dy)>4)pan.moved=true;if(pan.moved){box={...pan.box,x:pan.box.x-dx/pan.scale,y:pan.box.y-dy/pan.scale};map.classList.add('dragging');apply()}});
  const end=e=>{if(!pan||pan.id!==e.pointerId)return;suppressClick=pan.moved||e.type==='pointercancel';pan=null;map.classList.remove('dragging');if(map.hasPointerCapture(e.pointerId))map.releasePointerCapture(e.pointerId)};
  // Select on pointerup: pointer capture retargets the subsequent click to the SVG.
  map.addEventListener('pointerup',e=>{const country=pan&&!pan.moved?document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-country]'):null;end(e);if(country&&map.contains(country)&&!suppressClick){suppressClick=true;selectRelationCountry(country.dataset.country)}});
  map.addEventListener('pointercancel',end);map.addEventListener('lostpointercapture',end);
  map.addEventListener('click',e=>{if(suppressClick){suppressClick=false;return}const t=e.target.closest('[data-country]');if(t)selectRelationCountry(t.dataset.country)});
  map.addEventListener('keydown',e=>{const t=e.target.closest('[data-country]');if(t&&['Enter',' '].includes(e.key)){e.preventDefault();selectRelationCountry(t.dataset.country);return}if(['+','=','-','0','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(['0','Home'].includes(e.key))reset();else if(e.key==='-')zoom(1/1.3);else if(['+','='].includes(e.key))zoom(1.3);else{box.x+=e.key==='ArrowLeft'?-box.w*.1:e.key==='ArrowRight'?box.w*.1:0;box.y+=e.key==='ArrowUp'?-box.h*.1:e.key==='ArrowDown'?box.h*.1:0;apply()}}});
  document.querySelectorAll('[data-relation-map]').forEach(button=>button.onclick=()=>({in:()=>zoom(1.4),out:()=>zoom(1/1.4),reset,country:focus})[button.dataset.relationMap]());
}
function selectRelationCountry(t){select(t,true);$('#geo-relations').scrollIntoView({block:'start'})}
function bindCountryDetail(){
  bindIndustryScope(C[selected]);
  bindGeoTableSorting();
  document.querySelectorAll('#country-detail button[data-country]').forEach(el=>el.onclick=()=>el.closest('#geo-relations')?selectRelationCountry(el.dataset.country):select(el.dataset.country,true));
  document.querySelectorAll('[data-relations-expand]').forEach(el=>el.onclick=()=>document.querySelectorAll('.relation-root-branch .relation-branch').forEach(branch=>branch.open=el.dataset.relationsExpand==='true'));
  bindRelationMap();
}

function methodChip(k){const m=D.methods[k];return `<span class="method-chip">${geoIcon(m?.icon)}<span>${esc(m?.name||k)}</span></span>`}
function unitName(k){const m=G.unitMeta[k];return `<span class="military-unit">${geoIcon(m?.profile||m?.icon)}<span>${esc(m?.name||label(k))}</span></span>`}
function militarySummary(c,kind){const rows=sorted(c.military).filter(([k])=>c.militaryKinds[k]===kind);return `<h4>${kind==='army'?'陆军 · 营':'海军 · 艘'}</h4>${rows.length?table([kind==='army'?'兵种':'舰种','开局','世界占比'],rows.map(([k,n])=>[unitName(k),num(n),share(n,worldTotal('military',k))])):`<p class="muted">无显式开局${kind==='army'?'陆军':'舰艇'}记录</p>`}`}
function formationCard(f){const n=Object.values(f.units).reduce((a,b)=>a+b,0);return `<article class="formation-card" data-formation-kind="${esc(f.kind)}"><header><h5>${esc(f.name)}</h5><strong>${num(n)} ${f.kind==='army'?'营':'艘'}</strong></header><p class="muted">总部：${esc(f.hq||'未指定')}</p>${table([f.kind==='army'?'下辖兵种':'舰艇类型',f.kind==='army'?'营数':'艘数'],sorted(f.units).map(([k,n])=>[unitName(k),num(n)]))}${f.ships.length?`<details><summary>指定舰名 · ${f.ships.length} 条记录</summary><ul>${f.ships.map(s=>`<li>${esc(s.name)} · ${esc(G.unitMeta[s.type]?.name||label(s.type))}</li>`).join('')}</ul></details>`:''}${!n?'<p class="muted">编制已定义，未指定开局单位。</p>':''}</article>`}
function militaryPanel(c){return `<h4>开局军队与舰队</h4><div class="military-layout"><div class="military-summary">${militarySummary(c,'army')}${militarySummary(c,'fleet')}</div><div class="formation-details"><h4>陆军编制 · ${c.formations.filter(f=>f.kind==='army').length} 支</h4><div class="formation-grid">${c.formations.filter(f=>f.kind==='army').map(formationCard).join('')||'<p class="muted">无开局陆军编制记录</p>'}</div><h4>海军舰队 · ${c.formations.filter(f=>f.kind==='fleet').length} 支</h4><div class="formation-grid">${c.formations.filter(f=>f.kind==='fleet').map(formationCard).join('')||'<p class="muted">无开局舰队记录</p>'}</div></div></div>`}
function principleCards(ids){return `<div class="principle-slots">${ids.map(id=>{const p=G.principleMeta[id];if(!p)return '';const roman=['','Ⅰ','Ⅱ','Ⅲ'][p.level]||p.level;return `<article class="principle-card"><div class="principle-art" style="background-image:url('${esc(p.background)}')">${geoIcon(p.icon)}<span>${roman}</span></div><div><strong>${esc(p.name)} ${roman}</strong><p class="muted">${esc(p.description)}</p>${p.effects.map(e=>{const v=Number(e.value),value=e.value==='yes'?'启用':e.value==='no'?'禁用':Number.isFinite(v)?(v>0?'+':'')+num(v*(e.percent?100:1))+(e.percent?'%':''):e.value;return `<p class="principle-effect"><span>${{member_modifier:'成员',leader_modifier:'领袖',participant_modifier:'全体',power_bloc_modifier:'集团',institution_modifier:`${e.institution||'机构'} · 每级`}[e.scope]} · ${esc(e.name)}</span><strong>${esc(value)}</strong></p>`}).join('')}</div></article>`}).join('')||'<p class="muted">无基础原则记录</p>'}</div>`}
function religionLink(k){return `<a class="profile-inline-link" href="religions.html?religion=${encodeURIComponent(k)}">${geoIcon(G.religionMeta[k]?.icon)}${esc(G.religionMeta[k]?.name||label(k))}</a>`}
function profileFlag(c){if(c.id==='JAP'&&c.profile.government)return `<svg class="profile-flag" viewBox="0 0 150 100" role="img" aria-label="德川幕府旗"><rect width="150" height="100" fill="#fff"/><rect y="34" width="150" height="32" fill="#111"/></svg>`;return `<span class="profile-country-emblem" title="国土徽标">${countryBadge(c.id)}</span>`}
function countryProfile(c){const p=c.profile,army=c.formations.filter(f=>f.kind==='army').reduce((n,f)=>n+Object.values(f.units).reduce((a,b)=>a+b,0),0),navy=c.formations.filter(f=>f.kind==='fleet').reduce((n,f)=>n+Object.values(f.units).reduce((a,b)=>a+b,0),0),cultures=p.primaryCultures.map(k=>`<a href="cultures.html?culture=${encodeURIComponent(k)}">${esc(label(k))}</a>`).join('、'),capital=states[p.capital];const fallback=`${c.name}是1836年开局的${p.recognition}，直属领土包含${c.states.length}个州或分割州，人口${num(c.population)}人。${c.overlord?'宗主为'+C[c.overlord.country]?.name+'。':c.subjects.length?'下辖'+c.subjects.length+'个直属附庸。':'无开局宗主及直属附庸记录。'}`;return `<div class="profile-date">1836年1月1日 · 开局档案</div><header class="profile-title">${profileFlag(c)}<div><h2>${esc(c.name)}</h2><span>${esc(p.recognition)}</span></div></header><div class="profile-forces"><a href="#geo-resources">⚔ ${num(army)} <small>营</small></a><a href="#geo-resources">⚓ ${num(navy)} <small>艘</small></a></div><dl class="profile-facts"><div><dt>人口</dt><dd><a href="#geo-population">${num(c.population)}</a></dd></div><div><dt>${p.government?'政府':'治理原则'}</dt><dd><a href="#geo-laws">${esc(p.government||label(c.laws.lawgroup_governance_principles)||'未记录')}</a></dd></div><div><dt>主体文化</dt><dd>${cultures||'未记录'}</dd></div><div><dt>国教</dt><dd>${p.religion?religionLink(p.religion):'未记录'}<small class="profile-origin">${esc(p.religionSource)}</small></dd></div><div><dt>耕地容量¹</dt><dd><a href="#geo-resources">${num(c.arable)}</a></dd></div><div><dt>首都州</dt><dd>${capital?`<a href="map.html?state=${encodeURIComponent(capital.id)}">${esc(capital.name)}</a>`:'未记录'}</dd></div></dl><p class="profile-runtime">GDP、识字率、生活水平与威望排名需游戏运行后计算，当前未读取开局存档。</p><section class="country-introduction"><h3>${p.description?'国家简介':'开局概况'}</h3><p>${esc(p.description||fallback)}</p><small class="muted">${p.description?'游戏原版国家简介':'根据本页开局数据生成的简述'} · ¹ 分割州耕地按省份占比估算</small></section>`}
