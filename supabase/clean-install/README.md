# Accord CRM — Clean Install Package

Rebuilds the Accord CRM database in a **brand-new, empty Supabase project**.

Derived from the 17 SQL files in `supabase/`, with the four confirmed defects from the audit corrected. The old Supabase project is not referenced, touched, or required by anything here. No frontend file was changed.

**Source of truth:** the 17 `.sql` files in `supabase/`.
**Explicitly NOT a source:** the SQL block inside `SUPABASE_MIGRATION.md` — that document contains an older, incompatible schema (`TEXT` primary keys, `assignee_id`/`organizer_id` columns, a different `profiles` shape). Running it will silently poison this install, because every `CREATE TABLE IF NOT EXISTS` below would then skip. Do not run it.

---

## Run order

Run these **in order, one file at a time**, in Supabase Dashboard → SQL Editor. Wait for each to report success before starting the next.

| # | File | Purpose |
|---|---|---|
| 01 | `001_profiles_foundation.sql` | teams + profiles + auth trigger + seed teams |
| 02 | `002_contacts.sql` | contacts table |
| 03 | `003_leads.sql` | leads table |
| 04 | `004_tasks.sql` | tasks table |
| 05 | `005_meetings.sql` | meetings table |
| 06 | `006_activities.sql` | activities table |
| 07 | `007_ownership.sql` | ownership columns — **defines `actor_id` as TEXT** |
| 08 | `008_rbac_helper.sql` | `get_visible_profile_ids()` — the corrected version |
| 09 | `009_rbac_policies.sql` | role-scoped RLS for leads/tasks/meetings/activities/contacts |
| 10 | `010_opportunities.sql` | opportunities table + its RLS |
| 11 | `011_notifications.sql` | notifications table + its RLS |
| 12 | `012_timeline.sql` | activities.metadata + `timeline_events` view (security-safe) |
| 13 | `013_activities_rls.sql` | final entity-scoped activity visibility |
| 14 | `014_admin_policy.sql` | re-asserts the profiles Admin update policy |
| 15 | `015_settings.sql` | **REQUIRED** — company_settings + user_preferences |
| 16 | `016_notifications_realtime.sql` | Realtime replication for the notification bell |
| 17 | `017_integrations.sql` | External mail/calendar integration tables |

Then run `verification.sql` (read-only) and check every `status` column reads `PASS`.

**Expected final state** (confirmed by execution against PostgreSQL 16.14):

| | After 001–017 (all files) |
|---|---|
| Tables | 14 |
| Views | 1 |
| Functions | 4 (project functions; excludes extension functions) |
| RLS policies | 39 |
| Foreign keys | 8 |
| Seeded rows | 4 teams |

Files 016 and 017 were added after `verification.sql` was written, so that script
covers 001–015 only. The integration tables carry their own verification block at
the end of `017_integrations.sql`.

Per-table policy counts: activities 2 · contacts 4 · leads 4 · meetings 4 · notifications 4 · opportunities 4 · profiles 4 · tasks 4 · teams 1 · company_settings 3 · user_preferences 4.

### Why the order is not negotiable

- **007 before 012** — `activities.actor_id` must be created as `TEXT`. In the original repo two files created this column with different types and whichever ran first won silently. If 012 ever created it as `UUID`, every policy comparing `actor_id = auth.uid()::text` fails with `operator does not exist: uuid = text`. In this package 012 no longer touches the column at all, but the dependency remains.
- **008 before 009, 010 and 013** — those three files reference `get_visible_profile_ids()` inside policy expressions, and PostgreSQL resolves the function at `CREATE POLICY` time.
- **001 before 008** — PostgreSQL validates SQL-language function bodies at creation, so `public.profiles` must already exist.
- **010 before 013** — the entity-scoped activities policy reads `public.opportunities` directly.
- **001 before 014** — 014 drops and re-creates a policy that 001 created.

Files 002–006 are independent of each other, and 011 is independent of everything except `auth.users`. Keeping the numbered order is simplest.

### These files fail loudly on purpose

Unnecessary `IF NOT EXISTS` and `DROP ... IF EXISTS` have been removed. If you run a file twice, or out of order, you get a hard error like `relation "contacts" already exists` rather than a silent no-op that leaves a half-configured schema. **A failure here is the package doing its job.** Fix the order and re-run against a clean project rather than forcing past it.

If a file fails partway, the Supabase SQL Editor runs each script in a transaction, so nothing from that file is applied. Correct the problem and re-run that file.

### Are files 015, 016 and 017 required?

**All three are now required.** Their status changed as later phases were built:

- **`015_settings.sql`** — was optional when written, because nothing queried
  `company_settings` / `user_preferences`. The Settings module was rewired to real
  Supabase persistence afterwards, so it is now load-bearing. Without it every
  Settings section silently falls back to defaults and saves fail.
