// node verify-industrial-chain-browser.cjs <path-to-playwright>
const assert=require('assert'),path=require('path'),{pathToFileURL}=require('url');
const {chromium}=require(process.argv[2]||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1050},acceptDownloads:true});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  const url=pathToFileURL(path.resolve('index.html')).href;
  await page.goto(url+'?dataset=vanilla&lang=zh');
  await page.locator('#dataset-summary').waitFor();
  assert.equal(await page.locator('.building').count(),122);
  await page.locator('[data-dataset="industrial-chain"]').click();
  assert.equal(await page.locator('.building').count(),144);
  assert.equal(await page.locator('[data-dataset="industrial-chain"]').getAttribute('aria-pressed'),'true');
  assert(await page.locator('#version-dashboard').isHidden());
  assert((await page.locator('#dataset-summary').textContent()).includes('1.4.12'));
  assert.equal(await page.locator('.controls select').count(),5);
  await page.locator('select[data-group="4"]').selectOption('pm_steam_oven');
  await page.locator('.pm').last().locator('summary').click();
  assert((await page.locator('.pm').last().textContent()).includes('10%'));
  await page.locator('[data-building="building_bricks_factory"]').click();
  await page.locator('#optimal').click();
  const metrics=await page.locator('.metrics').innerText();
  assert(metrics.includes('净产值'));assert.equal(await page.locator('.compare-entry').count(),0);
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'.industrial-chain-desktop-preview.png',fullPage:true});
  await page.locator('[data-dataset="vanilla"]').click();
  assert.equal(await page.locator('.building').count(),122);assert(await page.locator('#version-dashboard').isVisible());
  await page.locator('[data-dataset="industrial-chain"]').click();
  assert.equal(await page.locator('select[data-group="4"]').inputValue(),'pm_steam_oven','MOD combination must survive switching back');
  await page.locator('.building-subnav [data-tab="ranking"]').click();
  const rowCount=await page.locator('#content tbody tr').count();assert(rowCount>55);
  await page.locator('[data-sort="net"]').click();
  assert.equal(await page.locator('[data-sort="net"]').locator('..').getAttribute('aria-sort'),'ascending');
  await page.locator('.building-subnav [data-tab="goods"]').click();
  await page.locator('#search').fill('水泥');assert((await page.locator('#content').innerText()).includes('50'));
  // Inspect the actual generated Blob. The managed headless host cancels even
  // a plain about:blank Blob download, independently of this application.
  await page.evaluate(()=>{
   const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.exportedCSV=blob;return create(blob)};
   HTMLAnchorElement.prototype.click=function(){window.exportedName=this.download};
  });
  await page.locator('#export').click();
  const csv=await page.evaluate(()=>window.exportedCSV.text());
  assert((await page.evaluate(()=>window.exportedName)).includes('industrial-chain'));
  assert(csv.includes('数据版本'));assert(csv.includes('工业之链 MOD 1.4.12'));assert(csv.includes('cement'));
  await page.locator('.building-subnav [data-tab="about"]').click();
  assert((await page.locator('#content').innerText()).includes('MOD 百分比修正'));
  await page.goto(url+'?dataset=industrial-chain&building=building_bricks_factory&lang=en');
  assert((await page.locator('#dataset-summary').textContent()).includes('Chains of Industry MOD'));
  assert(!/[\u3400-\u9fff]/.test(await page.locator('#dataset-summary').textContent()));
  assert((await page.locator('.building-heading').innerText()).includes('Bricks Factory'));
  await page.goto(url+'?building=building_food_industry&lang=zh');
  assert.equal(await page.evaluate(()=>window.V3.dataset),'vanilla','external base-game deep links must override saved MOD preference');
  await page.setViewportSize({width:390,height:844});
  await page.goto(url+'?dataset=industrial-chain&building=building_bricks_factory&lang=zh');
  assert(await page.locator('[data-dataset="industrial-chain"]').isVisible());
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,'mobile page must not scroll horizontally');
  await page.screenshot({path:'.industrial-chain-mobile-preview.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log(`PASS: actual offline browser, switching, MOD PM selection, independent saved combinations, ${rowCount} ranking rows, sorting, goods, source-tagged CSV, English and mobile layout.`);
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
