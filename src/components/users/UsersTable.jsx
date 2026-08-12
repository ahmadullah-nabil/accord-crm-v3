import React from 'react'
import {
  CheckCircle2, XCircle, MoreHorizontal,
  Pencil, UserCheck, UserX, ChevronUp, ChevronDown,
} from 'lucide-react'
import { Avatar }   from '../ui/Avatar.jsx'
import { Badge }    from '../ui/Badge.jsx'
import { Skeleton } from '../ui/Skeleton.jsx'
import { ROLES }    from '../../lib/users.js'

const ROLE_ORDER = [ROLES.ADMIN, ROLES.AGM, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.EXECUTIVE]

export function UsersTable({ users, isLoading, onEdit, onToggleActive }) {
  const [sort, setSort] = React.useState({ field: 'name', dir: 'asc' })

  const toggle = (field) =>
    setSort((s) => ({ field, dir: s.field === field && s.dir === 'asc' ? 'desc' : 'asc' }))

  const sorted = [...users].sort((a, b) => {
    const dir = sort.dir === 'asc' ? 1 : -1
    if (sort.field === 'role') {
      return (ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)) * dir
    }
    const av = (a[sort.field] ?? '').toLowerCase()
    const bv = (b[sort.field] ?? '').toLowerCase()
    return av < bv ? -dir : av > bv ? dir : 0
  })

  if (isLoading) {
    return (
      <div className="card overflow-hidden">
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="card py-16 text-center">
        <p className="text-sm font-semibold text-gray-800 mb-1">No users found</p>
        <p className="text-xs text-gray-400">Users appear here once they have a profile.</p>
      </div>
    )
  }

  const SortIcon = ({ field }) => {
    if (sort.field !== field) return null
    return sort.dir === 'asc'
      ? <ChevronUp size={12} className="text-teal-500 inline ml-0.5" />
      : <ChevronDown size={12} className="text-teal-500 inline ml-0.5" />
  }

  const Th = ({ field, label }) => (
    <th
      onClick={() => toggle(field)}
      className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap cursor-pointer hover:text-gray-800 select-none"
    >
      {label}<SortIcon field={field} />
    </th>
  )

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <Th field="name"       label="Name" />
            <Th field="role"       label="Role" />
            <Th field="department" label="Department" />
            <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Manager</th>
            <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
            <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 w-12"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              allUsers={users}
              onEdit={() => onEdit(user)}
              onToggleActive={() => onToggleActive(user)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function UserRow({ user, allUsers, onEdit, onToggleActive }) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const manager = allUsers.find((u) => u.id === user.managerId)

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors group">
      {/* Name + email */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} size="sm" />
          <div className="min-w-0">
            <p className={`text-sm font-semibold truncate ${user.isActive ? 'text-gray-900' : 'text-gray-400'}`}>
              {user.name || '—'}
            </p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
        </div>
      </td>

      {/* Role badge */}
      <td className="px-4 py-3">
        <Badge variant={user.role}>{user.role}</Badge>
      </td>

      {/* Department */}
      <td className="px-4 py-3 text-xs text-gray-600">{user.department || <span className="text-gray-300">—</span>}</td>

      {/* Manager */}
      <td className="px-4 py-3">
        {manager ? (
          <div className="flex items-center gap-1.5">
            <Avatar name={manager.name} size="xs" />
            <span className="text-xs text-gray-600">{manager.name.split(' ')[0]}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>

      {/* Status pill */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full
          ${user.isActive
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-gray-100 text-gray-500'
          }`}>
          {user.isActive
            ? <><CheckCircle2 size={11} /> Active</>
            : <><XCircle size={11} /> Inactive</>
          }
        </span>
      </td>

      {/* Row action menu */}
      <td className="px-4 py-3 relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all"
        >
          <MoreHorizontal size={15} className="text-gray-400" />
        </button>

        {menuOpen && (
          <RowMenu
            onEdit={() => { onEdit(); setMenuOpen(false) }}
            onToggle={() => { onToggleActive(); setMenuOpen(false) }}
            isActive={user.isActive}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </td>
    </tr>
  )
}

function RowMenu({ onEdit, onToggle, isActive, onClose }) {
  const menuRef = React.useRef(null)

  React.useEffect(() => {
    const h = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        onClose()
      }
    }

    document.addEventListener('mousedown', h)

    return () =>
      document.removeEventListener('mousedown', h)
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-card-lg border border-gray-100 py-1 min-w-[160px] animate-fade-in"
    >
      <button
        onClick={onEdit}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        <Pencil size={13} /> Edit user
      </button>

      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium
          ${isActive
            ? 'text-amber-600 hover:bg-amber-50'
            : 'text-emerald-600 hover:bg-emerald-50'}`}
      >
        {isActive
          ? <><UserX size={13} /> Deactivate</>
          : <><UserCheck size={13} /> Activate</>}
      </button>
    </div>
  )
}