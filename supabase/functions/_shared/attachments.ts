// ─── Attachment policy ────────────────────────────────────────────────────────
//
// PHASE 1b. The rules about attachments that do not involve talking to anybody:
// what the caller is allowed to ask for, and how big a payload each provider
// will actually accept.
//
// Deliberately free of I/O and of any Supabase import. Everything here is a
// pure function over plain values, which means `deno check` can verify it
// without network access — unlike anything that pulls in supabase-js. The
// fetching half lives in send-email/attachments.ts, next to the only function
// that has a client to fetch with.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ WHY THE LIMITS ARE EXPRESSED IN RAW BYTES                               │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Every provider's published ceiling applies to the ENCODED request, not  │
// │ to the file on disk. base64 costs 4 bytes for every 3, so a 3 MB PDF    │
// │ arrives at the provider as roughly 4 MB.                                │
// │                                                                          │
// │ The user, however, sees a file size in a file picker — raw bytes. A     │
// │ limit stated in encoded bytes would be a number they cannot check       │
// │ against anything they can see, and "your 3.1 MB file exceeds the 4 MB   │
// │ limit" is a support ticket, not an error message.                        │
// │                                                                          │
// │ So the ceilings below are RAW, already divided down, and encodedSize()  │
// │ exists for the one place that needs the other direction.                 │
// └─────────────────────────────────────────────────────────────────────────┘

import { IntegrationError } from './types.ts'

/** base64 emits 4 characters per 3 input bytes, then pads to a multiple of 4. */
export function encodedSize(rawBytes: number): number {
  return Math.ceil(rawBytes / 3) * 4
}

/**
 * The most attachment bytes ONE message may carry, per provider, before
 * encoding.
 *
 * These are floors of the provider ceiling, not the ceiling itself. Headers,
 * the HTML body, the plain-text alternative and the MIME boundaries all share
 * the same request, and a limit set exactly at the documented maximum fails on
 * a long signature.
 */
export const PROVIDER_ATTACHMENT_LIMITS: Record<string, number> = {
  // Gmail accepts a 25 MB message. 18 MB raw encodes to ~24 MB, leaving room
  // for the body. Larger than this needs Gmail's resumable upload protocol,
  // which is a different request shape and is not built.
  google: 18 * 1024 * 1024,

  // ┌───────────────────────────────────────────────────────────────────────┐
  // │ Graph's /me/sendMail rejects a request over roughly 4 MB with a 413.  │
  // │ 3 MB raw encodes to ~4 MB, which is the whole budget.                 │
  // │                                                                       │
  // │ The documented way past this is createUploadSession — but that path   │
  // │ requires creating a DRAFT message first, and creating a draft needs   │
  // │ Mail.ReadWrite. This adapter requests Mail.Send and nothing else.     │
  // │                                                                       │
  // │ So the ceiling is not a missing feature, it is a SCOPE DECISION that  │
  // │ has not been made. Raising it means adding a read/write mail scope to │
  // │ the consent screen, which every existing Microsoft user would have to │
  // │ re-approve. That is a business call, not a bug fix — see the error    │
  // │ message below, which says so rather than implying a retry might work. │
  // └───────────────────────────────────────────────────────────────────────┘
  microsoft: 3 * 1024 * 1024,

  // Zoho uploads bytes to its File Store first, so THIS request is not the
  // constraint — the resulting message is. Zoho's own compose ceiling is
  // documented at 20 MB of attachments; 18 MB leaves the same margin as Gmail.
  zoho: 18 * 1024 * 1024,
}

/** Number of files on one message. Not a provider rule — a sanity rule. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 10

export function limitFor(provider: string): number {
  // An unknown provider gets the smallest ceiling rather than the largest. A
  // new adapter that forgets to declare a limit should fail on a big file, not
  // discover the limit by having a customer's quotation bounce.
  return PROVIDER_ATTACHMENT_LIMITS[provider] ?? 3 * 1024 * 1024
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Validate the `attachmentIds` field of a send request.
 *
 * Returns a de-duplicated list of UUID strings. Shape is checked here so that
 * a malformed id never reaches a database query — and so that the caller gets
 * 'bad_request' rather than a Postgres cast error surfacing as a 500.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseAttachmentIds(raw: unknown): string[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) {
    throw new IntegrationError('bad_request', 'attachmentIds must be an array.', 400)
  }
  if (raw.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new IntegrationError(
      'bad_request',
      `A message may carry at most ${MAX_ATTACHMENTS_PER_MESSAGE} files.`,
      400,
    )
  }

  const seen = new Set<string>()
  for (const value of raw) {
    const id = String(value ?? '').trim()
    if (!UUID_RE.test(id)) {
      throw new IntegrationError('bad_request', 'An attachment id is not a valid id.', 400)
    }
    seen.add(id.toLowerCase())
  }
  return [...seen]
}

/**
 * Refuse a payload the provider is going to refuse anyway.
 *
 * Called BEFORE the email_messages row is written. That ordering is the whole
 * point of having this as a separate step: the log row is deliberately written
 * before the send so that a crash leaves evidence, but a message rejected for
 * size never reached the provider at all, and a 'queued' row that no retry can
 * ever resolve is worse than no row.
 */
export function assertWithinProviderLimit(
  provider: string,
  files: { filename: string; sizeBytes: number }[],
): void {
  const limit = limitFor(provider)

  // Named individually first. "Your attachments total 4.2 MB" tells the user
  // nothing about which one to drop.
  for (const file of files) {
    if (file.sizeBytes > limit) {
      throw new IntegrationError(
        'attachment_too_large',
        oversizeMessage(provider, file.filename, file.sizeBytes, limit),
        400,
      )
    }
  }

  const total = files.reduce((sum, f) => sum + f.sizeBytes, 0)
  if (total > limit) {
    throw new IntegrationError(
      'attachment_too_large',
      `Those ${files.length} files total ${formatBytes(total)}. ` +
      `${providerLabel(provider)} accepts up to ${formatBytes(limit)} on one message.`,
      400,
    )
  }
}

function providerLabel(provider: string): string {
  if (provider === 'google') return 'Gmail'
  if (provider === 'microsoft') return 'Outlook'
  if (provider === 'zoho') return 'Zoho Mail'
  return provider
}

/**
 * The message a user actually reads.
 *
 * For Microsoft it names the real reason rather than a size alone, because the
 * honest answer is "this account cannot send files this large at all", not
 * "try again". Anything vaguer produces a retry, then a support ticket.
 */
function oversizeMessage(
  provider: string,
  filename: string,
  sizeBytes: number,
  limit: number,
): string {
  const head = `${filename} is ${formatBytes(sizeBytes)}, over the ${formatBytes(limit)} limit for ${providerLabel(provider)}.`
  if (provider === 'microsoft') {
    return `${head} Outlook accounts cannot send larger files from the CRM. Share it as a link instead.`
  }
  return `${head} Share it as a link instead.`
}
