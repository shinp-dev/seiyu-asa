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
  },
  {
    id:'rakutenmart',
    label:'楽天マート',
    url:jan=>'https://sm.rakuten.co.jp/item/'+encodeURIComponent(jan)
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
  const imageUrl=decodeAttr((raw.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)||[])[1]||'');
  const nutrition=extractNutrition(text);

  return{
    jan,
    name,
    brand:'',
    manufacturer:'',
    quantity:'',
    imageUrl,
    kcal:nutrition.kcal,
    kcalBasis:nutrition.kcalBasis,
    nutritionSource:nutrition.kcal!=null?retailer.label:'',
    nutritionSourceUrl:nutrition.kcal!=null?sourceUrl:'',
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

  const quantity=(raw.match(/(?:^|\s)(\d+(?:\.\d+)?\s*(?:g|kg|ml|mL|L|個|本|袋|枚|食))(?:\s|$)/m)||[])[1]||'';
  const nutrition=extractNutrition(raw);

  return{
    jan,
    name,
    brand:'',
    manufacturer:'',
    quantity,
    imageUrl:'',
    kcal:nutrition.kcal,
    kcalBasis:nutrition.kcalBasis,
    nutritionSource:nutrition.kcal!=null?retailer.label:'',
    nutritionSourceUrl:nutrition.kcal!=null?sourceUrl:'',
    retailer:retailer.label,
    retailerId:retailer.id,
    source:'retail',
    sourceUrl
  };
}

function extractNutrition(text){
  let pos=0;
  while((pos=text.indexOf('栄養成分',pos))>=0){
    const near=text.slice(pos,pos+350);
    const m=near.match(/(?:エネルギー|熱量)\s*[：:]?\s*(\d+(?:\.\d+)?)\s*kcal/i);
    if(m){
      const kcal=Number(m[1]);
      const basis=(near.slice(0,m.index).match(/((?:1|１)\s*(?:個|包装|袋|食|本|パック)(?:\s*\d+\s*g)?\s*(?:当り|当たり|あたり)|100\s*(?:g|ml)\s*(?:当り|当たり|あたり))/i)||[])[1]||'';
      if(Number.isFinite(kcal))return{kcal,kcalBasis:basis||'掲載単位を確認'};
    }
    pos+=4;
  }
  return{kcal:null,kcalBasis:''};
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
    const buf=await r.arrayBuffer();
    return decodeHtml(buf,r.headers.get('content-type')||'');
  }catch(e){
    return '';
  }
}

function decodeHtml(buf,contentType){
  const bytes=new Uint8Array(buf);
  const head=new TextDecoder('utf-8',{fatal:false}).decode(bytes.slice(0,4096));
  const declared=((contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i)||[])[1]
    ||(head.match(/<meta[^>]+charset\s*=\s*["']?([^"'\s/>]+)/i)||[])[1]
    ||(head.match(/<meta[^>]+content=["'][^"']*charset\s*=\s*([^;"'\s]+)/i)||[])[1]
    ||'utf-8').toLowerCase();

  const encoding=/shift[_-]?jis|sjis|windows-31j|cp932/.test(declared)?'shift_jis'
    :/euc[_-]?jp/.test(declared)?'euc-jp'
    :'utf-8';
  try{return new TextDecoder(encoding,{fatal:false}).decode(bytes)}
  catch(e){return new TextDecoder('utf-8',{fatal:false}).decode(bytes)}
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
