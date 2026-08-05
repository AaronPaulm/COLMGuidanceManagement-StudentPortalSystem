-- ============================================================
-- Removes the risk-tagging feature (E2) — the client doesn't use
-- risk levels, it was only ever an optional value-add and was never
-- part of their actual workflow. Run this if cases_risk_level_migration.sql
-- was already applied; harmless (no-op) if it was never run at all.
-- ============================================================

alter table public.cases drop constraint if exists cases_risk_level_check;
alter table public.cases drop column if exists risk_level;
