-- ============================================================
-- Caps how many "pending" appointment requests one student can have
-- queued up at the same time (see PENDING_APPOINTMENT_LIMIT in
-- student-appointments.html). The app already checks this client-side
-- before inserting; this trigger is the backstop that still holds if
-- that check is bypassed (e.g. calling the API directly), the same
-- way appointments_no_double_booking.sql backstops the slot-clash
-- check. Safe to re-run.
-- ============================================================

create or replace function public.enforce_pending_appointment_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pending_count int;
  pending_limit constant int := 3;
begin
  if new.status = 'pending' then
    select count(*) into pending_count
    from public.appointments
    where student_id = new.student_id
      and status = 'pending';

    if pending_count >= pending_limit then
      raise exception 'You already have % pending appointment requests. Wait for a response before submitting more.', pending_limit;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_pending_appointment_limit_trigger on public.appointments;
create trigger enforce_pending_appointment_limit_trigger
before insert on public.appointments
for each row execute function public.enforce_pending_appointment_limit();
