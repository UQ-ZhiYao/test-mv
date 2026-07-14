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
