/* ===== assets/js/phone/markets-actions.js — Transactions/distributions lists, market data, subscribe/redeem sheets ===== */
var bioOn=true,notifOn=true;
function toggleMPwd(id){var f=document.getElementById(id);f.type=f.type==='password'?'text':'password';}
function saveMPwd(){
  var p1=document.getElementById('mPwd1').value,p2=document.getElementById('mPwd2').value;
  if(!p1||!p2){showToastM('Please fill both fields');return;}
  if(p1!==p2){showToastM('Passwords do not match');return;}
  if(p1.length<8){showToastM('Minimum 8 characters');return;}
  showToastM('Password updated successfully');
  document.getElementById('mPwd1').value='';document.getElementById('mPwd2').value='';
}
function toggleBio(){
  bioOn=!bioOn;
  var el=document.getElementById('bioToggle');
  el.style.background=bioOn?'var(--blue)':'var(--border)';
  el.children[0].style.right=bioOn?'3px':'auto';el.children[0].style.left=bioOn?'auto':'3px';
  showToastM('Biometric login '+(bioOn?'enabled':'disabled'));
}
function toggleNotif(){
  notifOn=!notifOn;
  var el=document.getElementById('notifToggle');
  el.style.background=notifOn?'var(--green)':'var(--border)';
  el.children[0].style.right=notifOn?'3px':'auto';el.children[0].style.left=notifOn?'auto':'3px';
  showToastM('Login notifications '+(notifOn?'on':'off'));
}

// ── GLOBAL SEARCH ────────────────────────────────────────────────────────────
var SEARCH_RECENT = ['KLCI','AAPL','BTC'];

// Extended fundamentals data per symbol
var STOCK_FUNDAMENTALS = {
  'KLCI': {desc:'The FTSE Bursa Malaysia KLCI is the benchmark index of Bursa Malaysia, comprising the 30 largest companies by market cap.',mktCap:'RM 1.82T',pe:'14.2x',eps:'107.35',div:'3.8%',wk52H:'1,588',wk52L:'1,414',vol:'185M',sector:'Index'},
  '5168': {desc:'Hartalega Holdings is one of the world\'s largest nitrile glove manufacturers, listed on Bursa Malaysia.',mktCap:'RM 9.7B',pe:'42.1x',eps:'0.067',div:'1.4%',wk52H:'3.28',wk52L:'1.92',vol:'8.2M',sector:'Healthcare'},
  '1295': {desc:'Public Bank Berhad is one of Malaysia\'s largest banks by assets, known for strong asset quality and dividends.',mktCap:'RM 81.7B',pe:'14.8x',eps:'0.284',div:'3.9%',wk52H:'4.58',wk52L:'3.81',vol:'12.4M',sector:'Financials'},
  '5225': {desc:'IHH Healthcare is Asia\'s largest listed healthcare group by market cap, operating hospitals across 10+ countries.',mktCap:'RM 38.5B',pe:'48.6x',eps:'0.045',div:'0.7%',wk52H:'2.44',wk52L:'1.76',vol:'6.8M',sector:'Healthcare'},
  'AAPL': {desc:'Apple Inc. designs, manufactures and markets smartphones, personal computers, tablets, wearables and accessories worldwide.',mktCap:'$3.48T',pe:'31.2x',eps:'7.31',div:'0.5%',wk52H:'259.81',wk52L:'164.07',vol:'58.2M',sector:'Technology'},
  'TSLA': {desc:'Tesla designs, develops and manufactures electric vehicles, energy generation and storage systems.',mktCap:'$795B',pe:'68.4x',eps:'3.63',div:'—',wk52H:'488.54',wk52L:'182.00',vol:'92.1M',sector:'Consumer Disc.'},
  'NVDA': {desc:'NVIDIA Corporation provides graphics and computing platforms for gaming, professional visualization, data centers and automotive.',mktCap:'$3.21T',pe:'38.7x',eps:'3.40',div:'0.03%',wk52H:'149.43',wk52L:'85.48',vol:'245M',sector:'Technology'},
  'MSFT': {desc:'Microsoft develops and supports software, services, devices and solutions across productivity, cloud computing and gaming.',mktCap:'$3.15T',pe:'33.8x',eps:'12.50',div:'0.8%',wk52H:'468.35',wk52L:'385.58',vol:'22.4M',sector:'Technology'},
  'BTC':  {desc:'Bitcoin is a decentralized digital currency that enables peer-to-peer transactions without a central authority.',mktCap:'$1.95T',pe:'—',eps:'—',div:'—',wk52H:'109,356',wk52L:'49,121',vol:'$38.4B',sector:'Crypto'},
  'ETH':  {desc:'Ethereum is a decentralized platform that enables smart contracts and decentralized applications to run without downtime.',mktCap:'$459B',pe:'—',eps:'—',div:'—',wk52H:'4,108',wk52L:'1,521',vol:'$18.2B',sector:'Crypto'},
  'GOLD': {desc:'Gold spot price in USD per troy ounce — the global benchmark for the precious metal.',mktCap:'$19.8T',pe:'—',eps:'—',div:'—',wk52H:'3,500',wk52L:'2,286',vol:'$180B/day',sector:'Commodity'},
  'SPX':  {desc:'The S&P 500 tracks 500 large US companies and is widely regarded as the best gauge of large-cap US equities.',mktCap:'$46.2T',pe:'22.1x',eps:'248.11',div:'1.3%',wk52H:'5,669',wk52L:'4,803',vol:'3.2B',sector:'Index'},
};

