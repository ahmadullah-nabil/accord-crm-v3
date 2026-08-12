-- ─── Accord CRM — RBAC / RLS Foundation ──────────────────────────────────────
--
-- READ-ONLY scope enforcement. INSERT / UPDATE / DELETE remain unrestricted
-- (auth.role() = 'authenticated') as per the safe rollout plan.
--
-- Run AFTER:
--   1. profiles_foundation.sql
--   2. leads_migration.sql + tasks_migration.sql + meetings_migration.sql
--   3. activities_migration.sql
--   4. ownership_patch.sql  (adds owner_id, created_by, actor_id columns)
--
-- Access model
-- ────────────
-- Admin / AGM  → sees ALL records in every table
-- Manager      → sees own records + every subordinate's records (recursive)
-- Employee     → sees only records where they are the owner / assignee
--
-- "Seeing" a record means any of:
--   • leads.owner_id        = auth.uid()::text
--   • tasks.assignee        = current user's display name (via profiles.name)
--   • meetings.organizer    = current user's display name (via profiles.name)
--   • activities.actor_id   = auth.uid()::text
--   • The record belongs to a subordinate (resolved via recursive CTE)
--
-- Safe rollout guarantee
-- ──────────────────────
-- Every USING clause starts with an OR branch that passes if the user is
-- 'Admin' or 'AGM' (checked via a fast profiles lookup).
-- This means a misconfigured hierarchy can never lock an admin out.
--
-- Graceful degradation
-- ──────────────────────
-- If owner_id / assignee / actor_id columns are NULL (old rows created before
-- ownership_patch.sql was run), the policy falls through to the name-based
-- check or returns no rows rather than erroring.
-- The app services all catch errors and surface them via isError so the UI
-- shows a retry button instead of crashing.

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: Shared helper function
-- ─────────────────────────────────────────────────────────────────────────────

-- Returns the set of profile ids that are visible to a given user.
-- Used by every RLS USING clause via a subquery.
--
-- Performance: the recursive CTE is evaluated once per policy check and
-- Postgres caches the result within a single query. The profiles table is
-- small (< 1000 rows in any typical CRM), so the CTE cost is negligible.
-- Indexes on profiles.manager_id and profiles.role are used automatically.
CREATE OR REPLACE FUNCTION public.get_visible_profile_ids(for_user_id UUID)
RETURNS TABLE (profile_id UUID)
LANGUAGE sql
STABLE        -- result is stable within a single transaction
SECURITY DEFINER  -- reads profiles without requiring a separate RLS bypass
SET search_path = public
AS $$
  WITH
  -- Step 1: get the current user's own profile
  me AS (
    SELECT id, role, name
    FROM public.profiles
    WHERE id = for_user_id
    LIMIT 1
  ),
  -- Step 2: build the full subordinate tree using BFS
  subordinates AS (
    -- Base case: direct reports
    SELECT p.id
    FROM public.profiles p
    JOIN me ON p.manager_id = me.id

    UNION ALL

    -- Recursive case: reports of reports
    SELECT p.id
    FROM public.profiles p
    JOIN subordinates s ON p.manager_id = s.id
  )
  -- Admin / AGM: return ALL profile ids
  SELECT p.id AS profile_id
  FROM public.profiles p
  WHERE EXISTS (SELECT 1 FROM me WHERE me.role IN ('Admin', 'AGM'))

  UNION

  -- Manager / Everyone: return self + subordinates
  SELECT me.id AS profile_id FROM me
  UNION
  SELECT s.id AS profile_id FROM subordinates
$$;

-- Index to make the manager_id lookup in the recursive CTE fast
CREATE INDEX IF NOT EXISTS profiles_manager_id_idx ON public.profiles (manager_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: Leads RLS
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the old blanket policy
DROP POLICY IF EXISTS "Authenticated users can access leads" ON public.leads;

-- SELECT: role-aware visibility
-- A lead is visible when ANY of these is true:
--   (a) The user is Admin/AGM → all leads
--   (b) The lead's owner_id matches auth.uid() (the creating user)
--   (c) The lead's assignee matches the user's display name
--   (d) The lead's owner_id belongs to a visible subordinate
CREATE POLICY "Leads SELECT — role-scoped"
  ON public.leads
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      -- Admin / AGM shortcut (fast path — avoids the CTE)
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('Admin', 'AGM')
      )
      -- Owner match (UUID comparison — leads.owner_id is TEXT, cast needed)
      OR (owner_id IS NOT NULL AND owner_id = auth.uid()::text)
      -- Assignee name match (fallback for rows without owner_id)
      OR assignee = (
        SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1
      )
      -- Subordinate visibility (manager sees their team's leads)
      OR (
        owner_id IS NOT NULL
        AND owner_id::uuid IN (
          SELECT profile_id FROM public.get_visible_profile_ids(auth.uid())
        )
      )
    )
  );

