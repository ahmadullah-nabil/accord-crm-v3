// ─── TaskRecordContent ────────────────────────────────────────────────────────
//
// step047. What a task IS, as data: its field groups, its tabs, its header bits.
// Copy #4 of the LeadRecordContent pattern.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ THIS FILE EXISTS SO THE PANEL AND THE PAGE CANNOT DRIFT                 │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ TaskDetailPanel and TaskRecordPage both call these hooks. Add a field   │
// │ here and it appears on both surfaces; add it to one component and you   │
// │ have two versions of a task that disagree, which nobody notices because │
// │ nobody opens both in the same minute.                                    │
// └─────────────────────────────────────────────────────────────────────────┘
//
// A TASK HAS TWO TABS, NOT FIVE, AND THAT IS THE HONEST ANSWER
// ────────────────────────────────────────────────────────────
// Timeline and Files. That is every relation a task actually has:
//
//   • attachments  — real, keyed on ('task', id). The old panel showed these.
//   • activities   — real, the TimelinePanel.
//   • sub-tasks    — NO TABLE. tasks has no parent_task_id.
//   • meetings     — a task can point AT a meeting via related_type, but the
//                    relation is single-valued and already shown as a FIELD.
//                    A "Meetings" tab listing exactly one row, or zero, is a
//                    click to discover something the field already said.
//   • emails       — email_messages is keyed to lead/contact/opportunity. No
//                    surface has ever sent an email about a task and there is
//                    nothing to read back.
//
// Shipping empty tabs to match the shape of the lead record would be
// decoration. Two real tabs beat five, three of which never fill.
//
// OVERDUE IS DERIVED HERE TOO. The badge row computes it from isTaskOverdue()
// and renders it ALONGSIDE the stored status rather than replacing it — an
// overdue task is still Todo or In Progress, and a badge row that swaps one for
// the other loses the state the user can actually change.
//
// PERMISSIONS: getTaskPermissions() exists and nothing calls it. Both surfaces
// are ungated today and stay ungated here. `perms` is threaded through so the
// batch that decides has one place to change. See the note in TasksTable.

import React from 'react'
import {
  Calendar, Clock, User, Tag, Link2, FileText, Hash,
  Activity, Paperclip, Flag, CheckCircle2, AlertCircle, ListChecks,
  Circle, Pencil, Trash2,
} from 'lucide-react'

import { useAttachments }              from '../../hooks/useAttachments.js'
import { STATUS_CONFIG, PRIORITY_CONFIG, daysUntilDue } from '../../lib/tasksData.js'
import { isTaskOverdue, formatLocalDate } from '../../lib/dates.js'
import { Avatar }                      from '../ui/Avatar.jsx'
import { FieldGroup, RecordField }     from '../ui/FieldGroup.jsx'
import { TimelinePanel }               from '../timeline/TimelinePanel.jsx'
import { AttachmentPanel }             from '../attachments/AttachmentPanel.jsx'

// ── Badges ────────────────────────────────────────────────────────────────────

export function TaskBadges({ task }) {
  if (!task) return null
  const sc = STATUS_CONFIG[task.status]     || STATUS_CONFIG['Todo']
  const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG['Low']
  const overdue = isTaskOverdue(task)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`badge ${sc.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mr-1 ${sc.dot}`} />
        {sc.label}
      </span>
      <span className={`badge ${pc.color}`}>{pc.label} priority</span>
      {/* Derived, and shown IN ADDITION to the stored status — see header note. */}
      {overdue && (
        <span className="badge bg-red-50 text-red-600">
          <AlertCircle size={10} className="mr-1" /> Overdue
        </span>
      )}
    </div>
  )
}

// ── Field groups ──────────────────────────────────────────────────────────────

