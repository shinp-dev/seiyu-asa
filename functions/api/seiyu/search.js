const BASE='https://netsuper.rakuten.co.jp';
export async function onRequestGet(ctx){
  const u=new URL(ctx.request.url),q=(u.searchParams.get('q')||'').trim();
  if(!q)return json({items:[]});
  const target=BASE+'/seiyu/search/?keyword='+encodeURIComponent(q);
  try{
    const r=await fetch(target,{headers:{accept:'text/html,application/xhtml+xml','user-agent':'seiyu-asa/0.2'},cf:{cacheTtl:900,cacheEverything:true}});
    if(!r.ok)return json({items:[],sourceUrl:target});
    const html=await r.text(),items=[],re=/<a[^>]+href=["']([^"']*\/seiyu\/item\/\d+\/?)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while((m=re.exec(html))&&items.length<12){
      const url=m[1].startsWith('http')?m[1]:BASE+(m[1].startsWith('/')?'':'/')+m[1];
      const name=clean(m[2]);
      if(!name||items.some(x=>x.url===url))continue;
      const text=clean(html.slice(re.lastIndex,re.lastIndex+1800));
      const prices=Array.from(text.matchAll(/([0-9][0-9,]{0,7})\s*円/g)).map(x=>Number(x[1].replace(/,/g,''))).filter(Number.isFinite);
      const size=(text.match(/(\d+(?:\.\d+)?\s*(?:g|kg|ml|L|本|個|袋|食|枚))/i)||[])[1]||'';
      items.push({name:name,url:url,price:prices[0]||null,taxIncludedPrice:prices[1]||prices[0]||null,size:size});
    }
    return json({items:items,sourceUrl:target,note:'公開見学ページの参考価格。実際の品揃え・価格はログイン後の配送エリア等で異なる場合があります。'});
  }catch(e){return json({items:[],error:'seiyu_fetch_failed'});}
}
function clean(s){return String(s).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();}
function json(v){return new Response(JSON.stringify(v),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=600'}});}