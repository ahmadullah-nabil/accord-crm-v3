import React from 'react'
import { Layers } from 'lucide-react'
import { Skeleton } from '../ui/Skeleton.jsx'

function formatValue(v) {
  const n = Number(v) || 0
  if (n >= 1_000_000) return `৳${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `৳${(n / 1_000).toFixed(0)}K`
  return `৳${n}`
}

// analyticsService returns { stage, count, color } — no `value` field.
// We derive value from count (placeholder) and pct from count/max.
function normalise(rows) {
  if (!rows?.length) return []
  const max = rows[0]?.count || 1
  return rows.map((r) => ({
    stage: r.stage,
    count: Number(r.count) || 0,
    color: r.color ?? '#94a3b8',
    value: Number(r.value) || 0,     // 0 when not provided — shown as —
    pct:   Math.round((Number(r.count) || 0) / max * 100),
  }))
}

export function PipelineFunnel({ data = [], isLoading = false }) {
  if (isLoading) {
    return (
      <div className="card p-5">
        <Skeleton className="h-4 w-36 mb-1.5" />
        <Skeleton className="h-3 w-48 mb-5" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <Skeleton className="h-8 rounded-lg" style={{ width: `${100 - i * 14}%` }} />
          </div>
        ))}
      </div>
    )
  }

  const stages  = normalise(data)
  const topCount = stages[0]?.count ?? 0
  const botCount = stages[stages.length - 1]?.count ?? 0
  const winRate  = topCount > 0 ? ((botCount / topCount) * 100).toFixed(1) : '0.0'

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="mb-5">
        <h3 className="font-display font-bold text-gray-900 text-base">Pipeline Funnel</h3>
        <p className="text-xs text-gray-400 mt-0.5">Lead progression across stages</p>
      </div>

      {/* Empty state */}
      {stages.length === 0 && (
        <div className="py-8 text-center">
          <Layers size={24} className="text-gray-200 mx-auto mb-2" />
          <p className="text-xs text-gray-400">No lead data yet</p>
        </div>
      )}

      {/* Funnel bars */}
      {stages.length > 0 && (
        <div className="space-y-2.5">
          {stages.map((stage, idx) => {
            const barWidth = topCount > 0 ? (stage.count / topCount) * 100 : 0
            const prevCount = idx > 0 ? stages[idx - 1].count : stage.count
            const dropOff  = idx > 0 && prevCount > 0
              ? Math.round(((prevCount - stage.count) / prevCount) * 100)
              : 0

            return (
              <div key={stage.stage} className="group">
                {idx > 0 && (
                  <div className="flex items-center gap-2 mb-1.5 pl-1">
                    <div className="w-px h-3 bg-gray-200 ml-1" />
                    <span className="text-[10px] text-gray-400 font-medium">↓ {dropOff}% drop-off</span>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="w-24 flex-shrink-0">
                    <span className="text-xs font-semibold text-gray-700">{stage.stage}</span>
                  </div>

                  <div className="flex-1 relative">
                    <div className="w-full bg-gray-100 rounded-lg h-9 overflow-hidden">
                      <div
                        className="h-full rounded-lg flex items-center justify-end pr-2.5 transition-all duration-700"
                        style={{
                          width: `${Math.max(barWidth, stage.count > 0 ? 8 : 0)}%`,
                          background: stage.color,
                          opacity: 0.85 + (idx * 0.02),
                        }}
                      >
                        {stage.count > 0 && (
                          <span className="text-[11px] font-bold text-white whitespace-nowrap">
                            {stage.count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="w-10 text-right flex-shrink-0">
                    <span className="text-xs font-semibold text-gray-500">{stage.count}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Summary footer */}
      {stages.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
          <div className="text-center">
            <p className="text-xs text-gray-400">Total Leads</p>
            <p className="font-bold text-gray-900 text-sm mt-0.5">{topCount.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Win Rate</p>
            <p className="font-bold text-teal-600 text-sm mt-0.5">{winRate}%</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default PipelineFunnel
