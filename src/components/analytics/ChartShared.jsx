// ─── ChartShared ──────────────────────────────────────────────────────────────
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ step057 — THE ONE FILE THAT THEMES ALL NINE CHARTS                      │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Every analytics chart draws itself inside `ChartCard` and reads its axis │
// │ style from `AXIS_TICK_STYLE`. Both live here, so editing this file       │
// │ re-themes the card chrome and the axes of all nine charts without        │
// │ touching them.                                                           │
// │                                                                          │
// │ IT DOES NOT REACH EVERY TOOLTIP, and the grep proved it.                 │
// │ `LeadAnalyticsCharts.jsx` and `MeetingAnalyticsCharts.jsx` each carry a  │
// │ PRIVATE COPY of the tooltip markup instead of importing `ChartTooltip` — │
// │ both still `rounded-xl shadow-card-lg`. They are untouched here on       │
// │ purpose (step058); do not assume this file is the only place a tooltip   │
// │ is styled.                                                               │
// │                                                                          │
// │ TWO REAL BUGS FIXED, not restyling:                                      │
// │                                                                          │
// │ 1. `AXIS_TICK_STYLE.fontFamily` still named DM Sans. step033 removed DM  │
// │    Sans from tailwind.config.js and moved the app to Inter / Inter       │
// │    Tight. The font was never loaded, so every axis on every chart has    │
// │    been rendering in the browser's fallback sans since step033 — the     │
// │    one place in the app not using the app's typeface.                    │
// │                                                                          │
// │ 2. `fill: '#94a3b8'` is a FIXED HEX on a themed ramp. The neutral ramp   │
// │    inverts wholesale in dark mode (handover #4, invariant 3), so the     │
// │    axes stayed mid-slate on a dark card while every other label in the   │
// │    app flipped. `rgb(var(--c-gray-400))` is the same colour in light     │
// │    mode and follows the theme in dark.                                   │
// │                                                                          │
// │ WHY A CSS VARIABLE AND NOT A TAILWIND CLASS. Recharts writes these into  │
// │ SVG presentation attributes, not className, so a utility class cannot    │
// │ reach them. The variable is the only way a chart tick participates in    │
// │ theming at all. Same reason the accent colours below are variables:      │
// │ `#14b8a6` ignored the user's accent preference entirely.                 │
// │                                                                          │
// │ CHARTCARD GAINED `fill`. Default OFF, so every existing call site is     │
// │ unchanged and keeps its own height. A card in `fill` mode is a flex      │
// │ column that takes the height its parent gives it and lets the chart body │
// │ absorb what is left — the step055 pattern, one region flexes and the     │
// │ chrome is `shrink-0`. This is what lets Analytics fit a viewport without │
// │ anyone picking a number.                                                 │
// └─────────────────────────────────────────────────────────────────────────┘

import React from 'react'
import { Skeleton } from '../ui/Skeleton.jsx'

// ── Reusable chart tooltip ────────────────────────────────────────────────────
// Flattened: `rounded-xl shadow-card-lg` was the only floating-panel elevation
// left in the analytics surface. A hairline border and a small radius is the
// same language as the cards it floats over.
export function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-md shadow-sm px-2.5 py-2 min-w-[140px]">
      {label && (
        <p className="text-[11px] font-medium text-gray-500 mb-1.5">{label}</p>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-xs mb-0.5 last:mb-0">
          <span className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: p.color || p.fill }}
            />
            <span className="text-gray-500 capitalize">{p.name}</span>
          </span>
          <span className="font-medium text-gray-900 tabular-nums">
            {formatter ? formatter(p.value, p.name) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Chart card wrapper ────────────────────────────────────────────────────────
//
// `fill` is opt-in. Without it this renders exactly as it did before — the five
// chart files not in this batch keep their fixed heights and are unaffected.
//
// With it: `h-full flex flex-col min-h-0`, header `shrink-0`, body `flex-1
// min-h-0`. A chart inside then asks for `height="100%"` and gets the height
// that is left rather than a number somebody measured once.
export function ChartCard({
  title, subtitle, children, isLoading,
  skeletonHeight = 240, action, fill = false, className = '',
}) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-3
        ${fill ? 'h-full flex flex-col min-h-0' : ''} ${className}`}
    >
      <div className={`flex items-start justify-between mb-2.5 flex-wrap gap-2 ${fill ? 'shrink-0' : ''}`}>
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-gray-900 text-sm leading-tight truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* In `fill` mode the skeleton has to occupy the flexing region itself,
          not merely claim height:100% of an auto-height box — otherwise the
          card collapses while loading and snaps to full height when data
          lands. */}
      {isLoading
        ? (fill
            ? <div className="flex-1 min-h-0"><Skeleton className="w-full h-full rounded-md" /></div>
            : <Skeleton className="w-full rounded-md" style={{ height: skeletonHeight }} />)
        : (fill ? <div className="flex-1 min-h-0">{children}</div> : children)
      }
    </div>
  )
}

// ── Stat row inside a chart card ──────────────────────────────────────────────
// Bar height 1.5 → 1, radius full → md, value in tabular figures so a column of
// these does not jitter as numbers change.
export function StatRow({ label, value, pct, color }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-600 truncate">{label}</span>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className="text-xs font-medium text-gray-900 tabular-nums">{value}</span>
            {pct !== undefined && (
              <span className="text-[10px] text-gray-400 tabular-nums">{pct}%</span>
            )}
          </div>
        </div>
        <div className="h-1 bg-gray-100 rounded-md overflow-hidden">
          <div
            className="h-full rounded-md transition-all duration-500"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Axis tick style shared across charts ──────────────────────────────────────
// See the header block: the font name was dead and the colour was a fixed hex.
export const AXIS_TICK_STYLE = {
  fontSize: 11,
  fill: 'rgb(var(--c-gray-400))',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
}

// ── Grid / accent tokens ──────────────────────────────────────────────────────
// Recharts needs colour STRINGS, so these are variables rather than classes.
// CHART_ACCENT follows the user's accent preference; the hardcoded #14b8a6 it
// replaces did not.
export const CHART_GRID_STROKE = 'rgb(var(--c-gray-100))'
export const CHART_ACCENT      = 'rgb(var(--c-accent-500))'
export const CHART_MUTED       = 'rgb(var(--c-gray-300))'

// ── Shared chart margins ──────────────────────────────────────────────────────
export const CHART_MARGIN = { top: 4, right: 4, bottom: 0, left: 0 }
