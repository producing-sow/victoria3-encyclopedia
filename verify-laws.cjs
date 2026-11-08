const fs=require('fs'),vm=require('vm'),assert=require('assert'),ctx={window:{}};
for(const f of ['laws-data.js','geopolitics-data.js','laws-core.js'])vm.runInNewContext(fs.readFileSync(f,'utf8'),ctx);
const L=ctx.window.V3_LAWS,G=ctx.window.V3_GEO,K=ctx.window.LawCore;
assert.equal(Object.keys(L.laws).length,Object.keys(G.lawMeta).length);
for(const law of Object.values(L.laws)){
 assert(L.groups[law.group]);assert(fs.existsSync(law.icon));if(law.institution)assert(L.institutions[law.institution]);
 for(const mode of [false,true]){const s=K.statistics(L,G,law.id,mode);assert.equal(s.total,449);assert.equal(s.distribution.reduce((n,r)=>n+r.count,0)+s.unknown,s.total);assert.equal(s.adopters.length,s.explicit.length+(mode?s.inferred.length:0));assert.equal(s.distribution.find(r=>r.id===law.id)?.count||0,s.adopters.length)}
}
assert(L.laws.law_strict_edo_system.special);assert(L.laws.law_hindu_caste_enforced.special);assert(L.laws.law_women_in_the_fields.special);
const school=K.effects(L,'law_religious_schools',[],3);
assert(Math.abs(school.institution.find(e=>e.id==='state_education_access_add').value-.3)<1e-9);
assert.equal(school.fixed.find(e=>e.id==='country_institution_cost_institution_schools_mult').value,-.2);
const police=K.effects(L,'law_dedicated_police',[],2);
assert.equal(police.institution.find(e=>e.id==='state_turmoil_effects_mult').value,-.2);
const zero=K.effects(L,'law_religious_schools',[],0);assert(zero.institution.every(e=>e.boolean||e.value===0));
const low=K.effects(L,'law_consumption_based_taxation',[],1,'very_low'),high=K.effects(L,'law_consumption_based_taxation',[],1,'very_high');
assert.equal(low.taxes.find(e=>e.id==='tax_consumption_add').value,.15);assert.equal(high.taxes.find(e=>e.id==='tax_consumption_add').value,.35);
const a='amendment_american_second_amendment',republic=K.effects(L,'law_presidential_republic',[a]);
assert(republic.fixed.some(e=>e.id==='building_training_rate_mult'&&e.value===.1));
assert(!K.effects(L,'law_monarchy',[a]).fixed.some(e=>e.sources.includes(L.amendments[a].name)));
assert.deepEqual(K.effects(L,'law_presidential_republic',[a,a]),republic);
assert(K.eligible(L,'law_monarchy').some(a=>a.generic));
assert(K.statistics(L,G,'law_religious_schools').explicit.some(c=>c.id==='GBR'));
assert(!K.statistics(L,G,'law_no_womens_rights').explicit.some(c=>c.id==='JAP'));
assert(K.statistics(L,G,'law_no_womens_rights',true).inferred.some(c=>c.id==='JAP'));
assert(K.statistics(L,G,'law_intermediate_edo_system').explicit.some(c=>c.id==='JAP'));
console.log('PASS: complete law catalog, special laws, conservation of all adoption pies, source separation, institution base + per-level effects, fixed effects, tax levels, amendment eligibility and deduplication.');
assert.equal(G.countries.USA.laws.lawgroup_governance_principles,'law_presidential_republic');
assert.equal(G.countries.USA.laws.lawgroup_education_system,'law_public_schools');
assert.equal(G.countries.ABU.laws.lawgroup_church_and_state,'law_people_of_the_book');
assert(G.countries.USA.lawOrigins.lawgroup_governance_principles.template);
for(const c of Object.values(G.countries))for(const [group,entries] of Object.entries(c.amendments))for(const entry of entries)assert(K.eligible(L,c.laws[group]).some(a=>a.id===entry.id));
console.log('PASS: starting political templates, later country overrides, Islamic branch, all historical amendments attached to eligible laws.');
