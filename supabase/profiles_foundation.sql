-- ─── Accord CRM — Profiles Foundation Migration ───────────────────────────────
--
-- Run this FIRST, before profiles_team_patch.sql and any other migration.
-- Safe to re-run: uses IF NOT EXISTS throughout.
--
-- What this does
-- ──────────────
-- 1. Creates the `teams` lookup table
-- 2. Creates the `profiles` table linked to auth.users
-- 3. Adds RLS policies (read-all authenticated, write-own)
-- 4. Creates a trigger that auto-inserts a profile row whenever a new
--    Supabase auth user is created (so manual seeding is not required)
-- 5. Seeds profiles for any auth users that already exist but have no profile
--
-- Compatibility
-- ─────────────
-- Column names match exactly what authService.js / buildUser() already reads:
--   profile.name, profile.role, profile.avatar_url, profile.department,
--   profile.manager_id, profile.team_id, profile.updated_at
--
-- The app's upsertProfile() writes: id, name, department, updated_at
-- All other columns are nullable / have defaults so upsertProfile continues
-- to work without any code changes.

-- ── 0. Extension ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. Teams table ────────────────────────────────────────────────────────────
-- Created before profiles because profiles.team_id references it.
CREATE TABLE IF NOT EXISTS public.teams (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT        DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index lets us do ON CONFLICT (name) DO NOTHING for idempotent seeding
CREATE UNIQUE INDEX IF NOT EXISTS teams_name_idx ON public.teams (name);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read teams" ON public.teams;
CREATE POLICY "Authenticated users can read teams"
  ON public.teams FOR SELECT
  USING (auth.role() = 'authenticated');

-- Seed the four CRM departments as teams
INSERT INTO public.teams (name, description)
VALUES
  ('Leadership',  'Executive and admin leadership'),
  ('Sales',       'Sales and account management'),
  ('Engineering', 'Product and engineering'),
  ('Operations',  'Operations and support')
ON CONFLICT (name) DO NOTHING;

-- ── 2. Profiles table ─────────────────────────────────────────────────────────
-- One row per Supabase auth.users entry.
-- Primary key is the auth user UUID — no separate sequence needed.
CREATE TABLE IF NOT EXISTS public.profiles (
  -- FK to Supabase auth.users; cascade delete cleans up profiles automatically
  id          UUID        PRIMARY KEY
                          REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  name        TEXT        DEFAULT '',
  email       TEXT        DEFAULT '',   -- denormalised for convenience (kept in sync by trigger)

  -- Role system
  -- Values must match ROLES constants in src/lib/users.js
  -- ('Admin' | 'AGM' | 'Manager' | 'Executive' | 'Employee')
  role        TEXT        NOT NULL DEFAULT 'Employee',

  -- Organisational placement
  department  TEXT        DEFAULT '',
  phone       TEXT        DEFAULT '',
  avatar_url  TEXT,

  -- Hierarchy (self-referential; NULL = top of tree)
  manager_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Team membership (NULL = unassigned)
  team_id     UUID        REFERENCES public.teams(id)    ON DELETE SET NULL,

  -- Soft-delete flag — false hides the member from dropdowns
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,

  -- Timestamps
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS profiles_manager_id_idx ON public.profiles (manager_id);
CREATE INDEX IF NOT EXISTS profiles_team_id_idx    ON public.profiles (team_id);
CREATE INDEX IF NOT EXISTS profiles_role_idx       ON public.profiles (role);
CREATE INDEX IF NOT EXISTS profiles_is_active_idx  ON public.profiles (is_active);
CREATE INDEX IF NOT EXISTS profiles_email_idx      ON public.profiles (lower(email));

-- ── 4. Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read all profiles
-- (needed so assignment dropdowns can show all team members)
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- A user can only INSERT their own profile row
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- A user can only UPDATE their own profile row
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING     (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update any profile row (needed for User Management page)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS admin_row
      WHERE  admin_row.id   = auth.uid()
        AND  admin_row.role = 'Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles AS admin_row
      WHERE  admin_row.id   = auth.uid()
        AND  admin_row.role = 'Admin'
    )
  );

-- ── 5. Auto-create trigger ────────────────────────────────────────────────────
-- Fires on every INSERT into auth.users (new signup).
-- Extracts name from user_metadata (set during signUp({ options: { data: { name } } }))
-- and creates the profile row automatically.
-- The app's upsertProfile() call in authStore.signup() is a belt-and-suspenders
-- fallback in case this trigger is not present.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER           -- runs with owner privileges so it can write to profiles
SET search_path = public   -- prevent search_path injection
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    -- Pull name from user_metadata if the client sent it during signUp()
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), ''),
    'Employee',              -- default role; admins can elevate later
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;  -- idempotent: won't overwrite if row already exists
  RETURN NEW;
END;
$$;

-- Drop and recreate the trigger so this script is safe to re-run
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── 6. Back-fill existing auth users ──────────────────────────────────────────
-- If there are already auth users without profile rows (e.g. users created
-- before this migration was run), insert minimal profile rows for them now.
-- ON CONFLICT DO NOTHING makes this idempotent.
INSERT INTO public.profiles (id, email, name, role, created_at, updated_at)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1), ''),
  'Employee',
  COALESCE(u.created_at, NOW()),
  NOW()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- ── 7. Verify ─────────────────────────────────────────────────────────────────
-- After running, check with:
--
-- SELECT id, email, name, role, department, manager_id, team_id, is_active
-- FROM public.profiles;
--
-- You should see one row per auth user, all with role = 'Employee' and
-- is_active = TRUE. Elevate roles manually in the Table Editor as needed.
--
-- To set Alex Rivera as Admin:
--   UPDATE public.profiles SET role = 'Admin' WHERE email = 'admin@nexuscrm.io';
-- To set Jordan Kim as AGM:
--   UPDATE public.profiles SET role = 'AGM' WHERE email = 'agm@nexuscrm.io';
-- To wire hierarchy (Morgan reports to Jordan):
--   UPDATE public.profiles
--     SET manager_id = (SELECT id FROM profiles WHERE email = 'agm@nexuscrm.io')
--   WHERE email = 'manager@nexuscrm.io';
