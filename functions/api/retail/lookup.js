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
  const allowReader=u.searchParams.get('reader')==='1';
  if(!requested.length)return json({product:null,attempted:[],readerUsed:false});

  const selected=RETAILERS.filter(x=>requested.includes(x.id));
  const attempted=[];

  for(const retailer of selected){
    attempted.push(retailer.id);
    const sourceUrl=retailer.url(jan);
    let body=await getHtml(sourceUrl);
    let readerUsed=false;
    let product=body?extractProduct(body,sourceUrl,retailer,jan):null;

    if(!product&&allowReader){
      body=await getReaderText(sourceUrl);
      readerUsed=!!body;
      product=body?extractReaderProduct(body,sourceUrl,retailer,jan):null;
    }

    if(product){
      product.fetchVia=readerUsed?'jina-reader':'direct';
      return json({product,attempted,readerUsed});
    }
  }
  return json({product:null,attempted,readerUsed:false});
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

function extractReaderProduct(body,sourceUrl,retailer,jan){
  const raw=String(body||'');
  const compact=raw.replace(/[\s\-‐‑–—]/g,'');
  if(!compact.includes(jan))return null;

  const titleLine=(raw.match(/^Title:\s*(.+)$/mi)||[])[1]||'';
  const headings=Array.from(raw.matchAll(/^#{1,3}\s+(.+)$/gm)).map(m=>m[1].trim());
  const heading=headings.find(x=>!/(楽天全国スーパー|ネットスーパー|オンラインショップ|商品詳細)/.test(x))||headings[0]||'';
  const name=cleanName(heading||titleLine,retailer.label);
  if(!name)return null;

  const taxIncluded=(raw.match(/税込[^0-9]{0,30}([0-9][0-9,]*(?:\.[0-9]+)?)\s*円/i)||[])[1];
  const anyPrice=(raw.match(/([0-9][0-9,]*(?:\.[0-9]+)?)\s*円/)||[])[1];
  const priceText=taxIncluded||anyPrice||'';
  const netPrice=priceText?Number(priceText.replace(/,/g,'')):null;
  const quantity=(raw.match(/(?:^|\s)(\d+(?:\.\d+)?\s*(?:g|kg|ml|mL|L|個|本|袋|枚|食))(?:\s|$)/m)||[])[1]||'';

  return{
    jan,
    name,
    brand:'',
    manufacturer:'',
    quantity,
    netPrice:Number.isFinite(netPrice)?netPrice:null,
    imageUrl:'',
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

async function getReaderText(url){
  try{
    const r=await fetch('https://r.jina.ai/'+url,{
      headers:{
        accept:'text/plain',
        'dnt':'1',
        'x-respond-with':'content'
      },
      cache:'no-store'
    });
    if(!r.ok)return '';
    return await r.text();
  }catch(e){
    return '';
  }
}

async function getHtml(url){
  try{
    const r=await fetch(url,{
      headers:{
        accept:'text/html,application/xhtml+xml',
        'accept-language':'ja,en-US;q=0.9,en;q=0.8',
        'cache-control':'no-cache',
        'user-agent':'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'
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
      'cache-control':'no-store'
    }
  });
}
