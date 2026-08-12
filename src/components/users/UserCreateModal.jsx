// ─── UserCreateModal ──────────────────────────────────────────────────────────
//
// Admin-only modal to onboard a new workspace user.
//
// Flow:
//   1. Admin fills: name, email, role, manager, department
//   2. A temporary password is auto-generated (shown once)
//   3. On submit → createWorkspaceUser() in userManagementService:
//        a. supabase.auth.signUp()       — creates auth.users row
//        b. Postgres trigger             — auto-creates public.profiles row
//        c. patchProfile()              — applies role / manager_id / department
//   4. Success screen shows the temp password for the admin to share
//   5. New user appears immediately in table, dropdowns, and hierarchy

import React, { useState, useCallback } from 'react'
import {
  X, UserPlus, Eye, EyeOff, Copy, Check,
  ShieldCheck, AlertTriangle, RefreshCw,
} from 'lucide-react'
import { useCreateUser }     from '../../hooks/useUserManagement.js'
import { useWorkspaceUsers } from '../../hooks/useUserManagement.js'
import { ROLES }             from '../../lib/users.js'
import { Avatar }            from '../ui/Avatar.jsx'
import { Spinner }           from '../ui/Spinner.jsx'

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: ROLES.ADMIN,     label: 'Admin',     desc: 'Full access to all records and settings'         },
  { value: ROLES.AGM,       label: 'AGM',       desc: 'Department-wide visibility and reporting access' },
  { value: ROLES.MANAGER,   label: 'Manager',   desc: 'Team visibility and task management'             },
  { value: ROLES.EXECUTIVE, label: 'Executive', desc: 'Own records and assigned work'                   },
  { value: ROLES.EMPLOYEE,  label: 'Employee',  desc: 'Basic CRM access'                               },
]

const DEPT_SUGGESTIONS = [
  'Sales', 'Business Development', 'Account Management',
  'Marketing', 'Operations', 'Finance', 'HR', 'Technology',
]

// ── Password generator ────────────────────────────────────────────────────────

function generateTempPassword() {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower   = 'abcdefghjkmnpqrstuvwxyz'
  const digits  = '23456789'
  const special = '!@#$%'
  const all     = upper + lower + digits + special
  const rand    = (set) => set[Math.floor(Math.random() * set.length)]
  // Guarantee at least one of each character class
  const required = [rand(upper), rand(lower), rand(digits), rand(special)]
  const rest = Array.from({ length: 8 }, () => rand(all))
  return [...required, ...rest]
    .sort(() => Math.random() - 0.5)
    .join('')
}

// ── Form validation ───────────────────────────────────────────────────────────

function validate({ name, email, role }) {
  const errors = {}
  if (!name.trim())              errors.name  = 'Full name is required.'
  if (!email.trim())             errors.email = 'Email address is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
                                 errors.email = 'Enter a valid email address.'
  if (!role)                     errors.role  = 'Role is required.'
  return errors
}

// ── Main component ────────────────────────────────────────────────────────────

