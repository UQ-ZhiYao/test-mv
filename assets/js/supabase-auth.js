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
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
  });
}
function zyVerifyRedirect() { return location.origin + location.pathname.replace(/[^/]*$/, '') + 'verify.html'; }
async function zySignUp({ name, email, password }) {
  if (ZY_DEMO || !sb) { await new Promise(function(r){ setTimeout(r,700); }); try{ localStorage.setItem('zy_pending_email', email); }catch(e){} return { demo:true, needsVerification:true, email:email }; }
  var r = await sb.auth.signUp({ email:email, password:password, options:{ data:{ full_name:name }, emailRedirectTo:zyVerifyRedirect() } });
  if (r.error) throw r.error;
  try{ localStorage.setItem('zy_pending_email', email); }catch(e){}
  // Write email into the profiles row so admin can see it without joining auth.users
  if (r.data && r.data.user) {
    await sb.from('profiles').update({ email: email }).eq('id', r.data.user.id);
  }
  return { needsVerification: !r.data.session, email:email, session:r.data.session };
}
async function zyVerifyFromUrl() {
  var q=new URLSearchParams(location.search), token_hash=q.get('token_hash'), type=q.get('type')||'signup';
  var hash=new URLSearchParams(location.hash.replace(/^#/,'')), hashAccess=hash.get('access_token');
  var hashErr=q.get('error_description')||hash.get('error_description');
  if (hashErr) return { status:'error', message:hashErr };
  if (ZY_DEMO || !sb) { await new Promise(function(r){ setTimeout(r,1100); }); if(token_hash||hashAccess||q.get('demo')==='ok') return {status:'success',demo:true}; return {status:'pending',demo:true}; }
  if (hashAccess) { var s=await sb.auth.getSession(); return s.data.session?{status:'success'}:{status:'error',message:'No active session'}; }
  if (!token_hash) return { status:'pending' };
  var v=await sb.auth.verifyOtp({ token_hash:token_hash, type:type });
  if (v.error) return { status:/expired/i.test(v.error.message)?'expired':'error', message:v.error.message };
  return { status:'success' };
}
async function zyResend(email) {
  if (ZY_DEMO || !sb) { await new Promise(function(r){ setTimeout(r,600); }); return { demo:true }; }
  var r=await sb.auth.resend({ type:'signup', email:email, options:{ emailRedirectTo:zyVerifyRedirect() } });
  if (r.error) throw r.error;
  return {};
}
