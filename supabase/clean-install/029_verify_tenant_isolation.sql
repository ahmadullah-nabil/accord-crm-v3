-- ═══════════════════════════════════════════════════════════════════════════
-- 029 — MULTI-TENANCY VERIFICATION HARNESS  (READ ONLY)
-- Accord CRM
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN THIS IN THE SUPABASE SQL EDITOR, after 028.
-- Project: gopcrwrprpfcieljdyjt  ("Accord CRM (Clone)")
--
-- Nothing here writes. Run it as often as you like, and run it after every
-- future migration. Each check prints a PASS/FAIL line; read the FAILs.
--
-- ⚠ THIS FILE PROVES THE SCHEMA IS CORRECT. IT DOES NOT PROVE ISOLATION WORKS.
--   Only the two-tenant test in MULTI-TENANT-RUNBOOK.md does that, because
--   these queries run as a superuser in the SQL editor and RLS does not apply
--   to them at all. Passing every check below and still leaking across tenants
--   is entirely possible if the JWT hook is off. Do the runbook.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── CHECK 1 · isolation defects ────────────────────────────────────────────
-- Expect: zero rows.
SELECT '1. ISOLATION DEFECTS' AS check,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL — ' || COUNT(*) || ' defect(s)' END AS result
FROM   public.verify_tenant_isolation();

SELECT * FROM public.verify_tenant_isolation();   -- the detail, if any


-- ── CHECK 2 · every tenant table is covered ────────────────────────────────
-- Lists every public table and what protects it. Read this one with your eyes:
-- anything in 'NONE — REVIEW' is a table nobody has made a decision about.
SELECT '2. COVERAGE MAP' AS check;

SELECT t.table_name,
       CASE
         WHEN t.table_name = ANY (public.tenant_isolation_excluded())
           THEN 'excluded by policy (028 §3)'
         WHEN EXISTS (SELECT 1 FROM pg_policies p
                      WHERE p.schemaname='public' AND p.tablename=t.table_name
                        AND p.policyname = t.table_name || '_tenant_isolation')
           THEN 'org_id isolation policy'
         WHEN EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema='public' AND c.table_name=t.table_name
                        AND c.column_name='org_id')
           THEN 'NONE — REVIEW (has org_id, no policy)'
         WHEN EXISTS (SELECT 1 FROM pg_policies p
                      WHERE p.schemaname='public' AND p.tablename=t.table_name)
           THEN 'other policies only — confirm this is intended'
         ELSE 'NONE — REVIEW (no policies at all)'
       END AS protection,
       (SELECT COUNT(*) FROM pg_policies p
        WHERE p.schemaname='public' AND p.tablename=t.table_name) AS policy_count
FROM   information_schema.tables t
WHERE  t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER  BY 2 DESC, 1;


-- ── CHECK 3 · RLS is actually ON everywhere it matters ─────────────────────
-- A policy on a table with RLS disabled is decoration. Expect: zero rows.
SELECT '3. RLS DISABLED WITH POLICIES PRESENT' AS check;

SELECT cl.relname AS table_name, 'RLS is OFF' AS problem
FROM   pg_class cl
JOIN   pg_namespace ns ON ns.oid = cl.relnamespace
WHERE  ns.nspname = 'public'
  AND  cl.relkind = 'r'
  AND  cl.relrowsecurity = FALSE
  AND  EXISTS (SELECT 1 FROM pg_policies p
               WHERE p.schemaname='public' AND p.tablename=cl.relname);


-- ── CHECK 4 · the JWT hook ─────────────────────────────────────────────────
-- This is the one that silently degrades. If custom_access_token_hook is not
-- enabled in Dashboard → Authentication → Hooks, current_org_id() falls back
-- to the caller's OLDEST ACTIVE MEMBERSHIP — correct for one org, arbitrary
-- for two, and impossible to switch away from.
--
-- The function's existence is checkable from here. Whether the dashboard
-- toggle is ON is NOT — see the runbook for the live check.
SELECT '4. JWT HOOK FUNCTION' AS check,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE p.proname = 'custom_access_token_hook'
       ) THEN 'PASS — function exists (now confirm the dashboard toggle, see runbook)'
         ELSE 'FAIL — function missing, re-run 022' END AS result;


-- ── CHECK 5 · orphan rows ──────────────────────────────────────────────────
-- Rows whose org_id points at no organisation, or whose owner has no active
-- membership. Either makes a row invisible to everyone, forever.
SELECT '5. ORPHANED ROWS' AS check;

SELECT 'integration_accounts' AS table_name, COUNT(*) AS orphans
FROM   public.integration_accounts a
WHERE  NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = a.org_id)
UNION ALL
SELECT 'memberships (user gone)', COUNT(*)
FROM   public.memberships m
WHERE  NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.user_id)
UNION ALL
SELECT 'profiles with no membership', COUNT(*)
FROM   public.profiles pr
WHERE  NOT EXISTS (SELECT 1 FROM public.memberships m
                   WHERE m.user_id = pr.id AND m.is_active);


-- ── CHECK 6 · who holds more than one membership ───────────────────────────
-- Zero rows today. The FIRST row here is the moment every deferred multi-org
-- decision becomes live: the JWT hook stops being optional, the org switcher
-- stops being a nice-to-have, and integration_accounts.org_id starts doing
-- real work.
SELECT '6. MULTI-ORG USERS' AS check;

SELECT m.user_id,
       COUNT(*) AS org_count,
       string_agg(o.name, ', ' ORDER BY o.name) AS orgs
FROM   public.memberships m
JOIN   public.organizations o ON o.id = m.org_id
WHERE  m.is_active
GROUP  BY m.user_id
HAVING COUNT(*) > 1;


-- ── CHECK 7 · row counts per organisation ──────────────────────────────────
-- The shape of the data, per tenant. After the two-tenant test in the runbook
-- this is where you confirm the second org's rows landed in the second org.
SELECT '7. ROWS PER ORG' AS check;

SELECT o.name AS org,
       (SELECT COUNT(*) FROM public.leads         WHERE org_id = o.id) AS leads,
       (SELECT COUNT(*) FROM public.contacts      WHERE org_id = o.id) AS contacts,
       (SELECT COUNT(*) FROM public.opportunities WHERE org_id = o.id) AS opportunities,
       (SELECT COUNT(*) FROM public.tasks         WHERE org_id = o.id) AS tasks,
       (SELECT COUNT(*) FROM public.meetings      WHERE org_id = o.id) AS meetings,
       (SELECT COUNT(*) FROM public.attachments   WHERE org_id = o.id) AS attachments,
       (SELECT COUNT(*) FROM public.memberships   WHERE org_id = o.id AND is_active) AS members
FROM   public.organizations o
ORDER  BY o.created_at;


-- ── CHECK 8 · Edge Functions are NOT covered by any of this ────────────────
-- Not a query — a standing reminder, printed so it is read at the same moment
-- as the results above.
SELECT '8. EDGE FUNCTIONS' AS check,
       'Edge Functions run as SERVICE ROLE and bypass every policy in 023 and 028. '
       'The only tenant boundary there is assertOwnership() in send-email/attachments.ts. '
       'Nothing in this file tests that path.' AS reminder;
