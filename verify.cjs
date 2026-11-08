const fs=require('fs'),vm=require('vm'),assert=require('assert');
const elements=new Map();
function el(s){if(!elements.has(s))elements.set(s,{value:'',style:{},textContent:'',innerHTML:'',classList:{toggle(){}}});return elements.get(s)}
const context={window:{},document:{querySelector:el,querySelectorAll:()=>[]},location:{hash:''},localStorage:{getItem:()=>null,setItem(){}},console,setTimeout,Blob,URL};
vm.createContext(context);
vm.runInContext(fs.readFileSync('data.js','utf8'),context);
vm.runInContext(fs.readFileSync('app.js','utf8'),context);
const D=context.window.V3_DATA,V=context.window.V3;
assert.equal(D.buildings.length,122);
assert(D.buildings.every(b=>!b.category.includes('\\')));
let p=V.calculate(['pm_patent_stills']);assert.equal(p.cost,1150);assert.equal(p.revenue,1800);assert.equal(p.net,650);assert.equal(p.workers,900);
let bakery=V.calculate(['pm_bakery']);assert.equal(bakery.net,550);assert.equal(bakery.workers,5000);
let combo=V.calculate(['pm_bakery','pm_cannery','pm_patent_stills','pm_manual_dough_processing']);
assert.equal(combo.input.grain,20);assert.equal(combo.output.groceries,35);assert.equal(combo.net,1500);assert.equal(combo.workers,6400);
let count=0,start=Date.now();for(const b of D.buildings){let c=V.best(b);assert(Number.isFinite(c.net));assert(c.valid,b.id);assert(c.net>=V.calculate(V.selection(b)).net,b.id);count++}
for(const t of ['ranking','goods','about','buildings']){vm.runInContext(`setTab('${t}')`,context);assert(el('#content').innerHTML.length>100)}
vm.runInContext("document.querySelector('#search').value='不存在的建筑';render()",context);assert(el('#content').innerHTML.includes('没有匹配'));
vm.runInContext("document.querySelector('#search').value='';document.querySelector('#category').value='03_mines';render()",context);assert(el('#content').innerHTML.includes('矿业'));
console.log(`PASS: source references, Chinese names, reference-image £650 case, signed combination arithmetic, ${count} optimal combinations, all 4 views, search/filter; ${Date.now()-start}ms`);
vm.runInContext("document.querySelector('#category').value='';setTab('ranking')",context);
assert(el('#content').innerHTML.includes('aria-sort="descending"'));
for(const key of ['name','category','cost','revenue','net','workers','perCapita']){
 for(const direction of ['asc','desc']){
  vm.runInContext(`rankingSort={key:'${key}',direction:'${direction}'}`,context);
  const values=vm.runInContext(`rankingRows(D.buildings).map(row=>rankingValue(row,'${key}'))`,context);
  for(let i=1;i<values.length;i++){
   const a=values[i-1],b=values[i];if(b===null)continue;assert.notEqual(a,null);
   const cmp=typeof a==='string'?a.localeCompare(b,'zh-CN'):a-b;
   assert(direction==='asc'?cmp<=0:cmp>=0,`${key} ${direction}`);
  }
 }
}
vm.runInContext("rankingSort={key:'net',direction:'desc'};changeRankingSort('net')",context);
assert.equal(vm.runInContext('rankingSort.direction',context),'asc');
vm.runInContext("changeRankingSort('name')",context);
assert.equal(vm.runInContext('rankingSort.direction',context),'asc');
assert(el('#content').innerHTML.includes('data-sort="perCapita"'));
console.log('PASS: all 7 ranking columns ascending/descending, null values last, click toggling, accessible headers');
const eligible=vm.runInContext('rankingRows(D.buildings).map(row=>row.b)',context);
assert(eligible.length>0&&eligible.length<D.buildings.length);
assert(eligible.every(b=>!['08_monuments','15_special','14_companies'].includes(b.category)));
assert(eligible.every(b=>b.groups.some(g=>D.groups[g].methods.some(id=>Object.values(D.methods[id].output).some(n=>n>0)))));
assert(!eligible.some(b=>['building_barracks','building_conscription_center','building_angkor_wat'].includes(b.id)));
assert(eligible.some(b=>b.id==='building_food_industry'));
console.log(`PASS: production leaderboard excludes special, company and non-producing buildings; ${eligible.length} eligible buildings.`);
if(process.argv.includes('--export')){
 const rows=[['建筑','ID','投入/周','产出/周','净产值/周','满员用工','人均年净产值','理论最高组合'],...eligible.map(b=>({b,c:V.best(b)})).sort((a,b)=>b.c.net-a.c.net).map(({b,c})=>[b.name,b.id,c.cost,c.revenue,c.net,c.workers,c.workers?c.net*52/c.workers:'',c.ps.map(p=>D.methods[p].name).join(' + ')])];
 fs.writeFileSync('最高理论产值清单.csv','\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n'),'utf8');
}
