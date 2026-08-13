# Accord CRM — Frontend Redesign Handover #3

**Written 13 August 2026.** Continues `HANDOVER-FRONTEND-2.md` (step037–042) and
`HANDOVER-FRONTEND.md` (step033–036). The repo's `HANDOVER.md` (backend,
database, Edge Functions, integrations) is still accurate for all of that.

This file covers **step043 through step049** and supersedes #2's "Where the
redesign stands", "Your job" and "Known open items" sections. Everything else in
#2 still holds — the primitives, their APIs, the migration recipe and the
working method are unchanged.

If you are an assistant picking this up in a fresh conversation: read this file,
**then clone the repo and read the actual code.** Several claims in #1 and #2
turned out to be wrong when checked against the running system, and the same
will eventually be true here.

---

## Start here

```
Repo:      https://github.com/ahmadullah-nabil/accord-crm-v3   (public — clone it)
Live:      https://accord-crm-v3.vercel.app
Supabase:  gopcrwrprpfcieljdyjt   — project "Accord CRM (Clone)"
Local:     C:\Users\Ashraf Nabil\Downloads\accord-crm-complete\accord-crm-main
```

**The frontend redesign is COMPLETE.** All five record modules and the dashboard
are migrated. There is no remaining module work. What is left is backend and
verification — see "What is actually left" at the bottom.

---

## Where the redesign stands

| Batch | What | Status |
|---|---|---|
| step033–042 | See handover #2 | applied, live |
| step043 | Contacts on `RecordShell`, `/contacts/:id`, shared `RelatedList` | live (`2596824`) |
| step044 | Opportunities list on `DataTable`/`ViewHeader`/`FacetChips`, shared `Segmented` | live (`2030f68`) |
| step045 | Opportunities record, `/opportunities/:id`, `'Opportunity'` related-type, Kanban density | live (`622d44b`) |
| step046 | Notifications on `ViewHeader`/`FacetChips` | live (`05bc0a4`) |
| step047 | Tasks both halves, `/tasks/:id`, local date parsing | live (`12a940f`) |
| step048 | Meetings both halves, `/meetings/:id` | live (`5ef6580`) |
| step049 | Dashboard Today tab: agenda rail + month grid, themed chrome | pending |

Every module now has: `FacetChips` + `ViewHeader` + `DataTable` on the list, and
`RecordShell` panel + record page sharing one `<Module>RecordContent.jsx`.

Five record routes exist: `/leads/:id`, `/contacts/:id`, `/opportunities/:id`,
`/tasks/:id`, `/meetings/:id`.

---

## New invariants — added since #2

These are in addition to every invariant in handover #2, all of which still
hold. None of these fail loudly.

### 1. `new Date('YYYY-MM-DD')` is UTC. This is the READ-side date trap.

step040 swept every **write** with a mechanical rule: "every
`.toISOString().split('T')[0]` is wrong". That rule cannot catch the read side,
because the bug has no `toISOString()` in it:

```js
new Date('2026-08-13')   // → 2026-08-13T00:00:00 UTC
new Date(2026, 7, 13)    // → 2026-08-13T00:00:00 LOCAL
```

A bare date-only string is parsed by the spec as UTC; every other Date
constructor form is local. So subtracting a local midnight from one of these
mixes two different midnights. `Math.round` hides it inside ±12h, which is why
it looked correct in Dhaka (UTC+6) and would have been a whole day out further
east.

Found in `daysUntilDue()` (tasksData.js, fixed step047) and `daysFromToday()`
(meetingsData.js, fixed step048) — twin helpers, identical bug.

**Use `parseLocalDate(s)` / `formatLocalDate(s, opts)` from `src/lib/dates.js`
for any date-only column.** Timestamps (`timestamptz`) are unaffected — they
carry an offset and `new Date()` reads them correctly. `formatMeetingDateTime`
in meetingsData.js is also fine and was deliberately left alone: it builds
`${date}T${time}`, and a datetime string without a `Z` is parsed as local.

