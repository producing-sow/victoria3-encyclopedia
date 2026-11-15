/* Resource variants share geometry and population; resource overrides never mutate base data. */
(()=>{
 const base=window.V3_MAP,mod=window.V3_REAL_RESOURCES;
 const requested=new URLSearchParams(location.search).get('dataset')==='real-resources'?'real-resources':'vanilla';
 function dataFor(version){
  if(version!=='real-resources'||!mod)return base;
  return {...base,states:base.states.map(s=>({...s,...(mod.states[s.id]||{})})),resources:{...base.resources,...mod.resources},farms:{...base.farms,...mod.farms},traits:{...base.traits,...mod.traits},variant:mod.metadata};
 }
 function render(version){
  const active=version==='real-resources',meta=mod?.metadata;
  const english=window.V3I18n?.language==='en';
  const credit=document.querySelector('#map-mod-credit');
  credit.hidden=!active;credit.replaceChildren();
  if(active){
   credit.innerHTML=window.V3ModCredits.markup('real-resources');
  }
  document.querySelectorAll('[data-map-version]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.mapVersion===version));button.classList.toggle('active',button.dataset.mapVersion===version);button.disabled=button.dataset.mapVersion==='real-resources'&&!mod});
  document.querySelector('#map-version-status').textContent=english?(active?'Real Resources MOD · Explorable Real-World Resources':'Base game · No MOD overrides'):(active?'真实资源 MOD · Explorable Real-World Resources':'原版 · 未加载 MOD 修改');
  document.querySelector('#map-version-description').textContent=english?(active?`The MOD overrides resources, arable land, farm types and traits in ${meta.overriddenStates} state regions. Known and undiscovered capacities are listed separately; include undiscovered potential to view total deposits. Population, cultures and borders use base-game data. Events and workforce rules are not simulated.`:'Base-game data. Switching versions updates the map, state details, rankings and exports.'):(active?`MOD 覆盖 ${meta.overriddenStates} 个完整州的资源、耕地、农牧业与州特质。已发现和未发现分列；勾选“计入未发现潜力”查看总储量。人口、文化与边界沿用原版；不模拟事件或劳动力规则。`:'使用原版游戏数据。切换版本后，地图、州详情、资源排行和导出同步更新。');
  document.querySelector('#map-version-source').hidden=!active;
  document.querySelector('#map-version-source').textContent=active?(english?`Workshop ID: ${meta.workshopId} · Base dataset: ${meta.baseVersion}`:`创意工坊 ID：${meta.workshopId} · 对照游戏版本：${meta.baseVersion}`):'';
  document.querySelector('#map-source').textContent=active?`${meta.source} · ${base.populationSource}`:`${base.source} · ${base.populationSource}`;
  // Version history only contains base-game snapshots.
  document.querySelector('header .compare-entry').hidden=active;
 }
 window.V3MapVersions={requested,dataFor,render};
 document.addEventListener('DOMContentLoaded',()=>{
  render(requested==='real-resources'&&mod?requested:'vanilla');
  document.querySelectorAll('[data-map-version]').forEach(button=>button.addEventListener('click',()=>window.V3Atlas.setVersion(button.dataset.mapVersion)));
 });
})();
