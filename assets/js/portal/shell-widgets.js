/* ===== assets/js/portal/shell-widgets.js — Notifications, search, toasts, login/logout, pie tooltips, global UI event wiring ===== */
function toggleNotif(){
  var p=document.getElementById('npanel');
  p.classList.toggle('open');
  if(p.classList.contains('open')){document.getElementById('notifDot').style.display='none';document.getElementById('userMenu').classList.remove('open');}
}
function renderNotifs(){
  document.getElementById('nlist').innerHTML=NOTIFS.map(function(n){
    return '<div class="nitem'+(n.unread?' unread':'')+'"><div class="ni-dot" style="'+(n.unread?'':'background:var(--gray-200)')+'"></div><div style="flex:1"><div style="font-size:.86rem;font-weight:600;color:var(--fg-1);margin-bottom:3px">'+n.title+'</div><div style="font-size:.8rem;color:var(--fg-3);line-height:1.5">'+n.body+'</div><div style="font-size:.72rem;color:var(--fg-3);margin-top:6px">'+n.time+'</div></div></div>';
  }).join('');
}

// ── USER MENU ────────────────────────────────────────────────────────────────
function toggleUserMenu(){document.getElementById('userMenu').classList.toggle('open');document.getElementById('npanel').classList.remove('open');}

// ── SEARCH ───────────────────────────────────────────────────────────────────
function toggleSearch(){
  var ov=document.getElementById('soverlay');
  var open=ov.style.display==='flex';
  ov.style.display=open?'none':'flex';
  if(!open)setTimeout(function(){document.getElementById('sinp').focus();},50);
}
function renderSearch(q){
  var r=document.getElementById('sresults');
  if(!q){r.innerHTML='<div style="padding:10px 12px;font-size:.8rem;color:var(--fg-3)">Type to search — holdings, transactions, documents</div>';return;}
  var ql=q.toLowerCase();
  var items=[];
  HOLDINGS.forEach(function(h){if(h.n.toLowerCase().includes(ql)||h.t.toLowerCase().includes(ql))items.push({label:h.n,sub:h.t+' · '+h.sec,page:'holdings'});});
  TXS.forEach(function(t){if(t.ref.toLowerCase().includes(ql)||t.type.toLowerCase().includes(ql))items.push({label:t.ref,sub:t.type+' · '+t.date,page:'transactions'});});
  DOCS.forEach(function(d){if(d.n.toLowerCase().includes(ql))items.push({label:d.n,sub:d.type+' · '+d.date,page:'statements'});});
  if(!items.length){r.innerHTML='<div style="padding:10px 12px;font-size:.8rem;color:var(--fg-3)">No results for "'+q+'"</div>';return;}
  r.innerHTML=items.slice(0,6).map(function(it){
    return '<div class="sitem" onclick="toggleSearch();navigate(\''+it.page+'\')"><div style="width:32px;height:32px;border-radius:8px;background:var(--blue-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg></div><div style="flex:1;min-width:0"><div style="font-size:.86rem;font-weight:600;color:var(--fg-1)">'+it.label+'</div><div style="font-size:.74rem;color:var(--fg-3)">'+it.sub+'</div></div></div>';
  }).join('');
}

// ── TOAST ────────────────────────────────────────────────────────────────────
var toastTimer;
function showToast(msg,type){
  var t=document.getElementById('toast');
  t.textContent=msg;
  t.style.background=type==='success'?'var(--green)':type==='orange'?'var(--orange)':type==='error'?'var(--red)':'var(--fg-1)';
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){t.classList.remove('show');},4000);
}

// ── LOGIN ────────────────────────────────────────────────────────────────────
function doLogout(){
  document.getElementById('userMenu').classList.remove('open');
  // Wipe the real Supabase session token directly and synchronously — do
  // NOT depend on sb.auth.signOut() completing or succeeding to decide
  // we're "logged out" locally (a failed/erroring signOut() call can leave
  // the real session token behind, which login.html would then see as
  // still valid). signOut() still fires as best-effort server-side cleanup.
  try{
    Object.keys(localStorage).forEach(function(k){
      if(k.indexOf('sb-')===0 && k.indexOf('-auth-token')!==-1) localStorage.removeItem(k);
    });
    ['zy-page','zy_token','zy_role','zy_name','zy_investor_id','zy-session','zy-email'].forEach(function(k){localStorage.removeItem(k);});
  }catch(e){}
  try{ if(typeof sb!=='undefined'&&sb) sb.auth.signOut().catch(function(){}); }catch(e){}
  window.location.href='../login.html';
}
function doLogin(){
  var e=document.getElementById('lemail').value, p=document.getElementById('lpwd').value;
  if(!e||!p){showToast('Please enter your email and password','error');return;}
  try{localStorage.setItem('zy-session','1');localStorage.setItem('zy-email',e);}catch(err){}
  document.getElementById('lscreen').style.display='none';
  showToast('Welcome back, '+e+'.','success');
}

