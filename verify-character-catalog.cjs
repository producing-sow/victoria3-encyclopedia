const fs=require('fs'),vm=require('vm'),assert=require('assert'),ctx={window:{}};
for(const file of ['characters-data.js','geopolitics-data.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),ctx);
const A=ctx.window.V3_CHARACTERS,G=ctx.window.V3_GEO;
assert.equal(Object.keys(A.ideologies).length,190);assert.equal(Object.keys(A.traits).length,127);
const stances=new Set(['strongly_approve','approve','neutral','disapprove','strongly_disapprove']);
for(const [kind,items] of [['ideology',A.ideologies],['trait',A.traits]])for(const [id,m] of Object.entries(items)){
 assert.equal(m.id,id);assert(m.icon&&fs.existsSync(m.icon),id);assert(m.definition.length,id);
 assert.equal(m.characterCount,A.characters.filter(c=>kind==='ideology'?c.ideology===id:c.traits.includes(id)).length,id);
 for(const rows of Object.values(m.effects))for(const e of rows)assert(Number.isFinite(Number(e.value))||['yes','no'].includes(e.value),e.id);
 if(kind==='ideology')for(const s of m.stances){assert(G.lawMeta[s.law],s.law);assert.equal(G.lawMeta[s.law].group,s.group);assert(stances.has(s.stance));}
 else for(const replaced of m.replaces)assert(A.traits[replaced],replaced);
}
assert(A.ideologies.ideology_paternalistic.stances.some(s=>s.law==='law_monarchy'&&s.stance==='strongly_approve'));
assert(A.traits.persistent.effects.character_modifier.some(e=>e.id==='character_health_add'&&Number(e.value)===.2&&e.percent));
assert(A.traits.persistent.effects.command_modifier.some(e=>e.id==='unit_morale_loss_mult'&&Number(e.value)===-.15&&e.percent));
assert(A.traits.persistent.effects.country_modifier.some(e=>e.id==='country_bureaucrats_pol_str_mult'&&Number(e.value)===.25));
assert(A.traits.persistent.effects.interest_group_modifier.some(e=>e.id==='interest_group_in_opposition_approval_add'&&Number(e.value)===-1&&!e.percent));
for(const role of ['ruler','general','politician','agitator','executive'])assert(A.roles[role].icon&&fs.existsSync(A.roles[role].icon));
console.log('PASS: full ideology/trait catalogs, all icons, template counts, law stance references, role-specific modifier values/units, replaced traits, role icons.');