// Price history (simplified sparkline data per symbol)
var STOCK_CHARTS = {
  'KLCI': [1414,1438,1462,1451,1488,1476,1502,1519,1508,1524],
  '5168': [1.92,2.04,2.18,2.31,2.45,2.38,2.52,2.64,2.71,2.84],
  '1295': [3.81,3.92,4.05,4.18,4.28,4.14,4.22,4.31,4.18,4.21],
  'AAPL': [164,172,185,194,208,219,225,231,224,227.84],
  'TSLA': [182,195,214,228,241,258,235,248,252,248.50],
  'NVDA': [85,94,102,108,118,126,129,131,129,131.38],
  'MSFT': [385,394,402,411,418,422,419,424,421,422.92],
  'BTC':  [49121,54280,61402,72840,81200,76540,85200,91800,95200,98421],
  'ETH':  [1521,1840,2240,2810,3200,3560,3820,3680,3720,3814],
  'GOLD': [2286,2340,2410,2480,2550,2820,2980,3100,3280,3341],
  'SPX':  [4803,4921,5084,5187,5264,5342,5418,5467,5451,5482.87],
};
function getChartData(sym){ return STOCK_CHARTS[sym] || [1,1.1,1.05,1.08,1.12,1.09,1.14,1.11,1.13,1.15]; }

