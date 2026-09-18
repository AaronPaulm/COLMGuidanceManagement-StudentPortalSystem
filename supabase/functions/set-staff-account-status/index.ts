// Supabase Edge Function: set-staff-account-status
//
// Deactivates / reactivates a guidance personnel account.
//
// Deactivating must NOT be possible for the caller's own account
// (avoid accidental lockouts) and must never leave the office with
// ZERO active personnel — otherwise nobody could manage accounts or
// the portal afterward. Both rules are enforced here server-side
// (the UI also hides the self-row's button, but this is the
// authoritative guard).
//
// Deactivation = auth ban (~100 years, same trick as
// disable-student-account) + is_active = false so portal guards
// (requireCounselorAuth) and the student booking pickers exclude
// the person immediately. Reactivation un-bans and flips the flag.
//
// Deploy with the Supabase CLI:
//   supabase functions deploy set-staff-account-status
//
// No new secrets needed — SUPABASE_URL, SUPABASE_ANON_KEY, and
// SUPABASE_SERVICE_ROLE_KEY are provided automatically to every function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
      .select("counselor_id, user_id, is_active")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!callerCounselor) return json({ error: "Only counselors can manage staff accounts" }, 403);
    if (callerCounselor.is_active === false) {
      return json({ error: "This account has been deactivated. Contact your office admin." }, 403);
    }

    const { counselorId, active } = await req.json();
    if (!counselorId || typeof active !== "boolean") {
      return json({ error: "Invalid request" }, 400);
    }

    const { data: target } = await adminClient
      .from("counselors")
      .select("counselor_id, user_id, is_active, deactivated_at")
      .eq("counselor_id", counselorId)
      .maybeSingle();

    if (!target) return json({ error: "Counselor not found" }, 404);

    if (Number(target.counselor_id) === Number(callerCounselor.counselor_id)) {
      return json({ error: "You can't change your own account status" }, 400);
    }

    if (!active && target.is_active === true) {
      const { data: otherActive, error: countError } = await adminClient
        .from("counselors")
        .select("counselor_id")
        .eq("is_active", true)
        .neq("counselor_id", target.counselor_id);

      if (countError) return json({ error: countError.message }, 400);
      if (!otherActive || otherActive.length < 1) {
        return json(
          { error: "At least one active guidance personnel account is required — you can't deactivate the last one." },
          409
        );
      }
    }

    const { error: banError } = await adminClient.auth.admin.updateUserById(target.user_id, {
      ban_duration: active ? "none" : "876000h",
    });
    if (banError) return json({ error: banError.message }, 400);

    const { error: updateError } = await adminClient
      .from("counselors")
      .update(
        active
          ? { is_active: true, deactivated_at: null, deactivated_by: null }
          : { is_active: false, deactivated_at: new Date().toISOString(), deactivated_by: callerCounselor.counselor_id }
      )
      .eq("counselor_id", target.counselor_id);

    if (updateError) return json({ error: updateError.message }, 400);

    // Append the audit trail (never allowed to block the status change).
    await adminClient.from("counselor_audit_log").insert({
      counselor_id: target.counselor_id,
      actor_id: callerCounselor.counselor_id,
      action: active ? "activated" : "deactivated",
    });

    return json({ success: true, active });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});