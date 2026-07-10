/* ===== assets/js/portal/pages-fund-overview.js — Fund Overview page (large, self-contained) ===== */
function pgFundOverview(){
  // Each chart instance gets its own tooltip element id, since several
  // charts render on this page simultaneously and frTip()/frHide() target
  // one element by id at a time.
  var _fovTipSeq=0;
  function nextTipId(){ return 'fovTip'+(_fovTipSeq++); }

  function kf(label,val,unit){
    return '<div class="fov-kf"><div class="fov-kl">'+label+'</div>'
      +'<div class="fov-kv">'+val+(unit?'<span class="fov-ku"> '+unit+'</span>':'')+'</div></div>';
  }

  // Thin donut — fills container
  function donut(segs,label){
    var s=200,cx=s/2,cy=s/2,R=s*0.42,ir=s*0.30;
    var total=segs.reduce(function(a,x){return a+x.v;},0);
    var ang=-Math.PI/2,paths='';
    segs.forEach(function(sg){
      var sweep=(sg.v/total)*2*Math.PI,ea=ang+sweep;
      var x1=(cx+R*Math.cos(ang)).toFixed(2),y1=(cy+R*Math.sin(ang)).toFixed(2);
      var x2=(cx+R*Math.cos(ea)).toFixed(2),y2=(cy+R*Math.sin(ea)).toFixed(2);
      var x3=(cx+ir*Math.cos(ea)).toFixed(2),y3=(cy+ir*Math.sin(ea)).toFixed(2);
      var x4=(cx+ir*Math.cos(ang)).toFixed(2),y4=(cy+ir*Math.sin(ang)).toFixed(2);
      var la=sweep>Math.PI?1:0;
      var d='M'+x1+' '+y1+' A'+R+' '+R+' 0 '+la+' 1 '+x2+' '+y2+' L'+x3+' '+y3+' A'+ir+' '+ir+' 0 '+la+' 0 '+x4+' '+y4+'Z';
      paths+='<path d="'+d+'" fill="'+sg.color+'" stroke="none"/>';
      ang=ea;
    });
    var legend=segs.map(function(sg,i){
      var pct=(sg.v/total*100).toFixed(1);
      return '<div style="display:flex;align-items:center;gap:6px;font-size:.78rem;color:#374151">'
        +'<span style="width:8px;height:8px;border-radius:50%;background:'+sg.color+';flex-shrink:0;display:inline-block"></span>'
        +sg.label+' <span style="color:#9CA3AF">'+pct+'%</span></div>';
    }).join('');
    return '<div style="display:flex;align-items:center;justify-content:flex-start;gap:24px;flex:1;padding:8px 0">'
      +'<svg viewBox="0 0 '+s+' '+s+'" style="width:'+s+'px;height:'+s+'px;flex-shrink:0">'
      +paths
      +'<circle cx="'+cx+'" cy="'+cy+'" r="'+(ir-3)+'" fill="#fff"/>'
      +'<text x="'+cx+'" y="'+(cy-4)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="11" font-weight="700" fill="#0F172A">'+label+'</text>'
      +'<text x="'+cx+'" y="'+(cy+12)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="9" fill="#6B7280">total</text>'
      +'</svg>'
      +'<div style="display:flex;flex-direction:column;gap:7px">'+legend+'</div>'
      +'</div>';
  }

  // Line chart — full width + hover
  function line(series,labels){
    var W=420,H=220,padX=36,padY=18;
    var all=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var mn=Math.min.apply(null,all),mx=Math.max.apply(null,all),rng=mx-mn||0.001;
    var n=labels.length;
    function px(i){return padX+(i/(n-1))*(W-padX-8);}
    function py(v){return H-padY-((v-mn)/rng)*(H-padY*2);}
    var paths=series.map(function(s){
      var d=s.v.map(function(v,i){return (i?'L':'M')+px(i).toFixed(1)+','+py(v).toFixed(1);}).join('');
      var area=d+' L'+px(n-1).toFixed(1)+','+(H-padY)+' L'+px(0).toFixed(1)+','+(H-padY)+'Z';
      var dots=s.v.map(function(v,i){
        var tip=labels[i]+': '+v.toFixed(4);
        return '<circle cx="'+px(i).toFixed(1)+'" cy="'+py(v).toFixed(1)+'" r="3" fill="#fff" stroke="'+s.color+'" stroke-width="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
      }).join('');
      return '<defs><linearGradient id="lg'+s.id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+s.color+'" stop-opacity=".12"/><stop offset="1" stop-color="'+s.color+'" stop-opacity="0"/></linearGradient></defs>'
        +'<path d="'+area+'" fill="url(#lg'+s.id+')"/>'
        +'<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+dots;
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=mn+f*rng;
      var vStr=v>=100?v.toFixed(0):v>=1?v.toFixed(2):v.toFixed(4);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+vStr+'</text>';
    }).join('');
    var xL=[0,Math.floor(n/2),n-1].map(function(i){return '<text x="'+px(i).toFixed(1)+'" y="'+(H-2)+'" text-anchor="middle" font-size="8.5" fill="#9CA3AF">'+labels[i]+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+paths+xL+'</svg>';
    var leg=series.length>1?'<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'+series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:'+s.color+';display:inline-block;border-radius:1px"></span>'+(s.label||s.id)+'</span>';}).join('')+'</div>':'';
    return chartSvg+leg;
  }
  // Combo chart — bars (DPS) + line (Yield) + hover
  function comboChart(groups,barSeries,lineSeries){
    var W=420,H=220,padX=42,padYT=16,padYB=24;
    var allBar=barSeries.v,allLine=lineSeries.v;
    var barMax=Math.max.apply(null,allBar)||1,lineMax=Math.max.apply(null,allLine)||1;
    var n=groups.length,groupW=(W-padX-8)/n,barW=Math.min(28,groupW*0.35);
    function bx(i){return (padX+i*groupW+groupW/2-barW/2).toFixed(1);}
    function barH(v){return Math.max(2,((v/barMax)*(H-padYT-padYB))).toFixed(1);}
    function barY(v){return (H-padYB-parseFloat(barH(v))).toFixed(1);}
    function lx(i){return (padX+i*groupW+groupW/2).toFixed(1);}
    function ly(v){return (H-padYB-((v/lineMax)*(H-padYT-padYB))).toFixed(1);}
    var bPaths=allBar.map(function(v,i){
      var tip=groups[i]+' '+barSeries.label+': '+v;
      return '<rect x="'+bx(i)+'" y="'+barY(v)+'" width="'+barW+'" height="'+barH(v)+'" fill="'+barSeries.color+'" rx="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
    }).join('');
    var ld=allLine.map(function(v,i){return (i?'L':'M')+lx(i)+','+ly(v);}).join('');
    var ldots=allLine.map(function(v,i){
      var tip=groups[i]+' '+lineSeries.label+': '+v+'%';
      return '<circle cx="'+lx(i)+'" cy="'+ly(v)+'" r="3" fill="#fff" stroke="'+lineSeries.color+'" stroke-width="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padYB-f*(H-padYT-padYB)).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+(barMax*f).toFixed(2)+'</text>'
        +'<text x="'+(W-4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="'+lineSeries.color+'">'+(lineMax*f).toFixed(1)+'%</text>';
    }).join('');
    var xL=groups.map(function(l,i){return '<text x="'+lx(i)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+'<path d="'+ld+'" fill="none" stroke="'+lineSeries.color+'" stroke-width="2" stroke-linejoin="round"/>'+ldots+xL+'</svg>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+barSeries.color+';display:inline-block"></span>'+barSeries.label+'</span>'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:'+lineSeries.color+';display:inline-block;border-radius:1px"></span>'+lineSeries.label+'</span>'
      +'</div>';
    return chartSvg+leg;
  }
  function donut(segs,label){
    var s=200,cx=s/2,cy=s/2,R=s*0.42,ir=s*0.30;
    var total=segs.reduce(function(a,x){return a+x.v;},0);
    var ang=-Math.PI/2,paths='';
    segs.forEach(function(sg){
      var sweep=(sg.v/total)*2*Math.PI,ea=ang+sweep;
      var x1=(cx+R*Math.cos(ang)).toFixed(2),y1=(cy+R*Math.sin(ang)).toFixed(2);
      var x2=(cx+R*Math.cos(ea)).toFixed(2),y2=(cy+R*Math.sin(ea)).toFixed(2);
      var x3=(cx+ir*Math.cos(ea)).toFixed(2),y3=(cy+ir*Math.sin(ea)).toFixed(2);
      var x4=(cx+ir*Math.cos(ang)).toFixed(2),y4=(cy+ir*Math.sin(ang)).toFixed(2);
      var la=sweep>Math.PI?1:0;
      var d='M'+x1+' '+y1+' A'+R+' '+R+' 0 '+la+' 1 '+x2+' '+y2+' L'+x3+' '+y3+' A'+ir+' '+ir+' 0 '+la+' 0 '+x4+' '+y4+'Z';
      paths+='<path d="'+d+'" fill="'+sg.color+'" stroke="none"/>';
      ang=ea;
    });
    var legend=segs.map(function(sg,i){
      var pct=(sg.v/total*100).toFixed(1);
      return '<div style="display:flex;align-items:center;gap:6px;font-size:.78rem;color:#374151">'
        +'<span style="width:8px;height:8px;border-radius:50%;background:'+sg.color+';flex-shrink:0;display:inline-block"></span>'
        +sg.label+' <span style="color:#9CA3AF">'+pct+'%</span></div>';
    }).join('');
    return '<div style="display:flex;align-items:center;justify-content:flex-start;gap:24px;flex:1;padding:8px 0">'
      +'<svg viewBox="0 0 '+s+' '+s+'" style="width:'+s+'px;height:'+s+'px;flex-shrink:0">'
      +paths
      +'<circle cx="'+cx+'" cy="'+cy+'" r="'+(ir-3)+'" fill="#fff"/>'
      +'<text x="'+cx+'" y="'+(cy-4)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="11" font-weight="700" fill="#0F172A">'+label+'</text>'
      +'<text x="'+cx+'" y="'+(cy+12)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="9" fill="#6B7280">total</text>'
      +'</svg>'
      +'<div style="display:flex;flex-direction:column;gap:7px">'+legend+'</div>'
      +'</div>';
  }

  // Line chart — full width + hover
  function line(series,labels){
    var W=420,H=220,padX=36,padY=18;
    var all=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var mn=Math.min.apply(null,all),mx=Math.max.apply(null,all),rng=mx-mn||0.001;
    var n=labels.length;
    function px(i){return padX+(i/(n-1))*(W-padX-8);}
    function py(v){return H-padY-((v-mn)/rng)*(H-padY*2);}
    var paths=series.map(function(s){
      var d=s.v.map(function(v,i){return (i?'L':'M')+px(i).toFixed(1)+','+py(v).toFixed(1);}).join('');
      var area=d+' L'+px(n-1).toFixed(1)+','+(H-padY)+' L'+px(0).toFixed(1)+','+(H-padY)+'Z';
      var dots=s.v.map(function(v,i){
        var tip=labels[i]+': '+v.toFixed(4);
        return '<circle cx="'+px(i).toFixed(1)+'" cy="'+py(v).toFixed(1)+'" r="3" fill="#fff" stroke="'+s.color+'" stroke-width="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
      }).join('');
      return '<defs><linearGradient id="lg'+s.id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+s.color+'" stop-opacity=".12"/><stop offset="1" stop-color="'+s.color+'" stop-opacity="0"/></linearGradient></defs>'
        +'<path d="'+area+'" fill="url(#lg'+s.id+')"/>'
        +'<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+dots;
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=mn+f*rng;
      var vStr=v>=100?v.toFixed(0):v>=1?v.toFixed(2):v.toFixed(4);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+vStr+'</text>';
    }).join('');
    var xL=[0,Math.floor(n/2),n-1].map(function(i){return '<text x="'+px(i).toFixed(1)+'" y="'+(H-2)+'" text-anchor="middle" font-size="8.5" fill="#9CA3AF">'+labels[i]+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+paths+xL+'</svg>';
    var leg=series.length>1?'<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'+series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:'+s.color+';display:inline-block;border-radius:1px"></span>'+(s.label||s.id)+'</span>';}).join('')+'</div>':'';
    return chartSvg+leg;
  }
  // Combo chart — bars (DPS) + line (Yield)
  function comboChart(groups,barSeries,lineSeries){
    var W=420,H=220,padX=42,padYT=16,padYB=24;
    var allBar=barSeries.v, allLine=lineSeries.v;
    var barMax=Math.max.apply(null,allBar)||1;
    var lineMax=Math.max.apply(null,allLine)||1;
    var n=groups.length;
    var groupW=(W-padX-8)/n;
    var barW=Math.min(28,groupW*0.35);
    function bx(i){return (padX+i*groupW+groupW/2-barW/2).toFixed(1);}
    function barH(v){return Math.max(2,((v/barMax)*(H-padYT-padYB))).toFixed(1);}
    function barY(v){return (H-padYB-parseFloat(barH(v))).toFixed(1);}
    function lx(i){return (padX+i*groupW+groupW/2).toFixed(1);}
    function ly(v){return (H-padYB-((v/lineMax)*(H-padYT-padYB))).toFixed(1);}
    // Bars
    var bPaths=allBar.map(function(v,i){
      return '<rect x="'+bx(i)+'" y="'+barY(v)+'" width="'+barW+'" height="'+barH(v)+'" fill="'+barSeries.color+'" rx="2"/>';
    }).join('');
    // Line
    var ld=allLine.map(function(v,i){return (i?'L':'M')+lx(i)+','+ly(v);}).join('');
    var ldots=allLine.map(function(v,i){return '<circle cx="'+lx(i)+'" cy="'+ly(v)+'" r="3" fill="#fff" stroke="'+lineSeries.color+'" stroke-width="2"/>';}).join('');
    // Grid
    var grid=[0.5,1].map(function(f){
      var yy=(H-padYB-f*(H-padYT-padYB)).toFixed(1);
      var vLeft=(barMax*f).toFixed(2);
      var vRight=(lineMax*f).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+vLeft+'</text>'
        +'<text x="'+(W-5)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="'+lineSeries.color+'">'+vRight+'%</text>';
    }).join('');
    // X labels
    var xL=groups.map(function(l,i){return '<text x="'+lx(i)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+'<path d="'+ld+'" fill="none" stroke="'+lineSeries.color+'" stroke-width="2" stroke-linejoin="round"/>'+ldots+xL+'</svg>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+barSeries.color+';display:inline-block"></span>'+barSeries.label+'</span>'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:'+lineSeries.color+';display:inline-block;border-radius:1px"></span>'+lineSeries.label+'</span>'
      +'</div>';
    return chartSvg+leg;
  }


  // Bar chart
  function bars(data,labels,colors,legendItems,showLabels){
    if(showLabels===undefined)showLabels=true;
    var W=420,H=220,padX=36,padY=20,n=data.length;
    var mx=Math.max.apply(null,data)||1,barW=Math.min(28,(W-padX-8)/n*0.30),gap=(W-padX-8)/n;
    function bx(i){return padX+i*gap+gap/2-barW/2;}
    function bh(v){return Math.max(2,(v/mx)*(H-padY*2));}
    var bPaths=data.map(function(v,i){
      var h=bh(v),x=bx(i).toFixed(1),y=(H-padY-h).toFixed(1);
      return '<rect x="'+x+'" y="'+y+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+(colors[i]||'#1565C0')+'" rx="2"/>'
        +(showLabels?'<text x="'+(parseFloat(x)+barW/2).toFixed(1)+'" y="'+(parseFloat(y)-4).toFixed(1)+'" text-anchor="middle" font-size="9" fill="#000" font-weight="600">'+v+'</text>':'');
    }).join('');
    var hZones=data.map(function(v,i){
      var tipStr=labels[i]+': '+v;
      return '<rect x="'+(padX+i*gap).toFixed(1)+'" y="'+padY+'" width="'+gap.toFixed(1)+'" height="'+(H-padY*2)+'" fill="transparent" data-tip="'+tipStr+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=(mx*f).toFixed(2);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#333">'+v+'</text>';
    }).join('');
    var xL=labels.map(function(l,i){return '<text x="'+(bx(i)+barW/2).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#000">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+xL+hZones+'</svg>';
    var leg=legendItems?'<div style="display:flex;gap:14px;justify-content:center;margin-top:6px;flex-wrap:wrap">'+legendItems.map(function(it){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#000"><span style="width:10px;height:10px;border-radius:2px;background:'+it.c+';display:inline-block"></span>'+it.l+'</span>';}).join('')+'</div>':'';
    return chartSvg+leg;
  }
  // Grouped bar chart
  function groupedBars(groups,series){
    var W=420,H=220,padX=36,padY=20,n=groups.length,ns=series.length;
    var allV=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var mx=Math.max.apply(null,allV)||1;
    var groupW=(W-padX-8)/n,barW=Math.min(16,groupW/ns*0.4);
    function bx(gi,si){return padX+gi*groupW+groupW/2-(ns*barW+(ns-1)*3)/2+si*(barW+3);}
    function bh(v){return Math.max(2,(v/mx)*(H-padY*2));}
    var bPaths=series.map(function(s,si){
      return s.v.map(function(v,gi){
        var h=bh(v),x=bx(gi,si).toFixed(1),y=(H-padY-h).toFixed(1);
        return '<rect x="'+x+'" y="'+y+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+s.color+'" rx="2"/>';
      }).join('');
    }).join('');
    var hZones=groups.map(function(g,gi){
      var vals=series.map(function(s){return s.label+': '+s.v[gi];}).join(' | ');
      var tipStr=g+' — '+vals;
      return '<rect x="'+(padX+gi*groupW).toFixed(1)+'" y="'+padY+'" width="'+groupW.toFixed(1)+'" height="'+(H-padY*2)+'" fill="transparent" data-tip="'+tipStr+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=(mx*f).toFixed(2);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#333">'+v+'</text>';
    }).join('');
    var xL=groups.map(function(l,i){var cx=padX+i*groupW+groupW/2;return '<text x="'+cx.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#000">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+xL+hZones+'</svg>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'+series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#000"><span style="width:10px;height:10px;border-radius:2px;background:'+s.color+';display:inline-block"></span>'+s.label+'</span>';}).join('')+'</div>';
    return chartSvg+leg;
  }
  // Stacked bar
  function stackedBars(series,labels){
    var W=420,H=220,padX=36,padY=20,n=labels.length;
    var totals=labels.map(function(_,i){return series.reduce(function(a,s){return a+s.v[i];},0);});
    var mx=Math.max.apply(null,totals)||1,barW=Math.min(28,(W-padX-8)/n*0.30),gap=(W-padX-8)/n;
    function bx(i){return (padX+i*gap+gap/2-barW/2).toFixed(1);}
    function bh(v){return Math.max(2,((v/mx)*(H-padY*2)));}
    var rects='';
    labels.forEach(function(_,i){var y=H-padY;series.forEach(function(s){var h=bh(s.v[i]);y-=h;rects+='<rect x="'+bx(i)+'" y="'+y.toFixed(1)+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+s.color+'" rx="1"/>';});});
    var hZones=labels.map(function(l,i){
      var vals=series.map(function(s){return s.label+': '+s.v[i];}).join(' | ');
      var tipStr=l+' — '+vals;
      return '<rect x="'+(padX+i*gap).toFixed(1)+'" y="'+padY+'" width="'+gap.toFixed(1)+'" height="'+(H-padY*2)+'" fill="transparent" data-tip="'+tipStr+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=(mx*f).toFixed(1);return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/><text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#333">'+v+'</text>';}).join('');
    var xL=labels.map(function(l,i){return '<text x="'+(parseFloat(bx(i))+barW/2).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#000">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+rects+xL+hZones+'</svg>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'+series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#000"><span style="width:10px;height:10px;border-radius:2px;background:'+s.color+';display:inline-block"></span>'+s.label+'</span>';}).join('')+'</div>';
    return chartSvg+leg;
  }
  // Line chart
  function line(series,labels){
    var W=420,H=220,padX=36,padY=18;
    var all=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var mn=Math.min.apply(null,all),mx=Math.max.apply(null,all),rng=mx-mn||0.001;
    var n=labels.length;
    function px(i){return padX+(i/(n-1))*(W-padX-8);}
    function py(v){return H-padY-((v-mn)/rng)*(H-padY*2);}
    var paths=series.map(function(s){
      var d=s.v.map(function(v,i){return (i?'L':'M')+px(i).toFixed(1)+','+py(v).toFixed(1);}).join('');
      var area=d+' L'+px(n-1).toFixed(1)+','+(H-padY)+' L'+px(0).toFixed(1)+','+(H-padY)+'Z';
      var dots=s.v.map(function(v,i){
        var tipStr=labels[i]+': '+v.toFixed(4);
        return '<circle cx="'+px(i).toFixed(1)+'" cy="'+py(v).toFixed(1)+'" r="3" fill="#fff" stroke="'+s.color+'" stroke-width="2" data-tip="'+tipStr+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
      }).join('');
      return '<defs><linearGradient id="lg'+s.id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+s.color+'" stop-opacity=".12"/><stop offset="1" stop-color="'+s.color+'" stop-opacity="0"/></linearGradient></defs>'
        +'<path d="'+area+'" fill="url(#lg'+s.id+')"/>'
        +'<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+dots;
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=mn+f*rng;var vStr=v>=100?v.toFixed(0):v>=1?v.toFixed(2):v.toFixed(4);return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/><text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#333">'+vStr+'</text>';}).join('');
    var xL=[0,Math.floor(n/2),n-1].map(function(i){return '<text x="'+px(i).toFixed(1)+'" y="'+(H-2)+'" text-anchor="middle" font-size="8.5" fill="#000">'+labels[i]+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+paths+xL+'</svg>';
    var leg=series.length>1?'<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'+series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#000"><span style="width:16px;height:2px;background:'+s.color+';display:inline-block;border-radius:1px"></span>'+(s.label||s.id)+'</span>';}).join('')+'</div>':'';
    return chartSvg+leg;
  }
  // Combo chart
  function comboChart(groups,barSeries,lineSeries){
    var W=420,H=220,padX=42,padYT=16,padYB=24;
    var allBar=barSeries.v,allLine=lineSeries.v;
    var barMax=Math.max.apply(null,allBar)||1,lineMax=Math.max.apply(null,allLine)||1;
    var n=groups.length,groupW=(W-padX-8)/n,barW=Math.min(28,groupW*0.35);
    function bx(i){return (padX+i*groupW+groupW/2-barW/2).toFixed(1);}
    function barH(v){return Math.max(2,((v/barMax)*(H-padYT-padYB))).toFixed(1);}
    function barY(v){return (H-padYB-parseFloat(barH(v))).toFixed(1);}
    function lx(i){return (padX+i*groupW+groupW/2).toFixed(1);}
    function ly(v){return (H-padYB-((v/lineMax)*(H-padYT-padYB))).toFixed(1);}
    var bPaths=allBar.map(function(v,i){return '<rect x="'+bx(i)+'" y="'+barY(v)+'" width="'+barW+'" height="'+barH(v)+'" fill="'+barSeries.color+'" rx="2"/>';}).join('');
    var ld=allLine.map(function(v,i){return (i?'L':'M')+lx(i)+','+ly(v);}).join('');
    var ldots=allLine.map(function(v,i){return '<circle cx="'+lx(i)+'" cy="'+ly(v)+'" r="3" fill="#fff" stroke="'+lineSeries.color+'" stroke-width="2"/>';}).join('');
    var hZones=groups.map(function(g,i){
      var tipStr=g+' — '+barSeries.label+': '+allBar[i]+' | '+lineSeries.label+': '+allLine[i]+'%';
      return '<rect x="'+(padX+i*groupW).toFixed(1)+'" y="'+padYT+'" width="'+groupW.toFixed(1)+'" height="'+(H-padYT-padYB)+'" fill="transparent" data-tip="'+tipStr+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){var yy=(H-padYB-f*(H-padYT-padYB)).toFixed(1);return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/><text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#333">'+(barMax*f).toFixed(2)+'</text><text x="'+(W-4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="'+lineSeries.color+'">'+(lineMax*f).toFixed(1)+'%</text>';}).join('');
    var xL=groups.map(function(l,i){return '<text x="'+lx(i)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#000">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+'<path d="'+ld+'" fill="none" stroke="'+lineSeries.color+'" stroke-width="2" stroke-linejoin="round"/>'+ldots+xL+hZones+'</svg>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px"><span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#000"><span style="width:10px;height:10px;border-radius:2px;background:'+barSeries.color+';display:inline-block"></span>'+barSeries.label+'</span><span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#000"><span style="width:16px;height:2px;background:'+lineSeries.color+';display:inline-block;border-radius:1px"></span>'+lineSeries.label+'</span></div>';
    return chartSvg+leg;
  }
  function donut(segs,label){
    var s=200,cx=s/2,cy=s/2,R=s*0.42,ir=s*0.30;
    var total=segs.reduce(function(a,x){return a+x.v;},0);
    var ang=-Math.PI/2,paths='';
    segs.forEach(function(sg){
      var sweep=(sg.v/total)*2*Math.PI,ea=ang+sweep;
      var x1=(cx+R*Math.cos(ang)).toFixed(2),y1=(cy+R*Math.sin(ang)).toFixed(2);
      var x2=(cx+R*Math.cos(ea)).toFixed(2),y2=(cy+R*Math.sin(ea)).toFixed(2);
      var x3=(cx+ir*Math.cos(ea)).toFixed(2),y3=(cy+ir*Math.sin(ea)).toFixed(2);
      var x4=(cx+ir*Math.cos(ang)).toFixed(2),y4=(cy+ir*Math.sin(ang)).toFixed(2);
      var la=sweep>Math.PI?1:0;
      var d='M'+x1+' '+y1+' A'+R+' '+R+' 0 '+la+' 1 '+x2+' '+y2+' L'+x3+' '+y3+' A'+ir+' '+ir+' 0 '+la+' 0 '+x4+' '+y4+'Z';
      paths+='<path d="'+d+'" fill="'+sg.color+'" stroke="none"/>';
      ang=ea;
    });
    var legend=segs.map(function(sg,i){
      var pct=(sg.v/total*100).toFixed(1);
      return '<div style="display:flex;align-items:center;gap:6px;font-size:.78rem;color:#374151">'
        +'<span style="width:8px;height:8px;border-radius:50%;background:'+sg.color+';flex-shrink:0;display:inline-block"></span>'
        +sg.label+' <span style="color:#9CA3AF">'+pct+'%</span></div>';
    }).join('');
    return '<div style="display:flex;align-items:center;justify-content:flex-start;gap:24px;flex:1;padding:8px 0">'
      +'<svg viewBox="0 0 '+s+' '+s+'" style="width:'+s+'px;height:'+s+'px;flex-shrink:0">'
      +paths
      +'<circle cx="'+cx+'" cy="'+cy+'" r="'+(ir-3)+'" fill="#fff"/>'
      +'<text x="'+cx+'" y="'+(cy-4)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="11" font-weight="700" fill="#0F172A">'+label+'</text>'
      +'<text x="'+cx+'" y="'+(cy+12)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="9" fill="#6B7280">total</text>'
      +'</svg>'
      +'<div style="display:flex;flex-direction:column;gap:7px">'+legend+'</div>'
      +'</div>';
  }

  // Line chart — full width + hover
  function line(series,labels){
    var W=420,H=220,padX=36,padY=18;
    var all=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var mn=Math.min.apply(null,all),mx=Math.max.apply(null,all),rng=mx-mn||0.001;
    var n=labels.length;
    function px(i){return padX+(i/(n-1))*(W-padX-8);}
    function py(v){return H-padY-((v-mn)/rng)*(H-padY*2);}
    var paths=series.map(function(s){
      var d=s.v.map(function(v,i){return (i?'L':'M')+px(i).toFixed(1)+','+py(v).toFixed(1);}).join('');
      var area=d+' L'+px(n-1).toFixed(1)+','+(H-padY)+' L'+px(0).toFixed(1)+','+(H-padY)+'Z';
      var dots=s.v.map(function(v,i){
        var tip=labels[i]+': '+v.toFixed(4);
        return '<circle cx="'+px(i).toFixed(1)+'" cy="'+py(v).toFixed(1)+'" r="3" fill="#fff" stroke="'+s.color+'" stroke-width="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
      }).join('');
      return '<defs><linearGradient id="lg'+s.id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+s.color+'" stop-opacity=".12"/><stop offset="1" stop-color="'+s.color+'" stop-opacity="0"/></linearGradient></defs>'
        +'<path d="'+area+'" fill="url(#lg'+s.id+')"/>'
        +'<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+dots;
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=mn+f*rng;
      var vStr=v>=100?v.toFixed(0):v>=1?v.toFixed(2):v.toFixed(4);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+vStr+'</text>';
    }).join('');
    var xL=[0,Math.floor(n/2),n-1].map(function(i){return '<text x="'+px(i).toFixed(1)+'" y="'+(H-2)+'" text-anchor="middle" font-size="8.5" fill="#9CA3AF">'+labels[i]+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+paths+xL+'</svg>';
    var leg=series.length>1?'<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'+series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:'+s.color+';display:inline-block;border-radius:1px"></span>'+(s.label||s.id)+'</span>';}).join('')+'</div>':'';
    return chartSvg+leg;
  }
  // Combo chart — bars (DPS) + line (Yield) + hover
  function comboChart(groups,barSeries,lineSeries){
    var W=420,H=220,padX=42,padYT=16,padYB=24;
    var allBar=barSeries.v,allLine=lineSeries.v;
    var barMax=Math.max.apply(null,allBar)||1,lineMax=Math.max.apply(null,allLine)||1;
    var n=groups.length,groupW=(W-padX-8)/n,barW=Math.min(28,groupW*0.35);
    function bx(i){return (padX+i*groupW+groupW/2-barW/2).toFixed(1);}
    function barH(v){return Math.max(2,((v/barMax)*(H-padYT-padYB))).toFixed(1);}
    function barY(v){return (H-padYB-parseFloat(barH(v))).toFixed(1);}
    function lx(i){return (padX+i*groupW+groupW/2).toFixed(1);}
    function ly(v){return (H-padYB-((v/lineMax)*(H-padYT-padYB))).toFixed(1);}
    var bPaths=allBar.map(function(v,i){
      var tip=groups[i]+' '+barSeries.label+': '+v;
      return '<rect x="'+bx(i)+'" y="'+barY(v)+'" width="'+barW+'" height="'+barH(v)+'" fill="'+barSeries.color+'" rx="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
    }).join('');
    var ld=allLine.map(function(v,i){return (i?'L':'M')+lx(i)+','+ly(v);}).join('');
    var ldots=allLine.map(function(v,i){
      var tip=groups[i]+' '+lineSeries.label+': '+v+'%';
      return '<circle cx="'+lx(i)+'" cy="'+ly(v)+'" r="3" fill="#fff" stroke="'+lineSeries.color+'" stroke-width="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padYB-f*(H-padYT-padYB)).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+(barMax*f).toFixed(2)+'</text>'
        +'<text x="'+(W-4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="'+lineSeries.color+'">'+(lineMax*f).toFixed(1)+'%</text>';
    }).join('');
    var xL=groups.map(function(l,i){return '<text x="'+lx(i)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+'<path d="'+ld+'" fill="none" stroke="'+lineSeries.color+'" stroke-width="2" stroke-linejoin="round"/>'+ldots+xL+'</svg>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+barSeries.color+';display:inline-block"></span>'+barSeries.label+'</span>'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:'+lineSeries.color+';display:inline-block;border-radius:1px"></span>'+lineSeries.label+'</span>'
      +'</div>';
    return chartSvg+leg;
  }
  function donut(segs,label,caption,valFmt,legendOverride){
    // Sort by value descending so the rank-based color gradient (dark blue
    // = largest slice, grey = smallest) is always applied consistently,
    // regardless of the order segments were passed in. Segments flagged
    // pinLast (e.g. "The rest of shareholder") are excluded from the sort
    // and always appended at the end, regardless of their value.
    var pinned=segs.filter(function(s){return s.pinLast;});
    var ranked=segs.filter(function(s){return !s.pinLast;});
    var sorted=ranked.slice().sort(function(a,b){return b.v-a.v;}).concat(pinned);
    var fmtV=valFmt||fmtChartNum;
    var s=270,cx=s/2,cy=s/2,R=s*0.42,ir=s*0.35;
    var total=sorted.reduce(function(a,x){return a+x.v;},0);
    var ang=-Math.PI/2,paths='';
    sorted.forEach(function(sg,idx){
      var col=pieGradientColor(idx,sorted.length);
      var sweep=(sg.v/total)*2*Math.PI,ea=ang+sweep;
      var x1=(cx+R*Math.cos(ang)).toFixed(2),y1=(cy+R*Math.sin(ang)).toFixed(2);
      var x2=(cx+R*Math.cos(ea)).toFixed(2),y2=(cy+R*Math.sin(ea)).toFixed(2);
      var x3=(cx+ir*Math.cos(ea)).toFixed(2),y3=(cy+ir*Math.sin(ea)).toFixed(2);
      var x4=(cx+ir*Math.cos(ang)).toFixed(2),y4=(cy+ir*Math.sin(ang)).toFixed(2);
      var la=sweep>Math.PI?1:0;
      var d='M'+x1+' '+y1+' A'+R+' '+R+' 0 '+la+' 1 '+x2+' '+y2+' L'+x3+' '+y3+' A'+ir+' '+ir+' 0 '+la+' 0 '+x4+' '+y4+'Z';
      var pct=(sg.v/total*100).toFixed(1);
      var tipStr=sg.label+': '+fmtV(sg.v)+' ('+pct+'%)';
      paths+='<path d="'+d+'" fill="'+col+'" stroke="none" data-tip="'+tipStr+'" onmouseenter="showPieTip(event,getTip(this))" onmousemove="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
      ang=ea;
    });
    // Legend defaults to the pie's own segments (rank color + % share), but
    // callers can pass an explicit legendOverride — e.g. Distribution
    // Summary shows the last 3 years' interim payout, independent of
    // whichever two figures make up the donut slices.
    var legend;
    if(legendOverride && legendOverride.length){
      legend=legendOverride.map(function(it){
        return '<div style="display:flex;align-items:center;gap:6px;font-size:.78rem;color:#374151">'
          +'<span style="width:8px;height:8px;border-radius:50%;background:'+it.color+';flex-shrink:0;display:inline-block"></span>'
          +it.label+' <span style="color:#9CA3AF">'+it.value+'</span></div>';
      }).join('');
    } else {
      legend=sorted.map(function(sg,idx){
        var col=pieGradientColor(idx,sorted.length);
        var pct=(sg.v/total*100).toFixed(1);
        return '<div style="display:flex;align-items:center;gap:6px;font-size:.78rem;color:#374151">'
          +'<span style="width:8px;height:8px;border-radius:50%;background:'+col+';flex-shrink:0;display:inline-block"></span>'
          +sg.label+' <span style="color:#9CA3AF">'+pct+'%</span></div>';
      }).join('');
    }
    return '<div style="display:flex;align-items:center;justify-content:flex-start;gap:20px;flex:1;padding:8px 0;min-height:0">'
      +'<svg viewBox="0 0 '+s+' '+s+'" style="width:'+s+'px;height:'+s+'px;max-width:90%;max-height:100%;flex-shrink:0">'
      +paths
      +'<circle cx="'+cx+'" cy="'+cy+'" r="'+(ir-3)+'" fill="#fff" style="pointer-events:none"/>'
      +'<text x="'+cx+'" y="'+(cy-6)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="19" font-weight="400" fill="#0F172A" style="pointer-events:none">'+label+'</text>'
      +'<text x="'+cx+'" y="'+(cy+16)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="13" fill="#6B7280" style="pointer-events:none">'+(caption||'total')+'</text>'
      +'</svg>'
      +'<div style="display:flex;flex-direction:column;gap:7px;min-width:0">'+legend+'</div>'
      +'</div>';
  }

  // Line chart — full width + hover
  function line(series,labels){
    var W=420,H=220,padX=36,padY=18;
    var all=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var mn=Math.min.apply(null,all),mx=Math.max.apply(null,all),rng=mx-mn||0.001;
    var n=labels.length;
    function px(i){return padX+(i/(n-1))*(W-padX-8);}
    function py(v){return H-padY-((v-mn)/rng)*(H-padY*2);}
    var paths=series.map(function(s){
      var d=s.v.map(function(v,i){return (i?'L':'M')+px(i).toFixed(1)+','+py(v).toFixed(1);}).join('');
      var area=d+' L'+px(n-1).toFixed(1)+','+(H-padY)+' L'+px(0).toFixed(1)+','+(H-padY)+'Z';
      var dots=s.v.map(function(v,i){
        var tip=labels[i]+': '+v.toFixed(4);
        return '<circle cx="'+px(i).toFixed(1)+'" cy="'+py(v).toFixed(1)+'" r="3" fill="#fff" stroke="'+s.color+'" stroke-width="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
      }).join('');
      return '<defs><linearGradient id="lg'+s.id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+s.color+'" stop-opacity=".12"/><stop offset="1" stop-color="'+s.color+'" stop-opacity="0"/></linearGradient></defs>'
        +'<path d="'+area+'" fill="url(#lg'+s.id+')"/>'
        +'<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+dots;
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=mn+f*rng;
      var vStr=v>=100?v.toFixed(0):v>=1?v.toFixed(2):v.toFixed(4);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+vStr+'</text>';
    }).join('');
    var xL=[0,Math.floor(n/2),n-1].map(function(i){return '<text x="'+px(i).toFixed(1)+'" y="'+(H-2)+'" text-anchor="middle" font-size="8.5" fill="#9CA3AF">'+labels[i]+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+paths+xL+'</svg>';
    var leg=series.length>1?'<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'+series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:'+s.color+';display:inline-block;border-radius:1px"></span>'+(s.label||s.id)+'</span>';}).join('')+'</div>':'';
    return chartSvg+leg;
  }
  // Combo chart — bars (DPS) + line (Yield)
  function comboChart(groups,barSeries,lineSeries){
    var W=420,H=220,padX=42,padYT=16,padYB=24;
    var allBar=barSeries.v, allLine=lineSeries.v;
    var barMax=Math.max.apply(null,allBar)||1;
    var lineMax=Math.max.apply(null,allLine)||1;
    var n=groups.length;
    var groupW=(W-padX-8)/n;
    var barW=Math.min(28,groupW*0.35);
    function bx(i){return (padX+i*groupW+groupW/2-barW/2).toFixed(1);}
    function barH(v){return Math.max(2,((v/barMax)*(H-padYT-padYB))).toFixed(1);}
    function barY(v){return (H-padYB-parseFloat(barH(v))).toFixed(1);}
    function lx(i){return (padX+i*groupW+groupW/2).toFixed(1);}
    function ly(v){return (H-padYB-((v/lineMax)*(H-padYT-padYB))).toFixed(1);}
    // Bars
    var bPaths=allBar.map(function(v,i){
      return '<rect x="'+bx(i)+'" y="'+barY(v)+'" width="'+barW+'" height="'+barH(v)+'" fill="'+barSeries.color+'" rx="2"/>';
    }).join('');
    // Line
    var ld=allLine.map(function(v,i){return (i?'L':'M')+lx(i)+','+ly(v);}).join('');
    var ldots=allLine.map(function(v,i){return '<circle cx="'+lx(i)+'" cy="'+ly(v)+'" r="3" fill="#fff" stroke="'+lineSeries.color+'" stroke-width="2"/>';}).join('');
    // Grid
    var grid=[0.5,1].map(function(f){
      var yy=(H-padYB-f*(H-padYT-padYB)).toFixed(1);
      var vLeft=(barMax*f).toFixed(2);
      var vRight=(lineMax*f).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+vLeft+'</text>'
        +'<text x="'+(W-5)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="'+lineSeries.color+'">'+vRight+'%</text>';
    }).join('');
    // X labels
    var xL=groups.map(function(l,i){return '<text x="'+lx(i)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+'<path d="'+ld+'" fill="none" stroke="'+lineSeries.color+'" stroke-width="2" stroke-linejoin="round"/>'+ldots+xL+'</svg>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+barSeries.color+';display:inline-block"></span>'+barSeries.label+'</span>'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:'+lineSeries.color+';display:inline-block;border-radius:1px"></span>'+lineSeries.label+'</span>'
      +'</div>';
    return chartSvg+leg;
  }


  // Bar chart — full width + bottom legend + hover
  function bars(data,labels,colors,legendItems,showLabels){
    if(showLabels===undefined) showLabels=true;
    var W=420,H=220,padX=36,padY=20,n=data.length;
    var mx=Math.max.apply(null,data)||1,barW=Math.min(28,(W-padX-8)/n*0.30),gap=(W-padX-8)/n;
    function bx(i){return padX+i*gap+gap/2-barW/2;}
    function bh(v){return Math.max(2,(v/mx)*(H-padY*2));}
    var bPaths=data.map(function(v,i){
      var h=bh(v),x=bx(i).toFixed(1),y=(H-padY-h).toFixed(1);
      var tip=labels[i]+': '+v;
      return '<rect x="'+x+'" y="'+y+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+(colors[i]||'#1565C0')+'" rx="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>'
        +(showLabels?'<text x="'+(parseFloat(x)+barW/2).toFixed(1)+'" y="'+(parseFloat(y)-4).toFixed(1)+'" text-anchor="middle" font-size="9" fill="#374151" font-weight="600">'+v+'</text>':'');
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=(mx*f).toFixed(2);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+v+'</text>';
    }).join('');
    var xL=labels.map(function(l,i){return '<text x="'+(bx(i)+barW/2).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+xL+'</svg>';
    var leg=legendItems?'<div style="display:flex;gap:14px;justify-content:center;margin-top:6px;flex-wrap:wrap">'
      +legendItems.map(function(it){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+it.c+';display:inline-block"></span>'+it.l+'</span>';}).join('')+'</div>':'';
    return chartSvg+leg;
  }
  // Grouped bar chart — full width + bottom legend + hover
  function groupedBars(groups,series){
    var W=420,H=220,padX=36,padY=20,n=groups.length,ns=series.length;
    var allV=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var mx=Math.max.apply(null,allV)||1;
    var groupW=(W-padX-8)/n,barW=Math.min(16,groupW/ns*0.4);
    function bx(gi,si){return padX+gi*groupW+groupW/2-(ns*barW+(ns-1)*3)/2+si*(barW+3);}
    function bh(v){return Math.max(2,(v/mx)*(H-padY*2));}
    var bPaths=series.map(function(s,si){
      return s.v.map(function(v,gi){
        var h=bh(v),x=bx(gi,si).toFixed(1),y=(H-padY-h).toFixed(1);
        var tip=groups[gi]+' '+s.label+': '+v;
        return '<rect x="'+x+'" y="'+y+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+s.color+'" rx="2" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
      }).join('');
    }).join('');
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=(mx*f).toFixed(2);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+v+'</text>';
    }).join('');
    var xL=groups.map(function(l,i){
      var cx=padX+i*groupW+groupW/2;
      return '<text x="'+cx.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';
    }).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+xL+'</svg>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'
      +series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+s.color+';display:inline-block"></span>'+s.label+'</span>';}).join('')+'</div>';
    return chartSvg+leg;
  }
  // Stacked bar — full width + legend + hover
  function stackedBars(series,labels){
    var W=420,H=220,padX=36,padY=20,n=labels.length;
    var totals=labels.map(function(_,i){return series.reduce(function(a,s){return a+s.v[i];},0);});
    var mx=Math.max.apply(null,totals)||1,barW=Math.min(28,(W-padX-8)/n*0.30),gap=(W-padX-8)/n;
    function bx(i){return (padX+i*gap+gap/2-barW/2).toFixed(1);}
    function bh(v){return Math.max(2,((v/mx)*(H-padY*2)));}
    var rects='';
    labels.forEach(function(_,i){
      var y=H-padY;
      series.forEach(function(s){
        var h=bh(s.v[i]);
        y-=h;
        var tip=labels[i]+' '+s.label+': '+s.v[i];
        rects+='<rect x="'+bx(i)+'" y="'+y.toFixed(1)+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+s.color+'" rx="1" data-tip="'+tip+'" onmouseenter="showPieTip(event,getTip(this))" onmouseout="hidePieTip()" style="cursor:pointer"/>';
      });
    });
    var grid=[0.2,0.4,0.6,0.8,1.0].map(function(f){
      var yy=(H-padY-f*(H-padY*2)).toFixed(1),v=(mx*f).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-8)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(padX-3)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="end" font-size="8" fill="#9CA3AF">'+v+'</text>';
    }).join('');
    var xL=labels.map(function(l,i){return '<text x="'+(parseFloat(bx(i))+barW/2).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';}).join('');
    var chartSvg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+rects+xL+'</svg>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'
      +series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+s.color+';display:inline-block"></span>'+s.label+'</span>';}).join('')+'</div>';
    return chartSvg+leg;
  }
  // Line chart — full width
  function line(series,labels){
    var W=420,H=220,padX=16,padR=42,padY=18;
    var tipId=nextTipId();
    var all=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var rawMn=Math.min.apply(null,all),rawMx=Math.max.apply(null,all);
    var scale=niceAxisScale(rawMn,rawMx,5);
    var mn=scale.min,mx=scale.max,rng=(mx-mn)||0.001;
    var n=labels.length;
    function px(i){return padX+(i/(n-1))*(W-padX-padR);}
    function py(v){return H-padY-((v-mn)/rng)*(H-padY*2);}
    var paths=series.map(function(s){
      var d=s.v.map(function(v,i){return (i?'L':'M')+px(i).toFixed(1)+','+py(v).toFixed(1);}).join('');
      var area=d+' L'+px(n-1).toFixed(1)+','+(H-padY)+' L'+px(0).toFixed(1)+','+(H-padY)+'Z';
      var dots=s.v.map(function(v,i){
        return i===s.v.length-1?'<circle cx="'+px(i).toFixed(1)+'" cy="'+py(v).toFixed(1)+'" r="3" fill="#fff" stroke="'+s.color+'" stroke-width="2"/>':'';
      }).join('');
      return '<defs><linearGradient id="lg'+s.id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+s.color+'" stop-opacity=".12"/><stop offset="1" stop-color="'+s.color+'" stop-opacity="0"/></linearGradient></defs>'
        +'<path d="'+area+'" fill="url(#lg'+s.id+')"/>'
        +'<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+dots;
    }).join('');
    var ticks=[];
    for(var tv=mn; tv<=mx+scale.step*0.001; tv+=scale.step){ ticks.push(tv); }
    var grid=ticks.map(function(v){
      var yy=(H-padY-((v-mn)/rng)*(H-padY*2)).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(W-padR+4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="#9CA3AF">'+fmtChartNum(v)+'</text>';
    }).join('');
    var xL=[0,Math.floor(n/2),n-1].map(function(i){
      return '<text x="'+px(i).toFixed(1)+'" y="'+(H-1)+'" text-anchor="middle" font-size="8.5" fill="#9CA3AF">'+labels[i]+'</text>';
    }).join('');
    // Group hover overlay per x-position — shows every series' value at that point
    var segW=(W-padX-padR)/Math.max(1,n-1);
    var overlays=labels.map(function(l,i){
      if(!l) return '';
      var tipLines=series.map(function(s){ return s.color+'::'+(s.label||s.id)+': '+fmtTipNum(s.v[i]); });
      var tip='FY:'+l+'|'+tipLines.join('|');
      var ox=Math.max(0,px(i)-segW/2).toFixed(1);
      var cx=(px(i)/W).toFixed(4);
      return '<rect x="'+ox+'" y="0" width="'+segW.toFixed(1)+'" height="'+H+'" fill="transparent" data-cx="'+cx+'" data-tip="'+tip+'" onmouseenter="frTip(event,getTip(this),this.getAttribute(\'data-cx\'),\''+tipId+'\')" onmouseleave="frHide(\''+tipId+'\')" style="cursor:crosshair;touch-action:pan-y"/>';
    }).join('');
    var chartSvg='<div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+paths+xL+overlays+'</svg>'
      +'<div id="'+tipId+'" style="display:none;position:absolute;background:#fff;color:#0F172A;font-size:.74rem;font-weight:600;padding:8px 12px;border-radius:8px;pointer-events:none;z-index:10;top:4px;left:0;border:1px solid #E2E8F0;box-shadow:0 6px 20px rgba(0,0,0,.13)"></div></div>';
    // Legend at bottom if multiple series
    var leg=series.length>1?'<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'
      +series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:3px;background:'+s.color+';display:inline-block;border-radius:2px"></span>'+(s.label||s.id)+'</span>';}).join('')
      +'</div>':'';
    return chartSvg+leg;
  }

  // Candlestick chart — monthly OHLC (used by NTA Performance)
  function candlestick(months){
    var W=420,H=220,padX=16,padR=42,padYT=14,padYB=24;
    var infoId=nextTipId();
    var n=months.length;
    var allV=[];
    months.forEach(function(m){ allV.push(m.high,m.low); });
    var scale=tightTicks(Math.min.apply(null,allV),Math.max.apply(null,allV));
    var mn=scale.min,mx=scale.max,rng=(mx-mn)||0.001;
    var plotH=H-padYT-padYB;
    function yFor(v){ return padYT+(mx-v)/rng*plotH; }
    var colW=(W-padX-padR)/n;
    var bodyW=Math.min(10,colW*0.45);
    function cx(i){ return padX+i*colW+colW/2; }
    var candles=months.map(function(m,i){
      var up=m.close>=m.open;
      var col=up?'#2E7D32':'#DC2626';
      var x=cx(i);
      var wickTop=yFor(m.high).toFixed(1), wickBot=yFor(m.low).toFixed(1);
      var bodyTop=yFor(Math.max(m.open,m.close)).toFixed(1);
      var bodyH=Math.max(1,Math.abs(yFor(m.open)-yFor(m.close)));
      return '<line x1="'+x.toFixed(1)+'" y1="'+wickTop+'" x2="'+x.toFixed(1)+'" y2="'+wickBot+'" stroke="'+col+'" stroke-width="1"/>'
        +'<rect x="'+(x-bodyW/2).toFixed(1)+'" y="'+bodyTop+'" width="'+bodyW.toFixed(1)+'" height="'+bodyH.toFixed(1)+'" fill="'+col+'" rx="1"/>';
    }).join('');
    var ticks=scale.ticks;
    var grid=ticks.map(function(v){
      var yy=yFor(v).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(W-padR+4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="#9CA3AF">'+fmtChartNum(v)+'</text>';
    }).join('');
    var lblEvery=Math.max(1,Math.ceil(n/6));
    var xL=months.map(function(m,i){
      if(i%lblEvery!==0 && i!==n-1) return '';
      return '<text x="'+cx(i).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="8" fill="#6B7280">'+m.label+'</text>';
    }).join('');
    // Build the "mmm yy  O: .. H: .. L: .. C: .. (Change)" info string for
    // a given month, changed against the previous month's close (falls
    // back to open->close for the first bar, which has no prior month).
    function infoStr(m,prev){
      var base=prev?prev.close:m.open;
      var chg=m.close-base;
      var chgPct=base?(chg/base*100):0;
      var up=chg>=0;
      var sign=up?'+':'−';
      return m.label+'|'+fmtTipNum(m.open)+'|'+fmtTipNum(m.high)+'|'+fmtTipNum(m.low)+'|'+fmtTipNum(m.close)+'|'+sign+fmtChartNum(Math.abs(chg))+'|'+sign+Math.abs(chgPct).toFixed(2)+'%|'+(up?1:0);
    }
    var defaultTip=n?infoStr(months[n-1],n>1?months[n-2]:null):'';
    var overlays=months.map(function(m,i){
      var prev=i>0?months[i-1]:null;
      var tip=infoStr(m,prev);
      var ox=(padX+i*colW).toFixed(1);
      return '<rect x="'+ox+'" y="0" width="'+colW.toFixed(1)+'" height="'+H+'" fill="transparent" data-tip="'+tip+'" onmouseenter="candleInfo(getTip(this),\''+infoId+'\')" onmousemove="candleInfo(getTip(this),\''+infoId+'\')" onmouseleave="candleInfo(\''+defaultTip+'\',\''+infoId+'\')" style="cursor:crosshair;touch-action:pan-y"/>';
    }).join('');
    var infoLine='<div id="'+infoId+'" style="font-size:.82rem;color:#374151;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #F1F5F9;min-height:20px;display:flex;align-items:center;flex-wrap:wrap">'+candleInfoHtml(defaultTip)+'</div>';
    var chartSvg='<div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+candles+xL+overlays+'</svg></div>';
    return infoLine+chartSvg;
  }

  // Combo chart — bars (DPS) + line (Yield)
  function comboChart(groups,barSeries,lineSeries){
    var W=420,H=220,padX=42,padR=42,padYT=16,padYB=24;
    var tipId=nextTipId();
    var allBar=barSeries.v, allLine=lineSeries.v;
    var barScale=niceAxisScale(0,Math.max.apply(null,allBar)||1,5);
    var barMax=barScale.max||1;
    var lineMax=Math.max.apply(null,allLine)||1;
    var n=groups.length;
    var groupW=(W-padX-padR)/n;
    var barW=Math.min(20,groupW*0.22);
    function bx(i){return (padX+i*groupW+groupW/2-barW/2).toFixed(1);}
    function barH(v){return Math.max(2,((v/barMax)*(H-padYT-padYB))).toFixed(1);}
    function barY(v){return (H-padYB-parseFloat(barH(v))).toFixed(1);}
    function lx(i){return (padX+i*groupW+groupW/2).toFixed(1);}
    function ly(v){return (H-padYB-((v/lineMax)*(H-padYT-padYB))).toFixed(1);}
    // Bars (left axis) — the fund's own value series
    var bPaths=allBar.map(function(v,i){
      return '<rect x="'+bx(i)+'" y="'+barY(v)+'" width="'+barW+'" height="'+barH(v)+'" fill="'+barSeries.color+'" rx="2"/>';
    }).join('');
    // Line (right axis) — a percentage series
    var ld=allLine.map(function(v,i){return (i?'L':'M')+lx(i)+','+ly(v);}).join('');
    var ldots=allLine.map(function(v,i){return '<circle cx="'+lx(i)+'" cy="'+ly(v)+'" r="3" fill="#fff" stroke="'+lineSeries.color+'" stroke-width="2"/>';}).join('');
    // Grid — bar values on the inner right edge, line % just outside it
    var grid=[0.2,0.4,0.6,0.8,1].map(function(f){
      var yy=(H-padYB-f*(H-padYT-padYB)).toFixed(1);
      var vLeft=fmtChartNum(barMax*f);
      var vRight=fmtChartPct(lineMax*f);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(W-padR+4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="'+barSeries.color+'">'+vLeft+'</text>'
        +'<text x="'+(W-4)+'" y="'+(parseFloat(yy)-6)+'" text-anchor="end" font-size="7.5" fill="'+lineSeries.color+'">'+vRight+'</text>';
    }).join('');
    // X labels
    var xL=groups.map(function(l,i){return '<text x="'+lx(i)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';}).join('');
    // Group hover overlay per FY — shows both the bar and line values together
    var overlays=groups.map(function(g,gi){
      var tip='FY:'+g+'|'+barSeries.color+'::'+barSeries.label+': '+fmtTipNum(allBar[gi])+'|'+lineSeries.color+'::'+lineSeries.label+': '+fmtTipPct(allLine[gi]);
      var ox=(padX+gi*groupW).toFixed(1);
      var cx=((padX+gi*groupW+groupW/2)/W).toFixed(4);
      return '<rect x="'+ox+'" y="0" width="'+groupW.toFixed(1)+'" height="'+H+'" fill="transparent" data-cx="'+cx+'" data-tip="'+tip+'" onmouseenter="frTip(event,getTip(this),this.getAttribute(\'data-cx\'),\''+tipId+'\')" onmouseleave="frHide(\''+tipId+'\')" style="cursor:crosshair;touch-action:pan-y"/>';
    }).join('');
    var chartSvg='<div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+'<path d="'+ld+'" fill="none" stroke="'+lineSeries.color+'" stroke-width="2" stroke-linejoin="round"/>'+ldots+xL+overlays+'</svg>'
      +'<div id="'+tipId+'" style="display:none;position:absolute;background:#fff;color:#0F172A;font-size:.74rem;font-weight:600;padding:8px 12px;border-radius:8px;pointer-events:none;z-index:10;top:4px;left:0;border:1px solid #E2E8F0;box-shadow:0 6px 20px rgba(0,0,0,.13)"></div></div>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px">'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+barSeries.color+';display:inline-block"></span>'+barSeries.label+'</span>'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:'+lineSeries.color+';display:inline-block;border-radius:1px"></span>'+lineSeries.label+'</span>'
      +'</div>';
    return chartSvg+leg;
  }


  // Bar chart — full width + bottom legend + hover
  function bars(data,labels,colors,legendItems,showLabels,isPct){
    if(showLabels===undefined) showLabels=true;
    var fmtV=isPct?fmtChartPct:fmtChartNum;
    var fmtVTip=isPct?fmtTipPct:fmtTipNum;
    var W=420,H=220,padX=16,padR=42,padY=20,n=data.length;
    var tipId=nextTipId();
    var rawMx=Math.max.apply(null,data)||1;
    var scale=fiveTicks(0,rawMx);
    var mx=scale.max||1,barW=Math.min(22,(W-padX-padR)/n*0.20),gap=(W-padX-padR)/n;
    function bx(i){return padX+i*gap+gap/2-barW/2;}
    function bh(v){return Math.max(2,(v/mx)*(H-padY*2));}
    var bPaths=data.map(function(v,i){
      var h=bh(v),x=bx(i).toFixed(1),y=(H-padY-h).toFixed(1);
      return '<rect x="'+x+'" y="'+y+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+(colors[i]||'#1565C0')+'" rx="2"/>'
        +(showLabels?'<text x="'+(parseFloat(x)+barW/2).toFixed(1)+'" y="'+(parseFloat(y)-4).toFixed(1)+'" text-anchor="middle" font-size="9" fill="#374151" font-weight="400">'+fmtV(v)+'</text>':'');
    }).join('');
    var grid=scale.ticks.map(function(v){
      var yy=(H-padY-(v/mx)*(H-padY*2)).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(W-padR+4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="#9CA3AF">'+fmtV(v)+'</text>';
    }).join('');
    var xL=labels.map(function(l,i){return '<text x="'+(bx(i)+barW/2).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';}).join('');
    // Group hover overlay per label
    var overlays=labels.map(function(l,i){
      var tip='FY:'+l+'|'+(colors[i]||'#1565C0')+'::Value: '+fmtVTip(data[i]);
      var ox=(padX+i*gap).toFixed(1);
      var cx=((padX+i*gap+gap/2)/W).toFixed(4);
      return '<rect x="'+ox+'" y="0" width="'+gap.toFixed(1)+'" height="'+H+'" fill="transparent" data-cx="'+cx+'" data-tip="'+tip+'" onmouseenter="frTip(event,getTip(this),this.getAttribute(\'data-cx\'),\''+tipId+'\')" onmouseleave="frHide(\''+tipId+'\')" style="cursor:crosshair;touch-action:pan-y"/>';
    }).join('');
    var chartSvg='<div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+bPaths+xL+overlays+'</svg>'
      +'<div id="'+tipId+'" style="display:none;position:absolute;background:#fff;color:#0F172A;font-size:.74rem;font-weight:400;padding:8px 12px;border-radius:8px;pointer-events:none;z-index:10;top:4px;left:0;border:1px solid #E2E8F0;box-shadow:0 6px 20px rgba(0,0,0,.13)"></div></div>';
    var leg=legendItems?'<div style="display:flex;gap:14px;justify-content:center;margin-top:6px;flex-wrap:wrap">'
      +legendItems.map(function(it){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+it.c+';display:inline-block"></span>'+it.l+'</span>';}).join('')+'</div>':'';
    return chartSvg+leg;
  }
  // Grouped bar chart — full width + bottom legend + hover
  function groupedBars(groups,series){
    var W=420,H=220,padX=16,padR=42,padYT=14,padYB=24,n=groups.length,ns=series.length;
    var tipId=nextTipId();
    var allV=series.reduce(function(a,s){return a.concat(s.v);},[]);
    var rawMx=Math.max.apply(null,allV.concat([0]));
    var rawMn=Math.min.apply(null,allV.concat([0]));
    var scale=fiveTicks(rawMn,rawMx);
    var mx=scale.max, mn=scale.min;
    if(mx===mn){ mx+=1; mn-=1; }
    var rng=mx-mn;
    var plotH=H-padYT-padYB;
    function yFor(v){ return padYT+(mx-v)/rng*plotH; }
    var zeroY=yFor(0);
    var groupW=(W-padX-padR)/n,barW=Math.min(12,groupW/ns*0.28);
    function bx(gi,si){return padX+gi*groupW+groupW/2-(ns*barW+(ns-1)*3)/2+si*(barW+3);}
    var bPaths=series.map(function(s,si){
      return s.v.map(function(v,gi){
        var yTop=yFor(Math.max(0,v)), yBot=yFor(Math.min(0,v));
        var h=Math.max(0.5,yBot-yTop);
        var x=bx(gi,si).toFixed(1);
        var col=s.colorByValue?(v<0?'#DC2626':'#2E7D32'):s.color;
        return '<rect x="'+x+'" y="'+yTop.toFixed(1)+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+col+'" rx="2"/>';
      }).join('');
    }).join('');
    var grid=scale.ticks.map(function(v){
      var yy=yFor(v).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(W-padR+4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="#9CA3AF">'+fmtChartNum(v)+'</text>';
    }).join('');
    var zeroLine=(mn<0&&mx>0)?('<line x1="'+padX+'" y1="'+zeroY.toFixed(1)+'" x2="'+(W-padR)+'" y2="'+zeroY.toFixed(1)+'" stroke="#CBD5E1" stroke-width="1.2"/>'):'';
    var xL=groups.map(function(l,i){
      var cx=padX+i*groupW+groupW/2;
      return '<text x="'+cx.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';
    }).join('');
    // Group hover overlay per FY — shows all series values together
    var overlays=groups.map(function(g,gi){
      var tipLines=series.map(function(s){ var dotCol=s.colorByValue?(s.v[gi]<0?'#DC2626':'#2E7D32'):s.color; return dotCol+'::'+s.label+': '+fmtTipPlain(s.v[gi]); });
      var tip='FY:'+g+'|'+tipLines.join('|');
      var ox=(padX+gi*groupW).toFixed(1);
      var cx=((padX+gi*groupW+groupW/2)/W).toFixed(4);
      return '<rect x="'+ox+'" y="0" width="'+groupW.toFixed(1)+'" height="'+H+'" fill="transparent" data-cx="'+cx+'" data-tip="'+tip+'" onmouseenter="frTip(event,getTip(this),this.getAttribute(\'data-cx\'),\''+tipId+'\')" onmouseleave="frHide(\''+tipId+'\')" style="cursor:crosshair;touch-action:pan-y"/>';
    }).join('');
    var chartSvg='<div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+zeroLine+bPaths+xL+overlays+'</svg>'
      +'<div id="'+tipId+'" style="display:none;position:absolute;background:#fff;color:#0F172A;font-size:.74rem;font-weight:400;padding:8px 12px;border-radius:8px;pointer-events:none;z-index:10;top:4px;left:0;border:1px solid #E2E8F0;box-shadow:0 6px 20px rgba(0,0,0,.13)"></div></div>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px;flex-wrap:wrap">'
      +series.map(function(s){var sw=s.colorByValue?'linear-gradient(90deg,#2E7D32 50%,#DC2626 50%)':s.color;return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+sw+';display:inline-block"></span>'+s.label+'</span>';}).join('')+'</div>';
    return chartSvg+leg;
  }
  // Stacked bar — full width + legend
  function stackedBars(series,labels){
    var W=420,H=220,padX=16,padR=42,padY=20,n=labels.length;
    var tipId=nextTipId();
    var totals=labels.map(function(_,i){return series.reduce(function(a,s){return a+s.v[i];},0);});
    var rawMx=Math.max.apply(null,totals)||1;
    var scalePre=fiveTicks(0,rawMx);
    var mx=scalePre.max||1,barW=Math.min(22,(W-padX-padR)/n*0.20),gap=(W-padX-padR)/n;
    function bx(i){return (padX+i*gap+gap/2-barW/2).toFixed(1);}
    function bh(v){return Math.max(2,((v/mx)*(H-padY*2)));}
    var rects='';
    labels.forEach(function(_,i){
      var y=H-padY;
      series.forEach(function(s){
        var h=bh(s.v[i]);
        y-=h;
        rects+='<rect x="'+bx(i)+'" y="'+y.toFixed(1)+'" width="'+barW+'" height="'+h.toFixed(1)+'" fill="'+s.color+'" rx="1"/>';
      });
    });
    var grid=scalePre.ticks.map(function(v){
      var yy=(H-padY-(v/scalePre.max)*(H-padY*2)).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(W-padR+4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="#9CA3AF">'+fmtChartNum(v)+'</text>';
    }).join('');
    var xL=labels.map(function(l,i){
      return '<text x="'+(parseFloat(bx(i))+barW/2).toFixed(1)+'" y="'+(H-2)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';
    }).join('');
    // Group hover overlay per label — shows all series values together
    var overlays=labels.map(function(l,i){
      var tipLines=series.map(function(s){ return s.color+'::'+s.label+': '+fmtTipPlain(s.v[i]); });
      var tip='FY:'+l+'|'+tipLines.join('|');
      var ox=(padX+i*gap).toFixed(1);
      var cx=((padX+i*gap+gap/2)/W).toFixed(4);
      return '<rect x="'+ox+'" y="0" width="'+gap.toFixed(1)+'" height="'+H+'" fill="transparent" data-cx="'+cx+'" data-tip="'+tip+'" onmouseenter="frTip(event,getTip(this),this.getAttribute(\'data-cx\'),\''+tipId+'\')" onmouseleave="frHide(\''+tipId+'\')" style="cursor:crosshair;touch-action:pan-y"/>';
    }).join('');
    var chartSvg='<div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+rects+xL+overlays+'</svg>'
      +'<div id="'+tipId+'" style="display:none;position:absolute;background:#fff;color:#0F172A;font-size:.74rem;font-weight:400;padding:8px 12px;border-radius:8px;pointer-events:none;z-index:10;top:4px;left:0;border:1px solid #E2E8F0;box-shadow:0 6px 20px rgba(0,0,0,.13)"></div></div>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px;flex-wrap:wrap">'
      +series.map(function(s){return '<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:'+s.color+';display:inline-block"></span>'+s.label+'</span>';}).join('')
      +'</div>';
    return chartSvg+leg;
  }
  // Distribution History — Interim + Final DPS stacked bars (left axis,
  // gridlines) with a Dividend Yield trend line drawn on its own internal
  // scale and NO visible axis/gridlines/labels — exact yield values are
  // only shown via hover, keeping the two very different scales from
  // fighting for the same axis.
  function stackedBarsWithLine(labels,interimArr,finalArr,totalArr,yieldArr){
    var W=420,H=220,padX=16,padR=42,padYT=14,padYB=24,n=labels.length;
    var tipId=nextTipId();
    var rawMx=Math.max.apply(null,totalArr)||1;
    var scale=fiveTicks(0,rawMx);
    var mx=scale.max||1,barW=Math.min(22,(W-padX-padR)/n*0.20),gap=(W-padX-padR)/n;
    function bx(i){return (padX+i*gap+gap/2-barW/2).toFixed(1);}
    function bh(v){return Math.max(0,((v/mx)*(H-padYT-padYB)));}
    var rects='';
    labels.forEach(function(_,i){
      var y=H-padYB;
      var ih=bh(interimArr[i]||0), fh=bh(finalArr[i]||0);
      y-=ih; rects+='<rect x="'+bx(i)+'" y="'+y.toFixed(1)+'" width="'+barW+'" height="'+ih.toFixed(1)+'" fill="#0D47A1" rx="1"/>';
      y-=fh; rects+='<rect x="'+bx(i)+'" y="'+y.toFixed(1)+'" width="'+barW+'" height="'+fh.toFixed(1)+'" fill="#64B5F6" rx="1"/>';
    });
    var grid=scale.ticks.map(function(v){
      var yy=(H-padYB-(v/mx)*(H-padYT-padYB)).toFixed(1);
      return '<line x1="'+padX+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="#F3F4F6" stroke-width="1"/>'
        +'<text x="'+(W-padR+4)+'" y="'+(parseFloat(yy)+3)+'" text-anchor="start" font-size="8" fill="#9CA3AF">'+fmtChartNum(v)+'</text>';
    }).join('');
    function lx(i){ return padX+i*gap+gap/2; }
    var yMax=Math.max.apply(null,yieldArr.concat([0.0001]))*1.2;
    function ly(v){ return H-padYB-((v/yMax)*(H-padYT-padYB)); }
    var ld=yieldArr.map(function(v,i){return (i?'L':'M')+lx(i).toFixed(1)+','+ly(v).toFixed(1);}).join('');
    var ldots=yieldArr.map(function(v,i){return '<circle cx="'+lx(i).toFixed(1)+'" cy="'+ly(v).toFixed(1)+'" r="3" fill="#fff" stroke="#F59E0B" stroke-width="2"/>';}).join('');
    var xL=labels.map(function(l,i){return '<text x="'+(parseFloat(bx(i))+barW/2).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" font-size="9" fill="#6B7280">'+l+'</text>';}).join('');
    // Group hover overlay per FY — shows Interim/Final/Total DPS + Yield together
    var overlays=labels.map(function(l,i){
      var tipLines=[
        '#0D47A1::Interim DPS: '+fmtTipNum(interimArr[i]),
        '#64B5F6::Final DPS: '+fmtTipNum(finalArr[i]),
        '#0F172A::Total DPS: '+fmtTipNum(totalArr[i]),
        '#F59E0B::Dividend Yield: '+fmtTipPct(yieldArr[i])
      ];
      var tip='FY:'+l+'|'+tipLines.join('|');
      var ox=(padX+i*gap).toFixed(1);
      var cx=((padX+i*gap+gap/2)/W).toFixed(4);
      return '<rect x="'+ox+'" y="0" width="'+gap.toFixed(1)+'" height="'+H+'" fill="transparent" data-cx="'+cx+'" data-tip="'+tip+'" onmouseenter="frTip(event,getTip(this),this.getAttribute(\'data-cx\'),\''+tipId+'\')" onmouseleave="frHide(\''+tipId+'\')" style="cursor:crosshair;touch-action:pan-y"/>';
    }).join('');
    var chartSvg='<div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;flex:1;min-height:0;display:block">'+grid+rects+'<path d="'+ld+'" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linejoin="round"/>'+ldots+xL+overlays+'</svg>'
      +'<div id="'+tipId+'" style="display:none;position:absolute;background:#fff;color:#0F172A;font-size:.74rem;font-weight:400;padding:8px 12px;border-radius:8px;pointer-events:none;z-index:10;top:4px;left:0;border:1px solid #E2E8F0;box-shadow:0 6px 20px rgba(0,0,0,.13)"></div></div>';
    var leg='<div style="display:flex;gap:14px;justify-content:center;margin-top:6px;flex-wrap:wrap">'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:#0D47A1;display:inline-block"></span>Interim DPS</span>'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:10px;height:10px;border-radius:2px;background:#64B5F6;display:inline-block"></span>Final DPS</span>'
      +'<span style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:#6B7280"><span style="width:16px;height:2px;background:#F59E0B;display:inline-block;border-radius:1px"></span>Dividend Yield</span>'
      +'</div>';
    return chartSvg+leg;
  }

  // Distribution Payout Ratio donut — visually the same as donut(), but
  // every slice shares ONE hover tooltip (Total DPS / EPS / Payout Ratio)
  // instead of a different tooltip per slice, since the 3 segments here
  // are components of a single ratio rather than independent categories.
  function payoutDonut(segs,label,caption,groupTip,legendData){
    var s=270,cx=s/2,cy=s/2,R=s*0.42,ir=s*0.35;
    var total=segs.reduce(function(a,x){return a+x.v;},0)||1;
    var ang=-Math.PI/2,paths='';
    segs.forEach(function(sg){
      var sweep=(sg.v/total)*2*Math.PI,ea=ang+sweep;
      var x1=(cx+R*Math.cos(ang)).toFixed(2),y1=(cy+R*Math.sin(ang)).toFixed(2);
      var x2=(cx+R*Math.cos(ea)).toFixed(2),y2=(cy+R*Math.sin(ea)).toFixed(2);
      var x3=(cx+ir*Math.cos(ea)).toFixed(2),y3=(cy+ir*Math.sin(ea)).toFixed(2);
      var x4=(cx+ir*Math.cos(ang)).toFixed(2),y4=(cy+ir*Math.sin(ang)).toFixed(2);
      var la=sweep>Math.PI?1:0;
      var d='M'+x1+' '+y1+' A'+R+' '+R+' 0 '+la+' 1 '+x2+' '+y2+' L'+x3+' '+y3+' A'+ir+' '+ir+' 0 '+la+' 0 '+x4+' '+y4+'Z';
      paths+='<path d="'+d+'" fill="'+sg.color+'" stroke="none" data-tip="'+groupTip+'" onmouseenter="showGroupPieTip(event,getTip(this))" onmousemove="showGroupPieTip(event,getTip(this))" onmouseout="hideGroupPieTip()" style="cursor:pointer"/>';
      ang=ea;
    });
    // legendData lets the textbox show different figures than the pie
    // slices themselves (e.g. the full Gross per Share, not the slice's
    // excl.-Interim remainder) — falls back to the slice values if omitted.
    var rows=legendData||segs;
    var legendRows=rows.map(function(sg){
      return '<div style="display:flex;align-items:center;gap:6px;font-size:.78rem;color:#374151">'
        +'<span style="width:8px;height:8px;border-radius:50%;background:'+sg.color+';flex-shrink:0;display:inline-block"></span>'
        +'<span style="flex:1">'+sg.label+'</span>'
        +'<span style="color:#0F172A;font-weight:400">'+fmtSen(sg.v)+' sen</span></div>';
    }).join('');
    var legend='<div style="display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-radius:8px;min-width:170px">'+legendRows+'</div>';
    return '<div style="display:flex;align-items:center;justify-content:flex-start;gap:20px;flex:1;padding:8px 0;min-height:0">'
      +'<svg viewBox="0 0 '+s+' '+s+'" style="width:'+s+'px;height:'+s+'px;max-width:90%;max-height:100%;flex-shrink:0">'
      +paths
      +'<circle cx="'+cx+'" cy="'+cy+'" r="'+(ir-3)+'" fill="#fff" style="pointer-events:none"/>'
      +'<text x="'+cx+'" y="'+(cy-6)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="19" font-weight="400" fill="#0F172A" style="pointer-events:none">'+label+'</text>'
      +'<text x="'+cx+'" y="'+(cy+16)+'" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="13" fill="#6B7280" style="pointer-events:none">'+(caption||'total')+'</text>'
      +'</svg>'
      +'<div style="display:flex;flex-direction:column;min-width:0">'+legend+'</div>'
      +'</div>';
  }

  function card(title,chartHtml,subline,href){
    var titleRow = href
      ? '<div class="fov-ct" style="display:flex;justify-content:space-between;align-items:center"><span>'+title+'</span><a href="'+href+'" style="font-size:.78rem;font-weight:600;color:var(--blue);text-decoration:none;white-space:nowrap;flex-shrink:0;margin-left:10px">Details &rarr;</a></div>'
      : '<div class="fov-ct">'+title+'</div>';
    return '<div class="fov-cc">'+titleRow+(subline?'<div class="fov-csub">'+subline+'</div>':'')+'<div class="fov-ch">'+chartHtml+'</div></div>';
  }

  // ── KEY FACTS (full width, no outline) ────────────────────────────────
  var latestBS = BALANCE_SHEET.length ? BALANCE_SHEET[BALANCE_SHEET.length-1] : null;
  var fundSizeLbl = latestBS ? ('RM '+fmtChartNum(latestBS.totalEquity)) : '—';
  var navLbl = NTA_PRICE>0 ? ('RM '+NTA_PRICE.toFixed(4)) : '—';
  var inceptionLbl = INCEPTION_DATE
    ? formatDate(INCEPTION_DATE)
    : (BALANCE_SHEET.length ? formatDate(BALANCE_SHEET[0].startDate) : '—');
  var keyFacts='<div style="margin-bottom:28px"><div class="fov-section-label">Key Facts</div>'
    +'<div class="fov-kfgrid-full">'
    +kf('Fund Size (AUM)',fundSizeLbl)
    +kf('Net Asset Value',navLbl,'per unit')
    +kf('Inception Date',inceptionLbl)
    +kf('Fund Structure','Investment Holdings')
    +kf('Fund Manager','Mr. Ng Zhi Yao')
    +kf('Custodian','-')
    +kf('Benchmark','Effective Annual Rate 7%')
    +kf('Min. Investment','RM 10,000')
    +'</div></div>';

  // ── OWNERSHIP — top 3 shareholders + "The rest of shareholder" ────────
  var shSorted = SHAREHOLDERS.slice().sort(function(a,b){return (b.units||0)-(a.units||0);});
  var shTop3 = shSorted.slice(0,3);
  var shRest = shSorted.slice(3);
  var shRestUnits = shRest.reduce(function(s,r){return s+(r.units||0);},0);
  var shTotalUnits = shSorted.reduce(function(s,r){return s+(r.units||0);},0);
  var OWN_COL = ['#1565C0','#2E7D32','#E65100'];
  var ownershipSegs = shTop3.map(function(s,i){ return {v:s.units||0, color:OWN_COL[i], label:s.name}; });
  if(shRest.length) ownershipSegs.push({v:shRestUnits, color:'#9CA3AF', label:'The rest of shareholder', pinLast:true});
  function fmtUnits4dp(v){ return (v||0).toLocaleString('en-MY',{minimumFractionDigits:4,maximumFractionDigits:4}); }
  var ownershipChart = ownershipSegs.length
    ? donut(ownershipSegs, fmtUnits4dp(shTotalUnits), 'units', fmtUnits4dp)
    : '<div style="padding:20px;color:var(--fg-3);font-size:.85rem">No shareholder data on record</div>';

  // ── CAPITAL STRUCTURE — Total Assets by the 4 Balance Sheet categories ─
  var capStructChart = BALANCE_SHEET.length
    ? stackedBars(
        [
          {v:BALANCE_SHEET.map(function(r){return r.securities;}),          color:'#0D47A1', label:'Securities'},
          {v:BALANCE_SHEET.map(function(r){return r.otherInvestments;}),    color:'#1565C0', label:'Other Assets'},
          {v:BALANCE_SHEET.map(function(r){return r.dividendReceivables;}), color:'#42A5F5', label:'Receivables'},
          {v:BALANCE_SHEET.map(function(r){return r.cash;}),                color:'#90CAF9', label:'Cash'}
        ],
        BALANCE_SHEET.map(function(r){return r.fy;})
      )
    : '<div style="padding:20px;color:var(--fg-3);font-size:.85rem">'+(BALANCE_SHEET_ERROR?('Could not load — '+BALANCE_SHEET_ERROR):'No financial years defined yet')+'</div>';

  // ── BALANCE SHEET (this card only) — Total Assets vs Total Liabilities ─
  var balanceSheetChart = BALANCE_SHEET.length
    ? groupedBars(
        BALANCE_SHEET.map(function(r){return r.fy;}),
        [
          {v:BALANCE_SHEET.map(function(r){return r.totalAssets;}),      color:'#1565C0', label:'Total Assets'},
          {v:BALANCE_SHEET.map(function(r){return r.totalLiabilities;}), color:'#E65100', label:'Total Liabilities'}
        ]
      )
    : '<div style="padding:20px;color:var(--fg-3);font-size:.85rem">'+(BALANCE_SHEET_ERROR?('Could not load — '+BALANCE_SHEET_ERROR):'No financial years defined yet')+'</div>';

  // ── NTA PERFORMANCE — monthly OHLC candlestick from nta_daily ──────────
  var ntaPerfChart = NTA_MONTHLY.length
    ? candlestick(NTA_MONTHLY)
    : '<div style="padding:20px;color:var(--fg-3);font-size:.85rem">'+(NTA_MONTHLY_ERROR?('Could not load — '+NTA_MONTHLY_ERROR):'No NTA history on record')+'</div>';

  // ── Canonical FY list (every FY the fund has defined, regardless of
  // whether a distribution was paid) — so Distribution History always
  // shows 5 bars even for FYs with no distribution on record ─────────────
  var ALL_FY = RATIO_ANALYSIS.length ? RATIO_ANALYSIS.map(function(r){return r.fy;})
    : (INCOME_STATEMENT.length ? INCOME_STATEMENT.map(function(r){return r.fy;}) : DIST_BY_FY.map(function(r){return r.fy;}));
  var DIST_BY_FY_MAP = {}; DIST_BY_FY.forEach(function(r){ DIST_BY_FY_MAP[r.fy]=r; });
  var INCOME_BY_FY = {}; INCOME_STATEMENT.forEach(function(r){ INCOME_BY_FY[r.fy]=r; });

  // ── DISTRIBUTION PAYOUT RATIO — center number is Interim DPS ÷ previous
  // FY's GPS (the full figure, not net of Interim DPS). The donut breaks
  // down into 2 segments: last FY's Interim DPS (light blue), and previous
  // FY's GPS (Gross Income per share) less that Interim DPS (grey) — but
  // the textbox shows the full GPS figure, not the excl.-Interim remainder.
  // One shared multi-line hover tooltip covers the whole chart: FYxxxx
  // header, then Interim DPS and GPS each on their own line. ─────────────
  function fmtSen(v){ return (v||0).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  var payoutLastFy = ALL_FY.length ? ALL_FY[ALL_FY.length-1] : null;
  var payoutPrevFy = ALL_FY.length>1 ? ALL_FY[ALL_FY.length-2] : null;
  var distSummaryChart;
  if(payoutLastFy && payoutPrevFy){
    var lastDist = DIST_BY_FY_MAP[payoutLastFy] || {interimDps:0,finalDps:0,totalDps:0};
    var prevIS   = INCOME_BY_FY[payoutPrevFy];
    var prevGps  = (prevIS && prevIS.outstandingShares>0) ? (prevIS.grossIncome/prevIS.outstandingShares*100) : null;
    if(prevGps!=null){
      var interimVal  = lastDist.interimDps||0;
      var payoutRatio = prevGps ? (interimVal/prevGps*100) : null;
      var gpsExclInterim = Math.max(0, prevGps-interimVal);
      var distSegs=[
        {v:interimVal,     color:'#64B5F6', label:'Interim DPS'},
        {v:gpsExclInterim, color:'#9CA3AF', label:'GPS excl. Interim DPS'}
      ];
      var distLegendData=[
        {v:interimVal, color:'#64B5F6', label:'Interim DPS'},
        {v:prevGps,    color:'#9CA3AF', label:'Gross per Share'}
      ];
      var groupTip=payoutLastFy+'|Interim DPS: '+fmtSen(interimVal)+' sen|GPS: '+fmtSen(prevGps)+' sen';
      distSummaryChart = payoutDonut(distSegs, (payoutRatio!=null?payoutRatio.toFixed(1):'—')+'%', 'Payout Ratio', groupTip, distLegendData);
    } else {
      distSummaryChart = '<div style="padding:20px;color:var(--fg-3);font-size:.85rem">No Gross Income data on record</div>';
    }
  } else {
    distSummaryChart = '<div style="padding:20px;color:var(--fg-3);font-size:.85rem">'+(DIST_BY_FY_ERROR?('Could not load — '+DIST_BY_FY_ERROR):'No distribution history on record')+'</div>';
  }

  // ── DISTRIBUTION HISTORY — past 5 FY, always shown even where a given
  // FY had no distribution (defaults to 0) — Interim + Final DPS (stacked,
  // dark/light blue) with Dividend Yield trend line (axis-less; values
  // shown on hover) ───────────────────────────────────────────────────────
  var last5Fy = ALL_FY.slice(-5);
  var distHistChart;
  if(last5Fy.length){
    var ratioByFy={}; RATIO_ANALYSIS.forEach(function(r){ ratioByFy[r.fy]=r; });
    var dhInterim=[], dhFinal=[], dhTotal=[], dhYield=[];
    last5Fy.forEach(function(fy){
      var d=DIST_BY_FY_MAP[fy]||{interimDps:0,finalDps:0,totalDps:0};
      dhInterim.push(d.interimDps||0);
      dhFinal.push(d.finalDps||0);
      dhTotal.push(d.totalDps||0);
      var ra=ratioByFy[fy];
      dhYield.push((ra&&ra.dividendYield!=null)?ra.dividendYield:0);
    });
    distHistChart = stackedBarsWithLine(last5Fy, dhInterim, dhFinal, dhTotal, dhYield);
  } else {
    distHistChart = '<div style="padding:20px;color:var(--fg-3);font-size:.85rem">'+(DIST_BY_FY_ERROR?('Could not load — '+DIST_BY_FY_ERROR):'No distribution history on record')+'</div>';
  }

  // ── CASH RESERVE RATIO — from Financial Result's Ratio Analysis (live),
  // single solid color per the simplified bar style ──────────────────────
  var cashReserveChart = RATIO_ANALYSIS.length
    ? bars(
        RATIO_ANALYSIS.map(function(r){return r.cashReserveRatio||0;}),
        RATIO_ANALYSIS.map(function(r){return r.fy;}),
        RATIO_ANALYSIS.map(function(){return '#1565C0';}),
        [{c:'#1565C0',l:'Cash Reserve (%)'}],
        false,
        true
      )
    : '<div style="padding:20px;color:var(--fg-3);font-size:.85rem">'+(RATIO_ANALYSIS_ERROR?('Could not load — '+RATIO_ANALYSIS_ERROR):'No financial years defined yet')+'</div>';

  // ── ABOUT — goes into first 2-col row (left only) ─────────────────────
  var aboutCard='<div class="fov-cc"><div class="fov-ct">About</div><div class="fov-csub">Fund mandate &amp; investment strategy</div><div style="padding-top:4px"><p class="fov-about">ZY-Invest is a private investment fund targeting long-term capital appreciation through a concentrated portfolio of Malaysian equity securities. The fund focuses on large-cap blue-chip stocks, selective growth equities and defensive consumer names on Bursa Malaysia, with flexibility on position sizing not typical of conventional unit trusts.</p></div></div>';
  var aboutBlank='<div></div>';

  // ── 2-COL CHART GRID ──────────────────────────────────────────────────
  var grid='<div class="fov-2col">'
    +aboutCard+aboutBlank
    +card('Ownership',ownershipChart,'Top 3 shareholders by units held','shareholders.html')
    +card('Capital Structure',capStructChart,'Total assets by category, per financial year','factsheet.html')
    +card('Financial Results', INCOME_STATEMENT.length
      ? groupedBars(
          INCOME_STATEMENT.map(function(r){return r.fy;}),
          [
            {v:INCOME_STATEMENT.map(function(r){return r.revenue;}),   color:'#1565C0', label:'Revenue'},
            {v:INCOME_STATEMENT.map(function(r){return r.netIncome;}), color:'#2E7D32', label:'NPAT', colorByValue:true}
          ]
        )
      : '<div style="padding:20px;color:var(--fg-3);font-size:.85rem">'+(INCOME_STATEMENT_ERROR?('Could not load — '+INCOME_STATEMENT_ERROR):'No financial years defined yet')+'</div>',
      'Revenue vs. Net Profit After Tax, per financial year',
      'financial-results.html?tab=income'
    )
    +card('NTA Performance',ntaPerfChart,'Monthly NTA per unit (open/high/low/close)','nta-history.html')
    +card('Distribution Payout Ratio',distSummaryChart,'Interim DPS ÷ previous FY gross per share','financial-results.html?tab=ratios')
    +card('Distribution History',distHistChart,'Interim &amp; final DPS with dividend yield trend, per financial year','financial-results.html?tab=ratios')
    +card('Balance Sheet',balanceSheetChart,'Total assets vs. total liabilities, per financial year','financial-results.html?tab=balance')
    +card('Cash Reserve Ratio',cashReserveChart,'Cash as a % of total assets, per financial year','financial-results.html?tab=balance')
    +'</div>';


  var grid2=grid+'</div>';
  return '<div style="background:#fff;margin:-26px -28px -48px;padding:26px 28px 48px;min-height:100%">'
    +'<div class="ph-xl"><h1>Fund <span class="acc">Overview</span></h1><p>ZY-Invest Private Investment Fund · Key facts, mandate &amp; structure.</p></div>'
    +keyFacts+grid2
    +'</div>';
}

// ── FACTSHEET ─────────────────────────────────────────────────────────────
// ── FACTSHEET ───────────────────────────────────────────────────────────
