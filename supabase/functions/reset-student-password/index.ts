// Supabase Edge Function: reset-student-password
//
// Called from counselor-student.html when a counselor needs to reset a
// student's login password (e.g. the student forgot it and can't use the
// self-service "Forgot password?" email flow, or never got their original
// temp password). Resets it back to the school's standard student login
// password, set directly via the Admin API, which needs the service-role
// key and so can't run client-side.
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

// Dev-only allowlist — widen this to the real deployed origin(s)
// once the site is hosted somewhere other than localhost.
const ALLOWED_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
  if (origin === "null" || ALLOWED_ORIGIN_PATTERN.test(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

// Kept in sync with create-student-accounts — the same standard password
// every student is expected to log in with initially.
const STUDENT_TEMP_PASSWORD = "colmstudent";

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

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      password: STUDENT_TEMP_PASSWORD,
    });

    if (updateError) return json({ error: updateError.message }, 400);

    return json({ success: true, tempPassword: STUDENT_TEMP_PASSWORD });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
