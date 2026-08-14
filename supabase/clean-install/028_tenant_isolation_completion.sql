-- ═══════════════════════════════════════════════════════════════════════════
-- 028 — TENANT ISOLATION, COMPLETED
-- Accord CRM
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN THIS IN THE SUPABASE SQL EDITOR. It does NOT arrive via git push.
-- Project: gopcrwrprpfcieljdyjt  ("Accord CRM (Clone)")
-- Run 028 first, then 029 (the verification harness).
--
-- ── What 023 left behind ───────────────────────────────────────────────────
-- 023 isolated nine tables from a HARDCODED array:
--
--   leads contacts tasks meetings opportunities
--   activities notifications email_messages teams
--
-- The database has twenty-three tables. Of the fourteen it did not name:
--
--   attachments               HAS org_id, was simply not in the array
--   integration_accounts      no org_id — user-scoped only
--   integration_credentials   no org_id — pure child of integration_accounts
--   integration_oauth_states  no org_id — user-scoped only
--   email_attachments         no org_id — pure child of email_messages
--   user_preferences          no org_id — deliberate, see below
--   user_email_settings       no org_id — deliberate, see below
--   memberships               EXCLUDED  — see the exclusion list
--   org_invitations           EXCLUDED  — see the exclusion list
--   organizations             no org_id column (its PK is `id`)
--   platform_admins           cross-tenant by design
--   platform_access_log       cross-tenant by design
--   profiles                  has its own policy in 023
--   company_settings          has its own policy in 023
--
-- None of these is a live leak TODAY, because exactly one organisation exists
-- and user-scoping is transitively org-scoping while every user belongs to one
-- org. All of them become one the day a person holds two memberships.
--
-- ── The decisions this migration makes ─────────────────────────────────────
--
-- A CONNECTED MAILBOX IS PER-USER-PER-ORG.  integration_accounts and
-- integration_oauth_states gain org_id. If the same human is an Admin at
-- Accord and an Employee at a customer, the customer's workspace must not
-- inherit — or be able to send from — the Accord mailbox. Reconnecting inside
-- the second org creates a second row for the same external account, which is
-- why the unique index is widened to include org_id.
--
-- PURE CHILD TABLES ISOLATE THROUGH THEIR PARENT, not through a copied column.
-- integration_credentials (PK account_id) and email_attachments (FK
-- email_message_id) have no independent existence and no insert path that
-- bypasses the parent. A denormalised org_id on them is a second source of
-- truth that can drift; an EXISTS policy against the parent cannot.
--
-- USER PREFERENCES ARE NOT ORG-SCOPED, DELIBERATELY.  user_preferences and
-- user_email_settings hold theme, density, font size and signature. Those are
-- facts about the PERSON and should follow them into every workspace. They
-- stay user-scoped and are named in the exclusion list so a future audit reads
-- this as a decision rather than an oversight.
--
-- ── And the structural fix ─────────────────────────────────────────────────
-- The hardcoded array is replaced by a scan of information_schema: every table
-- in `public` that HAS an org_id column gets the isolation policy, minus an
-- explicit exclusion list. A table added next month is covered by re-running
-- this file, instead of being covered only if somebody remembers.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 1: org_id on the integration tables
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.integration_accounts
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.integration_oauth_states
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill from the owner's oldest active membership. That is the same rule
-- current_org_id() falls back to, so existing rows land where the app has been
-- treating them as living all along. Correct for the single-org world these
-- rows were created in, and the only defensible answer for them.
UPDATE public.integration_accounts a
   SET org_id = m.org_id
  FROM (
    SELECT DISTINCT ON (user_id) user_id, org_id
    FROM   public.memberships
    WHERE  is_active
    ORDER  BY user_id, created_at
  ) m
 WHERE a.user_id = m.user_id
   AND a.org_id IS NULL;

UPDATE public.integration_oauth_states s
   SET org_id = m.org_id
  FROM (
    SELECT DISTINCT ON (user_id) user_id, org_id
    FROM   public.memberships
    WHERE  is_active
    ORDER  BY user_id, created_at
  ) m
 WHERE s.user_id = m.user_id
   AND s.org_id IS NULL;

