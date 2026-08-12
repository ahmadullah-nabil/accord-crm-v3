-- ═══════════════════════════════════════════════════════════════════════════
-- 004 — TASKS
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : 4 of 15
-- DEPENDS ON: nothing (fully standalone table)
-- SOURCE    : supabase/tasks_migration.sql
--
-- Column names match the toApp() / toDb() mappers in
-- src/services/tasksService.js.
--
-- Tasks have no owner_id — visibility is resolved by display name via
-- assignee / created_by. created_by is added by file 007.
--
-- RLS NOTE: the blanket FOR ALL policy here is interim — file 009 replaces it.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.tasks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  title           TEXT        NOT NULL,
  description     TEXT                    DEFAULT '',

  -- Must match TASK_STATUSES / TASK_PRIORITIES in src/lib/tasksData.js
  -- ('Todo'|'In Progress'|'Completed'|'Overdue')
  status          TEXT        NOT NULL    DEFAULT 'Todo',
  -- ('Low'|'Medium'|'High'|'Urgent')
  priority        TEXT        NOT NULL    DEFAULT 'Medium',

  -- Scheduling
  due_date        DATE,                   -- NULL = no due date set
  assignee        TEXT                    DEFAULT '',

  -- Related entity (Lead or Contact) — soft link, no FK
  related_type    TEXT                    DEFAULT 'None',
  related_id      TEXT                    DEFAULT '',
  related_label   TEXT                    DEFAULT '',

  -- Set by the service when status becomes 'Completed'; cleared when it changes away
  completed_at    DATE,

  tags            TEXT[]                  DEFAULT '{}',

  created_at      DATE        NOT NULL    DEFAULT CURRENT_DATE
);

-- ── Row Level Security (interim — superseded by file 009) ──────────────────
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access tasks"
  ON public.tasks
  FOR ALL
  USING      (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX tasks_due_date_idx   ON public.tasks (due_date ASC NULLS LAST);
CREATE INDEX tasks_status_idx     ON public.tasks (status);
CREATE INDEX tasks_priority_idx   ON public.tasks (priority);
CREATE INDEX tasks_assignee_idx   ON public.tasks (lower(assignee));
CREATE INDEX tasks_created_at_idx ON public.tasks (created_at DESC);
