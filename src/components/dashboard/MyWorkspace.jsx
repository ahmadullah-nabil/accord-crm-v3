import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckSquare, Calendar, Target,
  AlertCircle, Clock, ChevronRight,
  TrendingUp,
} from 'lucide-react'
import { useAuthStore }        from '../../stores/authStore.js'
import {
  useMyOverdueTasks,
  useMyUpcomingTasks,
  useMyUpcomingMeetings,
  useMyPipeline,
} from '../../hooks/usePersonalized.js'
import { useLeadsStore }        from '../../stores/leadsStore.js'
import { Skeleton }             from '../ui/Skeleton.jsx'
import { formatMeetingDateTime } from '../../lib/meetingsData.js'

const fmt = (n) =>
  n >= 1_000_000 ? `৳${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `৳${(n / 1_000).toFixed(0)}K`
  : `৳${n}`

// ── Section header ────────────────────────────────────────────────────────────
function SectionHead({ icon: Icon, label, count, countColor = 'bg-gray-100 text-gray-600', onNav }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-1.5">
        <Icon size={13} className="text-gray-400" />
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        {count !== undefined && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${countColor}`}>
            {count}
          </span>
        )}
      </div>
      {onNav && (
        <button
          onClick={onNav}
          className="text-[10px] text-teal-600 hover:text-teal-700 font-medium flex items-center gap-0.5"
        >
          View all <ChevronRight size={10} />
        </button>
      )}
    </div>
  )
}

// ── Task pill ─────────────────────────────────────────────────────────────────
function TaskPill({ task, isOverdue }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors">
      <CheckSquare
        size={13}
        className={isOverdue ? 'text-red-400 flex-shrink-0' : 'text-gray-300 flex-shrink-0'}
      />
      <span className="text-xs text-gray-800 flex-1 truncate">{task.title}</span>
      {task.dueDate && (
        <span className={`text-[10px] font-medium flex-shrink-0 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
          {task.dueDate}
        </span>
      )}
    </div>
  )
}

// ── Meeting pill ──────────────────────────────────────────────────────────────
function MeetingPill({ meeting }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors">
      <Calendar size={13} className="text-blue-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-800 truncate">{meeting.title}</p>
        <p className="text-[11px] text-gray-400">
          {formatMeetingDateTime(meeting.scheduledDate, meeting.scheduledTime)}
        </p>
      </div>
    </div>
  )
}

// ── Pipeline mini-stat ────────────────────────────────────────────────────────
function PipelineStat({ stage, count, value }) {
  const STAGE_COLORS = {
    New:         'bg-blue-50 text-blue-700',
    Contacted:   'bg-indigo-50 text-indigo-700',
    Qualified:   'bg-teal-50 text-teal-700',
    Proposal:    'bg-amber-50 text-amber-700',
    Negotiation: 'bg-orange-50 text-orange-700',
    Won:         'bg-emerald-50 text-emerald-700',
  }

  return (
    <div className="flex items-center justify-between py-1">
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-600'}`}>
        {stage}
      </span>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>{count} lead{count !== 1 ? 's' : ''}</span>
        {value > 0 && <span className="font-medium text-gray-700">{fmt(value)}</span>}
      </div>
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────
export function MyWorkspace({ isLoading: propLoading }) {
  const navigate   = useNavigate()
  const user       = useAuthStore((s) => s.user)
  const isLeadsReady = useLeadsStore((s) => !s.isLoading && s.leads.length >= 0)

  const { data: overdue   = [], isLoading: ol } = useMyOverdueTasks()
  const { data: upcoming  = [], isLoading: ul } = useMyUpcomingTasks()
  const { data: meetings  = [], isLoading: ml } = useMyUpcomingMeetings()
  const { myLeads, totalValue, byStage }        = useMyPipeline()

  const isLoading = propLoading || ol || ul || ml

  if (!user?.name) return null

  const stageEntries = Object.entries(byStage)

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-gray-900 text-base">My Workspace</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Assigned to {user.name.split(' ')[0]}
          </p>
        </div>
        {totalValue > 0 && (
          <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl">
            <TrendingUp size={14} />
            {fmt(totalValue)}
          </div>
        )}
      </div>

      {isLoading ? (
        <WorkspaceSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">

          {/* ── My Tasks ──────────────────────────────────────────────────── */}
          <div>
            {overdue.length > 0 && (
              <>
                <SectionHead
                  icon={AlertCircle}
                  label="Overdue"
                  count={overdue.length}
                  countColor="bg-red-100 text-red-600"
                  onNav={() => navigate('/tasks')}
                />
                <div className="space-y-0.5 mb-3">
                  {overdue.slice(0, 3).map((t) => (
                    <TaskPill key={t.id} task={t} isOverdue />
                  ))}
                  {overdue.length > 3 && (
                    <p className="text-[11px] text-gray-400 px-2 pt-1">
                      +{overdue.length - 3} more
                    </p>
                  )}
                </div>
              </>
            )}

            <SectionHead
              icon={Clock}
              label="Due this week"
              count={upcoming.length || undefined}
              onNav={() => navigate('/tasks')}
            />
            {upcoming.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-2">No tasks due this week</p>
            ) : (
              <div className="space-y-0.5">
                {upcoming.slice(0, 4).map((t) => (
                  <TaskPill key={t.id} task={t} isOverdue={false} />
                ))}
                {upcoming.length > 4 && (
                  <p className="text-[11px] text-gray-400 px-2 pt-1">
                    +{upcoming.length - 4} more
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── My Meetings ──────────────────────────────────────────────── */}
          <div className="pt-4 sm:pt-0 sm:pl-4">
            <SectionHead
              icon={Calendar}
              label="Upcoming meetings"
              count={meetings.length || undefined}
              onNav={() => navigate('/meetings')}
            />
            {meetings.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-2">No upcoming meetings</p>
            ) : (
              <div className="space-y-0.5">
                {meetings.map((m) => (
                  <MeetingPill key={m.id} meeting={m} />
                ))}
              </div>
            )}
          </div>

          {/* ── My Pipeline ──────────────────────────────────────────────── */}
          <div className="pt-4 sm:pt-0 sm:pl-4">
            <SectionHead
              icon={Target}
              label="My pipeline"
              count={myLeads.length || undefined}
              onNav={() => navigate('/leads')}
            />
            {stageEntries.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-2">No active leads assigned</p>
            ) : (
              <div>
                {stageEntries.map(([stage, count]) => {
                  const stageValue = myLeads
                    .filter((l) => l.stage === stage)
                    .reduce((s, l) => s + (Number(l.value) || 0), 0)
                  return (
                    <PipelineStat key={stage} stage={stage} count={count} value={stageValue} />
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function WorkspaceSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-28 mb-3" />
          <Skeleton className="h-7 w-full rounded-lg" />
          <Skeleton className="h-7 w-full rounded-lg" />
          <Skeleton className="h-7 w-3/4 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export default MyWorkspace
