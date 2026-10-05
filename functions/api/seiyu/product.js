const BASE='https://netsuper.rakuten.co.jp';

export async function onRequestGet(ctx){
  const u=new URL(ctx.request.url);
  const jan=(u.searchParams.get('jan')||'').replace(/[^0-9]/g,'');
  if(!/^\d{8,14}$/.test(jan)) return json({item:null,error:'invalid_jan'},400);

  const target=BASE+'/seiyu/item/'+encodeURIComponent(jan)+'/';
  try{
    const r=await fetch(target,{
      headers:{
        accept:'text/html,application/xhtml+xml',
        'user-agent':'seiyu-asa/0.3 (+https://github.com/shinp-dev/seiyu-asa)'
      },
      cf:{cacheTtl:21600,cacheEverything:true}
    });
    if(!r.ok) return json({item:null,sourceUrl:target},r.status===404?404:200);

    const html=await r.text();
    const text=clean(html);
    const h1=(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1];
    const name=clean(h1||'');
    if(!name || !/かごに追加|商品説明/.test(text)) return json({item:null,sourceUrl:target},404);

    const taxIncluded=number((text.match(/税込\s*([0-9][0-9,]*)\s*円/)||[])[1]);
    const namePos=text.indexOf(name);
    const near=namePos>=0?text.slice(namePos,namePos+500):text;
    const prices=Array.from(near.matchAll(/([0-9][0-9,]*)\s*円/g))
      .map(m=>number(m[1])).filter(Number.isFinite);
    const price=prices.find(v=>v!==taxIncluded)||prices[0]||null;
    const size=(near.match(/(\d+(?:\.\d+)?\s*(?:g|kg|ml|mL|L|本|個|袋入|袋|食|枚|本入))/i)||[])[1]||'';
    const nutrition=(text.match(/栄養成分\s+(.{1,100}?)\s+当たり[：:]?\s*エネルギー\s*([0-9]+(?:\.[0-9]+)?)\s*kcal/i)||[]);
    const kcal=number(nutrition[2]||(text.match(/エネルギー\s*([0-9]+(?:\.[0-9]+)?)\s*kcal/i)||[])[1]);
    const kcalBasis=clean(nutrition[1]||'');

    return json({
      item:{
        jan,
        name,
        size,
        price,
        taxIncludedPrice:taxIncluded||price,
        kcal:Number.isFinite(kcal)?kcal:null,
        kcalBasis:kcalBasis,
        source:'seiyu',
        sourceUrl:target
      },
      note:'西友ネットスーパー見学ページの参考情報です。実際の品揃え・価格はログイン後の配送エリア等で異なる場合があります。'
    });
  }catch(e){
    return json({item:null,error:'seiyu_fetch_failed',sourceUrl:target},200);
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
function number(v){
  if(v==null||v==='')return null;
  const n=Number(String(v).replace(/,/g,''));
  return Number.isFinite(n)?n:null;
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
