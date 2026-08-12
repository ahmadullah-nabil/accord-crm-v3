// ─── Timeline Service ─────────────────────────────────────────────────────────
//
// Builds on the existing activities table (which already has entity_type /
// entity_id / actor / occurred_at). This service adds:
//
//   • getTimelineForEntity()   — full chronological event stream
//   • addNote()                — internal note on any entity
//   • logFollowUp()            — completed follow-up entry
//   • scheduleFollowUp()       — next follow-up date/action
//   • addMeetingNote()         — post-meeting summary
//
// All writes are append-only. History is never modified or deleted.
// The `metadata` JSONB column (added by timeline_patch.sql) stores richer
// payloads that don't fit in the activities.detail text field.

import { supabase }        from '../lib/supabaseClient.js'
import { throwClassified } from '../lib/supabaseErrors.js'

// ── Timeline event types ──────────────────────────────────────────────────────
export const TIMELINE_TYPES = {
  // Existing activity types (from activityService.ACTIVITY_TYPES)
  LEAD_CREATED:        'lead_created',
  LEAD_STAGE_CHANGED:  'lead_stage_changed',
  LEAD_UPDATED:        'lead_updated',
  MEETING_SCHEDULED:   'meeting_scheduled',
  MEETING_COMPLETED:   'meeting_completed',
  MEETING_UPDATED:     'meeting_updated',
  TASK_CREATED:        'task_created',
  TASK_COMPLETED:      'task_completed',
  TASK_REOPENED:       'task_reopened',
  // New timeline types
  NOTE_ADDED:          'note_added',
  FOLLOWUP_LOGGED:     'followup_logged',
  FOLLOWUP_SCHEDULED:  'followup_scheduled',
  MEETING_NOTE_ADDED:  'meeting_note_added',
}

export const FOLLOWUP_TYPES = ['Call', 'Email', 'Visit', 'Demo', 'Meeting', 'Other']

// ── Field mapper ──────────────────────────────────────────────────────────────
function toApp(row) {
  if (!row) return null
  return {
    id:          row.id,
    type:        row.type,
    actor:       row.actor        ?? '',
    actorId:     row.actor_id     ?? null,
    action:      row.action       ?? '',
    subject:     row.subject      ?? '',
    detail:      row.detail       ?? '',
    entityType:  row.entity_type  ?? null,
    entityId:    row.entity_id    ?? null,
    entityLabel: row.entity_label ?? null,
    metadata:    row.metadata     ?? {},
    occurredAt:  row.occurred_at  ?? '',
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Full chronological timeline for an entity.
 * When linkedEntityType + linkedEntityId are provided (e.g. a lead converted
 * from a contact), fetches both entities in parallel and merges newest-first.
 * No data is copied or moved — both sets of rows stay where they were written.
 */
export async function getTimelineForEntity(
  entityType,
  entityId,
  limit = 50,
  linkedEntityType = null,
  linkedEntityId   = null,
) {
  const primary = supabase
    .from('activities')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', String(entityId))
    .order('occurred_at', { ascending: false })
    .limit(limit)

  const linked = (linkedEntityType && linkedEntityId)
    ? supabase
        .from('activities')
        .select('*')
        .eq('entity_type', linkedEntityType)
        .eq('entity_id', String(linkedEntityId))
        .order('occurred_at', { ascending: false })
        .limit(limit)
    : Promise.resolve({ data: [] })

  const [{ data: primaryRows, error }, { data: linkedRows }] =
    await Promise.all([primary, linked])

  if (error) throwClassified(error)

  const all = [
    ...(primaryRows ?? []),
    ...(linkedRows  ?? []),
  ]

  // Merge sort newest-first, deduplicate by id, cap at limit
  return all
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .filter((row, i, arr) => arr.findIndex((r) => r.id === row.id) === i)
    .slice(0, limit)
    .map(toApp)
}

/**
 * Fetch only notes for an entity (type = 'note_added').
 */
export async function getNotesForEntity(entityType, entityId) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', String(entityId))
    .eq('type', TIMELINE_TYPES.NOTE_ADDED)
    .order('occurred_at', { ascending: false })

  if (error) throwClassified(error)
  return (data ?? []).map(toApp)
}

/**
 * Fetch only follow-up logs for an entity.
 */
export async function getFollowUpsForEntity(entityType, entityId) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', String(entityId))
    .in('type', [TIMELINE_TYPES.FOLLOWUP_LOGGED, TIMELINE_TYPES.FOLLOWUP_SCHEDULED])
    .order('occurred_at', { ascending: false })

  if (error) throwClassified(error)
  return (data ?? []).map(toApp)
}

// ── Write helpers ─────────────────────────────────────────────────────────────

