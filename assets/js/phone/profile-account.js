/* ===== assets/js/phone/profile-account.js — Profile/account data loading, capital-injection summary rendering ===== */
// ── PROFILE DATA (real, from Supabase) ─────────────────────────────────────
var PROFILE=null, AUTH_USER=null;
function mpInitialsPhone(name){
  if(!name) return '—';
  var parts=String(name).trim().split(/\s+/);
  return ((parts[0]||'')[0]||'').toUpperCase()+((parts[1]||'')[0]||'').toUpperCase();
}
async function loadProfileData(){
  try{
    if(typeof sb==='undefined'||!sb) return;
    var sess=await sb.auth.getSession();
    var user=sess.data&&sess.data.session&&sess.data.session.user;
    if(!user) return;
    AUTH_USER=user;
    PROFILE=await mpLoadProfile(user.id);
  }catch(e){ console.warn('Profile load failed:', e.message); PROFILE=PROFILE||{}; }
  applyProfileToUI();
}
function applyProfileToUI(){
  var P=PROFILE||{};
  var name=P.full_name||P.preferred_name||(AUTH_USER&&AUTH_USER.email)||'Member';
  var email=(AUTH_USER&&AUTH_USER.email)||'';
  var initials=mpInitialsPhone(name);
  document.querySelectorAll('.prof-name').forEach(function(el){el.textContent=name;});
  document.querySelectorAll('.prof-email').forEach(function(el){el.textContent=email;});
  document.querySelectorAll('.prof-av-lg,.avatar-sm').forEach(function(el){el.textContent=initials;});
  document.querySelectorAll('.prof-badge').forEach(function(el){el.textContent='Verified Investor · '+(P.investor_id||'—');});
}

