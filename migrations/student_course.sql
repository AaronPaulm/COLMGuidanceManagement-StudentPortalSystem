-- Adds the student's current official course to the students record.
-- Historical course values remain preserved in student_info_sheets.answers.

alter table public.students
  add column if not exists course text;

create index if not exists students_course_idx on public.students (course);
