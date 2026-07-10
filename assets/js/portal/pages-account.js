/* ===== assets/js/portal/pages-account.js — Settings/Profile/Password/Nominee pages and their form handlers ===== */
var STAB = 'personal'; // active settings tab

function profHero(){
  var email = (AUTH_USER && AUTH_USER.email) || '—';
  var fullName = (PROFILE && PROFILE.full_name) || email;
  var av = mpInitials(PROFILE && (PROFILE.preferred_name || PROFILE.full_name));
  return '<div class="prof-hero">'
    +'<div class="prof-av" id="profAvatar">'+av+'</div>'
    +'<div class="prof-info"><h2 id="profName">'+fullName+'</h2>'
    +'<div class="prof-meta"><span id="profEmail">'+email+'</span></div>'
    +'</div>'
    +'<span class="prof-badge">Verified Investor</span>'
    +'</div>';
}

function profTabs(){
  var ts=[['personal','Profile'],['security','Password & Security'],['nominee','Nominee']];
  return '<div class="prof-tabs">'
    +ts.map(function(t){
      return '<button class="prof-tab'+(STAB===t[0]?' on':'')+'" data-stab="'+t[0]+'" onclick="switchStab(this.dataset.stab)">'+t[1]+'</button>';
    }).join('')
    +'</div>';
}

function switchStab(tab){
  STAB=tab;
  document.querySelectorAll('.prof-tab').forEach(function(b){b.classList.toggle('on',b.dataset.stab===tab);});
  document.querySelectorAll('.prof-pane').forEach(function(p){p.classList.toggle('on',p.dataset.pane===tab);});
}

function fcard(head,sub,body,foot,extraHead){
  return '<div class="fcard">'
    +'<div class="fcard-head"><div><h3>'+head+'</h3><p>'+sub+'</p></div>'+(extraHead||'')+'</div>'
    +'<div class="fcard-body">'+body+'</div>'
    +(foot?'<div class="fcard-foot">'+foot+'</div>':'')
    +'</div>';
}
function ff(lbl,id,type,val,ph,hint,full,disabled){
  var extra=full?' class="fg-full"':'';
  return '<div class="ffield'+extra+'"><label>'+lbl+'</label>'
    +'<input id="'+id+'" type="'+(type||'text')+'" value="'+(val||'')+'" placeholder="'+(ph||'')+'"'+(disabled?' disabled style="opacity:.6;cursor:not-allowed"':'')+'>'
    +(hint?'<div class="fhint">'+hint+'</div>':'')
    +'</div>';
}
function ffSave(cancelFn,saveFn){
  return '<button class="fbtn-line" onclick="'+cancelFn+'()">Cancel</button>'
    +'<button class="fbtn-fill" onclick="'+saveFn+'()">Save Changes</button>';
}

