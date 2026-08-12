// ─── Notifications Service ────────────────────────────────────────────────────
//
// All real Supabase CRUD for the notifications table.
// Called exclusively by useNotifications.js hooks.
//
// RLS ensures users only see their own notifications — no client-side
// filtering needed; Supabase enforces it at the DB level.
//
// Notification field mapping
// ──────────────────────────
// DB snake_case:  user_id, is_read, is_pinned, actor_id, entity_type, entity_id
// App camelCase:  userId, isRead, isPinned, actorId, entityType, entityId

import { supabase } from '../lib/supabaseClient.js'

// ── Field mapper ──────────────────────────────────────────────────────────────
function toApp(row) {
  if (!row) return null
  return {
    id:         row.id,
    userId:     row.user_id,
    actor:      row.actor       ?? '',
    actorId:    row.actor_id    ?? null,
    category:   row.category    ?? 'System',
    type:       row.type,
    title:      row.title       ?? '',
    body:       row.body        ?? '',
    entityType: row.entity_type ?? null,
    entityId:   row.entity_id   ?? null,
    isRead:     row.is_read     ?? false,
    isPinned:   row.is_pinned   ?? false,
    metadata:   row.metadata    ?? {},
    createdAt:  row.created_at  ?? '',
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** Fetch all notifications for the authenticated user (RLS scopes to user_id). */
export async function getNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    // Table missing — return empty so the UI shows an empty state
    if (error.code === '42P01') return []
    throw error
  }
  return (data ?? []).map(toApp)
}

/** Fetch unread count for badge — lightweight, only counts. */
export async function getUnreadCount() {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false)

  if (error) {
    if (error.code === '42P01') return 0
    throw error
  }
  return count ?? 0
}

/** Fetch a single notification. */
export async function getNotificationById(id) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return toApp(data)
}

// ── Write ─────────────────────────────────────────────────────────────────────

/** Mark one notification as read. */
export async function markNotificationRead(id) {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toApp(data)
}

/** Mark one notification as unread. */
export async function markNotificationUnread(id) {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: false })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toApp(data)
}

/** Mark ALL unread notifications as read for the authenticated user. */
export async function markAllNotificationsRead() {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false)   // RLS scopes this to current user
    .select()
  if (error) throw error
  return (data ?? []).map(toApp)
}

/** Toggle pinned state. */
export async function toggleNotificationPin(id) {
  // Read current state, then flip
  const { data: cur, error: fetchErr } = await supabase
    .from('notifications')
    .select('is_pinned')
    .eq('id', id)
    .single()
  if (fetchErr) throw fetchErr

  const { data, error } = await supabase
    .from('notifications')
    .update({ is_pinned: !cur.is_pinned })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toApp(data)
}

/** Delete a notification permanently. */
export async function deleteNotification(id) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id)
  if (error) throw error
  return { id }
}

/** Delete all read (non-pinned) notifications for the current user. */
export async function deleteAllReadNotifications() {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('is_read', true)
    .eq('is_pinned', false)
  if (error) throw error
  return []
}

// ── Create helpers ────────────────────────────────────────────────────────────
//
// These are the public API for other services (leadsStore, useTasks, etc.)
// to create notifications when significant events occur.
//
// Design: fire-and-forget by the caller — errors are logged, not thrown.
// The primary action (create lead, update stage) must never fail due to
// a notification write failure.

// ── Recipient resolution ──────────────────────────────────────────────────────
//
// The CRM stores assignment as a DISPLAY NAME string (leads.assignee,
// tasks.assignee, meetings.organizer), but notifications.user_id is an
// auth.users UUID. This bridges the two.
//
// It is not a notification helper — it creates nothing. It only answers
// "who should receive this?" so the existing notify* helpers can be called
// with a real recipientId.
//
// Returns null (meaning: do not notify) when
//   • no assignee name is set
//   • the name does not match an active profile
//   • the assignee IS the person who performed the action (self-assignment)
//
// Self-assignment is deliberately silent: notifying someone about an action
// they just performed themselves is noise. No existing business rule in this
// CRM requires it.
//
// A short-lived in-memory cache avoids one profiles round-trip per write.
const RECIPIENT_CACHE_TTL = 1000 * 60 * 5
const recipientCache = new Map()   // lowercased name → { id, at }

