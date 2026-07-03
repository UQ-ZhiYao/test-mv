/* ============================================================
   ZY-Invest Member Portal — API Integration Layer
   Wraps Supabase queries for all member portal data.
   Requires supabase-auth.js (sb client) loaded first.
   ============================================================ */

/* ── Auth guard ──────────────────────────────────────────── */
async function mpCheckAuth() {
  try {
    if (!sb) throw new Error('Supabase not initialised');
    const { data } = await sb.auth.getSession();
    if (!data.session) return null;
    return data.session.user;
  } catch(e) { return null; }
}

/* ── Profile ─────────────────────────────────────────────── */
async function mpLoadProfile(userId) {
  const { data, error } = await sb.from('profiles')
    .select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

async function mpSaveProfile(userId, updates) {
  const { error } = await sb.from('profiles')
    .update(updates).eq('id', userId);
  if (error) throw error;
}

/* ── NTA History (from nta_daily: date, nta) ────────────────
   Buckets: YTD / 1Y / 3Y / ALL (no 1D — daily granularity IS the data)
   Paginated: a daily table since fund inception easily exceeds
   PostgREST's default ~1000-row response cap, which silently
   truncated the series (e.g. stopping years short of "today"). */
async function mpLoadNTA() {
  const pageSize = 1000;
  let all = [];
  let page = 0;
  while (true) {
    const { data, error } = await sb.from('nta_daily')
      .select('date, nta')
      .order('date', { ascending: true })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw error;
    if (!data || !data.length) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  all = all.filter(r => r.date && r.nta !== null && r.nta !== undefined);
  const now = new Date();

  function bucket(rows) {
    if (!rows.length) return { v: [1, 1], l: ['—', '—'] };
    if (rows.length === 1) return { v: [parseFloat(rows[0].nta), parseFloat(rows[0].nta)], l: [rows[0].date, rows[0].date] };
    return { v: rows.map(r => parseFloat(r.nta)), l: rows.map(r => r.date) };
  }
  function since(dateFrom) {
    return all.filter(r => new Date(r.date) >= dateFrom);
  }

  const ytdFrom = new Date(now.getFullYear(), 0, 1);
  const oneYFrom = new Date(now); oneYFrom.setFullYear(oneYFrom.getFullYear() - 1);
  const threeYFrom = new Date(now); threeYFrom.setFullYear(threeYFrom.getFullYear() - 3);

  return {
    ytd: bucket(since(ytdFrom)),
    '1y': bucket(since(oneYFrom)),
    '3y': bucket(since(threeYFrom)),
    all: bucket(all)
  };
}

/* ── Portfolio / Holdings (fund-wide: portfolio + instruments) ──
   portfolio: instrument_name, product, units, total_cost, vwap_cost,
              market_value, latest_price, unrealised_pnl
   instruments: name, ticker, code, product, sector, currency
   (joined client-side on instrument_name === instruments.name) */
async function mpLoadHoldings(investorId) {
  const [pfRes, inRes] = await Promise.all([
    sb.from('portfolio')
      .select('instrument_name, product, units, total_cost, vwap_cost, market_value, latest_price, unrealised_pnl'),
    sb.from('instruments')
      .select('name, ticker, code, product, sector, currency')
  ]);
  if (pfRes.error) throw pfRes.error;
  const instByName = {};
  (inRes.data || []).forEach(function(i) { instByName[i.name] = i; });

  const CASH_NAME = 'MYR Cash Account';
  const rows = (pfRes.data || []).map(function(p) {
    const inst = instByName[p.instrument_name] || {};
    const isCash = p.instrument_name === CASH_NAME;
    const mv = parseFloat(p.market_value || p.total_cost || 0);
    const tk = (inst.ticker || '').trim();
    const co = (inst.code || '').trim();
    const subLine = isCash ? 'MYR' : (tk && co && tk !== co ? (tk + ' | ' + co) : (tk || co || '—'));
    return {
      n:    p.instrument_name || 'Unknown',
      t:    subLine,
      ticker: tk || '—',
      code: co || '—',
      sec:  isCash ? 'Cash' : (inst.sector || 'Unknown'),
      inst: p.product || inst.product || 'Other',
      units: p.units != null ? parseFloat(p.units) : null,
      cost:  p.vwap_cost != null ? parseFloat(p.vwap_cost) : null,
      px:    p.latest_price != null ? parseFloat(p.latest_price) : null,
      mv:    mv,
      pnl:   isCash ? 0 : (p.unrealised_pnl != null ? parseFloat(p.unrealised_pnl) : 0),
      isCash: isCash
    };
  });

  // Non-cash first, cash last — mirrors admin portfolio ordering
  const nonCash = rows.filter(r => !r.isCash);
  const cash    = rows.filter(r => r.isCash);
  const ordered = nonCash.concat(cash);

  const totalMV = ordered.reduce((s, r) => s + (r.mv || 0), 0);
  ordered.forEach(function(r) { r.al = totalMV > 0 ? (r.mv / totalMV) * 100 : 0; });
  ordered.sort(function(a, b) {
    if (a.isCash !== b.isCash) return a.isCash ? 1 : -1;
    return (b.al || 0) - (a.al || 0);
  });
  return ordered;
}

/* ── Capital Summary (Units Held, AVCO Avg Cost, Total Cost) ──
   Units Held = direct sum of signed units from Approved capital_injection.
   Avg Cost   = AVCO over the same Approved rows in date order:
                Subscriptions add to the cost pool, Redemptions draw
                down units+cost at the running average (never at the
                redemption's own price) — same method used for trade
                settlement in the admin repo.
   Total Cost = Avg Cost × Units Held.                                */
async function mpLoadCapitalSummary(userId) {
  const { data, error } = await sb.from('capital_injection')
    .select('type, amount, units, date, status')
    .eq('uid', userId)
    .eq('status', 'Approved')
    .order('date', { ascending: true });
  if (error) throw error;
  const rows = data || [];

  const unitsHeld = rows.reduce((s, r) => s + (parseFloat(r.units) || 0), 0);

  let runUnits = 0, runCost = 0;
  rows.forEach(function(r) {
    const u = parseFloat(r.units) || 0;
    if (u > 0) {
      runCost  += Math.abs(parseFloat(r.amount) || 0);
      runUnits += u;
    } else if (u < 0 && runUnits > 0) {
      const sellUnits = Math.min(Math.abs(u), runUnits);
      const avgCost = runCost / runUnits;
      runUnits -= sellUnits;
      runCost   = runUnits > 0 ? runCost - avgCost * sellUnits : 0;
    }
  });
  const avgCost   = runUnits > 0 ? runCost / runUnits : 0;
  const totalCost = avgCost * unitsHeld;

  return { unitsHeld: unitsHeld, avgCost: avgCost, totalCost: totalCost };
}

/* ── Transactions (from capital_injection — this member's own rows) ── */
async function mpLoadTransactions(userId) {
  const { data, error } = await sb.from('capital_injection')
    .select('reference_id, type, amount, units, nta, date, status')
    .eq('uid', userId)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data || []).map(function(t) {
    const units = parseFloat(t.units) || 0;
    const amt = parseFloat(t.amount) || 0;
    return {
      ref:    t.reference_id || '—',
      type:   t.type,   // 'Subscription' | 'Redemption'
      date:   formatDate(t.date),
      dateRaw: t.date,
      units:  t.type === 'Redemption' ? '\u2212' + Math.abs(units).toFixed(4) : '+' + Math.abs(units).toFixed(4),
      unitsRaw: t.type === 'Redemption' ? -Math.abs(units) : Math.abs(units),
      nav:    t.nta != null ? parseFloat(t.nta).toFixed(4) : '—',
      amt:    t.type === 'Redemption'
              ? '\u2212RM ' + Math.abs(amt).toLocaleString('en-MY',{minimumFractionDigits:2})
              : '+RM ' + Math.abs(amt).toLocaleString('en-MY',{minimumFractionDigits:2}),
      amtRaw: t.type === 'Redemption' ? -Math.abs(amt) : Math.abs(amt),
      status: t.status || 'Pending'
    };
  });
}

/* ── Distributions ───────────────────────────────────────────
   Fund-wide `distributions` rows; each member's entitlement is
   computed (not stored) from their approved capital_injection
   units as at the distribution's ex-date — same logic as the
   admin/member repo: myUnits = sum(units) where date <= ex_date,
   myAmount = myUnits>0 ? myUnits * dps/100 : 0.                */
async function mpLoadDistributions(userId) {
  const [distRes, ciRes] = await Promise.all([
    sb.from('distributions')
      .select('fy, type, ex_date, pay_date, dps, status')
      .order('ex_date', { ascending: false }),
    sb.from('capital_injection')
      .select('units, date')
      .eq('uid', userId)
      .eq('status', 'Approved')
      .order('date', { ascending: true })
  ]);
  if (distRes.error) throw distRes.error;
  const dists = distRes.data || [];
  const myCI  = ciRes.data || [];

  return dists.map(function(d) {
    const exDate = d.ex_date;
    let myUnits = 0;
    myCI.forEach(function(r) {
      if (r.date && exDate && r.date <= exDate) myUnits += parseFloat(r.units) || 0;
    });
    myUnits = Math.max(0, myUnits);
    const dps = parseFloat(d.dps) || 0;
    const myAmount = myUnits > 0 ? myUnits * (dps / 100) : 0;
    return {
      fy:      d.fy,
      type:    d.type,    // 'Final' | 'Interim' | 'Special'
      ex:      formatDate(d.ex_date),
      pay:     formatDate(d.pay_date),
      exRaw:   d.ex_date,
      payRaw:  d.pay_date,
      dps:     dps.toFixed(2),
      units:   myUnits,
      amt:     myAmount,
      status:  d.status || 'Pending'
    };
  });
}

/* ── Documents ───────────────────────────────────────────── */
async function mpLoadDocuments() {
  const { data, error } = await sb.from('documents')
    .select('*')
    .order('document_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(function(d) {
    return {
      n:    d.title,
      type: d.document_type,   // 'Factsheet' | 'Annual Report' | 'Statement'
      date: formatDate(d.document_date),
      sz:   d.file_size || '—',
      url:  d.file_url  || null
    };
  });
}

