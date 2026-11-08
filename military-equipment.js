'use strict';
const equipment=window.V3_MILITARY_DATA;
function effectValue(effect,signed=true){
  const value=effect.value*(effect.percent?100:1),suffix=effect.percent?(effect.id.endsWith('_add')?' 个百分点':'%'):'';
  return (signed&&value>0?'+':'')+num(value)+suffix;
}
function effectTone(effect){if(effect.color==='neutral'||!effect.value)return '';return ((effect.value>0)===(effect.color==='good'))?'positive':'negative'}
function effectRows(effects){return `<dl class="military-effect-list">${effects.map(effect=>`<div><dt>${esc(effect.name)}</dt><dd class="${effectTone(effect)}">${esc(effectValue(effect))}</dd></div>`).join('')}</dl>`}
function goodsRows(costs,{signed=true}={}){
  if(!costs.length)return '<p class="muted">无额外商品需求</p>';
  return `<ul class="military-goods-list">${costs.map(cost=>{const good=window.V3_DATA.goods[cost.good],value=(signed&&cost.value>0?'+':'')+num(cost.value*(cost.mode==='mult'?100:1))+(cost.mode==='mult'?'%':'');return `<li><span>${good?.icon?`<img src="${esc(good.icon)}" alt="" loading="lazy">`:''}${esc(cost.name)}</span><strong>${esc(value)}</strong></li>`}).join('')}</ul>`;
}
function unitIdentityAndAttributes(unit){
  const meta=equipment.units[unit.id];
  const image=unit.profile||unit.icon?`<img class="unit-detail-hero" src="${esc(unit.profile||unit.icon)}" alt="${esc(unit.name)}">`:'';
  const identity=`<div class="unit-identity">${image}<span class="pill">${kindLabel(unit.kind)} · ${esc(meta?.groupName||(unit.kind==='army'?'兵种':'舰种'))}</span><h3>${esc(unit.name)}</h3><div class="unit-id">${esc(unit.id)}</div></div>`;
  if(!meta)return `${identity}<p class="muted">当前数据未包含该类型属性，请更新游戏数据。</p>`;
  const values=Object.fromEntries(meta.attributes.map(effect=>[effect.id,effect]));
  const keys=unit.kind==='army'?['unit_offense_add','unit_defense_add']:['ship_hull_damage_add','ship_armor_add','ship_hit_points_max_add','ship_crew_max_add'];
  const statNames={unit_offense_add:'攻击',unit_defense_add:'防御',ship_hull_damage_add:'船体伤害',ship_armor_add:'装甲',ship_hit_points_max_add:'舰体耐久',ship_crew_max_add:'最大船员'};
  const stats=keys.map(id=>({name:statNames[id],value:values[id]?effectValue(values[id],false):'—'}));
  if(unit.kind==='army')stats.push({name:'满编兵员上限',value:meta.maxManpower===null?'—':num(meta.maxManpower)+' 人'},{name:'补给容量',value:meta.supplyCapacity===null?'—':num(meta.supplyCapacity)});
  const remaining=meta.attributes.filter(effect=>!keys.includes(effect.id));
  return `<div class="unit-detail-top">${identity}<div class="unit-attributes"><h4>${unit.kind==='army'?'军队属性':'舰艇属性'}</h4><dl class="unit-attribute-grid">${stats.map(stat=>`<div><dt>${esc(stat.name)}</dt><dd>${esc(stat.value)}</dd></div>`).join('')}</dl><p class="muted">兵种定义基础值，未叠加国家、将领、装备改装与动员加成。</p></div></div><div class="unit-equipment-info"><p class="unit-unlocks"><strong>解锁科技：</strong>${meta.technologies.length?meta.technologies.map(tech=>esc(tech.name)).join(' / ')+(meta.technologies.length>1?'（任一）':''):'无显式科技门槛'}</p><div class="unit-base-goods"><h4>${unit.kind==='army'?'每营基础商品需求':'舰艇物资需求'}</h4>${goodsRows(meta.upkeep,{signed:false})}<p class="muted">定义基准用量；实际需求受规模、兵员及其他修正影响。</p></div>${remaining.length?`<details class="unit-other-attributes"><summary>其他${unit.kind==='army'?'军队':'舰艇'}属性 · ${remaining.length} 项</summary>${effectRows(remaining)}</details>`:''}${meta.construction.length?`<details class="unit-other-attributes"><summary>建造商品需求</summary>${goodsRows(meta.construction,{signed:false})}</details>`:''}${unit.kind==='army'?'<a class="unit-mobilization-link" href="#mobilization-options">查看补给、护理和支援装备的消耗与加成 ↓</a>':'<p class="muted">本版本动员选项适用于陆军；舰艇属性单独按舰种定义展示。</p>'}</div>`;
}
function mobilizationConditions(option){
  const lines=[];
  for(const [field,label] of [['technologies','科技'],['laws','法律'],['principles','集团原则']])if(option[field].length)lines.push(`${label}：${option[field].map(item=>esc(item.name)).join(' / ')}${option[field].length>1?'（任一）':''}`);
  if(!option.technologies.length)lines.push('无显式科技门槛');
  if(option.mandatory)lines.push('基础必需补给，不能关闭');
  if(option.conditions.requires.length)lines.push('须已启用：'+option.conditions.requires.map(id=>esc(equipment.options[id].name)).join('、'));
  if(option.conditions.excludes.length)lines.push('不能同时启用：'+option.conditions.excludes.map(id=>esc(equipment.options[id].name)).join('、'));
  if(option.conditions.market.length)lines.push('市场须具备潜在供应：'+option.conditions.market.map(id=>esc(window.V3_DATA.goods[id]?.name||id)).join('、'));
  return `<ul class="mobilization-conditions">${lines.map(line=>`<li>${line}</li>`).join('')}</ul>`;
}
function mobilizationCard(option){
  const fixed=option.costs.filter(cost=>cost.mode==='add'),multipliers=option.costs.filter(cost=>cost.mode==='mult');
  const stages={on_activate:'启用时',on_deactivate:'关闭时',on_activate_while_mobilized:'已动员时启用',on_deactivate_while_mobilized:'已动员时关闭'};
  const transitions=Object.entries(option.transitions).filter(([,effects])=>effects.length);
  return `<article class="mobilization-card" data-mobilization="${esc(option.id)}"><div class="mobilization-card-title">${option.icon?`<img src="${esc(option.icon)}" alt="" loading="lazy">`:''}<div><h4>${esc(option.name)}</h4><span class="muted">${option.mandatory?'基础必需 · ':''}${esc(equipment.groups[option.group].name)}</span></div></div><div class="mobilization-tradeoff"><div><h5>消耗什么</h5>${goodsRows(fixed)}${multipliers.length?`<h6>装备需求增幅</h6>${goodsRows(multipliers)}<p class="muted">按对应商品需求增加比例，不是固定增加件数。</p>`:''}</div><div><h5>得到什么</h5>${option.effects.length?effectRows(option.effects):'<p class="muted">提供基础动员补给，无额外战斗加成。</p>'}</div></div><div class="mobilization-requirements"><h5>解锁与使用条件</h5>${mobilizationConditions(option)}</div>${transitions.length?`<details class="mobilization-transitions"><summary>启停代价</summary>${transitions.map(([stage,effects])=>`<p><strong>${stages[stage]}：</strong>${effects.map(effect=>`${effect.stat==='morale'?'每营当前士气':'军队当前组织度'} ${effect.value>0?'+':''}${num(effect.value*100)}%`).join('；')}</p>`).join('')}</details>`:''}</article>`;
}
function renderMobilization(){
  const group=$('#mobilization-group').value,query=$('#mobilization-search').value.trim().toLowerCase();
  const options=Object.values(equipment.options).filter(option=>(!group||option.group===group)&&[option.name,option.id,equipment.groups[option.group].name,...option.technologies.map(t=>t.name),...option.principles.map(t=>t.name),...option.costs.map(c=>c.name),...option.effects.map(e=>e.name)].join(' ').toLowerCase().includes(query));
  $('#mobilization-count').textContent=`${options.length} / ${Object.keys(equipment.options).length} 项陆军动员选项`;
  $('#mobilization-list').innerHTML=Object.values(equipment.groups).map(group=>{const items=options.filter(option=>option.group===group.id);return items.length?`<section class="mobilization-group"><h3>${esc(group.name)} <small>${items.length} 项</small></h3><div class="mobilization-grid">${items.map(mobilizationCard).join('')}</div></section>`:''}).join('')||'<p class="empty">没有匹配的动员方案，可搜索“巧克力”“现代护理”或商品名称。</p>';
}
function initMilitaryEquipment(){
  $('#mobilization-group').innerHTML='<option value="">全部类别</option>'+Object.values(equipment.groups).map(group=>`<option value="${esc(group.id)}">${esc(group.name)}</option>`).join('');
  $('#mobilization-group').onchange=renderMobilization;$('#mobilization-search').oninput=renderMobilization;renderMobilization();
}
