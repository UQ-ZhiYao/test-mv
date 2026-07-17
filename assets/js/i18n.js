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
    'login.errAuthNotConfigured': 'Auth service not configured.',

    // Topbar titles for the Me tab's drilled-in sub-pages (DRILL_PAGES,
    // profile-account.js). Other DRILL_PAGES entries not listed here
    // (transaction, distribution, instrument, etc.) are out of this pass's
    // scope — t() safely returns their literal English title unchanged
    // when no matching key exists.
    'drill.password': 'Password & Security',
    'drill.inquiry': 'Online Inquiry',
    'drill.feedback': 'App Feedback',
    'drill.settings': 'Settings',

    // Me tab (me.html)
    'me.personalProfile': 'Personal Profile',
    'me.passwordSecurity': 'Password & Security',
    'me.nominee': 'Nominee',
    'me.onlineInquiry': 'Online Inquiry',
    'me.helpCenter': 'Help Center',
    'me.appFeedback': 'App Feedback',
    'me.settings': 'Settings',
    'me.logOut': 'Log Out',
    'me.footer': 'Platform services provided by ZY-Invest Investment Holdings',
    'me.badgeVerified': 'Verified Investor',
    'me.badgeUser': 'USER',

    // Settings page (settings.html)
    'settings.general': 'General',
    'settings.language': 'Language',
    'settings.languageSub': 'Applies across the app',

    // Password & Security page (password.html + its dynamic strings in
    // profile-account.js)
    'password.pageTitle': 'Password & Security',
    'password.pageSub': 'Review your security settings below. Tap Edit to make changes.',
    'password.loginPassword': 'Login Password',
    'password.edit': 'Edit',
    'password.passwordLbl': 'Password',
    'password.pinNumber': 'PIN Number',
    'password.pinLbl': 'PIN',
    'password.verifyPassword': 'Verify Password',
    'password.verifyPasswordSub': 'Enter your current password to continue.',
    'password.currentPassword': 'Current Password',
    'password.currentPasswordPlaceholder': 'Enter current password',
    'password.incorrectPassword': 'Incorrect password. Please try again.',
    'password.cancel': 'Cancel',
    'password.continue': 'Continue',
    'password.newPasswordTitle': 'New Password',
    'password.newPasswordSub': 'Choose a new password for your account.',
    'password.newPasswordLbl': 'New Password',
    'password.newPasswordPlaceholder': 'Min. 8 characters',
    'password.newPasswordErr': 'Password must be at least 8 characters.',
    'password.back': 'Back',
    'password.confirmPasswordTitle': 'Confirm Password',
    'password.confirmPasswordSub': 'Re-enter your new password to confirm.',
    'password.confirmPasswordLbl': 'Confirm Password',
    'password.confirmPasswordPlaceholder': 'Re-enter new password',
    'password.passwordMismatch': 'Passwords do not match.',
    'password.save': 'Save',
    'password.verifyPin': 'Verify PIN',
    'password.verifyPinSub': 'Enter your current PIN to continue.',
    'password.incorrectPin': 'Incorrect PIN. Please try again.',
    'password.setNewPinTitle': 'Set New PIN',
    'password.setPinTitle': 'Set PIN',
    'password.newPinSub': "Choose a 6-digit PIN. You'll use this to view your Personal Profile details.",
    'password.newPinLbl': 'New PIN',
    'password.pinMustBe6': 'PIN must be exactly 6 digits.',
    'password.confirmPinTitle': 'Confirm PIN',
    'password.confirmPinSub': 'Re-enter your new 6-digit PIN to confirm.',
    'password.confirmPinLbl': 'Confirm PIN',
    'password.pinMismatch': 'PINs do not match.',
    'password.verifying': 'Verifying…',
    'password.saving': 'Saving…',
    'password.pleaseEnterPin6': 'Please enter your 6-digit PIN.',
    'password.unableVerifyLater': 'Unable to verify — please try again later.',
    'password.toastPwUpdated': 'Password updated successfully',
    'password.toastPinUpdated': 'PIN updated successfully',
    'password.pwServiceUnavailable': 'Password service unavailable',
    'password.pinServiceUnavailable': 'PIN service unavailable',

    // Online Inquiry page (inquiry.html)
    'inquiry.pageTitle': 'Online Inquiry',
    'inquiry.pageSub': 'Reach our support team any of these ways — we usually respond within 1 business day.',
    'inquiry.email': 'Email',
    'inquiry.phone': 'Phone',

    // App Feedback page (feedback.html + submitFeedback() in misc.js)
    'feedback.pageTitle': 'App Feedback',
    'feedback.pageSub': "Tell us what's working, what isn't, or what you'd like to see — it's sent straight to our support team.",
    'feedback.subject': 'Subject',
    'feedback.selectSubject': 'Select a subject',
    'feedback.subjSecurity': 'Security & Password',
    'feedback.subjUiUx': 'UI/UX Design',
    'feedback.subjOthers': 'Others',
    'feedback.subjectErr': 'Please select a subject.',
    'feedback.yourMessage': 'Your Message',
    'feedback.messagePlaceholder': 'Write your feedback here…',
    'feedback.contentErr': 'Please write your feedback before submitting.',
    'feedback.submit': 'Submit',
    'feedback.sending': 'Sending…',
    'feedback.toastSent': 'Thanks! Your feedback has been sent.',
    'feedback.toastFailed': 'Could not send feedback: ',

    // Personal Profile page (profile.html — a genuine standalone
    // navigation, not a DRILL_PAGES tab, so it loads i18n.js directly)
    'profile.topbarTitle': 'Personal Profile',
    'profile.pageTitle': 'Update Personal Profile',
    'profile.pageSub': 'Your details are hidden for privacy. Tap "View Details" and enter your PIN to reveal them, or "Edit" to make changes.',
    'profile.basicInfo': 'Basic Information',
    'profile.edit': 'Edit',
    'profile.fullName': 'Full Name',
    'profile.icPassport': 'IC / Passport No.',
    'profile.dob': 'Date of Birth',
    'profile.gender': 'Gender',
    'profile.nationality': 'Nationality',
    'profile.contact': 'Contact',
    'profile.mobileNo': 'Mobile No.',
    'profile.email': 'Email',
    'profile.address': 'Address',
    'profile.postcode': 'Postcode',
    'profile.city': 'City',
    'profile.state': 'State',
    'profile.bankAccount': 'Bank Account',
    'profile.bankName': 'Bank Name',
    'profile.accountNo': 'Account No.',
    'profile.accountName': 'Account Name',
    'profile.viewDetails': 'View Details',
    'profile.enterPin': 'Enter PIN',
    'profile.enterPinSub': 'Enter your 6-digit PIN to view your personal details.',
    'profile.cancel': 'Cancel',
    'profile.confirm': 'Confirm',
    'profile.pinMustBe6': 'PIN must be 6 digits.',
    'profile.incorrectPin': 'Incorrect PIN. Please try again.',
    'profile.setPinFirst': 'Please set a PIN in Security settings first'
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
    'login.errAuthNotConfigured': '认证服务未配置。',

    'drill.password': '密码与安全',
    'drill.inquiry': '在线咨询',
    'drill.feedback': '应用反馈',
    'drill.settings': '设置',

    'me.personalProfile': '个人资料',
    'me.passwordSecurity': '密码与安全',
    'me.nominee': '受益人',
    'me.onlineInquiry': '在线咨询',
    'me.helpCenter': '帮助中心',
    'me.appFeedback': '应用反馈',
    'me.settings': '设置',
    'me.logOut': '退出登录',
    'me.footer': '平台服务由 ZY-Invest Investment Holdings 提供',
    'me.badgeVerified': '认证投资者',
    'me.badgeUser': '用户',

    'settings.general': '通用',
    'settings.language': '语言',
    'settings.languageSub': '适用于整个应用',

    'password.pageTitle': '密码与安全',
    'password.pageSub': '请查看下方的安全设置。点击"编辑"进行更改。',
    'password.loginPassword': '登录密码',
    'password.edit': '编辑',
    'password.passwordLbl': '密码',
    'password.pinNumber': 'PIN 码',
    'password.pinLbl': 'PIN 码',
    'password.verifyPassword': '验证密码',
    'password.verifyPasswordSub': '请输入您当前的密码以继续。',
    'password.currentPassword': '当前密码',
    'password.currentPasswordPlaceholder': '请输入当前密码',
    'password.incorrectPassword': '密码错误，请重试。',
    'password.cancel': '取消',
    'password.continue': '继续',
    'password.newPasswordTitle': '新密码',
    'password.newPasswordSub': '请为您的账户设置新密码。',
    'password.newPasswordLbl': '新密码',
    'password.newPasswordPlaceholder': '至少 8 个字符',
    'password.newPasswordErr': '密码长度至少为 8 个字符。',
    'password.back': '返回',
    'password.confirmPasswordTitle': '确认密码',
    'password.confirmPasswordSub': '请重新输入新密码以确认。',
    'password.confirmPasswordLbl': '确认密码',
    'password.confirmPasswordPlaceholder': '请重新输入新密码',
    'password.passwordMismatch': '两次输入的密码不一致。',
    'password.save': '保存',
    'password.verifyPin': '验证 PIN 码',
    'password.verifyPinSub': '请输入您当前的 PIN 码以继续。',
    'password.incorrectPin': 'PIN 码错误，请重试。',
    'password.setNewPinTitle': '设置新 PIN 码',
    'password.setPinTitle': '设置 PIN 码',
    'password.newPinSub': '请设置一个 6 位数的 PIN 码，用于查看您的个人资料详情。',
    'password.newPinLbl': '新 PIN 码',
    'password.pinMustBe6': 'PIN 码必须为 6 位数字。',
    'password.confirmPinTitle': '确认 PIN 码',
    'password.confirmPinSub': '请重新输入您的新 6 位 PIN 码以确认。',
    'password.confirmPinLbl': '确认 PIN 码',
    'password.pinMismatch': '两次输入的 PIN 码不一致。',
    'password.verifying': '验证中…',
    'password.saving': '保存中…',
    'password.pleaseEnterPin6': '请输入您的 6 位 PIN 码。',
    'password.unableVerifyLater': '暂时无法验证，请稍后重试。',
    'password.toastPwUpdated': '密码更新成功',
    'password.toastPinUpdated': 'PIN 码更新成功',
    'password.pwServiceUnavailable': '密码服务不可用',
    'password.pinServiceUnavailable': 'PIN 码服务不可用',

    'inquiry.pageTitle': '在线咨询',
    'inquiry.pageSub': '您可以通过以下任一方式联系我们的支持团队——我们通常会在 1 个工作日内回复。',
    'inquiry.email': '电子邮箱',
    'inquiry.phone': '电话',

    'feedback.pageTitle': '应用反馈',
    'feedback.pageSub': '告诉我们哪些方面做得好、哪些不足，或您希望看到的改进——您的反馈将直接发送给我们的支持团队。',
    'feedback.subject': '主题',
    'feedback.selectSubject': '请选择主题',
    'feedback.subjSecurity': '安全与密码',
    'feedback.subjUiUx': '界面/用户体验设计',
    'feedback.subjOthers': '其他',
    'feedback.subjectErr': '请选择一个主题。',
    'feedback.yourMessage': '您的留言',
    'feedback.messagePlaceholder': '请在此处输入您的反馈…',
    'feedback.contentErr': '请先填写反馈内容再提交。',
    'feedback.submit': '提交',
    'feedback.sending': '发送中…',
    'feedback.toastSent': '感谢您！反馈已发送。',
    'feedback.toastFailed': '无法发送反馈：',

    'profile.topbarTitle': '个人资料',
    'profile.pageTitle': '更新个人资料',
    'profile.pageSub': '您的详细信息因隐私原因已隐藏。点击"查看详情"并输入 PIN 码以显示，或点击"编辑"进行修改。',
    'profile.basicInfo': '基本信息',
    'profile.edit': '编辑',
    'profile.fullName': '姓名',
    'profile.icPassport': '身份证/护照号码',
    'profile.dob': '出生日期',
    'profile.gender': '性别',
    'profile.nationality': '国籍',
    'profile.contact': '联系方式',
    'profile.mobileNo': '手机号码',
    'profile.email': '电子邮箱',
    'profile.address': '地址',
    'profile.postcode': '邮政编码',
    'profile.city': '城市',
    'profile.state': '州属',
    'profile.bankAccount': '银行账户',
    'profile.bankName': '银行名称',
    'profile.accountNo': '账户号码',
    'profile.accountName': '账户名称',
    'profile.viewDetails': '查看详情',
    'profile.enterPin': '输入 PIN 码',
    'profile.enterPinSub': '请输入您的 6 位 PIN 码以查看个人详情。',
    'profile.cancel': '取消',
    'profile.confirm': '确认',
    'profile.pinMustBe6': 'PIN 码必须为 6 位数字。',
    'profile.incorrectPin': 'PIN 码错误，请重试。',
    'profile.setPinFirst': '请先在安全设置中设置 PIN 码'
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
