/* ===== assets/js/portal/pages-performance.js — NTA History + Comparison performance-chart pages ===== */
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
    return '<rect x="'+ox.toFixed(1)+'" y="0" width="'+colW.toFixed(1)+'" height="'+H+'" fill="transparent" onmouseenter="nthHoverAt('+i+')" onmousemove="nthHoverAt('+i+')" onmouseleave="nthHoverReset()" style="cursor:crosshair;touch-action:pan-y"/>';
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
    return '<rect x="'+ox.toFixed(1)+'" y="0" width="'+colW.toFixed(1)+'" height="'+H+'" fill="transparent" onmouseenter="nthHoverAt('+i+')" onmousemove="nthHoverAt('+i+')" onmouseleave="nthHoverReset()" style="cursor:crosshair;touch-action:pan-y"/>';
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
    return '<rect x="'+ox.toFixed(1)+'" y="0" width="'+colW.toFixed(1)+'" height="'+H+'" fill="transparent" onmouseenter="cmpHoverAt('+i+')" onmousemove="cmpHoverAt('+i+')" onmouseleave="cmpHoverReset()" style="cursor:crosshair;touch-action:pan-y"/>';
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
