-- ============================================================
-- Per-student same-slot guard for appointments.
--
-- Team-wide management (setup_team_access.sql, applied) lets every
-- guidance personnel manage every appointment. The per-slot rule
-- (a slot belongs to ONE personnel) still stands, so personnel A's
-- 9:00 and personnel B's 9:00 are two different slots. That leaves
-- one loophole: the SAME student can be booked into the same
-- date + time with TWO different personnel at once (A's 9:00 and
-- B's 9:00 are both "available" to that student).
--
-- This migration closes the loophole at the DB level: an ACTIVE
-- appointment (status not in cancelled/declined) is unique on
-- (student_id, appointment_date, appointment_time) across the whole
-- team. The client's own cross-check stays as the friendly layer;
-- this index is the unbreakable backstop so a double-insert can't
-- slip through no matter what the pages send.
--
-- Rerun-safe + guarded:
--   * Pre-scan counts any rows that would already violate the rule.
--     If any exist, we STOP with a readable message instead of a
--     raw duplicate-key stack trace — clean up those pairs in the
--     office, then re-run.
--   * The unique index itself is created only if it doesn't exist
--     (partial unique index: student_id + date + time for active
--     rows only).
-- ============================================================

-- 1) Pre-scan for existing violations (bypasses 0-row inserts and
--    fails loudly instead of letting the index build blow up with
--    an opaque duplicate-key error).
do $$
declare
  v_conflicts bigint;
begin
  select count(*)
    into v_conflicts
    from public.appointments a
   where a.status not in ('cancelled', 'declined')
     and exists (
           select 1
             from public.appointments b
            where b.student_id       = a.student_id
              and b.appointment_date = a.appointment_date
              and b.appointment_time = a.appointment_time
              and b.appointment_id  <> a.appointment_id
              and b.status not in ('cancelled', 'declined')
         );

  if v_conflicts > 0 then
    raise exception
      'Blocked: % appointment pair(s) already hold the same student at the same date+time (excl. cancelled/declined). Resolve them in the office first, then re-run this migration.',
      v_conflicts;
  end if;
end $$;

-- 2) The guard itself (partial unique index, only for active rows).
create unique index if not exists appointments_student_slot_unique_idx
  on public.appointments (student_id, appointment_date, appointment_time)
  where status not in ('cancelled', 'declined');
