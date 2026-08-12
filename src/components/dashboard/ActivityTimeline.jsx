import React from 'react'
import {
  Trophy, UserCheck, Calendar, FileText,
  UserPlus, XCircle, Phone, CheckCircle2,
  RotateCcw, Activity,
} from 'lucide-react'
import { Avatar }   from '../ui/Avatar.jsx'
import { Skeleton } from '../ui/Skeleton.jsx'

// ── Type → visual config ──────────────────────────────────────────────────────
const TYPE_CONFIG = {
  // Real activity types — matches ACTIVITY_TYPES in activityService.js
  lead_created:       { icon: UserPlus,    bg: 'bg-indigo-50', color: 'text-indigo-600', dot: 'bg-indigo-400'  },
  lead_stage_changed: { icon: UserCheck,   bg: 'bg-teal-50',   color: 'text-teal-600',   dot: 'bg-teal-400'    },
  lead_updated:       { icon: UserCheck,   bg: 'bg-teal-50',   color: 'text-teal-600',   dot: 'bg-teal-400'    },
  meeting_scheduled:  { icon: Calendar,    bg: 'bg-blue-50',   color: 'text-blue-600',   dot: 'bg-blue-400'    },
  meeting_updated:    { icon: Calendar,    bg: 'bg-blue-50',   color: 'text-blue-600',   dot: 'bg-blue-400'    },
  meeting_completed:  { icon: CheckCircle2,bg: 'bg-emerald-50',color: 'text-emerald-600',dot: 'bg-emerald-400' },
  task_created:       { icon: FileText,    bg: 'bg-amber-50',  color: 'text-amber-600',  dot: 'bg-amber-400'   },
  task_completed:     { icon: CheckCircle2,bg: 'bg-emerald-50',color: 'text-emerald-600',dot: 'bg-emerald-400' },
  task_reopened:      { icon: RotateCcw,   bg: 'bg-gray-100',  color: 'text-gray-500',   dot: 'bg-gray-400'    },
  // analyticsService maps these legacy codes from older activity records
  deal_won:           { icon: Trophy,      bg: 'bg-emerald-50',color: 'text-emerald-600',dot: 'bg-emerald-400' },
  lead_new:           { icon: UserPlus,    bg: 'bg-indigo-50', color: 'text-indigo-600', dot: 'bg-indigo-400'  },
  lead_moved:         { icon: UserCheck,   bg: 'bg-teal-50',   color: 'text-teal-600',   dot: 'bg-teal-400'    },
  task_done:          { icon: CheckCircle2,bg: 'bg-emerald-50',color: 'text-emerald-600',dot: 'bg-emerald-400' },
  meeting:            { icon: Calendar,    bg: 'bg-blue-50',   color: 'text-blue-600',   dot: 'bg-blue-400'    },
  deal_lost:          { icon: XCircle,     bg: 'bg-red-50',    color: 'text-red-500',    dot: 'bg-red-400'     },
}

// ── Relative time helper ──────────────────────────────────────────────────────
function relativeTime(iso) {
  if (!iso) return ''
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60)         return 'just now'
  if (diff < 3600)       return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)      return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7)  return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short' })
}

// ── Single timeline item ──────────────────────────────────────────────────────
function ActivityItem({ item, isLast }) {
  const cfg = TYPE_CONFIG[item.type] || {
    icon: Activity, bg: 'bg-gray-100', color: 'text-gray-500', dot: 'bg-gray-400',
  }
  const Icon = cfg.icon

  // Normalise field names — activityService uses actor/occurredAt,
  // analyticsService.getRecentActivity() remaps to user/time for this component
  const user    = item.actor  ?? item.user    ?? ''
  const action  = item.action ?? ''
  const subject = item.subject ?? ''
  const detail  = item.detail  ?? ''
  const time    = item.occurredAt
    ? relativeTime(item.occurredAt)
    : (item.time ?? '')

  return (
    <div className="flex gap-3 group">
      {/* Timeline line + icon */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0
          transition-transform duration-200 group-hover:scale-110`}>
          <Icon size={14} className={cfg.color} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-gray-100 mt-2 mb-1" />}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${!isLast ? 'pb-4' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700 leading-snug">
              <span className="font-semibold text-gray-900">{user}</span>
              {' '}
              <span className="text-gray-500">{action}</span>
              {' '}
              <span className="font-medium text-gray-800">{subject}</span>
            </p>
            {detail && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{detail}</p>
            )}
          </div>
          <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
            {time}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="card p-5">
      <Skeleton className="h-4 w-36 mb-1.5" />
      <Skeleton className="h-3 w-48 mb-5" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 mb-4">
          <Skeleton className="w-8 h-8 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Public component ──────────────────────────────────────────────────────────
// Accepts real activity data as a prop from DashboardPage (via useDashboardActivity).
// No internal data fetching, no mock fallback.
export function ActivityTimeline({ data = [], isLoading = false, maxItems = 7 }) {
  if (isLoading) return <LoadingSkeleton />

  const items = data.slice(0, maxItems)

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-display font-bold text-gray-900 text-base">Recent Activity</h3>
          <p className="text-xs text-gray-400 mt-0.5">Live team updates</p>
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="py-6 text-center">
          <Activity size={24} className="text-gray-200 mx-auto mb-2" />
          <p className="text-xs text-gray-400">No activity yet</p>
          <p className="text-[11px] text-gray-300 mt-0.5">
            Events appear as leads, meetings, and tasks are created
          </p>
        </div>
      )}

      {/* Timeline */}
      <div>
        {items.map((item, idx) => (
          <ActivityItem
            key={item.id ?? idx}
            item={item}
            isLast={idx === items.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

export default ActivityTimeline
