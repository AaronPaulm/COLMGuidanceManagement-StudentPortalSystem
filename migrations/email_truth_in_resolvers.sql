-- ============================================================
-- Username resolvers follow Auth truth, not the mirror column.
--
-- students.auth_email is a client-side mirror that can drift ahead
-- of the real login address in auth.users (e.g. when an email
-- change gets half-confirmed). When it drifted, username login fell
-- back to the mirror and signed in with an email Auth doesn't
-- recognize -> "can't log in with username".
--
-- These rewrites make resolve_username / resolve_reset_email return
-- the ADDRESS AUTH ACTUALLY VALIDATES (auth.users.email), falling
-- back to the mirror only if the join has no auth row.
--
-- Rerun-safe: both use create or replace.
-- ============================================================

create or replace function public.resolve_username(p_username text)
returns text
language sql
security definer
set search_path = public, auth
as $$
  select coalesce(u.email, s.auth_email)
  from public.students s
  left join auth.users u on u.id = s.user_id
  where s.username = p_username
  limit 1;
$$;

revoke execute on function public.resolve_username(text) from public;
grant execute on function public.resolve_username(text) to anon, authenticated;

-- Same idea for password resets: email only addresses Auth actually
-- holds, and only for accounts that are verified + non-placeholder.
-- '__COLM_NO_EMAIL__' = username exists but can't receive a reset.
-- NULL = no such username.
create or replace function public.resolve_reset_email(p_username text)
returns text
language sql
security definer
set search_path = public, auth
as $$
  with resolved as (
    select coalesce(u.email, s.auth_email) as login_email,
           s.email_verified
    from public.students s
    left join auth.users u on u.id = s.user_id
    where s.username = p_username
    limit 1
  )
  select case
    when email_verified = true and login_email is not null and login_email !~ '@colm\.edu\.ph$'
      then login_email
    when email_verified is distinct from true or login_email is null or login_email ~ '@colm\.edu\.ph$'
      then '__COLM_NO_EMAIL__'
    else null
  end
  from resolved;
$$;

revoke execute on function public.resolve_reset_email(text) from public;
grant execute on function public.resolve_reset_email(text) to anon, authenticated;