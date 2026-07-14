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

// Full stock/index universe for the Watchlist screen (global search is
// backed by real "instruments" table data instead — see
// assets/js/phone/search-instruments.js).
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
  if(typeof applyFundRestriction==='function') applyFundRestriction();
  var restricted=(typeof ACCOUNT_RESTRICTED!=='undefined'&&ACCOUNT_RESTRICTED);
  // Pending/suspended accounts see the tab-lock overlay instead — skip
  // fetching data they can't view anyway.
  if(restricted && (tab==='results'||tab==='portfolio'||tab==='shareholder')) return;
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
