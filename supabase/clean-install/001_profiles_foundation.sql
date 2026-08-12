-- ═══════════════════════════════════════════════════════════════════════════
-- 001 — PROFILES FOUNDATION
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : 1 of 15 (first)
-- DEPENDS ON: Supabase built-in auth.users only
-- SOURCE    : supabase/profiles_foundation.sql
--
-- WHAT THIS FILE DOES
-- ───────────────────
--   1. Creates public.teams and seeds the four organisational teams
--   2. Creates public.profiles, keyed 1:1 to auth.users
--   3. Enables RLS and installs the profiles/teams read-write policies
--   4. Installs handle_new_user() + the on_auth_user_created trigger so every
--      new Supabase Auth signup automatically receives a profile row
--   5. Back-fills profile rows for any auth.users that already exist
--
-- ROLE VALUES (application-level, stored in profiles.role — NOT Postgres roles)
--   'Admin' | 'AGM' | 'Manager' | 'Executive' | 'Employee'
--   These must match the ROLES constants in src/lib/users.js
--
-- COLUMN CONTRACT — read by src/services/teamService.js and authService.js:
--   id, name, email, role, department, manager_id, team_id,
--   is_active, phone, avatar_url, created_at, updated_at
--
-- NOTE ON EXTENSIONS
-- ──────────────────
-- Every table in this package uses gen_random_uuid(), which is built into
-- PostgreSQL 13+ and needs no extension. The original migrations declared
-- "uuid-ossp" in six separate files but never called uuid_generate_v4().
-- It is declared once here to preserve the original project's intent.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ───────────────────────────────────────────────────────────────────────────
-- 1. TEAMS
-- Created before profiles because profiles.team_id references it.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE public.teams (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT        DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index on name enables the idempotent ON CONFLICT seed below
CREATE UNIQUE INDEX teams_name_idx ON public.teams (name);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read teams"
  ON public.teams FOR SELECT
  USING (auth.role() = 'authenticated');

-- Reference data (NOT demo data): the four organisational teams.
-- src/services/teamService.js getTeams() reads these for the team dropdown.
INSERT INTO public.teams (name, description)
VALUES
  ('Leadership',  'Executive and admin leadership'),
  ('Sales',       'Sales and account management'),
  ('Engineering', 'Product and engineering'),
  ('Operations',  'Operations and support')
ON CONFLICT (name) DO NOTHING;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. PROFILES
-- One row per auth.users entry. Primary key IS the auth user UUID.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  -- FK to Supabase auth.users; cascade delete cleans up profiles automatically
  id          UUID        PRIMARY KEY
                          REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  name        TEXT        DEFAULT '',
  email       TEXT        DEFAULT '',   -- denormalised; populated by the trigger

  -- Application role system
  role        TEXT        NOT NULL DEFAULT 'Employee',

  -- Organisational placement
  department  TEXT        DEFAULT '',
  phone       TEXT        DEFAULT '',
  avatar_url  TEXT,

  -- Hierarchy (self-referential; NULL = top of tree)
  -- Walked recursively by get_visible_profile_ids() in file 008.
  manager_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Team membership (NULL = unassigned)
  team_id     UUID        REFERENCES public.teams(id) ON DELETE SET NULL,

  -- Soft-delete flag — false hides the member from assignee dropdowns
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ───────────────────────────────────────────────────────────────────────────
-- 3. INDEXES
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX profiles_manager_id_idx ON public.profiles (manager_id);
CREATE INDEX profiles_team_id_idx    ON public.profiles (team_id);
CREATE INDEX profiles_role_idx       ON public.profiles (role);
CREATE INDEX profiles_is_active_idx  ON public.profiles (is_active);
CREATE INDEX profiles_email_idx      ON public.profiles (lower(email));


-- ───────────────────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read all profiles.
-- Required so assignee dropdowns can list every team member, and so the
-- Admin/AGM fast-path subqueries in files 009/010/013 can resolve.
CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- A user can only INSERT their own profile row.
-- Used by authService.upsertProfile() as a fallback when the trigger is absent.
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- A user can only UPDATE their own profile row.
-- WITH CHECK is required so a user cannot rewrite the row into someone else's id.
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING      (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update any profile row — required by the User Management page.
-- Re-asserted verbatim by file 014.
--
-- This subquery reads public.profiles from inside a public.profiles policy.
-- That is safe here only because the SELECT policy above is unconditional
-- (auth.role() = 'authenticated') and therefore cannot recurse into this one.
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


-- ───────────────────────────────────────────────────────────────────────────
-- 5. AUTO-CREATE TRIGGER
-- Fires on every INSERT into auth.users (new signup) and creates the
-- matching profile row. Reads the name from raw_user_meta_data, which
-- authService.signUpWithEmail() populates via options.data.name.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER          -- runs as owner so it can write to profiles under RLS
SET search_path = public  -- prevents search_path injection
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), ''),
    'Employee',             -- default role; elevate to Admin manually (see README)
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ───────────────────────────────────────────────────────────────────────────
-- 6. BACK-FILL EXISTING AUTH USERS
-- No-op on a brand-new project (auth.users is empty). Retained so this file
-- stays correct if an admin created users in the dashboard before migrating.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO public.profiles (id, email, name, role, created_at, updated_at)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1), ''),
  'Employee',
  COALESCE(u.created_at, NOW()),
  NOW()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
