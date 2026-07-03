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

  let prevReceivables = null, prevCashEnd = null;

  const rows = FYS.map(function(fy) {
    const start = fy.start_date, end = fy.end_date;
    const is = isByFy[fy.label] || {};
    const bs = bsByFy[fy.label] || {};

    const profitBeforeTax = is.profitBeforeTax || 0;
    // Reverse out the non-cash unrealised P&L embedded in Profit before Tax
    // (indirect method): a gain is subtracted, a loss is added back.
    const unrealizedAdjustment = -(is.unrealizedPnl || 0);

    const receivables = bs.dividendReceivables || 0;
    const changeReceivables = prevReceivables === null ? 0 : (prevReceivables - receivables);

    const cashflowFromOps = profitBeforeTax + unrealizedAdjustment + changeReceivables;
    const incomeTaxPaid = 0;
    const netCashOperating = cashflowFromOps + incomeTaxPaid;

    const fyTrades = tradeRows.filter(function(r) { return inRange(r.trade_date, start, end); });
    const proceedsSecurities = fyTrades
      .filter(function(r) { return isSecuritiesProduct(r.product); })
      .reduce(function(s, r) { return s + (parseFloat(r.cashflow) || 0); }, 0);
    const proceedsOtherAssets = fyTrades
      .filter(function(r) { return !isSecuritiesProduct(r.product); })
      .reduce(function(s, r) { return s + (parseFloat(r.cashflow) || 0); }, 0);
    const netCashInvesting = proceedsSecurities + proceedsOtherAssets;

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

    prevReceivables = receivables; prevCashEnd = cashEnding;

    return {
      fy: fy.label, startDate: start, endDate: end,
      profitBeforeTax: profitBeforeTax, unrealizedAdjustment: unrealizedAdjustment,
      changeReceivables: changeReceivables,
      cashflowFromOps: cashflowFromOps, incomeTaxPaid: incomeTaxPaid, netCashOperating: netCashOperating,
      proceedsSecurities: proceedsSecurities, proceedsOtherAssets: proceedsOtherAssets, netCashInvesting: netCashInvesting,
      dividendPaid: dividendPaid, issuanceOfShares: issuanceOfShares, netCashFinancing: netCashFinancing,
      netIncreaseInCash: netIncreaseInCash, cashBeginning: cashBeginning, cashEnding: cashEnding
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
