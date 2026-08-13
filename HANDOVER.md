# Accord CRM — Handover: Dashboard step 12 DONE, multi-tenant 022→023 DONE (needs app testing)

Repo: https://github.com/ahmadullah-nabil/accord-crm-v3 (public — clone it)
Live: https://accord-crm-v3.vercel.app
Supabase project ref: `gopcrwrprpfcieljdyjt` — project name **"Accord CRM (Clone)"**, badge says PRODUCTION
Local: Windows / PowerShell, `Downloads\accord-crm-complete\accord-crm-main`

> **Read the real files before writing code.** Especially
> `supabase/clean-install/022_multi_tenant_foundation.sql`,
> `022a_service_role_org_fix.sql`, `023_tenant_isolation.sql`,
> `009_rbac_policies.sql`, `008_rbac_helper.sql`.
> **Clone and read — do not trust this document over the code.**

---

## FIRST — verify state, do not assume

Last two handovers each claimed work was pushed when it was not. This time it
was verified from the remote side, but verify again anyway — it costs a minute.

```powershell
cd "C:\Users\Ashraf Nabil\Downloads\accord-crm-complete\accord-crm-main"
git fetch origin
git log origin/main --oneline -5
git status --short
```

**Confirmed on `origin/main` at handover time:**

```
f9a46da  022a + 023: service-role org fix and tenant isolation
2e3d1a0  Dashboard: mobile agenda view below sm; stack Lead Overview header
f180487  Dashboard: gate the six analytics queries on the Overview tab
cdf1563  Dashboard: Lead Overview
1f4d933  Dashboard: calendar filters
```

All four SQL files and all four JSX/JS files were byte-compared against the
tested versions — identical.

