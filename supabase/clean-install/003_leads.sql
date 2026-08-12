-- ═══════════════════════════════════════════════════════════════════════════
-- 003 — LEADS
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : 3 of 15
-- DEPENDS ON: nothing (fully standalone table)
-- SOURCE    : supabase/leads_migration.sql
--
-- Column names match the toApp() / toDb() mappers in
-- src/services/leadsService.js.
--
-- The ownership columns (created_by, owner_id) are added by file 007, exactly
-- as in the original migration history. File 009 then reads owner_id in the
-- role-scoped SELECT policy.
--
-- RLS NOTE: the blanket FOR ALL policy here is interim — file 009 replaces it.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.leads (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core identity
  name            TEXT        NOT NULL,
  company         TEXT                    DEFAULT '',
  email           TEXT                    DEFAULT '',
  phone           TEXT                    DEFAULT '',

  -- Pipeline — must match STAGES in src/stores/leadsStore.js
  -- ('New'|'Contacted'|'Qualified'|'Proposal'|'Negotiation'|'Won'|'Lost')
  stage           TEXT        NOT NULL    DEFAULT 'New',

  -- Deal value; returned as a JS number by toApp()
  value           NUMERIC                 DEFAULT 0,

  -- Must match SOURCES / ASSIGNEES / PRIORITIES in leadsStore.js
  source          TEXT                    DEFAULT '',
  assignee        TEXT                    DEFAULT '',
  priority        TEXT        NOT NULL    DEFAULT 'Medium',

  notes           TEXT                    DEFAULT '',
  tags            TEXT[]                  DEFAULT '{}',

  -- DATE to match the app's YYYY-MM-DD strings
  created_at      DATE        NOT NULL    DEFAULT CURRENT_DATE,
  last_activity   DATE        NOT NULL    DEFAULT CURRENT_DATE
);

-- ── Row Level Security (interim — superseded by file 009) ──────────────────
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access leads"
  ON public.leads
  FOR ALL
  USING      (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── Indexes ────────────────────────────────────────────────────────────────
-- Default sort is last_activity DESC; stage/priority/value are common filters
CREATE INDEX leads_last_activity_idx ON public.leads (last_activity DESC);
CREATE INDEX leads_stage_idx         ON public.leads (stage);
CREATE INDEX leads_priority_idx      ON public.leads (priority);
CREATE INDEX leads_assignee_idx      ON public.leads (lower(assignee));
CREATE INDEX leads_value_idx         ON public.leads (value DESC);
CREATE INDEX leads_created_at_idx    ON public.leads (created_at DESC);
