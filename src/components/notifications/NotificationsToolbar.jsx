import React from 'react'
import { Search, SlidersHorizontal, X, CheckCheck, Trash2 } from 'lucide-react'
import { useNotificationsStore }           from '../../stores/notificationsStore.js'
import { useMarkAllAsRead, useClearAllRead } from '../../hooks/useNotifications.js'
import { NOTIFICATION_CATEGORIES }          from '../../lib/notificationsData.js'

const READ_FILTERS = ['All', 'Unread', 'Read']

export function NotificationsToolbar({ total, unreadCount }) {
  const {
    searchQuery, setSearchQuery,
    categoryFilter, setCategoryFilter,
    readFilter, setReadFilter,
    clearFilters,
  } = useNotificationsStore()

  const markAllMutation  = useMarkAllAsRead()
  const clearReadMutation = useClearAllRead()

  const hasFilters = searchQuery || categoryFilter !== 'All' || readFilter !== 'All'

  return (
    <div className="card px-4 py-3 space-y-3">
      {/* Row 1: search + bulk actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search notifications…"
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
            {total} total · {unreadCount} unread
          </span>
        )}

        {/* Mark all as read */}
        {unreadCount > 0 && (
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="btn-secondary py-2 text-xs flex-shrink-0 gap-1.5"
          >
            <CheckCheck size={13} />
            Mark all read
          </button>
        )}

        {/* Clear all read */}
        <button
          onClick={() => {
            if (window.confirm('Remove all read notifications?')) {
              clearReadMutation.mutate()
            }
          }}
          disabled={clearReadMutation.isPending}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 font-medium transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50 flex-shrink-0"
        >
          <Trash2 size={12} />
          Clear read
        </button>
      </div>

      {/* Row 2: filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <SlidersHorizontal size={13} className="text-gray-400 flex-shrink-0" />

        {/* Read state toggle pills */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {READ_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setReadFilter(f)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150
                ${readFilter === f
                  ? 'bg-white text-gray-900 shadow-card'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <FilterSelect
          label="Category"
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={NOTIFICATION_CATEGORIES}
        />

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
