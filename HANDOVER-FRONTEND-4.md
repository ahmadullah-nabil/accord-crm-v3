# Accord CRM — Frontend Redesign Handover #4

**Written 13 August 2026.** Continues `HANDOVER-FRONTEND-3.md` (step043–049),
`HANDOVER-FRONTEND-2.md` (step037–042) and `HANDOVER-FRONTEND.md` (step033–036).
The repo's `HANDOVER.md` (backend, database, Edge Functions, integrations) is
still accurate for all of that.

This file covers **step050 through step056** and supersedes #3's "Where the
redesign stands" and "What is actually left". Everything else in #3 still
holds — every invariant, the landmine, the permission table, the working
method and the five VERIFY checks are unchanged and still outstanding.

If you are an assistant picking this up in a fresh conversation: read this
file, **then clone the repo and read the actual code.** Claims in #1, #2 and #3
turned out to be wrong when checked against the running system, and at least
one claim in this file will too.

---

## Start here

```
Repo:      https://github.com/ahmadullah-nabil/accord-crm-v3   (public — clone it)
Live:      https://accord-crm-v3.vercel.app
Supabase:  gopcrwrprpfcieljdyjt   — project "Accord CRM (Clone)"
Local:     C:\Users\Ashraf Nabil\Downloads\accord-crm-complete\accord-crm-main
```

**The module redesign is still COMPLETE** — that has not changed since #3.
step050–056 were cleanup, then a dashboard rebuild, then Analytics. What is
left is backend and verification, plus the small frontend list at the bottom.

---

## Where things stand

| Batch | What | Status |
|---|---|---|
| step033–049 | See handovers #1–#3 | applied, live |
| step050 | Remaining fixed-ramp colours onto themed `gray`; delete three dead files | applied |
| step051 | Calendar density pass 1 — flat item rows, 76px cells | applied |
| step052 | Calendar density pass 2 — 56px cells, two items, unmount `LeadOverview` | applied |
| step053 | Month grid becomes a DOT calendar; remove the Overview tab | applied |
| step054 | Single-page dashboard: figures → pipeline → month → recent deals | applied |
| step055 | Dashboard fills the viewport; `AppLayout` passes height down | applied |
| step056 | Analytics into four gated sections; `{ enabled }` on all nine hooks | pending |

---

## New invariants — added since #3

In addition to every invariant in #2 and #3, all of which still hold.

### 1. `slate-` matches `translate-`. The marker trap has a FOURTH face.

step050 opened with a claim that ~70 `slate-*` classes were spread across 23
files. The real number was 40 across 5. Nearly every extra hit was
`-translate-y-1/2` on an input icon: the substring `slate-` sits inside
`translate-`.

This is the same family as #3's three faces (guessed count, wrong tool,
marker matching its own comment) and it is the most dangerous, because the
count is plausible and the file list looks right.

**When asserting a colour class, the marker is `-slate-`** — a hyphen
immediately before. `translate-` cannot produce it (the character before
`slate-` there is `n`). Every `<prop>-slate-<n>` form does.

### 2. A tuned number is not a layout. Pass the height down instead.

Four batches picked a cell height — 112 → 76 → 56 → 40 — and each one was
arithmetic against an assumed viewport. Every one of them was defeated on the
real machine by a bookmarks bar plus page zoom, which together cost more than
all four passes saved.

step055 stopped guessing. `AppLayout`'s content wrapper now carries `h-full`,
so a page can ask for "the height that is left"; `DashboardPage` is
`h-full flex flex-col`; the chrome bands are `shrink-0` and the calendar is
the single band that flexes. The month grid is `grid-rows-6` at full height,
so rows divide what is left, and the agenda rail scrolls between its own
header and footer with no cap at all.

**If a page must fit a viewport, exactly one region flexes and everything else
is `shrink-0`.** Do not reintroduce a `max-h-[Npx]` on the rail or a fixed
cell height — those are the thing that failed.

`AppLayout`'s `h-full` is the one edit in these batches that touches all
eleven routes. It is safe (the div has no background, border or overflow of
its own, and `<main>` still scrolls) but it is the first thing to suspect if
another page's layout looks wrong.

### 3. `gray-900` is NOT a dark colour. Overlays use `black`.

The neutral ramp is inverted wholesale in dark mode, so `gray-900` resolves to
near-white there. Two modal scrims were `bg-slate-900/60`; rewriting them to
`gray-900` would have made the scrim **light the page up** instead of dimming
it. They are `bg-black/40 backdrop-blur-sm` now, matching the Lead / Contact /
Opportunity modals. `black` is deliberately not remapped in
`tailwind.config.js`.