function openMktSearch(){
  var overlay=document.getElementById('searchOverlay');
  overlay.style.display='flex';
  overlay.style.flexDirection='column';
  renderSearchRecent();
  setTimeout(function(){document.getElementById('globalSearchInput').focus();},200);
}
function closeSearch(){
  document.getElementById('searchOverlay').style.display='none';
  document.getElementById('globalSearchInput').value='';
  document.getElementById('searchResults').style.display='none';
  document.getElementById('searchRecent').style.display='block';
  document.getElementById('searchEmpty').style.display='none';
}
function renderSearchRecent(){
  var list=document.getElementById('searchRecentList');
  if(!list) return;
  var items=SEARCH_RECENT.map(function(sym){return WL_UNIVERSE.find(function(u){return u.sym===sym;});}).filter(Boolean);
  list.innerHTML=items.length?items.map(function(d,i){
    return searchItemHTML(d,i,items.length);
  }).join(''):'<div style="padding:16px;font-size:.84rem;color:var(--fg-3);text-align:center;">No recent searches</div>';
}
function globalSearch(q){
  var rec=document.getElementById('searchRecent');
  var res=document.getElementById('searchResults');
  var emp=document.getElementById('searchEmpty');
  var list=document.getElementById('searchResultsList');
  if(!q){rec.style.display='block';res.style.display='none';emp.style.display='none';return;}
  rec.style.display='none';
  var hits=WL_UNIVERSE.filter(function(u){
    return u.sym.toLowerCase().includes(q.toLowerCase())||u.name.toLowerCase().includes(q.toLowerCase());
  });
  if(!hits.length){res.style.display='none';emp.style.display='block';return;}
  emp.style.display='none';res.style.display='block';
  list.innerHTML=hits.map(function(d,i){return searchItemHTML(d,i,hits.length);}).join('');
}
function searchItemHTML(d,i,total){
  var sign=d.up?'+':'';var clr=d.up?'var(--green)':'var(--red)';
  var typeBg=d.type==='Bursa'?'var(--blue-bg)':d.type==='Crypto'?'#F5F3FF':d.type==='Forex'?'var(--green-bg)':d.type==='Commodity'?'var(--orange-bg)':'var(--gray-100)';
  var typeC=d.type==='Bursa'?'var(--blue)':d.type==='Crypto'?'#7C3AED':d.type==='Forex'?'var(--green)':d.type==='Commodity'?'var(--orange)':'var(--fg-3)';
  return '<div data-stock-sym="'+d.sym+'" style="display:flex;align-items:center;padding:12px 16px;border-bottom:'+(i<total-1?'1px solid var(--border)':'none')+';cursor:pointer;active:background:var(--gray-50);">'
    +'<div style="width:38px;height:38px;border-radius:10px;background:'+typeBg+';display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:12px;font-size:.62rem;font-weight:700;color:'+typeC+';text-align:center;">'+d.sym+'</div>'
    +'<div style="flex:1;min-width:0;">'
      +'<div style="font-size:.88rem;font-weight:600;color:var(--fg-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+d.name+'</div>'
      +'<div style="font-size:.72rem;color:var(--fg-3);margin-top:1px;">'+d.type+'</div>'
    +'</div>'
    +'<div style="text-align:right;">'
      +'<div style="font-size:.88rem;font-weight:700;color:var(--fg-1);">'+fmtNum(d.v)+'</div>'
      +'<div style="font-size:.72rem;font-weight:700;color:'+clr+';">'+sign+d.cp.toFixed(2)+'%</div>'
    +'</div>'
    +'</div>';
}

