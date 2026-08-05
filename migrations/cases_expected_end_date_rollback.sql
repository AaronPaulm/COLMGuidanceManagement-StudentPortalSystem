-- ============================================================
-- Removes the "Expected End" field from cases — superseded by the
-- interventions feature (a PDF/document attached to a case, visible
-- to the student, with access removed by the counselor once the
-- student improves — see interventions.sql). Run this if
-- cases_expected_end_date.sql was already applied; harmless (no-op)
-- if it was never run at all.
-- ============================================================

alter table public.cases drop column if exists expected_end_date;
