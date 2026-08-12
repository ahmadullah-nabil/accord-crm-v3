import React from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, MoreHorizontal, Eye, Pencil, Trash2, Calendar } from 'lucide-react'
import { useLeadsStore, STAGE_COLORS, PRIORITY_COLORS, STAGES } from '../../stores/leadsStore.js'
import { useMeetingsStore }         from '../../stores/meetingsStore.js'
import { useBatchLeadPermissions }  from '../../hooks/usePermissions.js'
import { Avatar } from '../ui/Avatar.jsx'
import { EmptyState } from '../ui/EmptyState.jsx'
import { Target } from 'lucide-react'

const fmt = (n) =>
  n >= 1000000
    ? `৳${(n / 1000000).toFixed(2)}M`
    : n >= 1000
    ? `৳${(n / 1000).toFixed(0)}K`
    : `৳${n}`

export function LeadsTable() {
  const {
    getFilteredLeads, sortField, sortDir, setSort,
    openDetail, openEditModal, deleteLead, updateStage,
  } = useLeadsStore()

  const { openAddModalWithPrefill } = useMeetingsStore()
  const { getPermissions } = useBatchLeadPermissions()

  const leads = getFilteredLeads()

  if (leads.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={Target}
          title="No leads found"
          description="Try adjusting your search or filter criteria."
        />
      </div>
    )
  }

  const COLS = [
    { key: 'name',         label: 'Lead',          sortable: true,  width: '' },
    { key: 'stage',        label: 'Stage',         sortable: true,  width: 'w-28' },
    { key: 'value',        label: 'Deal Value',    sortable: true,  width: 'w-28' },
    { key: 'priority',     label: 'Priority',      sortable: false, width: 'w-24' },
    { key: 'source',       label: 'Source',        sortable: false, width: 'w-28' },
    { key: 'assignee',     label: 'Assignee',      sortable: false, width: 'w-32' },
    { key: 'lastActivity', label: 'Last Activity', sortable: true,  width: 'w-28' },
    { key: 'actions',      label: '',              sortable: false, width: 'w-12' },
  ]

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              {COLS.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${col.width}
                    ${col.sortable ? 'cursor-pointer select-none hover:text-gray-700 group' : ''}`}
                  onClick={col.sortable ? () => setSort(col.key) : undefined}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      sortField === col.key
                        ? sortDir === 'asc'
                          ? <ChevronUp size={12} className="text-teal-500" />
                          : <ChevronDown size={12} className="text-teal-500" />
                        : <ChevronsUpDown size={11} className="text-gray-300 group-hover:text-gray-400" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leads.map((lead) => {
              const perms = getPermissions(lead)
              return (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  perms={perms}
                  onOpen={() => openDetail(lead.id)}
                  onEdit={() => openEditModal(lead.id)}
                  onDelete={() => deleteLead(lead.id)}
                  onStageChange={(stage) => updateStage(lead.id, stage)}
                  onSchedule={() => openAddModalWithPrefill({
                    relatedType:  'Lead',
                    relatedId:    lead.id,
                    relatedLabel: `${lead.name} — ${lead.company}`,
                    title:        `Meeting — ${lead.company}`,
                    participants: lead.name ? [lead.name] : [],
                  })}
                />
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      <div className="px-4 py-2.5 border-t border-gray-50 bg-gray-50/40">
        <p className="text-xs text-gray-400">{leads.length} lead{leads.length !== 1 ? 's' : ''}</p>
      </div>
    </div>
  )
}

function LeadRow({ lead, perms = {}, onOpen, onEdit, onDelete, onStageChange, onSchedule }) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const sc = STAGE_COLORS[lead.stage] || {}
  const pc = PRIORITY_COLORS[lead.priority] || ''

  return (
    <tr
      className="hover:bg-gray-50/60 transition-colors duration-100 cursor-pointer group"
      onClick={onOpen}
    >
      {/* Lead name + company */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={lead.name} size="sm" />
          <div>
            <p className="font-medium text-gray-900 text-sm leading-tight">{lead.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{lead.company}</p>
          </div>
        </div>
      </td>

      {/* Stage */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <select
          value={lead.stage}
          onChange={(e) => onStageChange(e.target.value)}
          className={`text-xs font-semibold rounded-full px-2.5 py-1 border-0 outline-none cursor-pointer ${sc.light}`}
        >
          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>

      {/* Value */}
      <td className="px-4 py-3">
        <span className="font-semibold text-gray-800 font-mono text-sm">{fmt(lead.value)}</span>
      </td>

      {/* Priority */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${pc}`}>
          {lead.priority}
        </span>
      </td>

      {/* Source */}
      <td className="px-4 py-3">
        <span className="text-xs text-gray-500">{lead.source}</span>
      </td>

      {/* Assignee */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Avatar name={lead.assignee} size="xs" />
          <span className="text-xs text-gray-600 truncate max-w-[80px]">{lead.assignee.split(' ')[0]}</span>
        </div>
      </td>

      {/* Last activity */}
      <td className="px-4 py-3">
        <span className="text-xs text-gray-500">{lead.lastActivity}</span>
      </td>

      {/* Actions menu */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <RowMenu
              onOpen={() => { onOpen(); setMenuOpen(false) }}
              onEdit={perms.canEdit ? () => { onEdit(); setMenuOpen(false) } : null}
              onDelete={perms.canDelete ? () => { if (confirm('Delete this lead?')) { onDelete(); setMenuOpen(false) } } : null}
              onSchedule={perms.canSchedule ? () => { onSchedule(); setMenuOpen(false) } : null}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      </td>
    </tr>
  )
}

function RowMenu({ onOpen, onEdit, onDelete, onSchedule, onClose }) {
  React.useEffect(() => {
    const handler = () => onClose()
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [onClose])

  return (
    <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-card-lg border border-gray-100 py-1 min-w-[160px] animate-fade-in">
      <MenuItem icon={Eye}      label="View"             onClick={onOpen}     />
      {onEdit     && <MenuItem icon={Pencil}   label="Edit"             onClick={onEdit}     />}
      {onSchedule && <MenuItem icon={Calendar} label="Schedule Meeting" onClick={onSchedule} />}
      {onDelete   && <MenuItem icon={Trash2}   label="Delete"           onClick={onDelete}   danger />}
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors
        ${danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}
