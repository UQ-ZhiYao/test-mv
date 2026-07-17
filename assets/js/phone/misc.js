/* ===== assets/js/phone/misc.js — Watchlist, logout, ownership panel, financial detail modal, remaining helpers ===== */
function drawPortfolioDonut(canvasId,data){
  var canvas=document.getElementById(canvasId);
  if(!canvas)return;
  if(!data||!data.length)return;
  var dpr=window.devicePixelRatio||1;
  var W=canvas.parentElement.clientWidth;
  var H=200;
  canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr);
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  var ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  var total=data.reduce(function(s,d){return s+d.v;},0);
  var r=74, inner=Math.round(r*0.72), cx=r+16, cy=H/2;
  var start=-Math.PI/2;
  data.forEach(function(d){
    var sweep=d.v/total*Math.PI*2;
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,start,start+sweep);
    ctx.arc(cx,cy,inner,start+sweep,start,true);
    ctx.closePath();
    ctx.fillStyle=d.c; ctx.fill();
    ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();
    start+=sweep;
  });
  ctx.beginPath(); ctx.arc(cx,cy,inner,0,Math.PI*2);
  ctx.fillStyle='#fff'; ctx.fill();
  var legX=cx+r+20, legGap=26;
  var legStartY=(H-data.length*legGap)/2+14;
  data.forEach(function(d,i){
    var lx=legX, ly=legStartY+i*legGap;
    ctx.beginPath(); ctx.arc(lx+5,ly,5,0,Math.PI*2);
    ctx.fillStyle=d.c; ctx.fill();
    ctx.fillStyle='#374151'; ctx.font='600 10px DM Sans,sans-serif'; ctx.textAlign='left';
    var nameW=ctx.measureText(d.label).width;
    ctx.fillText(d.label,lx+14,ly+4);
    ctx.fillStyle='#94A3B8'; ctx.font='500 10px DM Sans,sans-serif';
    ctx.fillText('  '+(d.v/total*100).toFixed(1)+'%',lx+14+nameW,ly+4);
  });
}
var sectorData=[];
var productData=[];
var PORTFOLIO_COLORS=['#1565C0','#1E88E5','#42A5F5','#90CAF9','#546E7A','#B0BEC5','#78909C','#CFD8DC'];
function applyPortfolioColors(entries){
  return entries.map(function(e,i){ return {label:e.label, v:+e.v.toFixed(1), c:PORTFOLIO_COLORS[i%PORTFOLIO_COLORS.length]}; });
}
var portfolioLoaded=false;
async function loadPortfolioData(){
  if(portfolioLoaded){ drawHoldingsChart(); drawSectorChart(); drawProductChart(); return; }
  try{
    if(typeof mpLoadHoldingsByFy!=='function') return;
    var byFy=await mpLoadHoldingsByFy();
    if(!byFy || !byFy.length) return;
    var latest=byFy[byFy.length-1];
    var holdings=latest.holdings||[];
    if(!holdings.length) return;

    // Holdings — top 8 shown as bars, summary describes top-3 concentration
    var top8=holdings.slice(0,8);
    holdingsData=top8.map(function(h){ return {label:h.name, v:+h.pct.toFixed(1)}; });
    var top3Total=holdings.slice(0,3).reduce(function(s,h){return s+h.pct;},0);
    var holdSum=document.getElementById('holdSummary');
    if(holdSum) holdSum.textContent='Top 3 Holdings '+top3Total.toFixed(2)+'% \u00a0\u00b7\u00a0 Latest Update '+latest.fy;

    // Sector Allocation — aggregate by sector
    var secMap={};
    holdings.forEach(function(h){ var k=h.sector||'Other'; secMap[k]=(secMap[k]||0)+h.pct; });
    var secEntries=Object.keys(secMap).map(function(k){return {label:k,v:secMap[k]};}).sort(function(a,b){return b.v-a.v;});
    sectorData=applyPortfolioColors(secEntries);
    var secSum=document.getElementById('sectorSummary');
    if(secSum) secSum.textContent='As at '+latest.fy;

    // Product Allocation — aggregate by product
    var prodMap={};
    holdings.forEach(function(h){ var k=h.product||'Other'; prodMap[k]=(prodMap[k]||0)+h.pct; });
    var prodEntries=Object.keys(prodMap).map(function(k){return {label:k,v:prodMap[k]};}).sort(function(a,b){return b.v-a.v;});
    productData=applyPortfolioColors(prodEntries);
    var prodSum=document.getElementById('productSummary');
    if(prodSum) prodSum.textContent='As at '+latest.fy;

    portfolioLoaded=true;
    drawHoldingsChart();
    drawSectorChart();
    drawProductChart();
  }catch(e){ console.warn('[Portfolio] load failed:', e.message); }
}
function drawSectorChart(){drawPortfolioDonut('sectorChart',sectorData);}
function drawProductChart(){drawPortfolioDonut('productChart',productData);}
(function(){})();

