// ─── ContactsToolbar ──────────────────────────────────────────────────────────
//
// step036. The two-row card is now one ViewHeader row.
//
// Everything functional is carried over unchanged: the UUID filter on assignee
// names, the isManager() gate on Import, the ExportButton, the ImportModal and
// its query invalidation. Only the layout moved.
//
// The UUID filter in particular is load-bearing and easy to mistake for
// defensive noise — it keeps static fallback data out of the assignee dropdown.
// It is kept exactly as it was.

import React, { useState } from 'react'
import { Plus, Upload } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useContactsStore }                   from '../../stores/contactsStore.js'
import { CONTACT_TYPES, CONTACT_STATUSES }    from '../../lib/contactsData.js'
import { useAssignableMembers }               from '../../hooks/useTeam.js'
import { useAuthStore }                       from '../../stores/authStore.js'
import { isManager }                          from '../../lib/permissions.js'
import { ImportModal }                        from '../import-export/ImportModal.jsx'
import { ExportButton }                       from '../import-export/ExportButton.jsx'
import { ViewHeader }                         from '../ui/ViewHeader.jsx'

export function ContactsToolbar({ total, filtered }) {
  const {
    searchQuery, setSearchQuery,
    typeFilter, setTypeFilter,
    statusFilter, setStatusFilter,
    assigneeFilter, setAssigneeFilter,
    openAddModal, clearFilters,
  } = useContactsStore()

  // Filter to real Supabase profiles only (UUID ids) — prevents static fallback
  // data from appearing in the assignee filter dropdown.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const { members: allMembers } = useAssignableMembers()
  const assigneeNames = allMembers
    .filter((m) => UUID_RE.test(m.id ?? ''))
    .map((m) => m.name)
    .filter(Boolean)

  const user      = useAuthStore((s) => s.user)
  const canImport = isManager(user)
  const [showImport, setShowImport] = useState(false)
  const qc = useQueryClient()

  const hasFilters =
    Boolean(searchQuery) || typeFilter !== 'All' || statusFilter !== 'All' || assigneeFilter !== 'All'

  return (
    <>
      <ViewHeader
        title="All contacts"
        count={filtered}
        total={total}
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Search contacts',
        }}
        filters={[
          { label: 'Type',     value: typeFilter,     onChange: setTypeFilter,     options: CONTACT_TYPES },
          { label: 'Status',   value: statusFilter,   onChange: setStatusFilter,   options: CONTACT_STATUSES },
          { label: 'Assignee', value: assigneeFilter, onChange: setAssigneeFilter, options: assigneeNames },
        ]}
        hasFilters={hasFilters}
        onClearFilters={clearFilters}
        actions={
          <>
            {canImport && (
              <button
                onClick={() => setShowImport(true)}
                className="btn-secondary"
                title="Import contacts from CSV"
              >
                <Upload size={14} /> Import
              </button>
            )}
            <ExportButton entityType="contact" />
            <button onClick={openAddModal} className="btn-primary">
              <Plus size={14} /> New contact
            </button>
          </>
        }
      />

      {showImport && (
        <ImportModal
          entityType="contact"
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            setShowImport(false)
            qc.invalidateQueries({ queryKey: ['contacts'] })
          }}
        />
      )}
    </>
  )
}

export default ContactsToolbar
