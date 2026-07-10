/* ===== assets/js/portal/pages-factsheet.js — Factsheet + Shareholders pages ===== */
var FS_HOLD_PALETTE=['#1565C0','#2E7D32','#E65100','#7C3AED','#0891B2','#B45309','#DB2777','#059669','#9333EA','#0D9488'];
var FS_OTHER_PALETTE=['#0891B2','#DB2777','#059669','#9333EA','#B45309','#0D9488','#E11D48','#4F46E5','#65A30D','#EA580C'];
function switchFsFy(fy){
  window._fsFy=fy;
  var el=document.getElementById('mainContent');
  if(el) el.innerHTML=pgFactsheet();
}
function switchFsMode(mode){
  window._fsMode=mode;
  var el=document.getElementById('mainContent');
  if(el) el.innerHTML=pgFactsheet();
}
// Ranks whichever field ('sector' or 'product') into a top-6 + "Others"
// group, and assigns colors: the chart's active grouping always gets the
// rank-based dark-blue → grey gradient (pieGradientColor, same one used
// by the app's donuts); this is reused as-is for the matching table
// column's color boxes so they visually match the chart exactly.
function fsGroupAndColor(fyList, holdingsByFy, field){
  var byFy = fyList.map(function(fy){
    var bucket=holdingsByFy.filter(function(f){return f.fy===fy;})[0];
    var holdings=bucket?bucket.holdings:[];
    var map={};
    holdings.forEach(function(h){ var k=h[field]||'Other'; map[k]=(map[k]||0)+h.pct; });
    return map;
  });
  var overallTotals={};
  byFy.forEach(function(m){ Object.keys(m).forEach(function(k){ overallTotals[k]=(overallTotals[k]||0)+m[k]; }); });
  var ranked=Object.keys(overallTotals).sort(function(a,b){return overallTotals[b]-overallTotals[a];});
  var TOP_N=6;
  var mainKeys=ranked.slice(0,TOP_N);
  var hasOthers=ranked.length>TOP_N;
  var segOrder=mainKeys.concat(hasOthers?['Others']:[]);
  var colorFor={};
  segOrder.forEach(function(k,idx){ colorFor[k]=pieGradientColor(idx,segOrder.length); });
  var valsByFy=byFy.map(function(m){
    var vals={}; segOrder.forEach(function(k){vals[k]=0;});
    Object.keys(m).forEach(function(k){
      var key=mainKeys.indexOf(k)>=0?k:'Others';
      vals[key]=(vals[key]||0)+m[k];
    });
    return vals;
  });
  return {segOrder:segOrder, colorFor:colorFor, mainKeys:mainKeys, valsByFy:valsByFy};
}
// A simple rotating, non-blue palette for whichever field ISN'T the
// active chart grouping — so its table color boxes are still visually
// distinct without competing with the chart's blue-family gradient.
function fsOtherColorMap(fyList, holdingsByFy, field){
  var seen=[], colorFor={};
  fyList.forEach(function(fy){
    var bucket=holdingsByFy.filter(function(f){return f.fy===fy;})[0];
    var holdings=bucket?bucket.holdings:[];
    holdings.forEach(function(h){ var k=h[field]||'Other'; if(seen.indexOf(k)<0) seen.push(k); });
  });
  seen.forEach(function(k,idx){ colorFor[k]=FS_OTHER_PALETTE[idx%FS_OTHER_PALETTE.length]; });
  return colorFor;
}
// Stacked column chart — one bar per FY; segments follow whichever
// grouping (sector or product) is currently selected via the top-right
// tab. No legend — clicking a bar (or its FY label) switches the
// Holdings table below to that FY, and the selected bar gets a dark
// outline plus a bold FY label. Smooth, moderately-tinted ribbons connect
// each segment across consecutive FYs, like a stream graph.
function buildHoldingsStackChart(fyList, groupData, selectedFy){
  var n=fyList.length;
  if(!n) return '<div style="padding:50px 20px;color:var(--fg-3);font-size:.85rem;text-align:center">No holdings data on record</div>';
  var segOrder=groupData.segOrder, colorFor=groupData.colorFor, valsByFy=groupData.valsByFy;
  var W=800,H=380,padL=8,padR=44,padYT=14,padYB=28;
  var pctW=Math.min(100,(n/10*100)).toFixed(1)+'%';
  var gap=(W-padL-padR)/n;
  var barW=Math.min(64,gap*0.6);
  function bx(i){ return padL+i*gap+gap/2-barW/2; }
  var grid=[0,25,50,75,100].map(function(v){
    var yy=(H-padYB-(v/100)*(H-padYT-padYB)).toFixed(1);
    return '<line x1="'+padL+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F1F5F9" stroke-width="1"/>'
      +'<text x="'+(W-padR+5)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="9.5" fill="#000000">'+v+'%</text>';
  }).join('');

  var boundsByFy=valsByFy.map(function(vals){
    var y=H-padYB, b={};
    segOrder.forEach(function(s){
      var v=vals[s]||0;
      var hgt=(v/100)*(H-padYT-padYB);
      var yTop=y-hgt;
      b[s]={top:yTop,bot:y,v:v};
      y=yTop;
    });
    return b;
  });

  // Smooth ribbons linking each segment between consecutive FYs
  var ribbons='';
  for(var i=0;i<n-1;i++){
    var x1=bx(i)+barW, x2=bx(i+1);
    var midX=(x1+x2)/2;
    segOrder.forEach(function(s){
      var b1=boundsByFy[i][s], b2=boundsByFy[i+1][s];
      if(b1.v<=0.05 && b2.v<=0.05) return;
      var d='M'+x1.toFixed(1)+','+b1.top.toFixed(1)
        +' C'+midX.toFixed(1)+','+b1.top.toFixed(1)+' '+midX.toFixed(1)+','+b2.top.toFixed(1)+' '+x2.toFixed(1)+','+b2.top.toFixed(1)
        +' L'+x2.toFixed(1)+','+b2.bot.toFixed(1)
        +' C'+midX.toFixed(1)+','+b2.bot.toFixed(1)+' '+midX.toFixed(1)+','+b1.bot.toFixed(1)+' '+x1.toFixed(1)+','+b1.bot.toFixed(1)
        +' Z';
      ribbons+='<path d="'+d+'" fill="'+colorFor[s]+'" opacity="0.34" stroke="none"/>';
    });
  }

  var bars='', overlays='';
  fyList.forEach(function(fy,i){
    var b=boundsByFy[i];
    var isSel=(fy===selectedFy);
    var tipLines=[];
    segOrder.forEach(function(s){
      if(b[s].v<=0.05) return;
      bars+='<rect x="'+bx(i).toFixed(1)+'" y="'+b[s].top.toFixed(1)+'" width="'+barW.toFixed(1)+'" height="'+(b[s].bot-b[s].top).toFixed(1)+'" fill="'+colorFor[s]+'" stroke="'+(isSel?'#0F172A':'none')+'" stroke-width="'+(isSel?'1.4':'0')+'" onclick="switchFsFy(\''+fy+'\')" style="cursor:pointer"/>';
      tipLines.push(colorFor[s]+'::'+s+': '+b[s].v.toFixed(1)+'%');
    });
    var tip='FY:'+fy+'|'+(tipLines.length?tipLines.join('|'):'No holdings');
    var ox=(padL+i*gap).toFixed(1);
    var cx=((padL+i*gap+gap/2)/W).toFixed(4);
    overlays+='<rect x="'+ox+'" y="'+padYT+'" width="'+gap.toFixed(1)+'" height="'+(H-padYT-padYB)+'" fill="transparent" data-cx="'+cx+'" data-tip="'+tip+'" onmouseenter="frTip(event,getTip(this),this.getAttribute(\'data-cx\'))" onmouseleave="frHide()" onclick="switchFsFy(\''+fy+'\')" style="cursor:pointer"/>';
  });
  var xL=fyList.map(function(fy,i){
    var isSel=(fy===selectedFy);
    return '<text x="'+(bx(i)+barW/2).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" font-size="10.5" font-weight="'+(isSel?'700':'400')+'" fill="#000000" style="cursor:pointer" onclick="switchFsFy(\''+fy+'\')">'+fy+'</text>';
  }).join('');

  return '<div style="width:100%">'
    +'<div style="width:'+pctW+';min-width:'+W+'px;max-width:100%;margin-left:auto;position:relative;overflow:visible">'
    +'<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block">'+grid+ribbons+bars+overlays+xL+'</svg>'
    +'<div id="frTipEl" style="display:none;position:absolute;background:#fff;color:#0F172A;font-size:.74rem;font-weight:600;padding:8px 12px;border-radius:8px;pointer-events:none;z-index:10;top:4px;left:0;border:1px solid #E2E8F0;box-shadow:0 6px 20px rgba(0,0,0,.13);"></div>'
    +'</div></div>';
}

