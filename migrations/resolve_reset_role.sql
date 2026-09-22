-- ============================================================
-- Forgot-password: identify the role of the typed identifier so
-- the sign-in helper page can tailor its post-submit message and
-- "back to sign in" routing (students use index.html, guidance
-- personnel use personnel-login.html since those logins split).
--
-- Mirrors resolve_reset_recipient's matching rules but only
-- answers "counselor", "student", or null — it never leaks an
-- email address, so it's safe to expose to anon.
-- Rerun-safe: create or replace.
-- ============================================================

create or replace function public.resolve_reset_role(p_identifier text)
returns text
language sql
security definer
set search_path = public, auth
stable
as $$
  select case
    when exists (
      select 1
        from public.counselors c
        join auth.users u on u.id = c.user_id
       where u.email = p_identifier
          or c.username = p_identifier
    ) then 'counselor'
    when exists (
      select 1 from public.students s
       where s.username = p_identifier
          or s.auth_email = p_identifier
          or s.student_email = p_identifier
    ) then 'student'
    else null
  end;
$$;

revoke execute on function public.resolve_reset_role(text) from public;
grant execute on function public.resolve_reset_role(text) to anon, authenticated;