const fs=require('fs'),vm=require('vm'),assert=require('assert');
function boot({query='',stored={}}={}){
 const elements=new Map(),store=new Map(Object.entries(stored));
 const el=s=>{if(!elements.has(s))elements.set(s,{value:'',style:{},textContent:'',innerHTML:'',classList:{toggle(){}}});return elements.get(s)};
 const context={window:{},document:{querySelector:el,querySelectorAll:()=>[]},location:{hash:'',search:query},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},console,setTimeout,Blob,URL,URLSearchParams};
 vm.createContext(context);
 for(const file of ['data.js','industrial-chain-data.js','app.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 return{V:context.window.V3,run:s=>vm.runInContext(s,context),el,store};
}
const {V,run,el,store}=boot(),base=V.data;
assert.equal(V.dataset,'vanilla');
const food=base.buildings.find(b=>b.id==='building_food_industry'),baseBest=V.best(food).net;
run("persist(['pm_bakery','pm_cannery','pm_patent_stills','pm_manual_dough_processing'])");
const savedBase=store.get('v3-combinations');
V.switchDataset('industrial-chain');
const mod=V.data;
assert.equal(mod.mod.version,'1.4.12');assert.equal(mod.buildings.length,144);assert.equal(Object.keys(mod.goods).length,68);
assert.equal(mod.goods.services.price,30);assert.equal(base.goods.services.price,30);
assert.equal(mod.goods.bricks.price,30);assert(!base.goods.bricks);
assert(mod.buildings.some(b=>b.id==='building_bricks_factory'));
assert.equal(mod.methods.pm_bakery.output.groceries,10);
assert.equal(mod.methods.pm_bakery.jobs.laborers,2000,'repeated building_modifiers blocks must preserve jobs');
assert.equal(mod.methods.pm_bakery.jobs.shopkeepers,500);
const textile=mod.buildings.find(b=>b.id==='building_textile_mill');
assert(textile.groups.includes('pmg_assembly_lines_building_textile_mill'));
assert(textile.groups.includes('pmg_base_building_textile_mill'),'INJECT must preserve inherited groups');
assert(!base.buildings.find(b=>b.id===textile.id).groups.includes('pmg_assembly_lines_building_textile_mill'));
assert(mod.groups.pmg_base_building_food_industry.methods.includes('pm_bakery_additives'));
assert(mod.groups.pmg_base_building_food_industry.methods.includes('pm_bakery'));
const c=V.calculate(['pm_bakery','pm_early_mill','pm_steam_oven']);
// Independently read from MOD source: (10+35)*1.1 groceries, 40*1.1 grain,
// plus one stationary engine and one coal, 500+500 shopkeepers, 2000+2000-1000 laborers.
assert(Math.abs(c.output.groceries-49.5)<1e-9);assert.equal(c.input.grain,44);
assert.equal(c.input.stationary_engine,1);assert.equal(c.input.coal,1);assert.equal(c.workers,4000);
assert(Math.abs(c.net-495)<1e-9);
const both=V.calculate(['pm_bakery','pm_early_mill','pm_steam_oven','pm_tunnel_oven']);
assert(Math.abs(both.output.groceries-63)<1e-9,'percentage modifiers add before multiplying');
const throughput=V.calculate(['pm_bakery','pm_commercial_collection']);
assert(Math.abs(throughput.output.groceries-11)<1e-9,'inherent throughput is included');
for(const group of Object.values(mod.groups))for(const id of group.methods)assert(mod.methods[id],id);
for(const kind of ['goods','methods','buildings'])for(const item of Array.isArray(mod[kind])?mod[kind]:Object.values(mod[kind])){
 assert(!/^(REPLACE|INJECT|REPLACE_OR_CREATE):/.test(item.id),item.id);
 if(item.icon)assert(fs.existsSync(item.icon),`missing artwork: ${item.id}`);
}
let optimized=0;
for(const b of mod.buildings){const best=V.best(b);assert(best.valid,b.id);assert(Number.isFinite(best.net),b.id);assert(best.net+1e-8>=V.calculate(V.selection(b)).net,b.id);optimized++}
const modFood=mod.buildings.find(b=>b.id===food.id);
assert.notEqual(V.best(modFood).net,baseBest,'MOD must not reuse the base-game optimization cache');
run('persist(best(current).ps)');assert(store.has('v3-combinations-industrial-chain'));assert.equal(store.get('v3-combinations'),savedBase);
for(const tab of ['ranking','goods','about','buildings']){run(`setTab('${tab}')`);assert(el('#content').innerHTML.length>100)}
assert(!el('#content').innerHTML.includes('compare.html?module=buildings'),'MOD must not link to base-game historical comparisons');
assert(el('#dataset-summary').textContent.includes('1.4.12'));assert(el('#version-dashboard').hidden);
V.switchDataset('vanilla');assert.equal(V.best(food).net,baseBest);assert.equal(store.get('v3-combinations'),savedBase);assert(!el('#version-dashboard').hidden);
assert(el('#content').innerHTML.includes('compare.html?module=buildings'));
assert.equal(boot({query:'?dataset=industrial-chain&building=building_bricks_factory'}).V.dataset,'industrial-chain');
assert.equal(boot({query:'?building=building_food_industry',stored:{'v3-industry-dataset':'industrial-chain'}}).V.dataset,'vanilla','base-game links from other modules must keep their dataset');
assert.equal(boot({stored:{'v3-industry-dataset':'industrial-chain'}}).V.dataset,'industrial-chain');
assert.equal(boot({query:'?dataset=unknown'}).V.dataset,'vanilla');
const english={window:{}};vm.runInNewContext(fs.readFileSync('en/industrial-chain-data.js','utf8'),english);
assert.equal(english.window.V3_INDUSTRIAL_CHAIN_DATA.buildings.length,mod.buildings.length);
assert.equal(english.window.V3_INDUSTRIAL_CHAIN_DATA.methods.pm_bakery.name,'Bakeries');
console.log(`PASS: MOD override/injection, repeated modifier blocks, goods percentages, throughput, ${optimized} optimal combinations, separate caches/storage, all views, source-safe links, English data and artwork.`);
