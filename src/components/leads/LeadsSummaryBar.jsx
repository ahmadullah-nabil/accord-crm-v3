import React from 'react'
import { useLeadsStore, STAGES, STAGE_COLORS } from '../../stores/leadsStore.js'

const fmt = (n) =>
  n >= 1000000 ? `৳${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `৳${(n / 1000).toFixed(0)}K` : `৳${n}`

export function LeadsSummaryBar() {
  const { leads, stageFilter, setStageFilter } = useLeadsStore()

  const total = leads.length
  const totalValue = leads.reduce((s, l) => s + l.value, 0)
  const wonCount = leads.filter((l) => l.stage === 'Won').length
  const convRate = total > 0 ? ((wonCount / total) * 100).toFixed(1) : '0.0'

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
      {/* Overall stats */}
      <StatPill label="Total Leads" value={total} sub={`৳${fmt(totalValue)} pipeline`} active={stageFilter === 'All'} onClick={() => setStageFilter('All')} color="bg-gray-900 text-white" />
      <StatPill label="Win Rate" value={`${convRate}%`} sub={`${wonCount} won`} active={false} color="bg-emerald-500 text-white" />

      {/* Per-stage pills */}
      {STAGES.filter((s) => !['Won', 'Lost'].includes(s)).map((stage) => {
        const count = leads.filter((l) => l.stage === stage).length
        const value = leads.filter((l) => l.stage === stage).reduce((s, l) => s + l.value, 0)
        const sc = STAGE_COLORS[stage]
        return (
          <StatPill
            key={stage}
            label={stage}
            value={count}
            sub={fmt(value)}
            active={stageFilter === stage}
            onClick={() => setStageFilter(stageFilter === stage ? 'All' : stage)}
            dotColor={sc.bg}
          />
        )
      })}
    </div>
  )
}

function StatPill({ label, value, sub, active, onClick, color, dotColor }) {
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
        {dotColor && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />}
        <p className={`text-[10px] font-semibold uppercase tracking-wider ${active ? 'text-teal-100' : 'text-gray-500'}`}>{label}</p>
      </div>
      <p className={`font-display font-bold text-lg leading-tight ${active ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      <p className={`text-[10px] mt-0.5 font-mono ${active ? 'text-teal-100' : 'text-gray-400'}`}>{sub}</p>
    </button>
  )
}
