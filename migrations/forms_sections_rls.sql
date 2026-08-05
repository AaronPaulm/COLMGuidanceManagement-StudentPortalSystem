-- ============================================================
-- RLS for form_sections (mirrors form_questions' existing pattern)
-- + the missing DELETE policies on forms/form_questions that
-- counselor-forms.html's Edit/Delete actions need to function.
-- Run once in the Supabase SQL editor.
-- ============================================================

alter table public.form_sections enable row level security;

create policy "counselor can create sections"
  on public.form_sections for insert
  with check (is_counselor());

create policy "can view sections of viewable forms"
  on public.form_sections for select
  using (
    form_id in (
      select forms.form_id from public.forms
      where forms.counselor_id in (
        select counselors.counselor_id from public.counselors where counselors.user_id = auth.uid()
      )
      or forms.form_id in (
        select form_assignments.form_id from public.form_assignments
        where form_assignments.student_id in (
          select students.student_id from public.students where students.user_id = auth.uid()
        )
      )
    )
  );

create policy "counselor can update sections"
  on public.form_sections for update
  using (is_counselor());

create policy "counselor can delete sections"
  on public.form_sections for delete
  using (is_counselor());

-- Missing DELETE policies (pre-existing gap, not caused by the sections work)

create policy "counselor can delete questions"
  on public.form_questions for delete
  using (is_counselor());

create policy "counselor can delete own form"
  on public.forms for delete
  using (
    counselor_id in (
      select counselors.counselor_id from public.counselors where counselors.user_id = auth.uid()
    )
  );
