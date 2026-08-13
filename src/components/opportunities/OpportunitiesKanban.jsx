// ─── OpportunitiesKanban ──────────────────────────────────────────────────────
//
// step045. Density pass. No behaviour change — same grouping, same drag/drop,
// same store, same mutation.
//
// WHAT THE CARDS WERE
// ───────────────────
// `rounded-xl p-3 shadow-card border`, a two-step hover shadow plus a negative
// translate lift, and five stacked rows: title, company, value + probability,
// close date, then an assignee footer behind its own border-t.
// Around 118px per card, so four deals filled a screen and a stage with six was
// unreadable without scrolling a 220px column.
//
// A Kanban's job is letting you see a pipeline at once. Every pixel of card
// chrome is a deal you cannot see.
//
// WHAT CHANGED, AND WHAT DID NOT
// ──────────────────────────────
// Chrome: `rounded-xl` → `rounded-lg`, `p-3` → `px-2.5 py-2`, the shadow pair
// replaced by a border that darkens on hover. `transition-all` →
// `transition-colors`, which is also the cheaper property to animate.
//
// The negative-translate hover lift is GONE — open item 1 in the handover. It
// moved the card under the cursor on hover, which fights a drag gesture: you
// grab a card that has just shifted 2px. Killed here rather than globally,
// because a rule that silently cancels a utility confuses whoever writes the
// next board.
//
// NO INFORMATION WAS DROPPED. Close date and assignee moved onto the meta row
// instead of each claiming a line and a divider. Same five facts, ~64px.

import React from 'react'
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
    <div className="flex gap-2 overflow-x-auto pb-3 min-h-[420px]">
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
      className={`flex-shrink-0 w-[220px] flex flex-col rounded-lg transition-colors duration-120
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
      <div className="px-2 pt-2 pb-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.bg}`} />
            <span className="text-xs font-medium text-gray-700 truncate">{stage}</span>
          </div>
          {/* The count is a fact, not a chip — the pill with its own shadow and
              ring read as a control you could press. */}
          <span className="tnum text-xs text-gray-400 flex-shrink-0">{opps.length}</span>
        </div>
        <div className="text-[10px] text-gray-400 tnum mt-0.5">
          {fmt(total)} · {fmt(expRev)} exp.
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-1.5 space-y-1.5">
        {opps.map((opp) => (
          <OppCard key={opp.id} opp={opp} onClick={onCardClick} />
        ))}
      </div>
    </div>
  )
}

function OppCard({ opp, onClick }) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('oppId', opp.id)}
      onClick={() => onClick(opp.id)}
      className="bg-white rounded-lg px-2.5 py-2 border border-gray-200 cursor-pointer
        hover:border-gray-300 hover:bg-gray-50 transition-colors duration-120 group"
    >
      <p className="text-xs font-medium text-gray-900 leading-snug line-clamp-2
        group-hover:text-teal-700 transition-colors duration-120">
        {opp.title}
      </p>
      {opp.company && (
        <p className="text-[11px] text-gray-400 truncate mt-0.5">{opp.company}</p>
      )}

      <div className="flex items-center gap-1.5 mt-1.5">
        <span className="text-xs font-medium text-gray-800 tnum">{fmt(opp.value)}</span>
        <span className="text-[10px] text-gray-400 tnum">{opp.probability}%</span>
        {opp.expectedCloseDate && (
          <span className="text-[10px] text-gray-400 tnum truncate">
            · {opp.expectedCloseDate}
          </span>
        )}
        {opp.assignee && (
          <span className="ml-auto flex-shrink-0" title={opp.assignee}>
            <Avatar name={opp.assignee} size="xs" />
          </span>
        )}
      </div>
    </div>
  )
}
