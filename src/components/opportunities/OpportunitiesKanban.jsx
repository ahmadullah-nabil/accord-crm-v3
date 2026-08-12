import React from 'react'
import { DollarSign } from 'lucide-react'
import { useOpportunitiesStore, OPPORTUNITY_STAGES, OPP_STAGE_COLORS } from '../../stores/opportunitiesStore.js'
import { useUpdateOpportunityStage } from '../../hooks/useOpportunities.js'
import { Avatar } from '../ui/Avatar.jsx'

const fmt = (n) =>
  n >= 1_000_000 ? `৳${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `৳${(n / 1_000).toFixed(0)}K`
  : `৳${n}`

export function OpportunitiesKanban({ opportunities }) {
  const { openDetail } = useOpportunitiesStore()
  const stageMutation  = useUpdateOpportunityStage()

  const grouped = OPPORTUNITY_STAGES.reduce((acc, stage) => {
    acc[stage] = opportunities.filter((o) => o.stage === stage)
    return acc
  }, {})

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[520px]">
      {OPPORTUNITY_STAGES.map((stage) => (
        <KanbanColumn
          key={stage}
          stage={stage}
          opps={grouped[stage]}
          onCardClick={openDetail}
          onDrop={(id) => stageMutation.mutate({ id, stage })}
        />
      ))}
    </div>
  )
}

function KanbanColumn({ stage, opps, onCardClick, onDrop }) {
  const [dragOver, setDragOver] = React.useState(false)
  const sc     = OPP_STAGE_COLORS[stage] ?? OPP_STAGE_COLORS.New
  const total  = opps.reduce((s, o) => s + (o.value || 0), 0)
  const expRev = opps.reduce((s, o) => s + (o.expectedRevenue || 0), 0)

  return (
    <div
      className={`flex-shrink-0 w-[220px] flex flex-col rounded-xl transition-all duration-150
        ${dragOver ? 'bg-teal-50/60 ring-2 ring-teal-300 ring-dashed' : 'bg-gray-50'}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        const id = e.dataTransfer.getData('oppId')
        if (id) onDrop(id)
        setDragOver(false)
      }}
    >
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${sc.bg}`} />
            <span className="text-xs font-semibold text-gray-700">{stage}</span>
          </div>
          <span className="text-xs font-bold text-gray-500 bg-white rounded-full px-2 py-0.5 shadow-sm border border-gray-100">
            {opps.length}
          </span>
        </div>
        <div className="text-[11px] text-gray-400">
          {fmt(total)} · {fmt(expRev)} exp.
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {opps.map((opp) => (
          <OppCard key={opp.id} opp={opp} onClick={onCardClick} />
        ))}
      </div>
    </div>
  )
}

function OppCard({ opp, onClick }) {
  const sc = OPP_STAGE_COLORS[opp.stage] ?? OPP_STAGE_COLORS.New

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('oppId', opp.id)}
      onClick={() => onClick(opp.id)}
      className="bg-white rounded-xl p-3 shadow-card border border-gray-100 cursor-pointer
        hover:shadow-card-md hover:-translate-y-0.5 transition-all duration-150 group"
    >
      <p className="text-xs font-semibold text-gray-900 leading-snug line-clamp-2 mb-1.5
        group-hover:text-teal-700 transition-colors">
        {opp.title}
      </p>
      {opp.company && (
        <p className="text-[11px] text-gray-400 mb-2 truncate">{opp.company}</p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-800">{fmt(opp.value)}</span>
        <span className="text-[10px] text-gray-400">{opp.probability}%</span>
      </div>
      {opp.expectedCloseDate && (
        <p className="text-[10px] text-gray-400 mt-1">Close: {opp.expectedCloseDate}</p>
      )}
      {opp.assignee && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-50">
          <Avatar name={opp.assignee} size="xs" />
          <span className="text-[10px] text-gray-400 truncate">{opp.assignee.split(' ')[0]}</span>
        </div>
      )}
    </div>
  )
}