// Stock detail
function openStockDetail(sym){
  var d=WL_UNIVERSE.find(function(u){return u.sym===sym;});
  if(!d) return;
  // Add to recent
  SEARCH_RECENT=SEARCH_RECENT.filter(function(s){return s!==sym;});
  SEARCH_RECENT.unshift(sym);
  if(SEARCH_RECENT.length>5) SEARCH_RECENT.pop();
  var fund=STOCK_FUNDAMENTALS[sym]||{desc:'Market data for '+d.name,mktCap:'—',pe:'—',eps:'—',div:'—',wk52H:'—',wk52L:'—',vol:'—',sector:d.type};
  var chartData=getChartData(sym);
  var inWl=WL_ITEMS.indexOf(sym)!==-1;
  var sign=d.up?'+':'';var clr=d.up?'var(--green)':'var(--red)';
  // Build canvas sparkline SVG inline
  var mn=Math.min.apply(null,chartData),mx=Math.max.apply(null,chartData),rng=mx-mn||1;
  var n=chartData.length,W=320,H=80,pad=8;
  function px(i){return pad+(i/(n-1))*(W-pad*2);}
  function py(v){return H-pad-((v-mn)/rng)*(H-pad*2);}
  var pathD=chartData.map(function(v,i){return (i?'L':'M')+px(i).toFixed(1)+','+py(v).toFixed(1);}).join('');
  var areaD=pathD+' L'+px(n-1).toFixed(1)+','+(H-pad)+' L'+px(0).toFixed(1)+','+(H-pad)+'Z';
  var chartSVG='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;height:80px;display:block">'
    +'<defs><linearGradient id="sdg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+(d.up?'#2E7D32':'#DC2626')+'" stop-opacity=".18"/><stop offset="1" stop-color="'+(d.up?'#2E7D32':'#DC2626')+'" stop-opacity="0"/></linearGradient></defs>'
    +'<path d="'+areaD+'" fill="url(#sdg)"/>'
    +'<path d="'+pathD+'" fill="none" stroke="'+(d.up?'#2E7D32':'#DC2626')+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
    +'<circle cx="'+px(n-1).toFixed(1)+'" cy="'+py(chartData[n-1]).toFixed(1)+'" r="3" fill="#fff" stroke="'+(d.up?'#2E7D32':'#DC2626')+'" stroke-width="2"/>'
    +'</svg>';

  function kv(label,val){
    return '<div style="padding:11px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">'
      +'<span style="font-size:.82rem;color:var(--fg-3);">'+label+'</span>'
      +'<span style="font-size:.84rem;font-weight:600;color:var(--fg-1);">'+val+'</span>'
      +'</div>';
  }

  document.getElementById('stockSheetContent').innerHTML=
    // Header
    '<div style="padding:16px 20px 0;">'
      +'<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;">'
        +'<div>'
          +'<div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--fg-3);margin-bottom:4px;">'+fund.sector+'</div>'
          +'<div style="font-size:1.05rem;font-weight:700;color:var(--fg-1);">'+d.name+'</div>'
          +'<div style="font-size:.78rem;color:var(--fg-3);margin-top:2px;">'+d.sym+'</div>'
        +'</div>'
        +'<button data-wl-sym="'+sym+'" style="font:inherit;font-size:.78rem;font-weight:700;padding:7px 14px;border-radius:99px;border:1.5px solid '+(inWl?'var(--red)':'var(--blue)')+';background:'+(inWl?'var(--red-bg)':'var(--blue-bg)')+';color:'+(inWl?'var(--red)':'var(--blue)')+';cursor:pointer;">'+(inWl?'★ Watching':'☆ Watchlist')+'</button>'
      +'</div>'
      // Price
      +'<div style="font-size:2.2rem;font-weight:700;letter-spacing:-.03em;color:var(--fg-1);">'+fmtNum(d.v)+'</div>'
      +'<div style="font-size:.9rem;font-weight:700;color:'+clr+';margin-top:2px;">'+sign+(d.c>=0?d.c.toFixed(2):d.c.toFixed(2))+' ('+sign+d.cp.toFixed(2)+'%)'
        +'<span style="font-size:.75rem;font-weight:400;color:var(--fg-3);margin-left:6px;">Today</span></div>'
    +'</div>'
    // Chart
    +'<div style="padding:16px 20px 8px;">'+chartSVG+'</div>'
    // Description
    +'<div style="padding:0 20px 14px;font-size:.82rem;color:var(--fg-2);line-height:1.7;">'+fund.desc+'</div>'
    // Key stats
    +'<div style="padding:0 20px 4px;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--fg-3);">Key Statistics</div>'
    +'<div style="padding:0 20px;">'
      +kv('Market Cap',fund.mktCap)
      +kv('P/E Ratio',fund.pe)
      +kv('EPS',fund.eps)
      +kv('Dividend Yield',fund.div)
      +kv('52W High',fund.wk52H)
      +kv('52W Low',fund.wk52L)
      +kv('Volume',fund.vol)
    +'</div>'
    // Action buttons
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:16px 20px 0;">'
      +'<button onclick="openSheet(\'subscribe\')" style="padding:13px;border-radius:12px;border:none;background:var(--blue);color:#fff;font:inherit;font-size:.88rem;font-weight:700;cursor:pointer;">Subscribe</button>'
      +'<button onclick="openSheet(\'redeem\')" style="padding:13px;border-radius:12px;border:1.5px solid var(--border);background:#fff;color:var(--fg-1);font:inherit;font-size:.88rem;font-weight:600;cursor:pointer;">Redeem</button>'
    +'</div>';

  document.getElementById('sheetScrim').classList.add('vis');
  document.getElementById('stockSheet').classList.add('vis');
}

