import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { ChartCard, ChartTooltip, StatRow, AXIS_TICK_STYLE, CHART_MARGIN } from './ChartShared.jsx'

// ── Task Completion Trend ─────────────────────────────────────────────────────
export function TaskCompletionTrendChart({ data, isLoading }) {
  const chartData = (data?.completionTrend || []).map((d) => ({
    ...d,
    pending: d.total - d.completed,
    rate:    Math.round((d.completed / d.total) * 100),
  }))

  return (
    <ChartCard
      title="Task Completion Trend"
      subtitle="Completed vs total tasks per week"
      isLoading={isLoading}
      skeletonHeight={200}
    >
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={CHART_MARGIN} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} dy={6} />
          <YAxis tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} width={24} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc', radius: 4 }} />
          <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[3, 3, 0, 0]} stackId="a" />
          <Bar dataKey="pending"   name="Pending"   fill="#e2e8f0" radius={[3, 3, 0, 0]} stackId="a" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ── Task Status + Priority Split ──────────────────────────────────────────────
export function TaskBreakdownChart({ data, isLoading }) {
  if (isLoading || !data) {
    return (
      <ChartCard title="Task Breakdown" subtitle="Status and priority distribution" isLoading skeletonHeight={200} />
    )
  }

  const statusTotal   = data.byStatus.reduce((s, d) => s + d.value, 0)
  const priorityTotal = data.byPriority.reduce((s, d) => s + d.value, 0)

  return (
    <ChartCard
      title="Task Breakdown"
      subtitle="Status and priority distribution"
      isLoading={false}
    >
      <div className="grid grid-cols-2 gap-6">
        {/* Status donut */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">By Status</p>
          <div className="flex flex-col items-center">
            <ResponsiveContainer width={100} height={100}>
              <PieChart>
                <Pie
                  data={data.byStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={46}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {data.byStatus.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full mt-3 space-y-1.5">
              {data.byStatus.map((d) => (
                <StatRow
                  key={d.name}
                  label={d.name}
                  value={d.value}
                  pct={Math.round(d.value / statusTotal * 100)}
                  color={d.color}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Priority donut */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">By Priority</p>
          <div className="flex flex-col items-center">
            <ResponsiveContainer width={100} height={100}>
              <PieChart>
                <Pie
                  data={data.byPriority}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={46}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {data.byPriority.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full mt-3 space-y-1.5">
              {data.byPriority.map((d) => (
                <StatRow
                  key={d.name}
                  label={d.name}
                  value={d.value}
                  pct={Math.round(d.value / priorityTotal * 100)}
                  color={d.color}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer stats */}
      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total</p>
          <p className="font-bold text-gray-900 text-sm mt-0.5">{data.totalTasks}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Completion</p>
          <p className="font-bold text-emerald-600 text-sm mt-0.5">{data.completionRate}%</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Overdue</p>
          <p className="font-bold text-red-500 text-sm mt-0.5">{data.overdueCount}</p>
        </div>
      </div>
    </ChartCard>
  )
}
