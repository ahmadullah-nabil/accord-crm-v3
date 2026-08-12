-- ═══════════════════════════════════════════════════════════════════════════
-- 011 — NOTIFICATIONS
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : 11 of 15
-- DEPENDS ON: Supabase built-in auth.users only
--             (independent of every other file in this package)
-- SOURCE    : supabase/notifications_migration.sql
--
-- Column names match the toApp() / toDb() mappers in
-- src/services/notificationsService.js.
--
-- Its RLS model is per-user ownership, not the role hierarchy: a user reads,
-- updates and deletes only their own rows. All four policies are final.
--
-- REQUIRES MANUAL DASHBOARD STEP — Realtime replication must be enabled on
-- this table. notificationsService.subscribeToNotifications() opens the
-- channel `notifications:user:{userId}`; without replication the notification
-- bell will never update live. See README section "Manual configuration".
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient — the user who sees this notification
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Who triggered it (display name denormalised for quick read)
  actor         TEXT        DEFAULT '',
  actor_id      UUID,       -- soft reference to profiles.id; no FK

  -- category: 'Assignments'|'Tasks'|'Meetings'|'Deals'|'Leads'|'System'
  category      TEXT        NOT NULL DEFAULT 'System',
  -- type: 'lead_assigned'|'task_assigned'|'task_overdue'|'meeting_scheduled'
  --       |'opportunity_stage_changed'|'opportunity_stale'|'lead_inactive'|...
  type          TEXT        NOT NULL,

  title         TEXT        NOT NULL DEFAULT '',
  body          TEXT        DEFAULT '',

  -- Soft link back to the source record
  entity_type   TEXT,       -- 'lead'|'task'|'meeting'|'opportunity'|'contact'
  entity_id     UUID,

  is_read       BOOLEAN     NOT NULL DEFAULT FALSE,
  is_pinned     BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Extra payload for future extensibility
  metadata      JSONB       DEFAULT '{}',

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row Level Security (final) ─────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Notification creation is triggered on behalf of other users, so INSERT is
-- open to any authenticated session rather than restricted to the recipient.
CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX notif_user_id_idx    ON public.notifications (user_id);
CREATE INDEX notif_is_read_idx    ON public.notifications (user_id, is_read);
CREATE INDEX notif_created_at_idx ON public.notifications (created_at DESC);
CREATE INDEX notif_entity_idx     ON public.notifications (entity_type, entity_id);
CREATE INDEX notif_type_idx       ON public.notifications (type);
