-- ============================================================
-- Adds a required (at the form level) category to appointments
-- so the counselor dashboard can show exact "Common Concerns"
-- analytics instead of relying on free-text keywords. The column
-- is nullable at the DB level so legacy rows (NULL) survive; the
-- appointment form enforces a category for every new submission.
-- Safe to re-run.
-- ============================================================

alter table public.appointments
  add column if not exists concern_category text;

alter table public.appointments
  drop constraint if exists appointments_concern_category_check;
alter table public.appointments
  add constraint appointments_concern_category_check
  check (
    concern_category is null
    or concern_category in (
      'Academic',
      'Career Guidance',
      'Family Concerns',
      'Bullying & Peer Relations',
      'Emotional & Mental Health',
      'Other'
    )
  );

create index if not exists appointments_concern_category_idx
  on public.appointments (concern_category);