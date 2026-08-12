import React from 'react'
import { ChartCard } from './ChartShared.jsx'
import { Skeleton }  from '../ui/Skeleton.jsx'

function fmtCount(n) { return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n) }

export function AnalyticsPipelineChart({ data, isLoading }) {
  if (isLoading || !data) {
    return (
      <ChartCard title="Lead Pipeline Funnel" subtitle="Conversion across pipeline stages" isLoading skeletonHeight={280} />
    )
  }

  const maxCount = data[0]?.count || 1
  const won  = data.find((d) => d.stage === 'Won')
  const lost = data.find((d) => d.stage === 'Lost')
  const total = data[0]?.count || 1
  const winRate  = won  ? ((won.count  / total) * 100).toFixed(1) : '0'
  const lossRate = lost ? ((lost.count / total) * 100).toFixed(1) : '0'

  // Exclude Won/Lost from funnel bars — show them in footer
  const funnelStages = data.filter((d) => d.stage !== 'Won' && d.stage !== 'Lost')

  return (
    <ChartCard
      title="Lead Pipeline Funnel"
      subtitle="Conversion across pipeline stages"
      isLoading={false}
    >
      <div className="space-y-2">
        {funnelStages.map((stage, idx) => {
          const barWidth = (stage.count / maxCount) * 100
          const prev = funnelStages[idx - 1]
          const dropOff = prev
            ? Math.round(((prev.count - stage.count) / prev.count) * 100)
            : 0

          return (
            <div key={stage.stage}>
              {idx > 0 && (
                <div className="flex items-center gap-2 mb-1.5 pl-1">
                  <div className="w-px h-2.5 bg-gray-200 ml-1.5" />
                  <span className="text-[10px] text-gray-400 font-medium">↓ {dropOff}% drop-off</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="w-24 flex-shrink-0">
                  <span className="text-xs font-semibold text-gray-700">{stage.stage}</span>
                </div>
                <div className="flex-1 relative">
                  <div className="w-full bg-gray-100 rounded-lg h-8 overflow-hidden">
                    <div
                      className="h-full rounded-lg flex items-center justify-end pr-2.5 transition-all duration-700"
                      style={{ width: `${barWidth}%`, background: stage.color }}
                    >
                      <span className="text-[11px] font-bold text-white whitespace-nowrap">
                        {fmtCount(stage.count)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="w-14 text-right flex-shrink-0">
                  <span className="text-[10px] font-medium text-gray-400">
                    {Math.round((stage.count / maxCount) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer: Won / Lost / Win Rate */}
      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Won</p>
          <p className="font-bold text-emerald-600 text-sm mt-0.5">
            {won ? fmtCount(won.count) : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Win Rate</p>
          <p className="font-bold text-teal-600 text-sm mt-0.5">{winRate}%</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Lost</p>
          <p className="font-bold text-red-500 text-sm mt-0.5">
            {lost ? fmtCount(lost.count) : '—'}
          </p>
        </div>
      </div>
    </ChartCard>
  )
}
