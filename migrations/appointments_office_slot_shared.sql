-- ============================================================
-- The guidance office shares one appointment schedule: a booked
-- date+time belongs to the whole office, not to an individual
-- counselor. Widen the backstop index so two students can never
-- land on the same office slot even for different counselors.
-- Cancelled/declined slots don't count — freeing the slot back up
-- once a booking falls through. Safe to re-run.
--
-- Note: run after migrations/appointments_no_double_booking.sql
-- and the demo reset (data must hold the new rule — no two
-- appointments for the same date/time with different counselors).
-- ============================================================

drop index if exists public.appointments_slot_unique;
create unique index appointments_slot_unique
  on public.appointments (appointment_date, appointment_time)
  where status not in ('cancelled', 'declined');