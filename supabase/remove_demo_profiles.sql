-- ─── Remove Demo / Prototype Profiles ────────────────────────────────────────
--
-- These demo profile rows were created during initial prototype setup.
-- They appear in all assignee dropdowns because getTeamMembers() reads
-- ALL active rows from public.profiles.
--
-- SAFE: Run the SELECT first to confirm which rows will be removed.
-- Then uncomment and run the DELETE to remove them.
--
-- After deletion, the demo names will immediately disappear from all
-- assignee dropdowns on next page load (React Query staleTime: 0 means
-- the team members cache refetches on every mount).
--
-- ── Step 1: Preview rows that will be removed ─────────────────────────────────
-- Run this first and verify these are demo rows, not real users.

SELECT id, name, email, role, is_active, created_at
FROM public.profiles
WHERE name IN ('Alex Rivera', 'Jordan Kim', 'Morgan Chen', 'Taylor Brooks')
ORDER BY name;

-- ── Step 2: Also find any profiles with the demo email domains ────────────────
-- (in case the names were changed but the demo emails remain)

SELECT id, name, email, role, is_active, created_at
FROM public.profiles
WHERE email ILIKE '%@nexuscrm.io'
ORDER BY name;

-- ── Step 3: Deactivate (safe — preserves existing records linked to them) ──────
-- Preferred approach: deactivate rather than delete, so any leads/contacts/tasks
-- assigned to them still display correctly in historical records.
-- They will no longer appear in assignee dropdowns (is_active = true filter).

-- UPDATE public.profiles
-- SET is_active = false, updated_at = NOW()
-- WHERE name IN ('Alex Rivera', 'Jordan Kim', 'Morgan Chen', 'Taylor Brooks');

-- ── Step 4: Hard delete (only if these profiles have NO linked records) ─────────
-- Use ONLY if Step 1 shows rows you are certain are safe to remove.
-- Check for linked records first:

-- SELECT COUNT(*) FROM public.leads    WHERE assignee IN ('Alex Rivera','Jordan Kim','Morgan Chen','Taylor Brooks');
-- SELECT COUNT(*) FROM public.contacts WHERE assignee IN ('Alex Rivera','Jordan Kim','Morgan Chen','Taylor Brooks');
-- SELECT COUNT(*) FROM public.tasks    WHERE assignee IN ('Alex Rivera','Jordan Kim','Morgan Chen','Taylor Brooks');
-- SELECT COUNT(*) FROM public.meetings WHERE organizer IN ('Alex Rivera','Jordan Kim','Morgan Chen','Taylor Brooks');

-- If all counts are 0, safe to delete:
-- DELETE FROM public.profiles
-- WHERE name IN ('Alex Rivera', 'Jordan Kim', 'Morgan Chen', 'Taylor Brooks')
--   AND email ILIKE '%@nexuscrm.io';   -- extra safety check: only demo email domain