function pgSettings(t){
  STAB=t;
  var P = PROFILE || {};
  var pEmail = (AUTH_USER && AUTH_USER.email) || '';
  var nricLocked = !!P.nric_passport;
  return '<div class="prof-wrap">'
    +'<div class="ph-xl"><h1>Account <span class="acc">Settings</span></h1><p>Manage your profile, security and nominees from one place.</p></div>'
    +profHero()
    +profTabs()
    +'<div class="prof-pane'+(t==='personal'?' on':'')+'" data-pane="personal">'
    +fcard('Personal Details','Your contact and identity information on record.',
      '<div class="fgrid">'
      +ff('Full Name','pf-name','text',(P.full_name||''),'As per NRIC / passport')
      +ff('Preferred Name','pf-pref','text',(P.preferred_name||''),'Display name')
      +ff('Email Address','pf-email','email',pEmail,'','Email is used for login',false,true)
      +ff('Mobile','pf-phone','tel',(P.phone||''),'+60 1X-XXX XXXX')
      +ff('NRIC / Passport','pf-nric','text',(nricLocked?'······-··-····':''),'e.g. 990512-14-5678',(nricLocked?'Locked after first save':''),false,nricLocked)
      +ff('Date of Birth','pf-dob','date',(P.date_of_birth||''),'')
      +'<div class="ffield"><label>Nationality</label><select id="pf-nat" style="font:inherit;font-size:.92rem;color:var(--fg-1);background:#fff;border:1.5px solid var(--border);border-radius:var(--radius-md);padding:9px 12px;outline:none;transition:.2s;width:100%;box-sizing:border-box">'
      +['Malaysian','Singaporean','Permanent Resident','Other'].map(function(n){return '<option'+(P.nationality===n?' selected':'')+'>'+n+'</option>';}).join('')
      +'</select></div>'
      +'<div class="ffield fg-full"><label>Residential Address</label><input id="pf-addr" value="'+(P.address||'')+'"></div>'
      +'</div>',
      ffSave('cancelSettings','profileSave')
    )
    +fcard('Distribution Bank Account','Where your income distributions are paid in MYR.',
      '<div class="fgrid">'
      +ff('Bank Name','pf-bank','text',(P.bank_name||''),'e.g. Maybank')
      +ff('Account Number','pf-bankacct','text',(P.bank_account_no||''),'Account number')
      +ff('Account Holder Name','pf-bkholder','text',(P.bank_account_holder||''),'Name as per bank account','',true)
      +'</div>',
      ffSave('cancelSettings','bankSave')
    )
    +fcard('Account Verification','Your KYC status and investor classification.',
      '<div>'
      +'<div class="kyc-row"><span class="kyc-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg></span><span class="kyc-meta"><span class="kt">Identity Verification</span><span class="kd">'+(nricLocked?'NRIC verified':'NRIC not yet on file')+'</span></span><span class="'+(nricLocked?'pill-ok':'pill-warn')+'">'+(nricLocked?'Verified':'Pending')+'</span></div>'
      +'<div class="kyc-row"><span class="kyc-ic"><svg viewBox="0 0 24 24"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/></svg></span><span class="kyc-meta"><span class="kt">Investor Classification</span><span class="kd">Eligible to subscribe under the fund mandate</span></span><span class="pill-ok">Sophisticated Investor</span></div>'
      +'<div class="kyc-row"><span class="kyc-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg></span><span class="kyc-meta"><span class="kt">Risk Profile Assessment</span><span class="kd">Annual review due 30 Jun 2026</span></span><span class="pill-warn">Review Due</span></div>'
      +'</div>'
    )
    +'</div>'
    +'<div class="prof-pane'+(t==='security'?' on':'')+'" data-pane="security">'
    +secPane()
    +'</div>'
    +'<div class="prof-pane'+(t==='nominee'?' on':'')+'" data-pane="nominee">'
    +nomPane()
    +'</div>'
    +'</div>';
}
function pgProfile(){return pgSettings('personal');}
function pgPassword(){return pgSettings('security');}
function pgNominee(){return pgSettings('nominee');}

function secPane(){
  return fcard('Change Password','Use at least 8 characters with a mix of letters, numbers and symbols.',
    '<div style="max-width:480px;display:flex;flex-direction:column;gap:14px">'
    +ff('New Password','pw-new','password','','','Minimum 8 characters')
    +'<div class="ffield"><label>Password Strength</label>'
    +'<div class="pw-bar-wrap"><div id="pw-bar" style="height:100%;width:0;background:var(--red);transition:width .3s,background .3s;border-radius:99px"></div></div>'
    +'<div id="pw-lbl" class="fhint" style="margin-top:5px">—</div></div>'
    +ff('Confirm New Password','pw-cf','password','','')
    +'</div>',
    '<button class="fbtn-line" onclick="clearPwForm()">Clear</button><button class="fbtn-fill" onclick="submitPwChange()">Update Password</button>'
  )
  +fcard('Two-Factor Authentication','Add an extra layer of security to your account.',
    '<div>'
    +'<div class="sesh-row"><span class="sesh-ic" style="background:var(--orange-bg)"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="var(--orange)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/></svg></span><span class="kyc-meta"><span class="kt">Authenticator App</span><span class="kd">Google Authenticator or Authy</span></span><div style="display:flex;align-items:center;gap:10px"><span class="pill-warn">Not Enabled</span><button class="fbtn-fill" style="padding:6px 14px;font-size:.8rem" onclick="enable2FA()">Enable</button></div></div>'
    +'<div class="sesh-row"><span class="sesh-ic" style="background:var(--green-bg)"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="var(--green)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/></svg></span><span class="kyc-meta"><span class="kt">SMS OTP</span><span class="kd">Sent to +60 12-345 6789 on each login</span></span><span class="pill-ok">Enabled</span></div>'
    +'</div>'
  )
  +fcard('Active Sessions','Devices currently signed in to your account.',
    '<div>'
    +'<div class="sesh-row"><span class="sesh-ic" style="background:var(--blue-bg)"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="var(--blue)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></span><span class="kyc-meta"><span class="kt">Chrome on macOS</span><span class="kd">Kuala Lumpur · Active now</span></span><span class="pill-ok">Current</span></div>'
    +'<div class="sesh-row"><span class="sesh-ic" style="background:var(--gray-100)"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="var(--fg-3)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/></svg></span><span class="kyc-meta"><span class="kt">Safari on iPhone</span><span class="kd">Kuala Lumpur · 2 days ago</span></span><button class="fbtn-red" style="padding:6px 14px;font-size:.8rem" onclick="revokeSession()">Revoke</button></div>'
    +'</div>'
  );
}

