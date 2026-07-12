// supabase/functions/fetch-historical/index.ts
//
// Fetches historical weekly close prices for an external index/ticker from
// Yahoo Finance and returns them in a small, stable shape. This exists so
// the browser never has to call Yahoo Finance directly — Yahoo returns 403
// for cross-origin browser requests, and every workaround short of this
// (public CORS proxies like corsproxy.io) has turned out to be unreliable
// in production. Running server-side here means no CORS problem at all:
// Yahoo sees a normal server-to-server request.
//
// Used by assets/js/member-api.js's mpLoadYahooWeekly() for the Fund page's
// correlation matrix / Sharpe ratio chart and desktop's Comparison page.
//
// Request:
//   GET  /functions/v1/fetch-historical?symbol=%5EKLSE&interval=1wk&range=5y
//   POST /functions/v1/fetch-historical  { "symbol": "^KLSE", "interval": "1wk", "range": "5y" }
//   (interval/range are optional, default to "1wk"/"5y" — the correlation
//   matrix's 5-year weekly window.)
//
// Response (200):
//   { "symbol": "^KLSE", "points": [ { "date": "2021-01-04", "close": 1627.21 }, ... ] }
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

  let symbol: string | null = null;
  let interval = "1wk";
  let range = "5y";

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      symbol = typeof body.symbol === "string" ? body.symbol : null;
      if (typeof body.interval === "string" && body.interval) interval = body.interval;
      if (typeof body.range === "string" && body.range) range = body.range;
    } else {
      const url = new URL(req.url);
      symbol = url.searchParams.get("symbol");
      interval = url.searchParams.get("interval") || interval;
      range = url.searchParams.get("range") || range;
    }
  } catch (_e) {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  if (!symbol) {
    return jsonResponse({ error: "Missing required 'symbol' parameter" }, 400);
  }

  const yahooUrl = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol)
    + "?interval=" + encodeURIComponent(interval) + "&range=" + encodeURIComponent(range);

  let yahooRes: Response;
  try {
    yahooRes = await fetch(yahooUrl, {
      headers: {
        // Yahoo's chart endpoint sometimes blocks requests with no
        // browser-like User-Agent even for legitimate server calls.
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
  } catch (e) {
    return jsonResponse({ error: "Could not reach Yahoo Finance: " + (e instanceof Error ? e.message : String(e)) }, 502);
  }

  if (!yahooRes.ok) {
    return jsonResponse({ error: "Yahoo Finance request failed for " + symbol + " (" + yahooRes.status + ")" }, 502);
  }

  const json = await yahooRes.json().catch(() => null);
  const result = json?.chart?.result?.[0];
  if (!result || !result.timestamp) {
    return jsonResponse({ error: "No data returned for " + symbol }, 502);
  }

  const timestamps: number[] = result.timestamp;
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];

  const points: { date: string; close: number }[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (c == null) continue;
    points.push({ date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10), close: c });
  }

  return jsonResponse({ symbol, points }, 200);
});