function pgFactsheet(){
  var fyOptions = HOLDINGS_BY_FY.map(function(f){ return f.fy; });
  var fySel = window._fsFy && fyOptions.indexOf(window._fsFy)>=0 ? window._fsFy : fyOptions[fyOptions.length-1];
  var mode = window._fsMode==='product' ? 'product' : 'sector';
  var bucket = HOLDINGS_BY_FY.filter(function(f){ return f.fy===fySel; })[0];
  var holdings = bucket ? bucket.holdings : [];

  function modeBtn(lbl,m){ return '<button class="'+(mode===m?'on':'')+'" onclick="switchFsMode(\''+m+'\')">'+lbl+'</button>'; }
  var modeTabs='<div class="seg">'+modeBtn('Sector','sector')+modeBtn('Product','product')+'</div>';

  // Active grouping (drives the chart) gets the blue-family gradient;
  // the other field gets a separate rotating palette for its table pills.
  var activeGroup = fsGroupAndColor(fyOptions, HOLDINGS_BY_FY, mode);
  var otherField = mode==='sector' ? 'product' : 'sector';
  var otherColorFor = fsOtherColorMap(fyOptions, HOLDINGS_BY_FY, otherField);

  // Soft pastel color pill — same style as the app's existing tag pills
  // (light tint background, the color itself for text), not a solid-fill
  // badge. Parses either the rgb(...) from pieGradientColor or the hex
  // values from the "other field" palette.
  function fsParseColor(color){
    var m=/rgb\((\d+),(\d+),(\d+)\)/.exec(color);
    if(m) return {r:+m[1],g:+m[2],b:+m[3]};
    var h=color.replace('#','');
    return {r:parseInt(h.substr(0,2),16),g:parseInt(h.substr(2,2),16),b:parseInt(h.substr(4,2),16)};
  }
  function colorPill(color,label){
    var c=fsParseColor(color);
    var bg='rgba('+c.r+','+c.g+','+c.b+',0.14)';
    return '<span style="display:inline-block;padding:3px 10px;border-radius:99px;background:'+bg+';color:'+color+';font-size:.85rem;font-weight:400;white-space:nowrap">'+label+'</span>';
  }

  var totalMV = holdings.reduce(function(s,h){ return s+(h.mv||0); },0);
  var hRows = holdings.length
    ? holdings.map(function(h){
        var sub = (h.code && h.ticker) ? (h.code+' | '+h.ticker) : (h.code||h.ticker||'—');
        var sectorColor = mode==='sector' ? (activeGroup.colorFor[activeGroup.mainKeys.indexOf(h.sector)>=0?h.sector:'Others']) : otherColorFor[h.sector];
        var productColor = mode==='product' ? (activeGroup.colorFor[activeGroup.mainKeys.indexOf(h.product)>=0?h.product:'Others']) : otherColorFor[h.product];
        return '<tr style="background:#fff">'
          +'<td style="padding:10px 16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:400;color:var(--fg-1)">'+h.name+'<div style="font-size:.78rem;color:var(--fg-3);font-weight:400">'+sub+'</div></td>'
          +'<td style="padding:10px 16px">'+colorPill(productColor,h.product)+'</td>'
          +'<td style="padding:10px 16px">'+colorPill(sectorColor,h.sector)+'</td>'
          +'<td style="padding:10px 16px;text-align:right;font-weight:400;color:var(--fg-1)">RM '+(h.mv||0).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
          +'<td style="padding:10px 16px;text-align:right;font-weight:400;color:var(--fg-1)">'+h.pct.toFixed(1)+'%</td>'
          +'</tr>';
      }).join('')
    : '<tr><td colspan="5" style="padding:30px 16px;text-align:center;color:var(--fg-3);font-size:.85rem;background:#fff">'+(HOLDINGS_BY_FY_ERROR?('Could not load — '+HOLDINGS_BY_FY_ERROR):'No holdings on record for this financial year')+'</td></tr>';

  var totalRow = holdings.length
    ? '<tr style="border-top:2px solid var(--border-strong,var(--border));background:#fff">'
      +'<td style="padding:10px 16px;font-weight:400;color:var(--fg-1)">Total</td>'
      +'<td style="padding:10px 16px"></td>'
      +'<td style="padding:10px 16px"></td>'
      +'<td style="padding:10px 16px;text-align:right;font-weight:400;color:var(--fg-1)">RM '+totalMV.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
      +'<td style="padding:10px 16px;text-align:right;font-weight:400;color:var(--fg-1)">100.0%</td>'
      +'</tr>'
    : '';

  var colgroup='<colgroup><col style="width:34%"><col style="width:18%"><col style="width:18%"><col style="width:15%"><col style="width:15%"></colgroup>';

  return '<div style="background:#fff;margin:-26px -28px -48px;padding:26px 28px 48px;min-height:100%">'
    +'<div class="ph-xl"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px"><h1 style="margin:0">Fund <span class="acc">Factsheet</span></h1>'+modeTabs+'</div></div>'
    // Stacked column chart — click a bar to switch the table below
    +'<div style="margin-bottom:24px">'+buildHoldingsStackChart(fyOptions, activeGroup, fySel)+'</div>'
    // Holdings table — no title/subline, no card outline, fixed column
    // widths, only the header divider line, all rows white, Total pinned last
    +'<table style="width:100%;table-layout:fixed;border-collapse:collapse">'+colgroup
    +'<thead><tr style="border-bottom:1px solid var(--border)">'
    +'<th style="padding:10px 16px;text-align:left;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3)">Instrument</th>'
    +'<th style="padding:10px 16px;text-align:left;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3)">Product</th>'
    +'<th style="padding:10px 16px;text-align:left;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3)">Sector</th>'
    +'<th style="padding:10px 16px;text-align:right;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3)">Value</th>'
    +'<th style="padding:10px 16px;text-align:right;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3)">Weight</th>'
    +'</tr></thead>'
    +'<tbody>'+hRows+totalRow+'</tbody></table>'
    +'</div>';
}


