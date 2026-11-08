const assert=require('assert'),fs=require('fs'),vm=require('vm');
const context={window:{},document:{querySelector:()=>({})}};vm.createContext(context);
for(const file of ['data.js','map-data.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
vm.runInContext(fs.readFileSync('map.js','utf8').split('const fragment=')[0],context);
const run=s=>vm.runInContext(s,context),M=context.window.V3_MAP;
assert.equal(M.states.length,676);assert.equal(new Set(M.states.map(s=>s.id)).size,676);
for(const s of M.states){assert.equal(Object.values(s.cultures).reduce((a,b)=>a+b,0),s.population);assert(s.path.startsWith('M'));assert(s.path.endsWith('Z'));assert(s.bounds[0]>=0&&s.bounds[1]>=0);assert(s.bounds[0]+s.bounds[2]<=M.width);assert(s.bounds[1]+s.bounds[3]<=M.height)}
const svea=M.states.find(s=>s.id==='STATE_SVEALAND');assert.equal(svea.population,1114208);assert.equal(svea.cultures.swedish,1081208);assert.equal(svea.arable,30);assert.equal(svea.resources.building_iron_mine,60);
run("filter={...filter,resource:'building_oil_rig',hidden:false}");let known=run('M.states.filter(matches).length');assert.equal(known,0);
run('filter.hidden=true');let potential=run('M.states.filter(matches).length');assert.equal(potential,150);
run("filter={...filter,resource:'',culture:'han',layer:'culture',minPop:10000000,hidden:false}");assert.equal(run('M.states.filter(matches).length'),18);
run("filter.minArable=500");assert(run('M.states.filter(matches).every(s=>s.arable>=500)'));
run("filter.minCulture=10000000");assert(run("M.states.filter(matches).every(s=>s.cultures.han>=10000000)"));
run("filter={...filter,resource:'',culture:'',minArable:0,minPop:0,minCulture:0,search:'svealand'}");assert.equal(run('M.states.filter(matches).length'),1);
run("filter.search='不存在的州'");assert.equal(run('M.states.filter(matches).length'),0);
assert.equal(run('percentage(2592,22832408)'), '0.01');
console.log('PASS: 676 land boundaries; whole-state culture totals; source-backed Svealand totals; known/undiscovered oil; combined population, culture and arable filters; state search; minority percentages.');
run("filter={...filter,resource:'',search:'',requirements:{building_coal_mine:50,building_iron_mine:50},hidden:false}");
const both=run('M.states.filter(matches)');assert(both.length>0);
assert(both.every(s=>s.resources.building_coal_mine>=50&&s.resources.building_iron_mine>=50));
assert(both.some(s=>s.id==='STATE_SHANXI'));
run('matched=M.states.filter(matches)');
for(const key of ['name','selected','building_coal_mine','building_iron_mine','arable','population'])for(const direction of ['asc','desc']){
run(`resourceRankSort={key:'${key}',direction:'${direction}'}`);
const values=run(`rankedStates().map(s=>resourceRankValue(s,'${key}'))`);
for(let i=1;i<values.length;i++){if(values[i]===null)continue;assert.notEqual(values[i-1],null);const c=typeof values[i]==='string'?values[i-1].localeCompare(values[i],'zh-CN'):values[i-1]-values[i];assert(direction==='asc'?c<=0:c>=0)}
}
run("filter.requirements={building_coal_mine:100000,building_iron_mine:50}");assert.equal(run('M.states.filter(matches).length'),0);
console.log(`PASS: independent coal AND iron thresholds (${both.length} states at 50/50), impossible combination, resource leaderboard numeric/text sorting both directions.`);
for(const s of M.states){assert(Array.isArray(s.traits));for(const id of s.traits)assert(M.traits[id],`${s.id}: ${id}`)}
for(const t of Object.values(M.traits)){
assert(t.name&&!t.name.startsWith('state_trait_'));assert(t.icon&&fs.existsSync(t.icon));
for(const e of t.effects){assert(Number.isFinite(e.value));assert(e.name!==e.id,`Untranslated modifier ${e.id}`);assert(['good','bad','neutral'].includes(e.color))}
}
assert.deepEqual(M.states.find(s=>s.id==='STATE_YUNNAN').traits,['state_trait_yangtze_river']);
assert.equal(run("traitEffectText(M.traits.state_trait_yangtze_river.effects.find(e=>e.id==='state_infrastructure_add'))"),'+20');
assert.equal(run("traitEffectText(M.traits.state_trait_yangtze_river.effects.find(e=>e.id==='state_market_access_price_impact'))"),'+5%');
assert.equal(run("traitEffectClass(M.traits.state_trait_malaria.effects.find(e=>e.id==='state_non_homeland_mortality_mult'))"),'negative');
assert(run("renderStateTraits(byId.STATE_YUNNAN)").includes('长江'));
assert(run("renderStateTraits({traits:[]})").includes('无固定地区特质'));
assert(run("renderStateTraits({traits:['state_trait_malaria']})").includes('奎宁'));
console.log(`PASS: all state trait references, icons and translated effects; Yunnan +20 / +5%; mortality penalty; technology conditions and empty state (${Object.keys(M.traits).length} traits).`);