### 2. A segment or chip must read ONLY the filter it sets.

Three controls were found highlighting themselves from a compound condition:

- Notifications "Unread": `readFilter === 'Unread' && categoryFilter === 'All'`
- Meetings "Mine": `organizerFilter === user.name && statusFilter === 'All' && typeFilter === 'All' && searchQuery === ''`
- Tasks quick tabs: same shape

Each turned OFF while its own filter was still applied, the moment the user
touched an independent axis. **The row showed a filter as inactive that was
actively hiding rows.**

Fixed in step046/047/048. If you add a toggle, its `active` prop reads one
piece of state. Other axes compose with it; they do not cancel it.

### 3. Two axes cannot share one `FacetChips` row.

`FacetChips` has a single `value`. Read-state (All/Unread/Read) and category are
different axes, so read-state went to `ViewHeader`'s `leading` slot as a
`Segmented`. Same for Tasks and Meetings: status is the chip row, Mine/All is
`leading`.

### 4. A panel mounted on many pages must NOT fetch its own list.

`TaskDetailPanel` is mounted on **seven** pages, `MeetingDetailPanel` on
**six**, because those records are openable from every module. Calling
`useTasks()` inside the panel would put a tasks query on the Leads page, which
has no task list and never asked for one.

Both now take `records` — the caller's already-filtered array. `TasksPage` and
`MeetingsPage` pass `filtered`; every other page passes nothing and gets **no
nav arrows**, which is the correct answer because there is no visible list for
the arrows to walk. The invariant from #2 ("nav must walk the caller's filtered
list") is now enforced by the signature rather than by each caller remembering
it.

`ContactDetailPanel` and `OppDetailPanel` still call `useContacts()` /
`useOpportunities()` directly. That is acceptable because each is mounted only
on its own list page and its own record page — but if either ever gets mounted
elsewhere, convert it to the `records` prop first.

### 5. `slate-*` is NOT themed. Use `gray-*`.

