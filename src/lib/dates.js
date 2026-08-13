// ─── Local dates and derived overdue ──────────────────────────────────────────
//
// Two rules that this codebase already stated, kept in one place so they stop
// being restated — and misstated — per module.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 1. NEVER toISOString() FOR A CALENDAR DATE                              │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ toISOString() converts to UTC. Dhaka is UTC+6, so between midnight and  │
// │ 6am local it returns YESTERDAY. Any "is this due today" or "is this     │
// │ overdue" comparison built on it is wrong for six hours a day — and      │
// │ wrong silently, at the hour nobody is looking.                          │
// │                                                                          │
// │ The correct helper already existed in calendarActivityService.js and    │
// │ ActivityCalendar.jsx. It was private to both, so the other forty-odd    │
// │ date computations in src/ used toISOString() instead.                   │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ 2. OVERDUE IS DERIVED, NEVER STORED                                     │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ TASK_STATUSES still contains 'Overdue'. It is legacy and wrong: a       │
// │ stored status is right only until a date passes without someone editing │
// │ the row, and wrong again the moment a due date is pushed out.           │
// │                                                                          │
// │ Nothing in this codebase writes 'Overdue' — verified against the        │
// │ database, where the tasks table contains no such row. So every UI that  │
// │ counted `status === 'Overdue'` was reading a value that is never        │
// │ written and displaying zero forever.                                    │
// └─────────────────────────────────────────────────────────────────────────┘

/**
 * A Date as local YYYY-MM-DD.
 *
 * Built from the local getters rather than any ISO serialisation, because the
 * whole point is to stay in the user's day rather than Greenwich's.
 */
export function localISODate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Today, local, as YYYY-MM-DD. */
export function todayLocal() {
  return localISODate(new Date())
}

/**
 * Is this task overdue right now?
 *
 *   due_date < today AND status <> 'Completed'
 *
 * String comparison is correct and deliberate here: YYYY-MM-DD sorts
 * lexicographically in date order, so this needs no Date parsing and no
 * timezone reasoning beyond `today` itself.
 *
 * A task with no due date is never overdue — there is nothing to be late for.
 */
export function isTaskOverdue(task) {
  if (!task?.dueDate) return false
  if (task.status === 'Completed') return false
  return task.dueDate < todayLocal()
}

/**
 * The same rule against raw snake_case DB rows, for the service layer.
 *
 * Kept as a second function rather than a shape-sniffing one: a helper that
 * guesses whether it was handed camelCase or snake_case gets that guess wrong
 * eventually, and silently.
 */
export function isRowOverdue(row) {
  if (!row?.due_date) return false
  if (row.status === 'Completed') return false
  return row.due_date < todayLocal()
}

/** Is this task due today? Completed tasks are excluded — they are done. */
export function isDueToday(task) {
  if (!task?.dueDate) return false
  if (task.status === 'Completed') return false
  return task.dueDate === todayLocal()
}
