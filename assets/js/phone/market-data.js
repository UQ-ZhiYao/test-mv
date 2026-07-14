/* ===== assets/js/phone/market-data.js — Market screen: Indices/Forex/Crypto tabs, real quotes via fetch-quotes edge function ===== */

// Curated symbol lists — same country/exchange groupings as the Discover
// page's preview widget (MARKETS in portfolio-widgets.js), extended with
// real Yahoo Finance tickers and country labels for the full Market page.
var MKT_INDICES_HEADLINE={symbol:'^KLSE',name:'FTSE Bursa Malaysia KLCI',country:'Malaysia'};
// Region display order for the flat list below the pinned KLCI headline —
// no "Top" highlight list anymore (it just duplicated entries from these
// three and didn't fit "sort by region").
var MKT_REGIONS=['american','asia','european'];
var MKT_INDICES={
  american:[
    {symbol:'^GSPC',name:'S&P 500',country:'United States'},
    {symbol:'^IXIC',name:'Nasdaq Composite',country:'United States'},
    {symbol:'^DJI',name:'Dow Jones Industrial Average',country:'United States'},
    {symbol:'^RUT',name:'Russell 2000',country:'United States'},
    {symbol:'^GSPTSE',name:'S&P/TSX Composite',country:'Canada'},
    {symbol:'^BVSP',name:'Bovespa',country:'Brazil'},
    {symbol:'^COLCAP',name:'COLCAP',country:'Colombia'}
  ],
  asia:[
    {symbol:'^N225',name:'Nikkei 225',country:'Japan'},
    {symbol:'^HSI',name:'Hang Seng Index',country:'Hong Kong'},
    {symbol:'000001.SS',name:'Shanghai Composite',country:'China'},
    {symbol:'^STI',name:'Straits Times Index',country:'Singapore'},
    {symbol:'^KS11',name:'KOSPI',country:'South Korea'},
    {symbol:'^NSEI',name:'Nifty 50',country:'India'},
    {symbol:'^AXJO',name:'ASX 200',country:'Australia'},
    {symbol:'^JKSE',name:'IDX Composite',country:'Indonesia'},
    {symbol:'^SET.BK',name:'SET Index',country:'Thailand'}
  ],
  european:[
    {symbol:'^FTSE',name:'FTSE 100',country:'United Kingdom'},
    {symbol:'^GDAXI',name:'DAX',country:'Germany'},
    {symbol:'^FCHI',name:'CAC 40',country:'France'},
    {symbol:'^STOXX50E',name:'Euro Stoxx 50',country:'Eurozone'},
    {symbol:'^AEX',name:'AEX',country:'Netherlands'},
    {symbol:'^SSMI',name:'SMI',country:'Switzerland'},
    {symbol:'PFTS',name:'PFTS Index',country:'Ukraine'},
    {symbol:'IMOEX.ME',name:'MOEX Russia Index',country:'Russia'}
  ]
};
var MKT_CRYPTO=[
  {symbol:'BTC-USD',name:'Bitcoin'},
  {symbol:'ETH-USD',name:'Ethereum'},
  {symbol:'SOL-USD',name:'Solana'},
  {symbol:'XRP-USD',name:'XRP'},
  {symbol:'BNB-USD',name:'BNB'},
  {symbol:'DOGE-USD',name:'Dogecoin'},
  {symbol:'ADA-USD',name:'Cardano'},
  {symbol:'USDT-USD',name:'Tether'}
];
var MKT_FX_CURRENCIES=[
  {code:'MYR',name:'Malaysian Ringgit'},
  {code:'USD',name:'US Dollar'},
  {code:'SGD',name:'Singapore Dollar'},
  {code:'EUR',name:'Euro'},
  {code:'GBP',name:'British Pound'},
  {code:'JPY',name:'Japanese Yen'},
  {code:'CNY',name:'Chinese Yuan'},
  {code:'AUD',name:'Australian Dollar'},
  {code:'HKD',name:'Hong Kong Dollar'},
  {code:'THB',name:'Thai Baht'},
  {code:'COP',name:'Colombian Peso'},
  {code:'IDR',name:'Indonesian Rupiah'},
  {code:'UAH',name:'Ukrainian Hryvnia'},
  {code:'RUB',name:'Russian Ruble'}
];
var MKT_FX_BASE='MYR';
var MKT_ACTIVE_TAB='indices';
// Flag shown in front of the country name on the Indices tab's subline.
var MKT_FLAGS={
  'Malaysia':'🇲🇾','United States':'🇺🇸','Hong Kong':'🇭🇰','Japan':'🇯🇵','United Kingdom':'🇬🇧',
  'Canada':'🇨🇦','Brazil':'🇧🇷','China':'🇨🇳','Singapore':'🇸🇬','South Korea':'🇰🇷','India':'🇮🇳',
  'Australia':'🇦🇺','Germany':'🇩🇪','France':'🇫🇷','Eurozone':'🇪🇺','Netherlands':'🇳🇱','Switzerland':'🇨🇭',
  'Colombia':'🇨🇴','Indonesia':'🇮🇩','Thailand':'🇹🇭','Ukraine':'🇺🇦','Russia':'🇷🇺'
};

