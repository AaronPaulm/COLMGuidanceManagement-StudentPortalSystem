-- ============================================================
-- Password-reset safety + verified-email -> profile sync.
--
-- Follow-up to `student_username_resolution.sql` (already applied):
-- its resolve_username() made forgot-password email the raw (often
-- fake) @colm.edu.ph auth_email. These changes:
--
--   resolve_reset_email()   forgot-password: returns the auth email
--                           ONLY for accounts with a verified,
--                           non-placeholder personal email.
--   confirm_student_email() rewrite: also copies the verified email
--                           into `student_email` so it shows on the
--                           student profile automatically.
--
-- resolve_reset_email() results:
--   '<email>'           -> OK to email a reset link to this address.
--   '__COLM_NO_EMAIL__' -> username exists but has no verified
--                          personal email yet (page shows a hint,
--                          no email is sent).
--   NULL                -> no such username.
-- ============================================================

create or replace function public.resolve_reset_email(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select case
    when email_verified = true and auth_email !~ '@colm\.edu\.ph$' then auth_email
    when email_verified is distinct from true or auth_email ~ '@colm\.edu\.ph$' then '__COLM_NO_EMAIL__'
    else null
  end
  from public.students
  where username = p_username
  limit 1;
$$;

revoke execute on function public.resolve_reset_email(text) from public;
grant execute on function public.resolve_reset_email(text) to anon, authenticated;

-- Same self-row guard as the original (auth.uid() can only ever hit
-- the caller's own row). Now also syncs student_email so the verified
-- address appears on the student's profile.
create or replace function public.confirm_student_email(p_user_id uuid, p_auth_email text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.students
     set email_verified = true,
         auth_email = p_auth_email,
         student_email = p_auth_email
   where user_id = p_user_id
     and user_id = auth.uid();
$$;

revoke execute on function public.confirm_student_email(uuid, text) from public;
grant execute on function public.confirm_student_email(uuid, text) to authenticated;