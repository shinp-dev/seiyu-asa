const CAT={snack:'お菓子',lunch:'昼メシ',drink:'飲み物'};
const ICON={snack:'🍫',lunch:'🍙',drink:'🥤'};
const SOURCE={demo:'デモ',registered:'登録済み',seiyu:'西友ネット',openfoodfacts:'商品DB',manual:'手入力'};
const REASONS={expensive:'高い',small:'量が足りない',calorie:'カロリーの割に満足しない',taste:'味が好みじゃない',other:'その他'};
const SEED=[
{id:'s1',jan:'4900000000016',name:'クリームパン',category:'snack',storePrice:138,netPrice:158,kcal:356,source:'demo'},
{id:'s2',jan:'4900000000023',name:'チョコバー',category:'snack',storePrice:48,netPrice:58,kcal:118,source:'demo'},
{id:'s3',jan:'4900000000030',name:'ミックスナッツ 小袋',category:'snack',storePrice:158,netPrice:178,kcal:186,source:'demo'},
{id:'l1',jan:'4900000000105',name:'カツ丼',category:'lunch',storePrice:498,netPrice:538,kcal:892,source:'demo'},
{id:'l2',jan:'4900000000112',name:'鮭おにぎり + たまごサンド',category:'lunch',storePrice:398,netPrice:438,kcal:486,source:'demo'},
{id:'l3',jan:'4900000000129',name:'おにぎり2個 + ゆでたまご',category:'lunch',storePrice:358,netPrice:398,kcal:421,source:'demo'},
{id:'d1',jan:'4900000000201',name:'コーラ 500ml',category:'drink',storePrice:108,netPrice:128,kcal:225,source:'demo'},
{id:'d2',jan:'4900000000218',name:'無糖茶 600ml',category:'drink',storePrice:88,netPrice:98,kcal:0,source:'demo'},
{id:'d3',jan:'4900000000225',name:'炭酸水 500ml',category:'drink',storePrice:79,netPrice:89,kcal:0,source:'demo'}];

const K={
  catalog:'sa.catalog',
  history:'sa.history',
  stats:'sa.stats',
  prefs:'sa.prefs',
  prices:'sa.prices',
  decisions:'sa.decisions'
};
const S={
  route:'today',
  focus:'drink',
  fixed:'d1',
  rec:null,
  last:null,
  lastRec:{},
  stream:null,
  detector:null,
  reasonFor:null,
  productFilter:'all'
};

const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=n=>n!==null&&n!==''&&Number.isFinite(Number(n))?'¥'+Math.round(Number(n)).toLocaleString('ja-JP'):'—';
const kc=n=>n!==null&&n!==''&&Number.isFinite(Number(n))?Math.round(Number(n)).toLocaleString('ja-JP')+' kcal':'— kcal';
const signed=(n,suffix)=>!Number.isFinite(n)?'—':(n>0?'+':'')+Math.round(n).toLocaleString('ja-JP')+(suffix||'');
const uid=()=>Date.now()+'-'+Math.random().toString(36).slice(2,7);

function localDate(d){
  d=d||new Date();
  const p=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
}
function today(){return localDate(new Date())}
function prettyDate(v){
  const d=new Date(v+'T00:00:00');
  if(Number.isNaN(d.getTime()))return v;
  const w=['日','月','火','水','木','金','土'][d.getDay()];
  return (d.getMonth()+1)+'/'+d.getDate()+' ('+w+')';
}
function normalizeJan(v){return String(v||'').replace(/[^0-9]/g,'')}
function validJan(v){return /^\d{8,14}$/.test(normalizeJan(v))}
function toast(t){
  const e=document.createElement('div');
  e.className='toast';
  e.textContent=t;
  document.body.appendChild(e);
  setTimeout(()=>e.classList.add('show'),10);
  setTimeout(()=>e.remove(),2100);
}

function loadPrefs(){
  const p=read(K.prefs,{});
  if(p.focus&&CAT[p.focus])S.focus=p.focus;
  if(p.fixed)S.fixed=p.fixed;
}
function savePrefs(){write(K.prefs,{focus:S.focus,fixed:S.fixed})}

function catalog(){
  const m=new Map(SEED.map(p=>[p.id,p]));
  read(K.catalog,[]).forEach(p=>m.set(p.id,p));
  return Array.from(m.values());
}
function saveProduct(p){
  const a=read(K.catalog,[]);
  const i=a.findIndex(x=>x.id===p.id||(p.jan&&x.jan===p.jan));
  if(i>=0)a[i]=Object.assign({},a[i],p);
  else a.push(p);
  write(K.catalog,a);
}
function categoryCandidates(c,includeNg){
  const all=catalog().filter(p=>p.category===c&&(includeNg||!ng(p.id)));
  const real=all.filter(p=>p.source!=='demo');
  return real.length?real:all;
}
function productById(id){return catalog().find(x=>x.id===id)||null}

function stats(){return read(K.stats,{})}
function st(id){return stats()[id]||{proposed:0,selected:0,good:0,meh:0,ng:0}}
function mod(id,key,delta){
  const a=stats();
  a[id]=a[id]||{proposed:0,selected:0,good:0,meh:0,ng:0};
  a[id][key]=Math.max(0,(a[id][key]||0)+delta);
  write(K.stats,a);
}
function ng(id){return st(id).ng>0}
function clearNg(id){
  const a=stats();
  if(a[id])a[id].ng=0;
  write(K.stats,a);
}
function history(){return read(K.history,[])}
function eatenCount(id){return history().filter(h=>h.productId===id&&h.status==='eaten').length}
function lastReason(id){
  return history().slice().reverse().find(h=>h.productId===id&&h.reason&&['meh','ng'].includes(h.feedback))||null;
}
function recentProductIds(days){
  const min=new Date();
  min.setDate(min.getDate()-(days||7));
  const key=localDate(min);
  return history().filter(h=>h.date>=key&&h.status==='eaten').map(h=>h.productId);
}

