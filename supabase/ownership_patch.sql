-- ─── Accord CRM — Ownership Columns Patch ─────────────────────────────────────
--
-- Adds created_by (display name TEXT) and owner_id (UUID soft-ref) to
-- leads, meetings, and tasks. Adds actor_id to activities.
--
-- Run AFTER the original table migration scripts.
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS.
--
-- Why TEXT for created_by / owner_id stored as text?
-- ────────────────────────────────────────────────────
-- The app currently uses display-name strings for assignee/organizer.
-- owner_id stores the Supabase auth.users UUID when available, but is
-- nullable so existing rows are not broken.
-- A full FK constraint can be added later once user management is in place.

-- ── Leads ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS created_by  TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS owner_id    TEXT    DEFAULT NULL;   -- Supabase user UUID

-- ── Meetings ──────────────────────────────────────────────────────────────────
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS created_by  TEXT    DEFAULT '';

-- ── Tasks ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS created_by  TEXT    DEFAULT '';

-- ── Activities ────────────────────────────────────────────────────────────────
-- actor_id allows future filtering of "my activity" and RBAC audit trails
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS actor_id    TEXT    DEFAULT NULL;   -- Supabase user UUID

-- ── Indexes for the new columns ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS leads_owner_idx        ON public.leads     (owner_id);
CREATE INDEX IF NOT EXISTS leads_created_by_idx   ON public.leads     (lower(created_by));
CREATE INDEX IF NOT EXISTS activities_actor_id_idx ON public.activities (actor_id);