### 4. A cell that must hold a title has a floor. Dots do not.

Three padding passes on the month grid failed for one reason: a legible title
needs about 70px of cell, and 42 of those is always most of a screen. step053
changed the shape instead — the grid renders a day number and up to three
status dots, and the agenda rail beside it carries titles and times.

**Division of labour: the grid answers WHICH DAYS, the rail answers WHAT IS
ON.** Both read the same `byDate`, so they cannot disagree. Do not put item
text back in the cells.

Create moved with the items. There is no room for a hover `+` at 40px, so
clicking any date — including an empty one — selects it and the rail switches
to that day and offers its own `+`. One create path, and the empty-Thursday
case still works. `CreateMenu` is now reached only from the rail.

### 5. Unmount before you delete.

step052/053/054 took `LeadOverview`, the whole Overview tab, `KpiCard`,
`RevenueChart`, `PipelineFunnel`, `ActivityTimeline`, `TopPerformers`,
`LeadsChart`, `MyWorkspace` and `QuickActions` off the dashboard. **None of
those files were deleted.** They sit in the repo unimported, along with
`hooks/useDashboard.js`'s four now-unused queries.

Unmounting is reversible and deleting is not. If they are still unimported in
a month, that is the evidence for removing them — as its own batch, never as a
side effect of another one.

### 6. The gate goes on the QUERY, not the render.

Stated in #3 for the dashboard; step056 hit it again on Analytics, which
called nine hooks unconditionally and drew eleven charts in one column. A hook
fetches wherever it is called — a condition around the JSX stops the markup
and nothing else.

`useAnalytics.js` now takes `{ enabled }` on all nine hooks, defaulting to
`true` so no existing call site changed. `AnalyticsPage` gates them by section.

---

## What changed on the Dashboard, and why it is worth knowing

The Today/Overview tab strip is gone, and with it the `?tab` param. The page is
four bands:

1. **Figures** — four tiles: pipeline value, revenue, active leads, deals won.
2. **Pipeline strip** — lead stage counts, 44px. Clicking a stage deep-links
   into Leads.
3. **The calendar** — `ActivityCalendar`, the one band that flexes.
4. **Recent deals** — five opportunities, capped and internally scrollable.

Three things about it that are easy to undo by accident:

**The figures are the ones `getKpiSummary` actually returns.** There is no
"open deals" and no "won this month" in that service. Do not relabel
`activeLeads` into a figure it is not.

**There are no trend arrows.** Every `trend` the service returns is hardcoded
`0`. An arrow would be decoration claiming to be data.

**The stage link goes through the leads STORE, not a URL param.** `LeadsPage`
reads no search params at all, so `navigate('/leads?stage=Qualified')` lands on
an unfiltered list *while looking like a filter was applied*. The call is
`clearFilters()` → `setStageFilter(stage)` → `navigate('/leads')`, which is what
the old `LeadOverview` did. The string `/leads?stage=` appears exactly once in
`DashboardPage.jsx`, inside the comment warning about it — that is the marker.

`?leadOwner` is dead now that `LeadOverview` is unmounted. **Do not reuse the
name for the calendar's `?owner`.** They were deliberately separate, and
reusing it would resurrect the bug the day anyone remounts the widget.

---

## What changed on Analytics (step056)

Eleven charts in one column became four sections behind a `Segmented`:
Overview (kpi, revenue, funnel), Leads (leads, sources), Activity (tasks,
meetings), Team (team, activity). A visit now costs two or three queries
instead of nine.

- **Section is in the URL (`?section=`); the range is not.** The range already
  lives in `analyticsStore` and is shared; putting it in the URL too would give
  one value two owners — the `?leadOwner` / `?owner` tangle again.
- **`ViewHeader` was deliberately NOT used.** It is the list primitive: its
  shape is `title · count of total` and it renders the count unconditionally.
  Analytics has no rows to count. Two `Segmented` controls on one line is the
  same visual language without pretending the page is a list.
- **Every chart component is untouched.** This batch moved them and stopped
  fetching for the ones you cannot see. It did not restyle a single axis or
  legend — those are their own files and their own batch, and they are the
  obvious next piece of frontend work if you want one.

---

## Still true from #3, still not done

Repeated here because they are the actual remaining risk, not because anything
about them changed.

