import React, { useState } from 'react'
import { Search, SlidersHorizontal, Plus, X, Upload } from 'lucide-react'
import { useQueryClient }                             from '@tanstack/react-query'
import { useContactsStore }   from '../../stores/contactsStore.js'
import { CONTACT_TYPES, CONTACT_STATUSES } from '../../lib/contactsData.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'
import { useAuthStore }       from '../../stores/authStore.js'
import { isManager }          from '../../lib/permissions.js'
import { ImportModal }        from '../import-export/ImportModal.jsx'
import { ExportButton }       from '../import-export/ExportButton.jsx'

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
    searchQuery || typeFilter !== 'All' || statusFilter !== 'All' || assigneeFilter !== 'All'

  return (
    <>
      <div className="card px-4 py-3 space-y-3">
        {/* Row 1: search + count + add */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search by name, company, email or role…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base pl-9 py-2 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Result count */}
          {total !== undefined && (
            <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:inline">
              {filtered} of {total}
            </span>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {canImport && (
              <button
                onClick={() => setShowImport(true)}
                className="btn-secondary py-2 text-sm flex items-center gap-1.5"
                title="Import contacts from CSV"
              >
                <Upload size={14} /> Import
              </button>
            )}
            <ExportButton entityType="contact" />
            <button onClick={openAddModal} className="btn-primary py-2 text-sm">
              <Plus size={15} /> Add Contact
            </button>
          </div>
        </div>

        {/* Row 2: filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal size={13} className="text-gray-400 flex-shrink-0" />

          <FilterSelect
            label="Type"
            value={typeFilter}
            onChange={setTypeFilter}
            options={CONTACT_TYPES}
          />
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={CONTACT_STATUSES}
          />
          <FilterSelect
            label="Assignee"
            value={assigneeFilter}
            onChange={setAssigneeFilter}
            options={assigneeNames}
          />

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium ml-1"
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>
      </div>

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

function FilterSelect({ label, value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`text-xs font-medium rounded-lg px-2.5 py-1.5 border outline-none cursor-pointer
        transition-all duration-150
        ${value !== 'All'
          ? 'bg-teal-50 border-teal-300 text-teal-700'
          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
        }`}
    >
      <option value="All">{label}: All</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
