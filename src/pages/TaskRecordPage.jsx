// ─── TaskRecordPage ───────────────────────────────────────────────────────────
//
// step047. /tasks/:id — the fourth record route.
//
// COLD ARRIVAL IS READ, NOT INFERRED. Tasks is on React Query, so useTask(id)
// fetches that one row and a pasted link in a fresh tab is an ordinary query
// with an ordinary loading state. "Not found" comes from PostgREST's PGRST116
// via error.isNotFound rather than being inferred from an empty store — a
// deleted id and an id behind RLS give different, accurate answers. Same shape
// as ContactRecordPage and OppRecordPage; see the fuller note in either.
//
// MODALS ARE MOUNTED HERE. TaskFormModal is opened by the Edit button on this
// page, and a modal whose page never mounted it simply does not appear — no
// error, no message, just a button that looks dead.

import React, { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckSquare, RefreshCw } from 'lucide-react'

import { useTasksStore }   from '../stores/tasksStore.js'
import {
  useTask, useTasks, useDeleteTask, useToggleTaskComplete,
} from '../hooks/useTasks.js'
import { useRoleByName }      from '../hooks/useTeam.js'
import { RecordShell }        from '../components/ui/RecordShell.jsx'
import { UnauthorizedState }  from '../components/ui/UnauthorizedState.jsx'
import {
  TaskFields, TaskBadges, TaskActions, useTaskTabs,
} from '../components/tasks/TaskRecordContent.jsx'

import { TaskFormModal } from '../components/tasks/TaskFormModal.jsx'

export function TaskRecordPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { openEditModal, applyFilters } = useTasksStore()
  const { data: task, isLoading, isError, error, refetch } = useTask(id)
  const deleteMutation = useDeleteTask()
  const toggleMutation = useToggleTaskComplete()

  const tabs = useTaskTabs(task)
  const assigneeRole = useRoleByName(task?.assignee)

  // Same filtered ordering the list and panel use. On a cold arrival the list
  // query is still in flight, so `ordered` is empty and nav is null — the
  // arrows appear once it lands rather than pointing at a one-item universe.
  const { data: allTasks = [] } = useTasks()
  const ordered = applyFilters(allTasks)

  const nav = useMemo(() => {
    const index = ordered.findIndex((t) => t.id === id)
    if (index === -1) return null
    return {
      index,
      total: ordered.length,
      onPrev: () => index > 0 && navigate(`/tasks/${ordered[index - 1].id}`),
      onNext: () => index < ordered.length - 1 && navigate(`/tasks/${ordered[index + 1].id}`),
    }
  }, [ordered, id, navigate])

  const handleDelete = () => {
    if (!task) return
    if (window.confirm(`Delete task "${task.title}"?`)) {
      // The record no longer exists, so this route no longer resolves.
      deleteMutation.mutate(task.id, { onSuccess: () => navigate('/tasks') })
    }
  }

  const handleToggle = () => {
    if (!task) return
    toggleMutation.mutate({ id: task.id, currentStatus: task.status })
  }

  if (isError && error?.isUnauthorized) {
    return <UnauthorizedState message={error.message} onRetry={refetch} />
  }

  if (isError && error?.isNotFound) {
    return (
      <CentredState
        title="Task not found"
        detail="It may have been deleted, or you may not have access to it."
        actionLabel="Back to tasks"
        onAction={() => navigate('/tasks')}
      />
    )
  }

  if (isError) {
    return (
      <CentredState
        title="Could not load task"
        detail={error?.message ?? 'Something went wrong. Try again.'}
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    )
  }

  const isComplete = task?.status === 'Completed'

  return (
    <>
      <RecordShell
        variant="page"
        breadcrumb="Tasks"
        onBack={() => navigate('/tasks')}
        isLoading={isLoading || !task}
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

      <TaskFormModal />
    </>
  )
}

function CentredState({ title, detail, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3">
      <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
        <CheckSquare size={18} className="text-red-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900 mb-0.5">{title}</p>
        <p className="text-xs text-gray-500 max-w-xs">{detail}</p>
      </div>
      <button onClick={onAction} className="btn-secondary">
        <RefreshCw size={13} /> {actionLabel}
      </button>
    </div>
  )
}

export default TaskRecordPage
