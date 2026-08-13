// ─── UserCreateModal ──────────────────────────────────────────────────────────
//
// Admin-only modal to INVITE someone into this organisation.
//
// It used to create the account outright: supabase.auth.signUp() from the
// admin's browser, plus a generated temporary password shown once. That broke
// when tenancy landed — signUp creates auth.users and a profile, and NOTHING
// creates a membership. The result was a user with no org: every policy denies,
// they log in to an empty CRM, and the admin who created them cannot see them
// either, because they share no org.
//
// Now:
//   1. Admin fills: email, role, manager, department  (no name, no password)
//   2. On submit → an org_invitations row, scoped to the admin's org by RLS
//   3. Admin copies the signup link and sends it however they like
//   4. The person signs up, picks their OWN password, and the
//      on_auth_user_created_membership trigger (024) turns the invitation into
//      a membership BEFORE their first token is minted — which matters,
//      because custom_access_token_hook reads memberships to write the org_id
//      claim. A membership created a moment later means their first session
//      has no org and the app looks broken.
//
// Two things deliberately went away:
//
//   • The temp password. The person sets their own. An admin-chosen password
//     had to be relayed over WhatsApp anyway and was rarely changed.
//   • The name field. They type their own at signup, and it lands in
//     raw_user_meta_data where handle_new_user reads it. An admin guessing the
//     spelling of a colleague's name is a worse source than the colleague.
//
// The invited person does NOT appear in the user list until they accept.
// Showing them early would mean a row that cannot be assigned work.

import React, { useState, useCallback } from 'react'
import {
  X, UserPlus, Copy, Check, Mail,
  ShieldCheck, AlertTriangle, Link2,
} from 'lucide-react'
import { useInviteUser }     from '../../hooks/useInvitations.js'
import { buildInviteLink }   from '../../services/invitationService.js'
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

// ── Form validation ───────────────────────────────────────────────────────────

function validate({ email, role }) {
  const errors = {}
  if (!email.trim())             errors.email = 'Email address is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
                                 errors.email = 'Enter a valid email address.'
  if (!role)                     errors.role  = 'Role is required.'
  return errors
}

// ── Main component ────────────────────────────────────────────────────────────

export function UserCreateModal({ onClose }) {
  const { data: allUsers = [] } = useWorkspaceUsers()
  const inviteMutation          = useInviteUser()

  const [form, setForm] = useState({
    email:      '',
    role:       ROLES.EMPLOYEE,
    managerId:  '',
    department: '',
  })
  const [errors,  setErrors]  = useState({})
  const [copied,  setCopied]  = useState('')
  const [invited, setInvited] = useState(null)   // success state

  const field = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((err) => { const n = { ...err }; delete n[key]; return n })
  }

  // `which` distinguishes the two copy buttons so the tick appears on the one
  // that was actually pressed. A shared boolean ticks both.
  const handleCopy = (text, which) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(which)
      setTimeout(() => setCopied(''), 2000)
    })
  }

  const handleSubmit = async () => {
    const errs = validate(form)
    if (Object.keys(errs).length) { setErrors(errs); return }

    try {
      const result = await inviteMutation.mutateAsync({
        email:      form.email.trim().toLowerCase(),
        role:       form.role,
        managerId:  form.managerId || null,
        department: form.department.trim(),
      })
      setInvited(result)
    } catch (err) {
      setErrors({ submit: err.message ?? 'Failed to send the invitation. Please try again.' })
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  // The admin sends the link themselves. No email is dispatched from here —
  // system email is step 18 and belongs on a transactional provider, not on
  // whichever mailbox this admin happens to have connected.
  if (invited) {
    const link = buildInviteLink(invited.email)

    return (
      <ModalShell onClose={onClose} title="Invitation created">
        <div className="p-6 space-y-5">
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center ring-1 ring-teal-200">
              <Mail size={22} className="text-teal-600" />
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-gray-900 text-lg">{invited.email}</p>
              <span className="inline-block mt-1 px-3 py-0.5 bg-teal-50 text-teal-700 text-xs font-semibold rounded-full">
                {invited.role}
              </span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <ShieldCheck size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Send them this link</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  They sign up with this email address and choose their own password.
                  Signing up with a different address will not join them to the team.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white rounded-lg border border-amber-200 px-3 py-2">
              <Link2 size={13} className="text-gray-400 flex-shrink-0" />
              <code className="flex-1 text-xs font-mono text-gray-800 truncate select-all">{link}</code>
              <button
                onClick={() => handleCopy(link, 'link')}
                className="text-gray-400 hover:text-teal-600 p-1 transition-colors"
                title="Copy link"
              >
                {copied === 'link' ? <Check size={14} className="text-teal-500" /> : <Copy size={14} />}
              </button>
            </div>

            <button
              onClick={() => handleCopy(
                `You have been invited to Accord CRM.\n\n` +
                `Sign up here using ${invited.email}:\n${link}\n\n` +
                `You will choose your own password.`,
                'message',
              )}
              className="w-full text-xs px-3 py-2 rounded-lg border border-amber-200 bg-white
                         hover:bg-amber-50 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              {copied === 'message'
                ? <><Check size={12} className="text-teal-500" /> Message copied</>
                : <><Copy size={12} /> Copy a ready-made message</>}
            </button>
          </div>

          <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-gray-400" />
            <span>
              The invitation expires in 14 days, and they will not appear in the user
              list until they have signed up.
            </span>
          </div>

          <button onClick={onClose} className="btn-primary w-full">Done</button>
        </div>
      </ModalShell>
    )
  }

  // ── Form screen ───────────────────────────────────────────────────────────
  const eligibleManagers = allUsers.filter((u) => u.isActive)

  return (
    <ModalShell onClose={onClose} title="Invite someone">
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Submit error */}
        {errors.submit && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{errors.submit}</p>
          </div>
        )}

        {/* Email — this IS the invitation. The trigger matches on the address
            they sign up with, so a typo here means they join nothing. */}
        <Field label="Work email" error={errors.email} required>
          <input
            type="email"
            className={`input-base ${errors.email ? 'border-red-300 ring-1 ring-red-200' : ''}`}
            placeholder="farhan@company.com"
            value={form.email}
            onChange={field('email')}
            autoComplete="off"
            autoFocus
          />
          <p className="text-[11px] text-gray-400 mt-1">
            They must sign up with this exact address. Their name is whatever they
            enter at signup.
          </p>
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

      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
        <button onClick={onClose} className="btn-secondary" disabled={inviteMutation.isPending}>
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={inviteMutation.isPending}
          className="btn-primary disabled:opacity-60 min-w-[120px]"
        >
          {inviteMutation.isPending
            ? <><Spinner size="sm" color="white" /> Inviting…</>
            : <><UserPlus size={14} /> Create invitation</>
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
