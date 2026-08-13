// ─── send-email / attachments ─────────────────────────────────────────────────
//
// PHASE 1b, the fetching half. Turns a list of attachment ids from the request
// into the EmailAttachment[] that buildMimeMessage and the Zoho uploader both
// consume.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ THIS FUNCTION IS THE TENANT BOUNDARY. READ BEFORE CHANGING IT.          │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ send-email runs with the SERVICE ROLE key, which bypasses RLS entirely. │
// │ Every policy written in 023 and 026 — the restrictive tenant policies,  │
// │ the org-prefixed Storage rules, all of it — is inert on this code path. │
// │                                                                          │
// │ So a request naming any attachment id at all would otherwise be honoured│
// │ regardless of which organisation owns the file. The exploit needs no    │
// │ special access: a member of one tenant guesses or obtains an id, sends  │
// │ a message TO THEMSELVES with that file attached, and receives another   │
// │ company's quotation in their own inbox. Storage RLS never sees it,      │
// │ because the service role never asks.                                     │
// │                                                                          │
// │ assertOwnership() below is the only thing standing in the way. It does  │
// │ in code what a policy would have done, because on this path no policy   │
// │ runs. Do not remove it, do not make it conditional, and do not replace  │
// │ it with current_org_id() — that reads a JWT claim, and there is no JWT  │
// │ on a service-role connection. It would evaluate to NULL and match       │
// │ nothing, or worse, be "fixed" by dropping the check.                     │
// └─────────────────────────────────────────────────────────────────────────┘

import { adminClient } from '../_shared/supabase.ts'
import { base64Encode } from '../_shared/mime.ts'
import { IntegrationError, type EmailAttachment } from '../_shared/types.ts'
import { assertWithinProviderLimit } from '../_shared/attachments.ts'

type Admin = ReturnType<typeof adminClient>

interface AttachmentRow {
  id: string
  org_id: string
  storage_path: string
  filename: string
  mime_type: string
  size_bytes: number
}

export interface LoadedAttachments {
  /** Ready for buildMimeMessage / the Zoho uploader. */
  files: EmailAttachment[]
  /** attachments.id values, for the email_attachments join rows. */
  ids: string[]
}

/**
 * Read, authorise and encode every requested file.
 *
 * Called BEFORE the email_messages row is written, deliberately. Everything
 * that can be known to fail — a missing file, another tenant's file, a payload
 * the provider will reject — fails here, while there is still nothing in the
 * log to explain. A 'queued' row for a message that was never sendable is a row
 * no retry can ever clear.
 */
export async function loadAttachments(
  admin: Admin,
  userId: string,
  ids: string[],
  provider: string,
): Promise<LoadedAttachments> {
  if (ids.length === 0) return { files: [], ids: [] }

  const { data, error } = await admin
    .from('attachments')
    .select('id, org_id, storage_path, filename, mime_type, size_bytes')
    .in('id', ids)

  if (error) {
    console.error('[send-email] attachment lookup failed:', error.message)
    throw new IntegrationError('attachment_failed', 'The files could not be read.', 500)
  }

  const rows = (data ?? []) as AttachmentRow[]

  // A missing row and a row belonging to somebody else are reported the same
  // way, below, and on purpose — see assertOwnership.
  if (rows.length !== ids.length) {
    throw new IntegrationError(
      'attachment_failed',
      'One of the attached files no longer exists.',
      404,
    )
  }

  await assertOwnership(admin, userId, rows)

  // Size is checked against the recorded size_bytes before a single byte is
  // downloaded. Pulling 20 MB out of Storage only to discover the provider will
  // not take it wastes the function's whole time budget and its memory with it.
  assertWithinProviderLimit(
    provider,
    rows.map((r) => ({ filename: r.filename, sizeBytes: r.size_bytes })),
  )

  const files: EmailAttachment[] = []
  for (const row of rows) {
    // Sequential. Concurrent downloads would hold every file in memory at once,
    // and an Edge Function that runs out of memory dies without an error the
    // caller can act on.
    files.push(await download(admin, row))
  }

  return { files, ids: rows.map((r) => r.id) }
}