function toggleAcctExpand(){
  var p1=document.getElementById('acctExpandPanel');
  var p2=document.getElementById('jointExpandPanel');
  var btn=document.getElementById('acctExpandBtn');
  var pBtn=document.getElementById('personalExpandBtn');
  var jBtn=document.getElementById('jointExpandBtn');
  var open=p1.style.display==='block';
  p1.style.display=open?'none':'block';
  if(pBtn)pBtn.style.transform=open?'rotate(0deg)':'rotate(180deg)';
  // Only expand the Joint Account panel if this profile actually has a
  // joint account — otherwise there's nothing to show there.
  if(JA_ACCT){
    if(p2) p2.style.display=open?'none':'block';
    if(jBtn)jBtn.style.transform=open?'rotate(0deg)':'rotate(180deg)';
  } else if(p2){
    p2.style.display='none';
  }
  btn.style.transform=open?'rotate(0deg)':'rotate(180deg)';
}
// Watchlist screen logic (real "watchlist" table data) lives in
// assets/js/phone/watchlist-actions.js.

// ── AUTH ──────────────────────────────────────────────────────────────────────
function doLogout(){
  // Wipe the real Supabase session token directly and synchronously — do
  // NOT depend on sb.auth.signOut() completing or succeeding to decide
  // we're "logged out" locally. That was the actual bug: signOut() was
  // failing/erroring before it could clear the local session, so the old
  // session survived in localStorage, and login.html's session check
  // (correctly, from what it could see) found it still valid and sent the
  // user straight back — a fast bounce, not a hang. Clearing the token
  // ourselves guarantees login.html can never see a stale valid session,
  // regardless of whether the network call to Supabase succeeds, fails, or
  // hangs. signOut() still runs, purely as best-effort server-side cleanup
  // (revoking the refresh token) — its outcome no longer gates anything.
  try{
    Object.keys(localStorage).forEach(function(k){
      if(k.indexOf('sb-')===0 && k.indexOf('-auth-token')!==-1) localStorage.removeItem(k);
    });
    ['zy-session','zy_token','zy_role','zy_name','zy-page','zy_investor_id','zy_joint_account_id','zy_joint_account_name'].forEach(function(k){localStorage.removeItem(k);});
  }catch(e){}
  try{ if(typeof sb!=='undefined'&&sb) sb.auth.signOut().catch(function(){}); }catch(e){}
  window.location.href='login.html';
}
// ── AUTH GATE ────────────────────────────────────────────────────────────────
// The local zy-session/zy_token flags are a fast, synchronous hint — not the
// source of truth. On phones especially, they can drift out of sync with the
// real Supabase session (storage eviction, a PWA relaunch after the OS
// reclaims background storage, iOS Safari's stricter lifecycle for
// home-screen-added apps, etc.). Previously, a missing flag with a still-valid
// session bounced to login.html, which checks the *real* session, saw it was
// valid, and bounced straight back — an infinite loop that looked like the
// app had crashed. Now: the real session always wins. A valid session heals
// the local flags instead of triggering a bounce; only a genuinely absent
// session redirects to login.
(function(){
  var hasFlags = !!(localStorage.getItem('zy-session') || localStorage.getItem('zy_token'));
  function toLogin(){ window.location.replace('login.html'); }
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

function adjustProfileSpacer(){
  var spacer=document.getElementById('profileSpacer');
  var scroll=document.getElementById('mainScroll');
  if(!spacer||!scroll)return;
  spacer.style.height='0px';
  var page=document.getElementById('pg-profile');
  var contentH=page?page.scrollHeight:0;
  var available=scroll.clientHeight;
  var gap=available-contentH;
  spacer.style.height=Math.max(gap+16,16)+'px';
}
function openOwnershipPanel(){
  var main=document.getElementById('shareholderMain');
  var detail=document.getElementById('shareholderDetail');
  if(main) main.style.display='none';
  if(detail) detail.style.display='block';
  var scroll=document.getElementById('mainScroll');
  if(scroll) scroll.scrollTop=0;
  // Render SVG donut for detail view
  var wrap=document.getElementById('shareholderDetailChartWrap');
  if(!wrap)return;
  var total=shareholderData.reduce(function(s,d){return s+d.v;},0);
  var VW=192, cx=VW/2, cy=54, r=36, ir=24;
  var angle=-Math.PI/2, paths='', labels='';
  var top=shareholderData.reduce(function(a,b){return a.v>b.v?a:b;});
  shareholderData.forEach(function(d){
    var sweep=d.v/total*Math.PI*2;
    var x1=cx+r*Math.cos(angle),y1=cy+r*Math.sin(angle);
    var x2=cx+r*Math.cos(angle+sweep),y2=cy+r*Math.sin(angle+sweep);
    var ix1=cx+ir*Math.cos(angle+sweep),iy1=cy+ir*Math.sin(angle+sweep);
    var ix2=cx+ir*Math.cos(angle),iy2=cy+ir*Math.sin(angle);
    var lg=sweep>Math.PI?1:0;
    paths+='<path d="M'+x1.toFixed(2)+','+y1.toFixed(2)+' A'+r+','+r+' 0 '+lg+',1 '+x2.toFixed(2)+','+y2.toFixed(2)+' L'+ix1.toFixed(2)+','+iy1.toFixed(2)+' A'+ir+','+ir+' 0 '+lg+',0 '+ix2.toFixed(2)+','+iy2.toFixed(2)+' Z" fill="'+d.c+'" stroke="#fff" stroke-width="1"/>';
    // Outside label for top shareholder only
    if(d===top){
      var mid=angle+sweep/2;
      var lx=cx+Math.cos(mid)*(r+14), ly=cy+Math.sin(mid)*(r+14);
      var anchor=lx<cx?'end':'start';
      labels+='<text x="'+lx.toFixed(1)+'" y="'+(ly-2).toFixed(1)+'" text-anchor="'+anchor+'" font-size="6" font-weight="600" fill="#374151" font-family="DM Sans,sans-serif">'+d.label+'</text>';
      labels+='<text x="'+lx.toFixed(1)+'" y="'+(ly+5.5).toFixed(1)+'" text-anchor="'+anchor+'" font-size="5.5" fill="#64748B" font-family="DM Sans,sans-serif">'+d.v.toFixed(1)+'%</text>';
      // Leader line
      var lx0=cx+Math.cos(mid)*r, ly0=cy+Math.sin(mid)*r;
      var lx1=cx+Math.cos(mid)*(r+9), ly1=cy+Math.sin(mid)*(r+9);
      labels+='<line x1="'+lx0.toFixed(1)+'" y1="'+ly0.toFixed(1)+'" x2="'+lx1.toFixed(1)+'" y2="'+ly1.toFixed(1)+'" stroke="#94A3B8" stroke-width="0.8"/>';
    }
    angle+=sweep;
  });
  var rowH=9, legTop=cy+r+16;
  var legRows='';
  shareholderData.forEach(function(d,i){
    var y=legTop+5+i*rowH;
    legRows+='<circle cx="10" cy="'+y+'" r="2.5" fill="'+d.c+'"/>';
    legRows+='<text x="17" y="'+(y+1.5).toFixed(1)+'" font-size="7.5" fill="#374151" font-weight="600" font-family="DM Sans,sans-serif">'+d.label+'</text>';
    legRows+='<text x="'+(VW-4)+'" y="'+(y+1.5).toFixed(1)+'" font-size="7.5" fill="#374151" text-anchor="end" font-family="DM Sans,sans-serif">'+d.v.toFixed(1)+'%</text>';
    if(i<shareholderData.length-1){}
  });
  var svgH=legTop+shareholderData.length*rowH+10;
  wrap.innerHTML='<svg viewBox="0 0 '+VW+' '+svgH+'" width="100%" xmlns="http://www.w3.org/2000/svg">'+
    paths+
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+ir+'" fill="#fff"/>'+
    labels+legRows+'</svg>';
}
function closeOwnershipPanel(){
  var main=document.getElementById('shareholderMain');
  var detail=document.getElementById('shareholderDetail');
  if(main) main.style.display='block';
  if(detail) detail.style.display='none';
}
document.addEventListener('click',function(e){if(e.target.closest('.ownership-open-btn'))openOwnershipPanel();});

// ── FINANCIAL RESULTS DETAIL (chart + full table, per statement type) ──
var finDetailMode=null;
var FIN_DETAIL_TITLES={is:'Income Statement',bs:'Balance Sheet',cf:'Cash Flows',ra:'Ratio Analysis'};
function openFinDetail(mode){
  finDetailMode=mode;
  var resultsBody=document.getElementById('ftab-results-body');
  var detail=document.getElementById('finDetail');
  if(resultsBody) resultsBody.style.display='none';
  if(detail) detail.style.display='block';
  var scroll=document.getElementById('mainScroll');
  if(scroll) scroll.scrollTop=0;
  var titleEl=document.getElementById('finDetailTitle');
  if(titleEl) titleEl.textContent=FIN_DETAIL_TITLES[mode]||'';
  renderFinDetail();
}
function closeFinDetail(){
  var resultsBody=document.getElementById('ftab-results-body');
  var detail=document.getElementById('finDetail');
  if(resultsBody) resultsBody.style.display='block';
  if(detail) detail.style.display='none';
}
function fmtFinNum(v){
  v=v||0;
  var abs=Math.abs(v);
  var disp=abs>=1000000?(v/1000000).toFixed(2)+'M':abs>=1000?(v/1000).toFixed(2)+'k':v.toFixed(2);
  return disp;
}
// Builds a simple bordered table: first row = headers (FY labels), each
// subsequent row = [metric name, ...values].
function buildFinTable(headerRow,dataRows){
  var thStyle='padding:8px 12px;text-align:right;font-weight:700;color:var(--fg-3);font-size:.66rem;text-transform:uppercase;letter-spacing:.03em;border-bottom:1px solid var(--border);';
  var thStyleFirst=thStyle.replace('text-align:right','text-align:left');
  var tdStyle='padding:8px 12px;text-align:right;color:var(--fg-1);border-bottom:1px solid var(--border);';
  var tdStyleFirst=tdStyle.replace('text-align:right','text-align:left').replace('color:var(--fg-1)','color:var(--fg-2);font-weight:600');
  var html='<thead><tr>';
  headerRow.forEach(function(h,i){ html+='<th style="'+(i===0?thStyleFirst:thStyle)+'">'+h+'</th>'; });
  html+='</tr></thead><tbody>';
  dataRows.forEach(function(row){
    html+='<tr>';
    row.forEach(function(cell,i){ html+='<td style="'+(i===0?tdStyleFirst:tdStyle)+'">'+cell+'</td>'; });
    html+='</tr>';
  });
  html+='</tbody>';
  return html;
}
function fmtCentsRow(v){ return v==null?'-':(v).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtUnitsRow(v){ return v==null?'-':(v).toLocaleString('en-MY',{minimumFractionDigits:4,maximumFractionDigits:4}); }
function fmtNtaRow(v){ return v==null?'-':(v).toLocaleString('en-MY',{minimumFractionDigits:4,maximumFractionDigits:4}); }
function fmtPctRow(v){ return v==null?'-':(v).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})+'%'; }
function fmtCountRow(v){ return v==null?'-':Math.round(v).toLocaleString('en-MY'); }
function fmtMoneyRow(v){ return v==null?'-':(v).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}); }
// Builds one table row from a per-FY rows array (e.g. RESULTS_IS), matching
// desktop's fsRow() — field pulled by name, missing/null shown as "–".
function finRow(rows,label,field,fmtFn){
  fmtFn=fmtFn||fmtMoneyRow;
  return [label].concat(rows.map(function(r){
    var v=r?r[field]:null;
    return fmtFn(v==null?null:v);
  }));
}
function renderFinDetail(){
  var mode=finDetailMode;
  var table=document.getElementById('finDetailTable');
  if(!table) return;
  var years=RESULTS_IS.map(function(r){return r.fy;});
  if(mode==='is'){
    drawComboChart('finDetailChart', isData[activeISTab]||isData.revenue);
    table.innerHTML=buildFinTable(['FY'].concat(years),[
      finRow(RESULTS_IS,'Dividend Income','dividendIncome'),
      finRow(RESULTS_IS,'Interest Income','interestIncome'),
      finRow(RESULTS_IS,'Revenue / Total Income','revenue'),
      finRow(RESULTS_IS,'Management Cost','managementCost'),
      finRow(RESULTS_IS,'Gross Income','grossIncome'),
      finRow(RESULTS_IS,'Realised Profit & Loss','realizedPnl'),
      finRow(RESULTS_IS,'Unrealised Profit & Loss','unrealizedPnl'),
      finRow(RESULTS_IS,'Other Income / (Expenses)','otherIncomeExpense'),
      finRow(RESULTS_IS,'Profit before Tax','profitBeforeTax'),
      finRow(RESULTS_IS,'Tax Paid','tax'),
      finRow(RESULTS_IS,'Net Income / Profit after Tax (NPAT)','netIncome'),
      finRow(RESULTS_IS,'Outstanding Shares (Units)','outstandingShares',fmtUnitsRow),
      finRow(RESULTS_IS,'EPS (cents)','epsCents',fmtCentsRow)
    ]);
  } else if(mode==='bs'){
    drawBSChart('finDetailChart');
    var bsYearsFull=RESULTS_BS.map(function(r){return r.fy;});
    table.innerHTML=buildFinTable(['FY'].concat(bsYearsFull),[
      finRow(RESULTS_BS,'Securities','securities'),
      finRow(RESULTS_BS,'Other Investments','otherInvestments'),
      finRow(RESULTS_BS,'Dividend Receivables','dividendReceivables'),
      finRow(RESULTS_BS,'Cash & Cash Equivalents','cash'),
      finRow(RESULTS_BS,'Total Assets','totalAssets'),
      finRow(RESULTS_BS,'Accrual Fees','accrualFees'),
      finRow(RESULTS_BS,'Total Liabilities','totalLiabilities'),
      finRow(RESULTS_BS,'Total Capital','totalCapital'),
      finRow(RESULTS_BS,'Retained Earnings','retainedEarnings'),
      finRow(RESULTS_BS,'Total Equities','totalEquity'),
      finRow(RESULTS_BS,'Outstanding Shares (Units)','outstandingShares',fmtUnitsRow),
      finRow(RESULTS_BS,'NTA per Share','ntaPerShare',fmtNtaRow)
    ]);
  } else if(mode==='cf'){
    drawComboChart('finDetailChart', cfData[activeCFTab]||cfData.op);
    var cfYearsFull=RESULTS_CF.map(function(r){return r.fy;});
    table.innerHTML=buildFinTable(['FY'].concat(cfYearsFull),[
      finRow(RESULTS_CF,'Profit before Tax','profitBeforeTax'),
      finRow(RESULTS_CF,'Unrealised (Gain) / Loss on Investment','unrealizedAdjustment'),
      finRow(RESULTS_CF,'Realised (Gain) / Loss on Investment','realizedAdjustment'),
      finRow(RESULTS_CF,'Net Proceeds — Securities','proceedsSecurities'),
      finRow(RESULTS_CF,'Net Proceeds — Other Assets','proceedsOtherAssets'),
      finRow(RESULTS_CF,'Changes in Receivables','changeReceivables'),
      finRow(RESULTS_CF,'Changes in Accrual Fees','changeAccrualFees'),
      finRow(RESULTS_CF,'Cashflow from Operations','cashflowFromOps'),
      finRow(RESULTS_CF,'Income Tax Paid','incomeTaxPaid'),
      finRow(RESULTS_CF,'Net Cash from Operating Activities','netCashOperating'),
      finRow(RESULTS_CF,'Net Cash from Investing Activities','netCashInvesting'),
      finRow(RESULTS_CF,'Dividend Paid','dividendPaid'),
      finRow(RESULTS_CF,'Issuance of New Shares','issuanceOfShares'),
      finRow(RESULTS_CF,'Net Cash from Financing Activities','netCashFinancing'),
      finRow(RESULTS_CF,'Net Increase in Cash & Bank Balances','netIncreaseInCash'),
      finRow(RESULTS_CF,'Cash & Bank Balances at Beginning of FY','cashBeginning'),
      finRow(RESULTS_CF,'Cash & Bank Balances at End of FY','cashEnding')
    ]);
  } else if(mode==='ra'){
    drawComboChart('finDetailChart', raData[activeRATab]||raData.gps);
    var raYearsFull=RESULTS_RA.map(function(r){return r.fy;});
    table.innerHTML=buildFinTable(['FY'].concat(raYearsFull),[
      finRow(RESULTS_RA,'Gross Margin','grossMargin',fmtPctRow),
      finRow(RESULTS_RA,'PBT Margin','pbtMargin',fmtPctRow),
      finRow(RESULTS_RA,'NAT Margin','natMargin',fmtPctRow),
      finRow(RESULTS_RA,'Yield Return','yieldReturn',fmtPctRow),
      finRow(RESULTS_RA,'Gross Return','grossReturn',fmtPctRow),
      finRow(RESULTS_RA,'Return on Asset','returnOnAsset',fmtPctRow),
      finRow(RESULTS_RA,'Gearing Ratio','gearingRatio',fmtPctRow),
      finRow(RESULTS_RA,'Cash Reserve Ratio','cashReserveRatio',fmtPctRow),
      finRow(RESULTS_RA,'Dividend per Share (sen)','dps',fmtCentsRow),
      finRow(RESULTS_RA,'Dividend Yield','dividendYield',fmtPctRow),
      finRow(RESULTS_RA,'No. of Transactions','numTransactions',fmtCountRow),
      finRow(RESULTS_RA,'Total Trading Amount (RM)','totalTradingAmount'),
      finRow(RESULTS_RA,'Total Trading Units','totalTradingUnits',fmtUnitsRow),
      finRow(RESULTS_RA,'Total Trading Fees (RM)','totalTradingFees'),
      finRow(RESULTS_RA,'Fees Rate','feesRate',fmtPctRow)
    ]);
  }
}

