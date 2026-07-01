/* @ds-bundle: {"format":3,"namespace":"ZYInvestDesignSystem_5cfc8d","components":[],"sourceHashes":{"assets/js/api.js":"3d3fc22764bc","assets/js/member-api.js":"84e71a51a4d2","assets/js/site.js":"cdf19021163d","assets/js/supabase-auth.js":"e5729982d629","members/sw.js":"649a6fda96e7","sw.js":"d1db718e4b10"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.ZYInvestDesignSystem_5cfc8d = window.ZYInvestDesignSystem_5cfc8d || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// assets/js/api.js
try { (() => {
/* ============================================================
   ZY-Invest  API + Auth utilities  v1.1.0
   ============================================================ */

const API_BASE = 'https://zy-invest-api.onrender.com';

/* ── HTTP helpers ─────────────────────────────────────────── */
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('zy_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });
  if (res.status === 401) {
    authLogout();
    throw new Error('Session expired — please log in again');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}
const api = {
  get: path => apiFetch(path),
  post: (path, body) => apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(body)
  }),
  put: (path, body) => apiFetch(path, {
    method: 'PUT',
    body: JSON.stringify(body)
  }),
  delete: path => apiFetch(path, {
    method: 'DELETE'
  })
};

/* ── Auth helpers ─────────────────────────────────────────── */
function authSave(data) {
  localStorage.setItem('zy_token', data.access_token);
  localStorage.setItem('zy_role', data.role);
  localStorage.setItem('zy_name', data.name);
  localStorage.setItem('zy_investor_id', data.investor_id || '');
}
async function authLogout() {
  try {
    if (typeof sb !== 'undefined' && sb) await sb.auth.signOut();
  } catch (e) {}
  ['zy_token', 'zy_role', 'zy_name', 'zy_investor_id'].forEach(k => localStorage.removeItem(k));
  window.location.href = '/login.html';
}
function authUser() {
  return {
    token: localStorage.getItem('zy_token'),
    role: localStorage.getItem('zy_role'),
    name: localStorage.getItem('zy_name'),
    investorId: localStorage.getItem('zy_investor_id')
  };
}
function authRequired() {
  const {
    token
  } = authUser();
  if (!token) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}
function adminRequired() {
  const {
    token,
    role
  } = authUser();
  if (!token) {
    window.location.href = '/login.html';
    return false;
  }
  if (role !== 'admin') {
    window.location.href = '/dashboard/index.html';
    return false;
  }
  return true;
}

/* ── Navbar scroll effect ─────────────────────────────────── */
function initNavbar() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 10);
  });
  // Mobile toggle
  const toggle = document.querySelector('.navbar-toggle');
  const navLinks = document.querySelector('.navbar-nav');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => navLinks.classList.toggle('open'));
  }
  // Active link
  const path = window.location.pathname;
  document.querySelectorAll('.navbar-nav a').forEach(a => {
    if (a.getAttribute('href') && path.endsWith(a.getAttribute('href').split('/').pop())) {
      a.classList.add('active');
    }
  });
}

/* ── Fund overview (public) ───────────────────────────────── */
async function loadFundOverview() {
  try {
    const data = await api.get('/api/public/fund-overview');
    if (!data) return;
    // Fill any element with data-fund="key"
    document.querySelectorAll('[data-fund]').forEach(el => {
      const key = el.dataset.fund;
      if (data[key] !== undefined) {
        let val = data[key];
        if (key === 'aum') val = Number(val).toLocaleString('en-MY', {
          maximumFractionDigits: 0
        });
        if (key === 'current_nta') val = Number(val).toFixed(4);
        if (key === 'total_return_pct') val = '+' + Number(val).toFixed(2) + '%';
        if (key === 'trading_days') val = Number(val).toLocaleString() + '+';
        el.textContent = val;
      }
    });
    // Portfolio snapshot bars
    const snapshot = document.getElementById('portfolio-snapshot');
    if (snapshot && data.portfolio_snapshot) {
      snapshot.innerHTML = data.portfolio_snapshot.map(item => `
        <div class="snapshot-row">
          <div class="snapshot-label">
            <span>${item.asset_class}</span>
            <span class="snapshot-pct">${Number(item.weight_pct).toFixed(1)}%</span>
          </div>
          <div class="snapshot-bar-bg">
            <div class="snapshot-bar" style="width:${item.weight_pct}%"></div>
          </div>
        </div>
      `).join('');
    }
  } catch (e) {
    console.warn('Fund overview unavailable:', e.message);
  }
}
document.addEventListener('DOMContentLoaded', initNavbar);
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/js/api.js", error: String((e && e.message) || e) }); }

