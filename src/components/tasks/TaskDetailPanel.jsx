// ─── TaskDetailPanel ──────────────────────────────────────────────────────────
//
// step047. The one-long-scroll panel is now a tabbed record surface, matching
// the three modules before it.
//
// WHAT CHANGED
// ────────────
// Before: a 420px panel with seven stacked <Section> blocks — Description, Due
// Date, Assignee, Related, Tags, Details, Files — plus a timeline at the bottom.
// Reaching the timeline meant scrolling past every field every time.
//
// Now: fields live in collapsible groups, and the two things a task actually
// relates to (its activity trail and its attachments) are tabs. The field
// definitions, badges, header actions and tab list come from TaskRecordContent,
// which TaskRecordPage also uses.
//
// RECORD NAVIGATION IS SUPPLIED BY THE CALLER, NOT FETCHED HERE
// ─────────────────────────────────────────────────────────────
// This panel is mounted on SEVEN pages — Leads, Contacts, Opportunities, their
// three record pages, and Meetings — because a task can be opened from any of
// them. So it must not fetch a task list of its own: calling useTasks() here
// would put a tasks query on the Leads page, which has no task list on it and
// never asked for one.
//
// `records` is the caller's already-filtered array. TasksPage passes `filtered`;
// everyone else passes nothing and gets no arrows — which is the correct answer,
// because there is no visible list for the arrows to walk. That is the same
// invariant as everywhere else ("nav must walk the CALLER'S filtered list"),
// enforced by the signature rather than by each caller remembering it.
//
// PERMISSIONS ARE UNCHANGED, WHICH MEANS THERE ARE NONE. This panel never
// gated Edit, Delete or the completion toggle and still does not. See the note
// in TasksTable — it needs its own decision, not a UI diff.

import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckSquare } from 'lucide-react'

import { useTasksStore }   from '../../stores/tasksStore.js'
import {
  useTask, useDeleteTask, useToggleTaskComplete,
} from '../../hooks/useTasks.js'
import { useRoleByName }   from '../../hooks/useTeam.js'
import { RecordShell }     from '../ui/RecordShell.jsx'
import {
  TaskFields, TaskBadges, TaskActions, useTaskTabs,
} from './TaskRecordContent.jsx'

export function TaskDetailPanel({ records = null }) {
  const navigate = useNavigate()
  const {
    detailPanelOpen, closeDetail, openDetail, selectedTaskId,
    openEditModal,
  } = useTasksStore()

  const { data: task, isLoading } = useTask(
    detailPanelOpen ? selectedTaskId : null
  )
  const deleteMutation = useDeleteTask()
  const toggleMutation = useToggleTaskComplete()

  const tabs = useTaskTabs(task)
  const assigneeRole = useRoleByName(task?.assignee)

  const nav = useMemo(() => {
    if (!records) return null
    const ordered = records
    const index = ordered.findIndex((t) => t.id === selectedTaskId)
    if (index === -1) return null
    return {
      index,
      total: ordered.length,
      onPrev: () => index > 0 && openDetail(ordered[index - 1].id),
      onNext: () => index < ordered.length - 1 && openDetail(ordered[index + 1].id),
    }
  }, [records, selectedTaskId, openDetail])

  const handleDelete = () => {
    if (!task) return
    if (window.confirm(`Delete task "${task.title}"?`)) {
      deleteMutation.mutate(task.id, { onSuccess: closeDetail })
    }
  }

  const handleToggle = () => {
    if (!task) return
    toggleMutation.mutate({ id: task.id, currentStatus: task.status })
  }

  const isComplete = task?.status === 'Completed'

  return (
    <RecordShell
      variant="panel"
      open={detailPanelOpen}
      onClose={closeDetail}
      onExpand={task ? () => { closeDetail(); navigate(`/tasks/${task.id}`) } : undefined}
      isLoading={isLoading}
      avatar={
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
          ${isComplete ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
          <CheckSquare size={15} />
        </span>
      }
      title={task?.title ?? 'Loading…'}
      subtitle={task?.relatedLabel || null}
      badges={task ? <TaskBadges task={task} /> : null}
      nav={nav}
      actions={
        <TaskActions
          task={task}
          isToggling={toggleMutation.isPending}
          onToggle={handleToggle}
          onEdit={() => openEditModal(task.id)}
          onDelete={handleDelete}
        />
      }
      fields={<TaskFields task={task} assigneeRole={assigneeRole} />}
      tabs={tabs}
    />
  )
}

export default TaskDetailPanel
