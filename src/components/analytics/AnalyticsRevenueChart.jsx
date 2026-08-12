import React from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { ChartCard, ChartTooltip, AXIS_TICK_STYLE, CHART_MARGIN } from './ChartShared.jsx'
import { fmtCurrency } from '../../lib/analyticsData.js'

export function AnalyticsRevenueChart({ data, isLoading }) {
  return (
    <ChartCard
      title="Revenue vs Target"
      subtitle="Revenue performance against monthly targets"
      isLoading={isLoading}
      skeletonHeight={280}
    >
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={CHART_MARGIN}>
          <defs>
            <linearGradient id="ar-gradRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#14b8a6" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="ar-gradTarget" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} dy={8} />
          <YAxis
            tickFormatter={(v) => fmtCurrency(v)}
            tick={AXIS_TICK_STYLE}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            content={<ChartTooltip formatter={(v) => fmtCurrency(v)} />}
            cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="target"
            name="Target"
            stroke="#6366f1"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            fill="url(#ar-gradTarget)"
            dot={false}
            activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="#14b8a6"
            strokeWidth={2}
            fill="url(#ar-gradRevenue)"
            dot={false}
            activeDot={{ r: 5, fill: '#14b8a6', stroke: '#fff', strokeWidth: 2 }}
          />
          <Legend
            iconType="plainline"
            iconSize={16}
            wrapperStyle={{ fontSize: 12, color: '#64748b', paddingTop: 16 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
