const fs=require('fs'),vm=require('vm'),assert=require('assert');
const elements=new Map(),el=selector=>{if(!elements.has(selector))elements.set(selector,{value:'',innerHTML:'',textContent:'',hidden:false,addEventListener(){}});return elements.get(selector)};
const context={window:{},document:{querySelector:el,querySelectorAll:()=>[]},console};vm.createContext(context);
for(const file of ['data.js','companies-data.js','mod-companies-data.js','companies-sources.js','companies.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const run=s=>vm.runInContext(s,context),base=context.window.V3_COMPANIES,mod=context.window.V3_MOD_COMPANIES,original=JSON.stringify(base);
assert.equal(mod.companies.length,923);assert.equal(new Set(mod.companies.map(c=>c.id)).size,923);
assert.equal(mod.meta.stats.added,692);assert.equal(mod.meta.stats.override,231);assert.equal(mod.meta.stats.missing_target,0);
assert.equal(mod.meta.missingAssets.length,0);assert.equal(mod.meta.duplicates.length,0);
const baseIds=new Set(base.companies.map(c=>c.id));
for(const c of mod.companies){
  assert.equal(baseIds.has(c.id),c.changeType==='override',c.id);assert.notEqual(c.name,c.id);assert(fs.existsSync(c.icon));assert(fs.existsSync(c.background));
  for(const id of c.prestige){assert(mod.prestigeGoods[id]?.icon,id);assert(fs.existsSync(mod.prestigeGoods[id].icon))}
  for(const [id,op,v] of c.prosperity){assert.equal(op,'=');assert.notEqual(v,null);assert(Number.isFinite(Number(v)));assert(mod.labels[id]);assert(!/[\[\]$]/.test(mod.labels[id]),id)}
}
run("switchCompanySource('more-companies')");assert.equal(run('results().length'),923);assert.equal(el('#company-change').hidden,false);
run("document.querySelector('#company-change').value='added'");assert.equal(run('results().length'),692);
run("document.querySelector('#company-change').value='override'");assert.equal(run('results().length'),231);
run("document.querySelector('#company-change').value='';document.querySelector('#company-region').value='China';document.querySelector('#company-search').value='瑞蚨祥';render()");assert.equal(run('results().length'),1);assert(el('#company-detail').innerHTML.includes('MOD 新增'));
run("document.querySelector('#company-search').value='开平';render()");assert.equal(run('results().length'),1);assert(el('#company-detail').innerHTML.includes('source=vanilla&amp;')||el('#company-detail').innerHTML.includes('source=vanilla&company=company_kaiping_mining'));
const changed=mod.companies.find(c=>c.id==='company_kaiping_mining'),vanilla=base.companies.find(c=>c.id===changed.id);assert.notStrictEqual(changed,vanilla);assert.equal(changed.changeType,'override');assert.equal(changed.operation,'TRY_REPLACE');assert(changed.source.endsWith('_China.txt'));
run("document.querySelector('#company-search').value='';document.querySelector('#company-region').value='';document.querySelector('#company-building').value='building_coal_mine'");assert(run('results().length')>0);assert(run("results().every(c=>[...c.buildings,...c.extensions].includes('building_coal_mine'))"));
for(const c of mod.companies){context.testCompany=c;run('current=testCompany;detail()');assert(el('#company-detail').innerHTML.includes(c.id));assert(el('#company-detail').innerHTML.includes('更多公司 MOD'))}
context.testCompany=mod.companies.find(c=>c.id==='company_Wartsila');run('current=testCompany;detail()');assert(el('#company-detail').innerHTML.includes('缺少赋值'));assert.equal(context.testCompany.prosperity.length,1);
run("switchCompanySource('vanilla')");assert.equal(run('results().length'),231);assert(el('#company-change').hidden);assert.equal(el('#company-building').value,'');assert.equal(JSON.stringify(base),original);
assert(el('#company-source-note').innerHTML.includes('原版公司图鉴'));
const english={window:{}};vm.runInNewContext(fs.readFileSync('en/mod-companies-data.js','utf8'),english);assert.equal(english.window.V3_MOD_COMPANIES.companies.length,923);assert(english.window.V3_MOD_COMPANIES.companies.find(c=>c.id==='company_Rui_Fu_Xiang').name!=='瑞蚨祥');
console.log('PASS: 923 isolated MOD definitions, 692 additions / 231 overrides, all art and prestige assets, translation, source filtering/switching, Chinese search, industries, every detail view, malformed source warning and untouched vanilla data.');
