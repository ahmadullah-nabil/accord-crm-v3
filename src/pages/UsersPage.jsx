import React, { useState } from 'react'
import { UserCog, RefreshCw, UserPlus } from 'lucide-react'
import { useWorkspaceUsers, useSetUserActive } from '../hooks/useUserManagement.js'
import { UsersTable }      from '../components/users/UsersTable.jsx'
import { UserEditModal }   from '../components/users/UserEditModal.jsx'
import { UserCreateModal } from '../components/users/UserCreateModal.jsx'
import { ROLES }           from '../lib/users.js'

// ── Summary cards ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'teal' }) {
  const colors = {
    teal:   'bg-teal-50 text-teal-700 ring-teal-200',
    blue:   'bg-blue-50 text-blue-700 ring-blue-200',
    amber:  'bg-amber-50 text-amber-700 ring-amber-200',
    gray:   'bg-gray-100 text-gray-600 ring-gray-200',
  }
  return (
    <div className="card px-5 py-4">
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      <p className={`font-display font-bold text-2xl leading-none ${color === 'teal' ? 'text-teal-700' : 'text-gray-800'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export function UsersPage() {
  const { data: users = [], isLoading, isError, refetch } = useWorkspaceUsers()
  const setActiveMutation = useSetUserActive()

  const [editingUser,  setEditingUser]  = useState(null)
  const [showCreate,   setShowCreate]   = useState(false)
  const [filter,      setFilter]      = useState('all')   // 'all' | 'active' | 'inactive'
  const [roleFilter,  setRoleFilter]  = useState('All')

  // Stats
  const total     = users.length
  const active    = users.filter((u) => u.isActive).length
  const inactive  = users.filter((u) => !u.isActive).length
  const admins    = users.filter((u) => u.role === ROLES.ADMIN).length

  // Filter
  const visible = users.filter((u) => {
    const statusOk = filter === 'all'
      ? true
      : filter === 'active' ? u.isActive : !u.isActive
    const roleOk = roleFilter === 'All' || u.role === roleFilter
    return statusOk && roleOk
  })

  const handleToggleActive = (user) => {
    const action = user.isActive ? 'deactivate' : 'activate'
    if (!confirm(`${user.isActive ? 'Deactivate' : 'Activate'} ${user.name || 'this user'}?`)) return
    setActiveMutation.mutate({ id: user.id, isActive: !user.isActive })
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center ring-1 ring-red-200">
          <UserCog size={20} className="text-red-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Failed to load users</p>
          <p className="text-xs text-gray-500">Check that the profiles table exists and RLS is configured.</p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary text-sm gap-1.5">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-5 max-w-[1400px]">
        {/* Page heading */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center ring-1 ring-teal-200">
            <UserCog size={18} className="text-teal-600" />
          </div>
          <div>
            <h1 className="font-display font-bold text-gray-900 text-xl leading-tight">
              User Management
            </h1>
            <p className="text-xs text-gray-500">Workspace members, roles, and hierarchy</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Members"  value={total}   sub="all profiles" />
          <StatCard label="Active"         value={active}  sub="can sign in"  color="blue" />
          <StatCard label="Inactive"       value={inactive} sub="access suspended" color="amber" />
          <StatCard label="Admins"         value={admins}  sub="full access"  />
        </div>

        {/* Toolbar */}
        <div className="card px-4 py-3 flex items-center gap-3 flex-wrap">
          {/* Status filter tabs */}
          <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
            {[
              { key: 'all',      label: `All (${total})` },
              { key: 'active',   label: `Active (${active})` },
              { key: 'inactive', label: `Inactive (${inactive})` },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
                  ${filter === key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={`text-xs font-medium rounded-lg px-2.5 py-1.5 border outline-none cursor-pointer
              ${roleFilter !== 'All'
                ? 'bg-teal-50 border-teal-300 text-teal-700'
                : 'bg-white border-gray-200 text-gray-600'
              }`}
          >
            <option value="All">All roles</option>
            {Object.values(ROLES).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <span className="text-xs text-gray-400 ml-auto">
            {visible.length} of {total} members
          </span>

          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <UserPlus size={14} /> Add User
          </button>
        </div>

        {/* Users table */}
        <UsersTable
          users={visible}
          isLoading={isLoading}
          onEdit={(user) => setEditingUser(user)}
          onToggleActive={handleToggleActive}
        />
      </div>

      {/* Edit modal */}
      {editingUser && (
        <UserEditModal
          user={editingUser}
          allUsers={users}
          onClose={() => setEditingUser(null)}
        />
      )}

      {/* Create user modal */}
      {showCreate && (
        <UserCreateModal onClose={() => setShowCreate(false)} />
      )}
    </>
  )
}

export default UsersPage
