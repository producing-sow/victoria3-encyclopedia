const fs=require('fs'),vm=require('vm'),assert=require('assert'),context={window:{}};
vm.createContext(context);
for(const file of ['data.js','geopolitics-data.js','military-data.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
const data=context.window.V3_MILITARY_DATA,geo=context.window.V3_GEO,goods=context.window.V3_DATA.goods;
const effect=(item,id)=>item.effects.find(e=>e.id===id)?.value;
const cost=(item,good,mode='add')=>item.costs.find(e=>e.good===good&&e.mode===mode)?.value;
assert.equal(Object.keys(data.units).length,41);assert.equal(Object.keys(data.options).length,18);
for(const [id,unit] of Object.entries(data.units)){
  assert(geo.unitMeta[id]);assert(unit.source);assert(unit.attributes.length);
  for(const effect of unit.attributes){assert(Number.isFinite(effect.value));assert.notEqual(effect.name,effect.id)}
  if(unit.kind==='army')for(const key of ['unit_offense_add','unit_defense_add'])assert(unit.attributes.some(e=>e.id===key),id+' '+key);
  for(const item of [...unit.upkeep,...unit.construction])assert(goods[item.good]);
}
const trench=data.units.combat_unit_type_trench_infantry;
assert.equal(trench.attributes.find(e=>e.id==='unit_offense_add').value,30);assert.equal(trench.attributes.find(e=>e.id==='unit_defense_add').value,40);
assert.equal(trench.upkeep.find(e=>e.good==='small_arms').value,3);assert.equal(trench.upkeep.find(e=>e.good==='ammunition').value,2);
const basic=data.options.mobilization_option_basic_supplies,extra=data.options.mobilization_option_extra_supplies,chocolate=data.options.mobilization_option_chocolate,hospital=data.options.mobilization_option_field_hospitals;
assert(basic.mandatory);assert.equal(cost(basic,'grain'),.75);assert.equal(cost(basic,'small_arms','mult'),.5);
assert.equal(cost(extra,'groceries'),1.5);assert.equal(cost(extra,'small_arms','mult'),.25);assert.equal(effect(extra,'unit_offense_mult'),.1);assert.equal(effect(extra,'unit_defense_mult'),.1);assert.equal(effect(extra,'unit_morale_loss_mult'),-.05);
assert.equal(cost(chocolate,'sugar'),1);assert.equal(effect(chocolate,'unit_morale_recovery_mult'),.1);
assert.equal(cost(hospital,'opium'),2);assert.equal(cost(hospital,'tools'),1);assert.equal(effect(hospital,'unit_recovery_rate_add'),.4);assert.equal(hospital.technologies[0].id,'modern_nursing');
assert(hospital.conditions.excludes.includes('mobilization_option_first_aid'));assert(data.options.mobilization_option_first_aid.conditions.excludes.includes(hospital.id));
assert(data.options.mobilization_option_luxurious_supplies.conditions.requires.includes(extra.id));
assert.equal(effect(data.options.mobilization_option_forced_march,'unit_morale_loss_mult'),.1);
assert.equal(effect(data.options.mobilization_option_chemical_weapons,'unit_recovery_rate_add'),-.2);
assert.equal(hospital.transitions.on_activate_while_mobilized[0].value,-.25);assert(hospital.transitions.on_deactivate.some(e=>e.stat==='morale'&&e.value===-.5));
for(const option of Object.values(data.options)){
  assert.equal(option.kind,'army');assert(data.groups[option.group]);assert(fs.existsSync(option.icon));
  for(const item of option.costs){assert(goods[item.good]);assert(Number.isFinite(item.value));assert(['add','mult'].includes(item.mode))}
  for(const e of option.effects){assert(Number.isFinite(e.value));assert.notEqual(e.name,e.id)}
  for(const id of [...option.conditions.requires,...option.conditions.excludes])assert(data.options[id]);
}
const history=fs.readFileSync('version_history.py','utf8');assert(history.includes("'military-data.js'"));assert(history.includes("'build_military.py'"));
console.log('PASS: 41 unit attributes, 18 options, trench 30/40, equipment costs, chocolate, modern nursing hospitals, mandatory supplies, dependencies, exclusions, negative effects, toggle penalties, assets and update integration.');
