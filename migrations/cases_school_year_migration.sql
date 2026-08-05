-- ============================================================
-- Tags each case with the school year it was opened in, so offense
-- history stays intact (per A2) while counselors can still filter a
-- student's cases down to "this school year" — the same June-cutoff
-- convention already used for form_assignments.school_year and the
-- defaultSchoolYear() JS helper in js/counselor-common.js. Safe to
-- re-run — every statement is idempotent.
-- ============================================================

alter table public.cases
  add column if not exists school_year text;

-- Backfill existing rows from created_at using the same June-cutoff
-- rule as defaultSchoolYear(): before June, a case still belongs to
-- the school year that started the previous calendar year.
update public.cases
set school_year = case
  when extract(month from created_at) >= 6
    then extract(year from created_at)::text || '-' || (extract(year from created_at)::int + 1)::text
  else (extract(year from created_at)::int - 1)::text || '-' || extract(year from created_at)::text
end
where school_year is null;

create index if not exists cases_school_year_idx on public.cases (school_year);
