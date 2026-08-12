-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION — Accord CRM Clean Install
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 100% READ-ONLY. Contains no INSERT, UPDATE, DELETE, DROP, ALTER or CREATE.
-- Safe to run at any time, as many times as you like.
--
-- Run in: Supabase Dashboard → SQL Editor, after files 001–015.
-- Every check emits a `status` column. Investigate anything that is not PASS.
--
-- Expected totals for a correctly installed, freshly seeded project:
--   tables 11 (or 9 if you skipped 015) · views 1 · functions 2
--   policies 38 (or 31 without 015)     · teams 4 · every other table empty
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. REQUIRED TABLES
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '1. tables' AS check_id,
  expected.tablename,
  CASE WHEN t.tablename IS NOT NULL THEN 'PASS' ELSE 'MISSING' END AS status
FROM (VALUES
  ('profiles'),('teams'),('contacts'),('leads'),('tasks'),('meetings'),
  ('activities'),('opportunities'),('notifications'),
  ('company_settings'),('user_preferences')   -- last two only if 015 was run
) AS expected(tablename)
LEFT JOIN pg_tables t
  ON t.tablename = expected.tablename AND t.schemaname = 'public'
ORDER BY status DESC, expected.tablename;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. REQUIRED VIEW + SECURITY MODE
-- The single most important security check in this file.
-- security_invoker MUST be true, or timeline_events bypasses activities RLS
-- and exposes every activity row to every authenticated user.
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '2. view security' AS check_id,
  c.relname,
  COALESCE(
    (SELECT option_value FROM pg_options_to_table(c.reloptions)
     WHERE option_name = 'security_invoker'),
    'false'
  ) AS security_invoker,
  CASE WHEN COALESCE(
         (SELECT option_value FROM pg_options_to_table(c.reloptions)
          WHERE option_name = 'security_invoker'), 'false') = 'true'
       THEN 'PASS'
       ELSE 'FAIL — view bypasses RLS, re-run file 012' END AS status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v';


-- ───────────────────────────────────────────────────────────────────────────
-- 3. REQUIRED FUNCTIONS
-- Both must be SECURITY DEFINER. get_visible_profile_ids must be language sql.
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '3. functions' AS check_id,
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  l.lanname AS language,
  p.prosecdef AS security_definer,
  CASE WHEN p.prosecdef THEN 'PASS' ELSE 'FAIL — must be SECURITY DEFINER' END AS status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language  l ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND p.proname IN ('handle_new_user', 'get_visible_profile_ids')
ORDER BY p.proname;


-- ───────────────────────────────────────────────────────────────────────────
-- 4. RLS ENABLED ON EVERY TABLE
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '4. rls enabled' AS check_id,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  CASE WHEN c.relrowsecurity THEN 'PASS' ELSE 'FAIL — table is unprotected' END AS status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relrowsecurity, c.relname;


-- ───────────────────────────────────────────────────────────────────────────
-- 5. POLICY COUNT PER TABLE
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '5. policy counts' AS check_id,
  e.tablename,
  e.expected_count,
  COALESCE(a.actual_count, 0) AS actual_count,
  CASE WHEN COALESCE(a.actual_count, 0) = e.expected_count
       THEN 'PASS' ELSE 'MISMATCH' END AS status
FROM (VALUES
  ('activities', 2), ('contacts', 4), ('leads', 4), ('meetings', 4),
  ('notifications', 4), ('opportunities', 4), ('profiles', 4),
  ('tasks', 4), ('teams', 1),
  ('company_settings', 3), ('user_preferences', 4)   -- only if 015 was run
) AS e(tablename, expected_count)
LEFT JOIN (
  SELECT tablename, COUNT(*)::int AS actual_count
  FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename
) a ON a.tablename = e.tablename
ORDER BY status DESC, e.tablename;


-- ───────────────────────────────────────────────────────────────────────────
-- 6. NO SUPERSEDED POLICIES LEFT BEHIND
-- The interim blanket policies from files 002–006 and the actor-based
-- activities policy from 009 must all be gone. Any row here is a failure.
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '6. stale policies' AS check_id,
  tablename,
  policyname,
  'FAIL — superseded policy still present' AS status
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN (
    'Authenticated users can access leads',
    'Authenticated users can access tasks',
    'Authenticated users can access meetings',
    'Authenticated users can access activities',
    'Authenticated users can access contacts',
    'Activities SELECT — role-scoped'
  );
