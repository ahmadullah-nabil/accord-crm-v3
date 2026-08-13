// ─── OppSummaryBar ────────────────────────────────────────────────────────────
//
// step044. Eight KPI cards → one row of chips, matching Leads and Contacts.
//
// WHAT WENT AND WHY
// ─────────────────
// The old bar was an 8-across grid of ~76px cards with shadows, hover lifts and
// uppercase micro-labels — around 100px of vertical space above a pipeline
// whose job is showing deals. Same counts, same filter behaviour, no furniture.
//
// LOST WAS UNREACHABLE. The per-stage pills did `.filter((s) => s !== 'Lost')`,
// so a stage that exists in OPPORTUNITY_STAGES, appears on every deal's badge
// and has its own colour could not be filtered to from the one row whose job is
// filtering by stage. The chip row IS the stage filter; a stage missing from it
// is a stage you cannot reach. All six are here now.
//
// EXP. REVENUE WAS A FAKE CONTROL — `active={false}` and no onClick. It was
// shaped exactly like the six filters beside it and did nothing when pressed.
// A control that cannot be operated should not look like one, so it is plain
// text now, alongside pipeline value and win rate.
//
// THE PER-STAGE MONEY SUBTOTALS are gone from the chips deliberately. A chip is
// a filter with a count on it; a second number inside it competes with the
// first and neither reads at 13px. Nothing was dropped — the money moved to the
// table's aggregate footer, the row already dedicated to totals.

import React from 'react'
import {
  useOpportunitiesStore, OPPORTUNITY_STAGES, OPP_STAGE_COLORS,
} from '../../stores/opportunitiesStore.js'
import { FacetChips } from '../ui/FacetChips.jsx'

const fmt = (n) =>
  n >= 1_000_000 ? `৳${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `৳${(n / 1_000).toFixed(0)}K`
  : `৳${n ?? 0}`

// Open = still in play. Won and Lost are settled and would flatter or drag the
// pipeline number depending on which way the quarter went.
const isOpen = (o) => !['Won', 'Lost'].includes(o.stage)

export function OppSummaryBar({ opportunities = [] }) {
  const { stageFilter, setStageFilter } = useOpportunitiesStore()

  const total       = opportunities.length
  const pipelineVal = opportunities.filter(isOpen).reduce((s, o) => s + (o.value || 0), 0)
  const expRevenue  = opportunities.filter(isOpen).reduce((s, o) => s + (o.expectedRevenue || 0), 0)
  const wonCount    = opportunities.filter((o) => o.stage === 'Won').length
  const winRate     = total > 0 ? ((wonCount / total) * 100).toFixed(1) : '0.0'

  const items = [
    { key: 'All', label: 'All', count: total },
    ...OPPORTUNITY_STAGES.map((stage) => ({
      key:      stage,
      label:    stage,
      count:    opportunities.filter((o) => o.stage === stage).length,
      // OPP_STAGE_COLORS already carries the `bg` class the old dots used and
      // the Kanban columns use. Kept as the single source of per-stage colour
      // rather than inventing a second mapping that could drift from it.
      dotClass: OPP_STAGE_COLORS[stage]?.bg,
    })),
  ]

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <FacetChips items={items} value={stageFilter} onChange={setStageFilter} />
      {total > 0 && (
        <span className="text-xs text-gray-400 flex-shrink-0">
          <span className="tnum text-gray-500 font-medium">{fmt(pipelineVal)}</span> open pipeline
          <span className="text-gray-300"> · </span>
          <span className="tnum text-gray-500 font-medium">{fmt(expRevenue)}</span> expected
          <span className="text-gray-300"> · </span>
          <span className="tnum text-gray-500 font-medium">{winRate}%</span> win rate
        </span>
      )}
    </div>
  )
}

export default OppSummaryBar
