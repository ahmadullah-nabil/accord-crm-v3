-- ─── Demo Data Cleanup ────────────────────────────────────────────────────────
--
-- Removes records whose assignee / organizer name does not match any real
-- profile in public.profiles. These are rows seeded while the app was running
-- with the old demo system (Alex Rivera, Morgan Chen, Jordan Kim, Taylor Brooks)
-- before real Supabase auth users were set up.
--
-- Run this ONCE in the Supabase SQL Editor after your real users are in profiles.
-- Safe: uses DELETE ... WHERE NOT EXISTS so it only removes truly orphaned rows.
-- Review the SELECT statements first before running the DELETE statements.

-- ── Preview orphaned rows (run this first to see what will be deleted) ─────────

-- Leads with no matching profile
SELECT id, assignee, stage, value, created_at
FROM public.leads
WHERE assignee IS NOT NULL
  AND assignee <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE name = leads.assignee
  );

-- Opportunities with no matching profile
SELECT id, assignee, stage, value, created_at
FROM public.opportunities
WHERE assignee IS NOT NULL
  AND assignee <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE name = opportunities.assignee
  );

-- Tasks with no matching profile
SELECT id, assignee, status, created_at
FROM public.tasks
WHERE assignee IS NOT NULL
  AND assignee <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE name = tasks.assignee
  );

-- Meetings with no matching profile
SELECT id, organizer, status, created_at
FROM public.meetings
WHERE organizer IS NOT NULL
  AND organizer <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE name = meetings.organizer
  );

-- ── Delete orphaned rows (run AFTER reviewing the SELECT results above) ────────

-- Option A: Delete the orphaned records entirely
-- DELETE FROM public.leads
-- WHERE assignee IS NOT NULL AND assignee <> ''
--   AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE name = leads.assignee);

-- DELETE FROM public.opportunities
-- WHERE assignee IS NOT NULL AND assignee <> ''
--   AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE name = opportunities.assignee);

-- DELETE FROM public.tasks
-- WHERE assignee IS NOT NULL AND assignee <> ''
--   AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE name = tasks.assignee);

-- DELETE FROM public.meetings
-- WHERE organizer IS NOT NULL AND organizer <> ''
--   AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE name = meetings.organizer);

-- Option B: Reassign orphaned records to a real user instead of deleting
-- UPDATE public.leads
-- SET assignee = (SELECT name FROM public.profiles ORDER BY created_at LIMIT 1)
-- WHERE assignee IS NOT NULL AND assignee <> ''
--   AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE name = leads.assignee);

-- ── Verify cleanup ─────────────────────────────────────────────────────────────
-- After cleanup, this should return 0 rows for each table:
-- SELECT COUNT(*) FROM public.leads
-- WHERE assignee <> '' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE name = leads.assignee);
