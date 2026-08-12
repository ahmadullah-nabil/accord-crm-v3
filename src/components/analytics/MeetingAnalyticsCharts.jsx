import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { ChartCard, ChartTooltip, StatRow, AXIS_TICK_STYLE } from './ChartShared.jsx'

// ── Meeting Status Donut ──────────────────────────────────────────────────────
export function MeetingStatusChart({ data, isLoading }) {
  if (isLoading || !data) {
    return (
      <ChartCard title="Meeting Status" subtitle="Breakdown by outcome" isLoading skeletonHeight={200} />
    )
  }

  const total = data.byStatus.reduce((s, d) => s + d.value, 0)

  return (
    <ChartCard
      title="Meeting Status"
      subtitle="Breakdown by outcome"
      isLoading={false}
    >
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          <ResponsiveContainer width={130} height={130}>
            <PieChart>
              <Pie
                data={data.byStatus}
                cx="50%"
                cy="50%"
                innerRadius={38}
                outerRadius={60}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {data.byStatus.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-white border border-gray-100 rounded-xl shadow-card-lg p-2.5 text-xs">
                      <p className="font-semibold text-gray-700">{d.name}</p>
                      <p className="text-gray-500 mt-0.5">{d.value} · {Math.round(d.value / total * 100)}%</p>
                    </div>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 space-y-2.5">
          {data.byStatus.map((d) => (
            <StatRow
              key={d.name}
              label={d.name}
              value={d.value}
              pct={Math.round(d.value / total * 100)}
              color={d.color}
            />
          ))}
          <div className="pt-2 mt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-center">
            <div>
              <p className="text-[10px] text-gray-400">Total</p>
              <p className="text-sm font-bold text-gray-900">{data.totalMeetings}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Avg Duration</p>
              <p className="text-sm font-bold text-gray-900">{data.avgDurationMins}m</p>
            </div>
          </div>
        </div>
      </div>
    </ChartCard>
  )
}

// ── Meeting Types Horizontal Bar ──────────────────────────────────────────────
export function MeetingTypeChart({ data, isLoading }) {
  if (isLoading || !data) {
    return (
      <ChartCard title="Meeting Types" subtitle="Count by meeting category" isLoading skeletonHeight={220} />
    )
  }

  const sorted = [...data.byType].sort((a, b) => b.count - a.count)
  const max = sorted[0]?.count || 1

  return (
    <ChartCard
      title="Meeting Types"
      subtitle="Count by meeting category"
      isLoading={false}
    >
      <div className="space-y-2.5">
        {sorted.map((d) => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="text-xs text-gray-600 w-28 flex-shrink-0 truncate">{d.label}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
              <div
                className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-700"
                style={{ width: `${(d.count / max) * 100}%`, background: d.color }}
              >
                <span className="text-[10px] font-bold text-white">{d.count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}