function mktFmtPrice(v){
  if(v==null||isNaN(v)) return '—';
  if(Math.abs(v)>=1000) return v.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
  return v.toFixed(v<10?4:2);
}
function mktFmtChangePct(v){
  if(v==null||isNaN(v)) return {txt:'—',color:'var(--fg-3)'};
  var sign=v>=0?'+':'';
  return {txt:sign+v.toFixed(2)+'%', color:v>=0?'var(--green)':'var(--red)'};
}
// Indices tab's right subline: absolute change and change% combined on one
// line, e.g. "+8.72 (+0.54%)".
function mktFmtChangeCombined(change,changePct){
  if(change==null||changePct==null||isNaN(change)||isNaN(changePct)) return {txt:'—',color:'var(--fg-3)'};
  var sign=change>=0?'+':'';
  var pctSign=changePct>=0?'+':'';
  return {txt:sign+mktFmtPrice(Math.abs(change))+' ('+pctSign+changePct.toFixed(2)+'%)', color:change>=0?'var(--green)':'var(--red)'};
}
function mktQuoteBySymbol(quotes,symbol){
  for(var i=0;i<quotes.length;i++){ if(quotes[i].symbol===symbol) return quotes[i]; }
  return null;
}
// Shared row: left = code (bold) + up to 2 sublines; right = value (bold) +
// change subline. bg is an optional background color (e.g. a light tint
// marking a region group, or the accent color for a pinned/base row).
// onclickAttr is an optional inline onclick="..." string (used by Indices
// rows to open the detail drill-down; omitted by Crypto/Forex rows).
function mktRenderRow(left1,left2,left3,right1,right2Obj,bg,onclickAttr){
  return '<div'+(onclickAttr?' onclick="'+onclickAttr+'" style="cursor:pointer;':' style="')+'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border);background:'+(bg||'transparent')+';">'
    +'<div style="min-width:0;">'
    +'<div style="font-size:.84rem;font-weight:700;color:var(--fg-1);">'+left1+'</div>'
    +(left2?'<div style="font-size:.71rem;color:var(--fg-3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+left2+'</div>':'')
    +(left3?'<div style="font-size:.68rem;color:var(--fg-3);">'+left3+'</div>':'')
    +'</div>'
    +'<div style="text-align:right;flex-shrink:0;padding-left:10px;">'
    +'<div style="font-size:.86rem;font-weight:700;color:var(--fg-1);">'+right1+'</div>'
    +'<div style="font-size:.72rem;font-weight:600;color:'+right2Obj.color+';margin-top:2px;">'+right2Obj.txt+'</div>'
    +'</div>'
    +'</div>';
}

function switchMarketTab(tab){
  MKT_ACTIVE_TAB=tab;
  ['indices','forex','crypto'].forEach(function(t){
    var body=document.getElementById('mtab-'+t+'-body');
    var btn=document.getElementById('mtab-'+t+'-btn');
    if(body) body.style.display=tab===t?'block':'none';
    if(btn){ btn.style.color=tab===t?'var(--blue)':'var(--fg-3)'; btn.style.borderBottomColor=tab===t?'var(--blue)':'transparent'; }
  });
  if(tab==='indices') loadMarketIndices();
  else if(tab==='forex') loadMarketForex();
  else if(tab==='crypto') loadMarketCrypto();
}

// ── INDICES ──────────────────────────────────────────────────────────────
// Ticker/code is deliberately not shown — the index's full name is the
// main line, country (with its flag) is the only subline. One flat table,
// no category headers: FTSE Bursa Malaysia KLCI is always pinned at the
// top (highlighted), then every other index is grouped by region (in
// MKT_REGIONS order) and, within each region, sorted by market
// size — the index's own price/value, descending, since indices don't
// have a traditional market cap. Each region group gets its own light
// background tint (alternating) so the boundaries read visually without
// needing text headers.
var MKT_REGION_BG=[null,'var(--gray-50)',null];
function mktIndexBySymbol(symbol){
  if(MKT_INDICES_HEADLINE.symbol===symbol) return MKT_INDICES_HEADLINE;
  for(var i=0;i<MKT_REGIONS.length;i++){
    var list=MKT_INDICES[MKT_REGIONS[i]];
    for(var j=0;j<list.length;j++){ if(list[j].symbol===symbol) return list[j]; }
  }
  return null;
}
// Each row is a one-tap entry point into openIndexDetail() (chart +
// summary drill-down, see the "INDEX DETAIL" section below).
function renderIndexRow(idx,quotes,bg){
  var q=mktQuoteBySymbol(quotes,idx.symbol);
  var price=q?mktFmtPrice(q.regularMarketPrice):'—';
  var chg=q?mktFmtChangeCombined(q.regularMarketChange,q.regularMarketChangePercent):{txt:'—',color:'var(--fg-3)'};
  var flag=MKT_FLAGS[idx.country]||'';
  return mktRenderRow(idx.name,(flag?flag+' ':'')+idx.country,null,price,chg,bg,"openIndexDetail('"+idx.symbol.replace(/'/g,"\\'")+"')");
}
function mktIndexQuoteValue(idx,quotes){
  var q=mktQuoteBySymbol(quotes,idx.symbol);
  return (q&&q.regularMarketPrice!=null)?q.regularMarketPrice:-Infinity;
}
function renderMarketIndices(quotes){
  var el=document.getElementById('mktIndicesList');
  if(!el) return;
  var html=renderIndexRow(MKT_INDICES_HEADLINE,quotes,'var(--blue-bg)');
  MKT_REGIONS.forEach(function(region,ri){
    var bg=MKT_REGION_BG[ri%MKT_REGION_BG.length];
    var sorted=MKT_INDICES[region].slice().sort(function(a,b){
      return mktIndexQuoteValue(b,quotes)-mktIndexQuoteValue(a,quotes);
    });
    sorted.forEach(function(idx){ html+=renderIndexRow(idx,quotes,bg); });
  });
  el.innerHTML=html;
}
async function loadMarketIndices(){
  if(typeof sb==='undefined'||!sb) return;
  var allSymbols=[MKT_INDICES_HEADLINE.symbol];
  MKT_REGIONS.forEach(function(region){
    MKT_INDICES[region].forEach(function(idx){ if(allSymbols.indexOf(idx.symbol)===-1) allSymbols.push(idx.symbol); });
  });
  try{
    var quotes=await mpLoadQuotes(allSymbols);
    renderMarketIndices(quotes);
  }catch(e){
    console.warn('[Market] indices load failed:', e.message);
    renderMarketIndices([]);
  }
}

// ── INDEX DETAIL (one-tap drill-down: chart + period switcher + summary) ─
var MKT_IDX_PERIODS=[
  {key:'1D',range:'1d',interval:'5m'},
  {key:'1W',range:'5d',interval:'30m'},
  {key:'1M',range:'1mo',interval:'1d'},
  {key:'3M',range:'3mo',interval:'1d'},
  {key:'1Y',range:'1y',interval:'1wk'},
  {key:'5Y',range:'5y',interval:'1mo'}
];
var MKT_IDX_DETAIL_SYMBOL=null;
var MKT_IDX_DETAIL_PERIOD='1M';
function openIndexDetail(symbol){
  var idx=mktIndexBySymbol(symbol);
  if(!idx) return;
  MKT_IDX_DETAIL_SYMBOL=symbol;
  var flag=MKT_FLAGS[idx.country]||'';
  var titleEl=document.getElementById('mktIndexDetailTitle');
  if(titleEl) titleEl.textContent=idx.name;
  var subEl=document.getElementById('mktIndexDetailSub');
  if(subEl) subEl.textContent=(flag?flag+' ':'')+idx.country;
  var listWrap=document.getElementById('mktIndicesListWrap');
  var detail=document.getElementById('mktIndexDetail');
  if(listWrap) listWrap.style.display='none';
  if(detail) detail.style.display='block';
  switchIndexPeriod(MKT_IDX_DETAIL_PERIOD);
}
function closeIndexDetail(){
  var listWrap=document.getElementById('mktIndicesListWrap');
  var detail=document.getElementById('mktIndexDetail');
  if(detail) detail.style.display='none';
  if(listWrap) listWrap.style.display='block';
}
function switchIndexPeriod(periodKey){
  MKT_IDX_DETAIL_PERIOD=periodKey;
  document.querySelectorAll('.mkt-idx-period-btn').forEach(function(b){
    var on=b.getAttribute('data-period')===periodKey;
    b.style.color=on?'var(--blue)':'var(--fg-3)';
    b.style.background=on?'var(--blue-bg)':'transparent';
  });
  loadIndexDetailData();
}
async function loadIndexDetailData(){
  if(!MKT_IDX_DETAIL_SYMBOL) return;
  var symbol=MKT_IDX_DETAIL_SYMBOL;
  var periodKey=MKT_IDX_DETAIL_PERIOD;
  var period=null;
  for(var i=0;i<MKT_IDX_PERIODS.length;i++){ if(MKT_IDX_PERIODS[i].key===periodKey){ period=MKT_IDX_PERIODS[i]; break; } }
  if(!period) period=MKT_IDX_PERIODS[2];
  try{
    var results=await Promise.all([
      mpLoadHistorical(symbol,period.interval,period.range),
      mpLoadQuotes([symbol])
    ]);
    // The symbol changed (user opened a different index) or another period
    // was tapped and already finished loading while this request was still
    // in flight — either way a newer call already rendered (or will), so
    // drop this now-stale one instead of overwriting it.
    if(symbol!==MKT_IDX_DETAIL_SYMBOL||periodKey!==MKT_IDX_DETAIL_PERIOD) return;
    drawIndexDetailChart(results[0]);
    renderIndexDetailSummary(mktQuoteBySymbol(results[1],symbol));
  }catch(e){
    console.warn('[Market] index detail load failed:', e.message);
    if(symbol!==MKT_IDX_DETAIL_SYMBOL||periodKey!==MKT_IDX_DETAIL_PERIOD) return;
    drawIndexDetailChart([]);
    renderIndexDetailSummary(null);
  }
}
// Left axis = price, right axis = % change from the first point of the
// currently-selected period — both share the same 3 horizontal gridlines
// (high/mid/low of the price range), since %-change is just an affine
// transform of price (pct = (price/firstClose - 1) * 100), so the two
// axes are guaranteed to overlap at every tick rather than needing a
// second line.
function drawIndexDetailChart(points){
  var c=document.getElementById('mktIndexDetailChart');
  if(!c) return;
  var dpr=window.devicePixelRatio||1;
  var W=c.parentElement.clientWidth;
  var H=160;
  var ctx=c.getContext('2d');
  if(W<=0){
    // Container not laid out yet (e.g. tab just became visible) — same
    // class of timing issue fixed for the Account Summary donut; skip
    // this draw rather than sizing the canvas to 0.
    return;
  }
  c.width=W*dpr; c.height=H*dpr;
  c.style.width=W+'px'; c.style.height=H+'px';
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  var closes=(points||[]).map(function(p){return p.close;}).filter(function(v){return v!=null&&!isNaN(v);});
  if(closes.length<2){
    ctx.fillStyle='#94A3B8';
    ctx.font='12px sans-serif';
    ctx.textAlign='center';
    ctx.fillText('No data available',W/2,H/2);
    return;
  }
  var mn=Math.min.apply(null,closes), mx=Math.max.apply(null,closes);
  var rng=(mx-mn)||1;
  var firstClose=closes[0];
  // The plot itself uses ~99% of the available width — the axis labels
  // are drawn overlapping directly on top of the chart (near its left/
  // right edges, inside the plotted area) instead of living in a reserved
  // side margin that would shrink the line/gridlines to make room.
  var pad={l:1,r:1,t:14,b:14};
  var innerW=W-pad.l-pad.r, innerH=H-pad.t-pad.b;
  var up=closes[closes.length-1]>=closes[0];
  var lineColor=up?'#2E7D32':'#DC2626';
  var fillColor=up?'rgba(46,125,50,.08)':'rgba(220,38,38,.08)';

  // Small translucent backing behind each label so it stays legible where
  // it overlaps the line, fill, or gridline underneath it.
  function drawAxisLabel(text,x,align){
    ctx.font='9px sans-serif';
    var tw=ctx.measureText(text).width;
    var boxX=align==='left'?x-3:x-tw-3;
    ctx.fillStyle='rgba(255,255,255,.85)';
    ctx.fillRect(boxX,y-7,tw+6,14);
    ctx.fillStyle='#64748B';
    ctx.textBaseline='middle';
    ctx.textAlign=align;
    ctx.fillText(text,x,y);
  }
  var ticks=[mx,(mn+mx)/2,mn];
  var y;
  ticks.forEach(function(v){
    y=pad.t+innerH-((v-mn)/rng)*innerH;
    ctx.beginPath();
    ctx.moveTo(pad.l,y);
    ctx.lineTo(pad.l+innerW,y);
    ctx.strokeStyle='rgba(100,116,139,.15)';
    ctx.lineWidth=1;
    ctx.stroke();
    var pct=firstClose?((v-firstClose)/firstClose*100):0;
    drawAxisLabel(mktFmtPrice(v),pad.l+4,'left');
    drawAxisLabel((pct>=0?'+':'')+pct.toFixed(1)+'%',pad.l+innerW-4,'right');
  });

  ctx.beginPath();
  closes.forEach(function(v,i){
    var x=pad.l+(i/(closes.length-1))*innerW;
    var y=pad.t+innerH-((v-mn)/rng)*innerH;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.lineJoin='round';
  ctx.lineWidth=1.75;
  ctx.strokeStyle=lineColor;
  ctx.stroke();
  ctx.lineTo(pad.l+innerW,pad.t+innerH);
  ctx.lineTo(pad.l,pad.t+innerH);
  ctx.closePath();
  ctx.fillStyle=fillColor;
  ctx.fill();
}
function mktSummaryRow(label,value){
  return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">'
    +'<div style="font-size:.76rem;color:var(--fg-3);">'+label+'</div>'
    +'<div style="font-size:.78rem;font-weight:600;color:var(--fg-1);">'+value+'</div>'
    +'</div>';
}
function renderIndexDetailSummary(q){
  var el=document.getElementById('mktIndexDetailSummary');
  if(!el) return;
  if(!q){
    el.innerHTML='<div style="padding:16px 0;text-align:center;color:var(--fg-3);font-size:.72rem;">No data available</div>';
    return;
  }
  var chg=mktFmtChangeCombined(q.regularMarketChange,q.regularMarketChangePercent);
  el.innerHTML=''
    +'<div style="text-align:center;padding:8px 0 16px;">'
    +'<div style="font-size:1.6rem;font-weight:700;color:var(--fg-1);">'+mktFmtPrice(q.regularMarketPrice)+'</div>'
    +'<div style="font-size:.82rem;font-weight:600;color:'+chg.color+';margin-top:2px;">'+chg.txt+'</div>'
    +'</div>'
    +mktSummaryRow('Previous Close',mktFmtPrice(q.previousClose))
    +mktSummaryRow('Day Range',mktFmtPrice(q.regularMarketDayLow)+' – '+mktFmtPrice(q.regularMarketDayHigh))
    +mktSummaryRow('52-Week Range',mktFmtPrice(q.fiftyTwoWeekLow)+' – '+mktFmtPrice(q.fiftyTwoWeekHigh))
    +mktSummaryRow('Currency',q.currency||'—');
}

// ── FOREX ────────────────────────────────────────────────────────────────
// No dropdown — the base currency is just whichever row the user last
// tapped. That row is pinned to the top of the list and highlighted;
// changeFxBase() (called via each row's onclick) re-renders with the new
// base. Was double-click/double-tap, but dblclick doesn't fire reliably
// across mobile touch browsers/WebViews, so a single tap is used instead.
function mktRenderFxRow(c,rate,chgObj,isBase){
  return '<div onclick="changeFxBase(\''+c.code+'\')" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;background:'+(isBase?'var(--blue-bg)':'transparent')+';">'
    +'<div style="min-width:0;">'
    +'<div style="font-size:.84rem;font-weight:700;color:'+(isBase?'var(--blue)':'var(--fg-1)')+';">'+c.code
    +(isBase?' <span style="font-size:.62rem;font-weight:700;letter-spacing:.03em;text-transform:uppercase;">· Base</span>':'')
    +'</div>'
    +'<div style="font-size:.71rem;color:var(--fg-3);margin-top:2px;">'+c.name+'</div>'
    +'</div>'
    +'<div style="text-align:right;flex-shrink:0;padding-left:10px;">'
    +'<div style="font-size:.86rem;font-weight:700;color:var(--fg-1);">'+rate+'</div>'
    +'<div style="font-size:.72rem;font-weight:600;color:'+chgObj.color+';margin-top:2px;">'+chgObj.txt+'</div>'
    +'</div>'
    +'</div>';
}
function renderMarketForex(quotes,others){
  var el=document.getElementById('mktForexList');
  if(!el) return;
  var baseC=MKT_FX_CURRENCIES.filter(function(c){return c.code===MKT_FX_BASE;})[0];
  var html=baseC?mktRenderFxRow(baseC,'1.0000',{txt:'Base currency',color:'var(--fg-3)'},true):'';
  html+=others.map(function(c){
    var symbol=MKT_FX_BASE+c.code+'=X';
    var q=mktQuoteBySymbol(quotes,symbol);
    var rate=q?mktFmtPrice(q.regularMarketPrice):'—';
    var chg=q?mktFmtChangePct(q.regularMarketChangePercent):{txt:'—',color:'var(--fg-3)'};
    return mktRenderFxRow(c,rate,chg,false);
  }).join('');
  el.innerHTML=html;
}
async function loadMarketForex(){
  if(typeof sb==='undefined'||!sb) return;
  var others=MKT_FX_CURRENCIES.filter(function(c){return c.code!==MKT_FX_BASE;});
  var symbols=others.map(function(c){return MKT_FX_BASE+c.code+'=X';});
  try{
    var quotes=await mpLoadQuotes(symbols);
    renderMarketForex(quotes,others);
  }catch(e){
    console.warn('[Market] forex load failed:', e.message);
    renderMarketForex([],others);
  }
}
function changeFxBase(code){
  if(code===MKT_FX_BASE) return;
  MKT_FX_BASE=code;
  loadMarketForex();
}

// ── CRYPTO ───────────────────────────────────────────────────────────────
function renderMarketCrypto(quotes){
  var el=document.getElementById('mktCryptoList');
  if(!el) return;
  el.innerHTML=MKT_CRYPTO.map(function(c){
    var q=mktQuoteBySymbol(quotes,c.symbol);
    var price=q?mktFmtPrice(q.regularMarketPrice):'—';
    var chg=q?mktFmtChangePct(q.regularMarketChangePercent):{txt:'—',color:'var(--fg-3)'};
    return mktRenderRow(c.symbol.replace('-USD',''),c.name,'USD',price,chg);
  }).join('');
}
async function loadMarketCrypto(){
  if(typeof sb==='undefined'||!sb) return;
  var symbols=MKT_CRYPTO.map(function(c){return c.symbol;});
  try{
    var quotes=await mpLoadQuotes(symbols);
    renderMarketCrypto(quotes);
  }catch(e){
    console.warn('[Market] crypto load failed:', e.message);
    renderMarketCrypto([]);
  }
}
