/* ===== assets/js/i18n.js — lightweight i18n layer =====
   Proof of concept, scoped to phone/login.html for now before expanding
   to the rest of the app. Language choice persists in localStorage so it
   would carry across any other page that also loads this script.

   Usage on a page:
     - Give an element data-i18n="key" — its innerHTML is replaced with
       the translated string (dictionary entries are static strings this
       file defines, not user input, so embedding markup like <br> in a
       value is safe).
     - Give an <input>/<textarea> data-i18n-placeholder="key" to translate
       its placeholder instead (innerHTML doesn't apply to those).
     - Give a language-switcher button data-i18n-lang-btn="en" (or "zh")
       and applyI18n() will toggle an "i18n-lang-active" class on whichever
       one matches the active language — style that class yourself in the
       page's own CSS (different pages use this against different
       backgrounds, so there's no one right "selected" look to hardcode
       here).
     - Call t('some.key') from your own JS for strings you set dynamically
       (error messages, button label swaps, etc.) instead of hardcoding
       English.
   Load this script right after your visible markup (not deferred) so it
   runs synchronously before the page paints far along — keeps the
   English-then-translated flash to a minimum without needing a build
   step or server-side rendering. */
var I18N_DICT = {
  en: {
    'login.memberPortal': 'Member Portal',
    'login.welcomeBack': 'Welcome<br>Back',
    'login.heroSub': 'Access your personalised investment dashboard and track your portfolio.',
    'login.feat1': 'Real-time portfolio valuation',
    'login.feat2': 'Daily NTA updates',
    'login.feat3': 'Distribution history & documents',
    'login.signIn': 'Sign In',
    'login.cardSub': 'Enter your credentials to continue',
    'login.emailLabel': 'Email Address',
    'login.emailPlaceholder': 'your@email.com',
    'login.pwdLabel': 'Password',
    'login.pwdPlaceholder': 'Enter your password',
    'login.forgotPwd': 'Forgot password?',
    'login.signingIn': 'Signing in…',
    'login.newMember': 'New member?',
    'login.registerLink': 'Register an account',
    'login.backToSite': 'Back to site',
    'login.errEmptyFields': 'Please enter your email and password.',
    'login.errInvalidCreds': 'Incorrect email or password. Please try again.',
    'login.errGeneric': 'Login failed. Please try again.',
    'login.errAuthNotConfigured': 'Auth service not configured.'
  },
  zh: {
    'login.memberPortal': '会员门户',
    'login.welcomeBack': '欢迎回来',
    'login.heroSub': '访问您的个性化投资仪表板，追踪您的投资组合。',
    'login.feat1': '实时投资组合估值',
    'login.feat2': '每日资产净值更新',
    'login.feat3': '分红记录与文件',
    'login.signIn': '登录',
    'login.cardSub': '请输入您的登录信息以继续',
    'login.emailLabel': '电子邮箱',
    'login.emailPlaceholder': 'your@email.com',
    'login.pwdLabel': '密码',
    'login.pwdPlaceholder': '请输入密码',
    'login.forgotPwd': '忘记密码？',
    'login.signingIn': '登录中…',
    'login.newMember': '新会员？',
    'login.registerLink': '注册账户',
    'login.backToSite': '返回网站',
    'login.errEmptyFields': '请输入您的电子邮箱和密码。',
    'login.errInvalidCreds': '电子邮箱或密码错误，请重试。',
    'login.errGeneric': '登录失败，请重试。',
    'login.errAuthNotConfigured': '认证服务未配置。'
  }
};
var I18N_SUPPORTED = ['en', 'zh'];

function i18nGetLang(){
  try{
    var saved = localStorage.getItem('zy_lang');
    if(saved && I18N_SUPPORTED.indexOf(saved) !== -1) return saved;
  }catch(e){}
  return 'en';
}
// Falls back to English, then to the key itself, so a missing translation
// never renders as blank.
function t(key){
  var dict = I18N_DICT[i18nGetLang()] || I18N_DICT.en;
  return dict[key] || I18N_DICT.en[key] || key;
}
function applyI18n(){
  var lang = i18nGetLang();
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(function(el){
    el.innerHTML = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el){
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  document.querySelectorAll('[data-i18n-lang-btn]').forEach(function(btn){
    var active = btn.getAttribute('data-i18n-lang-btn') === lang;
    btn.classList.toggle('i18n-lang-active', active);
  });
}
function i18nSetLang(lang){
  if(I18N_SUPPORTED.indexOf(lang) === -1) return;
  try{ localStorage.setItem('zy_lang', lang); }catch(e){}
  applyI18n();
}
// Run immediately (this script is placed after the visible markup it
// targets, so those elements already exist) and again on DOMContentLoaded
// as a safety net for any future page that loads this script earlier.
applyI18n();
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', applyI18n);
}
