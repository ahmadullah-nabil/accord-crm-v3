-- ═══════════════════════════════════════════════════════════════════════════
-- 017 — EXTERNAL MAIL & CALENDAR INTEGRATIONS
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : after 001_profiles_foundation.sql (needs auth.users)
-- DEPENDS ON: auth.users only — independent of every other CRM table
-- SCOPE     : three new tables. No existing table, column or policy is touched.
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ THE THREE-TABLE SPLIT IS THE SECURITY CONTROL                           │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │                                                                          │
-- │  integration_accounts      non-secret metadata   → user-readable (RLS)   │
-- │  integration_credentials   refresh/access tokens → NO POLICIES AT ALL    │
-- │  integration_oauth_states  CSRF + PKCE state     → NO POLICIES AT ALL    │
-- │                                                                          │
-- │ RLS is ENABLED on the latter two with ZERO policies. In PostgreSQL that  │
-- │ is not "filtered access" — it is NO access. `anon` and `authenticated`   │
-- │ cannot read, insert, update or delete a single row, ever, by any query.  │
-- │ Only `service_role` (which bypasses RLS) can touch them, and the only    │
-- │ thing holding the service-role key is a Supabase Edge Function.          │
-- │                                                                          │
-- │ This means a bug in the React app CANNOT leak a refresh token, because   │
-- │ there is no policy under which PostgREST would return one. The browser   │
-- │ is not trusted to filter — it is not permitted to read.                  │
-- │                                                                          │
-- │ integration_accounts is READ-ONLY to the client: one SELECT policy and   │
-- │ nothing else. Every mutation — connect, status change, disconnect —      │
-- │ goes through an Edge Function that first verifies the OAuth grant or     │
-- │ revokes it at the provider. The browser can look, never write.           │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- NOT ENCRYPTED AT REST IN THIS PHASE (deliberate, agreed scope)
-- ──────────────────────────────────────────────────────────────
-- Tokens are stored as TEXT. supabase_vault / pgsodium column encryption is a
-- planned follow-up, not part of this phase. RLS already prevents client
-- access; encryption would add defence against a database dump. Until it lands,
-- treat a database backup of integration_credentials as sensitive material.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. INTEGRATION ACCOUNTS — safe metadata
-- ───────────────────────────────────────────────────────────────────────────
-- One row per connected external account. A user may connect several accounts
-- per provider (personal + work Gmail), which is why the unique key includes
-- provider_account_id rather than being one-row-per-provider.
CREATE TABLE public.integration_accounts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner. CASCADE so deleting a CRM user removes their integrations.
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 'google' | 'microsoft' | 'zoho'  (extensible: 'imap', 'caldav', …)
  provider            TEXT        NOT NULL,

  -- Stable provider-side identifier: Google `sub`, Microsoft `id`,
  -- Zoho `ZUID`. NOT the email — emails change, these do not.
  provider_account_id TEXT        NOT NULL,

  -- Display only. What the user recognises in the UI.
  account_email       TEXT        NOT NULL DEFAULT '',
  account_name        TEXT        NOT NULL DEFAULT '',

  -- Which capabilities this account was authorised for: {'email'},
  -- {'calendar'}, or both. Email and calendar are separate consents, so an
  -- account can legitimately hold one without the other.
  capabilities        TEXT[]      NOT NULL DEFAULT '{}',

  -- Exact scope strings the provider actually granted. Compared against what
  -- was requested — a provider may grant fewer than asked.
  granted_scopes      TEXT[]      NOT NULL DEFAULT '{}',

  -- Connection lifecycle. 'connected' is written ONLY after a token exchange
  -- has fully succeeded AND identity has been fetched.
  --   connected           working
  --   reauth_required     refresh failed / revoked / password changed
  --   revoked             user disconnected at the provider
  --   error               last provider call failed
  status              TEXT        NOT NULL DEFAULT 'connected',

  -- Zoho serves separate data centres (.com/.eu/.in/.com.au/.jp/.sa) and
  -- returns the correct API host in the token response. Hardcoding .com breaks
  -- every non-US account, so the value is persisted per account and used for
  -- all subsequent calls. NULL for providers with a single global host.
  api_domain          TEXT,

  -- Diagnostics surfaced in the UI as reconnect prompts
  last_error          TEXT,
  last_error_at       TIMESTAMPTZ,
  last_sync_at        TIMESTAMPTZ,

  connected_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT integration_accounts_provider_check
    CHECK (provider IN ('google', 'microsoft', 'zoho')),
  CONSTRAINT integration_accounts_status_check
    CHECK (status IN ('connected', 'reauth_required', 'revoked', 'error'))
);

