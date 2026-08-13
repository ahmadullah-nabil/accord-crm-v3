// ─── NotificationsToolbar ─────────────────────────────────────────────────────
//
// step046. The two-row card becomes one ViewHeader row.
//
// EVERY FUNCTIONAL DETAIL IS CARRIED OVER: the search field and its clear
// button, the read-state toggle, Mark all read (still shown only when there is
// something unread), Clear read and its confirm, and clearFilters.
//
// WHAT MOVED WHERE, AND WHY THE DISTINCTION IS REAL
// ─────────────────────────────────────────────────
// `leading` — the All / Unread / Read toggle. It changes WHICH ROWS are the
// subject and nothing about them, which is what the left slot is for.
//
// `actions` — Mark all read and Clear read. These WRITE. Clear read deletes
// rows. They belong on the right with the other things that do something to the
// data, as far from the frame toggles as the row allows.
//
// The category select is gone from here because the chip row above IS the
// category filter now. Two controls for one filter is one more than can be
// right, and the pair could disagree.

import React from 'react'
import { CheckCheck, Trash2 } from 'lucide-react'
import { useNotificationsStore }               from '../../stores/notificationsStore.js'
import { useMarkAllAsRead, useClearAllRead }   from '../../hooks/useNotifications.js'
import { ViewHeader }                          from '../ui/ViewHeader.jsx'
import { Segmented, SegButton }                from '../ui/Segmented.jsx'

const READ_FILTERS = ['All', 'Unread', 'Read']

export function NotificationsToolbar({ total, filtered, unreadCount }) {
  const {
    searchQuery, setSearchQuery,
    categoryFilter,
    readFilter, setReadFilter,
    clearFilters,
  } = useNotificationsStore()

  const markAllMutation   = useMarkAllAsRead()
  const clearReadMutation = useClearAllRead()

  const hasFilters = Boolean(searchQuery) || categoryFilter !== 'All' || readFilter !== 'All'

  return (
    <ViewHeader
      title="Notifications"
      count={filtered}
      total={total}
      leading={
        <Segmented>
          {READ_FILTERS.map((f) => (
            // A plain read of readFilter — the old pill's highlight also
            // depended on categoryFilter, so it could show OFF while on.
            <SegButton key={f} active={readFilter === f} onClick={() => setReadFilter(f)}>
              {f}
            </SegButton>
          ))}
        </Segmented>
      }
      search={{
        value: searchQuery,
        onChange: setSearchQuery,
        placeholder: 'Search notifications',
      }}
      hasFilters={hasFilters}
      onClearFilters={clearFilters}
      actions={
        <>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                         text-gray-600 hover:text-gray-900 hover:bg-gray-100
                         transition-colors duration-120 disabled:opacity-40"
            >
              <CheckCheck size={12} /> Mark all read
            </button>
          )}
          <button
            onClick={() => {
              if (window.confirm('Remove all read notifications?')) {
                clearReadMutation.mutate()
              }
            }}
            disabled={clearReadMutation.isPending}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                       text-gray-500 hover:text-red-600 hover:bg-red-50
                       transition-colors duration-120 disabled:opacity-40"
          >
            <Trash2 size={12} /> Clear read
          </button>
        </>
      }
    />
  )
}

export default NotificationsToolbar
