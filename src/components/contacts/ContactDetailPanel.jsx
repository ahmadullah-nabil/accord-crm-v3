import React from 'react'
import {
  X, Mail, Phone, Building2, Globe, MapPin,
  Tag, Pencil, Trash2, Calendar, TrendingUp, Link2,
  Plus, Clock, CheckCircle2, XCircle, RefreshCw,
  AlertCircle, Circle,
} from 'lucide-react'
import { useContactsStore }                 from '../../stores/contactsStore.js'
import { useContact, useDeleteContact }     from '../../hooks/useContacts.js'
import { useContactMeetings }               from '../../hooks/useMeetings.js'
import { useContactTasks }                  from '../../hooks/useTasks.js'
import { useMeetingsStore }                 from '../../stores/meetingsStore.js'
import { useTasksStore }                    from '../../stores/tasksStore.js'
import { useLeadsStore }                    from '../../stores/leadsStore.js'
import { useAuthStore }                     from '../../stores/authStore.js'
import { convertContactToLead }             from '../../services/leadsService.js'
import { useQueryClient }                   from '@tanstack/react-query'
import { TYPE_COLORS, STATUS_COLORS }       from '../../lib/contactsData.js'
import { STATUS_CONFIG, formatMeetingDateTime } from '../../lib/meetingsData.js'
import { STATUS_CONFIG as TASK_STATUS_CONFIG }  from '../../lib/tasksData.js'
import { useRoleByName }                    from '../../hooks/useTeam.js'
import { Avatar }                           from '../ui/Avatar.jsx'
import { Skeleton, SkeletonText }           from '../ui/Skeleton.jsx'
import { TimelinePanel }                    from '../timeline/TimelinePanel.jsx'

