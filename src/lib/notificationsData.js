// ─── Notification UI Constants ──────────────────────────────────────────────
// Mock data and delay-based fetch functions removed.
// All CRUD now uses notificationsService.js (real Supabase).

export const NOTIFICATION_CATEGORIES = [
  'Leads', 'Tasks', 'Meetings', 'Deals', 'System', 'Team Activity',
]

export const NOTIFICATION_TYPES = [
  'deal_won', 'deal_lost', 'lead_created', 'lead_moved',
  'task_completed', 'task_overdue', 'meeting_scheduled',
  'meeting_cancelled', 'team_activity', 'system_update',
]

export const CATEGORY_CONFIG = {
  'Leads':         { color: 'bg-blue-50 text-blue-700',    dot: 'bg-blue-500',    icon: 'Target'    },
  'Tasks':         { color: 'bg-amber-50 text-amber-700',  dot: 'bg-amber-500',   icon: 'CheckSquare'},
  'Meetings':      { color: 'bg-teal-50 text-teal-700',    dot: 'bg-teal-500',    icon: 'Calendar'  },
  'Deals':         { color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', icon: 'TrendingUp'},
  'System':        { color: 'bg-gray-100 text-gray-600',   dot: 'bg-gray-400',    icon: 'Settings'  },
  'Team Activity': { color: 'bg-purple-50 text-purple-700',dot: 'bg-purple-500',  icon: 'Users'     },
}

export const TYPE_CONFIG = {
  'deal_won':          { label: 'Deal Won',          iconColor: 'text-emerald-500', bg: 'bg-emerald-50' },
  'deal_lost':         { label: 'Deal Lost',         iconColor: 'text-red-400',     bg: 'bg-red-50'     },
  'lead_created':      { label: 'Lead Created',      iconColor: 'text-blue-500',    bg: 'bg-blue-50'    },
  'lead_moved':        { label: 'Lead Moved',        iconColor: 'text-indigo-500',  bg: 'bg-indigo-50'  },
  'task_completed':    { label: 'Task Completed',    iconColor: 'text-teal-500',    bg: 'bg-teal-50'    },
  'task_overdue':      { label: 'Task Overdue',      iconColor: 'text-orange-500',  bg: 'bg-orange-50'  },
  'meeting_scheduled': { label: 'Meeting Scheduled', iconColor: 'text-blue-500',    bg: 'bg-blue-50'    },
  'meeting_cancelled': { label: 'Meeting Cancelled', iconColor: 'text-red-400',     bg: 'bg-red-50'     },
  'team_activity':     { label: 'Team Activity',     iconColor: 'text-purple-500',  bg: 'bg-purple-50'  },
  'system_update':     { label: 'System',            iconColor: 'text-gray-400',    bg: 'bg-gray-100'   },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatNotifTime(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now  = new Date()
  const diff = Math.floor((now - date) / 1000)

  if (diff < 60)           return 'just now'
  if (diff < 3600)         return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)        return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7)    return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function formatNotifDate(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