- **`016_notifications_realtime.sql`** — puts `public.notifications` into the
  `supabase_realtime` publication. Without it the notification bell never updates
  live. Equivalent to ticking Database → Replication in the Dashboard; running
  both is harmless (the migration is guarded and idempotent).
- **`017_integrations.sql`** — creates the three tables behind Settings →
  Integrations. Without it the Integrations tab renders but every connection
  attempt fails. Also required before deploying the Edge Functions in
  `supabase/functions/`.

---

## Manual configuration in the Supabase Dashboard

The SQL files cannot do any of this. All of it is required before the app works end to end.

### 1. Bootstrap the first Admin — required

There is a deliberate chicken-and-egg here: the "Admins can update any profile" policy needs an existing Admin, and the signup trigger assigns everyone `role = 'Employee'`. The first elevation **cannot be done through the app UI**.

1. Create your first user — app signup page, or Authentication → Users → Add user.
2. The `on_auth_user_created` trigger fires and inserts the profile row automatically.
3. In the SQL Editor, elevate that user:
   ```sql
   UPDATE public.profiles SET role = 'Admin' WHERE email = 'you@yourdomain.com';
   ```
4. Confirm with check 11b in `verification.sql`.

### 2. Build the reporting hierarchy — required for Manager visibility

`get_visible_profile_ids()` walks `profiles.manager_id`. Until that column is populated, **every Manager-role user sees only their own records.** Set it via the User Management page once an Admin exists, or directly in the Table Editor. Admin and AGM users are unaffected — they always see everything via the fast path.

### 3. Realtime replication on `public.notifications` — required for the live bell

Database → Replication → enable for `public.notifications`. `notificationsService.subscribeToNotifications()` opens the channel `notifications:user:{userId}`; without this the notification bell never updates live. No other table needs Realtime. Check 16 in `verification.sql` confirms it.

### 4. Auth configuration — required

- **Provider:** Email + password. No OAuth provider is referenced anywhere in the codebase.
- **Confirm email: leave ON (recommended).** `userManagementService.createWorkspaceUser()` creates users with `supabase.auth.signUp()` and the anon key rather than the admin API. With confirmations disabled, `signUp` returns a live session and **the admin's browser is silently signed in as the user they just created.**
- **Site URL:** your deployed origin, matching `VITE_APP_URL`.
- **Redirect allow-list** (Authentication → URL Configuration) — the app uses three callback paths:
  - `{VITE_APP_URL}/verify-email` — signup and resend
  - `{VITE_APP_URL}/reset-password` — password reset
  - `{origin}/login` — admin-created users
  
  Add all three for production **and** for `http://localhost:5173` if you develop locally.

### 5. Environment variables — required

Set in `.env.local` and in your Vercel project. These are the only four the app reads:

```
VITE_SUPABASE_URL=https://<new-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<new project anon key>
VITE_USE_REAL_BACKEND=true
VITE_APP_URL=https://<your-deployed-app>
```

Point these at the **new** project. The old project's credentials must not be reused here.

### 6. Storage buckets — none required

There are zero `supabase.storage` calls in `src/`. `profiles.avatar_url` is a plain text column holding an external URL. Do not provision buckets.

### 7. PostgreSQL version — verify once

File 012 uses `WITH (security_invoker = true)`, which requires **PostgreSQL 15 or newer**. Every current Supabase project qualifies. Confirm with `SHOW server_version;` before running 012 if you are unsure.

---

## What is deliberately absent

| Original file | Why it is not in this package |
|---|---|
| `profiles_team_patch.sql` | Legacy predecessor of `profiles_foundation.sql`; every statement is a subset of file 001. It also re-creates "Users can update own profile" **without** a `WITH CHECK` clause, which is a security regression. |
| `remove_demo_profiles.sql` | Demo-cleanup tooling. Its `DELETE`/`UPDATE` statements are commented out; the active statements are `SELECT`s that return zero rows on a new project. |
| `cleanup_demo_data.sql` | Demo-cleanup tooling, same reasoning. Also errors outright if run before `opportunities` exists. |
| `rbac_rls.sql` Section 1 | The broken `get_visible_profile_ids()` — a self-referential CTE without `RECURSIVE`. It aborts on creation and, because the SQL Editor uses one transaction, rolls back every policy in the rest of that file. The corrected version is file 008. |
| `timeline_patch.sql` actor_id line | Declared `actor_id` as `UUID`. Wrong type — see file 007. |
| SQL inside `SUPABASE_MIGRATION.md` | Divergent legacy schema. Never run it. |

No demo users, no demo business records, and no destructive `DELETE`, `UPDATE`, `TRUNCATE` or `DROP TABLE` statement appears anywhere in these 15 files. The only `INSERT`s in the entire package are the four organisational teams (reference data) and the `auth.users` back-fill in file 001, which is a no-op on an empty project.