// ── PAGE LOADER ──
(function loadPages(){
  var pages=["pg-all","pg-fund","pg-profile","pg-password","pg-discover","pg-market","pg-watchlist","pg-transaction","pg-distribution","pg-assetdetails","pg-inquiry","pg-feedback","pg-instrument","pg-accountdetails","pg-settings"];
  var srcMap={"pg-all":"all.html","pg-fund":"fund.html","pg-profile":"me.html","pg-password":"password.html","pg-discover":"discover.html","pg-market":"market.html","pg-watchlist":"watchlist.html","pg-transaction":"transaction.html","pg-distribution":"distribution.html","pg-assetdetails":"asset-details.html","pg-inquiry":"inquiry.html","pg-feedback":"feedback.html","pg-instrument":"instrument.html","pg-accountdetails":"account-details.html","pg-settings":"settings.html"};
  var mount=document.getElementById('pages-mount');
  Promise.all(pages.map(function(id){
    return fetch(srcMap[id]).then(function(r){return r.text();}).then(function(html){
      // Extract just the <div class="page"...>...</div> from standalone file
      var tmp=document.createElement('div');
      tmp.innerHTML=html;
      var pg=tmp.querySelector('.page');
      return pg?pg.outerHTML:html;
    });
  })).then(function(htmls){
    mount.innerHTML=htmls.join('\n');
    // Wire ownership detail buttons after injection
    document.querySelectorAll('.ownership-open-btn').forEach(function(btn){
      btn.addEventListener('click',function(){openOwnershipPanel();});
    });
    document.querySelectorAll('.ownership-close-btn').forEach(function(btn){
      btn.addEventListener('click',function(){closeOwnershipPanel();});
    });
    if(pendingTab){
      // User tapped a tab before its page finished loading — complete that
      // switch now that it's in the DOM.
      var t=pendingTab;
      pendingTab=null;
      switchTab(t);
    } else {
      var active=document.querySelector('.page.active');
      if(!active){
        var first=document.querySelector('.page');
        if(first) first.classList.add('active');
      }
    }
    // Init after pages are in DOM
    drawMChart('1d');renderMktList();drawKlciSparkline();updateMktTime();renderWatchlist();setTimeout(drawSparkline,100);setInterval(updateMktTime,1000);
    loadProfileData();
    loadAccountSummary();
    loadAdminBankAccount();
    zyFillSupportEmailText();
  });
})();

