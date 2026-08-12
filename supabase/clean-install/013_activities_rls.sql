-- ═══════════════════════════════════════════════════════════════════════════
-- 013 — ACTIVITIES RLS: ENTITY-SCOPED HISTORY
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : 13 of 15
-- DEPENDS ON: 001 (profiles), 003 (leads), 004 (tasks), 005 (meetings),
--             006 (activities), 007 (owner_id / created_by / actor_id TEXT),
--             008 (get_visible_profile_ids), 009 (the interim policies this
--             file drops), 010 (opportunities — referenced in the policy body)
-- SOURCE    : supabase/activities_rls_fix.sql
--
-- This is the most dependency-heavy file in the package. Its policy expression
-- references columns on five different tables plus the RBAC helper function,
-- and PostgreSQL validates all of them at CREATE POLICY time.
--
-- PROBLEM THIS FIXES
-- ──────────────────
-- The interim policy from file 009 gated visibility on who WROTE the event
-- (actor_id = auth.uid()). That broke organisational memory: when a lead was
-- reassigned, the new assignee could not see any history written by previous
-- actors, even though they had full access to the lead record itself.
--
-- CORRECT MODEL
-- ─────────────
-- Timeline visibility follows ENTITY access, not creator identity. If you can
-- see the entity, you can see ALL of its history regardless of who wrote it.
--
--   Admin / AGM          → all activities (fast path)
--   Manager              → activities for entities owned by self or by any
--                          subordinate (via get_visible_profile_ids)
--   Employee / Executive → activities for entities assigned/owned by self
--
-- Ownership signals per entity type:
--   leads         → owner_id, assignee
--   opportunities → owner_id, assignee
--   tasks         → assignee, created_by   (display names)
--   meetings      → organizer, created_by  (display names)
--   contacts      → open read for authenticated users (current schema)
--
-- BACKWARDS COMPATIBILITY
-- ───────────────────────
-- Activities with no entity_type (legacy/system events) fall back to the
-- actor-based check, so no history is unexpectedly hidden.
--
-- Activities remain APPEND-ONLY: this file creates SELECT and INSERT policies
-- and nothing else. No UPDATE or DELETE policy exists on this table anywhere
-- in the package, which is why the services can never mutate history.
--
-- The DROP statements omit "IF EXISTS" so that a broken install order fails
-- loudly instead of leaving the permissive interim policy silently in place —
-- that particular failure mode would be a security regression, not an
-- inconvenience.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY "Activities SELECT — role-scoped"  ON public.activities;
DROP POLICY "Activities INSERT — authenticated" ON public.activities;

CREATE POLICY "Activities SELECT — entity-scoped history"
  ON public.activities
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (

      -- ── FAST PATH: Admin / AGM see everything ───────────────────────────
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('Admin', 'AGM')
      )

      -- ── LEAD activities: visible if the lead is visible ─────────────────
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

      -- ── OPPORTUNITY activities ──────────────────────────────────────────
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

      -- ── TASK activities ─────────────────────────────────────────────────
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

      -- ── MEETING activities ──────────────────────────────────────────────
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

      -- ── CONTACT activities: contacts are open-read in this schema ───────
      OR (
        entity_type = 'contact'
        AND entity_id IS NOT NULL
        AND auth.role() = 'authenticated'
      )

      -- ── FALLBACK: unlinked system events ────────────────────────────────
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

-- INSERT is unchanged from file 009 — any authenticated user may log activity.
CREATE POLICY "Activities INSERT — authenticated"
  ON public.activities
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
