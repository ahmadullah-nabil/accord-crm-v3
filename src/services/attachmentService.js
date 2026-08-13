// ─── attachmentService ────────────────────────────────────────────────────────
//
// Files live in the private `attachments` bucket; their metadata lives in
// public.attachments. Both are org-scoped by 026, and the isolation is enforced
// by the PATH:
//
//     {org_id}/{yyyy}/{mm}/{uuid}-{filename}
//
// The Storage policy compares the first path segment against current_org_id(),
// so this module must build that prefix correctly or the upload is refused. It
// reads the org from my_membership_status() rather than accepting one from the
// caller — a client that could name its own org prefix would be a client that
// could write into another tenant.
//
// Downloads use SIGNED URLs. The bucket is private, so there is no permanent
// public link; a signed URL expires, which is the correct property for a file
// that may be a client's pricing.

import { supabase } from '../lib/supabaseClient.js'
import { getMembershipStatus } from './invitationService.js'

// Matches the bucket's file_size_limit in 026. Checked here too so the user is
// told before a 25 MB upload runs to completion and is rejected at the end.
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

// Provider ceilings, for warning the user at ATTACH time rather than at send
// time. Deliberately not enforced as a block: which provider is used depends on
// the connected account, and a file may be stored now and sent later, or
// downloaded rather than emailed.
export const PROVIDER_INLINE_LIMITS = {
  microsoft: 4 * 1024 * 1024,   // Graph caps sendMail near 4 MB total
  google:   20 * 1024 * 1024,   // beyond this Gmail wants a resumable upload
  zoho:     20 * 1024 * 1024,   // Zoho's own Upload Attachments ceiling
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Strip anything that would change the meaning of a storage path.
 *
 * Slashes are the real hazard: a filename containing one would add a path
 * segment and could push the org id out of first position, which is exactly
 * what the Storage policy checks. Everything else here is ordinary hygiene.
 */
function safeName(filename) {
  return (filename || 'file')
    .replace(/[/\\]/g, '-')
    .replace(/[^\w.\-() ]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)          // leave room for the uuid prefix within path limits
}

function buildPath(orgId, filename) {
  const now   = new Date()
  const yyyy  = now.getFullYear()
  const mm    = String(now.getMonth() + 1).padStart(2, '0')
  // Same reason as the calendar: never toISOString() for a local date. Here it
  // would only shift the folder, but a file uploaded at 9pm in Dhaka landing in
  // last month's folder is the kind of thing nobody notices until they look.
  const uuid  = crypto.randomUUID()
  return `${orgId}/${yyyy}/${mm}/${uuid}-${safeName(filename)}`
}

// ── Upload ────────────────────────────────────────────────────────────────────

/**
 * Upload one file and record it.
 *
 * Storage first, metadata second. If the metadata insert fails, the object is
 * deleted again — an orphaned object is invisible to the app but still counts
 * against storage, and nothing would ever clean it up. The reverse order would
 * be worse: a metadata row pointing at bytes that do not exist renders as a
 * file the user can see and cannot open.
 */
export async function uploadAttachment(file, { relatedType = null, relatedId = null } = {}) {
  if (!file) throw new Error('No file provided.')

  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(
      `${file.name} is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_ATTACHMENT_BYTES)}.`,
    )
  }
  if (file.size === 0) {
    // A zero-byte file uploads and sends without error and arrives useless.
    throw new Error(`${file.name} is empty.`)
  }

  const status = await getMembershipStatus()
  if (!status?.currentOrg) {
    throw new Error('You are not part of an organisation, so files cannot be uploaded.')
  }

  const path = buildPath(status.currentOrg, file.name)

  const { error: upErr } = await supabase.storage
    .from('attachments')
    .upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,          // the uuid makes collisions impossible; if one
                              // happens, failing is better than overwriting
    })

  if (upErr) {
    if (upErr.message?.toLowerCase().includes('row-level security')) {
      throw new Error('You do not have permission to upload files to this organisation.')
    }
    throw new Error(upErr.message)
  }

  const { data: me } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('attachments')
    .insert({
      // org_id omitted on purpose — it defaults to current_org_id() and RLS
      // overrules anything else. Same rule as invitations.
      storage_path: path,
      filename:     file.name,
      mime_type:    file.type || 'application/octet-stream',
      size_bytes:   file.size,
      related_type: relatedType,
      related_id:   relatedId,
      uploaded_by:  me?.user?.id ?? null,
    })
    .select()
    .single()

  if (error) {
    // Roll the object back so it does not linger unreferenced.
    await supabase.storage.from('attachments').remove([path]).catch(() => {})
    throw new Error(error.message)
  }

  return toApp(data)
}

function toApp(row) {
  if (!row) return null
  return {
    id:          row.id,
    storagePath: row.storage_path,
    filename:    row.filename,
    mimeType:    row.mime_type,
    sizeBytes:   row.size_bytes,
    relatedType: row.related_type,
    relatedId:   row.related_id,
    uploadedBy:  row.uploaded_by,
    createdAt:   row.created_at,
  }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/** Files attached to one record. RLS scopes it to the caller's org. */
export async function listAttachments(relatedType, relatedId) {
  if (!relatedType || !relatedId) return []

  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('related_type', relatedType)
    .eq('related_id', relatedId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(toApp)
}

/**
 * A time-limited URL for one file.
 *
 * Short-lived by default. A signed URL is a bearer token in a link — anyone
 * holding it can read the file for as long as it is valid, without a session.
 * Five minutes is enough to click a download and not enough to be worth
 * forwarding.
 */
export async function getDownloadUrl(storagePath, expiresInSeconds = 300) {
  const { data, error } = await supabase.storage
    .from('attachments')
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error) throw new Error(error.message)
  return data.signedUrl
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Remove a file and its record.
 *
 * Metadata first. `email_attachments.attachment_id` is ON DELETE RESTRICT, so
 * a file that was actually emailed to a client makes this fail — and it should
 * fail BEFORE the bytes are gone. Deleting the object first would destroy the
 * file and then discover it was not allowed to.
 */
export async function deleteAttachment(id, storagePath) {
  const { error } = await supabase.from('attachments').delete().eq('id', id)

  if (error) {
    if (error.message?.includes('violates foreign key')) {
      throw new Error('This file was sent in an email and cannot be deleted.')
    }
    throw new Error(error.message)
  }

  // Best-effort. The metadata row is gone, so the app no longer shows the file;
  // a failure here leaves bytes behind but nothing broken, and throwing would
  // report a delete that did in fact happen as an error.
  await supabase.storage.from('attachments').remove([storagePath]).catch(() => {})
  return true
}
