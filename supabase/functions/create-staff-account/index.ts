// Supabase Edge Function: create-staff-account
//
// Called from counselor-account.html's "Create Guidance Counselor Account"
// form. Creating a login account requires the Supabase Admin API
// (auth.admin.createUser), which needs the service-role key — that can
// never be exposed to the browser, so this has to run server-side.
//
// Deploy with the Supabase CLI:
//   supabase functions deploy create-staff-account
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

// Avoids visually ambiguous characters (0/O, 1/l/I) since this gets
// hand-typed by whoever the counselor relays it to.
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let pw = "";
  for (const b of bytes) pw += chars[b % chars.length];
  return pw;
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

    if (!callerCounselor) return json({ error: "Only counselors can create staff accounts" }, 403);

    const { firstName, lastName, email, workDays } = await req.json();
    if (!firstName || !lastName || !email) return json({ error: "Missing required fields" }, 400);

    const tempPassword = generateTempPassword();

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (createError || !created?.user) {
      return json({ error: createError?.message || "Couldn't create auth user" }, 400);
    }

    const newUserId = created.user.id;

    // Roll back the auth user if either downstream insert fails, so we
    // don't end up with a login that has no matching app-side row.
    const { error: usersError } = await adminClient.from("users").insert({
      user_id: newUserId,
      role: "counselor",
    });

    if (usersError) {
      await adminClient.auth.admin.deleteUser(newUserId);
      return json({ error: "Couldn't create user record: " + usersError.message }, 400);
    }

    const { error: counselorError } = await adminClient.from("counselors").insert({
      user_id: newUserId,
      first_name: firstName,
      last_name: lastName,
      work_days: workDays || null,
      availability_status: "available",
    });

    if (counselorError) {
      await adminClient.auth.admin.deleteUser(newUserId);
      return json({ error: "Couldn't create counselor record: " + counselorError.message }, 400);
    }

    return json({ success: true, email, tempPassword });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