/**
 * Resolve an assignee display name to the profile id that should be notified.
 *
 * @param {string} assigneeName  Display name as stored on the record.
 * @param {string} actorId       auth id of the user who performed the action.
 * @returns {Promise<string|null>} Recipient profile id, or null to skip.
 */
export async function resolveNotificationRecipient(assigneeName, actorId) {
  const name = (assigneeName ?? '').trim()
  if (!name) return null

  const key    = name.toLowerCase()
  const cached = recipientCache.get(key)
  let profileId = null

  if (cached && Date.now() - cached.at < RECIPIENT_CACHE_TTL) {
    profileId = cached.id
  } else {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('name', name)
        .eq('is_active', true)
        .limit(1)

      if (error) {
        console.warn('[notificationsService] recipient lookup failed:', error.message)
        return null
      }
      profileId = data?.[0]?.id ?? null
      recipientCache.set(key, { id: profileId, at: Date.now() })
    } catch (err) {
      console.warn('[notificationsService] recipient lookup threw:', err.message)
      return null
    }
  }

  if (!profileId) return null
  if (actorId && profileId === actorId) return null   // self-assignment → silent
  return profileId
}

// ── Duplicate suppression ─────────────────────────────────────────────────────
//
// Some business events are reachable through more than one code path — an
// opportunity stage can change via the kanban drag (useUpdateOpportunityStage)
// or via the edit modal (useUpdateOpportunity). React Query also retries a
// failed mutation once, which can re-run onSuccess side effects.
//
// This guard drops an identical notification (same recipient, type, entity and
// title) seen within a short window. It is intentionally narrow: a genuinely
// repeated event — the same lead reassigned to the same person twice — will
// still notify once the window lapses.
const DEDUPE_WINDOW = 1000 * 15
const recentlySent  = new Map()   // signature → timestamp

function isDuplicate(signature) {
  const now  = Date.now()
  const seen = recentlySent.get(signature)

  // Opportunistic cleanup so the map cannot grow unbounded in a long session
  if (recentlySent.size > 200) {
    for (const [k, t] of recentlySent) {
      if (now - t > DEDUPE_WINDOW) recentlySent.delete(k)
    }
  }

  if (seen && now - seen < DEDUPE_WINDOW) return true
  recentlySent.set(signature, now)
  return false
}

/**
 * Create a single notification row.
 *
 * @param {object} opts
 * @param {string}   opts.userId      — recipient Supabase UUID
 * @param {string}   [opts.actor]     — display name of who triggered it
 * @param {string}   [opts.actorId]   — UUID of the actor profile
 * @param {string}   opts.category    — 'Assignments'|'Tasks'|'Meetings'|'Deals'|'Leads'|'System'
 * @param {string}   opts.type        — machine-readable event type
 * @param {string}   opts.title       — short notification title
 * @param {string}   [opts.body]      — longer description
 * @param {string}   [opts.entityType]— 'lead'|'task'|'meeting'|'opportunity'
 * @param {string}   [opts.entityId]  — UUID of the source record
 * @param {object}   [opts.metadata]  — arbitrary JSON payload
 */
export async function createNotification({
  userId,
  actor    = '',
  actorId  = null,
  category = 'System',
  type,
  title,
  body     = '',
  entityType = null,
  entityId   = null,
  metadata   = {},
}) {
  if (!userId || !type || !title) {
    console.warn('[notificationsService] createNotification: missing required fields', { userId, type, title })
    return null
  }

  // Applies to every path into this function, including the intelligence
  // scanner, so no caller has to implement its own guard.
  if (isDuplicate(`${userId}|${type}|${entityId ?? ''}|${title}`)) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id:     userId,
        actor,
        actor_id:    actorId,
        category,
        type,
        title,
        body,
        entity_type: entityType,
        entity_id:   entityId   ?? null,
        metadata,
      })
      .select()
      .single()

    if (error) {
      console.error('[notificationsService] createNotification error:', error.message)
      return null
    }
    return toApp(data)
  } catch (err) {
    console.error('[notificationsService] createNotification threw:', err.message)
    return null
  }
}

