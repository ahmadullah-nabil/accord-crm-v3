import React from 'react'
import { useLeadsStore, STAGES, STAGE_COLORS, PRIORITY_COLORS } from '../../stores/leadsStore.js'
import { Avatar } from '../ui/Avatar.jsx'

const fmt = (n) =>
  n >= 1000000 ? `৳${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `৳${(n / 1000).toFixed(0)}K` : `৳${n}`

export function LeadsKanban() {
  const { getFilteredLeads, openDetail, updateStage } = useLeadsStore()
  const leads = getFilteredLeads()

  const grouped = STAGES.reduce((acc, stage) => {
    acc[stage] = leads.filter((l) => l.stage === stage)
    return acc
  }, {})

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[520px]">
      {STAGES.map((stage) => (
        <KanbanColumn
          key={stage}
          stage={stage}
          leads={grouped[stage]}
          onCardClick={openDetail}
          onDrop={(leadId) => updateStage(leadId, stage)}
        />
      ))}
    </div>
  )
}

function KanbanColumn({ stage, leads, onCardClick, onDrop }) {
  const [dragOver, setDragOver] = React.useState(false)
  const sc = STAGE_COLORS[stage]
  const total = leads.reduce((s, l) => s + l.value, 0)

  return (
    <div
      className={`flex-shrink-0 w-[220px] flex flex-col rounded-xl transition-all duration-150
        ${dragOver ? 'bg-teal-50/60 ring-2 ring-teal-300 ring-dashed' : 'bg-gray-50'}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        const id = e.dataTransfer.getData('leadId')
        if (id) onDrop(id)
        setDragOver(false)
      }}
    >
      {/* Column header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${sc.bg}`} />
            <span className="text-xs font-semibold text-gray-700">{stage}</span>
          </div>
          <span className="text-xs font-bold text-gray-500 bg-white rounded-full px-2 py-0.5 shadow-sm border border-gray-100">
            {leads.length}
          </span>
        </div>
        {leads.length > 0 && (
          <p className="text-[10px] text-gray-400 font-mono pl-4">{fmt(total)}</p>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 px-2 pb-3 flex-1">
        {leads.map((lead) => (
          <KanbanCard key={lead.id} lead={lead} onClick={() => onCardClick(lead.id)} />
        ))}

        {leads.length === 0 && (
          <div className="flex-1 flex items-center justify-center min-h-[80px]">
            <p className="text-[11px] text-gray-300 text-center">Drop here</p>
          </div>
        )}
      </div>
    </div>
  )
}

function KanbanCard({ lead, onClick }) {
  const pc = PRIORITY_COLORS[lead.priority] || ''

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('leadId', lead.id)}
      onClick={onClick}
      className="bg-white rounded-xl p-3 shadow-card border border-gray-100 cursor-pointer
                 hover:shadow-card-md hover:-translate-y-0.5 transition-all duration-150 group"
    >
      {/* Priority dot + value */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${pc}`}>
          {lead.priority}
        </span>
        <span className="text-[10px] font-mono font-semibold text-gray-500">{fmt(lead.value)}</span>
      </div>

      {/* Name + company */}
      <p className="text-xs font-semibold text-gray-900 leading-tight mb-0.5 group-hover:text-teal-700 transition-colors">
        {lead.name}
      </p>
      <p className="text-[10px] text-gray-400 mb-2 truncate">{lead.company}</p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <div className="flex items-center gap-1.5">
          <Avatar name={lead.assignee} size="xs" />
          <span className="text-[10px] text-gray-400">{lead.assignee.split(' ')[0]}</span>
        </div>
        <span className="text-[10px] text-gray-300">{lead.source}</span>
      </div>
    </div>
  )
}
