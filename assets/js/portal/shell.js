/* ===== assets/js/portal/shell.js — Auth guard, global page state, nav helper, live-data loading, base chart init, small formatters ===== */
/* ============================================================
   ZY-Invest Member Portal — Shared Application Logic
   Shared across all desktop/*.html pages.
   Requires supabase-auth.js (sb client) loaded first.
   Expects the including page to declare `var S = {...}` and the
   page-specific render dispatch (see bottom of each *.html file)
   in its own inline <script> tag after this file loads.
   ============================================================ */
// ── AUTH GATE ────────────────────────────────────────────────────────────────
// The local zy-session/zy_token flags are a fast, synchronous hint — not the
// source of truth. They can drift out of sync with the real Supabase session
// (expiry, storage eviction, etc.). Previously this only checked the flags,
// while loadLiveData() below separately checked the *real* session and
// redirected on its own if invalid — and login.html's own "already logged
// in?" check trusted the flags too. When the flags were stale (present) but
// the real session had expired, login.html bounced here on the stale flags
// and loadLiveData() immediately bounced back once it found no real
// session: an infinite loop that looked like the app had crashed. Now: the
// real session always wins. A valid session heals the local flags instead
// of triggering a bounce; only a genuinely absent session (or no session at
// all, with no flags either) redirects to login.
(function(){
  var hasFlags = !!(localStorage.getItem('zy-session') || localStorage.getItem('zy_token'));
  function toLogin(){ window.location.href='../login.html'; }
  if (typeof sb === 'undefined' || !sb) { if (!hasFlags) toLogin(); return; }
  sb.auth.getSession().then(function(s){
    if (s && s.data && s.data.session) {
      try{ localStorage.setItem('zy-session','1'); }catch(e){}
    } else {
      try{ localStorage.removeItem('zy-session'); localStorage.removeItem('zy_token'); }catch(e){}
      toLogin();
    }
  }).catch(function(){ if (!hasFlags) toLogin(); });
})();
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
    if(!authUser){
      try{ localStorage.removeItem('zy-session'); localStorage.removeItem('zy_token'); }catch(e){}
      window.location.href='../login.html'; return;
    }
    try{ localStorage.setItem('zy-session','1'); }catch(e){}

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
    +'<svg id="ntaChart" viewBox="0 0 '+W+' '+H+'" style="width:100%;height:180px;display:block;cursor:crosshair;touch-action:pan-y" preserveAspectRatio="none">'
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
