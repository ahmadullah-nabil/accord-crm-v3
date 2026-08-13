// ─── send-email ───────────────────────────────────────────────────────────────
//
// PHASE 1. The first feature that actually uses a connected account.
//
// Everything before this proved the plumbing: OAuth connects, tokens refresh,
// providers accept the refreshed token. Nothing sent anything. This does.
//
//   POST /functions/v1/send-email
//   { to, cc?, bcc?, subject, html, variables?, related?, thread?, replyTo? }
//
// Authenticated (verify_jwt = true, the default). The caller's JWT decides
// whose mailbox is used — the client never names an account, because it must
// not be able to send from somebody else's connection by passing an id.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ THREADING, AND WHAT SEND-ONLY SCOPE COSTS                               │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Every message carries a Message-ID we generate, and replies carry       │
// │ In-Reply-To / References pointing at the previous CRM message. That     │
// │ threads a SEQUENCE OF CRM-SENT MESSAGES correctly in the recipient's    │
// │ client.                                                                  │
// │                                                                          │
// │ What it cannot do is thread onto the contact's REPLY. That reply lands   │
// │ in the user's mailbox, which the CRM cannot read — gmail.readonly is     │
// │ Restricted-tier and is never being added. Without reading it we do not   │
// │ know its Message-ID, so we cannot reference it.                          │
// │                                                                          │
// │ There is a second, subtler gap: Gmail commonly REPLACES a caller-        │
// │ supplied Message-ID with its own, and send-only scope cannot read the    │
// │ sent message back to learn the real one. So on Gmail the stored          │
// │ rfc822_message_id may not be the id recipients actually saw, and a       │
// │ later reply referencing it may not thread. provider_thread_id is stored  │
// │ alongside precisely because Gmail's own threadId does still work for     │
// │ the sender's mailbox view.                                               │
// │                                                                          │
// │ Both limits are inherent to the scope decision, not defects. Do not      │
// │ debug them; they are the price of not triggering a CASA audit.           │
// └─────────────────────────────────────────────────────────────────────────┘

import { requireUser, adminClient } from '../_shared/supabase.ts'
import { corsHeaders, json, errorResponse } from '../_shared/http.ts'
import { getTokenForCapability, authHeader } from '../_shared/tokens.ts'
import { getAdapter } from '../_shared/providers/index.ts'
import { htmlToText, generateMessageId } from '../_shared/mime.ts'
import { IntegrationError, type MailboxAuth, type SendEmailInput } from '../_shared/types.ts'
import {
  parseRecipients, applyVariables, sanitizeHtml, appendSignature,
  replySubject, assertWithinLimits,
} from './compose.ts'
import { parseAttachmentIds } from '../_shared/attachments.ts'
import { loadAttachments, linkAttachments } from './attachments.ts'

interface SendRequest {
  to: unknown
  cc?: unknown
  bcc?: unknown
  subject?: string
  html?: string
  /** {{contact_name}} → value. Resolved server-side; see compose.ts. */
  variables?: Record<string, string>
  /** Soft link so the send shows up on the record's timeline. */
  related?: {
    type?: 'lead' | 'contact' | 'opportunity'
    id?: string
    label?: string
  }
  /** Continue an existing CRM conversation. */
  thread?: {
    inReplyTo?: string
    references?: string[]
    providerThreadId?: string
  }
  replyTo?: string
  /**
   * Ids from public.attachments — never file bytes.
   *
   * The browser has already uploaded to Storage under an org-prefixed path
   * that Storage RLS enforced. Posting bytes here instead would move the file
   * through a service-role code path where no policy applies, and would put a
   * multi-megabyte body in front of every send.
   */
  attachmentIds?: unknown
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'), req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const user = await requireUser(req)
    const admin = adminClient()

    let body: SendRequest
    try {
      body = await req.json()
    } catch {
      throw new IntegrationError('bad_request', 'Expected a JSON body.', 400)
    }

    // ── Recipients and limits ─────────────────────────────────────────────────
    const to  = parseRecipients(body.to,  'To')
    const cc  = parseRecipients(body.cc,  'Cc')
    const bcc = parseRecipients(body.bcc, 'Bcc')
    const replyTo = parseRecipients(body.replyTo, 'Reply-To')[0]

    const variables = body.variables ?? {}
    const isReply = Boolean(body.thread?.inReplyTo)

