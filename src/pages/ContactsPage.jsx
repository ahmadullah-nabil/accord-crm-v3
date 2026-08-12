import React from 'react'
import { Users, RefreshCw } from 'lucide-react'
import { useContacts }            from '../hooks/useContacts.js'
import { useContactsStore }       from '../stores/contactsStore.js'
import { ContactsSummaryBar }     from '../components/contacts/ContactsSummaryBar.jsx'
import { ContactsToolbar }        from '../components/contacts/ContactsToolbar.jsx'
import { ContactsTable }          from '../components/contacts/ContactsTable.jsx'
import { ContactDetailPanel }     from '../components/contacts/ContactDetailPanel.jsx'
import { ContactFormModal }        from '../components/contacts/ContactFormModal.jsx'
import { MeetingFormModal }        from '../components/meetings/MeetingFormModal.jsx'
import { MeetingDetailPanel }      from '../components/meetings/MeetingDetailPanel.jsx'
import { TaskFormModal }           from '../components/tasks/TaskFormModal.jsx'
import { TaskDetailPanel }         from '../components/tasks/TaskDetailPanel.jsx'
import { UnauthorizedState }      from '../components/ui/UnauthorizedState.jsx'

export function ContactsPage() {
  const { data: allContacts = [], isLoading, isError, error, refetch } = useContacts()
  const { applyFilters } = useContactsStore()

  const filtered = applyFilters(allContacts)

  if (isError) {
    if (error?.isUnauthorized) {
      return <UnauthorizedState message={error.message} onRetry={refetch} />
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center ring-1 ring-red-200">
          <Users size={20} className="text-red-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Failed to load contacts</p>
          <p className="text-xs text-gray-500 max-w-xs">
            {error?.message ?? 'An unexpected error occurred. Please try again.'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-secondary text-sm gap-1.5"
        >
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
          <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center ring-1 ring-purple-200">
            <Users size={18} className="text-purple-600" />
          </div>
          <div>
            <h1 className="font-display font-bold text-gray-900 text-xl leading-tight">Contacts</h1>
            <p className="text-xs text-gray-500">Your full contact directory</p>
          </div>
        </div>

        {/* Summary pills */}
        <ContactsSummaryBar contacts={allContacts} />

        {/* Toolbar */}
        <ContactsToolbar total={allContacts.length} filtered={filtered.length} />

        {/* Table */}
        <ContactsTable contacts={filtered} isLoading={isLoading} />
      </div>

      {/* Detail panel */}
      <ContactDetailPanel />

      {/* Add / Edit modal */}
      <ContactFormModal />

      {/* Meeting scheduling modal — opened from ContactDetailPanel */}
      <MeetingFormModal />

      {/* Meeting detail panel — opened by clicking a meeting card */}
      <MeetingDetailPanel />

      {/* Task creation modal — opened from ContactDetailPanel */}
      <TaskFormModal />

      {/* Task detail panel — opened by clicking a task card */}
      <TaskDetailPanel />
    </>
  )
}

export default ContactsPage
