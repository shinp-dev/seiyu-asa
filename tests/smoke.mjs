import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('app.js');
const sw=read('sw.js');
const makerLookup=read('functions/api/maker/lookup.js');
const retailLookup=read('functions/api/retail/lookup.js');
const functionFiles=[
  'functions/api/seiyu/search.js',
  'functions/api/seiyu/product.js',
  'functions/api/product/lookup.js',
  'functions/api/maker/lookup.js',
  'functions/api/retail/lookup.js'
];

new Function(app);
new Function(sw);
for(const p of functionFiles){
  const src=read(p).replace(/export\s+async\s+function/g,'async function');
  new Function(src);
}

const badBindings=app.split('\n').filter(line=>line.trim().startsWith("$(")&&line.includes('.forEach'));
assert.deepEqual(badBindings,[], 'single-element $() must not be used with forEach');
assert.match(app,/\^\\d\{8,14\}\$/, 'JAN validator should accept numeric 8-14 digit codes');
assert.ok(app.includes('/api/seiyu/product?jan='),'JAN-first Seiyu lookup missing');
assert.ok(app.includes('/api/product/lookup?jan='),'Open Food Facts proxy fallback missing');
assert.ok(app.includes('findSeiyuAlternatives'),'Seiyu alternative discovery missing');
assert.ok(app.includes('recordDecision'),'what-if decision tracking missing');
assert.ok(app.includes('serviceWorker.register'),'service worker registration missing');
assert.ok(app.includes('scanBarcodeImage'),'barcode image scan missing');
assert.ok(app.includes('runNameSearch'),'Seiyu product-name search fallback missing');
assert.ok(app.includes('monthDecisionSummary'),'what-if monthly summary missing');
assert.ok(app.includes('data-stock-jan'),'official Seiyu stock lookup missing');
assert.ok(app.includes('productQuery'),'product dictionary search missing');
assert.ok(app.includes('sanitizeCachedProduct'),'stale cached product sanitizer missing');
assert.ok(app.includes('/サイト内検索|検索結果|site\\s*search/i'),'legacy maker false-positive cleanup missing');
assert.ok(app.includes('alternativeScore'),'alternative ranking missing');
assert.ok(app.includes('recDate'),'daily recommendation refresh missing');
assert.ok(!app.includes('KNOWN_PRODUCTS'),'hardcoded product dictionary must not be bundled');
assert.ok(app.includes('MAKER_OPTIONS'),'manufacturer prefix metadata missing');
assert.ok(app.includes('makerOptedIn(jan)'),'manufacturer opt-in gate missing');
assert.ok(app.includes('retailOptedInIds()'),'retail opt-in gate missing');
assert.ok(app.includes('data-retail-optin'),'retail settings toggles missing');
assert.ok(app.includes('data-reader-optin'),'reader opt-in toggle missing');
assert.ok(app.includes("reader='+(S.readerOptIn?'1':'0')"),'reader opt-in gate missing from retail request');
assert.ok(app.includes('/api/retail/lookup?jan='),'retail JAN lookup missing');
assert.ok(app.includes("cache:'no-store'"),'lookup requests must bypass browser HTTP cache');
assert.ok(retailLookup.includes("'cache-control':'no-store'"),'retail lookup responses must not cache misses');
assert.ok(app.includes("S.route==='options'?renderOptions()"),'options screen missing');
assert.ok(makerLookup.includes("prefix:'4903110'"),'Yamazaki maker route missing');
assert.ok(makerLookup.includes("prefix:'4902410'"),'Fuji Pan maker route missing');
assert.ok(makerLookup.includes("prefix:'4901820'"),'Pasco maker route missing');
assert.ok(!makerLookup.includes('const direct=extractProduct(html,target,maker,jan)'),'maker search page must not be accepted as a product');
assert.ok(makerLookup.includes("search\\.yamazakipan\\.co\\.jp"),'Yamazaki search host guard missing');
assert.ok(makerLookup.includes("'cache-control':'no-store'"),'maker lookup responses must not cache false matches');
assert.ok(retailLookup.includes("id:'beisia'"),'Beisia retail route missing');
assert.ok(retailLookup.includes("id:'tokiwa'"),'Tokiwa retail route missing');
assert.ok(retailLookup.includes("id:'youme'"),'Youme retail route missing');
assert.ok(retailLookup.includes("if(!requested.length)"),'retail lookup must require explicit opt-in sources');
assert.ok(retailLookup.includes("compact.includes(jan)"),'retail lookup must require exact JAN in fetched page');
assert.ok(retailLookup.includes("u.searchParams.get('reader')==='1'"),'reader fallback must require explicit opt-in');
assert.ok(retailLookup.includes("https://r.jina.ai/"),'Jina Reader fallback missing');
assert.ok(retailLookup.includes("extractReaderProduct"),'reader response parser missing');
assert.ok(retailLookup.includes("decodeHtml"),'retailer charset decoder missing');
assert.ok(retailLookup.includes("'shift_jis'"),'Shift_JIS retailer pages must be decoded');

