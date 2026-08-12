-- ═══════════════════════════════════════════════════════════════════════════
-- 005 — MEETINGS
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : 5 of 15
-- DEPENDS ON: nothing (fully standalone table)
-- SOURCE    : supabase/meetings_migration.sql
--
-- Column names match the toApp() / toDb() mappers in
-- src/services/meetingsService.js.
--
-- Meetings have no owner_id — visibility is resolved by display name via
-- organizer / participants / created_by. created_by is added by file 007.
--
-- RLS NOTE: the blanket FOR ALL policy here is interim — file 009 replaces it.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.meetings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  title           TEXT        NOT NULL,
  description     TEXT                    DEFAULT '',

  -- Must match MEETING_STATUSES / MEETING_TYPES in src/lib/meetingsData.js
  -- ('Scheduled'|'Completed'|'Cancelled'|'Rescheduled')
  status          TEXT        NOT NULL    DEFAULT 'Scheduled',
  type            TEXT        NOT NULL    DEFAULT 'Discovery',

  -- scheduled_date maps to app scheduledDate ('2026-05-13')
  -- scheduled_time maps to app scheduledTime ('10:00')
  scheduled_date  DATE,
  scheduled_time  TIME,
  duration_mins   INTEGER                 DEFAULT 60,

  location        TEXT                    DEFAULT '',
  location_url    TEXT                    DEFAULT '',

  -- People: organizer and participants are display-name strings
  organizer       TEXT                    DEFAULT '',
  participants    TEXT[]                  DEFAULT '{}',

  -- Related entity (Lead or Contact) — soft link, no FK
  related_type    TEXT                    DEFAULT 'None',
  related_id      TEXT                    DEFAULT '',
  related_label   TEXT                    DEFAULT '',

  notes           TEXT                    DEFAULT '',
  tags            TEXT[]                  DEFAULT '{}',

  created_at      DATE        NOT NULL    DEFAULT CURRENT_DATE
);

-- ── Row Level Security (interim — superseded by file 009) ──────────────────
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access meetings"
  ON public.meetings
  FOR ALL
  USING      (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX meetings_scheduled_date_idx ON public.meetings (scheduled_date ASC NULLS LAST);
CREATE INDEX meetings_status_idx         ON public.meetings (status);
CREATE INDEX meetings_type_idx           ON public.meetings (type);
CREATE INDEX meetings_organizer_idx      ON public.meetings (lower(organizer));
CREATE INDEX meetings_created_at_idx     ON public.meetings (created_at DESC);
