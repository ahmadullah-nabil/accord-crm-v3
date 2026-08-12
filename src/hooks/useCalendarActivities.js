// ─── useCalendarActivities ────────────────────────────────────────────────────
//
// Meetings and tasks for one month, normalised into a single calendar shape.
//
// Fetches by MONTH and filters in memory. The month is the query key; type,
// status and owner toggles never hit the network. A month holds tens of items,
// not thousands, so filtering client-side makes every toggle instant — and
// makes the counts in the legend reflect the whole month rather than only what
// survived the current filter.

import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getCalendarActivities, groupByDate, filterActivities,
  ownersIn, statusCounts, monthRange,
} from '../services/calendarActivityService.js'

export const calendarKeys = {
  month: (year, monthIndex) => ['calendar', 'month', year, monthIndex],
}

/**
 * @param {number} year
 * @param {number} monthIndex  0-11, matching Date
 * @param {object} [filters]   { types, statuses, owner }
 */
export function useCalendarActivities(year, monthIndex, filters = {}) {
  const { from, to } = useMemo(() => monthRange(year, monthIndex), [year, monthIndex])

  const query = useQuery({
    queryKey: calendarKeys.month(year, monthIndex),
    queryFn:  () => getCalendarActivities({ from, to }),
    // Meetings and tasks change from elsewhere in the app (the meetings table,
    // the task modal), so a short stale window keeps the calendar honest
    // without refetching on every focus change.
    staleTime: 30_000,
  })

  const all = query.data ?? []

  const filtered = useMemo(
    () => filterActivities(all, filters),
    [all, filters.types, filters.statuses, filters.owner],
  )

  return {
    ...query,
    /** Everything this month, before filters — the legend counts from this so
     *  the numbers do not change as the user narrows the view. */
    all,
    items: filtered,
    byDate: useMemo(() => groupByDate(filtered), [filtered]),
    owners: useMemo(() => ownersIn(all), [all]),
    counts: useMemo(() => statusCounts(all), [all]),
    range: { from, to },
  }
}

/**
 * Invalidate the calendar after a meeting or task changes elsewhere.
 *
 * Broad on purpose: an edit can move an item BETWEEN months (a reschedule, a
 * pushed-out due date), so invalidating only the visible month would leave the
 * origin month showing an item that is no longer there.
 */
export function useInvalidateCalendar() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['calendar'] })
}
