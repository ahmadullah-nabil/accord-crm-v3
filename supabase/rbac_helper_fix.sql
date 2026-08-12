-- ─── Fix: get_visible_profile_ids — correct recursive CTE ────────────────────
--
-- Replaces the broken version in rbac_rls.sql Section 1.
-- Run this BEFORE running the rest of rbac_rls.sql, OR run this standalone
-- if the rest of the file already applied successfully.
--
-- Root cause of the original error
-- ──────────────────────────────────
-- PostgreSQL requires the RECURSIVE keyword any time a WITH clause refers to
-- itself (directly or indirectly). The original code used two separate CTEs
-- (me + subordinates) and then combined them with UNION in the SELECT — but
-- `subordinates` was recursive (self-referential) without RECURSIVE being
-- declared. Postgres rejected it with "relation subordinates does not exist".
--
-- The fix: one single WITH RECURSIVE block where the anchor (direct reports)
-- and the recursive step (reports-of-reports) are expressed as a standard
-- UNION ALL inside a single named CTE.

CREATE OR REPLACE FUNCTION public.get_visible_profile_ids(for_user_id UUID)
RETURNS TABLE (profile_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Fast path: Admin / AGM see every profile
  -- This branch is evaluated first; if it returns rows the second branch is
  -- still evaluated (SQL UNION) but Postgres will short-circuit in the policy
  -- USING clause via OR.
  SELECT p.id AS profile_id
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = for_user_id
      AND me.role IN ('Admin', 'AGM')
  )

  UNION

  -- Hierarchy path: self + all subordinates via a proper recursive CTE
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
