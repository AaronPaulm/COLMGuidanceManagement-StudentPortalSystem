-- ============================================================
-- Forgot-password accepts username OR email, for students AND
-- guidance personnel.
--
-- Students log in with a username; counselors log in with the
-- email on their auth account (they have no username). The old
-- resolve_reset_email() only matched students by username, so a
-- guidance personnel member could never request a reset link.
--
-- resolve_reset_recipient(p_identifier):
--   '<email>'           -> OK to email a reset link to this address.
--   '__COLM_NO_EMAIL__' -> student account exists but has no
--                          verified personal email yet.
--   NULL                -> no matching account (student or counselor).
--
-- Resolution order:
--   1. a counselor whose auth email matches,
--   2. a student matched by username, auth_email, or student_email
--      (returning the address only when verified + non-placeholder).
-- ============================================================

create or replace function public.resolve_reset_recipient(p_identifier text)
returns text
language sql
security definer
set search_path = public, auth
as $$
  with counselor_hit as (
    select u.email as login_email
    from public.counselors c
    join auth.users u on u.id = c.user_id
    where u.email = p_identifier
    limit 1
  ),
  student_hit as (
    select coalesce(u.email, s.auth_email) as login_email,
           s.email_verified
    from public.students s
    left join auth.users u on u.id = s.user_id
    where s.username = p_identifier
       or s.auth_email = p_identifier
       or s.student_email = p_identifier
    limit 1
  )
  select case
    when exists (select 1 from counselor_hit)
      then (select login_email from counselor_hit)
    when not exists (select 1 from student_hit)
      then null
    when (select email_verified from student_hit) = true
         and (select login_email from student_hit) is not null
         and (select login_email from student_hit) !~ '@colm\.edu\.ph$'
      then (select login_email from student_hit)
    else '__COLM_NO_EMAIL__'
  end;
$$;

revoke execute on function public.resolve_reset_recipient(text) from public;
grant execute on function public.resolve_reset_recipient(text) to anon, authenticated;