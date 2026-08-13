// ─── Meetings Service ─────────────────────────────────────────────────────────
//
// All Supabase CRUD for the meetings table.
// Called only by useMeetings.js hooks — UI components never import this directly.
//
// Field mapping
// ─────────────
// App uses camelCase:  scheduledDate, scheduledTime, durationMins, locationUrl,
//                      relatedType, relatedId, relatedLabel, createdAt
// Supabase uses snake: scheduled_date, scheduled_time, duration_mins, location_url,
//                      related_type, related_id, related_label, created_at
//
// participants and tags are TEXT[] in Postgres and string[] in JS — no rename needed.
//
// toApp()  DB row   → app shape   (every SELECT result passes through this)
// toDb()   app data → DB columns  (every INSERT / UPDATE passes through this)
//
// RLS
// ───
// supabase.auth persists the JWT and forwards it on every request.
// The meetings RLS policy requires auth.role() = 'authenticated'.

import { supabase }        from '../lib/supabaseClient.js'
import { throwClassified } from '../lib/supabaseErrors.js'
import { todayLocal } from '../lib/dates.js'

// ── Field mappers ─────────────────────────────────────────────────────────────

/** Supabase row → app meeting shape (camelCase) */
function toApp(row) {
  if (!row) return null
  return {
    id:           row.id,
    title:        row.title         ?? '',
    description:  row.description   ?? '',
    status:       row.status        ?? 'Scheduled',
    type:         row.type          ?? 'Discovery',
    scheduledDate: row.scheduled_date ?? '',
    scheduledTime: row.scheduled_time ?? '',
    durationMins:  row.duration_mins  ?? 60,
    location:      row.location       ?? '',
    locationUrl:   row.location_url   ?? '',
    organizer:     row.organizer      ?? '',
    participants:  Array.isArray(row.participants) ? row.participants : [],
    relatedType:   row.related_type   ?? 'None',
    relatedId:     row.related_id     ?? '',
    relatedLabel:  row.related_label  ?? '',
    notes:         row.notes          ?? '',
    tags:          Array.isArray(row.tags) ? row.tags : [],
    createdAt:     row.created_at     ?? '',
    createdBy:     row.created_by     ?? '',

    // ── Calendar sync (020) ───────────────────────────────────────────────
    // organizerId is the auth user whose connected calendar hosts the event.
    // Distinct from `organizer`, which is a display name — the two answer
    // different questions and both are needed.
    organizerId:   row.organizer_id   ?? null,
    // [{email,name,source}]. ONLY these receive an external invitation;
    // `participants` above is internal tracking and is never mailed.
    attendees:     Array.isArray(row.attendees) ? row.attendees : [],
    timezone:      row.timezone       ?? 'Asia/Dhaka',
    provider:      row.provider       ?? null,
    externalEventId: row.external_event_id ?? null,
    syncStatus:    row.sync_status    ?? 'not_synced',
    syncError:     row.sync_error     ?? null,
    lastSyncedAt:  row.last_synced_at ?? null,
    meetingUrl:    row.meeting_url    ?? null,
  }
}

