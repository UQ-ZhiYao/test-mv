/* ===== assets/js/phone/search-instruments.js — Global search (real
   "instruments" table, product="Securities") + the Instrument Detail page
   it opens =====
   The first result is always "ZY-Invest" itself — pinned, tapping it goes
   straight to the Fund page — since this is a single-fund platform and
   that's the one thing worth surfacing no matter what was typed. Every
   other result is a real row from the instruments table (searchable by
   name, ticker, or code), fetched once per session and filtered
   client-side as the member types, same pattern the old mock-data search
   used, just backed by real data now. */

var SEARCH_INSTRUMENTS = null;   // lazy-loaded [{name,ticker,code,product,sector,currency}]
var SEARCH_LOAD_PROMISE = null;
var SEARCH_RECENT_CODES = [];    // recently-opened instrument codes, most recent first
// 'navigate' (default, opened via the topbar search icon): tapping ZY-Invest
// goes to the Fund page, tapping an instrument opens Instrument Detail.
// 'add-watchlist' (opened via Watchlist's "Add Instrument" — see
// openWlSearch() in watchlist-actions.js): this exact same overlay is
// reused instead of a separate picker, but ZY-Invest isn't offered (it
// can't be "watched") and tapping an instrument toggles it in/out of the
// watchlist in place instead of navigating away.
var SEARCH_MODE = 'navigate';

function ensureSearchInstruments(){
  if(SEARCH_INSTRUMENTS) return Promise.resolve(SEARCH_INSTRUMENTS);
  if(!SEARCH_LOAD_PROMISE){
    SEARCH_LOAD_PROMISE=mpLoadSecuritiesInstruments()
      .then(function(rows){ SEARCH_INSTRUMENTS=rows; return rows; })
      .catch(function(e){ console.error('Search: failed to load instruments —',e&&e.message); SEARCH_INSTRUMENTS=[]; return SEARCH_INSTRUMENTS; });
  }
  return SEARCH_LOAD_PROMISE;
}
function instrumentByCode(code){
  return (SEARCH_INSTRUMENTS||[]).find(function(u){return u.code===code;});
}
// Ticker and code shown together ("TICK | CODE") only when code exists —
// just the ticker (or code alone, if that's all there is) otherwise.
function zyInstrumentSubline(ticker,code){
  var tick=(ticker||'').trim();
  var co=(code||'').trim();
  if(!co) return tick||'—';
  return tick?tick+' | '+co:co;
}

function openMktSearch(){
  SEARCH_MODE='navigate';
  document.getElementById('globalSearchInput').placeholder='Search stocks, indices, crypto…';
  var label=document.getElementById('searchRecentLabel');
  if(label) label.textContent='Recent';
  openSearchOverlay();
}
function openSearchOverlay(){
  var overlay=document.getElementById('searchOverlay');
  overlay.style.display='flex';
  overlay.style.flexDirection='column';
  renderSearchRecent();
  ensureSearchInstruments().then(function(){
    var q=document.getElementById('globalSearchInput').value;
    if(q) globalSearch(q); else renderSearchRecent();
  });
  setTimeout(function(){document.getElementById('globalSearchInput').focus();},200);
}
function closeSearch(){
  SEARCH_MODE='navigate';
  document.getElementById('searchOverlay').style.display='none';
  document.getElementById('globalSearchInput').value='';
  document.getElementById('searchResults').style.display='none';
  document.getElementById('searchRecent').style.display='block';
}

