import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('app.js');
const sw=read('sw.js');
const makerLookup=read('functions/api/maker/lookup.js');
const functionFiles=[
  'functions/api/seiyu/search.js',
  'functions/api/seiyu/product.js',
  'functions/api/product/lookup.js',
  'functions/api/maker/lookup.js'
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
assert.ok(app.includes('alternativeScore'),'alternative ranking missing');
assert.ok(app.includes('recDate'),'daily recommendation refresh missing');
assert.ok(!app.includes('KNOWN_PRODUCTS'),'hardcoded product dictionary must not be bundled');
assert.ok(makerLookup.includes("prefix:'4903110'"),'Yamazaki maker route missing');
assert.ok(makerLookup.includes("prefix:'4902410'"),'Fuji Pan maker route missing');
assert.ok(makerLookup.includes("prefix:'4901820'"),'Pasco maker route missing');

console.log('smoke: OK');
