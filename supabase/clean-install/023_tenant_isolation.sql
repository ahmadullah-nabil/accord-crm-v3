-- ═══════════════════════════════════════════════════════════════════════════
-- 023 — TENANT ISOLATION
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : 23. AFTER 022 and 022a. 022a is not optional — without it the
--             email and calendar Edge Functions are already failing.
--
-- This is the file that actually isolates tenants. Until it runs, org_id is a
-- column nobody checks.
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ I CHANGED THE APPROACH. READ THIS BEFORE REVIEWING.                     │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ The plan was to rewrite all 28 policies as                              │
-- │     USING ( org_id = current_org_id() AND ( <existing expression> ) )   │
-- │                                                                          │
-- │ I am not doing that, because it is the more dangerous of the two ways.   │
-- │                                                                          │
-- │ The activities SELECT policy alone is ~40 lines of nested EXISTS across  │
-- │ five entity types. Retyping 28 such expressions to bolt one AND onto     │
-- │ each puts every one of them at risk of a transcription error — and a     │
-- │ mistake there does not fail loudly, it silently widens or narrows who    │
-- │ can see what, inside a file whose whole purpose is access control.       │
-- │                                                                          │
-- │ Postgres has a feature for exactly this: RESTRICTIVE policies. They are  │
-- │ AND-ed with every permissive policy on the table. That is precisely the  │
-- │ "AND-wrapped outside, never OR-ed in" rule, enforced by the engine       │
-- │ instead of by my typing.                                                 │
-- │                                                                          │
-- │ So the existing 28 policies are NOT TOUCHED. Their role logic stays      │
-- │ exactly as written and reviewed. Nine restrictive policies are added on  │
-- │ top, one per table, each three lines long and each identical.            │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- WHY THIS IS ALSO STRONGER, NOT MERELY SAFER TO WRITE
-- ────────────────────────────────────────────────────
-- With the rewrite approach, tenant isolation lives inside 28 expressions.
-- The day someone adds a 29th policy — a new feature, a quick fix, a
-- permissive policy for a new role — that policy is OR-ed with the others and
-- has no org check. Isolation is gone for that table, and nothing complains.
--
-- A restrictive policy cannot be escaped that way. It is AND-ed with whatever
-- permissive policies exist now or later. A future developer who knows nothing
-- about tenancy cannot accidentally open a hole.
--
-- WHAT IT DOES NOT DO
-- ───────────────────
--   • Service role still bypasses RLS entirely. Edge Functions and any future
--     pg_cron job must filter org_id by hand. See the note at the end.
--   • WITHIN an org, the 17 wide-open write policies stay wide open — any
--     authenticated member can still edit any lead in their own org. That is
--     the existing single-tenant RBAC decision, unchanged and out of scope
--     here. This file stops CROSS-tenant access, which is the leak.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 1: The isolation policies
-- ───────────────────────────────────────────────────────────────────────────
-- Each is FOR ALL with both USING and WITH CHECK, which covers:
--   USING      → SELECT, UPDATE, DELETE   (which rows you may touch)
--   WITH CHECK → INSERT, UPDATE           (which rows you may leave behind)
--
-- Both halves are required. USING alone would let a member of org A UPDATE
-- one of their own rows and set its org_id to org B — moving a record across
-- the boundary instead of reading across it.
--
-- is_org_member() is deliberately ANDed with the equality rather than trusted
-- alone. current_org_id() reads a JWT claim; is_org_member() checks that claim
-- against the memberships table. A token is issued by our own hook, but a
-- policy that trusts a claim without verifying it trusts the issuer absolutely
-- — and also silently keeps working for a user whose membership was revoked
-- until their token happens to refresh.
--
-- If current_org_id() returns NULL — no claim, no membership, a malformed
-- claim — then `org_id = NULL` is NULL, which is not true, and every row is
-- denied. FAILS CLOSED.

