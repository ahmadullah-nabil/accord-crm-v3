# Phase 1 — Send email

Status: **built, not yet run against a live provider.** Nothing here has been
deployed or executed; the Zoho account is the one that can prove it first.

---

## The Sent-folder question, settled

| Provider | Behaviour | Evidence |
|---|---|---|
| **Google** | `native` | Gmail applies the `SENT` system label automatically to anything sent via `messages.send`, and `SENT` **cannot be applied manually** — [Manage labels](https://developers.google.com/workspace/gmail/api/guides/labels) |
| **Microsoft** | `native` | `saveToSentItems` defaults to `true`; the docs say to specify it only when you want `false`. We send MIME, and the MIME form takes no parameters at all, so the default is the only reachable value |
| **Zoho** | `unverified` | The send API documents `fromAddress`, `toAddress`, `subject`, `content`, `mailFormat`, `askReceipt`, `encoding`, attachments and scheduling. It says **nothing** about Sent and exposes no flag |

**Decision: rely on native behaviour across all three, build no fallback, and
make the uncertainty explicit rather than silent.**

`ProviderAdapter` now carries `sentCopy: 'native' | 'unverified' | 'none'`. The
send response returns it, and the composer only says "a copy is in your Sent
folder" when it is `'native'`. A Zoho user is told the send is on the timeline
and nothing more — because promising a Sent copy that might not be there is the
exact failure this was meant to avoid.

Two things made a fallback the wrong call rather than merely unnecessary:

- **On Google a fallback is impossible.** Inserting into `SENT` needs
  `gmail.insert` or `gmail.modify`, both Restricted-tier. The native behaviour
  is the only path that keeps the scope promise — and it is the documented one.
- **On Zoho a fallback costs a scope.** Filing a copy would mean listing folders
  to find the Sent folder id (`ZohoMail.folders.READ`, a new line on the consent
  screen) plus a second call per send. That is a scope decision, not a bug fix.

**To close it:** send one message from the connected Zoho account and look in
Sent. If it is there, change `sentCopy` in `providers/zoho.ts` to `'native'` —
one word. If it is not, the fallback and its scope cost are now a decision with
a known price rather than a surprise.

---

## Three things that changed the spec

### 1. Zoho takes no raw MIME

Its endpoint wants a JSON object: `content` plus `mailFormat: html|plaintext`.
So `_shared/mime.ts` serves Gmail and Graph, and the Zoho adapter maps the same
`SendEmailInput` onto JSON fields. Consequences, all documented in the adapter:

- **The plain-text alternative is not ours to send on Zoho.** `mailFormat` picks
  one format. Zoho derives its own text part. `input.text` is still generated and
  still stored, so the CRM's record is consistent across providers.
- **Threading headers cannot be set on Zoho.** No `In-Reply-To`/`References`
  parameters. Its reply endpoint is addressed by the *original Zoho messageId*,
  obtainable only by reading the mailbox — which send-only scope forbids.

### 2. `provider_account_id` is Zoho's ZUID, not the mail `accountId`

`fetchIdentity` stores the ZUID (correct — it survives an address change). The
send endpoint needs the mail `accountId`, a different field of the same
`GET /api/accounts` response. `resolveMailAccount()` fetches it with a 10-minute
in-isolate cache, and also picks a **validated** `fromAddress` from
`sendMailDetails` rather than trusting the stored `account_email`.

*Open:* a `provider_metadata JSONB` column on `integration_accounts` would make
this durable. That is a schema change to the proven integration layer, so it is
your call, not a commit.

### 3. There is no `user_settings` table

The repo has `user_preferences` in `015_settings.sql` — documented as optional,
unwired, read from mocks. A send function depending on it would break on any
install that skipped an optional file. The signature lives in
`user_email_settings`, created by `018` alongside the table that needs it.

---

## Deliberate deviation from the spec: RLS on `email_messages`

The spec said "matching `notifications`". `notifications` grants `INSERT` to any
authenticated session, because one user legitimately creates notifications *for*
another. Copying that here would let a browser insert a row claiming
`status='sent'` with a `provider_message_id` it invented.

Every column on `email_messages` is an assertion about what a provider actually
did. So: **own-row `SELECT` only, all writes through the Edge Function under the
service-role key, `REVOKE INSERT, UPDATE, DELETE`** — the same reasoning that
left `integration_accounts` read-only in `017`.

`user_email_settings` *does* get full own-row CRUD. A signature is a real user
preference and asserts nothing about a provider.

---

## Threading: what works and what cannot

Every message carries a `Message-ID` we generate; replies carry `In-Reply-To`
and `References` pointing at the previous CRM message. **That threads a sequence
of CRM-sent messages correctly.**

Two limits, both inherent to send-only scope — not defects to debug:

1. **We can never thread onto the contact's reply.** It lands in the user's
   mailbox, which the CRM cannot read, so its `Message-ID` is unknowable.
2. **Gmail commonly replaces a caller-supplied `Message-ID`** and send-only
   scope cannot read the sent message back to learn the real one. So on Google,
   `rfc822_message_id` records what we *submitted*. `provider_thread_id` is
   stored alongside because Gmail's own `threadId` still works for the sender's
   mailbox view.

---

## Deploy

```bash
# 1. Schema
#    Run supabase/clean-install/018_email_messages.sql in the SQL editor.
#    The verify block at the bottom should print:
#      email_messages       policies=1  PASS — read-only to client
#      user_email_settings  policies=4  PASS — own-row CRUD

# 2. Function
npx supabase functions deploy send-email

# integration-token-check has been REMOVED — send-email exercises tokens.ts on
# every send, which is a better test than a read-only probe.
```

Rotate the exposed Google and Zoho client secrets first if that has not happened
yet. Existing connections survive it; refresh tokens are already stored.

## First live test

1. Connect Zoho (or a Google test user) in Settings → Integrations.
2. Open a contact with an email address → the **Mail** icon in the panel header.
3. Send a short message with `{{contact_name}}` in it. Use **Preview** first —
   unknown `{{tokens}}` are left intact rather than silently deleted, so the
   preview is what catches a typo before a client sees it.
4. Check: the message arrives; the timeline shows *sent an email*, expandable to
   recipients and a text excerpt; `email_messages` has one row with
   `status='sent'`; **and the Sent folder** — that is the open question above.

Failure paths worth exercising deliberately: send with no mailbox connected (you
should get a Connect prompt, not an error), and send to a malformed address (you
should get `invalid_recipient` naming the bad one).

---

## Phase 1b is unblocked

`buildMimeMessage()` already branches on `attachments.length` and produces the
`multipart/mixed` wrapper around the `multipart/alternative` pair. Phase 1b
populates `SendEmailInput.attachments` and enforces limits. Known ceilings to
verify live: **Graph caps a `sendMail` request near 4 MB** (larger needs
`createUploadSession`), Gmail has a threshold above which the resumable upload
path is required, and **Zoho does not take bytes at all** — attachments go
through its Upload Attachments API, which returns `storeName` /
`attachmentPath` / `attachmentName` to reference in the send body.

---

## Files

**Server**
- `supabase/functions/_shared/mime.ts` — new. MIME assembly, `htmlToText`, base64
- `supabase/functions/_shared/types.ts` — email types, `ProviderAuth`, `sentCopy`, `sendEmail`, four new error codes
- `supabase/functions/_shared/providers/{google,microsoft,zoho}.ts` — `sendEmail` + `sentCopy`
- `supabase/functions/send-email/{index.ts,compose.ts}` — new
- `supabase/clean-install/018_email_messages.sql` — new
- `supabase/config.toml` — `send-email` added, `integration-token-check` removed

**Client**
- `src/services/emailService.js`, `src/hooks/useEmail.js` — new
- `src/components/email/EmailComposer.jsx` — new
- `src/components/{contacts/ContactDetailPanel,leads/LeadDetailPanel}.jsx` — Mail action + composer
- `src/components/timeline/TimelinePanel.jsx` — renders `email_sent`
- `src/services/timelineService.js` — `EMAIL_SENT` type
- `src/services/integrationsService.js` — exported error normaliser, three new messages

`ProviderAuth` is defined in `types.ts` rather than reusing `ValidToken`, because
`tokens.ts` imports `types.ts` — depending the other way would make the module
graph circular. The caller builds it from a `ValidToken` via `authHeader()`,
which stays the single place that knows Zoho needs its own auth scheme.