// ── NOMINEE DATA & LOGIC (mirrors live version) ────────────────────────────
var NOM_DATA=[{name:'',rel:'Spouse',nric:'',dob:'',mob:'',alloc:100}];
var NOM_SEL=0;
var NOM_COLORS=['var(--blue)','var(--green)','var(--orange)','#7E57C2'];

function nomClamp(v){return Math.max(0,Math.min(100,v));}

// After rebalancing, fix any rounding drift so total stays exactly 100
function nomFixRounding(){
  var tot=NOM_DATA.reduce(function(a,n){return a+n.alloc;},0), diff=100-tot;
  if(!diff||!NOM_DATA.length) return;
  var idx=-1,mx=-1;
  NOM_DATA.forEach(function(n,i){if(i!==NOM_SEL&&n.alloc>mx){mx=n.alloc;idx=i;}});
  if(idx===-1) idx=NOM_SEL;
  NOM_DATA[idx].alloc=nomClamp(NOM_DATA[idx].alloc+diff);
}

// Proportionally redistribute remaining % to other nominees
function nomRebalance(v){
  v=nomClamp(Math.round(v/5)*5);
  var others=NOM_DATA.map(function(n,i){return i;}).filter(function(i){return i!==NOM_SEL;});
  if(!others.length){NOM_DATA[NOM_SEL].alloc=100;return;}
  var rem=100-v, tot=others.reduce(function(a,i){return a+NOM_DATA[i].alloc;},0);
  if(!tot){
    var each=Math.floor(rem/others.length);
    others.forEach(function(i){NOM_DATA[i].alloc=each;});
    NOM_DATA[others[0]].alloc+=rem-(each*others.length); // absorb leftover
  } else {
    others.forEach(function(i){NOM_DATA[i].alloc=Math.round(NOM_DATA[i].alloc/tot*rem);});
  }
  NOM_DATA[NOM_SEL].alloc=v;
  nomFixRounding();
}

function nomBarHTML(){
  var total=NOM_DATA.reduce(function(a,n){return a+n.alloc;},0);
  var ok=total===100;
  var bars=NOM_DATA.map(function(n,i){
    return '<span style="width:'+n.alloc+'%;background:'+NOM_COLORS[i%4]+';transition:width .25s"></span>';
  }).join('');
  return '<div style="margin-bottom:8px">'
    +'<div class="nom-bar-wrap">'+bars+'</div>'
    +'<div style="display:flex;justify-content:space-between;margin-top:6px">'
    +'<div style="display:flex;gap:12px">'
    +NOM_DATA.map(function(n,i){
      return '<span style="display:flex;align-items:center;gap:5px;font-size:.74rem;color:var(--fg-3)">'
        +'<span style="width:8px;height:8px;border-radius:2px;background:'+NOM_COLORS[i%4]+';display:inline-block"></span>'
        +(n.name||'New')+'</span>';
    }).join('')
    +'</div>'
    +'<span style="font-size:.75rem;font-weight:700;color:'+(ok?'var(--green)':'var(--red)')+'">'+total+'% '+(!ok?'(must equal 100%)':'')+'</span>'
    +'</div></div>';
}

