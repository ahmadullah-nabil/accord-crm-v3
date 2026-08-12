-- ─── Accord CRM — Opportunities Table ────────────────────────────────────────
-- Run AFTER: profiles_foundation.sql, ownership_patch.sql, rbac_rls.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.opportunities (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT        NOT NULL,
  company           TEXT                    DEFAULT '',
  email             TEXT                    DEFAULT '',
  phone             TEXT                    DEFAULT '',

  -- Pipeline
  stage             TEXT        NOT NULL    DEFAULT 'New',
  -- ('New' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost')

  -- Deal financials
  value             NUMERIC                 DEFAULT 0,
  probability       INTEGER                 DEFAULT 50, -- 0–100 %
  expected_revenue  NUMERIC GENERATED ALWAYS AS (value * probability / 100.0) STORED,

  -- Timing
  expected_close_date DATE,
  last_activity       DATE        NOT NULL    DEFAULT CURRENT_DATE,

  -- Assignment
  assignee          TEXT                    DEFAULT '',

  -- Lead → Opportunity conversion (soft FK, no constraint)
  source_lead_id    UUID,

  -- Content
  notes             TEXT                    DEFAULT '',
  tags              TEXT[]                  DEFAULT '{}',

  -- Ownership (matches ownership_patch.sql pattern)
  created_by        TEXT                    DEFAULT '',
  owner_id          TEXT                    DEFAULT NULL,  -- Supabase auth UUID as TEXT

  created_at        DATE        NOT NULL    DEFAULT CURRENT_DATE
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- SELECT: mirrors leads RLS visibility (owner_id + assignee + hierarchy)
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
  USING     (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Opportunities DELETE — authenticated"
  ON public.opportunities FOR DELETE
  USING (auth.role() = 'authenticated');

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS opp_stage_idx         ON public.opportunities (stage);
CREATE INDEX IF NOT EXISTS opp_owner_idx         ON public.opportunities (owner_id);
CREATE INDEX IF NOT EXISTS opp_assignee_idx      ON public.opportunities (lower(assignee));
CREATE INDEX IF NOT EXISTS opp_last_activity_idx ON public.opportunities (last_activity DESC);
CREATE INDEX IF NOT EXISTS opp_close_date_idx    ON public.opportunities (expected_close_date);
CREATE INDEX IF NOT EXISTS opp_source_lead_idx   ON public.opportunities (source_lead_id);
