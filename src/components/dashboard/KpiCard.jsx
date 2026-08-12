import React from 'react'
import {
  DollarSign, Target, TrendingUp, HeartHandshake,
  Users, BarChart2, Calendar, CheckSquare,
} from 'lucide-react'
import { TrendBadge } from '../ui/TrendBadge.jsx'
import { Skeleton } from '../ui/Skeleton.jsx'

const ICON_MAP = {
  DollarSign, Target, TrendingUp, HeartHandshake, Handshake: HeartHandshake,
  Users, BarChart2, Calendar, CheckSquare,
}

const COLOR_VARIANTS = {
  teal:    { ring: 'ring-teal-200',    bg: 'bg-teal-50',    icon: 'text-teal-600',    accent: 'bg-teal-500'    },
  blue:    { ring: 'ring-blue-200',    bg: 'bg-blue-50',    icon: 'text-blue-600',    accent: 'bg-blue-500'    },
  emerald: { ring: 'ring-emerald-200', bg: 'bg-emerald-50', icon: 'text-emerald-600', accent: 'bg-emerald-500' },
  amber:   { ring: 'ring-amber-200',   bg: 'bg-amber-50',   icon: 'text-amber-600',   accent: 'bg-amber-500'   },
  purple:  { ring: 'ring-purple-200',  bg: 'bg-purple-50',  icon: 'text-purple-600',  accent: 'bg-purple-500'  },
}

export function KpiCard({ label, value, trend, period, icon, color = 'teal', isLoading = false }) {
  const Icon = ICON_MAP[icon] || DollarSign
  const cv = COLOR_VARIANTS[color] || COLOR_VARIANTS.teal

  if (isLoading) {
    return (
      <div className="card p-5">
        <div className="flex items-start justify-between mb-4">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="w-16 h-5 rounded-full" />
        </div>
        <Skeleton className="h-7 w-24 mb-1.5" />
        <Skeleton className="h-3.5 w-32" />
      </div>
    )
  }

  return (
    <div className="card p-5 hover:shadow-card-md transition-all duration-200 group cursor-default">
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${cv.bg} ring-1 ${cv.ring} flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110`}>
          <Icon size={18} className={cv.icon} />
        </div>
        <TrendBadge value={trend} />
      </div>

      {/* Value */}
      <div className="mb-1">
        <span className="font-display font-bold text-2xl text-gray-900 tracking-tight">{value}</span>
      </div>

      {/* Label + period */}
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{period}</p>

      {/* Bottom accent bar */}
      <div className="mt-4 h-0.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${cv.accent} rounded-full transition-all duration-700`}
          style={{ width: `${Math.min(100, Math.abs(trend) * 4 + 40)}%` }}
        />
      </div>
    </div>
  )
}

export default KpiCard
