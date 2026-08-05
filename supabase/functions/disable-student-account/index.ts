// Supabase Edge Function: disable-student-account
//
// Called from counselor-student.html when a counselor archives or
// unarchives a student. Archiving is a *soft* archive — the student row
// and all their records (appointments, cases, forms) stay exactly as
// they are; the only thing this function does is disable (or restore)
// that student's ability to log in, via the Admin API's ban feature,
// which needs the service-role key and so can't run client-side.
//
// The students.is_archived/archived_at columns themselves are updated
// directly from the client (normal RLS-permitted update) — this
// function only handles the auth-ban side of "archiving."
//
// Deploy with the Supabase CLI:
//   supabase functions deploy disable-student-account
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

    if (!callerCounselor) return json({ error: "Only counselors can archive student accounts" }, 403);

    const { userId, archive } = await req.json();
    if (!userId || typeof archive !== "boolean") {
      return json({ error: "Invalid request" }, 400);
    }

    // ~100 years — effectively permanent until explicitly unbanned.
    const { error: banError } = await adminClient.auth.admin.updateUserById(userId, {
      ban_duration: archive ? "876000h" : "none",
    });

    if (banError) return json({ error: banError.message }, 400);

    return json({ success: true });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