function score(p){
  const x=st(p.id);
  const r=x.proposed?x.selected/x.proposed:.45;
  const recent=recentProductIds(5).filter(id=>id===p.id).length;
  const kcal=Number.isFinite(Number(p.kcal))?Number(p.kcal):250;
  const price=Number.isFinite(Number(p.storePrice))?Number(p.storePrice):200;
  return r*100+x.good*10-x.meh*9-x.ng*80-recent*13-kcal/18-price/28+Math.random()*18;
}
function pick(c){
  let a=categoryCandidates(c,false);
  if(a.length>1&&S.lastRec[c])a=a.filter(p=>p.id!==S.lastRec[c]);
  return a.sort((a,b)=>score(b)-score(a))[0]||null;
}
function resolveFixed(){
  let p=productById(S.fixed);
  if(!p||p.category!==S.focus||ng(p.id)){
    p=categoryCandidates(S.focus,false)[0]||null;
    S.fixed=p?p.id:null;
    savePrefs();
  }
  return p;
}
function makeRec(){
  const r={};
  Object.keys(CAT).forEach(c=>{
    let p=c===S.focus?resolveFixed():null;
    p=p||pick(c);
    if(p){
      r[c]=p;
      mod(p.id,'proposed',1);
    }
  });
  S.rec=r;
  return r;
}

function sourceLabel(p){return SOURCE[p.source]||p.source||''}
function priceDelta(p){
  if(p.netPrice===null||p.netPrice===''||p.storePrice===null||p.storePrice==='')return null;
  const n=Number(p.netPrice),s=Number(p.storePrice);
  return Number.isFinite(n)&&Number.isFinite(s)?n-s:null;
}
function card(p,opts){
  opts=opts||{};
  const x=st(p.id);
  const rate=x.proposed?Math.round(x.selected/x.proposed*100):0;
  const d=priceDelta(p);
  const reason=lastReason(p.id);
  const priceLine=p.storePrice!=null
    ?'店頭 '+yen(p.storePrice)+(p.netPrice!=null?' / ネット '+yen(p.netPrice)+(d!==null?' ('+(d>=0?'+':'')+Math.round(d)+'円)':''):'')
    :(p.netPrice!=null?'ネット参考 '+yen(p.netPrice)+' / 店頭未登録':'価格未登録');
  const mainPrice=opts.preferNet&&p.storePrice==null?p.netPrice:p.storePrice;
  return '<article class="product card '+(ng(p.id)?'is-ng':'')+'">'+
    '<div class="ico">'+ICON[p.category]+'</div>'+
    '<div class="grow"><div>'+
      '<span class="badge">'+CAT[p.category]+'</span>'+
      (p.source==='demo'?'<span class="badge demo">DEMO</span>':'')+
      (ng(p.id)?'<span class="badge bad">NG</span>':'')+
    '</div>'+
    '<b>'+esc(p.name)+'</b>'+
    '<small>'+priceLine+'</small>'+
    '<small>選ばれ率 '+rate+'% / 食べた '+eatenCount(p.id)+'回'+(reason?' / 前回: '+esc(reason.reason):'')+'</small>'+
    '</div>'+
    '<div class="num"><b>'+yen(mainPrice)+'</b><small>'+kc(p.kcal)+'</small></div>'+
    (opts.actions&&ng(p.id)?'<button class="tiny-link" data-unng="'+esc(p.id)+'">NG解除</button>':'')+
    (opts.choose?'<button class="tiny-link choose" data-use-product="'+esc(p.id)+'">今日これを優先</button>':'')+
  '</article>';
}

function recentBaseline(){
  const rows=history().filter(h=>h.status==='eaten');
  const by={};
  rows.forEach(h=>{
    (by[h.date]||(by[h.date]=[])).push(h);
  });
  const days=Object.keys(by).sort().reverse().slice(0,14).map(k=>{
    const xs=by[k];
    return {
      date:k,
      price:xs.reduce((a,x)=>a+(Number(x.price)||0),0),
      kcal:xs.reduce((a,x)=>a+(Number(x.kcal)||0),0)
    };
  }).filter(x=>x.price||x.kcal);
  if(days.length<2)return null;
  return {
    days:days.length,
    price:days.reduce((a,x)=>a+x.price,0)/days.length,
    kcal:days.reduce((a,x)=>a+x.kcal,0)/days.length
  };
}

function renderToday(){
  const r=S.rec||makeRec();
  const realCount=catalog().filter(p=>p.source!=='demo').length;
  const ps=Object.values(r);
  const price=ps.reduce((a,p)=>a+(Number(p.storePrice)||0),0);
  const cal=ps.reduce((a,p)=>a+(Number(p.kcal)||0),0);
  const base=recentBaseline();
  const comparison=base
    ?'<p class="compare">最近'+base.days+'日平均より <b>'+signed(price-base.price,'円')+'</b> / <b>'+signed(cal-base.kcal,' kcal')+'</b></p>'
    :'<p class="compare muted">食べた記録が2日分たまると、いつもの朝との差を表示します。</p>';

  return '<section class="hero"><small>出勤前の西友だけ</small><h2>今日の3点、これでどう？</h2><p>お菓子 + 昼メシ + ペットボトル。夕方の買い物は混ぜない。</p></section>'+ (realCount<3?'<section class="onboarding card"><b>まずは自分の西友を育てる</b><p>実商品はまだ '+realCount+' 件。店頭でバーコードを読むほど、架空のDEMOではなく普段の商品から提案できるようになります。</p><button class="secondary small" data-jump="scan">1つスキャンする</button></section>':'')+
  '<section class="card focus"><b>今日はこれを固定</b><div class="pills">'+
    Object.keys(CAT).map(c=>'<button data-focus="'+c+'" class="pill '+(S.focus===c?'on':'')+'">'+CAT[c]+'</button>').join('')+
    '</div><select id="fixed">'+categoryCandidates(S.focus,false).map(p=>'<option value="'+p.id+'" '+(p.id===S.fixed?'selected':'')+'>'+esc(p.name)+(p.source==='demo'?' (DEMO)':'')+'</option>').join('')+'</select></section>'+
  '<div class="title"><h3>今日のセット</h3><button id="reroll">別のセット</button></div>'+
  ps.map(p=>card(p)).join('')+
  '<section class="summary"><small>合計</small><strong>'+yen(price)+' / '+kc(cal)+'</strong>'+comparison+
    '<p>'+CAT[S.focus]+'は固定。NG商品と最近食べたものを避けながら、残りを提案しています。</p></section>'+
  '<button class="primary" id="accept">これでいく</button>'+
  '<button class="secondary" data-jump="scan">店頭の商品をスキャンして比べる</button>';
}

