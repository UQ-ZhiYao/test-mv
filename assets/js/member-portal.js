/* ============================================================
   ZY-Invest Member Portal — Shared Application Logic
   Shared across all members/desktop/*.html pages.
   Requires supabase-auth.js (sb client) loaded first.
   Expects the including page to declare `var S = {...}` and the
   page-specific render dispatch (see bottom of each *.html file)
   in its own inline <script> tag after this file loads.
   ============================================================ */
if(!localStorage.getItem('zy-session')&&!localStorage.getItem('zy_token')){window.location.href='../../login.html';}
function navigate(pg){
  var map={fundoverview:'fund-overview',ntahistory:'nta-history',financialresults:'financial-results'};
  var file=map[pg]||pg;
  window.location.href=file+'.html';
}

// ── DATA (live from Supabase; small fallback shown only if a fetch fails) ──────
let NTA = { all:{v:[1.0000,1.0000],l:["—","—"]}, '3y':{v:[1.0000,1.0000],l:["—","—"]}, '1y':{v:[1.0000,1.0000],l:["—","—"]}, ytd:{v:[1.0000,1.0000],l:["—","—"]} };
let HOLDINGS = [];
let TXS = [];
let DISTS = [];
let ACTIVITY = [];
let DOCS = [];
let NOTIFS = [];
let SHAREHOLDERS = [];
let SHAREHOLDERS_BY_FY = [];
let SHAREHOLDERS_BY_FY_ERROR = null;
let HOLDINGS_BY_FY = [];
let HOLDINGS_BY_FY_ERROR = null;
let FUND_OVERVIEW = null;
let LIVE_DATA_READY = false;
let PROFILE = null;
let AUTH_USER = null;
let INVESTOR_ID = null;
let CAPITAL_SUMMARY = { unitsHeld: 0, avgCost: 0, totalCost: 0, realizedPnl: 0, cashflows: [] };
let PRODUCT_TYPES = {};
let NTA_LOAD_ERROR = null;
let INCOME_STATEMENT = [];
let INCOME_STATEMENT_ERROR = null;
let BALANCE_SHEET = [];
let BALANCE_SHEET_ERROR = null;
let CASH_FLOW = [];
let CASH_FLOW_ERROR = null;
let RATIO_ANALYSIS = [];
let RATIO_ANALYSIS_ERROR = null;
let INCEPTION_DATE = null;
let NTA_MONTHLY = [];
let NTA_MONTHLY_ERROR = null;
let NTA_DAILY = [];
let NTA_DAILY_ERROR = null;
let NTA_WEEKLY_OHLC = [];
let NTA_WEEKLY_OHLC_ERROR = null;
let NTA_QUARTERLY_OHLC = [];
let NTA_QUARTERLY_OHLC_ERROR = null;
let DIST_BY_FY = [];
let DIST_BY_FY_ERROR = null;
let COMPARISON_DATA = null;
let COMPARISON_ERROR = null;

function mpInitials(name){
  if(!name) return '—';
  var parts=String(name).trim().split(/\s+/);
  return (parts[0][0]+(parts[parts.length-1][0]||'')).toUpperCase();
}

// ── Recent Activity — merges capital_injection (Subscription/Redemption)
// with computed distribution entitlements, sorted by date, top 5 ──────────
function buildActivity(){
  var items=[];
  TXS.forEach(function(t){
    items.push({ type:t.type, ref:t.ref, date:t.date, dateRaw:t.dateRaw, amt:t.amt, status:t.status });
  });
  DISTS.forEach(function(d){
    if(d.amt>0){
      items.push({
        type: 'Distribution',
        ref:  (d.fy||'')+(d.type?(' '+d.type):''),
        date: d.pay!=='—' ? d.pay : d.ex,
        dateRaw: d.payRaw || d.exRaw,
        amt:  '+RM '+d.amt.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}),
        status: d.status
      });
    }
  });
  items.sort(function(a,b){
    var da=a.dateRaw?new Date(a.dateRaw).getTime():0;
    var db=b.dateRaw?new Date(b.dateRaw).getTime():0;
    return db-da;
  });
  return items.slice(0,5);
}

// ── TOP BAR / DROPDOWN — populate with real Supabase profile data ──────────
function setText(id, txt){ var el=document.getElementById(id); if(el) el.textContent = (txt===undefined||txt===null||txt==='') ? '—' : txt; }
function populateNav(){
  if(!AUTH_USER) return;
  var email = AUTH_USER.email || '—';
  var displayName = (PROFILE && (PROFILE.preferred_name || PROFILE.full_name)) || email;
  var fullName = (PROFILE && PROFILE.full_name) || email;
  var av = mpInitials(PROFILE && (PROFILE.preferred_name || PROFILE.full_name));
  setText('navName',    fullName);
  setText('navRole',    email);
  setText('navAvatar',  av);
  setText('menuAvatar', av);
  setText('menuName',   fullName);
  setText('menuEmail',  email);
}

async function loadLiveData(){
  try{
    if(typeof sb === 'undefined' || !sb){ console.warn('Supabase client not initialised — check assets/js/supabase-auth.js credentials.'); return; }
    var authUser = (typeof mpCheckAuth === 'function') ? await mpCheckAuth() : null;
    if(!authUser){ window.location.href='../../login.html'; return; }

    var profile = null;
    try{ profile = await mpLoadProfile(authUser.id); }catch(e){ console.warn('Profile load failed:', e.message); }
    AUTH_USER = authUser;
    PROFILE = profile;
    populateNav();
    var investorId = (profile && profile.investor_id) || localStorage.getItem('zy_investor_id') || authUser.id;
    INVESTOR_ID = investorId;

    var results = await Promise.allSettled([
      mpLoadNTA(),
      mpLoadAll(authUser, investorId),
      mpLoadShareholders(),
      mpLoadFundOverview(),
      mpLoadCapitalSummary(authUser.id),
      mpLoadProductTypes()
    ]);

    if(results[0].status === 'fulfilled'){ NTA = results[0].value; NTA_LOAD_ERROR = null; }
    else { NTA_LOAD_ERROR = (results[0].reason && results[0].reason.message) || 'Unknown error'; console.warn('NTA history load failed:', NTA_LOAD_ERROR); }

    if(results[1].status === 'fulfilled'){
      var all = results[1].value;
      HOLDINGS = all.holdings || [];
      TXS = all.transactions || [];
      DISTS = all.distributions || [];
      ACTIVITY = buildActivity();
      DOCS = all.documents || [];
      if(all.nominees && all.nominees.length){
        NOM_DATA = all.nominees;
        NOM_SEL = 0;
      }
      NOTIFS = (all.notifications || []).map(function(n){
        return {
          title: n.title || n.subject || 'Notification',
          body:  n.body || n.message || '',
          time:  formatDate(n.created_at || n.time),
          unread: n.unread !== undefined ? n.unread : !n.is_read
        };
      });
    } else {
      console.warn('Member data load failed:', results[1].reason && results[1].reason.message);
    }

    if(results[2].status === 'fulfilled'){
      var raw = results[2].value || [];
      var totalUnits = raw.reduce(function(a,s){ return a + (parseFloat(s.units_held)||0); }, 0) || 1;
      SHAREHOLDERS = raw.map(function(s){
        return {
          initials: mpInitials(s.full_name),
          name: s.full_name || 'Unknown',
          position: s.account_type === 'director' ? 'Director' : 'Shareholder',
          since: formatDate(s.joined_date),
          units: parseFloat(s.units_held) || 0,
          pct: ((parseFloat(s.units_held) || 0) / totalUnits * 100)
        };
      });
    } else {
      console.warn('Shareholders load failed:', results[2].reason && results[2].reason.message);
    }

    if(results[3].status === 'fulfilled') FUND_OVERVIEW = results[3].value;
    else console.warn('Fund overview load failed:', results[3].reason && results[3].reason.message);

    if(results[4].status === 'fulfilled') CAPITAL_SUMMARY = results[4].value;
    else console.warn('Capital summary load failed:', results[4].reason && results[4].reason.message);

    if(results[5].status === 'fulfilled') PRODUCT_TYPES = results[5].value;
    else console.warn('Product types load failed:', results[5].reason && results[5].reason.message);

    refreshLiveConstants();
    populateSRModal();
    LIVE_DATA_READY = true;
  }catch(e){
    console.error('loadLiveData failed, page will show empty/fallback state:', e.message);
  }
}

// ── STATE ────────────────────────────────────────────────────────────────────

// ── CHART ────────────────────────────────────────────────────────────────────
function makePath(vals, W, H, px, py) {
  var min=Math.min.apply(null,vals)-0.003, max=Math.max.apply(null,vals)+0.003, rng=max-min;
  var pts=vals.map(function(v,i){return[px+(i/(vals.length-1))*(W-2*px), H-py-((v-min)/rng)*(H-2*py)];});
  var d='M'+pts[0][0].toFixed(1)+','+pts[0][1].toFixed(1);
  for(var i=1;i<pts.length;i++){
    var p0=i>1?pts[i-2]:pts[i-1],p1=pts[i-1],p2=pts[i],p3=i<pts.length-1?pts[i+1]:pts[i];
    var c1x=p1[0]+(p2[0]-p0[0])/6, c1y=p1[1]+(p2[1]-p0[1])/6;
    var c2x=p2[0]-(p3[0]-p1[0])/6, c2y=p2[1]-(p3[1]-p1[1])/6;
    d+=' C'+c1x.toFixed(1)+','+c1y.toFixed(1)+' '+c2x.toFixed(1)+','+c2y.toFixed(1)+' '+p2[0].toFixed(1)+','+p2[1].toFixed(1);
  }
  return {d:d, pts:pts};
}

function ntaHasData(period){
  var d = NTA && NTA[period];
  return !!(d && d.l && d.l.length && d.l[0]!=='—');
}
function ntaEmptyState(){
  var msg = NTA_LOAD_ERROR
    ? 'Could not load NTA history — '+NTA_LOAD_ERROR
    : 'No NTA history found for this period yet.';
  return '<div style="height:180px;display:flex;align-items:center;justify-content:center;color:var(--fg-3);font-size:.85rem;text-align:center;padding:0 20px">'+msg+'</div>';
}

function chartHTML(period) {
  var data=NTA[period], W=480, H=180, px=6, py=10;
  var r=makePath(data.v,W,H,px,py), pts=r.pts;
  var area=r.d+' L'+pts[pts.length-1][0]+','+H+' L'+pts[0][0]+','+H+' Z';
  var li=[0, Math.floor(pts.length/3), Math.floor(2*pts.length/3), pts.length-1];
  return '<div style="position:relative">'
    +'<svg id="ntaChart" viewBox="0 0 '+W+' '+H+'" style="width:100%;height:180px;display:block;cursor:crosshair" preserveAspectRatio="none">'
    +'<defs><linearGradient id="ntaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1565C0" stop-opacity=".18"/><stop offset="1" stop-color="#1565C0" stop-opacity="0"/></linearGradient></defs>'
    +'<line x1="'+px+'" y1="'+(py+(H-2*py)*0.25)+'" x2="'+(W-px)+'" y2="'+(py+(H-2*py)*0.25)+'" stroke="#F3F4F6" stroke-width="1"/>'
    +'<line x1="'+px+'" y1="'+(py+(H-2*py)*0.5)+'" x2="'+(W-px)+'" y2="'+(py+(H-2*py)*0.5)+'" stroke="#F3F4F6" stroke-width="1"/>'
    +'<line x1="'+px+'" y1="'+(py+(H-2*py)*0.75)+'" x2="'+(W-px)+'" y2="'+(py+(H-2*py)*0.75)+'" stroke="#F3F4F6" stroke-width="1"/>'
    +'<path d="'+area+'" fill="url(#ntaG)"/>'
    +'<path d="'+r.d+'" fill="none" stroke="#1565C0" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>'
    +'<circle cx="'+pts[pts.length-1][0]+'" cy="'+pts[pts.length-1][1]+'" r="4" fill="#fff" stroke="#1565C0" stroke-width="2"/>'
    +'<rect id="chartOv" x="'+px+'" y="'+py+'" width="'+(W-2*px)+'" height="'+(H-2*py)+'" fill="transparent"/>'
    +'</svg>'
    +'<div id="chartTip" style="display:none;position:absolute;background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:10px 14px;min-width:130px;box-shadow:0 6px 20px rgba(0,0,0,.13);pointer-events:none;z-index:10;white-space:nowrap"></div>'
    +'<div style="display:flex;justify-content:space-between;padding:0 6px 4px;font-size:.7rem;color:#64748B">'
    +li.map(function(i){return '<span>'+data.l[i]+'</span>';}).join('')
    +'</div></div>';
}

function initChart(period) {
  var data=NTA[period], chart=document.getElementById('ntaChart'), ov=document.getElementById('chartOv'), tip=document.getElementById('chartTip');
  if(!chart||!ov) return;
  var W=480, H=180, px=6, py=10, pts=makePath(data.v,W,H,px,py).pts;
  ov.addEventListener('mousemove',function(e){
    var rect=chart.getBoundingClientRect(), pct=(e.clientX-rect.left)/rect.width;
    var idx=Math.round(pct*(pts.length-1)); idx=Math.max(0,Math.min(idx,pts.length-1));
    var p=pts[idx], v=data.v[idx], lbl=data.l[idx];
    var tx=Math.min(Math.max((p[0]/W)*rect.width-50,0),rect.width-120);
    var ty=Math.max((p[1]/H)*180-44,4);
    tip.style.cssText='display:block;position:absolute;background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:9px 14px;min-width:130px;box-shadow:0 4px 20px rgba(0,0,0,.13);pointer-events:none;left:'+tx+'px;top:'+ty+'px;z-index:10';
    tip.innerHTML='<div style="font-size:.72rem;font-weight:600;color:#1565C0;margin-bottom:3px">'+lbl+'</div><div style="font-size:.85rem;font-weight:400;color:#0F172A">RM '+v.toFixed(4)+'</div>';
    var ln=document.getElementById('chLine');
    if(!ln){ln=document.createElementNS('http://www.w3.org/2000/svg','line');ln.id='chLine';ln.setAttribute('stroke','#CBD5E1');ln.setAttribute('stroke-width','1');ln.setAttribute('stroke-dasharray','3,3');chart.insertBefore(ln,ov);}
    ln.setAttribute('x1',p[0]);ln.setAttribute('y1',py);ln.setAttribute('x2',p[0]);ln.setAttribute('y2',H-py);
  });
  ov.addEventListener('mouseleave',function(){tip.style.display='none';var ln=document.getElementById('chLine');if(ln)ln.remove();});
}

// ── PAGE RENDERS ─────────────────────────────────────────────────────────────
function segBtn(lbl,p){return '<button class="'+(S.period===p?'on':'')+'" onclick="switchPeriod(\''+p+'\')">'+lbl+'</button>';}

// ── Live-computed aggregates (real data only — "—" when nothing to compute) ──
function holdingsTotals(){
  var totalVal=0, totalPnl=0, any=false;
  HOLDINGS.forEach(function(h){
    if(typeof h.mv==='number'){ totalVal += h.mv; any=true; }
    if(typeof h.pnl==='number'){ totalPnl += h.pnl; }
  });
  return any ? { value: totalVal, cost: totalVal-totalPnl, pnl: totalPnl } : { value:null, cost:null, pnl:null };
}
function distTotals(){
  var mine = DISTS.filter(function(d){ return (d.amt||0)>0 && d.status==='Paid'; });
  if(!mine.length) return null;
  var total=0, byType={};
  mine.forEach(function(d){
    var amt = parseFloat(d.amt)||0;
    total += amt;
    byType[d.type] = (byType[d.type]||0) + amt;
  });
  return { total:total, count:mine.length, byType:byType, latestFY: mine[0] && mine[0].fy };
}
function fmtMoneyOrDash(n){ return (n===null||n===undefined||isNaN(n)) ? '—' : 'RM '+n.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}); }

// distributions.type in the DB may be stored as "Interim Dividend",
// "Final Dividend", etc. rather than the short form — match by
// substring so colouring/grouping works regardless of exact wording.
function normalizeDistType(t){
  if(!t) return 'Other';
  var low = String(t).toLowerCase();
  if(low.indexOf('interim')>-1) return 'Interim';
  if(low.indexOf('final')>-1) return 'Final';
  if(low.indexOf('special')>-1) return 'Special';
  return t;
}

// ── IRR — Newton's method on a signed cashflow timeline ─────────────────────
// cashflows: [{date:'YYYY-MM-DD', amount:number}] — investments negative,
// redemptions/distributions/current market value positive. Returns an
// annualised percentage, or null if it can't be solved (no sign change,
// too few points, or failed to converge).
function computeXIRR(cashflows){
  if(!cashflows || cashflows.length<2) return null;
  var pts = cashflows
    .map(function(c){ return { t:new Date(c.date).getTime(), amt:c.amount }; })
    .filter(function(p){ return !isNaN(p.t); })
    .sort(function(a,b){ return a.t-b.t; });
  if(pts.length<2) return null;
  var t0 = pts[0].t;
  var yrs = pts.map(function(p){ return (p.t-t0)/(365*86400000); });
  var hasPos=false, hasNeg=false;
  pts.forEach(function(p){ if(p.amt>0) hasPos=true; if(p.amt<0) hasNeg=true; });
  if(!hasPos || !hasNeg) return null;

  function npv(r){
    var s=0;
    for(var i=0;i<pts.length;i++){ s += pts[i].amt/Math.pow(1+r,yrs[i]); }
    return s;
  }
  function dnpv(r){
    var s=0;
    for(var i=0;i<pts.length;i++){ if(yrs[i]>0) s += -yrs[i]*pts[i].amt/Math.pow(1+r,yrs[i]+1); }
    return s;
  }

  var r=0.1;
  for(var iter=0; iter<100; iter++){
    var f=npv(r), fp=dnpv(r);
    if(!isFinite(f)) return null;
    if(Math.abs(fp)<1e-10) break;
    var rNext=r-f/fp;
    if(!isFinite(rNext)) break;
    if(rNext<=-0.999) rNext=-0.999;
    if(Math.abs(rNext-r)<1e-7){ r=rNext; break; }
    r=rNext;
  }
  if(!isFinite(r) || Math.abs(npv(r))>1) return null;
  return r*100;
}

function pgDashboard() {
  var txRows=ACTIVITY.map(function(t){
    var ic=t.type==='Distribution'?'dist':t.type==='Redemption'?'red-ic':'sub';
    var col=t.amt.startsWith('+')&&t.type!=='Redemption'?'color:var(--green)':'color:var(--fg-1)';
    return '<div class="ar"><div class="ar-ic '+ic+'"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(t.type==='Distribution'?'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>':(t.type==='Redemption'?'<path d="M20 16H6l3 3"/><path d="M4 8h14l-3-3"/>':(t.type==='Subscription'?'<path d="M4 8h14l-3-3"/><path d="M20 16H6l3 3"/>':'')))+'</svg></div><div class="ar-meta"><div class="ar-title">'+t.type+'</div><div class="ar-date">'+t.ref+' · '+t.date+'</div></div><div class="ar-amt" style="'+col+'">'+t.amt+'<span class="su">'+t.status+'</span></div></div>';
  }).join('');
  var hl=HOLDINGS.slice(0,5).map(function(h){
    var w=Math.min(100,Math.round(h.al/14.2*100));
    return '<tr><td class="hn"><b>'+h.n+'</b><span>'+h.t+'</span></td><td>'+productPill(h.inst)+'</td><td>'+h.sec+'</td><td><div class="ac"><div class="ac-bar"><span style="width:'+w+'%;background:var(--blue)"></span></div><span class="ac-pct">'+h.al.toFixed(1)+'%</span></div></td></tr>';
  }).join('');
  var moreCount = Math.max(0, HOLDINGS.length-5);
  var moreRow = moreCount>0 ? '<tr><td colspan="4" style="padding:10px 20px;font-size:.8rem;color:var(--blue);cursor:pointer" onclick="navigate(\'holdings\')">+ '+moreCount+' more positions →</td></tr>' : '';
  var memberName = (PROFILE && (PROFILE.preferred_name || PROFILE.full_name)) || (AUTH_USER && AUTH_USER.email) || '—';
  var todayStr = new Date().toLocaleDateString('en-MY',{day:'numeric',month:'short',year:'numeric'});
  var dt = distTotals();
  var cs = CAPITAL_SUMMARY;
  var myValue = (NTA_PRICE>0 && cs.unitsHeld) ? cs.unitsHeld*NTA_PRICE : null;
  var myPnl   = (myValue!==null) ? myValue-cs.totalCost : null;
  var portfolioValLbl = fmtMoneyOrDash(myValue);
  var retPct = (myValue!==null && cs.totalCost) ? (myPnl/cs.totalCost)*100 : null;
  var portfolioRetLbl, portfolioRetColor;
  if(retPct===null){ portfolioRetLbl='—'; portfolioRetColor='var(--fg-3)'; }
  else if(retPct<0){ portfolioRetLbl='▼ '+Math.abs(retPct).toFixed(2)+'% total return'; portfolioRetColor='var(--red)'; }
  else if(retPct>0){ portfolioRetLbl='▲ '+retPct.toFixed(2)+'% total return'; portfolioRetColor='var(--green)'; }
  else { portfolioRetLbl='0.00% total return'; portfolioRetColor='var(--fg-1)'; }
  var pnlColor = myPnl>0 ? 'var(--green)' : (myPnl<0 ? 'var(--red)' : 'var(--fg-1)');
  var realisedPnl = (cs.realizedPnl||0) + (dt ? dt.total : 0);
  var realisedColor = realisedPnl>0 ? 'var(--green)' : (realisedPnl<0 ? 'var(--red)' : 'var(--fg-1)');
  var totalPnl = (myPnl===null && !realisedPnl) ? null : (myPnl||0)+realisedPnl;
  var totalPnlColor = totalPnl>0 ? 'var(--green)' : (totalPnl<0 ? 'var(--red)' : 'var(--fg-1)');
  var irrCashflows = (cs.cashflows||[]).slice();
  DISTS.filter(function(d){return d.status==='Paid'&&d.amt>0;}).forEach(function(d){
    irrCashflows.push({date: d.payRaw||d.exRaw, amount:d.amt});
  });
  if(myValue!==null && cs.unitsHeld>0){
    irrCashflows.push({date: new Date().toISOString().slice(0,10), amount: myValue});
  }
  var irr = computeXIRR(irrCashflows);
  var irrColor = (irr===null) ? 'var(--fg-1)' : (irr>0 ? 'var(--green)' : (irr<0 ? 'var(--red)' : 'var(--fg-1)'));
  var ntaStats = ntaHasData(S.period) ? (function(){
    var v = NTA[S.period].v;
    var cur=v[v.length-1], hi=Math.max.apply(null,v), lo=Math.min.apply(null,v);
    var hiRet = cur ? (hi-cur)/cur*100 : 0;
    var loRet = cur ? (lo-cur)/cur*100 : 0;
    return { cur:cur, hi:hi, lo:lo, hiRet:hiRet, loRet:loRet };
  })() : null;
  var pvStats = (ntaStats && cs.unitsHeld>0) ? {
    cur: cs.unitsHeld*ntaStats.cur,
    hi:  cs.unitsHeld*ntaStats.hi,
    lo:  cs.unitsHeld*ntaStats.lo
  } : null;
  var DIST_TYPE_COLOR = {Interim:'var(--blue)', Final:'var(--green)', Special:'var(--orange)'};
  var paidDists = DISTS.filter(function(d){return d.status==='Paid'&&d.amt>0;});
  var cardFY = paidDists.length ? paidDists[0].fy : null;
  var fyDists = cardFY ? paidDists.filter(function(d){return d.fy===cardFY;}) : [];
  var fyTotal = fyDists.reduce(function(a,d){return a+d.amt;},0);
  var fyDpsSum = fyDists.reduce(function(a,d){return a+(parseFloat(d.dps)||0);},0);
  var fyByType = {};
  fyDists.forEach(function(d){ var nt=normalizeDistType(d.type); fyByType[nt] = (fyByType[nt]||0) + d.amt; });
  var typeOrder = ['Interim','Final','Special'];
  var orderedTypes = typeOrder.filter(function(t){return fyByType[t];})
    .concat(Object.keys(fyByType).filter(function(t){return typeOrder.indexOf(t)===-1;}));
  var todayISO = new Date().toISOString().slice(0,10);
  var upcoming = DISTS.filter(function(d){return d.exRaw && d.exRaw>todayISO;}).sort(function(a,b){return a.exRaw<b.exRaw?-1:1;});
  var nextDist = upcoming.length ? upcoming[0] : null;
  var distCard = fyDists.length
    ? ('<div class="dbig">'+fmtMoneyOrDash(fyTotal)+'</div><div class="dsub">'+fyDists.length+' payment'+(fyDists.length===1?'':'s')+' · <em>'+fyDpsSum.toFixed(2)+' sen DPS</em></div>'
      +'<div class="dstack">'+orderedTypes.map(function(t){
        var pct = fyTotal>0 ? (fyByType[t]/fyTotal*100) : 0;
        return '<span style="width:'+pct.toFixed(1)+'%;background:'+(DIST_TYPE_COLOR[t]||'#9CA3AF')+'"></span>';
      }).join('')+'</div>'
      +'<div class="dleg">'+orderedTypes.map(function(t){
        return '<div class="dr"><span class="dl"><span class="dd" style="background:'+(DIST_TYPE_COLOR[t]||'#9CA3AF')+'"></span>'+t+'</span><span class="dv">'+fmtMoneyOrDash(fyByType[t])+'</span></div>';
      }).join('')+'</div>'
      +(nextDist?('<div class="dnxt"><span class="dl">Next ex-date · '+nextDist.fy+'</span><span class="dv">'+nextDist.ex+'</span></div>'):''))
    : ('<div class="dbig">—</div><div class="dsub">No distributions on record</div>');
  return '<div class="ph-xl"><h1>My <span class="acc">Portfolio</span></h1><p>Welcome back, '+memberName+'. Here\'s your investment with ZY-Invest as of '+todayStr+'.</p></div>'
    +'<div class="split"><div class="col-main">'
    +'<div class="mrow"><div class="mc"><div class="lbl">Units Held</div><div class="val">'+(cs.unitsHeld?cs.unitsHeld.toLocaleString('en-MY',{minimumFractionDigits:4,maximumFractionDigits:4}):'—')+'</div><div class="sub">Total cost '+fmtMoneyOrDash(cs.totalCost)+'</div></div><div class="mc"><div class="lbl">Current NTA</div><div class="val b">'+(NTA_PRICE>0?('RM '+NTA_PRICE.toFixed(4)):'—')+'</div><div class="sub">Avg cost '+(cs.avgCost?('RM '+cs.avgCost.toFixed(4)+'/unit'):'—')+'</div></div><div class="mc"><div class="lbl">Unrealised P&L</div><div class="val" style="color:'+pnlColor+'">'+fmtMoneyOrDash(myPnl)+'</div><div class="sub" style="color:'+realisedColor+'">Realised '+fmtMoneyOrDash(realisedPnl)+'</div></div><div class="mc"><div class="lbl">Annualised IRR</div><div class="val" style="color:'+irrColor+'">'+(irr===null?'—':(irr>=0?'+':'')+irr.toFixed(1)+'%')+'</div><div class="sub" style="color:'+totalPnlColor+'">Total P&L '+fmtMoneyOrDash(totalPnl)+'</div></div></div>'
    +'<div class="panel"><div class="ph"><h3>NTA per Unit</h3><div class="seg">'+segBtn('YTD','ytd')+segBtn('1Y','1y')+segBtn('3Y','3y')+segBtn('ALL','all')+'</div></div>'
    +'<div class="chart-wrap"><div class="chart-main">'+(ntaHasData(S.period)?chartHTML(S.period):ntaEmptyState())+'</div><div class="chart-side"><div><div class="ck">Current NTA</div><div class="cv" style="font-weight:400">'+(ntaStats?('RM '+ntaStats.cur.toFixed(4)):'—')+'</div></div><div><div class="ck">Highest NTA</div><div class="cv" style="font-weight:400">'+(ntaStats?('RM '+ntaStats.hi.toFixed(4)):'—')+'</div>'+(ntaStats?('<div style="font-size:.68rem;font-weight:400;color:'+(ntaStats.hiRet>=0?'var(--green)':'var(--red)')+'">('+(ntaStats.hiRet>=0?'+':'')+ntaStats.hiRet.toFixed(2)+'%)</div>'):'')+'</div><div><div class="ck">Lowest NTA</div><div class="cv" style="font-weight:400">'+(ntaStats?('RM '+ntaStats.lo.toFixed(4)):'—')+'</div>'+(ntaStats?('<div style="font-size:.68rem;font-weight:400;color:'+(ntaStats.loRet>=0?'var(--green)':'var(--red)')+'">('+(ntaStats.loRet>=0?'+':'')+ntaStats.loRet.toFixed(2)+'%)</div>'):'')+'</div></div></div></div>'
    +'<div class="panel"><div class="ph"><h3>Your Holdings</h3><button class="lnk" onclick="navigate(\'holdings\')">View all →</button></div><table class="tbl"><thead><tr><th>Holding</th><th>Product</th><th>Sector</th><th style="width:36%">Allocation</th></tr></thead><tbody>'+(hl||'<tr><td colspan="4" style="padding:16px 20px;color:var(--fg-3)">No holdings on record</td></tr>')+moreRow+'</tbody></table></div>'
    +'<div class="panel"><div class="ph"><h3>Recent Activity</h3><button class="lnk" onclick="navigate(\'transactions\')">View all →</button></div>'+(txRows||'<div style="padding:16px 20px;color:var(--fg-3)">No recent activity</div>')+'</div>'
    +'</div><div class="col-rail">'
    +'<div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden"><div class="vc" style="position:relative" onmouseenter="var t=document.getElementById(\'pvTip\');if(t)t.style.opacity=\'1\';" onmouseleave="var t=document.getElementById(\'pvTip\');if(t)t.style.opacity=\'0\';"><div class="vc-lbl">Total Portfolio Value</div><div class="gw"><svg viewBox="0 0 300 162" width="100%"><defs><linearGradient id="aG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1565C0"/><stop offset="1" stop-color="#2E7D32"/></linearGradient></defs><path d="M22,148 A128,128 0 0 1 278,148" fill="none" stroke="#F3F4F6" stroke-width="8" stroke-linecap="round"/><path d="M22,148 A128,128 0 0 1 278,148" fill="none" stroke="url(#aG)" stroke-width="8" stroke-linecap="round" stroke-dasharray="401" stroke-dashoffset="100"/><circle cx="240" cy="60" r="6" fill="#fff" stroke="#2E7D32" stroke-width="3"/></svg><div class="gc"><div class="gv">'+portfolioValLbl+'</div><div class="gd" style="color:'+portfolioRetColor+'">'+portfolioRetLbl+'</div></div></div>'
    +(pvStats?('<div id="pvTip" style="position:absolute;top:10px;right:10px;opacity:0;transition:opacity .15s;pointer-events:none;background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:9px 13px;box-shadow:0 6px 20px rgba(0,0,0,.13);font-size:.72rem;font-weight:400;color:var(--fg-1);white-space:nowrap;z-index:10">'
      +'<div style="margin-bottom:4px">Current: '+fmtMoneyOrDash(pvStats.cur)+'</div>'
      +'<div style="margin-bottom:4px;color:var(--green)">Highest: '+fmtMoneyOrDash(pvStats.hi)+'</div>'
      +'<div style="color:var(--red)">Lowest: '+fmtMoneyOrDash(pvStats.lo)+'</div>'
      +'</div>') : '<div id="pvTip" style="display:none"></div>')
    +'<div class="vact"><button class="bf" onclick="openSR(\'subscribe\')">Subscribe</button><button class="bl" onclick="openSR(\'redeem\')">Redeem</button></div></div></div>'
    +'<div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden"><div class="ph"><h3>Distributions'+(cardFY?(' · '+cardFY):'')+'</h3><button class="lnk" onclick="navigate(\'distributions\')">Details →</button></div><div class="dov">'+distCard+'</div></div>'
    +'<div style="background:#fff;border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden"><div class="ph"><h3>Fund Resources</h3></div><div class="res-list"><a class="res-item" onclick="navigate(\'statements\')"><span class="ri-ic"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/><path d="M9 13h6M9 17h4"/></svg></span><span class="ri-t"><b>Latest Factsheet</b><span>PDF</span></span><span class="ri-arr">→</span></a><a class="res-item" onclick="navigate(\'distributions\')"><span class="ri-ic"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg></span><span class="ri-t"><b>Distribution History</b><span>All FY payments</span></span><span class="ri-arr">→</span></a><a class="res-item" onclick="navigate(\'holdings\')"><span class="ri-ic"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5"/><path d="M4 15l5-5 4 3 7-8"/></svg></span><span class="ri-t"><b>NTA &amp; Holdings</b><span>Portfolio breakdown</span></span><span class="ri-arr">→</span></a></div></div>'
    +'</div></div>';
}

var SC={Healthcare:'#1565C0',Financials:'#2E7D32',Telcos:'#7C3AED',Consumer:'#E65100',Energy:'#B45309',Technology:'#0891B2',Cash:'#9CA3AF'};

var INST_COL={'Blue Chip':'#1565C0','Growth':'#7C3AED','Defensive':'#2E7D32','Cash':'#9CA3AF'};
function productPill(name){
  var pt = PRODUCT_TYPES[name];
  if(pt) return '<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:.75rem;font-weight:500;white-space:nowrap;letter-spacing:.01em;background:'+pt.bg+';color:'+pt.color+'">'+name+'</span>';
  var ic=INST_COL[name]||'#9CA3AF';
  return '<span style="font-size:.75rem;padding:2px 8px;border-radius:99px;background:'+ic+'1A;color:'+ic+'">'+name+'</span>';
}
function productColorMap(){
  var m={};
  Object.keys(PRODUCT_TYPES).forEach(function(k){ m[k]=PRODUCT_TYPES[k].color; });
  Object.keys(INST_COL).forEach(function(k){ if(!m[k]) m[k]=INST_COL[k]; });
  return m;
}