function nomListHTML(){
  return NOM_DATA.map(function(n,i){
    return '<div class="nom-item'+(i===NOM_SEL?' sel':'')+'" onclick="nomSelect('+i+')">'
      +'<span class="nom-dot" style="background:'+NOM_COLORS[i%4]+'"></span>'
      +'<span class="kyc-meta">'
      +'<span class="kt">'+(n.name||'New nominee')+'</span>'
      +'<span class="kd">'+n.rel+' · '+(i===0?'Primary':'Secondary')+' nominee</span>'
      +'</span>'
      +'<span class="nom-alloc-pill" style="background:'+NOM_COLORS[i%4]+'22;color:'+NOM_COLORS[i%4]+'">'+n.alloc+'%</span>'
      +'</div>';
  }).join('');
}

function refreshNomUI(){
  var bar=document.getElementById('nom-bar-area');
  var list=document.getElementById('nom-list-area');
  if(bar) bar.innerHTML=nomBarHTML();
  if(list) list.innerHTML=nomListHTML();
  // Update alloc pill value live
  var alloc=document.getElementById('nf-alloc');
  if(alloc) alloc.value=NOM_DATA[NOM_SEL].alloc;
  allocSlide(alloc);
}

function nomSelect(i){
  NOM_SEL=i;
  var n=NOM_DATA[i];
  var setV=function(id,v){var el=document.getElementById(id);if(el)el.value=v||'';};
  setV('nf-name',n.name); setV('nf-nric',n.nric); setV('nf-dob',n.dob); setV('nf-mob',n.mob);
  var rel=document.getElementById('nf-rel');
  if(rel){for(var k=0;k<rel.options.length;k++){if(rel.options[k].value===n.rel||rel.options[k].text===n.rel){rel.selectedIndex=k;break;}}}
  var alloc=document.getElementById('nf-alloc');
  if(alloc){alloc.value=n.alloc; allocSlide(alloc);}
  var lbl=document.getElementById('nom-prim-lbl');
  if(lbl) lbl.textContent=i===0?'Primary':'Secondary';
  document.querySelectorAll('.nom-item').forEach(function(el,idx){el.classList.toggle('sel',idx===i);});
}

// Called when slider moves — rebalance then refresh
function nomSlide(el){
  nomRebalance(parseInt(el.value,10));
  refreshNomUI();
  // Keep slider at current sel value (refreshNomUI sets it)
}

function nomAdd(){
  if(NOM_DATA.length>=4){showToast('Maximum 4 nominees allowed','error');return;}
  // Give new nominee 0%, don't disturb existing
  NOM_DATA.push({name:'',rel:'Spouse',nric:'',dob:'',mob:'',alloc:0});
  NOM_SEL=NOM_DATA.length-1;
  refreshNomUI(); nomSelect(NOM_SEL);
  var el=document.getElementById('nf-name'); if(el)el.focus();
  showToast('New nominee added — set allocation then Save','orange');
}

async function saveNominee(){
  var getV=function(id){var el=document.getElementById(id);return el?el.value.trim():'';};
  var n=NOM_DATA[NOM_SEL];
  n.name=getV('nf-name'); n.nric=getV('nf-nric'); n.dob=getV('nf-dob'); n.mob=getV('nf-mob');
  var relEl=document.getElementById('nf-rel'); if(relEl) n.rel=relEl.value;
  var total=NOM_DATA.reduce(function(a,x){return a+x.alloc;},0);
  if(total!==100){showToast('Total allocation must equal 100% (currently '+total+'%)','error');return;}
  if(!n.name){showToast('Nominee name is required','error');return;}
  if(!INVESTOR_ID){showToast('Not signed in','error');return;}
  if(typeof mpSaveNominee!=='function'){showToast('Nominee save service unavailable','error');return;}
  var payload={
    full_name:      n.name,
    relationship:   n.rel,
    nric_passport:  n.nric || null,
    date_of_birth:  n.dob || null,
    mobile:         n.mob || null,
    allocation_pct: n.alloc
  };
  if(n.id) payload.id = n.id;
  try{
    await mpSaveNominee(INVESTOR_ID, payload);
    try{
      var fresh = await mpLoadNominees(INVESTOR_ID);
      if(fresh && fresh.length){ NOM_DATA=fresh; if(NOM_SEL>=NOM_DATA.length) NOM_SEL=0; }
    }catch(e){}
    refreshNomUI();
    showToast((n.name||'Nominee')+' saved successfully','success');
  }catch(e){
    showToast('Save failed: '+e.message,'error');
  }
}

