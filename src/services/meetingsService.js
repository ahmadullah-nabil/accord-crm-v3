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

  if (payload.relatedId !== undefined)
    row.related_id = payload.relatedId ?? ''

  if (payload.relatedLabel !== undefined)
    row.related_label = payload.relatedLabel ?? ''

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
  const today = new Date().toISOString().split('T')[0]
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
