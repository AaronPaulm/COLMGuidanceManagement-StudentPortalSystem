// Supabase Edge Function: notify-announcement-email
//
// Sends a best-effort email to every student with a real, verified personal
// email when a counselor publishes or updates an announcement. Called from
// counselor-announcements.html after the announcement row is written.
//
// Emails are ONLY sent to students with:
//   * email_verified = true (set after the verify-email OTP flow), and
//   * auth_email not null and not the fake "username@colm.edu.ph" placeholder.
// Unverified students still get the in-app notification — they just don't get
// the email, since it couldn't be delivered to a nonexistent address anyway.
//
// The announcement row is re-read from the database (service role) rather than
// trusting anything from the caller except announcement_id + is_update, so the
// sent content always matches what was actually saved.
//
// Uses Resend's batch endpoint (up to 100 emails per call), chunking for larger
// student bodies, so one publish = one (or few) upstream requests instead of N.
//
// Deploy with the Supabase CLI (set RESEND_API_KEY first):
//   supabase secrets set RESEND_API_KEY=<key>
//   supabase functions deploy notify-announcement-email
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

type AnnouncementRequest = {
  announcement_id: string;
  is_update?: boolean;
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

function buildAnnouncementEmail(
  firstName: string,
  title: string,
  content: string,
  isUpdate: boolean,
  portalUrl: string | null | undefined
): string {
  const name = escapeHtml(firstName || "there");
  const link = portalUrl
    ? `<p><a href="${escapeHtml(portalUrl)}">View the announcement in your student portal</a></p>`
    : "";
  return `
    <p>Warm greetings, ${name},</p>
    <p>${isUpdate ? "The following announcement has been updated" : "A new announcement has been posted"} by the COLM Guidance Office:</p>
    <h3 style="margin-bottom:0;">${escapeHtml(title)}</h3>
    <p>${escapeHtml(content)}</p>
    ${link}
    <p>— <em>COLM Guidance Office</em></p>
  `.trim();
}

Deno.serve(async (req) => {
  const headers = corsHeadersFor(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const body = (await req.json()) as AnnouncementRequest;

    if (!body?.announcement_id) {
      return json({ error: "announcement_id is required." }, 400, headers);
    }
    if (!RESEND_API_KEY) {
      return json({ error: "RESEND_API_KEY is not configured." }, 500, headers);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: announcement, error: announcementError } = await supabase
      .from("announcements")
      .select("title, announcement_content, announcement_date")
      .eq("announcement_id", body.announcement_id)
      .maybeSingle();

    if (announcementError) {
      return json({ error: `Failed to read announcement: ${announcementError.message}` }, 500, headers);
    }
    if (!announcement) {
      return json({ ok: true, skipped: "no announcement row" }, 200, headers);
    }

    const { data: students } = await supabase
      .from("students")
      .select("user_id, first_name, auth_email")
      .eq("is_archived", false)
      .eq("email_verified", true);

    const recipients = (students || []).filter(
      (s) => s.auth_email && !/@colm\.edu\.ph$/i.test(s.auth_email)
    );

    if (recipients.length === 0) {
      return json({ ok: true, sent: 0, skipped: students ? students.length : 0 }, 200, headers);
    }

    const prefix = body.is_update ? "Announcement update" : "New announcement";
    const subject = `${prefix}: ${announcement.title}`;
    const link =
      body.portal_url || `https://${req.headers.get("host")?.split("://").pop() || "colmguidance.org"}`;

    const emails = recipients.map((s) => {
      return {
        from: SENDER,
        to: [s.auth_email as string],
        subject,
        html: buildAnnouncementEmail(s.first_name, announcement.title, announcement.announcement_content, !!body.is_update, link),
      };
    });

    // Resend's /emails/batch accepts up to 100 per call — chunk just in case.
    const CHUNK = 100;
    let sent = 0;
    for (let i = 0; i < emails.length; i += CHUNK) {
      const chunk = emails.slice(i, i + CHUNK);
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        const detail = await res.text();
        return json({ error: `Resend rejected the batch: ${detail}` }, 502, headers);
      }
      sent += chunk.length;
    }

    return json({ ok: true, sent, skipped: students ? students.length - recipients.length : 0 }, 200, headers);
  } catch (err) {
    return json({ error: err.message || "Unexpected error." }, 500, headers);
  }
});