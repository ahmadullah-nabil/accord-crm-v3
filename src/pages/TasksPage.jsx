// ─── TasksPage ────────────────────────────────────────────────────────────────
//
// step047. The page heading block is gone, matching the four modules before it.
//
// It was a 36px emerald icon tile, an <h1> reading "Tasks" and a subtitle
// reading "Track and manage all sales activities" — on a page reached by
// clicking "Tasks" in the sidebar, under a top bar already reading the same
// word.
//
// Spacing drops from space-y-4 to space-y-2 to match: the chips, the header row
// and the table are one block, and 16px gutters read as three separate cards.
//
// Nothing else changed: same hook, same filters, same panel and modal mounted
// in the same order.

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
      <div className="space-y-2 max-w-[1600px]">
        <TasksSummaryBar tasks={allTasks} />
        <TasksToolbar total={allTasks.length} filtered={filtered.length} />
        <TasksTable tasks={filtered} isLoading={isLoading} />
      </div>

      {/* The panel's record arrows walk THIS array — the rows actually on
          screen. See the note in TaskDetailPanel about why it is passed in
          rather than fetched there. */}
      <TaskDetailPanel records={filtered} />
      <TaskFormModal />
    </>
  )
}

export default TasksPage
