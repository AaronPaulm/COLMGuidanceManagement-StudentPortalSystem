-- ============================================================
-- Fixes a real bug in interventions.sql's student-facing policies:
-- both the "student can view own visible interventions" policy on
-- public.interventions and the "students can view visible
-- intervention files" policy on storage.objects check case ownership
-- by querying public.cases inside their USING clause — but cases.sql
-- deliberately gives students zero SELECT access on cases at all
-- ("Counselor-only, no student-facing RLS", since case data is
-- incident/discipline-adjacent). A subquery inside another policy's
-- USING clause is still subject to the referenced table's own RLS, so
-- that inner query against cases always came back empty for a
-- student session — meaning the outer policy silently evaluated to
-- false for every student, no matter how many interventions existed
-- or how visible they were. The intervention was really there; RLS
-- just never let the student see it.
--
-- The fix: two SECURITY DEFINER functions that check case ownership
-- with elevated privilege (bypassing cases' RLS for this one narrow
-- boolean check only) and return nothing but true/false — no case
-- data (nature_of_incident, status, etc.) is ever exposed to the
-- student through them. Safe to re-run.
-- ============================================================

create or replace function public.is_own_case(check_case_id bigint)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cases c
    join public.students s on s.student_id = c.student_id
    where c.case_id = check_case_id
      and s.user_id = auth.uid()
  );
$$;

create or replace function public.can_view_intervention_file(check_path text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.interventions i
    join public.cases c on c.case_id = i.case_id
    join public.students s on s.student_id = c.student_id
    where i.file_path = check_path
      and i.is_visible_to_student = true
      and s.user_id = auth.uid()
  );
$$;

drop policy if exists "student can view own visible interventions" on public.interventions;
create policy "student can view own visible interventions"
  on public.interventions for select
  using (
    is_visible_to_student = true
    and public.is_own_case(case_id)
  );

drop policy if exists "students can view visible intervention files" on storage.objects;
create policy "students can view visible intervention files"
  on storage.objects for select
  using (
    bucket_id = 'case-attachments'
    and public.can_view_intervention_file(storage.objects.name)
  );
