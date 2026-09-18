-- ============================================================
-- Personnel account lifecycle: soft deactivation, not hard delete.
--
-- Hard-deleting a counselors row cascades into cases,
-- interventions, intervention_templates, and visit_logs, and the
-- codebase already treats the counselor row as immutable
-- (see setup_team_access.sql). Personnel accounts therefore use
-- an `is_active` flag + an auth ban instead:
--
--   * is_active      false = deactivated (no login, not bookable)
--   * created_by/-at which personnel created the account (audit)
--   * deactivated_by/-at who took the account down and when
--     (NULL while active; cleared on reactivation)
--
-- Mutations run through the set-staff-account-status edge
-- function, which also enforces:
--   * no self-deactivation
--   * at least one personnel account stays active at all times
--
-- Rerun-safe: guarded with IF NOT EXISTS.
-- ============================================================

alter table public.counselors
  add column if not exists is_active boolean not null default true,
  add column if not exists created_by bigint references public.counselors (counselor_id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by bigint references public.counselors (counselor_id) on delete set null;