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
assert.ok(!app.includes('const SEED='),'demo seed catalog must stay removed');
assert.ok(!app.includes("source:'demo'"),'demo products must stay removed');
assert.ok(!app.includes('id="jan"'),'manual JAN entry must stay removed');
assert.ok(!app.includes('id="lookup"'),'manual JAN lookup button must stay removed');
assert.ok(app.includes('runNameSearch'),'Seiyu product-name search fallback missing');
assert.ok(app.includes('data-name-result'),'name-search results must expose a direct registration action');
assert.ok(app.includes('selectNameResult'),'name-search selection handler missing');
assert.ok(app.includes("lookupJan(picked.jan,{persist:false})"),'name-search enrichment must not save before confirmation');
assert.ok(app.includes("name:picked.name"),'selected Seiyu product name must survive JAN enrichment');
assert.ok(app.includes("netPriceSource:picked.netPrice!=null?'seiyu'"),'selected Seiyu price must remain authoritative');
assert.ok(!app.includes('JAN手入力を使ってください'),'removed manual JAN UI must not be referenced by fallback messages');
assert.ok(app.includes('monthDecisionSummary'),'what-if monthly summary missing');
assert.ok(app.includes('data-stock-jan'),'official Seiyu stock lookup missing');
assert.ok(app.includes('productQuery'),'product dictionary search missing');
assert.ok(app.includes('sanitizeCachedProduct'),'stale cached product sanitizer missing');
assert.ok(app.includes("p.netPriceSource!=='seiyu'"),'legacy other-store prices must be excluded');
assert.ok(app.includes("hit=seiyu.find(x=>x.jan===jan)"),'Seiyu name-search prices require exact JAN');
assert.ok(!app.includes("netPrice:x.netPrice!=null?x.netPrice"),'external retailer must never provide the net reference price');
assert.ok(app.includes('/サイト内検索|検索結果|site\\s*search/i'),'legacy maker false-positive cleanup missing');
assert.ok(app.includes('alternativeScore'),'alternative ranking missing');
assert.ok(app.includes('recDate'),'daily recommendation refresh missing');
assert.ok(!app.includes('KNOWN_PRODUCTS'),'hardcoded product dictionary must not be bundled');
assert.ok(app.includes('MAKER_OPTIONS'),'manufacturer prefix metadata missing');
assert.ok(app.includes('makerOptedIn(jan)'),'manufacturer opt-in gate missing');
assert.ok(app.includes('retailOptedInIds()'),'retail opt-in gate missing');
assert.ok(app.includes('data-retail-optin'),'retail settings toggles missing');
assert.ok(app.includes('data-reader-optin'),'reader opt-in toggle missing');
assert.ok(app.includes("&reader=1',9000"),'Seiyu nutrition lookup must always enable the server-side Reader fallback');
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
const mockReader='Title: イチゴスペシャル｜西友ネットスーパー\n# [![Image 3: 西友ネットスーパー](https://cdn.example/img.png)](https://netsuper.rakuten.co.jp/seiyu/)\n# イチゴスペシャル\n1個 149円 (税込 160円)\n## 商品説明\n栄養成分 | 1個当り：エネルギー480kcal、脂質19.2g';
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
  assert.equal(j.item.name,'イチゴスペシャル','Reader must not treat the site logo heading as product name');
  assert.equal(j.item.kcal,480,'opted-in Reader fallback must return kcal');
  assert.equal(j.item.kcalBasis,'1個当り');
  assert.equal(j.fetchVia,'jina-reader');
  assert.equal(calls.length,3,'direct fetch plus explicit reader fallback required');
}finally{
  globalThis.fetch=originalFetch;
}

const getRetail=Function(read('functions/api/retail/lookup.js').replace(/export\s+async\s+function/,'async function')+';return extractProduct;')();
const retailHtml='<html><head><title>イチゴスペシャル</title></head><body><h1>イチゴスペシャル</h1>商品番号4903110330523 税込160円 栄養成分：1個当り エネルギー480kcal</body></html>';
const retail=getRetail(retailHtml,'https://example.test/4903110330523',{label:'テスト店',id:'test'},'4903110330523');
assert.equal(retail.kcal,480,'retailer nutrition must be parsed by exact JAN');
assert.equal(retail.netPrice,null,'retailer price must be ignored even when item is identified');
assert.equal(retail.kcalBasis,'1個当り');
assert.equal(getRetail(retailHtml,'https://example.test/notfound',{label:'テスト店',id:'test'},'4903110330524'),null,'wrong JAN must be rejected');
assert.ok(app.includes('||p.kcal==null)&&enabledRetail.length'),'missing kcal must trigger retail requery');
assert.ok(app.includes('nutritionSourceUrl'),'nutrition source must be present in rendered product');

const sanitizeSource=app.match(/function sanitizeCachedProduct\(p\)\{[\s\S]*?\n\}/);
assert.ok(sanitizeSource,'cached product sanitizer must exist');
const sanitize=Function(sanitizeSource[0]+';return sanitizeCachedProduct;')();
assert.equal(sanitize({name:'商品A',source:'retail',retailer:'ベイシア',netPrice:160,kcal:480}).netPrice,null,'previously cached retailer prices must be cleared');
assert.equal(sanitize({name:'商品A',source:'registered',retailer:'トキハ',netPrice:165,kcal:480}).netPrice,null,'retailer prices must also clear after source conversion');
assert.equal(sanitize({name:'商品A',source:'retail',retailer:'トキハ',netPrice:193,netPriceSource:'seiyu'}).netPrice,193,'known Seiyu prices must remain');
assert.equal(sanitize({name:'商品A',source:'registered',netPrice:195,netPriceSource:'manual'}).netPrice,195,'manual reference prices must remain');
assert.ok(!retailLookup.includes('priceText'),'retailer parser must not extract prices');
assert.equal((retailLookup.match(/netPrice:null/g)||[]).length,2,'both retailer parsing routes must not return other-store prices');
assert.ok(read('functions/api/seiyu/product.js').includes("readerProductName(raw)"),'Reader heading filter missing');
console.log('smoke: OK');
