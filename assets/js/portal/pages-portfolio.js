/* ===== assets/js/portal/pages-portfolio.js — Dashboard overview + Holdings + Transactions + Statements pages ===== */
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
