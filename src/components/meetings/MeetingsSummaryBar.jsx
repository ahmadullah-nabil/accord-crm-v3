import React from 'react'
import { useMeetingsStore }                   from '../../stores/meetingsStore.js'
import { MEETING_STATUSES, STATUS_CONFIG, daysFromToday } from '../../lib/meetingsData.js'

export function MeetingsSummaryBar({ meetings = [] }) {
  const { statusFilter, setStatusFilter } = useMeetingsStore()

  const total    = meetings.length
  const upcoming = meetings.filter((m) => {
    if (m.status !== 'Scheduled' && m.status !== 'Rescheduled') return false
    const d = daysFromToday(m.scheduledDate)
    return d !== null && d >= 0 && d <= 7
  }).length

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
      {/* All pill */}
      <StatPill
        label="All Meetings"
        value={total}
        sub={`${upcoming} this week`}
        active={statusFilter === 'All'}
        onClick={() => setStatusFilter('All')}
        dotColor="bg-gray-500"
        urgentSub={false}
      />

      {/* Per-status pills */}
      {MEETING_STATUSES.map((status) => {
        const count = meetings.filter((m) => m.status === status).length
        const cfg   = STATUS_CONFIG[status]
        const urgent = status === 'Cancelled' && count > 0
        return (
          <StatPill
            key={status}
            label={status}
            value={count}
            sub={count > 0 ? `${Math.round((count / (total || 1)) * 100)}% of total` : 'none'}
            active={statusFilter === status}
            onClick={() => setStatusFilter(statusFilter === status ? 'All' : status)}
            dotColor={cfg.dot}
            urgentSub={urgent}
          />
        )
      })}
    </div>
  )
}

function StatPill({ label, value, sub, active, onClick, dotColor, urgentSub }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl px-4 py-3 transition-all duration-200 border
        ${active
          ? 'bg-teal-500 text-white border-teal-500 shadow-glow-teal'
          : 'bg-white border-gray-100 shadow-card hover:shadow-card-md hover:-translate-y-0.5'
        }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
        <p className={`text-[10px] font-semibold uppercase tracking-wider truncate
          ${active ? 'text-teal-100' : 'text-gray-500'}`}>
          {label}
        </p>
      </div>
      <p className={`font-display font-bold text-lg leading-tight
        ${active ? 'text-white' : 'text-gray-900'}`}>
        {value}
      </p>
      <p className={`text-[10px] mt-0.5 truncate
        ${active ? 'text-teal-100' : urgentSub ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
        {sub}
      </p>
    </button>
  )
}
