// ─── Tasks Service ────────────────────────────────────────────────────────────
//
// All Supabase CRUD for the tasks table.
// Called only by useTasks.js hooks — UI components never import this directly.
//
// Field mapping
// ─────────────
// App uses camelCase:  dueDate, relatedType, relatedId, relatedLabel,
//                      completedAt, createdAt
// Supabase uses snake: due_date, related_type, related_id, related_label,
//                      completed_at, created_at
//
// toApp()   DB row   → app shape   (every SELECT result passes through this)
// toDb()    app data → DB columns  (every INSERT / UPDATE passes through this)
//
// completedAt logic
// ─────────────────
// When status changes TO 'Completed'   → set completed_at = today
// When status changes AWAY from it     → set completed_at = null
// toDb() handles both cases.

import { supabase }        from '../lib/supabaseClient.js'
import { throwClassified } from '../lib/supabaseErrors.js'
import { todayLocal } from '../lib/dates.js'

// ── Field mappers ─────────────────────────────────────────────────────────────

/** Supabase row → app task shape (camelCase) */
function toApp(row) {
  if (!row) return null
  return {
    id:           row.id,
    title:        row.title        ?? '',
    description:  row.description  ?? '',
    status:       row.status       ?? 'Todo',
    priority:     row.priority     ?? 'Medium',
    // 021. Calendar activity type. Existing rows default to 'Task' because they
    // predate typing, not because anyone classified them.
    type:         row.type         ?? 'Task',
    dueDate:      row.due_date     ?? '',
    assignee:     row.assignee     ?? '',
    relatedType:  row.related_type  ?? 'None',
    relatedId:    row.related_id    ?? '',
    relatedLabel: row.related_label ?? '',
    completedAt:  row.completed_at  ?? null,
    createdAt:    row.created_at    ?? '',
    tags:         Array.isArray(row.tags) ? row.tags : [],
    createdBy:    row.created_by    ?? '',
  }
}

/** App task payload → Supabase column names (snake_case) */
function toDb(payload) {
  const row = {}

  if (payload.title        !== undefined) row.title        = payload.title
  if (payload.description  !== undefined) row.description  = payload.description
  if (payload.priority     !== undefined) row.priority     = payload.priority
  if (payload.type         !== undefined) row.type         = payload.type || 'Task'
  if (payload.assignee     !== undefined) row.assignee     = payload.assignee
  if (payload.dueDate      !== undefined) row.due_date     = payload.dueDate || null
  if (payload.relatedType  !== undefined) row.related_type  = payload.relatedType ?? 'None'
  // related_id must be a UUID or NULL, never ''. 025 added
  // tasks_related_id_is_uuid — CHECK (related_id IS NULL OR related_id ~ uuid)
  // — and '' matches neither branch, so a task with no related record was
  // rejected with 23514. Added NOT VALID, so existing rows were grandfathered
  // and only new writes failed. `|| null` not `?? null`: '' is the value that
  // has to become NULL. toApp() maps NULL back to '' on read.
  if (payload.relatedId    !== undefined) row.related_id    = payload.relatedId   || null
  if (payload.relatedLabel !== undefined) row.related_label = payload.relatedLabel ?? ''
  if (payload.tags         !== undefined) {
    row.tags = Array.isArray(payload.tags) ? payload.tags : []
  }

  // Handle status + completedAt together
  if (payload.status !== undefined) {
    row.status = payload.status
    if (payload.status === 'Completed') {
      // Auto-set completed_at when marking done
      row.completed_at = payload.completedAt ?? todayLocal()
    } else {
      // Clear completed_at when moving away from Completed
      row.completed_at = null
    }
  }

  // Allow explicit completedAt override (e.g. when editing an existing completed task)
  if (payload.completedAt !== undefined && payload.status === undefined) {
    row.completed_at = payload.completedAt
  }

  if (payload.createdBy !== undefined) row.created_by = payload.createdBy ?? ''

  return row
}

// ── Fetch all tasks ───────────────────────────────────────────────────────────

export async function getTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error) throwClassified(error)
  return (data ?? []).map(toApp)
}

// ── Fetch one task ────────────────────────────────────────────────────────────

export async function getTaskById(id) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throwClassified(error)
  return toApp(data)
}

// ── Create a task ─────────────────────────────────────────────────────────────

export async function insertTask(payload) {
  const today = todayLocal()
  const row   = {
    ...toDb(payload),
    created_at: today,
    // Do NOT include `id` — the DB generates it via gen_random_uuid()
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert(row)
    .select()
    .single()

  if (error) throwClassified(error)
  return toApp(data)
}

// ── Update a task ─────────────────────────────────────────────────────────────

export async function patchTask(id, payload) {
  const row = toDb(payload)

  const { data, error } = await supabase
    .from('tasks')
    .update(row)
    .eq('id', id)
    .select()
    .single()

  if (error) throwClassified(error)
  return toApp(data)
}

// ── Delete a task ─────────────────────────────────────────────────────────────

export async function removeTask(id) {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)

  if (error) throwClassified(error)
  return { id }
}
