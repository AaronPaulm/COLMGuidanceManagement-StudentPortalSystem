-- Remove appointment cancellation for good.
--
-- The app no longer exposes any way to cancel an appointment (neither the
-- student nor the counselor side can trigger it), so the `cancelled` status
-- must not be producible anymore. Any existing cancelled rows are deleted --
-- safe here because the demo database is reset before production, and visit
-- history going forward no longer includes cancellations.
--
-- Runs inside a transaction so we never leave rows that the tightened check
-- constraint would reject.
begin;

delete from public.appointments where status = 'cancelled';

alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments
  add constraint appointments_status_check
  check (status in ('pending', 'approved', 'conducted', 'declined', 'rescheduled'));

commit;