// ── High-level notification helpers ───────────────────────────────────────────
// Called by leadsStore, useMeetings, useTasks, etc. after a successful write.
// Always fire-and-forget (callers do not await these).

/**
 * Notify a user that a lead has been assigned to them.
 */
export function notifyLeadAssignment({ recipientId, actorName, actorId, leadName, leadId }) {
  return createNotification({
    userId:     recipientId,
    actor:      actorName,
    actorId,
    category:   'Assignments',
    type:       'lead_assigned',
    title:      `Lead assigned: ${leadName}`,
    body:       `${actorName} assigned you the lead for ${leadName}.`,
    entityType: 'lead',
    entityId:   leadId,
  })
}

/**
 * Notify a user that a task has been assigned to them.
 */
export function notifyTaskAssignment({ recipientId, actorName, actorId, taskTitle, taskId, dueDate }) {
  return createNotification({
    userId:     recipientId,
    actor:      actorName,
    actorId,
    category:   'Assignments',
    type:       'task_assigned',
    title:      `Task assigned: ${taskTitle}`,
    body:       dueDate
      ? `${actorName} assigned you a task due ${dueDate}.`
      : `${actorName} assigned you a new task.`,
    entityType: 'task',
    entityId:   taskId,
    metadata:   { dueDate },
  })
}

/**
 * Notify a user that a meeting has been scheduled for them.
 */
export function notifyMeetingScheduled({ recipientId, actorName, actorId, meetingTitle, meetingId, scheduledDate }) {
  return createNotification({
    userId:     recipientId,
    actor:      actorName,
    actorId,
    category:   'Meetings',
    type:       'meeting_scheduled',
    title:      `Meeting scheduled: ${meetingTitle}`,
    body:       scheduledDate
      ? `${actorName} scheduled a meeting on ${scheduledDate}.`
      : `${actorName} scheduled a new meeting with you.`,
    entityType: 'meeting',
    entityId:   meetingId,
    metadata:   { scheduledDate },
  })
}

/**
 * Notify when an opportunity moves to a significant stage.
 */
export function notifyOpportunityStageChange({ recipientId, actorName, actorId, oppTitle, oppId, newStage, oldStage }) {
  const isWon  = newStage === 'Won'
  const isLost = newStage === 'Lost'
  return createNotification({
    userId:     recipientId,
    actor:      actorName,
    actorId,
    category:   'Deals',
    type:       isWon ? 'opportunity_won' : isLost ? 'opportunity_lost' : 'opportunity_stage_changed',
    title:      isWon
      ? `Deal won: ${oppTitle}` 
      : isLost
        ? `Deal lost: ${oppTitle}`
        : `Deal moved to ${newStage}: ${oppTitle}`,
    body:       `${actorName} moved "${oppTitle}" from ${oldStage} to ${newStage}.`,
    entityType: 'opportunity',
    entityId:   oppId,
    metadata:   { newStage, oldStage },
  })
}

// ── Activity Intelligence helpers ─────────────────────────────────────────────
// These are called by the intelligence scanner (useIntelligence hook) to
// create system-level notifications for stale/overdue records.

/**
 * Create an overdue task notification for the task's assignee.
 */
export function notifyOverdueTask({ recipientId, taskTitle, taskId, dueDate, daysOverdue }) {
  return createNotification({
    userId:     recipientId,
    actor:      'System',
    category:   'Tasks',
    type:       'task_overdue',
    title:      `Overdue task: ${taskTitle}`,
    body:       `This task was due ${daysOverdue === 1 ? 'yesterday' : `${daysOverdue} days ago`} (${dueDate}). Please update or reschedule.`,
    entityType: 'task',
    entityId:   taskId,
    metadata:   { dueDate, daysOverdue },
  })
}

/**
 * Create a stale opportunity notification for the assignee.
 */
