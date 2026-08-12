import React from 'react'
import { Search, Plus, LayoutList, Kanban, X, User, SlidersHorizontal } from 'lucide-react'
import { useOpportunitiesStore, OPPORTUNITY_STAGES } from '../../stores/opportunitiesStore.js'
import { ExportButton } from '../import-export/ExportButton.jsx'
import { useAuthStore }   from '../../stores/authStore.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'

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
    assigneeFilter === (user?.name ?? '') && stageFilter === 'All' && !searchQuery
  const hasFilters = searchQuery || stageFilter !== 'All' || assigneeFilter !== 'All'

  return (
    <div className="card px-4 py-3 space-y-3">
      {/* Mine / All tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={clearFilters}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
            ${!isMineActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          All Deals
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
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search deals by title or company…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-base pl-9 py-2 text-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
        {total !== undefined && (
          <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:inline">{filtered} of {total}</span>
        )}
        <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
          {[['kanban', Kanban, 'Kanban'], ['table', LayoutList, 'Table']].map(([mode, Icon, lbl]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
                ${viewMode === mode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Icon size={13} /> {lbl}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ExportButton entityType="opportunity" />
          <button onClick={openAddModal} className="btn-primary py-2 text-sm">
            <Plus size={15} /> Add Deal
          </button>
        </div>
      </div>

      {/* Row 2: filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <SlidersHorizontal size={13} className="text-gray-400 flex-shrink-0" />
        <FilterSelect label="Stage"    value={stageFilter}    onChange={setStageFilter}    options={OPPORTUNITY_STAGES} />
        <FilterSelect label="Assignee" value={assigneeFilter} onChange={setAssigneeFilter} options={assigneeNames} />
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium">
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
        ${value !== 'All' ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
    >
      <option value="All">{label}: All</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
