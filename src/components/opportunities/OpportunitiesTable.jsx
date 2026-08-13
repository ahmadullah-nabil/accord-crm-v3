// ─── OpportunitiesTable ───────────────────────────────────────────────────────
//
// step044. Third consumer of the DataTable primitive. 186 lines → this.
//
// The header markup, sort chevrons, row hover, the row action menu and its
// outside-click handler, the skeleton and the empty state are the primitive's
// job now. What is left is what is genuinely about deals: which columns exist
// and how each cell renders.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ THREE THINGS CHANGED THAT ARE NOT LAYOUT. ALL THREE ARE FLAGGED.        │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ 1. THE SCHEDULE-MEETING PREFILL WAS WRITING A LIE.                       │
// │    It sent `relatedType: 'Lead'` with an OPPORTUNITY id. There is no     │
// │    lead with that id, so the meeting was filed against a phantom: it     │
// │    never appeared on any record's Meetings list (useLeadMeetings         │
// │    matches relatedType 'Lead' AND a lead id, and an opportunity id is    │
// │    neither), while /meetings displayed it labelled "Lead". Rows that     │
// │    save successfully and land nowhere findable — the step038 class.      │
// │                                                                          │
// │    'Opportunity' is NOT a fix available in this batch: RELATED_TYPES in  │
// │    lib/meetingsData.js is ['Lead','Contact','None'] and there is no      │
// │    useOpportunityMeetings hook, so the value would be unselectable in    │
// │    the form and unreadable everywhere. That is a vocabulary decision,    │
// │    adjacent to the crm_entity_type landmine, and it is not made here.    │
// │                                                                          │
// │    So the prefill now carries the TITLE and no relation at all, letting  │
// │    the form's own 'None' default stand. The meeting is created,          │
// │    correctly unattributed, instead of falsely attributed. Nothing that   │
// │    worked stopped working — the link never worked.                       │
// │                                                                          │
// │ 2. ROW ACTIONS ARE NOW PERMISSION-GATED. OppDetailPanel has always       │
// │    gated Edit and Delete through useOpportunityPermissions; this table   │
// │    never did, so the row menu offered deletes the panel refused on the   │
// │    same deal. useBatchOpportunityPermissions already existed for exactly │
// │    this and had no callers. This applies the module's OWN existing       │
// │    policy to the surface that skipped it — it does not invent one.       │
// │    Say the word and it reverts to ungated.                               │
// │                                                                          │
// │ 3. A LAST ACTIVITY COLUMN. The store's default sortField is              │
// │    'lastActivity' and no column rendered it, so the table arrived sorted │
// │    by an invisible key with no sort indicator anywhere.                  │
// └─────────────────────────────────────────────────────────────────────────┘
//
// An action the user cannot perform is ABSENT, not disabled — a disabled item
// still advertises a capability they do not have.

import React from 'react'
import {
  Briefcase, Tag, DollarSign, Percent, TrendingUp, CalendarClock,
  User, Clock, Eye, Pencil, Trash2, Calendar,
} from 'lucide-react'
import {
  useOpportunitiesStore, OPP_STAGE_COLORS,
} from '../../stores/opportunitiesStore.js'
import { useMeetingsStore }             from '../../stores/meetingsStore.js'
import { useDeleteOpportunity }         from '../../hooks/useOpportunities.js'
import { useBatchOpportunityPermissions } from '../../hooks/usePermissions.js'
import { Avatar }    from '../ui/Avatar.jsx'
import { DataTable } from '../ui/DataTable.jsx'

