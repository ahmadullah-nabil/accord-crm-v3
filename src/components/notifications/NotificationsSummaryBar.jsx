import React from 'react'
import { useNotificationsStore }  from '../../stores/notificationsStore.js'
import { NOTIFICATION_CATEGORIES, CATEGORY_CONFIG } from '../../lib/notificationsData.js'

export function NotificationsSummaryBar({ notifications = [] }) {
  const { categoryFilter, setCategoryFilter, readFilter, setReadFilter } =
    useNotificationsStore()

  const total  = notifications.length
  const unread = notifications.filter((n) => !n.isRead).length

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
      {/* All pill */}
      <StatPill
        label="All"
        value={total}
        sub={`${unread} unread`}
        active={categoryFilter === 'All'}
        onClick={() => setCategoryFilter('All')}
        dotColor="bg-gray-500"
        urgentSub={unread > 0}
      />

      {/* Unread-only shortcut */}
      <StatPill
        label="Unread"
        value={unread}
        sub="need attention"
        active={readFilter === 'Unread' && categoryFilter === 'All'}
        onClick={() => {
          setCategoryFilter('All')
          setReadFilter(readFilter === 'Unread' ? 'All' : 'Unread')
        }}
        dotColor="bg-teal-500"
        urgentSub={unread > 0}
      />

      {/* Per-category pills */}
      {NOTIFICATION_CATEGORIES.map((cat) => {
        const catNotifs = notifications.filter((n) => n.category === cat)
        const catUnread = catNotifs.filter((n) => !n.isRead).length
        const cfg       = CATEGORY_CONFIG[cat]
        return (
          <StatPill
            key={cat}
            label={cat}
            value={catNotifs.length}
            sub={catUnread > 0 ? `${catUnread} unread` : 'all read'}
            active={categoryFilter === cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? 'All' : cat)}
            dotColor={cfg.dot}
            urgentSub={catUnread > 0}
          />
        )
      })}
    </div>
  )
}

function StatPill({ label, value, sub, active, onClick, dotColor, urgentSub }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl px-4 py-3 transition-all duration-200 border
        ${active
          ? 'bg-teal-500 text-white border-teal-500 shadow-glow-teal'
          : 'bg-white border-gray-100 shadow-card hover:shadow-card-md hover:-translate-y-0.5'
        }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
        <p className={`text-[10px] font-semibold uppercase tracking-wider truncate
          ${active ? 'text-teal-100' : 'text-gray-500'}`}>
          {label}
        </p>
      </div>
      <p className={`font-display font-bold text-lg leading-tight
        ${active ? 'text-white' : 'text-gray-900'}`}>
        {value}
      </p>
      <p className={`text-[10px] mt-0.5 truncate
        ${active ? 'text-teal-100' : urgentSub ? 'text-teal-600 font-medium' : 'text-gray-400'}`}>
        {sub}
      </p>
    </button>
  )
}