-- Reconnecting the same external account updates the existing row instead of
-- creating a duplicate.
CREATE UNIQUE INDEX integration_accounts_unique_idx
  ON public.integration_accounts (user_id, provider, provider_account_id);

CREATE INDEX integration_accounts_user_idx     ON public.integration_accounts (user_id);
CREATE INDEX integration_accounts_provider_idx ON public.integration_accounts (provider);
CREATE INDEX integration_accounts_status_idx   ON public.integration_accounts (status);

ALTER TABLE public.integration_accounts ENABLE ROW LEVEL SECURITY;

-- Own-row only, on every command. User A cannot see, rename, or delete User
-- B's integration — enforced by Postgres, not by the client.
-- READ-ONLY FOR THE BROWSER. This is the only policy on this table.
CREATE POLICY "Users can read own integrations"
  ON public.integration_accounts FOR SELECT
  USING (auth.uid() = user_id);

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ NO INSERT, NO UPDATE, NO DELETE POLICY — DELIBERATE                     │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ Every field on this table is a security assertion, not user preference: │
-- │ provider, provider_account_id, account_email, capabilities, status,     │
-- │ granted_scopes, api_domain. They describe what a verified OAuth grant    │
-- │ actually returned.                                                       │
-- │                                                                          │
-- │ If the browser could UPDATE them it could, for example, flip `status`    │
-- │ to 'connected' on a broken account, widen `capabilities` beyond what the │
-- │ user consented to, repoint `api_domain` at an attacker-controlled host,  │
-- │ or rewrite `granted_scopes` so a later scope check passes. None of that  │
-- │ is a legitimate client operation.                                        │
-- │                                                                          │
-- │ All writes therefore happen in Edge Functions holding the service-role   │
-- │ key, after a verified token exchange:                                    │
-- │   INSERT / UPDATE  → oauth-callback                                      │
-- │   DELETE           → integration-disconnect (which also revokes at the   │
-- │                      provider first, something a raw DELETE cannot do —  │
-- │                      a client-side delete would silently orphan a live   │
-- │                      grant at Google/Zoho with no local record of it)    │
-- │                                                                          │
-- │ service_role bypasses RLS, so those functions are unaffected by the      │
-- │ absence of policies here. Ownership is enforced inside them by an        │
-- │ explicit .eq('user_id', caller.id) filter on every statement.            │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Defence in depth: withdraw the table-level privileges as well, so even a
-- policy added here by mistake in future would not be sufficient to write.
-- SELECT is intentionally left granted.
REVOKE INSERT, UPDATE, DELETE ON public.integration_accounts FROM anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. INTEGRATION CREDENTIALS — secrets, service_role only
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE public.integration_credentials (
  -- PK is also the FK: exactly one credential row per account, and it dies
  -- with the account.
  account_id     UUID        PRIMARY KEY
                             REFERENCES public.integration_accounts(id) ON DELETE CASCADE,

  access_token   TEXT        NOT NULL,
  refresh_token  TEXT,          -- absent if the provider issued none (see below)
  token_type     TEXT        NOT NULL DEFAULT 'Bearer',

  -- Drives proactive refresh before an API call rather than retry-on-401.
  expires_at     TIMESTAMPTZ,

  -- Provider-side revocation endpoint host, captured at connect time so
  -- disconnect works even if the provider's account moves DC.
  revoke_domain  TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS ON, ZERO POLICIES → total denial for anon and authenticated.
-- This is the single most important statement in the file. Do not add a
-- policy here. If a future feature needs token data, it belongs in an Edge
-- Function using the service-role key, not in the browser.
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

-- Belt and braces: even the grant is withdrawn, so a mistakenly added policy
-- still would not be enough to read this table from the client.
REVOKE ALL ON public.integration_credentials FROM anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- 3. OAUTH STATE — CSRF + PKCE, single-use
-- ───────────────────────────────────────────────────────────────────────────
-- Written by oauth-start, consumed exactly once by oauth-callback. Binds the
-- provider redirect back to the user who initiated it, so a stolen or replayed
-- callback URL cannot attach someone else's mailbox to this account.
CREATE TABLE public.integration_oauth_states (
  state          TEXT        PRIMARY KEY,   -- high-entropy random, in the OAuth `state` param

  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider       TEXT        NOT NULL,
  capability     TEXT        NOT NULL,      -- 'email' | 'calendar'

  -- PKCE. Only the S256 challenge goes to the provider; the verifier never
  -- leaves the server.
  code_verifier  TEXT        NOT NULL,

  -- Where to send the browser afterwards (validated against an allow-list in
  -- the callback — never redirected to blindly).
  redirect_to    TEXT        NOT NULL DEFAULT '/settings',

  -- Single-use marker. A second callback with the same state is rejected.
  consumed_at    TIMESTAMPTZ,

  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT integration_oauth_states_capability_check
    CHECK (capability IN ('email', 'calendar'))
);

CREATE INDEX integration_oauth_states_user_idx    ON public.integration_oauth_states (user_id);
CREATE INDEX integration_oauth_states_expires_idx ON public.integration_oauth_states (expires_at);

-- Same total-denial model as credentials: code_verifier is a secret.
ALTER TABLE public.integration_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.integration_oauth_states FROM anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- 4. HOUSEKEEPING
-- ───────────────────────────────────────────────────────────────────────────
-- Expired state rows are dead weight and, until purged, replay surface.
-- Called opportunistically by oauth-start; safe to also schedule with pg_cron.
-- SECURITY DEFINER so the Edge Function can call it without owning the table.
CREATE OR REPLACE FUNCTION public.purge_expired_oauth_states()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed INTEGER;
BEGIN
  DELETE FROM public.integration_oauth_states
  WHERE expires_at < NOW() - INTERVAL '1 hour';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

-- Only the server may run it.
REVOKE ALL ON FUNCTION public.purge_expired_oauth_states() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_oauth_states() TO service_role;


-- Keep updated_at honest without every caller remembering to set it.
CREATE OR REPLACE FUNCTION public.touch_integration_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER integration_accounts_touch
  BEFORE UPDATE ON public.integration_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_integration_updated_at();

CREATE TRIGGER integration_credentials_touch
  BEFORE UPDATE ON public.integration_credentials
  FOR EACH ROW EXECUTE FUNCTION public.touch_integration_updated_at();


-- ───────────────────────────────────────────────────────────────────────────
-- 5. VERIFY (read-only)
-- ───────────────────────────────────────────────────────────────────────────
-- Expected:
--   integration_accounts      rls=t  policies=1   ← SELECT only
--   integration_credentials   rls=t  policies=0   ← MUST be 0
--   integration_oauth_states  rls=t  policies=0   ← MUST be 0
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count,
  CASE
    WHEN c.relname = 'integration_accounts'
      THEN CASE
        WHEN c.relrowsecurity AND (SELECT COUNT(*) FROM pg_policies p
          WHERE p.schemaname = 'public' AND p.tablename = c.relname) = 1
        THEN 'PASS — read-only to client'
        ELSE 'FAIL — expected exactly 1 SELECT policy' END
    ELSE CASE
      WHEN c.relrowsecurity AND (SELECT COUNT(*) FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = c.relname) = 0
      THEN 'PASS — locked to service_role'
      ELSE 'FAIL — client access is possible' END
  END AS status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('integration_accounts', 'integration_credentials', 'integration_oauth_states')
ORDER BY c.relname;