1. **The five VERIFY checks have never been run.** Create a meeting with an
   attendee → open the record surface → **Add to calendar** → edit →
   **Update & notify** → **Cancel event**; send a plain email; upload a file to
   a contact then compose from that contact. Sync is not automatic —
   `CalendarSyncCard` is the only caller, and it is on both the panel and
   `/meetings/:id`. **Turn Brave Shields off first**; the Supabase connection
   from Rezwan's machine shows 20s/25s/55s round trips. Do these BEFORE any RLS
   work, so a failure afterwards is attributable.
   `canSyncToCalendar` requires a date, a time, and `organizerId === your own
   user id` — create the test meeting yourself or the button is correctly
   disabled and it will look like a bug.
2. **RLS + UI permission batch** for Contacts and Tasks. `getContactPermissions`,
   `useContactPermissions`, `getTaskPermissions`, `useBatchTaskPermissions` all
   exist and nothing calls them. RLS first, mirroring `src/lib/permissions.js`.
   Audit error surfacing BEFORE tightening — a 403 in a form with no
   `mutation.error` surface is a dead button, which is the step038 wound.
3. **17 open write policies** within an org. Same batch as 2.
4. **Both OAuth client secrets were exposed in a chat transcript and are still
   unrotated.** Deferred until the UI work was finished; it has been finished
   since step049. Never ask for the values or put them in code.
5. **Google OAuth is still in Testing mode** — 100-user cap, refresh tokens
   expire in 7 days. If the connection is older than a week, reconnect before
   attempting the calendar checks or the first one fails with an `invalid_grant`
   that reads exactly like a code bug.
6. **`crm_entity_type` casing decision.** Migration 025's domain is lowercase
   and deliberately unattached; the app writes capitalised plus `'None'`.
   Attaching it breaks every meeting and task insert at once.
7. **Optional: repair pre-step045 mis-filed rows** — meetings and tasks written
   against an opportunity id but labelled `'Lead'` / `'Meeting'`.

### Frontend — small and genuinely optional

8. **Inline field editing is not built.** `RecordField` has the `action` slot
   and the update mutations take partial patches, so the write path exists. It
   needs its own validation and its own error surface. Largest remaining
   frontend feature, and its own batch.
9. **Filter state is not in the URL** for Leads, Contacts, Opportunities, Tasks
   or Meetings. Analytics' `?section` and the calendar's `?owner` are; the
   modules are not. A real improvement and a real batch.
10. **Leads is the last module on a Zustand array** rather than React Query.
    Moving it lets `LeadRecordPage` use the clean `error.isNotFound` shape
    Contacts has instead of the three-way empty-store test.
11. **Sidebar admin gating** reads `user?.role === 'Admin'` from `authStore`,
    not memberships. Fold into batch 2.
12. **`calendarActivityService.js` and `ActivityCalendar.jsx`** still carry
    private copies of `localISODate`. Collapse into `lib/dates.js` when next
    touched for another reason — not as a side effect.
13. **The unmounted dashboard components** (see invariant 5). Delete only after
    they have been unimported for a while, and only as their own batch.
14. **The analytics chart components themselves** have not been through the
    redesign. Axes, legends and tooltips are as they were. Obvious next batch
    if frontend work is wanted.

---

## Working method — unchanged

Everything in #2 and #3 still applies: flat filenames plus a name→path map,
never a nested `src\` tree; ready-to-paste PowerShell with real absolute paths;
**every `if`/`else` on ONE line**; zip the files FLAT; the copy block
pre-flights with `Test-Path`, uses `-ErrorAction Stop`, and resets `$count` per
iteration.

The measuring rule is unchanged and still mandatory:

```bash
grep -o -F -- "MARKER" file | wc -l
```

**Pick markers that can only occur in a class string, and check them against
your own comments before shipping.** Two markers in these batches were chosen
well by accident and one (`slate-`) was chosen badly on purpose. A useful trick
that worked repeatedly: when every file in a batch currently contains the
string you are removing, `Expect = 0` proves the copy landed *and* proves the
edit is complete, in one check.

**PUSHED IS NOT DEPLOYED.** Confirm the Vercel deployment shows the new commit
hash and is Ready. A local `npm run build` passing does not mean Vercel's will.

---

## The pattern that keeps repeating

Unchanged from #3, and reinforced twice more in these batches:

**Most bugs here surface only by USING the app.** step050's wrong file count
survived a grep. step051–054's height arithmetic survived every build and was
wrong on the first screenshot. "It compiles", "the page loads", "the feature
works" and "the deployment is live" are four different claims.

And a new one, earned three times over in these batches:

**When a number has to be tuned twice, the shape is wrong.** Three density
passes on the calendar cells and two on the page height all failed the same
way. The fixes that worked — dots instead of chips, flex instead of fixed
heights — each removed the number entirely.
