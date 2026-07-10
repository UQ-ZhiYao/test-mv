/* ===== assets/js/portal/pages-subscribe-redeem.js — Subscribe/redeem modal, document viewer, Coming-Soon page, render dispatch ===== */
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