/* ── Nominees ────────────────────────────────────────────── */
async function mpLoadNominees(investorId) {
  const { data, error } = await sb.from('nominees')
    .select('*')
    .eq('investor_id', investorId)
    .order('is_primary', { ascending: false });
  if (error) throw error;
  return (data || []).map(function(n) {
    return {
      id:    n.id,
      name:  n.full_name,
      rel:   n.relationship,
      nric:  n.nric_passport,
      dob:   n.date_of_birth,
      mob:   n.mobile,
      alloc: parseFloat(n.allocation_pct)
    };
  });
}

async function mpSaveNominee(investorId, nominee) {
  if (nominee.id) {
    const { error } = await sb.from('nominees')
      .update(nominee).eq('id', nominee.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from('nominees')
      .insert({ ...nominee, investor_id: investorId });
    if (error) throw error;
  }
}

async function mpDeleteNominee(nomineeId) {
  const { error } = await sb.from('nominees')
    .delete().eq('id', nomineeId);
  if (error) throw error;
}

/* ── Subscribe / Redeem ──────────────────────────────────── */
async function mpSubmitSubscription(investorId, { amount, receiptUrl, note }) {
  const { error } = await sb.from('subscription_requests').insert({
    investor_id: investorId,
    amount:      parseFloat(amount),
    receipt_url: receiptUrl || null,
    note:        note || null,
    status:      'Pending',
    requested_at: new Date().toISOString()
  });
  if (error) throw error;
}

async function mpSubmitRedemption(investorId, { amount, units, note }) {
  const { error } = await sb.from('redemption_requests').insert({
    investor_id: investorId,
    amount:      parseFloat(amount),
    units:       parseFloat(units),
    note:        note || null,
    status:      'Pending',
    requested_at: new Date().toISOString()
  });
  if (error) throw error;
}

/* ── Shareholders (fund-wide, public/member-read) ────────── */
async function mpLoadShareholders() {
  const { data, error } = await sb.from('profiles')
    .select('investor_id, full_name, account_type, units_held, joined_date, status')
    .order('units_held', { ascending: false });
  if (error) throw error;
  return data || [];
}

/* ── Product Types (colour taxonomy for product pills) ───── */
async function mpLoadProductTypes() {
  const { data, error } = await sb.from('product_types')
    .select('name, color, bg_color');
  if (error) throw error;
  const map = {};
  (data || []).forEach(function(p) {
    map[p.name] = { color: p.color, bg: p.bg_color };
  });
  return map;
}

/* ── Fund Overview (public) ──────────────────────────────── */
async function mpLoadFundOverview() {
  const { data, error } = await sb.from('fund_overview')
    .select('*').single();
  if (error) throw error;
  return data;
}

/* ── Password update ─────────────────────────────────────── */
async function mpUpdatePassword(newPassword) {
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/* ── Notifications ───────────────────────────────────────── */
async function mpLoadNotifications(investorId) {
  const { data, error } = await sb.from('notifications')
    .select('*')
    .eq('investor_id', investorId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return []; // soft fail
  return data || [];
}

/* ── Helpers ─────────────────────────────────────────────── */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Load all member data in parallel ────────────────────── */
async function mpLoadAll(user, investorId) {
  const [profile, holdings, transactions, distributions, documents, nominees, notifications] =
    await Promise.allSettled([
      mpLoadProfile(user.id),
      mpLoadHoldings(investorId),
      mpLoadTransactions(user.id),
      mpLoadDistributions(user.id),
      mpLoadDocuments(),
      mpLoadNominees(investorId),
      mpLoadNotifications(investorId)
    ]);

  return {
    profile:       profile.value       || null,
    holdings:      holdings.value      || [],
    transactions:  transactions.value  || [],
    distributions: distributions.value || [],
    documents:     documents.value     || [],
    nominees:      nominees.value      || [],
    notifications: notifications.value || []
  };
}
