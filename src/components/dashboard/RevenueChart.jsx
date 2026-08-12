import React, { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { Skeleton } from '../ui/Skeleton.jsx'

const RANGES = ['6M', '9M', '12M']

function formatCurrency(v) {
  const n = Number(v) || 0
  if (n >= 1_000_000) return `৳${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `৳${(n / 1_000).toFixed(0)}K`
  return `৳${n}`
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-card-lg p-3 min-w-[160px]">
      <p className="text-xs font-semibold text-gray-600 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs mb-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="text-gray-500 capitalize">{p.name}</span>
          </span>
          <span className="font-semibold text-gray-800">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// Normalise rows from analyticsService (uses 'label') to the chart key 'month'
function normalise(rows) {
  return (rows ?? []).map((r) => ({
    ...r,
    month:   r.month   ?? r.label ?? '',
    revenue: Number(r.revenue) || 0,
    target:  Number(r.target)  || 0,
    deals:   Number(r.deals)   || 0,
  }))
}

export function RevenueChart({ data = [], isLoading = false }) {
  const [range, setRange] = useState('12M')

  const sliceMap = { '6M': 6, '9M': 9, '12M': 12 }
  const normalised = normalise(data)
  const chartData  = normalised.length > 0
    ? normalised.slice(-sliceMap[range])
    : []

  if (isLoading) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></div>
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        <Skeleton className="h-[260px] w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="font-display font-bold text-gray-900 text-base">Revenue Overview</h3>
          <p className="text-xs text-gray-400 mt-0.5">Won deals revenue vs target</p>
        </div>

        {/* Range selector */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                range === r
                  ? 'bg-white text-gray-900 shadow-card'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {chartData.length === 0 && (
        <div className="h-[260px] flex flex-col items-center justify-center text-center">
          <p className="text-sm text-gray-400">No revenue data yet</p>
          <p className="text-xs text-gray-300 mt-1">Appears as opportunities are won</p>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#14b8a6" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="gradTarget" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'DM Sans, sans-serif' }}
              axisLine={false} tickLine={false} dy={8}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'DM Sans, sans-serif' }}
              axisLine={false} tickLine={false} width={52}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />

            <Area
              type="monotone" dataKey="target" name="Target"
              stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 2"
              fill="url(#gradTarget)" dot={false}
              activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
            />
            <Area
              type="monotone" dataKey="revenue" name="Revenue"
              stroke="#14b8a6" strokeWidth={2}
              fill="url(#gradRevenue)" dot={false}
              activeDot={{ r: 5, fill: '#14b8a6', stroke: '#fff', strokeWidth: 2 }}
            />

            <Legend
              iconType="plainline" iconSize={16}
              wrapperStyle={{ fontSize: 12, color: '#64748b', paddingTop: 16 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default RevenueChart
