/* ===== assets/js/phone/portfolio-widgets.js — Tab switching, password modal, portfolio value widgets, sparkline ===== */
function togglePortfolioValue(){
  portfolioVisible=!portfolioVisible;
  var icon=document.getElementById('eyeIcon');
  if(icon) icon.innerHTML=portfolioVisible
    ?'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
    :'<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
  applyEyeVisibility();
}

// ── PORTFOLIO SPARKLINE ───────────────────────────────────────────────────────
function drawSparkline(){
  var c=document.getElementById('sparkChart');
  if(!c)return;
  var w=100,h=44;
  c.width=w; c.height=h;
  var ctx=c.getContext('2d');
  var pts=[56224,58100,59800,61200,60400,59100,57800,58700,60200,59600,60800,61228];
  var min=Math.min.apply(null,pts),max=Math.max.apply(null,pts);
  var pX=2,pY=6;
  function sx(i){return pX+(i/(pts.length-1))*(w-pX*2);}
  function sy(v){return h-pY-(v-min)/(max-min)*(h-pY*2);}
  // dashed baseline
  var avgY=sy(pts.reduce(function(a,b){return a+b;},0)/pts.length);
  ctx.save();
  ctx.setLineDash([3,3]);
  ctx.beginPath();
  ctx.moveTo(pX,avgY); ctx.lineTo(w-pX,avgY);
  ctx.strokeStyle='rgba(0,0,0,.2)'; ctx.lineWidth=1; ctx.stroke();
  ctx.restore();
  // fill
  var grad=ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,'rgba(21,101,192,0.25)');
  grad.addColorStop(1,'rgba(21,101,192,0.02)');
  ctx.beginPath();
  ctx.moveTo(sx(0),sy(pts[0]));
  for(var i=1;i<pts.length;i++) ctx.lineTo(sx(i),sy(pts[i]));
  ctx.lineTo(sx(pts.length-1),h); ctx.lineTo(sx(0),h); ctx.closePath();
  ctx.fillStyle=grad; ctx.fill();
  // line
  ctx.beginPath();
  ctx.moveTo(sx(0),sy(pts[0]));
  for(var i=1;i<pts.length;i++) ctx.lineTo(sx(i),sy(pts[i]));
  ctx.strokeStyle='#1565C0'; ctx.lineWidth=2;
  ctx.lineJoin='round'; ctx.lineCap='round'; ctx.stroke();
  // dot
  ctx.beginPath();
  ctx.arc(sx(pts.length-1),sy(pts[pts.length-1]),3,0,Math.PI*2);
  ctx.fillStyle='#1565C0'; ctx.fill();
}

// ── TRANSACTIONS ──────────────────────────────────────────────────────────────
var TX_DATA=[];
function fmtTxDate(d){
  var dt=new Date(d+'T00:00:00');
  return dt.toLocaleDateString('en-MY',{day:'2-digit',month:'short',year:'numeric'});
}
// Builds the transaction list directly from the same capital_injection rows
// already loaded for Account Summary (PA_CI_ROWS/JA_CI_ROWS) — no separate
// query needed, and guarantees the two views can never disagree.
function buildTxDataFromCi(){
  var rows=[];
  function addRows(ciRows,acct){
    (ciRows||[]).forEach(function(r){
      var u=parseFloat(r.units)||0, a=parseFloat(r.amount)||0;
      rows.push({
        date:fmtTxDate(r.date), _sortDate:r.date,
        type:u>=0?'Subscription':'Redemption', acct:acct,
        kind:u>=0?'deposit':'withdrawal',
        amt:Math.abs(a), units:Math.abs(u)
      });
    });
  }
  addRows(PA_CI_ROWS,'pa');
  addRows(JA_CI_ROWS,'ja');
  rows.sort(function(a,b){ return a._sortDate<b._sortDate?1:(a._sortDate>b._sortDate?-1:0); });
  return rows;
}
var txFilter='all';
function setTxFilter(f){
  txFilter=f;
  ['all','deposit','withdrawal'].forEach(function(k){var b=document.getElementById('txf-'+k);if(b)b.classList.toggle('on',k===f);});
  renderTxList();
}
function fmtTxRM(n){return n.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});}
function renderTxList(){
  var sel=document.getElementById('txAcctSelect');
  if(!sel)return;
  var acct=sel.value;
  var rows=TX_DATA.filter(function(t){
    return (txFilter==='all'||t.kind===txFilter)&&(acct==='all'||t.acct===acct);
  });
  var list=document.getElementById('txList');
  if(!list)return;
  if(!rows.length){list.innerHTML='<div class="tx-empty">No transactions found</div>';return;}
  list.innerHTML=rows.map(function(t){
    return '<div class="tx-row">'
      +'<div class="txr-left"><div class="txr-date">'+t.date+'</div><div class="txr-type">'+t.type+'</div></div>'
      +'<div class="txr-right"><div class="txr-amt '+(t.kind==='deposit'?'dep':'wd')+'">'+(t.kind==='deposit'?'+':'-')+'RM '+fmtTxRM(t.amt)+'</div><div class="tx-units">'+fmtTxRM(t.units)+' units</div></div>'
      +'</div>';
  }).join('');
}

