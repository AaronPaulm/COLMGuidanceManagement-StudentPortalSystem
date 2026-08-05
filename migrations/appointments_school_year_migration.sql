-- ============================================================
-- Tags each appointment with the school year it was scheduled in —
-- same June-cutoff convention as cases.school_year
-- (cases_school_year_migration.sql) and the defaultSchoolYear() JS
-- helper, so a student's appointment history can be viewed/filtered
-- by school year the same way their cases can. Safe to re-run.
-- ============================================================

alter table public.appointments
  add column if not exists school_year text;

-- Backfilled from appointment_date (the date the session was actually
-- scheduled for), not created_at — a request made in May for a June
-- session belongs to the new school year, not the one it was booked in.
update public.appointments
set school_year = case
  when extract(month from appointment_date) >= 6
    then extract(year from appointment_date)::text || '-' || (extract(year from appointment_date)::int + 1)::text
  else (extract(year from appointment_date)::int - 1)::text || '-' || extract(year from appointment_date)::text
end
where school_year is null;

create index if not exists appointments_school_year_idx on public.appointments (school_year);