export function TaskFields({ task, assigneeRole }) {
  if (!task) return null

  const days = daysUntilDue(task.dueDate)
  const dueNote =
    task.status === 'Completed' ? null :
    days === null ? null :
    days <   0    ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue` :
    days === 0    ? 'Due today' :
    days === 1    ? 'Due tomorrow' :
                    `${days} days remaining`

  const dueNoteClass =
    days !== null && days <   0 ? 'text-red-500' :
    days !== null && days === 0 ? 'text-orange-500' :
    days !== null && days <=  2 ? 'text-amber-500' :
                                  'text-gray-400'

  return (
    <div>
      <FieldGroup title="Task">
        <RecordField label="Description" icon={FileText} placeholder="No description">
          {task.description || null}
        </RecordField>
        <RecordField label="Type" icon={ListChecks} placeholder="No type">
          {task.type || null}
        </RecordField>
        <RecordField label="Status" icon={CheckCircle2}>{task.status}</RecordField>
        <RecordField label="Priority" icon={Flag}>{task.priority}</RecordField>
      </FieldGroup>

      <FieldGroup title="Schedule">
        {/* Tasks are ALL-DAY and must stay so — there is no time component on
            this record and none should be invented for display. */}
        <RecordField label="Due date" icon={Calendar} placeholder="No due date">
          {task.dueDate
            ? (
              <span className="flex items-center gap-1.5 flex-wrap">
                <span className="tnum">
                  {formatLocalDate(task.dueDate, { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                {dueNote && (
                  <span className={`text-xs font-medium ${dueNoteClass}`}>{dueNote}</span>
                )}
              </span>
            )
            : null}
        </RecordField>
        {task.completedAt && (
          <RecordField label="Completed" icon={CheckCircle2} mono>
            {task.completedAt}
          </RecordField>
        )}
      </FieldGroup>

      <FieldGroup title="Assignee">
        <RecordField label="Owner" icon={User} placeholder="Unassigned">
          {task.assignee
            ? (
              <span className="flex items-center gap-1.5">
                <Avatar name={task.assignee} size="xs" />
                <span>{task.assignee}</span>
                {assigneeRole && <span className="text-gray-400">· {assigneeRole}</span>}
              </span>
            )
            : null}
        </RecordField>
      </FieldGroup>

      {/* The single-valued relation, shown as what it is: a field. This is why
          there is no Meetings tab — see the header note. */}
      <FieldGroup title="Related">
        <RecordField label="Type" icon={Link2} placeholder="Not linked">
          {task.relatedType && task.relatedType !== 'None' ? task.relatedType : null}
        </RecordField>
        <RecordField label="Record" icon={Hash} placeholder="—">
          {task.relatedType && task.relatedType !== 'None'
            ? (task.relatedLabel || <span className="text-xs text-gray-500 break-all">{task.relatedId}</span>)
            : null}
        </RecordField>
      </FieldGroup>

      <FieldGroup title="Tags" defaultOpen={Boolean(task.tags?.length)}>
        <RecordField label="Tags" icon={Tag} placeholder="No tags">
          {task.tags?.length
            ? (
              <span className="flex flex-wrap gap-1">
                {task.tags.map((t) => (
                  <span key={t} className="badge bg-gray-100 text-gray-600">{t}</span>
                ))}
              </span>
            )
            : null}
        </RecordField>
      </FieldGroup>

      <FieldGroup title="System" defaultOpen={false}>
        <RecordField label="Created" icon={Calendar}>{task.createdAt || null}</RecordField>
        <RecordField label="Task ID" icon={Hash} mono>
          <span className="text-xs text-gray-500 break-all">{task.id}</span>
        </RecordField>
      </FieldGroup>
    </div>
  )
}

// ── Header actions ────────────────────────────────────────────────────────────
//
// Shared so the panel and the page cannot drift, matching ContactActions and
// OppActions. The completion toggle is an ACTION, not a field: it is the one
// thing you open a task to do, and it belongs in the header where it is
// reachable from every tab.

export function TaskActions({ task, onToggle, onEdit, onDelete, isToggling }) {
  if (!task) return null
  const isComplete = task.status === 'Completed'

  return (
    <>
      <button
        onClick={onToggle}
        disabled={isToggling}
        title={isComplete ? 'Mark as Todo' : 'Mark as Completed'}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                    transition-colors duration-120 disabled:opacity-40
          ${isComplete
            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
      >
        {isComplete ? <CheckCircle2 size={12} /> : <Circle size={12} />}
        {isComplete ? 'Completed' : 'Complete'}
      </button>
      <button
        onClick={onEdit}
        title="Edit task"
        className="p-1.5 rounded-md text-gray-400 hover:text-teal-600 hover:bg-teal-50
                   transition-colors duration-120"
      >
        <Pencil size={15} />
      </button>
      <button
        onClick={onDelete}
        title="Delete task"
        className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50
                   transition-colors duration-120"
      >
        <Trash2 size={15} />
      </button>
    </>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

/**
 * @param {object} task
 * @returns {Array} RecordShell `tabs`
 */
export function useTaskTabs(task) {
  const taskId = task?.id ?? null
  const { data: files = [] } = useAttachments('task', taskId)

  if (!task) return []

  return [
    {
      key: 'timeline',
      label: 'Timeline',
      icon: Activity,
      render: () => (
        <TimelinePanel entityType="task" entityId={task.id} entityLabel={task.title} />
      ),
    },
    {
      key: 'files',
      label: 'Files',
      icon: Paperclip,
      count: files.length,
      // Lowercase 'task' — attachments want lowercase, tasks.related_type
      // stores capitalised. Both casings are correct in their own place.
      render: () => <AttachmentPanel relatedType="task" relatedId={task.id} compact />,
    },
  ]
}
