-- ============================================================
-- Backstop for the duplicate-assignment bug fixed in
-- counselor-forms.html: the Assign modal only checked client-side
-- whether a student was already assigned a form for a given school
-- year, via a hint the counselor could still click past. A unique
-- index closes that same-form/same-student/same-year gap at the
-- database level too, the same way appointments_no_double_booking.sql
-- backstops the appointment-slot check.
--
-- Run the SELECT below FIRST. If it returns any rows, this database
-- already has duplicate assignments (created before the app-side fix)
-- and the CREATE UNIQUE INDEX below will fail until those are resolved
-- by hand — deleting one duplicate row can also delete a student's
-- already-submitted answers if a form_submissions row points at it, so
-- this migration intentionally does not delete anything automatically.
-- ============================================================

-- Run this first to check for existing duplicates:
-- select form_id, student_id, school_year, count(*), array_agg(assignment_id) as assignment_ids
-- from public.form_assignments
-- group by form_id, student_id, school_year
-- having count(*) > 1;

create unique index if not exists form_assignments_unique_idx
  on public.form_assignments (form_id, student_id, school_year);
