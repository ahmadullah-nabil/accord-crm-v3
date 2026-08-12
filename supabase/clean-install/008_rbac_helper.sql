-- ═══════════════════════════════════════════════════════════════════════════
-- 008 — RBAC HELPER FUNCTION
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : 8 of 15
-- DEPENDS ON: 001 (public.profiles must exist — the body is validated at
--             CREATE time, so this file fails immediately if profiles is absent)
-- SOURCE    : supabase/rbac_helper_fix.sql  (the CORRECTED implementation)
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ This is the ONLY definition of get_visible_profile_ids() in the package.│
-- │                                                                          │
-- │ The original rbac_rls.sql Section 1 contained an earlier, broken version │
-- │ that referenced a self-referential CTE without the RECURSIVE keyword.    │
-- │ PostgreSQL validates SQL-language function bodies at creation time, so   │
-- │ that statement always failed with:                                       │
-- │      relation "subordinates" does not exist                              │
-- │ and — because the Supabase SQL Editor runs a script inside a single      │
-- │ transaction — it rolled back every policy in the rest of that file.      │
-- │                                                                          │
-- │ The broken version is NOT included anywhere in this package.             │
-- │ File 009 contains only Sections 2–7 of the original rbac_rls.sql.        │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- WHAT THE FUNCTION RETURNS
-- ─────────────────────────
--   Admin / AGM              → every profile id in the system
--   Manager / Executive / Employee
--                            → own id + every subordinate id, resolved
--                              recursively down the profiles.manager_id tree
--
-- SECURITY DEFINER is required: the function reads public.profiles from inside
-- RLS policy expressions on other tables, and must not be re-filtered by them.
-- SET search_path = public prevents search_path injection.
-- STABLE lets PostgreSQL cache the result within a single query.
--
-- Performance: profiles is small (< 1000 rows in a typical CRM) and
-- profiles_manager_id_idx (created in file 001) serves the recursive join.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_visible_profile_ids(for_user_id UUID)
RETURNS TABLE (profile_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Branch 1 — Admin / AGM see every profile
  SELECT p.id AS profile_id
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = for_user_id
      AND me.role IN ('Admin', 'AGM')
  )

  UNION

  -- Branch 2 — self + all subordinates, via a correctly declared
  -- WITH RECURSIVE block wrapped in a subquery
  SELECT tree.id AS profile_id
  FROM (
    WITH RECURSIVE subordinate_tree AS (
      -- Anchor: the requesting user themselves
      SELECT id, manager_id
      FROM public.profiles
      WHERE id = for_user_id

      UNION ALL

      -- Recursive step: each direct report of a node already in the tree
      SELECT child.id, child.manager_id
      FROM public.profiles child
      INNER JOIN subordinate_tree parent ON child.manager_id = parent.id
    )
    SELECT id FROM subordinate_tree
  ) AS tree
$$;
