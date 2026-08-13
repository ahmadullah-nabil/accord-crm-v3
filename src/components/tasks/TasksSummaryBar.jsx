// ─── TasksSummaryBar ──────────────────────────────────────────────────────────
//
// step047. Six KPI cards → one row of chips, matching the four modules before.
//
// WHAT WENT AND WHY
// ─────────────────
// The old bar was a 6-across grid of ~76px cards with shadows, hover lifts and
// uppercase micro-labels — around 100px above a table whose job is showing
// tasks. Same counts, same filter behaviour, no furniture.
//
// 'OVERDUE' STAYS IN THE ROW, AND STAYS DERIVED
// ─────────────────────────────────────────────
// TASK_STATUSES still contains 'Overdue' and NOTHING WRITES IT — verified
// against the database, which holds no such row. step040 fixed the count here
// to derive from isTaskOverdue() rather than compare `status === 'Overdue'`,
// which read zero forever. That derivation is preserved exactly: the chip's
// count is derived, the other three are stored equality checks because those
// statuses ARE stored.
//
// The chip is kept rather than dropped because an overdue count is precisely
// what this row should show, and tasksStore.applyFilters already special-cases
// 'Overdue' to filter by isTaskOverdue(). Chip and filter agree.
//
// 'DUE TODAY' BECOMES TEXT. It was the second line inside the All card, where
// it competed with the total at 10px. It is a number you read, not a control
// you press — and isDueToday uses a LOCAL date, which is the whole point.

import React from 'react'
import { useTasksStore }                   from '../../stores/tasksStore.js'
import { TASK_STATUSES, STATUS_CONFIG }    from '../../lib/tasksData.js'
import { isTaskOverdue, isDueToday }       from '../../lib/dates.js'
import { FacetChips }                      from '../ui/FacetChips.jsx'

export function TasksSummaryBar({ tasks = [] }) {
  const { statusFilter, setStatusFilter } = useTasksStore()

  const total    = tasks.length
  const overdue  = tasks.filter(isTaskOverdue).length
  const dueToday = tasks.filter(isDueToday).length

  const items = [
    { key: 'All', label: 'All', count: total },
    ...TASK_STATUSES.map((status) => ({
      key:      status,
      label:    status,
      count:    status === 'Overdue'
        ? overdue                                             // DERIVED
        : tasks.filter((t) => t.status === status).length,    // stored
      dotClass: STATUS_CONFIG[status]?.dot,
    })),
  ]

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <FacetChips items={items} value={statusFilter} onChange={setStatusFilter} />
      {total > 0 && (
        <span className="text-xs text-gray-400 flex-shrink-0">
          <span className={`tnum font-medium ${dueToday > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
            {dueToday}
          </span> due today
          {overdue > 0 && (
            <>
              <span className="text-gray-300"> · </span>
              <span className="tnum font-medium text-red-500">{overdue}</span> overdue
            </>
          )}
        </span>
      )}
    </div>
  )
}

export default TasksSummaryBar