-- INSERT: unrestricted (any authenticated user can create leads)
CREATE POLICY "Leads INSERT — authenticated"
  ON public.leads
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: unrestricted for now (owner-only enforcement is a future phase)
CREATE POLICY "Leads UPDATE — authenticated"
  ON public.leads
  FOR UPDATE
  USING     (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- DELETE: unrestricted for now
CREATE POLICY "Leads DELETE — authenticated"
  ON public.leads
  FOR DELETE
  USING (auth.role() = 'authenticated');


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: Tasks RLS
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can access tasks" ON public.tasks;

-- Tasks have no owner_id — visibility is based on:
--   (a) Admin/AGM → all tasks
--   (b) assignee name matches the user's profile name
--   (c) created_by name matches the user's profile name
--   (d) The task belongs to a visible subordinate (by assignee name)
CREATE POLICY "Tasks SELECT — role-scoped"
  ON public.tasks
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('Admin', 'AGM')
      )
      OR assignee = (
        SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1
      )
      OR created_by = (
        SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1
      )
      -- Manager: see tasks assigned to any visible team member
      OR assignee IN (
        SELECT p.name
        FROM public.profiles p
        WHERE p.id IN (
          SELECT profile_id FROM public.get_visible_profile_ids(auth.uid())
        )
      )
    )
  );

CREATE POLICY "Tasks INSERT — authenticated"
  ON public.tasks
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Tasks UPDATE — authenticated"
  ON public.tasks
  FOR UPDATE
  USING     (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Tasks DELETE — authenticated"
  ON public.tasks
  FOR DELETE
  USING (auth.role() = 'authenticated');


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: Meetings RLS
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can access meetings" ON public.meetings;

-- Meetings have no owner_id — visibility based on organizer name and created_by.
CREATE POLICY "Meetings SELECT — role-scoped"
  ON public.meetings
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('Admin', 'AGM')
      )
      OR organizer = (
        SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1
      )
      OR created_by = (
        SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1
      )
      -- Participant visibility: user is in the participants array
      OR auth.uid()::text = ANY(
        SELECT p.id::text
        FROM public.profiles p
        WHERE p.name = ANY(participants)
          AND p.id IN (
            SELECT profile_id FROM public.get_visible_profile_ids(auth.uid())
          )
      )
      -- Manager: see meetings organized by visible team members
      OR organizer IN (
        SELECT p.name
        FROM public.profiles p
        WHERE p.id IN (
          SELECT profile_id FROM public.get_visible_profile_ids(auth.uid())
        )
      )
    )
  );

CREATE POLICY "Meetings INSERT — authenticated"
  ON public.meetings
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Meetings UPDATE — authenticated"
  ON public.meetings
  FOR UPDATE
  USING     (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Meetings DELETE — authenticated"
  ON public.meetings
  FOR DELETE
  USING (auth.role() = 'authenticated');


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: Activities RLS
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can access activities" ON public.activities;

-- Activities: visible if the actor is yourself or a visible team member.
-- actor_id is TEXT (UUID stored as text) from ownership_patch.sql.
CREATE POLICY "Activities SELECT — role-scoped"
  ON public.activities
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('Admin', 'AGM')
      )
      OR actor_id = auth.uid()::text
      OR actor_id IN (
        SELECT profile_id::text
        FROM public.get_visible_profile_ids(auth.uid())
      )
      -- Fallback: actor name matches for rows without actor_id
      OR (actor_id IS NULL AND actor = (
        SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1
      ))
    )
  );

-- Activities are append-only — no UPDATE or DELETE policies needed.
-- Only INSERT is allowed (the service never updates or deletes activity rows).
CREATE POLICY "Activities INSERT — authenticated"
  ON public.activities
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6: Contacts RLS (if contacts table exists)
-- ─────────────────────────────────────────────────────────────────────────────
-- Contacts use a simpler model: all authenticated users can read all contacts.
-- Visibility scoping for contacts is a future phase (contacts don't have
-- owner_id in the current schema).
DROP POLICY IF EXISTS "Authenticated users can access contacts" ON public.contacts;

CREATE POLICY "Contacts SELECT — authenticated"
  ON public.contacts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Contacts INSERT — authenticated"
  ON public.contacts FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Contacts UPDATE — authenticated"
  ON public.contacts FOR UPDATE
  USING     (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Contacts DELETE — authenticated"
  ON public.contacts FOR DELETE
  USING (auth.role() = 'authenticated');


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7: Verify
-- ─────────────────────────────────────────────────────────────────────────────
-- After running, check active policies with:
--
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('leads','tasks','meetings','activities','contacts')
-- ORDER BY tablename, cmd;
--
-- To test as a specific user (requires service_role key in psql):
-- SET LOCAL role = authenticated;
-- SET LOCAL request.jwt.claim.sub = '<user-uuid-here>';
-- SELECT * FROM leads;   -- should return only their visible records
