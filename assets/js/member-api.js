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

async function mpLoadJointAccountName(jointAccountId) {
  if (!jointAccountId) return null;
  const { data, error } = await sb.from('joint_accounts')
    .select('display_name').eq('id', jointAccountId).maybeSingle();
  if (error) throw error;
  return (data && data.display_name) || null;
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
   Total Cost = Avg Cost × Units Held.
   Realised P&L (redemption leg) = AVCO gain/loss on each redemption:
   units_redeemed × (sale price − running AVCO cost), same method as
   trade settlement in the admin repo. Sale price is taken from the
   row's own `nta` (the NTA the redemption was executed at).
   Also returns a signed cashflow timeline (Subscriptions negative,
   Redemptions positive) for IRR — distributions and today's market
   value are appended by the caller.                                */
async function mpLoadCapitalSummary(userId) {
  const { data, error } = await sb.from('capital_injection')
    .select('type, amount, units, nta, date, status')
    .eq('uid', userId)
    .eq('status', 'Approved')
    .order('date', { ascending: true });
  if (error) throw error;
  const rows = data || [];

  const unitsHeld = rows.reduce((s, r) => s + (parseFloat(r.units) || 0), 0);

  let runUnits = 0, runCost = 0, realizedPnl = 0;
  const cashflows = [];
  rows.forEach(function(r) {
    const u = parseFloat(r.units) || 0;
    const amt = Math.abs(parseFloat(r.amount) || 0);
    if (u > 0) {
      runCost  += amt;
      runUnits += u;
      cashflows.push({ date: r.date, amount: -amt });
    } else if (u < 0) {
      const sellUnits = Math.min(Math.abs(u), runUnits);
      if (runUnits > 0 && sellUnits > 0) {
        const avgCost   = runCost / runUnits;
        const salePrice = (r.nta != null && r.nta !== '') ? parseFloat(r.nta) : (sellUnits > 0 ? amt / sellUnits : 0);
        realizedPnl += (salePrice - avgCost) * sellUnits;
        runUnits -= sellUnits;
        runCost   = runUnits > 0 ? runCost - avgCost * sellUnits : 0;
      }
      cashflows.push({ date: r.date, amount: amt });
    }
  });
  const avgCost   = runUnits > 0 ? runCost / runUnits : 0;
  const totalCost = avgCost * unitsHeld;

  return { unitsHeld: unitsHeld, avgCost: avgCost, totalCost: totalCost, realizedPnl: realizedPnl, cashflows: cashflows };
}

/* ── Transactions (from capital_injection — this member's own rows) ── */
async function mpLoadTransactions(userId) {
  const { data, error } = await sb.from('capital_injection')
    .select('reference_id, type, amount, units, nta, date, status, document')
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
      status: t.status || 'Pending',
      doc:    t.document || null
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

/* ── Subscribe / Redeem ──────────────────────────────────────────────────
   There is no separate subscription_requests/redemption_requests table in
   this project's actual Supabase schema (confirmed against the real DB —
   an earlier version of this code assumed those tables existed and every
   submission was silently failing). A Pending request IS a capital_injection
   row: the same table already carries status ('Pending'/'Approved'),
   reference_id, document (receipt URL), and gets its units/nta filled in
   once approved — see the Transaction page's Pending-vs-approved-units
   distinction in assets/js/phone/portfolio-widgets.js. */
async function mpSubmitCapitalInjectionRequest(uid, { fullName, type, amount, document, referenceId }) {
  const { error } = await sb.from('capital_injection').insert({
    uid:          uid,
    full_name:    fullName || null,
    date:         new Date().toISOString().slice(0, 10),
    type:         type, // 'Subscription' | 'Redemption'
    amount:       parseFloat(amount),
    nta:          null,   // filled in by admin once approved
    units:        null,   // filled in by admin once approved
    status:       'Pending',
    document:     document || null,
    reference_id: referenceId || null
  });
  if (error) throw error;
}

// The fund's own deposit-destination bank account — not a member's. Kept as
// a single profiles row with role='admin' (same schema as a normal member
// profile) rather than a separate table, per how this project's Supabase
// project is actually set up.
async function mpLoadAdminBankAccount() {
  // ilike (case-insensitive) in case the stored value isn't exactly
  // lowercase "admin", and limit(1) + data[0] instead of maybeSingle() so
  // this doesn't throw if more than one row happens to have that role —
  // it just uses the first. If this still comes back empty, it's very
  // likely a Row Level Security policy on profiles only allowing a member
  // to read their own row, not the admin's.
  const { data, error } = await sb.from('profiles')
    .select('bank_name, bank_account_no, bank_account_holder')
    .ilike('role', 'admin').limit(1);
  if (error) throw error;
  return (data && data[0]) || null;
}

// How many Subscription/Redemption capital_injection rows this account
// (uid — a personal profile id or a joint account id) already has — used
// as the running index in the account's next request's reference ID (see
// genRequestRef() in portfolio-widgets.js), so more than one request for
// the same account on the same day still gets a distinct ref.
async function mpCountCapitalInjectionRequests(uid, type) {
  const { count, error } = await sb.from('capital_injection')
    .select('id', { count: 'exact', head: true })
    .eq('uid', uid).eq('type', type);
  if (error) throw error;
  return count || 0;
}

// Uploads a subscription's bank-transfer-slip receipt to the
// capital-injection-docs Storage bucket, namespaced by the submitting
// member's own profile id so files from different members never collide,
// and returns its public URL for storage in capital_injection.document.
async function mpUploadReceipt(uid, file) {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = uid + '/' + Date.now() + '.' + ext;
  const { error } = await sb.storage.from('capital-injection-docs').upload(path, file);
  if (error) throw error;
  const { data } = sb.storage.from('capital-injection-docs').getPublicUrl(path);
  return data.publicUrl;
}

/* ── Shareholders (fund-wide, public/member-read) ────────── */
/* ── Shareholders (units_held computed from capital_injection, since
   profiles.units_held isn't kept up to date) ────────────────────── */
/* ── Shareholders (fully derived from capital_injection — it already
   carries full_name per row, so no join to profiles is needed at all) ── */
async function mpLoadShareholders() {
  const { data, error } = await sb.from('capital_injection')
    .select('uid, full_name, units, date, status')
    .eq('status', 'Approved');
  if (error) throw error;

  const byUid = {};
  (data || []).forEach(function(r) {
    if (!byUid[r.uid]) byUid[r.uid] = { uid: r.uid, full_name: r.full_name, units_held: 0, firstDate: r.date };
    byUid[r.uid].units_held += parseFloat(r.units) || 0;
    if (r.date && (!byUid[r.uid].firstDate || r.date < byUid[r.uid].firstDate)) byUid[r.uid].firstDate = r.date;
  });

  return Object.keys(byUid)
    .map(function(uid) {
      const s = byUid[uid];
      return {
        investor_id: s.uid,
        full_name: s.full_name || 'Unknown',
        account_type: 'shareholder',
        joined_date: s.firstDate,
        status: 'Active',
        units_held: s.units_held
      };
    })
    .sort(function(a, b) { return b.units_held - a.units_held; });
}

/* ── Shareholders by FY (point-in-time snapshot at each FY's end date) —
   for the Shareholder List page's FY filter tabs. Cumulative units per
   investor from all Approved capital_injection rows up to and including
   that FY's end_date (units are already signed +/- for subscription vs.
   redemption, so summing directly gives the correct running balance).    */
async function mpLoadShareholdersByFy() {
  const [fyRes, ciRes] = await Promise.all([
    sb.from('fy_settings').select('*').order('start_date', { ascending: true }),
    sb.from('capital_injection').select('uid, full_name, units, date, status').eq('status', 'Approved')
  ]);
  if (fyRes.error) throw fyRes.error;
  if (ciRes.error) throw ciRes.error;
  const FYS = fyRes.data || [];
  const ciRows = (ciRes.data || []).slice().sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });

  return FYS.map(function(fy) {
    const byUid = {};
    ciRows.forEach(function(r) {
      if (!r.date || r.date > fy.end_date) return;
      if (!byUid[r.uid]) byUid[r.uid] = { uid: r.uid, full_name: r.full_name, units_held: 0, firstDate: r.date };
      byUid[r.uid].units_held += parseFloat(r.units) || 0;
      if (r.date < byUid[r.uid].firstDate) byUid[r.uid].firstDate = r.date;
    });
    const list = Object.keys(byUid)
      .map(function(uid) {
        const s = byUid[uid];
        return {
          investor_id: s.uid,
          full_name: s.full_name || 'Unknown',
          account_type: 'shareholder',
          joined_date: s.firstDate,
          status: 'Active',
          units_held: s.units_held
        };
      })
      .filter(function(s) { return s.units_held > 0; })
      .sort(function(a, b) { return b.units_held - a.units_held; });
    return { fy: fy.label, list: list };
  });
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
/* ── Inception Date (first day of capital injection, fund-wide) ──── */
/* ── NTA Monthly OHLC (for the Fund Overview candlestick chart) ──
   Groups nta_daily into calendar months: open = first day's nta,
   close = last day's nta, high/low = max/min within the month.       */
async function mpLoadNtaMonthly() {
  const pageSize = 1000;
  let all = [], page = 0;
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

  const byMonth = {};
  const order = [];
  all.forEach(function(r) {
    if (!r.date || r.nta == null) return;
    const key = r.date.slice(0, 7); // YYYY-MM
    const v = parseFloat(r.nta);
    if (!byMonth[key]) {
      byMonth[key] = { key: key, open: v, high: v, low: v, close: v };
      order.push(key);
    } else {
      const m = byMonth[key];
      m.high = Math.max(m.high, v);
      m.low = Math.min(m.low, v);
      m.close = v; // rows arrive in ascending date order, so last write wins
    }
  });

  return order.map(function(key) {
    const m = byMonth[key];
    const d = new Date(key + '-01T00:00:00');
    const label = d.toLocaleDateString('en-MY', { month: 'short', year: '2-digit' });
    return { key: key, date: key + '-01', label: label, open: m.open, high: m.high, low: m.low, close: m.close };
  });
}

async function mpLoadInceptionDate() {
  const { data, error } = await sb.from('capital_injection')
    .select('date')
    .order('date', { ascending: true })
    .limit(1);
  if (error) throw error;
  return (data && data.length) ? data[0].date : null;
}

/* ── Raw daily NTA series (for the NTA History page's "Daily" view) ──── */
async function mpLoadNtaDaily() {
  const pageSize = 1000;
  let all = [], page = 0;
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
  return all
    .filter(function(r) { return r.date && r.nta != null; })
    .map(function(r) { return { date: r.date, nta: parseFloat(r.nta) }; });
}

/* ── NTA Weekly OHLC (for the NTA History page's "Weekly" candlestick) ──
   Same aggregation as mpLoadNtaMonthly, bucketed by ISO week instead of
   calendar month. "date" on each bucket is that week's last trading day.  */
async function mpLoadNtaWeeklyOHLC() {
  const pageSize = 1000;
  let all = [], page = 0;
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
  const byWeek = {};
  const order = [];
  all.forEach(function(r) {
    if (!r.date || r.nta == null) return;
    const key = isoWeekKey(new Date(r.date + 'T00:00:00'));
    const v = parseFloat(r.nta);
    if (!byWeek[key]) {
      byWeek[key] = { key: key, date: r.date, open: v, high: v, low: v, close: v };
      order.push(key);
    } else {
      const w = byWeek[key];
      w.high = Math.max(w.high, v);
      w.low = Math.min(w.low, v);
      w.close = v; // ascending order → last write wins
      w.date = r.date;
    }
  });
  return order.map(function(key) {
    const w = byWeek[key];
    const d = new Date(w.date + 'T00:00:00');
    const label = d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: '2-digit' });
    return { key: key, date: w.date, label: label, open: w.open, high: w.high, low: w.low, close: w.close };
  });
}

