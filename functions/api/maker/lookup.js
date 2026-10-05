const MAKERS=[
  {
    prefix:'4903110',
    id:'yamazaki',
    brand:'ヤマザキ',
    manufacturer:'山崎製パン株式会社',
    officialUrl:'https://www.yamazakipan.co.jp/',
    lookupUrl:jan=>'https://search.yamazakipan.co.jp/search?site=V8IJN3JX&charset=UTF-8&design=3&query='+encodeURIComponent(jan)
  },
  {
    prefix:'4902410',
    id:'fujipan',
    brand:'フジパン',
    manufacturer:'フジパン株式会社',
    officialUrl:'https://www.fujipan.co.jp/',
    lookupUrl:jan=>'https://www.fujipan.co.jp/product/zenkoku.html?jan='+encodeURIComponent(jan)
  },
  {
    prefix:'4901820',
    id:'pasco',
    brand:'Pasco',
    manufacturer:'敷島製パン株式会社',
    officialUrl:'https://www.pasconet.co.jp/',
    lookupUrl:jan=>'https://www.pasconet.co.jp/products/search/?_filter=product_post&s='+encodeURIComponent(jan)
  }
];

export async function onRequestGet(ctx){
  const u=new URL(ctx.request.url);
  const jan=(u.searchParams.get('jan')||'').replace(/[^0-9]/g,'');
  if(!/^\d{8,14}$/.test(jan))return json({maker:null,product:null,error:'invalid_jan'},400);

  const maker=MAKERS.find(x=>jan.startsWith(x.prefix));
  if(!maker)return json({maker:null,product:null});

  const publicMaker={
    id:maker.id,
    brand:maker.brand,
    manufacturer:maker.manufacturer,
    officialUrl:maker.officialUrl,
    lookupUrl:maker.lookupUrl(jan)
  };

  try{
    const product=await lookupOfficial(maker,jan);
    return json({maker:publicMaker,product});
  }catch(e){
    return json({maker:publicMaker,product:null,error:'maker_lookup_failed'});
  }
}

async function lookupOfficial(maker,jan){
  if(maker.id==='yamazaki'){
    return lookupSearchPage(maker.lookupUrl(jan),maker,jan);
  }

  const targets=maker.id==='fujipan'
    ?[
      'https://www.fujipan.co.jp/product/zenkoku.html',
      'https://www.fujipan.co.jp/product/kanto.html',
      'https://www.fujipan.co.jp/news/'
    ]
    :[
      maker.lookupUrl(jan),
      'https://www.pasconet.co.jp/products/'
    ];

  for(const target of targets){
    const html=await getHtml(target);
    if(!html)continue;
    const p=extractProduct(html,target,maker,jan);
    if(p)return p;
  }
  return null;
}

async function lookupSearchPage(target,maker,jan){
  const html=await getHtml(target);
  if(!html)return null;
  const direct=extractProduct(html,target,maker,jan);
  if(direct)return direct;

  const links=Array.from(html.matchAll(/href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map(m=>({href:m[1],label:clean(m[2])}))
    .filter(x=>x.label&&x.href)
    .slice(0,12);

  for(const link of links){
    let href=link.href;
    try{href=new URL(href,target).href}catch(e){continue}
    if(!href.includes('yamazakipan.co.jp'))continue;
    if(/search\.yamazakipan\.co\.jp/.test(href))continue;
    const page=await getHtml(href);
    if(!page)continue;
    const p=extractProduct(page,href,maker,jan);
    if(p)return p;
  }
  return null;
}

function extractProduct(html,sourceUrl,maker,jan){
  const compact=String(html||'').replace(/[\s\-‐‑–—]/g,'');
  if(!compact.includes(jan))return null;

  const text=clean(html);
  const h1=clean((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||'');
  const h2=clean((html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)||[])[1]||'');
  const title=clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'');
  const name=(h1||h2||title)
    .replace(/\s*[｜|].*$/,'')
    .replace(/^商品詳細\s*/,'')
    .trim();

  const normalized=text.replace(/[\s\-‐‑–—]/g,'');
  const pos=normalized.indexOf(jan);
  const near=pos>=0?normalized.slice(Math.max(0,pos-500),pos+900):normalized;
  const kcalRaw=(near.match(/(?:熱量|エネルギー)[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)\s*kcal/i)||[])[1];
  const basis=(text.match(/(?:栄養成分表示|栄養成分基準)[（(]?([^）)]{1,30})[）)]?/i)||[])[1]||'';

  return{
    jan,
    name:name||maker.brand+'商品',
    brand:maker.brand,
    manufacturer:maker.manufacturer,
    kcal:kcalRaw?Number(kcalRaw):null,
    kcalBasis:clean(basis),
    quantity:'',
    imageUrl:'',
    source:'maker',
    sourceUrl
  };
}

async function getHtml(url){
  try{
    const r=await fetch(url,{
      headers:{
        accept:'text/html,application/xhtml+xml',
        'user-agent':'seiyu-asa/0.4 (+https://github.com/shinp-dev/seiyu-asa)'
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
  return String(s||'')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
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
