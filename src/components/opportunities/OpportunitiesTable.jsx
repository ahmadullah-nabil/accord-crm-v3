import React from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, MoreHorizontal, Eye, Pencil, Trash2, Calendar } from 'lucide-react'
import { useOpportunitiesStore, OPPORTUNITY_STAGES, OPP_STAGE_COLORS } from '../../stores/opportunitiesStore.js'
import { useMeetingsStore }         from '../../stores/meetingsStore.js'
import { useDeleteOpportunity }     from '../../hooks/useOpportunities.js'
import { Skeleton }                 from '../ui/Skeleton.jsx'
import { Avatar }                   from '../ui/Avatar.jsx'

const fmt = (n) =>
  n >= 1_000_000 ? `৳${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `৳${(n / 1_000).toFixed(0)}K`
  : `৳${n}`

const COLS = [
  { key: 'title',             label: 'Title',           sortable: true  },
  { key: 'stage',             label: 'Stage',           sortable: true  },
  { key: 'value',             label: 'Value',           sortable: true  },
  { key: 'probability',       label: 'Prob',            sortable: true  },
  { key: 'expectedRevenue',   label: 'Exp. Revenue',    sortable: true  },
  { key: 'expectedCloseDate', label: 'Close Date',      sortable: true  },
  { key: 'assignee',          label: 'Assignee',        sortable: true  },
  { key: 'actions',           label: '',                sortable: false },
]

export function OpportunitiesTable({ opportunities, isLoading }) {
  const { sortField, sortDir, setSort, openDetail, openEditModal } = useOpportunitiesStore()
  const { openAddModalWithPrefill } = useMeetingsStore()
  const deleteMutation = useDeleteOpportunity()

  if (isLoading) {
    return (
      <div className="card overflow-hidden">
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (opportunities.length === 0) {
    return (
      <div className="card py-16 text-center">
        <p className="text-sm font-semibold text-gray-800 mb-1">No deals found</p>
        <p className="text-xs text-gray-400">Try adjusting your filters or add a new deal.</p>
      </div>
    )
  }

  const SortIcon = ({ col }) => {
    if (!col.sortable) return null
    if (sortField !== col.key) return <ChevronsUpDown size={12} className="text-gray-300" />
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-teal-500" />
      : <ChevronDown size={12} className="text-teal-500" />
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {COLS.map((col) => (
              <th
                key={col.key}
                onClick={col.sortable ? () => setSort(col.key) : undefined}
                className={`text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap
                  ${col.sortable ? 'cursor-pointer hover:text-gray-800 select-none' : ''}`}
              >
                <span className="flex items-center gap-1">
                  {col.label} <SortIcon col={col} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {opportunities.map((opp) => (
            <OppRow
              key={opp.id}
              opp={opp}
              onOpen={() => openDetail(opp.id)}
              onEdit={() => openEditModal(opp.id)}
              onDelete={() => deleteMutation.mutate(opp.id)}
              onSchedule={() => openAddModalWithPrefill({
                relatedType:  'Lead',
                relatedId:    opp.id,
                relatedLabel: `${opp.title} — ${opp.company}`,
                title:        `Meeting — ${opp.company}`,
                participants: [],
              })}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OppRow({ opp, onOpen, onEdit, onDelete, onSchedule }) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const sc = OPP_STAGE_COLORS[opp.stage] ?? OPP_STAGE_COLORS.New

  return (
    <tr
      onClick={onOpen}
      className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer transition-colors group"
    >
      <td className="px-4 py-3">
        <div>
          <p className="font-semibold text-gray-900 group-hover:text-teal-700 transition-colors">
            {opp.title}
          </p>
          {opp.company && (
            <p className="text-xs text-gray-400">{opp.company}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${sc.light}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sc.bg}`} />
          {opp.stage}
        </span>
      </td>
      <td className="px-4 py-3 font-mono font-semibold text-gray-800">{fmt(opp.value)}</td>
      <td className="px-4 py-3 text-xs text-gray-500">{opp.probability}%</td>
      <td className="px-4 py-3 font-mono text-xs text-emerald-600 font-semibold">{fmt(opp.expectedRevenue)}</td>
      <td className="px-4 py-3 text-xs text-gray-500">{opp.expectedCloseDate || '—'}</td>
      <td className="px-4 py-3">
        {opp.assignee ? (
          <div className="flex items-center gap-2">
            <Avatar name={opp.assignee} size="sm" />
            <span className="text-xs text-gray-600">{opp.assignee.split(' ')[0]}</span>
          </div>
        ) : <span className="text-xs text-gray-300">—</span>}
      </td>
      <td className="px-4 py-3 relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all"
        >
          <MoreHorizontal size={15} className="text-gray-400" />
        </button>
        {menuOpen && (
          <RowMenu
            onOpen={() => { onOpen(); setMenuOpen(false) }}
            onEdit={() => { onEdit(); setMenuOpen(false) }}
            onSchedule={() => { onSchedule(); setMenuOpen(false) }}
            onDelete={() => { if (confirm(`Delete "${opp.title}"?`)) { onDelete(); setMenuOpen(false) } }}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </td>
    </tr>
  )
}

function RowMenu({ onOpen, onEdit, onDelete, onSchedule, onClose }) {
  React.useEffect(() => {
    const h = () => onClose()
    document.addEventListener('click', h, true)
    return () => document.removeEventListener('click', h, true)
  }, [onClose])

  return (
    <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-card-lg border border-gray-100 py-1 min-w-[160px] animate-fade-in">
      <MenuItem icon={Eye}      label="View"             onClick={onOpen}     />
      <MenuItem icon={Pencil}   label="Edit"             onClick={onEdit}     />
      <MenuItem icon={Calendar} label="Schedule Meeting" onClick={onSchedule} />
      <MenuItem icon={Trash2}   label="Delete"           onClick={onDelete}   danger />
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium transition-colors
        ${danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}
    >
      <Icon size={13} /> {label}
    </button>
  )
}
