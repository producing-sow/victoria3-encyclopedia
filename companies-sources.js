function companyRegion(key){return C.regions?.[key]||regions[key]||key}
function companyChangeLabel(change){return {added:'MOD 新增',override:'覆盖原版',missing_target:'替换目标未找到'}[change]||''}
function renderCompanySource(){
  const isMod=activeCompanySource==='more-companies',meta=C.meta;
  document.querySelectorAll('[data-company-source]').forEach(button=>{button.classList.toggle('active',button.dataset.companySource===activeCompanySource);button.setAttribute('aria-pressed',String(button.dataset.companySource===activeCompanySource));button.disabled=!companySources[button.dataset.companySource]});
  $('#company-change').hidden=!isMod;
  const credit=$('#company-mod-credit');if(credit){credit.hidden=!isMod;credit.innerHTML=isMod?(window.V3ModCredits?.markup('more-companies')||''):''}
  $('#company-source-note').innerHTML=isMod?`<strong>更多公司 · ${esc(meta.name)}</strong><span>${C.companies.length} 家 MOD 定义：新增 ${meta.stats.added} 家，覆盖原版 ${meta.stats.override} 家${meta.stats.missing_target?`，替换目标未找到 ${meta.stats.missing_target} 家`:''}。</span><span>汉化：${esc(meta.translationName)}；同名公司使用本页 MOD 定义。<a href="https://steamcommunity.com/sharedfiles/filedetails/?id=${meta.modId}" target="_blank" rel="noopener">MOD 本体 ↗</a> · <a href="https://steamcommunity.com/sharedfiles/filedetails/?id=${meta.translationId}" target="_blank" rel="noopener">汉化包 ↗</a></span>`:'<strong>原版公司图鉴</strong><span>仅显示本机原版定义，包含官方 DLC 公司。切换到“更多公司 MOD”查看新增和修改内容。</span>';
  $('#company-footer').textContent=isMod?'按指定 MOD 本体与汉化包提取，未改动原版图鉴。条件限定、事件和其他 MOD 兼容检查保留原定义；不代表当前存档已启用或满足成立条件。':'按本机原版定义展示，包含 DLC / 条件限定公司。条件树保留逻辑关系；未读取存档，不代表当前国家可立即成立。';
}
function companyOrigin(company){
  if(activeCompanySource==='vanilla')return '<div class="company-origin"><span>原版</span></div>';
  const translated=window.V3I18n?.language!=='en'&&company.nameTranslated;
  return `<div class="company-origin is-mod"><span>更多公司 MOD</span><span>${companyChangeLabel(company.changeType)}</span>${translated?'<span>汉化包名称</span>':''}${!translated&&window.V3I18n?.language!=='en'&&company.nameSource==='mod'?'<span>未覆盖汉化 · 使用本体原名</span>':''}</div>${company.changeType==='override'?`<p class="muted">此条目替换原版同 ID 公司。<a href="companies.html?source=vanilla&company=${encodeURIComponent(company.id)}">查看原版定义 ↗</a></p>`:''}${company.changeType==='missing_target'?'<p class="note">本 MOD 使用 TRY_REPLACE，但当前原版图鉴没有对应 ID；此条保留供核对，不计为可直接生效的新增公司。</p>':''}`;
}
function scriptedCompanyConditions(company){
  if(!C.scriptedTriggers)return '';
  const found=new Set();
  function visit(entries){for(const [key,,value] of entries){if(C.scriptedTriggers[key]&&!found.has(key)){found.add(key);visit(C.scriptedTriggers[key])}if(Array.isArray(value))visit(value)}}
  Object.values(company.conditions).forEach(visit);
  return found.size?`<section class="company-section"><h3>引用的脚本条件</h3><p class="muted">以下为引用内容，供核对含义；判断仍遵循上方原条件中的 yes/no、NOT、OR 等关系。</p>${[...found].map(key=>`<details><summary>${esc(label(key))}</summary>${tree(C.scriptedTriggers[key])}</details>`).join('')}</section>`:'';
}
function switchCompanySource(source){
  if(!companySources[source]||source===activeCompanySource)return;
  activeCompanySource=source;C=companySources[source];current=C.companies[0];activeIndustrySector='';
  for(const id of ['company-search','company-kind','company-prestige','company-change'])$('#'+id).value='';
  industryKeys=[...new Set(C.companies.flatMap(c=>[...c.buildings,...c.extensions]))];
  $('#company-region').innerHTML='<option value="">全部定义地区 / 扩展</option>'+[...new Set(C.companies.map(c=>c.region))].map(key=>`<option value="${esc(key)}">${esc(companyRegion(key))}</option>`).join('');
  $('#company-building').innerHTML='<option value="">全部相关行业</option>'+industryKeys.sort((a,b)=>label(a).localeCompare(label(b),'zh-CN')).map(key=>`<option value="${esc(key)}">${esc(label(key))}</option>`).join('');
  $('#company-region').value='';$('#company-building').value='';render();$('#company-list').scrollTop=0;
  if(typeof location!=='undefined'&&typeof history!=='undefined'){const url=new URL(location.href);url.searchParams.set('source',source);url.searchParams.delete('company');history.replaceState(null,'',url)}
}
