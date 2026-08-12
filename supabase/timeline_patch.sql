-- ─── Accord CRM — Timeline / Notes Patch ──────────────────────────────────────
--
-- Extends the existing `activities` table for the unified timeline system.
-- Run AFTER: activities_migration.sql
-- Safe to re-run: all statements use IF NOT EXISTS.
--
-- New activity types added by this patch (stored in the `type` column):
-- ──────────────────────────────────────────────────────────────────────
--   note_added           Internal note on any entity
--   followup_logged      Completed follow-up (call/email/visit/demo)
--   followup_scheduled   Planned next follow-up date/action
--   meeting_note_added   Post-meeting summary with decisions + next actions
--
-- metadata JSONB payload shapes
-- ─────────────────────────────
--   note_added:
--     { "body": "...", "visibility": "internal"|"shared" }
--
--   followup_logged:
--     { "followupType": "Call"|"Email"|"Visit"|"Demo"|"Meeting"|"Other",
--       "outcome": "...",
--       "nextFollowupDate": "YYYY-MM-DD"|null }
--
--   followup_scheduled:
--     { "followupType": "...", "scheduledDate": "YYYY-MM-DD", "notes": "..." }
--
--   meeting_note_added:
--     { "summary": "...", "decisions": "...", "nextActions": "...",
--       "attendees": ["Name1", "Name2"] }

-- ── Add metadata JSONB column ─────────────────────────────────────────────────
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS metadata  JSONB DEFAULT '{}';

-- ── Add actor_id column (links to auth.users UUID, stored as UUID) ────────────
-- May already exist from ownership_patch.sql — IF NOT EXISTS handles this.
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS actor_id  UUID  DEFAULT NULL;

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- GIN index on metadata for future JSON queries (e.g. find all overdue follow-ups)
CREATE INDEX IF NOT EXISTS activities_metadata_gin_idx
  ON public.activities USING GIN (metadata)
  WHERE metadata <> '{}';

-- Actor lookups (note author, follow-up logger)
CREATE INDEX IF NOT EXISTS activities_actor_id_idx
  ON public.activities (actor_id)
  WHERE actor_id IS NOT NULL;

-- Fast entity + type queries (e.g. "all notes for lead X")
CREATE INDEX IF NOT EXISTS activities_entity_type_composite_idx
  ON public.activities (entity_type, entity_id, type);

-- ── Convenience view: full timeline for any entity ────────────────────────────
-- Returns all columns ordered newest-first.
-- Components call getTimelineForEntity() which queries activities directly,
-- but this view is useful for Supabase dashboard exploration and future
-- automation/webhook triggers.
CREATE OR REPLACE VIEW public.timeline_events AS
SELECT
  id,
  type,
  actor,
  actor_id,
  action,
  subject,
  detail,
  entity_type,
  entity_id,
  entity_label,
  metadata,
  occurred_at
FROM public.activities
ORDER BY occurred_at DESC;

-- Grant SELECT on the view to authenticated role
-- (inherits the activities RLS policies automatically for underlying table access)
GRANT SELECT ON public.timeline_events TO authenticated;
