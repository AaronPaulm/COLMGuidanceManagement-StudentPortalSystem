-- ============================================================
-- Makes the existing "Rescheduled" filter/badge actually mean
-- something. Rescheduling moves an approved appointment's date/time
-- but the appointment is still an active, upcoming "approved"
-- session — overloading status to "rescheduled" would break the
-- complete/reschedule/missed actions that key off status ===
-- "approved". This flag tracks the history separately instead.
-- Safe to re-run.
-- ============================================================

alter table public.appointments
  add column if not exists was_rescheduled boolean not null default false;
