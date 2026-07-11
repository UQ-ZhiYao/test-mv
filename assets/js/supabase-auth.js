/* ============================================================
   ZY-Invest · Supabase client + auth helpers
   Replace SUPABASE_URL and SUPABASE_ANON with your real values
   (Supabase Dashboard → Project Settings → API).
   ============================================================ */
var SUPABASE_URL  = 'https://wvaibdjkjnnesefantjc.supabase.co';
var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2YWliZGpram5uZXNlZmFudGpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NDM3NDEsImV4cCI6MjA5NzQxOTc0MX0.tWiXzeFVDQ_iFGAcKfJ141aN1ghRHToWwrzRjwEGLgM';
var ZY_DEMO = SUPABASE_URL.indexOf('YOUR-PROJECT') !== -1;
var sb = null;
if (!ZY_DEMO && window.supabase && window.supabase.createClient) {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      autoRefreshToken: true, persistSession: true, detectSessionInUrl: true,
      // Bypasses supabase-js's cross-tab Navigator Locks mutex, which has a known
      // deadlock class (supabase/supabase-js#1594, #2013) that can hang
      // getSession()/signInWithPassword() forever if a lock is never released.
      lock: function(name, acquireTimeout, fn) { return fn(); }
    }
  });
}
function zyVerifyRedirect() { return location.origin + location.pathname.replace(/[^/]*$/, '') + 'verify.html'; }
async function zySignUp({ name, email, password }) {
  if (ZY_DEMO || !sb) { await new Promise(function(r){ setTimeout(r,700); }); try{ localStorage.setItem('zy_pending_email', email); }catch(e){} return { demo:true, needsVerification:true, email:email }; }
  var r = await sb.auth.signUp({ email:email, password:password, options:{ data:{ full_name:name }, emailRedirectTo:zyVerifyRedirect() } });
  if (r.error) throw r.error;
  try{ localStorage.setItem('zy_pending_email', email); }catch(e){}
  // Write email into the profiles row so admin can see it without joining
  // auth.users. Uses upsert (not update) so this succeeds whether or not the
  // DB trigger that's supposed to create the profiles row for this new user
  // has actually run yet — update() on a not-yet-existing row silently
  // affects 0 rows and writes nothing. Retried once with a short delay in
  // case of any timing gap, and logged (not silently swallowed) if it still
  // fails, so a broken write is actually visible instead of just quietly
  // not happening.
  if (r.data && r.data.user) {
    var writeEmail=async function(){
      var res=await sb.from('profiles').upsert({ id: r.data.user.id, email: email }, { onConflict: 'id' }).select();
      return res;
    };
    var res1=await writeEmail();
    if (res1.error || !res1.data || !res1.data.length) {
      await new Promise(function(res){ setTimeout(res,800); });
      var res2=await writeEmail();
      if (res2.error) console.warn('[zySignUp] Failed to write email to profiles:', res2.error.message);
      else if (!res2.data || !res2.data.length) console.warn('[zySignUp] Email write to profiles affected 0 rows — profiles row may not exist for this user yet.');
    }
  }
  return { needsVerification: !r.data.session, email:email, session:r.data.session };
}
async function zyVerifyFromUrl() {
  var q=new URLSearchParams(location.search), token_hash=q.get('token_hash'), type=q.get('type')||'signup';
  var hash=new URLSearchParams(location.hash.replace(/^#/,'')), hashAccess=hash.get('access_token');
  var hashErr=q.get('error_description')||hash.get('error_description');
  if (hashErr) return { status:'error', message:hashErr };
  if (ZY_DEMO || !sb) { await new Promise(function(r){ setTimeout(r,1100); }); if(token_hash||hashAccess||q.get('demo')==='ok') return {status:'success',demo:true}; return {status:'pending',demo:true}; }
  if (hashAccess) {
    var s=await sb.auth.getSession();
    if (!s.data.session) return {status:'error',message:'No active session'};
    await zyWriteEmailToProfile(s.data.session.user);
    return {status:'success'};
  }
  if (!token_hash) return { status:'pending' };
  var v=await sb.auth.verifyOtp({ token_hash:token_hash, type:type });
  if (v.error) return { status:/expired/i.test(v.error.message)?'expired':'error', message:v.error.message };
  // A real session now exists (verifyOtp signs the user in), so this write
  // can actually pass RLS — the same write attempted at signUp() time
  // fails silently there since no session/auth.uid() exists that early.
  if (v.data && v.data.user) await zyWriteEmailToProfile(v.data.user);
  return { status:'success' };
}
async function zyWriteEmailToProfile(user) {
  if (!user || !user.email) return;
  try { await sb.from('profiles').upsert({ id: user.id, email: user.email }, { onConflict: 'id' }); }
  catch(e) { console.warn('[Auth] Could not write email to profile:', e.message); }
}
async function zyResend(email) {
  if (ZY_DEMO || !sb) { await new Promise(function(r){ setTimeout(r,600); }); return { demo:true }; }
  var r=await sb.auth.resend({ type:'signup', email:email, options:{ emailRedirectTo:zyVerifyRedirect() } });
  if (r.error) throw r.error;
  return {};
}
