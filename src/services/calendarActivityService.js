// ─── Activity calendar data layer ─────────────────────────────────────────────
//
// The Dashboard's monthly calendar shows meetings AND tasks in one grid. They
// live in two tables with genuinely different shapes, and this module is the
// single place that reconciles them.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ WHY A UNION AT READ TIME, NOT A UNIFIED TABLE                           │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ A meeting has a date, a time and a duration. A task has a due date and  │
// │ NO time at all. A single table would need nullable columns meaning      │
// │ different things per row — and every write path would have to know      │
// │ which flavour it was writing.                                            │
// │                                                                          │
// │ `activities` is not the answer either: it is an append-only AUDIT LOG   │
// │ (actor, action, subject, occurred_at) recording what HAPPENED. A        │
// │ calendar needs what is SCHEDULED.                                        │
// │                                                                          │
// │ Unioning at read time costs one extra query and no migration. If it     │
// │ proves painful, a real table is still available later. The reverse —     │
// │ unpicking a merged table — is not.                                       │
// └─────────────────────────────────────────────────────────────────────────┘
//
// Every item is normalised to:
//
//   { id, source, type, title, date, time, endTime, allDay,
//     status, owner, relatedType, relatedId, relatedLabel, raw }
//
// `allDay` is the load-bearing one. Tasks are all-day because they genuinely
// are: giving one a default hour would invent information and make it look
// scheduled against a real meeting at that hour.

import { supabase }        from '../lib/supabaseClient.js'
import { throwClassified } from '../lib/supabaseErrors.js'

// ── The four statuses the calendar speaks ─────────────────────────────────────
//
// Meetings and tasks each have their own vocabulary and neither matches the
// other. Mapping happens HERE so the grid, the filters and the legend all agree
// — and so a change of vocabulary in either table is a one-line edit.
//
//   meetings  Scheduled | Completed | Cancelled | Rescheduled
//   tasks     Todo      | In Progress | Completed | Overdue
//   calendar  pending   | completed | overdue | cancelled
export const CALENDAR_STATUSES = ['pending', 'completed', 'overdue', 'cancelled']

export const CALENDAR_TYPES = ['Meeting', 'Task', 'Follow-up', 'Call', 'Deadline']

const MEETING_STATUS_MAP = {
  Scheduled:   'pending',
  Rescheduled: 'pending',   // still going to happen, just moved
  Completed:   'completed',
  Cancelled:   'cancelled',
}

const TASK_STATUS_MAP = {
  'Todo':        'pending',
  'In Progress': 'pending',
  'Completed':   'completed',
  // 'Overdue' deliberately absent — see isOverdue below.
}

/** Local YYYY-MM-DD. Never toISOString(), which converts to UTC and can shift
 *  the date by a day for anyone east or west of Greenwich — in Dhaka (UTC+6)
 *  every evening item would land on the previous day. */
