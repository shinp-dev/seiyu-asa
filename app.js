const CAT={snack:'お菓子',lunch:'昼メシ',drink:'飲み物'};
const ICON={snack:'🍫',lunch:'🍙',drink:'🥤'};
const SOURCE={demo:'デモ',registered:'登録済み',seiyu:'西友ネット',openfoodfacts:'商品DB',retail:'外部商品情報',maker:'メーカー公式',manual:'手入力'};
const REASONS={expensive:'高い',small:'量が足りない',calorie:'カロリーの割に満足しない',taste:'味が好みじゃない',other:'その他'};
const MAKER_OPTIONS=[
  {id:'yamazaki',prefix:'4903110',label:'ヤマザキ'},
  {id:'fujipan',prefix:'4902410',label:'フジパン'},
  {id:'pasco',prefix:'4901820',label:'Pasco'}
];
const RETAIL_OPTIONS=[
  {id:'beisia',label:'ベイシア'},
  {id:'tokiwa',label:'トキハ'},
  {id:'youme',label:'ゆめデリバリー'},
  {id:'rakutenmart',label:'楽天マート'}
];
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
  recDate:null,
  last:null,
  lastRec:{},
  stream:null,
  detector:null,
  reasonFor:null,
  productFilter:'all',
  productQuery:'',
  nameResults:[],
  nameQuery:'',
  makerOptIns:{},
  retailOptIns:{},
  readerOptIn:false
};

const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=n=>n!==null&&n!==''&&Number.isFinite(Number(n))?'¥'+Math.round(Number(n)).toLocaleString('ja-JP'):'—';
const kc=n=>n!==null&&n!==''&&Number.isFinite(Number(n))?Math.round(Number(n)).toLocaleString('ja-JP')+' kcal':'— kcal';
const signed=(n,suffix)=>!Number.isFinite(n)?'—':(n>0?'+':'')+Math.round(n).toLocaleString('ja-JP')+(suffix||'');
function effectivePrice(p){
  if(p&&p.storePrice!==null&&p.storePrice!==''&&Number.isFinite(Number(p.storePrice)))return{value:Number(p.storePrice),source:'store'};
  if(p&&p.netPrice!==null&&p.netPrice!==''&&Number.isFinite(Number(p.netPrice)))return{value:Number(p.netPrice),source:'net'};
  return{value:null,source:'unknown'};
}
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
  S.makerOptIns=p.makerOptIns&&typeof p.makerOptIns==='object'?p.makerOptIns:{};
  S.retailOptIns=p.retailOptIns&&typeof p.retailOptIns==='object'?p.retailOptIns:{};
  S.readerOptIn=p.readerOptIn===true;
}
function savePrefs(){
  const prev=read(K.prefs,{});
  write(K.prefs,Object.assign({},prev,{focus:S.focus,fixed:S.fixed,makerOptIns:S.makerOptIns,retailOptIns:S.retailOptIns,readerOptIn:S.readerOptIn}));
}
function makerForJan(jan){return MAKER_OPTIONS.find(m=>jan.startsWith(m.prefix))||null}
function makerOptedIn(jan){
  const maker=makerForJan(jan);
  return !!(maker&&S.makerOptIns&&S.makerOptIns[maker.id]);
}
function retailOptedInIds(){
  return RETAIL_OPTIONS.filter(x=>S.retailOptIns&&S.retailOptIns[x.id]).map(x=>x.id);
}

