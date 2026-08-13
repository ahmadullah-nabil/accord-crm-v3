// ─── OpportunitiesToolbar ─────────────────────────────────────────────────────
//
// step044. The three-row card is now one ViewHeader row.
//
// The old toolbar was a `card` holding three stacked rows: All Deals / Mine
// tabs, then search + "N of M" + view toggle + actions, then a row of filter
// selects. Around 140px before the first deal. This is one row on the page, no
// card, no shadow.
//
// EVERYTHING FUNCTIONAL IS CARRIED OVER
// ─────────────────────────────────────
// Same two filters, same ExportButton, same All/Mine presets, same
// Kanban/Table toggle, same "N of M" (which ViewHeader renders natively from
// `count` and `total`, so the hand-rolled span is gone rather than the number).
//
// NO IMPORT BUTTON — because there was not one. Leads and Contacts gate Import
// behind isManager(); Opportunities never had it. Adding it here would be a new
// feature wearing a migration's clothes, and importing deals has a stage and a
// probability to validate that a CSV round-trip has not been designed for.
//
// isMineActive keeps its original definition — assignee is me AND every other
// filter is clear. Stricter than "assignee is me", and deliberately so: with a
// stage filter also applied neither tab is the truth, and lighting one up would
// claim otherwise.

import React from 'react'
import { Plus, LayoutList, Kanban, User } from 'lucide-react'
import {
  useOpportunitiesStore, OPPORTUNITY_STAGES,
} from '../../stores/opportunitiesStore.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'
import { useAuthStore }   from '../../stores/authStore.js'
import { ExportButton }   from '../import-export/ExportButton.jsx'
import { ViewHeader }     from '../ui/ViewHeader.jsx'
import { Segmented, SegButton } from '../ui/Segmented.jsx'

export function OpportunitiesToolbar({ total, filtered }) {
  const {
    searchQuery, setSearchQuery,
    stageFilter, setStageFilter,
    assigneeFilter, setAssigneeFilter,
    viewMode, setViewMode,
    openAddModal, clearFilters,
  } = useOpportunitiesStore()

  const user = useAuthStore((s) => s.user)
  const { names: assigneeNames } = useAssignableMembers()

  const isMineActive =
    assigneeFilter === (user?.name ?? '') &&
    stageFilter === 'All' && searchQuery === ''

  const hasFilters =
    Boolean(searchQuery) || stageFilter !== 'All' || assigneeFilter !== 'All'

  return (
    <ViewHeader
      title={isMineActive ? 'My deals' : 'All deals'}
      count={filtered}
      total={total}
      leading={
        <>
          <Segmented>
            <SegButton active={!isMineActive} onClick={clearFilters}>
              All
            </SegButton>
            <SegButton
              active={isMineActive}
              onClick={() => { clearFilters(); setAssigneeFilter(user?.name ?? 'All') }}
            >
              <User size={11} /> Mine
            </SegButton>
          </Segmented>

          <Segmented>
            <SegButton active={viewMode === 'table'} onClick={() => setViewMode('table')}>
              <LayoutList size={12} /> Table
            </SegButton>
            <SegButton active={viewMode === 'kanban'} onClick={() => setViewMode('kanban')}>
              <Kanban size={12} /> Kanban
            </SegButton>
          </Segmented>
        </>
      }
      search={{
        value: searchQuery,
        onChange: setSearchQuery,
        placeholder: 'Search deals',
      }}
      filters={[
        { label: 'Stage',    value: stageFilter,    onChange: setStageFilter,    options: OPPORTUNITY_STAGES },
        { label: 'Assignee', value: assigneeFilter, onChange: setAssigneeFilter, options: assigneeNames },
      ]}
      hasFilters={hasFilters}
      onClearFilters={clearFilters}
      actions={
        <>
          <ExportButton entityType="opportunity" />
          <button onClick={openAddModal} className="btn-primary">
            <Plus size={14} /> New deal
          </button>
        </>
      }
    />
  )
}

export default OpportunitiesToolbar
