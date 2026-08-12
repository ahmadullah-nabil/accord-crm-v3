import React, { useState, useEffect } from 'react'
import { X, User, Building2, Users, ShieldCheck } from 'lucide-react'
import { Avatar }   from '../ui/Avatar.jsx'
import { Badge }    from '../ui/Badge.jsx'
import {
  useUpdateUserRole,
  useUpdateUserManager,
  useUpdateUserDepartment,
} from '../../hooks/useUserManagement.js'
import { ROLES } from '../../lib/users.js'
import { useAuthStore } from '../../stores/authStore.js'

const ROLE_OPTIONS = [ROLES.ADMIN, ROLES.AGM, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.EXECUTIVE]
const DEPT_SUGGESTIONS = [
  'Sales', 'Business Development', 'Account Management',
  'Marketing', 'Operations', 'Finance', 'HR', 'Technology',
]

export function UserEditModal({ user, allUsers, onClose }) {
  const currentAdmin = useAuthStore((s) => s.user)

  const [role,       setRole]       = useState(user.role)
  const [managerId,  setManagerId]  = useState(user.managerId ?? '')
  const [department, setDepartment] = useState(user.department)
  const [dirty,      setDirty]      = useState(false)

  const roleMutation   = useUpdateUserRole()
  const managerMutation = useUpdateUserManager()
  const deptMutation   = useUpdateUserDepartment()

  const isPending = roleMutation.isPending || managerMutation.isPending || deptMutation.isPending

  // Eligible managers: all active users except the user being edited
  const eligibleManagers = allUsers.filter(
    (u) => u.isActive && u.id !== user.id
  )

  const handleSave = async () => {
    const promises = []

    if (role !== user.role) {
      promises.push(roleMutation.mutateAsync({ id: user.id, role }))
    }
    if ((managerId || null) !== user.managerId) {
      promises.push(managerMutation.mutateAsync({ id: user.id, managerId: managerId || null }))
    }
    if (department !== user.department) {
      promises.push(deptMutation.mutateAsync({ id: user.id, department }))
    }

    await Promise.all(promises)
    onClose()
  }

  const isSelf = user.id === currentAdmin?.id
  const managerDisplay = allUsers.find((u) => u.id === user.managerId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <Avatar name={user.name} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-gray-900">{user.name || 'Unnamed'}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isSelf && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3">
              <ShieldCheck size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                You are editing your own account. Some changes may affect your access.
              </p>
            </div>
          )}

          {/* Role */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Role
            </label>
            <select
              className="input-base"
              value={role}
              onChange={(e) => { setRole(e.target.value); setDirty(true) }}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">
              Changing role immediately affects visibility and RBAC permissions.
            </p>
          </div>

          {/* Manager */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Reports to (Manager)
            </label>
            <select
              className="input-base"
              value={managerId}
              onChange={(e) => { setManagerId(e.target.value); setDirty(true) }}
            >
              <option value="">— No manager —</option>
              {eligibleManagers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Department
            </label>
            <input
              className="input-base"
              list="dept-suggestions"
              value={department}
              onChange={(e) => { setDepartment(e.target.value); setDirty(true) }}
              placeholder="e.g. Sales"
            />
            <datalist id="dept-suggestions">
              {DEPT_SUGGESTIONS.map((d) => <option key={d} value={d} />)}
            </datalist>
          </div>

          {/* Read-only info */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Account info
            </p>
            <InfoRow label="User ID"  value={user.id.slice(0, 8) + '…'} />
            <InfoRow label="Status"   value={user.isActive ? 'Active' : 'Inactive'} />
            <InfoRow label="Joined"   value={user.createdAt || '—'} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="btn-primary disabled:opacity-60"
          >
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-700">{value}</span>
    </div>
  )
}