function sanitizeCachedProduct(p){
  if(!p)return p;
  let out=Object.assign({},p);
  const badMakerName=out.source==='maker'&&/サイト内検索|検索結果|site\s*search/i.test(out.name||'');
  if(badMakerName){
    out=Object.assign(out,{
      name:'未登録商品',
      brand:'',
      manufacturer:'',
      kcal:null,
      kcalBasis:'',
      quantity:'',
      imageUrl:'',
      source:'manual',
      sourceUrl:''
    });
  }
  const url=String(out.sourceUrl||'');
  const externalRetail=/netsuper\.rakuten\.co\.jp\/beisia|tokiwa-portal\.com|delivery\.youmetown\.com|sm\.rakuten\.co\.jp/i.test(url);
  if(out.source==='retail'||externalRetail)out.netPrice=null;
  return out;
}
function catalog(){
  const m=new Map(SEED.map(p=>[p.id,p]));
  read(K.catalog,[]).forEach(p=>m.set(p.id,sanitizeCachedProduct(p)));
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
  const ep=effectivePrice(p);
  const price=Number.isFinite(ep.value)?ep.value:200;
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
  S.recDate=today();
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
    ?'店頭 '+yen(p.storePrice)+(p.netPrice!=null?' / 西友ネット '+yen(p.netPrice)+(d!==null?' ('+(d>=0?'+':'')+Math.round(d)+'円)':''):'')
    :(p.netPrice!=null?'西友ネット '+yen(p.netPrice)+' / 店頭未登録':'価格未登録');
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
  const days=Object.keys(by).sort().reverse().slice(0,30).map(k=>{
    const xs=by[k];
    return {
      date:k,
      categories:new Set(xs.map(x=>x.category)).size,
      price:xs.reduce((a,x)=>a+(Number(x.price)||0),0),
      kcal:xs.reduce((a,x)=>a+(Number(x.kcal)||0),0)
    };
  }).filter(x=>x.categories>=3).slice(0,14);
  if(days.length<2)return null;
  return {
    days:days.length,
    price:days.reduce((a,x)=>a+x.price,0)/days.length,
    kcal:days.reduce((a,x)=>a+x.kcal,0)/days.length
  };
}

function todayInsight(ps,price,cal,base){
  const parts=[];
  if(base&&Number.isFinite(base.kcal)&&cal<base.kcal-20)parts.push('いつもの朝より約'+Math.round(base.kcal-cal)+' kcal軽め');
  const netSaved=ps.reduce((a,p)=>{
    const d=priceDelta(p);
    return a+(d!=null&&d>0?d:0);
  },0);
  if(netSaved>0)parts.push('西友ネットより合計'+yen(netSaved)+'安め');
  const fresh=ps.filter(p=>p.source!=='demo'&&eatenCount(p.id)===0).length;
  if(fresh>0)parts.push('初めての商品 '+fresh+'つ');
  return parts.slice(0,2).join(' / ')||'好きな1品は固定して、残りだけ整えています';
}