// ── INIT ─────────────────────────────────────────────────────────────────────
// Run immediately — script is at end of body so DOM is ready
function ensurePieTip(){
  var t=document.getElementById('pieTip');
  if(!t){
    t=document.createElement('div');
    t.id='pieTip';
    t.style.cssText='position:fixed;opacity:0;transition:opacity .12s;pointer-events:none;background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:7px 11px;font-size:.78rem;font-weight:400;color:#0F172A;box-shadow:0 6px 20px rgba(0,0,0,.13);z-index:999;white-space:nowrap';
    document.body.appendChild(t);
  }
  return t;
}
function showPieTip(e,txt){var t=ensurePieTip();t.textContent=txt;t.style.opacity='1';t.style.left=(e.clientX+14)+'px';t.style.top=(e.clientY-36)+'px';}
function hidePieTip(){var t=document.getElementById('pieTip');if(t)t.style.opacity='0';}
document.addEventListener('mousemove',function(e){var t=document.getElementById('pieTip');if(t&&t.style.opacity!=='0'){t.style.left=(e.clientX+14)+'px';t.style.top=(e.clientY-36)+'px';}});
// Group pie tooltip — one shared tooltip for an entire donut (e.g.
// Distribution Payout Ratio), rendered as a header line ("FYxxxx") plus
// one line per metric, rather than a single-line per-slice tooltip.
// data-tip carries a plain 'HEADER|line1|line2|...' string (never raw
// HTML) so it stays safe to embed as an HTML attribute.
function ensureGroupPieTip(){
  var t=document.getElementById('groupPieTip');
  if(!t){
    t=document.createElement('div');
    t.id='groupPieTip';
    t.style.cssText='position:fixed;opacity:0;transition:opacity .12s;pointer-events:none;background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:8px 12px;font-size:.78rem;font-weight:400;color:#0F172A;box-shadow:0 6px 20px rgba(0,0,0,.13);z-index:999;line-height:1.5;white-space:nowrap';
    document.body.appendChild(t);
  }
  return t;
}
function showGroupPieTip(e,raw){
  var t=ensureGroupPieTip();
  var parts=(raw||'').split('|');
  var header=parts[0]||'';
  var lines=parts.slice(1);
  t.innerHTML='<div style="color:#64748B;margin-bottom:5px">'+header+'</div>'
    +lines.map(function(l){return '<div style="margin-bottom:2px">'+l+'</div>';}).join('');
  t.style.opacity='1';
  t.style.left=(e.clientX+14)+'px';
  t.style.top=(e.clientY-46)+'px';
}
function hideGroupPieTip(){var t=document.getElementById('groupPieTip');if(t)t.style.opacity='0';}
document.addEventListener('mousemove',function(e){var t=document.getElementById('groupPieTip');if(t&&t.style.opacity!=='0'){t.style.left=(e.clientX+14)+'px';t.style.top=(e.clientY-46)+'px';}});
// [init removed for standalone page]
document.addEventListener('click',function(e){
  if(!e.target.closest('#npanel')&&!e.target.closest('#notifBtn'))document.getElementById('npanel').classList.remove('open');
  if(!e.target.closest('#userMenu')&&!e.target.closest('#userBtn'))document.getElementById('userMenu').classList.remove('open');
  if(!e.target.closest('.sbox')&&e.target.closest('#soverlay'))document.getElementById('soverlay').style.display='none';
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){closeSR();document.getElementById('soverlay').style.display='none';document.getElementById('npanel').classList.remove('open');}});
var tk=document.querySelector('.ticker-track');
if(tk){tk.addEventListener('mouseenter',function(){tk.style.animationPlayState='paused';});tk.addEventListener('mouseleave',function(){tk.style.animationPlayState='running';});}
window.addEventListener('scroll',function(){document.getElementById('topnav').classList.toggle('scrolled',window.scrollY>5);},{passive:true});
