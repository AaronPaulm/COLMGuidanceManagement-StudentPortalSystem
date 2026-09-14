-- ============================================================
-- reset_demo_data.sql
--
-- Wipes ALL data so you can start from scratch with fresh dummy
-- data for a presentation. Run from the Supabase Dashboard → SQL
-- Editor. This is destructive — there is no undo.
--
-- What it clears:
--   * every row in every public table (students, users, counselors,
--     appointments, notifications, cases, forms, announcements,
--     intervention templates, info sheets, visit logs, ...)
--   * every auth account (logins) in auth.users
--   * every uploaded file in Storage
--
-- What it keeps:
--   * the schema itself, RLS policies, triggers, and functions
--     (all migrations stay applied).
-- ============================================================

begin;

-- Truncate every public table in one dynamic pass. CASCADE handles
-- foreign-key ordering automatically; RESTART IDENTITY resets the
-- identity/sequence counters so new dummy rows start at 1 again.
do $$
declare
  t record;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
    order by tablename
  loop
    execute format('truncate table public.%I restart identity cascade', t.tablename);
  end loop;
end $$;

-- Wipe all login accounts. Deleting from auth.users also removes each
-- user's identities and sessions (cascading), so nobody stays signed
-- in afterwards.
delete from auth.users;

-- Wipe uploaded files (case attachments, signed documents, etc.).
-- Buckets themselves are kept so the app still has somewhere to upload.
delete from storage.objects;

commit;