-- ═══════════════════════════════════════════════════════════════════════════
-- 022 — MULTI-TENANT FOUNDATION
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : 22
-- DEPENDS ON: 001 (profiles, teams), 008 (get_visible_profile_ids), and every
--             table file 002–021. Run AFTER 021.
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ THIS FILE ALONE DOES NOT ISOLATE TENANTS. READ THIS BEFORE RUNNING.     │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ 022 adds the org_id COLUMNS, the organizations / memberships tables and │
-- │ the helper functions. It does NOT change a single RLS policy, so after  │
-- │ running it every user still sees exactly what they saw before.          │
-- │                                                                          │
-- │ Isolation arrives in 023, which rewrites the policies. Between 022 and  │
-- │ 023 the database is in a state that LOOKS multi-tenant and is NOT.      │
-- │ That gap is deliberate — the schema change is mechanical and safe, the  │
-- │ policy rewrite needs reading — but it must not be left sitting. Do not  │
-- │ onboard a second organisation until 023 has run and verified.           │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- WHAT THIS FILE DOES
-- ───────────────────
--   1. organizations           — the tenant
--   2. memberships             — (user, org, role); a user may hold several
--   3. platform_admins         — Accord's cross-org access, deliberately NOT a role
--   4. current_org_id() etc.   — the helpers 023's policies are built on
--   5. custom_access_token_hook — puts org_id in the JWT (must be enabled in
--                                 the dashboard; see the note at the bottom)
--   6. org_id columns + backfill + NOT NULL + indexes on the tenant tables
--
-- WHY role MOVES OFF profiles
-- ───────────────────────────
-- A person is one identity; their ROLE is a fact about them IN AN ORG. The
-- same human can be an Admin at Accord and an Employee at a customer they
-- support. profiles.role cannot express that, so role lives on memberships.
--
-- profiles.role is NOT dropped here. It is left in place and kept in sync by a
-- trigger, so lib/permissions.js and the auth store keep working untouched
-- while the app is migrated. Dropping it is a later, separate step — see the
-- DEPRECATION note in section 2.
--
-- WHY profiles GETS NO org_id
-- ───────────────────────────
-- It would contradict the point of memberships: a column can hold one org, and
-- the whole reason for this design is that a user can be in more than one.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 0: The Accord organisation's id
-- ───────────────────────────────────────────────────────────────────────────
-- Not a new value. src/services/settingsService.js already writes
-- company_settings with this exact sentinel:
--
--   export const WORKSPACE_ORG_ID = '00000000-0000-0000-0000-000000000001'
--
-- Reusing it means the existing company_settings row IS Accord's org row from
-- the moment this runs — no data migration, and the running app keeps reading
-- the same key it always did. A fresh gen_random_uuid() would have orphaned it.
--
-- Everything created before multi-tenancy belongs to this organisation.


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 1: organizations
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  name        TEXT        NOT NULL,
  -- URL-safe short name. Not used for routing yet; here now because adding a
  -- UNIQUE column to a populated table later means inventing values for rows
  -- that already exist.
  slug        TEXT        NOT NULL UNIQUE,

  -- 'active' | 'suspended'. A suspended org keeps its data and loses access —
  -- non-payment must not mean deletion.
  status      TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'suspended')),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Accord itself, on the id the app already uses.