// ── DISTRIBUTIONS ────────────────────────────────────────────────────────
var DX_DATA=[];
// Computes each account's distribution entitlement per historical payout:
// units held as of that distribution's ex-date (from the same
// PA_CI_ROWS/JA_CI_ROWS already loaded) × that distribution's DPS. Note:
// whether an investor took cash or reinvested is a per-investor election
// not present in the fund-wide distributions table, so every entry is
// shown as "Cash Payout" — this is a known simplification, not a real
// reinvestment/cash distinction.
async function loadDistributionHistory(){
  try{
    if(typeof sb==='undefined'||!sb) return;
    var res=await sb.from('distributions').select('dps, ex_date, pay_date, status').eq('status','Paid').order('pay_date',{ascending:false});
    if(res.error){ console.warn('[Distributions] load failed:', res.error.message); return; }
    var distRows=res.data||[];
    var rows=[];
    distRows.forEach(function(d){
      [['pa',PA_CI_ROWS],['ja',JA_CI_ROWS]].forEach(function(pair){
        var acct=pair[0], ciRows=pair[1];
        if(!ciRows||!ciRows.length) return;
        var unitsAtExDate=0;
        ciRows.forEach(function(r){ if(r.date<=d.ex_date) unitsAtExDate+=parseFloat(r.units)||0; });
        if(unitsAtExDate<=0.0001) return;
        var amt=unitsAtExDate*(parseFloat(d.dps)||0)/100; // dps in sen → RM
        var payDate=d.pay_date||d.ex_date;
        rows.push({date:fmtTxDate(payDate), _sortDate:payDate, type:'Cash Payout', acct:acct, kind:'cash', amt:amt, units:0});
      });
    });
    rows.sort(function(a,b){ return a._sortDate<b._sortDate?1:(a._sortDate>b._sortDate?-1:0); });
    DX_DATA=rows;
    if(document.getElementById('dxList')) renderDxList();
  }catch(e){ console.warn('[Distributions] load failed:', e.message); }
}
var dxFilter='all';
function setDxFilter(f){
  dxFilter=f;
  ['all','cash','reinvest'].forEach(function(k){var b=document.getElementById('dxf-'+k);if(b)b.classList.toggle('on',k===f);});
  renderDxList();
}
function fmtDxRM(n){return n.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});}
function renderDxList(){
  var sel=document.getElementById('dxAcctSelect');
  if(!sel)return;
  var acct=sel.value;
  var rows=DX_DATA.filter(function(t){
    return (dxFilter==='all'||t.kind===dxFilter)&&(acct==='all'||t.acct===acct);
  });
  var list=document.getElementById('dxList');
  if(!list)return;
  if(!rows.length){list.innerHTML='<div class="dx-empty">No distributions found</div>';return;}
  list.innerHTML=rows.map(function(t){
    return '<div class="dx-row">'
      +'<div class="dxr-left"><div class="dxr-date">'+t.date+'</div><div class="dxr-type">'+t.type+'</div></div>'
      +'<div class="dxr-right"><div class="dxr-amt">+RM '+fmtDxRM(t.amt)+'</div><div class="dx-units">'+(t.units>0?fmtDxRM(t.units)+' units':'—')+'</div></div>'
      +'</div>';
  }).join('');
}