function zyInvestSearchRowHTML(){
  return '<div data-zy-fund="1" style="display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;">'
    +'<div style="width:38px;height:38px;border-radius:10px;background:var(--blue-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:12px;">'
      +'<img src="../assets/img/logo.png" alt="" style="width:20px;height:20px;">'
    +'</div>'
    +'<div style="flex:1;min-width:0;">'
      +'<div style="font-size:.88rem;font-weight:600;color:var(--fg-1);">ZY-Invest</div>'
      +'<div style="font-size:.72rem;color:var(--fg-3);margin-top:1px;">Fund</div>'
    +'</div>'
    +'<span class="menu-arr">›</span>'
    +'</div>';
}
function instrumentSearchRowHTML(inst,i,total){
  var sub=zyInstrumentSubline(inst.ticker,inst.code);
  var tick=((inst.ticker||inst.code)||'').trim();
  var trailing='<span class="menu-arr">›</span>';
  if(SEARCH_MODE==='add-watchlist'){
    var saved=(typeof WATCHLIST_ITEMS!=='undefined'&&WATCHLIST_ITEMS||[]).some(function(w){return w.code===inst.code;});
    trailing=saved
      ? '<svg width="20" height="20" viewBox="0 0 24 24" stroke="var(--green)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" stroke="var(--blue)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';
  }
  return '<div data-inst-code="'+(inst.code||'')+'" style="display:flex;align-items:center;padding:12px 16px;border-bottom:'+(i<total-1?'1px solid var(--border)':'none')+';cursor:pointer;">'
    +'<div style="width:38px;height:38px;border-radius:10px;background:var(--gray-100);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:12px;font-size:.6rem;font-weight:700;color:var(--fg-3);text-align:center;overflow:hidden;">'+(tick||'—')+'</div>'
    +'<div style="flex:1;min-width:0;">'
      +'<div style="font-size:.88rem;font-weight:600;color:var(--fg-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+inst.name+'</div>'
      +'<div style="font-size:.72rem;color:var(--fg-3);margin-top:1px;">'+sub+'</div>'
    +'</div>'
    +trailing
    +'</div>';
}
function renderSearchRecent(){
  var list=document.getElementById('searchRecentList');
  if(!list) return;
  if(SEARCH_MODE==='add-watchlist'){
    // No "recently viewed" concept when picking something to watch — show
    // every Securities instrument, same as the default (empty-query) view
    // the dedicated Add sheet used to show before it was folded into this
    // shared overlay.
    var all=SEARCH_INSTRUMENTS||[];
    list.innerHTML=all.map(function(d,i){return instrumentSearchRowHTML(d,i,all.length);}).join('');
    return;
  }
  var recentItems=SEARCH_RECENT_CODES.map(function(code){return instrumentByCode(code);}).filter(Boolean);
  list.innerHTML=zyInvestSearchRowHTML()+recentItems.map(function(d,i){return instrumentSearchRowHTML(d,i,recentItems.length);}).join('');
}
function globalSearch(q){
  var rec=document.getElementById('searchRecent');
  var res=document.getElementById('searchResults');
  var list=document.getElementById('searchResultsList');
  if(!q){ rec.style.display='block'; res.style.display='none'; renderSearchRecent(); return; }
  rec.style.display='none'; res.style.display='block';
  var insts=SEARCH_INSTRUMENTS||[];
  var ql=q.toLowerCase();
  var hits=insts.filter(function(u){
    return (u.name||'').toLowerCase().indexOf(ql)!==-1
      || (u.ticker||'').toLowerCase().indexOf(ql)!==-1
      || (u.code||'').toLowerCase().indexOf(ql)!==-1;
  });
  var body=hits.length
    ? hits.map(function(d,i){return instrumentSearchRowHTML(d,i,hits.length);}).join('')
    : '<div style="padding:24px 16px;text-align:center;font-size:.8rem;color:var(--fg-3);">No matching instruments</div>';
  // ZY-Invest is always the first result in navigate mode, regardless of
  // query — it's the one thing on this single-fund platform worth
  // surfacing no matter what was typed. It isn't offered in
  // add-watchlist mode (the fund itself can't be "watched").
  list.innerHTML=(SEARCH_MODE==='add-watchlist'?'':zyInvestSearchRowHTML())+body;
}

// Event delegation for the two row types in the search overlay.
document.addEventListener('click',function(e){
  var zyRow=e.target.closest('[data-zy-fund]');
  if(zyRow){ closeSearch(); switchTab('fund'); return; }
  var instRow=e.target.closest('[data-inst-code]');
  if(instRow){
    var code=instRow.getAttribute('data-inst-code');
    if(SEARCH_MODE==='add-watchlist') toggleWlItem(code);
    else openInstrumentDetail(code);
    return;
  }
});

