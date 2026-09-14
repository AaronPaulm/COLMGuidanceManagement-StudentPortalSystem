-- ============================================================
-- Backfill usernames for students created before username support.
--
-- Earlier accounts have auth_email set (slug@colm.edu.ph) but
-- `username` is NULL, because usernames are only generated inside
-- create-student-accounts at bulk-import time. The login page
-- resolves a typed username via resolve_username() -> auth_email,
-- so a NULL username means the student can't log in by username
-- (only by typing the full @colm.edu.ph address).
--
-- Rule per student (only rows where username IS NULL):
--   * if auth_email is the placeholder @colm.edu.ph, the local part
--     IS the natural username (e.g. monica.gayola2 -> monica.gayola2)
--   * otherwise (verified personal email) derive slug(firstName).slug(lastName)
--     like the import logic, with the student-number tail on collision
--   * bump a numeric suffix (2, 3, ...) until the candidate is unique
--
-- Rerun-safe: it only touches rows with username IS NULL.
-- ============================================================

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
    select user_id, auth_email, first_name, last_name, student_number
      from public.students
     where username is null
  loop
    -- Prefer the placeholder-email local part (matches what students
    -- already know from their printed credentials).
    if r.auth_email is not null and r.auth_email ~ '@colm\.edu\.ph$' then
      base := left(r.auth_email, position('@' in r.auth_email) - 1);
    else
      base_fn := regexp_replace(lower(coalesce(r.first_name, '')), '[^a-z0-9]+', '', 'g');
      base_ln := regexp_replace(lower(coalesce(r.last_name, '')), '[^a-z0-9]+', '', 'g');
      if base_fn = '' then
        base := case when base_ln = '' then 'student' else base_ln end;
      else
        base := base_fn || case when base_ln = '' then '' else '.' || base_ln end;
      end if;
      if r.student_number is not null and r.student_number <> '' then
        base := base || right(r.student_number, 4);
      end if;
    end if;

    candidate := base;
    suffix := 2;
    loop
      select exists (
        select 1 from public.students
         where username = candidate
           and user_id <> r.user_id
      ) into taken;
      exit when not taken;
      candidate := base || suffix;
      suffix := suffix + 1;
    end loop;

    update public.students set username = candidate where user_id = r.user_id;
  end loop;
end $$;