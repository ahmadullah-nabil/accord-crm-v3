-- ═══════════════════════════════════════════════════════════════════════════
-- 009 — RBAC ROW LEVEL SECURITY POLICIES
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : 9 of 15
-- DEPENDS ON: 001 (profiles), 002 (contacts), 003 (leads), 004 (tasks),
--             005 (meetings), 006 (activities), 007 (owner_id / created_by /
--             actor_id columns), 008 (get_visible_profile_ids)
-- SOURCE    : supabase/rbac_rls.sql — SECTIONS 2 THROUGH 7 ONLY
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ Section 1 of the original rbac_rls.sql is deliberately ABSENT.          │
-- │ It contained the broken get_visible_profile_ids() definition that       │
-- │ aborted the whole script. The correct function lives in file 008 and    │
-- │ is already installed by the time this file runs.                        │
-- │ The duplicate CREATE INDEX on profiles_manager_id_idx from that section │
-- │ is also omitted — file 001 already creates that index.                  │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- ACCESS MODEL
-- ────────────
--   Admin / AGM  → sees ALL records in every table
--   Manager      → sees own records + every subordinate's records (recursive)
--   Employee     → sees only records where they are the owner / assignee
--
-- "Seeing" a record means any of:
--   • leads.owner_id      = auth.uid()::text
--   • tasks.assignee      = the user's profiles.name
--   • meetings.organizer  = the user's profiles.name
--   • activities.actor_id = auth.uid()::text
--   • the record belongs to a subordinate (resolved by get_visible_profile_ids)
--
-- SCOPE: this is READ-ONLY enforcement. INSERT / UPDATE / DELETE remain open to
-- any authenticated user, exactly as in the original safe-rollout design.
-- Do not tighten this here without a matching frontend change.
--
-- SAFE ROLLOUT GUARANTEE: every USING clause opens with an Admin/AGM fast path,
-- so a misconfigured manager_id hierarchy can never lock an administrator out.
--
-- GRACEFUL DEGRADATION: rows with NULL owner_id / assignee / actor_id fall
-- through to the name-based check or simply return no rows rather than erroring.
--
-- The DROP statements below remove the interim blanket policies created in
-- files 002–006. They are written WITHOUT "IF EXISTS" on purpose: if a table's
-- interim policy is missing, the install order was not followed and this file
-- must fail loudly rather than leave a half-configured policy set.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 2 — LEADS
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY "Authenticated users can access leads" ON public.leads;

-- A lead is visible when ANY of these is true:
--   (a) the user is Admin/AGM                    → all leads
--   (b) leads.owner_id matches auth.uid()        → the creating user
--   (c) leads.assignee matches the user's name   → fallback for rows w/o owner_id
--   (d) leads.owner_id belongs to a visible subordinate
CREATE POLICY "Leads SELECT — role-scoped"
  ON public.leads
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      -- Admin / AGM fast path — avoids evaluating the recursive CTE
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('Admin', 'AGM')
      )
      -- Owner match (owner_id is TEXT, so auth.uid() is cast to text)
      OR (owner_id IS NOT NULL AND owner_id = auth.uid()::text)
      -- Assignee display-name match
      OR assignee = (
        SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1
      )
      -- Subordinate visibility (a manager sees their team's leads)
      OR (
        owner_id IS NOT NULL
        AND owner_id::uuid IN (
          SELECT profile_id FROM public.get_visible_profile_ids(auth.uid())
        )
      )
    )
  );

CREATE POLICY "Leads INSERT — authenticated"
  ON public.leads
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Leads UPDATE — authenticated"
  ON public.leads
  FOR UPDATE
  USING      (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Leads DELETE — authenticated"
  ON public.leads
  FOR DELETE
  USING (auth.role() = 'authenticated');


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 3 — TASKS
-- Tasks have no owner_id; visibility is resolved through display names.
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY "Authenticated users can access tasks" ON public.tasks;

CREATE POLICY "Tasks SELECT — role-scoped"
  ON public.tasks
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('Admin', 'AGM')
      )
      OR assignee = (
        SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1
      )
      OR created_by = (
        SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1
      )
      -- Manager: tasks assigned to any visible team member
      OR assignee IN (
        SELECT p.name
        FROM public.profiles p
        WHERE p.id IN (
          SELECT profile_id FROM public.get_visible_profile_ids(auth.uid())
        )
      )
    )
  );

CREATE POLICY "Tasks INSERT — authenticated"
  ON public.tasks
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Tasks UPDATE — authenticated"
  ON public.tasks
  FOR UPDATE
  USING      (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Tasks DELETE — authenticated"
  ON public.tasks
  FOR DELETE
  USING (auth.role() = 'authenticated');


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 4 — MEETINGS
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY "Authenticated users can access meetings" ON public.meetings;

CREATE POLICY "Meetings SELECT — role-scoped"
  ON public.meetings
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('Admin', 'AGM')
      )
      OR organizer = (
        SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1
      )
      OR created_by = (
        SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1
      )
      -- Participant visibility: the user's name is in the participants array
      OR auth.uid()::text = ANY(
        SELECT p.id::text
        FROM public.profiles p
        WHERE p.name = ANY(participants)
          AND p.id IN (
            SELECT profile_id FROM public.get_visible_profile_ids(auth.uid())
          )
      )
      -- Manager: meetings organised by visible team members
      OR organizer IN (
        SELECT p.name
        FROM public.profiles p
        WHERE p.id IN (
          SELECT profile_id FROM public.get_visible_profile_ids(auth.uid())
        )
      )
    )
  );

CREATE POLICY "Meetings INSERT — authenticated"
  ON public.meetings
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Meetings UPDATE — authenticated"
  ON public.meetings
  FOR UPDATE
  USING      (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Meetings DELETE — authenticated"
  ON public.meetings
  FOR DELETE
  USING (auth.role() = 'authenticated');


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 5 — ACTIVITIES (interim)
-- ───────────────────────────────────────────────────────────────────────────
-- This actor-based SELECT policy is INTENTIONALLY REPLACED by file 013, which
-- switches activity visibility from "who wrote the event" to "can you see the
-- parent entity". It is created here to preserve the original migration
-- history and to keep the timeline readable if you pause the install at 009.
-- Activities are append-only: no UPDATE or DELETE policy is ever created.
DROP POLICY "Authenticated users can access activities" ON public.activities;

CREATE POLICY "Activities SELECT — role-scoped"
  ON public.activities
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('Admin', 'AGM')
      )
      OR actor_id = auth.uid()::text
      OR actor_id IN (
        SELECT profile_id::text
        FROM public.get_visible_profile_ids(auth.uid())
      )
      -- Fallback: actor display name matches, for rows without actor_id
      OR (actor_id IS NULL AND actor = (
        SELECT name FROM public.profiles WHERE id = auth.uid() LIMIT 1
      ))
    )
  );

CREATE POLICY "Activities INSERT — authenticated"
  ON public.activities
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');


-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 6 — CONTACTS
-- Contacts use the simpler open-read model: all authenticated users see all
-- contacts. Contacts have no owner_id in this schema, so per-user scoping is
-- deferred. Preserved exactly as in the original.
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY "Authenticated users can access contacts" ON public.contacts;

CREATE POLICY "Contacts SELECT — authenticated"
  ON public.contacts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Contacts INSERT — authenticated"
  ON public.contacts FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Contacts UPDATE — authenticated"
  ON public.contacts FOR UPDATE
  USING      (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Contacts DELETE — authenticated"
  ON public.contacts FOR DELETE
  USING (auth.role() = 'authenticated');
