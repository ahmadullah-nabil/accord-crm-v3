import React from 'react'
import {
  X, Calendar, Clock, MapPin, Users, Link2,
  FileText, Tag, Pencil, Trash2, ExternalLink, Hash,
  Plus, CheckCircle2, Circle, AlertCircle,
} from 'lucide-react'
import { useMeetingsStore }                   from '../../stores/meetingsStore.js'
import { useMeeting, useDeleteMeeting }       from '../../hooks/useMeetings.js'
import { STATUS_CONFIG, TYPE_CONFIG, formatMeetingDateTime, daysFromToday } from '../../lib/meetingsData.js'
import { useTasksStore }                      from '../../stores/tasksStore.js'
import { useMeetingTasks }                    from '../../hooks/useTasks.js'
import { STATUS_CONFIG as TASK_STATUS_CONFIG } from '../../lib/tasksData.js'
import { useMeetingPermissions }              from '../../hooks/usePermissions.js'
import { Avatar }                             from '../ui/Avatar.jsx'
import { Skeleton, SkeletonText }             from '../ui/Skeleton.jsx'
import { TimelinePanel }                      from '../timeline/TimelinePanel.jsx'
import { useRoleByName }                      from '../../hooks/useTeam.js'

export function MeetingDetailPanel() {
  const { detailPanelOpen, closeDetail, selectedMeetingId, openEditModal } = useMeetingsStore()
  const { openAddModalWithPrefill: openTaskWithPrefill, openDetail: openTaskDetail } = useTasksStore()
  const deleteMutation = useDeleteMeeting()

  const { data: meeting, isLoading } = useMeeting(
    detailPanelOpen ? selectedMeetingId : null
  )

  const {
    data: linkedTasks = [],
    isLoading: tasksLoading,
  } = useMeetingTasks(detailPanelOpen ? selectedMeetingId : null)

  const perms = useMeetingPermissions(meeting)
  const organizerRole = useRoleByName(meeting?.organizer)

  const handleDelete = () => {
    if (!meeting) return
    if (window.confirm(`Delete meeting "${meeting.title}"?`)) {
      deleteMutation.mutate(meeting.id, { onSuccess: closeDetail })
    }
  }

  // Suggest a due date one week from the meeting's scheduled date (or today)
  const suggestDueDate = (meeting) => {
    const base = meeting?.scheduledDate
      ? new Date(meeting.scheduledDate)
      : new Date()
    base.setDate(base.getDate() + 7)
    return base.toISOString().split('T')[0]
  }

  const handleCreateFollowUpTask = () => {
    if (!meeting) return
    openTaskWithPrefill({
      relatedType:  'Meeting',
      relatedId:    meeting.id,
      relatedLabel: meeting.title,
      title:        `Follow-up: ${meeting.title}`,
      dueDate:      suggestDueDate(meeting),
      assignee:     meeting.organizer || '',
      priority:     'Medium',
    })
  }

  return (
    <>
      {detailPanelOpen && (
        <div className="fixed inset-0 bg-black/30 z-[45]" onClick={closeDetail} />
      )}

      <div
        className={`
          fixed inset-y-0 right-0 z-50 w-[420px] max-w-full bg-white shadow-card-lg
          flex flex-col transition-transform duration-300 ease-in-out
          ${detailPanelOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {isLoading ? (
          <PanelSkeleton onClose={closeDetail} />
        ) : !meeting ? null : (
          <MeetingPanelContent
  meeting={meeting}
  organizerRole={organizerRole}
  linkedTasks={linkedTasks}
  tasksLoading={tasksLoading}
            onClose={closeDetail}
            onEdit={perms.canEdit ? () => openEditModal(meeting.id) : null}
            onDelete={perms.canDelete ? handleDelete : null}
            onCreateTask={perms.canFollowUp ? handleCreateFollowUpTask : null}
            onOpenTask={openTaskDetail}
          />
        )}
      </div>
    </>
  )
}

// ── Panel content ─────────────────────────────────────────────────────────────
function MeetingPanelContent({meeting,organizerRole,linkedTasks,tasksLoading,onClose,onEdit,onDelete,onCreateTask,onOpenTask}) {
  const sc   = STATUS_CONFIG[meeting.status] || STATUS_CONFIG['Scheduled']
  const tc   = TYPE_CONFIG[meeting.type]     || { color: 'bg-gray-100 text-gray-600' }
  const days = daysFromToday(meeting.scheduledDate)

  const isCompleted = meeting.status === 'Completed'
  const isCancelled = meeting.status === 'Cancelled'

  const dateTimeLabel = formatMeetingDateTime(meeting.scheduledDate, meeting.scheduledTime)

  const daysNote =
    isCancelled ? null :
    isCompleted ? null :
    days === null ? null :
    days < 0   ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago` :
    days === 0 ? 'Today' :
    days === 1 ? 'Tomorrow' :
                 `In ${days} days`

  const daysNoteClass =
    days !== null && days < 0  ? 'text-gray-400' :
    days !== null && days === 0 ? 'text-orange-500 font-semibold' :
    days !== null && days === 1 ? 'text-amber-500' :
                                  'text-gray-400'

  return (
    <>
      {/* Header */}
      <div className="p-5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className={`font-display font-bold text-base leading-snug
              ${isCancelled ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {meeting.title}
            </h3>
            {meeting.relatedLabel && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <Link2 size={11} className="text-gray-300 flex-shrink-0" />
                {meeting.relatedLabel}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-2 rounded-xl text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                title="Edit"
              >
                <Pencil size={15} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Close"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Status + Type */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${sc.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
            {sc.label}
          </span>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${tc.color}`}>
            {meeting.type}
          </span>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Date + Time */}
        <Section title="Date & Time" icon={Calendar}>
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{dateTimeLabel}</p>
              {daysNote && (
                <p className={`text-xs mt-0.5 ${daysNoteClass}`}>{daysNote}</p>
              )}
            </div>
            {meeting.durationMins && (
              <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                <Clock size={12} />
                {meeting.durationMins} min
              </div>
            )}
          </div>
        </Section>

        {/* Location */}
        <Section title="Location" icon={MapPin}>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-800">{meeting.location || '—'}</span>
            {meeting.locationUrl && (
              <a
                href={meeting.locationUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-teal-600 hover:underline font-medium"
              >
                <ExternalLink size={11} />
                Join
              </a>
            )}
          </div>
        </Section>

        {/* Organizer */}
        <Section title="Organizer" icon={Users}>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <Avatar name={meeting.organizer} size="md" />
            <div>
              <p className="text-sm font-medium text-gray-900">{meeting.organizer}</p>
              {organizerRole && (
                <p className="text-xs text-gray-500">{organizerRole}</p>
              )}
            </div>
          </div>
        </Section>

        {/* Participants */}
        {meeting.participants?.length > 0 && (
          <Section title={`Participants (${meeting.participants.length})`} icon={Users}>
            <div className="space-y-2">
              {meeting.participants.map((name, i) => (
                <div key={i} className="flex items-center gap-3 py-1">
                  <Avatar name={name} size="sm" />
                  <span className="text-sm text-gray-700">{name}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Related entity */}
        {meeting.relatedType && meeting.relatedType !== 'None' && meeting.relatedId && (
          <Section title="Related" icon={Link2}>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full
                ${meeting.relatedType === 'Lead' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                {meeting.relatedType}
              </span>
              <span className="text-sm text-gray-700">{meeting.relatedLabel || meeting.relatedId}</span>
            </div>
          </Section>
        )}

        {/* Description */}
        {meeting.description && (
          <Section title="Description" icon={FileText}>
            <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-3">
              {meeting.description}
            </p>
          </Section>
        )}

        {/* Meeting notes */}
        {meeting.notes && (
          <Section title="Notes" icon={FileText}>
            <p className="text-sm text-gray-600 leading-relaxed bg-amber-50 border border-amber-100 rounded-xl p-3">
              {meeting.notes}
            </p>
          </Section>
        )}

        {/* Tags */}
        {meeting.tags?.length > 0 && (
          <Section title="Tags" icon={Tag}>
            <div className="flex flex-wrap gap-2">
              {meeting.tags.map((tag) => (
                <span key={tag}
                  className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                  <Tag size={10} /> {tag}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* ── Follow-up Tasks ──────────────────────────────────────────────── */}
        <SectionWithAction
          title="Follow-up Tasks"
          icon={CheckCircle2}
          action={
            onCreateTask ? (
              <button
                onClick={onCreateTask}
                className="flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
                title="Create a follow-up task for this meeting"
              >
                <Plus size={12} />
                Add task
              </button>
            ) : null
          }
        >
          {tasksLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : linkedTasks.length === 0 ? (
            <div className="text-center py-4 px-3 bg-gray-50 rounded-xl">
              <CheckCircle2 size={18} className="text-gray-300 mx-auto mb-1.5" />
              <p className="text-xs text-gray-400">No follow-up tasks</p>
              {onCreateTask && (
                <button
                  onClick={onCreateTask}
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium mt-1 transition-colors"
                >
                  Create one now
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {linkedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => onOpenTask(task.id)}
                />
              ))}
            </div>
          )}
        </SectionWithAction>


        {/* ── Unified Timeline ─────────────────────────────────────────────── */}
        {meeting && (
          <TimelinePanel
            entityType="meeting"
            entityId={meeting.id}
            entityLabel={meeting.title}
          />
        )}

                {/* Meta */}
        <Section title="Details" icon={Hash}>
          <InfoRow label="Meeting ID" value={meeting.id} />
          <InfoRow label="Created"    value={meeting.createdAt} />
        </Section>
      </div>
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
        {Icon && <Icon size={11} className="text-gray-300" />}
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

// Section variant with a right-aligned action button
function SectionWithAction({ title, icon: Icon, action, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
          {Icon && <Icon size={11} className="text-gray-300" />}
          {title}
        </p>
        {action}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

// Related task card — clickable to open TaskDetailPanel
function TaskCard({ task, onClick }) {
  const sc = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG['Todo']

  const StatusIcon =
    task.status === 'Completed'  ? CheckCircle2 :
    task.status === 'Overdue'    ? AlertCircle  :
                                   Circle

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors duration-150 group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <StatusIcon
            size={13}
            className={`flex-shrink-0 mt-0.5
              ${task.status === 'Completed' ? 'text-emerald-500' :
                task.status === 'Overdue'   ? 'text-red-400'     :
                                              'text-gray-300'}`}
          />
          <p className={`text-xs font-semibold leading-snug group-hover:text-teal-700 transition-colors truncate
            ${task.status === 'Completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
            {task.title}
          </p>
        </div>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${sc.color}`}>
          {sc.label}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-1.5 ml-[21px]">
        {task.dueDate && (
          <p className="text-[11px] text-gray-400 flex items-center gap-1">
            <Calendar size={9} />
            {task.dueDate}
          </p>
        )}
        {task.assignee && (
          <p className="text-[11px] text-gray-400 flex items-center gap-1">
            <Avatar name={task.assignee} size="xs" />
            {task.assignee.split(' ')[0]}
          </p>
        )}
      </div>
    </button>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value}</span>
    </div>
  )
}

function PanelSkeleton({ onClose }) {
  return (
    <>
      <div className="flex items-start justify-between p-5 border-b border-gray-100">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 ml-2 flex-shrink-0">
          <X size={15} />
        </button>
      </div>
      <div className="p-5 space-y-5">
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-16 w-full rounded-xl" />
        <SkeletonText lines={3} />
        <SkeletonText lines={2} />
      </div>
    </>
  )
}
