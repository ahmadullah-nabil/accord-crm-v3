import React from 'react'
import {
  CheckCircle2, XCircle, Calendar, Target,
  ArrowRight, Circle,
} from 'lucide-react'
import { ChartCard } from './ChartShared.jsx'
import { Avatar }    from '../ui/Avatar.jsx'

const TYPE_CONFIG = {
  deal_won:   { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  deal_lost:  { icon: XCircle,      color: 'text-red-400',     bg: 'bg-red-50'     },
  meeting:    { icon: Calendar,     color: 'text-blue-500',    bg: 'bg-blue-50'    },
  task_done:  { icon: CheckCircle2, color: 'text-teal-500',    bg: 'bg-teal-50'    },
  lead_new:   { icon: Target,       color: 'text-indigo-500',  bg: 'bg-indigo-50'  },
  lead_moved: { icon: ArrowRight,   color: 'text-amber-500',   bg: 'bg-amber-50'   },
}

export function RecentActivityFeed({ data, isLoading }) {
  return (
    <ChartCard
      title="Recent Activity"
      subtitle="Latest actions across all modules"
      isLoading={isLoading}
      skeletonHeight={340}
    >
      <div className="space-y-3 max-h-[340px] overflow-y-auto scrollbar-hide pr-1">
        {(data || []).map((item) => {
          const cfg = TYPE_CONFIG[item.type] || { icon: Circle, color: 'text-gray-400', bg: 'bg-gray-50' }
          const Icon = cfg.icon
          return (
            <div key={item.id} className="flex items-start gap-3 group">
              {/* Type icon */}
              <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon size={13} className={cfg.color} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-600 leading-snug">
                  <span className="font-semibold text-gray-900">{item.user}</span>
                  {' '}{item.action}{' '}
                  <span className="font-semibold text-gray-800">{item.subject}</span>
                </p>
                {item.detail && (
                  <p className="text-[10px] text-gray-400 mt-0.5">{item.detail}</p>
                )}
              </div>

              {/* Time */}
              <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">{item.time}</span>
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}