**One correction is NOT yet pushed:** `022_verify.sql` on GitHub contains a
misleading final check (see "Known issues" #1). A corrected version was produced
this session. Push it before relying on that file.

---

## What this session did

### 1. Dashboard step 12 — finished (2 of 3 jobs; job 2 still open)

- **`f180487`** — the `enabled: tab === 'overview'` fix. Six `useDashboard*`
  hooks now take `{ enabled = true } = {}` ANDed with the auth check; one call
  site passes `forOverview`. Required code motion: `tab` was derived *below* the
  hook calls, so `useSearchParams` was hoisted above them. A comment in the file
  falsely claimed the gating already worked — it now says the opposite and
  explains that the JSX condition controls markup only.
  **Measured: Today tab went from 9 React Query keys on first paint to 3.**
  (`useAssignableMembers` resolves to `teamKeys.members()`, a shared key, so
  CalendarFilterBar and LeadOverview dedupe onto one entry.)

- **`2e3d1a0`** — mobile. Below `sm` the seven-column grid is `hidden` and an
  **agenda list** renders instead. Same data, same hooks:
  `agendaDates = Object.keys(byDate).sort()`, so the two views cannot disagree.
  Only non-empty days appear, every item shown (no `+2 more` — vertical space is
  what a phone has).
  Three things it forced, all genuine fixes: `CreateMenu` extracted (the grid
  opened an inline copy on hover, the agenda needs it from a tap — two
  hand-rolled menus drift apart); the day-detail panel is now `hidden sm:block`
  (it exists because a grid cell shows 3 of 9 items — the agenda shows all 9, so
  on a phone it was the same content twice); and "Hover a date to add…" became
  "Use + on a date", which is false on a touch screen.
  Creating on an **empty** day needed a decision: the agenda lists only
  non-empty days, so the footer carries Meeting/Task buttons prefilled with
  today when today is in the viewed month, otherwise the 1st of that month.
  LeadOverview header is now `flex-col sm:flex-row`.

**Job 2 — the 5-vs-6-row grid — is still Rayhan's call and was never answered.**
It is now a **desktop-only** cost, since the agenda has no fixed row count.
Recommendation unchanged: render only the weeks the month needs. The fixed
height defends against a jump that happens only when paging months — a
deliberate act — while the dead row is on screen 100% of the time.

### 2. Multi-tenant / organization system — `f9a46da`

Decision taken: **one multi-tenant product, Accord is tenant #1.** Not two
codepaths. Accord dogfoods what it sells, so an isolation bug hits Accord before
it hits a bank.

Fork resolved: **memberships (many orgs per user)**, not `profiles.org_id`.
Reason was concrete, not general — the day a customer buys this, someone at
Accord must see inside their org to answer a support ticket, and with a
single-org column the only way is an Admin account inside the customer's tenant,
which *is* the leak. Retrofitting one→many later costs the same as this did.
UI is unchanged: no org switcher, nobody notices.

---

## The three migrations — what each does

### `022_multi_tenant_foundation.sql`
- `organizations`, `memberships (user_id, org_id, role)`, `platform_admins`,
  `platform_access_log`
- `current_org_id()` (JWT claim first, membership fallback), `is_org_member()`,
  `current_org_role()`, `is_platform_admin()`, `custom_access_token_hook`
- `org_id UUID NOT NULL DEFAULT current_org_id()` on 9 tables, backfilled,
  FK'd, indexed with **org_id leading every index**
- `get_visible_profile_ids()` rewritten to be org-scoped in **both** terms of
  the recursion

**Accord's org id is `00000000-0000-0000-0000-000000000001`** — not a new value.
`src/services/settingsService.js` already exported that exact sentinel as
`WORKSPACE_ORG_ID` for `company_settings`. Reusing it meant zero data migration.

**`role` moved to `memberships`; `profiles.role` is kept and mirrored** by a
trigger so `lib/permissions.js` and the auth store keep working untouched. The
mirror only copies the Accord-org role and is lossy by design. **Delete the
column and the trigger in the same commit that moves `permissions.js` onto
memberships.**

**`profiles` deliberately has no `org_id`** — identity is global, membership is
per-org. A column would contradict the whole design.

### `022a_service_role_org_fix.sql` — fixes a bug 022 introduced
022 broke email sending. `current_org_id()` reads the JWT; an Edge Function
using the **service role key has no JWT**, so the DEFAULT evaluated to NULL and
`NOT NULL` rejected the row. Reproduced against a real database:

```
ERROR: null value in column "org_id" of relation "email_messages"
       violates not-null constraint
```

Three paths: `send-email` → `email_messages`, `calendar-sync` → `meetings`,
both → `activities`. `send-email` logs *before* sending, so sends died at the
logging step. RLS was not involved — service role bypasses RLS; this was a plain
constraint violation, so no policy change could have fixed it.

Fixed with a `BEFORE INSERT` trigger (`fill_org_id`) that resolves org from the
row's own user column (`user_id` / `organizer_id` / `actor_id`) when org_id is
NULL. Editing the three Edge Functions would have worked and left the same trap
for the next function anyone writes. It cannot weaken isolation: it only fires
when org_id is NULL and resolves from the acting user's own membership.

### `023_tenant_isolation.sql` — **approach was changed mid-flight**
The plan was to rewrite all 28 policies as
`USING ( org_id = current_org_id() AND ( <existing> ) )`. **That was abandoned,
deliberately.**

The `activities` SELECT policy alone is ~40 lines of nested `EXISTS` across five
entity types. Retyping 28 such expressions to bolt one `AND` onto each risks a
transcription error in each — and that error does not fail loudly, it silently
changes who can see what, inside a file whose only purpose is access control.

Instead: **`AS RESTRICTIVE` policies**, which Postgres ANDs with every permissive
policy on the table. That is exactly "AND-wrapped outside, never OR-ed in",
enforced by the engine rather than by typing. **The 28 existing policies are
untouched.** Eleven restrictive policies were added — nine tenant tables plus
`company_settings` (keyed by org_id but its policies never mentioned it) and
`profiles` (membership-based, since it has no org_id; without it every tenant
could list every user's name and email, and the assignee dropdown would show it).

**This is also structurally stronger.** Under the rewrite plan, the day someone
adds a 29th permissive policy it is OR-ed in with no org check and isolation is
silently gone. A restrictive policy cannot be escaped that way.

---

## Tested, not just written

A real PostgreSQL 16 was started in the container, the full existing schema
001–021 applied, then 022, 022a, 023 on top. Attacks were run as an
**unprivileged role**, not the superuser.

| # | Attack | Result |
|---|---|---|
| — | Nabil (Accord) lists leads | only Accord's |
| 1 | Nabil **forges his token** to claim Prime Bank's org | **0 rows** |
| 2 | Nabil **moves** his own lead to Prime Bank via UPDATE | **blocked** by WITH CHECK |
| 3 | Nabil **inserts** directly into Prime Bank | **blocked** |
| 4 | Nabil is **Admin** — does the "Admin sees everything" branch escape? | **1 lead, not 2** |
| 5 | Nabil reads `profiles` | Prime Bank staff **absent** |
| 6 | Cross-org `manager_id` (bad import) walks the recursion | old: leaked; **new: contained** |
| 7 | Malformed JWT claim | returns NULL — **fails closed**, no fallback |
| 8 | Suspended org | loses access, keeps data |
| — | Control: Prime Bank admin | sees only their own |

Attack 4 mattered most: every existing policy opens with *"pass if Admin or
AGM"*. Under the rewrite plan one slip would have handed an admin of one tenant
the entire database.

**Checked rather than assumed:** `timeline_events` is a *view* over `activities`.
A Postgres view without `security_invoker` runs as its owner and bypasses RLS
entirely. It already had `security_invoker = true`. `022_verify.sql` check 10
now enforces that for any view added later.

---

## DB state — what has actually been run

On the Supabase project, confirmed by Rayhan:
- ✅ `022` run — all 11 verify checks PASS
- ✅ JWT hook **ENABLED** (Authentication → Hooks → Customize Access Token,
  Postgres function, `public` / `custom_access_token_hook`)
- ⚠ `022a` and `023` — **placed and pushed, but it was NOT confirmed in-session
  that they were run against the database.** Check first:

```sql
-- expect 11 rows, all 'isolated'
SELECT t.tablename,
       CASE WHEN p.policyname IS NULL THEN '*** NOT ISOLATED ***' ELSE 'isolated' END
FROM (VALUES ('leads'),('contacts'),('tasks'),('meetings'),('opportunities'),
             ('activities'),('notifications'),('email_messages'),('teams'),
             ('company_settings'),('profiles')) t(tablename)
LEFT JOIN pg_policies p ON p.schemaname='public' AND p.tablename=t.tablename
                       AND p.permissive='RESTRICTIVE'
ORDER BY 2,1;

-- expect 3
SELECT count(*) FROM pg_trigger
WHERE tgname IN ('email_messages_fill_org','meetings_fill_org','activities_fill_org');
```

**The app has NOT been end-to-end tested since 023.** This is the highest
priority next action — 023 is the change that can lock people out.

---

## NEXT — in this order

**1. Test the app after 023.** Sign out and back in FIRST (old tokens have no
org claim). Then: Leads, Contacts, Tasks, Meetings, Opportunities load? Assignee
dropdown populated? Create/edit/delete a lead? **Send an email** — that is the
022a fix. Create a meeting with an attendee — that is `calendar-sync`. Dashboard
calendar and Lead Overview populate?
If a page is empty, suspect a stale token before suspecting a policy.

**2. Push the corrected `022_verify.sql`** (Known issues #1).

**3. Decide the 5-vs-6-row grid** (Dashboard job 2, still unanswered).

**4. Step 13 is DONE — and it was never an open decision.** The roadmap claimed
`email_messages` links to lead/contact/opportunity as separate columns. **It does
not.** There are no per-entity columns anywhere; the `(type, id)` pair is already
in use on six tables. `025_polymorphic_links.sql` settles the convention, adds
the two missing indexes, and constrains the TEXT ids. See below.

---

## Known issues — carried forward

1. **`022_verify.sql` on GitHub has a misleading check.** Its final query counts
   policies not mentioning `org_id` and says it should reach 0 after 023. It
   reads **28 forever** — because 023 deliberately left the 28 permissive
   policies alone. Proven: the same query returns 28 on the fully-isolated,
   attack-tested database. A corrected version exists and needs pushing. This
   was my error, and it cost a false alarm.

2. **Both OAuth client secrets were exposed in a chat transcript** and still
   need rotating via the provider consoles. *Rayhan's task — never ask for the
   values or put them in code.* Ten minutes; connections survive because refresh
   tokens are stored. **Carried across many sessions.** Now that this is a
   multi-tenant product, a shared OAuth client with leaked secrets is a
   different risk class — this is no longer a someday item.

3. **Google OAuth app is in Testing mode** — 100 users max, refresh tokens
   expire in 7 days, individual Gmail users cannot connect. **You cannot onboard
   a second organisation onto a Testing-mode client.** Step 24 is now blocking
   for the multi-tenant plan, not optional.

4. **Service role bypasses RLS entirely.** Edge Functions are safe today only
   because each resolves one user from a verified JWT before switching to the
   admin client. **Step 17 (notification scanner → `pg_cron`) is now a
   landmine**: a job scanning overdue tasks across the whole table has no user
   context, and no policy in 023 contains it. It must group by `org_id`
   explicitly.

5. **Within an org, 17 write policies are still wide open** —
   `auth.role() = 'authenticated'` for INSERT/UPDATE/DELETE. Any member can edit
   any lead in their own org. Pre-existing single-tenant RBAC decision,
   unchanged, out of 023's scope. 023 stops *cross*-tenant access.

6. **`assignee` is a NAME, not an id** (carried-forward invariant: tasks store
   `assignee` as a name and have no user id; meetings have `organizer_id`). Two
   tenants both employing a "Rahim Uddin" is not hypothetical in Bangladesh.
   Row-level `org_id` filtering contains it, so not a leak — but this moves the
   switch to `assignee_id` from *deferred* to *scheduled*.

7. **`profiles.role` is deprecated but still live**, mirrored by trigger. Once
   any user holds two memberships it cannot represent them. Delete it and the
   trigger in the same commit that moves `lib/permissions.js` to memberships.

8. Microsoft adapter written, never run. No calendar account picker (step 21).
   Location dropdown defaults to "Google Meet" with no link (step 22). Zoho
   invitations come from `noreply@zohocalendar.com`. Attachments not built
   (step 14). Deno type-check never run.

9. **Lead Overview counts lag up to `staleTime` (30s)** — `leadsStore` does not
   invalidate React Query. Query key is `['leads','stage-facets']`, deliberately
   under `['leads']`, so wiring store mutations to invalidate `['leads']` fixes
   it for free.

---

## Carried-forward invariants — these still hold

**Do not create a unified activity table.** `calendarActivityService.js` unions
`meetings` and `tasks` at READ time. `activities` is an append-only AUDIT LOG.

**Overdue is DERIVED, never stored.** `due_date < today AND status <> 'Completed'`.
`TASK_STATUSES` still contains `'Overdue'` — legacy and wrong, do not write it.

**Tasks are all-day and must stay so.**

**Completed items stay visible** (dimmed, struck through).

**The user filter compares NAMES, not ids.** Lead Overview follows this too.

**Never use `toISOString()` for calendar dates** — UTC conversion puts Dhaka
evening items on the previous day. Use the local `YYYY-MM-DD` helper.

**Filter state belongs in the URL.** Params deleted rather than emptied,
functional form, `{ replace: true }`. `?leadOwner` is Lead Overview's; `?owner`
is the calendar's — deliberately separate.

**Per-capability credentials (`019`).** Do not collapse to one row per account.

**Scopes are send-only.** Never add `gmail.readonly`/`modify`/`insert`.

**Zoho:** `Zoho-oauthtoken` not `Bearer`; tokens not portable between data
centres; Mail on `mail.zoho.<tld>`; Calendar on `calendar.zoho.<tld>` needing
both `ZohoCalendar.calendar.READ` and `ZohoCalendar.event.ALL`.

**Never prefix a provider secret with `VITE_`.** Tokens live server-side only,
in a table with RLS enabled and **zero policies**. Do not add a policy there.
Same pattern now applies to `platform_admins` and `platform_access_log`.

**`platform_admins` is NOT a role and must never become one.** No policy
references it. Support access goes through explicit, logging SECURITY DEFINER
functions — deliberately slower to use.

**Ask before architectural changes to the integration or calendar data layer.**

---

## Local workflow — Rayhan's setup

Windows / PowerShell. Applies changes by downloading a zip, unzipping to
`Downloads\<name>`, and running a copy script that maps **flat filenames to repo
paths**. Hand over **flat files plus a name→path map**, never a nested `src\`
tree. Always include the `if (-not $src) { throw }` guard — an unset variable
expands to `""` and `"\src"` resolves against the drive root, which once caused a
`Get-ChildItem` to scan all of `C:\`.

Windows "Extract All" defaults to a folder named after the zip, so extracting
into `Downloads` can produce `Downloads\step023\step023\…`. Check before running.

Finish with `npm run build` when `src/` changed, then
`git add -A && git commit && git push`, and confirm with
`git log origin/main --oneline -1` — **not** `git log`, which shows the local
branch and looks correct while nothing has left the machine.

### Template — the PowerShell file-placing command

```powershell
$src  = "C:\Users\Ashraf Nabil\Downloads\<BATCH>"
$repo = "C:\Users\Ashraf Nabil\Downloads\accord-crm-complete\accord-crm-main"

if (-not $src)  { throw "src not set" }
if (-not $repo) { throw "repo not set" }

$map = [ordered]@{
  "<FlatFileName>" = "<repo\relative\path>"
}

foreach ($name in $map.Keys) {
  $from = Join-Path $src  $name
  $to   = Join-Path $repo $map[$name]
  if (-not (Test-Path $from)) { Write-Host "MISSING: $name" -ForegroundColor Red; continue }
  New-Item -ItemType Directory -Force -Path (Split-Path $to) | Out-Null
  Copy-Item $from $to -Force
  Write-Host "placed  $($map[$name])" -ForegroundColor Green
}
```

Follow it with a marker check — `Copy-Item -Force` is silent whether it worked or
wrote somewhere unexpected:

```powershell
Select-String -Path "$repo\<file>" -Pattern "<expected marker>" | Measure-Object | Select-Object -Expand Count
```

---

## Full roadmap

### Done
1–10. Integrations, tokens, email sending, calendar push, activity audit,
data model, monthly calendar, create-on-date-click, calendar filters ✅
11. Lead Overview ✅
12. Dashboard polish — jobs 1 and 3 ✅ (**job 2, the grid, still open**)
**22. Multi-tenant foundation + isolation ✅** (022 / 022a / 023 — app testing pending)

### ── NEXT ──
13. **Polymorphic link model ✅** — `025`. Was already decided six times over;
    the file documents the convention rather than changing it.

### Then
14. **Attachments** (Phase 1b). Graph caps `sendMail` near 4 MB; Gmail has a
    resumable-upload threshold; **Zoho does not take bytes at all** — its Upload
    Attachments API returns a reference. High priority: this CRM sends quotations.
15. Generalise `EmailComposer`, extract `MeetingScheduler`.
16. Mount both across Leads, Tasks, Opportunities, Meetings. **Attachments FIRST.**
17. **Notification scanner → `pg_cron`.** Must be org-aware (see issue 4).
    Delete `useIntelligence.js` or you get duplicates.
18. Email notifications via Resend from a system address on `accordhrm.com` —
    **not** the user's OAuth grant. DNS verification has lead time.
19. Digest batching.
20. Unified CRM timeline.
21. Calendar account picker.
22. Conferencing links.
23. Microsoft app registration + testing.
24. **Google verification — now blocking** for multi-tenant (see issue 3).

### Multi-tenant follow-ups (new, from this session)
- Org onboarding: invite flow, domain mapping, first-admin bootstrap, org
  switcher. **Larger than the migration was.** Not started.
- Move `lib/permissions.js` off `profiles.role` onto memberships, then drop the
  column and its mirror trigger.
- Write the audited platform-support functions that use `platform_admins` and
  write to `platform_access_log`.

### Later / only if asked
25. Two-way calendar sync and RSVP. `external_event_id` and `etag` already
    stored, so additive. **Start it when users complain, not because a plan says
    "RSVP".**
26. Automation, recurring tasks, analytics, mobile push, offline.

---

# ADDENDUM — later in the same session

Everything above was written mid-session. This part supersedes it where they
disagree.

## Migrations added after the original handover

| File | What |
|---|---|
| `023a_fix_profiles_recursion.sql` | **Fixed a bug 023 caused** — every UPDATE on `profiles` failed with `infinite recursion detected in policy`. SELECT worked, so a read-only walkthrough looked fine. Cause: `014`'s admin policy does `SELECT FROM profiles` inside a policy *on* profiles; 023's restrictive policy named `public.profiles.id` in its body and closed the cycle. Fix: the membership test moved into `shares_org_with()`, a SECURITY DEFINER function, so the policy body names no table at all. |
| `024_org_onboarding.sql` | `org_invitations`, a trigger on `auth.users` that turns an invitation into a membership **before the first token is minted**, `provision_organization()`, `my_membership_status()`, and a backfill for anyone created between 022 and then. |
| `024a_invitation_org_default.sql` | **Fixed a bug 024 caused** — inviting failed with an RLS error even as Admin. `org_invitations.org_id` was declared NOT NULL with **no** `DEFAULT current_org_id()`, unlike the other nine tables. The client correctly does not send `org_id`, so the value was NULL, `NULL = current_org_id()` is NULL, and Postgres reported a missing value as a permissions failure. |
| `025_polymorphic_links.sql` | Step 13. Indexes on `meetings`/`tasks` link pairs, UUID-shape CHECKs on the TEXT ids, and a `crm_entity_type` domain for future columns. |

## Frontend added

| File | What |
|---|---|
| `src/services/invitationService.js` | Invitation CRUD + `my_membership_status` RPC |
| `src/hooks/useInvitations.js` | Query hooks |
| `src/components/users/UserCreateModal.jsx` | **Rewritten as an invite form.** No name field, no temp password — the person supplies both at signup |
| `src/components/users/PendingInvitations.jsx` | Panel on the Users page: copy link, renew, revoke |
| `src/components/auth/NoOrganization.jsx` | Explains "you are in no organisation" instead of an empty CRM |
| `src/layouts/AppLayout.jsx` | Mounts the org gate — **fails open**, deliberately |

Build: **2317 modules**.

## Step 13, correctly stated

There are **no per-entity columns** in this schema. The `(type, id)` pair is on
six tables, with two names and two types:

```
activities       entity_type  / entity_id   TEXT
notifications    entity_type  / entity_id   UUID
timeline_events  entity_type  / entity_id   TEXT   (a view)
email_messages   related_type / related_id  UUID
meetings         related_type / related_id  TEXT
tasks            related_type / related_id  TEXT
```

**The naming split is kept — it encodes a real distinction.** `related_*` means
*this record is about that record* (a user set it). `entity_*` means *this record
points at that record from a log* (the system wrote it as provenance). Rule for
new tables: user-chosen → `related_*`; system-written history → `entity_*`.

**Neither ever gets a foreign key.** A deleted lead must not delete the audit
trail of what was done to it.

The type split is half-fixed: `meetings`/`tasks` now carry a UUID-shape CHECK
(verified zero non-UUID values first). `activities.entity_id` stays TEXT and
unconstrained on purpose — a log must accept what happened, and rejecting a
write because the subject looks odd loses the record you would most want.

**This unblocks step 15** — a single `{ type, id, label }` reference works
against all six tables with no further schema work.

## Still not done

1. **Job 2 of Dashboard step 12** — the 5-vs-6-row calendar grid. Still Rayhan's
   call, now a desktop-only cost since the agenda has no fixed row count.
2. **`lib/permissions.js` still reads `profiles.role`.** `memberships.role` is
   the source of truth, mirrored by trigger. Delete the column and its trigger in
   the same commit that moves permissions onto memberships.
3. **No org switcher.** Not needed until someone holds two memberships;
   `my_membership_status().org_count` is how the app will know.
4. **No platform-support functions.** `platform_admins` and
   `platform_access_log` exist and are referenced by nothing.
5. **Nobody has tested a real end-to-end invite** — invite an address you
   control, sign up in a private window, confirm you land in the CRM with data.

## The pattern worth carrying forward

Five bugs surfaced this session; three were caused by these very migrations, and
**two were found only by clicking in the live app**, not by any SQL check:

- The invitation `org_id` default — every SQL verification passed.
- The verify script's own expectation was wrong and reported 28 forever.

The lesson that keeps repeating: *"the page loads"* and *"the feature works"* are
different claims. The profiles recursion broke every write while every read kept
working, and looked completely healthy on a walkthrough. **Test a write.**
