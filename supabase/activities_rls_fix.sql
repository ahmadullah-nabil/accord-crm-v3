-- ─── Activities RLS — Entity-Scoped History Visibility Fix ────────────────────
--
-- PROBLEM (before this patch)
-- ────────────────────────────
-- The old "Activities SELECT — role-scoped" policy gated visibility on
-- who WROTE the event (actor_id = auth.uid()). This broke organizational
-- memory continuity: when a lead was reassigned, the new assignee couldn't
-- see any history created by previous actors, even though they had full
-- access to the lead record itself.
--
-- CORRECT MODEL (this patch)
-- ──────────────────────────
-- Timeline visibility follows ENTITY access, not creator identity.
-- If you can see the entity (lead / opportunity / meeting / task / contact),
-- you can see ALL of its history, regardless of who wrote each event.
--
-- Implementation
-- ──────────────
-- The policy checks entity-level visibility using the same visibility rules
-- that already exist for leads, opportunities, tasks, meetings, and contacts:
--
--   Admin / AGM           → see ALL activities (fast path)
--   Manager               → see activities for entities owned by self or
--                           subordinates (via get_visible_profile_ids)
--   Employee / Executive  → see activities for entities assigned/owned by self
--
-- Entity linkage: activities.entity_type + activities.entity_id points to the
-- source record. The policy checks whether the current user has permission to
-- see that record using the same ownership signals:
--   leads        → owner_id, assignee
--   opportunities → owner_id, assignee
--   tasks        → assignee (stored as name)
--   meetings     → organizer (stored as name)
--   contacts     → authenticated (open read in current schema)
--
-- Backwards compatibility
-- ────────────────────────
-- Activities without entity_type / entity_id (legacy system events) fall back
-- to the old actor-based check so no history is unexpectedly hidden.
--
-- Run AFTER: rbac_rls.sql, activities_migration.sql, ownership_patch.sql

DROP POLICY IF EXISTS "Activities SELECT — role-scoped"    ON public.activities;
DROP POLICY IF EXISTS "Authenticated users can access activities" ON public.activities;

CREATE POLICY "Activities SELECT — entity-scoped history"
  ON public.activities
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (

      -- ── FAST PATH: Admin / AGM see everything ────────────────────────────
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('Admin', 'AGM')
      )

      -- ── ENTITY LINKED: visibility follows the parent entity ───────────────
      -- Lead activities: visible if the lead is visible to this user
      OR (
        entity_type = 'lead'
        AND entity_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.leads l
          WHERE l.id::text = activities.entity_id
            AND (
              l.owner_id = auth.uid()::text
              OR l.assignee = (SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1)
              OR l.owner_id IN (
                SELECT profile_id::text FROM public.get_visible_profile_ids(auth.uid())
              )
            )
        )
      )

      -- Opportunity activities: visible if the opportunity is visible
      OR (
        entity_type = 'opportunity'
        AND entity_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.opportunities o
          WHERE o.id::text = activities.entity_id
            AND (
              o.owner_id = auth.uid()::text
              OR o.assignee = (SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1)
              OR o.owner_id IN (
                SELECT profile_id::text FROM public.get_visible_profile_ids(auth.uid())
              )
            )
        )
      )

      -- Task activities: visible if the task is accessible to this user
      OR (
        entity_type = 'task'
        AND entity_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.tasks t
          WHERE t.id::text = activities.entity_id
            AND (
              t.assignee = (SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1)
              OR t.created_by = (SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1)
              OR t.assignee IN (
                SELECT p.name FROM public.profiles p
                WHERE p.id IN (
                  SELECT profile_id FROM public.get_visible_profile_ids(auth.uid())
                )
              )
            )
        )
      )

      -- Meeting activities: visible if the meeting is accessible
      OR (
        entity_type = 'meeting'
        AND entity_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.meetings m
          WHERE m.id::text = activities.entity_id
            AND (
              m.organizer = (SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1)
              OR m.created_by = (SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1)
              OR m.organizer IN (
                SELECT p.name FROM public.profiles p
                WHERE p.id IN (
                  SELECT profile_id FROM public.get_visible_profile_ids(auth.uid())
                )
              )
            )
        )
      )

      -- Contact activities: contacts are currently open-read for authenticated users
      OR (
        entity_type = 'contact'
        AND entity_id IS NOT NULL
        AND auth.role() = 'authenticated'
      )

      -- ── FALLBACK: unlinked system events (no entity_type / entity_id) ─────
      -- Legacy global activity log entries (e.g. app-level system events).
      -- Falls back to actor-based visibility so nothing is unexpectedly hidden.
      OR (
        entity_type IS NULL
        AND (
          actor_id = auth.uid()::text
          OR actor_id IN (
            SELECT profile_id::text FROM public.get_visible_profile_ids(auth.uid())
          )
          OR (actor_id IS NULL AND actor = (
            SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1
          ))
        )
      )

    )
  );

-- INSERT policy (unchanged — any authenticated user can log activities)
-- Already exists from rbac_rls.sql; safe to re-add as DROP IF EXISTS first.
DROP POLICY IF EXISTS "Activities INSERT — authenticated" ON public.activities;
CREATE POLICY "Activities INSERT — authenticated"
  ON public.activities
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ── Verification query ────────────────────────────────────────────────────────
-- Run this after applying to confirm the policy exists with the right name:
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename = 'activities'
-- ORDER BY cmd, policyname;
