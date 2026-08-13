// ─── ContactsPage ─────────────────────────────────────────────────────────────
//
// step036. The page heading block is gone.
//
// It was a 36px purple icon tile, an <h1> reading "Contacts", and a subtitle
// reading "Your full contact directory" — on a page reached by clicking
// "Contacts" in the sidebar, where the top bar already reads "Contacts". Three
// restatements of one word, costing ~64px above the fold on every module.
//
// Nothing else about this page changed: same data hook, same filters, same
// modals and panels mounted in the same order.

import React from 'react'
import { Users, RefreshCw } from 'lucide-react'
import { useContacts }            from '../hooks/useContacts.js'
import { useContactsStore }       from '../stores/contactsStore.js'
import { ContactsSummaryBar }     from '../components/contacts/ContactsSummaryBar.jsx'
import { ContactsToolbar }        from '../components/contacts/ContactsToolbar.jsx'
import { ContactsTable }          from '../components/contacts/ContactsTable.jsx'
import { ContactDetailPanel }     from '../components/contacts/ContactDetailPanel.jsx'
import { ContactFormModal }       from '../components/contacts/ContactFormModal.jsx'
import { MeetingFormModal }       from '../components/meetings/MeetingFormModal.jsx'
import { MeetingDetailPanel }     from '../components/meetings/MeetingDetailPanel.jsx'
import { TaskFormModal }          from '../components/tasks/TaskFormModal.jsx'
import { TaskDetailPanel }        from '../components/tasks/TaskDetailPanel.jsx'
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3">
        <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
          <Users size={18} className="text-red-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 mb-0.5">Could not load contacts</p>
          <p className="text-xs text-gray-500 max-w-xs">
            {error?.message ?? 'Something went wrong. Try again.'}
          </p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary">
          <RefreshCw size={13} />
          Try again
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        <ContactsSummaryBar contacts={allContacts} />
        <ContactsToolbar total={allContacts.length} filtered={filtered.length} />
        <ContactsTable contacts={filtered} isLoading={isLoading} />
      </div>

      <ContactDetailPanel />
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
