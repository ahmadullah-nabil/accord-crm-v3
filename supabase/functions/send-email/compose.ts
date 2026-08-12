// ─── Message composition ──────────────────────────────────────────────────────
//
// Everything between "the user pressed Send" and "hand a SendEmailInput to an
// adapter": variable substitution, signature, sanitising, address validation.
//
// Kept out of _shared/ deliberately. _shared/ holds code that more than one
// Edge Function needs; this is send-email's own business logic and putting it
// there would imply a reuse that does not exist. mime.ts, by contrast, is
// genuinely shared — two adapters call it.

import { IntegrationError, type EmailAddress } from '../_shared/types.ts'

// ── Limits ────────────────────────────────────────────────────────────────────
//
// Deliberately generous but finite. Without them a malformed client could send
// a multi-megabyte body that every provider would reject anyway, after we had
// already paid to build and transmit it.
export const LIMITS = {
  recipients: 50,          // combined to + cc + bcc
  subject:    998,         // RFC 5322 line-length ceiling
  bodyBytes:  1_000_000,   // ~1 MB of HTML, before attachments exist
}

// ── Addresses ─────────────────────────────────────────────────────────────────

/**
 * Pragmatic address check.
 *
 * NOT an RFC 5322 grammar. A fully compliant regex accepts quoted local parts
 * and nested comments that no CRM user will ever type, and rejecting a real
 * address is far worse here than passing a bad one through to the provider,
 * which validates properly and returns a clear error.
 */
const ADDRESS = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/

export function parseRecipients(
  value: unknown,
  field: string,
): EmailAddress[] {
  if (value == null || value === '') return []

  const raw: unknown[] = Array.isArray(value) ? value : String(value).split(/[,;]/)

  return raw.map((entry) => {
    const addr: EmailAddress =
      typeof entry === 'string'
        ? { email: entry.trim() }
        : { email: String((entry as any)?.email ?? '').trim(),
            name:  String((entry as any)?.name  ?? '').trim() || undefined }

    if (!ADDRESS.test(addr.email)) {
      throw new IntegrationError(
        'invalid_recipient',
        `"${addr.email || entry}" in ${field} is not a valid email address.`,
        400,
      )
    }
    return addr
  })
}

// ── Template variables ────────────────────────────────────────────────────────

/**
 * Substitute {{contact_name}} / {{company}} and friends.
 *
 * WHY THE VALUES ARRIVE FROM THE CLIENT rather than being looked up here: the
 * browser already holds the contact or lead record it opened the composer from.
 * Re-fetching it server-side would couple send-email to the CRM's tables and
 * raise an ownership question — which records may this user substitute from? —
 * that has no bearing on sending mail. The values are display text the user was
 * already looking at, so there is nothing to escalate.
 *
 * UNKNOWN TOKENS ARE LEFT ALONE, not blanked. A stray {{contact_name}} in a
 * sent email is embarrassing, but silently deleting it produces "Dear ," which
 * is worse and much harder to notice. The composer renders a live preview with
 * substitution applied, so the user sees the real text before sending — that
 * preview is the guard, not this function.
 */
const TOKEN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

export function applyVariables(
  text: string,
  variables: Record<string, string>,
): string {
  return text.replace(TOKEN, (whole, key: string) => {
    const value = variables[key]
    return value == null || value === '' ? whole : value
  })
}

// ── Sanitising ────────────────────────────────────────────────────────────────

/**
 * Strip anything executable from the composed HTML.
 *
 * The author is the sender themselves, so this is not defending the user from
 * their own composer. It defends two other things:
 *
 *   • the RECIPIENT — the CRM is the sending domain's reputation, and mail
 *     carrying <script> is treated accordingly by filters
 *   • the CRM's own UI later — anything stored in email_messages.body_html is
 *     a candidate for being rendered back into a page one day, and stored
 *     markup that was never sanitised is exactly how that becomes an XSS
 *
 * The timeline deliberately renders the TEXT part, not this, so today there is
 * no render path at all. This keeps it that way by construction rather than by
 * everyone remembering.
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed|link|meta)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed|link|meta)\b[^>]*\/?>/gi, '')
    // Inline event handlers, quoted or bare.
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    // javascript:/vbscript:/data: URLs in href or src.
    .replace(/(href|src)\s*=\s*"(?:\s*)(javascript|vbscript|data):[^"]*"/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*'(?:\s*)(javascript|vbscript|data):[^']*'/gi, "$1='#'")
}

// ── Signature ─────────────────────────────────────────────────────────────────

/**
 * Append the user's signature.
 *
 * The `-- ` delimiter is the RFC 3676 signature separator. Clients use it to
 * collapse the signature when quoting a reply, which is why it is worth the two
 * characters: without it every reply in a long thread carries a full copy.
 */
export function appendSignature(html: string, signatureHtml: string): string {
  const signature = sanitizeHtml(signatureHtml ?? '').trim()
  if (!signature) return html
  return `${html}<br><div class="accord-signature">--&nbsp;<br>${signature}</div>`
}

// ── Subject ───────────────────────────────────────────────────────────────────

/**
 * Normalise a reply subject.
 *
 * Gmail will not honour a threadId unless the Subject matches the thread's, and
 * "Re: Re: Re:" stacking breaks that match as well as looking careless.
 */
export function replySubject(subject: string): string {
  const trimmed = subject.trim()
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`
}

// ── Validation ────────────────────────────────────────────────────────────────

export function assertWithinLimits(opts: {
  recipients: number
  subject: string
  html: string
}): void {
  if (opts.recipients === 0) {
    throw new IntegrationError('bad_request', 'Add at least one recipient.', 400)
  }
  if (opts.recipients > LIMITS.recipients) {
    throw new IntegrationError(
      'bad_request',
      `This message has ${opts.recipients} recipients. The limit is ${LIMITS.recipients}.`,
      400,
    )
  }
  if (!opts.subject.trim()) {
    throw new IntegrationError('bad_request', 'Add a subject.', 400)
  }
  if (opts.subject.length > LIMITS.subject) {
    throw new IntegrationError(
      'bad_request',
      `The subject is longer than ${LIMITS.subject} characters.`,
      400,
    )
  }
  if (new TextEncoder().encode(opts.html).length > LIMITS.bodyBytes) {
    throw new IntegrationError(
      'bad_request',
      'This message is too large to send. Shorten it, or wait for attachment support.',
      400,
    )
  }
}
