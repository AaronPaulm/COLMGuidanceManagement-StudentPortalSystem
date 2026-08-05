-- ============================================================
-- Case tracking: a case can span multiple counseling sessions,
-- optionally starting from a completed appointment. Counselor-only
-- (no student-facing RLS) since case data is incident/discipline
-- adjacent. Safe to re-run — every statement is idempotent, in case
-- an earlier run partially applied before failing.
-- ============================================================

create table if not exists public.cases (
  case_id bigint generated always as identity primary key,
  student_id bigint not null references public.students(student_id) on delete cascade,
  counselor_id bigint not null references public.counselors(counselor_id) on delete cascade,
  nature_of_incident text not null,
  status text not null default 'open', -- open | monitoring | resolved
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "create table if not exists" above only runs on a genuinely new table —
-- if cases already existed from an earlier version of this file (before
-- updated_at was added to the create statement), re-running the migration
-- silently skips it, since IF NOT EXISTS only guards table creation, not
-- columns on an existing table. This covers that gap safely either way.
alter table public.cases
  add column if not exists updated_at timestamptz not null default now();

-- A check constraint named cases_status_check exists on the live database
-- but isn't defined anywhere in these tracked migrations — it was added
-- by hand at some point (likely via the Studio table editor), and its
-- allowed values don't match what the app actually sends. Own it here
-- explicitly instead: drop whatever's there and recreate it matching
-- counselor-cases.html's real status values.
alter table public.cases drop constraint if exists cases_status_check;
alter table public.cases
  add constraint cases_status_check check (status in ('open', 'monitoring', 'resolved'));

create index if not exists cases_counselor_idx on public.cases (counselor_id);
create index if not exists cases_student_idx on public.cases (student_id);

create table if not exists public.case_sessions (
  session_id bigint generated always as identity primary key,
  case_id bigint not null references public.cases(case_id) on delete cascade,
  appointment_id bigint references public.appointments(appointment_id) on delete set null,
  session_date date not null default current_date,
  action_taken text,
  session_note text,
  recommendation text,
  created_at timestamptz not null default now()
);

create index if not exists case_sessions_case_idx on public.case_sessions (case_id);

alter table public.cases enable row level security;

drop policy if exists "counselor can view own cases" on public.cases;
create policy "counselor can view own cases"
  on public.cases for select
  using (counselor_id in (select counselors.counselor_id from public.counselors where counselors.user_id = auth.uid()));

drop policy if exists "counselor can create cases" on public.cases;
create policy "counselor can create cases"
  on public.cases for insert
  with check (counselor_id in (select counselors.counselor_id from public.counselors where counselors.user_id = auth.uid()));

drop policy if exists "counselor can update own cases" on public.cases;
create policy "counselor can update own cases"
  on public.cases for update
  using (counselor_id in (select counselors.counselor_id from public.counselors where counselors.user_id = auth.uid()));

drop policy if exists "counselor can delete own cases" on public.cases;
create policy "counselor can delete own cases"
  on public.cases for delete
  using (counselor_id in (select counselors.counselor_id from public.counselors where counselors.user_id = auth.uid()));

alter table public.case_sessions enable row level security;

drop policy if exists "counselor can view sessions of own cases" on public.case_sessions;
create policy "counselor can view sessions of own cases"
  on public.case_sessions for select
  using (
    case_id in (
      select cases.case_id from public.cases
      where cases.counselor_id in (
        select counselors.counselor_id from public.counselors where counselors.user_id = auth.uid()
      )
    )
  );

drop policy if exists "counselor can create sessions on own cases" on public.case_sessions;
create policy "counselor can create sessions on own cases"
  on public.case_sessions for insert
  with check (
    case_id in (
      select cases.case_id from public.cases
      where cases.counselor_id in (
        select counselors.counselor_id from public.counselors where counselors.user_id = auth.uid()
      )
    )
  );

drop policy if exists "counselor can update sessions on own cases" on public.case_sessions;
create policy "counselor can update sessions on own cases"
  on public.case_sessions for update
  using (
    case_id in (
      select cases.case_id from public.cases
      where cases.counselor_id in (
        select counselors.counselor_id from public.counselors where counselors.user_id = auth.uid()
      )
    )
  );

drop policy if exists "counselor can delete sessions on own cases" on public.case_sessions;
create policy "counselor can delete sessions on own cases"
  on public.case_sessions for delete
  using (
    case_id in (
      select cases.case_id from public.cases
      where cases.counselor_id in (
        select counselors.counselor_id from public.counselors where counselors.user_id = auth.uid()
      )
    )
  );
