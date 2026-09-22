-- ============================================================
-- Contact page: guidance emails for deactivated accounts.
--
-- account-deactivated.html is reached by a student whose account
-- was disabled — they can't sign in, so they query as an
-- anonymous user. Reading `counselors` directly is blocked for
-- anon (table RLS), which left the "Send To" chooser saying
-- "No guidance email available".
--
-- Now that personnel have their own dedicated sign-in, exposing
-- the guidance office's login emails on this page is acceptable:
-- knowing an email gives no way to guess a staff password, and a
-- locked-out student needs a real contact to reach the office.
--
-- This security-definer function returns only the fields the
-- contact form needs (name + login email) for ACTIVE personnel.
-- Rerun-safe: create or replace.
-- ============================================================

create or replace function public.get_active_counselor_contacts()
returns table (
  first_name text,
  last_name  text,
  auth_email text
)
language sql
security definer
set search_path = public
as $$
  select c.first_name, c.last_name, c.auth_email
    from public.counselors c
   where c.is_active
     and c.auth_email is not null
     and c.auth_email <> ''
  order by c.first_name asc, c.last_name asc;
$$;

revoke execute on function public.get_active_counselor_contacts() from public;
grant execute on function public.get_active_counselor_contacts() to anon, authenticated;