// ─── TimelinePanel — Reusable Unified Timeline ───────────────────────────────
//
// Renders the full chronological event stream for any entity.
// Handles system events (lead_created, task_completed…) + user-generated
// entries (notes, follow-ups, meeting notes).
//
// Usage:
//   <TimelinePanel entityType="lead" entityId={lead.id} entityLabel={lead.company} />

import React, { useState } from 'react'
import {
  Activity, UserPlus, ArrowRight, CheckCircle2, RotateCcw,
  FileText, Calendar, MessageSquare, Phone, Mail, Users,
  Clock, StickyNote, ChevronDown, ChevronUp, Plus,
} from 'lucide-react'
import { useTimeline }   from '../../hooks/useTimeline.js'

import { NoteForm }       from './NoteForm.jsx'
import { FollowUpForm }   from './FollowUpForm.jsx'
import { MeetingNoteForm } from './MeetingNoteForm.jsx'
import { Avatar }         from '../ui/Avatar.jsx'
import { Skeleton }       from '../ui/Skeleton.jsx'
import { TIMELINE_TYPES } from '../../services/timelineService.js'

// ── Event type → visual config ────────────────────────────────────────────────
const EVENT_CONFIG = {
  // System events
  [TIMELINE_TYPES.LEAD_CREATED]:       { icon: UserPlus,      bg: 'bg-indigo-50', fg: 'text-indigo-600'  },
  [TIMELINE_TYPES.LEAD_STAGE_CHANGED]: { icon: ArrowRight,    bg: 'bg-teal-50',   fg: 'text-teal-600'    },
  [TIMELINE_TYPES.LEAD_UPDATED]:       { icon: FileText,      bg: 'bg-gray-100',  fg: 'text-gray-500'    },
  [TIMELINE_TYPES.MEETING_SCHEDULED]:  { icon: Calendar,      bg: 'bg-blue-50',   fg: 'text-blue-600'    },
  [TIMELINE_TYPES.MEETING_COMPLETED]:  { icon: CheckCircle2,  bg: 'bg-emerald-50',fg: 'text-emerald-600' },
  [TIMELINE_TYPES.MEETING_UPDATED]:    { icon: Calendar,      bg: 'bg-blue-50',   fg: 'text-blue-600'    },
  [TIMELINE_TYPES.TASK_CREATED]:       { icon: FileText,      bg: 'bg-amber-50',  fg: 'text-amber-600'   },
  [TIMELINE_TYPES.TASK_COMPLETED]:     { icon: CheckCircle2,  bg: 'bg-emerald-50',fg: 'text-emerald-600' },
  [TIMELINE_TYPES.TASK_REOPENED]:      { icon: RotateCcw,     bg: 'bg-gray-100',  fg: 'text-gray-500'    },
  // User-generated entries
  [TIMELINE_TYPES.NOTE_ADDED]:         { icon: StickyNote,    bg: 'bg-yellow-50', fg: 'text-yellow-600'  },
  [TIMELINE_TYPES.FOLLOWUP_LOGGED]:    { icon: Phone,         bg: 'bg-purple-50', fg: 'text-purple-600'  },
  [TIMELINE_TYPES.FOLLOWUP_SCHEDULED]: { icon: Clock,         bg: 'bg-orange-50', fg: 'text-orange-600'  },
  [TIMELINE_TYPES.MEETING_NOTE_ADDED]: { icon: Users,         bg: 'bg-blue-50',   fg: 'text-blue-600'    },
}

const FOLLOWUP_ICONS = { Call: Phone, Email: Mail, Visit: Users, Demo: Users, Meeting: Calendar }

// ── Relative time ─────────────────────────────────────────────────────────────
function relTime(iso) {
  if (!iso) return ''
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60)        return 'just now'
  if (diff < 3600)      return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)     return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