`tailwind.config.js` maps exactly two ramps to CSS custom properties:
`gray` (neutral, **inverted wholesale in dark mode**) and `teal` (the accent,
which follows the user's accent preference in Settings → Appearance).

`slate-*` resolves to Tailwind's own fixed palette. 49 of them were in
`ActivityCalendar.jsx` alone, so the dashboard calendar stayed light on a dark
theme and stayed teal under a blue accent. Fixed in step049.

**Chrome is `gray-*`; accent is `teal-*`.** Semantic colours (rose/red for
errors, emerald for done, amber for warning) stay fixed — that matches how
badges work everywhere else and is not a bug.

### 6. Marker counts can match your own comments.

Twice now a marker was chosen that appeared in the prose of the very comment
explaining the change — `hover:-translate-y-0.5` in step045, `slate-*` in
step049 — so the check read a non-zero count on a file that was perfectly
correct.

This is the **third** face of the marker trap, after #2's guessed count and
wrong-tool count. When asserting a string is ABSENT, either reword the comment
or pick a marker that can only occur in a class string (`text-slate-`, not
`slate-`).

The measuring rule is unchanged and still mandatory:

```bash
grep -o -F -- "MARKER" file | wc -l
```

---

## The vocabulary decision that was made

Handover #2 flagged that `'Opportunity'` was in neither `RELATED_TYPES` array
and there were no per-opportunity hooks, so a deal record could not have Tasks
or Meetings tabs.

**Decision taken in step045: extend the vocabulary.** `'Opportunity'` is now in
both arrays, and `useOpportunityMeetings` / `useOpportunityTasks` exist
alongside the lead and contact variants.

This fixed a live data bug. The old deal panel sent `relatedType: 'Lead'` with
an opportunity id for meetings, and `relatedType: 'Meeting'` with an opportunity
id for tasks. Both filed the row against a record that does not exist:
`useLeadMeetings` matches `'Lead'` **and** a lead id, and an opportunity id is
never both — so the meeting appeared on **no record's** list while `/meetings`
displayed it labelled "Lead". A write that succeeds and lands nowhere findable.

**Rows written before step045 are still wrong.** step045 fixes new writes; it
does not migrate old ones. Whether to repair them is an open decision — see
below.

---

## The landmine, now slightly larger

Migration 025 defines a `crm_entity_type` domain —
`'lead','contact','opportunity','task','meeting','email'`, **all lowercase** —
and **deliberately does not attach it to any column**.

The app writes `'Lead'`, `'Contact'`, `'Opportunity'`, `'Meeting'`, `'None'` to
`meetings.related_type` and `tasks.related_type`. step045 added `'Opportunity'`
to that set. `'None'` is not in the domain vocabulary at all.

Nothing breaks today. Whoever attaches that domain breaks every meeting and task
insert simultaneously.

**Still a decision, not a fix.** Normalise the app to lowercase, or extend the
domain to include `'None'` and accept the casing. **Do not attach the domain as
a side effect of anything.**

Note the casing split that already exists and is CORRECT: `email_messages` and
`attachments` want **lowercase** (`'lead'`, `'opportunity'`, `'task'`,
`'meeting'`); `meetings.related_type` and `tasks.related_type` store
**capitalised**. Both casings appear inside a single `<Module>RecordContent.jsx`
on purpose. Check before you copy.

---

## Per-module notes worth knowing

**Contacts** — on React Query, so `ContactRecordPage` reads "not found" from
PostgREST's `PGRST116` via `error.isNotFound` rather than inferring it from an
empty store. Leads is the only module still using the Zustand three-way test
(`!record && !isLoading && all.length > 0`), because `leadsStore` is its own
cache. Moving Leads to React Query would let it use the same clean shape — its
own batch.

**Opportunities** — the three KPI tiles (Value / Probability / Exp. Revenue)
were removed from the record surface. `expectedRevenue` is a generated column
(value × probability), so a tile emphasising it as an independent figure implies
three facts where there are two. Value and Probability are in the badge row,
visible on every tab.

**Tasks** — two tabs only, Timeline and Files. There is no sub-task table, no
task email path, and the meeting relation is single-valued so it is a field.
The "Upcoming" quick tab was removed: `applyQuickTab()` had no branch for it and
`activeQuickTab` could never return it, so it was incapable of highlighting
itself even in principle. Not reimplemented — sorting by the Due column already
answers "what is coming", and a real Upcoming axis needs a new store field and a
decision about N days.

**Meetings** — three tabs, and `CalendarSyncCard` is rendered through
`RecordShell`'s `children` slot (under the fields, **above** the tab bar) on
both the panel and the record page. It is the only caller of the calendar sync
path in this app; burying the sole control that mails invitations behind a tab
would be wrong, and would make the five outstanding VERIFY checks harder than
they already are.

**Notifications** — list only, no record route. A notification is an event, not
a record: nothing links to one, nothing relates to one.

---

## Permission gating — the current, uneven state, and why

| Module | Table | Panel / record | Decision |
|---|---|---|---|
| Leads | gated | gated | pre-existing |
| Opportunities | gated (step044) | gated | applied the module's OWN existing policy to the surface that skipped it |
| Meetings | gated (step048) | gated | same reasoning |
| Contacts | **none** | **none** | preserved — no existing policy to apply |
| Tasks | **none** | **none** | preserved — same |

`getContactPermissions`, `useContactPermissions`, `getTaskPermissions` and
`useBatchTaskPermissions` all exist and **nothing calls them**.

The rule followed throughout: where a module already gated one surface,
extending that gate to the other is applying an existing policy. Where a module
gates nowhere, adding a gate is a **new permissions decision** and must not be
buried in a UI diff.

**Gating Contacts and Tasks in the UI alone would be security theatre**, because
of open item 10 below: 17 write policies are open within an org
(`auth.role() = 'authenticated'` for INSERT/UPDATE/DELETE). Hiding a button does
not close a write path.

**The right batch is RLS + UI together, RLS first.** Target: make RLS mirror
`src/lib/permissions.js` (`canEdit`, `canDelete`, `subordinateNames`) — two
different rule sets will eventually disagree.

**Warning for that batch:** tightening RLS turns working buttons into 403s, and
any form without a `mutation.error` surface will show that as a dead button.
That is the step038 wound exactly. Audit error surfacing before, not after.

---

## What is actually left

### Verification — do this FIRST
1. **The five VERIFY checks have never been run.** Open across eight batches
   now. Create a meeting with an attendee, edit its time, cancel it, send a
   plain email, upload a file to a contact then compose from that contact.
   **Sync is not automatic** — saving a meeting mails nobody. The order is:
   create → open the record surface → **Add to calendar** → edit →
   **Update & notify** → **Cancel event**. `CalendarSyncCard` is the only
   caller, and as of step048 it is on both the panel and `/meetings/:id`.

   Do these BEFORE any RLS work. If they break afterwards you will not know
   whether they were already broken. A working baseline first.

2. **Turn Brave Shields off before attempting them.** The Supabase connection
   from Rezwan's machine shows 20s, 25s and 55s round trips, a request stuck
   Pending, `net::ERR_HTTP2_PING_FAILED` and `getTeamMembers: Failed to fetch`,
   while other requests on the same page return in 200–450ms. A 55-second stall
   during a calendar sync is indistinguishable from a failure.

### Backend
3. **RLS + UI permission batch** for Contacts and Tasks. See the table above.
   Start by dumping current policies:
   `select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' order by tablename, cmd;`
4. **17 open write policies** within an org. Defensible internally; not
   defensible in a Prime Bank or BAT security review, which is the target
   market. Same batch as 3.
5. **Both OAuth client secrets were exposed in a chat transcript and are still
   unrotated.** Rezwan deferred this until the UI work was finished. **The UI
   work is now finished.** Never ask for the values or put them in code.
6. **Google OAuth is still in Testing mode** — 100-user cap, refresh tokens
   expire in 7 days, no second organisation can be onboarded until verification
   completes. Waiting time, not build time.
7. **`crm_entity_type` casing decision.** See the landmine section.
8. **Optional: repair pre-step045 mis-filed rows.** Meetings and tasks written
   against an opportunity id but labelled `'Lead'` / `'Meeting'`. A data
   migration, and a separate decision from the code fix.

### Frontend — small and genuinely optional
9. `src/components/layout/GlobalSearch.jsx` — dead and unimported since step034.
   Safe to delete.
10. `ContactDetailPane_backup.jsx` and `useMeetings_backup.js` — stale backups.
11. Sidebar admin gating reads `user?.role === 'Admin'` from `authStore`, not
    memberships. Left on purpose; it is a permissions change. Fold into batch 3.
12. **Inline field editing is not built.** `RecordField` has the `action` slot
    and the update mutations take partial patches, so the write path exists. It
    needs its own validation and its own error surface — see the step038 lesson.
    Its own batch, and the largest remaining frontend feature.
13. `calendarActivityService.js` and `ActivityCalendar.jsx` still carry private
    copies of `localISODate`. Correct, but should collapse into `lib/dates.js`
    when next touched for another reason — not as a side effect.
14. Filter state is NOT in the URL for Leads, Contacts, Opportunities, Tasks or
    Meetings. Only `?leadOwner` (Lead Overview) and `?owner` (calendar) are, and
    those two are **deliberately separate** — do not unify them. Putting module
    filters in the URL is a real improvement and a real batch.
15. Leads is the last module on a Zustand array rather than React Query. See the
    Contacts note above.

---

## Working method — unchanged, with two hardening fixes

Everything in handover #2's "Working method" still applies: flat filenames plus
a name→path map, never a nested `src\` tree; ready-to-paste PowerShell with real
absolute paths filled in; **every `if`/`else` on ONE line**.

Two things were added after they cost round trips:

**Zip the files FLAT, not inside a folder.** A zip containing `step045/` extracts
to `Downloads\step045\step045\`, and the copy loop then finds nothing.

**The copy block must fail loudly.** The original template had two defects, both
observed:

- `Copy-Item` errors are non-terminating, so the following `Write-Host` printed a
  green "copied" line after every red failure.
- `$count` was not reset per iteration, so a file that could not be read reported
  the **previous** file's count. That happened to fail loudly once; it could just
  as easily have printed `ok`.

Current template — pre-flight existence check, `-ErrorAction Stop`, `$count`
reset, explicit `FILE MISSING`:

```powershell
foreach ($name in $map.Keys) { $from = Join-Path $src $name; if (-not (Test-Path $from)) { throw "MISSING SOURCE: $from" } }

foreach ($name in $map.Keys) { $from = Join-Path $src $name; $to = Join-Path $repo $map[$name]; $dir = Split-Path $to -Parent; if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }; Copy-Item $from $to -Force -ErrorAction Stop; Write-Host "copied  $name  ->  $($map[$name])" -ForegroundColor Green }