INSERT INTO public.organizations (id, name, slug)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Accord Technologies Limited',
  'accord'
)
ON CONFLICT (id) DO NOTHING;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 2: memberships
-- ───────────────────────────────────────────────────────────────────────────
-- (user, org) with the role attached. PRIMARY KEY (user_id, org_id) makes
-- "the same person twice in one org" unrepresentable rather than merely
-- discouraged.
CREATE TABLE IF NOT EXISTS public.memberships (
  user_id     UUID        NOT NULL
                          REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID        NOT NULL
                          REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Same vocabulary as profiles.role — Admin / AGM / Manager / Executive /
  -- Employee. Deliberately NOT a new enum: lib/permissions.js reads these
  -- exact strings, and inventing a parallel set would mean two vocabularies
  -- to keep in step.
  role        TEXT        NOT NULL DEFAULT 'Employee',

  -- Soft-delete. A former employee's memberships row is deactivated, not
  -- deleted, so their leads keep resolving to a name.
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS memberships_org_idx  ON public.memberships (org_id);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON public.memberships (user_id);

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- Backfill: every existing profile becomes a member of Accord, carrying the
-- role it already had. is_active mirrors profiles.is_active so a deactivated
-- member does not silently regain access.
INSERT INTO public.memberships (user_id, org_id, role, is_active)
SELECT
  p.id,
  '00000000-0000-0000-0000-000000000001',
  COALESCE(NULLIF(p.role, ''), 'Employee'),
  COALESCE(p.is_active, TRUE)
FROM public.profiles p
ON CONFLICT (user_id, org_id) DO NOTHING;

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ DEPRECATION — profiles.role                                             │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ memberships.role is now the source of truth. profiles.role is kept only │
-- │ so the un-migrated frontend keeps working, and is mirrored by the       │
-- │ trigger below.                                                          │
-- │                                                                          │
-- │ The mirror is one-directional and lossy ON PURPOSE: it copies the role  │
-- │ from the membership in Accord's org only. Once a user holds roles in    │
-- │ two orgs, profiles.role cannot represent them and must not be trusted.  │
-- │ Delete the column and this trigger in the same commit that moves        │
-- │ lib/permissions.js onto memberships.                                    │
-- └─────────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.sync_profile_role_from_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id = '00000000-0000-0000-0000-000000000001' THEN
    UPDATE public.profiles
       SET role = NEW.role, updated_at = NOW()
     WHERE id = NEW.user_id
       AND role IS DISTINCT FROM NEW.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS memberships_sync_profile_role ON public.memberships;
CREATE TRIGGER memberships_sync_profile_role
  AFTER INSERT OR UPDATE OF role ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_role_from_membership();


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 3: platform_admins
-- ───────────────────────────────────────────────────────────────────────────
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ THIS IS NOT A ROLE, AND MUST NEVER BECOME ONE                           │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ Accord needs to look inside a customer's org to answer a support        │
-- │ ticket. The tempting way to allow that is another OR branch in the 53   │
-- │ policies — `OR is_platform_admin()`. Do not. That puts a global read on │
-- │ every table, and one typo in one policy then leaks everything.          │
-- │                                                                          │
-- │ Membership of this table grants NOTHING by itself. No policy in 023     │
-- │ references it. It exists so that a small number of explicitly written,  │
-- │ auditing SECURITY DEFINER functions can check it — support access is    │
-- │ meant to be deliberate and logged, not ambient.                          │
-- └─────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id     UUID        PRIMARY KEY
                          REFERENCES auth.users(id) ON DELETE CASCADE,
  note        TEXT        DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Deliberately empty. Nobody is a platform admin until someone is added by
-- hand, from the SQL editor, on purpose.
--
-- The read-access log that support functions will write to. Created now so the
-- functions have somewhere to write from the first one onward — an audit trail
-- added after the fact has a hole exactly where it is most needed.
CREATE TABLE IF NOT EXISTS public.platform_access_log (
  id          BIGSERIAL   PRIMARY KEY,
  actor_id    UUID        NOT NULL,
  org_id      UUID        NOT NULL,
  action      TEXT        NOT NULL,
  detail      JSONB       DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_access_log ENABLE ROW LEVEL SECURITY;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 4: Helper functions
-- ───────────────────────────────────────────────────────────────────────────

-- ── current_org_id() ────────────────────────────────────────────────────────
-- The org the caller is acting in. Every policy in 023 is built on this.
--
-- Reads the JWT claim first: it costs nothing, and it is the only source that
-- can answer "which of my orgs am I in RIGHT NOW" for a user who holds several.
--
-- Falls back to a memberships lookup so the database is correct BEFORE the
-- access-token hook is enabled in the dashboard. The fallback picks the oldest
-- active membership, which is right for the single-org case and arbitrary for
-- the multi-org one — that is precisely why the hook is not optional once a
-- second membership exists.
--
-- Returns NULL when there is no claim and no membership. That is deliberate
-- and it FAILS CLOSED: `org_id = NULL` is NULL, never true, so a caller with
-- no org sees nothing rather than everything.
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claim_text TEXT;
  resolved   UUID;
BEGIN
  BEGIN
    claim_text := current_setting('request.jwt.claims', true)::jsonb ->> 'org_id';
  EXCEPTION WHEN OTHERS THEN
    -- No JWT at all (a pg_cron job, psql, the SQL editor). Not an error.
    claim_text := NULL;
  END;

  IF claim_text IS NOT NULL AND claim_text <> '' THEN
    BEGIN
      RETURN claim_text::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      -- A malformed claim must not fall through to the membership lookup:
      -- that would let a tampered token downgrade into a valid session.
      RETURN NULL;
    END;
  END IF;

  SELECT m.org_id
    INTO resolved
    FROM public.memberships m
   WHERE m.user_id = auth.uid()
     AND m.is_active
   ORDER BY m.created_at
   LIMIT 1;

  RETURN resolved;
END;
$$;

-- ── is_org_member() ─────────────────────────────────────────────────────────
-- Does the caller actually belong to the org they are claiming? The JWT claim
-- is written by our own hook, but a policy that trusts a claim without
-- checking it against the table is trusting the token issuer completely.
CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.organizations o ON o.id = m.org_id
    WHERE m.user_id  = auth.uid()
      AND m.org_id   = check_org_id
      AND m.is_active
      AND o.status   = 'active'   -- a suspended org loses access, keeps data
  );
$$;

-- ── current_org_role() ──────────────────────────────────────────────────────
-- The caller's role IN THE CURRENT ORG. Replaces the repeated
-- `SELECT role FROM profiles WHERE id = auth.uid()` subquery that the existing
-- policies use — that one reads a global role and would be wrong the moment a
-- user is an Admin in one org and an Employee in another.
CREATE OR REPLACE FUNCTION public.current_org_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role
  FROM public.memberships m
  WHERE m.user_id = auth.uid()
    AND m.org_id  = public.current_org_id()
    AND m.is_active
  LIMIT 1;
$$;

-- ── is_platform_admin() ─────────────────────────────────────────────────────
-- Provided for the audited support functions ONLY. Do not reference this in
-- an RLS policy — see the box in section 3.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  );
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 5: get_visible_profile_ids — org-scoped
-- ───────────────────────────────────────────────────────────────────────────
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ WHY THIS FUNCTION HAD TO CHANGE                                         │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ It walks profiles.manager_id recursively with no org filter. One        │
-- │ profile whose manager_id points at a person in another org — a bad      │
-- │ import, a user who moved, a hand-edited row — and the tree walks        │
-- │ straight across the tenant boundary and returns their subordinates.     │
-- │                                                                          │
-- │ Both terms of the recursion are now filtered, not just the anchor.      │
-- │ Filtering only the anchor stops the first hop and nothing after it.     │
-- │                                                                          │
-- │ The Admin/AGM branch is likewise scoped: an Admin now sees every        │
-- │ profile IN THEIR OWN ORG, which is what that branch always meant.       │
-- └─────────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.get_visible_profile_ids(for_user_id UUID)
RETURNS TABLE (profile_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scope AS (
    SELECT public.current_org_id() AS org_id
  ),
  -- Everyone in the caller's org. Every branch below is restricted to this,
  -- so no path through this function can return a foreign profile.
  org_members AS (
    SELECT m.user_id, m.role
    FROM public.memberships m, scope s
    WHERE m.org_id = s.org_id
      AND m.is_active
  )

  -- Branch 1 — Admin / AGM see every profile in their own org
  SELECT om.user_id AS profile_id
  FROM org_members om
  WHERE EXISTS (
    SELECT 1 FROM org_members me
    WHERE me.user_id = for_user_id
      AND me.role IN ('Admin', 'AGM')
  )

  UNION

  -- Branch 2 — self + subordinates, never leaving the org
  SELECT tree.id AS profile_id
  FROM (
    WITH RECURSIVE subordinate_tree AS (
      SELECT p.id, p.manager_id
      FROM public.profiles p
      WHERE p.id = for_user_id
        AND p.id IN (SELECT user_id FROM org_members)

      UNION ALL

      SELECT child.id, child.manager_id
      FROM public.profiles child
      INNER JOIN subordinate_tree parent ON child.manager_id = parent.id
      -- The org check belongs HERE too. On the anchor alone it would stop
      -- one hop and let every hop after it cross freely.
      WHERE child.id IN (SELECT user_id FROM org_members)
    )
    SELECT id FROM subordinate_tree
  ) AS tree
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 6: org_id on the tenant tables
-- ───────────────────────────────────────────────────────────────────────────
-- DEFAULT public.current_org_id() is the lever that keeps the application
-- change small: an INSERT that names no org_id gets the caller's own. Most of
-- src/services/*.js therefore needs no edit at all.
--
-- The DEFAULT is NOT a security control — a client can still send an explicit
-- org_id. The WITH CHECK clauses in 023 are what stop that.
--
-- Backfill order per table: add nullable → fill with Accord → set NOT NULL.
-- Adding it NOT NULL in one step fails against existing rows.

DO $$
DECLARE
  t TEXT;
  tenant_tables TEXT[] := ARRAY[
    'leads', 'contacts', 'tasks', 'meetings', 'opportunities',
    'activities', 'notifications', 'email_messages', 'teams'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    -- Skip tables this deployment has not created (email_messages arrives in
    -- 018, opportunities in 010 — a partial install must not abort here).
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      RAISE NOTICE '022: skipping %, table not present', t;
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS org_id UUID', t);

    EXECUTE format(
      'UPDATE public.%I SET org_id = %L WHERE org_id IS NULL',
      t, '00000000-0000-0000-0000-000000000001');

    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN org_id SET DEFAULT public.current_org_id()', t);

    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN org_id SET NOT NULL', t);

    -- FK last: it validates the whole table, so it wants the data already right.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = t
        AND constraint_name = t || '_org_id_fkey'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (org_id)
           REFERENCES public.organizations(id) ON DELETE RESTRICT',
        t, t || '_org_id_fkey');
    END IF;

    -- ┌───────────────────────────────────────────────────────────────────┐
    -- │ org_id LEADS EVERY INDEX. This is the scalability answer.         │
    -- │ A shared-schema tenant model is fast only if the planner can drop │
    -- │ other tenants' rows before doing anything else. Trailing org_id   │
    -- │ cannot do that.                                                    │
    -- └───────────────────────────────────────────────────────────────────┘
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (org_id)', t || '_org_idx', t);
  END LOOP;
END $$;

-- ── Tables deliberately NOT given org_id ────────────────────────────────────
--
-- profiles                 — global identity; org comes from memberships.
--                            A column here would contradict the whole design.
-- user_preferences,
-- user_email_settings      — a person's own UI settings. They follow the
--                            person across orgs; scoping them would mean a
--                            user's theme resets when they switch tenant.
-- integration_accounts,
-- integration_credentials,
-- integration_oauth_states — a connected mailbox belongs to a USER, and the
--                            existing (user_id, provider, provider_account_id)
--                            key already isolates it. Revisit only if shared
--                            org-level mailboxes are ever built.
-- company_settings         — already keyed BY org_id. Nothing to add.
-- organizations,
-- memberships,
-- platform_admins          — the tenancy system itself.


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 7: RLS for the new tables
-- ───────────────────────────────────────────────────────────────────────────
-- The tenancy tables are policed here rather than in 023, because 023 is about
-- rewriting the EXISTING 53 and these have no previous version to reconcile.

-- Organizations: you can see an org you belong to. Nothing else.
DROP POLICY IF EXISTS "Members can read their organizations" ON public.organizations;
CREATE POLICY "Members can read their organizations"
  ON public.organizations FOR SELECT
  USING (public.is_org_member(id));

-- No INSERT / UPDATE / DELETE policy at all. Creating and suspending orgs is a
-- service-role operation — provisioning is not a thing an end user does, and a
-- table with no write policy cannot be written through PostgREST.

-- Memberships: you can see the roster of orgs you are in. This is what makes
-- the assignee dropdowns work, so it has to be readable by everyone.
DROP POLICY IF EXISTS "Members can read the roster" ON public.memberships;
CREATE POLICY "Members can read the roster"
  ON public.memberships FOR SELECT
  USING (public.is_org_member(org_id));

-- Only an Admin/AGM of THAT org may change membership. current_org_role() is
-- evaluated against current_org_id(), and the row's org must equal it —
-- otherwise an Admin of org A could edit the roster of org B.
DROP POLICY IF EXISTS "Org admins manage membership" ON public.memberships;
CREATE POLICY "Org admins manage membership"
  ON public.memberships FOR ALL
  USING (
    org_id = public.current_org_id()
    AND public.current_org_role() IN ('Admin', 'AGM')
  )
  WITH CHECK (
    org_id = public.current_org_id()
    AND public.current_org_role() IN ('Admin', 'AGM')
  );

-- platform_admins and platform_access_log: RLS enabled, ZERO policies. Same
-- pattern as the integration token table — reachable by service role only,
-- invisible to every client. Do not add a policy here.


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 8: The access-token hook
-- ───────────────────────────────────────────────────────────────────────────
-- Puts org_id into the JWT so current_org_id() costs nothing per query.
--
-- ⚠ CREATING THIS FUNCTION DOES NOT ENABLE IT. It must be selected in the
--   dashboard: Authentication → Hooks → Customize Access Token (JWT) Claims.
--   Until then current_org_id() uses its membership fallback, which is correct
--   for single-org users and arbitrary for multi-org ones.
--
-- Which org does a multi-org user get? The oldest active membership. An org
-- SWITCHER would set a preference this hook reads — deliberately not built
-- yet, because nobody holds two memberships today.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims   JSONB;
  the_org  UUID;
  the_role TEXT;
BEGIN
  claims := COALESCE(event -> 'claims', '{}'::jsonb);

  SELECT m.org_id, m.role
    INTO the_org, the_role
    FROM public.memberships m
    JOIN public.organizations o ON o.id = m.org_id
   WHERE m.user_id = (event ->> 'user_id')::uuid
     AND m.is_active
     AND o.status = 'active'
   ORDER BY m.created_at
   LIMIT 1;

  IF the_org IS NOT NULL THEN
    claims := jsonb_set(claims, '{org_id}',   to_jsonb(the_org::text));
    claims := jsonb_set(claims, '{org_role}', to_jsonb(the_role));
  END IF;

  -- A user with no membership gets a token with NO org claim, and
  -- current_org_id() then returns NULL, and every policy denies. Someone
  -- removed from every org loses access at their next token refresh without
  -- anyone having to remember to revoke anything.
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

GRANT SELECT ON public.memberships   TO supabase_auth_admin;
GRANT SELECT ON public.organizations TO supabase_auth_admin;


-- ═══════════════════════════════════════════════════════════════════════════
-- AFTER RUNNING THIS FILE
-- ═══════════════════════════════════════════════════════════════════════════
--   1. Run 022_verify.sql. Every check must pass.
--   2. Enable the hook: Authentication → Hooks → Customize Access Token.
--   3. Sign out and back in — existing sessions carry tokens with no org claim
--      until they refresh.
--   4. THEN 023, the policy rewrite. Tenants are not isolated until it lands.
-- ═══════════════════════════════════════════════════════════════════════════
