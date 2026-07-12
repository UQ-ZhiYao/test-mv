// supabase/functions/fetch-quotes/index.ts
//
// Fetches live quote snapshots (price + change) for a batch of symbols —
// indices, forex pairs, and crypto — from Yahoo Finance, server-side. Same
// reasoning as fetch-historical/index.ts: a direct browser call to Yahoo
// Finance returns 403 (CORS), so this exists purely to run that fetch on
// the server instead, where there's no CORS restriction at all.
//
// Used by assets/js/member-api.js's mpLoadQuotes() for the phone Market
// screen's Indices/Forex/Crypto tabs.
//
// Request:
//   GET  /functions/v1/fetch-quotes?symbols=%5EKLSE,%5EGSPC,BTC-USD
//   POST /functions/v1/fetch-quotes  { "symbols": ["^KLSE","^GSPC","BTC-USD"] }
//
// Response (200):
//   { "quotes": [ { "symbol": "^KLSE", "shortName": "FTSE Bursa Malaysia KLCI",
//       "regularMarketPrice": 1627.21, "regularMarketChange": 8.72,
//       "regularMarketChangePercent": 0.54, "currency": "MYR" }, ... ] }
//   (symbols Yahoo doesn't recognize are simply absent from the array, not
//   an error — the caller renders "—" for any symbol missing from the
//   response.)
// Response (400/502/500):
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

  const yahooUrl = "https://query1.finance.yahoo.com/v7/finance/quote?symbols="
    + encodeURIComponent(symbols.join(","));

  let yahooRes: Response;
  try {
    yahooRes = await fetch(yahooUrl, {
      headers: {
        // Yahoo's quote endpoint sometimes blocks requests with no
        // browser-like User-Agent even for legitimate server calls.
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
  } catch (e) {
    return jsonResponse({ error: "Could not reach Yahoo Finance: " + (e instanceof Error ? e.message : String(e)) }, 502);
  }

  if (!yahooRes.ok) {
    return jsonResponse({ error: "Yahoo Finance request failed (" + yahooRes.status + ")" }, 502);
  }

  const json = await yahooRes.json().catch(() => null);
  const results = json?.quoteResponse?.result;
  if (!Array.isArray(results)) {
    return jsonResponse({ error: "No data returned" }, 502);
  }

  const quotes = results.map((r: Record<string, unknown>) => ({
    symbol: r.symbol,
    shortName: r.shortName || r.longName || r.symbol,
    regularMarketPrice: r.regularMarketPrice ?? null,
    regularMarketChange: r.regularMarketChange ?? null,
    regularMarketChangePercent: r.regularMarketChangePercent ?? null,
    currency: r.currency || null,
  }));

  return jsonResponse({ quotes }, 200);
});
