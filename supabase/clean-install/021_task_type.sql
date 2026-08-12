-- ═══════════════════════════════════════════════════════════════════════════
-- 021. TASK TYPE  (Dashboard activity calendar, step ⑥–⑦)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The Dashboard calendar filters activities by TYPE — Meetings, Follow-ups,
-- Tasks, Calls, Deadlines. An audit of what actually exists found only two of
-- those five are real:
--
--   Meeting    ✓ its own table, with MEETING_TYPES
--   Follow-up  ✗ exists only as a MEETING type
--   Call       ✗ exists only as a meeting LOCATION ('Phone Call')
--   Deadline   ✗ does not exist anywhere
--   Task       ✓ its own table — but completely untyped
--
-- So a task is currently just "a thing with a due date". The calendar could
-- show it, but could not tell "call the client back" apart from "submit the
-- proposal" — and the type filter is most of the reason the calendar is worth
-- building.
--
-- WHY NOW RATHER THAN LATER
-- ─────────────────────────
-- Adding a column later is equally easy. BACKFILLING it is not: once real users
-- hold thousands of untyped tasks, deciding what each one was is guesswork
-- nobody can do reliably. Today the table is test data, so the default is
-- honest rather than a fabrication.
--
-- WHY ON TASKS RATHER THAN A NEW ACTIVITIES TABLE
-- ───────────────────────────────────────────────
-- `activities` is an append-only AUDIT LOG — actor, action, subject,
-- occurred_at. It records what happened, not what is scheduled, so it cannot
-- feed a calendar of future items. And meetings and tasks differ in a way that
-- resists merging: a meeting has a date, a time and a duration; a task has a
-- due date and NO time. Forcing them into one table produces nullable columns
-- that mean different things per row. The calendar unions them at read time
-- instead. If that proves painful, a real table is still available — the
-- reverse would not be.
-- ═══════════════════════════════════════════════════════════════════════════


ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'Task';

-- 'Task' is the honest default for every existing row: they were created with
-- no type, and inferring one from the title would be invention dressed as data.
COMMENT ON COLUMN public.tasks.type IS
  'Calendar activity type. Existing rows default to Task because they predate typing — not because they were classified.';

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_type_check;

-- Constrained rather than free text so the calendar's type filter has a fixed
-- set to build from, and a typo cannot silently create a sixth category that
-- appears nowhere in the UI.
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_type_check
  CHECK (type IN ('Task', 'Follow-up', 'Call', 'Deadline'));

-- The calendar filters by type within a date window, so the index leads with
-- the filter and carries the range.
CREATE INDEX IF NOT EXISTS tasks_type_due_idx
  ON public.tasks (type, due_date);


-- ───────────────────────────────────────────────────────────────────────────
-- A NOTE ON 'Overdue', WHICH IS NOT FIXED HERE
-- ───────────────────────────────────────────────────────────────────────────
-- TASK_STATUSES in src/lib/tasksData.js is
--     ['Todo', 'In Progress', 'Completed', 'Overdue']
--
-- 'Overdue' does not belong in that list. It is not a state anyone chooses; it
-- is DERIVED — due_date < today AND status <> 'Completed'. Stored, it is wrong
-- the moment a date passes without someone editing the row, and equally wrong
-- if the due date is later pushed out.
--
-- It is deliberately left in place: existing rows may carry it, and rewriting
-- them would be a data change disguised as a schema change. The calendar layer
-- computes overdue from the date instead and treats the stored value as
-- legacy. New code should not write it.
--
-- Meetings have no 'Overdue' at all (Scheduled/Completed/Cancelled/Rescheduled),
-- which is the other reason this cannot be a stored column shared by both — the
-- two vocabularies genuinely differ and are mapped at read time.


-- ───────────────────────────────────────────────────────────────────────────
-- VERIFY
-- ───────────────────────────────────────────────────────────────────────────
--   SELECT type, count(*) FROM public.tasks GROUP BY type;
--   -- every existing row should read 'Task'
--
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint WHERE conname = 'tasks_type_check';
