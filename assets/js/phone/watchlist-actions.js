/* ===== assets/js/phone/watchlist-actions.js — Watchlist screen (real
   "watchlist" table) =====
   Each saved row is {id,name,code,ticker,created_at} — id is the
   watchlist row's own PK (used to remove it), code is the market symbol
   used both for the live price fetch (mpLoadQuotes) and for opening the
   shared Instrument Detail page (openInstrumentDetail() in
   search-instruments.js), backed by the same "instruments"
   product=Securities cache the Add sheet searches against. */

var WATCHLIST_ITEMS=null; // [{id,name,code,ticker,created_at}] once loaded
var WL_EDIT_MODE=false;

function renderWatchlist(retriesLeft){
  var list=document.getElementById('wlList');
  if(!list) return;
  if(!AUTH_USER){
    // Called from the eager boot-time init chain (misc.js's loadPages()
    // callback), which can run before loadProfileData() resolves and sets
    // AUTH_USER — retry briefly instead of querying with an undefined uid.
    if(retriesLeft===undefined) retriesLeft=10;
    if(retriesLeft<=0) return;
    setTimeout(function(){renderWatchlist(retriesLeft-1);},300);
    return;
  }
  loadAndRenderWatchlist();
}

async function loadAndRenderWatchlist(){
  var list=document.getElementById('wlList');
  if(!list) return;
  list.innerHTML='<div style="padding:16px;text-align:center;color:var(--fg-3);font-size:.72rem;">Loading…</div>';
  var results=await Promise.allSettled([
    mpLoadWatchlist(AUTH_USER.id),
    ensureSearchInstruments() // so tapping a row can resolve its instrument straight away
  ]);
  if(results[0].status==='fulfilled'){
    WATCHLIST_ITEMS=results[0].value;
  }else{
    console.error('Watchlist: failed to load —',results[0].reason&&results[0].reason.message);
    WATCHLIST_ITEMS=[];
  }
  await drawWatchlistList();
}

async function drawWatchlistList(){
  var list=document.getElementById('wlList');
  var empty=document.getElementById('wlEmpty');
  var timeEl=document.getElementById('wlTime');
  var editItem=document.getElementById('wlEditListItem');
  if(!list) return;
  var items=WATCHLIST_ITEMS||[];
  if(timeEl){var d=new Date(),h=d.getHours(),m=d.getMinutes();timeEl.textContent='Updated '+(h%12||12)+':'+(m<10?'0':'')+m+(h>=12?' PM':' AM');}
  if(editItem){
    var hasItems=items.length>0;
    editItem.style.opacity=hasItems?'1':'.4';
    editItem.style.cursor=hasItems?'pointer':'default';
  }
  if(!items.length){
    list.innerHTML='';
    if(empty) empty.style.display='block';
    WL_EDIT_MODE=false;
    updateWlEditLabel();
    return;
  }
  if(empty) empty.style.display='none';

  // Render rows immediately (no price yet), then fill in live prices once
  // the batch quote fetch resolves — same reasoning as the Market list,
  // no need to block the row layout on a network round trip.
  list.innerHTML=items.map(function(d,i){return wlRowHTML(d,i,items.length,null);}).join('');

  var codes=items.map(function(d){return d.code;}).filter(Boolean);
  if(!codes.length) return;
  try{
    var quotes=await mpLoadQuotes(codes);
    items.forEach(function(d,i){
      var q=mktQuoteBySymbol(quotes,d.code);
      var row=document.getElementById('wlRow-'+d.id);
      if(row) row.outerHTML=wlRowHTML(d,i,items.length,q);
    });
  }catch(e){
    console.warn('Watchlist: quote fetch failed —',e&&e.message);
  }
}

// Same as market-data.js's mktFmtPrice()/mktFmtChangeCombined(), except
// sub-10 values show 3 decimal places here instead of 4 — Watchlist-only,
// the Market screen's own list keeps its existing 4-decimal precision.
function wlFmtPrice(v){
  if(v==null||isNaN(v)) return '—';
  if(Math.abs(v)>=1000) return v.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
  return v.toFixed(v<10?3:2);
}
function wlFmtChangeCombined(change,changePct){
  if(change==null||changePct==null||isNaN(change)||isNaN(changePct)) return {txt:'—',color:'var(--fg-3)'};
  var sign=change>=0?'+':'';
  var pctSign=changePct>=0?'+':'';
  return {txt:sign+wlFmtPrice(Math.abs(change))+' ('+pctSign+changePct.toFixed(2)+'%)', color:change>=0?'var(--green)':'var(--red)'};
}

