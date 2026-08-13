// ─── LeadsToolbar ─────────────────────────────────────────────────────────────
//
// step041. The three-row card is now one ViewHeader row.
//
// The old toolbar was a `card` holding three stacked rows: All/Mine tabs, then
// search + view toggle + actions, then a row of filter selects. Around 140px
// before the first lead. This is one row on the page, no card, no shadow.
//
// EVERYTHING FUNCTIONAL IS CARRIED OVER
// ─────────────────────────────────────
// Same four filters, same isManager() gate on Import, same ExportButton, same
// ImportModal with its ['leads'] invalidation, same All/Mine presets, same
// Table/Kanban toggle. Only the layout moved.
//
// WHERE THE TWO EXTRA CONTROLS WENT
// ─────────────────────────────────
// Contacts needed neither of these, so ViewHeader had nowhere to put them. It
// now takes a `leading` slot on the left, beside the count, and both live
// there — because both change WHICH ROWS OR WHAT FRAME you are looking at,
// which is what the left side of the header already states. Import, Export and
// New Lead stay on the right in `actions`, because they act on the data rather
// than describe it.
//
// isMineActive keeps its original definition: assignee is me AND every other
// filter is clear. That is stricter than "assignee is me" and deliberately so
// — with a stage filter also applied, neither tab is the truth, and lighting
// one up would claim otherwise.

import React, { useState } from 'react'
import { Plus, Upload, LayoutList, Kanban, User } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useLeadsStore, STAGES, PRIORITIES, SOURCES } from '../../stores/leadsStore.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'
import { useAuthStore }  from '../../stores/authStore.js'
import { isManager }     from '../../lib/permissions.js'
import { ImportModal }   from '../import-export/ImportModal.jsx'
import { ExportButton }  from '../import-export/ExportButton.jsx'
import { ViewHeader }    from '../ui/ViewHeader.jsx'
import { Segmented, SegButton } from '../ui/Segmented.jsx'

export function LeadsToolbar({ total, filtered }) {
  const {
    searchQuery, setSearchQuery,
    stageFilter, setStageFilter,
    priorityFilter, setPriorityFilter,
    sourceFilter, setSourceFilter,
    assigneeFilter, setAssigneeFilter,
    viewMode, setViewMode,
    openAddModal, clearFilters,
  } = useLeadsStore()

  const user      = useAuthStore((s) => s.user)
  const canImport = isManager(user)
  const [showImport, setShowImport] = useState(false)
  const qc = useQueryClient()

  const { names: assigneeNames } = useAssignableMembers()

  const isMineActive =
    assigneeFilter === (user?.name ?? '') &&
    stageFilter === 'All' && priorityFilter === 'All' &&
    sourceFilter === 'All' && searchQuery === ''

  const hasFilters =
    Boolean(searchQuery) || stageFilter !== 'All' || priorityFilter !== 'All' ||
    sourceFilter !== 'All' || assigneeFilter !== 'All'

  return (
    <>
      <ViewHeader
        title={isMineActive ? 'My leads' : 'All leads'}
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
          placeholder: 'Search leads',
        }}
        filters={[
          { label: 'Stage',    value: stageFilter,    onChange: setStageFilter,    options: STAGES },
          { label: 'Priority', value: priorityFilter, onChange: setPriorityFilter, options: PRIORITIES },
          { label: 'Source',   value: sourceFilter,   onChange: setSourceFilter,   options: SOURCES },
          { label: 'Assignee', value: assigneeFilter, onChange: setAssigneeFilter, options: assigneeNames },
        ]}
        hasFilters={hasFilters}
        onClearFilters={clearFilters}
        actions={
          <>
            {canImport && (
              <button
                onClick={() => setShowImport(true)}
                className="btn-secondary"
                title="Import leads from CSV"
              >
                <Upload size={14} /> Import
              </button>
            )}
            <ExportButton entityType="lead" />
            <button onClick={openAddModal} className="btn-primary">
              <Plus size={14} /> New lead
            </button>
          </>
        }
      />

      {showImport && (
        <ImportModal
          entityType="lead"
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            setShowImport(false)
            qc.invalidateQueries({ queryKey: ['leads'] })
          }}
        />
      )}
    </>
  )
}

// step044: Segmented and SegButton moved to components/ui/Segmented.jsx now
// that Opportunities is the second caller — which is the graduation condition
// the step041 note set for them. Markup unchanged.

export default LeadsToolbar
