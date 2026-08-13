-- ═══════════════════════════════════════════════════════════════════════════
-- 025 — POLYMORPHIC LINKS: settle the convention  (roadmap step 13)
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ STEP 13 WAS NOT AN OPEN DECISION. IT WAS ALREADY DECIDED, SIX TIMES.    │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ The roadmap said email_messages links to lead / contact / opportunity   │
-- │ as SEPARATE COLUMNS, and that extending to tasks and meetings meant     │
-- │ choosing between more columns and an (entity_type, entity_id) pair.     │
-- │                                                                          │
-- │ That is not what the schema does. There are no per-entity columns        │
-- │ anywhere. The pair pattern is already in use on six tables:              │
-- │                                                                          │
-- │   activities       entity_type   / entity_id    TEXT                     │
-- │   notifications    entity_type   / entity_id    UUID                     │
-- │   timeline_events  entity_type   / entity_id    TEXT   (a view)          │
-- │   email_messages   related_type  / related_id   UUID                     │
-- │   meetings         related_type  / related_id   TEXT                     │
-- │   tasks            related_type  / related_id   TEXT                     │
-- │                                                                          │
-- │ So there is nothing to choose. What there IS, is drift: two names for    │
-- │ one idea, and two types for one kind of value.                           │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- THE NAMING SPLIT IS KEPT, AND IS NOT DRIFT
-- ──────────────────────────────────────────
-- On inspection the two names track a real distinction, so renaming them to
-- match would destroy information rather than tidy it:
--
--   related_*  — this record IS ABOUT that record.
--                A task about a lead. A meeting about an opportunity. An email
--                about a contact. The link is part of the record's meaning, and
--                a user set it.
--
--   entity_*   — this record POINTS AT that record from a log.
--                An activity, a notification, a timeline row. The link is
--                provenance, written by the system, and the row is evidence
--                that survives the thing it points at.
--
-- That is why neither has a foreign key, and why both must stay FK-free: a
-- deleted lead must not delete the audit trail of what was done to it, nor the
-- record that a proposal was emailed. Adding an FK here would be the one change
-- that turns a soft link into a delete cascade.
--
-- RULE FOR NEW TABLES: if a user chooses the link, call it related_*; if the
-- system writes it as history, call it entity_*.
--
-- THE TYPE SPLIT IS REAL, AND ONLY HALF FIXABLE
-- ─────────────────────────────────────────────
-- TEXT accepts anything. A malformed id is stored happily and only fails later,
-- at a join, as a row that silently matches nothing.
--
-- meetings.related_id and tasks.related_id are TEXT purely because their
-- services write String(id). They hold real UUIDs and nothing else — verified:
-- zero non-UUID values. Section 2 constrains them so a malformed id is rejected
-- at write time.
--
-- activities.entity_id stays TEXT and stays unconstrained. It is an append-only
-- audit log that may hold historical values that were never UUIDs, and
-- rejecting a log write because the subject looks odd loses the very record you
-- would want. A log's job is to accept what happened.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 1: The missing indexes
-- ───────────────────────────────────────────────────────────────────────────
-- activities, notifications and email_messages already have one. meetings and
-- tasks do not — the two tables step 20's unified timeline will query hardest,
-- since "everything about this lead" reads every one of these tables by the
-- same pair.
--
-- org_id leads, for the reason given in 022: a shared-schema tenant model is
-- only fast if the planner can drop other tenants' rows before doing anything
-- else.
CREATE INDEX IF NOT EXISTS meetings_related_idx
  ON public.meetings (org_id, related_type, related_id)
  WHERE related_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tasks_related_idx
  ON public.tasks (org_id, related_type, related_id)
  WHERE related_id IS NOT NULL;

-- Partial, because most rows have no link at all. Indexing the NULLs would
-- store the majority of the table to answer a question nobody asks.


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 2: Make the TEXT ids honest
-- ───────────────────────────────────────────────────────────────────────────
-- NOT VALID skips the scan of existing rows and applies to every future write.
-- The data is already clean, so this is belt-and-braces rather than a fix — but
-- it means the day a service writes String(undefined) the insert fails loudly
-- instead of storing the four characters 'null' and joining to nothing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meetings_related_id_is_uuid') THEN
    ALTER TABLE public.meetings
      ADD CONSTRAINT meetings_related_id_is_uuid
      CHECK (related_id IS NULL OR related_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_related_id_is_uuid') THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_related_id_is_uuid
      CHECK (related_id IS NULL OR related_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
      NOT VALID;
  END IF;
END $$;

-- Deliberately NOT converted to a UUID column. ALTER TYPE rewrites the table and
-- takes an ACCESS EXCLUSIVE lock, and every service reading these fields treats
-- them as strings. The constraint buys the correctness; the type change would
-- buy four bytes and a rewrite.


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 3: One vocabulary for the entity names
-- ───────────────────────────────────────────────────────────────────────────
-- The type columns are free-text on all six tables, so 'lead', 'Lead' and
-- 'leads' are all storable and none of them match each other on a join. This is
-- what actually breaks a unified timeline — not the column names.
--
-- A CHECK per table would be six constraints to keep in step. A shared domain
-- is one definition, and adding a seventh entity later is one ALTER.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_entity_type') THEN
    CREATE DOMAIN public.crm_entity_type AS TEXT
      CHECK (VALUE IS NULL OR VALUE IN
        ('lead','contact','opportunity','task','meeting','email'));
  END IF;
END $$;

-- NOT applied to the existing columns in this file. Attaching a domain to a
-- populated column validates every row and would fail the migration on any
-- legacy value — in an audit log, on data nobody can fix retrospectively.
--
-- Use it for NEW columns from here. To adopt it on an existing one, check first:
--
--   SELECT DISTINCT related_type FROM public.tasks;
--   SELECT DISTINCT entity_type  FROM public.activities;
--
-- and only then ALTER ... TYPE public.crm_entity_type.


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 4: Verify
-- ───────────────────────────────────────────────────────────────────────────
SELECT 'link indexes (expect 6)' AS check,
       (SELECT count(*)::text FROM pg_indexes
        WHERE schemaname='public'
          AND (indexdef LIKE '%entity_type%' OR indexdef LIKE '%related_type%')) AS value
UNION ALL
SELECT 'uuid-shape constraints (expect 2)',
       (SELECT count(*)::text FROM pg_constraint
        WHERE conname IN ('meetings_related_id_is_uuid','tasks_related_id_is_uuid'))
UNION ALL
SELECT 'crm_entity_type domain (expect 1)',
       (SELECT count(*)::text FROM pg_type WHERE typname='crm_entity_type');


-- ═══════════════════════════════════════════════════════════════════════════
-- WHAT THIS UNBLOCKS
-- ═══════════════════════════════════════════════════════════════════════════
-- Step 15 (generalise EmailComposer, extract MeetingScheduler) can take a
-- single { type, id, label } reference, because that is what all six tables
-- already store. No schema work is required first — which is the answer step 13
-- was asking for.
--
-- Step 20 (unified timeline) now has indexes on all six tables and can union
-- them by the same pair. The remaining obstacle there is the vocabulary in
-- section 3, not the shape.
-- ═══════════════════════════════════════════════════════════════════════════