function renderToday(){
  if(S.recDate!==today()){S.rec=null;S.lastRec={}}
  const r=S.rec||makeRec();
  const realCount=catalog().filter(p=>p.source!=='demo').length;
  const ps=Object.values(r);
  const priced=ps.map(effectivePrice);
  const price=priced.reduce((a,x)=>a+(Number.isFinite(x.value)?x.value:0),0);
  const hasNetEstimate=priced.some(x=>x.source==='net');
  const hasUnknownPrice=priced.some(x=>x.source==='unknown');
  const cal=ps.reduce((a,p)=>a+(Number(p.kcal)||0),0);
  const base=recentBaseline();
  const comparison=base
    ?'<p class="compare">最近'+base.days+'日平均より <b>'+signed(price-base.price,'円')+'</b> / <b>'+signed(cal-base.kcal,' kcal')+'</b></p>'
    :'<p class="compare muted">3点とも食べた記録が2日分たまると、いつもの朝との差を表示します。</p>';
  const insight=todayInsight(ps,price,cal,base);

  return '<section class="hero"><small>出勤前の西友だけ</small><h2>今日の3点、これでどう？</h2><p>お菓子 + 昼メシ + ペットボトル。夕方の買い物は混ぜない。</p></section>'+ (realCount<3?'<section class="onboarding card"><b>まずは自分の西友を育てる</b><p>実商品はまだ '+realCount+' 件。店頭でバーコードを読むほど、架空のDEMOではなく普段の商品から提案できるようになります。</p><button class="secondary small" data-jump="scan">1つスキャンする</button></section>':'')+
  '<section class="card focus"><b>今日はこれを固定</b><div class="pills">'+
    Object.keys(CAT).map(c=>'<button data-focus="'+c+'" class="pill '+(S.focus===c?'on':'')+'">'+CAT[c]+'</button>').join('')+
    '</div><select id="fixed">'+categoryCandidates(S.focus,false).map(p=>'<option value="'+p.id+'" '+(p.id===S.fixed?'selected':'')+'>'+esc(p.name)+(p.source==='demo'?' (DEMO)':'')+'</option>').join('')+'</select></section>'+
  '<div class="title"><h3>今日のセット</h3><button id="reroll">別のセット</button></div>'+
  ps.map(p=>card(p)).join('')+
  '<section class="summary"><small>合計'+(hasNetEstimate?'（西友ネット参考含む）':'')+(hasUnknownPrice?'（価格未登録あり）':'')+'</small><strong>'+yen(price)+' / '+kc(cal)+'</strong><div class="insight">'+esc(insight)+'</div>'+comparison+
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
      price:effectivePrice(p).value,
      priceSource:effectivePrice(p).source,
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

function renderOptions(){
  return '<section class="hero"><small>外部問い合わせ</small><h2>商品情報の検索先</h2><p>すべてOFFが初期値です。西友・商品DBで見つからない時だけ、ONにした検索先へJANを送ります。</p></section>'+
  '<div class="title"><h3>外部商品ページ</h3><span>商品名・栄養だけ / 価格には使わない</span></div>'+
  '<section class="card settings">'+
    RETAIL_OPTIONS.map(m=>'<label class="setting-row"><span><b>'+esc(m.label)+'</b><small>JANを商品情報の照合に使用（価格は採用しない）</small></span><input type="checkbox" data-retail-optin="'+esc(m.id)+'" '+(S.retailOptIns[m.id]?'checked':'')+'></label>').join('')+
  '</section>'+
  '<div class="title"><h3>ページ取得補助</h3><span>必要な時だけ</span></div>'+
  '<section class="card settings">'+
    '<label class="setting-row"><span><b>Jina Reader</b><small>ネットスーパー直取得が拒否された時だけ、商品ページURL（JANを含む）を外部の無料Readerへ送信</small></span><input type="checkbox" data-reader-optin="1" '+(S.readerOptIn?'checked':'')+'></label>'+
    '<p class="mini-note privacy-note">初期OFFです。ONのネットスーパーがある場合だけ使います。Jina Readerは無認証の無料枠を使用します。</p>'+
  '</section>'+
  '<div class="title"><h3>メーカー公式</h3><span>補助検索</span></div>'+
  '<section class="card settings">'+
    MAKER_OPTIONS.map(m=>'<label class="setting-row"><span><b>'+esc(m.label)+'</b><small>JANをメーカー公式の検索へ送信</small></span><input type="checkbox" data-maker-optin="'+esc(m.id)+'" '+(S.makerOptIns[m.id]?'checked':'')+'></label>').join('')+
    '<p class="mini-note privacy-note">OFFの検索先には問い合わせません。設定はこの端末内にだけ保存します。外部商品ページはJAN完全一致の商品名・栄養情報だけを補完し、表示価格には使いません。</p>'+
  '</section>';
}

function renderScan(){
  return '<section class="hero"><small>店頭で迷ったら</small><h2>バーコードで判定</h2><p>JAN/EANを読んで、西友ネット参考価格・店頭価格・カロリー・過去の後悔をまとめて確認。</p></section>'+
  '<section class="card scan"><div class="video"><video id="video" playsinline muted></video><i></i></div>'+
  '<div class="row"><button class="primary small" id="start">カメラで読む</button><button class="secondary small" id="stop">停止</button></div>'+
  '<div class="manual"><input id="jan" inputmode="numeric" autocomplete="off" placeholder="JANコードを手入力"><button id="lookup">検索</button></div>'+
  '<label class="barcode-upload">バーコード写真から読む<input id="barcode-image" type="file" accept="image/*" capture="environment"></label>'+
  '<p class="mini-note">自動読取に未対応でもJAN手入力で使えます。</p>'+
  '<div class="name-search"><input id="name-q" value="'+esc(S.nameQuery)+'" placeholder="商品名でも西友を検索"><button id="name-search">検索</button></div>'+
  '<div id="name-results">'+renderNameResults()+'</div></section>'+
  '<div id="result">'+(S.last?scanResult(S.last):'')+'</div>';
}
function renderNameResults(){
  if(!S.nameResults.length)return'';
  return '<div class="name-hits">'+S.nameResults.slice(0,6).map(x=>
    '<article class="name-hit"><a target="_blank" rel="noreferrer" href="'+esc(x.url)+'"><span><b>'+esc(x.name)+'</b><small>'+esc(x.size||'')+'</small></span><strong>'+yen(x.taxIncludedPrice||x.price)+'</strong></a>'+
    (x.jan?'<button data-lookup-jan="'+esc(x.jan)+'">JANで詳しく</button>':'')+'</article>'
  ).join('')+'</div>';
}
async function runNameSearch(q){
  q=String(q||'').trim();
  if(!q){toast('商品名を入れてください');return}
  S.nameQuery=q;
  const box=$('#name-results');
  if(box)box.innerHTML='<p class="loading">西友を検索しています…</p>';
  S.nameResults=await searchSeiyu(q);
  if(box)box.innerHTML=renderNameResults()||'<p class="empty">候補が見つかりませんでした。</p>';
  bind();
}

function manualLookupHint(p){
  const notes=[];
  if(p.retailAttempted&&p.retailAttempted.length)notes.push('ONにした外部商品ページでもJAN完全一致が見つかりませんでした。');
  else if(p.retailOptInAvailable)notes.push('外部商品ページ検索は設定でOFFです。ONにすると次回から照会します。');
  if(p.maker&&p.maker.lookupUrl)notes.push((p.maker.brand||'メーカー')+'公式でも商品名までは特定できませんでした。');
  else if(p.makerOptInAvailable)notes.push(p.makerOptInAvailable.label+'公式への問い合わせは設定でOFFです。');
  return notes.join(' ')||'このJANは外部商品情報から特定できませんでした。商品名と店頭価格を一度保存すれば、次回から端末内で即座に呼び出せます。';
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
      (p.manufacturer?'<small>'+esc(p.manufacturer)+'</small>':'')+
      '</div></div>'+
    '<div class="metrics"><div><small>店頭</small><b>'+yen(p.storePrice)+'</b></div>'+
    '<div><small>西友ネット</small><b>'+yen(p.netPrice)+'</b></div>'+
    '<div><small>kcal</small><b>'+kc(p.kcal)+'</b>'+(p.kcalBasis?'<em>'+esc(p.kcalBasis)+'</em>':'')+'</div></div>'+
    (p.kcal!=null&&p.nutritionSourceUrl?'<p class="mini-note">栄養情報：<a target="_blank" rel="noreferrer" href="'+esc(p.nutritionSourceUrl)+'">'+esc(p.nutritionSource||'掲載元')+'</a>（パッケージ表示を優先）</p>':'')+
    (d!==null?'<p class="callout">'+(d>=0?'店頭のほうが '+yen(d)+' 安い':'西友ネットのほうが '+yen(Math.abs(d))+' 安い')+'</p>':'<p class="hint">店頭価格を登録すると西友ネット価格との差額を出せます。</p>')+
    (p.sourceUrl?'<a class="source-link" target="_blank" rel="noreferrer" href="'+esc(p.sourceUrl)+'">情報元を確認 →</a>':'')+
    (p.maker&&p.maker.lookupUrl?'<a class="source-link" target="_blank" rel="noreferrer" href="'+esc(p.maker.lookupUrl)+'">'+esc(p.maker.brand)+'公式で確認 →</a>':'')+
    (p.jan?'<button class="stock-link" data-stock-jan="'+esc(p.jan)+'">西友の店舗在庫を確認</button>':'')+
    (p.source==='manual'?'<p class="hint">'+esc(manualLookupHint(p))+'</p>':'')+
    registerForm(p)+
    '<button class="secondary" data-use-scan="1">今日の3点でこの商品を優先</button>'+
  '</section>';

  if(r.seiyu&&r.seiyu.length){
    html+='<div class="title"><h3>西友ネット候補</h3><span>西友ネット参考価格</span></div>'+
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
    html+='<div class="title"><h3>西友で代わりにこれ</h3><span>西友ネット参考価格</span></div>'+
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
    '<label>西友ネット<input name="netPrice" type="number" min="0" inputmode="numeric" value="'+(p.netPrice==null?'':p.netPrice)+'"></label>'+
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
  const cp=Number(current.storePrice!=null?current.storePrice:current.netPrice),xp=Number(x.netPrice);
  const regret=lastReason(current.id);
  const reason=regret&&regret.reason||'';

  if(Number.isFinite(ck)&&Number.isFinite(xk)){
    const kcalGain=ck-xk;
    s+=kcalGain/10;
    if(reason===REASONS.calorie)s+=kcalGain/5;
  }
  if(Number.isFinite(cp)&&Number.isFinite(xp)){
    const priceGain=cp-xp;
    s+=priceGain/20;
    if(reason===REASONS.expensive)s+=priceGain/8;
  }
  if(reason===REASONS.small && x.quantity && current.quantity){
    const xv=parseFloat(String(x.quantity)),cv=parseFloat(String(current.quantity));
    if(Number.isFinite(xv)&&Number.isFinite(cv)&&xv>cv)s+=8;
  }
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
    const r=await fetch(url,{signal:c.signal,cache:'no-store'});
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

  let p=sanitizeCachedProduct(catalog().find(x=>x.jan===jan)||null);
  let exactSeiyu=null;
  const enabledRetail=retailOptedInIds();
  let retailAttempted=[];

  const sj=await fetchJson('/api/seiyu/product?jan='+encodeURIComponent(jan)+'&reader='+(S.readerOptIn?'1':'0'),9000);
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
      nutritionSource:sj.item.kcal!=null?'西友ネットスーパー':((p&&p.nutritionSource)||''),
      nutritionSourceUrl:sj.item.kcal!=null?(sj.item.nutritionSourceUrl||sj.item.sourceUrl):((p&&p.nutritionSourceUrl)||''),
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

  if((!p||!p.name||p.name==='未登録商品'||/^JAN /.test(p.name)||p.kcal==null)&&enabledRetail.length){
    const rj=await fetchJson('/api/retail/lookup?jan='+encodeURIComponent(jan)+'&sources='+encodeURIComponent(enabledRetail.join(','))+'&reader='+(S.readerOptIn?'1':'0'),9000);
    retailAttempted=rj&&Array.isArray(rj.attempted)?rj.attempted:enabledRetail;
    if(rj&&rj.product){
      const x=rj.product;
      p=Object.assign({},p||{},{
        id:(p&&p.id)||('jan-'+jan),
        jan,
        name:((p&&p.name&&!/^(未登録商品|JAN )/.test(p.name))?p.name:x.name)||(p&&p.name)||'未登録商品',
        brand:x.brand||(p&&p.brand)||'',
        manufacturer:x.manufacturer||(p&&p.manufacturer)||'',
        category:(p&&p.category)||inferCategory(x),
        storePrice:p&&p.storePrice!=null?p.storePrice:null,
        netPrice:p&&p.netPrice!=null?p.netPrice:null,
        kcal:p&&p.kcal!=null?p.kcal:(x.kcal!=null?x.kcal:null),
        kcalBasis:(p&&p.kcalBasis)||(x.kcalBasis||''),
        nutritionSource:(p&&p.kcal!=null&&p.nutritionSource)?p.nutritionSource:(x.nutritionSource||''),
        nutritionSourceUrl:(p&&p.kcal!=null&&p.nutritionSourceUrl)?p.nutritionSourceUrl:(x.nutritionSourceUrl||''),
        quantity:x.quantity||(p&&p.quantity)||'',
        imageUrl:x.imageUrl||(p&&p.imageUrl)||'',
        source:(p&&p.source&&p.source!=='manual')?p.source:'retail',
        retailer:x.retailer||'',
        sourceUrl:(p&&p.sourceUrl)||x.sourceUrl||''
      });
    }
  }

  if((!p||!p.name||p.name==='未登録商品'||/^JAN /.test(p.name))&&makerOptedIn(jan)){
    const mj=await fetchJson('/api/maker/lookup?jan='+encodeURIComponent(jan),5500);
    if(mj&&mj.product){
      const x=mj.product;
      p=Object.assign({},p||{},{
        id:(p&&p.id)||('jan-'+jan),
        jan,
        name:x.name||(p&&p.name)||'未登録商品',
        brand:x.brand||(p&&p.brand)||'',
        manufacturer:x.manufacturer||(p&&p.manufacturer)||'',
        category:(p&&p.category)||inferCategory(x),
        storePrice:p&&p.storePrice!=null?p.storePrice:null,
        netPrice:p&&p.netPrice!=null?p.netPrice:null,
        kcal:x.kcal!=null?x.kcal:(p&&p.kcal!=null?p.kcal:null),
        kcalBasis:x.kcalBasis||(p&&p.kcalBasis)||'',
        quantity:x.quantity||(p&&p.quantity)||'',
        imageUrl:x.imageUrl||(p&&p.imageUrl)||'',
        source:'maker',
        sourceUrl:x.sourceUrl||mj.maker?.officialUrl||''
      });
    }else if(mj&&mj.maker){
      p=Object.assign({},p||{},{
        id:(p&&p.id)||('jan-'+jan),
        jan,
        name:(p&&p.name)||'未登録商品',
        brand:(p&&p.brand)||mj.maker.brand||'',
        manufacturer:(p&&p.manufacturer)||mj.maker.manufacturer||'',
        category:(p&&p.category)||'snack',
        storePrice:p&&p.storePrice!=null?p.storePrice:null,
        netPrice:p&&p.netPrice!=null?p.netPrice:null,
        kcal:p&&p.kcal!=null?p.kcal:null,
        source:'manual',
        maker:mj.maker
      });
    }
  }

  if(!p){
    const maker=makerForJan(jan);
    p={
      id:'jan-'+jan,jan:jan,name:'未登録商品',category:'snack',storePrice:null,netPrice:null,kcal:null,source:'manual',
      makerOptInAvailable:maker&&!S.makerOptIns[maker.id]?maker:null,
      retailOptInAvailable:enabledRetail.length===0,
      retailAttempted
    };
  }else if(p.source==='manual'){
    p.retailOptInAvailable=enabledRetail.length===0;
    p.retailAttempted=retailAttempted;
  }
  p.category=p.category&&CAT[p.category]?p.category:inferCategory(p);
  if(p.source!=='demo'&&p.source!=='manual'&&!/^JAN /.test(p.name))saveProduct(p);

  const seiyu=exactSeiyu||p.source==='manual'?[]:await searchSeiyu(p.name);
  return{product:p,seiyu:seiyu,exactSeiyu:exactSeiyu};
}
async function doLookup(jan){
  const e=$('#result');
  if(e)e.innerHTML='<p class="loading">西友・商品DB・ONの外部検索先を照会しています…</p>';
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
  const price=rows.reduce((a,h)=>a+(h.priceSource!=='net'?(Number(h.price)||0):0),0);
  const kcal=rows.reduce((a,h)=>a+(Number(h.kcal)||0),0);
  const regrets=history().filter(h=>h.date&&h.date.startsWith(prefix)&&['meh','ng'].includes(h.feedback)).length;
  const netSaved=rows.reduce((a,h)=>{
    if(h.priceSource==='net')return a;
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
    '<div class="hist-main"><div><b>'+esc(h.name)+'</b><small>'+CAT[h.category]+' / '+yen(h.price)+(h.priceSource==='net'?'（西友ネット）':'')+' / '+kc(h.kcal)+(h.priceSource!=='net'&&h.netPrice!=null&&h.price!=null&&Number(h.netPrice)>Number(h.price)?' / 西友ネットより'+yen(Number(h.netPrice)-Number(h.price))+'安い':'')+'</small></div>'+
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
  return '<article class="card dictionary '+(ng(p.id)?'is-ng':'')+'" data-product-search="'+esc(((p.name||'')+' '+(p.jan||'')+' '+CAT[p.category]).toLowerCase())+'">'+
    '<div class="dict-head"><div><span class="badge">'+CAT[p.category]+'</span>'+
      (p.source==='demo'?'<span class="badge demo">DEMO</span>':'')+
      (ng(p.id)?'<span class="badge bad">NG</span>':'')+
      '<h3>'+esc(p.name)+'</h3></div><div class="dict-price"><b>'+yen(p.storePrice)+'</b><small>'+kc(p.kcal)+'</small></div></div>'+
    '<div class="dict-metrics"><span>提案 '+x.proposed+'回</span><span>採用 '+x.selected+'回</span><span>選ばれ率 '+rate+'%</span><span>食べた '+eatenCount(p.id)+'回</span></div>'+
    (d!==null?'<p class="price-note">西友ネット '+yen(p.netPrice)+' / 差 '+signed(d,'円')+'</p>':'')+
    (reason?'<p class="reason">後悔メモ: '+esc(reason.reason)+'</p>':'')+
    '<div class="dict-actions">'+(ng(p.id)?'<button data-unng="'+esc(p.id)+'">NG解除</button>':'')+
      (p.jan?'<button data-rescan="'+esc(p.jan)+'">このJANを確認</button>':'')+'</div>'+
  '</article>';
}
function renderProducts(){
  let ps=catalog();
  if(S.productFilter==='ng')ps=ps.filter(p=>ng(p.id));
  if(S.productFilter==='favorite')ps=ps.filter(p=>{const x=st(p.id);return x.selected>0&&x.good>=x.meh+x.ng});
  const q=S.productQuery.trim().toLowerCase();
  if(q)ps=ps.filter(p=>((p.name||'')+' '+(p.jan||'')+' '+CAT[p.category]).toLowerCase().includes(q));
  ps.sort((a,b)=>(ng(b.id)?1:0)-(ng(a.id)?1:0)||eatenCount(b.id)-eatenCount(a.id));

  return '<section class="hero"><small>自分専用の西友DB</small><h2>商品辞書</h2><p>選ばれ率・価格差・後悔理由を、使うほど自分向けに育てます。</p></section>'+
    '<div class="dictionary-search"><input id="product-q" value="'+esc(S.productQuery)+'" placeholder="商品名・JANで探す"><button id="product-q-clear" '+(S.productQuery?'':'disabled')+'>クリア</button></div>'+
    '<div class="pills filters">'+
      '<button class="pill '+(S.productFilter==='all'?'on':'')+'" data-filter="all">全部</button>'+
      '<button class="pill '+(S.productFilter==='favorite'?'on':'')+'" data-filter="favorite">鉄板</button>'+
      '<button class="pill '+(S.productFilter==='ng'?'on':'')+'" data-filter="ng">NG</button>'+
    '</div>'+
    '<p class="result-count" id="product-count">'+ps.length+'件</p>'+
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
  $('#app').innerHTML=S.route==='today'?renderToday():S.route==='scan'?renderScan():S.route==='history'?renderHistory():S.route==='options'?renderOptions():renderProducts();
  $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.route===S.route));
  bind();
}
function bind(){
  const settings=$('#settings');
  if(settings)settings.onclick=()=>{S.route='options';S.reasonFor=null;render()};
  $$('[data-retail-optin]').forEach(x=>x.onchange=()=>{
    S.retailOptIns[x.dataset.retailOptin]=!!x.checked;
    savePrefs();
    toast((RETAIL_OPTIONS.find(m=>m.id===x.dataset.retailOptin)||{label:'検索先'}).label+'検索を'+(x.checked?'ON':'OFF')+'にしました');
  });
  $$('[data-reader-optin]').forEach(x=>x.onchange=()=>{
    S.readerOptIn=!!x.checked;
    savePrefs();
    toast('ページ取得補助を'+(x.checked?'ON':'OFF')+'にしました');
  });
  $$('[data-maker-optin]').forEach(x=>x.onchange=()=>{
    S.makerOptIns[x.dataset.makerOptin]=!!x.checked;
    savePrefs();
    toast((MAKER_OPTIONS.find(m=>m.id===x.dataset.makerOptin)||{label:'メーカー'}).label+'公式問い合わせを'+(x.checked?'ON':'OFF')+'にしました');
  });
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
  const nq=$('#name-q'),ns=$('#name-search');
  if(ns)ns.onclick=()=>runNameSearch(nq&&nq.value);
  if(nq)nq.onkeydown=e=>{if(e.key==='Enter')runNameSearch(nq.value)};

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
  const pq=$('#product-q'),pqc=$('#product-q-clear');
  const applyProductQuery=()=>{
    if(!pq)return;
    S.productQuery=pq.value;
    const q=S.productQuery.trim().toLowerCase();
    let visible=0;
    $$('.dictionary[data-product-search]').forEach(card=>{
      const show=!q||(card.dataset.productSearch||'').includes(q);
      card.hidden=!show;
      if(show)visible++;
    });
    const count=$('#product-count');
    if(count)count.textContent=visible+'件';
    if(pqc)pqc.disabled=!S.productQuery;
  };
  if(pq)pq.oninput=applyProductQuery;
  if(pqc)pqc.onclick=()=>{S.productQuery='';pq.value='';applyProductQuery();pq.focus()};
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
  $$('[data-stock-jan]').forEach(b=>b.onclick=()=>{
    const jan=b.dataset.stockJan;
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(jan).catch(()=>{});
    window.open('https://www.seiyu.co.jp/stock/','_blank','noopener');
    toast('JAN '+jan+' をコピーしました');
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
