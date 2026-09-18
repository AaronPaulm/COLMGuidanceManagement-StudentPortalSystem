-- ============================================================
-- Personnel username + email login support.
--
-- Counselors previously had no username (students log in by
-- username; staff logged in by their auth email only). This adds:
--
--   * counselors.username   — human-readable login handle
--   * counselors.auth_email — snapshot of the auth email so the
--                             management directory can show it
--                             (auth.users isn't queryable from the
--                             browser)
--
-- Backfill: existing staff get slug(first).slug(last) with a
-- numeric suffix on collision, kept unique against BOTH
-- counselors usernames and students usernames (both tables share
-- the login page's single resolver namespace).
--
-- RPCs added (security definer, mirroring student_username_...):
--   * resolve_counselor_username(p_username) -> auth email
--   * check_username_available(p_username)   -> boolean
--   * resolve_reset_recipient() is extended to also match a
--     counselor by username.
--
-- Rerun-safe: column adds are IF NOT EXISTS; the backfill only
-- touches rows with username IS NULL.
-- ============================================================

alter table public.counselors
  add column if not exists username text,
  add column if not exists auth_email text;

-- Usernames must be unique across counselors. Enforce at the
-- table level (a cross-table constraint against students is not
-- possible, so the backfill + create functions enforce it across
-- both tables).
create unique index if not exists counselors_username_key
  on public.counselors (username)
  where username is not null;

-- Existing email addresses live only in auth.users; snapshot them
-- so the account-management directory can list staff emails.
update public.counselors c
   set auth_email = u.email
  from auth.users u
 where u.id = c.user_id
   and c.auth_email is null;

-- Backfill usernames for counselors created before username support.
do $$
declare
  r record;
  candidate text;
  base_fn text;
  base_ln text;
  base text;
  suffix int;
  taken boolean;
begin
  for r in
    select user_id, first_name, last_name
      from public.counselors
     where username is null
  loop
    base_fn := regexp_replace(lower(coalesce(r.first_name, '')), '[^a-z0-9]+', '', 'g');
    base_ln := regexp_replace(lower(coalesce(r.last_name, '')), '[^a-z0-9]+', '', 'g');
    if base_fn = '' and base_ln = '' then
      continue;
    end if;
    base := base_fn || case when base_ln = '' then '' else '.' || base_ln end;

    candidate := base;
    suffix := 2;
    loop
      select exists (
        select 1 from public.counselors where username = candidate and user_id <> r.user_id
        union all
        select 1 from public.students  where username = candidate
      ) into taken;
      exit when not taken;
      candidate := base || suffix;
      suffix := suffix + 1;
    end loop;

    update public.counselors set username = candidate where user_id = r.user_id;
  end loop;
end $$;

-- ============================================================
-- Login + availability helpers
-- ============================================================

create or replace function public.resolve_counselor_username(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select auth_email
  from public.counselors
  where username = p_username
  limit 1;
$$;

revoke execute on function public.resolve_counselor_username(text) from public;
grant execute on function public.resolve_counselor_username(text) to anon, authenticated;

create or replace function public.check_username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.counselors where username = p_username
    union all
    select 1 from public.students where username = p_username
  );
$$;

revoke execute on function public.check_username_available(text) from public;
grant execute on function public.check_username_available(text) to anon, authenticated;

-- ============================================================
-- Forgot-password: allow counselor usernames too.
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
       or c.username = p_identifier
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

-- ============================================================
-- Hardening: a counselors insert can never leave username /
-- auth_email NULL, regardless of the write path (edge function,
-- Studio, seed scripts, ...). Username + email are the two fields
-- the login page depends on (username resolves to auth_email).
-- ============================================================

-- Snapshot the auth email on insert (and if user_id changes) so
-- username login and the directory always have something to map to.
create or replace function public.set_counselor_auth_email()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.auth_email is null and new.user_id is not null then
    select u.email into new.auth_email
      from auth.users u
     where u.id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_counselors_set_auth_email on public.counselors;
create trigger trg_counselors_set_auth_email
  before insert or update of user_id on public.counselors
  for each row execute function public.set_counselor_auth_email();

-- Autofill username when an insert omits it, mirroring the
-- backfill above (slug(first).slug(last), numeric suffix on
-- collision against counselors and students).
create or replace function public.set_counselor_username()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  base_fn text;
  base_ln text;
  base text;
  candidate text;
  suffix int;
  taken boolean;
begin
  if new.username is not null then
    return new;
  end if;

  base_fn := regexp_replace(lower(coalesce(new.first_name, '')), '[^a-z0-9]+', '', 'g');
  base_ln := regexp_replace(lower(coalesce(new.last_name, '')), '[^a-z0-9]+', '', 'g');
  base := base_fn || case when base_ln = '' then '' else '.' || base_ln end;
  if base = '' then
    base := 'staff';
  end if;

  candidate := base;
  suffix := 2;
  loop
    select exists (
      select 1 from public.counselors where username = candidate
      union all
      select 1 from public.students where username = candidate
    ) into taken;
    exit when not taken;
    candidate := base || suffix;
    suffix := suffix + 1;
  end loop;

  new.username := candidate;
  return new;
end;
$$;

drop trigger if exists trg_counselors_set_username on public.counselors;
create trigger trg_counselors_set_username
  before insert on public.counselors
  for each row execute function public.set_counselor_username();