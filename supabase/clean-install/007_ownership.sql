-- ═══════════════════════════════════════════════════════════════════════════
-- 007 — OWNERSHIP COLUMNS
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : 7 of 15
-- DEPENDS ON: 003 (leads), 004 (tasks), 005 (meetings), 006 (activities)
-- SOURCE    : supabase/ownership_patch.sql
--
-- Adds the ownership and attribution columns that the RBAC policies in files
-- 009, 010 and 013 read. Nothing else in the package works without this file.
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ CRITICAL — activities.actor_id MUST BE TEXT                             │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ In the original repository two files added this same column with two    │
-- │ different types, and whichever ran first won silently:                  │
-- │                                                                          │
-- │   ownership_patch.sql  →  actor_id TEXT   ← correct                     │
-- │   timeline_patch.sql   →  actor_id UUID   ← wrong                       │
-- │                                                                          │
-- │ TEXT is the only correct type, for three independent reasons:           │
-- │   1. activityService.logActivity() writes String(actorId)               │
-- │   2. The RLS policies in files 009 and 013 compare                      │
-- │        actor_id = auth.uid()::text                                      │
-- │      A UUID column makes that expression fail at policy-creation time   │
-- │      with: operator does not exist: uuid = text                         │
-- │   3. leads.owner_id and opportunities.owner_id use the same TEXT        │
-- │      convention, so the codebase is internally consistent               │
-- │                                                                          │
-- │ In this package the column is declared exactly once, here, as TEXT.     │
-- │ File 012 no longer touches it.                                          │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- Why owner_id is TEXT rather than a UUID foreign key:
-- the app stores display-name strings for assignee/organizer and writes the
-- auth UUID into owner_id only when available. It is nullable so historical
-- rows are never broken. A real FK can be added later once every row is
-- backfilled — that is a deliberate deferral from the original design and is
-- preserved here unchanged.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Leads ──────────────────────────────────────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN created_by  TEXT DEFAULT '',
  ADD COLUMN owner_id    TEXT DEFAULT NULL;   -- Supabase auth.users UUID as TEXT

-- ── Meetings ───────────────────────────────────────────────────────────────
ALTER TABLE public.meetings
  ADD COLUMN created_by  TEXT DEFAULT '';

-- ── Tasks ──────────────────────────────────────────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN created_by  TEXT DEFAULT '';

-- ── Activities ─────────────────────────────────────────────────────────────
-- The single, canonical definition of actor_id. TEXT. See the box above.
ALTER TABLE public.activities
  ADD COLUMN actor_id    TEXT DEFAULT NULL;   -- Supabase auth.users UUID as TEXT

-- ── Indexes for the new columns ────────────────────────────────────────────
CREATE INDEX leads_owner_idx         ON public.leads      (owner_id);
CREATE INDEX leads_created_by_idx    ON public.leads      (lower(created_by));
CREATE INDEX activities_actor_id_idx ON public.activities (actor_id);
