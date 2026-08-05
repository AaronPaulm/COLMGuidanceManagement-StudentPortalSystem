// Supabase Edge Function: send-appointment-reminders
//
// Meant to run on a daily schedule (see
// migrations/appointment_reminders_cron.sql, which wires this up via
// pg_cron + pg_net) rather than being called from the frontend. Finds
// tomorrow's approved appointments that haven't been reminded yet and
// drops a notification into the bell the student already has (see
// js/student-common.js) — no new notification channel needed, this
// just automates writing to the one that's already there.
//
// Deploy with the Supabase CLI:
//   supabase functions deploy send-appointment-reminders --no-verify-jwt
//
// --no-verify-jwt is needed because pg_cron calls this on a timer with
// the service-role key rather than a logged-in user's session token;
// the function itself re-checks that the caller presented the
// service-role key before doing anything, so it's still not an open
// endpoint that anyone can trigger.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Dev-only allowlist — widen this to the real deployed origin(s)
// once the site is hosted somewhere other than localhost. This
// function is normally called server-to-server by pg_cron (no Origin
// header), so it's unaffected either way — this just also blocks it
// from being invoked cross-origin from a browser tab.
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
    const authHeader = req.headers.get("Authorization") || "";
    if (authHeader !== `Bearer ${SERVICE_ROLE_KEY}`) {
      return json({ error: "This function only runs on the scheduled job" }, 401);
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: appointments, error } = await adminClient
      .from("appointments")
      .select(
        "appointment_id, appointment_time, students(user_id), counselors(first_name, last_name)"
      )
      .eq("appointment_date", tomorrow)
      .eq("status", "approved")
      .is("reminder_sent_at", null);

    if (error) return json({ error: error.message }, 500);

    let sent = 0;
    for (const appt of appointments || []) {
      const userId = appt.students?.user_id;
      if (!userId) continue;

      const counselorName = appt.counselors
        ? `${appt.counselors.first_name} ${appt.counselors.last_name}`
        : "your counselor";

      const { error: notifError } = await adminClient.from("notifications").insert({
        recipient_user_id: userId,
        type: "appointment",
        title: "Appointment reminder",
        message: `You have a guidance appointment with ${counselorName} tomorrow at ${appt.appointment_time}.`,
        link: "student-appointments.html",
      });

      if (!notifError) {
        await adminClient
          .from("appointments")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("appointment_id", appt.appointment_id);
        sent++;
      }
    }

    return json({ success: true, remindersSent: sent });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
