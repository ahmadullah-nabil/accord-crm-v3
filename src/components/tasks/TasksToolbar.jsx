import React from 'react'
import { Search, SlidersHorizontal, Plus, X, User, AlertCircle, Clock } from 'lucide-react'
import { useTasksStore }   from '../../stores/tasksStore.js'
import { useAuthStore }    from '../../stores/authStore.js'
import { TASK_STATUSES, TASK_PRIORITIES } from '../../lib/tasksData.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'

const QUICK_TABS = [
  { id: 'all',      label: 'All',      icon: null          },
  { id: 'mine',     label: 'Mine',     icon: User          },
  { id: 'overdue',  label: 'Overdue',  icon: AlertCircle   },
  { id: 'upcoming', label: 'Upcoming', icon: Clock         },
]

export function TasksToolbar({ total, filtered }) {
  const {
    searchQuery,    setSearchQuery,
    statusFilter,   setStatusFilter,
    priorityFilter, setPriorityFilter,
    assigneeFilter, setAssigneeFilter,
    openAddModal,   clearFilters,
  } = useTasksStore()

  const user = useAuthStore((s) => s.user)

  // Derive active quick tab from current filter state
  const activeQuickTab = (() => {
    const myName = user?.name ?? ''
    if (statusFilter === 'Overdue' && assigneeFilter === myName) return 'overdue'
    if (statusFilter === 'All'     && assigneeFilter === myName && !searchQuery) return 'mine'
    return 'all'
  })()

  const hasFilters =
    searchQuery || statusFilter !== 'All' || priorityFilter !== 'All' || assigneeFilter !== 'All'
  const { names: assigneeNames } = useAssignableMembers()

  const applyQuickTab = (tabId) => {
    clearFilters()
    if (tabId === 'mine') {
      setAssigneeFilter(user?.name ?? 'All')
    } else if (tabId === 'overdue') {
      setAssigneeFilter(user?.name ?? 'All')
      setStatusFilter('Overdue')
    }
    // 'all' — clearFilters() above is sufficient
  }

  return (
    <div className="card px-4 py-3 space-y-3">
      {/* Quick tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {QUICK_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => applyQuickTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
              ${activeQuickTab === id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
              }
              ${id === 'overdue' && activeQuickTab !== id ? 'hover:text-red-500' : ''}
            `}
          >
            {Icon && <Icon size={11} />}
            {label}
          </button>
        ))}
      </div>

      {/* Row 1: search + count + add */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by title, assignee, or related contact…"
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

        {total !== undefined && (
          <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:inline">
            {filtered} of {total}
          </span>
        )}

        <button onClick={openAddModal} className="btn-primary py-2 text-sm flex-shrink-0">
          <Plus size={15} /> Add Task
        </button>
      </div>

      {/* Row 2: filter selects */}
      <div className="flex items-center gap-2 flex-wrap">
        <SlidersHorizontal size={13} className="text-gray-400 flex-shrink-0" />

        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={TASK_STATUSES}
        />
        <FilterSelect
          label="Priority"
          value={priorityFilter}
          onChange={setPriorityFilter}
          options={TASK_PRIORITIES}
        />
        <FilterSelect
          label="Assignee"
          value={assigneeFilter}
          onChange={setAssigneeFilter}
          options={assigneeNames}
        />

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium"
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
      className={`text-xs font-medium rounded-lg px-2.5 py-1.5 border outline-none cursor-pointer
        transition-all duration-150
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
