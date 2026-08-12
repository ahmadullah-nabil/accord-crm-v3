import React, { useState } from 'react'
import { Search, SlidersHorizontal, Plus, LayoutList, Kanban, X, User, Upload, Download } from 'lucide-react'
import { useLeadsStore, STAGES, PRIORITIES, SOURCES } from '../../stores/leadsStore.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'
import { useAuthStore }  from '../../stores/authStore.js'
import { isManager }     from '../../lib/permissions.js'
import { ImportModal }   from '../import-export/ImportModal.jsx'
import { ExportButton }  from '../import-export/ExportButton.jsx'
import { useQueryClient } from '@tanstack/react-query'

export function LeadsToolbar() {
  const {
    searchQuery, setSearchQuery,
    stageFilter, setStageFilter,
    priorityFilter, setPriorityFilter,
    sourceFilter, setSourceFilter,
    assigneeFilter, setAssigneeFilter,
    viewMode, setViewMode,
    openAddModal, clearFilters,
  } = useLeadsStore()

  const user = useAuthStore((s) => s.user)
  const canImport = isManager(user)
  const [showImport, setShowImport] = useState(false)
  const qc = useQueryClient()

  const isMineActive =
    assigneeFilter === (user?.name ?? '') &&
    stageFilter === 'All' && priorityFilter === 'All' &&
    sourceFilter === 'All' && searchQuery === ''

  const hasFilters =
    searchQuery || stageFilter !== 'All' || priorityFilter !== 'All' ||
    sourceFilter !== 'All' || assigneeFilter !== 'All'
  const { names: assigneeNames } = useAssignableMembers()

  return (
    <div className="card px-4 py-3 space-y-3">
      {/* Quick tabs: All / Mine */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={clearFilters}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
            ${!isMineActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          All Leads
        </button>
        <button
          onClick={() => { clearFilters(); setAssigneeFilter(user?.name ?? 'All') }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
            ${isMineActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <User size={11} /> Mine
        </button>
      </div>

      {/* Row 1: search + view toggle + add */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search leads by name, company or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-base pl-9 py-2 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
              ${viewMode === 'table' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <LayoutList size={13} /> Table
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
              ${viewMode === 'kanban' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Kanban size={13} /> Kanban
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {canImport && (
            <button
              onClick={() => setShowImport(true)}
              className="btn-secondary py-2 text-sm flex items-center gap-1.5"
              title="Import leads from CSV"
            >
              <Upload size={14} /> Import
            </button>
          )}
          <ExportButton entityType="lead" />
          <button onClick={openAddModal} className="btn-primary py-2 text-sm">
            <Plus size={15} /> Add Lead
          </button>
        </div>
      </div>

      {showImport && (
        <ImportModal
          entityType="lead"
          onClose={() => setShowImport(false)}
          onSuccess={(count) => {
            setShowImport(false)
            qc.invalidateQueries({ queryKey: ['leads'] })
          }}
        />
      )}

      {/* Row 2: filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <SlidersHorizontal size={13} className="text-gray-400 flex-shrink-0" />

        <FilterSelect label="Stage"    value={stageFilter}    onChange={setStageFilter}    options={STAGES} />
        <FilterSelect label="Priority" value={priorityFilter} onChange={setPriorityFilter} options={PRIORITIES} />
        <FilterSelect label="Source"   value={sourceFilter}   onChange={setSourceFilter}   options={SOURCES} />
        <FilterSelect label="Assignee" value={assigneeFilter} onChange={setAssigneeFilter} options={assigneeNames} />

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium ml-1"
          >
            <X size={11} /> Clear
          </button>
        )}
      </div>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`text-xs font-medium rounded-lg px-2.5 py-1.5 border outline-none cursor-pointer transition-all duration-150
        ${value !== 'All'
          ? 'bg-teal-50 border-teal-300 text-teal-700'
          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
        }`}
    >
      <option value="All">{label}: All</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
