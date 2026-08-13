// ─── AnalyticsRevenueChart ────────────────────────────────────────────────────
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ step057 — THE 280px NUMBER GOES, AND SO DO THE GRADIENTS                │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ HEIGHT. `height={280}` was the reason Overview could not fit a screen —  │
// │ a number measured once against somebody's window. It is `height="100%"`  │
// │ inside a `fill` ChartCard now, so the chart is however tall the page has │
// │ room for. This is the step055 lesson applied one level down: when a      │
// │ number has to be tuned, remove the number.                               │
// │                                                                          │
// │ COLOUR. `#14b8a6` and `#6366f1` were hardcoded, so this chart was the    │
// │ one surface in the app that ignored the user's accent preference and     │
// │ stayed teal after they picked blue. Revenue is the accent variable;      │
// │ target is a neutral, because a target is a reference line and not a      │
// │ second story competing for the eye.                                      │
// │                                                                          │
// │ TWO GRADIENT FILLS became one flat 8%-opacity wash under the revenue     │
// │ line and nothing at all under the target. A dashed reference line does   │
// │ not need an area — the area under a target is not a quantity of          │
// │ anything, and shading it implied it was.                                 │
// │                                                                          │
// │ AREACHART BECAME COMPOSEDCHART. `AreaChart` declares Area as its only    │
// │ graphical child; a `<Line>` handed to it is silently dropped, so the     │
// │ target would simply not have drawn. Mixing two item types is what        │
// │ ComposedChart is for. Nothing else about the plot changed.               │
// │                                                                          │
// │ THE RECHARTS LEGEND is gone from the plot and rebuilt as two swatches    │
// │ in ChartCard's `action` slot. Same information, on a line the card was   │
// │ already drawing, instead of ~30px of chart height plus its own padding.  │
// └─────────────────────────────────────────────────────────────────────────┘

import React from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  ChartCard, ChartTooltip,
  AXIS_TICK_STYLE, CHART_MARGIN, CHART_GRID_STROKE, CHART_ACCENT, CHART_MUTED,
} from './ChartShared.jsx'
import { fmtCurrency } from '../../lib/analyticsData.js'

function LegendSwatch({ color, label, dashed = false }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
      <span
        className="w-3 h-px shrink-0"
        style={{
          background: dashed ? 'none' : color,
          borderTop: dashed ? `1px dashed ${color}` : 'none',
        }}
      />
      {label}
    </span>
  )
}

export function AnalyticsRevenueChart({ data, isLoading, fill = false }) {
  return (
    <ChartCard
      title="Revenue vs Target"
      subtitle="Revenue performance against monthly targets"
      isLoading={isLoading}
      fill={fill}
      skeletonHeight={280}
      action={
        <div className="flex items-center gap-3">
          <LegendSwatch color={CHART_MUTED}  label="Target" dashed />
          <LegendSwatch color={CHART_ACCENT} label="Revenue" />
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={fill ? '100%' : 280}>
        <ComposedChart data={data} margin={CHART_MARGIN}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} dy={8} />
          <YAxis
            tickFormatter={(v) => fmtCurrency(v)}
            tick={AXIS_TICK_STYLE}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            content={<ChartTooltip formatter={(v) => fmtCurrency(v)} />}
            cursor={{ stroke: CHART_GRID_STROKE, strokeWidth: 1 }}
          />

          {/* Target is a reference, so it is a LINE with no fill. */}
          <Line
            type="monotone"
            dataKey="target"
            name="Target"
            stroke={CHART_MUTED}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 3, fill: CHART_MUTED, strokeWidth: 0 }}
          />

          <Area
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke={CHART_ACCENT}
            strokeWidth={2}
            fill={CHART_ACCENT}
            fillOpacity={0.08}
            dot={false}
            activeDot={{ r: 4, fill: CHART_ACCENT, stroke: '#fff', strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export default AnalyticsRevenueChart
