-- ============================================================
-- Adds username + email_verified to students.
--
-- username: used for login instead of the fake email. Generated
-- during bulk import as slugify(firstName).slugify(lastName)
-- with student-number suffix on collision.
--
-- email_verified: false for freshly-imported students (triggers
-- first-login email-verification flow); true for all pre-existing
-- rows (they already work without verification).
-- ============================================================

alter table public.students
  add column if not exists username text;

-- Unique index: allows multiple nulls (pre-existing rows) while
-- enforcing uniqueness for new imports that always provide one.
create unique index if not exists students_username_unique_idx
  on public.students (username) where username is not null;

create index if not exists students_username_lookup_idx
  on public.students (username) where username is not null;

alter table public.students
  add column if not exists email_verified boolean default true;

-- auth_email: mirrors the Supabase auth.users.email for each student.
-- Needed because the client can't query auth.users, and the login page
-- resolves a typed username back to this address before signing in.
alter table public.students
  add column if not exists auth_email text;
