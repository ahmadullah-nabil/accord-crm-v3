import React from 'react'
import { CheckSquare, RefreshCw } from 'lucide-react'
import { useTasks }           from '../hooks/useTasks.js'
import { useTasksStore }      from '../stores/tasksStore.js'
import { TasksSummaryBar }    from '../components/tasks/TasksSummaryBar.jsx'
import { TasksToolbar }       from '../components/tasks/TasksToolbar.jsx'
import { TasksTable }         from '../components/tasks/TasksTable.jsx'
import { TaskDetailPanel }    from '../components/tasks/TaskDetailPanel.jsx'
import { TaskFormModal }      from '../components/tasks/TaskFormModal.jsx'
import { UnauthorizedState }  from '../components/ui/UnauthorizedState.jsx'

export function TasksPage() {
  const { data: allTasks = [], isLoading, isError, error, refetch } = useTasks()
  const { applyFilters } = useTasksStore()

  const filtered = applyFilters(allTasks)

  if (isError) {
    if (error?.isUnauthorized) {
      return <UnauthorizedState message={error.message} onRetry={refetch} />
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center ring-1 ring-red-200">
          <CheckSquare size={20} className="text-red-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Failed to load tasks</p>
          <p className="text-xs text-gray-500 max-w-xs">
            {error?.message ?? 'An unexpected error occurred. Please try again.'}
          </p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary text-sm gap-1.5">
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4 max-w-[1600px]">
        {/* Page heading */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center ring-1 ring-emerald-200">
            <CheckSquare size={18} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="font-display font-bold text-gray-900 text-xl leading-tight">Tasks</h1>
            <p className="text-xs text-gray-500">Track and manage all sales activities</p>
          </div>
        </div>

        {/* Status summary */}
        <TasksSummaryBar tasks={allTasks} />

        {/* Toolbar */}
        <TasksToolbar total={allTasks.length} filtered={filtered.length} />

        {/* Table */}
        <TasksTable tasks={filtered} isLoading={isLoading} />
      </div>

      {/* Detail panel */}
      <TaskDetailPanel />

      {/* Add / Edit modal */}
      <TaskFormModal />
    </>
  )
}

export default TasksPage
