import React from 'react'
import { MoreHorizontal, Eye, EyeOff, Pin, Trash2, Bell } from 'lucide-react'
import { useNotificationsStore }                from '../../stores/notificationsStore.js'
import {
  useMarkAsRead, useMarkAsUnread,
  useClearNotification, useTogglePin,
} from '../../hooks/useNotifications.js'
import { CATEGORY_CONFIG, formatNotifTime }     from '../../lib/notificationsData.js'
import { NotifTypeIcon }                        from './NotifTypeIcon.jsx'
import { Skeleton }                             from '../ui/Skeleton.jsx'
import { EmptyState }                           from '../ui/EmptyState.jsx'

export function NotificationsList({ notifications, isLoading }) {
  const { openDetail } = useNotificationsStore()

  if (isLoading) return <ListSkeleton />

  if (!notifications.length) {
    return (
      <div className="card">
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="You're all caught up! Check back later for updates."
        />
      </div>
    )
  }

  // Separate pinned from others, then sort by date
  const pinned  = notifications.filter((n) => n.isPinned)
  const regular = notifications.filter((n) => !n.isPinned)

  return (
    <div className="space-y-3">
      {/* Pinned section */}
      {pinned.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2 px-1 flex items-center gap-1.5">
            <Pin size={10} /> Pinned
          </p>
          <div className="card overflow-hidden divide-y divide-gray-50">
            {pinned.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onOpen={() => openDetail(n.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Regular notifications */}
      {regular.length > 0 && (
        <div>
          {pinned.length > 0 && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2 px-1">
              All Notifications
            </p>
          )}
          <div className="card overflow-hidden divide-y divide-gray-50">
            {regular.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onOpen={() => openDetail(n.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────
function NotificationRow({ notification: n, onOpen }) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const readMutation    = useMarkAsRead()
  const unreadMutation  = useMarkAsUnread()
  const clearMutation   = useClearNotification()
  const pinMutation     = useTogglePin()

  const catCfg = CATEGORY_CONFIG[n.category] || CATEGORY_CONFIG['System']

  const handleRowClick = () => {
    if (!n.isRead) readMutation.mutate(n.id)
    onOpen()
  }

  return (
    <div
      className={`flex items-start gap-4 px-4 py-3.5 transition-colors duration-100 cursor-pointer group relative
        ${!n.isRead ? 'bg-teal-50/30 hover:bg-teal-50/50' : 'hover:bg-gray-50/60'}`}
      onClick={handleRowClick}
    >
      {/* Unread dot */}
      {!n.isRead && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
      )}

      {/* Type icon */}
      <div className="mt-0.5 flex-shrink-0">
        <NotifTypeIcon type={n.type} size={16} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm leading-tight ${n.isRead ? 'font-medium text-gray-700' : 'font-semibold text-gray-900'}`}>
            {n.title}
          </p>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Category badge */}
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 hidden sm:inline
              ${catCfg.color}`}>
              {n.category}
            </span>
            <span className="text-[10px] text-gray-400 whitespace-nowrap">
              {formatNotifTime(n.createdAt)}
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
          {n.body}
        </p>

        {n.actor && n.actor !== 'System' && (
          <p className="text-[10px] text-gray-400 mt-1">by {n.actor}</p>
        )}
      </div>

      {/* Actions menu */}
      <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100
            transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal size={14} />
        </button>

        {menuOpen && (
          <RowMenu
            isRead={n.isRead}
            isPinned={n.isPinned}
            onToggleRead={() => {
              if (n.isRead) unreadMutation.mutate(n.id)
              else readMutation.mutate(n.id)
              setMenuOpen(false)
            }}
            onTogglePin={() => { pinMutation.mutate(n.id); setMenuOpen(false) }}
            onClear={() => { clearMutation.mutate(n.id); setMenuOpen(false) }}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>
    </div>
  )
}

// ── Row dropdown menu ─────────────────────────────────────────────────────────
function RowMenu({ isRead, isPinned, onToggleRead, onTogglePin, onClear, onClose }) {
  React.useEffect(() => {
    const handler = () => onClose()
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [onClose])

  return (
    <div className="absolute right-4 top-10 z-20 bg-white rounded-xl shadow-card-lg border
      border-gray-100 py-1 min-w-[160px] animate-fade-in">
      <MenuItem
        icon={isRead ? EyeOff : Eye}
        label={isRead ? 'Mark as unread' : 'Mark as read'}
        onClick={onToggleRead}
      />
      <MenuItem
        icon={Pin}
        label={isPinned ? 'Unpin' : 'Pin'}
        onClick={onTogglePin}
      />
      <MenuItem
        icon={Trash2}
        label="Dismiss"
        onClick={onClear}
        danger
      />
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors
        ${danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ListSkeleton() {
  return (
    <div className="card overflow-hidden divide-y divide-gray-50">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 px-4 py-3.5">
          <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between gap-4">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}