// Event delegation for stock rows + watchlist toggle in detail
document.addEventListener('click',function(e){
  var stockRow=e.target.closest('[data-stock-sym]');
  if(stockRow){openStockDetail(stockRow.getAttribute('data-stock-sym'));return;}
  var wlBtn=e.target.closest('[data-wl-sym]');
  if(wlBtn){
    var sym=wlBtn.getAttribute('data-wl-sym');
    toggleWlItem(sym);
    var inWl=WL_ITEMS.indexOf(sym)!==-1;
    wlBtn.textContent=inWl?'★ Watching':'☆ Watchlist';
    wlBtn.style.borderColor=inWl?'var(--red)':'var(--blue)';
    wlBtn.style.background=inWl?'var(--red-bg)':'var(--blue-bg)';
    wlBtn.style.color=inWl?'var(--red)':'var(--blue)';
  }
});


// Full stock/index universe for search
var WL_UNIVERSE=[
  {sym:'KLCI',  name:'FBM KLCI',          type:'Index', v:1524.38, c:8.72,   cp:0.57,  up:true},
  {sym:'5168',  name:'Hartalega Holdings', type:'Bursa', v:2.84,   c:0.06,   cp:2.16,  up:true},
  {sym:'1295',  name:'Public Bank',        type:'Bursa', v:4.21,   c:-0.03,  cp:-0.71, up:false},
  {sym:'5225',  name:'IHH Healthcare',     type:'Bursa', v:2.18,   c:0.02,   cp:0.93,  up:true},
  {sym:'6947',  name:'DiGi.Com',           type:'Bursa', v:3.96,   c:-0.04,  cp:-1.00, up:false},
  {sym:'4707',  name:'Nestle Malaysia',    type:'Bursa', v:102.40, c:0.40,   cp:0.39,  up:true},
  {sym:'1818',  name:'Bursa Malaysia',     type:'Bursa', v:7.20,   c:0.05,   cp:0.70,  up:true},
  {sym:'7277',  name:'Dialog Group',       type:'Bursa', v:2.44,   c:-0.02,  cp:-0.81, up:false},
  {sym:'0166',  name:'Inari Amertron',     type:'Bursa', v:3.18,   c:0.08,   cp:2.58,  up:true},
  {sym:'AAPL',  name:'Apple Inc.',         type:'Nasdaq',v:227.84, c:2.44,   cp:1.08,  up:true},
  {sym:'TSLA',  name:'Tesla Inc.',         type:'Nasdaq',v:248.50, c:-8.22,  cp:-3.20, up:false},
  {sym:'NVDA',  name:'NVIDIA Corp.',       type:'Nasdaq',v:131.38, c:4.82,   cp:3.81,  up:true},
  {sym:'MSFT',  name:'Microsoft Corp.',    type:'Nasdaq',v:422.92, c:1.84,   cp:0.44,  up:true},
  {sym:'GOOGL', name:'Alphabet Inc.',      type:'Nasdaq',v:195.41, c:-1.22,  cp:-0.62, up:false},
  {sym:'AMZN',  name:'Amazon.com Inc.',    type:'Nasdaq',v:228.10, c:3.14,   cp:1.40,  up:true},
  {sym:'SPX',   name:'S&P 500',            type:'Index', v:5482.87,c:38.24,  cp:0.70,  up:true},
  {sym:'NDX',   name:'Nasdaq 100',         type:'Index', v:19842.33,c:152.44,cp:0.77,  up:true},
  {sym:'GOLD',  name:'Gold Spot (USD/oz)', type:'Commodity',v:3341.20,c:12.40,cp:0.37,up:true},
  {sym:'CRUDE', name:'Crude Oil (Brent)',  type:'Commodity',v:74.82, c:-0.58, cp:-0.77,up:false},
  {sym:'EURUSD',name:'EUR/USD',            type:'Forex', v:1.0842, c:0.0024, cp:0.22,  up:true},
  {sym:'USDJPY',name:'USD/JPY',            type:'Forex', v:149.88, c:-0.44,  cp:-0.29, up:false},
  {sym:'BTC',   name:'Bitcoin',            type:'Crypto',v:98421,  c:1842,   cp:1.91,  up:true},
  {sym:'ETH',   name:'Ethereum',           type:'Crypto',v:3814.20,c:-82.40, cp:-2.12, up:false},
];

// Default watchlist
var WL_ITEMS=['KLCI','5168','AAPL','GOLD'];

