export async function onRequestGet(ctx){
  const u=new URL(ctx.request.url);
  const jan=(u.searchParams.get('jan')||'').replace(/[^0-9]/g,'');
  if(!/^\d{8,14}$/.test(jan)) return json({product:null,error:'invalid_jan'},400);

  const fields=[
    'code','product_name','product_name_ja','brands','quantity','serving_size',
    'nutriments','image_front_small_url','categories_tags'
  ].join(',');
  const target='https://world.openfoodfacts.org/api/v3/product/'+encodeURIComponent(jan)+'?fields='+encodeURIComponent(fields);

  try{
    const r=await fetch(target,{
      headers:{
        accept:'application/json',
        'user-agent':'seiyu-asa/0.3 (+https://github.com/shinp-dev/seiyu-asa)'
      },
      cf:{cacheTtl:86400,cacheEverything:true}
    });
    if(!r.ok) return json({product:null},200);
    const j=await r.json();
    const p=j&&j.product;
    if(!p) return json({product:null},200);

    const n=p.nutriments||{};
    const serving=num(n['energy-kcal_serving']);
    const per100=num(n['energy-kcal_100g']);
    const name=p.product_name_ja||p.product_name||'';
    return json({
      product:{
        jan,
        name,
        brand:p.brands||'',
        quantity:p.quantity||'',
        servingSize:p.serving_size||'',
        kcal:Number.isFinite(serving)?serving:(Number.isFinite(per100)?per100:null),
        imageUrl:p.image_front_small_url||'',
        categories:Array.isArray(p.categories_tags)?p.categories_tags:[],
        source:'openfoodfacts',
        sourceUrl:'https://world.openfoodfacts.org/product/'+encodeURIComponent(jan)
      }
    });
  }catch(e){
    return json({product:null,error:'openfoodfacts_fetch_failed'},200);
  }
}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function json(v,status=200){
  return new Response(JSON.stringify(v),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'public, max-age=3600'
    }
  });
}
