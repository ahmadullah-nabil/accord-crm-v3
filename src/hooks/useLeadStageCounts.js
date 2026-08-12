// ─── useLeadStageCounts ───────────────────────────────────────────────────────
//
// Per-stage lead counts for the Dashboard's Lead Overview.
//
// Fetches ONE narrow projection — (stage, assignee) for every lead — and counts
// in memory. Same reasoning as useCalendarActivities: the user filter is a
// toggle, and a toggle that hits the network feels broken. Seven `count: exact`
// head requests (one per stage) would also multiply by the number of users.
//
// The projection is two short text columns. Even at 10k leads that is a few
// hundred KB once; the alternative is 7-plus round trips every time somebody
// changes the dropdown.
//
// Query key is ['leads', 'stage-facets'] — deliberately UNDER ['leads'], so if
// leadsStore ever invalidates ['leads'] after a mutation these counts refresh
// for free. It does not today (the store is its own cache, no React Query), so
// a lead added on the Leads page shows up here after staleTime. Known and
// accepted; see the handoff.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getLeadStageFacets } from '../services/leadsService.js'
import { STAGES } from '../stores/leadsStore.js'

export const leadStageKeys = {
  facets: () => ['leads', 'stage-facets'],
}

// One shared frozen array for every empty case, so `rows` is referentially
// stable while loading and the memos below do not re-run on unrelated renders.
const NONE = Object.freeze([])

/**
 * @param {string} [owner]  assignee NAME, or '' for everyone.
 *                          Names, not ids — leads store `assignee` as a name
 *                          and have no assignee_id. See the carried-forward
 *                          invariant; this must match how leadsStore filters.
 */
export function useLeadStageCounts(owner = '') {
  const query = useQuery({
    queryKey:  leadStageKeys.facets(),
    queryFn:   getLeadStageFacets,
    staleTime: 30_000,
  })

  const rows = query.data ?? NONE

  /** Every assignee that actually holds a lead. Sorted, de-duplicated, blanks
   *  dropped — unassigned leads still COUNT, they just are not an option. */
  const owners = useMemo(
    () => [...new Set(rows.map((r) => r.assignee).filter(Boolean))].sort(),
    [rows],
  )

  const { byStage, other, total } = useMemo(() => {
    const scoped = owner ? rows.filter((r) => r.assignee === owner) : rows

    const byStage = Object.fromEntries(STAGES.map((s) => [s, 0]))
    let other = 0

    for (const r of scoped) {
      // hasOwnProperty, not `in` — `in` walks the prototype chain, so a stage
      // literally called "constructor" or "toString" would land in a real slot.
      if (Object.prototype.hasOwnProperty.call(byStage, r.stage)) byStage[r.stage] += 1
      else other += 1
    }

    return { byStage, other, total: scoped.length }
  }, [rows, owner])

  return {
    ...query,
    /** { New: 12, Contacted: 4, … } — every stage in STAGES, zeros included. */
    byStage,
    /** Leads whose stage is not in STAGES. Almost always 0; surfaced rather
     *  than swallowed so the chips always sum to the total. */
    other,
    /** Total for the selected owner (or everyone when no owner is selected). */
    total,
    /** Total across everyone, regardless of the owner filter. */
    grandTotal: rows.length,
    owners,
  }
}