/* ── NTA Quarterly OHLC — same aggregation as monthly/weekly, bucketed by
   calendar quarter (Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec).      */
async function mpLoadNtaQuarterlyOHLC() {
  const pageSize = 1000;
  let all = [], page = 0;
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
  const byQuarter = {};
  const order = [];
  all.forEach(function(r) {
    if (!r.date || r.nta == null) return;
    const d = new Date(r.date + 'T00:00:00');
    const q = Math.floor(d.getMonth() / 3) + 1;
    const key = d.getFullYear() + '-Q' + q;
    const v = parseFloat(r.nta);
    if (!byQuarter[key]) {
      byQuarter[key] = { key: key, date: r.date, open: v, high: v, low: v, close: v };
      order.push(key);
    } else {
      const qq = byQuarter[key];
      qq.high = Math.max(qq.high, v);
      qq.low = Math.min(qq.low, v);
      qq.close = v; // ascending order → last write wins
      qq.date = r.date;
    }
  });
  return order.map(function(key) {
    const qq = byQuarter[key];
    return { key: key, date: qq.date, label: key, open: qq.open, high: qq.high, low: qq.low, close: qq.close };
  });
}

function isoWeekKey(d) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((dt - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return dt.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

/* ── Fund NTA resampled to weekly (fund-wide) — for the Comparison page's
   "vs index" chart, which needs the same cadence as the Yahoo Finance
   weekly series below.                                                   */
async function mpLoadNtaWeekly() {
  const pageSize = 1000;
  let all = [], page = 0;
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
  const byWeek = {};
  const order = [];
  let firstKey = null;
  all.forEach(function(r) {
    if (!r.date || r.nta == null) return;
    const key = isoWeekKey(new Date(r.date + 'T00:00:00'));
    const v = parseFloat(r.nta);
    if (firstKey === null) firstKey = key;
    if (!byWeek[key]) { byWeek[key] = { date: r.date, close: v }; order.push(key); }
    // Last write wins within a week (so each weekly point is that week's
    // closing value) — EXCEPT for the very first ISO week in the whole
    // series, which must keep its first day's exact date. Otherwise the
    // fund's true first day (e.g. 13 Dec) gets silently pushed forward to
    // the end of its ISO week by a later day in that same week, and the
    // chart appears to start days late even though nta_daily has data
    // from day one.
    else if (key !== firstKey) { byWeek[key].date = r.date; byWeek[key].close = v; }
  });
  return order.map(function(key) { return byWeek[key]; });
}

/* ── External index weekly series via Yahoo Finance, through our own
   fetch-historical Supabase Edge Function (supabase/functions/
   fetch-historical/index.ts) — a direct browser call to Yahoo Finance
   returns 403 (CORS), and every public-proxy workaround tried before this
   (corsproxy.io, then a multi-proxy fallback chain) turned out to be
   unreliable in production; FBM KLCI/STI/MSCI kept intermittently
   vanishing from the Fund page's correlation matrix and Sharpe chart, and
   from desktop's Comparison page, which both call this same function.
   Running the Yahoo call server-side avoids the CORS problem entirely
   instead of working around it. Returns ascending
   [{date:'YYYY-MM-DD', close:Number}].                                  */
async function mpLoadYahooWeekly(symbol) {
  const { data, error } = await sb.functions.invoke('fetch-historical', {
    body: { symbol: symbol, interval: '1wk', range: '5y' }
  });
  if (error) throw new Error('fetch-historical failed for ' + symbol + ': ' + error.message);
  if (data && data.error) throw new Error(data.error);
  return ((data && data.points) || []).map(function(p) { return { date: p.date, close: p.close }; });
}

/* ── Same fetch-historical edge function as mpLoadYahooWeekly(), but with
   caller-chosen interval/range instead of the fixed weekly/5y window —
   used by the Market screen's per-index detail chart (openIndexDetail()
   in market-data.js), which needs several different period lengths
   (1D/1W/1M/3M/1Y/5Y) from the same symbol. */
async function mpLoadHistorical(symbol, interval, range) {
  const { data, error } = await sb.functions.invoke('fetch-historical', {
    body: { symbol: symbol, interval: interval || '1wk', range: range || '5y' }
  });
  if (error) throw new Error('fetch-historical failed for ' + symbol + ': ' + error.message);
  if (data && data.error) throw new Error(data.error);
  return ((data && data.points) || []).map(function(p) { return { date: p.date, close: p.close }; });
}

/* ── Live quote snapshots (indices/forex/crypto) via our own fetch-quotes
   Supabase Edge Function (supabase/functions/fetch-quotes/index.ts) — same
   server-side-fetch pattern as mpLoadYahooWeekly()/fetch-historical, for
   the same CORS reason. Used by the phone Market screen's Indices/Forex/
   Crypto tabs. Returns an array of {symbol, shortName, regularMarketPrice,
   regularMarketChange, regularMarketChangePercent, currency} — symbols
   Yahoo doesn't recognize are simply absent, not an error. */
async function mpLoadQuotes(symbols) {
  const { data, error } = await sb.functions.invoke('fetch-quotes', {
    body: { symbols: symbols }
  });
  if (error) throw new Error('fetch-quotes failed: ' + error.message);
  if (data && data.error) throw new Error(data.error);
  return (data && data.quotes) || [];
}

/* ── App Feedback submission via our own send-feedback Supabase Edge
   Function (supabase/functions/send-feedback/index.ts) — sends the email
   to support@zy-invest.com server-side through Resend, so Submit doesn't
   need to open the member's own mail app. Throws on failure so the caller
   (submitFeedback() in phone/misc.js) can show an error toast and let the
   member retry without losing what they typed. */
async function mpSendFeedback(subject, content, memberEmail, memberName) {
  const { data, error } = await sb.functions.invoke('send-feedback', {
    body: { subject: subject, content: content, memberEmail: memberEmail, memberName: memberName }
  });
  if (error) throw new Error('send-feedback failed: ' + error.message);
  if (data && data.error) throw new Error(data.error);
  return true;
}

/* ── Distributions by FY (fund-wide, Paid only) — for the Fund Overview
   "Distribution Summary" & "Distribution History" cards. Buckets each
   Paid distribution into interimDps / finalDps by matching distributions.type
   (stored as full strings e.g. "Interim Dividend") rather than a short code;
   anything not matching "interim" is folded into finalDps so totalDps
   always equals the FY's full (gross) distribution per share.            */
async function mpLoadDistributionsByFy() {
  const { data, error } = await sb.from('distributions')
    .select('fy, type, dps, status')
    .eq('status', 'Paid');
  if (error) throw error;
  const rows = data || [];
  const byFy = {};
  const order = [];
  rows.forEach(function(r) {
    const fy = r.fy;
    if (!fy) return;
    if (!byFy[fy]) { byFy[fy] = { fy: fy, interimDps: 0, finalDps: 0 }; order.push(fy); }
    const dps = parseFloat(r.dps) || 0;
    const isInterim = (r.type || '').toLowerCase().indexOf('interim') !== -1;
    if (isInterim) byFy[fy].interimDps += dps;
    else byFy[fy].finalDps += dps;
  });
  order.sort();
  return order.map(function(fy) {
    const r = byFy[fy];
    r.totalDps = r.interimDps + r.finalDps;
    return r;
  });
}

async function mpLoadFundOverview() {
  const { data, error } = await sb.from('fund_overview')
    .select('*').single();
  if (error) throw error;
  return data;
}

/* ── Income Statement (fund-wide, per financial year) ────────
   Revenue        = Dividend Income (dividend, status='Received', by ex_date)
                   + Interest Income (transaction_others, category='Interests')
   Management Cost = Δ nta_daily.management_fees over the FY (cumulative column,
                     so FY cost = value at end_date − value at start_date)
                   + remuneration rows dated within the FY
   Gross Income    = Revenue − Management Cost
   Realised P&L    = settlement.pnl dated within the FY
   Other Inc/Exp   = transaction_others where category != 'Interests'
   Unrealised P&L  = solved backward (see below) — the only line we can't
                     source directly from a table.
   Profit before Tax = Gross Income + Realised P&L + Unrealised P&L + Other
   Tax             = 0 (none charged to date)
   Net Income      = Profit before Tax − Tax

   Unrealised P&L derivation ("special case 1"):
   Total Equity = Contributed Capital + Cumulative Net Income − Cumulative
   Distributions Paid  (standard equity roll-forward identity), so:
     NetIncome(FY) = TotalEquity(FY end) − TotalCapital(FY end)
                     − CumulativeNetIncomeBeforeFY
                     + CumulativeDistributionsPaid(through FY end)
   That gives an independent, balance-sheet-derived Net Income for the FY.
   Since Gross Income, Realised P&L and Other Inc/Exp are all independently
   known, whatever's left over must be the Unrealised P&L:
     UnrealisedP&L(FY) = NetIncome(FY) − GrossIncome − RealisedP&L − OtherIncExp
   FYs are processed oldest-first so each FY's cumulative-net-income-before
   figure is built up from the ones already solved.                     */
async function mpLoadIncomeStatement() {
  const pageSize = 1000;
  async function fetchAllNta() {
    let all = [], page = 0;
    while (true) {
      const { data, error } = await sb.from('nta_daily')
        .select('date, total_equity, management_fees')
        .order('date', { ascending: true })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (error) throw error;
      if (!data || !data.length) break;
      all = all.concat(data);
      if (data.length < pageSize) break;
      page++;
    }
    return all;
  }

  const [fyRes, divRes, otherRes, remRes, settlRes, ciRes, distRes, ntaRows] = await Promise.all([
    sb.from('fy_settings').select('*').order('start_date', { ascending: true }),
    sb.from('dividend').select('amount, ex_date, status'),
    sb.from('transaction_others').select('amount, date, category'),
    sb.from('remuneration').select('amount, date'),
    sb.from('settlement').select('pnl, date'),
    sb.from('capital_injection').select('amount, units, date, status').eq('status', 'Approved'),
    sb.from('distributions').select('amount, pay_date, status'),
    fetchAllNta()
  ]);
  if (fyRes.error) throw fyRes.error;
  // Surface anything that came back empty-but-erroring (e.g. RLS) so it's
  // visible in the console instead of silently showing as RM 0.00.
  [['dividend', divRes], ['transaction_others', otherRes], ['remuneration', remRes],
   ['settlement', settlRes], ['capital_injection', ciRes], ['distributions', distRes]]
    .forEach(function(pair) {
      if (pair[1].error) console.warn('Income statement: "' + pair[0] + '" query failed — ' + pair[1].error.message);
    });
  const FYS       = fyRes.data || [];
  const divRows   = divRes.data || [];
  const otherRows = otherRes.data || [];
  const remRows   = remRes.data || [];
  const settlRows = settlRes.data || [];
  const ciRows    = ciRes.data || [];
  const distRows  = distRes.data || [];

  function ntaAtOrBefore(dateStr) {
    let result = null;
    for (let i = 0; i < ntaRows.length; i++) {
      if (ntaRows[i].date <= dateStr) result = ntaRows[i]; else break;
    }
    return result;
  }
  function inRange(d, start, end) { return d && d >= start && d <= end; }
  function isInterest(cat) { return (cat || '').trim().toLowerCase() === 'interests'; }

  let cumNetIncomeBefore = 0;
  const rows = FYS.map(function(fy) {
    const start = fy.start_date, end = fy.end_date;

    const dividendIncome = divRows
      .filter(function(r) { return r.status === 'Received' && inRange(r.ex_date, start, end); })
      .reduce(function(s, r) { return s + (parseFloat(r.amount) || 0); }, 0);
    const interestIncome = otherRows
      .filter(function(r) { return isInterest(r.category) && inRange(r.date, start, end); })
      .reduce(function(s, r) { return s + (parseFloat(r.amount) || 0); }, 0);
    const revenue = dividendIncome + interestIncome;

    const ntaEnd = ntaAtOrBefore(end);
    const ntaStart = ntaAtOrBefore(start);
    const mgmtFeeDelta = (ntaEnd ? parseFloat(ntaEnd.management_fees) || 0 : 0)
                        - (ntaStart ? parseFloat(ntaStart.management_fees) || 0 : 0);
    const remInFY = remRows
      .filter(function(r) { return inRange(r.date, start, end); })
      .reduce(function(s, r) { return s + (parseFloat(r.amount) || 0); }, 0);
    const managementCost = mgmtFeeDelta + remInFY;

    const grossIncome = revenue - managementCost;

    const realizedPnl = settlRows
      .filter(function(r) { return inRange(r.date, start, end); })
      .reduce(function(s, r) { return s + (parseFloat(r.pnl) || 0); }, 0);

    const otherIncomeExpense = otherRows
      .filter(function(r) { return !isInterest(r.category) && inRange(r.date, start, end); })
      .reduce(function(s, r) { return s + (parseFloat(r.amount) || 0); }, 0);

    // Special case 1 — equity roll-forward derived Net Income
    const totalEquityEnd  = ntaEnd ? (parseFloat(ntaEnd.total_equity) || 0) : 0;
    const totalCapitalEnd = ciRows
      .filter(function(r) { return r.date <= end; })
      .reduce(function(s, r) { return s + (parseFloat(r.amount) || 0); }, 0);
    const cumDistPaidThroughEnd = distRows
      .filter(function(r) { return r.status === 'Paid' && r.pay_date && r.pay_date <= end; })
      .reduce(function(s, r) { return s + (parseFloat(r.amount) || 0); }, 0);

    const netIncomeFromEquity = totalEquityEnd - totalCapitalEnd - cumNetIncomeBefore + cumDistPaidThroughEnd;
    const unrealizedPnl = netIncomeFromEquity - grossIncome - realizedPnl - otherIncomeExpense;

    const profitBeforeTax = grossIncome + realizedPnl + unrealizedPnl + otherIncomeExpense;
    const tax = 0;
    const netIncome = profitBeforeTax - tax;

    const outstandingShares = ciRows
      .filter(function(r) { return r.date <= end; })
      .reduce(function(s, r) { return s + (parseFloat(r.units) || 0); }, 0);
    const epsCents = outstandingShares > 0 ? (netIncome / outstandingShares) * 100 : null;

    cumNetIncomeBefore += netIncome;

    return {
      fy: fy.label, startDate: start, endDate: end,
      dividendIncome: dividendIncome, interestIncome: interestIncome, revenue: revenue,
      managementCost: managementCost, grossIncome: grossIncome,
      realizedPnl: realizedPnl, unrealizedPnl: unrealizedPnl, otherIncomeExpense: otherIncomeExpense,
      profitBeforeTax: profitBeforeTax, tax: tax, netIncome: netIncome,
      outstandingShares: outstandingShares, epsCents: epsCents
    };
  });

  return rows;
}

/* ── Balance Sheet (fund-wide, per financial year, as at FY end date) ──
   All figures read directly (or derived) from nta_daily at the row
   nearest-at-or-before each FY's end_date, plus cumulative capital
   from capital_injection.                                            */
async function mpLoadBalanceSheet() {
  const pageSize = 1000;
  async function fetchAllNta() {
    let all = [], page = 0;
    while (true) {
      const { data, error } = await sb.from('nta_daily')
        .select('date, securities, other_assets, receivables, cash, management_fees, total_equity, total_units, nta')
        .order('date', { ascending: true })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (error) throw error;
      if (!data || !data.length) break;
      all = all.concat(data);
      if (data.length < pageSize) break;
      page++;
    }
    return all;
  }

  const [fyRes, ciRes, ntaRows] = await Promise.all([
    sb.from('fy_settings').select('*').order('start_date', { ascending: true }),
    sb.from('capital_injection').select('amount, date, status').eq('status', 'Approved'),
    fetchAllNta()
  ]);
  if (fyRes.error) throw fyRes.error;
  const FYS    = fyRes.data || [];
  const ciRows = ciRes.data || [];

  function ntaAtOrBefore(dateStr) {
    let result = null;
    for (let i = 0; i < ntaRows.length; i++) {
      if (ntaRows[i].date <= dateStr) result = ntaRows[i]; else break;
    }
    return result;
  }

  const rows = FYS.map(function(fy) {
    const end = fy.end_date;
    const row = ntaAtOrBefore(end) || {};

    const securities           = parseFloat(row.securities)    || 0;
    const otherInvestments     = parseFloat(row.other_assets)  || 0;
    const dividendReceivables  = parseFloat(row.receivables)   || 0;
    const cash                 = parseFloat(row.cash)          || 0;
    const totalAssets = securities + otherInvestments + dividendReceivables + cash;

    const accrualFees = parseFloat(row.management_fees) || 0;
    const totalLiabilities = accrualFees;

    const totalCapital = ciRows
      .filter(function(r) { return r.date <= end; })
      .reduce(function(s, r) { return s + (parseFloat(r.amount) || 0); }, 0);
    const totalEquity = parseFloat(row.total_equity) || 0;
    const retainedEarnings = totalEquity - totalCapital;

    const outstandingShares = parseFloat(row.total_units) || 0;
    const ntaPerShare = parseFloat(row.nta) || 0;

    return {
      fy: fy.label, endDate: end,
      securities: securities, otherInvestments: otherInvestments,
      dividendReceivables: dividendReceivables, cash: cash, totalAssets: totalAssets,
      accrualFees: accrualFees, totalLiabilities: totalLiabilities,
      totalCapital: totalCapital, retainedEarnings: retainedEarnings, totalEquity: totalEquity,
      outstandingShares: outstandingShares, ntaPerShare: ntaPerShare
    };
  });

  return rows;
}

/* ── Cash Flow (fund-wide, per financial year) ───────────────
   Reuses Income Statement (Profit before Tax, Unrealised P&L) and
   Balance Sheet (Dividend Receivables) rows already loaded on the page.

   OPERATING: Profit before Tax, adjusted for the non-cash Unrealised
   P&L embedded in it (a gain is subtracted, a loss added back), plus
   the change in Dividend Receivables (indirect method: an increase in
   a receivable is a use of cash, so change = previous − current).

   INVESTING: "Net Proceeds from (Investment)/Disposal" — real trading
   cashflows from transaction_trading (Buy = negative/outflow,
   Sell = positive/inflow), split by product: Securities & REIT Trusts
   vs. everything else ("Other Assets").

   Cash beginning/ending is chained forward FY by FY; the very first
   FY's beginning balance is seeded from nta_daily.cash at/just before
   that FY's start_date (there's no prior FY to chain from).          */
async function mpLoadCashFlow(incomeStatementRows, balanceSheetRows) {
  const [fyRes, ciRes, distRes, tradeRes] = await Promise.all([
    sb.from('fy_settings').select('*').order('start_date', { ascending: true }),
    sb.from('capital_injection').select('amount, date, status').eq('status', 'Approved'),
    sb.from('distributions').select('amount, pay_date, status'),
    sb.from('transaction_trading').select('cashflow, product, trade_date')
  ]);
  if (fyRes.error) throw fyRes.error;
  [['capital_injection', ciRes], ['distributions', distRes], ['transaction_trading', tradeRes]]
    .forEach(function(pair) {
      if (pair[1].error) console.warn('Cash flow: "' + pair[0] + '" query failed — ' + pair[1].error.message);
    });
  const FYS       = fyRes.data || [];
  const ciRows    = ciRes.data || [];
  const distRows  = distRes.data || [];
  const tradeRows = tradeRes.data || [];

  function inRange(d, start, end) { return d && d >= start && d <= end; }
  function isSecuritiesProduct(p) { p = (p || '').trim(); return p === 'Securities' || p === 'REIT Trusts'; }

  const isByFy = {}; (incomeStatementRows || []).forEach(function(r) { isByFy[r.fy] = r; });
  const bsByFy = {}; (balanceSheetRows   || []).forEach(function(r) { bsByFy[r.fy] = r; });

  // Seed cash-beginning for the first FY from nta_daily, since there's
  // no prior FY to chain the opening balance from.
  let seedCash = 0;
  if (FYS.length) {
    const { data } = await sb.from('nta_daily')
      .select('date, cash')
      .lte('date', FYS[0].start_date)
      .order('date', { ascending: false })
      .limit(1);
    if (data && data.length) seedCash = parseFloat(data[0].cash) || 0;
  }

  let prevReceivables = null, prevAccrualFees = null, prevCashEnd = null;

  const rows = FYS.map(function(fy) {
    const start = fy.start_date, end = fy.end_date;
    const is = isByFy[fy.label] || {};
    const bs = bsByFy[fy.label] || {};

    const profitBeforeTax = is.profitBeforeTax || 0;
    // Reverse out the non-cash Unrealised and Realised P&L embedded in
    // Profit before Tax (indirect method): a gain is subtracted, a loss
    // is added back. The actual cash effect of realised trades is
    // captured separately via Net Proceeds below (the full sale/purchase
    // cashflow, not just the accounting gain/loss), so reversing Realised
    // P&L out here avoids double-counting rather than causing it.
    const unrealizedAdjustment = -(is.unrealizedPnl || 0);
    const realizedAdjustment   = -(is.realizedPnl || 0);

    // Unit trust convention: buying/selling the fund's own securities IS
    // the core operating activity (not "investing" — that's how a fund
    // makes its return), so these sit under Operating as their own lines
    // (not part of "Adjustments for:"), before the working-capital items.
    const fyTrades = tradeRows.filter(function(r) { return inRange(r.trade_date, start, end); });
    const proceedsSecurities = fyTrades
      .filter(function(r) { return isSecuritiesProduct(r.product); })
      .reduce(function(s, r) { return s + (parseFloat(r.cashflow) || 0); }, 0);
    const proceedsOtherAssets = fyTrades
      .filter(function(r) { return !isSecuritiesProduct(r.product); })
      .reduce(function(s, r) { return s + (parseFloat(r.cashflow) || 0); }, 0);

    const receivables = bs.dividendReceivables || 0;
    // Receivables is an asset: change = previous FY − this FY (previous
    // defaults to 0 for the first FY).
    const changeReceivables = (prevReceivables === null ? 0 : prevReceivables) - receivables;

    // Accrual Fees is a liability: change = this FY − previous FY
    // (previous defaults to 0 for the first FY).
    const accrualFees = bs.accrualFees || 0;
    const changeAccrualFees = accrualFees - (prevAccrualFees === null ? 0 : prevAccrualFees);

    const cashflowFromOps = profitBeforeTax + unrealizedAdjustment + realizedAdjustment
      + proceedsSecurities + proceedsOtherAssets + changeReceivables + changeAccrualFees;
    const incomeTaxPaid = 0;
    const netCashOperating = cashflowFromOps + incomeTaxPaid;

    const netCashInvesting = 0;

    const dividendPaid = -distRows
      .filter(function(r) { return r.status === 'Paid' && inRange(r.pay_date, start, end); })
      .reduce(function(s, r) { return s + (parseFloat(r.amount) || 0); }, 0);
    const issuanceOfShares = ciRows
      .filter(function(r) { return inRange(r.date, start, end); })
      .reduce(function(s, r) { return s + (parseFloat(r.amount) || 0); }, 0);
    const netCashFinancing = dividendPaid + issuanceOfShares;

    const netIncreaseInCash = netCashOperating + netCashInvesting + netCashFinancing;

    const cashBeginning = prevCashEnd === null ? seedCash : prevCashEnd;
    const cashEnding = cashBeginning + netIncreaseInCash;

    prevReceivables = receivables; prevAccrualFees = accrualFees; prevCashEnd = cashEnding;

    return {
      fy: fy.label, startDate: start, endDate: end,
      profitBeforeTax: profitBeforeTax, unrealizedAdjustment: unrealizedAdjustment, realizedAdjustment: realizedAdjustment,
      proceedsSecurities: proceedsSecurities, proceedsOtherAssets: proceedsOtherAssets,
      changeReceivables: changeReceivables, changeAccrualFees: changeAccrualFees,
      cashflowFromOps: cashflowFromOps, incomeTaxPaid: incomeTaxPaid, netCashOperating: netCashOperating,
      netCashInvesting: netCashInvesting,
      dividendPaid: dividendPaid, issuanceOfShares: issuanceOfShares, netCashFinancing: netCashFinancing,
      netIncreaseInCash: netIncreaseInCash, cashBeginning: cashBeginning, cashEnding: cashEnding
    };
  });

  return rows;
}

/* ── Ratio Analysis (fund-wide, per financial year) ──────────
   Reuses Income Statement (Revenue, Gross Income, Profit before Tax,
   Net Income) and Balance Sheet (Total Assets, Total Liabilities,
   Total Equity, Cash, NTA per Share) rows already loaded on the page.
   "Average of assets" = (this FY's Total Assets + previous FY's Total
   Assets) / 2 — previous defaults to 0 for the first FY, same
   convention as the Cash Flow tab's "Changes in" rows.
   The "Others" trading stats exclude Cash Funds product entirely.     */
/* ── Holdings by FY (fund-wide) — for the Factsheet page's stacked column
   chart. For each FY, takes every trade at-or-before that FY's end_date,
   nets each instrument's cumulative units (units are signed: positive =
   buy, negative = sell, same convention as capital_injection), and values
   the position at that instrument's own most recent trade price on or
   before the FY end (no separate historical price feed exists for
   individual securities, unlike the Yahoo-sourced index comparisons — the
   last executed trade price is the closest available proxy for "price at
   FY end"). select('*') is used defensively since the exact column name
   for the instrument identifier isn't guaranteed across environments.    */
async function mpLoadHoldingsByFy() {
  const [fyRes, trRes, inRes] = await Promise.all([
    sb.from('fy_settings').select('*').order('start_date', { ascending: true }),
    sb.from('transaction_trading').select('*').order('trade_date', { ascending: true }),
    sb.from('instruments').select('name, sector, product, ticker, code')
  ]);
  if (fyRes.error) throw fyRes.error;
  if (trRes.error) throw trRes.error;
  const FYS = fyRes.data || [];
  const trades = trRes.data || [];
  const instByName = {};
  (inRes.data || []).forEach(function(i) { instByName[i.name] = i; });

  // Broadened fallback chain: only drop to the generic 'product' category
  // (e.g. "Equity") as an absolute last resort — falling back too early
  // merges every distinct instrument that's missing instrument_name into
  // one bucket, which is what was corrupting the most recent FY (the one
  // most likely to have a not-yet-fully-tagged trade row).
  function nameOf(r) { return r.instrument_name || r.name || r.security_name || r.instrument || r.code || r.ticker || r.product || 'Unknown'; }
  function isCashName(n) { return (n || '').toLowerCase().indexOf('cash') !== -1; }

  return FYS.map(function(fy) {
    const byName = {};
    trades.forEach(function(r) {
      if (!r.trade_date || r.trade_date > fy.end_date) return;
      const name = nameOf(r);
      if (isCashName(name)) return; // this chart is about invested holdings, not cash
      if (!byName[name]) byName[name] = { name: name, units: 0, lastPrice: null, lastDate: null };
      byName[name].units += parseFloat(r.units) || 0;
      const p = parseFloat(r.price);
      if (!isNaN(p) && (!byName[name].lastDate || r.trade_date >= byName[name].lastDate)) {
        byName[name].lastPrice = p;
        byName[name].lastDate = r.trade_date;
      }
    });
    const holdings = Object.keys(byName)
      .map(function(name) {
        const h = byName[name];
        const inst = instByName[name] || {};
        const mv = (h.units || 0) * (h.lastPrice || 0);
        return {
          name: name, sector: inst.sector || 'Other', product: inst.product || 'Other',
          ticker: (inst.ticker || '').trim(), code: (inst.code || '').trim(),
          units: h.units, price: h.lastPrice, mv: mv
        };
      })
      // Only drop fully-exited positions (~0 units) — a position with a
      // missing/zero last price is still real and must stay in the total,
      // otherwise every OTHER holding's weight% gets silently inflated
      // because the denominator (totalMV) is understated.
      .filter(function(h) { return Math.abs(h.units) > 0.0001; });
    const totalMV = holdings.reduce(function(s, h) { return s + Math.max(0, h.mv); }, 0);
    holdings.forEach(function(h) { h.pct = totalMV > 0 ? (Math.max(0, h.mv) / totalMV * 100) : 0; });
    holdings.sort(function(a, b) { return b.pct - a.pct; });
    return { fy: fy.label, totalMV: totalMV, holdings: holdings };
  });
}

async function mpLoadRatioAnalysis(incomeStatementRows, balanceSheetRows) {
  const [fyRes, distRes, tradeRes] = await Promise.all([
    sb.from('fy_settings').select('*').order('start_date', { ascending: true }),
    sb.from('distributions').select('dps, ex_date, status'),
    sb.from('transaction_trading').select('product, trade_date, units, price, fee')
  ]);
  if (fyRes.error) throw fyRes.error;
  const FYS      = fyRes.data || [];
  const distRows = distRes.data || [];
  const tradeRows = tradeRes.data || [];

  function inRange(d, start, end) { return d && d >= start && d <= end; }
  function isCashFunds(p) { return (p || '').trim().toLowerCase() === 'cash funds'; }

  const isByFy = {}; (incomeStatementRows || []).forEach(function(r) { isByFy[r.fy] = r; });
  const bsByFy = {}; (balanceSheetRows   || []).forEach(function(r) { bsByFy[r.fy] = r; });

  let prevTotalAssets = null;

  const rows = FYS.map(function(fy) {
    const start = fy.start_date, end = fy.end_date;
    const is = isByFy[fy.label] || {};
    const bs = bsByFy[fy.label] || {};

    const revenue        = is.revenue || 0;
    const grossIncome    = is.grossIncome || 0;
    const profitBeforeTax = is.profitBeforeTax || 0;
    const netIncome      = is.netIncome || 0;

    const totalAssets      = bs.totalAssets || 0;
    const totalLiabilities = bs.totalLiabilities || 0;
    const totalEquity      = bs.totalEquity || 0;
    const cash             = bs.cash || 0;
    const ntaPerShare      = bs.ntaPerShare || 0;

    // ── Profitability ──
    const grossMargin = revenue ? (grossIncome / revenue) * 100 : null;
    const pbtMargin    = revenue ? (profitBeforeTax / revenue) * 100 : null;
    const natMargin    = revenue ? (netIncome / revenue) * 100 : null;

    // ── Return (average of assets, previous FY defaults to 0) ──
    const avgAssets = prevTotalAssets === null ? totalAssets : (totalAssets + prevTotalAssets) / 2;
    const yieldReturn    = avgAssets ? (revenue / avgAssets) * 100 : null;
    const grossReturn    = avgAssets ? (grossIncome / avgAssets) * 100 : null;
    const returnOnAsset  = avgAssets ? (netIncome / avgAssets) * 100 : null;

    // ── Leverage ──
    const gearingRatio     = totalEquity ? (totalLiabilities / totalEquity) * 100 : null;
    const cashReserveRatio = totalAssets ? (cash / totalAssets) * 100 : null;

    // ── Dividend ──
    const dps = distRows
      .filter(function(r) { return r.status === 'Paid' && inRange(r.ex_date, start, end); })
      .reduce(function(s, r) { return s + (parseFloat(r.dps) || 0); }, 0);
    const dividendYield = ntaPerShare ? ((dps / 100) / ntaPerShare) * 100 : null;

    // ── Others (excludes Cash Funds) ──
    const fyTrades = tradeRows.filter(function(r) { return inRange(r.trade_date, start, end) && !isCashFunds(r.product); });
    const numTransactions = fyTrades.length;
    const totalTradingAmount = fyTrades.reduce(function(s, r) { return s + Math.abs((parseFloat(r.units) || 0) * (parseFloat(r.price) || 0)); }, 0);
    const totalTradingUnits  = fyTrades.reduce(function(s, r) { return s + Math.abs(parseFloat(r.units) || 0); }, 0);
    const totalTradingFees   = fyTrades.reduce(function(s, r) { return s + (parseFloat(r.fee) || 0); }, 0);
    const feesRate = totalTradingAmount ? (totalTradingFees / totalTradingAmount) * 100 : null;

    prevTotalAssets = totalAssets;

    return {
      fy: fy.label, startDate: start, endDate: end,
      grossMargin: grossMargin, pbtMargin: pbtMargin, natMargin: natMargin,
      yieldReturn: yieldReturn, grossReturn: grossReturn, returnOnAsset: returnOnAsset,
      gearingRatio: gearingRatio, cashReserveRatio: cashReserveRatio,
      dps: dps, dividendYield: dividendYield,
      numTransactions: numTransactions, totalTradingAmount: totalTradingAmount,
      totalTradingUnits: totalTradingUnits, totalTradingFees: totalTradingFees, feesRate: feesRate
    };
  });

  return rows;
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
