/* ===== assets/js/phone/profile-account.js — Profile/account data loading, capital-injection summary rendering ===== */
// ── PROFILE DATA (real, from Supabase) ─────────────────────────────────────
var PROFILE=null, AUTH_USER=null;
// True while the account is pending approval or suspended — gates sensitive
// fund figures (Market Value/Total Shares header + the Results/Portfolio/
// Shareholder tabs) on the Fund page. See applyFundRestriction() below and
// its call sites in assets/js/phone/financial-charts-1.js and
// assets/js/phone/markets-actions.js.
var ACCOUNT_RESTRICTED=false;
function mpInitialsPhone(name){
  if(!name) return '—';
  var parts=String(name).trim().split(/\s+/);
  return ((parts[0]||'')[0]||'').toUpperCase()+((parts[1]||'')[0]||'').toUpperCase();
}
async function loadProfileData(){
  var sess=null;
  try{
    if(typeof sb==='undefined'||!sb) return;
    sess=await sb.auth.getSession();
    var user=sess.data&&sess.data.session&&sess.data.session.user;
    if(!user) return;
    AUTH_USER=user;
    PROFILE=await mpLoadProfile(user.id);
  }catch(e){ console.warn('Profile load failed:', e.message); PROFILE=PROFILE||{}; }
  applyProfileToUI();
  if(!appLockInitialCheckDone){
    appLockInitialCheckDone=true;
    // Pass the session already confirmed a couple lines up straight through,
    // instead of having checkAppLockOnLoad()/verifySessionThenLock() await
    // sb.auth.getSession() a second time — that redundant round trip was
    // part of why the boot splash (index.html) sat there longer than it
    // needed to on a slow connection. Every OTHER call to
    // verifySessionThenLock() (resume from background, focus, etc.) still
    // does a fresh real check, since time has actually passed for those.
    if(typeof checkAppLockOnLoad==='function') checkAppLockOnLoad(sess);
  }
}
function applyProfileToUI(){
  var P=PROFILE||{};
  var name=P.full_name||P.preferred_name||(AUTH_USER&&AUTH_USER.email)||'Member';
  var email=(AUTH_USER&&AUTH_USER.email)||'';
  var initials=mpInitialsPhone(name);
  document.querySelectorAll('.prof-name').forEach(function(el){el.textContent=name;});
  document.querySelectorAll('.prof-email').forEach(function(el){el.textContent=email;});
  document.querySelectorAll('.prof-av-lg,.avatar-sm').forEach(function(el){el.textContent=initials;});
  // profiles has no separate investor_id column — id (the profile's own
  // uuid) is the only real per-member identifier in this schema.
  var shortId=P.id?String(P.id).slice(0,8).toUpperCase():'—';
  var badgeLabel=(typeof t==='function')?(P.status==='pending'?t('me.badgeUser'):t('me.badgeVerified')):(P.status==='pending'?'USER':'Verified Investor');
  document.querySelectorAll('.prof-badge').forEach(function(el){el.textContent=badgeLabel+' · '+shortId;});
  if(typeof updatePinDisplay==='function') updatePinDisplay();
  ACCOUNT_RESTRICTED=(P.status==='pending'||P.status==='suspended');
  if(typeof applyFundRestriction==='function') applyFundRestriction();
}

// Kick off the session/profile check — and therefore the App Lock decision
// in checkAppLockOnLoad() below — immediately on script load, rather than
// waiting for misc.js's loadPages() to first fetch and mount all of the
// Fund/Discover/Market/Watchlist/etc. page fragments (several parallel
// network requests that can take a while on a slow connection). Previously
// the App Lock check only ran after all of that finished, so the
// already-rendered dashboard shell stayed visible far longer than
// necessary before the PIN lock (or an invalid-session redirect) appeared.
// This call and the one loadPages() still makes afterward (to re-run
// applyProfileToUI() against the .prof-name/.prof-email/etc. elements that
// only exist once those fragments are mounted) are both safe to run twice:
// checkAppLockOnLoad() itself is guarded by appLockInitialCheckDone below.
loadProfileData();

// ── ACCOUNT SUMMARY (real data) ─────────────────────────────────────────────
// PA: capital_injection rows where uid = profiles.id (the logged-in user's
// own account). JA: same computation, but keyed on profiles.joint_account_id
// instead — a joint account has no login of its own, so its capital_injection
// rows are filed under that shared id rather than a person's id.
var PA_ACCT=null, JA_ACCT=null, LATEST_NTA=0, LATEST_NTA_DATE=null, TOTAL_ISSUED_UNITS=0;
var PA_CI_ROWS=[], JA_CI_ROWS=[];
// The fund's deposit-destination bank account, shown on the Subscribe
// sheet — loaded independently of the account summary above so a failure
// here (or there) never blocks the other.
var ADMIN_BANK=null;
async function loadAdminBankAccount(){
  try{ ADMIN_BANK=await mpLoadAdminBankAccount(); }
  catch(e){ console.warn('Admin bank account load failed:', e.message); }
}

