/* ===== assets/js/phone/market-data.js — Market screen: Indices/Forex/Crypto tabs, real quotes via fetch-quotes edge function ===== */

// Curated symbol lists — same country/exchange groupings as the Discover
// page's preview widget (MARKETS in portfolio-widgets.js), extended with
// real Yahoo Finance tickers and country labels for the full Market page.
var MKT_INDICES_HEADLINE={symbol:'^KLSE',name:'FTSE Bursa Malaysia KLCI',country:'Malaysia'};
var MKT_INDICES={
  top:[
    {symbol:'^GSPC',name:'S&P 500',country:'United States'},
    {symbol:'^IXIC',name:'Nasdaq Composite',country:'United States'},
    {symbol:'^DJI',name:'Dow Jones Industrial Average',country:'United States'},
    {symbol:'^HSI',name:'Hang Seng Index',country:'Hong Kong'},
    {symbol:'^N225',name:'Nikkei 225',country:'Japan'},
    {symbol:'^FTSE',name:'FTSE 100',country:'United Kingdom'}
  ],
  american:[
    {symbol:'^GSPC',name:'S&P 500',country:'United States'},
    {symbol:'^IXIC',name:'Nasdaq Composite',country:'United States'},
    {symbol:'^DJI',name:'Dow Jones Industrial Average',country:'United States'},
    {symbol:'^RUT',name:'Russell 2000',country:'United States'},
    {symbol:'^GSPTSE',name:'S&P/TSX Composite',country:'Canada'},
    {symbol:'^BVSP',name:'Bovespa',country:'Brazil'}
  ],
  asia:[
    {symbol:'^N225',name:'Nikkei 225',country:'Japan'},
    {symbol:'^HSI',name:'Hang Seng Index',country:'Hong Kong'},
    {symbol:'000001.SS',name:'Shanghai Composite',country:'China'},
    {symbol:'^STI',name:'Straits Times Index',country:'Singapore'},
    {symbol:'^KS11',name:'KOSPI',country:'South Korea'},
    {symbol:'^NSEI',name:'Nifty 50',country:'India'},
    {symbol:'^AXJO',name:'ASX 200',country:'Australia'}
  ],
  european:[
    {symbol:'^FTSE',name:'FTSE 100',country:'United Kingdom'},
    {symbol:'^GDAXI',name:'DAX',country:'Germany'},
    {symbol:'^FCHI',name:'CAC 40',country:'France'},
    {symbol:'^STOXX50E',name:'Euro Stoxx 50',country:'Eurozone'},
    {symbol:'^AEX',name:'AEX',country:'Netherlands'},
    {symbol:'^SSMI',name:'SMI',country:'Switzerland'}
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
  {code:'THB',name:'Thai Baht'}
];
var MKT_FX_BASE='MYR';
var MKT_ACTIVE_TAB='indices';
// Flag shown in front of the country name on the Indices tab's subline.
var MKT_FLAGS={
  'Malaysia':'🇲🇾','United States':'🇺🇸','Hong Kong':'🇭🇰','Japan':'🇯🇵','United Kingdom':'🇬🇧',
  'Canada':'🇨🇦','Brazil':'🇧🇷','China':'🇨🇳','Singapore':'🇸🇬','South Korea':'🇰🇷','India':'🇮🇳',
  'Australia':'🇦🇺','Germany':'🇩🇪','France':'🇫🇷','Eurozone':'🇪🇺','Netherlands':'🇳🇱','Switzerland':'🇨🇭'
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
// Shared row: left = code (bold) + up to 2 sublines; right = value (bold) + change subline.
function mktRenderRow(left1,left2,left3,right1,right2Obj){
  return '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border);">'
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
// main line, country (with its flag) is the only subline.
function renderIndexRow(idx,quotes){
  var q=mktQuoteBySymbol(quotes,idx.symbol);
  var price=q?mktFmtPrice(q.regularMarketPrice):'—';
  var chg=q?mktFmtChangeCombined(q.regularMarketChange,q.regularMarketChangePercent):{txt:'—',color:'var(--fg-3)'};
  var flag=MKT_FLAGS[idx.country]||'';
  return mktRenderRow(idx.name,(flag?flag+' ':'')+idx.country,null,price,chg);
}
function renderMarketIndices(quotes){
  var headEl=document.getElementById('mktIndicesHeadline');
  if(headEl) headEl.innerHTML=renderIndexRow(MKT_INDICES_HEADLINE,quotes);
  ['top','american','asia','european'].forEach(function(g){
    var el=document.getElementById('mktIndices-'+g);
    if(!el) return;
    el.innerHTML=MKT_INDICES[g].map(function(idx){ return renderIndexRow(idx,quotes); }).join('');
  });
}
async function loadMarketIndices(){
  if(typeof sb==='undefined'||!sb) return;
  var allSymbols=[MKT_INDICES_HEADLINE.symbol];
  ['top','american','asia','european'].forEach(function(g){
    MKT_INDICES[g].forEach(function(idx){ if(allSymbols.indexOf(idx.symbol)===-1) allSymbols.push(idx.symbol); });
  });
  try{
    var quotes=await mpLoadQuotes(allSymbols);
    renderMarketIndices(quotes);
  }catch(e){
    console.warn('[Market] indices load failed:', e.message);
    renderMarketIndices([]);
  }
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
