# Change Report — Original SQL → Clean Install Package

Every deviation from the original 17 files, and why. Nothing else was altered: no table renamed, no column renamed or retyped except where listed, no policy logic rewritten, no schema redesigned.

---

## A. Corrections to confirmed defects

### A1 — Broken RBAC helper removed
**Files:** `rbac_rls.sql` → `009_rbac_policies.sql`, `rbac_helper_fix.sql` → `008_rbac_helper.sql`

Section 1 of `rbac_rls.sql` — the `CREATE OR REPLACE FUNCTION get_visible_profile_ids` block plus its duplicate `CREATE INDEX profiles_manager_id_idx` — was removed entirely. File 009 contains Sections 2 through 7 only.

**Why:** the function used two sibling CTEs where `subordinates` referenced itself without the `RECURSIVE` keyword. PostgreSQL validates SQL-language function bodies at `CREATE` time, so the statement always failed, and because the Supabase SQL Editor wraps a script in one transaction, the failure rolled back every policy in the rest of the file.

**Verified:** reproducing the original block against PostgreSQL 16.14 raises `ERROR: relation "subordinates" does not exist`, with the hint `Use WITH RECURSIVE, or re-order the WITH items`. The corrected version from `rbac_helper_fix.sql` is carried across byte-for-byte in logic and installs cleanly.

The index was dropped from 009 because file 001 already creates `profiles_manager_id_idx`.

### A2 — `activities.actor_id` collision resolved to TEXT
**Files:** `ownership_patch.sql` → `007_ownership.sql`, `timeline_patch.sql` → `012_timeline.sql`

`ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS actor_id UUID DEFAULT NULL;` was **removed** from file 012. The column is now declared exactly once, in file 007, as `TEXT`.

**Why:** two files added the same column with different types using `ADD COLUMN IF NOT EXISTS`, so whichever ran first won silently. `TEXT` is correct because `activityService.logActivity()` writes `String(actorId)`, and because the RLS policies in files 009 and 013 compare `actor_id = auth.uid()::text`.

**Verified:** a probe table with `actor_id UUID` rejects that exact policy expression with `ERROR: operator does not exist: uuid = text`. The same expression on a `TEXT` column is accepted. The installed package reports `activities.actor_id | text`.

`notifications.actor_id` remains `UUID` — a different table and column, never compared to `::text` in any policy, and correct as originally written.

### A3 — `timeline_events` no longer bypasses RLS
**File:** `timeline_patch.sql` → `012_timeline.sql`

The view is now created as `CREATE VIEW public.timeline_events WITH (security_invoker = true) AS ...`. **Option A from your brief** — the view is retained rather than omitted, so behaviour matches the old project. The `GRANT SELECT ... TO authenticated` is unchanged.

**Why:** PostgreSQL views default to `security_invoker = false` and execute as their owner (`postgres`), bypassing RLS on the underlying table. Combined with the grant, any authenticated user could read every activity row — defeating the entire entity-scoped policy in file 013. The original file's comment claimed the view "inherits the activities RLS policies automatically"; it did not. `security_invoker = true` makes that claim true.

**Verified:** as a low-privilege test user, the base table returns 1 row, `timeline_events` returns 1 row, and a counterfactual view built the original way returns 2 (all rows). Requires PostgreSQL 15+; all current Supabase projects qualify.

### A4 — Settings tables added, derived from the frontend
**File:** `015_settings.sql` (new — no original equivalent)

`company_settings` and `user_preferences` were built by reading `settingsService.js`, `useSettings.js`, `lib/settingsData.js`, `SettingsPage.jsx` and `lib/permissions.js`. **The legacy schema in `SUPABASE_MIGRATION.md` was not copied.**

Design decisions and their evidence:

