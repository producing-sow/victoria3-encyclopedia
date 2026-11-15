const {createRequire}=require('node:module'),{pathToFileURL}=require('node:url');
const req=createRequire('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/probe.cjs');
const {chromium}=req('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
 const page=await browser.newPage({viewport:{width:1800,height:1050}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const url=pathToFileURL(require('node:path').resolve('map.html')).href;
 await page.goto(url+'?lang=zh&state=STATE_SHANXI');
 const initial=await page.evaluate(()=>({view:document.querySelector('#world').getAttribute('viewBox'),original:JSON.stringify(window.V3_MAP)}));
 assert.equal(await page.locator('[data-map-version="vanilla"]').getAttribute('aria-pressed'),'true');
 await page.locator('#preset-coal-iron').click();
 await page.locator('#require-min-building_coal_mine').fill('100');
 await page.locator('#hidden').check();
 await page.locator('[data-map-version="real-resources"]').click();
 assert.match(await page.locator('#map-mod-credit').innerText(),/MOD 作者：Asuna/);
 assert.equal(await page.locator('#map-mod-credit a').getAttribute('href'),'https://steamcommunity.com/sharedfiles/filedetails/?id=3459869359');
 const after=await page.evaluate(()=>({view:document.querySelector('#world').getAttribute('viewBox'),filter:V3Atlas.filter(),s:V3Atlas.states.find(s=>s.id==='STATE_SHANXI')}));
 assert.equal(after.view,initial.view);assert(after.filter.hidden);assert.equal(after.filter.requirements.building_coal_mine,100);
 assert.equal(after.s.resources.building_coal_mine,143);assert.equal(after.s.hidden.building_coal_mine,807);
 assert.match(await page.locator('#state-detail').innerText(),/真实资源 MOD/);
 assert.match(await page.locator('#state-detail').innerText(),/晋中/);
 assert.match(page.url(),/dataset=real-resources/);
 assert(await page.locator('header .compare-entry').isHidden());
 await page.locator('.map-version-panel').evaluate(e=>e.scrollIntoView({block:'start'}));
 await page.screenshot({path:'.real-resources-version-preview.png'});
 await page.locator('.atlas-layout').evaluate(e=>e.scrollIntoView({block:'start'}));
 await page.screenshot({path:'.real-resources-detail-preview.png'});
 const expected=await page.evaluate(()=>V3Atlas.states.find(s=>s.id==='STATE_SHANXI').resources.building_coal_mine);
 const pending=page.waitForEvent('download');await page.locator('#map-export').click();const download=await pending;
 assert.match(download.suggestedFilename(),/真实资源MOD/);const csv=fs.readFileSync(await download.path(),'utf8');assert.match(csv,/数据版本/);assert.match(csv,/真实资源 MOD/);assert.match(csv,/143/);
 await page.reload();assert.equal(await page.locator('[data-map-version="real-resources"]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.evaluate(()=>V3Atlas.states.find(s=>s.id==='STATE_SHANXI').resources.building_coal_mine),expected);
 await page.locator('[data-map-version="vanilla"]').click();
 assert(await page.locator('#map-mod-credit').isHidden());
 assert.equal(await page.evaluate(()=>JSON.stringify(window.V3_MAP)),initial.original);
 assert.equal(await page.evaluate(()=>V3Atlas.states.find(s=>s.id==='STATE_SHANXI').resources.building_coal_mine),116);
 assert(!page.url().includes('dataset='));assert(await page.locator('header .compare-entry').isVisible());
 await page.goto(url+'?lang=en&dataset=real-resources&state=STATE_SHANXI');
 assert.match(await page.locator('#map-mod-credit').innerText(),/MOD author: Asuna/);
 assert.match(await page.locator('#map-version-status').innerText(),/Real Resources MOD/);
 assert.match(await page.locator('#state-detail').innerText(),/Jinzhong Coal Basin/);
 const widths=[];
 for(const width of [1800,1100,800,390]){
  await page.setViewportSize({width,height:1000});
  widths.push(await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth})));
 }
 assert(widths.every(x=>!x.overflow),JSON.stringify(widths));
 await page.locator('.map-version-panel').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:'.real-resources-mobile-preview.png'});
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: live version switching, preserved map view and combined filters, known/hidden capacities, MOD trait effects, source labels, version-specific CSV, URL reload, base restoration, English and mobile layouts.',widths);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
