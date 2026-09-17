-- Add optional middle_name to guidance personnel so a counselor can fill out
-- their full name on the new "My Profile" page. Idempotent - safe to re-run.
alter table public.counselors add column if not exists middle_name text;

-- Counselors already self-edit their own row from the client (see the
-- availability toggle on counselor-appointments.html), and reads work for
-- students booking appointments, so no additional RLS changes are needed.