// Test the deployed-style Pages Function with an exact JAN, without needing network.
const seiyuModule=await import('data:text/javascript,'+encodeURIComponent(read('functions/api/seiyu/product.js')));
const originalFetch=globalThis.fetch;
const mockHtml='<html><h1>イチゴスペシャル</h1><div>1個 149円 (税込 160円)</div><h2>商品説明</h2><p>栄養成分 1個当り：エネルギー480kcal、脂質19.2g</p></html>';
const mockReader='Title: イチゴスペシャル｜西友ネットスーパー\n# イチゴスペシャル\n1個 149円 (税込 160円)\n## 商品説明\n栄養成分 | 1個当り：エネルギー480kcal、脂質19.2g';
try{
  let calls=[];
  globalThis.fetch=async url=>{
    calls.push(String(url));
    return new Response(mockHtml,{status:200,headers:{'content-type':'text/html'}});
  };
  let r=await seiyuModule.onRequestGet({request:new Request('https://example.test/api/seiyu/product?jan=4903110330523')});
  let j=await r.json();
  assert.equal(j.item.name,'イチゴスペシャル');
  assert.equal(j.item.kcal,480,'Seiyu product kcal must be parsed');
  assert.equal(j.item.kcalBasis,'1個当り','Serving basis must be retained');
  assert.equal(j.item.nutritionSource,'西友ネットスーパー');
  assert.equal(calls.length,1,'Reader must not be called without opt-in');

  calls=[];
  globalThis.fetch=async url=>{
    calls.push(String(url));
    return String(url).startsWith('https://r.jina.ai/')
      ?new Response(mockReader,{status:200})
      :new Response('Forbidden',{status:403});
  };
  r=await seiyuModule.onRequestGet({request:new Request('https://example.test/api/seiyu/product?jan=4903110330523')});
  j=await r.json();
  assert.equal(j.item,null,'without Reader opt-in a blocked site must not be relayed');
  assert.equal(calls.length,1);
  r=await seiyuModule.onRequestGet({request:new Request('https://example.test/api/seiyu/product?jan=4903110330523&reader=1')});
  j=await r.json();
  assert.equal(j.item.kcal,480,'opted-in Reader fallback must return kcal');
  assert.equal(j.item.kcalBasis,'1個当り');
  assert.equal(j.fetchVia,'jina-reader');
  assert.equal(calls.length,3,'direct fetch plus explicit reader fallback required');
}finally{
  globalThis.fetch=originalFetch;
}

const getRetail=Function(read('functions/api/retail/lookup.js').replace(/export\s+async\s+function/,'async function')+';return extractProduct;')();
const retailHtml='<html><head><title>イチゴスペシャル</title></head><body><h1>イチゴスペシャル</h1>商品番号4903110330523 栄養成分：1個当り エネルギー480kcal</body></html>';
const retail=getRetail(retailHtml,'https://example.test/4903110330523',{label:'テスト店',id:'test'},'4903110330523');
assert.equal(retail.kcal,480,'retailer nutrition must be parsed by exact JAN');
assert.equal(retail.kcalBasis,'1個当り');
assert.equal(getRetail(retailHtml,'https://example.test/notfound',{label:'テスト店',id:'test'},'4903110330524'),null,'wrong JAN must be rejected');
assert.ok(app.includes('||p.kcal==null)&&enabledRetail.length'),'missing kcal must trigger retail requery');
assert.ok(app.includes('nutritionSourceUrl'),'nutrition source must be present in rendered product');

console.log('smoke: OK');
