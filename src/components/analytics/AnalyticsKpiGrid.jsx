// ─── AnalyticsKpiGrid ─────────────────────────────────────────────────────────
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ step057 — EIGHT TILES AT 150px BECOME EIGHT FIGURES AT 46px             │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ This grid was ~330px of the Overview section — more than the chart       │
// │ underneath it — and every pixel above the number was decoration:         │
// │                                                                          │
// │   · a 40px pastel icon chip that hover-scaled. A dollar sign next to     │
// │     "Total Revenue" tells a reader nothing the word does not.            │
// │   · a TrendBadge. EVERY `trend` getKpiSummary returns is hardcoded 0 —   │
// │     verified in analyticsService.js, all eight of them. Eight badges     │
// │     reading "— 0%" is not a neutral signal, it is a claim that nothing   │
// │     moved, made by a service that never measured.                        │
// │   · "vs previous period" under each one, describing a comparison that    │
// │     is not being made.                                                   │
// │   · an accent bar whose width was `Math.min(100, |trend| * 4 + 40)`.     │
// │     With trend always 0 that is always exactly 40%. Eight bars, all the  │
// │     same length, encoding nothing.                                       │
// │                                                                          │
// │ WHAT REPLACES IT is the Dashboard's figure strip, deliberately to the    │
// │ pixel: `rounded-xl border px-3 py-1.5`, a 10px uppercase label, a        │
// │ tabular-figure value. The two pages state figures in one voice now.      │
// │                                                                          │
// │ WHEN THE SERVICE LEARNS TO MEASURE, bring TrendBadge back — it is a      │
// │ good component and it is still imported by the dashboard components      │
// │ that are unmounted but not deleted. The rule is the one from handover    │
// │ #4: an arrow is data or it is nothing. Do not restore it as decoration.  │
// │                                                                          │
// │ EIGHT ACROSS ONLY AT 2xl. At 1536px+ the eight sit on one 46px line. On  │
// │ a 1280 laptop "Conversion Rate" would not fit a 131px tile, so it falls  │
// │ back to 4 × 2, which is still under a third of what it was.              │
// └─────────────────────────────────────────────────────────────────────────┘

import React from 'react'
import { Skeleton } from '../ui/Skeleton.jsx'
import { fmtCurrency, fmtNum } from '../../lib/analyticsData.js'

// Order is the reading order: money first, then counts, then rates. The keys
// are exactly what getKpiSummary returns — a key that is not in the payload
// renders nothing rather than a zero it did not measure.
const FIGURES = [
  { key: 'pipelineValue',      label: 'Pipeline value',  format: 'currency' },
  { key: 'totalRevenue',       label: 'Total revenue',   format: 'currency' },
  { key: 'avgDealSize',        label: 'Avg deal size',   format: 'currency' },
  { key: 'dealsWon',           label: 'Deals won',       format: 'num'      },
  { key: 'activeLeads',        label: 'Active leads',    format: 'num'      },
  { key: 'meetingsConducted',  label: 'Meetings held',   format: 'num'      },
  { key: 'conversionRate',     label: 'Conversion',      format: 'pct'      },
  { key: 'taskCompletionRate', label: 'Task completion', format: 'pct'      },
]

const GRID = 'grid grid-cols-2 sm:grid-cols-4 2xl:grid-cols-8 gap-2'

function formatVal(val, format) {
  if (format === 'currency') return fmtCurrency(val)
  if (format === 'pct')      return `${val}%`
  return fmtNum(val)
}

export function AnalyticsKpiGrid({ data, isLoading }) {
  if (isLoading || !data) {
    return (
      <div className={GRID}>
        {Array.from({ length: FIGURES.length }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white px-3 py-1.5">
            <Skeleton className="h-2.5 w-20 mb-1.5" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={GRID}>
      {FIGURES.map((f) => {
        const entry = data[f.key]
        if (!entry) return null
        return (
          <div key={f.key} className="rounded-xl border border-gray-200 bg-white px-3 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 leading-none truncate">
              {f.label}
            </p>
            <p className="font-display font-semibold text-gray-900 text-base leading-snug tabular-nums">
              {formatVal(entry.value, f.format)}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export default AnalyticsKpiGrid
