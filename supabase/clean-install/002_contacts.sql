-- ═══════════════════════════════════════════════════════════════════════════
-- 002 — CONTACTS
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : 2 of 15
-- DEPENDS ON: nothing (fully standalone table)
-- SOURCE    : supabase/contacts_migration.sql
--
-- Column names match the toApp() / toDb() mappers in
-- src/services/contactsService.js. The app never supplies an id on insert.
--
-- RLS NOTE
-- ────────
-- The blanket FOR ALL policy created here is the interim policy. File 009
-- replaces it with four explicit per-command policies. This mirrors the
-- original migration history and leaves contacts usable if you stop early.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.contacts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core identity
  name            TEXT        NOT NULL,
  company         TEXT        NOT NULL DEFAULT '',
  designation     TEXT                 DEFAULT '',
  email           TEXT                 DEFAULT '',
  phone           TEXT                 DEFAULT '',

  -- Categorical — must match CONTACT_TYPES / CONTACT_STATUSES in contactsData.js
  type            TEXT        NOT NULL DEFAULT 'Prospect',
  status          TEXT        NOT NULL DEFAULT 'Active',

  -- Assignment
  assignee        TEXT                 DEFAULT '',
  linked_lead_id  TEXT,          -- soft link to leads.id; intentionally no FK

  -- Extended details
  address         TEXT                 DEFAULT '',
  website         TEXT                 DEFAULT '',
  notes           TEXT                 DEFAULT '',
  tags            TEXT[]               DEFAULT '{}',
  avatar          TEXT,

  -- DATE (not TIMESTAMPTZ) to match the app's YYYY-MM-DD string handling
  created_at      DATE        NOT NULL DEFAULT CURRENT_DATE,
  last_activity   DATE        NOT NULL DEFAULT CURRENT_DATE
);

-- ── Row Level Security (interim — superseded by file 009) ──────────────────
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access contacts"
  ON public.contacts
  FOR ALL
  USING      (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX contacts_last_activity_idx ON public.contacts (last_activity DESC);
CREATE INDEX contacts_email_idx         ON public.contacts (lower(email));
CREATE INDEX contacts_name_idx          ON public.contacts (lower(name));
CREATE INDEX contacts_company_idx       ON public.contacts (lower(company));
