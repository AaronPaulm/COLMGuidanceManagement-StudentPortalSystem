// Supabase Edge Function: reset-student-password
//
// Called from counselor-student.html when a counselor needs to reset a
// student's login password (e.g. the student forgot it and can't use the
// self-service "Forgot password?" email flow, or never got their original
// temp password). Issues a fresh unique temp password, set directly via
// the Admin API, which needs the service-role key and so can't run
// client-side.
//
// Deploy with the Supabase CLI:
//   supabase functions deploy reset-student-password
//
// No new secrets needed — SUPABASE_URL, SUPABASE_ANON_KEY, and
// SUPABASE_SERVICE_ROLE_KEY are provided automatically to every function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// CORS origin allowlist.
// 1. Built-in defaults: localhost, 127.0.0.1, and private LAN ranges
//    (10.x, 172.16-31.x, 192.168.x), plus "null" for file:// origins.
// 2. Extra origins via ALLOWED_ORIGINS secret (comma-separated, supports
//    "*" wildcard, e.g. "https://*.vercel.app,https://myschool.com").
//    Set with: supabase secrets set ALLOWED_ORIGINS="https://*.vercel.app"
//    Changes apply instantly — no redeploy needed.
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

// Kept in sync with create-student-accounts — every reset issues a unique
// first-login password (e.g. "colmstudent13452"): "colmstudent" plus a
// random numeric suffix, never the shared "colmstudent" the old importer
// used to hand out.
function randomTempPassword(): string {
  return `colmstudent${String(Math.floor(10000 + Math.random() * 90000))}`;
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) return json({ error: "Not authenticated" }, 401);

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerCounselor } = await adminClient
      .from("counselors")
      .select("counselor_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!callerCounselor) return json({ error: "Only counselors can reset student passwords" }, 403);

    const { userId } = await req.json();
    if (!userId) return json({ error: "Invalid request" }, 400);

    const tempPassword = randomTempPassword();

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });

    if (updateError) return json({ error: updateError.message }, 400);

    return json({ success: true, tempPassword });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
