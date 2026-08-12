-- ─── Accord CRM — Profiles & Teams Schema ─────────────────────────────────────
--
-- Run AFTER the initial profiles table is created by the auth trigger.
-- Safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
--
-- Architecture
-- ────────────
-- profiles  = one row per Supabase Auth user (created by on_auth_user_created trigger)
-- teams     = organisational units (Sales, Engineering, etc.)
-- profiles.manager_id → profiles.id   (self-referential FK for hierarchy)
-- profiles.team_id    → teams.id

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Teams table ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teams (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT  NOT NULL,
  description TEXT  DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read teams" ON public.teams;
CREATE POLICY "Authenticated users can read teams"
  ON public.teams FOR SELECT USING (auth.role() = 'authenticated');

-- Seed teams (idempotent via ON CONFLICT DO NOTHING requires unique constraint)
CREATE UNIQUE INDEX IF NOT EXISTS teams_name_idx ON public.teams (name);
INSERT INTO public.teams (name, description)
VALUES
  ('Leadership',   'Executive and admin leadership'),
  ('Sales',        'Sales and account management'),
  ('Engineering',  'Product and engineering'),
  ('Operations',   'Operations and support')
ON CONFLICT (name) DO NOTHING;

-- ── Patch profiles table ──────────────────────────────────────────────────────
-- Add hierarchy + team columns; existing rows get NULL defaults (safe)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role        TEXT    DEFAULT 'Employee',
  ADD COLUMN IF NOT EXISTS department  TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS manager_id  UUID    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team_id     UUID    REFERENCES public.teams(id)    ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS phone       TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS avatar_url  TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();

-- Indexes for hierarchy queries
CREATE INDEX IF NOT EXISTS profiles_manager_id_idx ON public.profiles (manager_id);
CREATE INDEX IF NOT EXISTS profiles_team_id_idx    ON public.profiles (team_id);
CREATE INDEX IF NOT EXISTS profiles_role_idx       ON public.profiles (role);

-- ── RLS for profiles (if not already set) ─────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read all profiles (needed for dropdown population)
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');

-- Users can only update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ── Verify ────────────────────────────────────────────────────────────────────
-- SELECT id, name, role, department, manager_id, team_id, is_active
-- FROM public.profiles;
