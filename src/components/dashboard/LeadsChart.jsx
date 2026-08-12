import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { Skeleton } from '../ui/Skeleton.jsx'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-card-lg p-3 min-w-[140px]">
      <p className="text-xs font-semibold text-gray-600 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3 text-xs mb-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: p.fill }} />
            <span className="text-gray-500 capitalize">{p.name}</span>
          </span>
          <span className="font-semibold text-gray-800">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// Normalise from analyticsService (label) to chart key (month)
function normalise(rows) {
  return (rows ?? []).map((r) => ({
    ...r,
    month: r.month ?? r.label ?? '',
    new:   Number(r.new)  || 0,
    won:   Number(r.won)  || 0,
    lost:  Number(r.lost) || 0,
  }))
}

export function LeadsChart({ data = [], isLoading = false }) {
  const chartData = normalise(data).slice(-6)

  if (isLoading) {
    return (
      <div className="card p-5">
        <Skeleton className="h-4 w-32 mb-1.5" />
        <Skeleton className="h-3 w-44 mb-5" />
        <Skeleton className="h-[200px] w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="card p-5">
      <div className="mb-4">
        <h3 className="font-display font-bold text-gray-900 text-base">Lead Statistics</h3>
        <p className="text-xs text-gray-400 mt-0.5">New, won and lost leads</p>
      </div>

      {chartData.length === 0 ? (
        <div className="h-[200px] flex flex-col items-center justify-center text-center">
          <p className="text-xs text-gray-400">No lead data yet</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'DM Sans, sans-serif' }} axisLine={false} tickLine={false} dy={6} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'DM Sans, sans-serif' }} axisLine={false} tickLine={false} width={28} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 4 }} />
            <Bar dataKey="new"  name="New"  fill="#6366f1" radius={[3, 3, 0, 0]} />
            <Bar dataKey="won"  name="Won"  fill="#14b8a6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="lost" name="Lost" fill="#f87171" radius={[3, 3, 0, 0]} />
            <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 12 }} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default LeadsChart
