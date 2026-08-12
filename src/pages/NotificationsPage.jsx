import React from 'react'
import { Bell } from 'lucide-react'
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
      <div className="space-y-4 max-w-[900px]">
        {/* Page heading */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center ring-1 ring-teal-200">
              <Bell size={18} className="text-teal-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-teal-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="font-display font-bold text-gray-900 text-xl leading-tight">
                Notifications
              </h1>
              <p className="text-xs text-gray-500">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                  : 'All caught up'}
              </p>
            </div>
          </div>
        </div>

        {/* Summary bar */}
        <NotificationsSummaryBar notifications={allNotifs} />

        {/* Toolbar */}
        <NotificationsToolbar total={allNotifs.length} unreadCount={unreadCount} />

        {/* List */}
        <NotificationsList notifications={filtered} isLoading={isLoading} />
      </div>

      {/* Detail panel */}
      <NotificationDetailPanel />
    </>
  )
}

export default NotificationsPage
