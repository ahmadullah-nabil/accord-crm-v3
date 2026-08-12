import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import { ChartCard, ChartTooltip, StatRow, AXIS_TICK_STYLE, CHART_MARGIN } from './ChartShared.jsx'

// ── Lead Stats Bar Chart ──────────────────────────────────────────────────────
export function LeadStatsChart({ data, isLoading }) {
  return (
    <ChartCard
      title="Lead Activity"
      subtitle="New, won and lost leads over time"
      isLoading={isLoading}
      skeletonHeight={220}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={CHART_MARGIN} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} dy={6} />
          <YAxis tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} width={28} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc', radius: 4 }} />
          <Bar dataKey="new"  name="New"  fill="#6366f1" radius={[3, 3, 0, 0]} />
          <Bar dataKey="won"  name="Won"  fill="#14b8a6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="lost" name="Lost" fill="#f87171" radius={[3, 3, 0, 0]} />
          <Legend
            iconType="square"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 12 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ── Lead Source Donut Chart ───────────────────────────────────────────────────
export function LeadSourceChart({ data, isLoading }) {
  if (isLoading || !data) {
    return (
      <ChartCard title="Lead Sources" subtitle="Distribution by acquisition channel" isLoading skeletonHeight={220} />
    )
  }

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <ChartCard
      title="Lead Sources"
      subtitle="Distribution by acquisition channel"
      isLoading={false}
    >
      <div className="flex items-center gap-4">
        {/* Donut */}
        <div className="flex-shrink-0">
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={44}
                outerRadius={66}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-white border border-gray-100 rounded-xl shadow-card-lg p-2.5 text-xs">
                      <p className="font-semibold text-gray-700">{d.name}</p>
                      <p className="text-gray-500 mt-0.5">{d.value} leads · {Math.round(d.value / total * 100)}%</p>
                    </div>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend + bars */}
        <div className="flex-1 space-y-2.5">
          {data.map((d) => (
            <StatRow
              key={d.name}
              label={d.name}
              value={d.value}
              pct={Math.round(d.value / total * 100)}
              color={d.color}
            />
          ))}
        </div>
      </div>
    </ChartCard>
  )
}
