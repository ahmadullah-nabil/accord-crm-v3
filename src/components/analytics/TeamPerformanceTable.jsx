import React from 'react'
import { ChartCard }  from './ChartShared.jsx'
import { Avatar }     from '../ui/Avatar.jsx'
import { fmtCurrency } from '../../lib/analyticsData.js'

export function TeamPerformanceTable({ data, isLoading }) {
  return (
    <ChartCard
      title="Team Performance"
      subtitle="Rep activity and revenue contribution"
      isLoading={isLoading}
      skeletonHeight={220}
    >
      <div className="space-y-3">
        {(data || []).map((rep, idx) => (
          <RepRow key={rep.name} rep={rep} rank={idx + 1} />
        ))}
      </div>
    </ChartCard>
  )
}

function RepRow({ rep, rank }) {
  const quotaColor =
    rep.quota >= 90 ? '#10b981' :
    rep.quota >= 75 ? '#14b8a6' :
    rep.quota >= 60 ? '#f59e0b' :
                      '#f87171'

  return (
    <div className="flex items-center gap-3 group">
      {/* Rank */}
      <span className={`w-5 text-center text-xs font-bold flex-shrink-0
        ${rank === 1 ? 'text-amber-500' : rank === 2 ? 'text-gray-400' : rank === 3 ? 'text-orange-400' : 'text-gray-300'}`}>
        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`}
      </span>

      {/* Avatar + name */}
      <Avatar name={rep.name} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 leading-tight">{rep.name}</p>
        <div className="flex items-center gap-3 mt-1">
          {/* Quota bar */}
          <div className="flex-1 max-w-[100px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${rep.quota}%`, background: quotaColor }}
            />
          </div>
          <span className="text-[10px] font-medium" style={{ color: quotaColor }}>
            {rep.quota}% quota
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 flex-shrink-0 text-right">
        <div>
          <p className="text-xs font-bold text-gray-900">{rep.deals}</p>
          <p className="text-[10px] text-gray-400">deals</p>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-900">{fmtCurrency(rep.revenue)}</p>
          <p className="text-[10px] text-gray-400">revenue</p>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-900">{rep.meetings}</p>
          <p className="text-[10px] text-gray-400">meetings</p>
        </div>
      </div>
    </div>
  )
}
