-- ============================================================
-- Interventions: a document (usually a PDF) attached to a case that
-- the student themselves can view — the one case-related thing a
-- student is allowed to see, since cases.case_id and cases.status
-- otherwise stay counselor-only (incident/discipline-adjacent, see
-- cases_tables.sql). The counselor uploads it, the student sees it
-- while is_visible_to_student is true, and the counselor removes
-- access (doesn't delete the record — see A2) once the student has
-- improved. Reuses the existing private "case-attachments" storage
-- bucket and its bucket-wide counselor policies (see
-- case_attachments.sql); this file only adds the student-facing
-- storage policy plus the table itself. Safe to re-run.
-- ============================================================

create table if not exists public.interventions (
  intervention_id bigint generated always as identity primary key,
  case_id bigint not null references public.cases(case_id) on delete cascade,
  counselor_id bigint not null references public.counselors(counselor_id) on delete cascade,
  title text not null,
  file_path text not null,
  file_name text not null,
  is_visible_to_student boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interventions_case_idx on public.interventions (case_id);

alter table public.interventions enable row level security;

drop policy if exists "counselor can view own interventions" on public.interventions;
create policy "counselor can view own interventions"
  on public.interventions for select
  using (counselor_id in (select counselor_id from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can create interventions" on public.interventions;
create policy "counselor can create interventions"
  on public.interventions for insert
  with check (counselor_id in (select counselor_id from public.counselors where user_id = auth.uid()));

drop policy if exists "counselor can update own interventions" on public.interventions;
create policy "counselor can update own interventions"
  on public.interventions for update
  using (counselor_id in (select counselor_id from public.counselors where user_id = auth.uid()));

-- The student only ever sees interventions on their own cases, and
-- only while the counselor has left them visible — this is the
-- "access removed once the student is doing better" gate.
--
-- Checking case ownership can't be a plain subquery against
-- public.cases here — cases_tables.sql deliberately gives students
-- zero SELECT access on cases at all ("Counselor-only, no
-- student-facing RLS"), and a subquery inside a policy's USING
-- clause is still subject to the referenced table's own RLS. A plain
-- "case_id in (select ... from cases ...)" would silently come back
-- empty for every student session, no matter how visible the
-- intervention actually was. These SECURITY DEFINER functions check
-- ownership with elevated privilege instead, bypassing cases' RLS
-- for this one narrow boolean check only — they return true/false,
-- never any actual case data (nature_of_incident, status, etc.).
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

-- storage.objects has its own separate RLS layer — the policy above
-- only governs the metadata row, not the actual file bytes. Without
-- this, a student could see that an intervention exists but a signed
-- URL request for the file itself would still be denied.
drop policy if exists "students can view visible intervention files" on storage.objects;
create policy "students can view visible intervention files"
  on storage.objects for select
  using (
    bucket_id = 'case-attachments'
    and public.can_view_intervention_file(storage.objects.name)
  );