// ── ASSET DETAILS ─────────────────────────────────────────────────────────────
function drawAdDonut(){
  var c=document.getElementById('adDonut');
  if(!c)return;
  var paMv=PA_ACCT?PA_ACCT.mv:0, jaMv=JA_ACCT?JA_ACCT.mv:0;
  var total=paMv+jaMv;
  var paPct=total?(paMv/total*100):0, jaPct=total?(jaMv/total*100):0;
  var totalEl=document.getElementById('adDonutTotal');
  if(totalEl){ totalEl.setAttribute('data-real', fmtMoney(total)); totalEl.textContent=portfolioVisible?fmtMoney(total):'••••••'; }
  var pEl=document.getElementById('adLegendPersonal'); if(pEl) pEl.textContent=paPct.toFixed(1)+'%';
  var jEl=document.getElementById('adLegendJoint'); if(jEl) jEl.textContent=jaPct.toFixed(1)+'%';
  var jWrap=document.getElementById('adLegendJointWrap');
  if(jWrap) jWrap.style.display=JA_ACCT?'':'none';
  var dpr=window.devicePixelRatio||1;
  var W=c.parentElement.parentElement.clientWidth-32;
  var size=Math.min(W,260);
  var H=size*0.58;
  c.width=size*dpr;c.height=H*dpr;
  c.style.width=size+'px';c.style.height=H+'px';
  var ctx=c.getContext('2d');ctx.scale(dpr,dpr);
  var cx=size/2,cy=H*0.96,r=size*0.42,lw=r*0.11;
  var segs=JA_ACCT?[{v:paPct,c:'#64B5F6'},{v:jaPct,c:'#B39DDB'}]:[{v:paPct||100,c:'#64B5F6'}];
  var start=Math.PI;
  ctx.lineCap='butt';
  segs.forEach(function(s){
    var ang=(s.v/100)*Math.PI;
    ctx.beginPath();
    ctx.arc(cx,cy,r,start,start+ang);
    ctx.lineWidth=lw;ctx.strokeStyle=s.c;ctx.stroke();
    start+=ang;
  });
  var txt=document.getElementById('adDonutText');
  if(txt){txt.style.top=(cy-6)+'px';txt.style.transform='translateY(-100%)';}
}
var adPeriod='ytd';
// Asset Trends — for each nta_daily date in the selected period, value =
// that date's NTA × cumulative units held as of that date (PA + JA
// combined). Cumulative units use a running total over capital_injection
// rows sorted ascending, walked alongside the NTA dates (two-pointer,
// avoids re-scanning all transactions for every date).
async function loadAdTrendData(period){
  var today=new Date();
  var cutoff=null;
  if(period==='1m'){ cutoff=new Date(today); cutoff.setMonth(cutoff.getMonth()-1); }
  else if(period==='3m'){ cutoff=new Date(today); cutoff.setMonth(cutoff.getMonth()-3); }
  else if(period==='1y'){ cutoff=new Date(today); cutoff.setFullYear(cutoff.getFullYear()-1); }
  else if(period==='ytd'){ cutoff=new Date(today.getFullYear(),0,1); }
  var cutoffStr=cutoff?cutoff.toISOString().slice(0,10):'0000-00-00';
  var q=sb.from('nta_daily').select('date,nta').order('date',{ascending:true});
  if(cutoff) q=q.gte('date',cutoffStr);
  var res=await q;
  var ntaRows=res.data||[];
  var allCi=(PA_CI_ROWS||[]).concat(JA_CI_ROWS||[]).slice().sort(function(a,b){return a.date<b.date?-1:(a.date>b.date?1:0);});
  var idx=0, cum=0, vals=[], lbls=[];
  ntaRows.forEach(function(r){
    while(idx<allCi.length && allCi[idx].date<=r.date){ cum+=parseFloat(allCi[idx].units)||0; idx++; }
    vals.push(cum*(parseFloat(r.nta)||0));
    lbls.push(r.date);
  });
  return {v:vals, l:lbls};
}
function sampleAdLabels(dates){
  if(!dates.length) return [];
  var fmt=function(d){ return new Date(d+'T00:00:00').toLocaleDateString('en-MY',{month:'short',year:'2-digit'}); };
  return [fmt(dates[0]), fmt(dates[Math.floor(dates.length/2)]), fmt(dates[dates.length-1])];
}
// Rounds an axis value to a "nice" figure (nearest 10/100/1000/10000/... based
// on its own magnitude) and formats it compactly (K/M), instead of the raw
// value with two decimal places (e.g. 12123.32 -> "12K").
function niceAxisValue(v){
  var av=Math.abs(v);
  var step=av>=1000000?100000:av>=100000?10000:av>=10000?1000:av>=1000?100:av>=100?10:1;
  return Math.round(v/step)*step;
}
function fmtAxisLabel(v){
  var r=niceAxisValue(v);
  if(Math.abs(r)>=1000000) return (r/1000000).toFixed(r%1000000?1:0)+'M';
  if(Math.abs(r)>=1000) return (r/1000).toFixed(r%1000?1:0)+'K';
  return String(r);
}
async function drawAdTrend(period){
  var canvas=document.getElementById('adTrendChart');
  if(!canvas)return;
  var data=await loadAdTrendData(period);
  var ctx=canvas.getContext('2d');
  var dpr=window.devicePixelRatio||1;
  // Measured directly off the canvas's own flex-resolved box (it sits next
  // to the Y-axis label column in a flex row) rather than computed from a
  // fixed padding offset, so the chart's drawing area is exactly whatever
  // space is actually available to it — unchanged by adding the axis.
  var W=canvas.clientWidth||canvas.getBoundingClientRect().width,H=150;
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  var vals=data.v,n=vals.length;
  var y0e=document.getElementById('adTrendY0'),y1e=document.getElementById('adTrendY1'),y2e=document.getElementById('adTrendY2');
  if(n<2){
    var l0e=document.getElementById('adTrendL0'),l1e=document.getElementById('adTrendL1'),l2e=document.getElementById('adTrendL2');
    if(l0e)l0e.textContent=''; if(l1e)l1e.textContent='No data'; if(l2e)l2e.textContent='';
    if(y0e)y0e.textContent=''; if(y1e)y1e.textContent=''; if(y2e)y2e.textContent='';
    return;
  }
  var mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals),rng=(mx-mn)||1;
  if(y0e)y0e.textContent=fmtAxisLabel(mx);
  if(y1e)y1e.textContent=fmtAxisLabel((mn+mx)/2);
  if(y2e)y2e.textContent=fmtAxisLabel(mn);
  var padX=4,padY=10;
  function px(i){return padX+(i/(n-1))*(W-padX*2);}
  function py(v){return H-padY-((v-mn)/rng)*(H-padY*2);}
  var grad=ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'rgba(21,101,192,.18)');
  grad.addColorStop(1,'rgba(21,101,192,0)');
  ctx.beginPath();
  ctx.moveTo(px(0),py(vals[0]));
  for(var i=1;i<n;i++) ctx.lineTo(px(i),py(vals[i]));
  ctx.lineTo(px(n-1),H-padY);ctx.lineTo(px(0),H-padY);ctx.closePath();
  ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();ctx.strokeStyle='#1565C0';ctx.lineWidth=2;ctx.lineJoin='round';ctx.lineCap='round';
  ctx.moveTo(px(0),py(vals[0]));
  for(var i=1;i<n;i++) ctx.lineTo(px(i),py(vals[i]));
  ctx.stroke();
  ctx.beginPath();ctx.arc(px(n-1),py(vals[n-1]),3.5,0,Math.PI*2);
  ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#1565C0';ctx.lineWidth=2;ctx.stroke();
  var lbls=sampleAdLabels(data.l);
  var l0=document.getElementById('adTrendL0'),l1=document.getElementById('adTrendL1'),l2=document.getElementById('adTrendL2');
  if(l0)l0.textContent=lbls[0]||'';
  if(l1)l1.textContent=lbls[1]||'';
  if(l2)l2.textContent=lbls[2]||'';
}
function switchAdPeriod(p,btn){
  adPeriod=p;
  document.querySelectorAll('#adSeg button').forEach(function(b){b.classList.remove('on');});
  btn.classList.add('on');
  drawAdTrend(p);
}