    // Shape-checked here so a malformed id is a 400 from this function rather
    // than a Postgres uuid cast error surfacing as a 500 further down.
    const attachmentIds = parseAttachmentIds(body.attachmentIds)

    const rawSubject = applyVariables(String(body.subject ?? ''), variables)
    const subject = isReply ? replySubject(rawSubject) : rawSubject.trim()

    const composed = sanitizeHtml(applyVariables(String(body.html ?? ''), variables))

    assertWithinLimits({
      recipients: to.length + cc.length + bcc.length,
      subject,
      html: composed,
    })

    // ── Resolve the sending account ───────────────────────────────────────────
    // getTokenForCapability picks the caller's most recently connected healthy
    // email account and hands back a token that is valid right now, refreshing
    // first if needed. This function does not read integration_credentials and
    // must never start to — tokens.ts is the only module that touches it.
    let token
    try {
      token = await getTokenForCapability(user.id, 'email')
    } catch (err) {
      // A 409 from that helper means "no connected account with email access",
      // which is a setup state, not a failure. Re-code it so the UI can show a
      // Connect prompt instead of an error banner — the two need completely
      // different responses from the user.
      if ((err as IntegrationError)?.status === 409) {
        throw new IntegrationError(
          'no_email_account',
          'No mailbox is connected yet. Connect one in Settings → Integrations to send email.',
          409,
        )
      }
      throw err
    }

    const { data: account, error: accountErr } = await admin
      .from('integration_accounts')
      .select('id, provider, account_email, account_name')
      .eq('id', token.accountId)
      .eq('user_id', user.id)          // belt and braces: admin bypasses RLS
      .maybeSingle()

    if (accountErr) throw accountErr
    if (!account) {
      throw new IntegrationError('no_email_account', 'The sending account could not be read.', 409)
    }

    const adapter = getAdapter(account.provider)

    // ── Signature ─────────────────────────────────────────────────────────────
    // Read server-side rather than trusting a client-supplied signature, so the
    // stored record and the sent message cannot disagree about what went out.
    const { data: settings } = await admin
      .from('user_email_settings')
      .select('signature_html, include_signature, from_name')
      .eq('user_id', user.id)
      .maybeSingle()

    const html = settings?.include_signature === false
      ? composed
      : appendSignature(composed, settings?.signature_html ?? '')

    // The text alternative is DERIVED, never supplied by the client. A caller
    // that sent its own could drift from the HTML, and a text part that says
    // something different from the HTML part is a phishing signature.
    const text = htmlToText(html)

    const from = {
      email: account.account_email,
      name:  (settings?.from_name ?? '').trim() || account.account_name || '',
    }

    // Generated here, not inside the MIME builder, so the value written to the
    // database and the value in the header are the same even if the send fails
    // and the row is all we have left.
    const messageId = generateMessageId(from.email)

    // ── Attachments ───────────────────────────────────────────────────────────
    // Deliberately BEFORE the log row. Everything that can be known to fail —
    // a deleted file, another tenant's file, a payload over the provider's
    // ceiling — fails here, while there is still nothing written to explain.
    // Validating after the insert would leave 'queued' rows for messages that
    // were never sendable, and no retry can ever clear those.
    //
    // It also has to be AFTER the account lookup: the size limit depends on
    // which provider is sending, and that is not known until the account is
    // resolved.
    const attached = await loadAttachments(admin, user.id, attachmentIds, account.provider)

    const input: SendEmailInput = {
      from,
      to, cc, bcc, replyTo,
      subject,
      html,
      text,
      messageId,
      inReplyTo:        body.thread?.inReplyTo ?? null,
      references:       body.thread?.references ?? [],
      providerThreadId: body.thread?.providerThreadId ?? null,
      attachments:      attached.files,
    }

    // ── Log BEFORE sending ────────────────────────────────────────────────────
    // The row is written as 'queued' first so that a crash, timeout or cold
    // shutdown between here and the provider call leaves evidence. A log
    // written only on success cannot record the failures anyone would want it
    // for.
    const related = body.related ?? {}
    const { data: logRow, error: logErr } = await admin
      .from('email_messages')
      .insert({
        user_id:                user.id,
        integration_account_id: account.id,
        provider:               account.provider,
        from_email:             from.email,
        from_name:              from.name,
        to_emails:              to.map((a) => a.email),
        cc_emails:              cc.map((a) => a.email),
        bcc_emails:             bcc.map((a) => a.email),
        subject,
        body_html:              html,
        body_text:              text,
        rfc822_message_id:      messageId,
        in_reply_to:            input.inReplyTo,
        reference_ids:          input.references,
        related_type:           related.type ?? null,
        related_id:             related.id || null,
        related_label:          related.label ?? '',
        status:                 'queued',
      })
      .select('id')
      .single()