-- Zero rows returned = PASS.


-- ───────────────────────────────────────────────────────────────────────────
-- 7. CRITICAL COLUMN TYPES
-- activities.actor_id MUST be text. If it reports uuid, file 012 was run
-- before file 007 and the RLS policies could not have been created.
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '7. column types' AS check_id,
  e.table_name,
  e.column_name,
  c.data_type AS actual_type,
  e.expected_type,
  CASE WHEN c.data_type IS NULL THEN 'MISSING'
       WHEN c.data_type = e.expected_type THEN 'PASS'
       ELSE 'FAIL — wrong type' END AS status
FROM (VALUES
  ('activities','actor_id','text'),
  ('activities','metadata','jsonb'),
  ('activities','entity_id','text'),
  ('leads','owner_id','text'),
  ('leads','created_by','text'),
  ('tasks','created_by','text'),
  ('meetings','created_by','text'),
  ('opportunities','owner_id','text'),
  ('opportunities','expected_revenue','numeric'),
  ('notifications','actor_id','uuid')   -- different table: uuid here is correct
) AS e(table_name, column_name, expected_type)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name   = e.table_name
 AND c.column_name  = e.column_name
ORDER BY status DESC, e.table_name, e.column_name;


-- ───────────────────────────────────────────────────────────────────────────
-- 8. AUTH TRIGGER
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '8. auth trigger' AS check_id,
  tgname,
  CASE tgenabled WHEN 'O' THEN 'enabled' ELSE tgenabled::text END AS state,
  CASE WHEN tgname = 'on_auth_user_created' AND tgenabled = 'O'
       THEN 'PASS' ELSE 'FAIL' END AS status
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal;
-- Zero rows = FAIL: new signups will never receive a profile row.


-- ───────────────────────────────────────────────────────────────────────────
-- 9. FOREIGN KEYS
-- Expect 4 (or 5 with file 015).
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '9. foreign keys' AS check_id,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema || '.' || ccu.table_name AS references_table,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name AND kcu.constraint_schema = tc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;


-- ───────────────────────────────────────────────────────────────────────────
-- 10. INDEXES PER TABLE
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '10. indexes' AS check_id,
  tablename,
  COUNT(*) AS index_count
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;


-- ───────────────────────────────────────────────────────────────────────────
-- 11. APPLICATION ROLES AND GRANTS
-- At least one Admin must exist before the User Management page will work.
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '11a. app roles' AS check_id,
  role,
  COUNT(*) AS user_count,
  COUNT(*) FILTER (WHERE is_active) AS active_count
FROM public.profiles
GROUP BY role
ORDER BY role;

SELECT
  '11b. admin exists' AS check_id,
  COUNT(*) AS admin_count,
  CASE WHEN COUNT(*) > 0 THEN 'PASS'
       ELSE 'ACTION REQUIRED — elevate your first user to Admin' END AS status
FROM public.profiles WHERE role = 'Admin';

SELECT
  '11c. api grants' AS check_id,
  table_name,
  grantee,
  STRING_AGG(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;


-- ───────────────────────────────────────────────────────────────────────────
-- 12. NO DEMO USERS OR DEMO DATA
-- Every violation count must be 0 on a clean install.
-- ───────────────────────────────────────────────────────────────────────────
SELECT '12. demo data' AS check_id, label, violations,
       CASE WHEN violations = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM (
  SELECT 'demo profile names' AS label, COUNT(*) AS violations
  FROM public.profiles
  WHERE name IN ('Alex Rivera','Jordan Kim','Morgan Chen','Taylor Brooks')
  UNION ALL
  SELECT 'demo email domain', COUNT(*)
  FROM public.profiles WHERE email ILIKE '%@nexuscrm.io'
  UNION ALL
  SELECT 'orphaned lead assignees', COUNT(*)
  FROM public.leads
  WHERE COALESCE(assignee,'') <> ''
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE name = leads.assignee)
  UNION ALL
  SELECT 'orphaned task assignees', COUNT(*)
  FROM public.tasks
  WHERE COALESCE(assignee,'') <> ''
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE name = tasks.assignee)
  UNION ALL
  SELECT 'orphaned meeting organizers', COUNT(*)
  FROM public.meetings
  WHERE COALESCE(organizer,'') <> ''
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE name = meetings.organizer)
  UNION ALL
  SELECT 'orphaned opportunity assignees', COUNT(*)
  FROM public.opportunities
  WHERE COALESCE(assignee,'') <> ''
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE name = opportunities.assignee)
) d;


