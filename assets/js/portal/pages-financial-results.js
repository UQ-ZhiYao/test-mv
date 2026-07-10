/* ===== assets/js/portal/pages-financial-results.js — Financial Results page (large, self-contained) ===== */
function pgFinancialResults(){
  var activeFRTab=window._frTab||'income';
  var FY=['FY21','FY22','FY23','FY24','FY25'];
  var INCOME={
    revenue:      [0,520000,850000,1580000,2100000],
    expenses:     [0,410000,612000,918000,1258000],
    netIncome:    [0,110000,238000,662000,842000],
    distPaid:     [0,0,16800,98200,752200],
    eps:          [0,0.012,0.022,0.058,0.074],
  };
  var BALANCE={
    totalAssets:  [0,16800000,22500000,25100000,24800000],
    equity:       [0,16700000,22400000,24900000,24600000],
    liabilities:  [0,100000,100000,200000,200000],
    cashMM:       [0,1400000,2100000,1800000,2100000],
    fixedIncome:  [0,1200000,1700000,1600000,1700000],
    equityInv:    [0,14200000,18700000,21500000,21000000],
  };
  var CASHFLOW={
    fromOps:      [0,820000,1240000,1980000,2640000],
    fromInv:      [0,-3400000,-5200000,-2400000,-1800000],
    fromFin:      [0,14200000,5800000,2800000,1200000],
    netChange:    [0,11620000,1840000,2380000,2040000],
    openingCash:  [0,0,11620000,13460000,15840000],
    closingCash:  [0,11620000,13460000,15840000,17880000],
  };
  var RATIOS={
    roe:          [0,0.66,1.06,2.66,3.43],
    roa:          [0,0.65,1.06,2.64,3.40],
    netMargin:    [0,21.2,28.0,41.9,40.1],
    expenseRatio: [0,78.8,72.0,58.1,59.9],
    debtEquity:   [0,0.006,0.004,0.008,0.008],
    currentRatio: [0,167.0,224.0,125.5,123.0],
  };

  // Active FY (skip leading zeros)
  // Cap at 8 FY
  FY=FY.slice(-10);
  Object.keys(INCOME).forEach(function(k){INCOME[k]=INCOME[k].slice(-10);});
  Object.keys(BALANCE).forEach(function(k){BALANCE[k]=BALANCE[k].slice(-10);});
  Object.keys(CASHFLOW).forEach(function(k){CASHFLOW[k]=CASHFLOW[k].slice(-10);});
  Object.keys(RATIOS).forEach(function(k){RATIOS[k]=RATIOS[k].slice(-10);});
  var activeFY=FY.filter(function(_,i){
    // Keep FY if at least one series has non-zero value at that index
    var key=activeFRTab==='income'?Object.values(INCOME):activeFRTab==='balance'?Object.values(BALANCE):activeFRTab==='cashflow'?Object.values(CASHFLOW):Object.values(RATIOS);
    return key.some(function(arr){return arr[i]!==0;});
  });

  // Bar chart with hover, right-axis, right-aligned plot area
  function fmtFull(v){
    var n=v||0;
    return Math.abs(n).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  // "Nice numbers for graph labels" (Heckbert) — picks round tick values
  // (2000, 10000, ...) instead of raw data-derived fractions (1998.32, ...).
  function niceNum(range, round){
    if(range<=0) return 1;
    var exponent=Math.floor(Math.log10(range));
    var fraction=range/Math.pow(10,exponent);
    var niceFraction;
    if(round){
      if(fraction<1.5) niceFraction=1;
      else if(fraction<3) niceFraction=2;
      else if(fraction<7) niceFraction=5;
      else niceFraction=10;
    } else {
      if(fraction<=1) niceFraction=1;
      else if(fraction<=2) niceFraction=2;
      else if(fraction<=5) niceFraction=5;
      else niceFraction=10;
    }
    return niceFraction*Math.pow(10,exponent);
  }
  function niceAxisScale(min,max,tickCount){
    tickCount=tickCount||5;
    if(min===max){ min-=1; max+=1; }
    var range=niceNum(max-min,false);
    var step=niceNum(range/(tickCount-1),true);
    var niceMin=Math.floor(min/step)*step;
    var niceMax=Math.ceil(max/step)*step;
    return {min:niceMin,max:niceMax,step:step};
  }
  // k at 6 digits (100,000+), mil at 9 digits (100,000,000+) — always
  // whole numbers ("#,##0"), never a decimal point, for consistency
  // across every axis on every chart.
  function fmtAxisNum(v){
    var av=Math.abs(v);
    var sign=v<0?'−':'';
    if(av>=100000000){
      return sign+Math.round(av/1000000).toLocaleString('en-MY')+'mil';
    } else if(av>=100000){
      return sign+Math.round(av/1000).toLocaleString('en-MY')+'k';
    }
    return sign+Math.round(av).toLocaleString('en-MY');
  }
  function barChartFR(fyLabels,series){
    var n=fyLabels.length;
    // Width scales with n, capped at 7 FY
    var barW=36, groupGap=24, padL=16, padR=58, padYT=14, padYB=24;
    var SEG=68;
    var W=padL+n*SEG+padR, H=240;
    var pctW=Math.min(100,(n/10*100)).toFixed(1)+'%';
    barW=Math.min(28,Math.floor((SEG-groupGap)/series.length-4));
    var allV=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var rawMx=Math.max.apply(null,allV.concat([0]));
    var rawMn=Math.min.apply(null,allV.concat([0]));
    var scale=niceAxisScale(rawMn,rawMx,5);
    var mx=scale.max, mn=scale.min;
    if(mx===mn){ mx+=1; mn-=1; }
    var rng=mx-mn;
    var plotH=H-padYT-padYB;
    function yFor(v){ return padYT+(mx-v)/rng*plotH; }
    var zeroY=yFor(0);
    function bx(gi,si){return padL+gi*SEG+(SEG-groupGap-(series.length*barW+(series.length-1)*4))/2+si*(barW+4);}
    // Grid lines at nice round tick values (supports negative)
    var ticks=[];
    for(var tv=mn; tv<=mx+scale.step*0.001; tv+=scale.step){ ticks.push(tv); }
    var grid=ticks.map(function(v){
      var yy=yFor(v).toFixed(1);
      var vStr=fmtAxisNum(v);
      return '<line x1="'+padL+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'+
             '<text x="'+(W-padR+4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="7" fill="#374151">'+vStr+'</text>';
    }).join('');
    var zeroLine=(mn<0&&mx>0)?('<line x1="'+padL+'" y1="'+zeroY.toFixed(1)+'" x2="'+(W-padR)+'" y2="'+zeroY.toFixed(1)+'" stroke="#CBD5E1" stroke-width="1.2"/>'):'';
    // Bars — extend from the zero baseline up (positive) or down (negative)
    var bars='';
    series.forEach(function(s,si){
      s.v.forEach(function(v,gi){
        var yTop=yFor(Math.max(0,v)), yBot=yFor(Math.min(0,v));
        var h=Math.max(0.5,yBot-yTop);
        var x=bx(gi,si).toFixed(1);
        var col=s.colorByValue?(v<0?'#DC2626':'#2E7D32'):s.color;
        bars+='<rect x="'+x+'" y="'+yTop.toFixed(1)+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+col+'" rx="2"/>';
      });
    });
    // Group hover overlay per FY
    var overlays=fyLabels.map(function(fy,gi){
      var tipLines=series.map(function(s){
        var v=s.v[gi];
        var dotCol=s.colorByValue?(v<0?'#DC2626':'#2E7D32'):s.color;
        return dotCol+'::'+s.label+': '+(v<0?('−'+fmtFull(v)):fmtFull(v));
      });
      var tip='FY:'+fy+'|'+tipLines.join('|');
      var ox=(padL+gi*SEG).toFixed(1);
      var cx=((padL+gi*SEG+SEG/2)/W).toFixed(4);
      return '<rect x="'+ox+'" y="'+padYT+'" width="'+SEG+'" height="'+(H-padYT-padYB)+'" fill="transparent" data-cx="'+cx+'" data-tip="'+tip+'" onmouseenter="frTip(event,getTip(this),this.getAttribute(\'data-cx\'))" onmouseleave="frHide()" style="cursor:crosshair;touch-action:pan-y"/>';
    }).join('');
    var xL=fyLabels.map(function(l,i){
      return '<text x="'+(padL+i*SEG+SEG/2).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="7" fill="#374151">'+l+'</text>';
    }).join('');
    var leg='<div style="display:flex;gap:14px;margin-top:8px;justify-content:center">'+series.map(function(s){
      var swatch=s.colorByValue?'linear-gradient(90deg,#2E7D32 50%,#DC2626 50%)':s.color;
      return '<span style="display:flex;align-items:center;gap:5px;font-size:.73rem;color:var(--fg-3)"><span style="width:9px;height:9px;border-radius:2px;background:'+swatch+';display:inline-block"></span>'+s.label+'</span>';
    }).join('')+'</div>';
    return '<div style="width:100%">'
      +'<div style="width:'+pctW+';min-width:'+W+'px;max-width:100%;margin-left:auto;position:relative;overflow:visible">'
      +'<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block">'+grid+zeroLine+bars+overlays+xL+'</svg>'
      +'<div id="frTipEl" style="display:none;position:absolute;background:#fff;color:#0F172A;font-size:.74rem;font-weight:600;padding:8px 12px;border-radius:8px;pointer-events:none;z-index:10;top:4px;left:0;border:1px solid #E2E8F0;box-shadow:0 6px 20px rgba(0,0,0,.13);"></div>'
      +'</div></div>'+leg;
  }

  // Line chart with hover, right axis
  function lineChartFR(fyLabels,series){
    var n=fyLabels.length;
    var padL=16,padR=48,padYT=14,padYB=24,pointGap=60;
    var SEG=68;
    var W=padL+n*SEG+padR, H=240;
    var pctWL=Math.min(100,(n/10*100)).toFixed(1)+'%';
    pointGap=SEG;
    var allV=series.reduce(function(a,s){return a.concat(s.v);},[]).filter(function(v){return v>0;});
    var rawMx=Math.max.apply(null,allV.concat([0]))||1;
    var scale=niceAxisScale(0,rawMx,5);
    var mn=0,mx=scale.max,rng=mx-mn||1;
    function px(i){return padL+i*SEG+SEG/2;}
    function py(v){return H-padYB-((v-mn)/rng)*(H-padYT-padYB);}
    var ticks=[];
    for(var tv=0; tv<=mx+scale.step*0.001; tv+=scale.step){ ticks.push(tv); }
    var grid=ticks.map(function(v){
      var yy=py(v).toFixed(1);
      var vStr=Math.round(v)+'%';
      return '<line x1="'+padL+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'+
             '<text x="'+(W-padR+4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="7" fill="#374151">'+vStr+'</text>';
    }).join('');
    var paths=series.map(function(s){
      var pts=s.v.map(function(v,i){return {x:px(i),y:py(v),v:v};}).filter(function(p){return p.v>0;});
      if(!pts.length) return '';
      var d=pts.map(function(p,i){return (i?'L':'M')+p.x.toFixed(1)+','+p.y.toFixed(1);}).join('');
      var dots=pts.map(function(p){return '<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3" fill="#fff" stroke="'+s.color+'" stroke-width="2"/>';}).join('');
      return '<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="2" stroke-linejoin="round"/>'+dots;
    }).join('');
    // Group overlays per FY
    var lineOverlays=fyLabels.map(function(fy,gi){
      var tipLines=series.map(function(s){return s.color+'::'+s.label+': '+(s.v[gi]>0?s.v[gi].toFixed(2)+'%':'—');});
      var tip='FY:'+fy+'|'+tipLines.join('|');
      var ox=(padL+gi*SEG).toFixed(1);
      var cx=((padL+gi*SEG+SEG/2)/W).toFixed(4);
      return '<rect x="'+ox+'" y="'+padYT+'" width="'+SEG+'" height="'+(H-padYT-padYB)+'" fill="transparent" data-cx="'+cx+'" data-tip="'+tip+'" onmouseenter="frTip(event,getTip(this),this.getAttribute(\'data-cx\'))" onmouseleave="frHide()" style="cursor:crosshair;touch-action:pan-y"/>';
    }).join('');
    var xL=fyLabels.map(function(l,i){return '<text x="'+px(i).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="7" fill="#374151">'+l+'</text>';}).join('');
    var leg='<div style="display:flex;gap:14px;margin-top:8px;justify-content:center">'+series.map(function(s){
      return '<span style="display:flex;align-items:center;gap:5px;font-size:.73rem;color:var(--fg-3)"><span style="width:14px;height:2px;background:'+s.color+';display:inline-block;border-radius:2px"></span>'+s.label+'</span>';
    }).join('')+'</div>';
    return '<div style="width:100%">'
      +'<div style="width:'+pctWL+';min-width:'+W+'px;max-width:100%;margin-left:auto;position:relative">'
      +'<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block">'+grid+paths+lineOverlays+xL+'</svg>'
      +'<div id="frTipEl" style="display:none;position:absolute;background:#fff;color:#0F172A;font-size:.74rem;font-weight:600;padding:8px 12px;border-radius:8px;pointer-events:none;z-index:10;top:4px;left:0;border:1px solid #E2E8F0;box-shadow:0 6px 20px rgba(0,0,0,.13);"></div>'
      +'</div></div>'+leg;
  }

  function fmt(v){if(!v)return '—';return v>=1000000?(v/1000000).toFixed(2)+'M':v>=1000?(v/1000).toFixed(0)+'K':v.toLocaleString();}
  function fmtPct(v){if(!v)return '—';return v.toFixed(2)+'%';}
  function tRow(label,vals,fmtFn,bold){
    var style='font-size:.84rem;'+(bold?'font-weight:600;color:var(--fg-1)':'font-weight:400;color:var(--fg-2)');
    return '<tr style="border-bottom:1px solid var(--border)"><td style="padding:9px 16px;'+style+'">'+label+'</td>'
      +vals.map(function(v,i){
        var av=activeFY.indexOf(FY[i])>=0;
        return av?'<td style="padding:9px 16px;text-align:right;'+style+'">'+fmtFn(v)+'</td>':'';
      }).join('')+'</tr>';
  }
  function thead(){
    return '<thead><tr style="border-bottom:1px solid var(--border)">'
      +'<th style="padding:9px 16px;text-align:left;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--fg-3)">Item</th>'
      +FY.map(function(y,i){
        return activeFY.indexOf(y)>=0?'<th style="padding:9px 16px;text-align:right;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--fg-3)">'+y+'</th>':'';
      }).join('')
      +'</tr></thead>';
  }

  // Slice data to active FY
  function slice(arr){return arr.filter(function(_,i){return activeFY.indexOf(FY[i])>=0;});}

  // ── Shared live-statement table helpers (Income Statement + Balance Sheet) ──
  function fsRow(dataset,label,key,bold,fmtFn,highlight,indent){
    var style='font-size:.84rem;'+(bold?'font-weight:600;color:var(--fg-1)':'font-weight:400;color:var(--fg-2)');
    var rowBg=highlight?' style="background:var(--blue-bg);border-bottom:1px solid var(--border)"':' style="border-bottom:1px solid var(--border)"';
    var labelPad=indent?'9px 16px 9px 32px':'9px 16px';
    return '<tr'+rowBg+'><td style="padding:'+labelPad+';'+style+'">'+label+'</td>'
      +dataset.map(function(r){
        var v=r[key];
        if(v===null||v===undefined) return '<td style="padding:9px 16px;text-align:right;'+style+'">—</td>';
        var vc=v<0?'color:var(--red)':(bold&&v>0?'color:var(--green)':'');
        var txt;
        if(fmtFn){ txt=v===0?'—':(v<0?('('+fmtFn(Math.abs(v))+')'):fmtFn(v)); }
        else { txt=v===0?'—':(v<0?('('+fmtFull(v)+')'):fmtFull(v)); }
        return '<td style="padding:9px 16px;text-align:right;'+style+(vc?';'+vc:'')+'">'+txt+'</td>';
      }).join('')
      +'</tr>';
  }
  function fsSubheader(dataset,label){
    return '<tr><td colspan="'+(dataset.length+1)+'" style="padding:9px 16px 0;font-size:.8rem;font-style:italic;color:var(--fg-3)">'+label+'</td></tr>';
  }
  function fsThead(dataset,unitLabel){
    return '<thead><tr style="border-bottom:1px solid var(--border);background:var(--gray-100)">'
      +'<th style="padding:9px 16px;text-align:left;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--fg-3);width:300px">Item ('+unitLabel+')</th>'
      +dataset.map(function(r){return '<th style="padding:9px 16px;text-align:right;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--fg-3);width:90px">'+r.fy+'</th>';}).join('')
      +'</tr></thead>';
  }
  function fsSpacer(dataset){
    return '<tr><td colspan="'+(dataset.length+1)+'" style="padding:5px 0;border:none"></td></tr>';
  }
  function fsSectionHeader(dataset,label){
    return '<tr style="background:var(--gray-50)"><td colspan="'+(dataset.length+1)+'" style="padding:8px 16px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--fg-3)">'+label+'</td></tr>';
  }
  var fmtUnits=function(v){return v.toLocaleString('en-MY',{minimumFractionDigits:4,maximumFractionDigits:4});};
  var fmtCents=function(v){return v.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});};
  var fmtNta=function(v){return v.toLocaleString('en-MY',{minimumFractionDigits:4,maximumFractionDigits:4});};
  var fmtPctAbs=function(v){return v.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';};
  var fmtCount=function(v){return Math.round(v).toLocaleString('en-MY');};

  var chart='',table='';
  if(activeFRTab==='income'){
    if(INCOME_STATEMENT_ERROR){
      table='<div style="padding:24px;color:var(--red);font-size:.86rem">Could not load income statement — '+INCOME_STATEMENT_ERROR+'</div>';
    } else if(!INCOME_STATEMENT.length){
      table='<div style="padding:24px;color:var(--fg-3);font-size:.86rem">No financial years defined yet — add rows to fy_settings to see the income statement.</div>';
    } else {
      chart=barChartFR(INCOME_STATEMENT.map(function(r){return r.fy;}),[
        {v:INCOME_STATEMENT.map(function(r){return r.revenue;}),   color:'#1565C0', label:'Revenue'},
        {v:INCOME_STATEMENT.map(function(r){return r.netIncome;}), color:'#2E7D32', label:'NPAT', colorByValue:true}
      ]);
      table='<table style="width:100%;border-collapse:collapse;table-layout:fixed">'+fsThead(INCOME_STATEMENT,'RM')+'<tbody>'
        +fsRow(INCOME_STATEMENT,'Dividend Income','dividendIncome',false)
        +fsRow(INCOME_STATEMENT,'Interest Income','interestIncome',false)
        +fsRow(INCOME_STATEMENT,'Revenue / Total Income','revenue',true,null,true)
        +fsRow(INCOME_STATEMENT,'Management Cost','managementCost',false)
        +fsRow(INCOME_STATEMENT,'Gross Income','grossIncome',true,null,true)
        +fsRow(INCOME_STATEMENT,'Realised Profit &amp; Loss','realizedPnl',false)
        +fsRow(INCOME_STATEMENT,'Unrealised Profit &amp; Loss','unrealizedPnl',false)
        +fsRow(INCOME_STATEMENT,'Other Income / (Expenses)','otherIncomeExpense',false)
        +fsRow(INCOME_STATEMENT,'Profit before Tax','profitBeforeTax',true,null,true)
        +fsRow(INCOME_STATEMENT,'Tax Paid','tax',false)
        +fsRow(INCOME_STATEMENT,'Net Income / Profit after Tax (NPAT)','netIncome',true,null,true)
        +fsRow(INCOME_STATEMENT,'Outstanding Shares (Units)','outstandingShares',false,fmtUnits)
        +fsRow(INCOME_STATEMENT,'EPS (cents)','epsCents',false,fmtCents)
        +'</tbody></table>';
    }
  } else if(activeFRTab==='balance'){
    if(BALANCE_SHEET_ERROR){
      table='<div style="padding:24px;color:var(--red);font-size:.86rem">Could not load balance sheet — '+BALANCE_SHEET_ERROR+'</div>';
    } else if(!BALANCE_SHEET.length){
      table='<div style="padding:24px;color:var(--fg-3);font-size:.86rem">No financial years defined yet — add rows to fy_settings to see the balance sheet.</div>';
    } else {
      chart=barChartFR(BALANCE_SHEET.map(function(r){return r.fy;}),[
        {v:BALANCE_SHEET.map(function(r){return r.totalAssets;}), color:'#1565C0', label:'Assets'},
        {v:BALANCE_SHEET.map(function(r){return r.totalEquity;}), color:'#2E7D32', label:'Equities'}
      ]);
      table='<table style="width:100%;border-collapse:collapse;table-layout:fixed">'+fsThead(BALANCE_SHEET,'RM')+'<tbody>'
        +fsRow(BALANCE_SHEET,'Securities','securities',false)
        +fsRow(BALANCE_SHEET,'Other Investments','otherInvestments',false)
        +fsRow(BALANCE_SHEET,'Dividend Receivables','dividendReceivables',false)
        +fsRow(BALANCE_SHEET,'Cash &amp; Cash Equivalents','cash',false)
        +fsRow(BALANCE_SHEET,'Total Assets','totalAssets',true,null,true)
        +fsRow(BALANCE_SHEET,'Accrual Fees','accrualFees',false)
        +fsRow(BALANCE_SHEET,'Total Liabilities','totalLiabilities',true,null,true)
        +fsRow(BALANCE_SHEET,'Total Capital','totalCapital',false)
        +fsRow(BALANCE_SHEET,'Retained Earnings','retainedEarnings',false)
        +fsRow(BALANCE_SHEET,'Total Equities','totalEquity',true,null,true)
        +fsRow(BALANCE_SHEET,'Outstanding Shares (Units)','outstandingShares',false,fmtUnits)
        +fsRow(BALANCE_SHEET,'NTA per Share','ntaPerShare',false,fmtNta)
        +'</tbody></table>';
    }
  } else if(activeFRTab==='cashflow'){
    if(CASH_FLOW_ERROR){
      table='<div style="padding:24px;color:var(--red);font-size:.86rem">Could not load cash flow — '+CASH_FLOW_ERROR+'</div>';
    } else if(!CASH_FLOW.length){
      table='<div style="padding:24px;color:var(--fg-3);font-size:.86rem">No financial years defined yet — add rows to fy_settings to see the cash flow statement.</div>';
    } else {
      chart=barChartFR(CASH_FLOW.map(function(r){return r.fy;}),[
        {v:CASH_FLOW.map(function(r){return r.netCashOperating;}), color:'#1565C0', label:'CF Operating'},
        {v:CASH_FLOW.map(function(r){return r.netCashInvesting;}), color:'#E65100', label:'CF Investing'},
        {v:CASH_FLOW.map(function(r){return r.netCashFinancing;}), color:'#2E7D32', label:'CF Financing'}
      ]);
      table='<table style="width:100%;border-collapse:collapse;table-layout:fixed">'+fsThead(CASH_FLOW,'RM')+'<tbody>'
        +fsRow(CASH_FLOW,'Profit before Tax','profitBeforeTax',false)
        +fsSubheader(CASH_FLOW,'Adjustments for:')
        +fsRow(CASH_FLOW,'Unrealised (Gain) / Loss on Investment','unrealizedAdjustment',false,null,false,true)
        +fsRow(CASH_FLOW,'Realised (Gain) / Loss on Investment','realizedAdjustment',false,null,false,true)
        +fsRow(CASH_FLOW,'Net Proceeds from (Investment) / Disposal — Securities','proceedsSecurities',false)
        +fsRow(CASH_FLOW,'Net Proceeds from (Investment) / Disposal — Other Assets','proceedsOtherAssets',false)
        +fsRow(CASH_FLOW,'Changes in Receivables','changeReceivables',false)
        +fsRow(CASH_FLOW,'Changes in Accrual Fees','changeAccrualFees',false)
        +fsRow(CASH_FLOW,'Cashflow from Operations','cashflowFromOps',true,null,true)
        +fsRow(CASH_FLOW,'Income Tax Paid','incomeTaxPaid',false)
        +fsRow(CASH_FLOW,'Net Cash from Operating Activities','netCashOperating',true,null,true)
        +fsSpacer(CASH_FLOW)
        +fsRow(CASH_FLOW,'Net Cash from Investing Activities','netCashInvesting',true,null,true)
        +fsSpacer(CASH_FLOW)
        +fsRow(CASH_FLOW,'Dividend Paid','dividendPaid',false)
        +fsRow(CASH_FLOW,'Issuance of New Shares','issuanceOfShares',false)
        +fsRow(CASH_FLOW,'Net Cash from Financing Activities','netCashFinancing',true,null,true)
        +fsSpacer(CASH_FLOW)
        +fsRow(CASH_FLOW,'Net Increase in Cash &amp; Bank Balances','netIncreaseInCash',true,null,true)
        +fsRow(CASH_FLOW,'Cash &amp; Bank Balances at Beginning of FY','cashBeginning',false)
        +fsRow(CASH_FLOW,'Cash &amp; Bank Balances at End of FY','cashEnding',true,null,true)
        +'</tbody></table>';
    }
  } else {
    if(RATIO_ANALYSIS_ERROR){
      table='<div style="padding:24px;color:var(--red);font-size:.86rem">Could not load ratio analysis — '+RATIO_ANALYSIS_ERROR+'</div>';
    } else if(!RATIO_ANALYSIS.length){
      table='<div style="padding:24px;color:var(--fg-3);font-size:.86rem">No financial years defined yet — add rows to fy_settings to see ratio analysis.</div>';
    } else {
      chart=lineChartFR(RATIO_ANALYSIS.map(function(r){return r.fy;}),[
        {v:RATIO_ANALYSIS.map(function(r){return r.yieldReturn||0;}), color:'#1565C0', label:'Yield Return'},
        {v:RATIO_ANALYSIS.map(function(r){return r.grossReturn||0;}), color:'#2E7D32', label:'Gross Return'}
      ]);
      table='<table style="width:100%;border-collapse:collapse;table-layout:fixed">'+fsThead(RATIO_ANALYSIS,'%')+'<tbody>'
        +fsSectionHeader(RATIO_ANALYSIS,'Profitability')
        +fsRow(RATIO_ANALYSIS,'Gross Margin','grossMargin',false,fmtPctAbs)
        +fsRow(RATIO_ANALYSIS,'PBT Margin','pbtMargin',false,fmtPctAbs)
        +fsRow(RATIO_ANALYSIS,'NAT Margin','natMargin',false,fmtPctAbs)
        +fsSectionHeader(RATIO_ANALYSIS,'Return')
        +fsRow(RATIO_ANALYSIS,'Yield Return','yieldReturn',false,fmtPctAbs)
        +fsRow(RATIO_ANALYSIS,'Gross Return','grossReturn',false,fmtPctAbs)
        +fsRow(RATIO_ANALYSIS,'Return on Asset','returnOnAsset',false,fmtPctAbs)
        +fsSectionHeader(RATIO_ANALYSIS,'Leverage')
        +fsRow(RATIO_ANALYSIS,'Gearing Ratio','gearingRatio',false,fmtPctAbs)
        +fsRow(RATIO_ANALYSIS,'Cash Reserve Ratio','cashReserveRatio',false,fmtPctAbs)
        +fsSectionHeader(RATIO_ANALYSIS,'Dividend')
        +fsRow(RATIO_ANALYSIS,'Dividend per Share (sen)','dps',false,fmtCents)
        +fsRow(RATIO_ANALYSIS,'Dividend Yield','dividendYield',false,fmtPctAbs)
        +fsSectionHeader(RATIO_ANALYSIS,'Others (excl. Cash Funds)')
        +fsRow(RATIO_ANALYSIS,'No. of Transactions','numTransactions',false,fmtCount)
        +fsRow(RATIO_ANALYSIS,'Total Trading Amount (RM)','totalTradingAmount',false)
        +fsRow(RATIO_ANALYSIS,'Total Trading Units','totalTradingUnits',false,fmtUnits)
        +fsRow(RATIO_ANALYSIS,'Total Trading Fees (RM)','totalTradingFees',false)
        +fsRow(RATIO_ANALYSIS,'Fees Rate','feesRate',false,fmtPctAbs)
        +'</tbody></table>';
    }
  }

  var tabs=[{id:'income',label:'Income Statement'},{id:'balance',label:'Balance Sheet'},{id:'cashflow',label:'Cash Flow'},{id:'ratios',label:'Ratio Analysis'}];
  var tabBar='<div style="display:inline-flex;gap:2px;background:var(--gray-100);border-radius:10px;padding:4px;flex:none;">'
    +tabs.map(function(t){
      var on=t.id===activeFRTab;
      return '<button onclick="window._frTab=\''+t.id+'\';renderMain(true)" style="font:inherit;font-size:.82rem;font-weight:'+(on?'700':'500')+';padding:8px 14px;border-radius:8px;border:none;background:'+(on?'#fff':'none')+';color:'+(on?'var(--blue)':'var(--fg-3)')+';cursor:pointer;box-shadow:'+(on?'0 1px 4px rgba(0,0,0,.1)':'none')+';white-space:nowrap;">'+t.label+'</button>';
    }).join('')+'</div>';

  return '<div style="background:#fff;margin:-26px -28px -48px;padding:26px 28px 48px;min-height:100%">'
    +'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:24px"><div class="ph-xl" style="margin-bottom:0"><h1>Financial <span class="acc">Results</span></h1><p>Annual income, balance sheet, cash flow &amp; ratios.</p></div>'+tabBar+'</div>'
    +'<div style="margin-bottom:20px">'+chart+'</div>'
    +'<div style="margin-bottom:4px">'+table+'</div></div>';
}
