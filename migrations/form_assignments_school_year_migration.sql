-- ============================================================
-- Adds a school-year tag to form assignments — run once in the
-- Supabase SQL editor. Purely additive: new nullable column,
-- no effect on existing rows or other tables.
-- ============================================================

alter table public.form_assignments
  add column school_year text;