export function UserCreateModal({ onClose }) {
  const { data: allUsers = [] } = useWorkspaceUsers()
  const createMutation          = useCreateUser()

  const [form, setForm] = useState({
    name:       '',
    email:      '',
    role:       ROLES.EMPLOYEE,
    managerId:  '',
    department: '',
  })
  const [errors,      setErrors]      = useState({})
  const [tempPwd,     setTempPwd]     = useState(() => generateTempPassword())
  const [showPwd,     setShowPwd]     = useState(false)
  const [copied,      setCopied]      = useState(false)
  const [createdUser, setCreatedUser] = useState(null)  // success state

  const field = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((err) => { const n = { ...err }; delete n[key]; return n })
  }

  const handleCopy = () => {
    navigator.clipboard?.writeText(tempPwd).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleRegenerate = () => setTempPwd(generateTempPassword())

  const handleSubmit = async () => {
    const errs = validate(form)
    if (Object.keys(errs).length) { setErrors(errs); return }

    try {
      const result = await createMutation.mutateAsync({
        name:        form.name.trim(),
        email:       form.email.trim().toLowerCase(),
        tempPassword: tempPwd,
        role:        form.role,
        managerId:   form.managerId || null,
        department:  form.department.trim(),
      })
      setCreatedUser(result)
    } catch (err) {
      setErrors({ submit: err.message ?? 'Failed to create user. Please try again.' })
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (createdUser) {
    return (
      <ModalShell onClose={onClose} title="User created">
        <div className="p-6 space-y-5">
          {/* Avatar + name */}
          <div className="flex flex-col items-center gap-3 py-4">
            <Avatar name={createdUser.name} size="xl" />
            <div className="text-center">
              <p className="font-display font-bold text-gray-900 text-lg">{createdUser.name}</p>
              <p className="text-sm text-gray-500">{createdUser.email}</p>
              <span className="inline-block mt-1 px-3 py-0.5 bg-teal-50 text-teal-700 text-xs font-semibold rounded-full">
                {createdUser.role}
              </span>
            </div>
          </div>

          {/* Temp password notice */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <ShieldCheck size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Share the temporary password</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  The user will need this to sign in for the first time.
                  Ask them to change it immediately via Settings.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white rounded-lg border border-amber-200 px-3 py-2">
              <code className="flex-1 text-sm font-mono text-gray-800 select-all">
                {showPwd ? tempPwd : '•'.repeat(tempPwd.length)}
              </code>
              <button
                onClick={() => setShowPwd((v) => !v)}
                className="text-gray-400 hover:text-gray-600 p-1"
                title={showPwd ? 'Hide' : 'Show'}
              >
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                onClick={handleCopy}
                className="text-gray-400 hover:text-teal-600 p-1 transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check size={14} className="text-teal-500" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Confirmation email notice */}
          <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-gray-400" />
            <span>
              If your Supabase project requires email confirmation, the user must click
              the verification link before signing in.
            </span>
          </div>

          <button onClick={onClose} className="btn-primary w-full">
            Done
          </button>
        </div>
      </ModalShell>
    )
  }

  // ── Form screen ───────────────────────────────────────────────────────────
  const eligibleManagers = allUsers.filter((u) => u.isActive)

  return (
    <ModalShell onClose={onClose} title="Add user">
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Submit error */}
        {errors.submit && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{errors.submit}</p>
          </div>
        )}

        {/* Full name */}
        <Field label="Full name" error={errors.name} required>
          <input
            className={`input-base ${errors.name ? 'border-red-300 ring-1 ring-red-200' : ''}`}
            placeholder="e.g. Farhan Hossain"
            value={form.name}
            onChange={field('name')}
            autoFocus
          />
        </Field>

        {/* Email */}
        <Field label="Work email" error={errors.email} required>
          <input
            type="email"
            className={`input-base ${errors.email ? 'border-red-300 ring-1 ring-red-200' : ''}`}
            placeholder="farhan@company.com"
            value={form.email}
            onChange={field('email')}
            autoComplete="off"
          />
        </Field>

        {/* Role */}
        <Field label="Role" error={errors.role} required>
          <div className="space-y-1.5">
            {ROLE_OPTIONS.map(({ value, label, desc }) => (
              <label
                key={value}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all
                  ${form.role === value
                    ? 'bg-teal-50 border-teal-300 ring-1 ring-teal-200'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={form.role === value}
                  onChange={field('role')}
                  className="mt-0.5 accent-teal-500 flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className={`text-sm font-semibold leading-tight
                    ${form.role === value ? 'text-teal-800' : 'text-gray-800'}`}>
                    {label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </Field>

        {/* Manager */}
        <Field label="Reports to (Manager)">
          <select
            className="input-base"
            value={form.managerId}
            onChange={field('managerId')}
          >
            <option value="">— No manager —</option>
            {eligibleManagers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </Field>

        {/* Department */}
        <Field label="Department">
          <input
            className="input-base"
            list="dept-suggestions-create"
            placeholder="e.g. Sales"
            value={form.department}
            onChange={field('department')}
          />
          <datalist id="dept-suggestions-create">
            {DEPT_SUGGESTIONS.map((d) => <option key={d} value={d} />)}
          </datalist>
        </Field>

        {/* Temporary password */}
        <Field label="Temporary password">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <code className="flex-1 text-sm font-mono text-gray-700 select-all">
              {showPwd ? tempPwd : '•'.repeat(tempPwd.length)}
            </code>
            <button
              onClick={() => setShowPwd((v) => !v)}
              className="text-gray-400 hover:text-gray-600 p-1"
              title={showPwd ? 'Hide' : 'Show'}
            >
              {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <button
              onClick={handleCopy}
              className="text-gray-400 hover:text-teal-600 p-1 transition-colors"
              title="Copy"
            >
              {copied ? <Check size={13} className="text-teal-500" /> : <Copy size={13} />}
            </button>
            <button
              onClick={handleRegenerate}
              className="text-gray-400 hover:text-blue-600 p-1 transition-colors"
              title="Regenerate"
            >
              <RefreshCw size={13} />
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Share this with the user. They should change it after first sign-in.
          </p>
        </Field>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
        <button onClick={onClose} className="btn-secondary" disabled={createMutation.isPending}>
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={createMutation.isPending}
          className="btn-primary disabled:opacity-60 min-w-[120px]"
        >
          {createMutation.isPending
            ? <><Spinner size="sm" color="white" /> Creating…</>
            : <><UserPlus size={14} /> Create user</>
          }
        </button>
      </div>
    </ModalShell>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ModalShell({ onClose, title, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center ring-1 ring-teal-200">
              <UserPlus size={14} className="text-teal-600" />
            </div>
            <h2 className="font-display font-bold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, error, required = false, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <AlertTriangle size={10} /> {error}
        </p>
      )}
    </div>
  )
}
