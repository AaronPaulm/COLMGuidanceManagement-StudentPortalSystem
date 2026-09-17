-- Add a dedicated "Details of the Case" narrative field to case sessions,
-- distinct from the per-session "Session Note" (session_note). Feed both the
-- Create Case first-session block and the Add Session form. Idempotent.
alter table public.case_sessions
    add column if not exists details text;