// assets/js/member-api.js
try { (() => {
/* ============================================================
   ZY-Invest Member Portal — API Integration Layer
   Wraps Supabase queries for all member portal data.
   Requires supabase-auth.js (sb client) loaded first.
   ============================================================ */

/* ── Auth guard ──────────────────────────────────────────── */
async function mpCheckAuth() {
  try {
    if (!sb) throw new Error('Supabase not initialised');
    const {
      data
    } = await sb.auth.getSession();
    if (!data.session) return null;
    return data.session.user;
  } catch (e) {
    return null;
  }
}

/* ── Profile ─────────────────────────────────────────────── */
async function mpLoadProfile(userId) {
  const {
    data,
    error
  } = await sb.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}
async function mpSaveProfile(userId, updates) {
  const {
    error
  } = await sb.from('profiles').update(updates).eq('id', userId);
  if (error) throw error;
}

/* ── NTA History ─────────────────────────────────────────── */
async function mpLoadNTA() {
  const {
    data,
    error
  } = await sb.from('nta_history').select('date, nta_value').order('date', {
    ascending: true
  });
  if (error) throw error;
  // Group into 1D / 1Y / 3Y / max periods
  const all = data || [];
  const vals = all.map(r => parseFloat(r.nta_value));
  const lbls = all.map(r => r.date);
  const now = new Date();
  function since(months) {
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - months);
    return all.filter(r => new Date(r.date) >= cutoff);
  }
  const d1d = since(1); // last month as proxy for "daily" data
  const d1y = since(12);
  const d3y = since(36);
  return {
    max: {
      v: vals,
      l: lbls
    },
    '3y': {
      v: since(36).map(r => parseFloat(r.nta_value)),
      l: since(36).map(r => r.date)
    },
    '1y': {
      v: since(12).map(r => parseFloat(r.nta_value)),
      l: since(12).map(r => r.date)
    },
    '1d': {
      v: d1d.map(r => parseFloat(r.nta_value)),
      l: d1d.map(r => r.date)
    }
  };
}

/* ── Portfolio / Holdings ────────────────────────────────── */
async function mpLoadHoldings(investorId) {
  const {
    data,
    error
  } = await sb.from('portfolios').select('*, instruments(name, ticker, sector, instrument_type)').eq('investor_id', investorId).order('allocation_pct', {
    ascending: false
  });
  if (error) throw error;
  return (data || []).map(function (p) {
    const inst = p.instruments || {};
    return {
      n: inst.name || p.instrument_name || 'Unknown',
      t: inst.ticker || p.ticker || '—',
      sec: inst.sector || p.sector || 'Unknown',
      inst: inst.instrument_type || p.instrument_type || 'Other',
      units: p.units_held ? parseFloat(p.units_held) : null,
      cost: p.avg_cost ? parseFloat(p.avg_cost) : null,
      px: p.market_price ? parseFloat(p.market_price) : null,
      al: p.allocation_pct ? parseFloat(p.allocation_pct) : 0
    };
  });
}

/* ── Transactions ────────────────────────────────────────── */
async function mpLoadTransactions(investorId) {
  const {
    data,
    error
  } = await sb.from('transactions').select('*').eq('investor_id', investorId).order('transaction_date', {
    ascending: false
  });
  if (error) throw error;
  return (data || []).map(function (t) {
    return {
      ref: t.reference_no || t.id,
      type: t.transaction_type,
      // 'Subscription' | 'Redemption'
      date: formatDate(t.transaction_date),
      units: t.units > 0 ? '+' + parseFloat(t.units).toFixed(4) : parseFloat(t.units).toFixed(4),
      nav: parseFloat(t.nav_price).toFixed(4),
      amt: t.transaction_type === 'Redemption' ? '\u2212RM ' + Math.abs(parseFloat(t.amount)).toLocaleString('en-MY', {
        minimumFractionDigits: 2
      }) : '+RM ' + parseFloat(t.amount).toLocaleString('en-MY', {
        minimumFractionDigits: 2
      }),
      status: t.status || 'Completed'
    };
  });
}

/* ── Distributions ───────────────────────────────────────── */
async function mpLoadDistributions(investorId) {
  const {
    data,
    error
  } = await sb.from('distributions').select('*').eq('investor_id', investorId).order('ex_date', {
    ascending: false
  });
  if (error) throw error;
  return (data || []).map(function (d) {
    return {
      fy: d.financial_year,
      type: d.distribution_type,
      // 'Final' | 'Interim' | 'Special'
      ex: formatDate(d.ex_date),
      pay: formatDate(d.payment_date),
      dps: parseFloat(d.dps_sen).toFixed(2),
      amt: parseFloat(d.amount),
      status: d.status || 'Paid'
    };
  });
}

/* ── Documents ───────────────────────────────────────────── */
async function mpLoadDocuments() {
  const {
    data,
    error
  } = await sb.from('documents').select('*').order('document_date', {
    ascending: false
  });
  if (error) throw error;
  return (data || []).map(function (d) {
    return {
      n: d.title,
      type: d.document_type,
      // 'Factsheet' | 'Annual Report' | 'Statement'
      date: formatDate(d.document_date),
      sz: d.file_size || '—',
      url: d.file_url || null
    };
  });
}

/* ── Nominees ────────────────────────────────────────────── */
async function mpLoadNominees(investorId) {
  const {
    data,
    error
  } = await sb.from('nominees').select('*').eq('investor_id', investorId).order('is_primary', {
    ascending: false
  });
  if (error) throw error;
  return (data || []).map(function (n) {
    return {
      name: n.full_name,
      rel: n.relationship,
      nric: n.nric_passport,
      dob: n.date_of_birth,
      mob: n.mobile,
      alloc: parseFloat(n.allocation_pct)
    };
  });
}
async function mpSaveNominee(investorId, nominee) {
  if (nominee.id) {
    const {
      error
    } = await sb.from('nominees').update(nominee).eq('id', nominee.id);
    if (error) throw error;
  } else {
    const {
      error
    } = await sb.from('nominees').insert({
      ...nominee,
      investor_id: investorId
    });
    if (error) throw error;
  }
}
async function mpDeleteNominee(nomineeId) {
  const {
    error
  } = await sb.from('nominees').delete().eq('id', nomineeId);
  if (error) throw error;
}

/* ── Subscribe / Redeem ──────────────────────────────────── */
async function mpSubmitSubscription(investorId, {
  amount,
  receiptUrl,
  note
}) {
  const {
    error
  } = await sb.from('subscription_requests').insert({
    investor_id: investorId,
    amount: parseFloat(amount),
    receipt_url: receiptUrl || null,
    note: note || null,
    status: 'Pending',
    requested_at: new Date().toISOString()
  });
  if (error) throw error;
}
async function mpSubmitRedemption(investorId, {
  amount,
  units,
  note
}) {
  const {
    error
  } = await sb.from('redemption_requests').insert({
    investor_id: investorId,
    amount: parseFloat(amount),
    units: parseFloat(units),
    note: note || null,
    status: 'Pending',
    requested_at: new Date().toISOString()
  });
  if (error) throw error;
}

/* ── Shareholders (fund-wide, public/member-read) ────────── */
async function mpLoadShareholders() {
  const {
    data,
    error
  } = await sb.from('profiles').select('investor_id, full_name, account_type, units_held, joined_date, status').order('units_held', {
    ascending: false
  });
  if (error) throw error;
  return data || [];
}

/* ── Fund Overview (public) ──────────────────────────────── */
async function mpLoadFundOverview() {
  const {
    data,
    error
  } = await sb.from('fund_overview').select('*').single();
  if (error) throw error;
  return data;
}

/* ── Password update ─────────────────────────────────────── */
async function mpUpdatePassword(newPassword) {
  const {
    error
  } = await sb.auth.updateUser({
    password: newPassword
  });
  if (error) throw error;
}

/* ── Notifications ───────────────────────────────────────── */
async function mpLoadNotifications(investorId) {
  const {
    data,
    error
  } = await sb.from('notifications').select('*').eq('investor_id', investorId).order('created_at', {
    ascending: false
  }).limit(20);
  if (error) return []; // soft fail
  return data || [];
}

/* ── Helpers ─────────────────────────────────────────────── */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/* ── Load all member data in parallel ────────────────────── */
async function mpLoadAll(user, investorId) {
  const [profile, holdings, transactions, distributions, documents, nominees, notifications] = await Promise.allSettled([mpLoadProfile(user.id), mpLoadHoldings(investorId), mpLoadTransactions(investorId), mpLoadDistributions(investorId), mpLoadDocuments(), mpLoadNominees(investorId), mpLoadNotifications(investorId)]);
  return {
    profile: profile.value || null,
    holdings: holdings.value || [],
    transactions: transactions.value || [],
    distributions: distributions.value || [],
    documents: documents.value || [],
    nominees: nominees.value || [],
    notifications: notifications.value || []
  };
}
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/js/member-api.js", error: String((e && e.message) || e) }); }

// assets/js/site.js
try { (() => {
/* ===== NAV scroll state ===== */
(function () {
  var nav = document.getElementById('nav');
  if (!nav) return;
  function onScroll() {
    nav.classList.toggle('scrolled', window.scrollY > 24);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, {
    passive: true
  });
})();

/* ===== MOBILE MENU (hamburger) ===== */
(function () {
  var b = document.getElementById('navBurger'),
    m = document.getElementById('mobileMenu'),
    c = document.getElementById('mmClose');
  if (!b || !m) return;
  function open() {
    m.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    m.classList.remove('open');
    document.body.style.overflow = '';
  }
  b.addEventListener('click', open);
  if (c) c.addEventListener('click', close);
  m.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', close);
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });
})();

/* ===== Reveal on scroll ===== */
(function () {
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, {
    threshold: .14,
    rootMargin: '0px 0px -8% 0px'
  });
  document.querySelectorAll('.reveal:not(.in)').forEach(function (el) {
    if (!el.closest('.hero')) io.observe(el);
  });
})();

/* ===== LOGIN → DASHBOARD TRANSITION ===== */
/* The progress effect no longer plays on page load anywhere. It runs ONLY when the
   login form succeeds, as a transition into the dashboard. Exposed as window.zyEnterDashboard. */
window.zyEnterDashboard = function (dest) {
  var ld = document.getElementById('loader');
  if (!ld) {
    window.location.href = dest;
    return;
  }
  var pctEl = document.getElementById('ldPct'),
    progEl = document.getElementById('ldProg'),
    loadEl = document.getElementById('ldLoad');
  document.body.classList.add('loading');
  ld.style.display = 'block';
  var C = 364.4,
    done = false;
  if (loadEl) {
    loadEl.textContent = 'entering';
  }
  var dotT = setInterval(function () {
    if (!loadEl) return;
    var n = (loadEl.textContent.replace('entering', '').match(/\./g) || []).length;
    loadEl.textContent = 'entering' + '.'.repeat((n + 1) % 4);
  }, 300);
  var reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var startT = performance.now(),
    DUR = reduce ? 500 : 1500;
  function ease(x) {
    return 1 - Math.pow(1 - x, 3);
  }
  function go() {
    window.location.href = dest;
  }
  function tick(now) {
    var k = Math.min(1, (now - startT) / DUR),
      v = Math.round(ease(k) * 100);
    if (pctEl) pctEl.textContent = v + '%';
    if (progEl) progEl.setAttribute('stroke-dashoffset', C * (1 - v / 100));
    if (k < 1) {
      requestAnimationFrame(tick);
    } else if (!done) {
      finish();
    }
  }
  function finish() {
    if (done) return;
    done = true;
    clearInterval(dotT);
    if (pctEl) pctEl.textContent = '100%';
    if (progEl) progEl.setAttribute('stroke-dashoffset', 0);
    setTimeout(go, 420);
  }
  ld.addEventListener('click', function () {
    if (!done) {
      done = true;
      clearInterval(dotT);
      go();
    }
  });
  requestAnimationFrame(tick);
};

/* ===== LIVE WALLPAPER ===== */
(function () {
  var c = document.getElementById('wp');
  if (!c) return;
  var ctx = c.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var W = 0,
    H = 0,
    DPR = Math.min(window.devicePixelRatio || 1, 2);
  var orbs = [{
    x: .18,
    y: .30,
    r: .45,
    col: [21, 101, 192],
    a: .16,
    sx: .018,
    sy: .013,
    p: 0
  }, {
    x: .74,
    y: .24,
    r: .40,
    col: [30, 136, 229],
    a: .13,
    sx: .014,
    sy: .020,
    p: 1.7
  }, {
    x: .55,
    y: .62,
    r: .42,
    col: [46, 125, 50],
    a: .11,
    sx: .020,
    sy: .012,
    p: 3.1
  }, {
    x: .90,
    y: .70,
    r: .34,
    col: [230, 81, 0],
    a: .07,
    sx: .012,
    sy: .017,
    p: 4.6
  }];
  var pts = [];
  var waves = [{
    base: .46,
    amp: 54,
    len: .0017,
    sp: .020,
    col: 'rgba(21,101,192,0.065)'
  }, {
    base: .58,
    amp: 78,
    len: .0012,
    sp: .015,
    col: 'rgba(30,136,229,0.07)'
  }, {
    base: .70,
    amp: 66,
    len: .0021,
    sp: .027,
    col: 'rgba(46,125,50,0.055)'
  }, {
    base: .82,
    amp: 58,
    len: .0015,
    sp: .012,
    col: 'rgba(230,81,0,0.035)'
  }];
  function reset() {
    W = c.clientWidth;
    H = c.clientHeight;
    c.width = W * DPR;
    c.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var n = Math.round(Math.min(64, Math.max(28, W / 26)));
    pts = [];
    for (var i = 0; i < n; i++) {
      pts.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.82,
        vx: (Math.random() - .5) * .16,
        vy: (Math.random() - .5) * .16,
        r: Math.random() * 1.6 + 0.8
      });
    }
  }
  function drawOrbs(t) {
    for (var i = 0; i < orbs.length; i++) {
      var o = orbs[i];
      var cx = (o.x + Math.sin(t * o.sx + o.p) * .05) * W;
      var cy = (o.y + Math.cos(t * o.sy + o.p) * .05) * H;
      var rad = o.r * Math.max(W, H);
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, 'rgba(' + o.col[0] + ',' + o.col[1] + ',' + o.col[2] + ',' + o.a + ')');
      g.addColorStop(1, 'rgba(' + o.col[0] + ',' + o.col[1] + ',' + o.col[2] + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }
  function drawWaves(t) {
    for (var k = 0; k < waves.length; k++) {
      var w = waves[k];
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (var x = 0; x <= W; x += 14) {
        var y = w.base * H + Math.sin(x * w.len + t * w.sp) * w.amp + Math.sin(x * w.len * 2.3 + t * w.sp * 0.6) * w.amp * 0.32;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      var g = ctx.createLinearGradient(0, w.base * H - w.amp, 0, H);
      g.addColorStop(0, w.col);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fill();
    }
  }
  function drawNet() {
    var maxd = 128;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      for (var j = i + 1; j < pts.length; j++) {
        var q = pts[j],
          dx = p.x - q.x,
          dy = p.y - q.y,
          d = Math.sqrt(dx * dx + dy * dy);
        if (d < maxd) {
          ctx.strokeStyle = 'rgba(21,101,192,' + 0.10 * (1 - d / maxd) + ')';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(21,101,192,0.42)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      ctx.fill();
    }
  }
  function step(p) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -1;
    if (p.y < 0 || p.y > H * 0.84) p.vy *= -1;
  }
  var t = 0,
    raf;
  function frame() {
    ctx.clearRect(0, 0, W, H);
    drawOrbs(t);
    drawWaves(t);
    if (document.body.classList.contains('motion')) for (var i = 0; i < pts.length; i++) step(pts[i]);
    drawNet();
    t += document.body.classList.contains('motion') ? 1 : 0;
    raf = requestAnimationFrame(frame);
  }
  function start() {
    reset();
    cancelAnimationFrame(raf);
    if (reduce) {
      ctx.clearRect(0, 0, W, H);
      drawOrbs(0);
      drawWaves(0);
      drawNet();
    } else {
      frame();
    }
  }
  window.addEventListener('resize', function () {
    clearTimeout(window.__wpz);
    window.__wpz = setTimeout(start, 180);
  });
  start();
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/js/site.js", error: String((e && e.message) || e) }); }

// assets/js/supabase-auth.js
try { (() => {
/* ============================================================
   ZY-Invest · Supabase client + auth helpers
   Replace SUPABASE_URL and SUPABASE_ANON with your real values
   (Supabase Dashboard → Project Settings → API).
   ============================================================ */
var SUPABASE_URL = 'https://wvaibdjkjnnesefantjc.supabase.co';
var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2YWliZGpram5uZXNlZmFudGpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NDM3NDEsImV4cCI6MjA5NzQxOTc0MX0.tWiXzeFVDQ_iFGAcKfJ141aN1ghRHToWwrzRjwEGLgM';
var ZY_DEMO = SUPABASE_URL.indexOf('YOUR-PROJECT') !== -1;
var sb = null;
if (!ZY_DEMO && window.supabase && window.supabase.createClient) {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });
}
function zyVerifyRedirect() {
  return location.origin + location.pathname.replace(/[^/]*$/, '') + 'verify.html';
}
async function zySignUp({
  name,
  email,
  password
}) {
  if (ZY_DEMO || !sb) {
    await new Promise(function (r) {
      setTimeout(r, 700);
    });
    try {
      localStorage.setItem('zy_pending_email', email);
    } catch (e) {}
    return {
      demo: true,
      needsVerification: true,
      email: email
    };
  }
  var r = await sb.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        full_name: name
      },
      emailRedirectTo: zyVerifyRedirect()
    }
  });
  if (r.error) throw r.error;
  try {
    localStorage.setItem('zy_pending_email', email);
  } catch (e) {}
  // Write email into the profiles row so admin can see it without joining auth.users
  if (r.data && r.data.user) {
    await sb.from('profiles').update({
      email: email
    }).eq('id', r.data.user.id);
  }
  return {
    needsVerification: !r.data.session,
    email: email,
    session: r.data.session
  };
}
async function zyVerifyFromUrl() {
  var q = new URLSearchParams(location.search),
    token_hash = q.get('token_hash'),
    type = q.get('type') || 'signup';
  var hash = new URLSearchParams(location.hash.replace(/^#/, '')),
    hashAccess = hash.get('access_token');
  var hashErr = q.get('error_description') || hash.get('error_description');
  if (hashErr) return {
    status: 'error',
    message: hashErr
  };
  if (ZY_DEMO || !sb) {
    await new Promise(function (r) {
      setTimeout(r, 1100);
    });
    if (token_hash || hashAccess || q.get('demo') === 'ok') return {
      status: 'success',
      demo: true
    };
    return {
      status: 'pending',
      demo: true
    };
  }
  if (hashAccess) {
    var s = await sb.auth.getSession();
    return s.data.session ? {
      status: 'success'
    } : {
      status: 'error',
      message: 'No active session'
    };
  }
  if (!token_hash) return {
    status: 'pending'
  };
  var v = await sb.auth.verifyOtp({
    token_hash: token_hash,
    type: type
  });
  if (v.error) return {
    status: /expired/i.test(v.error.message) ? 'expired' : 'error',
    message: v.error.message
  };
  return {
    status: 'success'
  };
}
async function zyResend(email) {
  if (ZY_DEMO || !sb) {
    await new Promise(function (r) {
      setTimeout(r, 600);
    });
    return {
      demo: true
    };
  }
  var r = await sb.auth.resend({
    type: 'signup',
    email: email,
    options: {
      emailRedirectTo: zyVerifyRedirect()
    }
  });
  if (r.error) throw r.error;
  return {};
}
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/js/supabase-auth.js", error: String((e && e.message) || e) }); }

// members/sw.js
try { (() => {
/* ZY-Invest Member Portal — service worker (offline shell for installability) */
const CACHE = 'zy-member-v1';
const ASSETS = ['index.html', 'manifest.webmanifest', '../../assets/img/logo.png', '../../assets/img/icon-192.png', '../../assets/img/icon-512.png', '../../assets/img/apple-touch-icon.png', '../../styles.css'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(fetch(req).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
    return res;
  }).catch(() => caches.match(req).then(hit => hit || caches.match('index.html'))));
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "members/sw.js", error: String((e && e.message) || e) }); }

// sw.js
try { (() => {
/* ZY-Invest — root service worker */
const CACHE = 'zy-v1';
const SHELL = ['/', 'login.html', 'members/desktop/dashboard.html', 'manifest.webmanifest', 'assets/css/site.css', 'assets/js/site.js', 'assets/js/supabase-auth.js', 'assets/js/api.js', 'assets/js/member-api.js', 'assets/img/logo.png', 'assets/img/icon-192.png', 'assets/img/icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {
    caches.open(CACHE).then(c => c.put(e.request, r.clone())).catch(() => {});
    return r;
  }).catch(() => caches.match(e.request).then(h => h || caches.match('login.html'))));
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "sw.js", error: String((e && e.message) || e) }); }

})();