function accept(){
  const h=history();
  for(let i=h.length-1;i>=0;i--){
    if(h[i].date===today()&&h[i].status==='planned'&&(h[i].slot==='morning'||!h[i].slot)){
      mod(h[i].productId,'selected',-1);
      h.splice(i,1);
    }
  }
  const setId='morning-'+Date.now();
  Object.values(S.rec||{}).forEach(p=>{
    h.push({
      id:uid(),
      setId:setId,
      slot:'morning',
      date:today(),
      createdAt:new Date().toISOString(),
      productId:p.id,
      jan:p.jan||'',
      name:p.name,
      category:p.category,
      price:p.storePrice,
      netPrice:p.netPrice,
      kcal:p.kcal,
      status:'planned',
      feedback:null,
      reason:null
    });
    mod(p.id,'selected',1);
  });
  write(K.history,h);
  toast('今日の3点を記録しました');
  S.route='history';
  render();
}

function renderScan(){
  return '<section class="hero"><small>店頭で迷ったら</small><h2>バーコードで判定</h2><p>JAN/EANを読んで、西友ネット参考価格・店頭価格・カロリー・過去の後悔をまとめて確認。</p></section>'+
  '<section class="card scan"><div class="video"><video id="video" playsinline muted></video><i></i></div>'+
  '<div class="row"><button class="primary small" id="start">カメラで読む</button><button class="secondary small" id="stop">停止</button></div>'+
  '<div class="manual"><input id="jan" inputmode="numeric" autocomplete="off" placeholder="JANコードを手入力"><button id="lookup">検索</button></div>'+
  '<label class="barcode-upload">バーコード写真から読む<input id="barcode-image" type="file" accept="image/*" capture="environment"></label>'+
  '<p class="mini-note">自動読取に未対応でもJAN手入力で使えます。</p></section>'+
  '<div id="result">'+(S.last?scanResult(S.last):'')+'</div>';
}
function scanResult(r){
  if(r.error)return '<div class="error">'+esc(r.error)+'</div>';
  const p=r.product;
  const d=priceDelta(p);
  const reason=lastReason(p.id);
  let html='';

  if(ng(p.id)){
    html+='<section class="regret"><b>これ、前に「もう買わない」にしています。</b>'+
      '<p>'+(reason?esc(reason.reason):'過去の後悔記録があります。')+'</p>'+
      '<button class="secondary small" data-unng="'+esc(p.id)+'">今回は候補に戻す</button></section>';
  }else if(reason){
    html+='<section class="regret mild"><b>前に少し後悔しています。</b><p>'+esc(reason.reason)+'</p></section>';
  }

  html+='<section class="card result">'+
    '<div class="result-head">'+
      (p.imageUrl?'<img src="'+esc(p.imageUrl)+'" alt="" loading="lazy">':'')+
      '<div><span class="badge">JAN '+esc(p.jan)+'</span>'+
      (sourceLabel(p)?'<span class="badge source">'+esc(sourceLabel(p))+'</span>':'')+
      '<h3>'+esc(p.name)+'</h3>'+
      (p.quantity?'<small>'+esc(p.quantity)+'</small>':'')+
      '</div></div>'+
    '<div class="metrics"><div><small>店頭</small><b>'+yen(p.storePrice)+'</b></div>'+
    '<div><small>ネット参考</small><b>'+yen(p.netPrice)+'</b></div>'+
    '<div><small>kcal</small><b>'+kc(p.kcal)+'</b>'+(p.kcalBasis?'<em>'+esc(p.kcalBasis)+'</em>':'')+'</div></div>'+
    (d!==null?'<p class="callout">'+(d>=0?'店頭のほうが '+yen(d)+' 安い':'ネット参考のほうが '+yen(Math.abs(d))+' 安い')+'</p>':'<p class="hint">店頭価格を登録するとネット参考価格との差額を出せます。</p>')+
    (p.sourceUrl?'<a class="source-link" target="_blank" rel="noreferrer" href="'+esc(p.sourceUrl)+'">情報元を確認 →</a>':'')+
    registerForm(p)+
    '<button class="secondary" data-use-scan="1">今日の3点でこの商品を優先</button>'+
  '</section>';

  if(r.seiyu&&r.seiyu.length){
    html+='<div class="title"><h3>西友ネット候補</h3><span>見学ページ参考価格</span></div>'+
      r.seiyu.map(x=>'<article class="hit card"><a target="_blank" rel="noreferrer" href="'+esc(x.url)+'"><div><b>'+esc(x.name)+'</b><small>'+esc(x.size||'')+'</small></div><strong>'+yen(x.taxIncludedPrice||x.price)+'</strong></a>'+(x.jan?'<button data-lookup-jan="'+esc(x.jan)+'">詳しく見る</button>':'')+'</article>').join('');
  }else if(p.name&&!/^JAN /.test(p.name)){
    html+='<a class="searchlink" target="_blank" rel="noreferrer" href="'+seiyuUrl(p.name)+'">西友ネットスーパーで名前検索 →</a>';
  }

  const alt=categoryCandidates(p.category,false).filter(x=>x.id!==p.id)
    .sort((a,b)=>{
      const ak=Number.isFinite(Number(a.kcal))?Number(a.kcal):99999;
      const bk=Number.isFinite(Number(b.kcal))?Number(b.kcal):99999;
      return ak-bk;
    }).slice(0,3);
  if(alt.length)html+='<div class="title"><h3>手元の候補</h3><span>同カテゴリ</span></div>'+alt.map(x=>card(x,{choose:true})).join('');
  html+='<button class="secondary find-alts" id="find-alts">'+((r.alternatives&&r.alternatives.length)?'西友の別候補を更新':'西友で代わりを探す')+'</button>';
  if(r.alternatives&&r.alternatives.length){
    html+='<div class="title"><h3>西友で代わりにこれ</h3><span>ネット参考価格</span></div>'+
      r.alternatives.map(x=>card(x,{choose:true,preferNet:true})).join('');
  }
  return html;
}
function registerForm(p){
  return '<form id="register" class="form">'+
    '<input type="hidden" name="jan" value="'+esc(p.jan)+'">'+
    '<label class="wide">商品名<input name="name" value="'+esc(p.name)+'"></label>'+
    '<label>種類<select name="category">'+Object.keys(CAT).map(c=>'<option value="'+c+'" '+(p.category===c?'selected':'')+'>'+CAT[c]+'</option>').join('')+'</select></label>'+
    '<label>店頭価格<input name="storePrice" type="number" min="0" inputmode="numeric" value="'+(p.storePrice==null?'':p.storePrice)+'"></label>'+
    '<label>ネット参考<input name="netPrice" type="number" min="0" inputmode="numeric" value="'+(p.netPrice==null?'':p.netPrice)+'"></label>'+
    '<label>kcal<input name="kcal" type="number" min="0" inputmode="numeric" value="'+(p.kcal==null?'':Math.round(p.kcal))+'"></label>'+
    '<button class="primary small">この内容で保存</button></form>';
}
function seiyuUrl(q){return 'https://netsuper.rakuten.co.jp/seiyu/search/?keyword='+encodeURIComponent(q||'')}
function alternativeKeyword(p){
  const n=p.name||'';
  if(/チョコ|ショコラ/.test(n))return'チョコ';
  if(/ポテト|スナック|チップ/.test(n))return'スナック菓子';
  if(/クッキー|ビスケット/.test(n))return'クッキー';
  if(/アイス/.test(n))return'アイス';
  if(/パン|クロワッサン|デニッシュ/.test(n))return'パン';
  if(/おにぎり/.test(n))return'おにぎり';
  if(/サンド/.test(n))return'サンドイッチ';
  if(/弁当|丼/.test(n))return'弁当';
  if(/コーラ|炭酸/.test(n))return'炭酸飲料';
  if(/茶|ティー/.test(n))return'お茶';
  if(/コーヒー|ラテ/.test(n))return'コーヒー';
  return p.category==='drink'?'飲料':p.category==='lunch'?'お弁当':'お菓子';
}
function alternativeScore(x,current){
  let s=0;
  const ck=Number(current.kcal),xk=Number(x.kcal);
  if(Number.isFinite(ck)&&Number.isFinite(xk))s+=(ck-xk)/10;
  const cp=Number(current.storePrice!=null?current.storePrice:current.netPrice),xp=Number(x.netPrice);
  if(Number.isFinite(cp)&&Number.isFinite(xp))s+=(cp-xp)/20;
  if(x.kcal==null)s-=8;
  return s;
}
async function findSeiyuAlternatives(){
  if(!S.last||!S.last.product)return;
  const p=S.last.product;
  const button=$('#find-alts');
  if(button){button.disabled=true;button.textContent='西友で探しています…'}
  const hits=await searchSeiyu(alternativeKeyword(p));
  const targets=hits.filter(x=>x.jan&&x.jan!==p.jan).slice(0,6);
  const detail=await Promise.all(targets.map(async h=>{
    const j=await fetchJson('/api/seiyu/product?jan='+encodeURIComponent(h.jan),5000);
    const x=j&&j.item;
    if(!x)return null;
    return{
      id:'jan-'+x.jan,jan:x.jan,name:x.name||h.name,category:p.category,
      storePrice:null,netPrice:x.taxIncludedPrice||x.price||h.taxIncludedPrice||h.price||null,
      kcal:x.kcal,kcalBasis:x.kcalBasis||'',quantity:x.size||h.size||'',imageUrl:'',
      source:'seiyu',sourceUrl:x.sourceUrl||h.url
    };
  }));
  S.last.alternatives=detail.filter(Boolean).sort((a,b)=>alternativeScore(b,p)-alternativeScore(a,p)).slice(0,3);
  const out=$('#result');
  if(out)out.innerHTML=scanResult(S.last);
  bind();
  if(!S.last.alternatives.length)toast('比較できる西友候補が見つかりませんでした');
}
async function fetchJson(url,timeout){
  const c=new AbortController();
  const t=setTimeout(()=>c.abort(),timeout||5000);
  try{
    const r=await fetch(url,{signal:c.signal});
    if(!r.ok)return null;
    return await r.json();
  }catch(e){return null}
  finally{clearTimeout(t)}
}
async function searchSeiyu(q){
  if(!q||/^JAN /.test(q))return[];
  const j=await fetchJson('/api/seiyu/search?q='+encodeURIComponent(q),5000);
  return j&&Array.isArray(j.items)?j.items:[];
}
function inferCategory(p){
  const text=((p.name||'')+' '+(p.quantity||'')+' '+(p.categories||[]).join(' ')).toLowerCase();
  if(/コーラ|お茶|茶 |茶$|水|ジュース|飲料|コーヒー|coffee|tea|water|cola|炭酸|スポーツドリンク|ml|mL|リットル/.test(text))return'drink';
  if(/おにぎり|弁当|丼|サンド|寿司|そば|うどん|パスタ|焼きそば|惣菜/.test(text))return'lunch';
  return'snack';
}
async function lookupJan(raw){
  const jan=normalizeJan(raw);
  if(!validJan(jan))return{error:'JAN/EANコードを確認してください（8〜14桁）'};

  let p=catalog().find(x=>x.jan===jan)||null;
  let exactSeiyu=null;

  const sj=await fetchJson('/api/seiyu/product?jan='+encodeURIComponent(jan),5500);
  if(sj&&sj.item){
    exactSeiyu=sj.item;
    p=Object.assign({},p||{},{
      id:(p&&p.id)||('jan-'+jan),
      jan:jan,
      name:sj.item.name||(p&&p.name)||('JAN '+jan),
      category:(p&&p.category)||inferCategory({name:sj.item.name,quantity:sj.item.size}),
      storePrice:p&&p.storePrice!=null?p.storePrice:null,
      netPrice:sj.item.taxIncludedPrice||sj.item.price||(p&&p.netPrice)||null,
      kcal:sj.item.kcal!=null?sj.item.kcal:(p&&p.kcal!=null?p.kcal:null),
      kcalBasis:sj.item.kcalBasis||(p&&p.kcalBasis)||'',
      quantity:sj.item.size||(p&&p.quantity)||'',
      imageUrl:(p&&p.imageUrl)||'',
      source:'seiyu',
      sourceUrl:sj.item.sourceUrl
    });
  }

  if(!p||!p.name||/^JAN /.test(p.name)||p.kcal==null||!p.imageUrl){
    let oj=await fetchJson('/api/product/lookup?jan='+encodeURIComponent(jan),5500);
    if(!oj||!oj.product){
      oj=await fetchJson('https://world.openfoodfacts.org/api/v3/product/'+encodeURIComponent(jan)+'?fields=code,product_name,product_name_ja,brands,quantity,serving_size,nutriments,image_front_small_url,categories_tags',5500);
      if(oj&&oj.product){
        const x=oj.product,n=x.nutriments||{};
        const s=Number(n['energy-kcal_serving']),h=Number(n['energy-kcal_100g']);
        oj={product:{
          jan:jan,
          name:x.product_name_ja||x.product_name||'',
          brand:x.brands||'',
          quantity:x.quantity||'',
          servingSize:x.serving_size||'',
          kcal:Number.isFinite(s)?s:(Number.isFinite(h)?h:null),
          kcalBasis:Number.isFinite(s)?(x.serving_size||'1食あたり'):(Number.isFinite(h)?'100gあたり':''),
          imageUrl:x.image_front_small_url||'',
          categories:Array.isArray(x.categories_tags)?x.categories_tags:[],
          source:'openfoodfacts',
          sourceUrl:'https://world.openfoodfacts.org/product/'+jan
        }};
      }
    }
    if(oj&&oj.product){
      const x=oj.product;
      p=Object.assign({},x,p||{});
      p.id=(p&&p.id)||('jan-'+jan);
      p.jan=jan;
      if((!p.name||/^JAN /.test(p.name))&&x.name)p.name=x.name;
      if(p.kcal==null&&x.kcal!=null)p.kcal=x.kcal;
      if(!p.kcalBasis&&x.kcalBasis)p.kcalBasis=x.kcalBasis;
      if(!p.quantity&&x.quantity)p.quantity=x.quantity;
      if(!p.imageUrl&&x.imageUrl)p.imageUrl=x.imageUrl;
      if(!exactSeiyu){
        p.source='openfoodfacts';
        p.sourceUrl=x.sourceUrl;
      }
      p.storePrice=p.storePrice==null?null:p.storePrice;
      p.netPrice=p.netPrice==null?null:p.netPrice;
    }
  }

  if(!p)p={id:'jan-'+jan,jan:jan,name:'JAN '+jan,category:'snack',storePrice:null,netPrice:null,kcal:null,source:'manual'};
  p.category=p.category&&CAT[p.category]?p.category:inferCategory(p);
  if(p.source!=='demo'&&!/^JAN /.test(p.name))saveProduct(p);

  const seiyu=exactSeiyu?[]:await searchSeiyu(p.name);
  return{product:p,seiyu:seiyu,exactSeiyu:exactSeiyu};
}
async function doLookup(jan){
  const e=$('#result');
  if(e)e.innerHTML='<p class="loading">西友と商品DBを調べています…</p>';
  S.last=await lookupJan(jan);
  if(S.last&&S.last.product&&navigator.vibrate)navigator.vibrate(45);
  if(e)e.innerHTML=scanResult(S.last);
  bind();
}

