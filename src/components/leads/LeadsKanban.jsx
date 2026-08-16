// ─── LeadsKanban ──────────────────────────────────────────────────────────────
//
// step045. Density pass, matching OpportunitiesKanban exactly. No behaviour
// change — same store, same grouping, same drag/drop, same updateStage.
//
// The two boards are the only Kanbans in the app and they were already near
// copies of each other. Changing one and not the other would leave the app with
// two card densities for the same gesture, which is the drift this project keeps
// paying for. See the fuller note in OpportunitiesKanban.jsx.
//
// The negative-translate hover lift is gone here too — open item 1, now
// closed for both boards. Nothing else uses it.
//
// NOTHING WAS DROPPED. Priority, value, name, company, assignee and source are
// all still on the card; priority and value share the meta row with the
// assignee instead of each holding a line behind a divider.

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
    <div className="flex gap-2 overflow-x-auto pb-3 min-h-[420px]">
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
      className={`flex-shrink-0 w-[220px] flex flex-col rounded-lg transition-colors duration-120
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
      <div className="px-2 pt-2 pb-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.bg}`} />
            <span className="text-xs font-medium text-gray-700 truncate">{stage}</span>
          </div>
          <span className="tnum text-xs text-gray-400 flex-shrink-0">{leads.length}</span>
        </div>
        {leads.length > 0 && (
          <p className="text-[10px] text-gray-400 tnum mt-0.5">{fmt(total)}</p>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-1.5 px-1.5 pb-1.5 flex-1">
        {leads.map((lead) => (
          <KanbanCard key={lead.id} lead={lead} onClick={() => onCardClick(lead.id)} />
        ))}

        {leads.length === 0 && (
          <div className="flex-1 flex items-center justify-center min-h-[60px]">
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
      className="bg-white rounded-lg px-2.5 py-2 border border-gray-200 cursor-pointer
                 hover:border-gray-300 hover:bg-gray-50 transition-colors duration-120 group"
    >
      {/* step067 — company first, contact underneath. Same swap as the table;
          a card that leads with the person while the table leads with the
          company would make Table and Kanban look like different data. */}
      <p className="text-xs font-medium text-gray-900 leading-snug truncate
        group-hover:text-teal-700 transition-colors duration-120">
        {lead.company || lead.name}
      </p>
      {lead.company && (
        <p className="text-[11px] text-gray-400 truncate mt-0.5">{lead.name}</p>
      )}

      <div className="flex items-center gap-1.5 mt-1.5">
        <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${pc}`}>
          {lead.priority}
        </span>
        <span className="text-xs font-medium text-gray-800 tnum">{fmt(lead.value)}</span>
        {/* step067 — the recurring half, only when there is one. A card is
            three lines; a permanent "৳0/mo" on every one of them is noise. */}
        {lead.mmc > 0 && (
          <span className="text-[10px] text-gray-400 tnum">{fmt(lead.mmc)}/mo</span>
        )}
        {lead.source && (
          <span className="text-[10px] text-gray-400 truncate">· {lead.source}</span>
        )}
        {lead.assignee && (
          <span className="ml-auto flex-shrink-0" title={lead.assignee}>
            <Avatar name={lead.assignee} size="xs" />
          </span>
        )}
      </div>
    </div>
  )
}
