import React, { useEffect } from 'react'
import { Target, RefreshCw } from 'lucide-react'
import { LeadsSummaryBar }  from '../components/leads/LeadsSummaryBar.jsx'
import { LeadsToolbar }     from '../components/leads/LeadsToolbar.jsx'
import { LeadsTable }       from '../components/leads/LeadsTable.jsx'
import { LeadsKanban }      from '../components/leads/LeadsKanban.jsx'
import { LeadDetailPanel }  from '../components/leads/LeadDetailPanel.jsx'
import { LeadFormModal }    from '../components/leads/LeadFormModal.jsx'
import { useLeadsStore }    from '../stores/leadsStore.js'
// Meeting modals are mounted here so they work when triggered from the lead panel
import { MeetingFormModal }   from '../components/meetings/MeetingFormModal.jsx'
import { MeetingDetailPanel } from '../components/meetings/MeetingDetailPanel.jsx'
// Task modals — triggered when creating follow-up tasks from a meeting opened via leads
import { TaskFormModal }      from '../components/tasks/TaskFormModal.jsx'
import { TaskDetailPanel }    from '../components/tasks/TaskDetailPanel.jsx'
import { OppFormModal }       from '../components/opportunities/OppFormModal.jsx'
export function LeadsPage() {
  const { viewMode, isLoading, error, initialize } = useLeadsStore()

  // Fetch leads from Supabase when the page mounts.
  // initialize() is a no-op if the user is not authenticated.
  useEffect(() => {
    initialize()
  }, [initialize])

  if (error && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center ring-1 ring-red-200">
          <Target size={20} className="text-red-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Failed to load leads</p>
          <p className="text-xs text-gray-500 max-w-xs">{error}</p>
        </div>
        <button onClick={() => initialize()} className="btn-secondary text-sm gap-1.5">
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
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center ring-1 ring-blue-200">
            <Target size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="font-display font-bold text-gray-900 text-xl leading-tight">Leads</h1>
            <p className="text-xs text-gray-500">Manage and track your sales pipeline</p>
          </div>
        </div>

        {/* Pipeline summary */}
        <LeadsSummaryBar />

        {/* Toolbar */}
        <LeadsToolbar />

        {/* View: table or kanban */}
        {viewMode === 'table' ? <LeadsTable /> : <LeadsKanban />}
      </div>

      {/* Detail slide-in panel */}
      <LeadDetailPanel />

      {/* Add / Edit lead modal */}
      <LeadFormModal />

      {/* Meeting modals — driven by meetingsStore, triggered from LeadDetailPanel */}
      <MeetingFormModal />
      <MeetingDetailPanel />

      {/* Task modals — triggered when creating follow-up tasks from a meeting in the lead context */}
      <TaskFormModal />
      <TaskDetailPanel />
      <OppFormModal />
    </>
  )
}

export default LeadsPage
