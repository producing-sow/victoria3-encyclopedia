const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c={window:{},document:{addEventListener(){}},location:{search:''},URLSearchParams};vm.createContext(c);
for(const f of ['data.js','map-data.js','map-real-resources-data.js','map-versions.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
const base=c.window.V3_MAP,mod=c.window.V3_REAL_RESOURCES,versions=c.window.V3MapVersions,original=JSON.stringify(base);
assert.equal(Object.keys(mod.states).length,676);
const active=versions.dataFor('real-resources');assert.equal(active.states.length,676);
for(const s of active.states){
 const before=base.states.find(v=>v.id===s.id);
 for(const key of ['path','bounds','population','cultures','homelands','provinceCount'])assert.deepEqual(s[key],before[key],`${s.id}: ${key}`);
 for(const key of ['resources','hidden','arable','farms','traits'])assert.deepEqual(s[key],mod.states[s.id][key]);
 for(const id of s.traits)assert(active.traits[id],`${s.id}: ${id}`);
 for(const key of ['resources','hidden'])for(const [id,n] of Object.entries(s[key])){assert(Number.isFinite(n)&&n>=0);assert(active.resources[id])}
}
for(const t of Object.values(mod.traits)){
 assert(t.name!==t.id&&fs.existsSync(t.icon));
 for(const e of t.effects){assert(e.name!==e.id);assert(Number.isFinite(e.value));assert(['good','bad','neutral'].includes(e.color))}
}
c.document.querySelector=()=>({});
vm.runInContext(fs.readFileSync('map.js','utf8').split('const fragment=')[0],c);
const run=s=>vm.runInContext(s,c);
const shanxi=active.states.find(s=>s.id==='STATE_SHANXI');
assert.equal(shanxi.resources.building_coal_mine,143);assert.equal(shanxi.hidden.building_coal_mine,807);
assert.equal(base.states.find(s=>s.id===shanxi.id).resources.building_coal_mine,116);
run("M=window.V3MapVersions.dataFor('real-resources');byId=Object.fromEntries(M.states.map(s=>[s.id,s]));filter={...filter,resource:'building_coal_mine',hidden:false}");
assert.equal(run('capacity(byId.STATE_SHANXI)'),143);run('filter.hidden=true');assert.equal(run('capacity(byId.STATE_SHANXI)'),950);
run("filter={...filter,resource:'',requirements:{building_coal_mine:900,building_iron_mine:100}}");assert(run('matches(byId.STATE_SHANXI)'));
run('filter.hidden=false');assert(!run('matches(byId.STATE_SHANXI)'));
assert.equal(JSON.stringify(base),original);assert.strictEqual(versions.dataFor('vanilla'),base);
const en={window:{}};vm.runInNewContext(fs.readFileSync('en/map-real-resources-data.js','utf8'),en);
assert.equal(en.window.V3_REAL_RESOURCES.fingerprint,mod.fingerprint);
assert.equal(en.window.V3_REAL_RESOURCES.traits.state_trait_jingzhon_coalfield.name,'Jinzhong Coal Basin');
console.log('PASS: 676 MOD state overrides, original geometry/population preserved, known vs undiscovered resources, multi-resource filters, 502 localized trait definitions/icons, English dataset, no base-data mutation.');