$fail = $false
foreach ($m in $markers) { $count = $null; $path = Join-Path $repo $m.File; if (-not (Test-Path $path)) { Write-Host "FAIL    $($m.File) : FILE MISSING" -ForegroundColor Red; $fail = $true; continue }; $text = Get-Content $path -Raw; $count = ([regex]::Matches($text, [regex]::Escape($m.Marker))).Count; if ($count -eq $m.Expect) { Write-Host "ok      $($m.File) : $($m.Marker) = $count" -ForegroundColor Green } else { Write-Host "FAIL    $($m.File) : $($m.Marker) = $count, expected $($m.Expect)" -ForegroundColor Red; $fail = $true } }
```

**Deliver the git sequence as its own code block**, never described in prose:

```powershell
cd "C:\Users\Ashraf Nabil\Downloads\accord-crm-complete\accord-crm-main"
npm run build
git add -A
git status --short
git commit -m "stepNNN: …"
git push
git log origin/main --oneline -1
```

`git log origin/main`, **not** plain `git log` — the plain one shows the local
branch and looks correct while nothing has left the machine.

### PUSHED IS NOT DEPLOYED — new, and it cost a whole session

Handover #2 says "committed and pushed is not applied" about SQL and Edge
Functions. **It is also true of the frontend.**

After step044 the code on `origin/main` was correct and the live site was still
serving the pre-step044 build: the old heading block, the eight KPI cards, no
Lost chip. Two rounds of debugging went into reading the code before anyone
checked Vercel.

**After every push, confirm the Vercel deployment shows the new commit hash and
is Ready.** A local `npm run build` passing does not mean Vercel's will — the
build environments differ (case-sensitive filesystem, different Node version).

---

## The pattern that keeps repeating

Most bugs in this project surfaced only by **using the app** — not by any SQL
check, type check or build. "It compiles", "the page loads", "the feature works"
and "the deployment is live" are four different claims.

**After every batch, name the two or three interactions most likely to be wrong
and check those.** For the record-surface work:

- the row click still opens the panel
- an inline control in a cell (Leads' stage select, Tasks' completion checkbox)
  does not ALSO open the panel — `stopPropagation` on the **wrapper div**
- a pasted record URL in a **fresh tab** resolves without flashing "not found"
- record-nav arrows stay inside the filtered set, and are ABSENT where the
  caller passes no list
- a shared component extracted this batch still looks identical in the module it
  came from

And: **when something appears to do nothing, get the actual error before
theorising.** Network tab → the failing request → **Response**. PostgREST
returns `message`, `details`, `hint`, `code`. If the form cannot show the error,
**fix that first** — the fix is also the diagnostic.
