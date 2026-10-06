const RETAILERS=[
  {
    id:'beisia',
    label:'ベイシア',
    url:jan=>'https://netsuper.rakuten.co.jp/beisia/item/'+encodeURIComponent(jan)+'/'
  },
  {
    id:'tokiwa',
    label:'トキハ',
    url:jan=>'https://www.tokiwa-portal.com/shop/g/g'+encodeURIComponent(jan)+'/'
  },
  {
    id:'youme',
    label:'ゆめデリバリー',
    url:jan=>'https://delivery.youmetown.com/shop/g/g'+encodeURIComponent(jan)+'/'
  }
];

export async function onRequestGet(ctx){
  const u=new URL(ctx.request.url);
  const jan=(u.searchParams.get('jan')||'').replace(/[^0-9]/g,'');
  if(!/^\d{8,14}$/.test(jan))return json({product:null,attempted:[],error:'invalid_jan'},400);

  const requested=(u.searchParams.get('sources')||'')
    .split(',')
    .map(x=>x.trim())
    .filter(Boolean);
  if(!requested.length)return json({product:null,attempted:[]});

  const selected=RETAILERS.filter(x=>requested.includes(x.id));
  const attempted=[];

  for(const retailer of selected){
    attempted.push(retailer.id);
    const sourceUrl=retailer.url(jan);
    const html=await getHtml(sourceUrl);
    if(!html)continue;
    const product=extractProduct(html,sourceUrl,retailer,jan);
    if(product)return json({product,attempted});
  }
  return json({product:null,attempted});
}

function extractProduct(html,sourceUrl,retailer,jan){
  const raw=String(html||'');
  const compact=raw.replace(/[\s\-‐‑–—]/g,'');
  if(!compact.includes(jan))return null;

  const h1=clean((raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||'');
  const ogTitle=decodeAttr((raw.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)||[])[1]||'');
  const title=clean((raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'');
  const name=cleanName(h1||ogTitle||title,retailer.label);
  if(!name)return null;

  const text=clean(raw);
  const taxIncluded=(text.match(/税込[^0-9]{0,25}([0-9][0-9,]*(?:\.[0-9]+)?)\s*円/i)||[])[1];
  const anyPrice=(text.match(/([0-9][0-9,]*(?:\.[0-9]+)?)\s*円/)||[])[1];
  const priceText=taxIncluded||anyPrice||'';
  const netPrice=priceText?Number(priceText.replace(/,/g,'')):null;
  const imageUrl=decodeAttr((raw.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)||[])[1]||'');

  return{
    jan,
    name,
    brand:'',
    manufacturer:'',
    quantity:'',
    netPrice:Number.isFinite(netPrice)?netPrice:null,
    imageUrl,
    retailer:retailer.label,
    retailerId:retailer.id,
    source:'retail',
    sourceUrl
  };
}

function cleanName(name,label){
  return String(name||'')
    .replace(/\s*[｜|:].*$/,'')
    .replace(/\s*[-–—]\s*(?:ネットスーパー|オンラインショップ).*$/i,'')
    .replace(new RegExp('\\s*[-–—｜|:]?\\s*'+escapeRegExp(label)+'.*$'),'')
    .replace(/\s+/g,' ')
    .trim();
}

function escapeRegExp(s){
  return String(s).replace(/[.*+?^$()|[\]\\{}]/g,'\\$&');
}

function decodeAttr(s){
  return String(s||'')
    .replace(/&amp;/g,'&')
    .replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'")
    .replace(/&nbsp;/g,' ')
    .trim();
}

async function getHtml(url){
  try{
    const r=await fetch(url,{
      headers:{
        accept:'text/html,application/xhtml+xml',
        'user-agent':'seiyu-asa/0.5 (+https://github.com/shinp-dev/seiyu-asa)'
      },
      cf:{cacheTtl:21600,cacheEverything:true}
    });
    if(!r.ok)return '';
    return await r.text();
  }catch(e){
    return '';
  }
}

function clean(s){
  return decodeAttr(String(s||'')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' '))
    .replace(/\s+/g,' ')
    .trim();
}

function json(v,status=200){
  return new Response(JSON.stringify(v),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'public, max-age=1800'
    }
  });
}
