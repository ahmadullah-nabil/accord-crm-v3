-- ═══════════════════════════════════════════════════════════════════════════
-- 014 — PROFILES ADMIN UPDATE POLICY (re-assertion)
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : 14 of 15
-- DEPENDS ON: 001 (profiles, and the policy of the same name created there)
-- SOURCE    : supabase/profiles_admin_update_policy.sql
--
-- WHY THIS POLICY EXISTS
-- ──────────────────────
-- "Users can update own profile" restricts every UPDATE to the caller's own
-- row (auth.uid() = id). On its own that silently blocks Admins from editing
-- other users via the User Management page: Supabase returns data:null and
-- error:null (zero rows matched), so the UI appears to save while nothing
-- changes in the database.
--
-- PostgreSQL evaluates multiple permissive policies with OR, so adding this
-- second UPDATE policy grants Admins access without weakening the first.
--   Regular users → can still update only their own row
--   Admin users   → can update ANY row
--
-- WHY IT IS DECLARED TWICE IN THIS PACKAGE
-- ────────────────────────────────────────
-- File 001 creates it so that public.profiles is complete and functional the
-- moment the foundation is installed. This file re-asserts the identical
-- definition as the final authority, preserving the original repository's
-- structure where this was a standalone corrective migration.
--
-- The DROP + CREATE pair makes the net result exactly ONE policy of this name,
-- not two. Run order matters: this must come after 001, never before.
-- Written without "IF EXISTS" so a missing file 001 fails loudly.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY "Admins can update any profile" ON public.profiles;

CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM   public.profiles AS admin_row
      WHERE  admin_row.id   = auth.uid()
        AND  admin_row.role = 'Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.profiles AS admin_row
      WHERE  admin_row.id   = auth.uid()
        AND  admin_row.role = 'Admin'
    )
  );