async function barcodeFormats(){
  if(!('BarcodeDetector'in window))return[];
  try{
    const supported=await BarcodeDetector.getSupportedFormats();
    return ['ean_13','ean_8','upc_a','upc_e'].filter(x=>supported.includes(x));
  }catch(e){return['ean_13','ean_8']}
}
async function makeDetector(){
  const formats=await barcodeFormats();
  if(!formats.length)return null;
  try{return new BarcodeDetector({formats:formats})}catch(e){return null}
}
async function startScan(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
    toast('このブラウザではカメラを使えません。JAN手入力を使ってください。');
    return;
  }
  const detector=await makeDetector();
  if(!detector){
    toast('自動読取に未対応です。JAN手入力を使ってください。');
    return;
  }
  try{
    const v=$('#video');
    S.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    v.srcObject=S.stream;
    await v.play();
    S.detector=detector;
    const loop=async()=>{
      if(!S.detector)return;
      try{
        const a=await S.detector.detect(v);
        if(a[0]&&a[0].rawValue){
          const jan=normalizeJan(a[0].rawValue);
          stopScan();
          doLookup(jan);
          return;
        }
      }catch(e){}
      requestAnimationFrame(loop);
    };
    loop();
  }catch(e){toast('カメラを開始できませんでした')}
}
async function scanBarcodeImage(file){
  if(!file)return;
  const detector=await makeDetector();
  if(!detector){toast('画像の自動読取に未対応です。JAN手入力を使ってください。');return}
  try{
    const bitmap=await createImageBitmap(file);
    const found=await detector.detect(bitmap);
    if(bitmap.close)bitmap.close();
    if(found&&found[0]&&found[0].rawValue){
      doLookup(found[0].rawValue);
    }else{
      toast('バーコードを見つけられませんでした');
    }
  }catch(e){toast('画像を読み取れませんでした')}
}

