-- ═══════════════════════════════════════════════════════════════════════════
-- 012 — TIMELINE / NOTES
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : 12 of 15
-- DEPENDS ON: 006 (activities), 007 (activities.actor_id must already exist)
-- SOURCE    : supabase/timeline_patch.sql
--
-- Extends public.activities for the unified timeline system used by
-- src/services/timelineService.js and src/components/timeline/*.
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ CHANGE FROM THE ORIGINAL — actor_id is NOT touched here.                │
-- │                                                                          │
-- │ The original timeline_patch.sql contained:                              │
-- │     ALTER TABLE public.activities                                        │
-- │       ADD COLUMN IF NOT EXISTS actor_id UUID DEFAULT NULL;               │
-- │                                                                          │
-- │ That statement is REMOVED. It declared the wrong type, and because it    │
-- │ used IF NOT EXISTS it either silently did nothing (if ownership_patch    │
-- │ ran first) or silently created a UUID column that broke every RLS        │
-- │ policy comparing actor_id = auth.uid()::text.                            │
-- │                                                                          │
-- │ actor_id is now declared exactly once, as TEXT, in file 007.             │
-- │                                                                          │
-- │ The duplicate CREATE INDEX activities_actor_id_idx is removed for the    │
-- │ same reason: file 007 already creates an index of that exact name, so    │
-- │ the original's partial variant here was silently never created.          │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- ACTIVITY TYPES ADDED BY THE TIMELINE FEATURE (stored in activities.type):
--   note_added           Internal note on any entity
--   followup_logged      Completed follow-up (call/email/visit/demo)
--   followup_scheduled   Planned next follow-up date/action
--   meeting_note_added   Post-meeting summary with decisions + next actions
--
-- metadata JSONB PAYLOAD SHAPES (written by timelineService.js):
--   note_added         { body, visibility }
--   followup_logged    { followupType, outcome, nextFollowupDate }
--   followup_scheduled { followupType, scheduledDate, notes }
--   meeting_note_added { summary, decisions, nextActions, attendees }
-- ═══════════════════════════════════════════════════════════════════════════

-- ── metadata column ────────────────────────────────────────────────────────
ALTER TABLE public.activities
  ADD COLUMN metadata JSONB DEFAULT '{}';

-- ── Indexes ────────────────────────────────────────────────────────────────
-- GIN index for future JSON queries (e.g. find all overdue follow-ups).
-- Partial so the default '{}' rows are excluded and the index stays small.
CREATE INDEX activities_metadata_gin_idx
  ON public.activities USING GIN (metadata)
  WHERE metadata <> '{}';

-- Fast "all notes for entity X" queries — timelineService filters on
-- entity_type + entity_id + type together.
CREATE INDEX activities_entity_type_composite_idx
  ON public.activities (entity_type, entity_id, type);


-- ───────────────────────────────────────────────────────────────────────────
-- CONVENIENCE VIEW: timeline_events
-- ───────────────────────────────────────────────────────────────────────────
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ SECURITY CHANGE — security_invoker = true                               │
-- │                                                                          │
-- │ The original view was created without this option. PostgreSQL views      │
-- │ default to security_invoker = false, meaning the view executes as its    │
-- │ OWNER (postgres) and therefore BYPASSES row level security on           │
-- │ public.activities. Combined with the GRANT below, that let any signed-in │
-- │ user read every activity row in the system, defeating the entire         │
-- │ entity-scoped policy installed by file 013.                              │
-- │                                                                          │
-- │ With security_invoker = true the view executes with the permissions of   │
-- │ the CALLING user, so the activities RLS policies apply exactly as the    │
-- │ original file's comment claimed they already did. This preserves the     │
-- │ intended behaviour and closes the hole.                                  │
-- │                                                                          │
-- │ REQUIRES PostgreSQL 15 or newer. All current Supabase projects qualify.  │
-- │ Verify with: SHOW server_version;                                        │
-- │                                                                          │
-- │ No code in src/ references this view — it exists for dashboard           │
-- │ exploration and future automation only. It is retained (rather than      │
-- │ dropped) so behaviour matches the old project.                           │
-- └─────────────────────────────────────────────────────────────────────────┘
CREATE VIEW public.timeline_events
WITH (security_invoker = true) AS
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

GRANT SELECT ON public.timeline_events TO authenticated;
