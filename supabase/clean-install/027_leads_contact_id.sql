-- ═══════════════════════════════════════════════════════════════════════════
-- 027 — LEADS.CONTACT_ID  (the Convert button's missing column)
-- Accord CRM
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN THIS IN THE SUPABASE SQL EDITOR. It does NOT arrive via git push.
-- Project: gopcrwrprpfcieljdyjt  ("Accord CRM (Clone)")
--
-- ── The bug ────────────────────────────────────────────────────────────────
-- Converting a contact to a lead failed with:
--
--     Could not find the 'contact_id' column of 'leads' in the schema cache
--
-- That is PostgREST reporting the truth. `src/services/leadsService.js` has
-- always written `contact_id` on insert (convertContactToLead, line ~235) and
-- always read it back in toApp() — but 003_leads.sql never created the column,
-- and no later migration added it. The write path and the schema disagreed
-- from the day conversion was written; nothing surfaced it until someone
-- pressed Convert.
--
-- Note the asymmetry that hid it: `contacts.linked_lead_id` DOES exist
-- (002_contacts.sql line 36). Only the other half of the pair was missing, so
-- half the link would have worked and the reading code looked fine.
--
-- ── Type ───────────────────────────────────────────────────────────────────
-- UUID, matching `leads.id` and `contacts.id`, both `UUID PRIMARY KEY DEFAULT
-- gen_random_uuid()`. Note that `contacts.linked_lead_id` is TEXT — that is
-- the existing soft-link convention and this migration does NOT change it;
-- retyping a live column is its own batch with its own backfill.
--
-- ── No foreign key, deliberately ──────────────────────────────────────────
-- Consistent with `linked_lead_id`, which 002 documents as "soft link to
-- leads.id; intentionally no FK". A hard FK would make deleting a contact
-- either fail or cascade into leads, and a converted lead should outlive the
-- contact it came from — the deal is real even if the contact record is
-- cleaned up.
--
-- ── Tenancy ────────────────────────────────────────────────────────────────
-- Nothing to do. The RESTRICTIVE org_id policy from 023 sits on the TABLE, so
-- a new column is covered by it automatically. No policy changes here.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS contact_id UUID;

COMMENT ON COLUMN public.leads.contact_id IS
  'Soft link to contacts.id when this lead was created by converting a contact. No FK, by design — a converted lead outlives its source contact.';

-- Partial index: only converted leads carry a value, and the lookup is always
-- "which lead came from this contact".
CREATE INDEX IF NOT EXISTS leads_contact_id_idx
  ON public.leads (contact_id)
  WHERE contact_id IS NOT NULL;

-- ── Verify ─────────────────────────────────────────────────────────────────
-- Expect exactly one row: contact_id | uuid | YES
SELECT column_name, data_type, is_nullable
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'leads'
  AND  column_name  = 'contact_id';