// Dark blue → light blue → grey gradient, assigned by rank (largest slice = darkest)
function pieGradientColor(idx, total){
  var stops=[[13,71,161],[21,101,192],[30,136,229],[66,165,245],[144,202,249],[176,190,197],[156,163,175]];
  if(total<=1) return 'rgb('+stops[0].join(',')+')';
  var t=idx/(total-1), pos=t*(stops.length-1);
  var i0=Math.floor(pos), i1=Math.min(stops.length-1,i0+1), f=pos-i0;
  var c0=stops[i0], c1=stops[i1];
  var r=Math.round(c0[0]+(c1[0]-c0[0])*f), g=Math.round(c0[1]+(c1[1]-c0[1])*f), b=Math.round(c0[2]+(c1[2]-c0[2])*f);
  return 'rgb('+r+','+g+','+b+')';
}
function piePanel(title, entries) {
  var cx=150,cy=150,R=132,ir=100;
  var total=entries.reduce(function(s,e){return s+e[1];},0);
  var ang=-Math.PI/2;
  var paths=entries.map(function(e,idx){
    var col=pieGradientColor(idx,entries.length);
    var sweep=(e[1]/total)*2*Math.PI;
    var ea=ang+sweep;
    var x1=(cx+R*Math.cos(ang)).toFixed(2),y1=(cy+R*Math.sin(ang)).toFixed(2);
    var x2=(cx+R*Math.cos(ea)).toFixed(2),y2=(cy+R*Math.sin(ea)).toFixed(2);
    var x3=(cx+ir*Math.cos(ea)).toFixed(2),y3=(cy+ir*Math.sin(ea)).toFixed(2);
    var x4=(cx+ir*Math.cos(ang)).toFixed(2),y4=(cy+ir*Math.sin(ang)).toFixed(2);
    var la=sweep>Math.PI?1:0;
    var d='M'+x1+' '+y1+' A'+R+' '+R+' 0 '+la+' 1 '+x2+' '+y2+' L'+x3+' '+y3+' A'+ir+' '+ir+' 0 '+la+' 0 '+x4+' '+y4+'Z';
    ang=ea;
    var tipLabel=e[0].replace(/"/g,'&quot;')+': '+e[1].toFixed(1)+'%';
    return '<path d="'+d+'" fill="'+col+'" stroke="none" data-tip="'+tipLabel+'" onmouseenter="showPieTip(event,this.dataset.tip)" onmousemove="showPieTip(event,this.dataset.tip)" onmouseout="hidePieTip()" style="cursor:pointer"/>';
  }).join('');
  return '<div class="panel" style="display:flex;flex-direction:column">'
    +'<div class="ph"><h3>'+title+'</h3></div>'
    +'<div style="padding:6px 12px 14px;display:flex;justify-content:center">'
    +'<svg viewBox="0 0 300 300" style="width:100%;max-height:300px;display:block">'
    +paths
    +'<circle cx="'+cx+'" cy="'+cy+'" r="'+(ir-4)+'" fill="#fff"/>'
    +'<text x="'+cx+'" y="'+(cy-4)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="18" font-weight="700" fill="#0F172A">'+title.split(' ')[0]+'</text>'
    +'<text x="'+cx+'" y="'+(cy+16)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="13" fill="#64748B">allocation</text>'
    +'</svg>'
    +'</div></div>';
}

function pgHoldings() {
  var htHold = holdingsTotals();
  var myValue = (NTA_PRICE>0 && CAPITAL_SUMMARY.unitsHeld) ? CAPITAL_SUMMARY.unitsHeld*NTA_PRICE : null;
  var secs={},insts={};
  HOLDINGS.forEach(function(h){
    secs[h.sec]=(secs[h.sec]||0)+h.al;
    insts[h.inst]=(insts[h.inst]||0)+h.al;
  });
  var secEntries=Object.entries(secs).sort(function(a,b){return b[1]-a[1];});
  var instEntries=Object.entries(insts).sort(function(a,b){return b[1]-a[1];});
  var topSec = secEntries.length ? secEntries[0] : null;
  var FOCUS_THRESHOLD = 40; // % — below this, portfolio reads as diversified rather than concentrated
  var isFocused = topSec && topSec[1] >= FOCUS_THRESHOLD;
  var focusLabel = isFocused ? topSec[0] : 'Diversify';
  var focusSub   = isFocused ? (topSec[1].toFixed(1)+'% of portfolio') : 'No dominant sector';
  var hRows=HOLDINGS.map(function(h){
    var col=SC[h.sec]||'#9CA3AF';
    return '<tr>'
      +'<td class="hn"><b>'+h.n+'</b><span>'+h.t+'</span></td>'
      +'<td>'+productPill(h.inst)+'</td>'
      +'<td><span style="font-size:.75rem;padding:2px 8px;border-radius:99px;background:'+col+'1A;color:'+col+'">'+h.sec+'</span></td>'
      +'<td><div class="ac"><div class="ac-bar"><span style="width:'+Math.min(100,Math.round(h.al/14.2*100))+'%;background:'+(h.inst==='Cash'?'var(--orange)':'var(--blue)')+'"></span></div><span class="ac-pct">'+h.al.toFixed(1)+'%</span></div></td>'
      +'</tr>';
  }).join('');
  return '<div class="ph-xl"><h1>My <span class="acc">Holdings</span></h1><p>Full portfolio breakdown as of '+new Date().toLocaleDateString('en-MY',{day:'numeric',month:'short',year:'numeric'})+'</p></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 220px;gap:14px;margin-bottom:16px;align-items:start">'
    +piePanel('Sector Allocation',secEntries)
    +piePanel('Instrument Type',instEntries)
    +'<div style="display:flex;flex-direction:column;gap:12px"><div class="mc"><div class="lbl">Total Portfolio Value</div><div class="val">'+fmtMoneyOrDash(myValue)+'</div><div class="sub">—</div></div><div class="mc"><div class="lbl">Focus Sector</div><div class="val">'+focusLabel+'</div><div class="sub">'+focusSub+'</div></div><div class="mc"><div class="lbl">Positions</div><div class="val">'+HOLDINGS.length+'</div><div class="sub">Across all instruments</div></div></div>'
    +'</div>'
    +'<div class="panel"><div class="ph"><h3>All Positions</h3></div>'
    +'<table class="tbl"><thead><tr><th>Instrument</th><th>Product</th><th>Sector</th><th style="width:160px">Allocation</th></tr></thead><tbody>'+(hRows||'<tr><td colspan="4" style="padding:20px;color:var(--fg-3)">No holdings on record</td></tr>')+'</tbody></table></div>';
}

function pgTransactions() {
  var types=['all','Subscription','Redemption'];
  var all=TXS.filter(function(t){return t.type==='Subscription'||t.type==='Redemption';});
  var list=S.txf==='all'?all:all.filter(function(t){return t.type===S.txf;});
  var approved=all.filter(function(t){return t.status==='Approved';});
  var totalUnits=approved.reduce(function(a,t){return a+(t.unitsRaw||0);},0);
  var realizedPnl = CAPITAL_SUMMARY.realizedPnl||0;
  var pnlColor = realizedPnl>0 ? 'var(--green)' : (realizedPnl<0 ? 'var(--red)' : 'var(--fg-1)');
  var cards='<div class="mrow" style="margin-bottom:16px">'
    +'<div class="mc"><div class="lbl">No. of Transactions</div><div class="val">'+all.length+'</div><div class="sub">Subscriptions &amp; redemptions</div></div>'
    +'<div class="mc"><div class="lbl">Total Invested</div><div class="val b">'+fmtMoneyOrDash(CAPITAL_SUMMARY.totalCost)+'</div><div class="sub">AVCO cost basis</div></div>'
    +'<div class="mc"><div class="lbl">Net Units</div><div class="val">'+totalUnits.toLocaleString('en-MY',{minimumFractionDigits:4,maximumFractionDigits:4})+'</div><div class="sub">Approved, net of redemptions</div></div>'
    +'<div class="mc"><div class="lbl">Realized P&amp;L</div><div class="val" style="color:'+pnlColor+'">'+fmtMoneyOrDash(realizedPnl)+'</div><div class="sub">From redemptions, AVCO method</div></div>'
    +'</div>';
  // Same base colours as the admin Capital Injection table (tag-sub/tag-red-type/pill-green/pill-yellow/pill-red)
  // Solid fill + white text, per feedback (was pale badge style before)
  // Matches admin's actual rendering (principal-admin.js: tag-green/tag-red for Type,
  // pill-ok/pill-warn/pill-rej for Status) — these classes use the theme's real
  // --green/--red/--orange tokens, not the unused hex block in principal.html's <style>.
  var TYPE_COL   = {Subscription:{bg:'var(--green-bg)',fg:'var(--green)'}, Redemption:{bg:'var(--red-bg)',fg:'var(--red)'}};
  var STATUS_COL = {Approved:{bg:'var(--green-bg)',fg:'var(--green)'}, Pending:{bg:'var(--orange-bg)',fg:'var(--orange)'}, Rejected:{bg:'var(--red-bg)',fg:'var(--red)'}};
  var tabs=types.map(function(t){return '<button class="ftab'+(S.txf===t?' on':'')+'" onclick="filterTx(\''+t+'\')">'+(t==='all'?'All':t+'s')+'</button>';}).join('');
  var LP='padding-left:20px', RP='padding-right:20px;text-align:right';
  var rows=list.map(function(t){
    var tc = TYPE_COL[t.type]   || {bg:'var(--gray-100)',fg:'var(--fg-2)'};
    var sc = STATUS_COL[t.status] || {bg:'var(--gray-100)',fg:'var(--fg-2)'};
    var unitsColor = t.unitsRaw>0 ? 'var(--green)' : (t.unitsRaw<0 ? 'var(--red)' : 'var(--fg-1)');
    var unitsTxt = (t.unitsRaw>0?'+':'')+t.unitsRaw.toLocaleString('en-MY',{minimumFractionDigits:4,maximumFractionDigits:4});
    var refEsc = String(t.ref).replace(/'/g,"\\'");
    return '<tr style="cursor:pointer" onclick="openTxDoc(\''+refEsc+'\')" title="Click to view document">'
      +'<td style="'+LP+'">'+t.date+'</td>'
      +'<td style="'+LP+'"><span class="pill" style="background:'+tc.bg+';color:'+tc.fg+'">'+t.type+'</span></td>'
      +'<td style="'+LP+'">'+t.ref+'</td>'
      +'<td style="'+RP+'">'+t.amt.replace(/^[+\u2212]/,'')+'</td>'
      +'<td style="'+RP+'">'+t.nav+'</td>'
      +'<td style="'+RP+';color:'+unitsColor+'">'+unitsTxt+'</td>'
      +'<td style="'+RP+'"><span class="pill" style="background:'+sc.bg+';color:'+sc.fg+'">'+t.status+'</span></td>'
      +'</tr>';
  }).join('');
  return '<div class="ph-xl"><h1><span class="acc">Principal Transactions</span></h1><p>Subscription &amp; redemption history — principal movements only.</p></div>'
    +cards
    +'<div class="panel"><div class="ph" style="flex-wrap:wrap;gap:10px"><h3>Principal Transactions</h3><div class="ftabs">'+tabs+'</div></div>'
    +'<table class="tbl"><thead><tr>'
    +'<th style="'+LP+'">Date</th>'
    +'<th style="'+LP+'">Type</th>'
    +'<th style="'+LP+'">Reference ID</th>'
    +'<th style="'+RP+'">Amount (RM)</th>'
    +'<th style="'+RP+'">NTA</th>'
    +'<th style="'+RP+'">Units</th>'
    +'<th style="'+RP+'">Status</th>'
    +'</tr></thead><tbody>'+(rows||'<tr><td colspan="7" style="padding:20px;color:var(--fg-3)">No transactions on record</td></tr>')+'</tbody></table></div>';
}

function pgDistributions() {
  var paid = DISTS.filter(function(d){return d.status==='Paid';});
  var received = paid.filter(function(d){return d.amt>0;});
  var totalReceived = paid.reduce(function(a,d){return a+(d.amt||0);},0);
  var mc4=[
    '<div class="mc"><div class="lbl">Total Received</div><div class="val'+(totalReceived>0?' g':'')+'">'+(paid.length?fmtMoneyOrDash(totalReceived):'—')+'</div><div class="sub">Since inception</div></div>',
    '<div class="mc"><div class="lbl">No. of Distributions</div><div class="val b">'+(received.length||'—')+'</div><div class="sub">Received since inception</div></div>',
    '<div class="mc"><div class="lbl">Interim Policy</div><div class="val">≥ 80%</div><div class="sub">of gross income</div></div>',
    '<div class="mc"><div class="lbl">Final Policy</div><div class="val">≥ 10%</div><div class="sub">of net income (excl. gross)</div></div>'
  ].join('');
  var tBg={Final:'var(--blue-bg)',Interim:'var(--green-bg)',Special:'var(--orange-bg)'};
  var tC={Final:'var(--blue)',Interim:'var(--green)',Special:'var(--orange)'};
  var sBg={Paid:'var(--green-bg)',Pending:'var(--orange-bg)'};
  var sC ={Paid:'var(--green)',Pending:'var(--orange)'};
  var rows=DISTS.map(function(d){
    var u = d.units>0 ? fmtMYR(d.units) : '—';
    var amtCol = d.amt>0 ? 'var(--green)' : 'var(--fg-3)';
    var amtTxt = d.amt>0 ? ('+RM '+d.amt.toFixed(2)) : '—';
    return '<tr><td style="font-weight:700">'+(d.fy||'—')+'</td>'
      +'<td><span class="pill" style="background:'+(tBg[normalizeDistType(d.type)]||'var(--gray-100)')+';color:'+(tC[normalizeDistType(d.type)]||'var(--fg-2)')+'">'+d.type+'</span></td>'
      +'<td>'+d.ex+'</td><td>'+d.pay+'</td>'
      +'<td style="text-align:right;font-weight:600">'+d.dps+'</td>'
      +'<td style="text-align:right">'+u+'</td>'
      +'<td style="text-align:right;font-weight:700;color:'+amtCol+'">'+amtTxt+'</td>'
      +'<td><span class="pill" style="background:'+(sBg[d.status]||'var(--gray-100)')+';color:'+(sC[d.status]||'var(--fg-2)')+'">'+d.status+'</span></td></tr>';
  }).join('');
  return '<div class="ph-xl"><h1>My <span class="acc">Distributions</span></h1><p>All cash distributions since inception · Total received: '+(paid.length?fmtMoneyOrDash(totalReceived):'—')+'</p></div>'
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px">'+mc4+'</div>'
    +'<div class="panel"><div class="ph"><h3>Distribution History</h3></div>'
    +'<table class="tbl"><thead><tr><th>FY</th><th>Type</th><th>Ex-Date</th><th>Pay Date</th><th style="text-align:right">DPS (sen)</th><th style="text-align:right">Units</th><th style="text-align:right">Amount</th><th>Status</th></tr></thead><tbody>'+(rows||'<tr><td colspan="8" style="padding:20px;color:var(--fg-3)">No distributions on record</td></tr>')
    +'</tbody></table></div>';
}

function pgStatements() {
  var dBg={'Statement':'var(--blue-bg)','Annual Report':'var(--green-bg)','Factsheet':'var(--orange-bg)'};
  var dC={'Statement':'var(--blue)','Annual Report':'var(--green)','Factsheet':'var(--orange)'};
  var rows=DOCS.map(function(d,i){
    return '<div style="display:flex;align-items:center;gap:14px;padding:13px 20px;'+(i<DOCS.length-1?'border-bottom:1px solid var(--gray-100)':'')+';transition:.15s" onmouseover="this.style.background=\'var(--gray-50)\'" onmouseout="this.style.background=\'\'">'
      +'<div style="width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:'+dBg[d.type]+';color:'+dC[d.type]+'">'
      +'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/><path d="M9 13h6M9 17h4"/></svg></div>'
      +'<div style="flex:1;min-width:0"><div style="font-size:.88rem;font-weight:600;color:var(--fg-1)">'+d.n+'</div><div style="font-size:.74rem;color:var(--fg-3);margin-top:2px">'+d.date+' · '+d.sz+'</div></div>'
      +'<span class="pill" style="flex-shrink:0;background:'+dBg[d.type]+';color:'+dC[d.type]+'">'+d.type+'</span>'
      +'<button onclick="showToast(\'Downloading: '+d.n.replace(/'/g,'')+'\',\'success\')" style="display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:var(--radius-md);border:1.5px solid var(--border);background:#fff;font-size:.8rem;font-weight:600;color:var(--fg-2);cursor:pointer;flex-shrink:0;transition:.15s" onmouseover="this.style.color=\'var(--blue)\';this.style.borderColor=\'var(--blue)\'" onmouseout="this.style.color=\'var(--fg-2)\';this.style.borderColor=\'var(--border)\'">'
      +'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download</button></div>';
  }).join('');
  return '<div class="ph-xl"><h1>My <span class="acc">Statements</span></h1><p>Factsheets, annual reports and statements of account.</p></div>'
    +'<div class="panel"><div class="ph"><h3>Available Documents</h3><span style="font-size:.8rem;color:var(--fg-3)">'+DOCS.length+' documents</span></div>'+rows+'</div>';
}

// ── SETTINGS (Profile / Password / Nominee) ────────────────────────────────
var STAB = 'personal'; // active settings tab

function profHero(){
  var email = (AUTH_USER && AUTH_USER.email) || '—';
  var fullName = (PROFILE && PROFILE.full_name) || email;
  var av = mpInitials(PROFILE && (PROFILE.preferred_name || PROFILE.full_name));
  return '<div class="prof-hero">'
    +'<div class="prof-av" id="profAvatar">'+av+'</div>'
    +'<div class="prof-info"><h2 id="profName">'+fullName+'</h2>'
    +'<div class="prof-meta"><span id="profEmail">'+email+'</span></div>'
    +'</div>'
    +'<span class="prof-badge">Verified Investor</span>'
    +'</div>';
}

function profTabs(){
  var ts=[['personal','Profile'],['security','Password & Security'],['nominee','Nominee']];
  return '<div class="prof-tabs">'
    +ts.map(function(t){
      return '<button class="prof-tab'+(STAB===t[0]?' on':'')+'" data-stab="'+t[0]+'" onclick="switchStab(this.dataset.stab)">'+t[1]+'</button>';
    }).join('')
    +'</div>';
}

function switchStab(tab){
  STAB=tab;
  document.querySelectorAll('.prof-tab').forEach(function(b){b.classList.toggle('on',b.dataset.stab===tab);});
  document.querySelectorAll('.prof-pane').forEach(function(p){p.classList.toggle('on',p.dataset.pane===tab);});
}

function fcard(head,sub,body,foot,extraHead){
  return '<div class="fcard">'
    +'<div class="fcard-head"><div><h3>'+head+'</h3><p>'+sub+'</p></div>'+(extraHead||'')+'</div>'
    +'<div class="fcard-body">'+body+'</div>'
    +(foot?'<div class="fcard-foot">'+foot+'</div>':'')
    +'</div>';
}
function ff(lbl,id,type,val,ph,hint,full,disabled){
  var extra=full?' class="fg-full"':'';
  return '<div class="ffield'+extra+'"><label>'+lbl+'</label>'
    +'<input id="'+id+'" type="'+(type||'text')+'" value="'+(val||'')+'" placeholder="'+(ph||'')+'"'+(disabled?' disabled style="opacity:.6;cursor:not-allowed"':'')+'>'
    +(hint?'<div class="fhint">'+hint+'</div>':'')
    +'</div>';
}
function ffSave(cancelFn,saveFn){
  return '<button class="fbtn-line" onclick="'+cancelFn+'()">Cancel</button>'
    +'<button class="fbtn-fill" onclick="'+saveFn+'()">Save Changes</button>';
}

function pgSettings(t){
  STAB=t;
  var P = PROFILE || {};
  var pEmail = (AUTH_USER && AUTH_USER.email) || '';
  var nricLocked = !!P.nric_passport;
  return '<div class="prof-wrap">'
    +'<div class="ph-xl"><h1>Account <span class="acc">Settings</span></h1><p>Manage your profile, security and nominees from one place.</p></div>'
    +profHero()
    +profTabs()
    +'<div class="prof-pane'+(t==='personal'?' on':'')+'" data-pane="personal">'
    +fcard('Personal Details','Your contact and identity information on record.',
      '<div class="fgrid">'
      +ff('Full Name','pf-name','text',(P.full_name||''),'As per NRIC / passport')
      +ff('Preferred Name','pf-pref','text',(P.preferred_name||''),'Display name')
      +ff('Email Address','pf-email','email',pEmail,'','Email is used for login',false,true)
      +ff('Mobile','pf-phone','tel',(P.phone||''),'+60 1X-XXX XXXX')
      +ff('NRIC / Passport','pf-nric','text',(nricLocked?'······-··-····':''),'e.g. 990512-14-5678',(nricLocked?'Locked after first save':''),false,nricLocked)
      +ff('Date of Birth','pf-dob','date',(P.date_of_birth||''),'')
      +'<div class="ffield"><label>Nationality</label><select id="pf-nat" style="font:inherit;font-size:.92rem;color:var(--fg-1);background:#fff;border:1.5px solid var(--border);border-radius:var(--radius-md);padding:9px 12px;outline:none;transition:.2s;width:100%;box-sizing:border-box">'
      +['Malaysian','Singaporean','Permanent Resident','Other'].map(function(n){return '<option'+(P.nationality===n?' selected':'')+'>'+n+'</option>';}).join('')
      +'</select></div>'
      +'<div class="ffield fg-full"><label>Residential Address</label><input id="pf-addr" value="'+(P.address||'')+'"></div>'
      +'</div>',
      ffSave('cancelSettings','profileSave')
    )
    +fcard('Distribution Bank Account','Where your income distributions are paid in MYR.',
      '<div class="fgrid">'
      +ff('Bank Name','pf-bank','text',(P.bank_name||''),'e.g. Maybank')
      +ff('Account Number','pf-bankacct','text',(P.bank_account_no||''),'Account number')
      +ff('Account Holder Name','pf-bkholder','text',(P.bank_account_holder||''),'Name as per bank account','',true)
      +'</div>',
      ffSave('cancelSettings','bankSave')
    )
    +fcard('Account Verification','Your KYC status and investor classification.',
      '<div>'
      +'<div class="kyc-row"><span class="kyc-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg></span><span class="kyc-meta"><span class="kt">Identity Verification</span><span class="kd">'+(nricLocked?'NRIC verified':'NRIC not yet on file')+'</span></span><span class="'+(nricLocked?'pill-ok':'pill-warn')+'">'+(nricLocked?'Verified':'Pending')+'</span></div>'
      +'<div class="kyc-row"><span class="kyc-ic"><svg viewBox="0 0 24 24"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/></svg></span><span class="kyc-meta"><span class="kt">Investor Classification</span><span class="kd">Eligible to subscribe under the fund mandate</span></span><span class="pill-ok">Sophisticated Investor</span></div>'
      +'<div class="kyc-row"><span class="kyc-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg></span><span class="kyc-meta"><span class="kt">Risk Profile Assessment</span><span class="kd">Annual review due 30 Jun 2026</span></span><span class="pill-warn">Review Due</span></div>'
      +'</div>'
    )
    +'</div>'
    +'<div class="prof-pane'+(t==='security'?' on':'')+'" data-pane="security">'
    +secPane()
    +'</div>'
    +'<div class="prof-pane'+(t==='nominee'?' on':'')+'" data-pane="nominee">'
    +nomPane()
    +'</div>'
    +'</div>';
}
function pgProfile(){return pgSettings('personal');}
function pgPassword(){return pgSettings('security');}
function pgNominee(){return pgSettings('nominee');}

function secPane(){
  return fcard('Change Password','Use at least 8 characters with a mix of letters, numbers and symbols.',
    '<div style="max-width:480px;display:flex;flex-direction:column;gap:14px">'
    +ff('New Password','pw-new','password','','','Minimum 8 characters')
    +'<div class="ffield"><label>Password Strength</label>'
    +'<div class="pw-bar-wrap"><div id="pw-bar" style="height:100%;width:0;background:var(--red);transition:width .3s,background .3s;border-radius:99px"></div></div>'
    +'<div id="pw-lbl" class="fhint" style="margin-top:5px">—</div></div>'
    +ff('Confirm New Password','pw-cf','password','','')
    +'</div>',
    '<button class="fbtn-line" onclick="clearPwForm()">Clear</button><button class="fbtn-fill" onclick="submitPwChange()">Update Password</button>'
  )
  +fcard('Two-Factor Authentication','Add an extra layer of security to your account.',
    '<div>'
    +'<div class="sesh-row"><span class="sesh-ic" style="background:var(--orange-bg)"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="var(--orange)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/></svg></span><span class="kyc-meta"><span class="kt">Authenticator App</span><span class="kd">Google Authenticator or Authy</span></span><div style="display:flex;align-items:center;gap:10px"><span class="pill-warn">Not Enabled</span><button class="fbtn-fill" style="padding:6px 14px;font-size:.8rem" onclick="enable2FA()">Enable</button></div></div>'
    +'<div class="sesh-row"><span class="sesh-ic" style="background:var(--green-bg)"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="var(--green)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/></svg></span><span class="kyc-meta"><span class="kt">SMS OTP</span><span class="kd">Sent to +60 12-345 6789 on each login</span></span><span class="pill-ok">Enabled</span></div>'
    +'</div>'
  )
  +fcard('Active Sessions','Devices currently signed in to your account.',
    '<div>'
    +'<div class="sesh-row"><span class="sesh-ic" style="background:var(--blue-bg)"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="var(--blue)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></span><span class="kyc-meta"><span class="kt">Chrome on macOS</span><span class="kd">Kuala Lumpur · Active now</span></span><span class="pill-ok">Current</span></div>'
    +'<div class="sesh-row"><span class="sesh-ic" style="background:var(--gray-100)"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="var(--fg-3)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/></svg></span><span class="kyc-meta"><span class="kt">Safari on iPhone</span><span class="kd">Kuala Lumpur · 2 days ago</span></span><button class="fbtn-red" style="padding:6px 14px;font-size:.8rem" onclick="revokeSession()">Revoke</button></div>'
    +'</div>'
  );
}

// ── NOMINEE DATA & LOGIC (mirrors live version) ────────────────────────────
var NOM_DATA=[{name:'',rel:'Spouse',nric:'',dob:'',mob:'',alloc:100}];
var NOM_SEL=0;
var NOM_COLORS=['var(--blue)','var(--green)','var(--orange)','#7E57C2'];

function nomClamp(v){return Math.max(0,Math.min(100,v));}

// After rebalancing, fix any rounding drift so total stays exactly 100
function nomFixRounding(){
  var tot=NOM_DATA.reduce(function(a,n){return a+n.alloc;},0), diff=100-tot;
  if(!diff||!NOM_DATA.length) return;
  var idx=-1,mx=-1;
  NOM_DATA.forEach(function(n,i){if(i!==NOM_SEL&&n.alloc>mx){mx=n.alloc;idx=i;}});
  if(idx===-1) idx=NOM_SEL;
  NOM_DATA[idx].alloc=nomClamp(NOM_DATA[idx].alloc+diff);
}

// Proportionally redistribute remaining % to other nominees
function nomRebalance(v){
  v=nomClamp(Math.round(v/5)*5);
  var others=NOM_DATA.map(function(n,i){return i;}).filter(function(i){return i!==NOM_SEL;});
  if(!others.length){NOM_DATA[NOM_SEL].alloc=100;return;}
  var rem=100-v, tot=others.reduce(function(a,i){return a+NOM_DATA[i].alloc;},0);
  if(!tot){
    var each=Math.floor(rem/others.length);
    others.forEach(function(i){NOM_DATA[i].alloc=each;});
    NOM_DATA[others[0]].alloc+=rem-(each*others.length); // absorb leftover
  } else {
    others.forEach(function(i){NOM_DATA[i].alloc=Math.round(NOM_DATA[i].alloc/tot*rem);});
  }
  NOM_DATA[NOM_SEL].alloc=v;
  nomFixRounding();
}

function nomBarHTML(){
  var total=NOM_DATA.reduce(function(a,n){return a+n.alloc;},0);
  var ok=total===100;
  var bars=NOM_DATA.map(function(n,i){
    return '<span style="width:'+n.alloc+'%;background:'+NOM_COLORS[i%4]+';transition:width .25s"></span>';
  }).join('');
  return '<div style="margin-bottom:8px">'
    +'<div class="nom-bar-wrap">'+bars+'</div>'
    +'<div style="display:flex;justify-content:space-between;margin-top:6px">'
    +'<div style="display:flex;gap:12px">'
    +NOM_DATA.map(function(n,i){
      return '<span style="display:flex;align-items:center;gap:5px;font-size:.74rem;color:var(--fg-3)">'
        +'<span style="width:8px;height:8px;border-radius:2px;background:'+NOM_COLORS[i%4]+';display:inline-block"></span>'
        +(n.name||'New')+'</span>';
    }).join('')
    +'</div>'
    +'<span style="font-size:.75rem;font-weight:700;color:'+(ok?'var(--green)':'var(--red)')+'">'+total+'% '+(!ok?'(must equal 100%)':'')+'</span>'
    +'</div></div>';
}

function nomListHTML(){
  return NOM_DATA.map(function(n,i){
    return '<div class="nom-item'+(i===NOM_SEL?' sel':'')+'" onclick="nomSelect('+i+')">'
      +'<span class="nom-dot" style="background:'+NOM_COLORS[i%4]+'"></span>'
      +'<span class="kyc-meta">'
      +'<span class="kt">'+(n.name||'New nominee')+'</span>'
      +'<span class="kd">'+n.rel+' · '+(i===0?'Primary':'Secondary')+' nominee</span>'
      +'</span>'
      +'<span class="nom-alloc-pill" style="background:'+NOM_COLORS[i%4]+'22;color:'+NOM_COLORS[i%4]+'">'+n.alloc+'%</span>'
      +'</div>';
  }).join('');
}

function refreshNomUI(){
  var bar=document.getElementById('nom-bar-area');
  var list=document.getElementById('nom-list-area');
  if(bar) bar.innerHTML=nomBarHTML();
  if(list) list.innerHTML=nomListHTML();
  // Update alloc pill value live
  var alloc=document.getElementById('nf-alloc');
  if(alloc) alloc.value=NOM_DATA[NOM_SEL].alloc;
  allocSlide(alloc);
}

function nomSelect(i){
  NOM_SEL=i;
  var n=NOM_DATA[i];
  var setV=function(id,v){var el=document.getElementById(id);if(el)el.value=v||'';};
  setV('nf-name',n.name); setV('nf-nric',n.nric); setV('nf-dob',n.dob); setV('nf-mob',n.mob);
  var rel=document.getElementById('nf-rel');
  if(rel){for(var k=0;k<rel.options.length;k++){if(rel.options[k].value===n.rel||rel.options[k].text===n.rel){rel.selectedIndex=k;break;}}}
  var alloc=document.getElementById('nf-alloc');
  if(alloc){alloc.value=n.alloc; allocSlide(alloc);}
  var lbl=document.getElementById('nom-prim-lbl');
  if(lbl) lbl.textContent=i===0?'Primary':'Secondary';
  document.querySelectorAll('.nom-item').forEach(function(el,idx){el.classList.toggle('sel',idx===i);});
}

// Called when slider moves — rebalance then refresh
function nomSlide(el){
  nomRebalance(parseInt(el.value,10));
  refreshNomUI();
  // Keep slider at current sel value (refreshNomUI sets it)
}

function nomAdd(){
  if(NOM_DATA.length>=4){showToast('Maximum 4 nominees allowed','error');return;}
  // Give new nominee 0%, don't disturb existing
  NOM_DATA.push({name:'',rel:'Spouse',nric:'',dob:'',mob:'',alloc:0});
  NOM_SEL=NOM_DATA.length-1;
  refreshNomUI(); nomSelect(NOM_SEL);
  var el=document.getElementById('nf-name'); if(el)el.focus();
  showToast('New nominee added — set allocation then Save','orange');
}

async function saveNominee(){
  var getV=function(id){var el=document.getElementById(id);return el?el.value.trim():'';};
  var n=NOM_DATA[NOM_SEL];
  n.name=getV('nf-name'); n.nric=getV('nf-nric'); n.dob=getV('nf-dob'); n.mob=getV('nf-mob');
  var relEl=document.getElementById('nf-rel'); if(relEl) n.rel=relEl.value;
  var total=NOM_DATA.reduce(function(a,x){return a+x.alloc;},0);
  if(total!==100){showToast('Total allocation must equal 100% (currently '+total+'%)','error');return;}
  if(!n.name){showToast('Nominee name is required','error');return;}
  if(!INVESTOR_ID){showToast('Not signed in','error');return;}
  if(typeof mpSaveNominee!=='function'){showToast('Nominee save service unavailable','error');return;}
  var payload={
    full_name:      n.name,
    relationship:   n.rel,
    nric_passport:  n.nric || null,
    date_of_birth:  n.dob || null,
    mobile:         n.mob || null,
    allocation_pct: n.alloc
  };
  if(n.id) payload.id = n.id;
  try{
    await mpSaveNominee(INVESTOR_ID, payload);
    try{
      var fresh = await mpLoadNominees(INVESTOR_ID);
      if(fresh && fresh.length){ NOM_DATA=fresh; if(NOM_SEL>=NOM_DATA.length) NOM_SEL=0; }
    }catch(e){}
    refreshNomUI();
    showToast((n.name||'Nominee')+' saved successfully','success');
  }catch(e){
    showToast('Save failed: '+e.message,'error');
  }
}

async function deleteNominee(){
  if(NOM_DATA.length<=1){showToast('At least one nominee required','error');return;}
  var cur=NOM_DATA[NOM_SEL];
  var name=cur.name||'Nominee';
  try{
    if(cur.id && typeof mpDeleteNominee==='function'){ await mpDeleteNominee(cur.id); }
    NOM_DATA.splice(NOM_SEL,1);
    NOM_SEL=0;
    // Redistribute to make total 100%
    var tot=NOM_DATA.reduce(function(a,n){return a+n.alloc;},0);
    if(tot>0&&tot!==100){NOM_DATA.forEach(function(n){n.alloc=Math.round(n.alloc/tot*100);}); nomFixRounding();}
    else if(!tot){NOM_DATA[0].alloc=100;}
    refreshNomUI(); nomSelect(0);
    showToast(name+' removed','success');
  }catch(e){
    showToast('Remove failed: '+e.message,'error');
  }
}

function nomPane(){
  var curN = NOM_DATA[NOM_SEL] || {};
  var rels=['Parent','Spouse','Child','Sibling','Other'];
  return fcard('Current Nominees','Click a nominee to edit, or add a new one.',
    '<div id="nom-bar-area">'+nomBarHTML()+'</div>'
    +'<div id="nom-list-area">'+nomListHTML()+'</div>',
    '<button class="fbtn-fill" onclick="nomAdd()">+ Add Nominee</button>'
  )
  +fcard('Nominee Details','<span id="nom-prim-lbl">Primary</span> nominee',
    '<div class="fgrid">'
    +ff('Full Name','nf-name','text',(curN.name||''),'Nominee full name')
    +'<div class="ffield"><label>Relationship</label><select id="nf-rel" style="font:inherit;font-size:.92rem;color:var(--fg-1);background:#fff;border:1.5px solid var(--border);border-radius:var(--radius-md);padding:9px 12px;outline:none;transition:.2s;width:100%;box-sizing:border-box">'
    +rels.map(function(r){return '<option'+(curN.rel===r?' selected':'')+'>'+r+'</option>';}).join('')
    +'</select></div>'
    +ff('NRIC / Passport','nf-nric','text',(curN.nric||''),'NRIC or passport no.')
    +ff('Date of Birth','nf-dob','text',(curN.dob||''),'DD Mmm YYYY')
    +ff('Mobile','nf-mob','tel',(curN.mob||''),'+60 1X-XXX XXXX')
    +'<div class="ffield"><label>Allocation <span id="nf-pct-lbl" style="color:var(--blue);font-weight:700">'+(curN.alloc||0)+'%</span></label>'
    +'<input type="range" id="nf-alloc" min="0" max="100" step="5" value="'+(curN.alloc||0)+'" oninput="nomSlide(this)" style="width:100%;accent-color:var(--blue);margin-top:6px">'
    +'<div class="fhint">Adjust allocation — must total 100% across all nominees</div></div>'
    +'</div>'
    +'<div style="margin-top:14px;padding:12px 14px;background:var(--orange-bg);border-radius:var(--radius-md);font-size:.78rem;color:var(--fg-2);line-height:1.6">'
    +'<b>Note:</b> Nominee changes require a completed and signed Nomination Form submitted to the fund manager.'
    +'</div>',
    '<button class="fbtn-red" onclick="deleteNominee()">Remove</button><div style="flex:1"></div><button class="fbtn-line" onclick="clearNomForm()">Clear</button><button class="fbtn-fill" onclick="saveNominee()">Save Nominee</button>'
  );
}

// Action helpers
function csDashboard(){navigate('dashboard');}
function cancelSettings(){navigate('dashboard');}
function fVal(id){var el=document.getElementById(id);return el?el.value.trim():'';}
async function profileSave(){
  if(!AUTH_USER){showToast('Not signed in','error');return;}
  var btn=event&&event.target;
  var updates={
    full_name:      fVal('pf-name'),
    preferred_name: fVal('pf-pref'),
    phone:           fVal('pf-phone'),
    date_of_birth:   fVal('pf-dob') || null,
    nationality:     fVal('pf-nat'),
    address:         fVal('pf-addr')
  };
  var nricEl=document.getElementById('pf-nric');
  if(nricEl && !nricEl.disabled && nricEl.value.trim()){
    updates.nric_passport = nricEl.value.trim();
  }
  try{
    if(btn){btn.disabled=true;btn.textContent='Saving…';}
    await mpSaveProfile(AUTH_USER.id, updates);
    PROFILE = Object.assign({}, PROFILE||{}, updates);
    populateNav();
    document.getElementById('mainContent').innerHTML=pgSettings(STAB||'personal');
    showToast('Personal details saved','success');
  }catch(e){
    showToast('Save failed: '+e.message,'error');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Save Changes';}
  }
}
async function bankSave(){
  if(!AUTH_USER){showToast('Not signed in','error');return;}
  var btn=event&&event.target;
  var updates={
    bank_name:           fVal('pf-bank'),
    bank_account_no:     fVal('pf-bankacct'),
    bank_account_holder: fVal('pf-bkholder')
  };
  try{
    if(btn){btn.disabled=true;btn.textContent='Saving…';}
    await mpSaveProfile(AUTH_USER.id, updates);
    PROFILE = Object.assign({}, PROFILE||{}, updates);
    showToast('Bank account updated','success');
  }catch(e){
    showToast('Save failed: '+e.message,'error');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Save Changes';}
  }
}
function enable2FA(){showToast('2FA setup coming soon','orange');}
function revokeSession(){showToast('Session revoked','success');}
function editNominee(){showToast('Edit nominee coming soon','orange');}
function removeNominee(){showToast('Nominee removed','success');}
function attachNomForm(){showToast('Form attached','success');}
function submitNomination(){showToast('Nomination submitted for review','success');}
function clearNomForm(){['nf-name','nf-nric','nf-dob','nf-mob'].forEach(function(i){var el=document.getElementById(i);if(el)el.value='';});}
function allocSlide(el){var lbl=document.getElementById('nf-pct-lbl');if(lbl)lbl.textContent=el.value+'%';}
function clearPwForm(){['pw-cur','pw-new','pw-cf'].forEach(function(i){var el=document.getElementById(i);if(el)el.value='';});pwStrength('');}
function togglePwVis(id){var f=document.getElementById(id);if(f)f.type=f.type==='password'?'text':'password';}

function pwStrength(v){
  var bar=document.getElementById('pw-bar'),lbl=document.getElementById('pw-lbl');
  if(!bar||!lbl)return;
  var sc=0;
  if(v.length>=8)sc++;if(v.length>=12)sc++;if(/[A-Z]/.test(v))sc++;if(/[0-9]/.test(v))sc++;if(/[^A-Za-z0-9]/.test(v))sc++;
  var pct=Math.min(100,sc*20);
  var col=sc<=1?'var(--red)':sc<=2?'var(--orange)':sc<=3?'var(--blue)':'var(--green)';
  var txt=['','Weak','Fair','Good','Strong','Strong'][sc];
  bar.style.width=pct+'%';bar.style.background=col;lbl.textContent=txt||'—';lbl.style.color=sc?col:'var(--fg-3)';
}
async function submitPwChange(){
  var nw=document.getElementById('pw-new'),cf=document.getElementById('pw-cf');
  if(!nw||!cf)return;
  if(nw.value.length<8){showToast('New password must be at least 8 characters','error');return;}
  if(nw.value!==cf.value){showToast('Passwords do not match','error');return;}
  if(typeof mpUpdatePassword!=='function'){showToast('Password service unavailable','error');return;}
  var btn=event&&event.target;
  try{
    if(btn){btn.disabled=true;btn.textContent='Updating…';}
    await mpUpdatePassword(nw.value);
    clearPwForm();
    showToast('Password updated successfully','success');
  }catch(e){
    showToast('Password update failed: '+e.message,'error');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Update Password';}
  }
}

// ── FUND OVERVIEW ─────────────────────────────────────────────────────────
function dlFactsheet(){showToast('Downloading factsheet...','success');}
function getTip(el){return el.getAttribute('data-tip');}

// ── Fund Overview chart number formatting ──────────────────────────────
// Base: #,##0.00 · 6-digit+ (100,000+): #,##0.0"k" · 9-digit+ (100,000,000+): #,##0.0"Mil" · %: 0.0%
// "Nice numbers for graph labels" (Heckbert) — picks round tick values
// (2000, 10000, ...) instead of raw data-derived fractions (17222.35, ...).
function niceNum(range, round){
  if(range<=0) return 1;
  var exponent=Math.floor(Math.log10(range));
  var fraction=range/Math.pow(10,exponent);
  var niceFraction;
  if(round){
    if(fraction<1.5) niceFraction=1;
    else if(fraction<3) niceFraction=2;
    else if(fraction<7) niceFraction=5;
    else niceFraction=10;
  } else {
    if(fraction<=1) niceFraction=1;
    else if(fraction<=2) niceFraction=2;
    else if(fraction<=5) niceFraction=5;
    else niceFraction=10;
  }
  return niceFraction*Math.pow(10,exponent);
}
function niceAxisScale(min,max,tickCount){
  tickCount=tickCount||5;
  if(min===max){ min-=1; max+=1; }
  var range=niceNum(max-min,false);
  var step=niceNum(range/(tickCount-1),true);
  var niceMin=Math.floor(min/step)*step;
  var niceMax=Math.ceil(max/step)*step;
  return {min:niceMin,max:niceMax,step:step};
}
// Guarantees exactly 5 evenly-spaced gridlines (4 equal intervals) across a
// nicely-rounded min/max — used by every bar/histogram chart for consistency.
// Axis ticks for bar/histogram/candlestick charts: always anchors the
// domain to include zero (so the zero baseline is always a gridline),
// expands to the next round number beyond the data (headroom), and aims
// for ~5 gridlines — landing on 4-6 is fine, since forcing exactly 5
// sometimes produces uglier tick values than letting them land naturally.
function fiveTicks(rawMin,rawMax,forceZero){
  if(forceZero===undefined) forceZero=true;
  var min=forceZero?Math.min(0,rawMin):rawMin, max=forceZero?Math.max(0,rawMax):rawMax;
  var scale=niceAxisScale(min,max,5);
  var ticks=[];
  for(var tv=scale.min; tv<=scale.max+scale.step*0.001; tv+=scale.step){ ticks.push(tv); }
  return {ticks:ticks,min:scale.min,max:scale.max,step:scale.step};
}

// Tight-fit axis for line/candle charts (Comparison, NTA History): unlike
// fiveTicks/niceAxisScale — which round the DOMAIN itself out to the next
// step multiple, so a small dip to -8% with a step of 50 blows the axis
// out to -50 — this only rounds the TICK step, and keeps min/max as the
// actual data range plus a small padding margin. Gridlines are then
// generated at nice step multiples that land inside that tight range
// (which may mean 4-6 gridlines rather than an exact count), so the axis
// always hugs whatever data is actually on screen.
function tightTicks(rawMin,rawMax){
  var range=rawMax-rawMin;
  if(range<=0){ rawMin-=1; rawMax+=1; range=2; }
  var pad=range*0.08;
  var min=rawMin-pad, max=rawMax+pad;
  var step=niceNum((max-min)/4,true);
  var start=Math.ceil(min/step)*step;
  var ticks=[];
  for(var tv=start; tv<=max+step*0.001; tv+=step){ ticks.push(tv); }
  return {ticks:ticks,min:min,max:max,step:step};
}

function fmtChartNum(v){
  var av=Math.abs(v||0), sign=(v||0)<0?'−':'';
  if(av>=100000000) return sign+(av/1000000).toLocaleString('en-MY',{minimumFractionDigits:1,maximumFractionDigits:1})+'Mil';
  if(av>=100000) return sign+(av/1000).toLocaleString('en-MY',{minimumFractionDigits:1,maximumFractionDigits:1})+'k';
  return sign+av.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function fmtChartPct(v){
  var av=Math.abs(v||0), sign=(v||0)<0?'−':'';
  return sign+av.toLocaleString('en-MY',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
}
// Tooltip-only variants — "-" for exactly zero, everything else formatted normally.
// Axis labels and other displays keep showing 0.00/0.0% via fmtChartNum/fmtChartPct.
function fmtTipNum(v){ return v ? fmtChartNum(v) : '—'; }
function fmtTipPct(v){ return v ? fmtChartPct(v) : '—'; }
// Plain #,##0.00 formatter — never abbreviates to k/Mil. Used for tooltips
// that must always show the exact figure (Capital Structure, Financial
// Results, Balance Sheet cards on Fund Overview).
function fmtTipPlain(v){
  if(!v) return '—';
  var av=Math.abs(v), sign=v<0?'−':'';
  return sign+av.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function pgFundOverview(){
  // Each chart instance gets its own tooltip element id, since several
  // charts render on this page simultaneously and frTip()/frHide() target
  // one element by id at a time.
  var _fovTipSeq=0;
  function nextTipId(){ return 'fovTip'+(_fovTipSeq++); }

  function kf(label,val,unit){
    return '<div class="fov-kf"><div class="fov-kl">'+label+'</div>'
      +'<div class="fov-kv">'+val+(unit?'<span class="fov-ku"> '+unit+'</span>':'')+'</div></div>';
  }

  // Thin donut — fills container
  function donut(segs,label){
    var s=200,cx=s/2,cy=s/2,R=s*0.42,ir=s*0.30;
    var total=segs.reduce(function(a,x){return a+x.v;},0);
    var ang=-Math.PI/2,paths='';
    segs.forEach(function(sg){
      var sweep=(sg.v/total)*2*Math.PI,ea=ang+sweep;
      var x1=(cx+R*Math.cos(ang)).toFixed(2),y1=(cy+R*Math.sin(ang)).toFixed(2);
      var x2=(cx+R*Math.cos(ea)).toFixed(2),y2=(cy+R*Math.sin(ea)).toFixed(2);
      var x3=(cx+ir*Math.cos(ea)).toFixed(2),y3=(cy+ir*Math.sin(ea)).toFixed(2);
      var x4=(cx+ir*Math.cos(ang)).toFixed(2),y4=(cy+ir*Math.sin(ang)).toFixed(2);
      var la=sweep>Math.PI?1:0;
      var d='M'+x1+' '+y1+' A'+R+' '+R+' 0 '+la+' 1 '+x2+' '+y2+' L'+x3+' '+y3+' A'+ir+' '+ir+' 0 '+la+' 0 '+x4+' '+y4+'Z';
      paths+='<path d="'+d+'" fill="'+sg.color+'" stroke="none"/>';
      ang=ea;
    });
    var legend=segs.map(function(sg,i){
      var pct=(sg.v/total*100).toFixed(1);
      return '<div style="display:flex;align-items:center;gap:6px;font-size:.78rem;color:#374151">'
        +'<span style="width:8px;height:8px;border-radius:50%;background:'+sg.color+';flex-shrink:0;display:inline-block"></span>'
        +sg.label+' <span style="color:#9CA3AF">'+pct+'%</span></div>';
    }).join('');
    return '<div style="display:flex;align-items:center;justify-content:flex-start;gap:24px;flex:1;padding:8px 0">'
      +'<svg viewBox="0 0 '+s+' '+s+'" style="width:'+s+'px;height:'+s+'px;flex-shrink:0">'
      +paths
      +'<circle cx="'+cx+'" cy="'+cy+'" r="'+(ir-3)+'" fill="#fff"/>'
      +'<text x="'+cx+'" y="'+(cy-4)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="11" font-weight="700" fill="#0F172A">'+label+'</text>'
      +'<text x="'+cx+'" y="'+(cy+12)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="9" fill="#6B7280">total</text>'
      +'</svg>'
      +'<div style="display:flex;flex-direction:column;gap:7px">'+legend+'</div>'
      +'</div>';
  }

  // Line chart — full width + hover
  function line(series,labels){
    var W=420,H=220,padX=36,padY=18;
    var all=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var mn=Math.min.apply(null,all),mx=Math.max.apply(null,all),rng=mx-mn||0.001;
    var n=labels.length;
    function px(i){return padX+(i/(n-1))*(W-padX-8);}
    function py(v){return H-padY-((v-mn)/rng)*(H-padY*2);}
    var paths=series.map(function(s){
      var d=s.v.map(function(v,i){return (i?'L':'M')+px(i).toFixed(1)+','+py(v).toFixed(1);}).join('');
      var area=d+' L'+px(n-1).toFixed(1)+','+(H-padY)+' L'+px(0).toFixed(1)+','+(H-padY)+'Z';
      var dots=s.v.map(function(v,i){
        var tip=labels[i]+': '+v.toFixed(4);
        return '<circle cx="'+px(i).toFixed(1)+'" cy="'+py(v).toFixed(1)+'" r="3" fill="#fff" stroke="'+s.color+'" stroke-width="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
      }).join('');
      return '<defs><linearGradient id="lg'+s.id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+s.color+'" stop-opacity=".12"/><stop offset="1" stop-color="'+s.color+'" stop-opacity="0"/></linearGradient></defs>'
        +'<path d="'+area+'" fill="url(#lg'+s.id+')"/>'
        +'<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+dots;
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=mn+f*rng;
      var vStr=v>=100?v.toFixed(0):v>=1?v.toFixed(2):v.toFixed(4);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+vStr+'</text>';
    }).join('');
    var xL=[0,Math.floor(n/2),n-1].map(function(i){return '<text x="'+px(i).toFixed(1)+'" y="'+(H-2)+'" text-anchor="middle" font-size="8.5" fill="#9CA3AF">'+labels[i]+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+paths+xL+'</svg>';
    var leg=series.length>1?'<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'+series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:'+s.color+';display:inline-block;border-radius:1px"></span>'+(s.label||s.id)+'</span>';}).join('')+'</div>':'';
    return chartSvg+leg;
  }
  // Combo chart — bars (DPS) + line (Yield) + hover
  function comboChart(groups,barSeries,lineSeries){
    var W=420,H=220,padX=42,padYT=16,padYB=24;
    var allBar=barSeries.v,allLine=lineSeries.v;
    var barMax=Math.max.apply(null,allBar)||1,lineMax=Math.max.apply(null,allLine)||1;
    var n=groups.length,groupW=(W-padX-8)/n,barW=Math.min(28,groupW*0.35);
    function bx(i){return (padX+i*groupW+groupW/2-barW/2).toFixed(1);}
    function barH(v){return Math.max(2,((v/barMax)*(H-padYT-padYB))).toFixed(1);}
    function barY(v){return (H-padYB-parseFloat(barH(v))).toFixed(1);}
    function lx(i){return (padX+i*groupW+groupW/2).toFixed(1);}
    function ly(v){return (H-padYB-((v/lineMax)*(H-padYT-padYB))).toFixed(1);}
    var bPaths=allBar.map(function(v,i){
      var tip=groups[i]+' '+barSeries.label+': '+v;
      return '<rect x="'+bx(i)+'" y="'+barY(v)+'" width="'+barW+'" height="'+barH(v)+'" fill="'+barSeries.color+'" rx="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
    }).join('');
    var ld=allLine.map(function(v,i){return (i?'L':'M')+lx(i)+','+ly(v);}).join('');
    var ldots=allLine.map(function(v,i){
      var tip=groups[i]+' '+lineSeries.label+': '+v+'%';
      return '<circle cx="'+lx(i)+'" cy="'+ly(v)+'" r="3" fill="#fff" stroke="'+lineSeries.color+'" stroke-width="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padYB-f*(H-padYT-padYB)).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+(barMax*f).toFixed(2)+'</text>'
        +'<text x="'+(W-4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="'+lineSeries.color+'">'+(lineMax*f).toFixed(1)+'%</text>';
    }).join('');
    var xL=groups.map(function(l,i){return '<text x="'+lx(i)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+'<path d="'+ld+'" fill="none" stroke="'+lineSeries.color+'" stroke-width="2" stroke-linejoin="round"/>'+ldots+xL+'</svg>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+barSeries.color+';display:inline-block"></span>'+barSeries.label+'</span>'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:'+lineSeries.color+';display:inline-block;border-radius:1px"></span>'+lineSeries.label+'</span>'
      +'</div>';
    return chartSvg+leg;
  }
  function donut(segs,label){
    var s=200,cx=s/2,cy=s/2,R=s*0.42,ir=s*0.30;
    var total=segs.reduce(function(a,x){return a+x.v;},0);
    var ang=-Math.PI/2,paths='';
    segs.forEach(function(sg){
      var sweep=(sg.v/total)*2*Math.PI,ea=ang+sweep;
      var x1=(cx+R*Math.cos(ang)).toFixed(2),y1=(cy+R*Math.sin(ang)).toFixed(2);
      var x2=(cx+R*Math.cos(ea)).toFixed(2),y2=(cy+R*Math.sin(ea)).toFixed(2);
      var x3=(cx+ir*Math.cos(ea)).toFixed(2),y3=(cy+ir*Math.sin(ea)).toFixed(2);
      var x4=(cx+ir*Math.cos(ang)).toFixed(2),y4=(cy+ir*Math.sin(ang)).toFixed(2);
      var la=sweep>Math.PI?1:0;
      var d='M'+x1+' '+y1+' A'+R+' '+R+' 0 '+la+' 1 '+x2+' '+y2+' L'+x3+' '+y3+' A'+ir+' '+ir+' 0 '+la+' 0 '+x4+' '+y4+'Z';
      paths+='<path d="'+d+'" fill="'+sg.color+'" stroke="none"/>';
      ang=ea;
    });
    var legend=segs.map(function(sg,i){
      var pct=(sg.v/total*100).toFixed(1);
      return '<div style="display:flex;align-items:center;gap:6px;font-size:.78rem;color:#374151">'
        +'<span style="width:8px;height:8px;border-radius:50%;background:'+sg.color+';flex-shrink:0;display:inline-block"></span>'
        +sg.label+' <span style="color:#9CA3AF">'+pct+'%</span></div>';
    }).join('');
    return '<div style="display:flex;align-items:center;justify-content:flex-start;gap:24px;flex:1;padding:8px 0">'
      +'<svg viewBox="0 0 '+s+' '+s+'" style="width:'+s+'px;height:'+s+'px;flex-shrink:0">'
      +paths
      +'<circle cx="'+cx+'" cy="'+cy+'" r="'+(ir-3)+'" fill="#fff"/>'
      +'<text x="'+cx+'" y="'+(cy-4)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="11" font-weight="700" fill="#0F172A">'+label+'</text>'
      +'<text x="'+cx+'" y="'+(cy+12)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="9" fill="#6B7280">total</text>'
      +'</svg>'
      +'<div style="display:flex;flex-direction:column;gap:7px">'+legend+'</div>'
      +'</div>';
  }

  // Line chart — full width + hover
  function line(series,labels){
    var W=420,H=220,padX=36,padY=18;
    var all=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var mn=Math.min.apply(null,all),mx=Math.max.apply(null,all),rng=mx-mn||0.001;
    var n=labels.length;
    function px(i){return padX+(i/(n-1))*(W-padX-8);}
    function py(v){return H-padY-((v-mn)/rng)*(H-padY*2);}
    var paths=series.map(function(s){
      var d=s.v.map(function(v,i){return (i?'L':'M')+px(i).toFixed(1)+','+py(v).toFixed(1);}).join('');
      var area=d+' L'+px(n-1).toFixed(1)+','+(H-padY)+' L'+px(0).toFixed(1)+','+(H-padY)+'Z';
      var dots=s.v.map(function(v,i){
        var tip=labels[i]+': '+v.toFixed(4);
        return '<circle cx="'+px(i).toFixed(1)+'" cy="'+py(v).toFixed(1)+'" r="3" fill="#fff" stroke="'+s.color+'" stroke-width="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
      }).join('');
      return '<defs><linearGradient id="lg'+s.id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+s.color+'" stop-opacity=".12"/><stop offset="1" stop-color="'+s.color+'" stop-opacity="0"/></linearGradient></defs>'
        +'<path d="'+area+'" fill="url(#lg'+s.id+')"/>'
        +'<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+dots;
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=mn+f*rng;
      var vStr=v>=100?v.toFixed(0):v>=1?v.toFixed(2):v.toFixed(4);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+vStr+'</text>';
    }).join('');
    var xL=[0,Math.floor(n/2),n-1].map(function(i){return '<text x="'+px(i).toFixed(1)+'" y="'+(H-2)+'" text-anchor="middle" font-size="8.5" fill="#9CA3AF">'+labels[i]+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+paths+xL+'</svg>';
    var leg=series.length>1?'<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'+series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:'+s.color+';display:inline-block;border-radius:1px"></span>'+(s.label||s.id)+'</span>';}).join('')+'</div>':'';
    return chartSvg+leg;
  }
  // Combo chart — bars (DPS) + line (Yield)
  function comboChart(groups,barSeries,lineSeries){
    var W=420,H=220,padX=42,padYT=16,padYB=24;
    var allBar=barSeries.v, allLine=lineSeries.v;
    var barMax=Math.max.apply(null,allBar)||1;
    var lineMax=Math.max.apply(null,allLine)||1;
    var n=groups.length;
    var groupW=(W-padX-8)/n;
    var barW=Math.min(28,groupW*0.35);
    function bx(i){return (padX+i*groupW+groupW/2-barW/2).toFixed(1);}
    function barH(v){return Math.max(2,((v/barMax)*(H-padYT-padYB))).toFixed(1);}
    function barY(v){return (H-padYB-parseFloat(barH(v))).toFixed(1);}
    function lx(i){return (padX+i*groupW+groupW/2).toFixed(1);}
    function ly(v){return (H-padYB-((v/lineMax)*(H-padYT-padYB))).toFixed(1);}
    // Bars
    var bPaths=allBar.map(function(v,i){
      return '<rect x="'+bx(i)+'" y="'+barY(v)+'" width="'+barW+'" height="'+barH(v)+'" fill="'+barSeries.color+'" rx="2"/>';
    }).join('');
    // Line
    var ld=allLine.map(function(v,i){return (i?'L':'M')+lx(i)+','+ly(v);}).join('');
    var ldots=allLine.map(function(v,i){return '<circle cx="'+lx(i)+'" cy="'+ly(v)+'" r="3" fill="#fff" stroke="'+lineSeries.color+'" stroke-width="2"/>';}).join('');
    // Grid
    var grid=[0.5,1].map(function(f){
      var yy=(H-padYB-f*(H-padYT-padYB)).toFixed(1);
      var vLeft=(barMax*f).toFixed(2);
      var vRight=(lineMax*f).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+vLeft+'</text>'
        +'<text x="'+(W-5)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="'+lineSeries.color+'">'+vRight+'%</text>';
    }).join('');
    // X labels
    var xL=groups.map(function(l,i){return '<text x="'+lx(i)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+'<path d="'+ld+'" fill="none" stroke="'+lineSeries.color+'" stroke-width="2" stroke-linejoin="round"/>'+ldots+xL+'</svg>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+barSeries.color+';display:inline-block"></span>'+barSeries.label+'</span>'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:'+lineSeries.color+';display:inline-block;border-radius:1px"></span>'+lineSeries.label+'</span>'
      +'</div>';
    return chartSvg+leg;
  }


  // Bar chart
  function bars(data,labels,colors,legendItems,showLabels){
    if(showLabels===undefined)showLabels=true;
    var W=420,H=220,padX=36,padY=20,n=data.length;
    var mx=Math.max.apply(null,data)||1,barW=Math.min(28,(W-padX-8)/n*0.30),gap=(W-padX-8)/n;
    function bx(i){return padX+i*gap+gap/2-barW/2;}
    function bh(v){return Math.max(2,(v/mx)*(H-padY*2));}
    var bPaths=data.map(function(v,i){
      var h=bh(v),x=bx(i).toFixed(1),y=(H-padY-h).toFixed(1);
      return '<rect x="'+x+'" y="'+y+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+(colors[i]||'#1565C0')+'" rx="2"/>'
        +(showLabels?'<text x="'+(parseFloat(x)+barW/2).toFixed(1)+'" y="'+(parseFloat(y)-4).toFixed(1)+'" text-anchor="middle" font-size="9" fill="#000" font-weight="600">'+v+'</text>':'');
    }).join('');
    var hZones=data.map(function(v,i){
      var tipStr=labels[i]+': '+v;
      return '<rect x="'+(padX+i*gap).toFixed(1)+'" y="'+padY+'" width="'+gap.toFixed(1)+'" height="'+(H-padY*2)+'" fill="transparent" data-tip="'+tipStr+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=(mx*f).toFixed(2);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#333">'+v+'</text>';
    }).join('');
    var xL=labels.map(function(l,i){return '<text x="'+(bx(i)+barW/2).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#000">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+xL+hZones+'</svg>';
    var leg=legendItems?'<div style="display:flex;gap:14px;justify-content:center;margin-top:6px;flex-wrap:wrap">'+legendItems.map(function(it){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#000"><span style="width:10px;height:10px;border-radius:2px;background:'+it.c+';display:inline-block"></span>'+it.l+'</span>';}).join('')+'</div>':'';
    return chartSvg+leg;
  }
  // Grouped bar chart
  function groupedBars(groups,series){
    var W=420,H=220,padX=36,padY=20,n=groups.length,ns=series.length;
    var allV=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var mx=Math.max.apply(null,allV)||1;
    var groupW=(W-padX-8)/n,barW=Math.min(16,groupW/ns*0.4);
    function bx(gi,si){return padX+gi*groupW+groupW/2-(ns*barW+(ns-1)*3)/2+si*(barW+3);}
    function bh(v){return Math.max(2,(v/mx)*(H-padY*2));}
    var bPaths=series.map(function(s,si){
      return s.v.map(function(v,gi){
        var h=bh(v),x=bx(gi,si).toFixed(1),y=(H-padY-h).toFixed(1);
        return '<rect x="'+x+'" y="'+y+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+s.color+'" rx="2"/>';
      }).join('');
    }).join('');
    var hZones=groups.map(function(g,gi){
      var vals=series.map(function(s){return s.label+': '+s.v[gi];}).join(' | ');
      var tipStr=g+' — '+vals;
      return '<rect x="'+(padX+gi*groupW).toFixed(1)+'" y="'+padY+'" width="'+groupW.toFixed(1)+'" height="'+(H-padY*2)+'" fill="transparent" data-tip="'+tipStr+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=(mx*f).toFixed(2);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#333">'+v+'</text>';
    }).join('');
    var xL=groups.map(function(l,i){var cx=padX+i*groupW+groupW/2;return '<text x="'+cx.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#000">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+xL+hZones+'</svg>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'+series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#000"><span style="width:10px;height:10px;border-radius:2px;background:'+s.color+';display:inline-block"></span>'+s.label+'</span>';}).join('')+'</div>';
    return chartSvg+leg;
  }
  // Stacked bar
  function stackedBars(series,labels){
    var W=420,H=220,padX=36,padY=20,n=labels.length;
    var totals=labels.map(function(_,i){return series.reduce(function(a,s){return a+s.v[i];},0);});
    var mx=Math.max.apply(null,totals)||1,barW=Math.min(28,(W-padX-8)/n*0.30),gap=(W-padX-8)/n;
    function bx(i){return (padX+i*gap+gap/2-barW/2).toFixed(1);}
    function bh(v){return Math.max(2,((v/mx)*(H-padY*2)));}
    var rects='';
    labels.forEach(function(_,i){var y=H-padY;series.forEach(function(s){var h=bh(s.v[i]);y-=h;rects+='<rect x="'+bx(i)+'" y="'+y.toFixed(1)+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+s.color+'" rx="1"/>';});});
    var hZones=labels.map(function(l,i){
      var vals=series.map(function(s){return s.label+': '+s.v[i];}).join(' | ');
      var tipStr=l+' — '+vals;
      return '<rect x="'+(padX+i*gap).toFixed(1)+'" y="'+padY+'" width="'+gap.toFixed(1)+'" height="'+(H-padY*2)+'" fill="transparent" data-tip="'+tipStr+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=(mx*f).toFixed(1);return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/><text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#333">'+v+'</text>';}).join('');
    var xL=labels.map(function(l,i){return '<text x="'+(parseFloat(bx(i))+barW/2).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#000">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+rects+xL+hZones+'</svg>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'+series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#000"><span style="width:10px;height:10px;border-radius:2px;background:'+s.color+';display:inline-block"></span>'+s.label+'</span>';}).join('')+'</div>';
    return chartSvg+leg;
  }
  // Line chart
  function line(series,labels){
    var W=420,H=220,padX=36,padY=18;
    var all=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var mn=Math.min.apply(null,all),mx=Math.max.apply(null,all),rng=mx-mn||0.001;
    var n=labels.length;
    function px(i){return padX+(i/(n-1))*(W-padX-8);}
    function py(v){return H-padY-((v-mn)/rng)*(H-padY*2);}
    var paths=series.map(function(s){
      var d=s.v.map(function(v,i){return (i?'L':'M')+px(i).toFixed(1)+','+py(v).toFixed(1);}).join('');
      var area=d+' L'+px(n-1).toFixed(1)+','+(H-padY)+' L'+px(0).toFixed(1)+','+(H-padY)+'Z';
      var dots=s.v.map(function(v,i){
        var tipStr=labels[i]+': '+v.toFixed(4);
        return '<circle cx="'+px(i).toFixed(1)+'" cy="'+py(v).toFixed(1)+'" r="3" fill="#fff" stroke="'+s.color+'" stroke-width="2" data-tip="'+tipStr+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
      }).join('');
      return '<defs><linearGradient id="lg'+s.id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+s.color+'" stop-opacity=".12"/><stop offset="1" stop-color="'+s.color+'" stop-opacity="0"/></linearGradient></defs>'
        +'<path d="'+area+'" fill="url(#lg'+s.id+')"/>'
        +'<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+dots;
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=mn+f*rng;var vStr=v>=100?v.toFixed(0):v>=1?v.toFixed(2):v.toFixed(4);return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/><text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#333">'+vStr+'</text>';}).join('');
    var xL=[0,Math.floor(n/2),n-1].map(function(i){return '<text x="'+px(i).toFixed(1)+'" y="'+(H-2)+'" text-anchor="middle" font-size="8.5" fill="#000">'+labels[i]+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+paths+xL+'</svg>';
    var leg=series.length>1?'<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'+series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#000"><span style="width:16px;height:2px;background:'+s.color+';display:inline-block;border-radius:1px"></span>'+(s.label||s.id)+'</span>';}).join('')+'</div>':'';
    return chartSvg+leg;
  }
  // Combo chart
  function comboChart(groups,barSeries,lineSeries){
    var W=420,H=220,padX=42,padYT=16,padYB=24;
    var allBar=barSeries.v,allLine=lineSeries.v;
    var barMax=Math.max.apply(null,allBar)||1,lineMax=Math.max.apply(null,allLine)||1;
    var n=groups.length,groupW=(W-padX-8)/n,barW=Math.min(28,groupW*0.35);
    function bx(i){return (padX+i*groupW+groupW/2-barW/2).toFixed(1);}
    function barH(v){return Math.max(2,((v/barMax)*(H-padYT-padYB))).toFixed(1);}
    function barY(v){return (H-padYB-parseFloat(barH(v))).toFixed(1);}
    function lx(i){return (padX+i*groupW+groupW/2).toFixed(1);}
    function ly(v){return (H-padYB-((v/lineMax)*(H-padYT-padYB))).toFixed(1);}
    var bPaths=allBar.map(function(v,i){return '<rect x="'+bx(i)+'" y="'+barY(v)+'" width="'+barW+'" height="'+barH(v)+'" fill="'+barSeries.color+'" rx="2"/>';}).join('');
    var ld=allLine.map(function(v,i){return (i?'L':'M')+lx(i)+','+ly(v);}).join('');
    var ldots=allLine.map(function(v,i){return '<circle cx="'+lx(i)+'" cy="'+ly(v)+'" r="3" fill="#fff" stroke="'+lineSeries.color+'" stroke-width="2"/>';}).join('');
    var hZones=groups.map(function(g,i){
      var tipStr=g+' — '+barSeries.label+': '+allBar[i]+' | '+lineSeries.label+': '+allLine[i]+'%';
      return '<rect x="'+(padX+i*groupW).toFixed(1)+'" y="'+padYT+'" width="'+groupW.toFixed(1)+'" height="'+(H-padYT-padYB)+'" fill="transparent" data-tip="'+tipStr+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){var yy=(H-padYB-f*(H-padYT-padYB)).toFixed(1);return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/><text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#333">'+(barMax*f).toFixed(2)+'</text><text x="'+(W-4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="'+lineSeries.color+'">'+(lineMax*f).toFixed(1)+'%</text>';}).join('');
    var xL=groups.map(function(l,i){return '<text x="'+lx(i)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#000">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+'<path d="'+ld+'" fill="none" stroke="'+lineSeries.color+'" stroke-width="2" stroke-linejoin="round"/>'+ldots+xL+hZones+'</svg>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px"><span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#000"><span style="width:10px;height:10px;border-radius:2px;background:'+barSeries.color+';display:inline-block"></span>'+barSeries.label+'</span><span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#000"><span style="width:16px;height:2px;background:'+lineSeries.color+';display:inline-block;border-radius:1px"></span>'+lineSeries.label+'</span></div>';
    return chartSvg+leg;
  }
  function donut(segs,label){
    var s=200,cx=s/2,cy=s/2,R=s*0.42,ir=s*0.30;
    var total=segs.reduce(function(a,x){return a+x.v;},0);
    var ang=-Math.PI/2,paths='';
    segs.forEach(function(sg){
      var sweep=(sg.v/total)*2*Math.PI,ea=ang+sweep;
      var x1=(cx+R*Math.cos(ang)).toFixed(2),y1=(cy+R*Math.sin(ang)).toFixed(2);
      var x2=(cx+R*Math.cos(ea)).toFixed(2),y2=(cy+R*Math.sin(ea)).toFixed(2);
      var x3=(cx+ir*Math.cos(ea)).toFixed(2),y3=(cy+ir*Math.sin(ea)).toFixed(2);
      var x4=(cx+ir*Math.cos(ang)).toFixed(2),y4=(cy+ir*Math.sin(ang)).toFixed(2);
      var la=sweep>Math.PI?1:0;
      var d='M'+x1+' '+y1+' A'+R+' '+R+' 0 '+la+' 1 '+x2+' '+y2+' L'+x3+' '+y3+' A'+ir+' '+ir+' 0 '+la+' 0 '+x4+' '+y4+'Z';
      paths+='<path d="'+d+'" fill="'+sg.color+'" stroke="none"/>';
      ang=ea;
    });
    var legend=segs.map(function(sg,i){
      var pct=(sg.v/total*100).toFixed(1);
      return '<div style="display:flex;align-items:center;gap:6px;font-size:.78rem;color:#374151">'
        +'<span style="width:8px;height:8px;border-radius:50%;background:'+sg.color+';flex-shrink:0;display:inline-block"></span>'
        +sg.label+' <span style="color:#9CA3AF">'+pct+'%</span></div>';
    }).join('');
    return '<div style="display:flex;align-items:center;justify-content:flex-start;gap:24px;flex:1;padding:8px 0">'
      +'<svg viewBox="0 0 '+s+' '+s+'" style="width:'+s+'px;height:'+s+'px;flex-shrink:0">'
      +paths
      +'<circle cx="'+cx+'" cy="'+cy+'" r="'+(ir-3)+'" fill="#fff"/>'
      +'<text x="'+cx+'" y="'+(cy-4)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="11" font-weight="700" fill="#0F172A">'+label+'</text>'
      +'<text x="'+cx+'" y="'+(cy+12)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="9" fill="#6B7280">total</text>'
      +'</svg>'
      +'<div style="display:flex;flex-direction:column;gap:7px">'+legend+'</div>'
      +'</div>';
  }

  // Line chart — full width + hover
  function line(series,labels){
    var W=420,H=220,padX=36,padY=18;
    var all=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var mn=Math.min.apply(null,all),mx=Math.max.apply(null,all),rng=mx-mn||0.001;
    var n=labels.length;
    function px(i){return padX+(i/(n-1))*(W-padX-8);}
    function py(v){return H-padY-((v-mn)/rng)*(H-padY*2);}
    var paths=series.map(function(s){
      var d=s.v.map(function(v,i){return (i?'L':'M')+px(i).toFixed(1)+','+py(v).toFixed(1);}).join('');
      var area=d+' L'+px(n-1).toFixed(1)+','+(H-padY)+' L'+px(0).toFixed(1)+','+(H-padY)+'Z';
      var dots=s.v.map(function(v,i){
        var tip=labels[i]+': '+v.toFixed(4);
        return '<circle cx="'+px(i).toFixed(1)+'" cy="'+py(v).toFixed(1)+'" r="3" fill="#fff" stroke="'+s.color+'" stroke-width="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
      }).join('');
      return '<defs><linearGradient id="lg'+s.id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+s.color+'" stop-opacity=".12"/><stop offset="1" stop-color="'+s.color+'" stop-opacity="0"/></linearGradient></defs>'
        +'<path d="'+area+'" fill="url(#lg'+s.id+')"/>'
        +'<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+dots;
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=mn+f*rng;
      var vStr=v>=100?v.toFixed(0):v>=1?v.toFixed(2):v.toFixed(4);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+vStr+'</text>';
    }).join('');
    var xL=[0,Math.floor(n/2),n-1].map(function(i){return '<text x="'+px(i).toFixed(1)+'" y="'+(H-2)+'" text-anchor="middle" font-size="8.5" fill="#9CA3AF">'+labels[i]+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+paths+xL+'</svg>';
    var leg=series.length>1?'<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'+series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:'+s.color+';display:inline-block;border-radius:1px"></span>'+(s.label||s.id)+'</span>';}).join('')+'</div>':'';
    return chartSvg+leg;
  }
  // Combo chart — bars (DPS) + line (Yield) + hover
  function comboChart(groups,barSeries,lineSeries){
    var W=420,H=220,padX=42,padYT=16,padYB=24;
    var allBar=barSeries.v,allLine=lineSeries.v;
    var barMax=Math.max.apply(null,allBar)||1,lineMax=Math.max.apply(null,allLine)||1;
    var n=groups.length,groupW=(W-padX-8)/n,barW=Math.min(28,groupW*0.35);
    function bx(i){return (padX+i*groupW+groupW/2-barW/2).toFixed(1);}
    function barH(v){return Math.max(2,((v/barMax)*(H-padYT-padYB))).toFixed(1);}
    function barY(v){return (H-padYB-parseFloat(barH(v))).toFixed(1);}
    function lx(i){return (padX+i*groupW+groupW/2).toFixed(1);}
    function ly(v){return (H-padYB-((v/lineMax)*(H-padYT-padYB))).toFixed(1);}
    var bPaths=allBar.map(function(v,i){
      var tip=groups[i]+' '+barSeries.label+': '+v;
      return '<rect x="'+bx(i)+'" y="'+barY(v)+'" width="'+barW+'" height="'+barH(v)+'" fill="'+barSeries.color+'" rx="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
    }).join('');
    var ld=allLine.map(function(v,i){return (i?'L':'M')+lx(i)+','+ly(v);}).join('');
    var ldots=allLine.map(function(v,i){
      var tip=groups[i]+' '+lineSeries.label+': '+v+'%';
      return '<circle cx="'+lx(i)+'" cy="'+ly(v)+'" r="3" fill="#fff" stroke="'+lineSeries.color+'" stroke-width="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padYB-f*(H-padYT-padYB)).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+(barMax*f).toFixed(2)+'</text>'
        +'<text x="'+(W-4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="'+lineSeries.color+'">'+(lineMax*f).toFixed(1)+'%</text>';
    }).join('');
    var xL=groups.map(function(l,i){return '<text x="'+lx(i)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+'<path d="'+ld+'" fill="none" stroke="'+lineSeries.color+'" stroke-width="2" stroke-linejoin="round"/>'+ldots+xL+'</svg>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+barSeries.color+';display:inline-block"></span>'+barSeries.label+'</span>'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:'+lineSeries.color+';display:inline-block;border-radius:1px"></span>'+lineSeries.label+'</span>'
      +'</div>';
    return chartSvg+leg;
  }
  function donut(segs,label,caption,valFmt,legendOverride){
    // Sort by value descending so the rank-based color gradient (dark blue
    // = largest slice, grey = smallest) is always applied consistently,
    // regardless of the order segments were passed in. Segments flagged
    // pinLast (e.g. "The rest of shareholder") are excluded from the sort
    // and always appended at the end, regardless of their value.
    var pinned=segs.filter(function(s){return s.pinLast;});
    var ranked=segs.filter(function(s){return !s.pinLast;});
    var sorted=ranked.slice().sort(function(a,b){return b.v-a.v;}).concat(pinned);
    var fmtV=valFmt||fmtChartNum;
    var s=270,cx=s/2,cy=s/2,R=s*0.42,ir=s*0.35;
    var total=sorted.reduce(function(a,x){return a+x.v;},0);
    var ang=-Math.PI/2,paths='';
    sorted.forEach(function(sg,idx){
      var col=pieGradientColor(idx,sorted.length);
      var sweep=(sg.v/total)*2*Math.PI,ea=ang+sweep;
      var x1=(cx+R*Math.cos(ang)).toFixed(2),y1=(cy+R*Math.sin(ang)).toFixed(2);
      var x2=(cx+R*Math.cos(ea)).toFixed(2),y2=(cy+R*Math.sin(ea)).toFixed(2);
      var x3=(cx+ir*Math.cos(ea)).toFixed(2),y3=(cy+ir*Math.sin(ea)).toFixed(2);
      var x4=(cx+ir*Math.cos(ang)).toFixed(2),y4=(cy+ir*Math.sin(ang)).toFixed(2);
      var la=sweep>Math.PI?1:0;
      var d='M'+x1+' '+y1+' A'+R+' '+R+' 0 '+la+' 1 '+x2+' '+y2+' L'+x3+' '+y3+' A'+ir+' '+ir+' 0 '+la+' 0 '+x4+' '+y4+'Z';
      var pct=(sg.v/total*100).toFixed(1);
      var tipStr=sg.label+': '+fmtV(sg.v)+' ('+pct+'%)';
      paths+='<path d="'+d+'" fill="'+col+'" stroke="none" data-tip="'+tipStr+'" onmouseenter="showPieTip(event,getTip(this))" onmousemove="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
      ang=ea;
    });
    // Legend defaults to the pie's own segments (rank color + % share), but
    // callers can pass an explicit legendOverride — e.g. Distribution
    // Summary shows the last 3 years' interim payout, independent of
    // whichever two figures make up the donut slices.
    var legend;
    if(legendOverride && legendOverride.length){
      legend=legendOverride.map(function(it){
        return '<div style="display:flex;align-items:center;gap:6px;font-size:.78rem;color:#374151">'
          +'<span style="width:8px;height:8px;border-radius:50%;background:'+it.color+';flex-shrink:0;display:inline-block"></span>'
          +it.label+' <span style="color:#9CA3AF">'+it.value+'</span></div>';
      }).join('');
    } else {
      legend=sorted.map(function(sg,idx){
        var col=pieGradientColor(idx,sorted.length);
        var pct=(sg.v/total*100).toFixed(1);
        return '<div style="display:flex;align-items:center;gap:6px;font-size:.78rem;color:#374151">'
          +'<span style="width:8px;height:8px;border-radius:50%;background:'+col+';flex-shrink:0;display:inline-block"></span>'
          +sg.label+' <span style="color:#9CA3AF">'+pct+'%</span></div>';
      }).join('');
    }
    return '<div style="display:flex;align-items:center;justify-content:flex-start;gap:20px;flex:1;padding:8px 0;min-height:0">'
      +'<svg viewBox="0 0 '+s+' '+s+'" style="width:'+s+'px;height:'+s+'px;max-width:90%;max-height:100%;flex-shrink:0">'
      +paths
      +'<circle cx="'+cx+'" cy="'+cy+'" r="'+(ir-3)+'" fill="#fff" style="pointer-events:none"/>'
      +'<text x="'+cx+'" y="'+(cy-6)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="19" font-weight="400" fill="#0F172A" style="pointer-events:none">'+label+'</text>'
      +'<text x="'+cx+'" y="'+(cy+16)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="13" fill="#6B7280" style="pointer-events:none">'+(caption||'total')+'</text>'
      +'</svg>'
      +'<div style="display:flex;flex-direction:column;gap:7px;min-width:0">'+legend+'</div>'
      +'</div>';
  }

  // Line chart — full width + hover
  function line(series,labels){
    var W=420,H=220,padX=36,padY=18;
    var all=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var mn=Math.min.apply(null,all),mx=Math.max.apply(null,all),rng=mx-mn||0.001;
    var n=labels.length;
    function px(i){return padX+(i/(n-1))*(W-padX-8);}
    function py(v){return H-padY-((v-mn)/rng)*(H-padY*2);}
    var paths=series.map(function(s){
      var d=s.v.map(function(v,i){return (i?'L':'M')+px(i).toFixed(1)+','+py(v).toFixed(1);}).join('');
      var area=d+' L'+px(n-1).toFixed(1)+','+(H-padY)+' L'+px(0).toFixed(1)+','+(H-padY)+'Z';
      var dots=s.v.map(function(v,i){
        var tip=labels[i]+': '+v.toFixed(4);
        return '<circle cx="'+px(i).toFixed(1)+'" cy="'+py(v).toFixed(1)+'" r="3" fill="#fff" stroke="'+s.color+'" stroke-width="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
      }).join('');
      return '<defs><linearGradient id="lg'+s.id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+s.color+'" stop-opacity=".12"/><stop offset="1" stop-color="'+s.color+'" stop-opacity="0"/></linearGradient></defs>'
        +'<path d="'+area+'" fill="url(#lg'+s.id+')"/>'
        +'<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+dots;
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=mn+f*rng;
      var vStr=v>=100?v.toFixed(0):v>=1?v.toFixed(2):v.toFixed(4);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+vStr+'</text>';
    }).join('');
    var xL=[0,Math.floor(n/2),n-1].map(function(i){return '<text x="'+px(i).toFixed(1)+'" y="'+(H-2)+'" text-anchor="middle" font-size="8.5" fill="#9CA3AF">'+labels[i]+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+paths+xL+'</svg>';
    var leg=series.length>1?'<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'+series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:'+s.color+';display:inline-block;border-radius:1px"></span>'+(s.label||s.id)+'</span>';}).join('')+'</div>':'';
    return chartSvg+leg;
  }
  // Combo chart — bars (DPS) + line (Yield)
  function comboChart(groups,barSeries,lineSeries){
    var W=420,H=220,padX=42,padYT=16,padYB=24;
    var allBar=barSeries.v, allLine=lineSeries.v;
    var barMax=Math.max.apply(null,allBar)||1;
    var lineMax=Math.max.apply(null,allLine)||1;
    var n=groups.length;
    var groupW=(W-padX-8)/n;
    var barW=Math.min(28,groupW*0.35);
    function bx(i){return (padX+i*groupW+groupW/2-barW/2).toFixed(1);}
    function barH(v){return Math.max(2,((v/barMax)*(H-padYT-padYB))).toFixed(1);}
    function barY(v){return (H-padYB-parseFloat(barH(v))).toFixed(1);}
    function lx(i){return (padX+i*groupW+groupW/2).toFixed(1);}
    function ly(v){return (H-padYB-((v/lineMax)*(H-padYT-padYB))).toFixed(1);}
    // Bars
    var bPaths=allBar.map(function(v,i){
      return '<rect x="'+bx(i)+'" y="'+barY(v)+'" width="'+barW+'" height="'+barH(v)+'" fill="'+barSeries.color+'" rx="2"/>';
    }).join('');
    // Line
    var ld=allLine.map(function(v,i){return (i?'L':'M')+lx(i)+','+ly(v);}).join('');
    var ldots=allLine.map(function(v,i){return '<circle cx="'+lx(i)+'" cy="'+ly(v)+'" r="3" fill="#fff" stroke="'+lineSeries.color+'" stroke-width="2"/>';}).join('');
    // Grid
    var grid=[0.5,1].map(function(f){
      var yy=(H-padYB-f*(H-padYT-padYB)).toFixed(1);
      var vLeft=(barMax*f).toFixed(2);
      var vRight=(lineMax*f).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+vLeft+'</text>'
        +'<text x="'+(W-5)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="'+lineSeries.color+'">'+vRight+'%</text>';
    }).join('');
    // X labels
    var xL=groups.map(function(l,i){return '<text x="'+lx(i)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+'<path d="'+ld+'" fill="none" stroke="'+lineSeries.color+'" stroke-width="2" stroke-linejoin="round"/>'+ldots+xL+'</svg>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+barSeries.color+';display:inline-block"></span>'+barSeries.label+'</span>'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:'+lineSeries.color+';display:inline-block;border-radius:1px"></span>'+lineSeries.label+'</span>'
      +'</div>';
    return chartSvg+leg;
  }


  // Bar chart — full width + bottom legend + hover
  function bars(data,labels,colors,legendItems,showLabels){
    if(showLabels===undefined) showLabels=true;
    var W=420,H=220,padX=36,padY=20,n=data.length;
    var mx=Math.max.apply(null,data)||1,barW=Math.min(28,(W-padX-8)/n*0.30),gap=(W-padX-8)/n;
    function bx(i){return padX+i*gap+gap/2-barW/2;}
    function bh(v){return Math.max(2,(v/mx)*(H-padY*2));}
    var bPaths=data.map(function(v,i){
      var h=bh(v),x=bx(i).toFixed(1),y=(H-padY-h).toFixed(1);
      var tip=labels[i]+': '+v;
      return '<rect x="'+x+'" y="'+y+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+(colors[i]||'#1565C0')+'" rx="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>'
        +(showLabels?'<text x="'+(parseFloat(x)+barW/2).toFixed(1)+'" y="'+(parseFloat(y)-4).toFixed(1)+'" text-anchor="middle" font-size="9" fill="#374151" font-weight="600">'+v+'</text>':'');
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=(mx*f).toFixed(2);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+v+'</text>';
    }).join('');
    var xL=labels.map(function(l,i){return '<text x="'+(bx(i)+barW/2).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+xL+'</svg>';
    var leg=legendItems?'<div style="display:flex;gap:14px;justify-content:center;margin-top:6px;flex-wrap:wrap">'
      +legendItems.map(function(it){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+it.c+';display:inline-block"></span>'+it.l+'</span>';}).join('')+'</div>':'';
    return chartSvg+leg;
  }
  // Grouped bar chart — full width + bottom legend + hover
  function groupedBars(groups,series){
    var W=420,H=220,padX=36,padY=20,n=groups.length,ns=series.length;
    var allV=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var mx=Math.max.apply(null,allV)||1;
    var groupW=(W-padX-8)/n,barW=Math.min(16,groupW/ns*0.4);
    function bx(gi,si){return padX+gi*groupW+groupW/2-(ns*barW+(ns-1)*3)/2+si*(barW+3);}
    function bh(v){return Math.max(2,(v/mx)*(H-padY*2));}
    var bPaths=series.map(function(s,si){
      return s.v.map(function(v,gi){
        var h=bh(v),x=bx(gi,si).toFixed(1),y=(H-padY-h).toFixed(1);
        var tip=groups[gi]+' '+s.label+': '+v;
        return '<rect x="'+x+'" y="'+y+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+s.color+'" rx="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
      }).join('');
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=(mx*f).toFixed(2);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+v+'</text>';
    }).join('');
    var xL=groups.map(function(l,i){
      var cx=padX+i*groupW+groupW/2;
      return '<text x="'+cx.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';
    }).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+xL+'</svg>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'
      +series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+s.color+';display:inline-block"></span>'+s.label+'</span>';}).join('')+'</div>';
    return chartSvg+leg;
  }
  // Stacked bar — full width + legend + hover
  function stackedBars(series,labels){
    var W=420,H=220,padX=36,padY=20,n=labels.length;
    var totals=labels.map(function(_,i){return series.reduce(function(a,s){return a+s.v[i];},0);});
    var mx=Math.max.apply(null,totals)||1,barW=Math.min(28,(W-padX-8)/n*0.30),gap=(W-padX-8)/n;
    function bx(i){return (padX+i*gap+gap/2-barW/2).toFixed(1);}
    function bh(v){return Math.max(2,((v/mx)*(H-padY*2)));}
    var rects='';
    labels.forEach(function(_,i){
      var y=H-padY;
      series.forEach(function(s){
        var h=bh(s.v[i]);
        y-=h;
        var tip=labels[i]+' '+s.label+': '+s.v[i];
        rects+='<rect x="'+bx(i)+'" y="'+y.toFixed(1)+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+s.color+'" rx="1" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
      });
    });
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=(mx*f).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+v+'</text>';
    }).join('');
    var xL=labels.map(function(l,i){return '<text x="'+(parseFloat(bx(i))+barW/2).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+rects+xL+'</svg>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'
      +series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+s.color+';display:inline-block"></span>'+s.label+'</span>';}).join('')+'</div>';
    return chartSvg+leg;
  }
  // Line chart — full width
  function line(series,labels){
    var W=420,H=220,padX=16,padR=42,padY=18;
    var tipId=nextTipId();
    var all=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var rawMn=Math.min.apply(null,all),rawMx=Math.max.apply(null,all);
    var scale=niceAxisScale(rawMn,rawMx,5);
    var mn=scale.min,mx=scale.max,rng=(mx-mn)||0.001;
    var n=labels.length;
    function px(i){return padX+(i/(n-1))*(W-padX-padR);}
    function py(v){return H-padY-((v-mn)/rng)*(H-padY*2);}
    var paths=series.map(function(s){
      var d=s.v.map(function(v,i){return (i?'L':'M')+px(i).toFixed(1)+','+py(v).toFixed(1);}).join('');
      var area=d+' L'+px(n-1).toFixed(1)+','+(H-padY)+' L'+px(0).toFixed(1)+','+(H-padY)+'Z';
      var dots=s.v.map(function(v,i){
        return i===s.v.length-1?'<circle cx="'+px(i).toFixed(1)+'" cy="'+py(v).toFixed(1)+'" r="3" fill="#fff" stroke="'+s.color+'" stroke-width="2"/>':'';
      }).join('');
      return '<defs><linearGradient id="lg'+s.id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+s.color+'" stop-opacity=".12"/><stop offset="1" stop-color="'+s.color+'" stop-opacity="0"/></linearGradient></defs>'
        +'<path d="'+area+'" fill="url(#lg'+s.id+')"/>'
        +'<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+dots;
    }).join('');
    var ticks=[];
    for(var tv=mn; tv<=mx+scale.step*0.001; tv+=scale.step){ ticks.push(tv); }
    var grid=ticks.map(function(v){
      var yy=(H-padY-((v-mn)/rng)*(H-padY*2)).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(W-padR+4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="#9CA3AF">'+fmtChartNum(v)+'</text>';
    }).join('');
    var xL=[0,Math.floor(n/2),n-1].map(function(i){
      return '<text x="'+px(i).toFixed(1)+'" y="'+(H-1)+'" text-anchor="middle" font-size="8.5" fill="#9CA3AF">'+labels[i]+'</text>';
    }).join('');
    // Group hover overlay per x-position — shows every series' value at that point
    var segW=(W-padX-padR)/Math.max(1,n-1);
    var overlays=labels.map(function(l,i){
      if(!l) return '';
      var tipLines=series.map(function(s){ return s.color+'::'+(s.label||s.id)+': '+fmtTipNum(s.v[i]); });
      var tip='FY:'+l+'|'+tipLines.join('|');
      var ox=Math.max(0,px(i)-segW/2).toFixed(1);
      var cx=(px(i)/W).toFixed(4);
      return '<rect x="'+ox+'" y="0" width="'+segW.toFixed(1)+'" height="'+H+'" fill="transparent" data-cx="'+cx+'" data-tip="'+tip+'" onmouseenter="frTip(event,getTip(this),this.getAttribute(\'data-cx\'),\''+tipId+'\')" onmouseleave="frHide(\''+tipId+'\')" style="cursor:crosshair"/>';
    }).join('');
    var chartSvg='<div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+paths+xL+overlays+'</svg>'
      +'<div id="'+tipId+'" style="display:none;position:absolute;background:#fff;color:#0F172A;font-size:.74rem;font-weight:600;padding:8px 12px;border-radius:8px;pointer-events:none;z-index:10;top:4px;left:0;border:1px solid #E2E8F0;box-shadow:0 6px 20px rgba(0,0,0,.13)"></div></div>';
    // Legend at bottom if multiple series
    var leg=series.length>1?'<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'
      +series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:3px;background:'+s.color+';display:inline-block;border-radius:2px"></span>'+(s.label||s.id)+'</span>';}).join('')
      +'</div>':'';
    return chartSvg+leg;
  }

  // Candlestick chart — monthly OHLC (used by NTA Performance)
  function candlestick(months){
    var W=420,H=220,padX=16,padR=42,padYT=14,padYB=24;
    var infoId=nextTipId();
    var n=months.length;
    var allV=[];
    months.forEach(function(m){ allV.push(m.high,m.low); });
    var scale=tightTicks(Math.min.apply(null,allV),Math.max.apply(null,allV));
    var mn=scale.min,mx=scale.max,rng=(mx-mn)||0.001;
    var plotH=H-padYT-padYB;
    function yFor(v){ return padYT+(mx-v)/rng*plotH; }
    var colW=(W-padX-padR)/n;
    var bodyW=Math.min(10,colW*0.45);
    function cx(i){ return padX+i*colW+colW/2; }
    var candles=months.map(function(m,i){
      var up=m.close>=m.open;
      var col=up?'#2E7D32':'#DC2626';
      var x=cx(i);
      var wickTop=yFor(m.high).toFixed(1), wickBot=yFor(m.low).toFixed(1);
      var bodyTop=yFor(Math.max(m.open,m.close)).toFixed(1);
      var bodyH=Math.max(1,Math.abs(yFor(m.open)-yFor(m.close)));
      return '<line x1="'+x.toFixed(1)+'" y1="'+wickTop+'" x2="'+x.toFixed(1)+'" y2="'+wickBot+'" stroke="'+col+'" stroke-width="1"/>'
        +'<rect x="'+(x-bodyW/2).toFixed(1)+'" y="'+bodyTop+'" width="'+bodyW.toFixed(1)+'" height="'+bodyH.toFixed(1)+'" fill="'+col+'" rx="1"/>';
    }).join('');
    var ticks=scale.ticks;
    var grid=ticks.map(function(v){
      var yy=yFor(v).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(W-padR+4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="#9CA3AF">'+fmtChartNum(v)+'</text>';
    }).join('');
    var lblEvery=Math.max(1,Math.ceil(n/6));
    var xL=months.map(function(m,i){
      if(i%lblEvery!==0 && i!==n-1) return '';
      return '<text x="'+cx(i).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="8" fill="#6B7280">'+m.label+'</text>';
    }).join('');
    // Build the "mmm yy  O: .. H: .. L: .. C: .. (Change)" info string for
    // a given month, changed against the previous month's close (falls
    // back to open->close for the first bar, which has no prior month).
    function infoStr(m,prev){
      var base=prev?prev.close:m.open;
      var chg=m.close-base;
      var chgPct=base?(chg/base*100):0;
      var up=chg>=0;
      var sign=up?'+':'−';
      return m.label+'|'+fmtTipNum(m.open)+'|'+fmtTipNum(m.high)+'|'+fmtTipNum(m.low)+'|'+fmtTipNum(m.close)+'|'+sign+fmtChartNum(Math.abs(chg))+'|'+sign+Math.abs(chgPct).toFixed(2)+'%|'+(up?1:0);
    }
    var defaultTip=n?infoStr(months[n-1],n>1?months[n-2]:null):'';
    var overlays=months.map(function(m,i){
      var prev=i>0?months[i-1]:null;
      var tip=infoStr(m,prev);
      var ox=(padX+i*colW).toFixed(1);
      return '<rect x="'+ox+'" y="0" width="'+colW.toFixed(1)+'" height="'+H+'" fill="transparent" data-tip="'+tip+'" onmouseenter="candleInfo(getTip(this),\''+infoId+'\')" onmousemove="candleInfo(getTip(this),\''+infoId+'\')" onmouseleave="candleInfo(\''+defaultTip+'\',\''+infoId+'\')" style="cursor:crosshair"/>';
    }).join('');
    var infoLine='<div id="'+infoId+'" style="font-size:.82rem;color:#374151;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #F1F5F9;min-height:20px;display:flex;align-items:center;flex-wrap:wrap">'+candleInfoHtml(defaultTip)+'</div>';
    var chartSvg='<div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+candles+xL+overlays+'</svg></div>';
    return infoLine+chartSvg;
  }

  // Combo chart — bars (DPS) + line (Yield)
  function comboChart(groups,barSeries,lineSeries){
    var W=420,H=220,padX=42,padR=42,padYT=16,padYB=24;
    var tipId=nextTipId();
    var allBar=barSeries.v, allLine=lineSeries.v;
    var barScale=niceAxisScale(0,Math.max.apply(null,allBar)||1,5);
    var barMax=barScale.max||1;
    var lineMax=Math.max.apply(null,allLine)||1;
    var n=groups.length;
    var groupW=(W-padX-padR)/n;
    var barW=Math.min(20,groupW*0.22);
    function bx(i){return (padX+i*groupW+groupW/2-barW/2).toFixed(1);}
    function barH(v){return Math.max(2,((v/barMax)*(H-padYT-padYB))).toFixed(1);}
    function barY(v){return (H-padYB-parseFloat(barH(v))).toFixed(1);}
    function lx(i){return (padX+i*groupW+groupW/2).toFixed(1);}
    function ly(v){return (H-padYB-((v/lineMax)*(H-padYT-padYB))).toFixed(1);}
    // Bars (left axis) — the fund's own value series
    var bPaths=allBar.map(function(v,i){
      return '<rect x="'+bx(i)+'" y="'+barY(v)+'" width="'+barW+'" height="'+barH(v)+'" fill="'+barSeries.color+'" rx="2"/>';
    }).join('');
    // Line (right axis) — a percentage series
    var ld=allLine.map(function(v,i){return (i?'L':'M')+lx(i)+','+ly(v);}).join('');
    var ldots=allLine.map(function(v,i){return '<circle cx="'+lx(i)+'" cy="'+ly(v)+'" r="3" fill="#fff" stroke="'+lineSeries.color+'" stroke-width="2"/>';}).join('');
    // Grid — bar values on the inner right edge, line % just outside it
    var grid=[0.2,0.4,0.6,0.8,1].map(function(f){
      var yy=(H-padYB-f*(H-padYT-padYB)).toFixed(1);
      var vLeft=fmtChartNum(barMax*f);
      var vRight=fmtChartPct(lineMax*f);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(W-padR+4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="'+barSeries.color+'">'+vLeft+'</text>'
        +'<text x="'+(W-4)+'" y="'+(parseFloat(yy)-6)+'" text-anchor="end" font-size="7.5" fill="'+lineSeries.color+'">'+vRight+'</text>';
    }).join('');
    // X labels
    var xL=groups.map(function(l,i){return '<text x="'+lx(i)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';}).join('');
    // Group hover overlay per FY — shows both the bar and line values together
    var overlays=groups.map(function(g,gi){
      var tip='FY:'+g+'|'+barSeries.color+'::'+barSeries.label+': '+fmtTipNum(allBar[gi])+'|'+lineSeries.color+'::'+lineSeries.label+': '+fmtTipPct(allLine[gi]);
      var ox=(padX+gi*groupW).toFixed(1);
      var cx=((padX+gi*groupW+groupW/2)/W).toFixed(4);
      return '<rect x="'+ox+'" y="0" width="'+groupW.toFixed(1)+'" height="'+H+'" fill="transparent" data-cx="'+cx+'" data-tip="'+tip+'" onmouseenter="frTip(event,getTip(this),this.getAttribute(\'data-cx\'),\''+tipId+'\')" onmouseleave="frHide(\''+tipId+'\')" style="cursor:crosshair"/>';
    }).join('');
    var chartSvg='<div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+'<path d="'+ld+'" fill="none" stroke="'+lineSeries.color+'" stroke-width="2" stroke-linejoin="round"/>'+ldots+xL+overlays+'</svg>'
      +'<div id="'+tipId+'" style="display:none;position:absolute;background:#fff;color:#0F172A;font-size:.74rem;font-weight:600;padding:8px 12px;border-radius:8px;pointer-events:none;z-index:10;top:4px;left:0;border:1px solid #E2E8F0;box-shadow:0 6px 20px rgba(0,0,0,.13)"></div></div>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+barSeries.color+';display:inline-block"></span>'+barSeries.label+'</span>'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:'+lineSeries.color+';display:inline-block;border-radius:1px"></span>'+lineSeries.label+'</span>'
      +'</div>';
    return chartSvg+leg;
  }


  // Bar chart — full width + bottom legend + hover
  function bars(data,labels,colors,legendItems,showLabels,isPct){
    if(showLabels===undefined) showLabels=true;
    var fmtV=isPct?fmtChartPct:fmtChartNum;
    var fmtVTip=isPct?fmtTipPct:fmtTipNum;
    var W=420,H=220,padX=16,padR=42,padY=20,n=data.length;
    var tipId=nextTipId();
    var rawMx=Math.max.apply(null,data)||1;
    var scale=fiveTicks(0,rawMx);
    var mx=scale.max||1,barW=Math.min(22,(W-padX-padR)/n*0.20),gap=(W-padX-padR)/n;
    function bx(i){return padX+i*gap+gap/2-barW/2;}
    function bh(v){return Math.max(2,(v/mx)*(H-padY*2));}
    var bPaths=data.map(function(v,i){
      var h=bh(v),x=bx(i).toFixed(1),y=(H-padY-h).toFixed(1);
      return '<rect x="'+x+'" y="'+y+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+(colors[i]||'#1565C0')+'" rx="2"/>'
        +(showLabels?'<text x="'+(parseFloat(x)+barW/2).toFixed(1)+'" y="'+(parseFloat(y)-4).toFixed(1)+'" text-anchor="middle" font-size="9" fill="#374151" font-weight="400">'+fmtV(v)+'</text>':'');
    }).join('');
    var grid=scale.ticks.map(function(v){
      var yy=(H-padY-(v/mx)*(H-padY*2)).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(W-padR+4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="#9CA3AF">'+fmtV(v)+'</text>';
    }).join('');
    var xL=labels.map(function(l,i){return '<text x="'+(bx(i)+barW/2).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';}).join('');
    // Group hover overlay per label
    var overlays=labels.map(function(l,i){
      var tip='FY:'+l+'|'+(colors[i]||'#1565C0')+'::Value: '+fmtVTip(data[i]);
      var ox=(padX+i*gap).toFixed(1);
      var cx=((padX+i*gap+gap/2)/W).toFixed(4);
      return '<rect x="'+ox+'" y="0" width="'+gap.toFixed(1)+'" height="'+H+'" fill="transparent" data-cx="'+cx+'" data-tip="'+tip+'" onmouseenter="frTip(event,getTip(this),this.getAttribute(\'data-cx\'),\''+tipId+'\')" onmouseleave="frHide(\''+tipId+'\')" style="cursor:crosshair"/>';
    }).join('');
    var chartSvg='<div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+xL+overlays+'</svg>'
      +'<div id="'+tipId+'" style="display:none;position:absolute;background:#fff;color:#0F172A;font-size:.74rem;font-weight:400;padding:8px 12px;border-radius:8px;pointer-events:none;z-index:10;top:4px;left:0;border:1px solid #E2E8F0;box-shadow:0 6px 20px rgba(0,0,0,.13)"></div></div>';
    var leg=legendItems?'<div style="display:flex;gap:14px;justify-content:center;margin-top:6px;flex-wrap:wrap">'
      +legendItems.map(function(it){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+it.c+';display:inline-block"></span>'+it.l+'</span>';}).join('')+'</div>':'';
    return chartSvg+leg;
  }
  // Grouped bar chart — full width + bottom legend + hover
  function groupedBars(groups,series){
    var W=420,H=220,padX=16,padR=42,padYT=14,padYB=24,n=groups.length,ns=series.length;
    var tipId=nextTipId();
    var allV=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var rawMx=Math.max.apply(null,allV.concat([0]));
    var rawMn=Math.min.apply(null,allV.concat([0]));
    var scale=fiveTicks(rawMn,rawMx);
    var mx=scale.max, mn=scale.min;
    if(mx===mn){ mx+=1; mn-=1; }
    var rng=mx-mn;
    var plotH=H-padYT-padYB;
    function yFor(v){ return padYT+(mx-v)/rng*plotH; }
    var zeroY=yFor(0);
    var groupW=(W-padX-padR)/n,barW=Math.min(12,groupW/ns*0.28);
    function bx(gi,si){return padX+gi*groupW+groupW/2-(ns*barW+(ns-1)*3)/2+si*(barW+3);}
    var bPaths=series.map(function(s,si){
      return s.v.map(function(v,gi){
        var yTop=yFor(Math.max(0,v)), yBot=yFor(Math.min(0,v));
        var h=Math.max(0.5,yBot-yTop);
        var x=bx(gi,si).toFixed(1);
        var col=s.colorByValue?(v<0?'#DC2626':'#2E7D32'):s.color;
        return '<rect x="'+x+'" y="'+yTop.toFixed(1)+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+col+'" rx="2"/>';
      }).join('');
    }).join('');
    var grid=scale.ticks.map(function(v){
      var yy=yFor(v).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(W-padR+4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="#9CA3AF">'+fmtChartNum(v)+'</text>';
    }).join('');
    var zeroLine=(mn<0&&mx>0)?('<line x1="'+padX+'" y1="'+zeroY.toFixed(1)+'" x2="'+(W-padR)+'" y2="'+zeroY.toFixed(1)+'" stroke="#CBD5E1" stroke-width="1.2"/>'):'';
    var xL=groups.map(function(l,i){
      var cx=padX+i*groupW+groupW/2;
      return '<text x="'+cx.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';
    }).join('');
    // Group hover overlay per FY — shows all series values together
    var overlays=groups.map(function(g,gi){
      var tipLines=series.map(function(s){ var dotCol=s.colorByValue?(s.v[gi]<0?'#DC2626':'#2E7D32'):s.color; return dotCol+'::'+s.label+': '+fmtTipPlain(s.v[gi]); });
      var tip='FY:'+g+'|'+tipLines.join('|');
      var ox=(padX+gi*groupW).toFixed(1);
      var cx=((padX+gi*groupW+groupW/2)/W).toFixed(4);
      return '<rect x="'+ox+'" y="0" width="'+groupW.toFixed(1)+'" height="'+H+'" fill="transparent" data-cx="'+cx+'" data-tip="'+tip+'" onmouseenter="frTip(event,getTip(this),this.getAttribute(\'data-cx\'),\''+tipId+'\')" onmouseleave="frHide(\''+tipId+'\')" style="cursor:crosshair"/>';
    }).join('');
    var chartSvg='<div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+zeroLine+bPaths+xL+overlays+'</svg>'
      +'<div id="'+tipId+'" style="display:none;position:absolute;background:#fff;color:#0F172A;font-size:.74rem;font-weight:400;padding:8px 12px;border-radius:8px;pointer-events:none;z-index:10;top:4px;left:0;border:1px solid #E2E8F0;box-shadow:0 6px 20px rgba(0,0,0,.13)"></div></div>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px;flex-wrap:wrap">'
      +series.map(function(s){var sw=s.colorByValue?'linear-gradient(90deg,#2E7D32 50%,#DC2626 50%)':s.color;return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+sw+';display:inline-block"></span>'+s.label+'</span>';}).join('')+'</div>';
    return chartSvg+leg;
  }
  // Stacked bar — full width + legend
  function stackedBars(series,labels){
    var W=420,H=220,padX=16,padR=42,padY=20,n=labels.length;
    var tipId=nextTipId();
    var totals=labels.map(function(_,i){return series.reduce(function(a,s){return a+s.v[i];},0);});
    var rawMx=Math.max.apply(null,totals)||1;
    var scalePre=fiveTicks(0,rawMx);
    var mx=scalePre.max||1,barW=Math.min(22,(W-padX-padR)/n*0.20),gap=(W-padX-padR)/n;
    function bx(i){return (padX+i*gap+gap/2-barW/2).toFixed(1);}
    function bh(v){return Math.max(2,((v/mx)*(H-padY*2)));}
    var rects='';
    labels.forEach(function(_,i){
      var y=H-padY;
      series.forEach(function(s){
        var h=bh(s.v[i]);
        y-=h;
        rects+='<rect x="'+bx(i)+'" y="'+y.toFixed(1)+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+s.color+'" rx="1"/>';
      });
    });
    var grid=scalePre.ticks.map(function(v){
      var yy=(H-padY-(v/scalePre.max)*(H-padY*2)).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(W-padR+4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="#9CA3AF">'+fmtChartNum(v)+'</text>';
    }).join('');
    var xL=labels.map(function(l,i){
      return '<text x="'+(parseFloat(bx(i))+barW/2).toFixed(1)+'" y="'+(H-2)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';
    }).join('');
    // Group hover overlay per label — shows all series values together
    var overlays=labels.map(function(l,i){
      var tipLines=series.map(function(s){ return s.color+'::'+s.label+': '+fmtTipPlain(s.v[i]); });
      var tip='FY:'+l+'|'+tipLines.join('|');
      var ox=(padX+i*gap).toFixed(1);
      var cx=((padX+i*gap+gap/2)/W).toFixed(4);
      return '<rect x="'+ox+'" y="0" width="'+gap.toFixed(1)+'" height="'+H+'" fill="transparent" data-cx="'+cx+'" data-tip="'+tip+'" onmouseenter="frTip(event,getTip(this),this.getAttribute(\'data-cx\'),\''+tipId+'\')" onmouseleave="frHide(\''+tipId+'\')" style="cursor:crosshair"/>';
    }).join('');
    var chartSvg='<div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+rects+xL+overlays+'</svg>'
      +'<div id="'+tipId+'" style="display:none;position:absolute;background:#fff;color:#0F172A;font-size:.74rem;font-weight:400;padding:8px 12px;border-radius:8px;pointer-events:none;z-index:10;top:4px;left:0;border:1px solid #E2E8F0;box-shadow:0 6px 20px rgba(0,0,0,.13)"></div></div>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px;flex-wrap:wrap">'
      +series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+s.color+';display:inline-block"></span>'+s.label+'</span>';}).join('')
      +'</div>';
    return chartSvg+leg;
  }
  // Distribution History — Interim + Final DPS stacked bars (left axis,
  // gridlines) with a Dividend Yield trend line drawn on its own internal
  // scale and NO visible axis/gridlines/labels — exact yield values are
  // only shown via hover, keeping the two very different scales from
  // fighting for the same axis.
  function stackedBarsWithLine(labels,interimArr,finalArr,totalArr,yieldArr){
    var W=420,H=220,padX=16,padR=42,padYT=14,padYB=24,n=labels.length;
    var tipId=nextTipId();
    var rawMx=Math.max.apply(null,totalArr)||1;
    var scale=fiveTicks(0,rawMx);
    var mx=scale.max||1,barW=Math.min(22,(W-padX-padR)/n*0.20),gap=(W-padX-padR)/n;
    function bx(i){return (padX+i*gap+gap/2-barW/2).toFixed(1);}
    function bh(v){return Math.max(0,((v/mx)*(H-padYT-padYB)));}
    var rects='';
    labels.forEach(function(_,i){
      var y=H-padYB;
      var ih=bh(interimArr[i]||0), fh=bh(finalArr[i]||0);
      y-=ih; rects+='<rect x="'+bx(i)+'" y="'+y.toFixed(1)+'" width="'+barW+'" height="'+ih.toFixed(1)+'" fill="#0D47A1" rx="1"/>';
      y-=fh; rects+='<rect x="'+bx(i)+'" y="'+y.toFixed(1)+'" width="'+barW+'" height="'+fh.toFixed(1)+'" fill="#64B5F6" rx="1"/>';
    });
    var grid=scale.ticks.map(function(v){
      var yy=(H-padYB-(v/mx)*(H-padYT-padYB)).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(W-padR+4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="#9CA3AF">'+fmtChartNum(v)+'</text>';
    }).join('');
    function lx(i){ return padX+i*gap+gap/2; }
    var yMax=Math.max.apply(null,yieldArr.concat([0.0001]))*1.2;
    function ly(v){ return H-padYB-((v/yMax)*(H-padYT-padYB)); }
    var ld=yieldArr.map(function(v,i){return (i?'L':'M')+lx(i).toFixed(1)+','+ly(v).toFixed(1);}).join('');
    var ldots=yieldArr.map(function(v,i){return '<circle cx="'+lx(i).toFixed(1)+'" cy="'+ly(v).toFixed(1)+'" r="3" fill="#fff" stroke="#F59E0B" stroke-width="2"/>';}).join('');
    var xL=labels.map(function(l,i){return '<text x="'+(parseFloat(bx(i))+barW/2).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';}).join('');
    // Group hover overlay per FY — shows Interim/Final/Total DPS + Yield together
    var overlays=labels.map(function(l,i){
      var tipLines=[
        '#0D47A1::Interim DPS: '+fmtTipNum(interimArr[i]),
        '#64B5F6::Final DPS: '+fmtTipNum(finalArr[i]),
        '#0F172A::Total DPS: '+fmtTipNum(totalArr[i]),
        '#F59E0B::Dividend Yield: '+fmtTipPct(yieldArr[i])
      ];
      var tip='FY:'+l+'|'+tipLines.join('|');
      var ox=(padX+i*gap).toFixed(1);
      var cx=((padX+i*gap+gap/2)/W).toFixed(4);
      return '<rect x="'+ox+'" y="0" width="'+gap.toFixed(1)+'" height="'+H+'" fill="transparent" data-cx="'+cx+'" data-tip="'+tip+'" onmouseenter="frTip(event,getTip(this),this.getAttribute(\'data-cx\'),\''+tipId+'\')" onmouseleave="frHide(\''+tipId+'\')" style="cursor:crosshair"/>';
    }).join('');
    var chartSvg='<div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+rects+'<path d="'+ld+'" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linejoin="round"/>'+ldots+xL+overlays+'</svg>'
      +'<div id="'+tipId+'" style="display:none;position:absolute;background:#fff;color:#0F172A;font-size:.74rem;font-weight:400;padding:8px 12px;border-radius:8px;pointer-events:none;z-index:10;top:4px;left:0;border:1px solid #E2E8F0;box-shadow:0 6px 20px rgba(0,0,0,.13)"></div></div>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px;flex-wrap:wrap">'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:#0D47A1;display:inline-block"></span>Interim DPS</span>'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:#64B5F6;display:inline-block"></span>Final DPS</span>'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:#F59E0B;display:inline-block;border-radius:1px"></span>Dividend Yield</span>'
      +'</div>';
    return chartSvg+leg;
  }

  // Distribution Payout Ratio donut — visually the same as donut(), but
  // every slice shares ONE hover tooltip (Total DPS / EPS / Payout Ratio)
  // instead of a different tooltip per slice, since the 3 segments here
  // are components of a single ratio rather than independent categories.
  function payoutDonut(segs,label,caption,groupTip,legendData){
    var s=270,cx=s/2,cy=s/2,R=s*0.42,ir=s*0.35;
    var total=segs.reduce(function(a,x){return a+x.v;},0)||1;
    var ang=-Math.PI/2,paths='';
    segs.forEach(function(sg){
      var sweep=(sg.v/total)*2*Math.PI,ea=ang+sweep;
      var x1=(cx+R*Math.cos(ang)).toFixed(2),y1=(cy+R*Math.sin(ang)).toFixed(2);
      var x2=(cx+R*Math.cos(ea)).toFixed(2),y2=(cy+R*Math.sin(ea)).toFixed(2);
      var x3=(cx+ir*Math.cos(ea)).toFixed(2),y3=(cy+ir*Math.sin(ea)).toFixed(2);
      var x4=(cx+ir*Math.cos(ang)).toFixed(2),y4=(cy+ir*Math.sin(ang)).toFixed(2);
      var la=sweep>Math.PI?1:0;
      var d='M'+x1+' '+y1+' A'+R+' '+R+' 0 '+la+' 1 '+x2+' '+y2+' L'+x3+' '+y3+' A'+ir+' '+ir+' 0 '+la+' 0 '+x4+' '+y4+'Z';
      paths+='<path d="'+d+'" fill="'+sg.color+'" stroke="none" data-tip="'+groupTip+'" onmouseenter="showGroupPieTip(event,getTip(this))" onmousemove="showGroupPieTip(event,getTip(this))" onmouseout="hideGroupPieTip()" style="cursor:pointer"/>';
      ang=ea;
    });
    // legendData lets the textbox show different figures than the pie
    // slices themselves (e.g. the full Gross per Share, not the slice's
    // excl.-Interim remainder) — falls back to the slice values if omitted.
    var rows=legendData||segs;
    var legendRows=rows.map(function(sg){
      return '<div style="display:flex;align-items:center;gap:6px;font-size:.78rem;color:#374151">'
        +'<span style="width:8px;height:8px;border-radius:50%;background:'+sg.color+';flex-shrink:0;display:inline-block"></span>'
        +'<span style="flex:1">'+sg.label+'</span>'
        +'<span style="color:#0F172A;font-weight:400">'+fmtSen(sg.v)+' sen</span></div>';
    }).join('');
    var legend='<div style="display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-radius:8px;min-width:170px">'+legendRows+'</div>';
    return '<div style="display:flex;align-items:center;justify-content:flex-start;gap:20px;flex:1;padding:8px 0;min-height:0">'
      +'<svg viewBox="0 0 '+s+' '+s+'" style="width:'+s+'px;height:'+s+'px;max-width:90%;max-height:100%;flex-shrink:0">'
      +paths
      +'<circle cx="'+cx+'" cy="'+cy+'" r="'+(ir-3)+'" fill="#fff" style="pointer-events:none"/>'
      +'<text x="'+cx+'" y="'+(cy-6)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="19" font-weight="400" fill="#0F172A" style="pointer-events:none">'+label+'</text>'
      +'<text x="'+cx+'" y="'+(cy+16)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="13" fill="#6B7280" style="pointer-events:none">'+(caption||'total')+'</text>'
      +'</svg>'
      +'<div style="display:flex;flex-direction:column;min-width:0">'+legend+'</div>'
      +'</div>';
  }

  function card(title,chartHtml,subline,href){
    var titleRow = href
      ? '<div class="fov-ct" style="display:flex;justify-content:space-between;align-items:center"><span>'+title+'</span><a href="'+href+'" style="font-size:.78rem;font-weight:600;color:var(--blue);text-decoration:none;white-space:nowrap;flex-shrink:0;margin-left:10px">Details &rarr;</a></div>'
      : '<div class="fov-ct">'+title+'</div>';
    return '<div class="fov-cc">'+titleRow+(subline?'<div class="fov-csub">'+subline+'</div>':'')+'<div class="fov-ch">'+chartHtml+'</div></div>';
  }

  // ── KEY FACTS (full width, no outline) ────────────────────────────────
  var latestBS = BALANCE_SHEET.length ? BALANCE_SHEET[BALANCE_SHEET.length-1] : null;
  var fundSizeLbl = latestBS ? ('RM '+fmtChartNum(latestBS.totalEquity)) : '—';
  var navLbl = NTA_PRICE>0 ? ('RM '+NTA_PRICE.toFixed(4)) : '—';
  var inceptionLbl = INCEPTION_DATE
    ? formatDate(INCEPTION_DATE)
    : (BALANCE_SHEET.length ? formatDate(BALANCE_SHEET[0].startDate) : '—');
  var keyFacts='<div style="margin-bottom:28px"><div class="fov-section-label">Key Facts</div>'
    +'<div class="fov-kfgrid-full">'
    +kf('Fund Size (AUM)',fundSizeLbl)
    +kf('Net Asset Value',navLbl,'per unit')
    +kf('Inception Date',inceptionLbl)
    +kf('Fund Structure','Investment Holdings')
    +kf('Fund Manager','Mr. Ng Zhi Yao')
    +kf('Custodian','-')
    +kf('Benchmark','Effective Annual Rate 7%')
    +kf('Min. Investment','RM 10,000')
    +'</div></div>';

  // ── OWNERSHIP — top 3 shareholders + "The rest of shareholder" ────────
  var shSorted = SHAREHOLDERS.slice().sort(function(a,b){return (b.units||0)-(a.units||0);});
  var shTop3 = shSorted.slice(0,3);
  var shRest = shSorted.slice(3);
  var shRestUnits = shRest.reduce(function(s,r){return s+(r.units||0);},0);
  var shTotalUnits = shSorted.reduce(function(s,r){return s+(r.units||0);},0);
  var OWN_COL = ['#1565C0','#2E7D32','#E65100'];
  var ownershipSegs = shTop3.map(function(s,i){ return {v:s.units||0, color:OWN_COL[i], label:s.name}; });
  if(shRest.length) ownershipSegs.push({v:shRestUnits, color:'#9CA3AF', label:'The rest of shareholder', pinLast:true});
  function fmtUnits4dp(v){ return (v||0).toLocaleString('en-MY',{minimumFractionDigits:4,maximumFractionDigits:4}); }
  var ownershipChart = ownershipSegs.length
    ? donut(ownershipSegs, fmtUnits4dp(shTotalUnits), 'units', fmtUnits4dp)
    : '<div style="padding:20px;color:var(--fg-3);font-size:.85rem">No shareholder data on record</div>';

  // ── CAPITAL STRUCTURE — Total Assets by the 4 Balance Sheet categories ─
  var capStructChart = BALANCE_SHEET.length
    ? stackedBars(
        [
          {v:BALANCE_SHEET.map(function(r){return r.securities;}),          color:'#0D47A1', label:'Securities'},
          {v:BALANCE_SHEET.map(function(r){return r.otherInvestments;}),    color:'#1565C0', label:'Other Assets'},
          {v:BALANCE_SHEET.map(function(r){return r.dividendReceivables;}), color:'#42A5F5', label:'Receivables'},
          {v:BALANCE_SHEET.map(function(r){return r.cash;}),                color:'#90CAF9', label:'Cash'}
        ],
        BALANCE_SHEET.map(function(r){return r.fy;})
      )
    : '<div style="padding:20px;color:var(--fg-3);font-size:.85rem">'+(BALANCE_SHEET_ERROR?('Could not load — '+BALANCE_SHEET_ERROR):'No financial years defined yet')+'</div>';

  // ── BALANCE SHEET (this card only) — Total Assets vs Total Liabilities ─
  var balanceSheetChart = BALANCE_SHEET.length
    ? groupedBars(
        BALANCE_SHEET.map(function(r){return r.fy;}),
        [
          {v:BALANCE_SHEET.map(function(r){return r.totalAssets;}),      color:'#1565C0', label:'Total Assets'},
          {v:BALANCE_SHEET.map(function(r){return r.totalLiabilities;}), color:'#E65100', label:'Total Liabilities'}
        ]
      )
    : '<div style="padding:20px;color:var(--fg-3);font-size:.85rem">'+(BALANCE_SHEET_ERROR?('Could not load — '+BALANCE_SHEET_ERROR):'No financial years defined yet')+'</div>';

  // ── NTA PERFORMANCE — monthly OHLC candlestick from nta_daily ──────────
  var ntaPerfChart = NTA_MONTHLY.length
    ? candlestick(NTA_MONTHLY)
    : '<div style="padding:20px;color:var(--fg-3);font-size:.85rem">'+(NTA_MONTHLY_ERROR?('Could not load — '+NTA_MONTHLY_ERROR):'No NTA history on record')+'</div>';

  // ── Canonical FY list (every FY the fund has defined, regardless of
  // whether a distribution was paid) — so Distribution History always
  // shows 5 bars even for FYs with no distribution on record ─────────────
  var ALL_FY = RATIO_ANALYSIS.length ? RATIO_ANALYSIS.map(function(r){return r.fy;})
    : (INCOME_STATEMENT.length ? INCOME_STATEMENT.map(function(r){return r.fy;}) : DIST_BY_FY.map(function(r){return r.fy;}));
  var DIST_BY_FY_MAP = {}; DIST_BY_FY.forEach(function(r){ DIST_BY_FY_MAP[r.fy]=r; });
  var INCOME_BY_FY = {}; INCOME_STATEMENT.forEach(function(r){ INCOME_BY_FY[r.fy]=r; });

  // ── DISTRIBUTION PAYOUT RATIO — center number is Interim DPS ÷ previous
  // FY's GPS (the full figure, not net of Interim DPS). The donut breaks
  // down into 2 segments: last FY's Interim DPS (light blue), and previous
  // FY's GPS (Gross Income per share) less that Interim DPS (grey) — but
  // the textbox shows the full GPS figure, not the excl.-Interim remainder.
  // One shared multi-line hover tooltip covers the whole chart: FYxxxx
  // header, then Interim DPS and GPS each on their own line. ─────────────
  function fmtSen(v){ return (v||0).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  var payoutLastFy = ALL_FY.length ? ALL_FY[ALL_FY.length-1] : null;
  var payoutPrevFy = ALL_FY.length>1 ? ALL_FY[ALL_FY.length-2] : null;
  var distSummaryChart;
  if(payoutLastFy && payoutPrevFy){
    var lastDist = DIST_BY_FY_MAP[payoutLastFy] || {interimDps:0,finalDps:0,totalDps:0};
    var prevIS   = INCOME_BY_FY[payoutPrevFy];
    var prevGps  = (prevIS && prevIS.outstandingShares>0) ? (prevIS.grossIncome/prevIS.outstandingShares*100) : null;
    if(prevGps!=null){
      var interimVal  = lastDist.interimDps||0;
      var payoutRatio = prevGps ? (interimVal/prevGps*100) : null;
      var gpsExclInterim = Math.max(0, prevGps-interimVal);
      var distSegs=[
        {v:interimVal,     color:'#64B5F6', label:'Interim DPS'},
        {v:gpsExclInterim, color:'#9CA3AF', label:'GPS excl. Interim DPS'}
      ];
      var distLegendData=[
        {v:interimVal, color:'#64B5F6', label:'Interim DPS'},
        {v:prevGps,    color:'#9CA3AF', label:'Gross per Share'}
      ];
      var groupTip=payoutLastFy+'|Interim DPS: '+fmtSen(interimVal)+' sen|GPS: '+fmtSen(prevGps)+' sen';
      distSummaryChart = payoutDonut(distSegs, (payoutRatio!=null?payoutRatio.toFixed(1):'—')+'%', 'Payout Ratio', groupTip, distLegendData);
    } else {
      distSummaryChart = '<div style="padding:20px;color:var(--fg-3);font-size:.85rem">No Gross Income data on record</div>';
    }
  } else {
    distSummaryChart = '<div style="padding:20px;color:var(--fg-3);font-size:.85rem">'+(DIST_BY_FY_ERROR?('Could not load — '+DIST_BY_FY_ERROR):'No distribution history on record')+'</div>';
  }

  // ── DISTRIBUTION HISTORY — past 5 FY, always shown even where a given
  // FY had no distribution (defaults to 0) — Interim + Final DPS (stacked,
  // dark/light blue) with Dividend Yield trend line (axis-less; values
  // shown on hover) ───────────────────────────────────────────────────────
  var last5Fy = ALL_FY.slice(-5);
  var distHistChart;
  if(last5Fy.length){
    var ratioByFy={}; RATIO_ANALYSIS.forEach(function(r){ ratioByFy[r.fy]=r; });
    var dhInterim=[], dhFinal=[], dhTotal=[], dhYield=[];
    last5Fy.forEach(function(fy){
      var d=DIST_BY_FY_MAP[fy]||{interimDps:0,finalDps:0,totalDps:0};
      dhInterim.push(d.interimDps||0);
      dhFinal.push(d.finalDps||0);
      dhTotal.push(d.totalDps||0);
      var ra=ratioByFy[fy];
      dhYield.push((ra&&ra.dividendYield!=null)?ra.dividendYield:0);
    });
    distHistChart = stackedBarsWithLine(last5Fy, dhInterim, dhFinal, dhTotal, dhYield);
  } else {
    distHistChart = '<div style="padding:20px;color:var(--fg-3);font-size:.85rem">'+(DIST_BY_FY_ERROR?('Could not load — '+DIST_BY_FY_ERROR):'No distribution history on record')+'</div>';
  }

  // ── CASH RESERVE RATIO — from Financial Result's Ratio Analysis (live),
  // single solid color per the simplified bar style ──────────────────────
  var cashReserveChart = RATIO_ANALYSIS.length
    ? bars(
        RATIO_ANALYSIS.map(function(r){return r.cashReserveRatio||0;}),
        RATIO_ANALYSIS.map(function(r){return r.fy;}),
        RATIO_ANALYSIS.map(function(){return '#1565C0';}),
        [{c:'#1565C0',l:'Cash Reserve (%)'}],
        false,
        true
      )
    : '<div style="padding:20px;color:var(--fg-3);font-size:.85rem">'+(RATIO_ANALYSIS_ERROR?('Could not load — '+RATIO_ANALYSIS_ERROR):'No financial years defined yet')+'</div>';

  // ── ABOUT — goes into first 2-col row (left only) ─────────────────────
  var aboutCard='<div class="fov-cc"><div class="fov-ct">About</div><div class="fov-csub">Fund mandate &amp; investment strategy</div><div style="padding-top:4px"><p class="fov-about">ZY-Invest is a private investment fund targeting long-term capital appreciation through a concentrated portfolio of Malaysian equity securities. The fund focuses on large-cap blue-chip stocks, selective growth equities and defensive consumer names on Bursa Malaysia, with flexibility on position sizing not typical of conventional unit trusts.</p></div></div>';
  var aboutBlank='<div></div>';

  // ── 2-COL CHART GRID ──────────────────────────────────────────────────
  var grid='<div class="fov-2col">'
    +aboutCard+aboutBlank
    +card('Ownership',ownershipChart,'Top 3 shareholders by units held','shareholders.html')
    +card('Capital Structure',capStructChart,'Total assets by category, per financial year','factsheet.html')
    +card('Financial Results', INCOME_STATEMENT.length
      ? groupedBars(
          INCOME_STATEMENT.map(function(r){return r.fy;}),
          [
            {v:INCOME_STATEMENT.map(function(r){return r.revenue;}),   color:'#1565C0', label:'Revenue'},
            {v:INCOME_STATEMENT.map(function(r){return r.netIncome;}), color:'#2E7D32', label:'NPAT', colorByValue:true}
          ]
        )
      : '<div style="padding:20px;color:var(--fg-3);font-size:.85rem">'+(INCOME_STATEMENT_ERROR?('Could not load — '+INCOME_STATEMENT_ERROR):'No financial years defined yet')+'</div>',
      'Revenue vs. Net Profit After Tax, per financial year',
      'financial-results.html?tab=income'
    )
    +card('NTA Performance',ntaPerfChart,'Monthly NTA per unit (open/high/low/close)','nta-history.html')
    +card('Distribution Payout Ratio',distSummaryChart,'Interim DPS ÷ previous FY gross per share','financial-results.html?tab=ratios')
    +card('Distribution History',distHistChart,'Interim &amp; final DPS with dividend yield trend, per financial year','financial-results.html?tab=ratios')
    +card('Balance Sheet',balanceSheetChart,'Total assets vs. total liabilities, per financial year','financial-results.html?tab=balance')
    +card('Cash Reserve Ratio',cashReserveChart,'Cash as a % of total assets, per financial year','financial-results.html?tab=balance')
    +'</div>';


  var grid2=grid+'</div>';
  return '<div style="background:#fff;margin:-26px -28px -48px;padding:26px 28px 48px;min-height:100%">'
    +'<div class="ph-xl"><h1>Fund <span class="acc">Overview</span></h1><p>ZY-Invest Private Investment Fund · Key facts, mandate &amp; structure.</p></div>'
    +keyFacts+grid2
    +'</div>';
}

// ── FACTSHEET ─────────────────────────────────────────────────────────────
// ── FACTSHEET ───────────────────────────────────────────────────────────
var FS_HOLD_PALETTE=['#1565C0','#2E7D32','#E65100','#7C3AED','#0891B2','#B45309','#DB2777','#059669','#9333EA','#0D9488'];
var FS_OTHER_PALETTE=['#0891B2','#DB2777','#059669','#9333EA','#B45309','#0D9488','#E11D48','#4F46E5','#65A30D','#EA580C'];
function switchFsFy(fy){
  window._fsFy=fy;
  var el=document.getElementById('mainContent');
  if(el) el.innerHTML=pgFactsheet();
}
function switchFsMode(mode){
  window._fsMode=mode;
  var el=document.getElementById('mainContent');
  if(el) el.innerHTML=pgFactsheet();
}
// Ranks whichever field ('sector' or 'product') into a top-6 + "Others"
// group, and assigns colors: the chart's active grouping always gets the
// rank-based dark-blue → grey gradient (pieGradientColor, same one used
// by the app's donuts); this is reused as-is for the matching table
// column's color boxes so they visually match the chart exactly.
function fsGroupAndColor(fyList, holdingsByFy, field){
  var byFy = fyList.map(function(fy){
    var bucket=holdingsByFy.filter(function(f){return f.fy===fy;})[0];
    var holdings=bucket?bucket.holdings:[];
    var map={};
    holdings.forEach(function(h){ var k=h[field]||'Other'; map[k]=(map[k]||0)+h.pct; });
    return map;
  });
  var overallTotals={};
  byFy.forEach(function(m){ Object.keys(m).forEach(function(k){ overallTotals[k]=(overallTotals[k]||0)+m[k]; }); });
  var ranked=Object.keys(overallTotals).sort(function(a,b){return overallTotals[b]-overallTotals[a];});
  var TOP_N=6;
  var mainKeys=ranked.slice(0,TOP_N);
  var hasOthers=ranked.length>TOP_N;
  var segOrder=mainKeys.concat(hasOthers?['Others']:[]);
  var colorFor={};
  segOrder.forEach(function(k,idx){ colorFor[k]=pieGradientColor(idx,segOrder.length); });
  var valsByFy=byFy.map(function(m){
    var vals={}; segOrder.forEach(function(k){vals[k]=0;});
    Object.keys(m).forEach(function(k){
      var key=mainKeys.indexOf(k)>=0?k:'Others';
      vals[key]=(vals[key]||0)+m[k];
    });
    return vals;
  });
  return {segOrder:segOrder, colorFor:colorFor, mainKeys:mainKeys, valsByFy:valsByFy};
}
// A simple rotating, non-blue palette for whichever field ISN'T the
// active chart grouping — so its table color boxes are still visually
// distinct without competing with the chart's blue-family gradient.
function fsOtherColorMap(fyList, holdingsByFy, field){
  var seen=[], colorFor={};
  fyList.forEach(function(fy){
    var bucket=holdingsByFy.filter(function(f){return f.fy===fy;})[0];
    var holdings=bucket?bucket.holdings:[];
    holdings.forEach(function(h){ var k=h[field]||'Other'; if(seen.indexOf(k)<0) seen.push(k); });
  });
  seen.forEach(function(k,idx){ colorFor[k]=FS_OTHER_PALETTE[idx%FS_OTHER_PALETTE.length]; });
  return colorFor;
}
// Stacked column chart — one bar per FY; segments follow whichever
// grouping (sector or product) is currently selected via the top-right
// tab. No legend — clicking a bar (or its FY label) switches the
// Holdings table below to that FY, and the selected bar gets a dark
// outline plus a bold FY label. Smooth, moderately-tinted ribbons connect
// each segment across consecutive FYs, like a stream graph.
function buildHoldingsStackChart(fyList, groupData, selectedFy){
  var n=fyList.length;
  if(!n) return '<div style="padding:50px 20px;color:var(--fg-3);font-size:.85rem;text-align:center">No holdings data on record</div>';
  var segOrder=groupData.segOrder, colorFor=groupData.colorFor, valsByFy=groupData.valsByFy;
  var W=800,H=380,padL=8,padR=44,padYT=14,padYB=28;
  var pctW=Math.min(100,(n/10*100)).toFixed(1)+'%';
  var gap=(W-padL-padR)/n;
  var barW=Math.min(64,gap*0.6);
  function bx(i){ return padL+i*gap+gap/2-barW/2; }
  var grid=[0,25,50,75,100].map(function(v){
    var yy=(H-padYB-(v/100)*(H-padYT-padYB)).toFixed(1);
    return '<line x1="'+padL+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F1F5F9" stroke-width="1"/>'
      +'<text x="'+(W-padR+5)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="9.5" fill="#000000">'+v+'%</text>';
  }).join('');

  var boundsByFy=valsByFy.map(function(vals){
    var y=H-padYB, b={};
    segOrder.forEach(function(s){
      var v=vals[s]||0;
      var hgt=(v/100)*(H-padYT-padYB);
      var yTop=y-hgt;
      b[s]={top:yTop,bot:y,v:v};
      y=yTop;
    });
    return b;
  });

  // Smooth ribbons linking each segment between consecutive FYs
  var ribbons='';
  for(var i=0;i<n-1;i++){
    var x1=bx(i)+barW, x2=bx(i+1);
    var midX=(x1+x2)/2;
    segOrder.forEach(function(s){
      var b1=boundsByFy[i][s], b2=boundsByFy[i+1][s];
      if(b1.v<=0.05 && b2.v<=0.05) return;
      var d='M'+x1.toFixed(1)+','+b1.top.toFixed(1)
        +' C'+midX.toFixed(1)+','+b1.top.toFixed(1)+' '+midX.toFixed(1)+','+b2.top.toFixed(1)+' '+x2.toFixed(1)+','+b2.top.toFixed(1)
        +' L'+x2.toFixed(1)+','+b2.bot.toFixed(1)
        +' C'+midX.toFixed(1)+','+b2.bot.toFixed(1)+' '+midX.toFixed(1)+','+b1.bot.toFixed(1)+' '+x1.toFixed(1)+','+b1.bot.toFixed(1)
        +' Z';
      ribbons+='<path d="'+d+'" fill="'+colorFor[s]+'" opacity="0.34" stroke="none"/>';
    });
  }

  var bars='', overlays='';
  fyList.forEach(function(fy,i){
    var b=boundsByFy[i];
    var isSel=(fy===selectedFy);
    var tipLines=[];
    segOrder.forEach(function(s){
      if(b[s].v<=0.05) return;
      bars+='<rect x="'+bx(i).toFixed(1)+'" y="'+b[s].top.toFixed(1)+'" width="'+barW.toFixed(1)+'" height="'+(b[s].bot-b[s].top).toFixed(1)+'" fill="'+colorFor[s]+'" stroke="'+(isSel?'#0F172A':'none')+'" stroke-width="'+(isSel?'1.4':'0')+'" onclick="switchFsFy(\''+fy+'\')" style="cursor:pointer"/>';
      tipLines.push(colorFor[s]+'::'+s+': '+b[s].v.toFixed(1)+'%');
    });
    var tip='FY:'+fy+'|'+(tipLines.length?tipLines.join('|'):'No holdings');
    var ox=(padL+i*gap).toFixed(1);
    var cx=((padL+i*gap+gap/2)/W).toFixed(4);
    overlays+='<rect x="'+ox+'" y="'+padYT+'" width="'+gap.toFixed(1)+'" height="'+(H-padYT-padYB)+'" fill="transparent" data-cx="'+cx+'" data-tip="'+tip+'" onmouseenter="frTip(event,getTip(this),this.getAttribute(\'data-cx\'))" onmouseleave="frHide()" onclick="switchFsFy(\''+fy+'\')" style="cursor:pointer"/>';
  });
  var xL=fyList.map(function(fy,i){
    var isSel=(fy===selectedFy);
    return '<text x="'+(bx(i)+barW/2).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" font-size="10.5" font-weight="'+(isSel?'700':'400')+'" fill="#000000" style="cursor:pointer" onclick="switchFsFy(\''+fy+'\')">'+fy+'</text>';
  }).join('');

  return '<div style="width:100%">'
    +'<div style="width:'+pctW+';min-width:'+W+'px;max-width:100%;margin-left:auto;position:relative;overflow:visible">'
    +'<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block">'+grid+ribbons+bars+overlays+xL+'</svg>'
    +'<div id="frTipEl" style="display:none;position:absolute;background:#fff;color:#0F172A;font-size:.74rem;font-weight:600;padding:8px 12px;border-radius:8px;pointer-events:none;z-index:10;top:4px;left:0;border:1px solid #E2E8F0;box-shadow:0 6px 20px rgba(0,0,0,.13);"></div>'
    +'</div></div>';
}

function pgFactsheet(){
  var fyOptions = HOLDINGS_BY_FY.map(function(f){ return f.fy; });
  var fySel = window._fsFy && fyOptions.indexOf(window._fsFy)>=0 ? window._fsFy : fyOptions[fyOptions.length-1];
  var mode = window._fsMode==='product' ? 'product' : 'sector';
  var bucket = HOLDINGS_BY_FY.filter(function(f){ return f.fy===fySel; })[0];
  var holdings = bucket ? bucket.holdings : [];

  function modeBtn(lbl,m){ return '<button class="'+(mode===m?'on':'')+'" onclick="switchFsMode(\''+m+'\')">'+lbl+'</button>'; }
  var modeTabs='<div class="seg">'+modeBtn('Sector','sector')+modeBtn('Product','product')+'</div>';

  // Active grouping (drives the chart) gets the blue-family gradient;
  // the other field gets a separate rotating palette for its table pills.
  var activeGroup = fsGroupAndColor(fyOptions, HOLDINGS_BY_FY, mode);
  var otherField = mode==='sector' ? 'product' : 'sector';
  var otherColorFor = fsOtherColorMap(fyOptions, HOLDINGS_BY_FY, otherField);

  // Soft pastel color pill — same style as the app's existing tag pills
  // (light tint background, the color itself for text), not a solid-fill
  // badge. Parses either the rgb(...) from pieGradientColor or the hex
  // values from the "other field" palette.
  function fsParseColor(color){
    var m=/rgb\((\d+),(\d+),(\d+)\)/.exec(color);
    if(m) return {r:+m[1],g:+m[2],b:+m[3]};
    var h=color.replace('#','');
    return {r:parseInt(h.substr(0,2),16),g:parseInt(h.substr(2,2),16),b:parseInt(h.substr(4,2),16)};
  }
  function colorPill(color,label){
    var c=fsParseColor(color);
    var bg='rgba('+c.r+','+c.g+','+c.b+',0.14)';
    return '<span style="display:inline-block;padding:3px 10px;border-radius:99px;background:'+bg+';color:'+color+';font-size:.85rem;font-weight:400;white-space:nowrap">'+label+'</span>';
  }

  var totalMV = holdings.reduce(function(s,h){ return s+(h.mv||0); },0);
  var hRows = holdings.length
    ? holdings.map(function(h){
        var sub = (h.code && h.ticker) ? (h.code+' | '+h.ticker) : (h.code||h.ticker||'—');
        var sectorColor = mode==='sector' ? (activeGroup.colorFor[activeGroup.mainKeys.indexOf(h.sector)>=0?h.sector:'Others']) : otherColorFor[h.sector];
        var productColor = mode==='product' ? (activeGroup.colorFor[activeGroup.mainKeys.indexOf(h.product)>=0?h.product:'Others']) : otherColorFor[h.product];
        return '<tr style="background:#fff">'
          +'<td style="padding:10px 16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:400;color:var(--fg-1)">'+h.name+'<div style="font-size:.78rem;color:var(--fg-3);font-weight:400">'+sub+'</div></td>'
          +'<td style="padding:10px 16px">'+colorPill(productColor,h.product)+'</td>'
          +'<td style="padding:10px 16px">'+colorPill(sectorColor,h.sector)+'</td>'
          +'<td style="padding:10px 16px;text-align:right;font-weight:400;color:var(--fg-1)">RM '+(h.mv||0).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
          +'<td style="padding:10px 16px;text-align:right;font-weight:400;color:var(--fg-1)">'+h.pct.toFixed(1)+'%</td>'
          +'</tr>';
      }).join('')
    : '<tr><td colspan="5" style="padding:30px 16px;text-align:center;color:var(--fg-3);font-size:.85rem;background:#fff">'+(HOLDINGS_BY_FY_ERROR?('Could not load — '+HOLDINGS_BY_FY_ERROR):'No holdings on record for this financial year')+'</td></tr>';

  var totalRow = holdings.length
    ? '<tr style="border-top:2px solid var(--border-strong,var(--border));background:#fff">'
      +'<td style="padding:10px 16px;font-weight:400;color:var(--fg-1)">Total</td>'
      +'<td style="padding:10px 16px"></td>'
      +'<td style="padding:10px 16px"></td>'
      +'<td style="padding:10px 16px;text-align:right;font-weight:400;color:var(--fg-1)">RM '+totalMV.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
      +'<td style="padding:10px 16px;text-align:right;font-weight:400;color:var(--fg-1)">100.0%</td>'
      +'</tr>'
    : '';

  var colgroup='<colgroup><col style="width:34%"><col style="width:18%"><col style="width:18%"><col style="width:15%"><col style="width:15%"></colgroup>';

  return '<div style="background:#fff;margin:-26px -28px -48px;padding:26px 28px 48px;min-height:100%">'
    +'<div class="ph-xl"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px"><h1 style="margin:0">Fund <span class="acc">Factsheet</span></h1>'+modeTabs+'</div></div>'
    // Stacked column chart — click a bar to switch the table below
    +'<div style="margin-bottom:24px">'+buildHoldingsStackChart(fyOptions, activeGroup, fySel)+'</div>'
    // Holdings table — no title/subline, no card outline, fixed column
    // widths, only the header divider line, all rows white, Total pinned last
    +'<table style="width:100%;table-layout:fixed;border-collapse:collapse">'+colgroup
    +'<thead><tr style="border-bottom:1px solid var(--border)">'
    +'<th style="padding:10px 16px;text-align:left;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3)">Instrument</th>'
    +'<th style="padding:10px 16px;text-align:left;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3)">Product</th>'
    +'<th style="padding:10px 16px;text-align:left;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3)">Sector</th>'
    +'<th style="padding:10px 16px;text-align:right;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3)">Value</th>'
    +'<th style="padding:10px 16px;text-align:right;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3)">Weight</th>'
    +'</tr></thead>'
    +'<tbody>'+hRows+totalRow+'</tbody></table>'
    +'</div>';
}


// ── SHAREHOLDERS ──────────────────────────────────────────────────────────
function pgShareholders(){
  var fyOptions = SHAREHOLDERS_BY_FY.map(function(f){ return f.fy; });
  var fySel = window._shFy && fyOptions.indexOf(window._shFy)>=0 ? window._shFy : fyOptions[fyOptions.length-1];
  var fyBucket = SHAREHOLDERS_BY_FY.filter(function(f){ return f.fy===fySel; })[0];
  var rawList = fyBucket ? fyBucket.list : [];
  var totalUnits = rawList.reduce(function(a,s){return a+(parseFloat(s.units_held)||0);},0) || 1;
  var shareholders = rawList.map(function(s){
    return {
      initials: mpInitials(s.full_name),
      name: s.full_name || 'Unknown',
      position: s.account_type==='director' ? 'Director' : 'Shareholder',
      since: formatDate(s.joined_date),
      units: parseFloat(s.units_held) || 0,
      pct: ((parseFloat(s.units_held)||0) / totalUnits * 100)
    };
  });
  var maxPct = shareholders.length ? Math.max.apply(null, shareholders.map(function(s){return s.pct;})) : 1;

  function fyTabBtn(fy){
    return '<button class="'+(fySel===fy?'on':'')+'" onclick="switchShareholderFy(\''+fy+'\')">'+fy+'</button>';
  }
  var fyTabs = fyOptions.length ? '<div class="seg">'+fyOptions.map(fyTabBtn).join('')+'</div>' : '';

  // Avatar colour pool (teal/green gradient shades matching image)
  var avBg=['#2E7D7C','#3A7D6B','#2E6B7C','#3A6B5A','#2E7D7C','#2E6B7C','#2E7D7C','#3D5A80'];

  // Position / Holding Since / Units share one fixed, equal, centered width.
  var eqCol='width:14%;text-align:center;';
  // Units column keeps its own right-alignment with a visual indent from
  // the cell's right edge — numeric, #,##0.0000.
  function fmtUnits4dp(v){ return (v||0).toLocaleString('en-MY',{minimumFractionDigits:4,maximumFractionDigits:4}); }

  var rows=shareholders.map(function(s,i){
    var barW=(s.pct/maxPct*100).toFixed(1);
    var isDir=s.position==='Director';
    return '<tr style="border-bottom:1px solid var(--border);'+(isDir?'background:#F0F7FF':'')+'">'
      +'<td style="padding:14px 16px;color:var(--fg-3);font-size:.88rem;">'+(i+1)+'</td>'
      +'<td style="padding:14px 16px;">'
        +'<div style="width:36px;height:36px;border-radius:50%;background:'+avBg[i%avBg.length]+';color:#fff;font-size:.72rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+s.initials+'</div>'
      +'</td>'
      +'<td style="padding:14px 8px;font-weight:400;color:var(--fg-1);font-size:.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+s.name+'</td>'
      +'<td style="padding:14px 16px;'+eqCol+'color:var(--fg-2);font-size:.88rem;">'+s.position+'</td>'
      +'<td style="padding:14px 16px;'+eqCol+'color:var(--fg-2);font-size:.88rem;">'+s.since+'</td>'
      +'<td style="padding:14px 32px 14px 16px;text-align:right;font-size:.88rem;font-weight:400;font-variant-numeric:tabular-nums;">'+fmtUnits4dp(s.units)+'</td>'
      +'<td style="padding:14px 16px;">'
        +'<div style="display:flex;align-items:center;gap:10px;">'
          +'<div style="flex:1;height:5px;background:var(--gray-100);border-radius:99px;overflow:hidden;">'
            +'<div style="width:'+barW+'%;height:100%;background:var(--blue);border-radius:99px;"></div>'
          +'</div>'
          +'<span style="font-size:.84rem;font-weight:400;color:var(--fg-1);min-width:44px;text-align:right;">'+s.pct.toFixed(2)+'%</span>'
        +'</div>'
      +'</td>'
      +'</tr>';
  }).join('');

  // Total row — always pinned as the very last row of the table, and
  // always rendered (even at 0) so every FY tab shows the same structure.
  var totalRow = '<tr style="border-top:2px solid var(--border-strong,var(--border));background:var(--gray-50)">'
      +'<td style="padding:14px 16px;"></td>'
      +'<td style="padding:14px 16px;"></td>'
      +'<td style="padding:14px 8px;font-weight:700;color:var(--fg-1);font-size:.88rem;">Total</td>'
      +'<td style="padding:14px 16px;'+eqCol+'"></td>'
      +'<td style="padding:14px 16px;'+eqCol+'"></td>'
      +'<td style="padding:14px 32px 14px 16px;text-align:right;font-size:.88rem;font-weight:700;color:var(--fg-1);font-variant-numeric:tabular-nums;">'+fmtUnits4dp(shareholders.length?totalUnits:0)+'</td>'
      +'<td style="padding:14px 16px;font-size:.84rem;font-weight:700;color:var(--fg-1);">'+(shareholders.length?'100.00%':'—')+'</td>'
      +'</tr>';

  var emptyRow = '<tr><td colspan="7" style="padding:40px 16px;text-align:center;color:var(--fg-3);font-size:.85rem">'+(SHAREHOLDERS_BY_FY_ERROR?('Could not load — '+SHAREHOLDERS_BY_FY_ERROR):'No shareholders on record for this financial year')+'</td></tr>';

  var colgroup='<colgroup>'
    +'<col style="width:5%">'
    +'<col style="width:6%">'
    +'<col style="width:23%">'
    +'<col style="width:14%">'
    +'<col style="width:14%">'
    +'<col style="width:19%">'
    +'<col style="width:19%">'
    +'</colgroup>';

  // Table is ALWAYS rendered with the same colgroup — even a financial
  // year with zero shareholders keeps the exact same fixed column widths
  // (an empty state that swaps out the whole <table> for a plain <div>
  // was what made the very first FY look narrower/different).
  return '<div style="background:#fff;margin:-26px -28px -48px;padding:26px 28px 48px;min-height:100%"><div class="ph-xl"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px"><h1 style="margin:0">Shareholder <span class="acc">List</span></h1>'+fyTabs+'</div></div>'
    // 2 blank lines of breathing room before the table
    +'<div aria-hidden="true" style="line-height:24px">&nbsp;<br>&nbsp;</div>'
    +'<table style="width:100%;table-layout:fixed;border-collapse:collapse;">'+colgroup
    +'<thead><tr style="border-bottom:1px solid var(--border);">'
    +'<th style="padding:10px 16px;text-align:left;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3);">#</th>'
    +'<th style="padding:10px 16px;"></th>'
    +'<th style="padding:10px 8px;text-align:left;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3);">Name</th>'
    +'<th style="padding:10px 16px;'+eqCol+'font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3);">Position</th>'
    +'<th style="padding:10px 16px;'+eqCol+'font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3);">Holding Since</th>'
    +'<th style="padding:10px 32px 10px 16px;text-align:right;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3);">Units</th>'
    +'<th style="padding:10px 16px;text-align:left;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3);">Ownership %</th>'
    +'</tr></thead>'
    +'<tbody>'+(shareholders.length?rows:emptyRow)+totalRow+'</tbody>'
    +'</table>'
    +'</div>';
}
function switchShareholderFy(fy){
  window._shFy=fy;
  var el=document.getElementById('mainContent');
  if(el) el.innerHTML=pgShareholders();
}

// ── NAVIGATION ───────────────────────────────────────────────────────────────
function navigate(pg) {
  S.page=pg;
  try{localStorage.setItem('zy-page',pg);}catch(e){}
  window.location.hash=pg==='dashboard'?'':pg;
  document.querySelectorAll('.sb-item[data-page]').forEach(function(el){el.classList.toggle('active',el.dataset.page===pg);});;
  renderMain(false);
}

function switchPeriod(p){S.period=p;renderMain(true);setTimeout(function(){initChart(p);},60);}
function filterTx(t){S.txf=t;renderMain(true);}

// ── NTA HISTORY ──────────────────────────────────────────────────────────────
// ── NTA History: shared hover state + info-line renderers ──────────────
function nthDateLabel(dateStr){
  var dt=new Date(dateStr+'T00:00:00');
  return dt.toLocaleDateString('en-MY',{day:'numeric',month:'short',year:'numeric'});
}
function fmtNtaOhlc(v){ return (v||0).toFixed(4); }
function nthPriceInfoHtml(dateStr,price,chg,chgPct){
  var up=chg>=0, col=up?'#2E7D32':'#DC2626', sign=up?'+':'−';
  return '<div style="font-size:.78rem;color:#000;margin-bottom:4px">'+nthDateLabel(dateStr)+'</div>'
    +'<div style="font-size:.8rem;font-weight:400;white-space:nowrap">'
    +'<span style="color:#000">RM '+price.toFixed(4)+'</span> '
    +'<span style="color:'+col+'">'+sign+Math.abs(chg).toFixed(4)+' ('+sign+Math.abs(chgPct).toFixed(2)+'%)</span>'
    +'</div>';
}
function nthCandleInfoHtml(dateLbl,o,h,l,c,chg,chgPct){
  var up=chg>=0, col=up?'#2E7D32':'#DC2626', sign=up?'+':'−';
  return '<div style="font-size:.78rem;color:#000;margin-bottom:4px">'+dateLbl+'</div>'
    +'<div style="font-size:.8rem;font-weight:400;white-space:nowrap">'
    +'<span style="color:#000">O</span><span style="color:'+col+'">'+fmtNtaOhlc(o)+'</span> '
    +'<span style="color:#000">H</span><span style="color:'+col+'">'+fmtNtaOhlc(h)+'</span> '
    +'<span style="color:#000">L</span><span style="color:'+col+'">'+fmtNtaOhlc(l)+'</span> '
    +'<span style="color:#000">C</span><span style="color:'+col+'">'+fmtNtaOhlc(c)+'</span> '
    +'<span style="color:'+col+'">'+sign+fmtNtaOhlc(Math.abs(chg))+' ('+sign+Math.abs(chgPct).toFixed(2)+'%)</span>'
    +'</div>';
}
function nthHoverAt(i){
  var rows=window._nthRows, px=window._nthPx;
  if(!rows||!rows[i]) return;
  var line=document.getElementById('nthHoverLine');
  if(line && px && px[i]!=null){
    var xp=px[i].toFixed(1);
    line.setAttribute('x1',xp); line.setAttribute('x2',xp);
    line.style.display='block';
  }
  var box=document.getElementById('nthInfoBox');
  if(!box) return;
  var cur=rows[i], prev=rows[i-1]||cur;
  if(window._nthGranMode==='daily'){
    var chg=cur.nta-prev.nta, chgPct=prev.nta?(chg/prev.nta*100):0;
    box.innerHTML=nthPriceInfoHtml(cur.date,cur.nta,chg,chgPct);
  } else {
    var chg2=cur.close-prev.close, chgPct2=prev.close?(chg2/prev.close*100):0;
    box.innerHTML=nthCandleInfoHtml(nthDateLabel(cur.date),cur.open,cur.high,cur.low,cur.close,chg2,chgPct2);
  }
}
function nthHoverReset(){
  var rows=window._nthRows;
  if(rows && rows.length) nthHoverAt(rows.length-1);
  var line=document.getElementById('nthHoverLine');
  if(line) line.style.display='none';
}

// ── NTA History: Daily line chart (single value per day, no OHLC range) ─
function buildNtaLineChart(rows){
  var n=rows.length;
  if(n<2) return '<div style="padding:50px 20px;color:var(--fg-3);font-size:.85rem;text-align:center">Not enough data for this period</div>';
  var W=1000,H=420,padL=8,padR=52,padYT=14,padYB=22;
  var vals=rows.map(function(r){return r.nta;});
  var scale=tightTicks(Math.min.apply(null,vals),Math.max.apply(null,vals));
  var mn=scale.min,mx=scale.max,rng=(mx-mn)||1;
  function px(i){ return padL+(i/(n-1))*(W-padL-padR); }
  function py(v){ return H-padYB-((v-mn)/rng)*(H-padYT-padYB); }
  var grid=scale.ticks.map(function(v){
    var yy=py(v).toFixed(1);
    return '<line x1="'+padL+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F1F5F9" stroke-width="1"/>'
      +'<text x="'+(W-padR+5)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="#000000">'+v.toFixed(4)+'</text>';
  }).join('');
  var spanDays=(new Date(rows[n-1].date+'T00:00:00')-new Date(rows[0].date+'T00:00:00'))/86400000;
  var shortSpan=spanDays<=100;
  var xTickCount=Math.min(6,n);
  var xLabels=[];
  for(var t=0;t<xTickCount;t++){
    var idx=Math.round(t*(n-1)/(xTickCount-1||1));
    var dt=new Date(rows[idx].date+'T00:00:00');
    var lbl=shortSpan?dt.toLocaleDateString('en-MY',{day:'numeric',month:'short'}):dt.toLocaleDateString('en-MY',{month:'short',year:'2-digit'});
    var anchor=(t===0)?'start':(t===xTickCount-1)?'end':'middle';
    xLabels.push('<text x="'+px(idx).toFixed(1)+'" y="'+(H-5)+'" text-anchor="'+anchor+'" font-size="8" fill="#000000">'+lbl+'</text>');
  }
  var d='',started=false;
  rows.forEach(function(r,i){ d+=(started?'L':'M')+px(i).toFixed(1)+','+py(r.nta).toFixed(1); started=true; });
  var path='<path d="'+d+'" fill="none" stroke="#1565C0" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>';
  var colW=(W-padL-padR)/Math.max(1,n-1);
  var overlays=rows.map(function(r,i){
    var ox=Math.max(padL,px(i)-colW/2);
    return '<rect x="'+ox.toFixed(1)+'" y="0" width="'+colW.toFixed(1)+'" height="'+H+'" fill="transparent" onmouseenter="nthHoverAt('+i+')" onmousemove="nthHoverAt('+i+')" onmouseleave="nthHoverReset()" style="cursor:crosshair"/>';
  }).join('');
  var hoverLine='<line id="nthHoverLine" x1="0" y1="'+padYT+'" x2="0" y2="'+(H-padYB)+'" stroke="#94A3B8" stroke-width="1" stroke-dasharray="3,3" style="display:none;pointer-events:none"/>';
  window._nthRows=rows;
  window._nthGranMode='daily';
  window._nthPx=rows.map(function(_,i){ return px(i); });
  var last=rows[n-1], prev=rows[n-2]||last;
  var chg=last.nta-prev.nta, chgPct=prev.nta?(chg/prev.nta*100):0;
  var defaultInfo=nthPriceInfoHtml(last.date,last.nta,chg,chgPct);
  return '<div style="position:relative;width:100%">'
    +'<div id="nthInfoBox" style="position:absolute;top:8px;left:8px;pointer-events:none">'+defaultInfo+'</div>'
    +'<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;height:420px;display:block;overflow:visible">'+grid+path+hoverLine+xLabels.join('')+overlays+'</svg>'
    +'</div>';
}

// ── NTA History: Weekly/Monthly candlestick chart ───────────────────────
function buildNtaCandleChart(rows){
  var n=rows.length;
  if(n<2) return '<div style="padding:50px 20px;color:var(--fg-3);font-size:.85rem;text-align:center">Not enough data for this period</div>';
  var W=1000,H=420,padL=8,padR=52,padYT=14,padYB=22;
  var allV=[]; rows.forEach(function(r){ allV.push(r.high,r.low); });
  var scale=tightTicks(Math.min.apply(null,allV),Math.max.apply(null,allV));
  var mn=scale.min,mx=scale.max,rng=(mx-mn)||1;
  var colW=(W-padL-padR)/n;
  function cx(i){ return padL+i*colW+colW/2; }
  function py(v){ return H-padYB-((v-mn)/rng)*(H-padYT-padYB); }
  var bw=Math.min(14,colW*0.55);
  var grid=scale.ticks.map(function(v){
    var yy=py(v).toFixed(1);
    return '<line x1="'+padL+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F1F5F9" stroke-width="1"/>'
      +'<text x="'+(W-padR+5)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="#000000">'+v.toFixed(4)+'</text>';
  }).join('');
  var candles=rows.map(function(r,i){
    var up=r.close>=r.open;
    var col=up?'#2E7D32':'#DC2626';
    var x=cx(i);
    var wick='<line x1="'+x.toFixed(1)+'" y1="'+py(r.high).toFixed(1)+'" x2="'+x.toFixed(1)+'" y2="'+py(r.low).toFixed(1)+'" stroke="'+col+'" stroke-width="1"/>';
    var top=Math.min(py(r.open),py(r.close)), bh=Math.max(1,Math.abs(py(r.open)-py(r.close)));
    var body='<rect x="'+(x-bw/2).toFixed(1)+'" y="'+top.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+bh.toFixed(1)+'" fill="'+col+'"/>';
    return wick+body;
  }).join('');
  var xTickCount=Math.min(6,n);
  var xLabels=[];
  for(var t=0;t<xTickCount;t++){
    var idx=Math.round(t*(n-1)/(xTickCount-1||1));
    var anchor=(t===0)?'start':(t===xTickCount-1)?'end':'middle';
    xLabels.push('<text x="'+cx(idx).toFixed(1)+'" y="'+(H-5)+'" text-anchor="'+anchor+'" font-size="8" fill="#000000">'+rows[idx].label+'</text>');
  }
  var overlays=rows.map(function(r,i){
    var ox=padL+i*colW;
    return '<rect x="'+ox.toFixed(1)+'" y="0" width="'+colW.toFixed(1)+'" height="'+H+'" fill="transparent" onmouseenter="nthHoverAt('+i+')" onmousemove="nthHoverAt('+i+')" onmouseleave="nthHoverReset()" style="cursor:crosshair"/>';
  }).join('');
  var hoverLine='<line id="nthHoverLine" x1="0" y1="'+padYT+'" x2="0" y2="'+(H-padYB)+'" stroke="#94A3B8" stroke-width="1" stroke-dasharray="3,3" style="display:none;pointer-events:none"/>';
  window._nthRows=rows;
  window._nthGranMode='candle';
  window._nthPx=rows.map(function(_,i){ return cx(i); });
  var last=rows[n-1], prev=rows[n-2]||last;
  var chg=last.close-prev.close, chgPct=prev.close?(chg/prev.close*100):0;
  var defaultInfo=nthCandleInfoHtml(nthDateLabel(last.date),last.open,last.high,last.low,last.close,chg,chgPct);
  return '<div style="position:relative;width:100%">'
    +'<div id="nthInfoBox" style="position:absolute;top:8px;left:8px;pointer-events:none">'+defaultInfo+'</div>'
    +'<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;height:420px;display:block;overflow:visible">'+grid+candles+hoverLine+xLabels.join('')+overlays+'</svg>'
    +'</div>';
}

// Maps the currently-selected period to the granularity that keeps candle
// counts in a readable range — used to auto-pick Data Layer when switching
// to Candle mode, since a period spanning years of daily candles would be
// an unreadable wall of bars.
function bestNtaGranForPeriod(period){
  switch(period){
    case '1m':
    case '3m':
      return 'daily';
    case '6m':
    case 'ytd':
    case '1y':
      return 'weekly';
    case '3y':
      return 'monthly';
    case 'all':
    default:
      return 'quarterly';
  }
}
function switchNtaChartType(t){
  window._nthChartType=t;
  if(t==='candle'){
    window._nthGran=bestNtaGranForPeriod(window._nthPeriod||'3y');
    window._nthPage=0;
  }
  var el=document.getElementById('mainContent');
  if(el) el.innerHTML=pgNtaHistory();
}
function switchNtaGran(g){
  window._nthGran=g;
  window._nthPage=0;
  var el=document.getElementById('mainContent');
  if(el) el.innerHTML=pgNtaHistory();
}
function switchNtaPeriod(p){
  window._nthPeriod=p;
  window._nthPage=0;
  if((window._nthChartType||'line')==='candle'){
    window._nthGran=bestNtaGranForPeriod(p);
  }
  var el=document.getElementById('mainContent');
  if(el) el.innerHTML=pgNtaHistory();
}
function switchNtaPage(p){
  window._nthPage=Math.max(0,p);
  var el=document.getElementById('mainContent');
  if(el) el.innerHTML=pgNtaHistory();
}

function pgNtaHistory(){
  var gran = window._nthGran || 'daily';
  var period = window._nthPeriod || '3y';
  var chartType = window._nthChartType || 'line';

  var chartTypeDropdown='<select onchange="switchNtaChartType(this.value)" style="font-size:.8rem;font-weight:600;color:var(--fg-1);border:1px solid var(--border);border-radius:8px;padding:7px 10px;background:#fff;cursor:pointer">'
    +['line','candle'].map(function(t){ return '<option value="'+t+'"'+(chartType===t?' selected':'')+'>'+(t==='line'?'Line':'Candle')+'</option>'; }).join('')
    +'</select>';

  var granOptions=['daily','weekly','monthly','quarterly'];
  var granDropdown='<select onchange="switchNtaGran(this.value)" style="font-size:.8rem;font-weight:600;color:var(--fg-1);border:1px solid var(--border);border-radius:8px;padding:7px 10px;background:#fff;cursor:pointer">'
    +granOptions.map(function(g){ return '<option value="'+g+'"'+(gran===g?' selected':'')+'>'+g.charAt(0).toUpperCase()+g.slice(1)+'</option>'; }).join('')
    +'</select>';

  function segBtn(lbl,p){ return '<button class="'+(period===p?'on':'')+'" onclick="switchNtaPeriod(\''+p+'\')">'+lbl+'</button>'; }
  var periodBar='<div class="seg">'+segBtn('YTD','ytd')+segBtn('1M','1m')+segBtn('3M','3m')+segBtn('6M','6m')+segBtn('1Y','1y')+segBtn('3Y','3y')+segBtn('ALL','all')+'</div>';

  var srcRows = gran==='daily' ? NTA_DAILY : gran==='weekly' ? NTA_WEEKLY_OHLC : gran==='monthly' ? NTA_MONTHLY : NTA_QUARTERLY_OHLC;
  var srcError = gran==='daily' ? NTA_DAILY_ERROR : gran==='weekly' ? NTA_WEEKLY_OHLC_ERROR : gran==='monthly' ? NTA_MONTHLY_ERROR : NTA_QUARTERLY_OHLC_ERROR;

  var chart, tableSection;
  if(srcRows.length){
    var latestDate=srcRows[srcRows.length-1].date;
    var cutoff=cmpCutoffDate(period, latestDate, null);
    var filtered=srcRows.filter(function(r){ return r.date>=cutoff; });
    if(filtered.length<2) filtered=srcRows;

    // Chart type (Line/Candle) is independent of the Data Layer granularity
    // now — Daily data has no intraday range, so "Candle" on Daily shows a
    // degenerate O=H=L=C candle for each day rather than being disallowed.
    if(chartType==='candle'){
      var candleRows = gran==='daily'
        ? filtered.map(function(r){ return {date:r.date, label:new Date(r.date+'T00:00:00').toLocaleDateString('en-MY',{day:'numeric',month:'short'}), open:r.nta, high:r.nta, low:r.nta, close:r.nta}; })
        : filtered;
      chart = buildNtaCandleChart(candleRows);
    } else {
      var lineRows = gran==='daily' ? filtered : filtered.map(function(r){ return {date:r.date, nta:r.close}; });
      chart = buildNtaLineChart(lineRows);
    }

    // Table — latest first, paginated 20 at a time
    var tableRows=filtered.slice().reverse();
    var pageSize=20;
    var totalPages=Math.max(1,Math.ceil(tableRows.length/pageSize));
    var pageIdx=Math.min(window._nthPage||0, totalPages-1);
    var pageRows=tableRows.slice(pageIdx*pageSize, pageIdx*pageSize+pageSize);

    // Change/Change% collapse to "–" in black when they round to
    // 0.0000/0.00% — a value like 0.00003 is technically nonzero but
    // reads as noise, not a meaningful move.
    function nthChgCell(chg){
      var rounded=parseFloat(chg.toFixed(4));
      if(rounded===0) return '<td style="padding:11px 16px;font-size:.85rem;font-weight:600;color:#000">-</td>';
      var up=chg>=0;
      return '<td style="padding:11px 16px;font-size:.85rem;font-weight:600;color:'+(up?'var(--green)':'var(--red)')+';">'+(up?'+':'')+chg.toFixed(4)+'</td>';
    }
    function nthChgPctCell(chgPct){
      var rounded=parseFloat(chgPct.toFixed(2));
      if(rounded===0) return '<td style="padding:11px 16px;font-size:.85rem;font-weight:600;color:#000">-</td>';
      var up=chgPct>=0;
      return '<td style="padding:11px 16px;font-size:.85rem;font-weight:600;color:'+(up?'var(--green)':'var(--red)')+';">'+(up?'+':'')+chgPct.toFixed(2)+'%</td>';
    }

    var bodyRows;
    if(gran==='daily'){
      bodyRows=pageRows.map(function(r){
        var idx=filtered.indexOf(r);
        var prev=filtered[idx-1];
        var chg=prev?(r.nta-prev.nta):0, chgPct=prev&&prev.nta?(chg/prev.nta*100):0;
        return '<tr style="border-bottom:1px solid var(--border);">'
          +'<td style="padding:11px 16px;font-size:.85rem;color:var(--fg-2);">'+nthDateLabel(r.date)+'</td>'
          +'<td style="padding:11px 16px;font-size:.88rem;font-weight:600;color:var(--fg-1);">RM '+r.nta.toFixed(4)+'</td>'
          +nthChgCell(chg)
          +nthChgPctCell(chgPct)
          +'</tr>';
      }).join('');
    } else {
      bodyRows=pageRows.map(function(r){
        var idx=filtered.indexOf(r);
        var prev=filtered[idx-1];
        var chg=prev?(r.close-prev.close):0, chgPct=prev&&prev.close?(chg/prev.close*100):0;
        return '<tr style="border-bottom:1px solid var(--border);">'
          +'<td style="padding:11px 16px;font-size:.85rem;color:var(--fg-2);">'+nthDateLabel(r.date)+'</td>'
          +'<td style="padding:11px 16px;font-size:.85rem;color:var(--fg-2);">RM '+r.open.toFixed(4)+'</td>'
          +'<td style="padding:11px 16px;font-size:.85rem;color:var(--fg-2);">RM '+r.high.toFixed(4)+'</td>'
          +'<td style="padding:11px 16px;font-size:.85rem;color:var(--fg-2);">RM '+r.low.toFixed(4)+'</td>'
          +'<td style="padding:11px 16px;font-size:.88rem;font-weight:600;color:var(--fg-1);">RM '+r.close.toFixed(4)+'</td>'
          +nthChgCell(chg)
          +nthChgPctCell(chgPct)
          +'</tr>';
      }).join('');
    }

    var headCells = gran==='daily'
      ? ['Date','NTA / Unit','Change','Change %']
      : ['Date','Open','High','Low','Close','Change','Change %'];
    var thead='<thead><tr style="border-bottom:1px solid var(--border);">'
      +headCells.map(function(h){ return '<th style="padding:10px 16px;text-align:left;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3);">'+h+'</th>'; }).join('')
      +'</tr></thead>';

    var rangeStart=pageIdx*pageSize+1, rangeEnd=Math.min(tableRows.length, rangeStart+pageSize-1);
    var pager='<div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px">'
      +'<span style="font-size:.8rem;color:var(--fg-3)">Showing '+rangeStart+'–'+rangeEnd+' of '+tableRows.length+'</span>'
      +'<div style="display:flex;gap:8px">'
      +'<button onclick="switchNtaPage('+(pageIdx-1)+')" '+(pageIdx<=0?'disabled':'')+' style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:#fff;font-size:.8rem;font-weight:600;color:'+(pageIdx<=0?'var(--fg-3)':'var(--fg-1)')+';cursor:'+(pageIdx<=0?'default':'pointer')+'">Previous</button>'
      +'<button onclick="switchNtaPage('+(pageIdx+1)+')" '+(pageIdx>=totalPages-1?'disabled':'')+' style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:#fff;font-size:.8rem;font-weight:600;color:'+(pageIdx>=totalPages-1?'var(--fg-3)':'var(--fg-1)')+';cursor:'+(pageIdx>=totalPages-1?'default':'pointer')+'">Next</button>'
      +'</div></div>';

    tableSection = '<table style="width:100%;border-collapse:collapse;">'+thead+'<tbody>'+bodyRows+'</tbody></table>'+pager;
  } else {
    chart='<div style="padding:50px 20px;color:var(--fg-3);font-size:.85rem;text-align:center">'+(srcError?('Could not load — '+srcError):'Loading NTA history…')+'</div>';
    tableSection='';
  }

  return '<div style="background:#fff;margin:-26px -28px -48px;padding:26px 28px 48px;min-height:100%">'
    +'<div class="ph-xl"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px"><h1 style="margin:0">NTA <span class="acc">History</span></h1>'
    +'<div style="display:flex;align-items:center;gap:10px">'+chartTypeDropdown+granDropdown+periodBar+'</div>'
    +'</div></div>'
    +chart
    // 2 lines of breathing room before the table
    +'<div aria-hidden="true" style="line-height:24px">&nbsp;<br>&nbsp;</div>'
    +'<div style="margin-bottom:4px"><h3 style="font-size:.95rem;font-weight:700;color:var(--fg-1);margin-bottom:12px">Historical Data</h3>'
    +tableSection
    +'</div></div>';
}


// ── COMPARISON ────────────────────────────────────────────────────────────────
function switchCmpPeriod(p){
  window._cmpPeriod=p;
  var el=document.getElementById('mainContent');
  if(el) el.innerHTML=pgComparison();
}

// Clicking a legend entry toggles that series' line on/off. State persists
// across period switches (survives re-render since it lives on window,
// not inside pgComparison's local scope).
function toggleCmpSeries(name){
  window._cmpHidden = window._cmpHidden || {};
  window._cmpHidden[name] = !window._cmpHidden[name];
  var el=document.getElementById('mainContent');
  if(el) el.innerHTML=pgComparison();
}

// Resolves a period key to a start-date cutoff (inclusive), anchored to the
// latest date in the loaded series. 'all' anchors to the fund's inception
// date instead, and never goes earlier than inception for any period.
function cmpCutoffDate(period, latestStr, inceptionStr){
  if(!latestStr) return inceptionStr || '0000-00-00';
  var latest=new Date(latestStr+'T00:00:00');
  var d=new Date(latest.getTime());
  switch(period){
    case 'ytd': d=new Date(latest.getFullYear(),0,1); break;
    case '1m': d.setMonth(d.getMonth()-1); break;
    case '3m': d.setMonth(d.getMonth()-3); break;
    case '6m': d.setMonth(d.getMonth()-6); break;
    case '1y': d.setFullYear(d.getFullYear()-1); break;
    case '3y': d.setFullYear(d.getFullYear()-3); break;
    case 'all':
    default:
      return inceptionStr || '0000-00-00';
  }
  var iso=d.toISOString().slice(0,10);
  if(inceptionStr && iso<inceptionStr) return inceptionStr;
  return iso;
}

// Comparison line chart — rebased-% series, right-side axis, no letterboxing
// (preserveAspectRatio="none" so the plot area always fills the card's
// actual width instead of aspect-ratio-locked empty margins). priceInfo
// draws a small per-index Price/Change readout over the top-left of the
// plot, using each index's own native price scale (not the rebased %).
// Hovering anywhere on the chart updates that readout to the hovered date;
// moving away reverts to the latest date (same convention as the NTA
// Performance candlestick's info line).
function buildCmpChart(seriesArr, dates, priceInfo, hidden){
  hidden = hidden || {};
  var n=dates.length;
  if(n<2 || !seriesArr.length) return '<div style="padding:50px 20px;color:var(--fg-3);font-size:.85rem;text-align:center">Not enough data for this period</div>';
  var visible=seriesArr.filter(function(s){ return !hidden[s.name]; });
  var W=1000,H=520,padL=8,padR=40,padYT=14,padYB=22;
  var allV=[]; (visible.length?visible:seriesArr).forEach(function(s){ s.v.forEach(function(v){ if(v!=null) allV.push(v); }); });
  if(!allV.length) return '<div style="padding:50px 20px;color:var(--fg-3);font-size:.85rem;text-align:center">No data</div>';
  var scale=tightTicks(Math.min.apply(null,allV),Math.max.apply(null,allV));
  var mn=scale.min,mx=scale.max,rng=(mx-mn)||1;
  function px(i){ return padL+(i/(n-1))*(W-padL-padR); }
  function py(v){ return H-padYB-((v-mn)/rng)*(H-padYT-padYB); }
  var grid=scale.ticks.map(function(v){
    var yy=py(v).toFixed(1);
    return '<line x1="'+padL+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F1F5F9" stroke-width="1"/>'
      +'<text x="'+(W-padR+5)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="7.5" fill="#000000">'+v.toFixed(0)+'%</text>';
  }).join('');
  var baseline=(mn<=0 && mx>=0) ? ('<line x1="'+padL+'" y1="'+py(0).toFixed(1)+'" x2="'+(W-padR)+'" y2="'+py(0).toFixed(1)+'" stroke="#CBD5E1" stroke-width="0.8" stroke-dasharray="4,3"/>') : '';
  // Short windows (roughly ≤3 months of weekly data) show "d MMM" instead
  // of "MMM yy" — a bare month/year is too coarse to read when the whole
  // chart only spans a few weeks, and the year is implicit at that zoom.
  var spanDays=(new Date(dates[n-1]+'T00:00:00')-new Date(dates[0]+'T00:00:00'))/86400000;
  var shortSpan=spanDays<=100;
  var xTickCount=Math.min(6,n);
  var xLabels=[];
  for(var t=0;t<xTickCount;t++){
    var idx=Math.round(t*(n-1)/(xTickCount-1||1));
    var dt=new Date(dates[idx]+'T00:00:00');
    var lbl=shortSpan
      ? dt.toLocaleDateString('en-MY',{day:'numeric',month:'short'})
      : dt.toLocaleDateString('en-MY',{month:'short',year:'2-digit'});
    // First/last labels anchor to start/end instead of middle, so the text
    // grows inward from the edge rather than being centered on it (which
    // was clipping the first letter of the leftmost label, e.g. "Jan").
    var anchor=(t===0)?'start':(t===xTickCount-1)?'end':'middle';
    xLabels.push('<text x="'+px(idx).toFixed(1)+'" y="'+(H-5)+'" text-anchor="'+anchor+'" font-size="7.5" fill="#000000">'+lbl+'</text>');
  }
  var paths=visible.map(function(s){
    var d='',started=false;
    s.v.forEach(function(v,i){
      if(v==null) return;
      d+=(started?'L':'M')+px(i).toFixed(1)+','+py(v).toFixed(1);
      started=true;
    });
    return '<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/>';
  }).join('');
  // Hover overlay — one thin column per data point; hovering recomputes
  // each series' Price/Change "as of" that date via cmpHoverAt(i), and
  // moves the vertical dashed hover line to that x position.
  var colW=(W-padL-padR)/Math.max(1,n-1);
  var overlays=dates.map(function(d,i){
    var ox=Math.max(padL,px(i)-colW/2);
    return '<rect x="'+ox.toFixed(1)+'" y="0" width="'+colW.toFixed(1)+'" height="'+H+'" fill="transparent" onmouseenter="cmpHoverAt('+i+')" onmousemove="cmpHoverAt('+i+')" onmouseleave="cmpHoverReset()" style="cursor:crosshair"/>';
  }).join('');
  var hoverLine='<line id="cmpHoverLine" x1="0" y1="'+padYT+'" x2="0" y2="'+(H-padYB)+'" stroke="#94A3B8" stroke-width="1" stroke-dasharray="3,3" style="display:none;pointer-events:none"/>';
  // Expose raw (native-price) series + date axis + pixel positions for the
  // hover handler — a plain global assignment (not embedded HTML/script),
  // since script tags injected via innerHTML never execute. Full data
  // (not just visible) is exposed; cmpHoverAt filters by window._cmpHidden
  // live, so toggling a series doesn't require rebuilding these arrays.
  window._cmpRaw = seriesArr.map(function(s){ return {name:s.name, color:s.color, raw:s.raw}; });
  window._cmpPct = seriesArr.map(function(s){ return {name:s.name, v:s.v}; });
  window._cmpDates = dates.slice();
  window._cmpPx = dates.map(function(_,i){ return px(i); });
  var visiblePriceInfo = (priceInfo||[]).filter(function(o){ return !hidden[o.name]; });
  var priceBoxInner = visiblePriceInfo.length
    ? '<div style="font-size:.78rem;color:#000000;margin-bottom:4px">'+cmpDateLabel(dates[dates.length-1])+'</div>'
      + visiblePriceInfo.map(function(o){ return cmpPriceLineHtml(o.name,o.color,o.price,o.chg,o.chgPct); }).join('')
    : '';
  var priceBox = priceBoxInner
    ? '<div id="cmpOhlcBox" style="position:absolute;top:8px;left:8px;display:flex;flex-direction:column;gap:3px;pointer-events:none">'+priceBoxInner+'</div>'
    : '';
  return '<div style="position:relative;width:100%">'
    +priceBox
    +'<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;height:520px;display:block;overflow:visible">'+grid+baseline+paths+hoverLine+xLabels.join('')+overlays+'</svg>'
    +'</div>';
}

function cmpDateLabel(dateStr){
  var dt=new Date(dateStr+'T00:00:00');
  return dt.toLocaleDateString('en-MY',{day:'numeric',month:'short',year:'numeric'});
}
function fmtCmpOhlc(v,dp){ dp=dp||2; return (v||0).toLocaleString('en-MY',{minimumFractionDigits:dp,maximumFractionDigits:dp}); }
// Name keeps its series line color; Price/Change/Change% are colored
// green or red by direction (change is period-over-period — vs the
// previous data point — never vs the start of the whole window).
// ZY-Invest's own NTA is shown to 4dp (its natural per-unit precision);
// the external indices stay at 2dp.
function cmpPriceLineHtml(name,color,price,chg,chgPct){
  var dp=(name==='ZY-Invest')?4:2;
  var up=chg>=0, col=up?'#2E7D32':'#DC2626', sign=up?'+':'−';
  return '<div style="font-size:.8rem;font-weight:400;white-space:nowrap">'
    +'<span style="color:'+color+'">'+name+'</span> '
    +'<span style="color:'+col+'">'+fmtCmpOhlc(price,dp)+'</span> '
    +'<span style="color:'+col+'">'+sign+fmtCmpOhlc(Math.abs(chg),dp)+' ('+sign+Math.abs(chgPct).toFixed(2)+'%)</span>'
    +'</div>';
}
function cmpHoverAt(i){
  var raw=window._cmpRaw, dates=window._cmpDates;
  var box=document.getElementById('cmpOhlcBox');
  if(!raw || !dates || !dates[i] || !box) return;
  var hidden=window._cmpHidden||{};
  var html='<div style="font-size:.78rem;color:#000000;margin-bottom:4px">'+cmpDateLabel(dates[i])+'</div>';
  raw.forEach(function(s){
    if(hidden[s.name]) return;
    // Walk backward from i to find the current point and the prior known
    // point, so "Change" is always period-over-period, never vs window start.
    var curIdx=-1;
    for(var a=i;a>=0;a--){ if(s.raw[a]!=null){ curIdx=a; break; } }
    if(curIdx<0) return;
    var price=s.raw[curIdx];
    var prevIdx=-1;
    for(var b=curIdx-1;b>=0;b--){ if(s.raw[b]!=null){ prevIdx=b; break; } }
    var prev=prevIdx>=0?s.raw[prevIdx]:price;
    var chg=price-prev, chgPct=prev?(chg/prev*100):0;
    html+=cmpPriceLineHtml(s.name,s.color,price,chg,chgPct);
  });
  box.innerHTML=html;
  // Move the vertical dashed hover line to this data point.
  var line=document.getElementById('cmpHoverLine');
  if(line && window._cmpPx && window._cmpPx[i]!=null){
    var xpos=window._cmpPx[i].toFixed(1);
    line.setAttribute('x1',xpos); line.setAttribute('x2',xpos);
    line.style.display='block';
  }
  // Legend accumulated return "as of" the hovered date (rebased % is
  // already 0% at the filtered window's start, so v[i] IS the cumulative
  // return from the start of the filtered range up to this date).
  var pct=window._cmpPct;
  if(pct){
    pct.forEach(function(s,si){
      var el=document.getElementById('cmpLegVal-'+si);
      if(!el) return;
      var vArr=s.v;
      var v=null;
      for(var k=i;k>=0;k--){ if(vArr[k]!=null){ v=vArr[k]; break; } }
      var up=v!=null&&v>=0;
      el.style.color=v==null?'var(--fg-3)':(up?'var(--green)':'var(--red)');
      el.textContent=v==null?'—':((up?'+':'')+v.toFixed(1)+'%');
    });
  }
}
function cmpHoverReset(){
  var dates=window._cmpDates;
  if(dates && dates.length) cmpHoverAt(dates.length-1);
  var line=document.getElementById('cmpHoverLine');
  if(line) line.style.display='none';
}

function pearsonCorr(a,b){
  var xs=[],ys=[];
  for(var i=0;i<a.length;i++){
    if(a[i]!=null && b[i]!=null){ xs.push(a[i]); ys.push(b[i]); }
  }
  var n=xs.length;
  if(n<2) return null;
  var mx=xs.reduce(function(s,v){return s+v;},0)/n;
  var my=ys.reduce(function(s,v){return s+v;},0)/n;
  var cov=0,vx=0,vy=0;
  for(var j=0;j<n;j++){ var dx=xs[j]-mx, dy=ys[j]-my; cov+=dx*dy; vx+=dx*dx; vy+=dy*dy; }
  var denom=Math.sqrt(vx*vy);
  return denom?cov/denom:null;
}
// Diverging heatmap: strong negative → red, 0 → near-white, strong positive → blue.
// Diverging heatmap: strong negative → deep red, 0 → white, strong
// positive → deep blue (dark blue = strong relation, white = neutral,
// red = strong inverse relation).
function corrColor(v){
  if(v==null) return '#F8FAFC';
  var t=Math.max(-1,Math.min(1,v));
  function lerp(a,b,f){ return Math.round(a+(b-a)*f); }
  if(t>=0){
    var blue=[21,101,192]; // var(--blue) #1565C0
    return 'rgb('+lerp(255,blue[0],t)+','+lerp(255,blue[1],t)+','+lerp(255,blue[2],t)+')';
  } else {
    var red=[220,38,38]; // var(--red) #DC2626
    var at=-t;
    return 'rgb('+lerp(255,red[0],at)+','+lerp(255,red[1],at)+','+lerp(255,red[2],at)+')';
  }
}
function buildCorrTable(retSeries){
  if(!retSeries.length) return '';
  var colCount=1+retSeries.length;
  var colWidth=(100/colCount).toFixed(2)+'%';
  var colgroup='<colgroup>'+Array(colCount).fill('<col style="width:'+colWidth+'">').join('')+'</colgroup>';
  var rows=retSeries.map(function(rowS){
    var cells=retSeries.map(function(colS){
      var v=(rowS.name===colS.name)?1:pearsonCorr(rowS.ret,colS.ret);
      var txt=v==null?'—':v.toFixed(2);
      var textCol=(v!=null && Math.abs(v)>0.55)?'#fff':'#1E293B';
      return '<td style="padding:10px 12px;text-align:center;vertical-align:middle;white-space:normal;word-break:break-word;font-size:.82rem;font-weight:500;color:'+textCol+';background:'+corrColor(v)+'">'+txt+'</td>';
    }).join('');
    return '<tr><td style="padding:10px 12px;text-align:left;white-space:normal;word-break:break-word"><div style="display:flex;align-items:center;gap:8px">'
      +'<span style="width:9px;height:9px;border-radius:50%;background:'+rowS.color+';flex-shrink:0;display:inline-block"></span>'
      +'<span style="font-size:.82rem;color:var(--fg-1)">'+rowS.name+'</span></div></td>'+cells+'</tr>';
  }).join('');
  var head='<th style="padding:9px 12px;text-align:left;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--fg-3)"></th>'
    +retSeries.map(function(s){return '<th style="padding:9px 12px;text-align:center;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--fg-3);white-space:normal;word-break:break-word">'+s.name+'</th>';}).join('');
  return '<div style="margin-bottom:16px"><h3 style="font-size:.95rem;font-weight:700;color:var(--fg-1);margin-bottom:4px">Correlation Matrix</h3>'
    +'<p style="font-size:.78rem;color:var(--fg-3);margin:0 0 10px">Pearson correlation of week-over-week returns, selected period</p>'
    +'<table style="width:100%;table-layout:fixed;border-collapse:collapse">'+colgroup+'<thead><tr style="border-bottom:1px solid var(--border)">'+head+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}

function pgComparison(){
  var period = window._cmpPeriod || '3y';
  function segBtnCmp(lbl,p){
    return '<button class="'+(period===p?'on':'')+'" onclick="switchCmpPeriod(\''+p+'\')">'+lbl+'</button>';
  }
  var periodBar = '<div class="seg">'
    +segBtnCmp('YTD','ytd')+segBtnCmp('1M','1m')+segBtnCmp('3M','3m')+segBtnCmp('6M','6m')
    +segBtnCmp('1Y','1y')+segBtnCmp('3Y','3y')+segBtnCmp('ALL','all')
    +'</div>';

  var CMP = COMPARISON_DATA;
  var chart, legend, corrTable, mergedTable;
  if(CMP && CMP.fund && CMP.fund.length){
    var rawSeries=[
      {name:'ZY-Invest', color:'#1565C0', pts:CMP.fund},
      {name:'FBM KLCI',  color:'#E65100', pts:CMP.klci||[]},
      {name:'STI',       color:'#DB2777', pts:CMP.sti||[]},
      {name:'MSCI',      color:'#7C3AED', pts:CMP.msci||[]},
      {name:'S&P 500',   color:'#2E7D32', pts:CMP.sp||[]},
      {name:'NASDAQ',    color:'#0891B2', pts:CMP.nasdaq||[]}
    ].filter(function(s){return s.pts && s.pts.length;});

    var allDates=[];
    rawSeries.forEach(function(s){ s.pts.forEach(function(p){ allDates.push(p.date); }); });
    allDates=Array.from(new Set(allDates)).sort();
    var latestDate=allDates[allDates.length-1];
    // Anchor "ALL" to the fund's own first NTA data point (CMP.fund[0]),
    // not the separate capital_injection-derived inception date — those
    // two can disagree (e.g. capital was injected before NTA computation
    // started), which was cutting the window earlier than ZY-Invest
    // actually has data and left it blank on the left side of the chart.
    var fundInception = (CMP.fund && CMP.fund.length) ? CMP.fund[0].date : CMP.inception;
    var cutoff=cmpCutoffDate(period, latestDate, fundInception);
    var windowDates=allDates.filter(function(d){ return d>=cutoff; });
    if(windowDates.length<2) windowDates=allDates;

    // Forward-fill each series onto the unified weekly date axis (their
    // native trading calendars don't line up exactly), then rebase every
    // series to 0% at its first available point within the window — so
    // "ALL" is 0% at inception and e.g. "YTD" is 0% at the start of the year.
    var aligned=rawSeries.map(function(s){
      var idx=0,last=null,vals=[];
      windowDates.forEach(function(d){
        while(idx<s.pts.length && s.pts[idx].date<=d){ last=s.pts[idx]; idx++; }
        vals.push(last?last.close:null);
      });
      var base=null;
      for(var i=0;i<vals.length;i++){ if(vals[i]!=null){ base=vals[i]; break; } }
      var pct=vals.map(function(v){ return (v==null||!base)?null:((v/base-1)*100); });
      return {name:s.name,color:s.color,v:pct,raw:vals};
    }).filter(function(s){ return s.v.some(function(v){return v!=null;}); });

    var priceInfo=aligned.map(function(s){
      var idxs=[]; s.raw.forEach(function(v,i){ if(v!=null) idxs.push(i); });
      if(!idxs.length) return null;
      var curIdx=idxs[idxs.length-1];
      var price=s.raw[curIdx];
      var prevIdx=idxs.length>1?idxs[idxs.length-2]:curIdx;
      var prev=s.raw[prevIdx];
      var chg=price-prev, chgPct=prev?(chg/prev*100):0;
      return {name:s.name,color:s.color,price:price,chg:chg,chgPct:chgPct};
    }).filter(Boolean);

    var hidden = window._cmpHidden || {};
    chart = buildCmpChart(aligned, windowDates, priceInfo, hidden);
    legend = '<div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:10px;justify-content:center;width:100%;">'
      +aligned.map(function(s,si){
        var lastV=null; for(var i=s.v.length-1;i>=0;i--){ if(s.v[i]!=null){lastV=s.v[i];break;} }
        var ret=lastV!=null?lastV.toFixed(1):'—'; var up=lastV!=null&&lastV>=0;
        var isHidden=!!hidden[s.name];
        return '<div onclick="toggleCmpSeries(\''+s.name+'\')" style="display:flex;align-items:center;gap:8px;cursor:pointer;opacity:'+(isHidden?'0.35':'1')+'" title="Click to '+(isHidden?'show':'hide')+'">'
          +'<span style="width:20px;height:3px;background:'+s.color+';display:inline-block;border-radius:2px"></span>'
          +'<span style="font-size:.78rem;color:var(--fg-2)">'+s.name+'</span>'
          +'<span id="cmpLegVal-'+si+'" style="font-size:.78rem;font-weight:400;color:'+(lastV==null?'var(--fg-3)':(up?'var(--green)':'var(--red)'))+'">'+(lastV==null?'—':((up?'+':'')+ret+'%'))+'</span>'
          +'</div>';
      }).join('')+'</div>';

    // Correlation matrix — Pearson correlation of week-over-week % returns
    // (not the cumulative rebased curves, which would overstate correlation).
    var retSeries=aligned.map(function(s){
      var rets=[];
      for(var i=1;i<s.raw.length;i++){
        var a=s.raw[i-1],b=s.raw[i];
        rets.push((a!=null&&b!=null&&a)?(b/a-1):null);
      }
      return {name:s.name,color:s.color,ret:rets};
    });
    corrTable = buildCorrTable(retSeries);

    // ── Last 3 calendar years' return — always fixed to the 3 most recent
    // calendar years regardless of the period filter, computed from each
    // series' FULL history (not the filtered window). ─────────────────────
    var thisYear=new Date().getFullYear();
    var yearList=[thisYear-2,thisYear-1,thisYear];
    function calendarYearReturn(pts,year){
      var yStart=year+'-01-01', yEnd=year+'-12-31';
      var startPrice=null,endPrice=null;
      for(var i=0;i<pts.length;i++){ if(pts[i].date<=yStart) startPrice=pts[i].close; }
      if(startPrice==null){
        for(var j=0;j<pts.length;j++){ if(pts[j].date>=yStart && pts[j].date<=yEnd){ startPrice=pts[j].close; break; } }
      }
      for(var k=pts.length-1;k>=0;k--){ if(pts[k].date<=yEnd){ endPrice=pts[k].close; break; } }
      if(startPrice==null||endPrice==null||!startPrice) return null;
      return (endPrice/startPrice-1)*100;
    }
    var yearReturns=rawSeries.map(function(s){
      return {name:s.name,color:s.color,vals:yearList.map(function(y){ return calendarYearReturn(s.pts,y); })};
    });

    // ── Annualised Return / Volatility / Sharpe / Max Drawdown / Beta —
    // all computed from the currently SELECTED period's data (aligned +
    // windowDates), so switching YTD/1M/.../ALL changes these too. Beta is
    // vs FBM KLCI's returns within the same window. ───────────────────────
    var periodMetrics=aligned.map(function(s){
      var idxs=[]; s.raw.forEach(function(v,i){ if(v!=null) idxs.push(i); });
      var rets=[];
      for(var i=1;i<s.raw.length;i++){
        var a=s.raw[i-1],b=s.raw[i];
        if(a!=null&&b!=null&&a) rets.push(b/a-1);
      }
      if(idxs.length<2) return {name:s.name,color:s.color,annReturn:null,annVol:null,sharpe:null,maxDD:null,maxRise:null,rets:rets};
      var firstV=s.raw[idxs[0]], lastV=s.raw[idxs[idxs.length-1]];
      var weeks=idxs[idxs.length-1]-idxs[0];
      var totalReturn=(firstV)?(lastV/firstV-1):null;
      var annReturn=(totalReturn!=null&&weeks>0)?(Math.pow(1+totalReturn,52/weeks)-1)*100:null;
      var annVol=null;
      if(rets.length>1){
        var mean=rets.reduce(function(a,b){return a+b;},0)/rets.length;
        var variance=rets.reduce(function(a,b){return a+(b-mean)*(b-mean);},0)/(rets.length-1);
        annVol=Math.sqrt(variance)*Math.sqrt(52)*100;
      }
      var sharpe=(annReturn!=null&&annVol)?(annReturn/annVol):null;
      // Largest single-period move — the biggest one-step decline and the
      // biggest one-step gain within the window (not a cumulative
      // peak-to-trough drawdown across multiple periods).
      var maxDD=rets.length?Math.min.apply(null,rets)*100:null;
      var maxRise=rets.length?Math.max.apply(null,rets)*100:null;
      if(maxDD!=null && maxDD>0) maxDD=0;
      if(maxRise!=null && maxRise<0) maxRise=0;
      return {name:s.name,color:s.color,annReturn:annReturn,annVol:annVol,sharpe:sharpe,maxDD:maxDD,maxRise:maxRise,rets:rets};
    });
    var klciM=periodMetrics.filter(function(p){return p.name==='FBM KLCI';})[0];
    periodMetrics.forEach(function(p){
      if(!klciM || p.rets.length<2 || klciM.rets.length<2){ p.beta=null; return; }
      var n=Math.min(p.rets.length,klciM.rets.length);
      var x=klciM.rets.slice(0,n), y=p.rets.slice(0,n);
      var mx=x.reduce(function(a,b){return a+b;},0)/n, my=y.reduce(function(a,b){return a+b;},0)/n;
      var cov=0,varx=0;
      for(var i=0;i<n;i++){ cov+=(x[i]-mx)*(y[i]-my); varx+=(x[i]-mx)*(x[i]-mx); }
      p.beta=varx?cov/varx:null;
    });

    mergedTable = buildComparisonTable(yearList, yearReturns, periodMetrics);
  } else {
    chart='<div style="padding:50px 20px;color:var(--fg-3);font-size:.85rem;text-align:center">'+(COMPARISON_ERROR?('Could not load — '+COMPARISON_ERROR):'Loading comparison data…')+'</div>';
    legend='';
    corrTable='';
    mergedTable='';
  }
  return '<div style="background:#fff;margin:-26px -28px -48px;padding:26px 28px 48px;min-height:100%"><div class="ph-xl"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px"><h1 style="margin:0">Fund <span class="acc">Comparison</span></h1>'+periodBar+'</div></div>'
    +'<div style="margin-bottom:44px">'
    +chart+legend+'</div>'
    +'<div style="margin-bottom:44px">'+mergedTable+'</div>'
    +'<div>'+corrTable+'</div>'
    +'</div>';
}

// Transposed comparison table — one row per fund/index, columns are the
// last 3 calendar years' return (fixed, independent of the period filter)
// followed by Beta / Sharpe / Annualised Return / Annualised Volatility /
// Max Drawdown / Max Rising (all computed from the selected period).
// Columns are fixed-width (table-layout:fixed) and every cell is
// center-aligned with wrapping allowed, so labels/values never force the
// table wider than its container.
function buildComparisonTable(yearList, yearReturns, periodMetrics){
  if(!yearReturns.length) return '';
  var cellBase='padding:10px 12px;text-align:center;vertical-align:middle;white-space:normal;word-break:break-word;';
  var fundCellBase='padding:10px 12px;text-align:left;vertical-align:middle;white-space:normal;word-break:break-word;';
  function pctCell(v){
    if(v==null) return '<td style="'+cellBase+'font-size:.84rem;color:var(--fg-3)">—</td>';
    var up=v>=0;
    return '<td style="'+cellBase+'font-size:.84rem;font-weight:600;color:'+(up?'var(--green)':'var(--red)')+'">'+(up?'+':'')+v.toFixed(2)+'%</td>';
  }
  function plainCell(v,dp){
    if(v==null) return '<td style="'+cellBase+'font-size:.84rem;color:var(--fg-3)">—</td>';
    return '<td style="'+cellBase+'font-size:.84rem;font-weight:500;color:var(--fg-1)">'+v.toFixed(dp)+'</td>';
  }
  var metricsByName={}; periodMetrics.forEach(function(p){ metricsByName[p.name]=p; });
  var rows=yearReturns.map(function(yr){
    var m=metricsByName[yr.name]||{};
    return '<tr onmouseover="this.style.background=\'#F8FAFC\'" onmouseout="this.style.background=\'transparent\'" style="transition:background .12s;">'
      +'<td style="'+fundCellBase+'"><div style="display:flex;align-items:center;gap:8px">'
      +'<span style="width:10px;height:10px;border-radius:50%;background:'+yr.color+';flex-shrink:0;display:inline-block"></span>'
      +'<span style="font-size:.85rem;color:var(--fg-1)">'+yr.name+'</span></div></td>'
      +yr.vals.map(pctCell).join('')
      +plainCell(m.beta,2)
      +plainCell(m.sharpe,2)
      +pctCell(m.annReturn)
      +plainCell(m.annVol,2)
      +pctCell(m.maxDD)
      +pctCell(m.maxRise)
      +'</tr>';
  }).join('');
  var headCell='padding:9px 12px;text-align:center;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--fg-3);white-space:normal;word-break:break-word;';
  var fundHeadCell='padding:9px 12px;text-align:left;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--fg-3);white-space:normal;word-break:break-word;';
  var yearHeads=yearList.map(function(y){return '<th style="'+headCell+'">Y'+String(y).slice(-2)+'</th>';}).join('');
  var colCount=1+yearList.length+6;
  var colWidth=(100/colCount).toFixed(2)+'%';
  var colgroup='<colgroup>'+Array(colCount).fill('<col style="width:'+colWidth+'">').join('')+'</colgroup>';
  return '<div style="margin-bottom:16px"><h3 style="font-size:.95rem;font-weight:700;color:var(--fg-1);margin-bottom:4px">Returns &amp; Risk Metrics</h3>'
    +'<p style="font-size:.78rem;color:var(--fg-3);margin:0 0 10px">Last 3 calendar years, plus annualised figures for the selected period above</p>'
    +'<table style="width:100%;table-layout:fixed;border-collapse:collapse">'+colgroup+'<thead><tr style="border-bottom:1px solid var(--border)">'
    +'<th style="'+fundHeadCell+'">Fund</th>'
    +yearHeads
    +'<th style="'+headCell+'">Beta</th>'
    +'<th style="'+headCell+'">Sharpe Ratio</th>'
    +'<th style="'+headCell+'">Annualised<br>Return</th>'
    +'<th style="'+headCell+'">Annualised<br>Volatility</th>'
    +'<th style="'+headCell+'">Maximum<br>Drawdown</th>'
    +'<th style="'+headCell+'">Maximum<br>Rising</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}

// ── FINANCIAL RESULTS ─────────────────────────────────────────────────────────
function pgFinancialResults(){
  var activeFRTab=window._frTab||'income';
  var FY=['FY21','FY22','FY23','FY24','FY25'];
  var INCOME={
    revenue:      [0,520000,850000,1580000,2100000],
    expenses:     [0,410000,612000,918000,1258000],
    netIncome:    [0,110000,238000,662000,842000],
    distPaid:     [0,0,16800,98200,752200],
    eps:          [0,0.012,0.022,0.058,0.074],
  };
  var BALANCE={
    totalAssets:  [0,16800000,22500000,25100000,24800000],
    equity:       [0,16700000,22400000,24900000,24600000],
    liabilities:  [0,100000,100000,200000,200000],
    cashMM:       [0,1400000,2100000,1800000,2100000],
    fixedIncome:  [0,1200000,1700000,1600000,1700000],
    equityInv:    [0,14200000,18700000,21500000,21000000],
  };
  var CASHFLOW={
    fromOps:      [0,820000,1240000,1980000,2640000],
    fromInv:      [0,-3400000,-5200000,-2400000,-1800000],
    fromFin:      [0,14200000,5800000,2800000,1200000],
    netChange:    [0,11620000,1840000,2380000,2040000],
    openingCash:  [0,0,11620000,13460000,15840000],
    closingCash:  [0,11620000,13460000,15840000,17880000],
  };
  var RATIOS={
    roe:          [0,0.66,1.06,2.66,3.43],
    roa:          [0,0.65,1.06,2.64,3.40],
    netMargin:    [0,21.2,28.0,41.9,40.1],
    expenseRatio: [0,78.8,72.0,58.1,59.9],
    debtEquity:   [0,0.006,0.004,0.008,0.008],
    currentRatio: [0,167.0,224.0,125.5,123.0],
  };

  // Active FY (skip leading zeros)
  // Cap at 8 FY
  FY=FY.slice(-10);
  Object.keys(INCOME).forEach(function(k){INCOME[k]=INCOME[k].slice(-10);});
  Object.keys(BALANCE).forEach(function(k){BALANCE[k]=BALANCE[k].slice(-10);});
  Object.keys(CASHFLOW).forEach(function(k){CASHFLOW[k]=CASHFLOW[k].slice(-10);});
  Object.keys(RATIOS).forEach(function(k){RATIOS[k]=RATIOS[k].slice(-10);});
  var activeFY=FY.filter(function(_,i){
    // Keep FY if at least one series has non-zero value at that index
    var key=activeFRTab==='income'?Object.values(INCOME):activeFRTab==='balance'?Object.values(BALANCE):activeFRTab==='cashflow'?Object.values(CASHFLOW):Object.values(RATIOS);
    return key.some(function(arr){return arr[i]!==0;});
  });

  // Bar chart with hover, right-axis, right-aligned plot area
  function fmtFull(v){
    var n=v||0;
    return Math.abs(n).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  // "Nice numbers for graph labels" (Heckbert) — picks round tick values
  // (2000, 10000, ...) instead of raw data-derived fractions (1998.32, ...).
  function niceNum(range, round){
    if(range<=0) return 1;
    var exponent=Math.floor(Math.log10(range));
    var fraction=range/Math.pow(10,exponent);
    var niceFraction;
    if(round){
      if(fraction<1.5) niceFraction=1;
      else if(fraction<3) niceFraction=2;
      else if(fraction<7) niceFraction=5;
      else niceFraction=10;
    } else {
      if(fraction<=1) niceFraction=1;
      else if(fraction<=2) niceFraction=2;
      else if(fraction<=5) niceFraction=5;
      else niceFraction=10;
    }
    return niceFraction*Math.pow(10,exponent);
  }
  function niceAxisScale(min,max,tickCount){
    tickCount=tickCount||5;
    if(min===max){ min-=1; max+=1; }
    var range=niceNum(max-min,false);
    var step=niceNum(range/(tickCount-1),true);
    var niceMin=Math.floor(min/step)*step;
    var niceMax=Math.ceil(max/step)*step;
    return {min:niceMin,max:niceMax,step:step};
  }
  // k at 6 digits (100,000+), mil at 9 digits (100,000,000+) — always
  // whole numbers ("#,##0"), never a decimal point, for consistency
  // across every axis on every chart.
  function fmtAxisNum(v){
    var av=Math.abs(v);
    var sign=v<0?'−':'';
    if(av>=100000000){
      return sign+Math.round(av/1000000).toLocaleString('en-MY')+'mil';
    } else if(av>=100000){
      return sign+Math.round(av/1000).toLocaleString('en-MY')+'k';
    }
    return sign+Math.round(av).toLocaleString('en-MY');
  }
  function barChartFR(fyLabels,series){
    var n=fyLabels.length;
    // Width scales with n, capped at 7 FY
    var barW=36, groupGap=24, padL=16, padR=58, padYT=14, padYB=24;
    var SEG=68;
    var W=padL+n*SEG+padR, H=240;
    var pctW=Math.min(100,(n/10*100)).toFixed(1)+'%';
    barW=Math.min(28,Math.floor((SEG-groupGap)/series.length-4));
    var allV=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var rawMx=Math.max.apply(null,allV.concat([0]));
    var rawMn=Math.min.apply(null,allV.concat([0]));
    var scale=niceAxisScale(rawMn,rawMx,5);
    var mx=scale.max, mn=scale.min;
    if(mx===mn){ mx+=1; mn-=1; }
    var rng=mx-mn;
    var plotH=H-padYT-padYB;
    function yFor(v){ return padYT+(mx-v)/rng*plotH; }
    var zeroY=yFor(0);
    function bx(gi,si){return padL+gi*SEG+(SEG-groupGap-(series.length*barW+(series.length-1)*4))/2+si*(barW+4);}
    // Grid lines at nice round tick values (supports negative)
    var ticks=[];
    for(var tv=mn; tv<=mx+scale.step*0.001; tv+=scale.step){ ticks.push(tv); }
    var grid=ticks.map(function(v){
      var yy=yFor(v).toFixed(1);
      var vStr=fmtAxisNum(v);
      return '<line x1="'+padL+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'+
             '<text x="'+(W-padR+4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="7" fill="#374151">'+vStr+'</text>';
    }).join('');
    var zeroLine=(mn<0&&mx>0)?('<line x1="'+padL+'" y1="'+zeroY.toFixed(1)+'" x2="'+(W-padR)+'" y2="'+zeroY.toFixed(1)+'" stroke="#CBD5E1" stroke-width="1.2"/>'):'';
    // Bars — extend from the zero baseline up (positive) or down (negative)
    var bars='';
    series.forEach(function(s,si){
      s.v.forEach(function(v,gi){
        var yTop=yFor(Math.max(0,v)), yBot=yFor(Math.min(0,v));
        var h=Math.max(0.5,yBot-yTop);
        var x=bx(gi,si).toFixed(1);
        var col=s.colorByValue?(v<0?'#DC2626':'#2E7D32'):s.color;
        bars+='<rect x="'+x+'" y="'+yTop.toFixed(1)+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+col+'" rx="2"/>';
      });
    });
    // Group hover overlay per FY
    var overlays=fyLabels.map(function(fy,gi){
      var tipLines=series.map(function(s){
        var v=s.v[gi];
        var dotCol=s.colorByValue?(v<0?'#DC2626':'#2E7D32'):s.color;
        return dotCol+'::'+s.label+': '+(v<0?('−'+fmtFull(v)):fmtFull(v));
      });
      var tip='FY:'+fy+'|'+tipLines.join('|');
      var ox=(padL+gi*SEG).toFixed(1);
      var cx=((padL+gi*SEG+SEG/2)/W).toFixed(4);
      return '<rect x="'+ox+'" y="'+padYT+'" width="'+SEG+'" height="'+(H-padYT-padYB)+'" fill="transparent" data-cx="'+cx+'" data-tip="'+tip+'" onmouseenter="frTip(event,getTip(this),this.getAttribute(\'data-cx\'))" onmouseleave="frHide()" style="cursor:crosshair"/>';
    }).join('');
    var xL=fyLabels.map(function(l,i){
      return '<text x="'+(padL+i*SEG+SEG/2).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="7" fill="#374151">'+l+'</text>';
    }).join('');
    var leg='<div style="display:flex;gap:14px;margin-top:8px;justify-content:center">'+series.map(function(s){
      var swatch=s.colorByValue?'linear-gradient(90deg,#2E7D32 50%,#DC2626 50%)':s.color;
      return '<span style="display:flex;align-items:center;gap:5px;font-size:.73rem;color:var(--fg-3)"><span style="width:9px;height:9px;border-radius:2px;background:'+swatch+';display:inline-block"></span>'+s.label+'</span>';
    }).join('')+'</div>';
    return '<div style="width:100%">'
      +'<div style="width:'+pctW+';min-width:'+W+'px;max-width:100%;margin-left:auto;position:relative;overflow:visible">'
      +'<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block">'+grid+zeroLine+bars+overlays+xL+'</svg>'
      +'<div id="frTipEl" style="display:none;position:absolute;background:#fff;color:#0F172A;font-size:.74rem;font-weight:600;padding:8px 12px;border-radius:8px;pointer-events:none;z-index:10;top:4px;left:0;border:1px solid #E2E8F0;box-shadow:0 6px 20px rgba(0,0,0,.13);"></div>'
      +'</div></div>'+leg;
  }

  // Line chart with hover, right axis
  function lineChartFR(fyLabels,series){
    var n=fyLabels.length;
    var padL=16,padR=48,padYT=14,padYB=24,pointGap=60;
    var SEG=68;
    var W=padL+n*SEG+padR, H=240;
    var pctWL=Math.min(100,(n/10*100)).toFixed(1)+'%';
    pointGap=SEG;
    var allV=series.reduce(function(a,s){return a.concat(s.v);},[]).filter(function(v){return v>0;});
    var rawMx=Math.max.apply(null,allV.concat([0]))||1;
    var scale=niceAxisScale(0,rawMx,5);
    var mn=0,mx=scale.max,rng=mx-mn||1;
    function px(i){return padL+i*SEG+SEG/2;}
    function py(v){return H-padYB-((v-mn)/rng)*(H-padYT-padYB);}
    var ticks=[];
    for(var tv=0; tv<=mx+scale.step*0.001; tv+=scale.step){ ticks.push(tv); }
    var grid=ticks.map(function(v){
      var yy=py(v).toFixed(1);
      var vStr=Math.round(v)+'%';
      return '<line x1="'+padL+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'+
             '<text x="'+(W-padR+4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="7" fill="#374151">'+vStr+'</text>';
    }).join('');
    var paths=series.map(function(s){
      var pts=s.v.map(function(v,i){return {x:px(i),y:py(v),v:v};}).filter(function(p){return p.v>0;});
      if(!pts.length) return '';
      var d=pts.map(function(p,i){return (i?'L':'M')+p.x.toFixed(1)+','+p.y.toFixed(1);}).join('');
      var dots=pts.map(function(p){return '<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3" fill="#fff" stroke="'+s.color+'" stroke-width="2"/>';}).join('');
      return '<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="2" stroke-linejoin="round"/>'+dots;
    }).join('');
    // Group overlays per FY
    var lineOverlays=fyLabels.map(function(fy,gi){
      var tipLines=series.map(function(s){return s.color+'::'+s.label+': '+(s.v[gi]>0?s.v[gi].toFixed(2)+'%':'—');});
      var tip='FY:'+fy+'|'+tipLines.join('|');
      var ox=(padL+gi*SEG).toFixed(1);
      var cx=((padL+gi*SEG+SEG/2)/W).toFixed(4);
      return '<rect x="'+ox+'" y="'+padYT+'" width="'+SEG+'" height="'+(H-padYT-padYB)+'" fill="transparent" data-cx="'+cx+'" data-tip="'+tip+'" onmouseenter="frTip(event,getTip(this),this.getAttribute(\'data-cx\'))" onmouseleave="frHide()" style="cursor:crosshair"/>';
    }).join('');
    var xL=fyLabels.map(function(l,i){return '<text x="'+px(i).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="7" fill="#374151">'+l+'</text>';}).join('');
    var leg='<div style="display:flex;gap:14px;margin-top:8px;justify-content:center">'+series.map(function(s){
      return '<span style="display:flex;align-items:center;gap:5px;font-size:.73rem;color:var(--fg-3)"><span style="width:14px;height:2px;background:'+s.color+';display:inline-block;border-radius:2px"></span>'+s.label+'</span>';
    }).join('')+'</div>';
    return '<div style="width:100%">'
      +'<div style="width:'+pctWL+';min-width:'+W+'px;max-width:100%;margin-left:auto;position:relative">'
      +'<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block">'+grid+paths+lineOverlays+xL+'</svg>'
      +'<div id="frTipEl" style="display:none;position:absolute;background:#fff;color:#0F172A;font-size:.74rem;font-weight:600;padding:8px 12px;border-radius:8px;pointer-events:none;z-index:10;top:4px;left:0;border:1px solid #E2E8F0;box-shadow:0 6px 20px rgba(0,0,0,.13);"></div>'
      +'</div></div>'+leg;
  }

  function fmt(v){if(!v)return '—';return v>=1000000?(v/1000000).toFixed(2)+'M':v>=1000?(v/1000).toFixed(0)+'K':v.toLocaleString();}
  function fmtPct(v){if(!v)return '—';return v.toFixed(2)+'%';}
  function tRow(label,vals,fmtFn,bold){
    var style='font-size:.84rem;'+(bold?'font-weight:600;color:var(--fg-1)':'font-weight:400;color:var(--fg-2)');
    return '<tr style="border-bottom:1px solid var(--border)"><td style="padding:9px 16px;'+style+'">'+label+'</td>'
      +vals.map(function(v,i){
        var av=activeFY.indexOf(FY[i])>=0;
        return av?'<td style="padding:9px 16px;text-align:right;'+style+'">'+fmtFn(v)+'</td>':'';
      }).join('')+'</tr>';
  }
  function thead(){
    return '<thead><tr style="border-bottom:1px solid var(--border)">'
      +'<th style="padding:9px 16px;text-align:left;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--fg-3)">Item</th>'
      +FY.map(function(y,i){
        return activeFY.indexOf(y)>=0?'<th style="padding:9px 16px;text-align:right;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--fg-3)">'+y+'</th>':'';
      }).join('')
      +'</tr></thead>';
  }

  // Slice data to active FY
  function slice(arr){return arr.filter(function(_,i){return activeFY.indexOf(FY[i])>=0;});}

  // ── Shared live-statement table helpers (Income Statement + Balance Sheet) ──
  function fsRow(dataset,label,key,bold,fmtFn,highlight,indent){
    var style='font-size:.84rem;'+(bold?'font-weight:600;color:var(--fg-1)':'font-weight:400;color:var(--fg-2)');
    var rowBg=highlight?' style="background:var(--blue-bg);border-bottom:1px solid var(--border)"':' style="border-bottom:1px solid var(--border)"';
    var labelPad=indent?'9px 16px 9px 32px':'9px 16px';
    return '<tr'+rowBg+'><td style="padding:'+labelPad+';'+style+'">'+label+'</td>'
      +dataset.map(function(r){
        var v=r[key];
        if(v===null||v===undefined) return '<td style="padding:9px 16px;text-align:right;'+style+'">—</td>';
        var vc=v<0?'color:var(--red)':(bold&&v>0?'color:var(--green)':'');
        var txt;
        if(fmtFn){ txt=v===0?'—':(v<0?('('+fmtFn(Math.abs(v))+')'):fmtFn(v)); }
        else { txt=v===0?'—':(v<0?('('+fmtFull(v)+')'):fmtFull(v)); }
        return '<td style="padding:9px 16px;text-align:right;'+style+(vc?';'+vc:'')+'">'+txt+'</td>';
      }).join('')
      +'</tr>';
  }
  function fsSubheader(dataset,label){
    return '<tr><td colspan="'+(dataset.length+1)+'" style="padding:9px 16px 0;font-size:.8rem;font-style:italic;color:var(--fg-3)">'+label+'</td></tr>';
  }
  function fsThead(dataset,unitLabel){
    return '<thead><tr style="border-bottom:1px solid var(--border);background:var(--gray-100)">'
      +'<th style="padding:9px 16px;text-align:left;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--fg-3);width:300px">Item ('+unitLabel+')</th>'
      +dataset.map(function(r){return '<th style="padding:9px 16px;text-align:right;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--fg-3);width:90px">'+r.fy+'</th>';}).join('')
      +'</tr></thead>';
  }
  function fsSpacer(dataset){
    return '<tr><td colspan="'+(dataset.length+1)+'" style="padding:5px 0;border:none"></td></tr>';
  }
  function fsSectionHeader(dataset,label){
    return '<tr style="background:var(--gray-50)"><td colspan="'+(dataset.length+1)+'" style="padding:8px 16px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--fg-3)">'+label+'</td></tr>';
  }
  var fmtUnits=function(v){return v.toLocaleString('en-MY',{minimumFractionDigits:4,maximumFractionDigits:4});};
  var fmtCents=function(v){return v.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});};
  var fmtNta=function(v){return v.toLocaleString('en-MY',{minimumFractionDigits:4,maximumFractionDigits:4});};
  var fmtPctAbs=function(v){return v.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';};
  var fmtCount=function(v){return Math.round(v).toLocaleString('en-MY');};

  var chart='',table='';
  if(activeFRTab==='income'){
    if(INCOME_STATEMENT_ERROR){
      table='<div style="padding:24px;color:var(--red);font-size:.86rem">Could not load income statement — '+INCOME_STATEMENT_ERROR+'</div>';
    } else if(!INCOME_STATEMENT.length){
      table='<div style="padding:24px;color:var(--fg-3);font-size:.86rem">No financial years defined yet — add rows to fy_settings to see the income statement.</div>';
    } else {
      chart=barChartFR(INCOME_STATEMENT.map(function(r){return r.fy;}),[
        {v:INCOME_STATEMENT.map(function(r){return r.revenue;}),   color:'#1565C0', label:'Revenue'},
        {v:INCOME_STATEMENT.map(function(r){return r.netIncome;}), color:'#2E7D32', label:'NPAT', colorByValue:true}
      ]);
      table='<table style="width:100%;border-collapse:collapse;table-layout:fixed">'+fsThead(INCOME_STATEMENT,'RM')+'<tbody>'
        +fsRow(INCOME_STATEMENT,'Dividend Income','dividendIncome',false)
        +fsRow(INCOME_STATEMENT,'Interest Income','interestIncome',false)
        +fsRow(INCOME_STATEMENT,'Revenue / Total Income','revenue',true,null,true)
        +fsRow(INCOME_STATEMENT,'Management Cost','managementCost',false)
        +fsRow(INCOME_STATEMENT,'Gross Income','grossIncome',true,null,true)
        +fsRow(INCOME_STATEMENT,'Realised Profit &amp; Loss','realizedPnl',false)
        +fsRow(INCOME_STATEMENT,'Unrealised Profit &amp; Loss','unrealizedPnl',false)
        +fsRow(INCOME_STATEMENT,'Other Income / (Expenses)','otherIncomeExpense',false)
        +fsRow(INCOME_STATEMENT,'Profit before Tax','profitBeforeTax',true,null,true)
        +fsRow(INCOME_STATEMENT,'Tax Paid','tax',false)
        +fsRow(INCOME_STATEMENT,'Net Income / Profit after Tax (NPAT)','netIncome',true,null,true)
        +fsRow(INCOME_STATEMENT,'Outstanding Shares (Units)','outstandingShares',false,fmtUnits)
        +fsRow(INCOME_STATEMENT,'EPS (cents)','epsCents',false,fmtCents)
        +'</tbody></table>';
    }
  } else if(activeFRTab==='balance'){
    if(BALANCE_SHEET_ERROR){
      table='<div style="padding:24px;color:var(--red);font-size:.86rem">Could not load balance sheet — '+BALANCE_SHEET_ERROR+'</div>';
    } else if(!BALANCE_SHEET.length){
      table='<div style="padding:24px;color:var(--fg-3);font-size:.86rem">No financial years defined yet — add rows to fy_settings to see the balance sheet.</div>';
    } else {
      chart=barChartFR(BALANCE_SHEET.map(function(r){return r.fy;}),[
        {v:BALANCE_SHEET.map(function(r){return r.totalAssets;}), color:'#1565C0', label:'Assets'},
        {v:BALANCE_SHEET.map(function(r){return r.totalEquity;}), color:'#2E7D32', label:'Equities'}
      ]);
      table='<table style="width:100%;border-collapse:collapse;table-layout:fixed">'+fsThead(BALANCE_SHEET,'RM')+'<tbody>'
        +fsRow(BALANCE_SHEET,'Securities','securities',false)
        +fsRow(BALANCE_SHEET,'Other Investments','otherInvestments',false)
        +fsRow(BALANCE_SHEET,'Dividend Receivables','dividendReceivables',false)
        +fsRow(BALANCE_SHEET,'Cash &amp; Cash Equivalents','cash',false)
        +fsRow(BALANCE_SHEET,'Total Assets','totalAssets',true,null,true)
        +fsRow(BALANCE_SHEET,'Accrual Fees','accrualFees',false)
        +fsRow(BALANCE_SHEET,'Total Liabilities','totalLiabilities',true,null,true)
        +fsRow(BALANCE_SHEET,'Total Capital','totalCapital',false)
        +fsRow(BALANCE_SHEET,'Retained Earnings','retainedEarnings',false)
        +fsRow(BALANCE_SHEET,'Total Equities','totalEquity',true,null,true)
        +fsRow(BALANCE_SHEET,'Outstanding Shares (Units)','outstandingShares',false,fmtUnits)
        +fsRow(BALANCE_SHEET,'NTA per Share','ntaPerShare',false,fmtNta)
        +'</tbody></table>';
    }
  } else if(activeFRTab==='cashflow'){
    if(CASH_FLOW_ERROR){
      table='<div style="padding:24px;color:var(--red);font-size:.86rem">Could not load cash flow — '+CASH_FLOW_ERROR+'</div>';
    } else if(!CASH_FLOW.length){
      table='<div style="padding:24px;color:var(--fg-3);font-size:.86rem">No financial years defined yet — add rows to fy_settings to see the cash flow statement.</div>';
    } else {
      chart=barChartFR(CASH_FLOW.map(function(r){return r.fy;}),[
        {v:CASH_FLOW.map(function(r){return r.netCashOperating;}), color:'#1565C0', label:'CF Operating'},
        {v:CASH_FLOW.map(function(r){return r.netCashInvesting;}), color:'#E65100', label:'CF Investing'},
        {v:CASH_FLOW.map(function(r){return r.netCashFinancing;}), color:'#2E7D32', label:'CF Financing'}
      ]);
      table='<table style="width:100%;border-collapse:collapse;table-layout:fixed">'+fsThead(CASH_FLOW,'RM')+'<tbody>'
        +fsRow(CASH_FLOW,'Profit before Tax','profitBeforeTax',false)
        +fsSubheader(CASH_FLOW,'Adjustments for:')
        +fsRow(CASH_FLOW,'Unrealised (Gain) / Loss on Investment','unrealizedAdjustment',false,null,false,true)
        +fsRow(CASH_FLOW,'Realised (Gain) / Loss on Investment','realizedAdjustment',false,null,false,true)
        +fsRow(CASH_FLOW,'Net Proceeds from (Investment) / Disposal — Securities','proceedsSecurities',false)
        +fsRow(CASH_FLOW,'Net Proceeds from (Investment) / Disposal — Other Assets','proceedsOtherAssets',false)
        +fsRow(CASH_FLOW,'Changes in Receivables','changeReceivables',false)
        +fsRow(CASH_FLOW,'Changes in Accrual Fees','changeAccrualFees',false)
        +fsRow(CASH_FLOW,'Cashflow from Operations','cashflowFromOps',true,null,true)
        +fsRow(CASH_FLOW,'Income Tax Paid','incomeTaxPaid',false)
        +fsRow(CASH_FLOW,'Net Cash from Operating Activities','netCashOperating',true,null,true)
        +fsSpacer(CASH_FLOW)
        +fsRow(CASH_FLOW,'Net Cash from Investing Activities','netCashInvesting',true,null,true)
        +fsSpacer(CASH_FLOW)
        +fsRow(CASH_FLOW,'Dividend Paid','dividendPaid',false)
        +fsRow(CASH_FLOW,'Issuance of New Shares','issuanceOfShares',false)
        +fsRow(CASH_FLOW,'Net Cash from Financing Activities','netCashFinancing',true,null,true)
        +fsSpacer(CASH_FLOW)
        +fsRow(CASH_FLOW,'Net Increase in Cash &amp; Bank Balances','netIncreaseInCash',true,null,true)
        +fsRow(CASH_FLOW,'Cash &amp; Bank Balances at Beginning of FY','cashBeginning',false)
        +fsRow(CASH_FLOW,'Cash &amp; Bank Balances at End of FY','cashEnding',true,null,true)
        +'</tbody></table>';
    }
  } else {
    if(RATIO_ANALYSIS_ERROR){
      table='<div style="padding:24px;color:var(--red);font-size:.86rem">Could not load ratio analysis — '+RATIO_ANALYSIS_ERROR+'</div>';
    } else if(!RATIO_ANALYSIS.length){
      table='<div style="padding:24px;color:var(--fg-3);font-size:.86rem">No financial years defined yet — add rows to fy_settings to see ratio analysis.</div>';
    } else {
      chart=lineChartFR(RATIO_ANALYSIS.map(function(r){return r.fy;}),[
        {v:RATIO_ANALYSIS.map(function(r){return r.yieldReturn||0;}), color:'#1565C0', label:'Yield Return'},
        {v:RATIO_ANALYSIS.map(function(r){return r.grossReturn||0;}), color:'#2E7D32', label:'Gross Return'}
      ]);
      table='<table style="width:100%;border-collapse:collapse;table-layout:fixed">'+fsThead(RATIO_ANALYSIS,'%')+'<tbody>'
        +fsSectionHeader(RATIO_ANALYSIS,'Profitability')
        +fsRow(RATIO_ANALYSIS,'Gross Margin','grossMargin',false,fmtPctAbs)
        +fsRow(RATIO_ANALYSIS,'PBT Margin','pbtMargin',false,fmtPctAbs)
        +fsRow(RATIO_ANALYSIS,'NAT Margin','natMargin',false,fmtPctAbs)
        +fsSectionHeader(RATIO_ANALYSIS,'Return')
        +fsRow(RATIO_ANALYSIS,'Yield Return','yieldReturn',false,fmtPctAbs)
        +fsRow(RATIO_ANALYSIS,'Gross Return','grossReturn',false,fmtPctAbs)
        +fsRow(RATIO_ANALYSIS,'Return on Asset','returnOnAsset',false,fmtPctAbs)
        +fsSectionHeader(RATIO_ANALYSIS,'Leverage')
        +fsRow(RATIO_ANALYSIS,'Gearing Ratio','gearingRatio',false,fmtPctAbs)
        +fsRow(RATIO_ANALYSIS,'Cash Reserve Ratio','cashReserveRatio',false,fmtPctAbs)
        +fsSectionHeader(RATIO_ANALYSIS,'Dividend')
        +fsRow(RATIO_ANALYSIS,'Dividend per Share (sen)','dps',false,fmtCents)
        +fsRow(RATIO_ANALYSIS,'Dividend Yield','dividendYield',false,fmtPctAbs)
        +fsSectionHeader(RATIO_ANALYSIS,'Others (excl. Cash Funds)')
        +fsRow(RATIO_ANALYSIS,'No. of Transactions','numTransactions',false,fmtCount)
        +fsRow(RATIO_ANALYSIS,'Total Trading Amount (RM)','totalTradingAmount',false)
        +fsRow(RATIO_ANALYSIS,'Total Trading Units','totalTradingUnits',false,fmtUnits)
        +fsRow(RATIO_ANALYSIS,'Total Trading Fees (RM)','totalTradingFees',false)
        +fsRow(RATIO_ANALYSIS,'Fees Rate','feesRate',false,fmtPctAbs)
        +'</tbody></table>';
    }
  }

  var tabs=[{id:'income',label:'Income Statement'},{id:'balance',label:'Balance Sheet'},{id:'cashflow',label:'Cash Flow'},{id:'ratios',label:'Ratio Analysis'}];
  var tabBar='<div style="display:inline-flex;gap:2px;background:var(--gray-100);border-radius:10px;padding:4px;flex:none;">'
    +tabs.map(function(t){
      var on=t.id===activeFRTab;
      return '<button onclick="window._frTab=\''+t.id+'\';renderMain(true)" style="font:inherit;font-size:.82rem;font-weight:'+(on?'700':'500')+';padding:8px 14px;border-radius:8px;border:none;background:'+(on?'#fff':'none')+';color:'+(on?'var(--blue)':'var(--fg-3)')+';cursor:pointer;box-shadow:'+(on?'0 1px 4px rgba(0,0,0,.1)':'none')+';white-space:nowrap;">'+t.label+'</button>';
    }).join('')+'</div>';

  return '<div style="background:#fff;margin:-26px -28px -48px;padding:26px 28px 48px;min-height:100%">'
    +'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:24px"><div class="ph-xl" style="margin-bottom:0"><h1>Financial <span class="acc">Results</span></h1><p>Annual income, balance sheet, cash flow &amp; ratios.</p></div>'+tabBar+'</div>'
    +'<div style="margin-bottom:20px">'+chart+'</div>'
    +'<div style="margin-bottom:4px">'+table+'</div></div>';
}
function frTip(e,txt,cxStr,tipId){
  var el=document.getElementById(tipId||'frTipEl');
  if(!el)return;
  var parts=txt.split('|');
  var fy=parts[0].replace('FY:','');
  var lines=parts.slice(1);
  el.innerHTML='<div style="font-size:.76rem;font-weight:400;color:#64748B;margin-bottom:7px;letter-spacing:.04em">'+fy+'</div>'
    +lines.map(function(l){
      var cc=l.split('::');
      var color=cc[0]; var rest=cc[1]||l;
      var kv=rest.split(': ');
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
        +'<span style="width:8px;height:8px;border-radius:50%;background:'+color+';flex-shrink:0"></span>'
        +'<span style="font-size:.8rem;color:#374151;flex:1">'+kv[0]+'</span>'
        +'<span style="font-size:.8rem;font-weight:400;color:#0F172A;margin-left:14px">'+kv[1]+'</span>'
        +'</div>';
    }).join('');
  var tipW=240;
  el.style.width=tipW+'px';
  el.style.display='block';
  // Use cxStr (fraction of viewBox W) to find column center in CSS px
  var svg=e.target.closest('svg');
  var svgRendW=svg ? svg.getBoundingClientRect().width : 400;
  var cx=cxStr ? parseFloat(cxStr) : 0.5;
  var colCenterCss=cx*svgRendW;
  // Position tooltip inside the SVG wrapper, top:10px, centered on column
  el.style.top='10px';
  el.style.left=Math.max(4, colCenterCss - tipW/2)+'px';
}
function frHide(tipId){var el=document.getElementById(tipId||'frTipEl');if(el)el.style.display='none';}

// NTA Performance candlestick — builds the "mmm yy  O0.785  H0.800  L0.780
// C0.790  +0.010 (+1.28%)" markup shown in the static info line above the
// plot area (no floating tooltip). Plain weight throughout, per spec.
function candleInfoHtml(tip){
  if(!tip) return '';
  var p=tip.split('|');
  var label=p[0],o=p[1],h=p[2],l=p[3],c=p[4],chg=p[5],chgPct=p[6],up=p[7]==='1';
  var col=up?'#2E7D32':'#DC2626';
  return '<span style="color:#0F172A;font-weight:400;margin-right:12px">'+label+'</span>'
    +'<span style="color:#0F172A;font-weight:400;margin-right:10px">O'+o+'</span>'
    +'<span style="color:#0F172A;font-weight:400;margin-right:10px">H'+h+'</span>'
    +'<span style="color:#0F172A;font-weight:400;margin-right:10px">L'+l+'</span>'
    +'<span style="color:#0F172A;font-weight:400;margin-right:10px">C'+c+'</span>'
    +'<span style="color:'+col+';font-weight:400">'+chg+' ('+chgPct+')</span>';
}
function candleInfo(tip,infoId){
  var el=document.getElementById(infoId);
  if(!el)return;
  el.innerHTML=candleInfoHtml(tip);
}

// ── COMING SOON ───────────────────────────────────────────────────────────────
function pgComingSoon(){
  var cfg={
    indices:{label:'Indices',icon:'<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',desc:'Real-time global and regional market indices — KLCI, S&P 500, Dow Jones and more in one place.',eta:'Q3 2025',features:['Live index prices & daily changes','Historical performance charts','Regional market overview']},
    watchlist:{label:'Watchlist',icon:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',desc:'Monitor your favourite securities side by side — price tracking and quick add from Holdings.',eta:'Q3 2025',features:['Custom security watchlists','Price & NTA alert notifications','One-click add from Holdings']},
    instruments:{label:'Instruments',icon:'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',desc:'Deep-dive fundamental data, financials and analytics for individual securities in the portfolio.',eta:'Q4 2025',features:['Company fundamentals & financials','Price & earnings history','Valuation ratios & metrics']}
  };
  var pg=S.page;
  var c=cfg[pg]||cfg.indices;
  var feats=c.features.map(function(f){
    return '<div style="display:flex;align-items:center;gap:10px;padding:13px 16px;background:#fff;border:1px solid var(--border);border-radius:12px;">'
      +'<div style="width:26px;height:26px;border-radius:7px;background:var(--blue-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
      +'<svg width="13" height="13" viewBox="0 0 24 24" stroke="var(--blue)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      +'</div>'
      +'<span style="font-size:.85rem;font-weight:500;color:var(--fg-1);">'+f+'</span>'
      +'</div>';
  }).join('');
  return '<div style="background:#fff;margin:-26px -28px -48px;padding:48px 40px 64px;min-height:calc(100vh - 60px);">'
    +'<div style="max-width:600px;margin:0 auto;">'
    +'<div style="background:linear-gradient(135deg,var(--blue-dark),var(--blue) 55%,var(--blue-light));border-radius:20px;padding:44px 40px;margin-bottom:24px;position:relative;overflow:hidden;">'
    +'<div style="position:absolute;top:-60px;right:-60px;width:240px;height:240px;border-radius:50%;background:rgba(255,255,255,.06);pointer-events:none;"></div>'
    +'<div style="position:absolute;bottom:-50px;left:50%;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,.04);pointer-events:none;"></div>'
    +'<div style="position:relative;">'
    +'<div style="display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.22);border-radius:99px;padding:5px 14px;margin-bottom:22px;">'
    +'<span style="width:7px;height:7px;border-radius:50%;background:#FFD700;flex-shrink:0;"></span>'
    +'<span style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.92);white-space:nowrap;">Coming Soon</span>'
    +'</div>'
    +'<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">'
    +'<div style="width:52px;height:52px;border-radius:14px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
    +'<svg width="24" height="24" viewBox="0 0 24 24" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">'+c.icon+'</svg>'
    +'</div>'
    +'<h2 style="font-size:1.8rem;font-weight:700;color:#fff;margin:0;letter-spacing:-.02em;">'+c.label+'</h2>'
    +'</div>'
    +'<p style="font-size:.92rem;color:rgba(255,255,255,.78);line-height:1.7;margin:0 0 20px;max-width:460px;">'+c.desc+'</p>'
    +'<div style="font-size:.76rem;color:rgba(255,255,255,.5);">Expected availability · <span style="color:rgba(255,255,255,.88);font-weight:600;">'+c.eta+'</span></div>'
    +'</div></div>'
    +'<div style="margin-bottom:28px;">'
    +'<div style="font-size:.67rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--fg-3);margin-bottom:12px;">Upcoming features</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px;">'+feats+'</div>'
    +'</div>'
    +'<button onclick="csDashboard()" style="font:inherit;font-size:.86rem;font-weight:600;padding:10px 22px;border-radius:10px;border:1.5px solid var(--border);background:#fff;color:var(--fg-2);cursor:pointer;display:inline-flex;align-items:center;gap:8px;">'
    +'<svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
    +'Back to Dashboard</button>'
    +'</div></div>';
}

function renderMain(instant) {
  var m=document.getElementById('mainContent');
  if(!m) return;
  var fns={dashboard:pgDashboard,fundoverview:pgFundOverview,holdings:pgHoldings,transactions:pgTransactions,distributions:pgDistributions,statements:pgStatements,factsheet:pgFactsheet,shareholders:pgShareholders,ntahistory:pgNtaHistory,comparison:pgComparison,financialresults:pgFinancialResults,indices:pgComingSoon,watchlist:pgComingSoon,instruments:pgComingSoon,profile:pgProfile,password:pgPassword,nominee:pgNominee};
  var go=function(){
    try{
      m.innerHTML=(fns[S.page]||pgDashboard)();
    }catch(e){
      m.innerHTML='<div style="padding:28px;color:#DC2626"><b>Render error:</b> '+e.message+'</div>';
    }
    m.style.opacity='1';
    if(S.page==='dashboard') setTimeout(function(){initChart(S.period);},60);
  };
  if(instant){go();}else{m.style.opacity='0';setTimeout(go,100);}
}

// ── MODALS ───────────────────────────────────────────────────────────────────
// ── SUBSCRIBE / REDEEM MODALS ────────────────────────────────────────────────
var NTA_PRICE=0, UNITS_HELD=0, MAX_VAL=0;
// Called after live data loads — NTA_PRICE comes from real NTA history.
// UNITS_HELD / MAX_VAL have no live per-investor capital-account source in
// this portal yet, so they stay 0 and the UI shows "—" instead of a fake number.
function refreshLiveConstants(){
  var v = NTA && NTA.all && NTA.all.v;
  NTA_PRICE = (v && v.length) ? v[v.length-1] : 0;
}
function fmtMYR(n){return n.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});}
function parseMYR(s){return parseFloat((s||'').replace(/,/g,''))||0;}
var subFileSet=false;

function populateSRModal(){
  var name = (PROFILE && (PROFILE.preferred_name || PROFILE.full_name)) || (AUTH_USER && AUTH_USER.email) || '—';
  setText('srSubRef',        (PROFILE && PROFILE.investor_id) || '—');
  setText('srMemberName',    name);
  setText('srMemberId',      (PROFILE && PROFILE.investor_id) || '—');
  setText('srUnitsHeld',     UNITS_HELD>0 ? fmtMYR(UNITS_HELD) : '—');
  setText('srCurrentValue',  MAX_VAL>0 ? 'RM '+fmtMYR(MAX_VAL) : '—');
  setText('srPayoutBank',    (PROFILE && PROFILE.bank_name) || '—');
  setText('srPayoutAcct',    (PROFILE && PROFILE.bank_account_no) ? ('···· ···· '+String(PROFILE.bank_account_no).slice(-4)) : '—');
  setText('subNtaLbl',       NTA_PRICE>0 ? NTA_PRICE.toFixed(4) : '—');
  setText('redNtaLbl',       NTA_PRICE>0 ? NTA_PRICE.toFixed(4) : '—');
  setText('redUnitsHeldLbl', UNITS_HELD>0 ? fmtMYR(UNITS_HELD) : '—');
}

function openSR(type){
  subFileSet=false;
  populateSRModal();
  if(type==='subscribe'){
    document.getElementById('subAmt').value='';
    document.getElementById('subUnits').value='—';

    document.getElementById('subDrop').classList.remove('filled');
    document.getElementById('subFname').textContent='Click to upload your bank transfer slip (PDF/JPG/PNG)';
    document.getElementById('sfAmt').classList.remove('show-err');
    document.getElementById('sfFile').classList.remove('show-err');
    document.getElementById('subModal').classList.add('vis');
  } else {
    document.getElementById('redAmt').value='';
    document.getElementById('redUnitsIn').value='';
    document.getElementById('redOut').value='—';

    document.getElementById('rfAmt').classList.remove('show-err');
    document.getElementById('redModal').classList.add('vis');
  }
  document.getElementById('srScrim').classList.add('vis');
}
function closeSR(){
  document.querySelectorAll('.sr-modal').forEach(function(m){m.classList.remove('vis');});
  document.getElementById('srScrim').classList.remove('vis');
}

// ── Transaction document viewer (Transactions page row click) ──────────────
function openTxDoc(ref){
  var t = TXS.filter(function(x){return x.ref===ref;})[0];
  var refEl = document.getElementById('txDocRef');
  var body  = document.getElementById('txDocBody');
  var modal = document.getElementById('txDocModal');
  var scrim = document.getElementById('txDocScrim');
  if(!modal || !scrim || !body) return; // modal not present on this page
  if(refEl) refEl.textContent = ref;
  if(t && t.doc){
    var url = t.doc;
    var ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
    var html;
    if(['jpg','jpeg','png','gif','webp'].indexOf(ext) > -1){
      html = '<img src="'+url+'" style="width:100%;border-radius:8px;border:1px solid var(--border);display:block">';
    } else {
      html = '<iframe src="'+url+'" title="Document" style="width:100%;height:460px;border-radius:8px;border:1px solid var(--border);display:block"></iframe>';
    }
    html += '<a href="'+url+'" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;font-size:.83rem;font-weight:600;color:var(--blue);text-decoration:none;padding:7px 13px;border:1px solid var(--blue);border-radius:8px;margin-top:12px">↗ Open in new tab</a>';
    body.innerHTML = html;
  } else {
    body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:260px;color:var(--fg-3);font-size:.85rem;gap:10px"><span style="font-size:2.5rem">📄</span>No document attached</div>';
  }
  modal.classList.add('vis');
  scrim.classList.add('vis');
}
function closeTxDoc(){
  var modal = document.getElementById('txDocModal');
  var scrim = document.getElementById('txDocScrim');
  if(modal) modal.classList.remove('vis');
  if(scrim) scrim.classList.remove('vis');
}
function simFileUpload(who){
  if(who==='sub'){subFileSet=true;document.getElementById('subDrop').classList.add('filled');document.getElementById('subFname').textContent='deposit-slip.pdf · attached';document.getElementById('sfFile').classList.remove('show-err');}
}
function setSubAmt(v){
  document.getElementById('subAmt').value=fmtMYR(v);
  document.getElementById('subUnits').value=(NTA_PRICE>0)?(fmtMYR(v/NTA_PRICE)+' units'):'—';
  document.getElementById('sfAmt').classList.remove('show-err');
}
function setRedPct(pct){
  var units=UNITS_HELD*pct/100;
  document.getElementById('redUnitsIn').value=(units>0)?fmtMYR(units):'';
  document.getElementById('redAmt').value=(units>0&&NTA_PRICE>0)?fmtMYR(units*NTA_PRICE):'';
  document.getElementById('redOut').value=(units>0&&NTA_PRICE>0)?(fmtMYR(units*NTA_PRICE)+' RM'):'—';
  document.getElementById('rfAmt').classList.remove('show-err');
}
function redAmtChanged(){
  var a=parseMYR(document.getElementById('redAmt').value);
  if(a>0 && NTA_PRICE>0){
    var u=a/NTA_PRICE;
    document.getElementById('redUnitsIn').value=fmtMYR(u);
    document.getElementById('redOut').value=fmtMYR(u)+' units';
  } else {
    document.getElementById('redUnitsIn').value='';
    document.getElementById('redOut').value='—';
  }
}
function redUnitsChanged(){
  var u=parseMYR(document.getElementById('redUnitsIn').value);
  if(u>0 && NTA_PRICE>0){
    var a=u*NTA_PRICE;
    document.getElementById('redAmt').value=fmtMYR(a);
    document.getElementById('redOut').value='RM '+fmtMYR(a);
  } else {
    document.getElementById('redAmt').value='';
    document.getElementById('redOut').value='—';
  }
}
var _sa=document.getElementById('subAmt');if(_sa)_sa.addEventListener('input',function(){
  var a=parseMYR(this.value);
  document.getElementById('subUnits').value=(a>0&&NTA_PRICE>0)?(fmtMYR(a/NTA_PRICE)+' units'):'—';
});
function submitSub(){
  var a=parseMYR(document.getElementById('subAmt').value);
  var ok=true;
  if(a<=0){document.getElementById('sfAmt').classList.add('show-err');ok=false;}else{document.getElementById('sfAmt').classList.remove('show-err');}
  if(!subFileSet){document.getElementById('sfFile').classList.add('show-err');ok=false;}else{document.getElementById('sfFile').classList.remove('show-err');}
  if(!ok)return;
  closeSR();
  setTimeout(function(){showToast('Subscription of RM '+fmtMYR(a)+' submitted for review','success');},200);
}
function submitRed(){
  var a=parseMYR(document.getElementById('redAmt').value);
  var ok=true;
  if(a<=0||a>MAX_VAL){document.getElementById('rfAmt').classList.add('show-err');ok=false;}else{document.getElementById('rfAmt').classList.remove('show-err');}
  if(!ok)return;
  closeSR();
  setTimeout(function(){showToast('Redemption of RM '+fmtMYR(a)+' submitted — 15 business days','orange');},200);
}

// ── NOTIFICATIONS ────────────────────────────────────────────────────────────
function toggleNotif(){
  var p=document.getElementById('npanel');
  p.classList.toggle('open');
  if(p.classList.contains('open')){document.getElementById('notifDot').style.display='none';document.getElementById('userMenu').classList.remove('open');}
}
function renderNotifs(){
  document.getElementById('nlist').innerHTML=NOTIFS.map(function(n){
    return '<div class="nitem'+(n.unread?' unread':'')+'"><div class="ni-dot" style="'+(n.unread?'':'background:var(--gray-200)')+'"></div><div style="flex:1"><div style="font-size:.86rem;font-weight:600;color:var(--fg-1);margin-bottom:3px">'+n.title+'</div><div style="font-size:.8rem;color:var(--fg-3);line-height:1.5">'+n.body+'</div><div style="font-size:.72rem;color:var(--fg-3);margin-top:6px">'+n.time+'</div></div></div>';
  }).join('');
}

// ── USER MENU ────────────────────────────────────────────────────────────────
function toggleUserMenu(){document.getElementById('userMenu').classList.toggle('open');document.getElementById('npanel').classList.remove('open');}

// ── SEARCH ───────────────────────────────────────────────────────────────────
function toggleSearch(){
  var ov=document.getElementById('soverlay');
  var open=ov.style.display==='flex';
  ov.style.display=open?'none':'flex';
  if(!open)setTimeout(function(){document.getElementById('sinp').focus();},50);
}
function renderSearch(q){
  var r=document.getElementById('sresults');
  if(!q){r.innerHTML='<div style="padding:10px 12px;font-size:.8rem;color:var(--fg-3)">Type to search — holdings, transactions, documents</div>';return;}
  var ql=q.toLowerCase();
  var items=[];
  HOLDINGS.forEach(function(h){if(h.n.toLowerCase().includes(ql)||h.t.toLowerCase().includes(ql))items.push({label:h.n,sub:h.t+' · '+h.sec,page:'holdings'});});
  TXS.forEach(function(t){if(t.ref.toLowerCase().includes(ql)||t.type.toLowerCase().includes(ql))items.push({label:t.ref,sub:t.type+' · '+t.date,page:'transactions'});});
  DOCS.forEach(function(d){if(d.n.toLowerCase().includes(ql))items.push({label:d.n,sub:d.type+' · '+d.date,page:'statements'});});
  if(!items.length){r.innerHTML='<div style="padding:10px 12px;font-size:.8rem;color:var(--fg-3)">No results for "'+q+'"</div>';return;}
  r.innerHTML=items.slice(0,6).map(function(it){
    return '<div class="sitem" onclick="toggleSearch();navigate(\''+it.page+'\')"><div style="width:32px;height:32px;border-radius:8px;background:var(--blue-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg></div><div style="flex:1;min-width:0"><div style="font-size:.86rem;font-weight:600;color:var(--fg-1)">'+it.label+'</div><div style="font-size:.74rem;color:var(--fg-3)">'+it.sub+'</div></div></div>';
  }).join('');
}

// ── TOAST ────────────────────────────────────────────────────────────────────
var toastTimer;
function showToast(msg,type){
  var t=document.getElementById('toast');
  t.textContent=msg;
  t.style.background=type==='success'?'var(--green)':type==='orange'?'var(--orange)':type==='error'?'var(--red)':'var(--fg-1)';
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){t.classList.remove('show');},4000);
}

// ── LOGIN ────────────────────────────────────────────────────────────────────
function doLogout(){
  document.getElementById('userMenu').classList.remove('open');
  try{['zy-page','zy_token','zy_role','zy_name','zy_investor_id','zy-session','zy-email'].forEach(function(k){localStorage.removeItem(k);});}catch(e){}
  if(typeof sb!=='undefined'&&sb){
    sb.auth.signOut().then(function(){window.location.href='../../login.html';}).catch(function(){window.location.href='../../login.html';});
  } else { window.location.href='../../login.html'; }
}
function doLogin(){
  var e=document.getElementById('lemail').value, p=document.getElementById('lpwd').value;
  if(!e||!p){showToast('Please enter your email and password','error');return;}
  try{localStorage.setItem('zy-session','1');localStorage.setItem('zy-email',e);}catch(err){}
  document.getElementById('lscreen').style.display='none';
  showToast('Welcome back, '+e+'.','success');
}

// ── INIT ─────────────────────────────────────────────────────────────────────
// Run immediately — script is at end of body so DOM is ready
function ensurePieTip(){
  var t=document.getElementById('pieTip');
  if(!t){
    t=document.createElement('div');
    t.id='pieTip';
    t.style.cssText='position:fixed;opacity:0;transition:opacity .12s;pointer-events:none;background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:7px 11px;font-size:.78rem;font-weight:400;color:#0F172A;box-shadow:0 6px 20px rgba(0,0,0,.13);z-index:999;white-space:nowrap';
    document.body.appendChild(t);
  }
  return t;
}
function showPieTip(e,txt){var t=ensurePieTip();t.textContent=txt;t.style.opacity='1';t.style.left=(e.clientX+14)+'px';t.style.top=(e.clientY-36)+'px';}
function hidePieTip(){var t=document.getElementById('pieTip');if(t)t.style.opacity='0';}
document.addEventListener('mousemove',function(e){var t=document.getElementById('pieTip');if(t&&t.style.opacity!=='0'){t.style.left=(e.clientX+14)+'px';t.style.top=(e.clientY-36)+'px';}});
// Group pie tooltip — one shared tooltip for an entire donut (e.g.
// Distribution Payout Ratio), rendered as a header line ("FYxxxx") plus
// one line per metric, rather than a single-line per-slice tooltip.
// data-tip carries a plain 'HEADER|line1|line2|...' string (never raw
// HTML) so it stays safe to embed as an HTML attribute.
function ensureGroupPieTip(){
  var t=document.getElementById('groupPieTip');
  if(!t){
    t=document.createElement('div');
    t.id='groupPieTip';
    t.style.cssText='position:fixed;opacity:0;transition:opacity .12s;pointer-events:none;background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:8px 12px;font-size:.78rem;font-weight:400;color:#0F172A;box-shadow:0 6px 20px rgba(0,0,0,.13);z-index:999;line-height:1.5;white-space:nowrap';
    document.body.appendChild(t);
  }
  return t;
}
function showGroupPieTip(e,raw){
  var t=ensureGroupPieTip();
  var parts=(raw||'').split('|');
  var header=parts[0]||'';
  var lines=parts.slice(1);
  t.innerHTML='<div style="color:#64748B;margin-bottom:5px">'+header+'</div>'
    +lines.map(function(l){return '<div style="margin-bottom:2px">'+l+'</div>';}).join('');
  t.style.opacity='1';
  t.style.left=(e.clientX+14)+'px';
  t.style.top=(e.clientY-46)+'px';
}
function hideGroupPieTip(){var t=document.getElementById('groupPieTip');if(t)t.style.opacity='0';}
document.addEventListener('mousemove',function(e){var t=document.getElementById('groupPieTip');if(t&&t.style.opacity!=='0'){t.style.left=(e.clientX+14)+'px';t.style.top=(e.clientY-46)+'px';}});
// [init removed for standalone page]
document.addEventListener('click',function(e){
  if(!e.target.closest('#npanel')&&!e.target.closest('#notifBtn'))document.getElementById('npanel').classList.remove('open');
  if(!e.target.closest('#userMenu')&&!e.target.closest('#userBtn'))document.getElementById('userMenu').classList.remove('open');
  if(!e.target.closest('.sbox')&&e.target.closest('#soverlay'))document.getElementById('soverlay').style.display='none';
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){closeSR();document.getElementById('soverlay').style.display='none';document.getElementById('npanel').classList.remove('open');}});
var tk=document.querySelector('.ticker-track');
if(tk){tk.addEventListener('mouseenter',function(){tk.style.animationPlayState='paused';});tk.addEventListener('mouseleave',function(){tk.style.animationPlayState='running';});}
window.addEventListener('scroll',function(){document.getElementById('topnav').classList.toggle('scrolled',window.scrollY>5);},{passive:true});