DO $$
DECLARE
  t TEXT;
  tenant_tables TEXT[] := ARRAY[
    'leads', 'contacts', 'tasks', 'meetings', 'opportunities',
    'activities', 'notifications', 'email_messages', 'teams'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t AND table_type = 'BASE TABLE'
    ) THEN
      RAISE NOTICE '023: skipping %, table not present', t;
      CONTINUE;
    END IF;

    -- The org_id column must exist, or the policy would be created against a
    -- column that is not there and fail at query time rather than here.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='org_id'
    ) THEN
      RAISE EXCEPTION '023: %.org_id is missing — run 022 first', t;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant_isolation', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        AS RESTRICTIVE
        FOR ALL
        USING      (org_id = public.current_org_id()
                    AND public.is_org_member(org_id))
        WITH CHECK (org_id = public.current_org_id()
                    AND public.is_org_member(org_id))
    $f$, t || '_tenant_isolation', t);

    RAISE NOTICE '023: isolated %', t;
  END LOOP;
END $$;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 2: company_settings
-- ───────────────────────────────────────────────────────────────────────────
-- Keyed BY org_id, so it needs no new column — but its existing policies are
-- "any authenticated user can read" and "any Admin can write", neither of
-- which mentions the org. Without this, every tenant reads and an admin of one
-- tenant edits another's company name, tax id and currency.
--
-- The role check stays in the permissive policies from 015; this only adds the
-- boundary.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='company_settings') THEN
    DROP POLICY IF EXISTS company_settings_tenant_isolation ON public.company_settings;
    CREATE POLICY company_settings_tenant_isolation
      ON public.company_settings
      AS RESTRICTIVE FOR ALL
      USING      (org_id = public.current_org_id() AND public.is_org_member(org_id))
      WITH CHECK (org_id = public.current_org_id() AND public.is_org_member(org_id));
    RAISE NOTICE '023: isolated company_settings';
  END IF;
END $$;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 3: profiles
-- ───────────────────────────────────────────────────────────────────────────
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ profiles has NO org_id — by design; identity is global, membership is    │
-- │ per-org. It still needs a boundary, or every tenant can list every       │
-- │ user's name, email, phone and avatar. That is the single most obvious    │
-- │ cross-tenant leak in the product, because the assignee dropdown would    │
-- │ show it.                                                                 │
-- │                                                                          │
-- │ So the boundary is membership-based rather than column-based: a profile  │
-- │ is visible if that person shares an org with you.                        │
-- │                                                                          │
-- │ Your own profile is always visible. Otherwise a user whose membership    │
-- │ was just revoked cannot load the app far enough to be told why.          │
-- └─────────────────────────────────────────────────────────────────────────┘
DROP POLICY IF EXISTS profiles_tenant_isolation ON public.profiles;
CREATE POLICY profiles_tenant_isolation
  ON public.profiles
  AS RESTRICTIVE FOR ALL
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.memberships mine
      JOIN public.memberships theirs ON theirs.org_id = mine.org_id
      WHERE mine.user_id   = auth.uid()
        AND mine.is_active
        AND theirs.user_id = public.profiles.id
        AND theirs.is_active
    )
  )
  WITH CHECK (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.memberships mine
      JOIN public.memberships theirs ON theirs.org_id = mine.org_id
      WHERE mine.user_id   = auth.uid()
        AND mine.is_active
        AND theirs.user_id = public.profiles.id
        AND theirs.is_active
    )
  );


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 4: Verify
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  t.tablename,
  CASE WHEN p.policyname IS NULL THEN '*** NOT ISOLATED ***' ELSE 'isolated' END AS status
FROM (VALUES ('leads'),('contacts'),('tasks'),('meetings'),('opportunities'),
             ('activities'),('notifications'),('email_messages'),('teams'),
             ('company_settings'),('profiles')) t(tablename)
LEFT JOIN pg_policies p
       ON p.schemaname='public'
      AND p.tablename = t.tablename
      AND p.permissive = 'RESTRICTIVE'
ORDER BY 2, 1;

-- Every tenant table must now carry a restrictive policy. Expect 11 rows, all
-- 'isolated'.


-- ═══════════════════════════════════════════════════════════════════════════
-- WHAT STILL BYPASSES THIS
-- ═══════════════════════════════════════════════════════════════════════════
-- SERVICE ROLE. It bypasses RLS by design, so none of the above applies to
-- Edge Functions. They are currently safe only because each one operates on a
-- single user's own data, resolved from a verified JWT before it switches to
-- the admin client.
--
-- The one to watch is step 17, moving the notification scanner to pg_cron. It
-- will scan overdue tasks across the entire table with no user context at all,
-- and no policy in this file will contain it. It must group by org_id
-- explicitly. Write that down now, because it will not announce itself.
-- ═══════════════════════════════════════════════════════════════════════════
