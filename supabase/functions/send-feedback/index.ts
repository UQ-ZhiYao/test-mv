// supabase/functions/send-feedback/index.ts
//
// Sends an App Feedback submission straight to support@zy-invest.com via
// Resend's API, server-side — so tapping Submit in the phone app sends the
// email immediately with no mail app / compose window involved. The
// member's own address is set as Reply-To so replying from support's inbox
// goes straight back to them, even though the email is technically sent
// from our own verified domain sender (Resend, like every transactional
// email API, requires the "from" address to be on a domain you've verified
// with them — it can't impersonate an arbitrary member's inbox).
//
// Setup required before this works:
//   1. Sign up at resend.com, verify the zy-invest.com sending domain.
//   2. Set the RESEND_API_KEY secret on this Supabase project:
//        supabase secrets set RESEND_API_KEY=re_xxxxxxxx
//   3. Deploy this function:
//        supabase functions deploy send-feedback
//
// Request (POST):
//   { "subject": "UI/UX Design", "content": "...", "memberEmail": "a@b.com",
//     "memberName": "Jane Tan" }
// Response (200):
//   { "ok": true }
// Response (400/500):
//   { "error": "..." }

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FEEDBACK_TO = "support@zy-invest.com";
// Must be an address on a domain verified with Resend — swap if the
// verified sending domain/subdomain differs from this.
const FEEDBACK_FROM = "ZY-Invest App <feedback@zy-invest.com>";

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
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "Email service is not configured" }, 500);
  }

  let body: { subject?: unknown; content?: unknown; memberEmail?: unknown; memberName?: unknown };
  try {
    body = await req.json();
  } catch (_e) {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const memberEmail = typeof body.memberEmail === "string" ? body.memberEmail.trim() : "";
  const memberName = typeof body.memberName === "string" ? body.memberName.trim() : "";

  if (!subject || !content) {
    return jsonResponse({ error: "Missing required 'subject' or 'content'" }, 400);
  }

  const bodyText = (memberName || memberEmail
    ? "From: " + (memberName || "Member") + (memberEmail ? " <" + memberEmail + ">" : "") + "\n\n"
    : "") + content;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FEEDBACK_FROM,
        to: [FEEDBACK_TO],
        reply_to: memberEmail || undefined,
        subject: "App Feedback: " + subject,
        text: bodyText,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return jsonResponse({ error: "Resend API error (" + res.status + "): " + errBody }, 502);
    }
  } catch (e) {
    return jsonResponse({ error: "Failed to reach email service: " + (e instanceof Error ? e.message : String(e)) }, 502);
  }

  return jsonResponse({ ok: true }, 200);
});
