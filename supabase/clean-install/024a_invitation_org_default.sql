-- ═══════════════════════════════════════════════════════════════════════════
-- 024a — FIX: org_invitations.org_id has no DEFAULT  ⚠ RUN AFTER 024
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ WHAT IS BROKEN                                                          │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ Inviting anyone fails, even as an Admin, with:                          │
-- │                                                                          │
-- │   new row violates row-level security policy for table                   │
-- │   "org_invitations"                                                      │
-- │                                                                          │
-- │ The message is misleading. The caller's role is fine — reproduced with   │
-- │ current_org_role() returning 'Admin' and current_org_id() returning the  │
-- │ right org, and the insert still failed.                                  │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- WHY
-- ───
-- 022 gave every tenant table `org_id ... DEFAULT public.current_org_id()`.
-- 024 created org_invitations by hand and declared org_id NOT NULL with NO
-- DEFAULT — an omission, not a decision.
--
-- invitationService.js deliberately does not send org_id, on the reasoning that
-- the column defaults to the caller's org and RLS overrules anything else. With
-- no default the value is NULL, `NULL = current_org_id()` evaluates to NULL,
-- WITH CHECK is not satisfied, and Postgres reports it as an RLS violation
-- rather than as the missing value it really is.
--
-- Fixing the DEFAULT is the right repair rather than sending org_id from the
-- client: it keeps this table consistent with the other nine, and it keeps the
-- rule that a client never nominates its own tenant.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.org_invitations
  ALTER COLUMN org_id SET DEFAULT public.current_org_id();

-- The other nine tables got this in 022; org_invitations was created later and
-- missed it. Same reasoning: org_id must lead, so the planner can eliminate
-- other tenants' rows before doing anything else.
CREATE INDEX IF NOT EXISTS org_invitations_org_idx
  ON public.org_invitations (org_id);


-- ───────────────────────────────────────────────────────────────────────────
-- Verify
-- ───────────────────────────────────────────────────────────────────────────
-- The DEFAULT is what the fix is, so check for it directly. An insert cannot be
-- self-tested here: this runs as postgres with no JWT, where current_org_id()
-- is correctly NULL — the same reason the earlier hand-written INSERT needed a
-- literal org id.
SELECT
  'org_invitations.org_id default' AS check,
  CASE WHEN column_default LIKE '%current_org_id%'
       THEN 'PASS' ELSE '*** FAIL ***' END AS result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'org_invitations'
  AND column_name  = 'org_id';

-- Every tenant table should now agree. Expect zero rows.
SELECT table_name AS tables_still_missing_the_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name  = 'org_id'
  AND (column_default IS NULL OR column_default NOT LIKE '%current_org_id%')
  AND table_name IN ('leads','contacts','tasks','meetings','opportunities',
                     'activities','notifications','email_messages','teams',
                     'org_invitations');


-- ═══════════════════════════════════════════════════════════════════════════
-- AFTER THIS
-- ═══════════════════════════════════════════════════════════════════════════
-- Reload the CRM and invite someone again. No frontend change is needed —
-- invitationService.js was already written for a column that defaults.
-- ═══════════════════════════════════════════════════════════════════════════
