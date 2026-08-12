import React from 'react'
import { X, Eye, EyeOff, Pin, Trash2, Tag, Clock, User, Link2 } from 'lucide-react'
import { useNotificationsStore }              from '../../stores/notificationsStore.js'
import {
  useNotification, useMarkAsRead, useMarkAsUnread,
  useClearNotification, useTogglePin,
} from '../../hooks/useNotifications.js'
import { CATEGORY_CONFIG, TYPE_CONFIG, formatNotifDate } from '../../lib/notificationsData.js'
import { NotifTypeIcon }  from './NotifTypeIcon.jsx'
import { Skeleton, SkeletonText } from '../ui/Skeleton.jsx'

export function NotificationDetailPanel() {
  const { detailPanelOpen, closeDetail, selectedNotifId } = useNotificationsStore()

  const readMutation   = useMarkAsRead()
  const unreadMutation = useMarkAsUnread()
  const clearMutation  = useClearNotification()
  const pinMutation    = useTogglePin()

  const { data: notif, isLoading } = useNotification(
    detailPanelOpen ? selectedNotifId : null
  )

  // Auto-mark as read when opened
  React.useEffect(() => {
    if (notif && !notif.isRead && detailPanelOpen) {
      readMutation.mutate(notif.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notif?.id, detailPanelOpen])

  const handleClear = () => {
    if (!notif) return
    if (window.confirm('Dismiss this notification?')) {
      clearMutation.mutate(notif.id, { onSuccess: closeDetail })
    }
  }

  return (
    <>
      {detailPanelOpen && (
        <div className="fixed inset-0 bg-black/20 z-30" onClick={closeDetail} />
      )}

      <div
        className={`
          fixed inset-y-0 right-0 z-40 w-[400px] max-w-full bg-white shadow-card-lg
          flex flex-col transition-transform duration-300 ease-in-out
          ${detailPanelOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {isLoading ? (
          <PanelSkeleton onClose={closeDetail} />
        ) : !notif ? null : (
          <NotifPanelContent
            notif={notif}
            onClose={closeDetail}
            onToggleRead={() =>
              notif.isRead
                ? unreadMutation.mutate(notif.id)
                : readMutation.mutate(notif.id)
            }
            onTogglePin={() => pinMutation.mutate(notif.id)}
            onClear={handleClear}
          />
        )}
      </div>
    </>
  )
}

// ── Panel content ─────────────────────────────────────────────────────────────
function NotifPanelContent({ notif, onClose, onToggleRead, onTogglePin, onClear }) {
  const catCfg  = CATEGORY_CONFIG[notif.category] || CATEGORY_CONFIG['System']
  const typeCfg = TYPE_CONFIG[notif.type]         || TYPE_CONFIG['system_update']

  return (
    <>
      {/* Header */}
      <div className="p-5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <NotifTypeIcon type={notif.type} size={18} />
            <div className="min-w-0">
              <h3 className={`font-display font-bold text-base leading-snug
                ${notif.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                {notif.title}
              </h3>
              {!notif.isRead && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500" /> Unread
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onToggleRead}
              className="p-2 rounded-xl text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
              title={notif.isRead ? 'Mark as unread' : 'Mark as read'}
            >
              {notif.isRead ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button
              onClick={onTogglePin}
              className={`p-2 rounded-xl transition-colors
                ${notif.isPinned
                  ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                  : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
                }`}
              title={notif.isPinned ? 'Unpin' : 'Pin'}
            >
              <Pin size={15} />
            </button>
            <button
              onClick={onClear}
              className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Dismiss"
            >
              <Trash2 size={15} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Close"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Category + type badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${catCfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${catCfg.dot}`} />
            {notif.category}
          </span>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold
            ${typeCfg.bg} ${typeCfg.iconColor}`}>
            {typeCfg.label}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Full notification body */}
        <Section title="Message">
          <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-4">
            {notif.body}
          </p>
        </Section>

        {/* Details */}
        <Section title="Details">
          {notif.actor && (
            <InfoRow icon={User}  label="From"    value={notif.actor} />
          )}
          {notif.subject && (
            <InfoRow icon={Link2} label="Subject"  value={notif.subject} />
          )}
          <InfoRow
            icon={Clock}
            label="Received"
            value={formatNotifDate(notif.createdAt)}
          />
          {notif.relatedModule && notif.relatedId && (
            <div className="flex items-center gap-3 py-1.5">
              <Link2 size={14} className="text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-500 w-24 flex-shrink-0">Related</span>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full
                  bg-blue-50 text-blue-600`}>
                  {notif.relatedModule}
                </span>
                <span className="text-xs text-gray-600 font-medium">{notif.relatedId}</span>
              </div>
            </div>
          )}
        </Section>

        {/* Tags */}
        {notif.tags?.length > 0 && (
          <Section title="Tags">
            <div className="flex flex-wrap gap-2">
              {notif.tags.map((tag) => (
                <span key={tag}
                  className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                  <Tag size={10} /> {tag}
                </span>
              ))}
            </div>
          </Section>
        )}
      </div>
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Icon size={14} className="text-gray-400 flex-shrink-0" />
      <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-800 font-medium truncate">{value}</span>
    </div>
  )
}

function PanelSkeleton({ onClose }) {
  return (
    <>
      <div className="flex items-start justify-between p-5 border-b border-gray-100">
        <div className="flex items-start gap-3 flex-1">
          <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 ml-2">
          <X size={15} />
        </button>
      </div>
      <div className="p-5 space-y-5">
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-20 w-full rounded-xl" />
        <SkeletonText lines={3} />
      </div>
    </>
  )
}
