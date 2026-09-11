-- ============================================================
-- Guidance Office Visit Logs: a running record of everyone who
-- uses the guidance office or its services — students, teachers,
-- parents/guardians, and other visitors — with the reason for
-- the visit, an optional linked case, and the visitor's drawn
-- signature. Counselor-only (no student-facing RLS), mirroring
-- how cases are scoped. Safe to re-run — every statement is
-- idempotent.
-- ============================================================

create table if not exists public.visit_logs (
  log_id bigint generated always as identity primary key,
  counselor_id bigint not null references public.counselors(counselor_id) on delete cascade,
  visitor_type text not null default 'student', -- student | teacher | parent | other
  visitor_name text,
  student_id bigint references public.students(student_id) on delete cascade,
  related_case_id bigint references public.cases(case_id) on delete set null,
  reason_for_visit text not null,
  signature text, -- drawn signature as a PNG data URL
  visit_time timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.visit_logs drop constraint if exists visit_logs_visitor_type_check;
alter table public.visit_logs
  add constraint visit_logs_visitor_type_check
  check (visitor_type in ('student', 'teacher', 'parent', 'other'));

create index if not exists visit_logs_counselor_time_idx on public.visit_logs (counselor_id, visit_time);
create index if not exists visit_logs_student_idx on public.visit_logs (student_id);
create index if not exists visit_logs_case_idx on public.visit_logs (related_case_id);

alter table public.visit_logs enable row level security;

drop policy if exists "counselor can view own visit logs" on public.visit_logs;
create policy "counselor can view own visit logs"
  on public.visit_logs for select
  using (counselor_id in (select counselors.counselor_id from public.counselors where counselors.user_id = auth.uid()));

drop policy if exists "counselor can create visit logs" on public.visit_logs;
create policy "counselor can create visit logs"
  on public.visit_logs for insert
  with check (counselor_id in (select counselors.counselor_id from public.counselors where counselors.user_id = auth.uid()));

drop policy if exists "counselor can update own visit logs" on public.visit_logs;
create policy "counselor can update own visit logs"
  on public.visit_logs for update
  using (counselor_id in (select counselors.counselor_id from public.counselors where counselors.user_id = auth.uid()));

drop policy if exists "counselor can delete own visit logs" on public.visit_logs;
create policy "counselor can delete own visit logs"
  on public.visit_logs for delete
  using (counselor_id in (select counselors.counselor_id from public.counselors where counselors.user_id = auth.uid()));