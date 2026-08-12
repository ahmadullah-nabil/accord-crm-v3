import React from 'react'
import { Skeleton } from '../ui/Skeleton.jsx'

// ── Reusable chart tooltip ────────────────────────────────────────────────────
export function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-card-lg p-3 min-w-[150px]">
      {label && <p className="text-xs font-semibold text-gray-600 mb-2">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-xs mb-1 last:mb-0">
          <span className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: p.color || p.fill }}
            />
            <span className="text-gray-500 capitalize">{p.name}</span>
          </span>
          <span className="font-semibold text-gray-800">
            {formatter ? formatter(p.value, p.name) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Chart card wrapper ────────────────────────────────────────────────────────
export function ChartCard({ title, subtitle, children, isLoading, skeletonHeight = 240, action, className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="flex items-start justify-between mb-5 flex-wrap gap-2">
        <div>
          <h3 className="font-display font-bold text-gray-900 text-base leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {isLoading
        ? <Skeleton className={`w-full rounded-xl`} style={{ height: skeletonHeight }} />
        : children
      }
    </div>
  )
}

// ── Stat row inside a chart card ──────────────────────────────────────────────
export function StatRow({ label, value, pct, color }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-600 font-medium truncate">{label}</span>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <span className="text-xs font-bold text-gray-900">{value}</span>
            {pct !== undefined && (
              <span className="text-[10px] text-gray-400">{pct}%</span>
            )}
          </div>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Axis tick style shared across charts ──────────────────────────────────────
export const AXIS_TICK_STYLE = {
  fontSize: 11,
  fill: '#94a3b8',
  fontFamily: 'DM Sans, sans-serif',
}

// ── Shared chart margins ──────────────────────────────────────────────────────
export const CHART_MARGIN = { top: 4, right: 4, bottom: 0, left: 0 }
