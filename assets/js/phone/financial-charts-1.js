/* ===== assets/js/phone/financial-charts-1.js — Fund overview + income-statement/balance-sheet charts ===== */
function updateFundSummaryHeader(){
  if(!FUND_NTA_DAILY.length) return;
  var last=FUND_NTA_DAILY[FUND_NTA_DAILY.length-1];
  var prev=FUND_NTA_DAILY.length>1?FUND_NTA_DAILY[FUND_NTA_DAILY.length-2]:last;
  var chg=last.nta-prev.nta, chgPct=prev.nta?(chg/prev.nta*100):0;
  var up=chg>=0;
  var priceEl=document.getElementById('fsPrice');
  if(priceEl){ priceEl.textContent=last.nta.toFixed(4); priceEl.style.color=up?'var(--green)':'var(--red)'; }
  var arrow=document.getElementById('fsArrow');
  if(arrow){ arrow.innerHTML=up?'<polygon points="6,0 12,10 0,10" fill="var(--green)"/>':'<polygon points="0,0 12,0 6,10" fill="var(--red)"/>'; }
  var chEl=document.getElementById('fsChange');
  if(chEl){ chEl.textContent=(up?'+':'')+chg.toFixed(4)+' \u00a0'+(up?'+':'')+chgPct.toFixed(2)+'%'; chEl.style.color=up?'var(--green)':'var(--red)'; }
  var tfcSub=document.getElementById('tfcSub');
  if(tfcSub){ tfcSub.textContent=last.nta.toFixed(4)+' \u00a0'+(up?'+':'')+chg.toFixed(4)+' ('+(up?'+':'')+chgPct.toFixed(2)+'%)'; tfcSub.style.color=up?'var(--green)':'var(--red)'; }
  var updEl=document.getElementById('fsUpdated');
  if(updEl){ updEl.textContent='Updated '+new Date(last.date+'T00:00:00').toLocaleDateString('en-MY',{day:'2-digit',month:'short',year:'numeric'}); }

  var wSrc=FUND_NTA_WEEKLY.length?FUND_NTA_WEEKLY:FUND_NTA_MONTHLY;
  if(wSrc.length){
    var lastCandle=wSrc[wSrc.length-1];
    var o=document.getElementById('fsOpen'), h=document.getElementById('fsHigh'), l=document.getElementById('fsLow');
    if(o) o.textContent=lastCandle.open.toFixed(4);
    if(h) h.textContent=lastCandle.high.toFixed(4);
    if(l) l.textContent=lastCandle.low.toFixed(4);
  }

  var cutoff52=new Date(last.date+'T00:00:00'); cutoff52.setDate(cutoff52.getDate()-365);
  var cutoff52Str=cutoff52.toISOString().slice(0,10);
  var last52=FUND_NTA_DAILY.filter(function(r){return r.date>=cutoff52Str;});
  if(last52.length){
    var hi52=Math.max.apply(null,last52.map(function(r){return r.nta;}));
    var lo52=Math.min.apply(null,last52.map(function(r){return r.nta;}));
    var h52El=document.getElementById('fs52High'), l52El=document.getElementById('fs52Low');
    if(h52El) h52El.textContent=hi52.toFixed(4);
    if(l52El) l52El.textContent=lo52.toFixed(4);
  }

  // Total Shares — reuses the outstanding-units figure already computed
  // fund-wide for the Financial Results page (desktop), via the same
  // shared mpLoadIncomeStatement().
  if(typeof INCOME_STATEMENT==='undefined' || !INCOME_STATEMENT.length){
    mpLoadIncomeStatement().then(function(rows){
      window.INCOME_STATEMENT=rows||[];
      applySharesAndDividend();
      updateFundMarketValue();
    }).catch(function(){});
  } else {
    applySharesAndDividend();
    updateFundMarketValue();
  }
}
// Market Value = Total Shares (fund-wide outstanding units) × current price
// (latest NTA) — this is the FUND's own market cap, not the logged-in
// member's personal holdings. (Avg Cost below this field is still sourced
// from the member's own PA/JA — flagging that as likely needing the same
// fix, but holding off until confirmed since there's no single well-defined
// "fund-wide average cost" the way there is for Market Value.)
function updateFundMarketValue(){
  var mvEl=document.getElementById('fsMarketValue');
  var acEl=document.getElementById('fsAvgCost');
  if(acEl) acEl.textContent='—'; // pending: no fund-wide definition confirmed yet (see note above)
  var IS=window.INCOME_STATEMENT||(typeof INCOME_STATEMENT!=='undefined'?INCOME_STATEMENT:[]);
  var lastNta=FUND_NTA_DAILY.length?FUND_NTA_DAILY[FUND_NTA_DAILY.length-1].nta:0;
  var outstandingShares=(IS.length?IS[IS.length-1].outstandingShares:0)||0;
  var marketCap=outstandingShares*lastNta;
  if(mvEl){ mvEl.setAttribute('data-real', fmtCompactM(marketCap)); mvEl.textContent=(typeof ACCOUNT_RESTRICTED!=='undefined'&&ACCOUNT_RESTRICTED)?'••••••':fmtCompactM(marketCap); }
  // foFundSize/poMarketCap intentionally left unmasked: foFundSize lives on
  // the Fund page's own "Profile" tab, which is excluded from restriction,
  // and poMarketCap lives inside the Portfolio tab, which gets the full
  // blur+lock overlay via applyFundRestriction() instead.
  var fundSizeEl=document.getElementById('foFundSize');
  if(fundSizeEl) fundSizeEl.textContent='RM '+fmtCompactM(marketCap);
  var poEl=document.getElementById('poMarketCap');
  if(poEl) poEl.textContent='RM '+fmtCompactM(marketCap);
  return marketCap;
}
function fmtCompactM(v){
  if(Math.abs(v)>=1000000) return (v/1000000).toFixed(1)+' M';
  return (v||0).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function applySharesAndDividend(){
  var IS=window.INCOME_STATEMENT||(typeof INCOME_STATEMENT!=='undefined'?INCOME_STATEMENT:[]);
  var sharesEl=document.getElementById('fsShares');
  var issuedEl=document.getElementById('foIssuedUnits');
  if(IS.length){
    var lastIS=IS[IS.length-1];
    var sharesTxt=fmtCompactM(lastIS.outstandingShares||0).replace(/\.00 M/,' M');
    if(sharesEl){ sharesEl.setAttribute('data-real', sharesTxt); sharesEl.textContent=(typeof ACCOUNT_RESTRICTED!=='undefined'&&ACCOUNT_RESTRICTED)?'••••••':sharesTxt; }
    // foIssuedUnits lives on the excluded "Profile" tab — left unmasked, see note in updateFundMarketValue().
    if(issuedEl) issuedEl.textContent=sharesTxt+' units';
  }
  if(typeof mpLoadDistributionsByFy==='function'){
    mpLoadDistributionsByFy().then(function(distByFy){
      var divEl=document.getElementById('fsDividend'), yldEl=document.getElementById('fsYield');
      if(distByFy && distByFy.length){
        var lastFy=distByFy[distByFy.length-1];
        if(divEl) divEl.textContent=(lastFy.totalDps||0).toFixed(2)+' sen';
        var lastNta=FUND_NTA_DAILY.length?FUND_NTA_DAILY[FUND_NTA_DAILY.length-1].nta:0;
        var yieldPct=lastNta?((lastFy.totalDps||0)/100/lastNta*100):0;
        if(yldEl) yldEl.textContent=yieldPct.toFixed(2)+'%';
      }
    }).catch(function(){});
  }
}

// Re-applies the Market Value/Total Shares header mask and the Results/
// Portfolio/Shareholder tab-lock overlays for the current ACCOUNT_RESTRICTED
// state. Called whenever profile data (re)loads (assets/js/phone/
// profile-account.js's applyProfileToUI()) and whenever the Fund page's
// header re-renders, so it's correct regardless of whether profile data or
// fund data finishes loading first.
var FUND_LOCK_TABS=['results','portfolio','shareholder'];
function applyFundRestriction(){
  var restricted=(typeof ACCOUNT_RESTRICTED!=='undefined'&&ACCOUNT_RESTRICTED);
  ['fsMarketValue','fsShares'].forEach(function(id){
    var el=document.getElementById(id);
    if(!el) return;
    var real=el.getAttribute('data-real');
    if(real!=null) el.textContent=restricted?'••••••':real;
  });
  FUND_LOCK_TABS.forEach(function(tab){
    var lockEl=document.getElementById('ftab-'+tab+'-lock');
    if(lockEl) lockEl.classList.toggle('show', restricted);
  });
}

var activeCPeriod='ytd';
var candleState={};
function drawCandleChart(period,btn,hoverIdx){
  activeCPeriod=period;
  if(btn){
    document.querySelectorAll('.cperiod').forEach(function(b){b.style.color='var(--fg-3)';b.style.fontWeight='600';});
    btn.style.color='var(--blue)';
  }
  var canvas=document.getElementById('candleChart');
  if(!canvas)return;
  var src=getFundCandleSource();
  if(!src||src.length<2) return;
  var latestDate=src[src.length-1].date;
  var cutoff=fundCutoffDate(period,latestDate);
  var data=src.filter(function(r){return r.date>=cutoff;});
  if(data.length<2) data=src;
  var dpr=window.devicePixelRatio||1;
  var W=canvas.parentElement.clientWidth;
  var H=Math.round(W*0.58);
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  var ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  var pad={t:8,r:4,b:20,l:4};
  var cw=W-pad.l-pad.r;
  var ch=H-pad.t-pad.b;
  var hiV=Math.max.apply(null,data.map(function(d){return d.high;}));
  var loV=Math.min.apply(null,data.map(function(d){return d.low;}));
  var range=(hiV-loV)||0.001;
  var yScale=function(v){return pad.t+ch-(v-loV)/range*ch;};
  var gap=2;
  var slotW=(cw-(data.length-1)*gap)/data.length;
  var cw2=Math.max(1,slotW*0.5);
  candleState={data:data,pad:pad,slotW:slotW,gap:gap,cw2:cw2,W:W,H:H,ch:ch,yScale:yScale,period:period};
  ctx.strokeStyle='rgba(226,232,240,.7)';ctx.lineWidth=1;
  for(var g=0;g<=4;g++){
    var yy=pad.t+ch/4*g;
    ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(W-pad.r,yy);ctx.stroke();
  }
  data.forEach(function(d,i){
    var cx=pad.l+i*(slotW+gap)+slotW/2;
    var isUp=d.close>=d.open;
    var color=(hoverIdx===i)?(isUp?'#1B5E20':'#B71C1C'):(isUp?'#2E7D32':'#DC2626');
    var bodyTop=yScale(Math.max(d.open,d.close));
    var bodyBot=yScale(Math.min(d.open,d.close));
    var bodyH=Math.max(1,bodyBot-bodyTop);
    ctx.strokeStyle=color;ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(cx,yScale(d.high));ctx.lineTo(cx,yScale(d.low));ctx.stroke();
    ctx.fillStyle=color;
    ctx.fillRect(cx-cw2/2,bodyTop,Math.max(1,cw2),bodyH);
  });
  ctx.font='bold 9px DM Sans,sans-serif';ctx.textAlign='left';
  for(var g=0;g<=4;g++){
    var yy=pad.t+ch/4*g;
    var val=(hiV-(range/4*g)).toFixed(4);
    ctx.fillStyle='rgba(255,255,255,.75)';ctx.fillRect(pad.l,yy-9,38,12);
    ctx.fillStyle='#64748B';ctx.fillText(val,pad.l+2,yy+1);
  }
  var step=Math.ceil(data.length/5);
  ctx.textAlign='center';ctx.fillStyle='#94A3B8';ctx.font='9px DM Sans,sans-serif';
  data.forEach(function(d,i){
    if(i%step===0||i===data.length-1){
      var cx2=pad.l+i*(slotW+gap)+slotW/2;
      var dt=new Date(d.date+'T00:00:00');
      var label=dt.toLocaleDateString('en-MY',{month:'short',year:'2-digit'});
      ctx.fillText(label,cx2,H-5);
    }
  });
  if(hoverIdx!=null && hoverIdx>=0 && hoverIdx<data.length){
    var d=data[hoverIdx];
    var cx=pad.l+hoverIdx*(slotW+gap)+slotW/2;
    ctx.save();ctx.setLineDash([3,3]);ctx.strokeStyle='rgba(100,116,139,.6)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(cx,pad.t);ctx.lineTo(cx,pad.t+ch);ctx.stroke();ctx.restore();
  }
}
// ── CORRELATION MATRIX + SHARPE/RETURN SCATTER (real data) ──────────────
var corrLabels=['ZY-Invest','FBM KLCI','STI','MSCI'];
var corrMatrixData=null; // NxN, computed
var rvPoints=[]; // computed from real weekly series
function corrColor(v){
  if(v>=0){
    var t=v;
    var r=Math.round(255-(255-187)*t), g=Math.round(255-(255-235)*t), b=Math.round(255-(255-187)*t);
    return'rgb('+r+','+g+','+b+')';
  } else {
    var t=-v;
    var g=Math.round(255-(255-187)*t), b=Math.round(255-(255-187)*t);
    return'rgb(255,'+g+','+b+')';
  }
}
function corrTextColor(v){return Math.abs(v)>0.7?'#1a1a1a':'#374151';}
function pearsonCorrPhone(a,b){
  var xs=[],ys=[];
  for(var i=0;i<a.length;i++){ if(a[i]!=null&&b[i]!=null){ xs.push(a[i]); ys.push(b[i]); } }
  var n=xs.length; if(n<2) return null;
  var mx=xs.reduce(function(s,v){return s+v;},0)/n, my=ys.reduce(function(s,v){return s+v;},0)/n;
  var cov=0,vx=0,vy=0;
  for(var j=0;j<n;j++){ var dx=xs[j]-mx, dy=ys[j]-my; cov+=dx*dy; vx+=dx*dx; vy+=dy*dy; }
  var den=Math.sqrt(vx*vy);
  return den?cov/den:null;
}
async function loadFundCorrelationAndSharpe(){
  try{
    if(typeof sb==='undefined'||!sb) return;
    var results=await Promise.allSettled([
      mpLoadNtaWeekly(),
      mpLoadYahooWeekly('^KLSE'),
      mpLoadYahooWeekly('^STI'),
      mpLoadYahooWeekly('MSCI')
    ]);
    var zy=(results[0].status==='fulfilled')?(results[0].value||[]):[];
    var klci=(results[1].status==='fulfilled')?(results[1].value||[]):[];
    var sti=(results[2].status==='fulfilled')?(results[2].value||[]):[];
    var msci=(results[3].status==='fulfilled')?(results[3].value||[]):[];
    var allSeries=[{name:'ZY-Invest',color:'#1565C0',pts:zy},{name:'FBM KLCI',color:'#90A4AE',pts:klci},{name:'STI',color:'#78909C',pts:sti},{name:'MSCI',color:'#546E7A',pts:msci}];
    var series=allSeries.filter(function(s){return s.pts&&s.pts.length;});
    // The benchmark indices load from Yahoo Finance through a public CORS
    // proxy (mpLoadYahooWeekly in member-api.js), which can fail
    // independently of the fund's own NTA data — surface that instead of
    // silently just not showing the missing benchmark(s).
    var missingNames=allSeries.filter(function(s){return !s.pts||!s.pts.length;}).map(function(s){return s.name;});
    var noticeEl=document.getElementById('corrDataNotice');
    if(noticeEl){
      if(missingNames.length){
        noticeEl.textContent=missingNames.join(', ')+' data is temporarily unavailable.';
        noticeEl.style.display='block';
      } else {
        noticeEl.style.display='none';
      }
    }
    if(!series.length) return;

    // Align onto a shared weekly date axis (forward-fill), same approach
    // used on desktop's Comparison page.
    var allDates=[]; series.forEach(function(s){ s.pts.forEach(function(p){allDates.push(p.date);}); });
    allDates=Array.from(new Set(allDates)).sort();
    var aligned=series.map(function(s){
      var idx=0,last=null,vals=[];
      allDates.forEach(function(d){
        while(idx<s.pts.length && s.pts[idx].date<=d){ last=s.pts[idx]; idx++; }
        vals.push(last?last.close:null);
      });
      return {name:s.name,color:s.color,raw:vals};
    });

    // Weekly returns for correlation + annualised return/vol/sharpe
    var rets=aligned.map(function(s){
      var r=[];
      for(var i=1;i<s.raw.length;i++){
        var a=s.raw[i-1],b=s.raw[i];
        r.push((a!=null&&b!=null&&a)?(b/a-1):null);
      }
      return {name:s.name,color:s.color,ret:r,raw:s.raw};
    });

    corrMatrixData=rets.map(function(rowS){
      return rets.map(function(colS){
        return rowS.name===colS.name?1:pearsonCorrPhone(rowS.ret,colS.ret);
      });
    });
    corrLabels=rets.map(function(s){return s.name;});

    rvPoints=rets.map(function(s,i){
      var validIdx=[]; s.raw.forEach(function(v,idx){ if(v!=null) validIdx.push(idx); });
      var annReturn=0, annVol=0;
      if(validIdx.length>1){
        var first=s.raw[validIdx[0]], last=s.raw[validIdx[validIdx.length-1]];
        var weeks=validIdx[validIdx.length-1]-validIdx[0];
        var totalReturn=first?(last/first-1):0;
        annReturn=weeks>0?(Math.pow(1+totalReturn,52/weeks)-1)*100:0;
        var validRets=s.ret.filter(function(v){return v!=null;});
        if(validRets.length>1){
          var mean=validRets.reduce(function(a,b){return a+b;},0)/validRets.length;
          var variance=validRets.reduce(function(a,b){return a+(b-mean)*(b-mean);},0)/(validRets.length-1);
          annVol=Math.sqrt(variance)*Math.sqrt(52)*100;
        }
      }
      var sharpe=annVol?(annReturn/annVol):0;
      return {label:s.name,ret:+annReturn.toFixed(1),vol:+annVol.toFixed(1),sharpe:+sharpe.toFixed(2),color:s.color,r:i===0?7:6};
    });

    FUND_CORR_LOADED=true;
    renderCorrMatrix();
    drawRVChart();
  }catch(e){ console.warn('[Fund Chart] correlation/sharpe load failed:', e.message); }
}
function renderCorrMatrix(){
  var wrap=document.getElementById('corrMatrixWrap');
  if(!wrap)return;
  if(!corrMatrixData){ wrap.innerHTML='<div style="padding:12px 0;color:var(--fg-3);font-size:.76rem;text-align:center">Loading…</div>'; return; }
  var shortLabels=corrLabels.map(function(l){return l==='ZY-Invest'?'ZY':l==='FBM KLCI'?'KLCI':l;});
  var html='<div style="display:flex;justify-content:center;"><div style="display:grid;grid-template-columns:36px repeat('+shortLabels.length+',48px);gap:2px;box-sizing:border-box;overflow:hidden;">';
  html+='<div></div>';
  shortLabels.forEach(function(l){
    html+='<div style="font-size:.55rem;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:var(--fg-3);text-align:center;padding-bottom:4px;">'+l+'</div>';
  });
  corrMatrixData.forEach(function(row,ri){
    html+='<div style="font-size:.6rem;font-weight:600;color:var(--fg-2);display:flex;align-items:center;justify-content:flex-end;padding-right:4px;">'+shortLabels[ri]+'</div>';
    row.forEach(function(v){
      var vv=v==null?0:v;
      var bg=corrColor(vv);var tc=corrTextColor(vv);
      html+='<div style="width:48px;height:48px;background:'+bg+';display:flex;align-items:center;justify-content:center;">'
        +'<span style="font-size:.6rem;font-weight:600;color:'+tc+';">'+(v==null?'—':vv.toFixed(2))+'</span>'
        +'</div>';
    });
  });
  html+='</div></div>';
  wrap.innerHTML=html;
}
function attachCandleListeners(){
  var canvas=document.getElementById('candleChart');
  if(!canvas||canvas._cl)return;canvas._cl=true;
  canvas.addEventListener('mousemove',candleHover);
  canvas.addEventListener('touchmove',function(e){e.preventDefault();candleHover(e);},{passive:false});
  canvas.addEventListener('mouseleave',candleLeave);
  canvas.addEventListener('touchend',candleLeave);
}
function candleHover(e){
  var canvas=document.getElementById('candleChart');
  if(!canvas||!candleState.data)return;
  var rect=canvas.getBoundingClientRect();
  var clientX=e.touches?e.touches[0].clientX:e.clientX;
  var xRel=clientX-rect.left;
  var s=candleState;
  var idx=Math.round((xRel-s.pad.l-s.slotW/2)/(s.slotW+s.gap));
  idx=Math.max(0,Math.min(s.data.length-1,idx));
  drawCandleChart(activeCPeriod,null,idx);
  var d=s.data[idx];
  var prevD=idx>0?s.data[idx-1]:d;
  var chg=+(d.close-prevD.close).toFixed(4);var chgPct=+(prevD.close?(chg/prevD.close*100):0).toFixed(2);
  var isUp=chg>=0;var clr=isUp?'var(--green)':'var(--red)';
  var dt=new Date(d.date+'T00:00:00');
  document.getElementById('ci-date').textContent=dt.toLocaleDateString('en-MY',{day:'numeric',month:'short',year:'numeric'});
  document.getElementById('ci-ov').textContent=d.open.toFixed(4);
  document.getElementById('ci-hv').textContent=d.high.toFixed(4);
  document.getElementById('ci-cv').textContent=(chg>=0?'+':'')+chg;document.getElementById('ci-cv').style.color=clr;
  document.getElementById('ci-clv').textContent=d.close.toFixed(4);
  document.getElementById('ci-lv').textContent=d.low.toFixed(4);
  document.getElementById('ci-pv').textContent=(chgPct>=0?'+':'')+chgPct+'%';document.getElementById('ci-pv').style.color=clr;
  document.getElementById('candleInfoBox').style.display='block';
}
function candleLeave(){drawCandleChart(activeCPeriod,null,null);document.getElementById('candleInfoBox').style.display='none';}
// ── RETURN VS VOLATILITY SCATTER — points are labeled directly with their
// Sharpe ratio (no hover tooltip; option (b) as specified) ──────────────
var rvState={};
function drawRVChart(){
  var canvas=document.getElementById('rvChart');
  if(!canvas)return;
  if(!rvPoints.length){ return; }
  var dpr=window.devicePixelRatio||1;
  var W=canvas.parentElement.clientWidth;
  var H=300;
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.height=H+'px';
  var ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  var pad={t:26,r:16,b:90,l:36};
  var cw=W-pad.l-pad.r, ch=H-pad.t-pad.b;
  var chartBottom=pad.t+ch;
  var tickY=chartBottom+12;
  var xTitleY=chartBottom+24;
  var legY=chartBottom+50;
  var allRet=rvPoints.map(function(p){return p.ret;}), allVol=rvPoints.map(function(p){return p.vol;});
  var minVol=Math.min(0,Math.min.apply(null,allVol))-1, maxVol=Math.max.apply(null,allVol)+2;
  var minRet=Math.min(0,Math.min.apply(null,allRet))-1, maxRet=Math.max.apply(null,allRet)+2;
  function xp(v){return pad.l+((v-minVol)/((maxVol-minVol)||1))*cw;}
  function yp(r){return pad.t+ch-((r-minRet)/((maxRet-minRet)||1))*ch;}
  rvState={xp:xp,yp:yp,pad:pad,W:W,H:H,chartBottom:chartBottom};
  var volTicks=fundNiceTicks(minVol,maxVol,4), retTicks=fundNiceTicks(minRet,maxRet,4);
  ctx.strokeStyle='rgba(150,160,170,.5)'; ctx.lineWidth=1; ctx.setLineDash([3,4]);
  volTicks.forEach(function(v){ctx.beginPath();ctx.moveTo(xp(v),pad.t);ctx.lineTo(xp(v),chartBottom);ctx.stroke();});
  retTicks.forEach(function(r){ctx.beginPath();ctx.moveTo(pad.l,yp(r));ctx.lineTo(pad.l+cw,yp(r));ctx.stroke();});
  ctx.setLineDash([]);
  ctx.strokeStyle='#94A3B8'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(pad.l,chartBottom); ctx.lineTo(pad.l+cw,chartBottom); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(pad.l,pad.t); ctx.lineTo(pad.l,chartBottom); ctx.stroke();
  ctx.fillStyle='#374151'; ctx.font='600 8px DM Sans,sans-serif'; ctx.textAlign='center';
  volTicks.forEach(function(v){ctx.fillText(v.toFixed(0)+'%',xp(v),tickY);});
  ctx.textAlign='right';
  retTicks.forEach(function(r){ctx.fillText(r.toFixed(0)+'%',pad.l-4,yp(r)+3);});
  ctx.fillStyle='#374151'; ctx.font='700 10px DM Sans,sans-serif';
  ctx.textAlign='center'; ctx.fillText('Volatility',W/2,xTitleY);
  ctx.textAlign='left'; ctx.fillText('Return',pad.l-10,pad.t-7);
  // points + Sharpe ratio data labels (no hover — labels replace tooltip)
  rvPoints.forEach(function(p){
    var x=xp(p.vol),y=yp(p.ret);
    ctx.beginPath(); ctx.arc(x,y,p.r,0,Math.PI*2);
    ctx.fillStyle=p.color; ctx.fill();
    ctx.font='700 9px DM Sans,sans-serif'; ctx.fillStyle='#0F172A'; ctx.textAlign='center';
    ctx.fillText(p.sharpe.toFixed(2), x, y-p.r-4);
  });
  // legend
  ctx.font='600 11px DM Sans,sans-serif';
  var legSpacing=16;
  var legItems=rvPoints.map(function(p){return{p:p,w:10+ctx.measureText(p.label).width+legSpacing};});
  var totalLegW=legItems.reduce(function(s,it){return s+it.w;},0)-legSpacing;
  var lx=(W-totalLegW)/2;
  legItems.forEach(function(it){
    ctx.beginPath(); ctx.arc(lx+5,legY,4,0,Math.PI*2);
    ctx.fillStyle=it.p.color; ctx.fill();
    ctx.fillStyle='#374151'; ctx.font=(it.p.r===7?'700':'600')+' 11px DM Sans,sans-serif';
    ctx.textAlign='left'; ctx.fillText(it.p.label,lx+13,legY+4);
    lx+=it.w;
  });
}
function fundNiceTicks(mn,mx,count){
  var range=mx-mn||1;
  var rough=range/count;
  var mag=Math.pow(10,Math.floor(Math.log(rough)/Math.LN10));
  var norm=rough/mag;
  var step=(norm<1.5?1:norm<3?2:norm<7?5:10)*mag;
  var start=Math.ceil(mn/step)*step;
  var ticks=[];
  for(var v=start; v<=mx+step*0.001; v+=step) ticks.push(v);
  return ticks;
}
// ── INCOME STATEMENT CHART ──
var isData={revenue:{label:'Revenue',color:'#1565C0',values:[],years:[]},gp:{label:'Gross Profit',color:'#2E7D32',values:[],years:[]},ni:{label:'Net Income',color:'#B45309',values:[],years:[]}};
var activeISTab='revenue';
function switchISTab(tab){
  activeISTab=tab;
  ['revenue','gp','ni'].forEach(function(t){
    var btn=document.getElementById('is-tab-'+t);
    if(!btn)return;
    btn.style.color=t===tab?'#0F172A':'#94A3B8';
    btn.style.borderColor=t===tab?'#0F172A':'#E2E8F0';
    btn.style.background='#fff';
  });
  drawISChart();
}
function drawISChart(){drawComboChart('isChart',isData[activeISTab]);}

// ── GENERIC COMBO CHART RENDERER ──
