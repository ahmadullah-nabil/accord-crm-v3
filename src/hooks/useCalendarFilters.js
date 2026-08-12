// ─── useCalendarFilters ───────────────────────────────────────────────────────
//
// Type / status / user filter state for the Dashboard calendar, held in the URL
// next to ?tab=.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ WHY THE URL AND NOT A STORE                                             │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Same reasoning as the tab. A filtered month is a view worth keeping: it │
// │ survives a refresh, it survives the back button after opening a task,   │
// │ and it can be pasted into chat — "here is what is overdue on Sabbir     │
// │ this month" is a link, not a set of instructions. Component state or a  │
// │ Zustand store silently resets on every one of those.                     │
// └─────────────────────────────────────────────────────────────────────────┘
//
// The URL shape, all optional and all absent when nothing is selected, so the
// default Dashboard URL stays clean:
//
//   ?type=Meeting,Call&status=overdue&owner=Rayhan%20Ahmed
//
// Filtering itself happens in memory — see calendarActivityService.filterActivities.
// This hook only decides WHAT is selected; it never touches the query.

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  CALENDAR_TYPES, CALENDAR_STATUSES,
} from '../services/calendarActivityService.js'

export const CALENDAR_FILTER_PARAMS = {
  types:    'type',
  statuses: 'status',
  owner:    'owner',
}

/** One shared empty array. Returned for every "nothing selected" case so the
 *  filters object stays referentially stable — useCalendarActivities memoises
 *  on filters.types / filters.statuses, and a fresh [] every render would make
 *  it recompute (and re-group by date) on every keystroke elsewhere. */
const NONE = Object.freeze([])

/**
 * Parse a comma list, keeping only values the calendar actually knows.
 *
 * Lenient on case and whitespace, and silently drops anything unrecognised: a
 * URL is a thing people hand-edit and paste, and a typo should narrow the view
 * by less than asked rather than produce an empty grid with no explanation.
 */
function parseList(raw, allowed) {
  if (!raw) return NONE
  const canonical = new Map(allowed.map((v) => [v.toLowerCase(), v]))
  const picked = []
  for (const part of raw.split(',')) {
    const hit = canonical.get(part.trim().toLowerCase())
    if (hit && !picked.includes(hit)) picked.push(hit)
  }
  return picked.length ? picked : NONE
}

/**
 * @returns {{
 *   filters: { types: string[], statuses: string[], owner: string },
 *   activeCount: number,
 *   toggleType: (t: string) => void,
 *   toggleStatus: (s: string) => void,
 *   setOwner: (name: string) => void,
 *   clear: () => void,
 * }}
 */
export function useCalendarFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const rawTypes    = searchParams.get(CALENDAR_FILTER_PARAMS.types)
  const rawStatuses = searchParams.get(CALENDAR_FILTER_PARAMS.statuses)
  const rawOwner    = searchParams.get(CALENDAR_FILTER_PARAMS.owner)

  // Memoised on the RAW STRINGS, not on searchParams — URLSearchParams is a new
  // object on every render, so keying on it would defeat the point.
  const filters = useMemo(() => ({
    types:    parseList(rawTypes, CALENDAR_TYPES),
    statuses: parseList(rawStatuses, CALENDAR_STATUSES),
    // 'all' rather than '' so the sentinel is explicit at every call site, and
    // matches what filterActivities already treats as "no owner filter".
    owner:    rawOwner?.trim() || 'all',
  }), [rawTypes, rawStatuses, rawOwner])

  const write = useCallback((patch) => {
    // Functional form so a filter change never clobbers a tab change (or
    // another filter) that landed in the same tick with a stale copy.
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(patch)) {
        const empty =
          value == null || value === '' || value === 'all' ||
          (Array.isArray(value) && value.length === 0)
        // Deleted rather than set to an empty value: an unfiltered calendar
        // should have an unfiltered URL, not ?type=&status=&owner=all.
        if (empty) next.delete(key)
        else next.set(key, Array.isArray(value) ? value.join(',') : value)
      }
      return next
    // replace, like the tab. Ticking six checkboxes should not mean pressing
    // Back six times to leave the Dashboard.
    }, { replace: true })
  }, [setSearchParams])

  const toggleType = useCallback((type) => {
    const next = filters.types.includes(type)
      ? filters.types.filter((t) => t !== type)
      : [...filters.types, type]
    write({ [CALENDAR_FILTER_PARAMS.types]: next })
  }, [filters.types, write])

  const toggleStatus = useCallback((status) => {
    const next = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status]
    write({ [CALENDAR_FILTER_PARAMS.statuses]: next })
  }, [filters.statuses, write])

  const setOwner = useCallback((name) => {
    write({ [CALENDAR_FILTER_PARAMS.owner]: name })
  }, [write])

  const clear = useCallback(() => {
    write({
      [CALENDAR_FILTER_PARAMS.types]:    NONE,
      [CALENDAR_FILTER_PARAMS.statuses]: NONE,
      [CALENDAR_FILTER_PARAMS.owner]:    'all',
    })
  }, [write])

  const activeCount =
    filters.types.length + filters.statuses.length + (filters.owner === 'all' ? 0 : 1)

  return { filters, activeCount, toggleType, toggleStatus, setOwner, clear }
}
