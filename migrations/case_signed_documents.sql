-- ============================================================
-- Per-session signed-document attachment for cases — the scanned or
-- photographed copy of the signed visitation slip for one specific
-- counseling session/meeting. Distinct from case_session_attachments,
-- which is the generic "Proof / Evidence" upload. Kept separately so a
-- signed record stays its own concept (and its own labeled section) even
-- though both are files belonging to a case session.
--
-- Reuses the existing private "case-attachments" storage bucket and its
-- bucket-wide counselor policies (see case_attachments.sql) — only a new
-- metadata table is needed, scoped by case_sessions -> cases.counselor_id
-- the same way case_session_attachments is.
--
-- Also drops the now-removed appointment_attachments table (the signed
-- document feature moved off appointments onto case sessions).
-- Safe to re-run — every statement is idempotent.
-- ============================================================

create table if not exists public.case_signed_documents (
  document_id bigint generated always as identity primary key,
  session_id bigint not null references public.case_sessions(session_id) on delete cascade,
  file_path text not null,
  file_name text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists case_signed_documents_session_idx on public.case_signed_documents (session_id);

alter table public.case_signed_documents enable row level security;

drop policy if exists "counselor can view signed docs of own cases" on public.case_signed_documents;
create policy "counselor can view signed docs of own cases"
  on public.case_signed_documents for select
  using (
    session_id in (
      select cs.session_id from public.case_sessions cs
      join public.cases c on c.case_id = cs.case_id
      where c.counselor_id in (select counselor_id from public.counselors where user_id = auth.uid())
    )
  );

drop policy if exists "counselor can add signed docs to own cases" on public.case_signed_documents;
create policy "counselor can add signed docs to own cases"
  on public.case_signed_documents for insert
  with check (
    session_id in (
      select cs.session_id from public.case_sessions cs
      join public.cases c on c.case_id = cs.case_id
      where c.counselor_id in (select counselor_id from public.counselors where user_id = auth.uid())
    )
  );

drop policy if exists "counselor can delete signed docs of own cases" on public.case_signed_documents;
create policy "counselor can delete signed docs of own cases"
  on public.case_signed_documents for delete
  using (
    session_id in (
      select cs.session_id from public.case_sessions cs
      join public.cases c on c.case_id = cs.case_id
      where c.counselor_id in (select counselor_id from public.counselors where user_id = auth.uid())
    )
  );

-- Signed documents no longer attach to appointments — drop the old table
-- (this cascades its RLS policies). Any files already uploaded under the
-- "appointments/..." storage prefix become orphaned but harmless; the
-- feature was new and no live data is expected.
drop table if exists public.appointment_attachments;
