-- ─── Profiles — Admin UPDATE Policy Fix ──────────────────────────────────────
--
-- Problem: The existing "Users can update own profile" policy restricts
-- all UPDATE operations to the user's own row (auth.uid() = id).
-- This silently blocks Admin users from editing other users' profiles
-- via the User Management page — Supabase returns data:null, error:null
-- (zero rows matched) rather than an error, causing the UI to appear to
-- save without anything changing in the database.
--
-- Fix: Add a second UPDATE policy for Admin-role users.
-- Postgres RLS evaluates policies with OR logic — a row is accessible if
-- ANY applicable policy's USING clause returns true.
--
-- After this runs:
--   • Regular users: can still update only their own profile row
--   • Admin users: can update ANY profile row
--
-- Run this in the Supabase SQL Editor for the change to take effect
-- on the live database. The profiles_foundation.sql file has also been
-- updated so future fresh deploys include this policy automatically.

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

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

-- Verify: after running, this should return two UPDATE policies:
-- SELECT policyname, cmd, qual
-- FROM   pg_policies
-- WHERE  tablename = 'profiles' AND cmd = 'UPDATE';
