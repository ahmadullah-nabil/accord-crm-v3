// ─── Email Service ────────────────────────────────────────────────────────────
//
// Thin client for the send-email Edge Function, plus the two tables the
// composer reads directly.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ WHAT THE BROWSER DOES AND DOES NOT DO HERE                              │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ It does NOT choose which mailbox sends. It never sends an account id;   │
// │ the Edge Function resolves the caller's connected email account from    │
// │ their JWT. A client that could name an account could try to name        │
// │ somebody else's.                                                        │
// │                                                                          │
// │ It does NOT write email_messages. That table is read-only to the        │
// │ browser by RLS — every row is an assertion about what a provider        │
// │ actually did, so only the server may state it.                          │
// │                                                                          │
// │ It DOES own user_email_settings, which is a genuine user preference and │
// │ has full own-row policies.                                              │
// └─────────────────────────────────────────────────────────────────────────┘

import { supabase }                    from '../lib/supabaseClient.js'
import { throwClassified }             from '../lib/supabaseErrors.js'
import { normaliseIntegrationError }   from './integrationsService.js'

// ── Field mappers ─────────────────────────────────────────────────────────────

function toApp(row) {
  if (!row) return null
  return {
    id:                row.id,
    provider:          row.provider          ?? '',
    fromEmail:         row.from_email         ?? '',
    fromName:          row.from_name          ?? '',
    to:                row.to_emails          ?? [],
    cc:                row.cc_emails          ?? [],
    bcc:               row.bcc_emails         ?? [],
    subject:           row.subject            ?? '',
    bodyText:          row.body_text          ?? '',
    // body_html is deliberately NOT mapped. Nothing in the CRM renders stored
    // email markup, and not carrying it into app state keeps it that way by
    // construction rather than by everyone remembering not to.
    messageId:         row.rfc822_message_id  ?? null,
    providerMessageId: row.provider_message_id ?? null,
    providerThreadId:  row.provider_thread_id ?? null,
    inReplyTo:         row.in_reply_to        ?? null,
    references:        row.reference_ids      ?? [],
    relatedType:       row.related_type       ?? null,
    relatedId:         row.related_id         ?? null,
    status:            row.status             ?? 'queued',
    error:             row.error              ?? null,
    sentAt:            row.sent_at            ?? null,
    createdAt:         row.created_at         ?? '',
  }
}

// ── Send ──────────────────────────────────────────────────────────────────────

/**
 * Send one message.
 *
 * @param {object}   opts
 * @param {string[]|string} opts.to
 * @param {string[]|string} [opts.cc]
 * @param {string[]|string} [opts.bcc]
 * @param {string}   opts.subject
 * @param {string}   opts.html          — composer markup, sanitised server-side
 * @param {object}   [opts.variables]   — { contact_name, company, … }
 * @param {object}   [opts.related]     — { type, id, label } for the timeline
 * @param {object}   [opts.thread]      — { inReplyTo, references, providerThreadId }
 *
 * Resolves to { id, status, provider, providerMessageId, messageId, sentCopy }.
 * `sentCopy` says whether the provider files its own copy in the user's Sent
 * folder — the UI uses it so it only promises that where it is true.
 */
export async function sendEmail(opts) {
  const { data, error } = await supabase.functions.invoke('send-email', {
    method: 'POST',
    body: {
      to:        opts.to,
      cc:        opts.cc,
      bcc:       opts.bcc,
      subject:   opts.subject,
      html:      opts.html,
      variables: opts.variables ?? {},
      related:   opts.related ?? null,
      thread:    opts.thread ?? null,
      replyTo:   opts.replyTo ?? null,
      // Ids only. The file is already in Storage under an org-scoped path that
      // Storage RLS enforced at upload time; posting bytes here would route
      // them through the Edge Function's service-role client instead, where no
      // policy applies, and put megabytes in front of every send.
      attachmentIds: opts.attachmentIds ?? [],
    },
  })
  if (error || data?.error) throw normaliseIntegrationError(error, data)
  return data
}

