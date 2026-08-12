-- ═══════════════════════════════════════════════════════════════════════════
-- 018 — OUTBOUND EMAIL  (Phase 1)
-- Accord CRM · Clean Install Package
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RUN ORDER : after 017_integrations.sql (needs integration_accounts)
-- DEPENDS ON: auth.users, public.integration_accounts
-- SCOPE     : two new tables. No existing table, column or policy is touched.
--
-- Adds the log of every message the CRM sends, plus the per-user signature the
-- send function appends. Both are new; nothing here alters Phase 0 or the
-- integration layer.
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ WHY THE SIGNATURE IS NOT IN user_preferences                            │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ 015_settings.sql is documented as OPTIONAL and the running app does not │
-- │ query it — useSettings.js reads mocks from src/lib/settingsData.js. A   │
-- │ send function that read the signature from user_preferences would       │
-- │ therefore break on any install that skipped an optional file, and the   │
-- │ failure would look like "the signature vanished" rather than "a         │
-- │ migration was not run".                                                  │
-- │                                                                          │
-- │ user_email_settings lives here instead, in the same file as the table    │
-- │ that cannot work without it. If 015 is ever wired up properly, merging   │
-- │ this into it is a small, deliberate migration rather than a silent       │
-- │ dependency today.                                                        │
-- └─────────────────────────────────────────────────────────────────────────┘


-- ───────────────────────────────────────────────────────────────────────────
-- 1. EMAIL MESSAGES — one row per send attempt
-- ───────────────────────────────────────────────────────────────────────────
-- Written by the send-email Edge Function, as 'queued' BEFORE the provider
-- call and updated to 'sent' or 'failed' after it. Rows are never written by
-- the browser; see the RLS note below.
CREATE TABLE public.email_messages (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Sender. CASCADE so deleting a CRM user removes their send history.
  user_id                UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Which connected mailbox sent it. SET NULL rather than CASCADE: if the user
  -- disconnects Gmail, the record that a quotation was sent last March must
  -- survive. The history is not a property of the connection.
  integration_account_id UUID        REFERENCES public.integration_accounts(id) ON DELETE SET NULL,

  -- Denormalised from the account so the row stays readable after that account
  -- is disconnected and integration_account_id has gone NULL.
  provider               TEXT        NOT NULL,
  from_email             TEXT        NOT NULL DEFAULT '',
  from_name              TEXT        NOT NULL DEFAULT '',

  to_emails              TEXT[]      NOT NULL DEFAULT '{}',
  cc_emails              TEXT[]      NOT NULL DEFAULT '{}',
  -- Stored. Bcc recipients are hidden from the OTHER recipients, not from the
  -- sender's own record of what they sent — and "who did this actually go to"
  -- is the first question anyone asks of a sent-mail log.
  bcc_emails             TEXT[]      NOT NULL DEFAULT '{}',

  subject                TEXT        NOT NULL DEFAULT '',
  -- Both parts, exactly as submitted. body_text is what the UI renders back;
  -- body_html is sanitised at compose time but is still never rendered into a
  -- CRM page as markup.
  body_html              TEXT        NOT NULL DEFAULT '',
  body_text              TEXT        NOT NULL DEFAULT '',

  -- ── Identifiers: three different things, deliberately three columns ──────
  -- rfc822_message_id   the Message-ID header WE generated and sent. This is
  --                     the value a later reply puts in In-Reply-To.
  --                     CAVEAT: Gmail commonly substitutes its own on send and
  --                     send-only scope cannot read the sent message back, so
  --                     on Google this records what we submitted, which is not
  --                     guaranteed to be what recipients received.
  -- provider_message_id the provider's internal id. Gmail returns one, Zoho
  --                     returns one, Microsoft Graph returns 202 with an empty
  --                     body and no id at all — hence nullable.
  -- provider_thread_id  the provider's conversation id, where the concept
  --                     exists. Gmail only, today.
  rfc822_message_id      TEXT,
  provider_message_id    TEXT,
  provider_thread_id     TEXT,

  -- Threading chain as sent. `references` is a reserved word in SQL, so the
  -- column is reference_ids — renaming it later would be a breaking change to
  -- the send function, so it is named correctly from the start.
  in_reply_to            TEXT,
  reference_ids          TEXT[]      NOT NULL DEFAULT '{}',

  -- ── Soft link to the CRM record ──────────────────────────────────────────
  -- No foreign key, matching how `activities` links to entities: a deleted
  -- lead must not delete the evidence that a proposal was emailed to them.
  --
  -- NOTE the type difference from activities.entity_id, which is TEXT because
  -- its services write String(id). These are real UUIDs from contacts, leads
  -- and opportunities, and typing them as UUID makes the database reject a
  -- malformed id instead of storing it.
  related_type           TEXT,       -- 'lead' | 'contact' | 'opportunity'
  related_id             UUID,
  related_label          TEXT        NOT NULL DEFAULT '',

  -- ── Outcome ──────────────────────────────────────────────────────────────
  --   queued  row written, provider not yet called
  --   sent    the provider accepted it
  --   failed  the provider rejected it, or we never reached it
  --
  -- 'sent' means ACCEPTED FOR DELIVERY, not delivered. Graph in particular
  -- returns 202 Accepted, which explicitly does not promise delivery. Bounce
  -- tracking would need inbound mail access and is out of scope.
  status                 TEXT        NOT NULL DEFAULT 'queued',
  error                  TEXT,
  -- The provider's own code, kept separate from the prose. Phase 3's retry
  -- logic needs to tell throttling from a bad address, and that distinction
  -- lives in the code, not the message — same reasoning as
  -- IntegrationError.providerError.
  error_code             TEXT,

  sent_at                TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT email_messages_status_check
    CHECK (status IN ('queued', 'sent', 'failed')),
  CONSTRAINT email_messages_provider_check
    CHECK (provider IN ('google', 'microsoft', 'zoho')),
  CONSTRAINT email_messages_related_type_check
    CHECK (related_type IS NULL OR related_type IN ('lead', 'contact', 'opportunity'))
);

