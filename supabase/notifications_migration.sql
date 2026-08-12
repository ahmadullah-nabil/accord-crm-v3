-- ─── Accord CRM — Notifications Table ────────────────────────────────────────
--
-- Run AFTER: profiles_foundation.sql
-- Safe to re-run: uses IF NOT EXISTS throughout.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient (the user who sees this notification)
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Who triggered the notification (display name, for quick read)
  actor         TEXT        DEFAULT '',
  actor_id      UUID,       -- soft ref to profiles.id

  -- Classification
  -- category: 'Assignments' | 'Tasks' | 'Meetings' | 'Deals' | 'Leads' | 'System'
  category      TEXT        NOT NULL DEFAULT 'System',
  -- type: 'lead_assigned' | 'task_assigned' | 'task_overdue' | 'meeting_scheduled'
  --        'opportunity_stage_changed' | 'opportunity_stale' | 'lead_inactive' | ...
  type          TEXT        NOT NULL,

  -- Human-readable content
  title         TEXT        NOT NULL DEFAULT '',
  body          TEXT        DEFAULT '',

  -- Soft link back to source record
  entity_type   TEXT,       -- 'lead' | 'task' | 'meeting' | 'opportunity' | 'contact'
  entity_id     UUID,       -- UUID of the source record

  -- State
  is_read       BOOLEAN     NOT NULL DEFAULT FALSE,
  is_pinned     BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Arbitrary extra payload (JSON) for future extensibility
  metadata      JSONB       DEFAULT '{}',

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Any authenticated user can insert (notification creation is server-side)
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Users can update (read/pin) only their own notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete only their own notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS notif_user_id_idx     ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS notif_is_read_idx     ON public.notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS notif_created_at_idx  ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS notif_entity_idx      ON public.notifications (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS notif_type_idx        ON public.notifications (type);
