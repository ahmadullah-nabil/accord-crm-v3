-- ═══════════════════════════════════════════════════════════════════════════
-- 019. CREDENTIALS PER CAPABILITY  (+ provider_metadata)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- THE BUG THIS FIXES
-- ──────────────────
-- 017 gave integration_credentials a PRIMARY KEY of (account_id) — exactly one
-- token per account. But `email` and `calendar` are independent grants: the
-- user consents to them separately, and each consent returns its own token.
--
-- With one credential row per account, the second connect OVERWRITES the first:
--
--   1. Connect Zoho Mail      → token A stored  (ZohoMail.messages.CREATE)
--   2. Connect Zoho Calendar  → token B REPLACES A  (ZohoCalendar.event.ALL)
--
-- oauth-callback merges `capabilities` to ['email','calendar'] but overwrites
-- `granted_scopes` with token B's scopes. The row now CLAIMS email access while
-- holding a token that has none. getTokenForCapability(user,'email') returns it
-- happily and Zoho answers the mail API with 404.
--
-- That is not a hypothetical: it is the exact failure hit on the first live
-- send in Phase 1.
--
-- Note which field was lying. `granted_scopes` was correct — it described the
-- token actually stored. `capabilities` was the false one, asserting a power
-- the stored credential could not exercise.
--
-- WHY GOOGLE APPEARED TO WORK
-- ───────────────────────────
-- google.ts sends `include_granted_scopes: 'true'`, so Google's second token
-- genuinely carries both scope sets and the merge is truthful there. Zoho has
-- no equivalent parameter. Microsoft's behaviour differs again. Keying
-- credentials by capability removes the dependence on per-provider incremental
-- consent semantics entirely — the design stops needing to know.
--
-- WHY NOT "ONE CAPABILITY AT A TIME ON ZOHO"
-- ──────────────────────────────────────────
-- 017 already states email and calendar are separate capabilities and that one
-- may be granted without the other. The schema simply failed to honour it. This
-- migration makes the storage match the design that was already documented,
-- rather than degrading the design to match the storage.
--
-- URGENCY: harmless today only because calendar-sync does not exist. The moment
-- Phase 2 ships, connecting a calendar silently kills that user's email.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. provider_metadata — folded in here to avoid a second migration
-- ───────────────────────────────────────────────────────────────────────────
-- Durable, non-secret, provider-specific facts discovered after connect.
--
-- First user: Zoho's mail `accountId`. Its send endpoint needs it, but
-- `provider_account_id` holds the ZUID (correct — that survives an address
-- change), so send-email currently re-fetches GET /api/accounts on a 10-minute
-- in-isolate cache. A cold isolate pays that round trip on every send.
--
-- Phase 2 will want somewhere for the primary calendar id. NOT for tokens or
-- anything secret — this table is client-readable.
ALTER TABLE public.integration_accounts
  ADD COLUMN IF NOT EXISTS provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.integration_accounts.provider_metadata IS
  'Non-secret provider-specific identifiers (Zoho mail accountId, calendar ids). Never tokens — this table is readable by the owning user.';


-- ───────────────────────────────────────────────────────────────────────────
-- 2. Add the capability column
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.integration_credentials
  ADD COLUMN IF NOT EXISTS capability TEXT;


-- ───────────────────────────────────────────────────────────────────────────
-- 3. Backfill — expand each existing credential to the capabilities its
--    scopes ACTUALLY support
-- ───────────────────────────────────────────────────────────────────────────
-- The honest question for every existing row is: which capabilities can this
-- stored token really exercise? `granted_scopes` answers it, because it
-- describes the token we hold rather than what the account claims.
--
-- Google connected for both → its token covers both → two rows, both working.
-- Zoho connected for both  → its token covers only the LAST one → one row, and
--                             `capabilities` is corrected downward to match.
--
-- The user then reconnects the dropped capability, which now stores a SECOND
-- credential instead of destroying the first.
--
-- Marker scopes per provider/capability:
--   email     gmail.send | Mail.Send | ZohoMail.messages.*
--   calendar  calendar   | Calendars.ReadWrite | ZohoCalendar.*
-- Matching is case-insensitive and substring-based, so scope URL prefixes and
-- version suffixes do not need enumerating.
CREATE TEMP TABLE _cred_expansion ON COMMIT DROP AS
SELECT
  c.account_id,
  cap                                              AS capability,
  c.access_token,
  c.refresh_token,
  c.token_type,
  c.expires_at,
  c.revoke_domain,
  c.created_at,
  c.updated_at
