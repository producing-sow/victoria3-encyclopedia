// Run with node verify-relations.cjs. Interaction checks without a browser.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const elements={},buttons=['in','out','reset','country'].map(action=>({dataset:{relationMap:action}}));
let hit=null;
const context={window:{},document:{querySelector:s=>elements[s]||{},querySelectorAll:s=>s==='[data-relation-map]'?buttons:[],elementFromPoint:()=>hit}};
vm.createContext(context);
for(const file of ['data.js','map-data.js','geopolitics-data.js','geopolitics-panels.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
vm.runInContext(fs.readFileSync('geopolitics.js','utf8').split('const fragment=')[0],context);
const run=s=>vm.runInContext(s,context);
const html=run('relationPanel(C.GBR)');
assert(html.indexOf('relations-info')<html.indexOf('relation-map-wrap'));
assert(html.includes('relation-root-branch" open'));
assert(html.includes('下属附庸'));
assert.equal(run("tree(Object.values(C).find(c=>!c.subjects.length).id)"),'');
const descendants=run("[...relatedCountries(C.GBR)]");
assert(descendants.includes('BIC')&&descendants.includes('KUT'));
assert(run("relationPanel(Object.values(C).find(c=>!c.subjects.length&&!c.blocs.length))").includes('无直属附庸'));
// A bloc member encountered before a child must not stop descendant traversal.
run("C.TEST_A={id:'TEST_A',blocs:[G.blocs.length],subjects:[{country:'TEST_B'}]};C.TEST_B={subjects:[{country:'TEST_C'}]};C.TEST_C={subjects:[{country:'TEST_A'}]};G.blocs.push({members:['TEST_B']})");
assert(run("relatedCountries(C.TEST_A).has('TEST_C')"));
assert(run("tree('TEST_A').length<2000"));
run("delete C.TEST_A;delete C.TEST_B;delete C.TEST_C;G.blocs.pop()");

const listeners={},classes=new Set(),captures=new Set();
let viewBox='0 0 1000 500';
const map={clientWidth:600,clientHeight:300,
  getAttribute:()=>viewBox,setAttribute:(key,value)=>{if(key==='viewBox')viewBox=value},
  classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)},
  addEventListener:(type,handler)=>listeners[type]=handler,
  setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),
  getScreenCTM:()=>({a:600/box()[2],inverse:()=>({})}),
  createSVGPoint:()=>({x:0,y:0,matrixTransform(){const b=box();return {x:b[0]+this.x*b[2]/600,y:b[1]+this.y*b[2]/600}}}),
  contains:node=>node===hit};
const box=()=>viewBox.split(' ').map(Number);
elements['#relation-mini-map']=map;elements['#relation-map-scale']={textContent:''};
run("selected='GBR';var picks=[];selectRelationCountry=t=>picks.push(t);bindRelationMap()");
const event=(extra={})=>({type:'',button:0,pointerId:1,clientX:200,clientY:100,preventDefault(){this.prevented=true},...extra});
const control=action=>buttons.find(b=>b.dataset.relationMap===action).onclick();
control('in');assert(box()[2]<1000);control('out');assert(Math.abs(box()[2]-1000)<1e-8);
const wheel=event({deltaY:-100});listeners.wheel(wheel);assert(wheel.prevented);assert(box()[2]<1000);
assert(Math.abs(box()[0]+200*box()[2]/600-1000/3)<1e-8,'zoom stays anchored under cursor');
control('reset');assert.deepEqual(box(),[0,0,1000,500]);
control('country');assert(box().every(Number.isFinite));assert(box()[2]>0);control('reset');

hit={dataset:{country:'BIC'},closest(){return this}};
listeners.pointerdown(event());listeners.pointermove(event({clientX:260}));
assert(box()[0]<0);assert(classes.has('dragging'));
listeners.pointerup(event({type:'pointerup',clientX:260}));listeners.click(event({target:hit}));
assert.equal(run('picks.length'),0,'dragging must not navigate');assert(!classes.has('dragging'));assert.equal(captures.size,0);
listeners.pointerdown(event());listeners.pointerup(event({type:'pointerup'}));
listeners.click(event({target:hit}));assert.equal(run('picks.join()'),'BIC','one selection per click');
listeners.pointerdown(event());listeners.pointercancel(event({type:'pointercancel'}));listeners.click(event({target:hit}));
assert.equal(run('picks.length'),1,'cancelled gestures must not navigate');
const enter=event({key:'Enter',target:hit});listeners.keydown(enter);assert(enter.prevented);assert.equal(run('picks.length'),2);
listeners.keydown(event({key:'0',target:hit}));assert.deepEqual(box(),[0,0,1000,500]);
listeners.keydown(event({key:'ArrowRight',target:hit}));assert.equal(box()[0],100);
listeners.keydown(event({key:'+',target:hit}));assert(box()[2]<1000);
for(let i=0;i<100;i++)control('in');assert(box().every(Number.isFinite)&&box()[2]>0);
for(let i=0;i<100;i++)control('out');assert(box().every(Number.isFinite)&&box()[2]<10000);
console.log('PASS: relationship hierarchy, leaf/empty states, cyclic traversal, map zoom limits, cursor anchor, reset, focus, drag versus click, pointer cancellation and keyboard controls.');
