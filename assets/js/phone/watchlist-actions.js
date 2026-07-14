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

function wlRowHTML(d,i,total,q){
  var priceHTML=q
    ? '<div style="font-size:.92rem;font-weight:700;color:var(--fg-1);">'+mktFmtPrice(q.regularMarketPrice)+'</div>'
      +'<div style="font-size:.72rem;font-weight:700;color:'+mktFmtChangeCombined(q.regularMarketChange,q.regularMarketChangePercent).color+';">'+mktFmtChangeCombined(q.regularMarketChange,q.regularMarketChangePercent).txt+'</div>'
    : '<div style="font-size:.72rem;color:var(--fg-3);">—</div>';
  var tick=((d.ticker||d.code)||'').trim();
  var trailing=WL_EDIT_MODE
    ? '<button data-wl-rm="'+d.id+'" style="background:none;border:none;cursor:pointer;padding:4px;margin-left:8px;color:var(--red);flex-shrink:0;" title="Remove">'
      +'<svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="8" x2="16" y2="16"/><line x1="16" y1="8" x2="8" y2="16"/></svg>'
      +'</button>'
    : '<span class="menu-arr" style="margin-left:8px;">›</span>';
  return '<div id="wlRow-'+d.id+'" data-wl-open="'+d.code+'" style="display:flex;align-items:center;padding:13px 16px;border-bottom:'+(i<total-1?'1px solid var(--border)':'none')+';cursor:'+(WL_EDIT_MODE?'default':'pointer')+';">'
    +'<div style="width:40px;height:40px;border-radius:11px;background:var(--gray-100);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:12px;font-size:.6rem;font-weight:700;color:var(--fg-3);text-align:center;overflow:hidden;">'+(tick||'—')+'</div>'
    +'<div style="flex:1;min-width:0;">'
      +'<div style="font-size:.88rem;font-weight:600;color:var(--fg-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+d.name+'</div>'
      +'<div style="font-size:.7rem;color:var(--fg-3);margin-top:2px;">'+tick+'</div>'
    +'</div>'
    +'<div style="text-align:right;flex-shrink:0;">'+priceHTML+'</div>'
    +trailing
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
    var sheet=document.getElementById('wlSearchSheet');
    if(sheet&&sheet.classList.contains('vis')) wlSearch(document.getElementById('wlSearchInput').value);
  }catch(e){
    showToastM('Could not remove — please try again');
  }
}

// ── ADD-TO-WATCHLIST SHEET (searches the same real "instruments" cache
// global search uses, via ensureSearchInstruments()/SEARCH_INSTRUMENTS in
// search-instruments.js) ────────────────────────────────────────────────
function openWlSearch(){
  document.getElementById('sheetScrim').classList.add('vis');
  document.getElementById('wlSearchSheet').classList.add('vis');
  document.getElementById('wlSearchInput').value='';
  ensureSearchInstruments().then(function(){wlSearch('');});
  setTimeout(function(){document.getElementById('wlSearchInput').focus();},300);
}
function closeWlSearch(){
  document.getElementById('wlSearchSheet').classList.remove('vis');
  document.getElementById('sheetScrim').classList.remove('vis');
}
function wlSearch(q){
  var res=document.getElementById('wlSearchResults');
  var emp=document.getElementById('wlSearchEmpty');
  if(!res) return;
  var insts=SEARCH_INSTRUMENTS||[];
  var ql=(q||'').toLowerCase();
  var hits=insts.filter(function(u){
    return !ql
      || (u.name||'').toLowerCase().indexOf(ql)!==-1
      || (u.ticker||'').toLowerCase().indexOf(ql)!==-1
      || (u.code||'').toLowerCase().indexOf(ql)!==-1;
  });
  if(!hits.length){res.innerHTML='';if(emp)emp.style.display='block';return;}
  if(emp) emp.style.display='none';
  res.innerHTML=hits.map(function(d,i){
    var inWl=(WATCHLIST_ITEMS||[]).some(function(w){return w.code===d.code;});
    var tick=((d.ticker||d.code)||'').trim();
    return '<div style="display:flex;align-items:center;padding:11px 14px;border-bottom:'+(i<hits.length-1?'1px solid var(--border)':'none')+';">'
      +'<div style="flex:1;min-width:0;">'
        +'<div style="font-size:.86rem;font-weight:600;color:var(--fg-1);">'+d.name+'</div>'
        +'<div style="font-size:.7rem;color:var(--fg-3);margin-top:1px;">'+tick+(d.sector?' · '+d.sector:'')+'</div>'
      +'</div>'
      +'<button data-wl-toggle="'+d.code+'" style="font:inherit;font-size:.75rem;font-weight:700;padding:6px 12px;border-radius:99px;border:1.5px solid '+(inWl?'var(--red)':'var(--blue)')+';background:'+(inWl?'var(--red-bg)':'var(--blue-bg)')+';color:'+(inWl?'var(--red)':'var(--blue)')+';cursor:pointer;flex-shrink:0;">'+(inWl?'Remove':'+ Add')+'</button>'
      +'</div>';
  }).join('');
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
  wlSearch(document.getElementById('wlSearchInput').value);
  drawWatchlistList();
}

// Event delegation for watchlist rows (open/remove) and the Add sheet's
// per-result add/remove toggle.
document.addEventListener('click',function(e){
  var rm=e.target.closest('[data-wl-rm]');
  if(rm){ removeWlItem(rm.getAttribute('data-wl-rm')); return; }
  var toggle=e.target.closest('[data-wl-toggle]');
  if(toggle){ toggleWlItem(toggle.getAttribute('data-wl-toggle')); return; }
  var openRow=e.target.closest('[data-wl-open]');
  if(openRow && !WL_EDIT_MODE){ openInstrumentDetail(openRow.getAttribute('data-wl-open')); return; }
});