FROM public.integration_credentials c
JOIN public.integration_accounts a ON a.id = c.account_id
CROSS JOIN LATERAL unnest(a.capabilities) AS cap
WHERE EXISTS (
  SELECT 1
  FROM unnest(a.granted_scopes) AS s
  WHERE
    (cap = 'email' AND (
         s ILIKE '%gmail.send%'
      OR s ILIKE '%mail.send%'
      OR s ILIKE '%zohomail.messages%'
    ))
    OR
    (cap = 'calendar' AND (
         s ILIKE '%calendar%'
    ))
);

-- Replace wholesale. Every row in the expansion carries its origin row's token,
-- so nothing is invented and nothing usable is lost.
DELETE FROM public.integration_credentials;

-- ORDER MATTERS. The old PRIMARY KEY is (account_id) ALONE, so it must come off
-- BEFORE the insert below — an account connected for both email and calendar
-- produces two rows sharing an account_id, and the old key rejects the second
-- with `duplicate key value violates unique constraint`. Dropping it after the
-- insert, which reads more naturally, cannot work.
--
-- The PK carried two meanings in 017: identity, and "exactly one per account".
-- Only the first was wanted.
ALTER TABLE public.integration_credentials
  DROP CONSTRAINT IF EXISTS integration_credentials_pkey;

INSERT INTO public.integration_credentials
  (account_id, capability, access_token, refresh_token, token_type,
   expires_at, revoke_domain, created_at, updated_at)
SELECT
  account_id, capability, access_token, refresh_token, token_type,
  expires_at, revoke_domain, created_at, updated_at
FROM _cred_expansion;


-- ───────────────────────────────────────────────────────────────────────────
-- 4. Make `capabilities` truthful
-- ───────────────────────────────────────────────────────────────────────────
-- An account may now claim a capability it has no credential for — that is the
-- original bug, still present in the data. Narrow each account to the
-- capabilities it can actually exercise.
UPDATE public.integration_accounts a
SET capabilities = COALESCE(
      (SELECT array_agg(DISTINCT c.capability)
         FROM public.integration_credentials c
        WHERE c.account_id = a.id),
      '{}'::text[]
    ),
    updated_at = NOW();

-- An account with no working credential at all cannot serve any request. Say so
-- rather than showing a green badge over a dead connection.
UPDATE public.integration_accounts
SET status        = 'reauth_required',
    last_error    = 'Stored credentials did not cover any capability after the 019 migration. Please reconnect.',
    last_error_at = NOW(),
    updated_at    = NOW()
WHERE cardinality(capabilities) = 0
  AND status = 'connected';


-- ───────────────────────────────────────────────────────────────────────────
-- 5. Enforce the new shape
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.integration_credentials
  ALTER COLUMN capability SET NOT NULL;

-- Guarded so the whole migration can be re-run after a failed attempt without
-- tripping over its own leftovers.
ALTER TABLE public.integration_credentials
  DROP CONSTRAINT IF EXISTS integration_credentials_capability_check;

ALTER TABLE public.integration_credentials
  ADD CONSTRAINT integration_credentials_capability_check
  CHECK (capability IN ('email', 'calendar'));

-- The composite key the old one should have been.
ALTER TABLE public.integration_credentials
  ADD CONSTRAINT integration_credentials_pkey
  PRIMARY KEY (account_id, capability);

-- ON DELETE CASCADE from 017 is preserved through the column-level REFERENCES,
-- so deleting an account still removes every credential it owns.

CREATE INDEX IF NOT EXISTS integration_credentials_account_idx
  ON public.integration_credentials (account_id);

COMMENT ON COLUMN public.integration_credentials.capability IS
  'Which grant this token belongs to. Email and calendar are consented separately and each returns its own token; storing one row per account let the second connect silently destroy the first.';


-- ───────────────────────────────────────────────────────────────────────────
-- 6. RLS is unchanged and still total denial
-- ───────────────────────────────────────────────────────────────────────────
-- Restated because it is the single most important property of this table and
-- adding a column is exactly the kind of change that invites a policy to be
-- added alongside it. Do not. Token access belongs in Edge Functions holding
-- the service-role key.
--   ALTER TABLE ... ENABLE ROW LEVEL SECURITY;  -- already on, zero policies
--   REVOKE ALL ... FROM anon, authenticated;    -- already withdrawn


-- ───────────────────────────────────────────────────────────────────────────
-- VERIFY
-- ───────────────────────────────────────────────────────────────────────────
-- Expect one row per (account, capability), and capabilities matching exactly:
--
--   SELECT a.provider, a.account_email, a.capabilities, a.status,
--          array_agg(c.capability ORDER BY c.capability) AS credential_caps
--     FROM public.integration_accounts a
--     LEFT JOIN public.integration_credentials c ON c.account_id = a.id
--    GROUP BY a.id, a.provider, a.account_email, a.capabilities, a.status;
--
-- `capabilities` and `credential_caps` must agree on every row. Zoho is
-- expected to show ONE capability here — reconnect the other in
-- Settings → Integrations, which will now add a row rather than replace one.