| Decision | Evidence |
|---|---|
| `company_settings.org_id` is the **primary key**, not a surrogate `id` | `settingsService` calls `.upsert({ ...payload, org_id })`. supabase-js resolves the conflict target from the primary key. With a surrogate `id UUID DEFAULT gen_random_uuid()` PK — as in the legacy MD schema — every save would insert a new row instead of updating. |
| `user_preferences.user_id` is the **primary key** | Same reasoning, for `.upsert({ user_id, <section> })`. The legacy MD schema's `id` PK + `user_id UNIQUE` would raise a unique violation on the second save. |
| Four JSONB section columns, not exploded preference columns | The service reads and writes each section as one opaque object: `.select('notifications')`, `.upsert({ user_id, appearance })`, etc. |
| Exactly nine company columns | The `company` object in `lib/settingsData.js` has exactly nine fields. Nothing added. |
| Company writes restricted to Admin/AGM | `SettingsPage.jsx` gates Company behind `ADMIN_ONLY_SECTIONS`; `lib/permissions.js` sets `canEditCompany = adminLevel` (Admin or AGM). |
| `user_preferences` is strictly own-row, no admin override | Nothing in the UI reads another user's preferences. |
| No seed row | Seeding a placeholder organisation would be demo data. |

**This file is optional and marked as such.** Nothing in the running app queries either table — see the file header and the README.

**Known frontend gap, deliberately not papered over:** `saveCompanySettings()` passes the payload through with no `toDb()` mapper, so the camelCase keys `taxId` and `fiscalYear` from `settingsData.js` would be rejected by PostgREST against the snake_case columns `tax_id` and `fiscal_year`. The correct fix is a mapper in `settingsService.js` — a frontend change, out of scope, **not made**. No camelCase columns were invented to hide it.

---

## B. Structural changes

### B1 — Three files excluded
`profiles_team_patch.sql`, `remove_demo_profiles.sql` and `cleanup_demo_data.sql` are not in the package, per your instruction. Rationale for each is in the README.

Worth recording: excluding `profiles_team_patch.sql` is not merely tidiness. It re-creates `"Users can update own profile"` **without** a `WITH CHECK` clause, where file 001's version has both `USING` and `WITH CHECK`. Running it would have silently weakened that policy.

### B2 — `IF NOT EXISTS` and `DROP ... IF EXISTS` removed
Per your requirement not to hide an incorrect schema or swallow real errors:

- `CREATE TABLE IF NOT EXISTS` → `CREATE TABLE`
- `CREATE INDEX IF NOT EXISTS` → `CREATE INDEX`
- `ADD COLUMN IF NOT EXISTS` → `ADD COLUMN`
- `DROP POLICY IF EXISTS` → `DROP POLICY` (in files 009, 013, 014, where the target policy is guaranteed to exist by an earlier file in the run order)
- Policies are created once, not `DROP`-then-`CREATE`d defensively

