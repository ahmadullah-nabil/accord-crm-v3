import React from 'react'
import { useOpportunitiesStore, OPPORTUNITY_STAGES, OPP_STAGE_COLORS } from '../../stores/opportunitiesStore.js'

const fmt = (n) =>
  n >= 1_000_000 ? `৳${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `৳${(n / 1_000).toFixed(0)}K`
  : `৳${n}`

export function OppSummaryBar({ opportunities = [] }) {
  const { stageFilter, setStageFilter } = useOpportunitiesStore()

  const total       = opportunities.length
  const pipelineVal = opportunities.filter((o) => !['Won','Lost'].includes(o.stage))
                        .reduce((s, o) => s + (o.value || 0), 0)
  const expRevenue  = opportunities.filter((o) => !['Won','Lost'].includes(o.stage))
                        .reduce((s, o) => s + (o.expectedRevenue || 0), 0)
  const wonCount    = opportunities.filter((o) => o.stage === 'Won').length
  const winRate     = total > 0 ? ((wonCount / total) * 100).toFixed(1) : '0.0'

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
      {/* Overall stats */}
      <StatPill
        label="Total Deals" value={total}
        sub={`${fmt(pipelineVal)} pipeline`}
        active={stageFilter === 'All'}
        onClick={() => setStageFilter('All')}
        color="bg-gray-900 text-white"
      />
      <StatPill
        label="Exp. Revenue" value={fmt(expRevenue)}
        sub={`${winRate}% win rate`}
        active={false}
        color="bg-emerald-500 text-white"
      />

      {/* Per-stage pills (exclude Won/Lost from main pills) */}
      {OPPORTUNITY_STAGES.filter((s) => s !== 'Lost').map((stage) => {
        const count = opportunities.filter((o) => o.stage === stage).length
        const val   = opportunities.filter((o) => o.stage === stage)
                        .reduce((s, o) => s + (o.value || 0), 0)
        const sc    = OPP_STAGE_COLORS[stage]
        return (
          <StatPill
            key={stage}
            label={stage}
            value={count}
            sub={fmt(val)}
            active={stageFilter === stage}
            onClick={() => setStageFilter(stageFilter === stage ? 'All' : stage)}
            dotColor={sc?.bg}
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
        {dotColor && !color && (
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
        )}
        <span className={`text-[10px] font-semibold uppercase tracking-wide truncate
          ${active ? 'text-teal-100' : 'text-gray-500'}`}>
          {label}
        </span>
      </div>
      <p className={`font-display font-bold text-lg leading-none
        ${color
          ? active ? 'text-white' : color.includes('emerald') ? 'text-emerald-600' : 'text-gray-900'
          : active ? 'text-white' : 'text-gray-900'
        }`}>
        {value}
      </p>
      <p className={`text-[11px] mt-1 truncate ${active ? 'text-teal-100' : 'text-gray-400'}`}>
        {sub}
      </p>
    </button>
  )
}
