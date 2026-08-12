import React from 'react'
import {
  TrendingUp, TrendingDown, Target, ArrowRight,
  CheckCircle2, AlertCircle, Calendar, XCircle,
  Users, Settings,
} from 'lucide-react'
import { TYPE_CONFIG } from '../../lib/notificationsData.js'

const TYPE_ICONS = {
  'deal_won':          TrendingUp,
  'deal_lost':         TrendingDown,
  'lead_created':      Target,
  'lead_moved':        ArrowRight,
  'task_completed':    CheckCircle2,
  'task_overdue':      AlertCircle,
  'meeting_scheduled': Calendar,
  'meeting_cancelled': XCircle,
  'team_activity':     Users,
  'system_update':     Settings,
}

export function NotifTypeIcon({ type, size = 15 }) {
  const cfg  = TYPE_CONFIG[type] || TYPE_CONFIG['system_update']
  const Icon = TYPE_ICONS[type] || Settings

  return (
    <div className={`flex items-center justify-center rounded-xl flex-shrink-0 ${cfg.bg}`}
      style={{ width: size * 2.2, height: size * 2.2 }}>
      <Icon size={size * 0.9} className={cfg.iconColor} />
    </div>
  )
}
