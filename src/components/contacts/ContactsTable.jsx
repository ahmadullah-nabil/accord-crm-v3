// ─── ContactsTable ────────────────────────────────────────────────────────────
//
// step035. First consumer of the DataTable primitive. 234 lines → this.
//
// Everything that used to live here — the header markup, the sort chevrons, the
// row hover, the row action menu, the skeleton, the footer count — is now the
// primitive's job. What is left is the part that is genuinely about contacts:
// which columns exist, and how each cell renders.
//
// BEHAVIOUR IS UNCHANGED. Same store actions, same delete confirmation, same
// row-click-opens-the-detail-panel. If something behaves differently after this
// batch, it is a bug in the migration and not a decision.

import React from 'react'
import {
  Users, Briefcase, Tag, Activity, User, Clock,
  Eye, Pencil, Trash2,
} from 'lucide-react'
import { useContactsStore }              from '../../stores/contactsStore.js'
import { useDeleteContact }              from '../../hooks/useContacts.js'
import { TYPE_COLORS, STATUS_COLORS }    from '../../lib/contactsData.js'
import { Avatar }                        from '../ui/Avatar.jsx'
import { DataTable }                     from '../ui/DataTable.jsx'

export function ContactsTable({ contacts, isLoading }) {
  const {
    sortField, sortDir, setSort,
    openDetail, openEditModal, openAddModal,
  } = useContactsStore()
  const deleteMutation = useDeleteContact()

  const columns = [
    {
      key: 'name',
      label: 'Contact',
      icon: Users,
      sortable: true,
      width: '260px',
      render: (c) => (
        <div className="flex items-center gap-2">
          <Avatar name={c.name} src={c.avatar} size="xs" />
          <span className="font-medium text-gray-900 truncate">{c.name}</span>
          {c.company && (
            <span className="text-gray-400 truncate">· {c.company}</span>
          )}
        </div>
      ),
    },
    {
      key: 'designation',
      label: 'Role',
      icon: Briefcase,
      render: (c) => c.designation || <span className="text-gray-300">—</span>,
    },
    {
      key: 'type',
      label: 'Type',
      icon: Tag,
      sortable: true,
      render: (c) => (
        <span className={`badge ${TYPE_COLORS[c.type] || 'bg-gray-100 text-gray-600'}`}>
          {c.type}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      icon: Activity,
      sortable: true,
      render: (c) => (
        <span className={`badge ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0
            ${c.status === 'Active' ? 'bg-emerald-500' : 'bg-red-400'}`} />
          {c.status}
        </span>
      ),
    },
    {
      key: 'assignee',
      label: 'Assignee',
      icon: User,
      render: (c) => (
        c.assignee
          ? (
            <div className="flex items-center gap-1.5">
              <Avatar name={c.assignee} size="xs" />
              <span className="truncate">{c.assignee}</span>
            </div>
          )
          : <span className="text-gray-300">Unassigned</span>
      ),
    },
    {
      key: 'lastActivity',
      label: 'Last activity',
      icon: Clock,
      sortable: true,
      render: (c) => <span className="text-gray-500">{c.lastActivity}</span>,
    },
  ]

  // Counts only. There is nothing on a contact worth summing, and a total of
  // something meaningless is worse than an empty strip.
  const active = contacts.filter((c) => c.status === 'Active').length

  return (
    <DataTable
      columns={columns}
      rows={contacts}
      isLoading={isLoading}
      selectable
      sort={{ field: sortField, dir: sortDir }}
      onSort={setSort}
      onRowClick={(c) => openDetail(c.id)}
      onAddNew={openAddModal}
      rowActions={(c) => [
        { label: 'Open',   icon: Eye,    onClick: () => openDetail(c.id) },
        { label: 'Edit',   icon: Pencil, onClick: () => openEditModal(c.id) },
        {
          label: 'Delete',
          icon: Trash2,
          danger: true,
          onClick: () => {
            if (confirm(`Delete contact "${c.name}"?`)) deleteMutation.mutate(c.id)
          },
        },
      ]}
      aggregates={[
        { label: 'Contacts', value: contacts.length },
        { label: 'Active',   value: active },
      ]}
      empty={{
        icon: Users,
        title: 'No contacts found',
        description: 'Try adjusting your search or filter criteria.',
      }}
    />
  )
}

export default ContactsTable
