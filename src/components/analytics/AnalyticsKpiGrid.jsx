import React from 'react'
import {
  DollarSign, Target, TrendingUp, CheckSquare,
  Calendar, Users, BarChart2, Layers,
} from 'lucide-react'
import { TrendBadge } from '../ui/TrendBadge.jsx'
import { Skeleton }   from '../ui/Skeleton.jsx'
import { fmtCurrency, fmtNum } from '../../lib/analyticsData.js'

const KPI_META = {
  totalRevenue:       { label: 'Total Revenue',     icon: DollarSign,  color: 'teal',    format: 'currency' },
  activeLeads:        { label: 'Active Leads',      icon: Target,      color: 'blue',    format: 'num' },
  conversionRate:     { label: 'Conversion Rate',   icon: TrendingUp,  color: 'emerald', format: 'pct' },
  dealsWon:           { label: 'Deals Won',         icon: BarChart2,   color: 'purple',  format: 'num' },
  taskCompletionRate: { label: 'Task Completion',   icon: CheckSquare, color: 'amber',   format: 'pct' },
  meetingsConducted:  { label: 'Meetings Held',     icon: Calendar,    color: 'indigo',  format: 'num' },
  avgDealSize:        { label: 'Avg Deal Size',     icon: Layers,      color: 'teal',    format: 'currency' },
  pipelineValue:      { label: 'Pipeline Value',    icon: Users,       color: 'blue',    format: 'currency' },
}

const COLOR_VARIANTS = {
  teal:   { ring: 'ring-teal-200',    bg: 'bg-teal-50',    icon: 'text-teal-600',    accent: 'bg-teal-500'   },
  blue:   { ring: 'ring-blue-200',    bg: 'bg-blue-50',    icon: 'text-blue-600',    accent: 'bg-blue-500'   },
  emerald:{ ring: 'ring-emerald-200', bg: 'bg-emerald-50', icon: 'text-emerald-600', accent: 'bg-emerald-500'},
  amber:  { ring: 'ring-amber-200',   bg: 'bg-amber-50',   icon: 'text-amber-600',   accent: 'bg-amber-500'  },
  purple: { ring: 'ring-purple-200',  bg: 'bg-purple-50',  icon: 'text-purple-600',  accent: 'bg-purple-500' },
  indigo: { ring: 'ring-indigo-200',  bg: 'bg-indigo-50',  icon: 'text-indigo-600',  accent: 'bg-indigo-500' },
}

function formatVal(val, format) {
  if (format === 'currency') return fmtCurrency(val)
  if (format === 'pct')      return `${val}%`
  return fmtNum(val)
}

export function AnalyticsKpiGrid({ data, isLoading }) {
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {Object.entries(KPI_META).map(([key, meta]) => {
        const kpi = data[key]
        if (!kpi) return null
        const cv = COLOR_VARIANTS[meta.color] || COLOR_VARIANTS.teal
        const Icon = meta.icon
        const displayVal = formatVal(kpi.value, meta.format)
        const trendAbs = Math.abs(kpi.trend)
        const barWidth = Math.min(100, trendAbs * 4 + 40)

        return (
          <div
            key={key}
            className="card p-5 hover:shadow-card-md transition-all duration-200 group cursor-default"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl ${cv.bg} ring-1 ${cv.ring} flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110`}>
                <Icon size={18} className={cv.icon} />
              </div>
              <TrendBadge value={kpi.trend} />
            </div>

            <div className="mb-1">
              <span className="font-display font-bold text-2xl text-gray-900 tracking-tight">
                {displayVal}
              </span>
            </div>
            <p className="text-sm text-gray-500 font-medium">{meta.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">vs previous period</p>

            <div className="mt-4 h-0.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${cv.accent} rounded-full transition-all duration-700`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KpiSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <Skeleton className="w-14 h-5 rounded-full" />
      </div>
      <Skeleton className="h-7 w-24 mb-1.5" />
      <Skeleton className="h-3.5 w-28 mb-0.5" />
      <Skeleton className="h-3 w-20 mb-4" />
      <Skeleton className="h-0.5 w-full" />
    </div>
  )
}