function localISODate(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Overdue is DERIVED, never read from storage.
 *
 * `tasks.status` can literally contain 'Overdue', but that value is wrong the
 * moment a date passes without someone editing the row — and wrong again if the
 * due date is later pushed out. The date is the truth.
 */
function isOverdue(dateStr, mappedStatus) {
  if (!dateStr) return false
  if (mappedStatus === 'completed' || mappedStatus === 'cancelled') return false
  return dateStr < localISODate(new Date())
}

function addMinutes(time, mins) {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + (Number(mins) || 0)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(Math.floor(total / 60) % 24)}:${p(total % 60)}`
}

function meetingToItem(row) {
  const mapped = MEETING_STATUS_MAP[row.status] ?? 'pending'
  const date   = row.scheduled_date ?? null
  return {
    id:     `meeting:${row.id}`,
    source: 'meeting',
    // A meeting's TYPE column already distinguishes Follow-up from Demo, so it
    // is surfaced directly rather than collapsing everything to 'Meeting'. That
    // is what makes the type filter useful without a second table.
    type:   row.type === 'Follow-up' ? 'Follow-up' : 'Meeting',
    title:  row.title ?? '',
    date,
    time:    row.scheduled_time ?? null,
    endTime: addMinutes(row.scheduled_time, row.duration_mins ?? 60),
    allDay:  false,
    status:  isOverdue(date, mapped) ? 'overdue' : mapped,
    owner:   row.organizer ?? '',
    ownerId: row.organizer_id ?? null,
    relatedType:  row.related_type  ?? 'None',
    relatedId:    row.related_id    ?? '',
    relatedLabel: row.related_label ?? '',
    // Sync state is surfaced so the calendar can flag a meeting whose
    // invitations never went out — silence there reads as success.
    syncStatus: row.sync_status ?? 'not_synced',
    raw: row,
  }
}

function taskToItem(row) {
  const mapped = TASK_STATUS_MAP[row.status] ?? 'pending'
  const date   = row.due_date ?? null
  return {
    id:     `task:${row.id}`,
    source: 'task',
    type:   row.type || 'Task',
    title:  row.title ?? '',
    date,
    // No time, and none invented. Rendered in the all-day strip.
    time:    null,
    endTime: null,
    allDay:  true,
    status:  isOverdue(date, mapped) ? 'overdue' : mapped,
    owner:   row.assignee ?? '',
    ownerId: null,          // tasks store an assignee NAME, not a user id
    relatedType:  row.related_type  ?? 'None',
    relatedId:    row.related_id    ?? '',
    relatedLabel: row.related_label ?? '',
    priority: row.priority ?? 'Medium',
    raw: row,
  }
}

/**
 * Every calendar item falling inside [from, to], inclusive, both YYYY-MM-DD.
 *
 * Two queries rather than one SQL UNION on purpose: a Postgres view would have
 * to reconcile the column sets itself, and PostgREST cannot filter a view as
 * flexibly as it filters a table. Two indexed range scans are cheap — both
 * tables already index their date column.
 *
 * COMPLETED ITEMS ARE INCLUDED. The calendar is meant to be a work schedule AND
 * an activity history; dropping finished work would make last week look empty.
 */
export async function getCalendarActivities({ from, to }) {
  if (!from || !to) throw new Error('getCalendarActivities requires from and to')

  const [meetingsRes, tasksRes] = await Promise.all([
    supabase
      .from('meetings')
      .select('id, title, type, status, scheduled_date, scheduled_time, duration_mins, ' +
              'organizer, organizer_id, related_type, related_id, related_label, sync_status')
      .gte('scheduled_date', from)
      .lte('scheduled_date', to),
    supabase
      .from('tasks')
      .select('id, title, type, status, priority, due_date, assignee, ' +
              'related_type, related_id, related_label')
      .gte('due_date', from)
      .lte('due_date', to),
  ])

  if (meetingsRes.error) throwClassified(meetingsRes.error, 'load calendar meetings')
  if (tasksRes.error)    throwClassified(tasksRes.error, 'load calendar tasks')

  const items = [
    ...(meetingsRes.data ?? []).map(meetingToItem),
    ...(tasksRes.data ?? []).map(taskToItem),
  ]

  // All-day items first within a day, then by start time. Matches how Google
  // and Outlook stack a day: undated-within-the-day work at the top, timed
  // items below in order.
  items.sort((a, b) => {
    if (a.date !== b.date) return (a.date ?? '') < (b.date ?? '') ? -1 : 1
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
    return (a.time ?? '').localeCompare(b.time ?? '')
  })

  return items
}

/** Group into { 'YYYY-MM-DD': [items] } — the shape a month grid renders from. */
export function groupByDate(items) {
  const byDate = {}
  for (const item of items) {
    if (!item.date) continue
    ;(byDate[item.date] ||= []).push(item)
  }
  return byDate
}

/**
 * Client-side filtering.
 *
 * Deliberately not pushed into the query: the month's items are already loaded
 * and small (tens, not thousands), so filtering in memory makes every toggle
 * instant instead of a network round trip. Revisit only if a month can hold
 * enough items for this to be felt.
 */
export function filterActivities(items, { types, statuses, owner } = {}) {
  return items.filter((item) => {
    if (types?.length && !types.includes(item.type)) return false
    if (statuses?.length && !statuses.includes(item.status)) return false
    // Name comparison, because tasks store an assignee NAME and have no user
    // id. Meetings do have organizer_id, but filtering the two differently
    // would silently drop tasks from any per-user view.
    if (owner && owner !== 'all') {
      if ((item.owner ?? '').toLowerCase() !== owner.toLowerCase()) return false
    }
    return true
  })
}

/** Distinct owner names present in a set — populates the user filter without a
 *  second query, and without listing people who have nothing this month. */
export function ownersIn(items) {
  return [...new Set(items.map((i) => i.owner).filter(Boolean))].sort()
}

/** Counts per status, for the legend. */
export function statusCounts(items) {
  const counts = { pending: 0, completed: 0, overdue: 0, cancelled: 0 }
  for (const item of items) counts[item.status] = (counts[item.status] ?? 0) + 1
  return counts
}

/** First and last day of a month as YYYY-MM-DD, for the query window. */
export function monthRange(year, monthIndex) {
  const first = new Date(year, monthIndex, 1)
  const last  = new Date(year, monthIndex + 1, 0)
  return { from: localISODate(first), to: localISODate(last) }
}
