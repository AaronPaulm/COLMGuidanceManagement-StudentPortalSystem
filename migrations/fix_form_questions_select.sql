-- ============================================================
-- form_questions — add missing SELECT policy
-- ============================================================
-- forms_sections_rls.sql added DELETE on form_questions (line 41)
-- but never added a SELECT policy. form_questions has no
-- "enable row level security" in the repo either, but if RLS was
-- enabled out-of-band in Studio (same pattern as public.forms),
-- the nested sub-select form_questions(question_id) in the
-- counselor-forms library query returns 0 rows — making every
-- form card display "0 questions".
--
-- This adds the missing SELECT policy using is_counselor(),
-- matching the existing form_sections INSERT/UPDATE/DELETE
-- pattern. Idempotent: drop-if-exists then create.
-- ============================================================

-- Drop any out-of-band per-counselor SELECT policy that may exist
drop policy if exists "counselor can view own questions" on public.form_questions;
drop policy if exists "counselor can view questions" on public.form_questions;
drop policy if exists "can view questions of viewable forms" on public.form_questions;

create policy "counselor can view questions"
  on public.form_questions for select
  using (is_counselor());
