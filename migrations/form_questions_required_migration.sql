-- ============================================================
-- Adds "required" support to form questions — run once in the
-- Supabase SQL editor. Purely additive: new column, safe default,
-- no effect on existing rows or other tables.
-- ============================================================

alter table public.form_questions
  add column is_required boolean not null default false;
