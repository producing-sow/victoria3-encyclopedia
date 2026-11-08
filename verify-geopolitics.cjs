const fs=require('fs'),vm=require('vm'),assert=require('assert'),c={window:{}};for(const f of ['map-data.js','geopolitics-data.js'])vm.runInNewContext(fs.readFileSync(f,'utf8'),c);const G=c.window.V3_GEO,M=c.window.V3_MAP,all=Object.values(G.countries);assert.equal(all.reduce((n,c)=>n+c.population,0),M.states.reduce((n,s)=>n+s.population,0));for(const country of all){assert.equal(Object.values(country.cultures).reduce((a,b)=>a+b,0),country.population);assert.equal(Object.values(country.religions).reduce((a,b)=>a+b,0),country.population);for(const [k,n] of Object.entries(country.buildings))assert.equal(country.buildingRows.filter(r=>r.building===k).reduce((n,r)=>n+r.levels,0),n);for(const s of country.subjects)if(G.countries[s.country])assert.equal(G.countries[s.country].overlord.country,country.id);for(const p of country.states)assert(p.share>=0&&p.share<=1);if(country.path)assert(country.path.startsWith('M')&&country.path.endsWith('Z'));for(const i of country.blocs)assert(G.blocs[i].members.includes(country.id))}assert.equal(G.countries.BIC.overlord.country,'GBR');assert.equal(G.countries.GBR.laws.lawgroup_governance_principles,'law_monarchy');assert.equal(G.countries.CHI.population,366405602);console.log('PASS: population conservation, cultures/religions, building totals, province shares, country polygons, reciprocal subjects, bloc membership, China and Britain source checks.');
const assertGeo=require('assert');
assertGeo.equal(G.countries.JAP.laws.lawgroup_rights_of_women,'law_no_womens_rights');
assertGeo.equal(G.lawMeta[G.countries.JAP.laws.lawgroup_rights_of_women].name,'法定监护');
assertGeo(!G.countries.JAP.explicitLaws.includes('lawgroup_rights_of_women'));
assertGeo.equal(G.countries.JAP.military.combat_unit_type_irregular_infantry,58);
for(const country of all){for(const id of Object.values(country.laws))assertGeo(G.lawMeta[id]);for(const n of Object.values(country.military))assertGeo(Number.isInteger(n)&&n>=0)}
console.log('PASS: Japan inferred guardianship, 58 irregular infantry battalions, law metadata and military counts.');
for(const country of all){const totals={};for(const f of country.formations){for(const [k,n] of Object.entries(f.units))totals[k]=(totals[k]||0)+n}assert.deepEqual(totals,country.military)}
assert.equal(G.countries.GBR.formations.filter(f=>f.kind==='fleet').length,10);
assert.equal(G.countries.GBR.formations.filter(f=>f.kind==='army').length,5);
assert.equal(G.countries.GBR.formations.filter(f=>f.kind==='fleet').reduce((n,f)=>n+Object.values(f.units).reduce((a,b)=>a+b,0),0),226);
assert.equal(G.countries.PRU.formations.find(f=>f.kind==='fleet').ships.length,1);
for(const bloc of G.blocs)for(const id of bloc.principles){assert(G.principleMeta[id]);assert(!G.principleMeta[id].name.startsWith('principle_'));assert(fs.existsSync(G.principleMeta[id].icon))}
console.log('PASS: all formation/summary totals, British 226 ships in 10 fleets, standalone Prussian ship, localized principle icons.');
for(const country of all){
 for(const [group,entries] of Object.entries(country.amendments)){
  assert(country.laws[group]);
  for(const entry of entries){assert(G.amendmentMeta[entry.id]);assert(entry.source);assert(entry.sponsorName&&!entry.sponsorName.startsWith('ig_'));assert(entry.cooldown===null||Number.isInteger(entry.cooldown));}
 }
 for(const [id,record] of Object.entries(country.institutions)){assert(G.institutionMeta[id]);assert(Number.isInteger(record.level)&&record.level>=0);assert(record.source);}
}
assert.equal(G.countries.GBR.amendments.lawgroup_distribution_of_power[0].id,'amendment_tradition_of_free_elections');
assert.equal(G.countries.GBR.institutions.institution_colonial_affairs.level,2);
assert.equal(G.countries.GBR.institutions.institution_schools.level,3);
assert.equal(G.countries.GBR.institutions.institution_police.level,1);
assert.equal(G.countries.GBR.institutions.institution_health_system,undefined);
assert.equal(G.countries.FRA.amendments.lawgroup_distribution_of_power.length,2);
assert.equal(G.countries.FRA.amendments.lawgroup_distribution_of_power[0].cooldown,48);
assert.equal(G.countries.USA.amendments.lawgroup_slavery[0].id,'amendment_american_fugitive_slaves_act');
assert.equal(G.lawMeta.law_religious_schools.institution,'institution_schools');
assert.equal(G.lawMeta.law_no_schools.institution,null);
console.log('PASS: all amendment/institution references, Britain 2/3/1 investment, missing health level, multiple French amendments, American slavery amendment, law/institution mapping.');
assert.equal(G.countries.JAP.profile.government,'幕府');
assert.equal(G.countries.JAP.profile.religion,'mahayana');
assert(G.countries.JAP.profile.description.includes('德川幕府'));
for(const country of all){assert(country.profile);for(const id of country.profile.primaryCultures)assert(G.labels[id]);if(country.profile.religion)assert(G.religionMeta[country.profile.religion])}
console.log('PASS: country starting profiles, primary culture and religion references, original Japanese flavor text.');
const conditionalByLeader={GBR:'principle_colonial_offices_2',AUS:'principle_defensive_cooperation_1',PRU:'principle_police_coordination_1',RUS:'principle_defensive_cooperation_1',TUR:'principle_external_trade_1'};
for(const [leader,id] of Object.entries(conditionalByLeader)){
 const bloc=G.blocs.find(b=>b.leader===leader);
 assert.equal(bloc.conditionalPrinciples.length,1);
 assert.equal(bloc.conditionalPrinciples[0].id,id);
 assert.deepEqual(Array.from(bloc.conditionalPrinciples[0].requiredFeatures),['power_bloc_features']);
 assert(!bloc.principles.includes(id));assert(G.principleMeta[id]);assert(fs.existsSync(G.principleMeta[id].icon));
}
const colonial=G.principleMeta.principle_colonial_offices_2;
assert.equal(colonial.name,'殖民部');assert.equal(colonial.level,2);
assert(colonial.effects.some(e=>e.scope==='institution_modifier'&&Number(e.value)===0.05));
assert(colonial.effects.some(e=>e.scope==='leader_modifier'&&e.value==='yes'));
console.log('PASS: all five DLC-conditional starting principles, colonial offices II and per-level institution effect.');
