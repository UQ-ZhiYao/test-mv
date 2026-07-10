/* ===== assets/js/phone/financial-charts-2.js — Cash-flow/ratio-analysis charts, results loading, shareholder + portfolio donut charts ===== */
function drawComboChart(canvasId,d){
  var canvas=document.getElementById(canvasId);
  if(!canvas)return;
  if(!d||!d.values||!d.values.length)return;
  var dpr=window.devicePixelRatio||1;
  var W=canvas.parentElement.clientWidth;
  var H=230;
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.height=H+'px';
  var ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  var pad={t:16,r:8,b:100,l:8};
  var cw=W-pad.l-pad.r, ch=H-pad.t-pad.b;
  var chartBottom=pad.t+ch;
  var yearY=chartBottom+14, valueY=chartBottom+28, yoyY=chartBottom+42, legY=chartBottom+68;
  var n=d.values.length;
  // Zero-baseline scale — always includes 0 in the range, so a negative
  // value's bar correctly dips below the baseline instead of rendering
  // identically to a positive value (which Math.abs() used to cause).
  var maxV=Math.max.apply(null,d.values.concat([0]))*1.12;
  var minV=Math.min.apply(null,d.values.concat([0]))*1.12;
  var vRange=(maxV-minV)||1;
  function barY(v){ return pad.t+ch*((maxV-v)/vRange); }
  var zeroY=barY(0);
  var slot=cw/n, barW=slot*0.14;
  ctx.strokeStyle='#94A3B8'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(pad.l,zeroY); ctx.lineTo(pad.l+cw,zeroY); ctx.stroke();
  var yoyVals=d.values.map(function(v,i){return i===0?null:((v-d.values[i-1])/d.values[i-1]*100);});
  var yoyNonNull=yoyVals.filter(function(v){return v!==null;});
  var minYoy=Math.min.apply(null,yoyNonNull)-2, maxYoy=Math.max.apply(null,yoyNonNull)+2;
  function yoyYp(v){return pad.t+ch-((v-minYoy)/(maxYoy-minYoy))*ch;}
  d.values.forEach(function(v,i){
    var cx=pad.l+i*slot+slot/2, x=cx-barW/2;
    var vTop=barY(v);
    var y=Math.min(zeroY,vTop), barH=Math.abs(vTop-zeroY);
    var up=v>=0;
    ctx.fillStyle='#226ad6';
    var r=Math.min(3,barH); // avoid corner radius overshoot on very short bars
    ctx.beginPath();
    if(up){
      ctx.moveTo(x+r,y); ctx.lineTo(x+barW-r,y);
      ctx.arcTo(x+barW,y,x+barW,y+r,r);
      ctx.lineTo(x+barW,zeroY); ctx.lineTo(x,zeroY);
      ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
    } else {
      // rounded corners on the bottom edge instead, since the bar hangs
      // below the zero line
      var yb=zeroY+barH;
      ctx.moveTo(x,zeroY); ctx.lineTo(x+barW,zeroY);
      ctx.lineTo(x+barW,yb-r); ctx.arcTo(x+barW,yb,x+barW-r,yb,r);
      ctx.lineTo(x+r,yb); ctx.arcTo(x,yb,x,yb-r,r);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle='#374151'; ctx.font='500 12px DM Sans,sans-serif'; ctx.textAlign='center';
    ctx.fillText(d.years[i],cx,yearY);
    var disp=Math.abs(v)>=1000000?(v/1000000).toFixed(2)+'M':Math.abs(v)>=1000?(v/1000).toFixed(2)+'k':v.toFixed(2);
    ctx.fillStyle='#226ad6'; ctx.font='600 11px DM Sans,sans-serif';
    ctx.fillText(disp,cx,valueY);
    if(i===0){ctx.fillStyle='#94A3B8';ctx.font='500 11px DM Sans,sans-serif';ctx.fillText('—',cx,yoyY);}
    else{var yoy=yoyVals[i];ctx.fillStyle=yoy>=0?'#2E7D32':'#DC2626';ctx.font='600 11px DM Sans,sans-serif';ctx.fillText((yoy>=0?'+':'')+yoy.toFixed(1)+'%',cx,yoyY);}
  });
  ctx.strokeStyle='#F57C00'; ctx.lineWidth=1; ctx.setLineDash([]);
  ctx.beginPath(); var started=false;
  yoyVals.forEach(function(v,i){if(v===null)return;var cx=pad.l+i*slot+slot/2;var y=yoyYp(v);if(!started){ctx.moveTo(cx,y);started=true;}else{ctx.lineTo(cx,y);}});
  ctx.stroke();
  yoyVals.forEach(function(v,i){if(v===null)return;var cx=pad.l+i*slot+slot/2;ctx.beginPath();ctx.arc(cx,yoyYp(v),3.5,0,Math.PI*2);ctx.fillStyle='#F57C00';ctx.fill();});
  var legItems=[{color:'#226ad6',label:d.label},{color:'#F57C00',label:'YoY Growth'}];
  ctx.font='700 11px DM Sans,sans-serif';
  var legSpacing=16, totalW=legItems.reduce(function(s,it){return s+10+ctx.measureText(it.label).width+legSpacing;},0)-legSpacing;
  var lx=(W-totalW)/2;
  legItems.forEach(function(it){ctx.beginPath();ctx.arc(lx+4,legY,5,0,Math.PI*2);ctx.fillStyle=it.color;ctx.fill();ctx.fillStyle='#374151';ctx.font='700 11px DM Sans,sans-serif';ctx.textAlign='left';ctx.fillText(it.label,lx+13,legY+4);lx+=10+ctx.measureText(it.label).width+legSpacing;});
}

// ── BALANCE SHEET ──
var bsAssets=[];
var bsLiab=[];
var bsYears=[];
function drawBSChart(canvasId){
  var canvas=document.getElementById(canvasId||'bsChart');
  if(!canvas)return;
  if(!bsYears.length)return;
  var dpr=window.devicePixelRatio||1;
  var W=canvas.parentElement.clientWidth;
  var H=260;
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.height=H+'px';
  var ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  var pad={t:16,r:8,b:120,l:8};
  var cw=W-pad.l-pad.r, ch=H-pad.t-pad.b;
  var chartBottom=pad.t+ch;
  var yearY=chartBottom+14, legY=chartBottom+90;
  var n=bsYears.length;
  var maxV=Math.max.apply(null,bsAssets.concat(bsLiab).concat([0]))*1.12;
  var minV=Math.min.apply(null,bsAssets.concat(bsLiab).concat([0]))*1.12;
  var vRange=(maxV-minV)||1;
  function barYAbs(v){ return pad.t+ch*((maxV-v)/vRange); }
  var zeroYAbs=barYAbs(0);
  var slot=cw/n, barW=slot*0.13, gap=3;
  // x-axis (zero baseline — coincides with the bottom edge whenever every
  // value is non-negative, same visual result as before in that case)
  ctx.strokeStyle='#94A3B8'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(pad.l,zeroYAbs); ctx.lineTo(pad.l+cw,zeroYAbs); ctx.stroke();
  // ratio scale
  var ratios=bsLiab.map(function(l,i){return l/bsAssets[i];});
  var minR=Math.min.apply(null,ratios)-0.02, maxR=Math.max.apply(null,ratios)+0.02;
  function ry(v){return pad.t+ch-((v-minR)/(maxR-minR))*ch;}
  // draw bars
  bsYears.forEach(function(yr,i){
    var cx=pad.l+i*slot+slot/2;
    var x0=cx-barW-gap/2, x1=cx+gap/2;
    function drawBar(x,h,color){
      var vTop=barYAbs(h);
      var up=h>=0;
      var y=Math.min(zeroYAbs,vTop), barH=Math.abs(vTop-zeroYAbs);
      var r=Math.min(3,barH);
      ctx.fillStyle=color;
      ctx.beginPath();
      if(up){
        ctx.moveTo(x+r,y); ctx.lineTo(x+barW-r,y);
        ctx.arcTo(x+barW,y,x+barW,y+r,r);
        ctx.lineTo(x+barW,zeroYAbs); ctx.lineTo(x,zeroYAbs);
        ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
      } else {
        var yb=zeroYAbs+barH;
        ctx.moveTo(x,zeroYAbs); ctx.lineTo(x+barW,zeroYAbs);
        ctx.lineTo(x+barW,yb-r); ctx.arcTo(x+barW,yb,x+barW-r,yb,r);
        ctx.lineTo(x+r,yb); ctx.arcTo(x,yb,x,yb-r,r);
      }
      ctx.closePath(); ctx.fill();
    }
    drawBar(x0,bsAssets[i],'#226ad6');
    drawBar(x1,bsLiab[i],'#90CAF9');
    // year label
    ctx.fillStyle='#374151'; ctx.font='500 12px DM Sans,sans-serif'; ctx.textAlign='center';
    ctx.fillText(yr,cx,yearY);
    // asset value
    var aDisp=bsAssets[i]>=1000000?(bsAssets[i]/1000000).toFixed(2)+'M':(bsAssets[i]/1000).toFixed(2)+'k';
    ctx.fillStyle='#226ad6'; ctx.font='600 10px DM Sans,sans-serif';
    ctx.fillText(aDisp,cx,yearY+14);
    // liab value
    var lDisp=bsLiab[i]>=1000000?(bsLiab[i]/1000000).toFixed(2)+'M':(bsLiab[i]/1000).toFixed(2)+'k';
    ctx.fillStyle='#5aabf0'; ctx.font='600 10px DM Sans,sans-serif';
    ctx.fillText(lDisp,cx,yearY+27);
    // ratio value
    ctx.fillStyle='#F57C00'; ctx.font='600 10px DM Sans,sans-serif';
    ctx.fillText((ratios[i]*100).toFixed(1)+'%',cx,yearY+40);
  });
  // ratio line
  ctx.strokeStyle='#F57C00'; ctx.lineWidth=1; ctx.setLineDash([]);
  ctx.beginPath();
  ratios.forEach(function(v,i){
    var cx=pad.l+i*slot+slot/2;
    if(i===0)ctx.moveTo(cx,ry(v)); else ctx.lineTo(cx,ry(v));
  });
  ctx.stroke();
  ratios.forEach(function(v,i){
    var cx=pad.l+i*slot+slot/2;
    ctx.beginPath(); ctx.arc(cx,ry(v),3.5,0,Math.PI*2);
    ctx.fillStyle='#F57C00'; ctx.fill();
  });
  // legend
  var legItems=[{color:'#226ad6',label:'Assets'},{color:'#90CAF9',label:'Liabilities'},{color:'#F57C00',label:'Ratio'}];
  ctx.font='700 11px DM Sans,sans-serif';
  var legSpacing=14, totalW=legItems.reduce(function(s,it){return s+10+ctx.measureText(it.label).width+legSpacing;},0)-legSpacing;
  var lx=(W-totalW)/2;
  legItems.forEach(function(it){
    ctx.beginPath(); ctx.arc(lx+4,legY,5,0,Math.PI*2);
    ctx.fillStyle=it.color; ctx.fill();
    ctx.fillStyle='#374151'; ctx.font='700 11px DM Sans,sans-serif'; ctx.textAlign='left';
    ctx.fillText(it.label,lx+13,legY+4);
    lx+=10+ctx.measureText(it.label).width+legSpacing;
  });
}

// ── CASH FLOWS ──
var cfData={
  op:  {label:'Operating CF', values:[],years:[]},
  inv: {label:'Investing CF', values:[],years:[]},
  fin: {label:'Financing CF', values:[],years:[]}
};
var activeCFTab='op';
function switchCFTab(tab){
  activeCFTab=tab;
  ['op','inv','fin'].forEach(function(t){var btn=document.getElementById('cf-tab-'+t);if(!btn)return;btn.style.color=t===tab?'#0F172A':'#94A3B8';btn.style.borderColor=t===tab?'#0F172A':'#E2E8F0';btn.style.background='#fff';});
  drawComboChart('cfChart',cfData[activeCFTab]);
}
function drawCFChart(){drawComboChart('cfChart',cfData[activeCFTab]);}

// ── RATIO ANALYSIS ──
var raData={
  gps:     {label:'GPS',         values:[],years:[]},
  eps:     {label:'EPS',         values:[],years:[]},
  dps:     {label:'DPS',         values:[],years:[]},
  yield:   {label:'Yield (%)',   values:[],years:[]},
  gross:   {label:'Gross %',     values:[],years:[]},
  roe:     {label:'ROE (%)',     values:[],years:[]},
  shares:  {label:'Issued Share',values:[],years:[]},
  turnover:{label:'Turnover',    values:[],years:[]}
};
// ── RESULTS TAB (real data) ─────────────────────────────────────────────
var RESULTS_IS=[], RESULTS_BS=[], RESULTS_CF=[], RESULTS_RA=[];
var resultsLoaded=false;
function fmtFyLabel(fy){ return fy; }
async function loadResultsData(){
  if(resultsLoaded){ drawISChart();drawBSChart();drawCFChart();drawRAChart(); return; }
  try{
    if(typeof sb==='undefined'||!sb) return;
    var IS = (window.INCOME_STATEMENT&&window.INCOME_STATEMENT.length) ? window.INCOME_STATEMENT : await mpLoadIncomeStatement();
    window.INCOME_STATEMENT=IS;
    var BS = await mpLoadBalanceSheet();
    var CF = await mpLoadCashFlow(IS, BS);
    RESULTS_IS=IS; RESULTS_BS=BS; RESULTS_CF=CF;

    var years=IS.map(function(r){return r.fy;});

    // Income Statement
    isData.revenue.values=IS.map(function(r){return r.revenue||0;}); isData.revenue.years=years;
    isData.gp.values=IS.map(function(r){return r.grossIncome||0;});  isData.gp.years=years;
    isData.ni.values=IS.map(function(r){return r.netIncome||0;});    isData.ni.years=years;

    // Balance Sheet
    bsYears=BS.map(function(r){return r.fy;});
    bsAssets=BS.map(function(r){return r.totalAssets||0;});
    bsLiab=BS.map(function(r){return r.totalLiabilities||0;});

    // Cash Flows
    var cfYears=CF.map(function(r){return r.fy;});
    cfData.op.values=CF.map(function(r){return r.netCashOperating||0;});  cfData.op.years=cfYears;
    cfData.inv.values=CF.map(function(r){return r.netCashInvesting||0;}); cfData.inv.years=cfYears;
    cfData.fin.values=CF.map(function(r){return r.netCashFinancing||0;}); cfData.fin.years=cfYears;

    // Ratio Analysis — combines Income Statement + Balance Sheet + the
    // shared mpLoadRatioAnalysis() (for DPS/Yield/Gross%), matching fields
    // to what desktop already computes rather than re-deriving them.
    var bsByFy={}; BS.forEach(function(r){bsByFy[r.fy]=r;});
    var RA=[];
    try{ RA=await mpLoadRatioAnalysis(IS,BS); }catch(e){ console.warn('[Results] ratio analysis load failed:',e.message); }
    RESULTS_RA=RA;
    var raByFy={}; RA.forEach(function(r){raByFy[r.fy]=r;});

    raData.gps.values=IS.map(function(r){return r.outstandingShares?(r.grossIncome/r.outstandingShares*100):0;}); raData.gps.years=years;
    raData.eps.values=IS.map(function(r){return r.epsCents||0;}); raData.eps.years=years;
    raData.dps.values=years.map(function(fy){return (raByFy[fy]&&raByFy[fy].dps)||0;}); raData.dps.years=years;
    raData.yield.values=years.map(function(fy){return (raByFy[fy]&&raByFy[fy].dividendYield)||0;}); raData.yield.years=years;
    raData.gross.values=years.map(function(fy){return (raByFy[fy]&&raByFy[fy].grossMargin)||0;}); raData.gross.years=years;
    raData.roe.values=IS.map(function(r){var bs=bsByFy[r.fy]; return (bs&&bs.totalEquity)?(r.netIncome/bs.totalEquity*100):0;}); raData.roe.years=years;
    raData.shares.values=IS.map(function(r){return r.outstandingShares||0;}); raData.shares.years=years;
    raData.turnover.values=IS.map(function(r){return r.revenue||0;}); raData.turnover.years=years;

    resultsLoaded=true;
    drawISChart(); drawBSChart(); drawCFChart(); drawRAChart();
  }catch(e){ console.warn('[Results] load failed:', e.message); }
}
var activeRATab='gps';

var raTabs=['gps','eps','dps','yield','gross','roe','shares','turnover'];
function switchRATab(tab){
  activeRATab=tab;
  raTabs.forEach(function(t){var btn=document.getElementById('ra-tab-'+t);if(!btn)return;btn.style.color=t===tab?'#0F172A':'#94A3B8';btn.style.borderColor=t===tab?'#0F172A':'#E2E8F0';btn.style.background='#fff';});
  drawComboChart('raChart',raData[activeRATab]);
}
function drawRAChart(){drawComboChart('raChart',raData[activeRATab]);}
// ── PORTFOLIO CHARTS ──
var holdingsData=[];
function drawHoldingsChart(){
  if(!holdingsData.length) return;
  var canvas=document.getElementById('holdingsChart');
  if(!canvas)return;
  var dpr=window.devicePixelRatio||1;
  var W=canvas.parentElement.clientWidth;
  var n=holdingsData.length;
  var rowH=40, pad={t:8,r:48,b:8,l:8};
  var H=pad.t+n*rowH+pad.b;
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.height=H+'px';
  var ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  var maxV=Math.max.apply(null,holdingsData.map(function(d){return d.v;}))*1.05;
  var barAreaW=W-pad.l-pad.r;
  holdingsData.forEach(function(d,i){
    var y=pad.t+i*rowH;
    // name above bar
    ctx.fillStyle='#374151'; ctx.font='500 12px DM Sans,sans-serif'; ctx.textAlign='left';
    ctx.fillText(d.label,pad.l,y+12);
    // bar
    var bw=barAreaW*(d.v/maxV);
    var by=y+17, bh=8, r=3;
    ctx.fillStyle='#226ad6';
    ctx.beginPath();
    ctx.moveTo(pad.l+r,by); ctx.lineTo(pad.l+bw-r,by);
    ctx.arcTo(pad.l+bw,by,pad.l+bw,by+r,r);
    ctx.lineTo(pad.l+bw,by+bh-r);
    ctx.arcTo(pad.l+bw,by+bh,pad.l+bw-r,by+bh,r);
    ctx.lineTo(pad.l+r,by+bh); ctx.arcTo(pad.l,by+bh,pad.l,by+bh-r,r);
    ctx.lineTo(pad.l,by+r); ctx.arcTo(pad.l,by,pad.l+r,by,r);
    ctx.closePath(); ctx.fill();
    // value after bar
    ctx.fillStyle='#374151'; ctx.font='600 11px DM Sans,sans-serif'; ctx.textAlign='left';
    ctx.fillText(d.v+'%',pad.l+bw+6,by+bh-1);
  });
}
// ── SHAREHOLDER CHART ──
var shareholderData=[];
var SHAREHOLDER_FULL_LIST=[];
var SHAREHOLDER_COLORS=['#1565C0','#42A5F5','#90CAF9','#B0BEC5'];
var shareholderLoaded=false;
async function loadShareholderData(){
  if(shareholderLoaded){ drawShareholderChart(); return; }
  try{
    if(typeof mpLoadShareholders!=='function') return;
    var rows=await mpLoadShareholders();
    var total=rows.reduce(function(s,r){return s+(parseFloat(r.units_held)||0);},0)||1;
    var top3=rows.slice(0,3);
    var restUnits=rows.slice(3).reduce(function(s,r){return s+(parseFloat(r.units_held)||0);},0);
    shareholderData=top3.map(function(r,i){
      return {label:r.full_name||'Unknown', v:(parseFloat(r.units_held)||0)/total*100, c:SHAREHOLDER_COLORS[i]};
    });
    if(restUnits>0) shareholderData.push({label:'The rest of shareholder', v:restUnits/total*100, c:SHAREHOLDER_COLORS[3]});
    SHAREHOLDER_FULL_LIST=rows.map(function(r){
      var pct=(parseFloat(r.units_held)||0)/total*100;
      return {name:r.full_name||'Unknown', units:parseFloat(r.units_held)||0, pct:pct};
    });
    shareholderLoaded=true;
    var top3Pct=shareholderData.slice(0,3).reduce(function(s,d){return s+d.v;},0);
    var todayStr=new Date().toLocaleDateString('en-MY',{day:'2-digit',month:'short',year:'numeric'});
    var mainSum=document.getElementById('shMainSummary');
    if(mainSum) mainSum.textContent='Top 3 holders: '+top3Pct.toFixed(1)+'% \u00a0\u00b7\u00a0 As at '+todayStr;
    var detSum=document.getElementById('shDetailSummary');
    if(detSum) detSum.textContent='As at '+todayStr+' \u00a0\u00b7\u00a0 Top 3 holders: '+top3Pct.toFixed(1)+'%';
    renderShareholderTable();
    drawShareholderChart();
  }catch(e){ console.warn('[Shareholder] load failed:', e.message); }
}
function renderShareholderTable(){
  var body=document.getElementById('shTableBody');
  if(!body) return;
  if(!SHAREHOLDER_FULL_LIST.length){
    body.innerHTML='<tr><td colspan="4" style="padding:16px 4px;text-align:center;color:var(--fg-3);font-size:.72rem;">No shareholders on record</td></tr>';
    return;
  }
  body.innerHTML=SHAREHOLDER_FULL_LIST.map(function(s,i){
    var isLast=i===SHAREHOLDER_FULL_LIST.length-1;
    return '<tr style="'+(isLast?'':'border-bottom:1px solid var(--border);')+'">'
      +'<td style="padding:9px 4px;color:var(--fg-3);font-size:.72rem;">'+(i+1)+'</td>'
      +'<td style="padding:9px 4px;color:var(--fg-1);">'+s.name+'</td>'
      +'<td style="padding:9px 4px;text-align:right;color:var(--fg-1);">'+s.units.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
      +'<td style="padding:9px 4px;text-align:right;font-weight:600;color:var(--fg-1);">'+s.pct.toFixed(1)+'%</td>'
      +'</tr>';
  }).join('');
}
function drawShareholderChart(canvasId){
  var canvas=document.getElementById(canvasId||'shareholderChart');
  if(!canvas)return;
  if(!shareholderData.length)return;
  var isDetail=canvasId==='shareholderDetailChart';
  var dpr=window.devicePixelRatio||1;
  var scrollEl=document.getElementById('mainScroll');
  var W=scrollEl?scrollEl.clientWidth-32:300;
  var legGap=22;
  var H=isDetail ? r*2+32+14+12+shareholderData.length*24+16 : 200;
  var r=isDetail?70:74, inner=Math.round(r*0.72);
  var cx=isDetail?W/2:r+16, cy=isDetail?r+16:H/2;
  canvas.width=Math.round(W*dpr);
  canvas.height=Math.round(H*dpr);
  canvas.style.width=W+'px';
  canvas.style.height=H+'px';
  var ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  var total=shareholderData.reduce(function(s,d){return s+d.v;},0);
  var start=-Math.PI/2;
  shareholderData.forEach(function(d){
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
  if(isDetail){
    // data label for top 1 shareholder (largest slice)
    var top=shareholderData.reduce(function(a,b){return a.v>b.v?a:b;});
    var topAngle=-Math.PI/2+top.v/total*Math.PI; // midpoint angle approx
    var cumAngle=-Math.PI/2;
    var topMid;
    shareholderData.forEach(function(d){
      var sweep=d.v/total*Math.PI*2;
      if(d===top) topMid=cumAngle+sweep/2;
      cumAngle+=sweep;
    });
    var labelR=(r+inner)/2;
    var lbx=cx+Math.cos(topMid)*labelR, lby=cy+Math.sin(topMid)*labelR;
    ctx.fillStyle='#fff'; ctx.font='bold 11px DM Sans,sans-serif'; ctx.textAlign='center';
    ctx.fillText(top.v.toFixed(1)+'%',lbx,lby+4);
    // table-format legend below chart
    var legStartY=cy+r+28;
    var rowH=24, pad=16;
    var col1=pad, col2=pad+130, col3=W-pad;
    // header
    ctx.fillStyle='#94A3B8'; ctx.font='500 9px DM Sans,sans-serif'; ctx.textAlign='left';
    ctx.fillText('NAME',col1+14,legStartY);
    ctx.textAlign='right';
    ctx.fillText('STAKE %',col3,legStartY);
    legStartY+=14;
    // divider
    ctx.beginPath(); ctx.moveTo(pad,legStartY); ctx.lineTo(W-pad,legStartY);
    ctx.strokeStyle='#E2E8F0'; ctx.lineWidth=1; ctx.stroke();
    legStartY+=12;
    shareholderData.forEach(function(d,i){
      var ly=legStartY+i*rowH;
      // dot
      ctx.beginPath(); ctx.arc(col1+5,ly,4,0,Math.PI*2);
      ctx.fillStyle=d.c; ctx.fill();
      // name
      ctx.fillStyle='#374151'; ctx.font='600 10px DM Sans,sans-serif'; ctx.textAlign='left';
      ctx.fillText(d.label,col1+14,ly+4);
      // stake
      ctx.fillStyle='#374151'; ctx.font='500 10px DM Sans,sans-serif'; ctx.textAlign='right';
      ctx.fillText(d.v.toFixed(1)+'%',col3,ly+4);
      // row divider
      if(i<shareholderData.length-1){
        ctx.beginPath(); ctx.moveTo(pad,ly+rowH/2+4); ctx.lineTo(W-pad,ly+rowH/2+4);
        ctx.strokeStyle='#F1F5F9'; ctx.lineWidth=1; ctx.stroke();
      }
    });
  } else {
    var legX=cx+r+20;
    var legStartY=(H-shareholderData.length*legGap)/2+14;
    shareholderData.forEach(function(d,i){
      var lx=legX, ly=legStartY+i*legGap;
      ctx.beginPath(); ctx.arc(lx+5,ly,5,0,Math.PI*2);
      ctx.fillStyle=d.c; ctx.fill();
      ctx.fillStyle='#374151'; ctx.font='600 10px DM Sans,sans-serif'; ctx.textAlign='left';
      var nameW=ctx.measureText(d.label).width;
      ctx.fillText(d.label,lx+14,ly+4);
      ctx.fillStyle='#94A3B8'; ctx.font='500 10px DM Sans,sans-serif';
      ctx.fillText('  '+d.v.toFixed(1)+'%',lx+14+nameW,ly+4);
    });
  }
}
// ── SECTOR & PRODUCT ALLOCATION ──