async function deleteNominee(){
  if(NOM_DATA.length<=1){showToast('At least one nominee required','error');return;}
  var cur=NOM_DATA[NOM_SEL];
  var name=cur.name||'Nominee';
  try{
    if(cur.id && typeof mpDeleteNominee==='function'){ await mpDeleteNominee(cur.id); }
    NOM_DATA.splice(NOM_SEL,1);
    NOM_SEL=0;
    // Redistribute to make total 100%
    var tot=NOM_DATA.reduce(function(a,n){return a+n.alloc;},0);
    if(tot>0&&tot!==100){NOM_DATA.forEach(function(n){n.alloc=Math.round(n.alloc/tot*100);}); nomFixRounding();}
    else if(!tot){NOM_DATA[0].alloc=100;}
    refreshNomUI(); nomSelect(0);
    showToast(name+' removed','success');
  }catch(e){
    showToast('Remove failed: '+e.message,'error');
  }
}

function nomPane(){
  var curN = NOM_DATA[NOM_SEL] || {};
  var rels=['Parent','Spouse','Child','Sibling','Other'];
  return fcard('Current Nominees','Click a nominee to edit, or add a new one.',
    '<div id="nom-bar-area">'+nomBarHTML()+'</div>'
    +'<div id="nom-list-area">'+nomListHTML()+'</div>',
    '<button class="fbtn-fill" onclick="nomAdd()">+ Add Nominee</button>'
  )
  +fcard('Nominee Details','<span id="nom-prim-lbl">Primary</span> nominee',
    '<div class="fgrid">'
    +ff('Full Name','nf-name','text',(curN.name||''),'Nominee full name')
    +'<div class="ffield"><label>Relationship</label><select id="nf-rel" style="font:inherit;font-size:.92rem;color:var(--fg-1);background:#fff;border:1.5px solid var(--border);border-radius:var(--radius-md);padding:9px 12px;outline:none;transition:.2s;width:100%;box-sizing:border-box">'
    +rels.map(function(r){return '<option'+(curN.rel===r?' selected':'')+'>'+r+'</option>';}).join('')
    +'</select></div>'
    +ff('NRIC / Passport','nf-nric','text',(curN.nric||''),'NRIC or passport no.')
    +ff('Date of Birth','nf-dob','text',(curN.dob||''),'DD Mmm YYYY')
    +ff('Mobile','nf-mob','tel',(curN.mob||''),'+60 1X-XXX XXXX')
    +'<div class="ffield"><label>Allocation <span id="nf-pct-lbl" style="color:var(--blue);font-weight:700">'+(curN.alloc||0)+'%</span></label>'
    +'<input type="range" id="nf-alloc" min="0" max="100" step="5" value="'+(curN.alloc||0)+'" oninput="nomSlide(this)" style="width:100%;accent-color:var(--blue);margin-top:6px">'
    +'<div class="fhint">Adjust allocation — must total 100% across all nominees</div></div>'
    +'</div>'
    +'<div style="margin-top:14px;padding:12px 14px;background:var(--orange-bg);border-radius:var(--radius-md);font-size:.78rem;color:var(--fg-2);line-height:1.6">'
    +'<b>Note:</b> Nominee changes require a completed and signed Nomination Form submitted to the fund manager.'
    +'</div>',
    '<button class="fbtn-red" onclick="deleteNominee()">Remove</button><div style="flex:1"></div><button class="fbtn-line" onclick="clearNomForm()">Clear</button><button class="fbtn-fill" onclick="saveNominee()">Save Nominee</button>'
  );
}

