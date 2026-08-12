// ─── Activity Service ─────────────────────────────────────────────────────────
//
// Append-only log of CRM events. Every significant action (lead created,
// meeting scheduled, task completed, etc.) calls logActivity() AFTER the
// primary Supabase write succeeds.
//
// Design principles
// ─────────────────
// • Fire-and-forget: callers do NOT await logActivity(). A failure here
//   must never block or roll back the primary operation.
// • Read path: getActivities() fetches rows ordered newest-first.
//   getActivitiesForEntity() fetches rows for a single lead/meeting/task.
// • No UPDATE or DELETE — activities are immutable once written.

import { supabase }        from '../lib/supabaseClient.js'
import { throwClassified } from '../lib/supabaseErrors.js'

// ── Activity type constants ────────────────────────────────────────────────────
export const ACTIVITY_TYPES = {
  LEAD_CREATED:       'lead_created',
  LEAD_STAGE_CHANGED: 'lead_stage_changed',
  LEAD_UPDATED:       'lead_updated',
  MEETING_SCHEDULED:  'meeting_scheduled',
  MEETING_UPDATED:    'meeting_updated',
  MEETING_COMPLETED:  'meeting_completed',
  TASK_CREATED:       'task_created',
  TASK_COMPLETED:     'task_completed',
  TASK_REOPENED:      'task_reopened',
}

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
    occurredAt:  row.occurred_at  ?? '',
  }
}

// ── Log one activity (fire-and-forget) ────────────────────────────────────────
// Never throws — swallows errors silently so callers are not affected.
export async function logActivity({
  type,
  actor = '',
  actorId = null,
  action = '',
  subject = '',
  detail = '',
  entityType = null,
  entityId = null,
  entityLabel = null,
}) {
  try {
    await supabase.from('activities').insert({
      type,
      actor,
      actor_id:     actorId ? String(actorId) : null,
      action,
      subject,
      detail,
      entity_type:  entityType,
      entity_id:    entityId   ? String(entityId) : null,
      entity_label: entityLabel,
    })
  } catch {
    // Intentionally silent — activity logging must never break primary flows
  }
}

// ── Fetch recent activities (global feed) ─────────────────────────────────────
export async function getActivities(limit = 50) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (error) throwClassified(error)
  return (data ?? []).map(toApp)
}

// ── Fetch activities for a specific entity (e.g. one lead) ───────────────────
export async function getActivitiesForEntity(entityType, entityId, limit = 30) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', String(entityId))
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (error) throwClassified(error)
  return (data ?? []).map(toApp)
}