// ── SUPPORT EMAIL (Cloudflare Email Obfuscation workaround) ────────────────
// Cloudflare's "Email Address Obfuscation" (Scrape Shield) rewrites any
// plain user@domain.tld text or mailto: link it finds in the HTML it
// serves into its own [email protected] placeholder plus a decoder
// <script>. That decoder never runs for fund.html's/inquiry.html's contact
// text, because those pages are fetched as fragments and injected via
// innerHTML above (browsers never execute <script> tags inserted that
// way) — so the placeholder just sits there broken instead of decoding
// back to a real address. Building the address from JS at runtime, after
// the fragments are already in the DOM, means Cloudflare's edge-side
// scanner never sees a literal email pattern in the HTML it serves in the
// first place, so there's nothing for it to rewrite.
var ZY_SUPPORT_EMAIL=['support','zy-invest.com'].join('@');
function zyOpenSupportEmail(){
  window.location.href='mailto:'+ZY_SUPPORT_EMAIL;
}
function zyFillSupportEmailText(){
  document.querySelectorAll('.zy-support-email').forEach(function(el){
    el.textContent=ZY_SUPPORT_EMAIL;
  });
}

// ── APP FEEDBACK ─────────────────────────────────────────────────────────
// Submitting calls mpSendFeedback() (member-api.js), which invokes the
// send-feedback Supabase Edge Function — the email to support@zy-invest.com
// is sent server-side via Resend, so this is a silent submit with no mail
// app involved. The member's own address goes along as Reply-To.
function clearFeedbackSubjectErr(){
  var err=document.getElementById('feedbackSubjectErr');
  if(err) err.style.display='none';
}
async function submitFeedback(){
  var subjectEl=document.getElementById('feedbackSubjectSelect');
  var subject=subjectEl?subjectEl.value:'';
  var contentEl=document.getElementById('feedbackContent');
  var content=contentEl?contentEl.value.trim():'';
  var subjectErr=document.getElementById('feedbackSubjectErr');
  var contentErr=document.getElementById('feedbackContentErr');
  var ok=true;
  if(!subject){ if(subjectErr) subjectErr.style.display='block'; ok=false; }
  else if(subjectErr) subjectErr.style.display='none';
  if(!content){ if(contentErr) contentErr.style.display='block'; ok=false; }
  else if(contentErr) contentErr.style.display='none';
  if(!ok) return;

  var btn=document.getElementById('feedbackSubmitBtn');
  var btnLabel=btn?btn.textContent:'';
  var tt=typeof t==='function'?t:function(k){return k;};
  if(btn){ btn.disabled=true; btn.textContent=tt('feedback.sending'); }

  var name=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.full_name)?PROFILE.full_name:'';
  var email=(typeof AUTH_USER!=='undefined'&&AUTH_USER&&AUTH_USER.email)?AUTH_USER.email:'';
  try{
    await mpSendFeedback(subject,content,email,name);
    if(contentEl) contentEl.value='';
    if(subjectEl) subjectEl.value='';
    if(typeof showToastM==='function') showToastM(tt('feedback.toastSent'));
    if(typeof switchTab!=='undefined') switchTab('profile');
  }catch(e){
    console.error('submitFeedback failed:',e);
    var reason=(e&&e.message)?e.message:'please try again';
    if(typeof showToastM==='function') showToastM(tt('feedback.toastFailed')+reason.slice(0,100));
  }finally{
    if(btn){ btn.disabled=false; btn.textContent=btnLabel; }
  }
}
