-- ═══════════════════════════════════════════════════════════════════════════
-- 006 — ACTIVITIES
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : 6 of 15
-- DEPENDS ON: nothing (fully standalone table)
-- SOURCE    : supabase/activities_migration.sql
--
-- Append-only event log. Every significant CRM action writes one row here via
-- src/services/activityService.js logActivity() and src/services/timelineService.js.
-- The services never UPDATE or DELETE activity rows — the final policy set
-- (file 013) therefore exposes SELECT and INSERT only.
--
-- IMPORTANT — actor_id and metadata are deliberately NOT declared here.
--   actor_id TEXT  is added by file 007 (ownership)
--   metadata JSONB is added by file 012 (timeline)
-- This preserves the original migration history. See file 007 for the full
-- explanation of why actor_id must be TEXT and never UUID.
--
-- RLS NOTE: the blanket FOR ALL policy here is interim — file 009 narrows it,
-- and file 013 replaces it with the final entity-scoped policy.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.activities (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event type — values mirror activityService.ACTIVITY_TYPES and
  -- timelineService.TIMELINE_TYPES
  type            TEXT        NOT NULL,

  -- Denormalised human-readable summary so the feed needs no joins
  actor           TEXT        NOT NULL DEFAULT '',   -- who did it
  action          TEXT        NOT NULL DEFAULT '',   -- verb phrase
  subject         TEXT        NOT NULL DEFAULT '',   -- the target
  detail          TEXT                 DEFAULT '',   -- extra context

  -- Soft links back to the source record — intentionally no FK constraints.
  -- entity_id is TEXT because the services write String(entityId).
  entity_type     TEXT,          -- 'lead'|'opportunity'|'task'|'meeting'|'contact'
  entity_id       TEXT,
  entity_label    TEXT,

  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row Level Security (interim — superseded by files 009 and 013) ─────────
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access activities"
  ON public.activities
  FOR ALL
  USING      (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── Indexes ────────────────────────────────────────────────────────────────
-- Timeline sort is always occurred_at DESC
CREATE INDEX activities_occurred_at_idx ON public.activities (occurred_at DESC);
-- Entity filtering (e.g. all activities for one lead)
CREATE INDEX activities_entity_idx      ON public.activities (entity_type, entity_id);
-- Type filtering (e.g. all task_completed events)
CREATE INDEX activities_type_idx        ON public.activities (type);
