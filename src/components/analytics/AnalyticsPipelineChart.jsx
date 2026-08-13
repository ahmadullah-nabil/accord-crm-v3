// ─── AnalyticsPipelineChart ───────────────────────────────────────────────────
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ step057 — THREE ARITHMETIC BUGS, ALL VISIBLE ON A SCREENSHOT            │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ 1. `NaN% drop-off`, printed four times. The old line was                 │
// │       Math.round(((prev.count - stage.count) / prev.count) * 100)        │
// │    and with an empty pipeline that is 0/0. There is no drop-off between  │
// │    two empty stages — not 0%, not NaN, none. The row is omitted now.     │
// │                                                                          │
// │ 2. Bars could exceed their track. `maxCount` was `data[0]?.count || 1`,  │
// │    i.e. whatever New happened to be. New is not guaranteed to be the     │
// │    largest stage — a pipeline with New 0 and Qualified 3 gave a fallback │
// │    maxCount of 1 and a bar width of 300%. It is the max across the       │
// │    funnel stages now, floored at 1.                                      │
// │                                                                          │
// │ 3. WIN RATE 100.0% FROM ONE WON DEAL. The denominator was that same      │
// │    `data[0]?.count || 1`, so one win against an empty New column read    │
// │    1/1. Win rate is won / (won + lost) — the deals that actually         │
// │    resolved — and it is an em-dash when nothing has resolved. A rate     │
// │    with no denominator is not 100%, it is unknown, and this figure is    │
// │    the sort a founder screenshots.                                       │
// │                                                                          │
// │ THE COUNT MOVED OUT OF THE BAR. It was white text right-aligned INSIDE   │
// │ the fill, so at count 0 the fill is 0px wide and the number was clipped  │
// │ out of existence — the one value you most need when a stage is empty.    │
// │ It sits in a fixed right column in tabular figures now, where it is      │
// │ legible at every width and the column does not jitter.                   │
// │                                                                          │
// │ Stage colours still come from the service. They are data, not styling.   │
// └─────────────────────────────────────────────────────────────────────────┘

import React from 'react'
import { ChartCard } from './ChartShared.jsx'

function fmtCount(n) { return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n) }

export function AnalyticsPipelineChart({ data, isLoading, fill = false }) {
  if (isLoading || !data) {
    return (
      <ChartCard
        title="Lead Pipeline Funnel"
        subtitle="Conversion across pipeline stages"
        isLoading
        fill={fill}
        skeletonHeight={280}
      />
    )
  }

  const won  = data.find((d) => d.stage === 'Won')
  const lost = data.find((d) => d.stage === 'Lost')

  // Won and Lost are outcomes, not stages — they sit in the footer.
  const funnelStages = data.filter((d) => d.stage !== 'Won' && d.stage !== 'Lost')

  // The widest bar is the largest stage, whichever one that is. Floored at 1 so
  // an all-zero pipeline divides safely and every bar renders at width 0.
  const maxCount = Math.max(1, ...funnelStages.map((s) => s.count))

  // Resolved deals only. `null` means nothing has resolved, which prints as an
  // em-dash rather than a rate.
  const wonN  = won?.count  ?? 0
  const lostN = lost?.count ?? 0
  const resolved = wonN + lostN
  const winRate = resolved > 0 ? ((wonN / resolved) * 100).toFixed(1) : null

  return (
    <ChartCard
      title="Lead Pipeline Funnel"
      subtitle="Conversion across pipeline stages"
      isLoading={false}
      fill={fill}
    >
      <div className={fill ? 'h-full flex flex-col min-h-0' : ''}>
        <div className={`space-y-1.5 ${fill ? 'flex-1 min-h-0 overflow-y-auto' : ''}`}>
          {funnelStages.map((stage, idx) => {
            const barWidth = (stage.count / maxCount) * 100
            const prev = funnelStages[idx - 1]

            // Only when the stage above actually held something. Bug 1.
            const dropOff = prev && prev.count > 0
              ? Math.round(((prev.count - stage.count) / prev.count) * 100)
              : null

            return (
              <div key={stage.stage}>
                {dropOff !== null && (
                  <div className="flex items-center gap-2 mb-1 pl-1">
                    <div className="w-px h-2 bg-gray-200 ml-1.5" />
                    <span className="text-[10px] text-gray-400 tabular-nums">
                      ↓ {dropOff}% drop-off
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2.5">
                  <div className="w-20 shrink-0">
                    <span className="text-xs font-medium text-gray-600 truncate">
                      {stage.stage}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="w-full bg-gray-100 rounded-md h-5 overflow-hidden">
                      <div
                        className="h-full rounded-md transition-all duration-500"
                        style={{ width: `${barWidth}%`, background: stage.color }}
                      />
                    </div>
                  </div>

                  <div className="w-10 text-right shrink-0">
                    <span className="text-xs font-medium text-gray-900 tabular-nums">
                      {fmtCount(stage.count)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer: Won / Win rate / Lost */}
        <div className={`mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-3 text-center ${fill ? 'shrink-0' : ''}`}>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Won</p>
            <p className="font-medium text-gray-900 text-sm mt-0.5 tabular-nums">
              {fmtCount(wonN)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Win rate</p>
            <p className="font-medium text-gray-900 text-sm mt-0.5 tabular-nums">
              {winRate === null ? <span className="text-gray-300">—</span> : `${winRate}%`}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Lost</p>
            <p className="font-medium text-gray-900 text-sm mt-0.5 tabular-nums">
              {fmtCount(lostN)}
            </p>
          </div>
        </div>
      </div>
    </ChartCard>
  )
}

export default AnalyticsPipelineChart
