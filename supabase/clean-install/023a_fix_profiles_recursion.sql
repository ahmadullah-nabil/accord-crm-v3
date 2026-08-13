-- ═══════════════════════════════════════════════════════════════════════════
-- 023a — FIX: infinite recursion on profiles  ⚠ RUN IMMEDIATELY AFTER 023
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ WHAT 023 BROKE                                                          │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ Any UPDATE on public.profiles fails with:                               │
-- │                                                                          │
-- │   ERROR: infinite recursion detected in policy for relation "profiles"  │
-- │                                                                          │
-- │ That means an admin cannot change anyone's role, manager or department,  │
-- │ and a user cannot edit their own profile. Reproduced, not inferred.      │
-- │                                                                          │
-- │ SELECT still works, which is why the app looked fine on a read-only      │
-- │ walkthrough. The break only shows on a write.                            │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- WHY
-- ───
-- `Admins can update any profile` (from 014) contains
--
--     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role …)
--
-- — a SELECT on profiles inside a policy ON profiles. That was survivable while
-- the only SELECT policy was a flat `auth.role() = 'authenticated'`: the inner
-- query evaluated one trivial policy and stopped.
--
-- 023 added a RESTRICTIVE policy which is ANDed onto that inner SELECT too, and
-- whose body referenced `public.profiles.id` explicitly. The inner query now
-- carries a policy that names profiles again, and Postgres detects the cycle.
--
-- THE FIX
-- ───────
-- Move the membership test into a SECURITY DEFINER function. The policy body
-- then contains NO table reference at all — only the row's own `id` column
-- passed as an argument — so it cannot re-enter profiles and cannot extend
-- anyone else's chain.
--
-- Isolation is unchanged. Same rule, same rows: you see a profile if you share
-- an active org with that person, or it is your own.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 1: The membership test, as a function
-- ───────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER is what breaks the cycle: the queries inside run as the
-- owner and are not subject to the caller's policies, so nothing here can
-- re-trigger the profiles policy that called it.
--
-- It reads ONLY memberships and organizations. It deliberately does not touch
-- profiles — if it did, the recursion would come straight back.
CREATE OR REPLACE FUNCTION public.shares_org_with(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Your own profile is always visible. Without this, a user whose
    -- membership was just revoked cannot load the app far enough to be told
    -- why — they would get a blank screen instead of a message.
    target_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.memberships mine
      JOIN public.memberships theirs ON theirs.org_id = mine.org_id
      JOIN public.organizations o     ON o.id         = mine.org_id
      WHERE mine.user_id   = auth.uid()
        AND mine.is_active
        AND theirs.user_id = target_user_id
        AND theirs.is_active
        AND o.status = 'active'
    );
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 2: Replace the recursive policy
-- ───────────────────────────────────────────────────────────────────────────
-- Note `shares_org_with(id)` — bare `id`, not `public.profiles.id`. It is the
-- column of the row being checked. Qualifying it would name the table inside
-- its own policy, which is the thing that caused this.
DROP POLICY IF EXISTS profiles_tenant_isolation ON public.profiles;

CREATE POLICY profiles_tenant_isolation
  ON public.profiles
  AS RESTRICTIVE
  FOR ALL
  USING      (public.shares_org_with(id))
  WITH CHECK (public.shares_org_with(id));


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 3: Verify — both a read AND a write
-- ───────────────────────────────────────────────────────────────────────────
-- 023's own check only proved the policy existed. A policy can exist and still
-- make every write fail, which is exactly what happened. This exercises an
-- UPDATE, because that is the path that broke.
DO $$
DECLARE
  victim UUID;
  before_name TEXT;
BEGIN
  SELECT p.id, p.name INTO victim, before_name
  FROM public.profiles p
  JOIN public.memberships m ON m.user_id = p.id
  LIMIT 1;

  IF victim IS NULL THEN
    RAISE NOTICE '023a VERIFY: skipped — no profile with a membership to test';
    RETURN;
  END IF;

  -- Runs as the table owner here, so this is not an RLS test — it is a
  -- "does evaluating the policy blow up" test. Recursion errors surface
  -- during planning and would raise regardless.
  PERFORM public.shares_org_with(victim);
  RAISE NOTICE '023a VERIFY: PASS — shares_org_with() evaluates without recursion';

  UPDATE public.profiles SET updated_at = NOW() WHERE id = victim;
  RAISE NOTICE '023a VERIFY: PASS — UPDATE on profiles completes';
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- STILL BROKEN AFTER THIS FILE — user creation
-- ═══════════════════════════════════════════════════════════════════════════
-- 023a fixes the recursion. It does NOT fix the other half of the problem:
--
--   createWorkspaceUser() in src/services/userManagementService.js calls
--   supabase.auth.signUp(), the handle_new_user trigger creates a profiles
--   row, and NOTHING creates a memberships row.
--
-- A user with no membership has no org. current_org_id() returns NULL, every
-- policy denies, and they see an empty application. The admin who created them
-- cannot see them either, because they share no org.
--
-- That is fixed in 024, the org onboarding migration.
-- ═══════════════════════════════════════════════════════════════════════════