function stopScan(){
  if(S.stream)S.stream.getTracks().forEach(t=>t.stop());
  S.stream=null;
  S.detector=null;
}

function recordDecision(original,replacement){
  if(!original||!replacement||original.id===replacement.id)return;
  const ok=Number(original.kcal),rk=Number(replacement.kcal);
  const op=Number(original.storePrice!=null?original.storePrice:original.netPrice);
  const rp=Number(replacement.storePrice!=null?replacement.storePrice:replacement.netPrice);
  const a=read(K.decisions,[]);
  a.push({
    id:uid(),date:today(),at:new Date().toISOString(),
    original:{id:original.id,jan:original.jan||'',name:original.name,kcal:original.kcal,price:Number.isFinite(op)?op:null},
    replacement:{id:replacement.id,jan:replacement.jan||'',name:replacement.name,kcal:replacement.kcal,price:Number.isFinite(rp)?rp:null},
    kcalDiff:Number.isFinite(ok)&&Number.isFinite(rk)?ok-rk:null,
    priceDiff:Number.isFinite(op)&&Number.isFinite(rp)?op-rp:null
  });
  write(K.decisions,a.slice(-1000));
}
function monthDecisionSummary(){
  const prefix=today().slice(0,7);
  const rows=read(K.decisions,[]).filter(x=>x.date&&x.date.startsWith(prefix));
  const savedKcal=rows.reduce((a,x)=>a+(Number.isFinite(Number(x.kcalDiff))?Math.max(0,Number(x.kcalDiff)):0),0);
  const savedYen=rows.reduce((a,x)=>a+(Number.isFinite(Number(x.priceDiff))?Math.max(0,Number(x.priceDiff)):0),0);
  return{rows:rows.slice().reverse(),count:rows.length,savedKcal:savedKcal,savedYen:savedYen,fatGram:savedKcal/7000*1000};
}
function renderDecisionSummary(){
  const d=monthDecisionSummary();
  if(!d.count)return '<section class="whatif card"><b>今月の「もしあの時」</b><p>店頭でスキャンして別の商品を選ぶと、ここに選び直しの差が残ります。</p></section>';
  return '<section class="whatif card">'+
    '<div class="whatif-head"><div><small>今月の「もしあの時」</small><strong>'+d.count+'回 選び直し</strong></div><div class="whatif-kcal">-'+Math.round(d.savedKcal).toLocaleString('ja-JP')+' kcal</div></div>'+
    '<p>エネルギー差の単純換算: 体脂肪 約'+Math.round(d.fatGram)+'g分の目安</p>'+
    (d.savedYen?'<p>価格差で '+yen(d.savedYen)+' 分も抑えました。</p>':'')+
    '<small class="disclaimer">体脂肪1kg≒約7,000kcalとして単純換算。実際の体重変化を保証するものではありません。</small>'+
    '<div class="decision-list">'+d.rows.slice(0,3).map(x=>{
      const kd=x.kcalDiff==null?'—':signed(-Number(x.kcalDiff),' kcal');
      const pd=x.priceDiff==null?'':(' / '+signed(-Number(x.priceDiff),'円'));
      return '<div><span>'+esc(x.original.name)+' → '+esc(x.replacement.name)+'</span><b>'+kd+pd+'</b></div>';
    }).join('')+'</div>'+
  '</section>';
}

