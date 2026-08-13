// ─── LeadsSummaryBar ──────────────────────────────────────────────────────────
//
// step041. Seven KPI cards → one row of chips, matching Contacts.
//
// WHAT WENT AND WHY
// ─────────────────
// The old bar was a 7-across grid of ~72px cards with shadows, hover lifts and
// uppercase micro-labels — roughly 100px of vertical space above a table whose
// job is showing rows. Same counts, same filter behaviour, no furniture.
//
// The per-stage MONEY SUBTOTALS are gone from the chips deliberately. A chip is
// a filter with a count on it; a second number inside it competes with the
// first and neither reads cleanly at 13px. Total pipeline value has not been
// dropped — it moved to the table's aggregate footer, which is the row already
// dedicated to totals, and where it sits next to the row count it belongs with.
//
// WIN RATE was a pill that was never clickable — `active={false}` and no
// onClick. It looked exactly like the six filters beside it and did nothing
// when pressed. A control that cannot be operated should not be shaped like
// one, so it is now plain text next to the chips.
//
// Won and Lost were excluded from the old per-stage pills, so filtering to
// either was impossible from here even though both are real stages. They are
// included now: the chip row is the stage filter, and a stage missing from it
// is a stage you cannot reach.

import React from 'react'
import { useLeadsStore, STAGES, STAGE_COLORS } from '../../stores/leadsStore.js'
import { FacetChips } from '../ui/FacetChips.jsx'

export function LeadsSummaryBar() {
  const { leads, stageFilter, setStageFilter } = useLeadsStore()

  const total     = leads.length
  const wonCount  = leads.filter((l) => l.stage === 'Won').length
  const winRate   = total > 0 ? ((wonCount / total) * 100).toFixed(1) : '0.0'

  const items = [
    { key: 'All', label: 'All', count: total },
    ...STAGES.map((stage) => ({
      key:      stage,
      label:    stage,
      count:    leads.filter((l) => l.stage === stage).length,
      // STAGE_COLORS entries carry a `bg` class already used for the old dots.
      // Kept as the single source of per-stage colour rather than inventing a
      // second mapping that could drift from the Kanban's.
      dotClass: STAGE_COLORS[stage]?.bg,
    })),
  ]

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <FacetChips items={items} value={stageFilter} onChange={setStageFilter} />
      {total > 0 && (
        <span className="text-xs text-gray-400 flex-shrink-0">
          <span className="tnum text-gray-500 font-medium">{winRate}%</span> win rate
          <span className="text-gray-300"> · {wonCount} won</span>
        </span>
      )}
    </div>
  )
}

export default LeadsSummaryBar
