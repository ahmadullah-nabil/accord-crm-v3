import React from 'react'
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  MoreHorizontal, Eye, Pencil, Trash2,
} from 'lucide-react'
import { useContactsStore }                    from '../../stores/contactsStore.js'
import { useDeleteContact }                    from '../../hooks/useContacts.js'
import { TYPE_COLORS, STATUS_COLORS }          from '../../lib/contactsData.js'
import { Avatar }                              from '../ui/Avatar.jsx'
import { Skeleton }                            from '../ui/Skeleton.jsx'
import { EmptyState }                          from '../ui/EmptyState.jsx'
import { Users }                               from 'lucide-react'

const COLS = [
  { key: 'name',         label: 'Contact',       sortable: true  },
  { key: 'designation',  label: 'Role',          sortable: false },
  { key: 'type',         label: 'Type',          sortable: true  },
  { key: 'status',       label: 'Status',        sortable: true  },
  { key: 'assignee',     label: 'Assignee',      sortable: false },
  { key: 'lastActivity', label: 'Last Activity', sortable: true  },
  { key: 'actions',      label: '',              sortable: false },
]

export function ContactsTable({ contacts, isLoading }) {
  const { sortField, sortDir, setSort, openDetail, openEditModal } = useContactsStore()
  const deleteMutation = useDeleteContact()

  if (isLoading) return <TableSkeleton />

  if (!contacts.length) {
    return (
      <div className="card">
        <EmptyState
          icon={Users}
          title="No contacts found"
          description="Try adjusting your search or filter criteria."
        />
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              {COLS.map((col) => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => setSort(col.key) : undefined}
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-500
                    uppercase tracking-wider whitespace-nowrap
                    ${col.sortable ? 'cursor-pointer select-none hover:text-gray-700 group' : ''}`}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      sortField === col.key
                        ? sortDir === 'asc'
                          ? <ChevronUp size={12} className="text-teal-500" />
                          : <ChevronDown size={12} className="text-teal-500" />
                        : <ChevronsUpDown size={11} className="text-gray-300 group-hover:text-gray-400" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {contacts.map((contact) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                onOpen={() => openDetail(contact.id)}
                onEdit={() => openEditModal(contact.id)}
                onDelete={() => {
                  if (confirm(`Delete contact "${contact.name}"?`)) {
                    deleteMutation.mutate(contact.id)
                  }
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 border-t border-gray-50 bg-gray-50/40">
        <p className="text-xs text-gray-400">
          {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────
function ContactRow({ contact, onOpen, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = React.useState(false)

  return (
    <tr
      onClick={onOpen}
      className="hover:bg-gray-50/60 transition-colors duration-100 cursor-pointer group"
    >
      {/* Contact name + company */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={contact.name} src={contact.avatar} size="sm" />
          <div>
            <p className="font-medium text-gray-900 text-sm leading-tight">{contact.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{contact.company}</p>
          </div>
        </div>
      </td>

      {/* Designation */}
      <td className="px-4 py-3">
        <span className="text-xs text-gray-600">{contact.designation || '—'}</span>
      </td>

      {/* Type badge */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
          ${TYPE_COLORS[contact.type] || 'bg-gray-100 text-gray-600'}`}>
          {contact.type}
        </span>
      </td>

      {/* Status badge */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
          ${STATUS_COLORS[contact.status] || 'bg-gray-100 text-gray-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0
            ${contact.status === 'Active' ? 'bg-emerald-500' : 'bg-red-400'}`} />
          {contact.status}
        </span>
      </td>

      {/* Assignee */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Avatar name={contact.assignee} size="xs" />
          <span className="text-xs text-gray-600 truncate max-w-[80px]">
            {contact.assignee?.split(' ')[0]}
          </span>
        </div>
      </td>

      {/* Last activity */}
      <td className="px-4 py-3">
        <span className="text-xs text-gray-500">{contact.lastActivity}</span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100
              transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <RowMenu
              onOpen={() => { onOpen(); setMenuOpen(false) }}
              onEdit={() => { onEdit(); setMenuOpen(false) }}
              onDelete={() => { onDelete(); setMenuOpen(false) }}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Row dropdown menu ─────────────────────────────────────────────────────────
function RowMenu({ onOpen, onEdit, onDelete, onClose }) {
  React.useEffect(() => {
    const handler = () => onClose()
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [onClose])

  return (
    <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-card-lg border
      border-gray-100 py-1 min-w-[130px] animate-fade-in">
      <MenuItem icon={Eye}    label="View"   onClick={onOpen}   />
      <MenuItem icon={Pencil} label="Edit"   onClick={onEdit}   />
      <MenuItem icon={Trash2} label="Delete" onClick={onDelete} danger />
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors
        ${danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="divide-y divide-gray-50">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-4">
            <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
