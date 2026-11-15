// Optional interaction check: node verify-mod-companies-dom.cjs <path-to-linkedom>
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const {parseHTML}=require(process.argv[2]||'linkedom');
function page(search='',english=false){
  const {window:dom,document}=parseHTML(fs.readFileSync('companies.html','utf8'));
  Object.defineProperty(dom.HTMLSelectElement.prototype,'value',{configurable:true,get(){return [...this.options].find(o=>o.hasAttribute('selected'))?.value||this.options[0]?.value||''},set(value){for(const o of this.options)o.toggleAttribute('selected',o.value===value)}});
  let exported;
  class TestURL extends URL {static createObjectURL(blob){exported=blob;return 'blob:test'}static revokeObjectURL(){}}
  const context={window:{V3I18n:{language:english?'en':'zh',t:s=>s}},document,URL:TestURL,URLSearchParams,Blob,setTimeout:fn=>fn(),location:{search,href:'https://example.invalid/companies.html'+search},history:{replaceState(a,b,url){context.location.href=String(url)}},console};
  vm.createContext(context);
  for(const file of ['data.js','companies-data.js','mod-companies-data.js'])vm.runInContext(fs.readFileSync((english?'en/':'')+file,'utf8'),context,{filename:file});
  for(const file of ['companies-sources.js','companies.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  return {$:s=>document.querySelector(s),document,context,exported:()=>exported,fire(el,type){el.dispatchEvent(new dom.Event(type,{bubbles:true}))}};
}
(async()=>{
  const p=page(),{$,fire}=p;
  assert.equal(p.document.querySelectorAll('[data-company]').length,231);
  assert($('#company-change').hidden);
  fire($('[data-company-source="more-companies"]'),'click');
  assert.equal(p.document.querySelectorAll('[data-company]').length,923);
  assert.equal($('[data-company-source="more-companies"]').getAttribute('aria-pressed'),'true');
  assert(!$('#company-change').hidden);assert(p.context.location.href.includes('source=more-companies'));
  $('#company-change').value='added';fire($('#company-change'),'change');assert.equal(p.document.querySelectorAll('[data-company]').length,692);
  $('#company-search').value='瑞蚨祥';fire($('#company-search'),'input');assert.equal(p.document.querySelectorAll('[data-company]').length,1);assert($('#company-detail').textContent.includes('MOD 新增'));
  fire($('#company-export'),'click');const csv=await p.exported().text();assert(csv.includes('更多公司 MOD'));assert(csv.includes('瑞蚨祥'));assert(!csv.includes('company_kaiping_mining'));
  $('#company-search').value='无此公司检索';fire($('#company-search'),'input');assert($('#company-detail').textContent.includes('没有匹配'));
  fire($('[data-company-source="vanilla"]'),'click');assert.equal(p.document.querySelectorAll('[data-company]').length,231);assert.equal($('#company-search').value,'');assert($('#company-change').hidden);
  const mod=page('?source=more-companies&company=company_kaiping_mining');assert(mod.$('#company-detail').textContent.includes('覆盖原版'));assert(mod.$('#company-detail a[href*="source=vanilla"]').getAttribute('href').includes('company_kaiping_mining'));
  const base=page('?source=vanilla&company=company_kaiping_mining');assert.equal(base.$('[data-company].active').dataset.company,'company_kaiping_mining');assert(!base.$('#company-detail .is-mod'));
  const en=page('?source=more-companies&company=company_Rui_Fu_Xiang',true);assert.equal(en.document.querySelectorAll('[data-company]').length,923);assert(!en.$('#company-detail h2').textContent.includes('瑞蚨祥'));
  console.log('PASS: actual DOM events for source tabs, filters, search, empty state, filtered CSV, direct MOD/vanilla links and English data loading. No layout engine.');
})().catch(error=>{console.error(error);process.exitCode=1});
