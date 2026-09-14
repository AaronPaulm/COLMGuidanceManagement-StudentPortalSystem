// Supabase Edge Function: notify-student-email
//
// Sends a best-effort email to a student when a counselor takes an action on
// one of their appointments (approved / declined / conducted / rescheduled /
// note added). Called from counselor-appointments.html after the in-app
// `notifications` row is inserted.
//
// Emails are ONLY sent to students with a real, verified personal email:
//   * email_verified must be true (set after the verify-email OTP flow), and
//   * auth_email must not be the fake "username@colm.edu.ph" placeholder.
// Unverified students still get the in-app notification — they just don't get
// the email, since it couldn't be delivered to a nonexistent address anyway.
//
// Uses the service-role key only to READ the student's own row (their email),
// plus the Resend API for delivery. Deliberately does not accept a target
// email from the caller — the address always comes from the database, so the
// function can't be tricked into mailing an arbitrary address.
//
// Deploy with the Supabase CLI (set RESEND_API_KEY first):
//   supabase secrets set RESEND_API_KEY=<key>
//   supabase functions deploy notify-student-email
//
// SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are provided
// automatically to every function; ALLOWED_ORIGINS is optional (see below).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SENDER =
  Deno.env.get("EMAIL_SENDER") || "COLM Guidance Portal <no-reply@colmguidance.org>";

// CORS origin allowlist (same pattern as create-staff-account).
// 1. Built-in defaults: localhost, 127.0.0.1, private LAN ranges, "null".
// 2. Extra origins via ALLOWED_ORIGINS secret (comma-separated, supports "*"
//    wildcard, e.g. "https://*.vercel.app,https://colmguidance.org").
const DEFAULT_ALLOWED_ORIGIN_PATTERN =
  /^https?:\/\/(?:(?:localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?)$/;

function isOriginAllowed(origin: string): boolean {
  if (origin === "null") return true;
  if (DEFAULT_ALLOWED_ORIGIN_PATTERN.test(origin)) return true;
  const extra = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
  return extra.some((pattern: string) => {
    const re = new RegExp(
      "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"
    );
    return re.test(origin);
  });
}

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
  if (isOriginAllowed(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

type NotifyRequest = {
  recipient_user_id: string;
  subject: string;
  message?: string | null;
  details?: string | null;
  portal_url?: string | null;
};

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmail(
  firstName: string,
  subject: string,
  message: string | null | undefined,
  details: string | null | undefined,
  portalUrl: string | null | undefined
): string {
  const name = escapeHtml(firstName || "there");
  const msg = message ? `<p>${escapeHtml(message)}</p>` : "";
  const detailLine = details ? `<p><strong>${escapeHtml(details)}</strong></p>` : "";
  const link = portalUrl
    ? `<p><a href="${escapeHtml(portalUrl)}">View it in your student portal</a></p>`
    : "";
  return `
    <p>Hi ${name},</p>
    <p>${escapeHtml(subject)}.</p>
    ${msg}
    ${detailLine}
    ${link}
    <p>— <em>COLM Guidance Office</em></p>
  `.trim();
}

Deno.serve(async (req) => {
  const headers = corsHeadersFor(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers });
  }

  try {
    const body = (await req.json()) as NotifyRequest;

    if (!body?.recipient_user_id || !body?.subject) {
      return json({ error: "recipient_user_id and subject are required." }, 400, headers);
    }
    if (!RESEND_API_KEY) {
      return json({ error: "RESEND_API_KEY is not configured." }, 500, headers);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: student } = await supabase
      .from("students")
      .select("first_name, last_name, auth_email, email_verified")
      .eq("user_id", body.recipient_user_id)
      .maybeSingle();

    if (!student?.auth_email) {
      return json({ ok: true, skipped: "no student row" }, 200, headers);
    }
    if (student.email_verified !== true) {
      return json({ ok: true, skipped: "email not verified" }, 200, headers);
    }
    if (/@colm\.edu\.ph$/i.test(student.auth_email)) {
      return json({ ok: true, skipped: "placeholder email" }, 200, headers);
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: SENDER,
        to: [student.auth_email],
        subject: body.subject,
        html: buildEmail(student.first_name, body.subject, body.message, body.details, body.portal_url),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: `Resend rejected the email: ${detail}` }, 502, headers);
    }

    return json({ ok: true }, 200, headers);
  } catch (err) {
    return json({ error: err.message || "Unexpected error." }, 500, headers);
  }
});