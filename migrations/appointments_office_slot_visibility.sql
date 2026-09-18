-- ============================================================
-- Office-wide slot visibility for the booking page.
--
-- The slot grid on student-appointments.html must show which
-- date+time slots are ALREADY TAKEN across the whole guidance
-- office (all counselors share one office). But the RLS policy
-- "student can view own appointments" (setup_team_access.sql)
-- only lets a student SELECT their own appointment rows, so a
-- plain .from("appointments").select(...) lookup returns nothing
-- for other students' bookings — the booked/disabled marking in
-- the grid never shows up.
--
-- We can't just widen the select policy: RLS gates ROWS, not
-- columns, so that would re-expose other students' full
-- appointment records (concern, student_id, etc.) — the exact
-- leak setup_team_access.sql closed.
--
-- Fix: a SECURITY DEFINER function that returns ONLY the taken
-- times for a date (no other columns), callable by any
-- authenticated user. Students learn which slots are busy without
-- seeing a single byte of anyone else's data. Safe to re-run.
-- ============================================================

create or replace function public.office_slot_times(target_date date)
returns table (taken_time text)
language sql
security definer
set search_path = public
stable
as $$
  select left(a.appointment_time::text, 5)
  from public.appointments a
  where a.appointment_date = target_date
    and a.status not in ('cancelled', 'declined')
$$;

-- Only authenticated accounts may ask; block anonymous/public access.
revoke all on function public.office_slot_times(date) from public;
grant execute on function public.office_slot_times(date) to authenticated;