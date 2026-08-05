-- ============================================================
-- Automated schedule reminders (a value-add — the client currently has
-- none). A daily job reminds a student about tomorrow's approved
-- appointment by writing into the notifications table that already
-- powers the bell icon in every sidebar (see js/counselor-common.js /
-- js/student-common.js) — no new UI needed, this just automates
-- writing to the channel that's already there.
--
-- Requires the pg_cron and pg_net extensions — toggle both on first
-- in the Supabase dashboard under Database > Extensions, no code
-- needed for that part.
--
-- Before running this file, replace <PROJECT_REF> and
-- <SERVICE_ROLE_KEY> below with your own project's values (Project
-- Settings > API). Never commit your real service role key to a
-- public repo — if this file is ever pushed with real values filled
-- in, rotate the key.
--
-- This also requires deploying the Edge Function first:
--   supabase functions deploy send-appointment-reminders --no-verify-jwt
-- ============================================================

alter table public.appointments
  add column if not exists reminder_sent_at timestamptz;

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('send-appointment-reminders-daily')
where exists (select 1 from cron.job where jobname = 'send-appointment-reminders-daily');

select cron.schedule(
  'send-appointment-reminders-daily',
  '0 8 * * *', -- 8:00 AM server time, every day
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-appointment-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
