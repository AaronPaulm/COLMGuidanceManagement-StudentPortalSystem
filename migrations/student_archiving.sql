-- ============================================================
-- Student account editing + 4yr (college) / 6yr (Grade 7-12)
-- archiving support. Archiving is a soft flag, not a delete —
-- records stay intact; login is separately disabled via the
-- disable-student-account Edge Function. Safe to re-run.
-- ============================================================

alter table public.students
  add column if not exists education_level text,        -- 'college' | 'junior_high' | 'senior_high'
  add column if not exists enrollment_school_year text,  -- e.g. '2021-2022'
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists review_dismissed_at timestamptz;

create index if not exists students_is_archived_idx on public.students (is_archived);

-- Counselors could already read students, but there's no evidence of an
-- UPDATE policy — needed now that account info + archiving are editable.
drop policy if exists "counselor can update students" on public.students;
create policy "counselor can update students"
  on public.students for update
  using (exists (select 1 from public.counselors where counselors.user_id = auth.uid()));