const fmt = (n) =>
  n >= 1_000_000 ? `৳${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `৳${(n / 1_000).toFixed(0)}K`
  : `৳${n ?? 0}`

export function OpportunitiesTable({ opportunities = [], isLoading }) {
  const {
    sortField, sortDir, setSort,
    openDetail, openEditModal, openAddModal,
  } = useOpportunitiesStore()

  const { openAddModalWithPrefill } = useMeetingsStore()
  const { getPermissions } = useBatchOpportunityPermissions()
  const deleteMutation = useDeleteOpportunity()

  const columns = [
    {
      key: 'title',
      label: 'Deal',
      icon: Briefcase,
      sortable: true,
      width: '280px',
      render: (o) => (
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-gray-900 truncate">{o.title}</span>
          {o.company && <span className="text-gray-400 truncate">· {o.company}</span>}
        </div>
      ),
    },
    {
      key: 'stage',
      label: 'Stage',
      icon: Tag,
      sortable: true,
      width: '140px',
      // A badge, not a dropdown. Leads' table has an inline stage select
      // because it always had one; this table never did, and adding inline
      // editing is its own batch with its own validation and error surface —
      // see the step038 lesson. The Kanban is still the way to move a stage.
      render: (o) => {
        const sc = OPP_STAGE_COLORS[o.stage] ?? OPP_STAGE_COLORS.New
        return (
          <span className={`badge ${sc.light}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.bg}`} />
            {o.stage}
          </span>
        )
      },
    },
    {
      key: 'value',
      label: 'Value',
      icon: DollarSign,
      sortable: true,
      align: 'right',
      width: '110px',
      render: (o) => <span className="font-medium text-gray-800 tnum">{fmt(o.value)}</span>,
    },
    {
      key: 'probability',
      label: 'Prob.',
      icon: Percent,
      sortable: true,
      align: 'right',
      width: '80px',
      render: (o) => <span className="text-gray-500 tnum">{o.probability}%</span>,
    },
    {
      key: 'expectedRevenue',
      label: 'Exp. revenue',
      icon: TrendingUp,
      sortable: true,
      align: 'right',
      width: '130px',
      render: (o) => (
        <span className="font-medium text-emerald-600 tnum">{fmt(o.expectedRevenue)}</span>
      ),
    },
    {
      key: 'expectedCloseDate',
      label: 'Close date',
      icon: CalendarClock,
      sortable: true,
      width: '120px',
      render: (o) => (
        o.expectedCloseDate
          ? <span className="text-gray-500">{o.expectedCloseDate}</span>
          : <span className="text-gray-300">—</span>
      ),
    },
    {
      key: 'assignee',
      label: 'Assignee',
      icon: User,
      sortable: true,
      width: '150px',
      // The old cell did `opp.assignee.split(' ')[0]` behind a truthiness
      // guard, showing only a first name. Assignee is a NAME with no user id
      // (see the invariant), and two people called Rahman are indistinguishable
      // at first-name resolution. Full name, same as every other table.
      render: (o) => (
        o.assignee
          ? (
            <div className="flex items-center gap-1.5">
              <Avatar name={o.assignee} size="xs" />
              <span className="truncate">{o.assignee}</span>
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
      render: (o) => <span className="text-gray-500">{o.lastActivity || '—'}</span>,
    },
  ]

  // Open pipeline excludes Won and Lost — a settled deal in the pipeline
  // number flatters or drags it depending on which way the quarter went.
  const open     = opportunities.filter((o) => !['Won', 'Lost'].includes(o.stage))
  const pipeline = open.reduce((s, o) => s + (Number(o.value) || 0), 0)
  const expected = open.reduce((s, o) => s + (Number(o.expectedRevenue) || 0), 0)
  const won      = opportunities.filter((o) => o.stage === 'Won').length

  return (
    <DataTable
      columns={columns}
      rows={opportunities}
      isLoading={isLoading}
      selectable
      sort={{ field: sortField, dir: sortDir }}
      onSort={setSort}
      onRowClick={(o) => openDetail(o.id)}
      onAddNew={openAddModal}
      rowActions={(o) => {
        const perms = getPermissions(o)
        return [
          { label: 'Open', icon: Eye, onClick: () => openDetail(o.id) },
          perms.canEdit && {
            label: 'Edit', icon: Pencil, onClick: () => openEditModal(o.id),
          },
          perms.canEdit && {
            label: 'Schedule meeting',
            icon: Calendar,
            // step045: the relation is back, and correct this time.
            //
            // step044 stripped relatedType/relatedId here because the prefill
            // sent 'Lead' with an opportunity id — a meeting filed against a
            // record that does not exist. Leaving it unattributed was the safe
            // move while 'Opportunity' was not a value the form could produce.
            // It is now, so the deal's Meetings tab can actually find this.
            //
            // Kept identical to the tab's prefill in OppRecordContent on
            // purpose: two surfaces that schedule against the same deal must
            // not write two different shapes of the same link.
            onClick: () => openAddModalWithPrefill({
              relatedType: 'Opportunity', relatedId: o.id,
              relatedLabel: [o.title, o.company].filter(Boolean).join(' — '),
              title: `Meeting — ${o.company || o.title}`,
            }),
          },
          perms.canDelete && {
            label: 'Delete',
            icon: Trash2,
            danger: true,
            onClick: () => {
              if (confirm(`Delete deal "${o.title}"?`)) deleteMutation.mutate(o.id)
            },
          },
        ].filter(Boolean)
      }}
      aggregates={[
        { label: 'Deals',        value: opportunities.length },
        { label: 'Open pipeline', value: fmt(pipeline) },
        { label: 'Expected',     value: fmt(expected) },
        { label: 'Won',          value: won },
      ]}
      empty={{
        icon: Briefcase,
        title: 'No deals found',
        description: 'Try adjusting your search or filter criteria.',
      }}
    />
  )
}

export default OpportunitiesTable
