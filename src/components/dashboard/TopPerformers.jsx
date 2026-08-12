import React from 'react'
import { Trophy, Users } from 'lucide-react'
import { Avatar }   from '../ui/Avatar.jsx'
import { Badge }    from '../ui/Badge.jsx'
import { Skeleton } from '../ui/Skeleton.jsx'

function QuotaBar({ value, color = '#14b8a6' }) {
  const safeVal = Math.min(100, Math.max(0, Number(value) || 0))
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${safeVal}%`, background: color }}
        />
      </div>
      <span className="text-[11px] font-semibold text-gray-600 w-8 text-right">{safeVal}%</span>
    </div>
  )
}

const QUOTA_COLORS = ['#14b8a6', '#3b82f6', '#8b5cf6', '#f59e0b', '#f97316']
const RANK_MEDALS  = ['🥇', '🥈', '🥉']

function fmtRevenue(v) {
  const n = Number(v) || 0
  if (n >= 1_000_000) return `৳${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `৳${(n / 1_000).toFixed(0)}K`
  return `৳${n}`
}

export function TopPerformers({ data = [], isLoading = false }) {
  if (isLoading) {
    return (
      <div className="card p-5">
        <Skeleton className="h-4 w-32 mb-1.5" />
        <Skeleton className="h-3 w-44 mb-5" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 mb-4">
            <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-2.5 w-full rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-12" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-display font-bold text-gray-900 text-base">Top Performers</h3>
          <p className="text-xs text-gray-400 mt-0.5">Revenue closed · last 30 days</p>
        </div>
        <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
          <Trophy size={15} className="text-amber-500" />
        </div>
      </div>

      {/* Empty state */}
      {data.length === 0 && (
        <div className="text-center py-6">
          <Users size={24} className="text-gray-200 mx-auto mb-2" />
          <p className="text-xs text-gray-400">No performance data yet</p>
          <p className="text-[11px] text-gray-300 mt-0.5">
            Data appears as won opportunities are recorded
          </p>
        </div>
      )}

      {/* Performers list — real data from public.profiles + opportunities */}
      <div className="space-y-4">
        {data.slice(0, 5).map((p, idx) => (
          <div key={p.name ?? idx} className="group">
            <div className="flex items-center gap-3 mb-1.5">
              {/* Rank + avatar */}
              <div className="relative flex-shrink-0">
                <Avatar name={p.name} size="sm" />
                {idx < 3 && (
                  <span className="absolute -top-1 -right-1 text-[10px] leading-none">
                    {RANK_MEDALS[idx]}
                  </span>
                )}
              </div>

              {/* Name + stats */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-800 truncate">
                    {p.name || 'Unknown'}
                  </span>
                  <span className="text-xs font-semibold text-gray-700">
                    {fmtRevenue(p.revenue)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {p.role && (
                    <Badge variant={p.role} className="text-[10px] px-1.5 py-0">{p.role}</Badge>
                  )}
                  <span className="text-[10px] text-gray-400">{p.deals ?? 0} deals</span>
                </div>
              </div>
            </div>

            {/* Quota / win-rate bar */}
            <div className="pl-11">
              <QuotaBar
                value={p.quota ?? 0}
                color={QUOTA_COLORS[idx % QUOTA_COLORS.length]}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TopPerformers
