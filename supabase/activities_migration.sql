-- ─── Accord CRM — Activities Table Migration ──────────────────────────────────
--
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS throughout.
--
-- Every significant CRM action writes a row here.
-- Activities are append-only; never update or delete rows.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.activities (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The type of event
  -- Allowed values mirror activityService.ACTIVITY_TYPES
  type            TEXT        NOT NULL,

  -- Human-readable summary (stored so the feed doesn't need joins)
  actor           TEXT        NOT NULL DEFAULT '',   -- who did it  (e.g. 'Alex Rivera')
  action          TEXT        NOT NULL DEFAULT '',   -- verb phrase (e.g. 'created lead')
  subject         TEXT        NOT NULL DEFAULT '',   -- the target  (e.g. 'GreenTech BD')
  detail          TEXT                  DEFAULT '',  -- extra context

  -- Optional links back to source records (no FK constraints — soft refs)
  entity_type     TEXT,          -- 'lead' | 'meeting' | 'task'
  entity_id       TEXT,          -- UUID of the source record
  entity_label    TEXT,          -- human-readable name of the source

  -- Timestamp
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row Level Security ─────────────────────────────────────────────────────────
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can access activities" ON public.activities;

CREATE POLICY "Authenticated users can access activities"
  ON public.activities
  FOR ALL
  USING     (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── Indexes ────────────────────────────────────────────────────────────────────
-- Timeline sort is always occurred_at DESC
CREATE INDEX IF NOT EXISTS activities_occurred_at_idx ON public.activities (occurred_at DESC);
-- For filtering by entity (e.g. all activities for a specific lead)
CREATE INDEX IF NOT EXISTS activities_entity_idx      ON public.activities (entity_type, entity_id);
-- For filtering by type (e.g. all task_completed events)
CREATE INDEX IF NOT EXISTS activities_type_idx        ON public.activities (type);

-- ── Verify ─────────────────────────────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'activities' ORDER BY ordinal_position;
