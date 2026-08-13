// ─── MeetingsSummaryBar ───────────────────────────────────────────────────────
//
// step048. Five KPI cards → one row of chips. The last module to make this
// move; the reasoning is unchanged from the four before it.
//
// The old bar was a 5-across grid of ~76px cards with shadows, hover lifts and
// uppercase micro-labels — around 100px above a table whose job is showing
// meetings. Same counts, same filter behaviour, no furniture.
//
// THE PERCENTAGES ARE GONE ON PURPOSE. Every status card's second line read
// "N% of total", which is the count divided by the number beside it — the same
// fact stated twice, once in a form nobody acts on. "0% of total" under a count
// of zero is arithmetic, not insight.
//
// "THIS WEEK" BECOMES TEXT. It was the second line inside the All card, where
// it competed with the total at 10px. It is a number you read, not a control
// you press — and it is worth reading, so it keeps its place beside the chips
// rather than being dropped.

import React from 'react'
import { useMeetingsStore }  from '../../stores/meetingsStore.js'
import { MEETING_STATUSES, STATUS_CONFIG, daysFromToday } from '../../lib/meetingsData.js'
import { FacetChips }        from '../ui/FacetChips.jsx'

export function MeetingsSummaryBar({ meetings = [] }) {
  const { statusFilter, setStatusFilter } = useMeetingsStore()

  const total = meetings.length

  // Still ahead and still going to happen. Cancelled and Completed are settled
  // and would inflate a number whose whole point is "what is coming".
  const upcoming = meetings.filter((m) => {
    if (m.status !== 'Scheduled' && m.status !== 'Rescheduled') return false
    const d = daysFromToday(m.scheduledDate)
    return d !== null && d >= 0 && d <= 7
  }).length

  const items = [
    { key: 'All', label: 'All', count: total },
    ...MEETING_STATUSES.map((status) => ({
      key:      status,
      label:    status,
      count:    meetings.filter((m) => m.status === status).length,
      dotClass: STATUS_CONFIG[status]?.dot,
    })),
  ]

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <FacetChips items={items} value={statusFilter} onChange={setStatusFilter} />
      {total > 0 && (
        <span className="text-xs text-gray-400 flex-shrink-0">
          <span className={`tnum font-medium ${upcoming > 0 ? 'text-teal-700' : 'text-gray-500'}`}>
            {upcoming}
          </span> in the next 7 days
        </span>
      )}
    </div>
  )
}

export default MeetingsSummaryBar