// ── SUBSCRIBE / REDEEM ────────────────────────────────────────────────────────
// PA_ACCT/JA_ACCT/LATEST_NTA (assets/js/phone/profile-account.js) are the
// same real, live figures shown on the Accounts screen — no separate demo
// data here anymore.
var subAcct='pa',redAcct='pa';
var subReceiptFile=null;
var subRefId=null,redRefId=null;
function fmtRM(n){return (n||0).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});}
function acctData(a){ return a==='ja'?JA_ACCT:PA_ACCT; }

// SUB-20260712-INV0042-001 / RED-20260712-INV0042-001 — type, issue date,
// the member's own investor_id, and a running index (this member's Nth
// request in that table) so two requests on the same day still get
// distinct references.
// Fixed at 12 characters: 1 (type) + 6 (YYMMDD) + 3 (investor id) + 2 (index).
function genRequestRef(type,investorId,index){
  var d=new Date();
  var yy=String(d.getFullYear()).slice(-2);
  var mm=String(d.getMonth()+1).padStart(2,'0');
  var dd=String(d.getDate()).padStart(2,'0');
  var t=(type||'?').charAt(0).toUpperCase();
  var idDigits=String(investorId||'').replace(/\D/g,'');
  var idPart=(idDigits.slice(-3)||'000').padStart(3,'0');
  var idxPart=String(index%100).padStart(2,'0');
  return t+yy+mm+dd+idPart+idxPart;
}
// Computed once when the sheet opens (not re-generated at submit time) so
// the reference the member sees on screen — the one they'd write on their
// bank transfer — is exactly the one that ends up on their request.
async function refreshRequestRef(prefix,type,table){
  var investorId=(PROFILE&&PROFILE.investor_id)||(AUTH_USER&&AUTH_USER.id);
  var el=document.getElementById(prefix+'Ref');
  if(el) el.textContent='—';
  var ref=null;
  try{
    var count=await mpCountRequests(table,investorId);
    ref=genRequestRef(type,investorId,count+1);
  }catch(e){ console.warn('Reference ID lookup failed:', e.message); }
  if(prefix==='sub') subRefId=ref; else redRefId=ref;
  if(el) el.textContent=ref||'—';
}

