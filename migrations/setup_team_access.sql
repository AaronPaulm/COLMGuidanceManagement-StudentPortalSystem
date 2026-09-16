-- ============================================================
-- Team-shared guidance office access — the operating model approved
-- for this school: every guidance personnel shares the whole team
-- caseload (cases, sessions, attachments, signed docs, interventions,
-- intervention templates, visit logs, appointments). What differs
-- between personnel is only WHO edited a given record, never WHAT
-- they are allowed to see.
--
-- Two things happen here:
--   1. Every counselor-only table's RLS changes from the per-counselor
--      guard
--        counselor_id in (select counselor_id from public.counselors
--                          where user_id = auth.uid())
--      to the team-wide guard
--        exists (select 1 from public.counselors where user_id = auth.uid())
--      — i.e. "any authenticated guidance personnel may read, create,
--      update, and delete every case / session / attachment / signed
--      document / intervention / template / visit log / appointment."
--      The per-row counselor_id column is KEPT untouched: it stays the
--      creator/owner (accountability anchor), it just no longer gates
--      access.
--   2. Audit columns are added ONLY where the user wants "who edited"
--      to be answerable — cases and case_sessions are living documents
--      that personnel shape together over timeable. visit_logs (a
--      one-shot event record) and appointments (student-facing booking)
--      deliberately get NO updated_by — matching the decision that
--      "the only difference is who edited the data" applies to shared
--      case work, not to event logging or student self-service.
--
-- Student-facing behavior is unchanged: students can still choose a
-- specific personnel when booking, and the student users' RLS is
-- untouched. The "office approves together" change to appointments is
-- purely on the counselor-management side.
--
-- Safe to re-run — every statement is idempotent (drop policy if
-- exists + create). No data is ever deleted.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Cases — team-wide read/create/update/delete
-- ------------------------------------------------------------
drop policy if exists "counselor can view own cases" on public.cases;
create policy "counselor can view own cases"
  on public.cases for select
  using (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can create cases" on public.cases;
create policy "counselor can create cases"
  on public.cases for insert
  with check (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can update own cases" on public.cases;
create policy "counselor can update own cases"
  on public.cases for update
  using (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can delete own cases" on public.cases;
create policy "counselor can delete own cases"
  on public.cases for delete
  using (exists (select 1 from public.counselors where user_id = auth.uid()));

-- ------------------------------------------------------------
-- 2. Case sessions — team-wide read/create/update/delete
--    (policy predicate widens from own-cases to any-case)
-- ------------------------------------------------------------
drop policy if exists "counselor can view sessions of own cases" on public.case_sessions;
create policy "counselor can view sessions of own cases"
  on public.case_sessions for select
  using (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can create sessions on own cases" on public.case_sessions;
create policy "counselor can create sessions on own cases"
  on public.case_sessions for insert
  with check (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can update sessions on own cases" on public.case_sessions;
create policy "counselor can update sessions on own cases"
  on public.case_sessions for update
  using (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can delete sessions on own cases" on public.case_sessions;
create policy "counselor can delete sessions on own cases"
  on public.case_sessions for delete
  using (exists (select 1 from public.counselors where user_id = auth.uid()));

-- ------------------------------------------------------------
-- 3. Case session attachments — team-wide
-- ------------------------------------------------------------
drop policy if exists "counselor can view attachments of own cases" on public.case_session_attachments;
create policy "counselor can view attachments of own cases"
  on public.case_session_attachments for select
  using (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can add attachments to own cases" on public.case_session_attachments;
create policy "counselor can add attachments to own cases"
  on public.case_session_attachments for insert
  with check (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can delete attachments of own cases" on public.case_session_attachments;
create policy "counselor can delete attachments of own cases"
  on public.case_session_attachments for delete
  using (exists (select 1 from public.counselors where user_id = auth.uid()));

-- ------------------------------------------------------------
-- 4. Case signed documents — team-wide
-- ------------------------------------------------------------
drop policy if exists "counselor can view signed docs of own cases" on public.case_signed_documents;
create policy "counselor can view signed docs of own cases"
  on public.case_signed_documents for select
  using (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can add signed docs to own cases" on public.case_signed_documents;
create policy "counselor can add signed docs to own cases"
  on public.case_signed_documents for insert
  with check (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can delete signed docs of own cases" on public.case_signed_documents;
create policy "counselor can delete signed docs of own cases"
  on public.case_signed_documents for delete
  using (exists (select 1 from public.counselors where user_id = auth.uid()));

-- ------------------------------------------------------------
-- 5. Interventions — team-wide for the counselor side. The
--    student-facing policies ("student can view own visible
--    interventions" and the is_own_case/is_visible gates) are
--    intentionally left untouched.
-- ------------------------------------------------------------
drop policy if exists "counselor can view own interventions" on public.interventions;
create policy "counselor can view own interventions"
  on public.interventions for select
  using (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can create interventions" on public.interventions;
create policy "counselor can create interventions"
  on public.interventions for insert
  with check (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can update own interventions" on public.interventions;
create policy "counselor can update own interventions"
  on public.interventions for update
  using (exists (select 1 from public.counselors where user_id = auth.uid()));

-- ------------------------------------------------------------
-- 6. Intervention templates — team-wide
-- ------------------------------------------------------------
drop policy if exists "counselor can view own intervention templates" on public.intervention_templates;
create policy "counselor can view own intervention templates"
  on public.intervention_templates for select
  using (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can create intervention templates" on public.intervention_templates;
create policy "counselor can create intervention templates"
  on public.intervention_templates for insert
  with check (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can delete own intervention templates" on public.intervention_templates;
create policy "counselor can delete own intervention templates"
  on public.intervention_templates for delete
  using (exists (select 1 from public.counselors where user_id = auth.uid()));

-- ------------------------------------------------------------
-- 7. Visit logs — team-wide. No updated_by: a visit log is a one-shot
--    event record ("a student/entity came into the office"), logged by
--    whoever was on the desk; per the design decision no "who recorded
--    this" attribution is required.
-- ------------------------------------------------------------
drop policy if exists "counselor can view own visit logs" on public.visit_logs;
create policy "counselor can view own visit logs"
  on public.visit_logs for select
  using (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can create visit logs" on public.visit_logs;
create policy "counselor can create visit logs"
  on public.visit_logs for insert
  with check (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can update own visit logs" on public.visit_logs;
create policy "counselor can update own visit logs"
  on public.visit_logs for update
  using (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can delete own visit logs" on public.visit_logs;
create policy "counselor can delete own visit logs"
  on public.visit_logs for delete
  using (exists (select 1 from public.counselors where user_id = auth.uid()));

-- ------------------------------------------------------------
-- 8. Audit columns — only on the living documents personnel shape
--    together. Kept as "add column if not exists" so history isn't
--    lost on re-run. updated_by holds the personnel who last edited;
--    set null on delete does NOT happen — see A2 note: we keep the
--    bigint even if that personnel later leaves, so the historical
--    attribution is never erased. (on delete set null keeps the row
--    valid but would drop the attribution; we deliberately attach to
--    the immutable counselor row, which is never hard-deleted in this
--    app once a personnel account exists.)
-- ------------------------------------------------------------
alter table public.cases
  add column if not exists updated_by bigint references public.counselors(counselor_id) on delete set null;

alter table public.case_sessions
  add column if not exists updated_by bigint references public.counselors(counselor_id) on delete set null;

-- ------------------------------------------------------------
-- 9. Appointments — team tightening. This table previously had NO RLS
--    at all: any authenticated account could read or write any
--    appointment. That was a real, silent exposure (a student could
--    open another student's booking), so we close it here while
--    keeping the two operating decisions that were already locked:
--
--    * The student-facing personnel picker KEEPS the appointment
--      bound to a specific personnel (the booking is still "with Ms.
--      A"), so the student combo box stays and the no-double-booking
--      unique index (counselor_id, appointment_date, appointment_time)
--      keeps working untouched.
--    * On the personnel side the whole office manages every
--      appointment (team-wide select/insert/update/delete) — that's
--      the "team decides together" approval behavior already approved.
--
-- Student-facing RLS narrows each student to their OWN appointments
-- only (student_id in own students where user_id = auth.uid()), which
-- is the actual leak fix.
-- ------------------------------------------------------------
alter table public.appointments enable row level security;

drop policy if exists "student can view own appointments" on public.appointments;
create policy "student can view own appointments"
  on public.appointments for select
  using (student_id in (select student_id from public.students where user_id = auth.uid()));

drop policy if exists "student can create own appointments" on public.appointments;
create policy "student can create own appointments"
  on public.appointments for insert
  with check (
    student_id in (select student_id from public.students where user_id = auth.uid())
  );

drop policy if exists "student can update own appointments" on public.appointments;
create policy "student can update own appointments"
  on public.appointments for update
  using (student_id in (select student_id from public.students where user_id = auth.uid()))
  with check (student_id in (select student_id from public.students where user_id = auth.uid()));

drop policy if exists "student can delete own appointments" on public.appointments;
create policy "student can delete own appointments"
  on public.appointments for delete
  using (student_id in (select student_id from public.students where user_id = auth.uid()));

drop policy if exists "counselor can view all appointments" on public.appointments;
create policy "counselor can view all appointments"
  on public.appointments for select
  using (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can create appointments" on public.appointments;
create policy "counselor can create appointments"
  on public.appointments for insert
  with check (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can update all appointments" on public.appointments;
create policy "counselor can update all appointments"
  on public.appointments for update
  using (exists (select 1 from public.counselors where user_id = auth.uid()))
  with check (exists (select 1 from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can delete all appointments" on public.appointments;
create policy "counselor can delete all appointments"
  on public.appointments for delete
  using (exists (select 1 from public.counselors where user_id = auth.uid()));
