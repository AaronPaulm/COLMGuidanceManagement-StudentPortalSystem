-- ============================================================
-- Stops two students from landing in the same counselor's slot at
-- the same time. The app already checks for this before inserting,
-- but a partial unique index is the backstop that holds even if two
-- requests race each other. Cancelled/declined slots don't count —
-- freeing that same slot back up once a booking falls through.
-- Safe to re-run.
-- ============================================================

drop index if exists public.appointments_slot_unique;
create unique index appointments_slot_unique
  on public.appointments (counselor_id, appointment_date, appointment_time)
  where status not in ('cancelled', 'declined');
