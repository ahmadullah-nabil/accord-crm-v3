-- ═══════════════════════════════════════════════════════════════════════════
-- 010 — OPPORTUNITIES
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : 10 of 15
-- DEPENDS ON: 001 (profiles), 008 (get_visible_profile_ids)
-- SOURCE    : supabase/opportunities_migration.sql
--
-- Column names match the toApp() / toDb() mappers in
-- src/services/opportunitiesService.js.
--
-- Unlike leads/tasks/meetings, this table declares its ownership columns
-- inline and does NOT depend on file 007 — that is how the original migration
-- was written and it is preserved unchanged.
--
-- Its RLS policies are declared here rather than in file 009 because the
-- original rbac_rls.sql predates this table. All four are final; nothing
-- later in the package modifies them.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.opportunities (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT        NOT NULL,
  company             TEXT                    DEFAULT '',
  email               TEXT                    DEFAULT '',
  phone               TEXT                    DEFAULT '',

  -- Pipeline ('New'|'Qualified'|'Proposal'|'Negotiation'|'Won'|'Lost')
  stage               TEXT        NOT NULL    DEFAULT 'New',

  -- Deal financials. expected_revenue is a generated stored column — the app
  -- reads it but must never write it.
  value               NUMERIC                 DEFAULT 0,
  probability         INTEGER                 DEFAULT 50,   -- 0–100 %
  expected_revenue    NUMERIC GENERATED ALWAYS AS (value * probability / 100.0) STORED,

  -- Timing
  expected_close_date DATE,
  last_activity       DATE        NOT NULL    DEFAULT CURRENT_DATE,

  -- Assignment
  assignee            TEXT                    DEFAULT '',

  -- Lead → Opportunity conversion; soft reference, intentionally no FK
  source_lead_id      UUID,

  notes               TEXT                    DEFAULT '',
  tags                TEXT[]                  DEFAULT '{}',

  -- Ownership — same TEXT convention as file 007
  created_by          TEXT                    DEFAULT '',
  owner_id            TEXT                    DEFAULT NULL,  -- auth.users UUID as TEXT

  created_at          DATE        NOT NULL    DEFAULT CURRENT_DATE
);

-- ── Row Level Security (final) ─────────────────────────────────────────────
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- SELECT mirrors the leads visibility model: owner_id + assignee + hierarchy
CREATE POLICY "Opportunities SELECT — role-scoped"
  ON public.opportunities FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('Admin', 'AGM')
      )
      OR (owner_id IS NOT NULL AND owner_id = auth.uid()::text)
      OR assignee = (SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1)
      OR (
        owner_id IS NOT NULL
        AND owner_id::uuid IN (
          SELECT profile_id FROM public.get_visible_profile_ids(auth.uid())
        )
      )
    )
  );

CREATE POLICY "Opportunities INSERT — authenticated"
  ON public.opportunities FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Opportunities UPDATE — authenticated"
  ON public.opportunities FOR UPDATE
  USING      (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Opportunities DELETE — authenticated"
  ON public.opportunities FOR DELETE
  USING (auth.role() = 'authenticated');

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX opp_stage_idx         ON public.opportunities (stage);
CREATE INDEX opp_owner_idx         ON public.opportunities (owner_id);
CREATE INDEX opp_assignee_idx      ON public.opportunities (lower(assignee));
CREATE INDEX opp_last_activity_idx ON public.opportunities (last_activity DESC);
CREATE INDEX opp_close_date_idx    ON public.opportunities (expected_close_date);
CREATE INDEX opp_source_lead_idx   ON public.opportunities (source_lead_id);