function openSheet(type){
  if(typeof ACCOUNT_RESTRICTED!=='undefined' && ACCOUNT_RESTRICTED){
    document.getElementById('sheetScrim').classList.add('vis');
    document.getElementById('restrictedSheet').classList.add('vis');
    return;
  }
  var prefix=type==='subscribe'?'sub':'red';
  document.getElementById('sheetScrim').classList.add('vis');
  document.getElementById(type==='subscribe'?'subSheet':'redSheet').classList.add('vis');
  // Personal Account is always available; the Joint Account toggle only
  // shows up if the profile actually has one.
  var jaBtn=document.getElementById(prefix+'Acct-ja');
  if(jaBtn) jaBtn.style.display=(PROFILE&&PROFILE.joint_account_id)?'':'none';
  if(type==='subscribe'){
    var b=ADMIN_BANK||{};
    document.getElementById('subBankName').textContent=b.bank_name||'—';
    document.getElementById('subBankHolder').textContent=b.bank_account_holder||'—';
    document.getElementById('subBankAcctNo').textContent=b.bank_account_no||'—';
    document.getElementById('subNtaLbl').textContent='Indicative Units (NTA '+(LATEST_NTA>0?LATEST_NTA.toFixed(4):'—')+')';
    document.getElementById('mSubAmt').value='';
    document.getElementById('mSubUnits').value='—';
    subReceiptFile=null;
    var fileEl=document.getElementById('mSubReceipt'); if(fileEl) fileEl.value='';
    document.getElementById('subReceiptErr').style.display='none';
    document.getElementById('subErr').style.display='none';
    selectAcct('sub','pa');
    refreshRequestRef('sub','SUB','subscription_requests');
  } else {
    var P=PROFILE||{};
    var acctNo=P.bank_account_no?('···· '+String(P.bank_account_no).slice(-4)):null;
    var parts=[P.bank_name,acctNo,P.bank_account_holder].filter(Boolean);
    document.getElementById('redPayoutBank').textContent=parts.length?parts.join(' · '):'—';
    document.getElementById('redNtaLbl').textContent='Indicative Units to Redeem (NTA '+(LATEST_NTA>0?LATEST_NTA.toFixed(4):'—')+')';
    document.getElementById('redErr').style.display='none';
    selectAcct('red','pa');
    refreshRequestRef('red','RED','redemption_requests');
  }
}
function closeSheet(){
  document.querySelectorAll('.sheet').forEach(function(s){s.classList.remove('vis');});
  document.getElementById('sheetScrim').classList.remove('vis');
}
function selectAcct(sheet,acct){
  if(sheet==='sub')subAcct=acct;else redAcct=acct;
  ['pa','ja'].forEach(function(a){
    var btn=document.getElementById(sheet+'Acct-'+a);
    if(!btn)return;
    var on=a===acct;
    btn.style.background=on?'#fff':'none';
    btn.style.color=on?'var(--blue)':'var(--fg-3)';
    btn.style.boxShadow=on?'0 1px 4px rgba(0,0,0,.1)':'none';
  });
  if(sheet==='red'){
    var acc=acctData(acct);
    document.getElementById('redHeldUnits').textContent=fmtRM(acc?acc.units:0);
    document.getElementById('redHeldValue').textContent=fmtRM(acc?acc.mv:0);
    document.getElementById('mRedAmt').value='';
    document.getElementById('mRedUnits').value='—';
  }
}
function setSubAmt(v){document.getElementById('mSubAmt').value=v;calcSubUnits();}
function calcSubUnits(){var a=parseFloat(document.getElementById('mSubAmt').value);document.getElementById('mSubUnits').value=(a>0&&LATEST_NTA>0)?fmtRM(a/LATEST_NTA)+' units':'—';}
function setRedPct(p){var acc=acctData(redAcct);if(!acc)return;var a=acc.mv*p/100;document.getElementById('mRedAmt').value=a.toFixed(2);document.getElementById('mRedUnits').value=fmtRM(acc.units*p/100)+' units';}
function calcRedUnits(){var acc=acctData(redAcct);var a=parseFloat(document.getElementById('mRedAmt').value);document.getElementById('mRedUnits').value=(a>0&&LATEST_NTA>0)?fmtRM(a/LATEST_NTA)+' units':'—';}
function onSubReceiptChange(){
  var fileEl=document.getElementById('mSubReceipt');
  subReceiptFile=(fileEl.files&&fileEl.files[0])||null;
  if(subReceiptFile) document.getElementById('subReceiptErr').style.display='none';
}
async function submitSubM(){
  var a=parseFloat(document.getElementById('mSubAmt').value);
  var errEl=document.getElementById('subErr');
  errEl.style.display='none';
  var ok=true;
  if(!a||a<=0){errEl.textContent='Please enter an amount.';errEl.style.display='block';ok=false;}
  if(!subReceiptFile){document.getElementById('subReceiptErr').style.display='block';ok=false;}
  if(!ok)return;
  var btn=document.getElementById('mSubBtn'),orig=btn.textContent;
  btn.disabled=true;btn.textContent='Submitting…';
  try{
    var investorId=(PROFILE&&PROFILE.investor_id)||(AUTH_USER&&AUTH_USER.id);
    var receiptUrl=await mpUploadReceipt(investorId,subReceiptFile);
    // subscription_requests has no dedicated column for the reference ID
    // shown on screen or for which account (PA/JA) the request is for, so
    // both are recorded in the note instead.
    var noteParts=['Ref: '+(subRefId||'—')];
    if(subAcct==='ja') noteParts.push('Joint Account');
    await mpSubmitSubscription(investorId,{amount:a,receiptUrl:receiptUrl,note:noteParts.join(' | ')});
    closeSheet();
    setTimeout(function(){showToastM('Subscription '+(subRefId||'')+' of RM '+fmtRM(a)+' submitted for review');},200);
  }catch(e){
    errEl.textContent='Submission failed: '+((e&&e.message)||'Unknown error');
    errEl.style.display='block';
  }finally{
    btn.disabled=false;btn.textContent=orig;
  }
}
async function submitRedM(){
  var acc=acctData(redAcct);
  var a=parseFloat(document.getElementById('mRedAmt').value);
  var errEl=document.getElementById('redErr');
  errEl.style.display='none';
  if(!acc||!a||a<=0||a>acc.mv){errEl.textContent='Please enter a valid amount.';errEl.style.display='block';return;}
  var units=LATEST_NTA>0?(a/LATEST_NTA):0;
  var btn=document.getElementById('mRedBtn'),orig=btn.textContent;
  btn.disabled=true;btn.textContent='Submitting…';
  try{
    var investorId=(PROFILE&&PROFILE.investor_id)||(AUTH_USER&&AUTH_USER.id);
    // redemption_requests has no dedicated column for the reference ID
    // shown on screen or for which account (PA/JA) the request is for, so
    // both are recorded in the note instead.
    var noteParts=['Ref: '+(redRefId||'—')];
    if(redAcct==='ja') noteParts.push('Joint Account');
    await mpSubmitRedemption(investorId,{amount:a,units:units,note:noteParts.join(' | ')});
    closeSheet();
    setTimeout(function(){showToastM('Redemption '+(redRefId||'')+' of RM '+fmtRM(a)+' submitted — 15 business days');},200);
  }catch(e){
    errEl.textContent='Submission failed: '+((e&&e.message)||'Unknown error');
    errEl.style.display='block';
  }finally{
    btn.disabled=false;btn.textContent=orig;
  }
}

