// ─── LeadsTable ───────────────────────────────────────────────────────────────
//
// step041. Second consumer of the DataTable primitive. 226 lines → this.
//
// The header markup, sort chevrons, row hover, row action menu, empty state and
// footer count are the primitive's job now. What is left is what is genuinely
// about leads: which columns exist and how each cell renders.
//
// TWO THINGS HERE ARE LOAD-BEARING AND EASY TO LOSE IN A REWRITE
// ──────────────────────────────────────────────────────────────
// 1. THE INLINE STAGE DROPDOWN. This is the only real inline editing in the
//    app today and it predates DataTable's read-only stance — it is not a
//    violation of it, it is a cell that renders a control. It needs
//    stopPropagation on the wrapper, or changing a stage also opens the detail
//    panel behind the dropdown.
//
// 2. PER-ROW PERMISSIONS. Edit, Delete and Schedule are gated per lead by
//    useBatchLeadPermissions. rowActions is a function of the row, so the gate
//    survives as a filter on the returned array — an action the user cannot
//    perform is ABSENT, not disabled. A disabled item still advertises a
//    capability they do not have.
//
// BEHAVIOUR IS OTHERWISE UNCHANGED: same store actions, same delete
// confirmation, same row-click-opens-the-panel, same meeting prefill. If
// something behaves differently after this batch it is a bug in the migration,
// not a decision.

import React from 'react'
import { Target, Tag, DollarSign, Flag, Radio, User, Clock,
         Eye, Pencil, Trash2, Calendar } from 'lucide-react'
import { useLeadsStore, STAGE_COLORS, PRIORITY_COLORS, STAGES } from '../../stores/leadsStore.js'
import { useMeetingsStore }         from '../../stores/meetingsStore.js'
import { useBatchLeadPermissions }  from '../../hooks/usePermissions.js'
import { Avatar }    from '../ui/Avatar.jsx'
import { DataTable } from '../ui/DataTable.jsx'

const fmt = (n) =>
  n >= 1_000_000 ? `৳${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000   ? `৳${(n / 1_000).toFixed(0)}K`
  : `৳${n}`

export function LeadsTable() {
  const {
    getFilteredLeads, sortField, sortDir, setSort,
    openDetail, openEditModal, openAddModal, deleteLead, updateStage,
  } = useLeadsStore()

  const { openAddModalWithPrefill } = useMeetingsStore()
  const { getPermissions } = useBatchLeadPermissions()

  const leads = getFilteredLeads()

  const columns = [
    {
      key: 'name',
      label: 'Lead',
      icon: Target,
      sortable: true,
      width: '260px',
      render: (l) => (
        <div className="flex items-center gap-2">
          <Avatar name={l.name} size="xs" />
          <span className="font-medium text-gray-900 truncate">{l.name}</span>
          {l.company && <span className="text-gray-400 truncate">· {l.company}</span>}
        </div>
      ),
    },
    {
      key: 'stage',
      label: 'Stage',
      icon: Tag,
      sortable: true,
      width: '150px',
      render: (l) => (
        // stopPropagation on the wrapper, not the select: a click that lands on
        // the padding around the control would otherwise reach the row and open
        // the panel.
        <div onClick={(e) => e.stopPropagation()}>
          <select
            value={l.stage}
            onChange={(e) => updateStage(l.id, e.target.value)}
            aria-label={`Stage for ${l.name}`}
            className={`text-xs font-medium rounded-md px-1.5 py-0.5 border-0 outline-none
                        cursor-pointer ${STAGE_COLORS[l.stage]?.light || 'bg-gray-100 text-gray-600'}`}
          >
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      ),
    },
    {
      key: 'value',
      label: 'Deal value',
      icon: DollarSign,
      sortable: true,
      align: 'right',
      width: '120px',
      render: (l) => <span className="font-medium text-gray-800 tnum">{fmt(l.value)}</span>,
    },
    {
      key: 'priority',
      label: 'Priority',
      icon: Flag,
      width: '110px',
      render: (l) => (
        <span className={`badge ${PRIORITY_COLORS[l.priority] || 'bg-gray-100 text-gray-600'}`}>
          {l.priority}
        </span>
      ),
    },
    {
      key: 'source',
      label: 'Source',
      icon: Radio,
      width: '120px',
      render: (l) => l.source || <span className="text-gray-300">—</span>,
    },
    {
      key: 'assignee',
      label: 'Assignee',
      icon: User,
      width: '150px',
      // The old cell did `lead.assignee.split(' ')[0]` with no guard, which
      // throws on an unassigned lead. Assignee is nullable — leads store a NAME
      // and there is nothing requiring one.
      render: (l) => (
        l.assignee
          ? (
            <div className="flex items-center gap-1.5">
              <Avatar name={l.assignee} size="xs" />
              <span className="truncate">{l.assignee}</span>
            </div>
          )
          : <span className="text-gray-300">Unassigned</span>
      ),
    },
    {
      key: 'lastActivity',
      label: 'Last activity',
      icon: Clock,
      sortable: true,
      width: '130px',
      render: (l) => <span className="text-gray-500">{l.lastActivity}</span>,
    },
  ]

  const pipeline = leads.reduce((sum, l) => sum + (Number(l.value) || 0), 0)
  const won      = leads.filter((l) => l.stage === 'Won').length

  return (
    <DataTable
      columns={columns}
      rows={leads}
      isLoading={false}
      selectable
      sort={{ field: sortField, dir: sortDir }}
      onSort={setSort}
      onRowClick={(l) => openDetail(l.id)}
      onAddNew={openAddModal}
      rowActions={(l) => {
        const perms = getPermissions(l)
        return [
          { label: 'Open', icon: Eye, onClick: () => openDetail(l.id) },
          perms.canEdit && {
            label: 'Edit', icon: Pencil, onClick: () => openEditModal(l.id),
          },
          perms.canSchedule && {
            label: 'Schedule meeting',
            icon: Calendar,
            onClick: () => openAddModalWithPrefill({
              relatedType:  'Lead',
              relatedId:    l.id,
              relatedLabel: `${l.name} — ${l.company}`,
              title:        `Meeting — ${l.company}`,
              participants: l.name ? [l.name] : [],
            }),
          },
          perms.canDelete && {
            label: 'Delete',
            icon: Trash2,
            danger: true,
            onClick: () => {
              if (confirm(`Delete lead "${l.name}"?`)) deleteLead(l.id)
            },
          },
        ].filter(Boolean)
      }}
      aggregates={[
        { label: 'Leads',    value: leads.length },
        { label: 'Pipeline', value: fmt(pipeline) },
        { label: 'Won',      value: won },
      ]}
      empty={{
        icon: Target,
        title: 'No leads found',
        description: 'Try adjusting your search or filter criteria.',
      }}
    />
  )
}

export default LeadsTable
