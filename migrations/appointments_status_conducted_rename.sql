-- ============================================================
-- Renames the "completed" appointment status to "conducted" for
-- consistency with the UI label. Safe to re-run.
-- ============================================================

-- 1. Update existing rows
update public.appointments set status = 'conducted' where status = 'completed';

-- 2. Swap the CHECK constraint
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments
  add constraint appointments_status_check
  check (status in ('pending', 'approved', 'conducted', 'cancelled', 'declined', 'rescheduled'));
