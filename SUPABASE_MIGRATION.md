# Accord CRM — Supabase Integration Guide

## Overview

The project is structured so that switching from mock data to a real Supabase
backend requires **zero changes to UI components or React Query hooks**.
The only changes needed are:

1. Add your Supabase credentials to `.env.local`
2. Flip `VITE_USE_REAL_BACKEND=true`
3. Run the SQL schema below in Supabase SQL editor
4. (Optional) Implement the real service function bodies

---

## Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL** and **Anon key** from Settings → API.

---

## Step 2 — Configure environment

Create `.env.local` (never commit this file):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_USE_REAL_BACKEND=true
VITE_APP_URL=https://your-deployed-app.com
```

---

## Step 3 — Run the SQL schema

Paste this into Supabase SQL Editor and run it.

```sql
-- ── Enable UUID extension ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Profiles (extends Supabase auth.users) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT,
  phone         TEXT,
  title         TEXT,
  department    TEXT,
  bio           TEXT,
  timezone      TEXT DEFAULT 'Asia/Dhaka',
  language      TEXT DEFAULT 'English',
  date_format   TEXT DEFAULT 'DD/MM/YYYY',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ── Company settings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_settings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL,
  name          TEXT,
  website       TEXT,
  industry      TEXT,
  size          TEXT,
  address       TEXT,
  phone         TEXT,
  tax_id        TEXT,
  currency      TEXT DEFAULT 'BDT',
  fiscal_year   TEXT DEFAULT 'January',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- ── User preferences (notification, appearance, security, preferences) ───────
CREATE TABLE IF NOT EXISTS user_preferences (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  notifications   JSONB DEFAULT '{}'::jsonb,
  appearance      JSONB DEFAULT '{}'::jsonb,
  security        JSONB DEFAULT '{}'::jsonb,
  preferences     JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prefs" ON user_preferences USING (auth.uid() = user_id);

-- ── Contacts ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  company         TEXT,
  designation     TEXT,
  email           TEXT,
  phone           TEXT,
  type            TEXT DEFAULT 'Prospect',
  status          TEXT DEFAULT 'Active',
  assignee        TEXT,
  assignee_id     UUID REFERENCES auth.users(id),
  linked_lead_id  TEXT,
  address         TEXT,
  website         TEXT,
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  avatar          TEXT,
  created_at      DATE DEFAULT CURRENT_DATE,
  last_activity   DATE DEFAULT CURRENT_DATE
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can access contacts" ON contacts
  FOR ALL USING (auth.role() = 'authenticated');

-- ── Leads ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  company         TEXT,
  email           TEXT,
  phone           TEXT,
  stage           TEXT DEFAULT 'New',
  value           NUMERIC DEFAULT 0,
  source          TEXT,
  assignee        TEXT,
  assignee_id     UUID REFERENCES auth.users(id),
  priority        TEXT DEFAULT 'Medium',
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  created_at      DATE DEFAULT CURRENT_DATE,
  last_activity   DATE DEFAULT CURRENT_DATE
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can access leads" ON leads
  FOR ALL USING (auth.role() = 'authenticated');

-- ── Tasks ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT DEFAULT 'Todo',
  priority        TEXT DEFAULT 'Medium',
  due_date        DATE,
  assignee        TEXT,
  assignee_id     UUID REFERENCES auth.users(id),
  related_type    TEXT,
  related_id      TEXT,
  related_label   TEXT,
  completed_at    DATE,
  tags            TEXT[] DEFAULT '{}',
  created_at      DATE DEFAULT CURRENT_DATE
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can access tasks" ON tasks
  FOR ALL USING (auth.role() = 'authenticated');

-- ── Meetings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meetings (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  description       TEXT,
  status            TEXT DEFAULT 'Scheduled',
  type              TEXT DEFAULT 'Discovery',
  scheduled_date    DATE,
  scheduled_time    TIME,
  duration_mins     INTEGER DEFAULT 60,
  location          TEXT,
  location_url      TEXT,
  organizer         TEXT,
  organizer_id      UUID REFERENCES auth.users(id),
  participants      TEXT[] DEFAULT '{}',
  related_type      TEXT,
  related_id        TEXT,
  related_label     TEXT,
  notes             TEXT,
  tags              TEXT[] DEFAULT '{}',
  created_at        DATE DEFAULT CURRENT_DATE
);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can access meetings" ON meetings
  FOR ALL USING (auth.role() = 'authenticated');

-- ── Notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category        TEXT,
  type            TEXT,
  title           TEXT NOT NULL,
  body            TEXT,
  actor           TEXT,
  subject         TEXT,
  related_module  TEXT,
  related_id      TEXT,
  is_read         BOOLEAN DEFAULT FALSE,
  is_pinned       BOOLEAN DEFAULT FALSE,
  tags            TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- ── Trigger: auto-update profiles on user creation ────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();
```

---

## Step 4 — Enable Realtime (optional)

In Supabase dashboard → Database → Replication, enable replication for the
`notifications` table to receive live updates via `subscribeToNotifications()`.

---

## Architecture summary

```
UI Components (never change)
        ↓
React Query hooks  (useContacts.js, useTasks.js, etc.)
        ↓
Service layer  (src/services/*.js)  ← THE ONLY FILE YOU MODIFY PER MODULE
        ↓
  ┌─────────────┐         ┌───────────────┐
  │  Mock data  │   OR    │  Supabase DB  │
  │ (lib/*.js)  │         │  (real data)  │
  └─────────────┘         └───────────────┘
        ↑
  USE_REAL_BACKEND flag
```

---

## Module migration checklist

| Module       | Service file                   | Mock lib file          | Status |
|--------------|-------------------------------|------------------------|--------|
| Auth         | authService.js                 | authStore.js           | Ready  |
| Contacts     | contactsService.js             | lib/contactsData.js    | Ready  |
| Leads        | leadsService.js                | stores/leadsStore.js   | Ready  |
| Tasks        | tasksService.js                | lib/tasksData.js       | Ready  |
| Meetings     | meetingsService.js             | lib/meetingsData.js    | Ready  |
| Notifications| notificationsService.js        | lib/notificationsData.js| Ready |
| Settings     | settingsService.js             | lib/settingsData.js    | Ready  |
| Analytics    | analyticsService.js            | lib/analyticsData.js   | Ready  |
