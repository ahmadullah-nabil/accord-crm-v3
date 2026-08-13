// ─── NotificationsPage ────────────────────────────────────────────────────────
//
// step046. The page heading block is gone, matching the four migrated modules.
//
// It was a 36px teal icon tile carrying an unread badge, an <h1> reading
// "Notifications" and a subtitle reading "N unread notifications" — on a page
// reached by clicking "Notifications" in the sidebar, under a top bar already
// reading the same word.
//
// The unread count is not lost: it is text beside the chip row, and the
// All/Unread/Read toggle in the header is the control that acts on it.
//
// NO RECORD ROUTE HERE, DELIBERATELY. A notification is an event, not a record:
// nothing links to one, nothing has a relation to one, and the detail panel's
// job is to show it once and mark it read. Giving it a URL would be a route
// nobody can arrive at from anywhere except this list.
//
// Spacing drops from space-y-4 to space-y-2 to match the others: the chips, the
// header row and the list are one block, and 16px gutters between them read as
// three separate cards.

import React from 'react'
import { useNotifications }              from '../hooks/useNotifications.js'
import { useNotificationsStore }         from '../stores/notificationsStore.js'
import { NotificationsSummaryBar }       from '../components/notifications/NotificationsSummaryBar.jsx'
import { NotificationsToolbar }          from '../components/notifications/NotificationsToolbar.jsx'
import { NotificationsList }             from '../components/notifications/NotificationsList.jsx'
import { NotificationDetailPanel }       from '../components/notifications/NotificationDetailPanel.jsx'

export function NotificationsPage() {
  const { data: allNotifs = [], isLoading, isError } = useNotifications()
  const { applyFilters } = useNotificationsStore()

  const filtered    = applyFilters(allNotifs)
  const unreadCount = allNotifs.filter((n) => !n.isRead).length

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-sm text-red-500">Failed to load notifications. Please try again.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2 max-w-[900px]">
        <NotificationsSummaryBar notifications={allNotifs} />
        <NotificationsToolbar
          total={allNotifs.length}
          filtered={filtered.length}
          unreadCount={unreadCount}
        />
        <NotificationsList notifications={filtered} isLoading={isLoading} />
      </div>

      <NotificationDetailPanel />
    </>
  )
}

export default NotificationsPage
