// ─── MeetingsPage ─────────────────────────────────────────────────────────────
//
// step048. The page heading block is gone, matching every other module.
//
// It was a 36px amber icon tile, an <h1> reading "Meetings" and a subtitle
// reading "Schedule and track all client meetings" — on a page reached by
// clicking "Meetings" in the sidebar, under a top bar already reading the same
// word. Spacing drops to space-y-2 to match.

import React from 'react'
import { Calendar, RefreshCw } from 'lucide-react'
import { useMeetings }           from '../hooks/useMeetings.js'
import { useMeetingsStore }      from '../stores/meetingsStore.js'
import { MeetingsSummaryBar }    from '../components/meetings/MeetingsSummaryBar.jsx'
import { MeetingsToolbar }       from '../components/meetings/MeetingsToolbar.jsx'
import { MeetingsTable }         from '../components/meetings/MeetingsTable.jsx'
import { MeetingDetailPanel }    from '../components/meetings/MeetingDetailPanel.jsx'
import { MeetingFormModal }      from '../components/meetings/MeetingFormModal.jsx'
import { UnauthorizedState }     from '../components/ui/UnauthorizedState.jsx'
// Task modals — mounted here so they work when triggered from MeetingDetailPanel
import { TaskFormModal }         from '../components/tasks/TaskFormModal.jsx'
import { TaskDetailPanel }       from '../components/tasks/TaskDetailPanel.jsx'

export function MeetingsPage() {
  const { data: allMeetings = [], isLoading, isError, error, refetch } = useMeetings()
  const { applyFilters } = useMeetingsStore()

  const filtered = applyFilters(allMeetings)

  if (isError) {
    if (error?.isUnauthorized) {
      return <UnauthorizedState message={error.message} onRetry={refetch} />
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center ring-1 ring-red-200">
          <Calendar size={20} className="text-red-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Failed to load meetings</p>
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
        <MeetingsSummaryBar meetings={allMeetings} />
        <MeetingsToolbar total={allMeetings.length} filtered={filtered.length} />
        <MeetingsTable meetings={filtered} isLoading={isLoading} />
      </div>

      {/* The panel's record arrows walk THIS array — the rows actually on
          screen. See the note in MeetingDetailPanel about why it is passed in
          rather than fetched there. */}
      <MeetingDetailPanel records={filtered} />

      {/* Add / Edit meeting modal */}
      <MeetingFormModal />

      {/* Task modals — driven by tasksStore, triggered from MeetingDetailPanel */}
      <TaskFormModal />
      <TaskDetailPanel />
    </>
  )
}

export default MeetingsPage
