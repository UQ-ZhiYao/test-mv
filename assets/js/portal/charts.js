/* ===== assets/js/portal/charts.js — Chart axis-scaling and number/percent formatting helpers ===== */
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
// Guarantees exactly 5 evenly-spaced gridlines (4 equal intervals) across a
// nicely-rounded min/max — used by every bar/histogram chart for consistency.
// Axis ticks for bar/histogram/candlestick charts: always anchors the
// domain to include zero (so the zero baseline is always a gridline),
// expands to the next round number beyond the data (headroom), and aims
// for ~5 gridlines — landing on 4-6 is fine, since forcing exactly 5
// sometimes produces uglier tick values than letting them land naturally.
function fiveTicks(rawMin,rawMax,forceZero){
  if(forceZero===undefined) forceZero=true;
  var min=forceZero?Math.min(0,rawMin):rawMin, max=forceZero?Math.max(0,rawMax):rawMax;
  var scale=niceAxisScale(min,max,5);
  var ticks=[];
  for(var tv=scale.min; tv<=scale.max+scale.step*0.001; tv+=scale.step){ ticks.push(tv); }
  return {ticks:ticks,min:scale.min,max:scale.max,step:scale.step};
}

// Tight-fit axis for line/candle charts (Comparison, NTA History): unlike
// fiveTicks/niceAxisScale — which round the DOMAIN itself out to the next
// step multiple, so a small dip to -8% with a step of 50 blows the axis
// out to -50 — this only rounds the TICK step, and keeps min/max as the
// actual data range plus a small padding margin. Gridlines are then
// generated at nice step multiples that land inside that tight range
// (which may mean 4-6 gridlines rather than an exact count), so the axis
// always hugs whatever data is actually on screen.
function tightTicks(rawMin,rawMax){
  var range=rawMax-rawMin;
  if(range<=0){ rawMin-=1; rawMax+=1; range=2; }
  var pad=range*0.08;
  var min=rawMin-pad, max=rawMax+pad;
  var step=niceNum((max-min)/4,true);
  var start=Math.ceil(min/step)*step;
  var ticks=[];
  for(var tv=start; tv<=max+step*0.001; tv+=step){ ticks.push(tv); }
  return {ticks:ticks,min:min,max:max,step:step};
}

function fmtChartNum(v){
  var av=Math.abs(v||0), sign=(v||0)<0?'−':'';
  if(av>=100000000) return sign+(av/1000000).toLocaleString('en-MY',{minimumFractionDigits:1,maximumFractionDigits:1})+'Mil';
  if(av>=100000) return sign+(av/1000).toLocaleString('en-MY',{minimumFractionDigits:1,maximumFractionDigits:1})+'k';
  return sign+av.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function fmtChartPct(v){
  var av=Math.abs(v||0), sign=(v||0)<0?'−':'';
  return sign+av.toLocaleString('en-MY',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
}
// Tooltip-only variants — "-" for exactly zero, everything else formatted normally.
// Axis labels and other displays keep showing 0.00/0.0% via fmtChartNum/fmtChartPct.
function fmtTipNum(v){ return v ? fmtChartNum(v) : '—'; }
function fmtTipPct(v){ return v ? fmtChartPct(v) : '—'; }
// Plain #,##0.00 formatter — never abbreviates to k/Mil. Used for tooltips
// that must always show the exact figure (Capital Structure, Financial
// Results, Balance Sheet cards on Fund Overview).
function fmtTipPlain(v){
  if(!v) return '—';
  var av=Math.abs(v), sign=v<0?'−':'';
  return sign+av.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
}