-- ── Indexes ────────────────────────────────────────────────────────────────
-- "my sent mail, newest first"
CREATE INDEX email_messages_user_idx
  ON public.email_messages (user_id, created_at DESC);
-- "everything sent to this lead" — the detail panel's query
CREATE INDEX email_messages_related_idx
  ON public.email_messages (related_type, related_id);
-- Partial: failures are the rare case and the one worth scanning for.
CREATE INDEX email_messages_failed_idx
  ON public.email_messages (user_id, created_at DESC)
  WHERE status = 'failed';
-- Threading lookups when composing a reply.
CREATE INDEX email_messages_thread_idx
  ON public.email_messages (provider_thread_id)
  WHERE provider_thread_id IS NOT NULL;

-- ── Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sent email"
  ON public.email_messages FOR SELECT
  USING (auth.uid() = user_id);

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ NO INSERT, UPDATE OR DELETE POLICY — AND WHY THIS DIFFERS FROM          │
-- │ notifications, WHICH WAS THE STATED MODEL                               │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ notifications grants INSERT to any authenticated session, because one   │
-- │ user legitimately creates notifications FOR another (assignment, など). │
-- │ Copying that here would let a browser INSERT a row claiming             │
-- │ status='sent' with a provider_message_id it invented.                    │
-- │                                                                          │
-- │ Every column on this table is an assertion about something that         │
-- │ happened at a provider: which mailbox sent it, what the provider        │
-- │ returned, whether it was accepted. None of that is a user preference    │
-- │ the client is entitled to state. This is the same reasoning that left   │
-- │ integration_accounts read-only in 017.                                   │
-- │                                                                          │
-- │ All writes go through the send-email Edge Function under the            │
-- │ service-role key, which bypasses RLS and filters on user_id explicitly. │
-- │ The browser can read its own history and nothing else.                  │
-- └─────────────────────────────────────────────────────────────────────────┘
REVOKE INSERT, UPDATE, DELETE ON public.email_messages FROM anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. USER EMAIL SETTINGS — the per-user signature
-- ───────────────────────────────────────────────────────────────────────────
-- Read by send-email at send time rather than accepted from the client, so the
-- signature on the stored copy and the signature on the sent message cannot
-- disagree.
CREATE TABLE public.user_email_settings (
  -- PK, not a surrogate id: supabase-js .upsert() resolves its conflict target
  -- from the primary key, and the client saves with { user_id, ... }. Same
  -- reasoning as user_preferences.user_id in 015.
  user_id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Limited HTML from the composer's editor. Sanitised again server-side on
  -- every send — never trust that what was stored was clean, because the
  -- sanitiser may have been improved since the row was written.
  signature_html    TEXT        NOT NULL DEFAULT '',

  -- Lets a user keep a signature on file while sending one message without it.
  include_signature BOOLEAN     NOT NULL DEFAULT TRUE,

  -- Overrides the display name from the provider account, e.g. "Rayhan Ahmed
  -- · Accord Technologies" rather than whatever the Google profile says.
  from_name         TEXT        NOT NULL DEFAULT '',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_email_settings ENABLE ROW LEVEL SECURITY;

-- Full own-row CRUD here, unlike email_messages above: a signature IS a user
-- preference, it asserts nothing about a provider, and the user is the only
-- party with any business setting it. Mirrors user_preferences in 015 — no
-- admin override policy, because nobody else needs to read it.
CREATE POLICY "Users can read own email settings"
  ON public.user_email_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email settings"
  ON public.user_email_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email settings"
  ON public.user_email_settings FOR UPDATE
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own email settings"
  ON public.user_email_settings FOR DELETE
  USING (auth.uid() = user_id);


-- ───────────────────────────────────────────────────────────────────────────
-- 3. HOUSEKEEPING
-- ───────────────────────────────────────────────────────────────────────────
-- Reuses the trigger function created by 017. Declared with CREATE OR REPLACE
-- there, so this file does not redefine it — it only attaches it.
CREATE TRIGGER email_messages_touch
  BEFORE UPDATE ON public.email_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_integration_updated_at();

CREATE TRIGGER user_email_settings_touch
  BEFORE UPDATE ON public.user_email_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_integration_updated_at();


-- ───────────────────────────────────────────────────────────────────────────
-- 4. VERIFY (read-only)
-- ───────────────────────────────────────────────────────────────────────────
-- Expected:
--   email_messages       rls=t  policies=1   ← SELECT only, server writes
--   user_email_settings  rls=t  policies=4   ← full own-row CRUD
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count,
  CASE
    WHEN c.relname = 'email_messages' THEN
      CASE WHEN c.relrowsecurity AND (SELECT COUNT(*) FROM pg_policies p
             WHERE p.schemaname = 'public' AND p.tablename = c.relname) = 1
           THEN 'PASS — read-only to client'
           ELSE 'FAIL — expected exactly 1 SELECT policy' END
    ELSE
      CASE WHEN c.relrowsecurity AND (SELECT COUNT(*) FROM pg_policies p
             WHERE p.schemaname = 'public' AND p.tablename = c.relname) = 4
           THEN 'PASS — own-row CRUD'
           ELSE 'FAIL — expected 4 policies' END
  END AS status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('email_messages', 'user_email_settings')
ORDER BY c.relname;