-- A row whose owner has no membership at all cannot be attributed to an org.
-- Deleting oauth_states is safe — they expire in minutes and are single-use.
-- integration_accounts is NOT deleted; an orphan there means a real mailbox
-- grant, so it is reported and left for a human.
DELETE FROM public.integration_oauth_states WHERE org_id IS NULL;

DO $$
DECLARE orphans INT;
BEGIN
  SELECT COUNT(*) INTO orphans FROM public.integration_accounts WHERE org_id IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      '028: % integration_accounts row(s) have an owner with no active membership. '
      'Resolve them by hand (assign a membership, or delete the row) and re-run. '
      'They are not deleted automatically because each one is a live OAuth grant.',
      orphans;
  END IF;
END $$;

ALTER TABLE public.integration_accounts      ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.integration_oauth_states  ALTER COLUMN org_id SET NOT NULL;

-- New rows default to the caller's org, matching how attachments.org_id works.
ALTER TABLE public.integration_accounts      ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.integration_oauth_states  ALTER COLUMN org_id SET DEFAULT public.current_org_id();

CREATE INDEX IF NOT EXISTS integration_accounts_org_idx
  ON public.integration_accounts (org_id);
CREATE INDEX IF NOT EXISTS integration_oauth_states_org_idx
  ON public.integration_oauth_states (org_id);

-- ── Uniqueness has to widen with the scope ────────────────────────────────
-- The old index was (user_id, provider, provider_account_id): "reconnecting the
-- same external account updates the existing row". That is still the intent,
-- but "the same account" is now the same account IN THIS ORG. Without org_id
-- in the key, connecting your Gmail in a second workspace would silently
-- overwrite the first workspace's row and move the grant.
DROP INDEX IF EXISTS public.integration_accounts_unique_idx;
CREATE UNIQUE INDEX integration_accounts_unique_idx
  ON public.integration_accounts (org_id, user_id, provider, provider_account_id);


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 2: child tables isolate through their parent
-- ───────────────────────────────────────────────────────────────────────────
-- RESTRICTIVE, so these AND with whatever permissive policies already exist
-- rather than replacing them — the same property that makes 023 safe.

ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS integration_credentials_tenant_isolation ON public.integration_credentials;
CREATE POLICY integration_credentials_tenant_isolation
  ON public.integration_credentials
  AS RESTRICTIVE
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.integration_accounts a
    WHERE a.id = integration_credentials.account_id
      AND a.org_id = public.current_org_id()
      AND public.is_org_member(a.org_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.integration_accounts a
    WHERE a.id = integration_credentials.account_id
      AND a.org_id = public.current_org_id()
      AND public.is_org_member(a.org_id)
  ));

ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_attachments_tenant_isolation ON public.email_attachments;
CREATE POLICY email_attachments_tenant_isolation
  ON public.email_attachments
  AS RESTRICTIVE
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.email_messages m
    WHERE m.id = email_attachments.email_message_id
      AND m.org_id = public.current_org_id()
      AND public.is_org_member(m.org_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.email_messages m
    WHERE m.id = email_attachments.email_message_id
      AND m.org_id = public.current_org_id()
      AND public.is_org_member(m.org_id)
  ));

-- The EXISTS lookups are by primary key on the parent, so they cost an index
-- probe per row. These indexes make the CHILD side of each join cheap too.
CREATE INDEX IF NOT EXISTS email_attachments_message_idx
  ON public.email_attachments (email_message_id);


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 3: the isolation set becomes derived, not hardcoded
-- ───────────────────────────────────────────────────────────────────────────
--
-- THE EXCLUSION LIST IS THE ONLY HARDCODED THING NOW, and every entry has a
-- reason that is not "we forgot":
--
--   memberships      A user must be able to READ every membership they hold,
--                    including ones in orgs they are not currently acting in —
--                    otherwise no org switcher can ever be built, and a user
--                    whose JWT claim is stale cannot recover. Its own
--                    own-rows-only policy is the correct boundary here.
--   org_invitations  Matched by EMAIL before any membership exists. Isolating
--                    it by current_org_id() would make an invitation invisible
--                    to the person it is for. 024 already gives it an
--                    org-admin-manages policy.
--   platform_admins  Cross-tenant by design; this is the Accord staff table.
--   platform_access_log  Same.

