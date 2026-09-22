-- ============================================================
-- Appointments: "rescheduled" becomes a real status.
--
-- Until now a rescheduled appointment stayed "approved" and merely
-- carried the was_rescheduled history flag. The office asked for the
-- status to actually say Rescheduled. So:
--
--   1. office_slot_times  — a rescheduled session still occupies its
--      NEW slot, so the slot grids must keep showing it as booked.
--      (Its OLD slot frees automatically: that row simply no longer
--      sits there after the update.)
--   2. The per-student same-slot guard — a student still can't hold
--      two active appointments at the same date+time, whether either
--      of them was rescheduled or not.
--   3. enforce_office_slot_rule — the shared-slot trigger now counts
--      rescheduled rows as occupying a slot: they keep blocking
--      normal bookings and OTHER summon batches, while rows of the
--      SAME summon_batch_id may all move together (batch reschedule).
--      Conducted/declined still free the slot.
--
-- Standalone + rerun-safe. Supersedes the slot logic in
-- appointments_group_slots.sql: apply this AFTER office_slot_visibility
-- and group_slots (or instead of them), and never re-run the old
-- group_slots trigger afterwards.
-- ============================================================

-- Bring legacy rows in line: any appointment that was rescheduled before
-- "rescheduled" became a real status is still stored as approved +
-- was_rescheduled. Flip those to rescheduled too so the badge and the
-- status filter behave consistently. Rerun-safe: only touches rows still
-- sitting in the old state.
update public.appointments
   set status = 'rescheduled'
 where status = 'approved'
   and was_rescheduled = true;

alter table public.appointments
  add column if not exists summon_batch_id uuid;

-- Drop the old slot indexes so the definitions below are authoritative.
drop index if exists public.appointments_slot_unique;
drop index if exists public.appointments_batch_slot_unique;
drop index if exists public.appointments_student_slot_unique_idx;

-- Per-student same-slot guard — rescheduled rows are still live.
create unique index appointments_student_slot_unique_idx
  on public.appointments (student_id, appointment_date, appointment_time)
  where status in ('pending', 'approved', 'rescheduled');

-- Plain lookup index for the slot grids.
create index if not exists appointments_slot_lookup_idx
  on public.appointments (appointment_date, appointment_time);

-- Slot grids: a slot is "taken" while pending / approved / rescheduled.
create or replace function public.office_slot_times(target_date date)
returns table (taken_time text)
language sql
security definer
set search_path = public
stable
as $$
  select left(a.appointment_time::text, 5)
  from public.appointments a
  where a.appointment_date = target_date
    and a.status in ('pending', 'approved', 'rescheduled')
$$;

revoke all on function public.office_slot_times(date) from public;
grant execute on function public.office_slot_times(date) to authenticated;

-- Shared-slot trigger, now aware of rescheduled rows. All rows of ONE
-- summon_batch_id may share the slot; anything else at that day+time
-- (a normal booking, another batch) is blocked while a batch sits there.
create or replace function public.enforce_office_slot_rule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only pending/approved/rescheduled bookings occupy a slot.
  if new.status not in ('pending', 'approved', 'rescheduled') then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(new.appointment_date::text || '|' || new.appointment_time, 0)
  );

  if exists (
    select 1
    from public.appointments a
    where a.appointment_date = new.appointment_date
      and a.appointment_time = new.appointment_time
      and a.status in ('pending', 'approved', 'rescheduled')
      and a.appointment_id is distinct from new.appointment_id
      and (
        a.summon_batch_id is null            -- any normal booking blocks everything
        or new.summon_batch_id is null       -- this normal booking blocks batches
        or a.summon_batch_id <> new.summon_batch_id  -- a different batch blocks this batch
      )
  ) then
    raise exception using
      errcode = '23505',
      message = 'that time slot is already taken';
  end if;

  return new;
end $$;

drop trigger if exists trg_appointments_office_slot_rule on public.appointments;
create trigger trg_appointments_office_slot_rule
  before insert or update of appointment_date, appointment_time, status, summon_batch_id
  on public.appointments
  for each row execute function public.enforce_office_slot_rule();