function monthSummary(){
  const prefix=today().slice(0,7);
  const rows=history().filter(h=>h.date&&h.date.startsWith(prefix)&&h.status==='eaten');
  const days=new Set(rows.map(h=>h.date)).size;
  const price=rows.reduce((a,h)=>a+(Number(h.price)||0),0);
  const kcal=rows.reduce((a,h)=>a+(Number(h.kcal)||0),0);
  const regrets=history().filter(h=>h.date&&h.date.startsWith(prefix)&&['meh','ng'].includes(h.feedback)).length;
  const netSaved=rows.reduce((a,h)=>{
    const n=Number(h.netPrice),s=Number(h.price);
    return a+(Number.isFinite(n)&&Number.isFinite(s)?Math.max(0,n-s):0);
  },0);
  return{days,price,kcal,regrets,netSaved};
}
function historyItem(h){
  const active=S.reasonFor===h.id&&['meh','ng'].includes(h.feedback);
  const feedback=h.status==='eaten'
    ?'<button data-fb="good" data-id="'+h.id+'" class="'+(h.feedback==='good'?'on':'')+'">よかった</button>'+
     '<button data-fb="meh" data-id="'+h.id+'" class="'+(h.feedback==='meh'?'on':'')+'">微妙</button>'+
     '<button data-fb="ng" data-id="'+h.id+'" class="'+(h.feedback==='ng'?'danger':'')+'">もう買わない</button>'
    :'';
  return '<article class="card hist">'+
    '<div class="hist-main"><div><b>'+esc(h.name)+'</b><small>'+CAT[h.category]+' / '+yen(h.price)+' / '+kc(h.kcal)+(h.netPrice!=null&&h.price!=null&&Number(h.netPrice)>Number(h.price)?' / ネットより'+yen(Number(h.netPrice)-Number(h.price))+'安い':'')+'</small></div>'+
    '<button class="remove" data-remove="'+h.id+'" aria-label="履歴から削除">×</button></div>'+
    '<div class="actions">'+
      (h.status==='planned'?'<button data-eat="'+h.id+'">食べた</button>':'<span>食べた</span>')+
      feedback+
    '</div>'+
    (h.reason?'<p class="reason">理由: '+esc(h.reason)+'</p>':'')+
    (active?'<div class="reason-picker"><small>理由を残す</small><div>'+
      Object.keys(REASONS).map(k=>'<button data-reason="'+k+'" data-id="'+h.id+'">'+REASONS[k]+'</button>').join('')+
    '</div></div>':'')+
  '</article>';
}
function renderHistory(){
  const all=history().slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||String(b.createdAt||b.id).localeCompare(String(a.createdAt||a.id)));
  const m=monthSummary();
  let html='<section class="hero"><small>後悔も忘れない</small><h2>食べたもの</h2><p>「もう買わない」と理由を残すと、次の朝と店頭スキャンで思い出させます。</p></section>'+
    '<section class="month-strip"><div><small>今月 食べた朝</small><b>'+m.days+'日</b></div><div><small>記録金額</small><b>'+yen(m.price)+'</b></div><div><small>記録kcal</small><b>'+kc(m.kcal)+'</b></div><div><small>ネットより節約</small><b>'+yen(m.netSaved)+'</b></div><div><small>後悔</small><b>'+m.regrets+'件</b></div></section>'+
    renderDecisionSummary();
  if(!all.length)return html+'<p class="empty">まだ履歴がありません。</p>';

  const groups={};
  all.forEach(h=>(groups[h.date]||(groups[h.date]=[])).push(h));
  Object.keys(groups).sort().reverse().forEach(d=>{
    const xs=groups[d];
    const eaten=xs.filter(x=>x.status==='eaten');
    const planned=xs.length-eaten.length;
    const price=eaten.reduce((a,x)=>a+(Number(x.price)||0),0);
    const kcal=eaten.reduce((a,x)=>a+(Number(x.kcal)||0),0);
    html+='<section class="day"><div class="day-head"><div><h3>'+prettyDate(d)+'</h3><span>'+yen(price)+' / '+kc(kcal)+(planned?' / 予定 '+planned+'件':'')+'</span></div>'+(planned?'<button data-eat-day="'+d+'">予定を全部「食べた」</button>':'')+'</div>'+xs.map(historyItem).join('')+'</section>';
  });
  return html;
}

