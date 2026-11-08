const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={window:{},location:{search:'?country=GBR'},URLSearchParams,document:{querySelector:()=>null}};
vm.createContext(context);
for(const file of ['geopolitics-data.js','military-data.js','military-equipment.js','military-core.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
vm.runInContext(fs.readFileSync('military.js','utf8').replace(/\ninitMilitary\(\);\s*$/,''),context);
const run=code=>vm.runInContext(code,context),model=run('model'),geo=context.window.V3_GEO;
assert.equal(model.units.length,Object.keys(geo.unitMeta).length);
assert.equal(model.totals.GBR.fleet,226);
assert.equal(geo.countries.JAP.military.combat_unit_type_irregular_infantry,58);
for(const kind of ['army','fleet']){
  let expected=0;
  for(const country of model.countries){
    const count=country.formations.filter(f=>f.kind===kind).reduce((sum,f)=>sum+Object.values(f.units).reduce((a,b)=>a+b,0),0);
    assert.equal(model.totals[country.id][kind],count,`${country.id} ${kind} matches named formations`);expected+=count;
    const entries=model.composition(country,kind);assert.equal(entries.reduce((n,e)=>n+e.count,0),count);
    assert(entries.every(e=>model.byUnit[e.id].kind===kind));
  }
  assert.equal(model.world[kind],expected);
  const ranking=model.ranking(kind);assert.equal(ranking.length,model.countries.length);
  assert(Math.abs(ranking.reduce((sum,c)=>sum+c.share,0)-1)<1e-10);
  assert(ranking.every((r,i)=>!i||ranking[i-1].count>=r.count));
  const ascending=model.ranking(kind,'',true);assert(ascending.every((r,i)=>!i||ascending[i-1].count<=r.count));
  const slices=context.window.V3_MILITARY.slices(ranking);assert(slices.length<=8);assert.equal(slices.reduce((sum,c)=>sum+c.count,0),expected);
}
for(const unit of model.units){
  const owners=model.owners(unit.id);assert.equal(owners.reduce((sum,c)=>sum+c.count,0),model.unitTotals[unit.id]);
  assert(owners.every(c=>geo.countries[c.id].military[unit.id]===c.count));
  assert(unit.profile||unit.icon);assert(fs.existsSync(unit.profile||unit.icon));
}
assert.equal(model.ranking('army','gbr')[0].id,'GBR');assert.equal(model.ranking('army','不存在的国家').length,0);
assert(run("pieChart([],{title:'空军队',kind:'army'}).includes('无显式开局陆军记录')"));
const single=run("pieChart([{id:'test',name:'唯一兵种',count:58}],{title:'单一兵种',kind:'army'})");assert(single.includes('<circle '));assert(single.includes('100%'));assert(!single.includes('NaN'));
const actual=run("pieChart(model.composition(geo.countries.GBR,'army'),{title:'陆军',kind:'army'})");assert(actual.includes('<path '));assert(!actual.includes('NaN'));
const escaped=run("pieChart([{id:'test',name:'<script>',count:1}],{title:'安全文本',kind:'fleet'})");assert(!escaped.includes('<script>'));assert(escaped.includes('&lt;script&gt;'));
const clamp=context.window.V3_MILITARY.clampView;
assert.equal(clamp({x:-100,y:5000,w:1000,h:500}).x,0);assert.equal(clamp({x:9000,y:5000,w:1000,h:500}).x,7192);assert.equal(clamp({x:0,y:0,w:10000,h:5000}).w,8192);
const html=fs.readFileSync('military.html','utf8');
for(const match of html.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)){const path=match[1];if(!/^(?:https?:|#)/.test(path))assert(fs.existsSync(path),`Missing page asset: ${path}`)}
for(const file of fs.readdirSync('.').filter(f=>f.endsWith('.html'))){const aside=fs.readFileSync(file,'utf8').match(/<aside[\s\S]*?<\/aside>/)?.[0];if(aside?.includes('geopolitics.html'))assert.equal((aside.match(/href="military.html"/g)||[]).length,1,`${file} has one military navigation entry`)}
console.log(`PASS: ${model.units.length} types, ${model.countries.length} countries, ${model.world.army} battalions and ${model.world.fleet} ships; all formation totals, shares, rankings, owner counts, pie edge cases, map bounds, assets and sidebar links.`);