    if (logErr) {
      console.error('[send-email] could not write the log row:', logErr.message)
      throw logErr
    }

    // Linked before the send, not after. 026 makes attachment_id ON DELETE
    // RESTRICT, so writing the link now means the file is protected from
    // deletion the moment it is committed to a send — including when the send
    // then fails, which is exactly when someone wants to know what was on it.
    await linkAttachments(admin, logRow.id, attached.ids)

    // ── Send ──────────────────────────────────────────────────────────────────
    // MailboxAuth, not ProviderAuth: sending needs to know WHICH mailbox, and
    // Zoho resolves a validated fromAddress from accountEmail. Calendar calls
    // take the narrower ProviderAuth, which has no mailbox identity to give.
    const auth: MailboxAuth = {
      authorization: authHeader(token),   // knows Zoho needs its own scheme
      apiDomain:     token.apiDomain,
      accountEmail:  account.account_email,
      accountName:   account.account_name ?? '',
    }

    let result
    try {
      result = await adapter.sendEmail(auth, input)
    } catch (err) {
      const code = err instanceof IntegrationError ? err.code : 'send_failed'
      const message = err instanceof Error ? err.message : String(err)

      await admin
        .from('email_messages')
        .update({
          status:     'failed',
          error:      message.slice(0, 1000),
          error_code: (err as IntegrationError)?.providerError ?? code,
          updated_at: new Date().toISOString(),
        })
        .eq('id', logRow.id)

      throw err
    }

    await admin
      .from('email_messages')
      .update({
        status:              'sent',
        provider_message_id: result.providerMessageId,
        provider_thread_id:  result.providerThreadId,
        sent_at:             new Date().toISOString(),
        updated_at:          new Date().toISOString(),
      })
      .eq('id', logRow.id)

    // ── Timeline ──────────────────────────────────────────────────────────────
    // Written into `activities`, the same append-only table every other CRM
    // event uses, so the existing TimelinePanel picks it up with no new query.
    // Failure here is logged and swallowed: the mail HAS been sent, and turning
    // a bookkeeping error into a send failure would invite the user to send it
    // a second time.
    if (related.type && related.id) {
      // The display name is read from profiles rather than taken from the
      // request. Every other timeline writer is client-side and passes its own
      // actorName; this one runs with the service-role key, so accepting a name
      // from the caller would let a request attribute a send to anybody.
      const { data: profile } = await admin
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .maybeSingle()

      const { error: activityErr } = await admin.from('activities').insert({
        type:         'email_sent',
        actor:        profile?.name || user.email || '',
        actor_id:     user.id,          // TEXT on this table — see migration 007
        action:       'sent an email',
        subject:      related.label ?? '',
        detail:       subject,
        entity_type:  related.type,
        entity_id:    String(related.id),
        entity_label: related.label ?? '',
        metadata: {
          emailMessageId: logRow.id,
          subject,
          to:          to.map((a) => a.email),
          provider:    account.provider,
          preview:     text.slice(0, 500),
          attachments: attached.files.map((f) => f.filename),
        },
        occurred_at: new Date().toISOString(),
      })
      if (activityErr) {
        console.error('[send-email] sent, but the timeline entry failed:', activityErr.message)
      }
    }

    return json({
      id:                logRow.id,
      status:            'sent',
      provider:          account.provider,
      fromEmail:         from.email,
      providerMessageId: result.providerMessageId,
      providerThreadId:  result.providerThreadId,
      messageId:         result.messageId || messageId,
      attachmentCount:   attached.files.length,
      // So the UI can say "saved to your Sent folder" only where that is
      // actually true. See SentCopyBehaviour in types.ts.
      sentCopy:          adapter.sentCopy,
    }, 200, cors)
  } catch (err) {
    return errorResponse(err, corsHeaders(req.headers.get('Origin'), req))
  }
})
