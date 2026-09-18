# Roles & Personnel Accounts

Design notes for the COLM Guidance Office portal.

## Single merged role: personnel = the admin

The system deliberately does **not** have a separate "super-admin" account type.
Guidance personnel accounts (`users.role = 'counselor'`, backed by a row in
`counselors`) carry **all** administrative powers:

- manage student records, cases, sessions, interventions and reports;
- create other personnel accounts;
- post announcements and assign forms;
- manage student accounts (archive/unarchive);
- deactivate / reactivate personnel accounts.

This is an intentional design decision: the COLM Guidance Office is a small
staff, so a separate super-admin layer would add management burden without a
real separation-of-duties need (defense talking point). "Personnel" **is** the
administrative role; there is no account "above" it.

The only guardrail is lifecycle: a personnel can never deactivate their **own**
account, and the office can never drop below **one active** personnel (see below).

## Personnel account lifecycle: deactivate, never delete

Personnel accounts are **never hard-deleted**. Deleting a `counselors` row
would cascade into `cases`, `interventions`, `intervention_templates`, and
`visit_logs` (their FKs are `ON DELETE CASCADE`) and destroy history. Instead
accounts are **deactivated**:

- `counselors.is_active` flips to `false`;
- the auth user is **banned** (~100 years) so any current session dies on the
  next refresh and fresh sign-ins are rejected;
- `counselors.deactivated_at` / `deactivated_by` record the audit trail;
- deactivated staff instantly disappear from the student booking pickers and
  are bounced out of the portal (`requireCounselorAuth` filters `is_active`).

Reactivation un-bans + clears `deactivated_at/by`. This mirrors the existing
"students are archived, not deleted" philosophy.

### Enforced rules (in `set-staff-account-status` edge function)

1. **No self-deactivation** — the caller cannot change their own status
   (prevents accidental lockouts). The UI also hides the button on your own row.
2. **Minimum one active personnel** — deactivating the last active account is
   rejected with a clear message, so the office can never lock itself out of
   account management entirely.
3. **Audit trail** — `created_by`/`created_at` (who created the account) and
   `deactivated_by`/`deactivated_at` (who disabled it and when) live on the
   counselor row, same "who edited it" pattern used by
   `cases.updated_by` / `case_sessions.updated_by`.

### Full history: `counselor_audit_log`

The row columns above capture only the **current** state — note that
`deactivated_by`/`deactivated_at` are **cleared on reactivation**, so repeated
toggles (and who reactivated) aren't visible there. For that, an append-only
`counselor_audit_log` table records every lifecycle event forever:

- `counselor_id` — the account the event is about (null-safe: `on delete set
  null` so history survives even a manual row delete, which the app never does);
- `actor_id` — which personnel did it (`NULL` = system, e.g. a Studio/seed
  insert captured by the safety-net trigger);
- `action` — `created` | `activated` | `deactivated` (CHECK-constrained);
- `created_at` — event timestamp, indexed `(counselor_id, created_at desc)`.

Writers: `create-staff-account` logs `created`; `set-staff-account-status`
logs `activated`/`deactivated`. A DB trigger
(`trg_counselors_audit_created`) also logs every direct INSERT into
`counselors`, so Studio/seed writes are never missed. RLS limits reads to
personnel (`exists (select 1 from counselors where user_id = auth.uid())`).
The Accounts Management page renders the latest 50 events in an **Account
Activity** feed below the directory.

## Username login for personnel

Personnel log in with a **username** or their email, like students:

- `counselors.username` is generated from `slug(first).slug(last)` (e.g.
  `maria.santos`) and shown/editable in the account-creation form, with live
  availability checking against **both** staff and student usernames (the login
  namespace is shared).
- `resolve_counselor_username()` maps a typed username to the auth email at
  login; `check_username_available()` backs the form validation; the
  forgot-password resolver (`resolve_reset_recipient`) also accepts a counselor
  username.
- `counselors.auth_email` snapshots the auth email so the management directory
  can display it without exposing `auth.users` to the browser.

> Email is the **mandatory** login credential (Supabase auth is keyed by
> email); the username is an optional alias that resolves to that email. To
> keep the mapping intact no matter how a row is written, triggers
> `trg_counselors_set_auth_email` (fill `auth_email` from `auth.users` when
> missing) and `trg_counselors_set_username` (autofill a unique
> `slug(first).slug(last)` when missing) run on `counselors` inserts.

## Deployment notes

- Migrations: `counselors_username_login.sql`,
  `counselors_account_status.sql`, `counselor_audit_log.sql` (apply in
  Supabase Studio, in order).
  `counselors_username_login.sql` is **rerun-safe** — if an account was created
  before the migration (or by the old `create-staff-account`), re-running it
  backfills its `username`/`auth_email` and installs the autofill triggers.
- Edge functions: deploy `create-staff-account` (updated) and
  `set-staff-account-status` (new):
  `supabase functions deploy create-staff-account set-staff-account-status`.