// ── ACCOUNT SUMMARY (real data) ─────────────────────────────────────────────
// PA: capital_injection rows where uid = profiles.id (the logged-in user's
// own account). JA: same computation, but keyed on profiles.joint_account_id
// instead — a joint account has no login of its own, so its capital_injection
// rows are filed under that shared id rather than a person's id.
var PA_ACCT=null, JA_ACCT=null, LATEST_NTA=0, LATEST_NTA_DATE=null;
var PA_CI_ROWS=[], JA_CI_ROWS=[];

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
async function computeAccountFromCapitalInjection(acctId, latestNta){
  if(!acctId) return {rows:[],result:null};
  var { data, error } = await sb.from('capital_injection').select('units, amount, date').eq('uid', acctId);
  if(error){ console.warn('[Account Summary] capital_injection load failed for', acctId, ':', error.message); return {rows:[],result:null}; }
  var rows=data||[];
  console.log('[Account Summary] capital_injection rows for uid='+acctId+':', rows.length);
  if(!rows.length) console.warn('[Account Summary] No rows returned for uid='+acctId+'. If this account should have transactions, check the capital_injection RLS policy allows reading rows where uid matches profiles.joint_account_id (not just auth.uid()).');
  var units=0, buyUnits=0, buyAmount=0;
  rows.forEach(function(r){
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

    var ntaRes=await sb.from('nta_daily').select('date,nta').order('date',{ascending:false}).limit(1);
    var latestRow=(ntaRes.data&&ntaRes.data[0])||null;
    LATEST_NTA=latestRow?parseFloat(latestRow.nta):0;
    LATEST_NTA_DATE=latestRow?latestRow.date:null;

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
    setText(prefix+'Value', acct?fmtMoney(acct.mv):'0.00');
    setText(prefix+'PL', acct?((up?'+':'')+fmtMoney(acct.realized)):'0.00', up?'var(--green)':'var(--red)');
    setText(prefix+'UnitsHeldLbl', acct?(fmtUnits(acct.units)+' units held'):'0.00 units held');
    setText(prefix+'Units', acct?fmtUnits(acct.units):'0.00');
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
// ── TAB NAVIGATION ────────────────────────────────────────────────────────────
var activeTab='portfolio';
var lastMainTab='portfolio';
var DRILL_PAGES={
  password:{title:'Password & Security',back:'profile'},
  transaction:{title:'Transaction',back:'all'},
  distribution:{title:'Distribution',back:'all'},
  assetdetails:{title:'Asset Details',back:'portfolio'}
};
function topbarBackClick(){
  var d=DRILL_PAGES[activeTab];
  if(!d){ switchTab('portfolio'); return; }
  // Password & Security can be opened from more than one place (Me page or
  // All Services) — its back destination follows wherever it was actually
  // opened from, rather than a single hardcoded tab. Other drill pages only
  // have one real entry point, so their fixed "back" is left as-is.
  var dest=(activeTab==='password')?lastMainTab:d.back;
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
    if(back){back.style.display='flex';document.getElementById('topbarBackTitle').textContent=d.title;}
  } else {
    if(logo)logo.style.display='flex';
    if(back)back.style.display='none';
  }
  // No divider line under the topbar on the Accounts page or its Asset
  // Details drill-in — every other page keeps the usual border.
  var noBorderTabs=['portfolio','assetdetails','fund','market','watchlist','discover','all'];
  if(bar) bar.style.borderBottom=(noBorderTabs.indexOf(tab)>=0)?'none':'1px solid var(--border)';
}
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
  if(tab==='market'){renderMktList();drawKlciSparkline();updateMktTime();}
  if(tab==='watchlist'){renderWatchlist();}
  if(tab==='transaction'){renderTxList();}
  if(tab==='distribution'){renderDxList();}
  if(tab==='assetdetails'){setTimeout(function(){drawAdDonut();drawAdTrend(adPeriod);},50);}
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
function openPwModal(){
  document.getElementById('pwStep1').style.display='block';
  document.getElementById('pwStep2').style.display='none';
  document.getElementById('pwCurrent').value='';
  document.getElementById('pwCurrent').style.borderColor='var(--border)';
  document.getElementById('pwCurrentErr').style.display='none';
  document.getElementById('pwNew').value='';
  document.getElementById('pwConfirm').value='';
  document.getElementById('pwMatchErr').style.display='none';
  document.getElementById('pwScrim').style.display='block';
  document.getElementById('pwModal').style.display='block';
  setTimeout(function(){document.getElementById('pwCurrent').focus();},100);
}
function closePwModal(){
  document.getElementById('pwScrim').style.display='none';
  document.getElementById('pwModal').style.display='none';
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
    document.getElementById('pwCurrentErr').textContent='Unable to verify — please try again later.';
    document.getElementById('pwCurrentErr').style.display='block';
    return;
  }
  var origTxt=btn&&btn.textContent;
  if(btn){btn.disabled=true;btn.textContent='Verifying…';}
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
    setTimeout(function(){document.getElementById('pwNew').focus();},100);
  }catch(e){
    document.getElementById('pwCurrentErr').textContent='Incorrect password. Please try again.';
    document.getElementById('pwCurrentErr').style.display='block';
    document.getElementById('pwCurrent').style.borderColor='var(--red)';
  }finally{
    if(btn){btn.disabled=false;btn.textContent=origTxt;}
  }
}
async function savePw(){
  var n=document.getElementById('pwNew').value;
  var c=document.getElementById('pwConfirm').value;
  var btn=event&&event.target;
  if(n.length<8){document.getElementById('pwNew').style.borderColor='var(--red)';return;}
  if(n!==c){document.getElementById('pwMatchErr').style.display='block';document.getElementById('pwConfirm').style.borderColor='var(--red)';return;}
  if(typeof mpUpdatePassword!=='function'){showToastM('Password service unavailable');return;}
  var origTxt=btn&&btn.textContent;
  if(btn){btn.disabled=true;btn.textContent='Saving…';}
  try{
    await mpUpdatePassword(n);
    closePwModal();
    showToastM('Password updated successfully');
  }catch(e){
    document.getElementById('pwMatchErr').textContent='Update failed: '+(e&&e.message||'Unknown error');
    document.getElementById('pwMatchErr').style.display='block';
  }finally{
    if(btn){btn.disabled=false;btn.textContent=origTxt;}
  }
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
                   'adDonutTotal'];
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
