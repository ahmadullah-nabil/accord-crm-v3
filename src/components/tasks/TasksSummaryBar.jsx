import React from 'react'
import { useTasksStore }           from '../../stores/tasksStore.js'
import { TASK_STATUSES, STATUS_CONFIG } from '../../lib/tasksData.js'

export function TasksSummaryBar({ tasks = [] }) {
  const { statusFilter, setStatusFilter } = useTasksStore()

  const total    = tasks.length
  const overdue  = tasks.filter((t) => t.status === 'Overdue').length
  const dueToday = tasks.filter((t) => {
    if (t.status === 'Completed') return false
    const today = new Date().toISOString().split('T')[0]
    return t.dueDate === today
  }).length

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      {/* All tasks pill */}
      <StatPill
        label="All Tasks"
        value={total}
        sub={`${dueToday} due today`}
        active={statusFilter === 'All'}
        onClick={() => setStatusFilter('All')}
        dotColor="bg-gray-500"
        urgentSub={dueToday > 0}
      />

      {/* Per-status pills */}
      {TASK_STATUSES.map((status) => {
        const count = tasks.filter((t) => t.status === status).length
        const cfg   = STATUS_CONFIG[status]
        return (
          <StatPill
            key={status}
            label={status}
            value={count}
            sub={status === 'Overdue' && count > 0 ? 'needs attention' : `of ${total}`}
            active={statusFilter === status}
            onClick={() => setStatusFilter(statusFilter === status ? 'All' : status)}
            dotColor={cfg.dot}
            urgentSub={status === 'Overdue' && count > 0}
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