// ── SHAREHOLDERS ──────────────────────────────────────────────────────────
function pgShareholders(){
  var fyOptions = SHAREHOLDERS_BY_FY.map(function(f){ return f.fy; });
  var fySel = window._shFy && fyOptions.indexOf(window._shFy)>=0 ? window._shFy : fyOptions[fyOptions.length-1];
  var fyBucket = SHAREHOLDERS_BY_FY.filter(function(f){ return f.fy===fySel; })[0];
  var rawList = fyBucket ? fyBucket.list : [];
  var totalUnits = rawList.reduce(function(a,s){return a+(parseFloat(s.units_held)||0);},0) || 1;
  var shareholders = rawList.map(function(s){
    return {
      initials: mpInitials(s.full_name),
      name: s.full_name || 'Unknown',
      position: s.account_type==='director' ? 'Director' : 'Shareholder',
      since: formatDate(s.joined_date),
      units: parseFloat(s.units_held) || 0,
      pct: ((parseFloat(s.units_held)||0) / totalUnits * 100)
    };
  });
  var maxPct = shareholders.length ? Math.max.apply(null, shareholders.map(function(s){return s.pct;})) : 1;

  function fyTabBtn(fy){
    return '<button class="'+(fySel===fy?'on':'')+'" onclick="switchShareholderFy(\''+fy+'\')">'+fy+'</button>';
  }
  var fyTabs = fyOptions.length ? '<div class="seg">'+fyOptions.map(fyTabBtn).join('')+'</div>' : '';

  // Avatar colour pool (teal/green gradient shades matching image)
  var avBg=['#2E7D7C','#3A7D6B','#2E6B7C','#3A6B5A','#2E7D7C','#2E6B7C','#2E7D7C','#3D5A80'];

  // Position / Holding Since / Units share one fixed, equal, centered width.
  var eqCol='width:14%;text-align:center;';
  // Units column keeps its own right-alignment with a visual indent from
  // the cell's right edge — numeric, #,##0.0000.
  function fmtUnits4dp(v){ return (v||0).toLocaleString('en-MY',{minimumFractionDigits:4,maximumFractionDigits:4}); }

  var rows=shareholders.map(function(s,i){
    var barW=(s.pct/maxPct*100).toFixed(1);
    var isDir=s.position==='Director';
    return '<tr style="border-bottom:1px solid var(--border);'+(isDir?'background:#F0F7FF':'')+'">'
      +'<td style="padding:14px 16px;color:var(--fg-3);font-size:.88rem;">'+(i+1)+'</td>'
      +'<td style="padding:14px 16px;">'
        +'<div style="width:36px;height:36px;border-radius:50%;background:'+avBg[i%avBg.length]+';color:#fff;font-size:.72rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+s.initials+'</div>'
      +'</td>'
      +'<td style="padding:14px 8px;font-weight:400;color:var(--fg-1);font-size:.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+s.name+'</td>'
      +'<td style="padding:14px 16px;'+eqCol+'color:var(--fg-2);font-size:.88rem;">'+s.position+'</td>'
      +'<td style="padding:14px 16px;'+eqCol+'color:var(--fg-2);font-size:.88rem;">'+s.since+'</td>'
      +'<td style="padding:14px 32px 14px 16px;text-align:right;font-size:.88rem;font-weight:400;font-variant-numeric:tabular-nums;">'+fmtUnits4dp(s.units)+'</td>'
      +'<td style="padding:14px 16px;">'
        +'<div style="display:flex;align-items:center;gap:10px;">'
          +'<div style="flex:1;height:5px;background:var(--gray-100);border-radius:99px;overflow:hidden;">'
            +'<div style="width:'+barW+'%;height:100%;background:var(--blue);border-radius:99px;"></div>'
          +'</div>'
          +'<span style="font-size:.84rem;font-weight:400;color:var(--fg-1);min-width:44px;text-align:right;">'+s.pct.toFixed(2)+'%</span>'
        +'</div>'
      +'</td>'
      +'</tr>';
  }).join('');

  // Total row — always pinned as the very last row of the table, and
  // always rendered (even at 0) so every FY tab shows the same structure.
  var totalRow = '<tr style="border-top:2px solid var(--border-strong,var(--border));background:var(--gray-50)">'
      +'<td style="padding:14px 16px;"></td>'
      +'<td style="padding:14px 16px;"></td>'
      +'<td style="padding:14px 8px;font-weight:700;color:var(--fg-1);font-size:.88rem;">Total</td>'
      +'<td style="padding:14px 16px;'+eqCol+'"></td>'
      +'<td style="padding:14px 16px;'+eqCol+'"></td>'
      +'<td style="padding:14px 32px 14px 16px;text-align:right;font-size:.88rem;font-weight:700;color:var(--fg-1);font-variant-numeric:tabular-nums;">'+fmtUnits4dp(shareholders.length?totalUnits:0)+'</td>'
      +'<td style="padding:14px 16px;font-size:.84rem;font-weight:700;color:var(--fg-1);">'+(shareholders.length?'100.00%':'—')+'</td>'
      +'</tr>';

  var emptyRow = '<tr><td colspan="7" style="padding:40px 16px;text-align:center;color:var(--fg-3);font-size:.85rem">'+(SHAREHOLDERS_BY_FY_ERROR?('Could not load — '+SHAREHOLDERS_BY_FY_ERROR):'No shareholders on record for this financial year')+'</td></tr>';

  var colgroup='<colgroup>'
    +'<col style="width:5%">'
    +'<col style="width:6%">'
    +'<col style="width:23%">'
    +'<col style="width:14%">'
    +'<col style="width:14%">'
    +'<col style="width:19%">'
    +'<col style="width:19%">'
    +'</colgroup>';

  // Table is ALWAYS rendered with the same colgroup — even a financial
  // year with zero shareholders keeps the exact same fixed column widths
  // (an empty state that swaps out the whole <table> for a plain <div>
  // was what made the very first FY look narrower/different).
  return '<div style="background:#fff;margin:-26px -28px -48px;padding:26px 28px 48px;min-height:100%"><div class="ph-xl"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px"><h1 style="margin:0">Shareholder <span class="acc">List</span></h1>'+fyTabs+'</div></div>'
    // 2 blank lines of breathing room before the table
    +'<div aria-hidden="true" style="line-height:24px">&nbsp;<br>&nbsp;</div>'
    +'<table style="width:100%;table-layout:fixed;border-collapse:collapse;">'+colgroup
    +'<thead><tr style="border-bottom:1px solid var(--border);">'
    +'<th style="padding:10px 16px;text-align:left;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3);">#</th>'
    +'<th style="padding:10px 16px;"></th>'
    +'<th style="padding:10px 8px;text-align:left;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3);">Name</th>'
    +'<th style="padding:10px 16px;'+eqCol+'font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3);">Position</th>'
    +'<th style="padding:10px 16px;'+eqCol+'font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3);">Holding Since</th>'
    +'<th style="padding:10px 32px 10px 16px;text-align:right;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3);">Units</th>'
    +'<th style="padding:10px 16px;text-align:left;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3);">Ownership %</th>'
    +'</tr></thead>'
    +'<tbody>'+(shareholders.length?rows:emptyRow)+totalRow+'</tbody>'
    +'</table>'
    +'</div>';
}
function switchShareholderFy(fy){
  window._shFy=fy;
  var el=document.getElementById('mainContent');
  if(el) el.innerHTML=pgShareholders();
}

// ── NAVIGATION ───────────────────────────────────────────────────────────────