async function insertEvent(payload) {
  const { data, error } = await supabase
    .from('activities')
    .insert(payload)
    .select()
    .single()

  if (error) throwClassified(error)
  return toApp(data)
}

/**
 * Add an internal note to any entity.
 *
 * @param {object} opts
 * @param {string}   opts.entityType   — 'lead'|'opportunity'|'contact'|'meeting'|'task'
 * @param {string}   opts.entityId     — UUID of the entity
 * @param {string}   opts.entityLabel  — display name of the entity
 * @param {string}   opts.body         — note text
 * @param {string}   opts.actorName    — display name of the author
 * @param {string}   [opts.actorId]    — UUID of the author profile
 * @param {'internal'|'shared'} [opts.visibility] — default 'internal'
 */
export async function addNote({
  entityType,
  entityId,
  entityLabel = '',
  body,
  actorName,
  actorId = null,
  visibility = 'internal',
}) {
  return insertEvent({
    type:         TIMELINE_TYPES.NOTE_ADDED,
    actor:        actorName,
    actor_id:     actorId,
    action:       'added a note',
    subject:      entityLabel,
    detail:       body.length > 120 ? body.slice(0, 120) + '…' : body,
    entity_type:  entityType,
    entity_id:    String(entityId),
    entity_label: entityLabel,
    metadata:     { body, visibility },
    occurred_at:  new Date().toISOString(),
  })
}

/**
 * Log a completed follow-up interaction.
 *
 * @param {object} opts
 * @param {string}   opts.entityType
 * @param {string}   opts.entityId
 * @param {string}   opts.entityLabel
 * @param {string}   opts.followupType  — 'Call'|'Email'|'Visit'|'Demo'|'Meeting'|'Other'
 * @param {string}   opts.outcome       — free-text description of what happened
 * @param {string}   [opts.nextFollowupDate] — 'YYYY-MM-DD' for next scheduled follow-up
 * @param {string}   opts.actorName
 * @param {string}   [opts.actorId]
 */
export async function logFollowUp({
  entityType,
  entityId,
  entityLabel = '',
  followupType,
  outcome,
  nextFollowupDate = null,
  actorName,
  actorId = null,
}) {
  return insertEvent({
    type:         TIMELINE_TYPES.FOLLOWUP_LOGGED,
    actor:        actorName,
    actor_id:     actorId,
    action:       `logged a ${followupType.toLowerCase()} follow-up`,
    subject:      entityLabel,
    detail:       outcome.length > 120 ? outcome.slice(0, 120) + '…' : outcome,
    entity_type:  entityType,
    entity_id:    String(entityId),
    entity_label: entityLabel,
    metadata:     { followupType, outcome, nextFollowupDate },
    occurred_at:  new Date().toISOString(),
  })
}

/**
 * Record a planned next follow-up date/action.
 */
export async function scheduleFollowUp({
  entityType,
  entityId,
  entityLabel = '',
  followupType,
  scheduledDate,
  notes = '',
  actorName,
  actorId = null,
}) {
  return insertEvent({
    type:         TIMELINE_TYPES.FOLLOWUP_SCHEDULED,
    actor:        actorName,
    actor_id:     actorId,
    action:       `scheduled a ${followupType.toLowerCase()} follow-up`,
    subject:      entityLabel,
    detail:       `Due: ${scheduledDate}${notes ? ` — ${notes}` : ''}`,
    entity_type:  entityType,
    entity_id:    String(entityId),
    entity_label: entityLabel,
    metadata:     { followupType, scheduledDate, notes },
    occurred_at:  new Date().toISOString(),
  })
}

/**
 * Add a post-meeting summary with decisions and next actions.
 *
 * @param {object} opts
 * @param {string}   opts.entityId      — meeting UUID
 * @param {string}   opts.entityLabel   — meeting title
 * @param {string}   opts.summary       — overall meeting summary
 * @param {string}   [opts.decisions]   — decisions made
 * @param {string}   [opts.nextActions] — agreed next steps
 * @param {string[]} [opts.attendees]   — list of attendee names
 * @param {string}   opts.actorName
 * @param {string}   [opts.actorId]
 */
export async function addMeetingNote({
  entityId,
  entityLabel = '',
  summary,
  decisions = '',
  nextActions = '',
  attendees = [],
  actorName,
  actorId = null,
}) {
  return insertEvent({
    type:         TIMELINE_TYPES.MEETING_NOTE_ADDED,
    actor:        actorName,
    actor_id:     actorId,
    action:       'added meeting notes',
    subject:      entityLabel,
    detail:       summary.length > 120 ? summary.slice(0, 120) + '…' : summary,
    entity_type:  'meeting',
    entity_id:    String(entityId),
    entity_label: entityLabel,
    metadata:     { summary, decisions, nextActions, attendees },
    occurred_at:  new Date().toISOString(),
  })
}