// Full-width, no card, no icon badge — same flat row treatment as the
// Market screen's list (mktRenderRow() in market-data.js): left = name +
// ticker subline, right = price + change. The only addition over
// mktRenderRow itself is the optional trailing remove button in edit
// mode, which that shared helper has no slot for.
function wlRowHTML(d,i,total,q){
  var chg=q?wlFmtChangeCombined(q.regularMarketChange,q.regularMarketChangePercent):{txt:'—',color:'var(--fg-3)'};
  var priceTxt=q?wlFmtPrice(q.regularMarketPrice):'—';
  var sub=zyInstrumentSubline(d.ticker,d.code);
  var removeBtn=WL_EDIT_MODE
    ? '<button data-wl-rm="'+d.id+'" style="background:none;border:none;cursor:pointer;padding:4px;margin-left:10px;color:var(--red);flex-shrink:0;" title="Remove">'
      +'<svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="8" x2="16" y2="16"/><line x1="16" y1="8" x2="8" y2="16"/></svg>'
      +'</button>'
    : '';
  return '<div id="wlRow-'+d.id+'" data-wl-open="'+d.code+'" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:'+(i<total-1?'1px solid var(--border)':'none')+';cursor:'+(WL_EDIT_MODE?'default':'pointer')+';">'
    +'<div style="min-width:0;">'
      +'<div style="font-size:.84rem;font-weight:700;color:var(--fg-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+d.name+'</div>'
      +'<div style="font-size:.71rem;color:var(--fg-3);margin-top:2px;">'+sub+'</div>'
    +'</div>'
    +'<div style="display:flex;align-items:center;flex-shrink:0;padding-left:10px;">'
      +'<div style="text-align:right;">'
        +'<div style="font-size:.86rem;font-weight:700;color:var(--fg-1);">'+priceTxt+'</div>'
        +'<div style="font-size:.72rem;font-weight:600;color:'+chg.color+';margin-top:2px;">'+chg.txt+'</div>'
      +'</div>'
      +removeBtn
    +'</div>'
    +'</div>';
}

function toggleWlEditMode(){
  if(!(WATCHLIST_ITEMS||[]).length) return;
  WL_EDIT_MODE=!WL_EDIT_MODE;
  updateWlEditLabel();
  drawWatchlistList();
}
function updateWlEditLabel(){
  var label=document.getElementById('wlEditLabel');
  if(label) label.textContent=WL_EDIT_MODE?'Done':'Edit List';
}
async function removeWlItem(id){
  if(!AUTH_USER) return;
  try{
    await mpRemoveWatchlistItem(AUTH_USER.id,id);
    WATCHLIST_ITEMS=(WATCHLIST_ITEMS||[]).filter(function(w){return String(w.id)!==String(id);});
    showToastM('Removed from watchlist');
    drawWatchlistList();
  }catch(e){
    showToastM('Could not remove — please try again');
  }
}

// ── ADD INSTRUMENT ──────────────────────────────────────────────────────
// Reuses the same full-screen search overlay the topbar's search icon
// opens (search-instruments.js) instead of a separate picker sheet —
// SEARCH_MODE='add-watchlist' changes that overlay's behavior: no
// ZY-Invest row, and tapping a result toggles it in/out of the watchlist
// (via toggleWlItem() below) instead of opening Instrument Detail.
function openWlSearch(){
  SEARCH_MODE='add-watchlist';
  document.getElementById('globalSearchInput').placeholder='Search instruments to add…';
  var label=document.getElementById('searchRecentLabel');
  if(label) label.textContent='All Instruments';
  openSearchOverlay();
}
async function toggleWlItem(code){
  if(!AUTH_USER) return;
  var existing=(WATCHLIST_ITEMS||[]).find(function(w){return w.code===code;});
  try{
    if(existing){
      await mpRemoveWatchlistItem(AUTH_USER.id,existing.id);
      WATCHLIST_ITEMS=WATCHLIST_ITEMS.filter(function(w){return w.id!==existing.id;});
      showToastM('Removed from watchlist');
    }else{
      var inst=(SEARCH_INSTRUMENTS||[]).find(function(u){return u.code===code;});
      if(!inst) return;
      if((WATCHLIST_ITEMS||[]).length>=50){showToastM('Max 50 items in watchlist');return;}
      await mpAddWatchlistItem(AUTH_USER.id,inst);
      WATCHLIST_ITEMS=await mpLoadWatchlist(AUTH_USER.id); // refetch to pick up the new row's id
      showToastM('Added to watchlist');
    }
  }catch(e){
    showToastM('Could not update watchlist — please try again');
    return;
  }
  // Re-render whichever of the search overlay's lists is currently
  // showing (Recent when the query is empty, Results otherwise) so the
  // tapped row's saved/unsaved indicator updates in place, plus the
  // Watchlist page's own list underneath.
  var q=document.getElementById('globalSearchInput');
  if(q){ if(q.value) globalSearch(q.value); else renderSearchRecent(); }
  drawWatchlistList();
}

// Event delegation for watchlist rows: open (navigate) or remove.
document.addEventListener('click',function(e){
  var rm=e.target.closest('[data-wl-rm]');
  if(rm){ removeWlItem(rm.getAttribute('data-wl-rm')); return; }
  var openRow=e.target.closest('[data-wl-open]');
  if(openRow && !WL_EDIT_MODE){ openInstrumentDetail(openRow.getAttribute('data-wl-open')); return; }
});
