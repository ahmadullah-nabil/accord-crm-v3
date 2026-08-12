-- ═══════════════════════════════════════════════════════════════════════════
-- 015 — SETTINGS TABLES  (OPTIONAL — read the box below before running)
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : 15 of 15 (last)
-- DEPENDS ON: 001 (profiles — the Admin write policy reads profiles.role),
--             Supabase built-in auth.users
-- SOURCE    : none. No file in the original 17-file set creates these tables.
--             This file was derived by reading the frontend, NOT by copying
--             the incompatible schema in SUPABASE_MIGRATION.md.
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ THIS FILE IS OPTIONAL. THE RUNNING APP DOES NOT QUERY THESE TABLES.     │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ Source inspection findings:                                             │
-- │                                                                          │
-- │  • src/services/settingsService.js is the ONLY code that references     │
-- │    company_settings and user_preferences.                               │
-- │                                                                          │
-- │  • Nothing imports those functions. settingsService.js is re-exported    │
-- │    by the src/services/index.js barrel and never called.                │
-- │                                                                          │
-- │  • The Settings UI runs through src/hooks/useSettings.js, which imports  │
-- │    the mock functions from src/lib/settingsData.js DIRECTLY. Company,    │
-- │    Notifications, Appearance, Security and Preferences are all           │
-- │    in-memory mock state today.                                          │
-- │                                                                          │
-- │  • The one Settings section backed by real data is Profile, which goes   │
-- │    through useTeam.js → teamService.js → public.profiles. That table is  │
-- │    already created by file 001 with every column teamService reads.      │
-- │                                                                          │
-- │ CONCLUSION: skipping this file produces a fully working CRM identical    │
-- │ to the old one. Run it only if you intend to wire settingsService.js up  │
-- │ later. It is included because you asked for it and because creating the  │
-- │ tables now is harmless; it changes no existing behaviour.                │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ KNOWN FRONTEND GAP — DO NOT "FIX" IT IN SQL                             │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ settingsService.saveCompanySettings() sends the payload straight        │
-- │ through: .upsert({ ...payload, org_id: orgId }). The company object in  │
-- │ src/lib/settingsData.js uses camelCase keys `taxId` and `fiscalYear`,   │
-- │ and settingsService has no toDb() mapper to convert them.               │
-- │                                                                          │
-- │ So if that code path is ever switched on as written, PostgREST will     │
-- │ reject the write for the two camelCase keys. The correct fix is a       │
-- │ toDb() mapper in settingsService.js — a frontend change, which is out   │
-- │ of scope for this task and has NOT been made.                           │
-- │                                                                          │
-- │ The columns below are snake_case, consistent with every other table in  │
-- │ this database. No camelCase columns have been invented to paper over    │
-- │ the missing mapper.                                                     │
-- └─────────────────────────────────────────────────────────────────────────┘


-- ───────────────────────────────────────────────────────────────────────────
-- COMPANY SETTINGS
-- ───────────────────────────────────────────────────────────────────────────
-- Queried by settingsService.js as:
--   .from('company_settings').select('*').eq('org_id', orgId).single()
--   .from('company_settings').upsert({ ...payload, org_id: orgId })
--
-- org_id is the PRIMARY KEY, not a separate surrogate id. supabase-js .upsert()
-- resolves its conflict target from the primary key, and the payload above
-- carries org_id and no id. With a surrogate `id UUID DEFAULT gen_random_uuid()`
-- primary key (as in the legacy SUPABASE_MIGRATION.md schema) every save would
-- insert a brand-new row instead of updating the existing one.
--
-- Columns are exactly the nine fields on the `company` object in
-- src/lib/settingsData.js. Nothing has been added.
CREATE TABLE public.company_settings (
  org_id       UUID        PRIMARY KEY,

  name         TEXT        DEFAULT '',
  website      TEXT        DEFAULT '',
  industry     TEXT        DEFAULT '',   -- INDUSTRY_OPTIONS in settingsData.js
  size         TEXT        DEFAULT '',   -- COMPANY_SIZES
  address      TEXT        DEFAULT '',
  phone        TEXT        DEFAULT '',
  tax_id       TEXT        DEFAULT '',
  currency     TEXT        DEFAULT 'BDT',      -- CURRENCIES
  fiscal_year  TEXT        DEFAULT 'January',  -- FISCAL_YEARS

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user (the Settings page reads before checking perms)
CREATE POLICY "Authenticated users can read company settings"
  ON public.company_settings FOR SELECT
  USING (auth.role() = 'authenticated');

-- Write: Admin and AGM only. This mirrors the frontend exactly —
-- SettingsPage.jsx gates the Company section behind ADMIN_ONLY_SECTIONS, and
-- lib/permissions.js sets canEditCompany = adminLevel (Admin or AGM).
CREATE POLICY "Admins can insert company settings"
  ON public.company_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('Admin', 'AGM')
    )
  );

CREATE POLICY "Admins can update company settings"
  ON public.company_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('Admin', 'AGM')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('Admin', 'AGM')
    )
  );

-- No DELETE policy: the app never deletes a company settings row.

-- NOTE: no row is seeded here. getCompanySettings() uses .single(), which
-- returns PGRST116 when no row exists. The first successful save creates it.
-- Seeding a placeholder organisation would be demo data, so it is omitted.


-- ───────────────────────────────────────────────────────────────────────────
-- USER PREFERENCES
-- ───────────────────────────────────────────────────────────────────────────
-- Queried by settingsService.js as four independent column reads and writes:
--   .select('notifications') / .upsert({ user_id, notifications })
--   .select('appearance')    / .upsert({ user_id, appearance })
--   .select('security')      / .upsert({ user_id, security })
--   .select('preferences')   / .upsert({ user_id, preferences })
--
-- user_id is the PRIMARY KEY for the same upsert-conflict-target reason as
-- company_settings.org_id above. PostgREST builds
--   ON CONFLICT (user_id) DO UPDATE SET <only the columns in the payload>
-- so saving one section never clears the other three.
--
-- Each section is a single JSONB blob rather than exploded columns, matching
-- both the service's per-column reads and the shapes in settingsData.js:
--   notifications → emailOnLeadAssigned, pushLeads, digestFrequency, ...
--   appearance    → theme, accentColor, fontSize, density, ...
--   security      → twoFactorEnabled, sessionTimeout, loginNotification, ...
--   preferences   → defaultModule, leadsDefaultView, itemsPerPage, ...
-- No individual preference keys are promoted to columns — the frontend treats
-- each section as one opaque object.
CREATE TABLE public.user_preferences (
  user_id       UUID        PRIMARY KEY
                            REFERENCES auth.users(id) ON DELETE CASCADE,

  notifications JSONB       NOT NULL DEFAULT '{}',
  appearance    JSONB       NOT NULL DEFAULT '{}',
  security      JSONB       NOT NULL DEFAULT '{}',
  preferences   JSONB       NOT NULL DEFAULT '{}',

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Strictly own-row for every command. A user's preferences are private:
-- unlike profiles, there is no reason for anyone else — including an Admin —
-- to read them, so no admin override policy is created.
CREATE POLICY "Users can read own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences"
  ON public.user_preferences FOR DELETE
  USING (auth.uid() = user_id);