One exception retained: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` in file 001. Extensions are shared cluster state that Supabase pre-installs, so `IF NOT EXISTS` there is correct usage rather than error-hiding.

**Consequence:** re-running any file, or running out of order, now fails loudly. Verified — re-running file 002 produces `ERROR: relation "contacts" already exists`.

### B3 — Duplicate `uuid-ossp` declarations consolidated
Six original files each declared `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`. It now appears once, in file 001.

Recorded for completeness: **no table actually uses it.** Every table uses `gen_random_uuid()`, built into PostgreSQL 13+. `uuid_generate_v4()` is never called anywhere in the SQL or the frontend. The declaration is retained only to preserve the original project's stated intent; on Supabase it is a no-op because the extension is pre-installed in the `extensions` schema.

### B4 — Duplicate index removed
`timeline_patch.sql` created a partial index named `activities_actor_id_idx`, but `ownership_patch.sql` had already created a full index of that exact name. Because `IF NOT EXISTS` matches on name only, the partial version was **never actually created** in the original install — the index was silently not what the file believed. File 007's version is kept; the duplicate declaration was dropped from file 012.

### B5 — Interim policies retained deliberately
Files 002–006 each create a blanket `FOR ALL` policy that files 009 and 013 later drop and replace. This mirrors the original migration history exactly and keeps each schema file independently readable and independently usable. The **final** state has no duplicates: verified as 2 policies on `activities` and 4 on each of leads/tasks/meetings/contacts, with zero superseded policies remaining (verification check 6 returns no rows).

### B6 — File 014 is a re-assertion, not a second policy
`"Admins can update any profile"` is created in file 001 so `public.profiles` is complete and functional immediately, then dropped and re-created identically in file 014, preserving that file's role as a standalone corrective migration. The `DROP` + `CREATE` pair means the net result is **one** policy, not two. Verified: `profiles` has exactly 4 policies.

### B7 — Documentation added
Every file has a header stating its run position, its dependencies, its original source file, and what it does. Inline comments explaining non-obvious decisions (why `owner_id` is TEXT, why activities are append-only, why the Admin fast path exists in every policy) were preserved from the originals and extended. No SQL logic was changed to accommodate a comment.

---

## C. What was NOT changed

- No table renamed. No column renamed. No column retyped except `activities.actor_id`, which was resolved to the type the application already writes.
- No policy logic rewritten. The role model — Admin/AGM see all, Manager sees self + subordinates, Employee sees own — is carried across verbatim.
- Read-only enforcement preserved: `INSERT`/`UPDATE`/`DELETE` remain open to any authenticated user on leads, tasks, meetings, contacts and opportunities, exactly as the original safe-rollout design intended. This was **not** tightened, because doing so without a matching frontend change would break the app.
- Activities remain append-only: no `UPDATE` or `DELETE` policy exists on that table anywhere in the package. Verified — an authenticated `UPDATE` and `DELETE` against `activities` both affect zero rows.
- All indexes preserved, including the generated column `opportunities.expected_revenue` and the partial GIN index on `activities.metadata`.
- Soft references left as soft references: `contacts.linked_lead_id`, `activities.entity_id`, `opportunities.source_lead_id` and `notifications.actor_id` still have no FK constraints, as originally designed.
- The four seeded teams are preserved.
- No frontend file was read-modified. `src/` was inspected only.

---

## D. Verification performed

**Executed against real PostgreSQL 16.14** in this session's Linux container, using a harness that recreates the Supabase objects the migrations depend on (`auth.users`, `auth.uid()`, `auth.role()`, and the `anon`/`authenticated`/`service_role` roles). This is not a Supabase instance, and Supabase's own GoTrue, PostgREST and Realtime layers were not exercised.

| Test | Result |
|---|---|
| All 15 files execute in order, `ON_ERROR_STOP=1` | 15/15 PASS |
| 11 tables, 1 view, 2 functions created | PASS |
| RLS enabled on all 11 tables | PASS |
| Policy counts match expectation (38 total) | PASS |
| No superseded policy left behind | PASS — 0 rows |
| `activities.actor_id` is `text` | PASS |
| `on_auth_user_created` trigger present and enabled | PASS |
| 5 foreign keys with correct delete rules | PASS |
| Trigger auto-creates a profile per `auth.users` insert | PASS — 4/4 |
| `get_visible_profile_ids` — Admin 4, Manager 2 (self + 1 report), Employee 1, unrelated user 1 | PASS |
| RLS visibility matrix across Admin / Manager / Employee / outsider | PASS |
| `timeline_events` returns the same row count as the base table per user | PASS |
| Counterfactual: original-style view leaks all rows (2 vs 1) | Confirms A3 was necessary |
| Original broken helper fails on creation | Confirms A1 was necessary |
| `actor_id UUID` rejects the policy expression | Confirms A2 was necessary |
| Activities `UPDATE`/`DELETE` affect 0 rows | PASS |
| `anon` role sees 0 rows in `leads` and `profiles` | PASS |
| Re-running a file fails loudly | PASS |
| Static scan: no `DELETE FROM`, `UPDATE`, `TRUNCATE`, `DROP TABLE` | PASS — none found |
| Static scan: no demo identities or `@nexuscrm.io` | PASS — none found |
| `verification.sql` executes cleanly, all checks report PASS | PASS |

Test rows created during the RBAC checks existed only in the throwaway local database. Nothing was written to any Supabase project, and no demo data appears in the package.
