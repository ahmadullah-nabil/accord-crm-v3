// ─── useLeadOverviewFilter ────────────────────────────────────────────────────
//
// The user filter for the Dashboard's Lead Overview, held in the URL beside
// ?tab= and the calendar's ?type= / ?status= / ?owner=.
//
// Same reasoning as useCalendarFilters: "whose pipeline is this" is a view
// worth keeping. It survives a refresh, and — the case that actually matters
// here — it survives the back button after clicking a stage through to the
// Leads page. Component state would reset on exactly that round trip, which is
// the one journey this widget is built for.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ WHY ?leadOwner AND NOT ?owner                                            │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ ?owner is already taken by the calendar, and both widgets sit on the    │
// │ SAME tab. Sharing the param would mean picking a name under the lead    │
// │ counts silently re-filters the calendar above it — two unrelated views  │
// │ moving as one, with no way to set them differently.                      │
// │                                                                          │
// │ Sharing is not obviously wrong ("show me everything for Sabbir" is a    │
// │ coherent thing to want), but it is a different feature and it should be │
// │ a deliberate one, not a side effect of a name collision.                 │
// └─────────────────────────────────────────────────────────────────────────┘
//
// 'all' is the sentinel for "no filter", matching useCalendarFilters, and the
// param is DELETED rather than set to 'all' so an unfiltered Dashboard keeps a
// clean URL.

import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export const LEAD_OWNER_PARAM = 'leadOwner'

export function useLeadOverviewFilter() {
  const [searchParams, setSearchParams] = useSearchParams()

  const owner = searchParams.get(LEAD_OWNER_PARAM)?.trim() || 'all'

  const setOwner = useCallback((name) => {
    // Functional form, and { replace: true } — same reasons as the calendar
    // filters: never clobber a tab change that landed in the same tick, and
    // never turn a dropdown into six entries of back-button history.
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (!name || name === 'all') next.delete(LEAD_OWNER_PARAM)
      else next.set(LEAD_OWNER_PARAM, name)
      return next
    }, { replace: true })
  }, [setSearchParams])

  return { owner, setOwner }
}