function productDetailCard(p){
  const x=st(p.id),rate=x.proposed?Math.round(x.selected/x.proposed*100):0;
  const reason=lastReason(p.id);
  const d=priceDelta(p);
  return '<article class="card dictionary '+(ng(p.id)?'is-ng':'')+'">'+
    '<div class="dict-head"><div><span class="badge">'+CAT[p.category]+'</span>'+
      (p.source==='demo'?'<span class="badge demo">DEMO</span>':'')+
      (ng(p.id)?'<span class="badge bad">NG</span>':'')+
      '<h3>'+esc(p.name)+'</h3></div><div class="dict-price"><b>'+yen(p.storePrice)+'</b><small>'+kc(p.kcal)+'</small></div></div>'+
    '<div class="dict-metrics"><span>提案 '+x.proposed+'回</span><span>採用 '+x.selected+'回</span><span>選ばれ率 '+rate+'%</span><span>食べた '+eatenCount(p.id)+'回</span></div>'+
    (d!==null?'<p class="price-note">ネット参考 '+yen(p.netPrice)+' / 差 '+signed(d,'円')+'</p>':'')+
    (reason?'<p class="reason">後悔メモ: '+esc(reason.reason)+'</p>':'')+
    '<div class="dict-actions">'+(ng(p.id)?'<button data-unng="'+esc(p.id)+'">NG解除</button>':'')+
      (p.jan?'<button data-rescan="'+esc(p.jan)+'">このJANを確認</button>':'')+'</div>'+
  '</article>';
}
function renderProducts(){
  let ps=catalog();
  if(S.productFilter==='ng')ps=ps.filter(p=>ng(p.id));
  if(S.productFilter==='favorite')ps=ps.filter(p=>{const x=st(p.id);return x.selected>0&&x.good>=x.meh+x.ng});
  ps.sort((a,b)=>(ng(b.id)?1:0)-(ng(a.id)?1:0)||eatenCount(b.id)-eatenCount(a.id));

  return '<section class="hero"><small>自分専用の西友DB</small><h2>商品辞書</h2><p>選ばれ率・価格差・後悔理由を、使うほど自分向けに育てます。</p></section>'+
    '<div class="pills filters">'+
      '<button class="pill '+(S.productFilter==='all'?'on':'')+'" data-filter="all">全部</button>'+
      '<button class="pill '+(S.productFilter==='favorite'?'on':'')+'" data-filter="favorite">鉄板</button>'+
      '<button class="pill '+(S.productFilter==='ng'?'on':'')+'" data-filter="ng">NG</button>'+
    '</div>'+
    (ps.length?ps.map(productDetailCard).join(''):'<p class="empty">該当する商品はありません。</p>')+
    '<section class="card backup"><h3>端末データ</h3><p>ログインなしなので、必要ならJSONでバックアップできます。</p>'+
      '<div class="row"><button id="export" class="secondary small">書き出す</button><label class="import-label">読み込む<input id="import" type="file" accept="application/json"></label><button id="reset-data" class="danger-outline small">初期化</button></div></section>';
}

function eatDay(day){
  const a=history();
  let changed=0;
  a.forEach(h=>{
    if(h.date===day&&h.status==='planned'){h.status='eaten';changed++}
  });
  if(changed){write(K.history,a);S.rec=null;toast(changed+'件を「食べた」にしました');render()}
}
function resetData(){
  if(!confirm('この端末の履歴・登録商品・学習データを削除します。JSONバックアップを残していないデータは戻せません。'))return;
  Object.values(K).forEach(k=>localStorage.removeItem(k));
  S.focus='drink';S.fixed='d1';S.rec=null;S.last=null;S.reasonFor=null;S.productFilter='all';
  toast('端末データを初期化しました');
  render();
}

function feedback(id,type){
  const a=history(),h=a.find(x=>x.id===id);
  if(!h)return;
  if(h.feedback)mod(h.productId,h.feedback,-1);
  h.feedback=type;
  if(type==='good')h.reason=null;
  mod(h.productId,type,1);
  write(K.history,a);
  if(type==='ng')toast('NGにしました。次回提案から外します');
  S.reasonFor=['meh','ng'].includes(type)?id:null;
  S.rec=null;
  render();
}
function setReason(id,key){
  const a=history(),h=a.find(x=>x.id===id);
  if(!h)return;
  h.reason=REASONS[key]||key;
  write(K.history,a);
  S.reasonFor=null;
  render();
}
function removeHistory(id){
  const a=history(),i=a.findIndex(x=>x.id===id);
  if(i<0)return;
  const h=a[i];
  if(h.feedback)mod(h.productId,h.feedback,-1);
  if(h.status==='planned'||h.status==='eaten')mod(h.productId,'selected',-1);
  a.splice(i,1);
  write(K.history,a);
  S.rec=null;
  toast('履歴から削除しました');
  render();
}
function recordPrice(p){
  if(p.storePrice==null&&p.netPrice==null)return;
  const a=read(K.prices,[]);
  const last=a.slice().reverse().find(x=>x.jan===p.jan);
  if(last&&last.storePrice===p.storePrice&&last.netPrice===p.netPrice)return;
  a.push({jan:p.jan,date:today(),at:new Date().toISOString(),storePrice:p.storePrice,netPrice:p.netPrice});
  write(K.prices,a.slice(-500));
}