/** App meeting payload → Supabase column names (snake_case) */
function toDb(payload) {
  const row = {}

  if (payload.title        !== undefined) row.title        = payload.title
  if (payload.description  !== undefined) row.description  = payload.description
  if (payload.status       !== undefined) row.status       = payload.status
  if (payload.type         !== undefined) row.type         = payload.type
  if (payload.location     !== undefined) row.location     = payload.location
  if (payload.organizer    !== undefined) row.organizer    = payload.organizer
  if (payload.notes        !== undefined) row.notes        = payload.notes

  if (payload.scheduledDate !== undefined)
    row.scheduled_date = payload.scheduledDate || null

  if (payload.scheduledTime !== undefined)
    row.scheduled_time = payload.scheduledTime || null

  if (payload.durationMins !== undefined)
    row.duration_mins = Number(payload.durationMins) || null

  if (payload.locationUrl !== undefined)
    row.location_url = payload.locationUrl || null

  if (payload.relatedType !== undefined)
    row.related_type = payload.relatedType ?? 'None'

  // ── related_id must be a UUID or NULL, never '' ────────────────────────────
  //
  // 025 added meetings_related_id_is_uuid:
  //   CHECK (related_id IS NULL OR related_id ~ '<uuid>')
  //
  // The empty string satisfies neither branch. `?? ''` only catches null and
  // undefined, so a meeting with Related Type 'None' — which the form models as
  // relatedId: '' — sent '' and was rejected with 23514 on EVERY insert.
  //
  // It stayed hidden because the constraint was added NOT VALID: existing rows
  // were never re-checked, so the table looked healthy while nothing new could
  // be written. `|| null` is deliberate over `?? null` — '' is exactly the
  // value that has to become NULL here.
  //
  // toApp() maps NULL back to '' on read, so app state and the form are
  // unchanged by this.
  if (payload.relatedId !== undefined)
    row.related_id = payload.relatedId || null

  if (payload.relatedLabel !== undefined)
    row.related_label = payload.relatedLabel ?? ''

  if (payload.organizerId !== undefined)
    row.organizer_id = payload.organizerId || null
  if (payload.timezone !== undefined)
    row.timezone = payload.timezone || 'Asia/Dhaka'
  if (payload.attendees !== undefined)
    // Normalised here so a stray blank row from the form cannot trip the
    // shape constraint, which would fail the whole save with a Postgres error
    // the user cannot act on.
    row.attendees = (Array.isArray(payload.attendees) ? payload.attendees : [])
      .filter((a) => a && typeof a.email === 'string' && a.email.trim())
      .map((a) => ({
        email:  a.email.trim().toLowerCase(),
        name:   (a.name ?? '').trim(),
        source: a.source ?? 'external',
      }))

  // provider / external_event_id / sync_status / sync_error / last_synced_at /
  // meeting_url are DELIBERATELY not writable from the client. They record what
  // a provider actually did, and calendar-sync owns them. Letting the browser
  // set sync_status='synced' would put a green badge over an event that was
  // never created.

  if (payload.participants !== undefined)
    row.participants = Array.isArray(payload.participants) ? payload.participants : []

  if (payload.tags !== undefined)
    row.tags = Array.isArray(payload.tags) ? payload.tags : []

  if (payload.createdBy !== undefined) row.created_by = payload.createdBy ?? ''

  return row
}

// ── Fetch all meetings ────────────────────────────────────────────────────────

export async function getMeetings() {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .order('scheduled_date', { ascending: true, nullsFirst: false })

  if (error) throwClassified(error)
  return (data ?? []).map(toApp)
}

// ── Fetch one meeting ─────────────────────────────────────────────────────────

export async function getMeetingById(id) {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throwClassified(error)
  return toApp(data)
}

// ── Create a meeting ──────────────────────────────────────────────────────────

export async function insertMeeting(payload) {
  const today = todayLocal()
  const row   = {
    ...toDb(payload),
    created_at: today,
    // Do NOT include `id` — the DB generates it via gen_random_uuid()
  }

  const { data, error } = await supabase
    .from('meetings')
    .insert(row)
    .select()
    .single()

  if (error) throwClassified(error)
  return toApp(data)
}

// ── Update a meeting ──────────────────────────────────────────────────────────

export async function patchMeeting(id, payload) {
  const row = toDb(payload)

  const { data, error } = await supabase
    .from('meetings')
    .update(row)
    .eq('id', id)
    .select()
    .single()

  if (error) throwClassified(error)
  return toApp(data)
}

// ── Delete a meeting ──────────────────────────────────────────────────────────

export async function removeMeeting(id) {
  const { error } = await supabase
    .from('meetings')
    .delete()
    .eq('id', id)

  if (error) throwClassified(error)
  return { id }
}