// ── Sent history ──────────────────────────────────────────────────────────────

/**
 * Everything sent from the CRM to one record, newest first.
 *
 * RLS scopes this to the caller's own sends, so two users working the same
 * lead each see their own — which is the correct behaviour for a mailbox, not
 * a limitation. A shared view would mean exposing one user's mailbox activity
 * to another and is a product decision, not a query change.
 */
export async function getSentEmailsForEntity(relatedType, relatedId, limit = 25) {
  const { data, error } = await supabase
    .from('email_messages')
    .select('*')
    .eq('related_type', relatedType)
    .eq('related_id', relatedId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throwClassified(error)
  return (data ?? []).map(toApp)
}

/**
 * The most recent successful send to a record, used to chain a reply onto the
 * existing conversation.
 *
 * Returns null when there is nothing to chain onto — the first message to a
 * contact is not a reply and must not carry an In-Reply-To header, which would
 * point at a message that does not exist.
 */
export async function getThreadAnchor(relatedType, relatedId) {
  const { data, error } = await supabase
    .from('email_messages')
    .select('rfc822_message_id, reference_ids, provider_thread_id, subject')
    .eq('related_type', relatedType)
    .eq('related_id', relatedId)
    .eq('status', 'sent')
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throwClassified(error)
  const row = data?.[0]
  if (!row?.rfc822_message_id) return null

  return {
    inReplyTo:  row.rfc822_message_id,
    // Chain grows oldest-first, capped: References is unbounded in principle
    // and some MTAs truncate very long header lines, which breaks threading
    // for everyone downstream. Twenty ancestors is far more than any client
    // needs to rebuild a conversation.
    references: [...(row.reference_ids ?? []), row.rfc822_message_id].slice(-20),
    providerThreadId: row.provider_thread_id ?? null,
    subject: row.subject ?? '',
  }
}

// ── Signature ─────────────────────────────────────────────────────────────────

export async function getEmailSettings() {
  const { data, error } = await supabase
    .from('user_email_settings')
    .select('signature_html, include_signature, from_name')
    .maybeSingle()

  if (error) throwClassified(error)
  return {
    signatureHtml:    data?.signature_html    ?? '',
    includeSignature: data?.include_signature ?? true,
    fromName:         data?.from_name         ?? '',
  }
}

export async function saveEmailSettings(settings) {
  const { data: session } = await supabase.auth.getUser()
  const userId = session?.user?.id
  if (!userId) throw new Error('You are signed out. Sign in again to save your signature.')

  const { error } = await supabase
    .from('user_email_settings')
    .upsert({
      user_id:           userId,
      signature_html:    settings.signatureHtml    ?? '',
      include_signature: settings.includeSignature ?? true,
      from_name:         settings.fromName         ?? '',
    })

  if (error) throwClassified(error)
  return settings
}

// ── Template variables ────────────────────────────────────────────────────────

/**
 * The variables a composer offers, given the record it was opened from.
 *
 * Substitution happens server-side at send time; this is what the composer
 * shows in its variable menu and uses for the live preview. The preview is what
 * stops a stray {{token}} reaching a client — the server leaves unknown tokens
 * intact rather than silently deleting them, on the grounds that "Dear ," is
 * worse than a visible mistake.
 */
export const TEMPLATE_VARIABLES = [
  { token: '{{contact_name}}', label: 'Contact name' },
  { token: '{{company}}',      label: 'Company' },
]

export function variablesFor(record) {
  return {
    contact_name: record?.name    ?? '',
    company:      record?.company ?? '',
  }
}

/** Apply the same substitution rule the server uses, for the preview. */
export function previewWithVariables(html, variables) {
  return String(html ?? '').replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (whole, key) => (variables?.[key] ? variables[key] : whole),
  )
}
