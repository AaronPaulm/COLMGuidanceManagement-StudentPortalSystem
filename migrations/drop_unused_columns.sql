-- Drop columns confirmed unused by the app codebase audit (Sep 2026):
--   students.enrollment_school_year - superseded by the year-level based
--     archiving countdown (see student_section.sql); never read/written by app.
--   students.review_dismissed_at   - written to null on edits but never read
--     to drive any UI logic (no archival-review banner exists).
-- Kept: cases.updated_by / case_sessions.updated_by are now stamped and
-- displayed by the client (guardian accountability for who edited a case or
-- logged a session).
alter table public.students
    drop column if exists enrollment_school_year,
    drop column if exists review_dismissed_at;