function renderWatchlist(){
  var list=document.getElementById('wlList');
  var empty=document.getElementById('wlEmpty');
  var cnt=document.getElementById('wlCount');
  var gainEl=document.getElementById('wlGainers');
  var loseEl=document.getElementById('wlLosers');
  var timeEl=document.getElementById('wlTime');
  if(timeEl){var d=new Date(),h=d.getHours(),m=d.getMinutes();timeEl.textContent='Updated '+(h%12||12)+':'+(m<10?'0':'')+m+(h>=12?' PM':' AM');}
  var items=WL_ITEMS.map(function(s){return WL_UNIVERSE.find(function(u){return u.sym===s;});}).filter(Boolean);
  if(cnt) cnt.textContent=items.length;
  if(gainEl) gainEl.textContent=items.filter(function(i){return i.up;}).length;
  if(loseEl) loseEl.textContent=items.filter(function(i){return !i.up;}).length;
  if(!items.length){
    if(list) list.innerHTML='';
    if(empty) empty.style.display='flex';
    return;
  }
  if(empty) empty.style.display='none';
  if(!list) return;
  list.innerHTML=items.map(function(d,i){
    var sign=d.up?'+':'';
    var clr=d.up?'var(--green)':'var(--red)';
    var typeBg=d.type==='Bursa'?'var(--blue-bg)':d.type==='Crypto'?'#F5F3FF':d.type==='Forex'?'var(--green-bg)':d.type==='Commodity'?'var(--orange-bg)':'var(--gray-100)';
    var typeC=d.type==='Bursa'?'var(--blue)':d.type==='Crypto'?'#7C3AED':d.type==='Forex'?'var(--green)':d.type==='Commodity'?'var(--orange)':'var(--fg-3)';
    return '<div style="display:flex;align-items:center;padding:13px 16px;border-bottom:'+(i<items.length-1?'1px solid var(--border)':'none')+';">'
      +'<div style="width:40px;height:40px;border-radius:11px;background:'+typeBg+';display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:12px;font-size:.65rem;font-weight:700;color:'+typeC+';text-align:center;line-height:1.2">'+d.sym+'</div>'
      +'<div style="flex:1;min-width:0;">'
        +'<div style="font-size:.88rem;font-weight:600;color:var(--fg-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+d.name+'</div>'
        +'<div style="font-size:.7rem;color:var(--fg-3);margin-top:2px;">'+d.type+'</div>'
      +'</div>'
      +'<div style="text-align:right;flex-shrink:0;margin-right:12px;">'
        +'<div style="font-size:.92rem;font-weight:700;font-family:monospace;color:var(--fg-1);">'+fmtNum(d.v)+'</div>'
        +'<div style="font-size:.72rem;font-weight:700;color:'+clr+';">'+sign+d.cp.toFixed(2)+'%</div>'
      +'</div>'
      +'<button data-rm="1" data-sym-rm="'+d.sym+'" style="background:none;border:none;cursor:pointer;padding:4px;color:#CBD5E1;flex-shrink:0;" title="Remove">'
        +'<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>'
      +'</button>'
      +'</div>';
  }).join('');
}

function removeWlItem(sym){
  WL_ITEMS=WL_ITEMS.filter(function(s){return s!==sym;});
  renderWatchlist();
  showToastM('Removed from watchlist');
}

function openWlSearch(){
  document.getElementById('sheetScrim').classList.add('vis');
  document.getElementById('wlSearchSheet').classList.add('vis');
  document.getElementById('wlSearchInput').value='';
  wlSearch('');
  setTimeout(function(){document.getElementById('wlSearchInput').focus();},300);
}
function closeWlSearch(){
  document.getElementById('wlSearchSheet').classList.remove('vis');
  document.getElementById('sheetScrim').classList.remove('vis');
}

