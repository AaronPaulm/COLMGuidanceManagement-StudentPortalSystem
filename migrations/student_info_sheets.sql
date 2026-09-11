-- ============================================================
-- Annual Student Information Sheet — the long multi-section form
-- (Personal Info, Educational Background, Family Background,
-- Health, Interests, Test Results) that every student fills out
-- once per school year.
--
-- One row per (student_id, school_year): a new school year gets a
-- fresh row and old years are NEVER overwritten or deleted — the
-- guidance office keeps every year's sheet as a historical record
-- (the sheet snapshots name/year-section/etc. as they were at
-- submission time, so it must not reference the live students row).
--
-- answers is JSONB keyed by field key (see js/student-info-schema.js
-- for the single source of truth of sections/fields). Tables inside
-- the form are stored as arrays of row objects. This keeps stored
-- data valid when question wording changes in future school years —
-- no schema migration needed for wording tweaks.
--
-- Section VII ("Significant Notes — For Guidance Counselors only")
-- lives in a SEPARATE table with zero student-facing RLS policies:
-- students physically cannot read or write counselor notes, same
-- spirit as cases_tables.sql's counselor-only rule.
--
-- Safe to re-run.
-- ============================================================

create table if not exists public.student_info_sheets (
  sheet_id bigint generated always as identity primary key,
  student_id bigint not null references public.students(student_id) on delete cascade,
  school_year text not null,
  answers jsonb not null default '{}'::jsonb,
  -- Drawn e-signature as a PNG data URL (certification checkbox +
  -- canvas drawing on the student side; identity is really proven by
  -- the logged-in account + submitted_at audit stamp).
  signature text,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, school_year)
);

create index if not exists student_info_sheets_student_idx
  on public.student_info_sheets (student_id);
create index if not exists student_info_sheets_school_year_idx
  on public.student_info_sheets (school_year);

alter table public.student_info_sheets enable row level security;

-- ---------- Student policies (own rows only) ----------

drop policy if exists "student can view own info sheets" on public.student_info_sheets;
create policy "student can view own info sheets"
  on public.student_info_sheets for select
  using (
    student_id in (
      select students.student_id from public.students where students.user_id = auth.uid()
    )
  );

drop policy if exists "student can create own info sheets" on public.student_info_sheets;
create policy "student can create own info sheets"
  on public.student_info_sheets for insert
  with check (
    student_id in (
      select students.student_id from public.students where students.user_id = auth.uid()
    )
  );

drop policy if exists "student can update own info sheets" on public.student_info_sheets;
create policy "student can update own info sheets"
  on public.student_info_sheets for update
  using (
    student_id in (
      select students.student_id from public.students where students.user_id = auth.uid()
    )
  );

-- ---------- Counselor policies (read every year's sheets) ----------

drop policy if exists "counselor can view all info sheets" on public.student_info_sheets;
create policy "counselor can view all info sheets"
  on public.student_info_sheets for select
  using (public.is_counselor());

-- ============================================================
-- Section VII — Significant Notes (For Guidance Counselors only).
-- One notes row per sheet (unique sheet_id), entries is an array of
-- { date, incident, remarks } objects rendered as an editable table
-- in counselor-student.html. NO student policies on purpose.
-- ============================================================

create table if not exists public.student_info_guidance_notes (
  note_id bigint generated always as identity primary key,
  sheet_id bigint not null unique references public.student_info_sheets(sheet_id) on delete cascade,
  entries jsonb not null default '[]'::jsonb,
  updated_by bigint references public.counselors(counselor_id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.student_info_guidance_notes enable row level security;

drop policy if exists "counselor can view guidance notes" on public.student_info_guidance_notes;
create policy "counselor can view guidance notes"
  on public.student_info_guidance_notes for select
  using (public.is_counselor());

drop policy if exists "counselor can add guidance notes" on public.student_info_guidance_notes;
create policy "counselor can add guidance notes"
  on public.student_info_guidance_notes for insert
  with check (public.is_counselor());

drop policy if exists "counselor can update guidance notes" on public.student_info_guidance_notes;
create policy "counselor can update guidance notes"
  on public.student_info_guidance_notes for update
  using (public.is_counselor());