-- ───────────────────────────────────────────────────────────────────────────
-- 13. ROW COUNTS
-- teams must be exactly 4. profiles must equal auth.users.
-- Any gap means the on_auth_user_created trigger failed for some signups.
-- ───────────────────────────────────────────────────────────────────────────
SELECT '13. row counts' AS check_id, 'teams' AS table_name, COUNT(*) AS rows FROM public.teams
UNION ALL SELECT '13. row counts','profiles',      COUNT(*) FROM public.profiles
UNION ALL SELECT '13. row counts','auth.users',    COUNT(*) FROM auth.users
UNION ALL SELECT '13. row counts','contacts',      COUNT(*) FROM public.contacts
UNION ALL SELECT '13. row counts','leads',         COUNT(*) FROM public.leads
UNION ALL SELECT '13. row counts','opportunities', COUNT(*) FROM public.opportunities
UNION ALL SELECT '13. row counts','tasks',         COUNT(*) FROM public.tasks
UNION ALL SELECT '13. row counts','meetings',      COUNT(*) FROM public.meetings
UNION ALL SELECT '13. row counts','activities',    COUNT(*) FROM public.activities
UNION ALL SELECT '13. row counts','notifications', COUNT(*) FROM public.notifications
ORDER BY table_name;

SELECT
  '13b. profile parity' AS check_id,
  (SELECT COUNT(*) FROM auth.users)      AS auth_users,
  (SELECT COUNT(*) FROM public.profiles) AS profiles,
  CASE WHEN (SELECT COUNT(*) FROM auth.users) = (SELECT COUNT(*) FROM public.profiles)
       THEN 'PASS' ELSE 'FAIL — trigger did not fire for every user' END AS status;


-- ───────────────────────────────────────────────────────────────────────────
-- 14. TEAMS SEED
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '14. teams seed' AS check_id,
  name,
  CASE WHEN name IN ('Leadership','Sales','Engineering','Operations')
       THEN 'PASS' ELSE 'UNEXPECTED' END AS status
FROM public.teams
ORDER BY name;


-- ───────────────────────────────────────────────────────────────────────────
-- 15. RBAC HELPER SMOKE TEST
-- For an Admin this must equal the total profile count.
-- Errors here mean file 008 did not apply.
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '15. rbac helper' AS check_id,
  (SELECT COUNT(*) FROM public.get_visible_profile_ids(
     (SELECT id FROM public.profiles WHERE role = 'Admin' ORDER BY created_at LIMIT 1)
   )) AS visible_to_first_admin,
  (SELECT COUNT(*) FROM public.profiles) AS total_profiles,
  CASE WHEN (SELECT COUNT(*) FROM public.profiles WHERE role = 'Admin') = 0
         THEN 'SKIPPED — no Admin exists yet'
       WHEN (SELECT COUNT(*) FROM public.get_visible_profile_ids(
               (SELECT id FROM public.profiles WHERE role = 'Admin' ORDER BY created_at LIMIT 1)))
            = (SELECT COUNT(*) FROM public.profiles)
         THEN 'PASS'
       ELSE 'FAIL' END AS status;


-- ───────────────────────────────────────────────────────────────────────────
-- 16. REALTIME REPLICATION
-- public.notifications must appear, or the live notification feed is dead.
-- This is a Dashboard setting, not something the SQL files can install.
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  '16. realtime' AS check_id,
  schemaname,
  tablename,
  'PASS' AS status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
-- No row for public.notifications = ACTION REQUIRED (see README).
