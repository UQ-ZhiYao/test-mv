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

/* ── NTA History ─────────────────────────────────────────── */
async function mpLoadNTA() {
  const { data, error } = await sb.from('nta_history')
    .select('date, nta_value')
    .order('date', { ascending: true });
  if (error) throw error;
  // Group into 1D / 1Y / 3Y / max periods
  const all = data || [];
  const vals = all.map(r => parseFloat(r.nta_value));
  const lbls = all.map(r => r.date);
  const now = new Date();
  function since(months) {
    const cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - months);
    return all.filter(r => new Date(r.date) >= cutoff);
  }
  const d1d = since(1); // last month as proxy for "daily" data
  const d1y = since(12);
  const d3y = since(36);
  return {
    max: { v: vals, l: lbls },
    '3y': { v: since(36).map(r=>parseFloat(r.nta_value)), l: since(36).map(r=>r.date) },
    '1y': { v: since(12).map(r=>parseFloat(r.nta_value)), l: since(12).map(r=>r.date) },
    '1d': { v: d1d.map(r=>parseFloat(r.nta_value)), l: d1d.map(r=>r.date) }
  };
}

/* ── Portfolio / Holdings ────────────────────────────────── */
async function mpLoadHoldings(investorId) {
  const { data, error } = await sb.from('portfolios')
    .select('*, instruments(name, ticker, sector, instrument_type)')
    .eq('investor_id', investorId)
    .order('allocation_pct', { ascending: false });
  if (error) throw error;
  return (data || []).map(function(p) {
    const inst = p.instruments || {};
    return {
      n:    inst.name    || p.instrument_name || 'Unknown',
      t:    inst.ticker  || p.ticker || '—',
      sec:  inst.sector  || p.sector || 'Unknown',
      inst: inst.instrument_type || p.instrument_type || 'Other',
      units: p.units_held  ? parseFloat(p.units_held)  : null,
      cost:  p.avg_cost    ? parseFloat(p.avg_cost)     : null,
      px:    p.market_price? parseFloat(p.market_price) : null,
      al:    p.allocation_pct ? parseFloat(p.allocation_pct) : 0
    };
  });
}

/* ── Transactions ────────────────────────────────────────── */
async function mpLoadTransactions(investorId) {
  const { data, error } = await sb.from('transactions')
    .select('*')
    .eq('investor_id', investorId)
    .order('transaction_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(function(t) {
    return {
      ref:    t.reference_no || t.id,
      type:   t.transaction_type,   // 'Subscription' | 'Redemption'
      date:   formatDate(t.transaction_date),
      units:  t.units > 0 ? '+' + parseFloat(t.units).toFixed(4)
              : parseFloat(t.units).toFixed(4),
      nav:    parseFloat(t.nav_price).toFixed(4),
      amt:    t.transaction_type === 'Redemption'
              ? '\u2212RM ' + Math.abs(parseFloat(t.amount)).toLocaleString('en-MY',{minimumFractionDigits:2})
              : '+RM ' + parseFloat(t.amount).toLocaleString('en-MY',{minimumFractionDigits:2}),
      status: t.status || 'Completed'
    };
  });
}

/* ── Distributions ───────────────────────────────────────── */
async function mpLoadDistributions(investorId) {
  const { data, error } = await sb.from('distributions')
    .select('*')
    .eq('investor_id', investorId)
    .order('ex_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(function(d) {
    return {
      fy:   d.financial_year,
      type: d.distribution_type,    // 'Final' | 'Interim' | 'Special'
      ex:   formatDate(d.ex_date),
      pay:  formatDate(d.payment_date),
      dps:  parseFloat(d.dps_sen).toFixed(2),
      amt:  parseFloat(d.amount),
      status: d.status || 'Paid'
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
      mpLoadTransactions(investorId),
      mpLoadDistributions(investorId),
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
