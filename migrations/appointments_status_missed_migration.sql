-- ============================================================
-- Adds "missed" as a valid appointments.status value, for the
-- missed-session / reissue workflow in counselor-appointments.html.
-- A check constraint on this column already exists on the live
-- database (added by hand, like the one on cases — see
-- cases_tables.sql's own comment on this) but isn't tracked in these
-- migrations. Own it here explicitly, matching every status value
-- the app actually uses. Safe to re-run.
-- ============================================================

alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments
  add constraint appointments_status_check
  check (status in ('pending', 'approved', 'completed', 'cancelled', 'declined', 'rescheduled', 'missed'));
