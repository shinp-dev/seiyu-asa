const BASE='https://netsuper.rakuten.co.jp';

export async function onRequestGet(ctx){
  const u=new URL(ctx.request.url);
  const jan=(u.searchParams.get('jan')||'').replace(/[^0-9]/g,'');
  if(!/^\d{8,14}$/.test(jan))return json({item:null,error:'invalid_jan'},400);

  const target=BASE+'/seiyu/item/'+encodeURIComponent(jan)+'/';
  const html=await fetchPage(target);
  let item=html?parseItem(html,jan,target,false):null;
  let via='direct';

  // Third-party Reader is explicitly opt-in; never relay this JAN otherwise.
  if((!item||item.kcal==null)&&u.searchParams.get('reader')==='1'){
    const markdown=await fetchReader(target);
    const fallback=markdown?parseItem(markdown,jan,target,true):null;
    if(fallback){
      via='jina-reader';
      if(!item)item=fallback;
      else if(item.kcal==null&&fallback.kcal!=null){
        item.kcal=fallback.kcal;
        item.kcalBasis=fallback.kcalBasis;
        item.nutritionSource=fallback.nutritionSource;
        item.nutritionSourceUrl=fallback.nutritionSourceUrl;
      }
    }
  }
  return json({item,sourceUrl:target,fetchVia:via});
}

function parseItem(body,jan,target,markdown){
  const raw=String(body||'');
  const text=clean(raw);
  const heading=markdown
    ?((raw.match(/^#\s+(.+)$/m)||[])[1]||'')
    :((raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||'');
  const name=clean(heading).replace(/^〖[^〗]+〗/,'').trim();
  if(!name||/サイト内検索|検索結果|ページが見つかりません/i.test(name))return null;
  if(!/商品説明|かごに追加|栄養成分/.test(text))return null;

  const anchor=text.indexOf(name);
  const near=anchor>=0?text.slice(anchor,anchor+700):text;
  const taxIncluded=num((near.match(/税込\s*([0-9][0-9,]*)\s*円/)||[])[1]);
  const prices=Array.from(near.matchAll(/([0-9][0-9,]*)\s*円/g))
    .map(m=>num(m[1])).filter(Number.isFinite);
  const price=prices.find(v=>v!==taxIncluded)||prices[0]||null;
  const size=(near.match(/(\d+(?:\.\d+)?\s*(?:g|kg|ml|mL|L|本|個|袋入|袋|食|枚|本入))/i)||[])[1]||'';
  const nutrition=parseNutrition(text);

  return{
    jan,name,size,price,taxIncludedPrice:taxIncluded||price,
    kcal:nutrition.kcal,kcalBasis:nutrition.kcalBasis,
    nutritionSource:nutrition.kcal!=null?'西友ネットスーパー':'',
    nutritionSourceUrl:nutrition.kcal!=null?target:'',
    source:'seiyu',sourceUrl:target
  };
}

function parseNutrition(text){
  let from=0;
  while((from=text.indexOf('栄養成分',from))>=0){
    const section=text.slice(from,from+350);
    const energy=section.match(/(?:エネルギー|熱量)\s*[：:]?\s*([0-9]+(?:\.[0-9]+)?)\s*kcal/i);
    if(energy){
      const kcal=num(energy[1]);
      const basis=(section.slice(0,energy.index).match(/((?:1|１)\s*(?:個|袋|包装|食|本|パック|枚)(?:\s*\d+\s*g)?\s*(?:当り|当たり|あたり)|100\s*(?:g|ml)\s*(?:当り|当たり|あたり))/i)||[])[1]||'';
      if(kcal!==null)return{kcal,kcalBasis:basis||'掲載単位を確認'};
    }
    from+=4;
  }
  return{kcal:null,kcalBasis:''};
}

async function fetchPage(url){
  try{
    const r=await fetch(url,{
      headers:{
        accept:'text/html,application/xhtml+xml',
        'accept-language':'ja,en-US;q=0.9',
        'user-agent':'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'
      },
      cf:{cacheTtl:1800,cacheEverything:true}
    });
    return r.ok?await r.text():'';
  }catch(e){return ''}
}
async function fetchReader(url){
  try{
    const r=await fetch('https://r.jina.ai/'+url,{
      headers:{accept:'text/plain',dnt:'1','x-respond-with':'content'},
      cache:'no-store'
    });
    return r.ok?await r.text():'';
  }catch(e){return ''}
}
function clean(s){
  return String(s||'')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
}
function num(v){
  if(v==null||v==='')return null;
  const n=Number(String(v).replace(/,/g,''));
  return Number.isFinite(n)?n:null;
}
function json(v,status=200){
  return new Response(JSON.stringify(v),{
    status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
  });
}
