// ─── NotificationsSummaryBar ──────────────────────────────────────────────────
//
// step046. Eight KPI cards → one row of chips, matching the four modules before
// it.
//
// WHAT WENT AND WHY
// ─────────────────
// The old bar was an up-to-7-across grid of ~76px cards with shadows, hover
// lifts and uppercase micro-labels — around 100px above a list whose job is
// showing notifications.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ THE "UNREAD" PILL WAS ON A DIFFERENT AXIS AND LIED ABOUT ITS OWN STATE  │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Six of the eight pills set categoryFilter. "Unread" set readFilter —    │
// │ a separate, independent filter — while sitting in the same row, shaped  │
// │ identically. Worse, its highlight read                                   │
// │                                                                          │
// │     active={readFilter === 'Unread' && categoryFilter === 'All'}        │
// │                                                                          │
// │ so filtering to Unread AND picking a category turned the Unread pill    │
// │ OFF while the unread filter was still applied. The row showed a filter  │
// │ as inactive that was actively hiding rows.                              │
// │                                                                          │
// │ Two axes cannot share one chip row: FacetChips has one `value`. Read    │
// │ state is now a Segmented in ViewHeader's `leading` slot, which is what  │
// │ that slot is for, and its highlight is a plain read of readFilter.      │
// └─────────────────────────────────────────────────────────────────────────┘
//
// The unread total is kept as plain text beside the chips — the old bar spent a
// whole card on it, and it is a number you read, not a control you press.

import React from 'react'
import { useNotificationsStore }  from '../../stores/notificationsStore.js'
import { NOTIFICATION_CATEGORIES, CATEGORY_CONFIG } from '../../lib/notificationsData.js'
import { FacetChips } from '../ui/FacetChips.jsx'

export function NotificationsSummaryBar({ notifications = [] }) {
  const { categoryFilter, setCategoryFilter } = useNotificationsStore()

  const total  = notifications.length
  const unread = notifications.filter((n) => !n.isRead).length

  const items = [
    { key: 'All', label: 'All', count: total },
    ...NOTIFICATION_CATEGORIES.map((cat) => ({
      key:      cat,
      label:    cat,
      count:    notifications.filter((n) => n.category === cat).length,
      // CATEGORY_CONFIG already carries the dot class the old cards used and
      // NotifTypeIcon reads. Kept as the single source of per-category colour
      // rather than inventing a second mapping that could drift from it.
      dotClass: CATEGORY_CONFIG[cat]?.dot,
    })),
  ]

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <FacetChips items={items} value={categoryFilter} onChange={setCategoryFilter} />
      {total > 0 && (
        <span className="text-xs text-gray-400 flex-shrink-0">
          <span className={`tnum font-medium ${unread > 0 ? 'text-teal-700' : 'text-gray-500'}`}>
            {unread}
          </span> unread
        </span>
      )}
    </div>
  )
}

export default NotificationsSummaryBar
