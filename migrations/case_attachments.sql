-- ============================================================
-- Case session attachments ("proof"/evidence files — photos, scanned
-- documents, etc.) attached when a counselor logs a session on a case.
-- Uses Supabase Storage for the actual file bytes; this table just
-- tracks which files belong to which session. Counselor-only, same
-- access pattern as cases/case_sessions — a counselor can only attach
-- to and view attachments on their own cases.
--
-- The bucket is private (not public): files are only ever served via a
-- signed URL generated on demand for a counselor who already passed the
-- storage.objects RLS check below, not via a permanent public link.
--
-- Safe to re-run — every statement is idempotent.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('case-attachments', 'case-attachments', false)
on conflict (id) do nothing;

create table if not exists public.case_session_attachments (
  attachment_id bigint generated always as identity primary key,
  session_id bigint not null references public.case_sessions(session_id) on delete cascade,
  file_path text not null,
  file_name text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists case_session_attachments_session_idx on public.case_session_attachments (session_id);

alter table public.case_session_attachments enable row level security;

drop policy if exists "counselor can view attachments of own cases" on public.case_session_attachments;
create policy "counselor can view attachments of own cases"
  on public.case_session_attachments for select
  using (
    session_id in (
      select cs.session_id from public.case_sessions cs
      join public.cases c on c.case_id = cs.case_id
      where c.counselor_id in (select counselor_id from public.counselors where user_id = auth.uid())
    )
  );

drop policy if exists "counselor can add attachments to own cases" on public.case_session_attachments;
create policy "counselor can add attachments to own cases"
  on public.case_session_attachments for insert
  with check (
    session_id in (
      select cs.session_id from public.case_sessions cs
      join public.cases c on c.case_id = cs.case_id
      where c.counselor_id in (select counselor_id from public.counselors where user_id = auth.uid())
    )
  );

drop policy if exists "counselor can delete attachments of own cases" on public.case_session_attachments;
create policy "counselor can delete attachments of own cases"
  on public.case_session_attachments for delete
  using (
    session_id in (
      select cs.session_id from public.case_sessions cs
      join public.cases c on c.case_id = cs.case_id
      where c.counselor_id in (select counselor_id from public.counselors where user_id = auth.uid())
    )
  );

-- storage.objects has its own separate RLS layer — the table policies
-- above only govern the metadata row, not the actual file bytes.
drop policy if exists "counselors can upload case attachments" on storage.objects;
create policy "counselors can upload case attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'case-attachments'
    and exists (select 1 from public.counselors where user_id = auth.uid())
  );

drop policy if exists "counselors can view case attachments" on storage.objects;
create policy "counselors can view case attachments"
  on storage.objects for select
  using (
    bucket_id = 'case-attachments'
    and exists (select 1 from public.counselors where user_id = auth.uid())
  );

drop policy if exists "counselors can delete case attachments" on storage.objects;
create policy "counselors can delete case attachments"
  on storage.objects for delete
  using (
    bucket_id = 'case-attachments'
    and exists (select 1 from public.counselors where user_id = auth.uid())
  );