/**
 * Every file must belong to an organisation this user is an active member of.
 *
 * Membership is read from `memberships` rather than from current_org_id(),
 * which resolves through the JWT and is meaningless under the service role.
 * The set form also handles a user who belongs to more than one organisation —
 * a single "their org" value would be a guess about which one they meant.
 */
async function assertOwnership(
  admin: Admin,
  userId: string,
  rows: AttachmentRow[],
): Promise<void> {
  const { data, error } = await admin
    .from('memberships')
    .select('org_id')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error) {
    console.error('[send-email] membership lookup failed:', error.message)
    // Fails CLOSED. An unreadable membership list means we cannot establish
    // that the user may have these files, and "cannot establish" must never
    // resolve to "allow" on the path that reads other tenants' documents.
    throw new IntegrationError('attachment_failed', 'The files could not be verified.', 500)
  }

  const allowed = new Set((data ?? []).map((m: { org_id: string }) => m.org_id))

  for (const row of rows) {
    if (!allowed.has(row.org_id)) {
      // Logged with enough detail to investigate, because a request that
      // reaches this line is either a bug or an attempt.
      console.error(
        `[send-email] SECURITY: user ${userId} requested attachment ${row.id} ` +
        `owned by org ${row.org_id}`,
      )
      // Reported to the caller as "does not exist", identically to a deleted
      // file. Saying "you are not allowed to attach that" would confirm the id
      // is real and that it belongs to someone — which is the one bit of
      // information an id-guessing attempt is actually after.
      throw new IntegrationError(
        'attachment_failed',
        'One of the attached files no longer exists.',
        404,
      )
    }
  }
}

async function download(admin: Admin, row: AttachmentRow): Promise<EmailAttachment> {
  const { data, error } = await admin.storage.from('attachments').download(row.storage_path)

  if (error || !data) {
    console.error(`[send-email] could not download ${row.storage_path}:`, error?.message)
    throw new IntegrationError(
      'attachment_failed',
      `${row.filename} could not be read from storage.`,
      502,
    )
  }

  const bytes = new Uint8Array(await data.arrayBuffer())

  // The recorded size and the object can disagree if the row was written and
  // the upload later replaced — 026 has no UPDATE policy on the bucket
  // precisely to make that hard, but the limit check above ran against
  // size_bytes, so a mismatch would mean the check tested the wrong number.
  if (bytes.length !== row.size_bytes) {
    console.error(
      `[send-email] size mismatch on ${row.storage_path}: ` +
      `recorded ${row.size_bytes}, actual ${bytes.length}`,
    )
    throw new IntegrationError(
      'attachment_failed',
      `${row.filename} does not match its stored record.`,
      500,
    )
  }

  return {
    filename:      row.filename,
    mimeType:      row.mime_type || 'application/octet-stream',
    contentBase64: base64Encode(bytes),
  }
}

/**
 * Record which files went with which message.
 *
 * Written AFTER the log row exists and BEFORE the send, so the ON DELETE
 * RESTRICT in 026 starts protecting the file at the moment it is committed to
 * a send rather than once the send succeeds. A message that failed still tells
 * you what was attached to it, which is usually the first question asked.
 *
 * A failure here is logged and swallowed. The link table is bookkeeping; the
 * message is real, and refusing to send because a join row would not insert
 * would trade a working feature for a tidy audit trail.
 */
export async function linkAttachments(
  admin: Admin,
  emailMessageId: string,
  attachmentIds: string[],
): Promise<void> {
  if (attachmentIds.length === 0) return

  const { error } = await admin
    .from('email_attachments')
    .insert(attachmentIds.map((id) => ({
      email_message_id: emailMessageId,
      attachment_id:    id,
    })))

  if (error) {
    console.error('[send-email] could not link attachments:', error.message)
  }
}
