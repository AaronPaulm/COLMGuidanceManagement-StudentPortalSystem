-- ============================================================
-- Username-only login support.
--
-- Students log in with their username, not the (fake) internal
-- email. RLS on `students` blocks anonymous reads, so the login
-- page can't look username -> auth email with a plain query.
-- These two SECURITY DEFINER functions are the controlled escape
-- hatches:
--
--   resolve_username()      login + forgot-password: returns ONLY
--                           the auth email for a username.
--   confirm_student_email() verify-email post-OTP step: only ever
--                           touches the caller's own row.
--
-- Plus a narrow self-read policy so post-login checks
-- (verify-email redirect + nag banner) can read email_verified.
-- ============================================================

create or replace function public.resolve_username(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select auth_email
  from public.students
  where username = p_username
  limit 1;
$$;

revoke execute on function public.resolve_username(text) from public;
grant execute on function public.resolve_username(text) to anon, authenticated;

-- auth.uid() reads the JWT claims of the current request, so even
-- though this runs as the definer it can only update the caller's
-- own row — no way to mark another student verified.
create or replace function public.confirm_student_email(p_user_id uuid, p_auth_email text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.students
     set email_verified = true,
         auth_email = p_auth_email
   where user_id = p_user_id
     and user_id = auth.uid();
$$;

revoke execute on function public.confirm_student_email(uuid, text) from public;
grant execute on function public.confirm_student_email(uuid, text) to authenticated;

-- Students read their own row for the email_verified checks after
-- login. Own-row only; doesn't expose anyone else's data.
create policy "student can read own row" on public.students
  for select
  using (user_id = auth.uid());