// ── Single timeline event ─────────────────────────────────────────────────────
function TimelineEvent({ event, isLast }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = EVENT_CONFIG[event.type] ?? { icon: Activity, bg: 'bg-gray-100', fg: 'text-gray-500' }
  const Icon = cfg.icon
  const meta = event.metadata ?? {}

  // Detect if there's expandable content
  const hasDetail =
    (event.type === TIMELINE_TYPES.NOTE_ADDED && meta.body?.length > 0) ||
    (event.type === TIMELINE_TYPES.FOLLOWUP_LOGGED && meta.outcome?.length > 0) ||
    (event.type === TIMELINE_TYPES.MEETING_NOTE_ADDED && (meta.summary || meta.decisions || meta.nextActions))

  return (
    <div className="flex gap-2.5 group">
      {/* Icon + connector line */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <Icon size={13} className={cfg.fg} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-gray-100 mt-1.5 mb-1" />}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${!isLast ? 'pb-3' : ''}`}>
        {/* Header row */}
        <div className="flex items-start gap-1.5 justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-700 leading-snug">
              {event.actor && (
                <span className="font-semibold text-gray-900">{event.actor} </span>
              )}
              <span className="text-gray-500">{event.action}</span>
              {event.subject && event.subject !== event.actor && (
                <><span> </span><span className="font-medium text-gray-800">{event.subject}</span></>
              )}
            </p>

            {/* Follow-up type badge */}
            {meta.followupType && (
              <span className="inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px] font-semibold">
                {meta.followupType}
              </span>
            )}

            {/* Next follow-up date */}
            {meta.nextFollowupDate && (
              <p className="text-[10px] text-orange-500 font-medium mt-0.5 flex items-center gap-0.5">
                <Clock size={9} /> Next: {meta.nextFollowupDate}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-[10px] text-gray-300">{relTime(event.occurredAt)}</span>
            {hasDetail && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-gray-300 hover:text-gray-500 transition-colors"
              >
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
          </div>
        </div>

        {/* Brief detail line (always shown) */}
        {!expanded && event.detail && (
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{event.detail}</p>
        )}

        {/* Expanded body */}
        {expanded && (
          <div className="mt-2 space-y-2">
            {/* Note body */}
            {meta.body && (
              <p className="text-xs text-gray-700 bg-yellow-50 border border-yellow-100 rounded-lg p-2.5 leading-relaxed whitespace-pre-wrap">
                {meta.body}
              </p>
            )}

            {/* Follow-up outcome */}
            {meta.outcome && (
              <p className="text-xs text-gray-700 bg-purple-50 border border-purple-100 rounded-lg p-2.5 leading-relaxed whitespace-pre-wrap">
                {meta.outcome}
              </p>
            )}

            {/* Meeting note fields */}
            {meta.summary && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5 space-y-2">
                <div>
                  <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-0.5">Summary</p>
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{meta.summary}</p>
                </div>
                {meta.decisions && (
                  <div>
                    <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-0.5">Decisions</p>
                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{meta.decisions}</p>
                  </div>
                )}
                {meta.nextActions && (
                  <div>
                    <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-0.5">Next Actions</p>
                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{meta.nextActions}</p>
                  </div>
                )}
                {Array.isArray(meta.attendees) && meta.attendees.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-0.5">Attendees</p>
                    <p className="text-xs text-gray-600">{meta.attendees.join(', ')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Inline action tabs ────────────────────────────────────────────────────────
const BASE_TABS = [
  { id: 'note',        label: 'Note',          icon: StickyNote },
  { id: 'followup',    label: 'Follow-up',     icon: Phone      },
]
const MEETING_TAB = { id: 'meeting_notes', label: 'Meeting Notes', icon: Users }

// ── Main component ────────────────────────────────────────────────────────────
export function TimelinePanel({
  entityType,
  entityId,
  entityLabel      = '',
  linkedEntityType = null,
  linkedEntityId   = null,
}) {
  const [activeTab, setActiveTab] = useState(null)

  const { data: events = [], isLoading } = useTimeline(
    entityType,
    entityId,
    linkedEntityType,
    linkedEntityId,
  )

  const tabs = entityType === 'meeting'
    ? [...BASE_TABS, MEETING_TAB]
    : BASE_TABS

  return (
    <div>
      {/* Header + action tabs */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 flex items-center gap-1">
          <Activity size={10} className="text-gray-300" /> Timeline
        </p>
        <div className="flex items-center gap-1">
          {tabs.map(({ id, label, icon: TabIcon }) => (
            <button
              key={id}
              onClick={() => setActiveTab((v) => v === id ? null : id)}
              className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors
                ${activeTab === id
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-gray-400 hover:text-teal-600 hover:bg-teal-50'
                }`}
            >
              <TabIcon size={10} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Inline form (shown when a tab is active) */}
      {activeTab === 'note' && (
        <NoteForm
          entityType={entityType}
          entityId={entityId}
          entityLabel={entityLabel}
          onClose={() => setActiveTab(null)}
        />
      )}
      {activeTab === 'followup' && (
        <FollowUpForm
          entityType={entityType}
          entityId={entityId}
          entityLabel={entityLabel}
          onClose={() => setActiveTab(null)}
        />
      )}
      {activeTab === 'meeting_notes' && entityType === 'meeting' && (
        <MeetingNoteForm
          meetingId={entityId}
          meetingTitle={entityLabel}
          onClose={() => setActiveTab(null)}
        />
      )}

      {/* Event list */}
      {isLoading ? (
        <div className="space-y-3 mt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-2.5">
              <Skeleton className="w-7 h-7 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5 pt-0.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-4 bg-gray-50 rounded-xl mt-2">
          <Activity size={16} className="text-gray-300 mx-auto mb-1.5" />
          <p className="text-xs text-gray-400">No timeline events yet</p>
          <p className="text-[11px] text-gray-300 mt-0.5">
            Actions, notes, and follow-ups will appear here
          </p>
        </div>
      ) : (
        <div className="mt-2">
          {events.map((event, idx) => (
            <TimelineEvent
              key={event.id}
              event={event}
              isLast={idx === events.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
