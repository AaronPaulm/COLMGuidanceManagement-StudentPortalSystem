-- ============================================================
-- Adds an optional Section field to students (block section for
-- JHS/SHS, or college block where applicable — free text since it
-- doesn't drive any calculation, just filtering/grouping).
--
-- This migration also marks the end of enrollment_school_year's role
-- in archiving math (superseded by a year-level-based countdown,
-- computed client-side from education_level + year_level — no schema
-- change needed for that part, the column just stops being read/
-- written by the app). enrollment_school_year itself is left in
-- place, unused, rather than dropped.
-- ============================================================

alter table public.students
  add column if not exists section text;

create index if not exists students_section_idx on public.students (section);
