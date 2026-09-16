-- ============================================================
-- FORMS — team-wide access (completion of setup_team_access)
-- ============================================================
-- setup_team_access.sql widened EIGHT tables (cases, case_sessions,
-- case_session_attachments, case_signed_documents, interventions,
-- intervention_templates, visit_logs, appointments) to team-wide —
-- but public.forms was omitted from that migration (byte-verified:
-- zero "on public.forms" statements in that file). The only
-- committed policy on public.forms is the per-counselor DELETE
-- ("counselor can delete own forms", forms_sections_rls.sql:46).
-- All other forms policies (view/create/update) were created in
-- the Studio editor out-of-band using the same per-counselor
-- "counselor can <VERB> own forms" convention.
--
-- This migration widens public.forms to the exact same team guard
-- used on the other 8 tables:
--     exists (select 1 from public.counselors where user_id = auth.uid())
--
-- Idempotent: every statement is either a drop-if-exists or a
-- guarded create; safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Forms — SELECT (team-wide)
-- ------------------------------------------------------------
drop policy if exists "counselor can view own forms" on public.forms;
drop policy if exists "counselor can view all forms" on public.forms;
create policy "counselor can view all forms"
  on public.forms for select
  using (exists (select 1 from public.counselors where user_id = auth.uid()));

-- ------------------------------------------------------------
-- 2. Forms — INSERT (team-wide)
-- ------------------------------------------------------------
drop policy if exists "counselor can create own forms" on public.forms;
drop policy if exists "counselor can create forms" on public.forms;
create policy "counselor can create forms"
  on public.forms for insert
  with check (exists (select 1 from public.counselors where user_id = auth.uid()));

-- ------------------------------------------------------------
-- 3. Forms — UPDATE (team-wide)
-- ------------------------------------------------------------
drop policy if exists "counselor can update own forms" on public.forms;
drop policy if exists "counselor can update all forms" on public.forms;
create policy "counselor can update all forms"
  on public.forms for update
  using (exists (select 1 from public.counselors where user_id = auth.uid()))
  with check (exists (select 1 from public.counselors where user_id = auth.uid()));

-- ------------------------------------------------------------
-- 4. Forms — DELETE (team-wide)
-- ------------------------------------------------------------
drop policy if exists "counselor can delete own forms" on public.forms;
drop policy if exists "counselor can delete all forms" on public.forms;
create policy "counselor can delete all forms"
  on public.forms for delete
  using (exists (select 1 from public.counselors where user_id = auth.uid()));
