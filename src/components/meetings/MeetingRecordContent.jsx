// ─── MeetingRecordContent ─────────────────────────────────────────────────────
//
// step048. What a meeting IS, as data: its field groups, its tabs, its header
// bits. Copy #5 — the last of the pattern.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ THIS FILE EXISTS SO THE PANEL AND THE PAGE CANNOT DRIFT                 │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ MeetingDetailPanel and MeetingRecordPage both call these hooks. Add a   │
// │ field here and it appears on both surfaces; add it to one component and │
// │ you have two versions of a meeting that disagree.                       │
// └─────────────────────────────────────────────────────────────────────────┘
//
// ═══ CALENDAR SYNC IS NOT A TAB, DELIBERATELY ═══════════════════════════════
//
// CalendarSyncCard is the ONLY caller of the calendar sync path in this app.
// Saving a meeting mails nobody — the sequence is: create → open this surface →
// Add to calendar → edit → Update & notify → Cancel event. Every one of those
// steps goes through that card.
//
// So it is rendered through RecordShell's `children` slot, which sits under the
// field stack and ABOVE the tab bar, visible on every tab and in both variants.
// Putting it behind a tab would hide the only control that sends invitations
// behind a click, and would make the five outstanding VERIFY checks — which
// walk exactly that sequence — harder to perform than they already are.
//
// A control that is the sole path to an external side effect does not get
// filed under "one of five things you might want".
//
// ═══ TABS ════════════════════════════════════════════════════════════════════
//
// Timeline, Tasks and Files. That is every relation a meeting has:
//
//   • activities   — real, TimelinePanel.
//   • tasks        — real, useMeetingTasks, and follow-ups are the whole point
//                    of the meeting record.
//   • attachments  — real, keyed on ('meeting', id).
//   • participants — a TEXT[] column, not a table. It is a field.
//   • emails       — email_messages is keyed to lead/contact/opportunity. No
//                    surface has ever sent an email about a meeting.
//
// PERMISSIONS ARE CARRIED OVER UNCHANGED. The old panel gated Edit on canEdit,
// Delete on canDelete and the follow-up task on canFollowUp, by passing null
// handlers. The same three flags gate the same three affordances here.

import React from 'react'
import {
  Calendar, Clock, MapPin, Users, Link2, FileText, Hash, Tag,
  Activity, Paperclip, CheckSquare, ExternalLink, Pencil, Trash2,
} from 'lucide-react'

import { useMeetingTasks }         from '../../hooks/useTasks.js'
import { useAttachments }          from '../../hooks/useAttachments.js'
import { useTasksStore }           from '../../stores/tasksStore.js'
import {
  STATUS_CONFIG, TYPE_CONFIG, daysFromToday, formatMeetingDateTime,
} from '../../lib/meetingsData.js'
import { localISODate, parseLocalDate } from '../../lib/dates.js'
import { Avatar }                  from '../ui/Avatar.jsx'
import { FieldGroup, RecordField } from '../ui/FieldGroup.jsx'
import { TimelinePanel }           from '../timeline/TimelinePanel.jsx'
import { AttachmentPanel }         from '../attachments/AttachmentPanel.jsx'
import { RelatedList }             from '../ui/RelatedList.jsx'

// ── Badges ────────────────────────────────────────────────────────────────────

export function MeetingBadges({ meeting }) {
  if (!meeting) return null
  const sc = STATUS_CONFIG[meeting.status] || STATUS_CONFIG['Scheduled']
  const tc = TYPE_CONFIG[meeting.type]     || { color: 'bg-gray-100 text-gray-600' }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`badge ${sc.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mr-1 ${sc.dot}`} />
        {sc.label}
      </span>
      {meeting.type && <span className={`badge ${tc.color}`}>{meeting.type}</span>}
      {meeting.durationMins && (
        <span className="ml-auto text-gray-500 tnum text-xs">{meeting.durationMins} min</span>
      )}
    </div>
  )
}

// ── Field groups ──────────────────────────────────────────────────────────────