export function notifyStaleOpportunity({ recipientId, oppTitle, oppId, daysSinceActivity, stage }) {
  return createNotification({
    userId:     recipientId,
    actor:      'System',
    category:   'Deals',
    type:       'opportunity_stale',
    title:      `Stale deal: ${oppTitle}`,
    body:       `No activity on "${oppTitle}" (${stage}) for ${daysSinceActivity} days. Consider following up.`,
    entityType: 'opportunity',
    entityId:   oppId,
    metadata:   { daysSinceActivity, stage },
  })
}

/**
 * Create an inactive lead notification for the assignee.
 */
export function notifyInactiveLead({ recipientId, leadName, leadId, daysSinceActivity, stage }) {
  return createNotification({
    userId:     recipientId,
    actor:      'System',
    category:   'Leads',
    type:       'lead_inactive',
    title:      `Inactive lead: ${leadName}`,
    body:       `No activity on "${leadName}" (${stage}) for ${daysSinceActivity} days.`,
    entityType: 'lead',
    entityId:   leadId,
    metadata:   { daysSinceActivity, stage },
  })
}

// ── Realtime subscription ─────────────────────────────────────────────────────
//
// Mounted once by useNotificationsRealtime() (hooks/useNotifications.js), which
// is itself mounted once in AppLayout. Do not call this directly from a page or
// component — doing so would open a second channel on the same topic.
//
// Listens for INSERT, UPDATE and DELETE so that:
//   INSERT → a new notification arrives live (badge + list update)
//   UPDATE → read/pin state changes made in another tab are reflected here
//   DELETE → dismissals made in another tab disappear here
//
// The server-side `filter` restricts the stream to this user's rows. That is a
// transport-level filter and is NOT a substitute for RLS — Supabase Realtime
// additionally evaluates the table's RLS SELECT policy against the subscriber's
// JWT before delivering any row, so a user cannot receive another user's
// notifications even if this filter were removed.

const notificationsTopic = (userId) => `notifications:user:${userId}`

/**
 * Open the notifications realtime channel for one user.
 *
 * @param {string} userId  Authenticated Supabase user id.
 * @param {object} handlers
 * @param {(n: object, event: string) => void} [handlers.onChange]  Any change.
 * @param {(n: object) => void} [handlers.onInsert]                 New row only.
 * @param {(status: string, err?: Error) => void} [handlers.onStatus] Channel state.
 * @returns {{ unsubscribe: () => void }}
 */
export function subscribeToNotifications(userId, handlers = {}) {
  const { onChange, onInsert, onStatus } = handlers
  const topic = notificationsTopic(userId)

  // Duplicate-subscription guard. React StrictMode double-invokes effects in
  // development and Vite HMR re-runs modules, both of which can leave an orphan
  // channel bound to this topic. Tear down any existing one before opening a new
  // channel so exactly one subscription per user is ever live.
  supabase
    .getChannels()
    .filter((c) => c.topic === topic || c.topic === `realtime:${topic}`)
    .forEach((c) => supabase.removeChannel(c))

  const handle = (payload) => {
    // DELETE payloads carry the removed row in `old`, not `new`.
    const row = payload.eventType === 'DELETE' ? payload.old : payload.new
    const mapped = toApp(row)
    if (payload.eventType === 'INSERT' && typeof onInsert === 'function') {
      onInsert(mapped)
    }
    if (typeof onChange === 'function') onChange(mapped, payload.eventType)
  }

  const channel = supabase
    .channel(topic)
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'notifications',
        filter: `user_id=eq.${userId}`,
      },
      handle,
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        // Most common cause: public.notifications is not in the
        // supabase_realtime publication. See 016_notifications_realtime.sql.
        console.warn(
          `[notificationsService] realtime channel ${status}. ` +
          'Confirm Realtime replication is enabled for public.notifications.',
          err?.message ?? '',
        )
      }
      if (typeof onStatus === 'function') onStatus(status, err)
    })

  return {
    unsubscribe: () => { supabase.removeChannel(channel) },
  }
}
