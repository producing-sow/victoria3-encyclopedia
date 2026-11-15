const fs=require('fs'),vm=require('vm'),assert=require('assert');
const host={innerHTML:''};const ctx={window:{V3_HISTORY:[{version:'test 1',captured:'2026-11-08T12:00:00',changes:[{kind:'新增'},{kind:'修改'}]}]},document:{getElementById:id=>id==='version-dashboard'?host:null}};
vm.runInNewContext(fs.readFileSync('history.js','utf8'),ctx);
assert(host.innerHTML.includes('test 1'));assert(host.innerHTML.includes('history.html'));assert(host.innerHTML.includes('compare.html?module=buildings'));assert(host.innerHTML.includes('compare.html?module=resources'));assert(host.innerHTML.includes('新增 <b>1'));
ctx.window.V3_HISTORY=[];vm.runInNewContext(fs.readFileSync('history.js','utf8'),ctx);assert(host.innerHTML.includes('暂无快照'));
console.log('PASS: dashboard counts, version link and empty archive.');
const elements=new Map();function element(id){if(!elements.has(id))elements.set(id,{innerHTML:'',value:'',textContent:''});return elements.get(id)}
const context=vm.createContext({window:{},document:{getElementById:element,createElement:()=>({remove(){}}),head:{append(script){setImmediate(()=>{try{vm.runInContext(fs.readFileSync(decodeURIComponent(script.src),'utf8'),context);script.onload()}catch(e){script.onerror()}})}}},console});
vm.runInContext(fs.readFileSync('history-data.js','utf8'),context);vm.runInContext(fs.readFileSync('history.js','utf8'),context);
const archive=context.window.V3_HISTORY;
function readRecords(entry){const sandbox={window:{}};vm.runInNewContext(fs.readFileSync('history/'+entry.id+'/records.js','utf8'),sandbox);return sandbox.window.V3_SNAPSHOT.records}
const before=readRecords(archive.at(-2)),after=readRecords(archive.at(-1));
const expected=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key]));
const added=expected.filter(key=>!before[key]).length;
setTimeout(()=>{
 assert(element('history-count').textContent.startsWith(`共 ${expected.length} 项变化`));
 assert.equal(element('history-rows').innerHTML.includes('history-record'),expected.length>0);
 element('history-kind').value='新增';element('history-kind').onchange();assert(element('history-count').textContent.startsWith(`共 ${added} 项变化`));
 element('history-kind').value='';element('history-query').value='no-such-record-xyz';element('history-query').oninput();assert(element('history-rows').innerHTML.includes('没有差异'));
 console.log(`PASS: actual local snapshots, ${expected.length} record changes, kind/search filtering and empty result.`);
},1000);