export function ContactDetailPanel() {
  const { detailPanelOpen, closeDetail, selectedContactId, openEditModal } = useContactsStore()
  const deleteMutation = useDeleteContact()

  const { openAddModalWithPrefill: openMeetingWithPrefill, openDetail: openMeetingDetail } = useMeetingsStore()
  const { openAddModalWithPrefill: openTaskWithPrefill,   openDetail: openTaskDetail   } = useTasksStore()

  const { data: contact, isLoading } = useContact(
    detailPanelOpen ? selectedContactId : null
  )

  const {
    data: linkedMeetings = [],
    isLoading: meetingsLoading,
  } = useContactMeetings(detailPanelOpen ? selectedContactId : null)

  const {
    data: linkedTasks = [],
    isLoading: tasksLoading,
  } = useContactTasks(detailPanelOpen ? selectedContactId : null)

  // Real role from public.profiles — replaces hardcoded "Account Owner"
  const assigneeRole = useRoleByName(contact?.assignee)

  const handleScheduleMeeting = () => {
    if (!contact) return
    openMeetingWithPrefill({
      relatedType:  'Contact',
      relatedId:    contact.id,
      relatedLabel: `${contact.name}${contact.company ? ' — ' + contact.company : ''}`,
      title:        `Meeting — ${contact.name}`,
      participants: contact.name ? [contact.name] : [],
    })
  }

  const handleCreateTask = () => {
    if (!contact) return
    openTaskWithPrefill({
      relatedType:  'Contact',
      relatedId:    contact.id,
      relatedLabel: `${contact.name}${contact.company ? ' — ' + contact.company : ''}`,
      title:        `Follow-up: ${contact.name}`,
      assignee:     contact.assignee ?? '',
    })
  }

  const { openDetail: openLeadDetail } = useLeadsStore()
  const user = useAuthStore((s) => s.user)
  const qc   = useQueryClient()

  const [converting, setConverting] = React.useState(false)

  const handleConvertToLead = async () => {
    if (!contact) return
    if (contact.linkedLeadId) return   // already converted — button is hidden but belt+suspenders
    if (!confirm(`Convert "${contact.name}" to a Lead? This will create a new lead linked to this contact.`)) return

    setConverting(true)
    try {
      const newLead = await convertContactToLead(contact, user)
      // Invalidate both caches so table + dropdowns update immediately
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['leads'] })
      closeDetail()
      // Open the new lead's detail panel
      setTimeout(() => openLeadDetail(newLead.id), 150)
    } catch (err) {
      alert(err.message ?? 'Conversion failed. Please try again.')
    } finally {
      setConverting(false)
    }
  }

  const handleDelete = () => {
    if (!contact) return
    if (confirm(`Delete contact "${contact.name}"?`)) {
      deleteMutation.mutate(contact.id, { onSuccess: closeDetail })
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
        ) : !contact ? null : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={contact.name} src={contact.avatar} size="lg" />
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-gray-900 text-base leading-tight truncate">
                    {contact.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{contact.designation}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Building2 size={11} className="text-gray-300 flex-shrink-0" />
                    {contact.company}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                {/* Convert to Lead — hidden after conversion */}
                {!contact.linkedLeadId ? (
                  <button
                    onClick={handleConvertToLead}
                    disabled={converting}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors disabled:opacity-50"
                    title="Convert this contact to a Lead"
                  >
                    <TrendingUp size={12} />
                    {converting ? 'Converting…' : 'Convert'}
                  </button>
                ) : (
                  <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 text-gray-500 cursor-default">
                    <TrendingUp size={12} /> Lead
                  </span>
                )}
                <button
                  onClick={() => openEditModal(contact.id)}
                  className="p-2 rounded-xl text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                  title="Edit"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
                <button
                  onClick={closeDetail}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  title="Close"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Type + Status badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold
                  ${TYPE_COLORS[contact.type] || 'bg-gray-100 text-gray-600'}`}>
                  {contact.type}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                  ${STATUS_COLORS[contact.status] || 'bg-gray-100 text-gray-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full
                    ${contact.status === 'Active' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  {contact.status}
                </span>
              </div>

              {/* Contact info */}
              <Section title="Contact">
                <InfoRow icon={Mail}  label="Email"  value={contact.email}  href={`mailto:${contact.email}`} />
                <InfoRow icon={Phone} label="Phone"  value={contact.phone}  href={`tel:${contact.phone}`} />
                {contact.website && (
                  <InfoRow icon={Globe} label="Website" value={contact.website}
                    href={`https://${contact.website}`} external />
                )}
                {contact.address && (
                  <InfoRow icon={MapPin} label="Address" value={contact.address} />
                )}
              </Section>

              {/* Assignee */}
              <Section title="Assignee">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <Avatar name={contact.assignee} size="md" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{contact.assignee}</p>
                    {assigneeRole && (
                      <p className="text-xs text-gray-500">{assigneeRole}</p>
                    )}
                  </div>
                </div>
              </Section>

              {/* Meetings */}
              <Section
                title="Meetings"
                action={
                  <button
                    onClick={handleScheduleMeeting}
                    className="flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
                    title="Schedule a meeting for this contact"
                  >
                    <Plus size={12} /> Schedule
                  </button>
                }
              >
                {meetingsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-14 w-full rounded-xl" />
                    <Skeleton className="h-14 w-full rounded-xl" />
                  </div>
                ) : linkedMeetings.length === 0 ? (
                  <div className="text-center py-4 px-3 bg-gray-50 rounded-xl">
                    <Calendar size={18} className="text-gray-300 mx-auto mb-1.5" />
                    <p className="text-xs text-gray-400">No meetings scheduled</p>
                    <button
                      onClick={handleScheduleMeeting}
                      className="text-xs text-teal-600 hover:text-teal-700 font-medium mt-1 transition-colors"
                    >
                      Schedule one now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {linkedMeetings.map((meeting) => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        onClick={() => openMeetingDetail(meeting.id)}
                      />
                    ))}
                  </div>
                )}
              </Section>

              {/* Tasks */}
              <Section
                title="Tasks"
                action={
                  <button
                    onClick={handleCreateTask}
                    className="flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
                    title="Create a task for this contact"
                  >
                    <Plus size={12} /> Add task
                  </button>
                }
              >
                {tasksLoading ? (
                  <Skeleton className="h-14 w-full rounded-xl" />
                ) : linkedTasks.length === 0 ? (
                  <div className="text-center py-4 px-3 bg-gray-50 rounded-xl">
                    <CheckCircle2 size={18} className="text-gray-300 mx-auto mb-1.5" />
                    <p className="text-xs text-gray-400">No tasks yet</p>
                    <button
                      onClick={handleCreateTask}
                      className="text-xs text-teal-600 hover:text-teal-700 font-medium mt-1 transition-colors"
                    >
                      Add one now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {linkedTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onClick={() => openTaskDetail(task.id)}
                      />
                    ))}
                  </div>
                )}
              </Section>

              {/* Timeline */}
              <Section title="Timeline">
                <TimelinePanel
                  entityType="contact"
                  entityId={contact.id}
                  entityLabel={contact.name}
                  linkedEntityType={contact.linkedLeadId ? 'lead' : null}
                  linkedEntityId={contact.linkedLeadId ?? null}
                />
              </Section>

              {/* Tags */}
              {contact.tags?.length > 0 && (
                <Section title="Tags">
                  <div className="flex flex-wrap gap-2">
                    {contact.tags.map((tag) => (
                      <span key={tag}
                        className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        <Tag size={10} /> {tag}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Notes */}
              {contact.notes && (
                <Section title="Notes">
                  <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-3">
                    {contact.notes}
                  </p>
                </Section>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Section({ title, children, action }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          {title}
        </p>
        {action}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function MeetingCard({ meeting, onClick }) {
  const sc = STATUS_CONFIG[meeting.status] || STATUS_CONFIG['Scheduled']
  const StatusIcon =
    meeting.status === 'Completed'   ? CheckCircle2 :
    meeting.status === 'Cancelled'   ? XCircle      :
    meeting.status === 'Rescheduled' ? RefreshCw    :
                                       Clock
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors duration-150 group"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-gray-900 leading-snug group-hover:text-teal-700 transition-colors truncate">
          {meeting.title}
        </p>
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${sc.color}`}>
          <StatusIcon size={9} /> {sc.label}
        </span>
      </div>
      <p className="text-[11px] text-gray-500 mt-1">
        {meeting.scheduledDate
          ? formatMeetingDateTime(meeting.scheduledDate, meeting.scheduledTime)
          : 'No date set'}
      </p>
      {meeting.organizer && (
        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
          <Avatar name={meeting.organizer} size="xs" />
          {meeting.organizer}
        </p>
      )}
    </button>
  )
}

function InfoRow({ icon: Icon, label, value, href, external }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Icon size={14} className="text-gray-400 flex-shrink-0" />
      <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
      {href ? (
        <a
          href={href}
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
          onClick={(e) => e.stopPropagation()}
          className="text-sm text-teal-600 hover:underline font-medium truncate"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm text-gray-800 font-medium truncate">{value}</span>
      )}
    </div>
  )
}

function TaskCard({ task, onClick }) {
  const sc = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG['Todo']
  const StatusIcon =
    task.status === 'Completed' ? CheckCircle2 :
    task.status === 'Overdue'   ? AlertCircle  :
                                   Circle
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors duration-150 group"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-gray-900 leading-snug group-hover:text-teal-700 transition-colors truncate">
          {task.title}
        </p>
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${sc.color}`}>
          <StatusIcon size={9} /> {sc.label}
        </span>
      </div>
      {task.dueDate && (
        <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
          <Clock size={10} /> Due {task.dueDate}
        </p>
      )}
      {task.assignee && (
        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
          <Avatar name={task.assignee} size="xs" />
          {task.assignee.split(' ')[0]}
        </p>
      )}
    </button>
  )
}

function PanelSkeleton({ onClose }) {
  return (
    <>
      <div className="flex items-start justify-between p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Skeleton className="w-11 h-11 rounded-full flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100">
          <X size={15} />
        </button>
      </div>
      <div className="p-5 space-y-5">
        <Skeleton className="h-8 w-40 rounded-full" />
        <SkeletonText lines={4} />
        <SkeletonText lines={3} />
      </div>
    </>
  )
}
