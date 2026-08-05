-- ============================================================
-- Offense records are never deleted (per the client's retention
-- rule) — the app itself never calls .delete() on cases or
-- case_sessions, but the DELETE RLS policies added in
-- cases_tables.sql:70-73 and :113-123 still let any counselor's
-- account issue one directly through the API. Removing those
-- policies closes that gap; "closing" a case still works exactly
-- as before via the status dropdown (open/monitoring/resolved).
-- Safe to re-run.
-- ============================================================

drop policy if exists "counselor can delete own cases" on public.cases;
drop policy if exists "counselor can delete sessions on own cases" on public.case_sessions;