function switchFundTab2(tab){
  ['chart','profile','results','portfolio','shareholder'].forEach(function(t){
    document.getElementById('ftab-'+t+'-body').style.display=tab===t?'block':'none';
    document.getElementById('ftab-'+t+'-btn').style.color=tab===t?'var(--blue)':'var(--fg-3)';
    document.getElementById('ftab-'+t+'-btn').style.borderBottomColor=tab===t?'var(--blue)':'transparent';
  });
  if(tab==='chart'){
    function tryFundChart(n){
      var c=document.getElementById('candleChart');
      if(c && c.parentElement && c.parentElement.clientWidth>0){
        attachCandleListeners();
        loadFundChartData();
      } else if(n>0){setTimeout(function(){tryFundChart(n-1);},120);}
    }
    setTimeout(function(){tryFundChart(10);},80);
  }
  if(tab==='results') setTimeout(function(){loadResultsData();},50);
  if(tab==='portfolio') setTimeout(function(){loadPortfolioData();},50);
  if(tab==='shareholder'){
    setTimeout(function(){loadShareholderData();},50);
    var btn=document.querySelector('.ownership-open-btn');
    if(btn && !btn._wired){btn.addEventListener('click',function(){openOwnershipPanel();});btn._wired=true;}
    var closeBtn=document.querySelector('.ownership-close-btn');
    if(closeBtn && !closeBtn._wired){closeBtn.addEventListener('click',function(){closeOwnershipPanel();});closeBtn._wired=true;}
  }
}

// ── FUND CHART TAB (real data) ──────────────────────────────────────────
var FUND_NTA_DAILY=[], FUND_NTA_WEEKLY=[], FUND_NTA_MONTHLY=[], FUND_NTA_QUARTERLY=[];
var FUND_CORR_LOADED=false;
var fundChartDataLoaded=false;

function fundCutoffDate(period,latestDateStr){
  if(!latestDateStr) return '0000-00-00';
  var latest=new Date(latestDateStr+'T00:00:00');
  var d=new Date(latest.getTime());
  switch(period){
    case 'ytd': d=new Date(latest.getFullYear(),0,1); break;
    case '1m': d.setMonth(d.getMonth()-1); break;
    case '3m': d.setMonth(d.getMonth()-3); break;
    case '6m': d.setMonth(d.getMonth()-6); break;
    case '1y': d.setFullYear(d.getFullYear()-1); break;
    case '3y': d.setFullYear(d.getFullYear()-3); break;
    case 'all': default: return '0000-00-00';
  }
  return d.toISOString().slice(0,10);
}

async function loadFundChartData(){
  if(fundChartDataLoaded){
    // Already loaded once this session — just redraw with current controls.
    drawCandleChart(activeCPeriod||'ytd',null,null);
    updateFundSummaryHeader();
    if(!FUND_CORR_LOADED) loadFundCorrelationAndSharpe();
    return;
  }
  try{
    if(typeof sb==='undefined'||!sb) return;
    var results=await Promise.allSettled([
      mpLoadNtaDaily(), mpLoadNtaWeeklyOHLC(), mpLoadNtaMonthly(), mpLoadNtaQuarterlyOHLC()
    ]);
    FUND_NTA_DAILY=(results[0].status==='fulfilled')?(results[0].value||[]):[];
    FUND_NTA_WEEKLY=(results[1].status==='fulfilled')?(results[1].value||[]):[];
    FUND_NTA_MONTHLY=(results[2].status==='fulfilled')?(results[2].value||[]):[];
    FUND_NTA_QUARTERLY=(results[3].status==='fulfilled')?(results[3].value||[]):[];
    fundChartDataLoaded=true;
    updateFundSummaryHeader();
    drawCandleChart('ytd',null,null);
    loadFundCorrelationAndSharpe();
  }catch(e){ console.warn('[Fund Chart] load failed:', e.message); }
}

function getFundCandleSource(){
  var sel=document.getElementById('candleDataType');
  var gran=sel?sel.value:'weekly';
  if(gran==='monthly') return FUND_NTA_MONTHLY;
  if(gran==='quarterly') return FUND_NTA_QUARTERLY;
  return FUND_NTA_WEEKLY;
}

// Price header: latest daily NTA, week-over-week change, latest weekly
// candle's O/H/L, 52-week high/low from daily history, dividend/yield from
// the latest completed FY, and Market Value / Avg Cost reusing the same
// PA_ACCT/JA_ACCT already computed for the Account Summary page.