// ── INSTRUMENT DETAIL PAGE ──────────────────────────────────────────────
var INST_DETAIL_CODE=null;
var INST_DETAIL_PERIOD='1M';
function openInstrumentDetail(code){
  var inst=instrumentByCode(code);
  if(!inst) return;
  closeSearch();

  SEARCH_RECENT_CODES=SEARCH_RECENT_CODES.filter(function(c){return c!==code;});
  SEARCH_RECENT_CODES.unshift(code);
  if(SEARCH_RECENT_CODES.length>5) SEARCH_RECENT_CODES.pop();

  INST_DETAIL_CODE=code;
  switchTab('instrument');
  // switchTab() -> updateTopbarChrome() just set the static DRILL_PAGES
  // title ("Instrument") — overwrite it with this instrument's real name
  // now that we're past that call.
  var titleEl=document.getElementById('topbarBackTitle');
  if(titleEl) titleEl.textContent=inst.name;

  var tick=((inst.ticker||inst.code)||'').trim();
  var nameEl=document.getElementById('instName');
  if(nameEl) nameEl.textContent=inst.name;
  var subEl=document.getElementById('instSub');
  if(subEl) subEl.textContent=[tick,inst.sector].filter(Boolean).join(' · ');
  var tEl=document.getElementById('instAboutTicker'); if(tEl) tEl.textContent=tick||'—';
  var secEl=document.getElementById('instAboutSector'); if(secEl) secEl.textContent=inst.sector||'—';
  var prodEl=document.getElementById('instAboutProduct'); if(prodEl) prodEl.textContent=inst.product||'—';
  var curEl=document.getElementById('instAboutCurrency'); if(curEl) curEl.textContent=inst.currency||'—';

  switchInstrumentPeriod(INST_DETAIL_PERIOD);
}
function switchInstrumentPeriod(periodKey){
  INST_DETAIL_PERIOD=periodKey;
  document.querySelectorAll('.inst-period-btn').forEach(function(b){
    var on=b.getAttribute('data-period')===periodKey;
    b.style.color=on?'var(--blue)':'var(--fg-3)';
    b.style.background=on?'var(--blue-bg)':'transparent';
  });
  loadInstrumentDetailData();
}
async function loadInstrumentDetailData(){
  if(!INST_DETAIL_CODE) return;
  var code=INST_DETAIL_CODE, periodKey=INST_DETAIL_PERIOD;
  var inst=instrumentByCode(code);
  if(!inst) return;
  // "code" is the Yahoo-fetchable market symbol (confirmed against real
  // instruments data — "ticker" can hold a non-fetchable label like
  // "ZETRIX" that 502s against fetch-historical/fetch-quotes). Falls back
  // to ticker only if code is somehow blank.
  var symbol=(inst.code&&inst.code.trim())||(inst.ticker&&inst.ticker.trim());
  if(!symbol){ drawInstrumentDetailChart([]); renderInstrumentDetailSummary(null); return; }
  var period=null;
  for(var i=0;i<MKT_IDX_PERIODS.length;i++){ if(MKT_IDX_PERIODS[i].key===periodKey){ period=MKT_IDX_PERIODS[i]; break; } }
  if(!period) period=MKT_IDX_PERIODS[2];
  function stillCurrent(){ return code===INST_DETAIL_CODE&&periodKey===INST_DETAIL_PERIOD; }
  var results=await Promise.allSettled([
    mpLoadHistorical(symbol,period.interval,period.range),
    mpLoadQuotes([symbol])
  ]);
  if(!stillCurrent()) return;
  var chartResult=results[0], quotesResult=results[1];
  if(chartResult.status==='fulfilled'){ drawInstrumentDetailChart(chartResult.value); }
  else{ console.warn('[Instrument] chart load failed:',chartResult.reason&&chartResult.reason.message); drawInstrumentDetailChart([]); }
  if(quotesResult.status==='fulfilled'){ renderInstrumentDetailSummary(mktQuoteBySymbol(quotesResult.value,symbol)); }
  else{ console.warn('[Instrument] summary load failed:',quotesResult.reason&&quotesResult.reason.message); renderInstrumentDetailSummary(null); }
}
function drawInstrumentDetailChart(points){ drawDetailChart('instChart',points); }
function renderInstrumentDetailSummary(q){
  var el=document.getElementById('instSummary');
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
