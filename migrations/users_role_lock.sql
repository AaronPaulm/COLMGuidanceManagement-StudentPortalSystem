-- ============================================================
-- Closes a privilege-escalation hole: the "user can update own row"
-- RLS policy on public.users only checks user_id = auth.uid() (via
-- USING, reused as the implicit WITH CHECK since none was given) —
-- nothing stops an authenticated user from also changing their own
-- `role` column in that same update. Any logged-in student could run
--   supabaseClient.from("users").update({ role: "counselor" })...
-- from the browser console and get full counselor access, since
-- every counselor-only RLS policy (cases, forms, staff creation,
-- etc.) and requireCounselorAuth() ultimately trust this column.
--
-- Fixed with a trigger rather than a WITH CHECK clause because WITH
-- CHECK can't cleanly compare against the pre-update value via a
-- self-referencing subquery — a trigger has OLD/NEW directly.
--
-- service_role is exempted so the Admin-API edge functions (which
-- currently only ever INSERT into users, never UPDATE role) aren't
-- affected, and any future admin flow that legitimately needs to
-- change a role can still do so server-side. Safe to re-run.
-- ============================================================

create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.role() <> 'service_role' then
    raise exception 'role cannot be changed directly';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_role_change_trigger on public.users;
create trigger prevent_role_change_trigger
before update on public.users
for each row execute function public.prevent_role_change();
