-- ============================================================
-- The missed-appointment "reissue" flow in counselor-appointments.html
-- (see the "missed" case in openActionModal's confirm handler) has a
-- counselor insert a brand-new appointments row directly, to schedule
-- the replacement session after marking the old one "missed" (see
-- appointments_status_missed_migration.sql for that status value).
--
-- Every insert policy on public.appointments so far was written back
-- when only students ever booked appointments (checking student_id
-- against auth.uid()), so a counselor-initiated insert has never had
-- a matching WITH CHECK and gets rejected by RLS — "new row violates
-- row-level security policy for table appointments" — even though the
-- counselor already has update rights on that same student's
-- appointments. Add the missing insert policy, same ownership check
-- already used for counselor-authored rows elsewhere (see
-- cases_tables.sql's "counselor can create cases"). Safe to re-run.
-- ============================================================

drop policy if exists "counselor can create appointments for own students" on public.appointments;
create policy "counselor can create appointments for own students"
  on public.appointments for insert
  with check (
    counselor_id in (select counselor_id from public.counselors where user_id = auth.uid())
  );
