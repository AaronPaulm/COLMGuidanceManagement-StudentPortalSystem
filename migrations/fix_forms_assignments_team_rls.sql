-- ============================================================
-- FORMS — team-wide access on form_sections, form_questions,
-- form_assignments, form_submissions, and form_answers
-- ============================================================
-- fix_forms_team_access.sql opened public.forms itself team-wide,
-- but the child tables were still gated per-counselor (or, in the
-- case of form_assignments and the submission tables, had no
-- committed policies at all — only out-of-band Studio ones created
-- using the same per-counselor "counselor can <VERB> own" pattern
-- as public.forms had). Symptoms:
--
--   * Opening a form created by another counselor shows no
--     sections and therefore no questions — form_sections / 
--     form_questions SELECT still resolved against the form's
--     OWNING counselor_id, so the team-wide PUBLIC.FORMS row was
--     visible but its children invisible.
--   * The Assign modal and Submissions modal did not show
--     assignments created by other counselors, so a form appeared
--     "not assigned to anyone" and the delete guard counted only
--     the viewing counselor's own assignment rows.
--
-- This migration widens the child tables to the same team guard
--
--     is_counselor()
--
-- used everywhere else, while PRESERVING the student-assignment
-- visibility branch (a student can still open forms assigned to
-- them). Idempotent: every statement is drop-if-exists or a
-- guarded create; safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. form_sections — SELECT (team-wide + student branch)
-- ------------------------------------------------------------
drop policy if exists "can view sections of viewable forms" on public.form_sections;
create policy "can view sections of viewable forms"
  on public.form_sections for select
  using (
    is_counselor()
    or form_id in (
      select form_assignments.form_id from public.form_assignments
      where form_assignments.student_id in (
        select students.student_id from public.students where students.user_id = auth.uid()
      )
    )
  );

-- ------------------------------------------------------------
-- 2. form_questions — SELECT (team-wide + student branch)
--    Supersedes fix_form_questions_select.sql's counselor-only
--    policy with the same student-assignment visibility used by
--    the student answering flow.
-- ------------------------------------------------------------
drop policy if exists "counselor can view questions" on public.form_questions;
drop policy if exists "counselor can view own questions" on public.form_questions;
drop policy if exists "can view questions of viewable forms" on public.form_questions;
create policy "can view questions of viewable forms"
  on public.form_questions for select
  using (
    is_counselor()
    or form_id in (
      select form_assignments.form_id from public.form_assignments
      where form_assignments.student_id in (
        select students.student_id from public.students where students.user_id = auth.uid()
      )
    )
  );

-- ------------------------------------------------------------
-- 3. form_assignments — full team-wide manage + student own rows
-- ------------------------------------------------------------
drop policy if exists "counselor can view assignments" on public.form_assignments;
drop policy if exists "counselor can view all assignments" on public.form_assignments;
drop policy if exists "student can view own assignments" on public.form_assignments;
create policy "counselor can view all assignments"
  on public.form_assignments for select
  using (is_counselor());
create policy "student can view own assignments"
  on public.form_assignments for select
  using (
    student_id in (select students.student_id from public.students where students.user_id = auth.uid())
  );

drop policy if exists "counselor can create assignments" on public.form_assignments;
drop policy if exists "counselor can create all assignments" on public.form_assignments;
create policy "counselor can create assignments"
  on public.form_assignments for insert
  with check (is_counselor());

drop policy if exists "counselor can update assignments" on public.form_assignments;
drop policy if exists "counselor can update all assignments" on public.form_assignments;
drop policy if exists "student can update own assignment" on public.form_assignments;
create policy "counselor can update assignments"
  on public.form_assignments for update
  using (is_counselor())
  with check (is_counselor());
create policy "student can update own assignment"
  on public.form_assignments for update
  using (
    student_id in (select students.student_id from public.students where students.user_id = auth.uid())
  )
  with check (
    student_id in (select students.student_id from public.students where students.user_id = auth.uid())
  );

drop policy if exists "counselor can delete assignments" on public.form_assignments;
drop policy if exists "counselor can delete all assignments" on public.form_assignments;
create policy "counselor can delete assignments"
  on public.form_assignments for delete
  using (is_counselor());

-- ------------------------------------------------------------
-- 4. form_submissions — counselors team-wide, student own rows
-- ------------------------------------------------------------
drop policy if exists "counselor can view submissions" on public.form_submissions;
drop policy if exists "student can view own submissions" on public.form_submissions;
create policy "counselor can view submissions"
  on public.form_submissions for select
  using (is_counselor());
create policy "student can view own submissions"
  on public.form_submissions for select
  using (
    assignment_id in (
      select form_assignments.assignment_id from public.form_assignments
      where form_assignments.student_id in (
        select students.student_id from public.students where students.user_id = auth.uid()
      )
    )
  );

drop policy if exists "counselor can create submissions" on public.form_submissions;
drop policy if exists "student can create own submission" on public.form_submissions;
create policy "counselor can create submissions"
  on public.form_submissions for insert
  with check (is_counselor());
create policy "student can create own submission"
  on public.form_submissions for insert
  with check (
    assignment_id in (
      select form_assignments.assignment_id from public.form_assignments
      where form_assignments.student_id in (
        select students.student_id from public.students where students.user_id = auth.uid()
      )
    )
  );

drop policy if exists "counselor can delete submissions" on public.form_submissions;
drop policy if exists "student can delete own submission" on public.form_submissions;
create policy "counselor can delete submissions"
  on public.form_submissions for delete
  using (is_counselor());
create policy "student can delete own submission"
  on public.form_submissions for delete
  using (
    assignment_id in (
      select form_assignments.assignment_id from public.form_assignments
      where form_assignments.student_id in (
        select students.student_id from public.students where students.user_id = auth.uid()
      )
    )
  );

-- ------------------------------------------------------------
-- 5. form_answers — counselors team-wide, student own rows
-- ------------------------------------------------------------
drop policy if exists "counselor can view answers" on public.form_answers;
drop policy if exists "student can view own answers" on public.form_answers;
create policy "counselor can view answers"
  on public.form_answers for select
  using (is_counselor());
create policy "student can view own answers"
  on public.form_answers for select
  using (
    submission_id in (
      select form_submissions.submission_id from public.form_submissions
      where form_submissions.assignment_id in (
        select form_assignments.assignment_id from public.form_assignments
        where form_assignments.student_id in (
          select students.student_id from public.students where students.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "counselor can create answers" on public.form_answers;
drop policy if exists "student can create own answers" on public.form_answers;
create policy "counselor can create answers"
  on public.form_answers for insert
  with check (is_counselor());
create policy "student can create own answers"
  on public.form_answers for insert
  with check (
    submission_id in (
      select form_submissions.submission_id from public.form_submissions
      where form_submissions.assignment_id in (
        select form_assignments.assignment_id from public.form_assignments
        where form_assignments.student_id in (
          select students.student_id from public.students where students.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "counselor can delete answers" on public.form_answers;
drop policy if exists "student can delete own answers" on public.form_answers;
create policy "counselor can delete answers"
  on public.form_answers for delete
  using (is_counselor());
create policy "student can delete own answers"
  on public.form_answers for delete
  using (
    submission_id in (
      select form_submissions.submission_id from public.form_submissions
      where form_submissions.assignment_id in (
        select form_assignments.assignment_id from public.form_assignments
        where form_assignments.student_id in (
          select students.student_id from public.students where students.user_id = auth.uid()
        )
      )
    )
  );