function exportData(){
  const payload={
    version:1,
    exportedAt:new Date().toISOString(),
    catalog:read(K.catalog,[]),
    history:history(),
    stats:stats(),
    prefs:read(K.prefs,{}),
    prices:read(K.prices,[]),
    decisions:read(K.decisions,[])
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const u=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=u;
  a.download='seiyu-asa-'+today()+'.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1000);
}
async function importData(file){
  try{
    const j=JSON.parse(await file.text());
    if(!j||j.version!==1)throw new Error('bad');
    if(Array.isArray(j.catalog))write(K.catalog,j.catalog);
    if(Array.isArray(j.history))write(K.history,j.history);
    if(j.stats&&typeof j.stats==='object')write(K.stats,j.stats);
    if(j.prefs&&typeof j.prefs==='object')write(K.prefs,j.prefs);
    if(Array.isArray(j.prices))write(K.prices,j.prices);
    if(Array.isArray(j.decisions))write(K.decisions,j.decisions);
    loadPrefs();
    S.rec=null;
    toast('バックアップを読み込みました');
    render();
  }catch(e){toast('読み込めないバックアップです')}
}

function render(){
  stopScan();
  $('#app').innerHTML=S.route==='today'?renderToday():S.route==='scan'?renderScan():S.route==='history'?renderHistory():renderProducts();
  $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.route===S.route));
  bind();
}
function bind(){
  $$('.nav-item').forEach(b=>b.onclick=()=>{S.route=b.dataset.route;S.reasonFor=null;render()});
  $$('[data-jump]').forEach(b=>b.onclick=()=>{S.route=b.dataset.jump;render()});
  $$('[data-focus]').forEach(b=>b.onclick=()=>{
    S.focus=b.dataset.focus;
    const p=categoryCandidates(S.focus,false)[0];
    S.fixed=p?p.id:null;
    savePrefs();
    S.rec=null;
    render();
  });
  const f=$('#fixed');
  if(f)f.onchange=()=>{S.fixed=f.value;savePrefs();S.rec=null;render()};
  const rr=$('#reroll');
  if(rr)rr.onclick=()=>{
    if(S.rec)Object.keys(S.rec).forEach(c=>{S.lastRec[c]=S.rec[c].id});
    S.rec=null;
    render();
  };
  const ac=$('#accept');
  if(ac)ac.onclick=accept;
  const st=$('#start');
  if(st)st.onclick=startScan;
  const sp=$('#stop');
  if(sp)sp.onclick=stopScan;
  const lu=$('#lookup');
  if(lu)lu.onclick=()=>doLookup($('#jan').value);
  const ji=$('#jan');
  if(ji)ji.onkeydown=e=>{if(e.key==='Enter')doLookup(ji.value)};
  const bi=$('#barcode-image');
  if(bi)bi.onchange=()=>{if(bi.files&&bi.files[0])scanBarcodeImage(bi.files[0])};

  const rg=$('#register');
  if(rg)rg.onsubmit=e=>{
    e.preventDefault();
    const d=new FormData(rg),num=v=>v===''?null:Number(v);
    const existing=S.last&&S.last.product||{};
    const p={
      id:existing.id||('jan-'+d.get('jan')),
      jan:String(d.get('jan')),
      name:String(d.get('name')||'').trim()||('JAN '+d.get('jan')),
      category:String(d.get('category')),
      storePrice:num(d.get('storePrice')),
      netPrice:num(d.get('netPrice')),
      kcal:num(d.get('kcal')),
      quantity:existing.quantity||'',
      imageUrl:existing.imageUrl||'',
      kcalBasis:existing.kcalBasis||'',
      source:existing.source==='seiyu'?'seiyu':'registered',
      sourceUrl:existing.sourceUrl||''
    };
    saveProduct(p);
    recordPrice(p);
    S.last={product:p,seiyu:S.last&&S.last.seiyu||[]};
    toast('商品情報を保存しました');
    render();
  };

  $$('[data-eat-day]').forEach(b=>b.onclick=()=>eatDay(b.dataset.eatDay));
  $$('[data-eat]').forEach(b=>b.onclick=()=>{
    const a=history(),h=a.find(x=>x.id===b.dataset.eat);
    if(h){h.status='eaten';write(K.history,a);S.rec=null;render()}
  });
  $$('[data-fb]').forEach(b=>b.onclick=()=>feedback(b.dataset.id,b.dataset.fb));
  $$('[data-reason]').forEach(b=>b.onclick=()=>setReason(b.dataset.id,b.dataset.reason));
  $$('[data-remove]').forEach(b=>b.onclick=()=>removeHistory(b.dataset.remove));
  $$('[data-unng]').forEach(b=>b.onclick=()=>{
    clearNg(b.dataset.unng);
    S.rec=null;
    toast('NGを解除しました');
    render();
  });
  $$('[data-filter]').forEach(b=>b.onclick=()=>{S.productFilter=b.dataset.filter;render()});
  $$('[data-rescan]').forEach(b=>b.onclick=()=>{S.route='scan';S.last=null;render();doLookup(b.dataset.rescan)});
  $$('[data-lookup-jan]').forEach(b=>b.onclick=()=>doLookup(b.dataset.lookupJan));
  $$('[data-use-product]').forEach(b=>b.onclick=()=>{
    const p=productById(b.dataset.useProduct)||(S.last&&Array.isArray(S.last.alternatives)?S.last.alternatives.find(x=>x.id===b.dataset.useProduct):null);
    if(!p)return;
    if(S.last&&S.last.product)recordDecision(S.last.product,p);
    if(p.source!=='demo')saveProduct(p);
    S.focus=p.category;S.fixed=p.id;savePrefs();S.rec=null;S.route='today';toast('今日の優先商品にしました');render();
  });
  $$('[data-use-scan]').forEach(b=>b.onclick=()=>{
    const p=S.last&&S.last.product;
    if(!p)return;
    if(p.source!=='demo')saveProduct(p);
    S.focus=p.category;S.fixed=p.id;savePrefs();S.rec=null;S.route='today';toast('今日の優先商品にしました');render();
  });
  const fa=$('#find-alts');
  if(fa)fa.onclick=findSeiyuAlternatives;
  const ex=$('#export');
  if(ex)ex.onclick=exportData;
  const im=$('#import');
  if(im)im.onchange=()=>{if(im.files&&im.files[0])importData(im.files[0])};
  const rd=$('#reset-data');
  if(rd)rd.onclick=resetData;
}

document.addEventListener('visibilitychange',()=>{if(document.hidden)stopScan()});
loadPrefs();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
render();
