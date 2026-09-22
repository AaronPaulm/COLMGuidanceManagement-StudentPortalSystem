-- ============================================================
-- Group summons share ONE time slot ("batch session").
--
-- The counselor can summon several students at once; every student
-- in the same summon batch is expected to come in together on the
-- SAME date + time. A plain unique index cannot express this rule,
-- so a BEFORE INSERT OR UPDATE trigger enforces it instead.
--
-- Slot rules (unified across the office):
--   * A slot is occupied only while an appointment is PENDING or
--     APPROVED. CONDUCTED and DECLINED appointments FREE the slot,
--     so it can be booked again (matches office_slot_times RPC).
--   * Two different owners can never share a date+time. "Owner" is
--     the summon_batch_id for batch rows, and "itself" for a normal
--     (non-batch) booking — so a normal booking collides with
--     anything, and a batch collides with any other batch or any
--     normal booking.
--   * ALL rows of the SAME summon batch may share the slot.
--   * A single student still can't hold two active appointments at
--     the same date+time (the per-student guard is recast to the
--     same pending/approved status rule below).
--
-- TERMINAL MIGRATION: apply this file AFTER
-- appointments_no_double_booking.sql and
-- appointments_office_slot_shared.sql (both are superseded by the
-- trigger). Do NOT re-run those two files afterwards — they recreate
-- the old unique index, which would break shared batch slots again.
--
-- Rerun-safe: ADD COLUMN IF NOT EXISTS, drop-if-exists on the old
-- indexes, CREATE OR REPLACE for the function, and the trigger is
-- dropped/created with a fixed name.
-- ============================================================

alter table public.appointments
  add column if not exists summon_batch_id uuid;

drop index if exists public.appointments_slot_unique;
drop index if exists public.appointments_batch_slot_unique;

-- Recast the per-student same-slot guard to the unified status rule
-- (conducted/declined free the slot, so a student may re-use it).
drop index if exists public.appointments_student_slot_unique_idx;
create unique index appointments_student_slot_unique_idx
  on public.appointments (student_id, appointment_date, appointment_time)
  where status in ('pending', 'approved');

-- Plain lookup index for the slot grids (busy state comes from the
-- office_slot_times RPC; this one just keeps lookups fast).
create index if not exists appointments_slot_lookup_idx
  on public.appointments (appointment_date, appointment_time);

-- One-slot-per-owner rule.
create or replace function public.enforce_office_slot_rule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only pending/approved bookings occupy a slot.
  if new.status not in ('pending', 'approved') then
    return new;
  end if;

  -- Serialize concurrent writers to the same office slot so a race
  -- can't slip past both checks; the lock lives until commit.
  perform pg_advisory_xact_lock(
    hashtextextended(new.appointment_date::text || '|' || new.appointment_time, 0)
  );

  if exists (
    select 1
    from public.appointments a
    where a.appointment_date = new.appointment_date
      and a.appointment_time = new.appointment_time
      and a.status in ('pending', 'approved')
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