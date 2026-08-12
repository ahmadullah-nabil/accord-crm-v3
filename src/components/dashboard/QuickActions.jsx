import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Calendar, CheckSquare, Users,
  Target, Phone, Mail, FileText,
} from 'lucide-react'

const ACTIONS = [
  { id: 'new-lead',    icon: Target,      label: 'New Lead',     color: 'text-teal-600',   bg: 'bg-teal-50',    hover: 'hover:bg-teal-100',   path: '/leads'    },
  { id: 'schedule',   icon: Calendar,    label: 'Schedule',     color: 'text-blue-600',   bg: 'bg-blue-50',    hover: 'hover:bg-blue-100',   path: '/meetings' },
  { id: 'new-task',   icon: CheckSquare, label: 'New Task',     color: 'text-purple-600', bg: 'bg-purple-50',  hover: 'hover:bg-purple-100', path: '/tasks'    },
  { id: 'add-contact',icon: Users,       label: 'Add Contact',  color: 'text-indigo-600', bg: 'bg-indigo-50',  hover: 'hover:bg-indigo-100', path: '/contacts' },
  { id: 'log-call',   icon: Phone,       label: 'Log Call',     color: 'text-amber-600',  bg: 'bg-amber-50',   hover: 'hover:bg-amber-100',  path: '/leads'    },
  { id: 'send-email', icon: Mail,        label: 'Send Email',   color: 'text-rose-600',   bg: 'bg-rose-50',    hover: 'hover:bg-rose-100',   path: '/contacts' },
  { id: 'new-report', icon: FileText,    label: 'New Report',   color: 'text-emerald-600',bg: 'bg-emerald-50', hover: 'hover:bg-emerald-100',path: '/analytics'},
  { id: 'new-deal',   icon: Plus,        label: 'New Deal',     color: 'text-orange-600', bg: 'bg-orange-50',  hover: 'hover:bg-orange-100', path: '/leads'    },
]

export function QuickActions() {
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState(null)

  const handleAction = (action) => {
    setActiveId(action.id)
    setTimeout(() => {
      setActiveId(null)
      navigate(action.path)
    }, 150)
  }

  return (
    <div className="card p-5">
      <div className="mb-4">
        <h3 className="font-display font-bold text-gray-900 text-base">Quick Actions</h3>
        <p className="text-xs text-gray-400 mt-0.5">Common tasks at a glance</p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon
          const isActive = activeId === action.id

          return (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              className={`
                flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-transparent
                transition-all duration-150 group
                ${action.bg} ${action.hover}
                ${isActive ? 'scale-95 border-current/20' : 'hover:scale-105 hover:shadow-sm'}
              `}
            >
              <div className={`w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center shadow-sm group-hover:shadow transition-shadow`}>
                <Icon size={15} className={action.color} />
              </div>
              <span className="text-[10px] font-semibold text-gray-600 text-center leading-tight">
                {action.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default QuickActions