CREATE OR REPLACE FUNCTION public.tenant_isolation_excluded()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY['memberships', 'org_invitations', 'platform_admins', 'platform_access_log']
$$;

COMMENT ON FUNCTION public.tenant_isolation_excluded() IS
  'Tables with an org_id column that deliberately do NOT carry the tenant isolation policy. Read 028 section 3 before adding to this list.';

DO $$
DECLARE
  t         TEXT;
  applied   INT := 0;
  skipped   INT := 0;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM   information_schema.columns c
    JOIN   information_schema.tables  tb
           ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
    WHERE  c.table_schema = 'public'
      AND  c.column_name  = 'org_id'
      AND  tb.table_type  = 'BASE TABLE'
    ORDER  BY c.table_name
  LOOP
    IF t = ANY (public.tenant_isolation_excluded()) THEN
      RAISE NOTICE '028: skipping % (excluded by policy, see section 3)', t;
      skipped := skipped + 1;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
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

    applied := applied + 1;
    RAISE NOTICE '028: isolated %', t;
  END LOOP;

  RAISE NOTICE '028: % table(s) isolated, % deliberately excluded', applied, skipped;
END $$;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 4: the guard that makes forgetting visible
-- ───────────────────────────────────────────────────────────────────────────
-- Run this after ANY migration that adds a table. An empty result is the pass.
-- 029 calls it as part of the full harness.

CREATE OR REPLACE FUNCTION public.verify_tenant_isolation()
RETURNS TABLE (table_name TEXT, problem TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- A. has org_id, is not excluded, and has no isolation policy
  SELECT c.table_name::TEXT,
         'has org_id but no *_tenant_isolation policy'::TEXT
  FROM   information_schema.columns c
  JOIN   information_schema.tables tb
         ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
  WHERE  c.table_schema = 'public'
    AND  c.column_name  = 'org_id'
    AND  tb.table_type  = 'BASE TABLE'
    AND  NOT (c.table_name = ANY (public.tenant_isolation_excluded()))
    AND  NOT EXISTS (
           SELECT 1 FROM pg_policies p
           WHERE p.schemaname = 'public'
             AND p.tablename  = c.table_name
             AND p.policyname = c.table_name || '_tenant_isolation'
         )

  UNION ALL

  -- B. carries an isolation policy but RLS is switched off, which makes the
  --    policy inert. This is the failure mode that looks fine in pg_policies.
  SELECT p.tablename::TEXT,
         'has an isolation policy but RLS is DISABLED on the table'::TEXT
  FROM   pg_policies p
  JOIN   pg_class cl ON cl.relname = p.tablename
  JOIN   pg_namespace ns ON ns.oid = cl.relnamespace AND ns.nspname = 'public'
  WHERE  p.schemaname = 'public'
    AND  p.policyname = p.tablename || '_tenant_isolation'
    AND  cl.relrowsecurity = FALSE

  UNION ALL

  -- C. the isolation policy exists but is PERMISSIVE, so it ORs with the other
  --    policies instead of ANDing — i.e. it isolates nothing.
  SELECT p.tablename::TEXT,
         'isolation policy is PERMISSIVE, must be RESTRICTIVE'::TEXT
  FROM   pg_policies p
  WHERE  p.schemaname = 'public'
    AND  p.policyname = p.tablename || '_tenant_isolation'
    AND  p.permissive = 'PERMISSIVE'

  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.verify_tenant_isolation() IS
  'Returns one row per tenant-isolation defect. An empty result is a pass. Run after every migration that adds a table.';

-- ── Fail the migration if it did not achieve its own goal ─────────────────
DO $$
DECLARE bad INT;
BEGIN
  SELECT COUNT(*) INTO bad FROM public.verify_tenant_isolation();
  IF bad > 0 THEN
    RAISE EXCEPTION '028: % isolation defect(s) remain — run SELECT * FROM public.verify_tenant_isolation();', bad;
  END IF;
  RAISE NOTICE '028: verify_tenant_isolation() is clean.';
END $$;