// Action helpers
function csDashboard(){navigate('dashboard');}
function cancelSettings(){navigate('dashboard');}
function fVal(id){var el=document.getElementById(id);return el?el.value.trim():'';}
async function profileSave(){
  if(!AUTH_USER){showToast('Not signed in','error');return;}
  var btn=event&&event.target;
  var updates={
    full_name:      fVal('pf-name'),
    preferred_name: fVal('pf-pref'),
    phone:           fVal('pf-phone'),
    date_of_birth:   fVal('pf-dob') || null,
    nationality:     fVal('pf-nat'),
    address:         fVal('pf-addr')
  };
  var nricEl=document.getElementById('pf-nric');
  if(nricEl && !nricEl.disabled && nricEl.value.trim()){
    updates.nric_passport = nricEl.value.trim();
  }
  try{
    if(btn){btn.disabled=true;btn.textContent='Saving…';}
    await mpSaveProfile(AUTH_USER.id, updates);
    PROFILE = Object.assign({}, PROFILE||{}, updates);
    populateNav();
    document.getElementById('mainContent').innerHTML=pgSettings(STAB||'personal');
    showToast('Personal details saved','success');
  }catch(e){
    showToast('Save failed: '+e.message,'error');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Save Changes';}
  }
}
async function bankSave(){
  if(!AUTH_USER){showToast('Not signed in','error');return;}
  var btn=event&&event.target;
  var updates={
    bank_name:           fVal('pf-bank'),
    bank_account_no:     fVal('pf-bankacct'),
    bank_account_holder: fVal('pf-bkholder')
  };
  try{
    if(btn){btn.disabled=true;btn.textContent='Saving…';}
    await mpSaveProfile(AUTH_USER.id, updates);
    PROFILE = Object.assign({}, PROFILE||{}, updates);
    showToast('Bank account updated','success');
  }catch(e){
    showToast('Save failed: '+e.message,'error');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Save Changes';}
  }
}
function enable2FA(){showToast('2FA setup coming soon','orange');}
function revokeSession(){showToast('Session revoked','success');}
function editNominee(){showToast('Edit nominee coming soon','orange');}
function removeNominee(){showToast('Nominee removed','success');}
function attachNomForm(){showToast('Form attached','success');}
function submitNomination(){showToast('Nomination submitted for review','success');}
function clearNomForm(){['nf-name','nf-nric','nf-dob','nf-mob'].forEach(function(i){var el=document.getElementById(i);if(el)el.value='';});}
function allocSlide(el){var lbl=document.getElementById('nf-pct-lbl');if(lbl)lbl.textContent=el.value+'%';}
function clearPwForm(){['pw-cur','pw-new','pw-cf'].forEach(function(i){var el=document.getElementById(i);if(el)el.value='';});pwStrength('');}
function togglePwVis(id){var f=document.getElementById(id);if(f)f.type=f.type==='password'?'text':'password';}

function pwStrength(v){
  var bar=document.getElementById('pw-bar'),lbl=document.getElementById('pw-lbl');
  if(!bar||!lbl)return;
  var sc=0;
  if(v.length>=8)sc++;if(v.length>=12)sc++;if(/[A-Z]/.test(v))sc++;if(/[0-9]/.test(v))sc++;if(/[^A-Za-z0-9]/.test(v))sc++;
  var pct=Math.min(100,sc*20);
  var col=sc<=1?'var(--red)':sc<=2?'var(--orange)':sc<=3?'var(--blue)':'var(--green)';
  var txt=['','Weak','Fair','Good','Strong','Strong'][sc];
  bar.style.width=pct+'%';bar.style.background=col;lbl.textContent=txt||'—';lbl.style.color=sc?col:'var(--fg-3)';
}
async function submitPwChange(){
  var nw=document.getElementById('pw-new'),cf=document.getElementById('pw-cf');
  if(!nw||!cf)return;
  if(nw.value.length<8){showToast('New password must be at least 8 characters','error');return;}
  if(nw.value!==cf.value){showToast('Passwords do not match','error');return;}
  if(typeof mpUpdatePassword!=='function'){showToast('Password service unavailable','error');return;}
  var btn=event&&event.target;
  try{
    if(btn){btn.disabled=true;btn.textContent='Updating…';}
    await mpUpdatePassword(nw.value);
    clearPwForm();
    showToast('Password updated successfully','success');
  }catch(e){
    showToast('Password update failed: '+e.message,'error');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Update Password';}
  }
}

// ── FUND OVERVIEW ─────────────────────────────────────────────────────────
function dlFactsheet(){showToast('Downloading factsheet...','success');}
function getTip(el){return el.getAttribute('data-tip');}

// ── Fund Overview chart number formatting ──────────────────────────────
// Base: #,##0.00 · 6-digit+ (100,000+): #,##0.0"k" · 9-digit+ (100,000,000+): #,##0.0"Mil" · %: 0.0%
// "Nice numbers for graph labels" (Heckbert) — picks round tick values
// (2000, 10000, ...) instead of raw data-derived fractions (17222.35, ...).
