// supabase/functions/fetch-quotes/index.ts
//
// Fetches live quote snapshots (price + change) for a batch of symbols —
// indices, forex pairs, and crypto — from Yahoo Finance, server-side. Same
// reasoning as fetch-historical/index.ts: a direct browser call to Yahoo
// Finance returns 403 (CORS), so this exists purely to run that fetch on
// the server instead, where there's no CORS restriction at all.
//
// This deliberately uses the same v8/finance/chart endpoint as
// fetch-historical (one request per symbol, run in parallel), not Yahoo's
// v7/finance/quote batch endpoint — v7/finance/quote now requires a
// crumb/cookie handshake and returns 401/403 for unauthenticated
// server-to-server requests, which surfaced here as a 502. v8/finance/chart
// doesn't need that and is already proven working by fetch-historical, so
// price/change are derived from its "meta" block (regularMarketPrice vs.
// previousClose) instead of a dedicated quote field.
//
// Used by assets/js/member-api.js's mpLoadQuotes() for the phone Market
// screen's Indices/Forex/Crypto tabs.
//
// Request:
//   GET  /functions/v1/fetch-quotes?symbols=%5EKLSE,%5EGSPC,BTC-USD
//   POST /functions/v1/fetch-quotes  { "symbols": ["^KLSE","^GSPC","BTC-USD"] }
//
// Response (200):
//   { "quotes": [ { "symbol": "^KLSE", "shortName": "^KLSE",
//       "regularMarketPrice": 1627.21, "regularMarketChange": 8.72,
//       "regularMarketChangePercent": 0.54, "currency": "MYR" }, ... ] }
//   (symbols Yahoo doesn't recognize, or that fail individually, are simply
//   absent from the array, not an error — the caller renders "—" for any
//   symbol missing from the response.)
// Response (400/500):
//   { "error": "..." }

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function fetchOneQuote(symbol: string) {
  const yahooUrl = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol)
    + "?interval=1d&range=1d";
  try {
    const res = await fetch(yahooUrl, {
      headers: {
        // Yahoo's chart endpoint sometimes blocks requests with no
        // browser-like User-Agent even for legitimate server calls.
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose ?? meta.chartPreviousClose;
    if (price == null || prevClose == null) return null;
    const change = price - prevClose;
    const changePercent = prevClose ? (change / prevClose) * 100 : null;
    return {
      symbol: meta.symbol || symbol,
      shortName: meta.shortName || meta.longName || meta.symbol || symbol,
      regularMarketPrice: price,
      regularMarketChange: change,
      regularMarketChangePercent: changePercent,
      currency: meta.currency || null,
    };
  } catch (_e) {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  let symbols: string[] | null = null;

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (Array.isArray(body.symbols)) {
        symbols = body.symbols.filter((s: unknown) => typeof s === "string" && s);
      }
    } else {
      const url = new URL(req.url);
      const raw = url.searchParams.get("symbols");
      if (raw) symbols = raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  } catch (_e) {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  if (!symbols || !symbols.length) {
    return jsonResponse({ error: "Missing required 'symbols' parameter" }, 400);
  }

  const results = await Promise.all(symbols.map(fetchOneQuote));
  const quotes = results.filter((q) => q != null);

  return jsonResponse({ quotes }, 200);
});