export function MeetingFields({ meeting, organizerRole }) {
  if (!meeting) return null

  const days = daysFromToday(meeting.scheduledDate)
  const settled = meeting.status === 'Completed' || meeting.status === 'Cancelled'

  const daysNote =
    settled       ? null :
    days === null ? null :
    days <   0    ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago` :
    days === 0    ? 'Today' :
    days === 1    ? 'Tomorrow' :
                    `In ${days} days`

  const daysNoteClass =
    days !== null && days <   0 ? 'text-gray-400' :
    days !== null && days === 0 ? 'text-orange-500 font-medium' :
    days !== null && days === 1 ? 'text-amber-500' :
                                  'text-gray-400'

  return (
    <div>
      <FieldGroup title="Schedule">
        <RecordField label="When" icon={Calendar} placeholder="Unscheduled">
          {meeting.scheduledDate
            ? (
              <span className="flex items-center gap-1.5 flex-wrap">
                {/* formatMeetingDateTime builds `${date}T${time}`, which the
                    spec parses as LOCAL — unlike a bare date, which is UTC.
                    Correct as it stands; see lib/dates.js. */}
                <span>{formatMeetingDateTime(meeting.scheduledDate, meeting.scheduledTime)}</span>
                {daysNote && <span className={`text-xs ${daysNoteClass}`}>{daysNote}</span>}
              </span>
            )
            : null}
        </RecordField>
        <RecordField label="Duration" icon={Clock} mono placeholder="Not set">
          {meeting.durationMins ? `${meeting.durationMins} min` : null}
        </RecordField>
      </FieldGroup>

      <FieldGroup title="Location">
        <RecordField label="Location" icon={MapPin} placeholder="No location">
          {meeting.location || null}
        </RecordField>
        <RecordField label="Join link" icon={ExternalLink} placeholder="No link">
          {meeting.locationUrl
            ? (
              <a
                href={meeting.locationUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-teal-700 hover:underline break-all"
              >
                Join
              </a>
            )
            : null}
        </RecordField>
      </FieldGroup>

      <FieldGroup title="People">
        <RecordField label="Organizer" icon={Users} placeholder="No organizer">
          {meeting.organizer
            ? (
              <span className="flex items-center gap-1.5">
                <Avatar name={meeting.organizer} size="xs" />
                <span>{meeting.organizer}</span>
                {organizerRole && <span className="text-gray-400">· {organizerRole}</span>}
              </span>
            )
            : null}
        </RecordField>
        {/* participants is a TEXT[] column, not a table — a field, not a tab. */}
        <RecordField
          label={`Participants${meeting.participants?.length ? ` (${meeting.participants.length})` : ''}`}
          icon={Users}
          placeholder="No participants"
        >
          {meeting.participants?.length
            ? (
              <span className="flex flex-col gap-1">
                {meeting.participants.map((p, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <Avatar name={p} size="xs" />
                    <span className="truncate">{p}</span>
                  </span>
                ))}
              </span>
            )
            : null}
        </RecordField>
      </FieldGroup>

      <FieldGroup title="Related">
        <RecordField label="Type" icon={Link2} placeholder="Not linked">
          {meeting.relatedType && meeting.relatedType !== 'None' ? meeting.relatedType : null}
        </RecordField>
        <RecordField label="Record" icon={Hash} placeholder="—">
          {meeting.relatedType && meeting.relatedType !== 'None'
            ? (meeting.relatedLabel ||
               <span className="text-xs text-gray-500 break-all">{meeting.relatedId}</span>)
            : null}
        </RecordField>
      </FieldGroup>

      <FieldGroup title="Notes" defaultOpen={Boolean(meeting.description || meeting.notes)}>
        <RecordField label="Description" icon={FileText} placeholder="No description">
          {meeting.description || null}
        </RecordField>
        <RecordField label="Notes" icon={FileText} placeholder="No notes">
          {meeting.notes || null}
        </RecordField>
        <RecordField label="Tags" icon={Tag} placeholder="No tags">
          {meeting.tags?.length
            ? (
              <span className="flex flex-wrap gap-1">
                {meeting.tags.map((t) => (
                  <span key={t} className="badge bg-gray-100 text-gray-600">{t}</span>
                ))}
              </span>
            )
            : null}
        </RecordField>
      </FieldGroup>

      <FieldGroup title="System" defaultOpen={false}>
        <RecordField label="Created" icon={Calendar}>{meeting.createdAt || null}</RecordField>
        <RecordField label="Meeting ID" icon={Hash} mono>
          <span className="text-xs text-gray-500 break-all">{meeting.id}</span>
        </RecordField>
      </FieldGroup>
    </div>
  )
}

// ── Header actions ────────────────────────────────────────────────────────────
//
// Shared so the panel and the page cannot drift. Edit and Delete are gated on
// the module's own flags, exactly as the old panel gated them by passing null.

export function MeetingActions({ meeting, perms = {}, onEdit, onDelete }) {
  if (!meeting) return null

  return (
    <>
      {perms.canEdit && (
        <button
          onClick={onEdit}
          title="Edit meeting"
          className="p-1.5 rounded-md text-gray-400 hover:text-teal-600 hover:bg-teal-50
                     transition-colors duration-120"
        >
          <Pencil size={15} />
        </button>
      )}
      {perms.canDelete && (
        <button
          onClick={onDelete}
          title="Delete meeting"
          className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50
                     transition-colors duration-120"
        >
          <Trash2 size={15} />
        </button>
      )}
    </>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

/**
 * @param {object} meeting
 * @param {object} perms  from useMeetingPermissions — gates the "add" affordance
 * @returns {Array} RecordShell `tabs`
 */
export function useMeetingTabs(meeting, perms = {}) {
  const meetingId = meeting?.id ?? null

  const { data: tasks = [], isLoading: tasksLoading } = useMeetingTasks(meetingId)
  const { data: files = [] }                          = useAttachments('meeting', meetingId)

  const { openAddModalWithPrefill: openTask, openDetail: openTaskDetail } = useTasksStore()

  if (!meeting) return []

  // One week after the meeting, or after today if it has no date. localISODate
  // and parseLocalDate throughout — a due date is a calendar date and UTC
  // shifts it a day for half the world.
  const suggestDueDate = () => {
    const base = parseLocalDate(meeting.scheduledDate) ?? new Date()
    base.setDate(base.getDate() + 7)
    return localISODate(base)
  }

  return [
    {
      key: 'timeline',
      label: 'Timeline',
      icon: Activity,
      render: () => (
        <TimelinePanel entityType="meeting" entityId={meeting.id} entityLabel={meeting.title} />
      ),
    },
    {
      key: 'tasks',
      label: 'Tasks',
      icon: CheckSquare,
      count: tasks.length,
      render: () => (
        <RelatedList
          isLoading={tasksLoading}
          items={tasks}
          emptyLabel="No follow-up tasks"
          onAdd={perms.canFollowUp ? () => openTask({
            relatedType:  'Meeting', relatedId: meeting.id,
            relatedLabel: meeting.title,
            title:        `Follow-up: ${meeting.title}`,
            dueDate:      suggestDueDate(),
            assignee:     meeting.organizer || '',
            priority:     'Medium',
          }) : null}
          addLabel="Add follow-up task"
          renderItem={(t) => (
            <button
              key={t.id}
              onClick={() => openTaskDetail(t.id)}
              className="w-full text-left px-2.5 py-2 rounded-lg border border-gray-100
                         hover:border-gray-200 hover:bg-gray-50 transition-colors duration-120"
            >
              <p className={`text-sm truncate
                ${t.status === 'Completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                {t.title}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {t.dueDate || 'No due date'} · {t.status}
              </p>
            </button>
          )}
        />
      ),
    },
    {
      key: 'files',
      label: 'Files',
      icon: Paperclip,
      count: files.length,
      // Lowercase 'meeting' — attachments want lowercase, meetings.related_type
      // stores capitalised. Both casings are correct in their own place.
      render: () => <AttachmentPanel relatedType="meeting" relatedId={meeting.id} compact />,
    },
  ]
}