var MARKETS={
  asia:[
    {n:'FBM KLCI',ex:'Bursa',v:1524.38,c:8.72,cp:0.57,up:true},
    {n:'Nikkei 225',ex:'JPX',v:38947.01,c:312.50,cp:0.81,up:true},
    {n:'Hang Seng',ex:'HKEX',v:17651.82,c:-124.30,cp:-0.70,up:false},
    {n:'Shanghai Comp.',ex:'SSE',v:3089.26,c:-18.44,cp:-0.59,up:false},
    {n:'Straits Times',ex:'SGX',v:3421.75,c:21.08,cp:0.62,up:true},
    {n:'KOSPI',ex:'KRX',v:2642.36,c:15.88,cp:0.60,up:true},
    {n:'Nifty 50',ex:'NSE',v:24601.40,c:185.20,cp:0.76,up:true},
    {n:'ASX 200',ex:'ASX',v:8241.60,c:38.40,cp:0.47,up:true},
  ],
  us:[
    {n:'S&P 500',ex:'NYSE',v:5482.87,c:38.24,cp:0.70,up:true},
    {n:'Nasdaq',ex:'NASDAQ',v:17857.02,c:142.68,cp:0.80,up:true},
    {n:'Dow Jones',ex:'NYSE',v:42847.36,c:-120.14,cp:-0.28,up:false},
    {n:'Russell 2000',ex:'NYSE',v:2081.44,c:14.22,cp:0.69,up:true},
    {n:'S&P/TSX Comp.',ex:'TSX',v:24312.80,c:98.50,cp:0.41,up:true},
    {n:'Bovespa',ex:'B3',v:127841.00,c:-540.20,cp:-0.42,up:false},
  ],
  eu:[
    {n:'FTSE 100',ex:'LSE',v:8447.12,c:32.18,cp:0.38,up:true},
    {n:'DAX',ex:'Xetra',v:18892.34,c:124.56,cp:0.66,up:true},
    {n:'CAC 40',ex:'Euronext',v:7681.25,c:-38.44,cp:-0.50,up:false},
    {n:'Euro Stoxx 50',ex:'Euronext',v:4981.88,c:28.34,cp:0.57,up:true},
    {n:'AEX',ex:'AMS',v:924.44,c:5.88,cp:0.64,up:true},
    {n:'SMI',ex:'SIX',v:12284.77,c:-44.21,cp:-0.36,up:false},
  ],
  crypto:[
    {n:'Bitcoin',ex:'BTC',v:98421.00,c:1842.00,cp:1.91,up:true},
    {n:'Ethereum',ex:'ETH',v:3814.20,c:-82.40,cp:-2.12,up:false},
    {n:'Solana',ex:'SOL',v:182.44,c:8.22,cp:4.72,up:true},
    {n:'XRP',ex:'XRP',v:0.5842,c:0.0124,cp:2.17,up:true},
    {n:'BNB',ex:'BNB',v:612.80,c:14.40,cp:2.40,up:true},
    {n:'USDT',ex:'USDT',v:1.0001,c:0.0001,cp:0.01,up:true},
  ]
};
var mktRegion='asia';
function mktTab(r,btn){
  mktRegion=r;
  document.querySelectorAll('[id^="mkt-tab-"]').forEach(function(b){b.classList.remove('on');});
  btn.classList.add('on');
  renderMktList();
}
function fmtNum(n){return n>=1000?n.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}):n>=1?n.toFixed(2):n.toFixed(4);}
function renderMktList(){
  var data=MARKETS[mktRegion];
  var el=document.getElementById('mktList');
  if(!el)return;
  el.innerHTML=data.map(function(d,i){
    var clr=d.up?'var(--green)':'var(--red)';
    var sign=d.up?'+':'';
    return '<div style="display:flex;align-items:center;padding:12px 16px;border-bottom:'+(i<data.length-1?'1px solid var(--border)':'none')+'">'
      +'<div style="width:36px;height:36px;border-radius:9px;background:'+(d.up?'var(--green-bg)':'var(--red-bg)')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:12px;font-size:.6rem;font-weight:700;color:'+clr+';text-align:center;line-height:1.2">'+d.ex+'</div>'
      +'<div style="flex:1;min-width:0"><div style="font-size:.86rem;font-weight:600;color:var(--fg-1)">'+d.n+'</div></div>'
      +'<div style="text-align:right"><div style="font-size:.88rem;font-weight:700;font-family:monospace;color:var(--fg-1)">'+fmtNum(d.v)+'</div>'
      +'<div style="font-size:.72rem;font-weight:700;color:'+clr+'">'+sign+d.cp.toFixed(2)+'%</div></div>'
      +'</div>';
  }).join('');
}
// KLCI sparkline
function drawKlciSparkline(){
  var c=document.getElementById('klciSparkline');if(!c)return;
  var ctx=c.getContext('2d');
  var v=[1514,1516,1512,1519,1521,1515,1518,1522,1520,1524];
  var mn=Math.min.apply(null,v),mx=Math.max.apply(null,v),rng=mx-mn;
  var W=120,H=36,n=v.length;
  ctx.clearRect(0,0,W,H);
  ctx.beginPath();ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=1.5;ctx.lineJoin='round';
  v.forEach(function(val,i){
    var x=i/(n-1)*(W-4)+2,y=H-4-((val-mn)/rng)*(H-8);
    i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  });
  ctx.stroke();
}
// Market time
function updateMktTime(){
  var el=document.getElementById('mktTime');if(!el)return;
  var d=new Date(),h=d.getHours(),m=d.getMinutes(),s=d.getSeconds();
  el.textContent=(h%12||12)+':'+(m<10?'0':'')+m+':'+(s<10?'0':'')+s+(h>=12?' PM':' AM');
}
// ── PASSWORD (mobile) ─────────────────────────────────────────────────────────
