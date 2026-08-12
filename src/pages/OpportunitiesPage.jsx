import React from 'react'
import { TrendingUp, RefreshCw } from 'lucide-react'
import { useOpportunities }        from '../hooks/useOpportunities.js'
import { useOpportunitiesStore }   from '../stores/opportunitiesStore.js'
import { OppSummaryBar }           from '../components/opportunities/OppSummaryBar.jsx'
import { OpportunitiesToolbar }    from '../components/opportunities/OpportunitiesToolbar.jsx'
import { OpportunitiesKanban }     from '../components/opportunities/OpportunitiesKanban.jsx'
import { OpportunitiesTable }      from '../components/opportunities/OpportunitiesTable.jsx'
import { OppDetailPanel }          from '../components/opportunities/OppDetailPanel.jsx'
import { OppFormModal }            from '../components/opportunities/OppFormModal.jsx'
import { UnauthorizedState }       from '../components/ui/UnauthorizedState.jsx'
import { MeetingFormModal }        from '../components/meetings/MeetingFormModal.jsx'
import { MeetingDetailPanel }      from '../components/meetings/MeetingDetailPanel.jsx'
import { TaskFormModal }           from '../components/tasks/TaskFormModal.jsx'
import { TaskDetailPanel }         from '../components/tasks/TaskDetailPanel.jsx'

export function OpportunitiesPage() {
  const { data: allOpps = [], isLoading, isError, error, refetch } = useOpportunities()
  const { viewMode, applyFilters } = useOpportunitiesStore()

  const filtered = applyFilters(allOpps)

  if (isError) {
    if (error?.isUnauthorized) {
      return <UnauthorizedState message={error.message} onRetry={refetch} />
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center ring-1 ring-red-200">
          <TrendingUp size={20} className="text-red-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Failed to load deals</p>
          <p className="text-xs text-gray-500 max-w-xs">
            {error?.message ?? 'An unexpected error occurred.'}
          </p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary text-sm gap-1.5">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4 max-w-[1600px]">
        {/* Page heading */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center ring-1 ring-teal-200">
            <TrendingUp size={18} className="text-teal-600" />
          </div>
          <div>
            <h1 className="font-display font-bold text-gray-900 text-xl leading-tight">Opportunities</h1>
            <p className="text-xs text-gray-500">Manage your deals pipeline</p>
          </div>
        </div>

        {/* Summary bar */}
        <OppSummaryBar opportunities={allOpps} />

        {/* Toolbar */}
        <OpportunitiesToolbar total={allOpps.length} filtered={filtered.length} />

        {/* View: kanban or table */}
        {viewMode === 'kanban'
          ? <OpportunitiesKanban opportunities={filtered} />
          : <OpportunitiesTable  opportunities={filtered} isLoading={isLoading} />
        }
      </div>

      {/* Opportunities detail + form */}
      <OppDetailPanel />
      <OppFormModal />

      {/* Meeting + Task modals triggered from the detail panel */}
      <MeetingFormModal />
      <MeetingDetailPanel />
      <TaskFormModal />
      <TaskDetailPanel />
    </>
  )
}

export default OpportunitiesPage
