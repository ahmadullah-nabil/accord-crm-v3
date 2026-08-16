-- ═══════════════════════════════════════════════════════════════════════════
-- 031 — LEADS.MODULES + OTC / MMC PRICING
-- Accord CRM
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN THIS IN THE SUPABASE SQL EDITOR. It does NOT arrive via git push.
-- Project: gopcrwrprpfcieljdyjt  ("Accord CRM (Clone)")
--
-- Which AccordHRM modules a lead is actually asking about. A prospect wanting
-- Payroll and Attendance is a different deal from one wanting the whole HR &
-- Admin Portal, and until now that lived in free-text Notes where nothing
-- could count it.
--
-- ── Why a separate column and not `tags` ───────────────────────────────────
-- `tags` already exists and is TEXT[], so this could have gone in there. It
-- should not. Tags are open-vocabulary and user-invented ("Enterprise", "Q2",
-- "Healthcare"); modules are a closed list that maps to what the product
-- actually ships. Mixed into one array you can never answer "how many open
-- deals want Payroll" without also matching a tag someone typed as "payroll",
-- and you can never rename a module without touching everyone's tags.
--
-- ── Why TEXT[] and not an enum or a join table ─────────────────────────────
-- An enum would need a migration every time the product adds a module, and
-- migration 025's crm_entity_type domain is already a live example of how that
-- goes wrong — it sits unattached because attaching it would break every
-- insert at once. A join table is the textbook answer and is real work:
-- another table, another RLS policy, another isolation entry, and joins on
-- every read. For a list of sixteen short strings on one table, an array with
-- the canonical list held in the app is the right size of solution.
--
-- The CUSTOM entry is why this cannot be constrained at the database level at
-- all: the field explicitly allows free text for anything not on the list.
-- A CHECK constraint would reject exactly the case the field was asked for.
--
-- ── Tenancy ────────────────────────────────────────────────────────────────
-- Nothing to do. The RESTRICTIVE org_id policy from 023 (re-derived by 028)
-- sits on the TABLE, so a new column is covered automatically.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS modules TEXT[] NOT NULL DEFAULT '{}';

-- ── OTC / MMC ──────────────────────────────────────────────────────────────
-- An AccordHRM deal is priced in two parts: a one-time cost to stand it up,
-- and a monthly maintenance cost that recurs for as long as they stay. They
-- are different money and cannot share a column — one is a single event, the
-- other is a rate, and adding them produces a number that means nothing.
--
-- `value` IS DELIBERATELY LEFT ALONE. It is the existing pipeline figure and
-- it is read by getKpiSummary, the Analytics funnel, the Dashboard's pipeline
-- strip, the Kanban column totals and the Leads footer. Redefining it as
-- "otc + mmc" — or deriving it — would silently change every one of those
-- numbers with no migration anyone could point at afterwards. OTC and MMC are
-- new, additive, and default to 0, so every existing lead reads exactly as it
-- did before this ran.
--
-- NUMERIC, matching `value`. Never FLOAT for money: 0.1 + 0.2 is not 0.3 in
-- binary floating point, and a monthly rate gets multiplied by twelve.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS otc NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS mmc NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.leads.otc IS
  'One-time cost, BDT. Setup / implementation. Separate from leads.value, which remains the pipeline figure.';
COMMENT ON COLUMN public.leads.mmc IS
  'Monthly maintenance cost, BDT. A RATE, not a total — annualise as mmc * 12 at the point of use, never in storage.';

COMMENT ON COLUMN public.leads.modules IS
  'AccordHRM modules this lead is interested in. Canonical list lives in src/lib/modules.js; free-text entries are permitted, so there is deliberately no CHECK constraint.';

-- GIN, not btree. Every query against this column is a containment test
-- ("which leads want Payroll"), which is `modules @> ARRAY['Payroll']` — btree
-- cannot serve that, GIN can.
CREATE INDEX IF NOT EXISTS leads_modules_gin_idx
  ON public.leads USING GIN (modules);

-- ── Verify ─────────────────────────────────────────────────────────────────
-- Expect three rows: mmc | numeric | NO, modules | ARRAY | NO, otc | numeric | NO
SELECT column_name, data_type, is_nullable
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'leads'
  AND  column_name  IN ('modules', 'otc', 'mmc')
ORDER  BY column_name;

-- Expect 0: nothing should be NULL, every column has a default.
SELECT COUNT(*) AS bad_rows
FROM   public.leads
WHERE  modules IS NULL OR otc IS NULL OR mmc IS NULL;
