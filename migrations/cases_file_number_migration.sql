-- ============================================================
-- Human-facing "file number" for cases (E1) — the case summary
-- view needs one and the only identifier that existed was the raw
-- internal case_id. Generated automatically as "<school_year>-<case_id
-- padded to 6 digits>" so every insert path (New Case modal, and the
-- "Add to Case" flow from Appointments) gets one without either page
-- needing to compute it itself. Safe to re-run.
--
-- Depends on cases.school_year, added by
-- cases_school_year_migration.sql — but doesn't require that file to
-- have run first. The block below backfills school_year itself (only
-- where still null) using the same June-cutoff rule, so this file
-- works standalone in either run order and both migrations converge
-- on the same values either way.
-- ============================================================

alter table public.cases
  add column if not exists school_year text;

update public.cases
set school_year = case
  when extract(month from created_at) >= 6
    then extract(year from created_at)::text || '-' || (extract(year from created_at)::int + 1)::text
  else (extract(year from created_at)::int - 1)::text || '-' || extract(year from created_at)::text
end
where school_year is null;

alter table public.cases
  add column if not exists file_number text;

-- Postgres resolves identity-column defaults (case_id) before BEFORE
-- ROW triggers run, so NEW.case_id is already available here.
create or replace function public.set_case_file_number()
returns trigger as $$
begin
  if new.file_number is null then
    new.file_number := coalesce(new.school_year, to_char(now(), 'YYYY')) || '-' || lpad(new.case_id::text, 6, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists cases_set_file_number on public.cases;
create trigger cases_set_file_number
  before insert on public.cases
  for each row execute function public.set_case_file_number();

-- Backfill existing rows the same way.
update public.cases
set file_number = coalesce(school_year, to_char(created_at, 'YYYY')) || '-' || lpad(case_id::text, 6, '0')
where file_number is null;

create unique index if not exists cases_file_number_idx on public.cases (file_number);