function fmtMoney(v){ return (v||0).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtUnits(v){ return (v||0).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtNta(v){ return (v||0).toLocaleString('en-MY',{minimumFractionDigits:4,maximumFractionDigits:4}); }
function fmtDateShort(d){
  if(!d) return '—';
  var dt=new Date(d+'T00:00:00');
  return dt.toLocaleDateString('en-MY',{day:'2-digit',month:'short',year:'2-digit'});
}

// Computes units/VWAP/MV/Cost/Realized/Return for one account id (either a
// profile's own id for PA, or a joint account id for JA) from capital_injection.
// The returned rows are every row regardless of status (the Transaction
// list needs Pending ones too, to show as "Pending" rather than omit them
// entirely) — but the units/value totals below only ever count Approved
// rows, matching the same status filter used everywhere else this table
// is queried (mpLoadCapitalSummary, mpLoadShareholders, etc. in
// member-api.js), so a still-Pending request never inflates the member's
// displayed holdings before it's actually been approved.
async function computeAccountFromCapitalInjection(acctId, latestNta){
  if(!acctId) return {rows:[],result:null};
  var { data, error } = await sb.from('capital_injection').select('reference_id, type, units, amount, date, status, nta').eq('uid', acctId);
  if(error){ console.warn('[Account Summary] capital_injection load failed for', acctId, ':', error.message); return {rows:[],result:null}; }
  var rows=data||[];
  console.log('[Account Summary] capital_injection rows for uid='+acctId+':', rows.length);
  if(!rows.length) console.warn('[Account Summary] No rows returned for uid='+acctId+'. If this account should have transactions, check the capital_injection RLS policy allows reading rows where uid matches profiles.joint_account_id (not just auth.uid()).');
  var units=0, buyUnits=0, buyAmount=0;
  rows.forEach(function(r){
    if(r.status!=='Approved') return;
    var u=parseFloat(r.units)||0;
    var a=parseFloat(r.amount)||0;
    units+=u;
    if(u>0){ buyUnits+=u; buyAmount+=a; } // VWAP uses subscriptions (buys) only
  });
  var vwap=buyUnits?(buyAmount/buyUnits):0;
  var mv=units*(latestNta||0);
  var cost=vwap*units;
  var realized=mv-cost;
  var returnPct=cost?(realized/cost*100):0;
  return {rows:rows, result:{units:units, vwap:vwap, mv:mv, cost:cost, realized:realized, returnPct:returnPct}};
}

async function loadAccountSummary(){
  try{
    if(typeof sb==='undefined'||!sb) return;
    if(!AUTH_USER){
      var sess=await sb.auth.getSession();
      AUTH_USER=sess.data&&sess.data.session&&sess.data.session.user;
    }
    if(!AUTH_USER) return;
    if(!PROFILE) PROFILE=await mpLoadProfile(AUTH_USER.id);
    var P=PROFILE||{};

    // total_units is the fund's total issued units as of that date — used
    // for Stake (this account's units ÷ total issued units), not just the
    // member's own PA+JA combined units.
    var ntaRes=await sb.from('nta_daily').select('date,nta,total_units').order('date',{ascending:false}).limit(1);
    var latestRow=(ntaRes.data&&ntaRes.data[0])||null;
    LATEST_NTA=latestRow?parseFloat(latestRow.nta):0;
    LATEST_NTA_DATE=latestRow?latestRow.date:null;
    TOTAL_ISSUED_UNITS=latestRow?parseFloat(latestRow.total_units):0;

    PA_ACCT=null; JA_ACCT=null;
    var paLoad=await computeAccountFromCapitalInjection(P.id, LATEST_NTA);
    PA_ACCT=paLoad.result; PA_CI_ROWS=paLoad.rows;
    console.log('[Account Summary] profile.joint_account_id =', P.joint_account_id);
    if(P.joint_account_id){
      var jaLoad=await computeAccountFromCapitalInjection(P.joint_account_id, LATEST_NTA);
      JA_ACCT=jaLoad.result; JA_CI_ROWS=jaLoad.rows;
    } else {
      JA_CI_ROWS=[];
    }
  }catch(e){
    console.warn('Account summary load failed:', e.message);
  }finally{
    // Always render — even a partial failure above (e.g. NTA query error)
    // must not block Transactions/Distributions, which only need whatever
    // PA_CI_ROWS/JA_CI_ROWS were actually populated.
    renderAccountSummary();
  }
}

function renderAccountSummary(){
  // Runs first and independently — a problem rendering the account cards
  // below must never prevent Transactions/Distributions from loading.
  try{
    if(typeof buildTxDataFromCi==='function'){
      TX_DATA=buildTxDataFromCi();
      if(document.getElementById('txList')) renderTxList();
    }
    if(typeof loadDistributionHistory==='function') loadDistributionHistory();
  }catch(e){ console.warn('[Transactions/Distributions] load failed:', e.message); }

  var pa=PA_ACCT, ja=JA_ACCT;
  var totalValue=(pa?pa.mv:0)+(ja?ja.mv:0);
  var totalPortfolioEl=document.getElementById('portfolioValue');
  if(totalPortfolioEl) totalPortfolioEl.setAttribute('data-real', fmtMoney(totalValue));

  function fill(prefix,acct){
    var up=acct&&acct.realized>=0;
    // Stake = this account's units ÷ the fund's total issued units
    // (nta_daily.total_units, latest date) — not just this member's own
    // PA+JA units combined.
    var stake=(acct&&TOTAL_ISSUED_UNITS)?(acct.units/TOTAL_ISSUED_UNITS*100):0;
    setText(prefix+'Value', acct?fmtMoney(acct.mv):'0.00');
    setText(prefix+'PL', acct?((up?'+':'')+fmtMoney(acct.realized)):'0.00', up?'var(--green)':'var(--red)');
    var unitsHeldSuffix=(typeof t==='function')?t('portfolio.unitsHeldSuffix'):' units held';
    setText(prefix+'UnitsHeldLbl', (acct?fmtUnits(acct.units):'0.00')+unitsHeldSuffix);
    setText(prefix+'Units', acct?fmtUnits(acct.units):'0.00');
    setText(prefix+'Stake', acct?(stake.toFixed(2)+'%'):'0.00%');
    setText(prefix+'LatestDate', fmtDateShort(LATEST_NTA_DATE));
    setText(prefix+'Price', fmtNta(LATEST_NTA));
    setText(prefix+'Vwap', acct?fmtNta(acct.vwap):'0.0000');
    setText(prefix+'Mv', acct?fmtMoney(acct.mv):'0.00');
    setText(prefix+'Cost', acct?fmtMoney(acct.cost):'0.00');
    setText(prefix+'Realized', acct?((up?'+':'')+fmtMoney(acct.realized)):'0.00', up?'var(--green)':'var(--red)');
    setText(prefix+'ReturnPct', acct?((up?'+':'')+acct.returnPct.toFixed(2)+'%'):'0.00%', up?'var(--green)':'var(--red)');
  }
  function setText(id,txt,color){
    var el=document.getElementById(id);
    if(!el) return;
    el.setAttribute('data-real', txt);
    if(color) el.style.color=color;
    if(portfolioVisible) el.textContent=txt;
  }
  fill('pa', pa);
  fill('ja', ja);

  // Joint Account card only shows if the profile actually has a joint account.
  var jaWrap=document.getElementById('jaCardWrap'), jaExpand=document.getElementById('jointExpandPanel'), jaBtn=document.getElementById('jointExpandBtn');
  var hasJa=!!ja;
  if(jaWrap) jaWrap.style.display=hasJa?'':'none';
  if(!hasJa && jaExpand) jaExpand.style.display='none';
  if(jaBtn) jaBtn.style.display=hasJa?'':'none';

  if(totalPortfolioEl && portfolioVisible) totalPortfolioEl.textContent=fmtMoney(totalValue);
  applyEyeVisibility();
  if(typeof drawAdDonut==='function') drawAdDonut();
}

// ── ACCOUNT DETAILS (Assets / Principal / Distribution / Profile tabs) ──────
// Opened from the Personal/Joint Account grey boxes' own chevrons
// (#personalExpandBtn/#jointExpandBtn in index.html) — the overall
// "Account Summary" section chevron (toggleAcctExpand(), misc.js) is
// unrelated and unchanged; it still expands the inline panels in place.
var AD_ACCT='pa';   // 'pa' | 'ja' — which account this page is showing
var AD_TAB='assets';
function openAccountDetails(acct){
  AD_ACCT=acct;
  AD_TAB='assets';
  // Sensitive co-holder data must re-lock every time this page is opened
  // fresh (this is the only entry point into 'accountdetails') — "leaving
  // the page" always requires the PIN again, no persisted unlock.
  AD_PROFILE_UNLOCKED=false;
  switchTab('accountdetails');
  // Top bar keeps the static DRILL_PAGES title ("Account Details") and its
  // back button only — the account is instead chosen via the #adAcctSelect
  // dropdown at the top of the body (renderAcctSelector()/switchAdAccount()).
}
function renderAccountDetails(){
  var profileBtn=document.getElementById('adtab-profile-btn');
  if(profileBtn) profileBtn.style.display=(AD_ACCT==='ja')?'':'none';
  // A personal account can never land on the joint-only Profile tab.
  if(AD_ACCT!=='ja' && AD_TAB==='profile') AD_TAB='assets';
  renderAcctSelector();
  switchAcctDetailTab(AD_TAB);
}
// Populates the account-switcher dropdown — "Joint Account" only appears
// once a joint account is confirmed to exist — and syncs its selected
// value + leading icon to AD_ACCT (needed since renderAccountDetails() can
// flip AD_TAB, e.g. bouncing PA off the Profile tab, without the user
// touching the dropdown itself).
function renderAcctSelector(){
  var sel=document.getElementById('adAcctSelect');
  if(sel){
    var hasJa=!!(PROFILE && PROFILE.joint_account_id);
    var ttSel=(typeof t==='function')?t:function(k){return k;};
    sel.innerHTML='<option value="pa">'+ttSel('portfolio.personalAccount')+'</option>'
      +(hasJa?'<option value="ja">'+ttSel('portfolio.jointAccount')+'</option>':'');
    sel.value=AD_ACCT;
  }
  var iconPa=document.getElementById('adAcctIconPa');
  var iconJa=document.getElementById('adAcctIconJa');
  if(iconPa) iconPa.style.display=(AD_ACCT==='ja')?'none':'block';
  if(iconJa) iconJa.style.display=(AD_ACCT==='ja')?'block':'none';
}
// Switching accounts via the dropdown stays on the same page (not a
// "leave"), so it does NOT reset AD_PROFILE_UNLOCKED — only re-opening the
// page fresh via openAccountDetails() does that. Reuses
// renderAccountDetails() for the same profile-tab-visibility/bounce logic
// the initial open already does.
function switchAdAccount(acct){
  AD_ACCT=acct;
  renderAccountDetails();
}
function switchAcctDetailTab(tab){
  AD_TAB=tab;
  ['assets','principal','distribution','profile'].forEach(function(t){
    var body=document.getElementById('adtab-'+t+'-body');
    var btn=document.getElementById('adtab-'+t+'-btn');
    if(body) body.style.display=tab===t?'block':'none';
    if(btn){ btn.style.color=tab===t?'var(--blue)':'var(--fg-3)'; btn.style.borderBottomColor=tab===t?'var(--blue)':'transparent'; }
  });
  var scroll=document.getElementById('mainScroll');
  if(scroll) scroll.scrollTop=0;
  if(tab==='assets') renderAssetsTab();
  else if(tab==='principal') renderPrincipalTab();
  else if(tab==='distribution') renderDistributionTab();
  else if(tab==='profile') enterProfileTab();
}

// ── ASSETS TAB — AVCO (average cost) over the same capital_injection rows
// already loaded for Account Summary (PA_CI_ROWS/JA_CI_ROWS) — no second
// query. VWAP (computeAccountFromCapitalInjection above) only tracks
// unrealized gain on currently-held units; AVCO is needed here because
// realized P&L requires knowing the cost basis consumed by each sell,
// same algorithm as member-api.js's mpLoadCapitalSummary() (used by the
// desktop portal), just run over rows already in memory instead of a
// fresh query. ──────────────────────────────────────────────────────────
function computeAvcoFromRows(ciRows){
  var rows=(ciRows||[]).filter(function(r){return r.status==='Approved';})
    .slice().sort(function(a,b){return a.date<b.date?-1:(a.date>b.date?1:0);});
  var runUnits=0, runCost=0, realizedPnl=0, cashflows=[], totalSubscribed=0, earliestDate=null;
  rows.forEach(function(r){
    var u=parseFloat(r.units)||0, amt=Math.abs(parseFloat(r.amount)||0);
    if(!earliestDate || r.date<earliestDate) earliestDate=r.date;
    if(u>0){
      runCost+=amt; runUnits+=u; totalSubscribed+=amt;
      cashflows.push({date:r.date, amount:-amt});
    } else if(u<0){
      var sellUnits=Math.min(Math.abs(u),runUnits);
      if(runUnits>0 && sellUnits>0){
        var avg=runCost/runUnits;
        var salePrice=(r.nta!=null && r.nta!=='')?parseFloat(r.nta):(sellUnits>0?amt/sellUnits:0);
        realizedPnl+=(salePrice-avg)*sellUnits;
        runUnits-=sellUnits;
        runCost=runUnits>0?runCost-avg*sellUnits:0;
      }
      cashflows.push({date:r.date, amount:amt});
    }
  });
  return {
    unitsHeld:runUnits,
    avgCost:runUnits>0?runCost/runUnits:0,
    totalCost:runCost,
    realizedPnl:realizedPnl,
    cashflows:cashflows,
    totalSubscribed:totalSubscribed,
    earliestDate:earliestDate
  };
}

// Newton-Raphson XIRR — ported from the desktop portal's computeXIRR()
// (assets/js/portal/shell.js), duplicated here rather than loading
// desktop's JS bundle into the phone app for one function. Returns null
// if there are fewer than 2 cashflows or they never change sign (no
// meaningful rate exists).
function computeXIRR(cashflows){
  if(!cashflows || cashflows.length<2) return null;
  var hasPos=false, hasNeg=false;
  cashflows.forEach(function(c){ if(c.amount>0)hasPos=true; if(c.amount<0)hasNeg=true; });
  if(!hasPos || !hasNeg) return null;
  var t0=new Date(cashflows[0].date).getTime();
  function years(d){ return (new Date(d).getTime()-t0)/(365*24*3600*1000); }
  function npv(rate){
    return cashflows.reduce(function(sum,c){ return sum+c.amount/Math.pow(1+rate,years(c.date)); },0);
  }
  function dnpv(rate){
    return cashflows.reduce(function(sum,c){
      var t=years(c.date);
      return t===0?sum:sum-t*c.amount/Math.pow(1+rate,t+1);
    },0);
  }
  var rate=0.1;
  for(var i=0;i<100;i++){
    var f=npv(rate), d=dnpv(rate);
    if(Math.abs(d)<1e-10) break;
    var newRate=rate-f/d;
    if(newRate<=-0.999) newRate=-0.999;
    if(Math.abs(newRate-rate)<1e-7){ rate=newRate; break; }
    rate=newRate;
  }
  return isFinite(rate)?rate*100:null;
}
// Feeds the AVCO cashflows + this account's Paid distributions (as
// positive inflows, dated at pay_date) + today's market value (as a
// final positive inflow) into computeXIRR() — same pattern as desktop's
// pages-portfolio.js.
function computeAcctIrr(acct, avco){
  var cf=avco.cashflows.slice();
  (typeof DX_DATA!=='undefined'?DX_DATA:[]).forEach(function(d){
    if(d.acct===acct && d.amt>0) cf.push({date:d._sortDate, amount:d.amt});
  });
  var acctObj=(acct==='ja')?JA_ACCT:PA_ACCT;
  var mv=acctObj?acctObj.mv:0;
  if(mv>0 && avco.unitsHeld>0) cf.push({date:new Date().toISOString().slice(0,10), amount:mv});
  return computeXIRR(cf);
}
// Sum of this account's Paid distributions (DX_DATA is already filtered to
// status='Paid' — see loadDistributionHistory() in portfolio-widgets.js).
function computeDividendReceived(acct){
  return (typeof DX_DATA!=='undefined'?DX_DATA:[]).reduce(function(sum,d){
    return d.acct===acct?sum+(d.amt||0):sum;
  },0);
}
function renderAssetsTab(){
  var ciRows=(AD_ACCT==='ja')?JA_CI_ROWS:PA_CI_ROWS;
  var acctObj=(AD_ACCT==='ja')?JA_ACCT:PA_ACCT;
  var avco=computeAvcoFromRows(ciRows);
  var mv=acctObj?acctObj.mv:0;
  var unrealized=mv-avco.totalCost;
  var dividendReceived=computeDividendReceived(AD_ACCT);
  // Total Return = Unrealized Return + Realized Return + Dividend Received.
  var totalReturn=unrealized+avco.realizedPnl+dividendReceived;
  // Return % is on total capital ever subscribed (not just the current
  // cost basis) so it reflects overall performance including money
  // that's since been redeemed, not only what's currently held.
  var returnPct=avco.totalSubscribed?(totalReturn/avco.totalSubscribed*100):0;
  var periodDays=avco.earliestDate?Math.max(0,Math.round((Date.now()-new Date(avco.earliestDate+'T00:00:00').getTime())/86400000)):0;
  var irr=computeAcctIrr(AD_ACCT, avco);

  // These figures are subject to the same portfolio-value eye toggle as
  // the Accounts screen (see EYE_MASK_IDS/applyEyeVisibility() below) — set
  // data-real here and let applyEyeVisibility() at the end decide whether
  // to actually display it or a mask.
  function setStat(id,txt,color){
    var el=document.getElementById(id);
    if(!el) return;
    el.setAttribute('data-real', txt);
    if(color) el.style.color=color;
  }
  function setMoney(id,val){
    setStat(id, (val>=0?'+':'')+fmtMoney(val), val>=0?'var(--green)':'var(--red)');
  }
  setStat('adNetAssets', fmtMoney(mv));
  setStat('adUnitsHeld', fmtUnits(avco.unitsHeld));
  setStat('adAvgCost', fmtNta(avco.avgCost));
  setStat('adLatestPrice', fmtNta(LATEST_NTA));
  setMoney('adUnrealized', unrealized);
  setMoney('adRealized', avco.realizedPnl);
  setStat('adDividendReceived', fmtMoney(dividendReceived));
  setMoney('adTotalReturn', totalReturn);
  setStat('adReturnPct', (returnPct>=0?'+':'')+returnPct.toFixed(2)+'%', returnPct>=0?'var(--green)':'var(--red)');
  // Period is not a financial figure — never masked by the eye toggle.
  var perEl=document.getElementById('adPeriodDays');
  var ttPer=(typeof t==='function')?t:function(k){return k;};
  if(perEl) perEl.textContent=periodDays+(periodDays===1?ttPer('accountdetails.daySuffix'):ttPer('accountdetails.daysSuffix'));
  if(irr==null){ setStat('adIrr', '—', 'var(--fg-1)'); }
  else { setStat('adIrr', (irr>=0?'+':'')+irr.toFixed(2)+'%', irr>=0?'var(--green)':'var(--red)'); }
  applyEyeVisibility();
}

// ── PROFILE TAB (joint account co-holders) — PIN-gated, centered popup ──
// In-memory only (no sessionStorage) — this data must hide again the
// moment the member leaves Account Details, so every fresh
// openAccountDetails() call resets AD_PROFILE_UNLOCKED to false rather
// than persisting an unlock across visits.
var AD_PROFILE_UNLOCKED=false;
function adProfileUnlocked(){ return AD_PROFILE_UNLOCKED; }
function enterProfileTab(){
  var locked=document.getElementById('adProfileLocked');
  var list=document.getElementById('adCoHolderList');
  if(adProfileUnlocked()){
    if(locked) locked.style.display='none';
    if(list) list.style.display='block';
    renderCoHolders();
  } else {
    if(locked) locked.style.display='block';
    if(list) list.style.display='none';
  }
}
function openAdPin(){
  if(!PROFILE || !PROFILE.pin){
    if(typeof showToastM==='function') showToastM((typeof t==='function')?t('profile.setPinFirst'):'Please set a PIN in Security settings first');
    return;
  }
  document.getElementById('adPinScrim').style.display='block';
  document.getElementById('adPinModal').style.display='block';
  setupPinBoxes('adPinBoxes');
  clearPinBoxes('adPinBoxes');
  setTimeout(function(){focusFirstPinBox('adPinBoxes');},150);
  var err=document.getElementById('adPinErr');
  if(err) err.style.display='none';
}
function closeAdPin(){
  document.getElementById('adPinScrim').style.display='none';
  document.getElementById('adPinModal').style.display='none';
}
function submitAdPin(){
  var entered=getPinBoxesValue('adPinBoxes');
  var errEl=document.getElementById('adPinErr');
  if(!/^\d{6}$/.test(entered)){
    if(errEl){ errEl.textContent=(typeof t==='function')?t('profile.pinMustBe6'):'PIN must be 6 digits.'; errEl.style.display='block'; }
    return;
  }
  if(entered===String(PROFILE.pin)){
    AD_PROFILE_UNLOCKED=true;
    closeAdPin();
    enterProfileTab();
  } else {
    if(errEl){ errEl.textContent=(typeof t==='function')?t('profile.incorrectPin'):'Incorrect PIN. Please try again.'; errEl.style.display='block'; }
  }
}
// One "Account Holder #" section + card per co-holder, in the same order
// mpLoadJointCoHolders() returns them (alphabetical by name). Ownership is
// always split evenly across every holder on the joint account — there's
// no per-holder ownership figure in the schema, so 100% ÷ holder count is
// the only defensible number to show.
async function renderCoHolders(){
  var list=document.getElementById('adCoHolderList');
  if(!list) return;
  var ttCh=(typeof t==='function')?t:function(k){return k;};
  list.innerHTML='<div style="padding:16px;text-align:center;color:var(--fg-3);font-size:.72rem;">'+ttCh('fund.loading')+'</div>';
  try{
    var holders=await mpLoadJointCoHolders(PROFILE.joint_account_id);
    if(!holders.length){ list.innerHTML='<div style="padding:16px;text-align:center;color:var(--fg-3);font-size:.82rem;">'+ttCh('accountdetails.noCoHolders')+'</div>'; return; }
    var ownershipPct=100/holders.length;
    list.innerHTML=holders.map(function(h,i){
      return '<div style="margin-bottom:16px;">'
        +'<div style="font-size:.7rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--fg-3);margin:0 0 8px;">'+ttCh('accountdetails.accountHolder')+' '+(i+1)+'</div>'
        +'<div style="background:transparent;border:1px solid var(--border);border-radius:12px;overflow:hidden;">'
        +'<div class="info-row"><span class="info-label">'+ttCh('accountdetails.fullName')+'</span><span class="info-value">'+(h.full_name||'—')+'</span></div>'
        +'<div class="info-row"><span class="info-label">'+ttCh('accountdetails.email')+'</span><span class="info-value">'+(h.email||'—')+'</span></div>'
        +'<div class="info-row"><span class="info-label">'+ttCh('accountdetails.ownership')+'</span><span class="info-value">'+ownershipPct.toFixed(2)+'%</span></div>'
        +'</div></div>';
    }).join('');
  }catch(e){
    console.error('[Account Details] failed to load co-holders —',e&&e.message);
    list.innerHTML='<div style="padding:16px;text-align:center;color:var(--fg-3);font-size:.82rem;">'+ttCh('accountdetails.couldNotLoadCoHolders')+'</div>';
  }
}

// ── TAB NAVIGATION ────────────────────────────────────────────────────────────
var activeTab='portfolio';
var lastMainTab='portfolio';
// title values here are plain English strings, EXCEPT for the four
// entries whose page is now translated (password/inquiry/feedback/
// settings) — those use i18n.js dictionary keys instead, resolved via
// t() in updateTopbarChrome() below. t() safely returns any string
// unchanged when it isn't a recognized key, so the untranslated entries
// below don't need any change.
var DRILL_PAGES={
  password:{title:'drill.password',back:'profile'},
  transaction:{title:'transaction.pageTitle',back:'all'},
  distribution:{title:'distribution.pageTitle',back:'all'},
  assetdetails:{title:'portfolio.assetDetailsTitle',back:'portfolio'},
  inquiry:{title:'drill.inquiry',back:'profile'},
  feedback:{title:'drill.feedback',back:'profile'},
  // title is a placeholder — openInstrumentDetail() (search-instruments.js)
  // overwrites #topbarBackTitle with the actual instrument's name right
  // after switchTab('instrument') runs.
  instrument:{title:'Instrument',back:'discover'},
  // Top bar keeps this static title — the account itself is chosen via the
  // #adAcctSelect dropdown at the top of the body, not the top bar.
  accountdetails:{title:'accountdetails.pageTitle',back:'portfolio'},
  settings:{title:'drill.settings',back:'profile'}
};
function topbarBackClick(){
  var d=DRILL_PAGES[activeTab];
  if(!d){ switchTab('portfolio'); return; }
  // Password & Security, and the Instrument Detail page opened from global
  // search, can both be reached from more than one place — their back
  // destination follows wherever it was actually opened from (lastMainTab)
  // rather than a single hardcoded tab. Other drill pages only have one
  // real entry point, so their fixed "back" is left as-is.
  var dest=(activeTab==='password'||activeTab==='instrument')?lastMainTab:d.back;
  switchTab(dest);
}
function updateTopbarChrome(tab){
  var d=DRILL_PAGES[tab];
  var logo=document.getElementById('topbarLogo');
  var back=document.getElementById('topbarBack');
  var bar=document.getElementById('mainTopbar');
  var fundCompact=document.getElementById('topbarFundCompact');
  if(fundCompact && tab!=='fund') fundCompact.style.display='none';
  if(d){
    if(logo)logo.style.display='none';
    if(back){back.style.display='flex';document.getElementById('topbarBackTitle').textContent=(typeof t==='function')?t(d.title):d.title;}
  } else {
    if(logo)logo.style.display='flex';
    if(back)back.style.display='none';
  }
  // No divider line under the topbar on the Accounts page or its Asset
  // Details drill-in — every other page keeps the usual border.
  var noBorderTabs=['portfolio','assetdetails','fund','market','watchlist','discover','all'];
  if(bar) bar.style.borderBottom=(noBorderTabs.indexOf(tab)>=0)?'none':'1px solid var(--border)';

  // App Feedback's fixed Submit button takes over the bottom tab bar's
  // slot while that page is active, instead of floating in the scrollable
  // content above a still-visible tab bar.
  var tabbar=document.querySelector('.tabbar');
  var feedbackFooter=document.getElementById('feedbackFooterBar');
  if(tab==='feedback'){
    if(tabbar) tabbar.style.display='none';
    if(feedbackFooter) feedbackFooter.style.display='flex';
  } else {
    if(tabbar) tabbar.style.display='';
    if(feedbackFooter) feedbackFooter.style.display='none';
  }
}
// switchTab() is what normally calls updateTopbarChrome(), but it only ever
// runs on an actual tab click — the default tab (Accounts/portfolio) is
// already marked active in the raw HTML, so nothing calls it on a fresh
// load. Without this, the topbar's divider line (present in the static
// CSS) stayed visible on the very first screen the app shows until the
// user switched tabs and back. Run it once, immediately, for whatever tab
// is actually active on load.
updateTopbarChrome(activeTab);
function switchFundTab(tab){
  document.querySelectorAll('.ftab').forEach(function(b){b.classList.remove('active');});
  document.getElementById('ftab-'+tab).classList.add('active');
  ['overview','financial','compare','historical','shareholders'].forEach(function(t){
    document.getElementById('ftab-'+t+'-body').style.display=(t===tab?'block':'none');
  });
  if(tab==='overview'){setTimeout(function(){drawMChart(mPeriod);},50);}
  document.getElementById('mainScroll').scrollTop=0;
}

var standalonePages={};
var pendingTab=null;
function switchTab(tab){
  if(standalonePages[tab]){location.href=standalonePages[tab];return;}
  updateTopbarChrome(tab);
  var pgEl=document.getElementById('pg-'+tab);
  var tabEl=document.getElementById('tab-'+tab);
  if(!pgEl){
    // Target page hasn't finished loading yet (async fetch) — highlight the
    // tab now and finish the switch once loadPages() injects it, instead of
    // clearing the current page and leaving nothing to show.
    pendingTab=tab;
    document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
    if(tabEl) tabEl.classList.add('active');
    return;
  }
  pendingTab=null;
  if(!DRILL_PAGES[activeTab]) lastMainTab=activeTab;
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  if(tabEl) tabEl.classList.add('active');
  pgEl.classList.add('active');
  document.getElementById('mainScroll').scrollTop=0;
  activeTab=tab;
  // Re-sync translated text now, not just at page-load time — the target
  // fragment may not have existed yet when i18n.js's own initial
  // applyI18n() call ran (loadPages() fetches fragments asynchronously).
  if(typeof applyI18n==='function'){applyI18n();}
  if(tab==='market'){renderMktList();drawKlciSparkline();updateMktTime();if(typeof switchMarketTab==='function')switchMarketTab(MKT_ACTIVE_TAB||'indices');}
  if(tab==='watchlist'){renderWatchlist();}
  if(tab==='transaction'){renderTxList();}
  if(tab==='distribution'){renderDxList();}
  if(tab==='password'){
    updatePinDisplay();
    ['pinVerifyBoxes','pinNewBoxes','pinConfirmBoxes'].forEach(setupPinBoxes);
  }
  if(tab==='assetdetails'){setTimeout(function(){drawAdDonut();drawAdTrend(adPeriod);},50);}
  if(tab==='accountdetails'){renderAccountDetails();}
  if(tab==='portfolio'){setTimeout(drawSparkline,50);}
  if(tab==='profile')setTimeout(function(){adjustProfileSpacer();},50);
  if(tab==='fund'){
    function tryInitFundCharts(n){
      var c=document.getElementById('candleChart');
      if(c && c.parentElement && c.parentElement.clientWidth>0){
        attachCandleListeners();
        loadFundChartData();
      } else if(n>0){setTimeout(function(){tryInitFundCharts(n-1);},120);}
    }
    setTimeout(function(){tryInitFundCharts(10);},80);
    initFundScrollHeader();
  }
}

// ── FUND PAGE: scroll-collapsing header ─────────────────────────────────────
// Past a threshold, the topbar swaps from the normal logo to a compact
// Title + Price/Change subline — only active while on the Fund tab.
var fundScrollAttached=false;
function initFundScrollHeader(){
  if(fundScrollAttached) return;
  var el=document.getElementById('mainScroll');
  if(!el) return;
  fundScrollAttached=true;
  el.addEventListener('scroll',handleFundTopbarScroll);
}
function handleFundTopbarScroll(){
  if(activeTab!=='fund') return;
  var compact=document.getElementById('topbarFundCompact');
  var logo=document.getElementById('topbarLogo');
  if(!compact||!logo) return;
  var scrollEl=document.getElementById('mainScroll');
  var scrolled=scrollEl && scrollEl.scrollTop>70;
  compact.style.display=scrolled?'flex':'none';
  logo.style.display=scrolled?'none':'flex';
}

// ── PASSWORD MODAL ──────────────────────────────────────────────────────────
// Verify -> New -> Confirm, one field per step (not new+confirm together),
// with a step-dot indicator and a Back action between steps.
function setPwStepDots(step){
  document.querySelectorAll('#pwStepDots .step-dot').forEach(function(d){
    var s=parseInt(d.getAttribute('data-step'),10);
    d.classList.toggle('active', s===step);
    d.classList.toggle('done', s<step);
  });
}
function openPwModal(){
  document.getElementById('pwStep1').style.display='block';
  document.getElementById('pwStep2').style.display='none';
  document.getElementById('pwStep3').style.display='none';
  setPwStepDots(1);
  document.getElementById('pwCurrent').value='';
  document.getElementById('pwCurrent').style.borderColor='var(--border)';
  document.getElementById('pwCurrentErr').style.display='none';
  document.getElementById('pwNew').value='';
  document.getElementById('pwNew').style.borderColor='var(--border)';
  document.getElementById('pwNewErr').style.display='none';
  document.getElementById('pwConfirm').value='';
  document.getElementById('pwConfirm').style.borderColor='var(--border)';
  document.getElementById('pwMatchErr').style.display='none';
  document.getElementById('pwScrim').style.display='block';
  document.getElementById('pwModal').style.display='block';
  setTimeout(function(){document.getElementById('pwCurrent').focus();},100);
}
function closePwModal(){
  document.getElementById('pwScrim').style.display='none';
  document.getElementById('pwModal').style.display='none';
}
function pwBackTo(step){
  document.getElementById('pwStep1').style.display=step===1?'block':'none';
  document.getElementById('pwStep2').style.display=step===2?'block':'none';
  document.getElementById('pwStep3').style.display=step===3?'block':'none';
  setPwStepDots(step);
}
function toggleVis(id){
  var f=document.getElementById(id);
  f.type=f.type==='password'?'text':'password';
}
async function verifyPw(){
  var v=document.getElementById('pwCurrent').value;
  var btn=event&&event.target;
  if(!v){document.getElementById('pwCurrent').focus();return;}
  if(typeof sb==='undefined'||!sb||!AUTH_USER||!AUTH_USER.email){
    document.getElementById('pwCurrentErr').textContent=t('password.unableVerifyLater');
    document.getElementById('pwCurrentErr').style.display='block';
    return;
  }
  var origTxt=btn&&btn.textContent;
  if(btn){btn.disabled=true;btn.textContent=t('password.verifying');}
  try{
    // Re-authenticating with the entered password is how we confirm it's
    // correct — Supabase has no separate "check password" call. This does
    // not disturb the existing session.
    var res=await sb.auth.signInWithPassword({email:AUTH_USER.email,password:v});
    if(res.error) throw res.error;
    document.getElementById('pwCurrentErr').style.display='none';
    document.getElementById('pwCurrent').style.borderColor='var(--border)';
    document.getElementById('pwStep1').style.display='none';
    document.getElementById('pwStep2').style.display='block';
    setPwStepDots(2);
    setTimeout(function(){document.getElementById('pwNew').focus();},100);
  }catch(e){
    document.getElementById('pwCurrentErr').textContent=t('password.incorrectPassword');
    document.getElementById('pwCurrentErr').style.display='block';
    document.getElementById('pwCurrent').style.borderColor='var(--red)';
  }finally{
    if(btn){btn.disabled=false;btn.textContent=origTxt;}
  }
}
function pwNewContinue(){
  var n=document.getElementById('pwNew').value;
  if(n.length<8){
    document.getElementById('pwNewErr').style.display='block';
    document.getElementById('pwNew').style.borderColor='var(--red)';
    return;
  }
  document.getElementById('pwNewErr').style.display='none';
  document.getElementById('pwNew').style.borderColor='var(--border)';
  document.getElementById('pwStep2').style.display='none';
  document.getElementById('pwStep3').style.display='block';
  setPwStepDots(3);
  setTimeout(function(){document.getElementById('pwConfirm').focus();},100);
}
async function savePw(){
  var n=document.getElementById('pwNew').value;
  var c=document.getElementById('pwConfirm').value;
  var btn=event&&event.target;
  if(n!==c){document.getElementById('pwMatchErr').style.display='block';document.getElementById('pwConfirm').style.borderColor='var(--red)';return;}
  if(typeof mpUpdatePassword!=='function'){showToastM(t('password.pwServiceUnavailable'));return;}
  var origTxt=btn&&btn.textContent;
  if(btn){btn.disabled=true;btn.textContent=t('password.saving');}
  try{
    await mpUpdatePassword(n);
    closePwModal();
    showToastM(t('password.toastPwUpdated'));
  }catch(e){
    document.getElementById('pwMatchErr').textContent='Update failed: '+(e&&e.message||'Unknown error');
    document.getElementById('pwMatchErr').style.display='block';
  }finally{
    if(btn){btn.disabled=false;btn.textContent=origTxt;}
  }
}

// ── PIN MODAL ────────────────────────────────────────────────────────────────
// PIN is stored on profiles.pin — used to gate revealing details on the
// Personal Profile page. Verify -> New -> Confirm (verify step skipped
// entirely when no PIN is on file yet, same as before), one field per step
// with a step-dot indicator and a Back action between steps.
var pinModalHasVerify=false;
function setPinStepDots(step){
  var dots=document.querySelectorAll('#pinStepDots .step-dot');
  if(!dots.length) return;
  dots[0].style.display=pinModalHasVerify?'block':'none';
  dots.forEach(function(d){
    var s=parseInt(d.getAttribute('data-step'),10);
    d.classList.toggle('active', s===step);
    d.classList.toggle('done', s<step);
  });
}
function openPinModal(){
  var hasPin=!!(PROFILE && PROFILE.pin);
  pinModalHasVerify=hasPin;
  ['pinVerifyBoxes','pinNewBoxes','pinConfirmBoxes'].forEach(clearPinBoxes);
  document.getElementById('pinVerifyErr').style.display='none';
  document.getElementById('pinNewErr').style.display='none';
  document.getElementById('pinMatchErr').style.display='none';
  var step1=document.getElementById('pinStep1'), step2=document.getElementById('pinStep2'), step3=document.getElementById('pinStep3');
  var step2Title=document.getElementById('pinStep2Title');
  var step2BackBtn=document.getElementById('pinStep2BackBtn');
  step3.style.display='none';
  if(hasPin){
    step1.style.display='block'; step2.style.display='none';
    if(step2Title) step2Title.textContent=t('password.setNewPinTitle');
    if(step2BackBtn){ step2BackBtn.textContent=t('password.back'); step2BackBtn.setAttribute('onclick','pinBackTo(1)'); }
    setPinStepDots(1);
  } else {
    // No PIN on file yet — nothing to verify, go straight to setting one.
    step1.style.display='none'; step2.style.display='block';
    if(step2Title) step2Title.textContent=t('password.setPinTitle');
    if(step2BackBtn){ step2BackBtn.textContent=t('password.cancel'); step2BackBtn.setAttribute('onclick','closePinModal()'); }
    setPinStepDots(2);
  }
  document.getElementById('pinScrim').style.display='block';
  document.getElementById('pinModal').style.display='block';
  setTimeout(function(){ focusFirstPinBox(hasPin?'pinVerifyBoxes':'pinNewBoxes'); },100);
}
function closePinModal(){
  document.getElementById('pinScrim').style.display='none';
  document.getElementById('pinModal').style.display='none';
}
function pinBackTo(step){
  document.getElementById('pinStep1').style.display=step===1?'block':'none';
  document.getElementById('pinStep2').style.display=step===2?'block':'none';
  document.getElementById('pinStep3').style.display=step===3?'block':'none';
  setPinStepDots(step);
}
function verifyPinStep(){
  var entered=getPinBoxesValue('pinVerifyBoxes');
  var errEl=document.getElementById('pinVerifyErr');
  if(!/^\d{6}$/.test(entered)){
    errEl.textContent=t('password.pleaseEnterPin6'); errEl.style.display='block';
    return;
  }
  if(entered!==String(PROFILE&&PROFILE.pin)){
    errEl.textContent=t('password.incorrectPin'); errEl.style.display='block';
    clearPinBoxes('pinVerifyBoxes'); focusFirstPinBox('pinVerifyBoxes');
    return;
  }
  errEl.style.display='none';
  document.getElementById('pinStep1').style.display='none';
  document.getElementById('pinStep2').style.display='block';
  setPinStepDots(2);
  setTimeout(function(){ focusFirstPinBox('pinNewBoxes'); },100);
}
function pinNewContinue(){
  var n=getPinBoxesValue('pinNewBoxes');
  var errEl=document.getElementById('pinNewErr');
  if(!/^\d{6}$/.test(n)){
    errEl.textContent=t('password.pinMustBe6'); errEl.style.display='block';
    return;
  }
  errEl.style.display='none';
  document.getElementById('pinStep2').style.display='none';
  document.getElementById('pinStep3').style.display='block';
  setPinStepDots(3);
  setTimeout(function(){ focusFirstPinBox('pinConfirmBoxes'); },100);
}
async function savePin(){
  var n=getPinBoxesValue('pinNewBoxes');
  var c=getPinBoxesValue('pinConfirmBoxes');
  var errEl=document.getElementById('pinMatchErr');
  var btn=event&&event.target;
  errEl.style.display='none';
  if(n!==c){
    errEl.textContent=t('password.pinMismatch'); errEl.style.display='block'; return;
  }
  if(typeof mpSaveProfile!=='function'||!AUTH_USER){ showToastM(t('password.pinServiceUnavailable')); return; }
  var origTxt=btn&&btn.textContent;
  if(btn){btn.disabled=true;btn.textContent=t('password.saving');}
  try{
    await mpSaveProfile(AUTH_USER.id,{pin:n});
    if(PROFILE) PROFILE.pin=n;
    updatePinDisplay();
    closePinModal();
    showToastM(t('password.toastPinUpdated'));
  }catch(e){
    errEl.textContent='Update failed: '+(e&&e.message||'Unknown error — confirm the "pin" column exists on profiles.');
    errEl.style.display='block';
  }finally{
    if(btn){btn.disabled=false;btn.textContent=origTxt;}
  }
}
function updatePinDisplay(){
  var el=document.getElementById('pinDisplayVal');
  if(!el) return;
  el.textContent=(PROFILE&&PROFILE.pin)?'••••••':'Not set';
}

// ── Segmented 6-box PIN input helpers ───────────────────────────────────────
var pinBoxesInitialized={};
function setupPinBoxes(containerId){
  if(pinBoxesInitialized[containerId]) return;
  var boxes=document.querySelectorAll('#'+containerId+' .pin-box');
  if(!boxes.length) return;
  pinBoxesInitialized[containerId]=true;
  boxes.forEach(function(box,i){
    box.addEventListener('input',function(){
      box.value=box.value.replace(/[^0-9]/g,'').slice(0,1);
      if(box.value && i<boxes.length-1){ boxes[i+1].focus(); }
    });
    box.addEventListener('keydown',function(e){
      if(e.key==='Backspace' && !box.value && i>0){ boxes[i-1].focus(); }
    });
    box.addEventListener('paste',function(e){
      e.preventDefault();
      var text=((e.clipboardData||window.clipboardData).getData('text')||'').replace(/[^0-9]/g,'').slice(0,boxes.length);
      text.split('').forEach(function(ch,idx){ if(boxes[idx]) boxes[idx].value=ch; });
      var nextIdx=Math.min(text.length,boxes.length-1);
      boxes[nextIdx].focus();
    });
  });
}
function getPinBoxesValue(containerId){
  var boxes=document.querySelectorAll('#'+containerId+' .pin-box');
  return Array.prototype.map.call(boxes,function(b){return b.value;}).join('');
}
function clearPinBoxes(containerId){
  document.querySelectorAll('#'+containerId+' .pin-box').forEach(function(b){b.value='';});
}
function focusFirstPinBox(containerId){
  var first=document.querySelector('#'+containerId+' .pin-box');
  if(first) first.focus();
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
var mToastTimer;
function showToastM(msg){
  var t=document.getElementById('mToast');
  t.textContent=msg;t.classList.add('show');
  clearTimeout(mToastTimer);
  mToastTimer=setTimeout(function(){t.classList.remove('show');},2400);
}

// ── CHART ─────────────────────────────────────────────────────────────────────
var MNTA={
  '1d':{v:[1.0388,1.0401,1.0392,1.0415,1.0428,1.0419,1.0432,1.0441,1.0429,1.0436,1.0448,1.0461,1.0452,1.0467,1.0471,1.0463,1.0478,1.0485,1.0472,1.0468,1.0479,1.0491,1.0483,1.0496,1.0488,1.0501,1.0495,1.0508,1.0501,1.0245],l:['05 Feb','','','','','','','','','','','','','','','','','','','','','','','','','','','','','19 Mar']},
  '1y':{v:[1.041,1.051,1.058,1.065,1.072,1.080,1.085,1.065,1.045,1.032,1.024,1.025,1.0245],l:['Apr 25','','','','Jul 25','','','','Oct 25','','','','Mar 26']},
  '3y':{v:[1.000,1.008,1.015,1.024,1.032,1.041,1.051,1.058,1.065,1.072,1.080,1.085,1.065,1.045,1.032,1.024,1.025,1.032,1.041,1.051,1.058,1.065,1.072,1.080,1.085,1.065,1.045,1.0245],l:['Dec 23','','','','','','','Mar 24','','','','','','','Sep 24','','','','','','','Mar 25','','','','','','Mar 26']},
  'max':{v:[1.000,1.008,1.015,1.024,1.032,1.041,1.051,1.058,1.065,1.072,1.080,1.085,1.065,1.045,1.032,1.024,1.025,1.032,1.041,1.051,1.058,1.065,1.072,1.080,1.085,1.065,1.045,1.032,1.025,1.0245],l:['Mar 22','','','','','','','','','','','','','','','','','','','','','','','','','','','','','Mar 26']}
};
var mPeriod='1d';
function drawMChart(period){
  var canvas=document.getElementById('mChart');
  if(!canvas)return;
  var ctx=canvas.getContext('2d');
  var data=MNTA[period];
  var dpr=window.devicePixelRatio||1;
  var W=canvas.parentElement.clientWidth-32,H=130;
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  ctx.scale(dpr,dpr);
  var vals=data.v,n=vals.length;
  var mn=Math.min.apply(null,vals)-0.001,mx=Math.max.apply(null,vals)+0.001,rng=mx-mn;
  var padX=4,padY=10;
  function px(i){return padX+(i/(n-1))*(W-padX*2);}
  function py(v){return H-padY-((v-mn)/rng)*(H-padY*2);}
  // Gradient fill
  var grad=ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'rgba(21,101,192,.15)');
  grad.addColorStop(1,'rgba(21,101,192,0)');
  ctx.beginPath();
  ctx.moveTo(px(0),py(vals[0]));
  for(var i=1;i<n;i++) ctx.lineTo(px(i),py(vals[i]));
  ctx.lineTo(px(n-1),H-padY);ctx.lineTo(px(0),H-padY);ctx.closePath();
  ctx.fillStyle=grad;ctx.fill();
  // Line
  ctx.beginPath();ctx.strokeStyle='#1565C0';ctx.lineWidth=2;ctx.lineJoin='round';ctx.lineCap='round';
  ctx.moveTo(px(0),py(vals[0]));
  for(var i=1;i<n;i++) ctx.lineTo(px(i),py(vals[i]));
  ctx.stroke();
  // End dot
  ctx.beginPath();ctx.arc(px(n-1),py(vals[n-1]),3.5,0,Math.PI*2);
  ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#1565C0';ctx.lineWidth=2;ctx.stroke();
  // Labels
  var lbls=data.l;
  var li=[0,Math.floor(n/2),n-1];
  li.forEach(function(i,idx){
    document.getElementById('mChartL'+idx).textContent=lbls[i]||'';
  });
}
function switchMPeriod(p,btn){
  mPeriod=p;
  document.querySelectorAll('.seg-sm button').forEach(function(b){b.classList.remove('on');});
  btn.classList.add('on');
  drawMChart(p);
}
window.addEventListener('resize',function(){drawMChart(mPeriod);drawSparkline();});

// ── PORTFOLIO VALUE TOGGLE ────────────────────────────────────────────────────
var portfolioVisible=true;
// Ids of every maskable figure on the Account page (card totals + both
// expansion panels). Total Value uses its own element directly since it's
// computed separately (sum of PA+JA) rather than per-account.
var EYE_MASK_IDS=['paValue','paPL','paUnits','paStake','paPrice','paVwap','paMv','paCost','paRealized','paReturnPct',
                   'jaValue','jaPL','jaUnits','jaStake','jaPrice','jaVwap','jaMv','jaCost','jaRealized','jaReturnPct',
                   'adDonutTotal',
                   // Account Details' Assets tab (period/day-count is left
                   // out — it isn't a financial figure).
                   'adNetAssets','adUnitsHeld','adAvgCost','adLatestPrice',
                   'adUnrealized','adRealized','adDividendReceived','adTotalReturn','adReturnPct','adIrr'];
function applyEyeVisibility(){
  var mask='••••••';
  var totalEl=document.getElementById('portfolioValue');
  if(totalEl){
    var real=totalEl.getAttribute('data-real');
    totalEl.textContent=portfolioVisible?(real||totalEl.textContent):mask;
  }
  EYE_MASK_IDS.forEach(function(id){
    var el=document.getElementById(id);
    if(!el) return;
    var real=el.getAttribute('data-real');
    el.textContent=portfolioVisible?(real!=null?real:el.textContent):mask;
  });
}

// ── APP LOCK ─────────────────────────────────────────────────────────────────
// Requires the PIN every time the app is opened or resumed from the
// background — the underlying Supabase session is left alone (still
// persisted, per persistSession:true), this is purely a local re-entry gate
// so the app can't just be reopened by anyone holding the device. New users
// with no PIN yet are forced to set one before they can proceed at all.
var appLockInitialCheckDone=false;
var appLockEverBackgrounded=false;

// Standalone pages like profile.html/profile-edit.html are reached from
// index.html via a REAL navigation (location.href), not an SPA tab switch —
// so tapping their back button either reloads index.html from scratch or
// restores it from bfcache, and both paths look identical to "the app was
// backgrounded" from here. Without this flag, going Profile -> Personal
// Profile -> back demanded the PIN again every time, even though the app
// was never actually closed or backgrounded. Those subpages set this flag
// on load (sessionStorage, so it survives the round trip); it's consumed
// exactly once, the next time index.html loads or is restored.
function consumeSubpageReturnFlag(){
  try{
    if(sessionStorage.getItem('zy_returning_from_subpage')==='1'){
      sessionStorage.removeItem('zy_returning_from_subpage');
      return true;
    }
  }catch(e){}
  return false;
}

function checkAppLockOnLoad(preConfirmedSession){
  ['appLockVerifyBoxes','appLockNewBoxes','appLockConfirmBoxes'].forEach(setupPinBoxes);
  var justLoggedIn=false;
  try{
    if(sessionStorage.getItem('zy_just_logged_in')==='1'){
      justLoggedIn=true;
      sessionStorage.removeItem('zy_just_logged_in'); // one-time only
    }
  }catch(e){}
  var justReturnedFromSubpage=consumeSubpageReturnFlag();
  // Skip the immediate PIN prompt for this very first load right after a
  // genuine password login (asking again seconds later is redundant), and
  // for a return trip from an in-app subpage like Personal Profile (see
  // consumeSubpageReturnFlag above). Every other open/resume still locks
  // normally — both flags are single-use and stored in sessionStorage, not
  // localStorage, so a real new session won't carry either over.
  if(!justLoggedIn && !justReturnedFromSubpage) verifySessionThenLock(preConfirmedSession);
  else hideBootSplash(); // no lock needed — reveal the account straight away
  // Lock the INSTANT the app is actually backgrounded — not after detecting
  // a "return" event. Waiting to detect resume is fragile: if iOS suspends
  // or fully kills the backgrounded page (very common for PWAs to save
  // memory/battery), that resume event can simply never fire, and the app
  // would silently stay unlocked. Locking proactively on every genuine
  // "went to background" signal means the overlay is already active and
  // blocking the screen by the time the user returns. showAppLock() is safe
  // to call repeatedly.
  //
  // visibilitychange (document.hidden) and pagehide are used deliberately
  // instead of window 'blur' — blur fires on ANY loss of window focus, not
  // just real backgrounding: opening a native <input type=date> picker, a
  // confirm()/alert() dialog, or any other in-page focus shift all trigger
  // it too, which was locking the app in the middle of ordinary in-app
  // interactions that never actually left the page. visibilitychange only
  // flips when the tab/app itself is genuinely hidden.
  function markBackgroundedThenLock(){ appLockEverBackgrounded=true; verifySessionThenLock(); }
  document.addEventListener('visibilitychange',function(){ if(document.hidden) markBackgroundedThenLock(); });
  window.addEventListener('pagehide',markBackgroundedThenLock);
  // Second layer, for the resume trip back in — but pageshow/focus can BOTH
  // also fire on a plain fresh page load (not just a genuine resume from
  // background), which was the actual bug: it fired right after login and
  // showed the PIN prompt anyway, ignoring the just-logged-in skip. Gating
  // these on "we've actually seen the app go to background at least once"
  // means they can never fire as a false positive on a fresh load — only
  // once a real backgrounding has genuinely happened first.
  window.addEventListener('pageshow',function(){
    if(consumeSubpageReturnFlag()){ hideAppLock(); return; }
    if(appLockEverBackgrounded) verifySessionThenLock();
  });
  window.addEventListener('focus',function(){ if(appLockEverBackgrounded && document.hidden===false) verifySessionThenLock(); });
}

// Resuming the app shouldn't demand a PIN if the real Supabase session is
// already gone (expired, revoked, or signed out elsewhere) — that just ends
// with the user solving a PIN puzzle for nothing before being bounced to
// login anyway. Check the real session first; only show the lock screen if
// it's still valid, otherwise go straight to login.
//
// preConfirmedSession lets the very first call (from checkAppLockOnLoad(),
// right after loadProfileData() already awaited sb.auth.getSession() a
// moment ago) skip doing that same check a second time — on a slow
// connection that redundant round trip was adding to how long the boot
// splash sat on screen before revealing the PIN lock. Every other caller
// (resume from background, focus, etc.) omits it and gets a fresh real
// check, since real time has actually passed since the last one.
function verifySessionThenLock(preConfirmedSession){
  try{
    if(typeof sb==='undefined'||!sb){ showAppLock(); return; }
    if(preConfirmedSession){
      if(preConfirmedSession.data&&preConfirmedSession.data.session){ showAppLock(); }
      else { window.location.href='login.html'; }
      return;
    }
    sb.auth.getSession().then(function(s){
      if(s&&s.data&&s.data.session){ showAppLock(); }
      else { window.location.href='login.html'; }
    }).catch(function(){ showAppLock(); });
  }catch(e){ showAppLock(); }
}

// Hides the boot-splash white screen (index.html) — the one thing that
// reveals whatever's actually supposed to be visible underneath, whether
// that's the appLockOverlay (showAppLock()) or the account itself
// (hideAppLock(), or the no-lock-needed branch in checkAppLockOnLoad()).
// Never called on the redirect-to-login branch of verifySessionThenLock()
// on purpose — the splash should stay up until that navigation actually
// happens, not flash the account first.
function hideBootSplash(){
  var splash=document.getElementById('bootSplash');
  if(splash) splash.style.display='none';
}
function showAppLock(){
  var overlay=document.getElementById('appLockOverlay');
  if(!overlay) return;
  hideBootSplash();
  var hasPin=!!(PROFILE && PROFILE.pin);
  overlay.style.display='flex';
  var verifyEl=document.getElementById('appLockVerify'), setEl=document.getElementById('appLockSet');
  var title=document.getElementById('appLockTitle'), sub=document.getElementById('appLockSub');
  var tt=(typeof t==='function')?t:function(k){return k;};
  if(hasPin){
    verifyEl.style.display='block'; setEl.style.display='none';
    title.textContent=tt('applock.enterPin');
    sub.textContent=tt('applock.enterPinSub');
    clearPinBoxes('appLockVerifyBoxes');
    document.getElementById('appLockVerifyErr').style.display='none';
    setTimeout(function(){ focusFirstPinBox('appLockVerifyBoxes'); },150);
  } else {
    verifyEl.style.display='none'; setEl.style.display='block';
    title.textContent=tt('applock.setupTitle');
    sub.textContent=tt('applock.setupSub');
    clearPinBoxes('appLockNewBoxes'); clearPinBoxes('appLockConfirmBoxes');
    document.getElementById('appLockSetErr').style.display='none';
    setTimeout(function(){ focusFirstPinBox('appLockNewBoxes'); },150);
  }
}
function hideAppLock(){
  var overlay=document.getElementById('appLockOverlay');
  if(overlay) overlay.style.display='none';
  hideBootSplash();
}
function appLockVerifySubmit(){
  var entered=getPinBoxesValue('appLockVerifyBoxes');
  var errEl=document.getElementById('appLockVerifyErr');
  if(!/^\d{6}$/.test(entered)){
    errEl.textContent=(typeof t==='function')?t('applock.pleaseEnterPin6'):'Please enter your 6-digit PIN.'; errEl.style.display='block';
    return;
  }
  if(entered!==String(PROFILE&&PROFILE.pin)){
    errEl.textContent=(typeof t==='function')?t('applock.incorrectPin'):'Incorrect PIN. Please try again.'; errEl.style.display='block';
    clearPinBoxes('appLockVerifyBoxes'); focusFirstPinBox('appLockVerifyBoxes');
    return;
  }
  hideAppLock();
}
async function appLockSetSubmit(){
  var n=getPinBoxesValue('appLockNewBoxes');
  var c=getPinBoxesValue('appLockConfirmBoxes');
  var errEl=document.getElementById('appLockSetErr');
  var btn=event&&event.target;
  errEl.style.display='none';
  var tt2=(typeof t==='function')?t:function(k){return k;};
  if(!/^\d{6}$/.test(n)){
    errEl.textContent=tt2('applock.pinMustBe6'); errEl.style.display='block'; return;
  }
  if(n!==c){
    errEl.textContent=tt2('applock.pinMismatch'); errEl.style.display='block'; return;
  }
  if(typeof mpSaveProfile!=='function'||!AUTH_USER){
    errEl.textContent=tt2('applock.unableSavePin'); errEl.style.display='block'; return;
  }
  var origTxt=btn&&btn.textContent;
  if(btn){btn.disabled=true;btn.textContent=tt2('applock.saving');}
  try{
    await mpSaveProfile(AUTH_USER.id,{pin:n});
    if(PROFILE) PROFILE.pin=n;
    if(typeof updatePinDisplay==='function') updatePinDisplay();
    hideAppLock();
  }catch(e){
    errEl.textContent=tt2('applock.couldNotSavePin')+(e&&e.message||'Unknown error — confirm the "pin" column exists on profiles.');
    errEl.style.display='block';
  }finally{
    if(btn){btn.disabled=false;btn.textContent=origTxt;}
  }
}
function appLockForgotPin(){
  if(typeof doLogout==='function') doLogout();
  else window.location.href='login.html';
}
