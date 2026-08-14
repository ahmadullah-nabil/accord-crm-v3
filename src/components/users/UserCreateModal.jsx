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
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ step062 — ONTO Modal / Stepper / FormKit, LIKE THE OTHER FOUR            │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ This was the last create dialog still carrying a private `ModalShell`    │
// │ and a private `Field`. Three steps — Person → Role → Access — on the     │
// │ same `Stepper` as Lead, Contact, Deal and Task.                          │
// │                                                                          │
// │ THE ROLE STEP IS WHY THE SPLIT IS WORTH IT HERE, and it is not just      │
// │ consistency. Five stacked radio cards with a description each were the   │
// │ tallest thing in the dialog and sat between the email field and the two  │
// │ fields below them, so on a laptop you scrolled past the role choice to   │
// │ reach Department and scrolled back to check what you had picked. On its  │
// │ own step the five options fit without scrolling and the choice is the    │
// │ only thing on screen.                                                    │
// │                                                                          │
// │ The success screen keeps its own shape. It is not a form step — the      │
// │ invitation already exists by then, there is nothing to go Back to, and   │
// │ the stepper is hidden so it cannot suggest otherwise. Its ONE action is  │
// │ Done.                                                                    │
// │                                                                          │
// │ THE SUBMIT-MID-CLICK TRAP FROM step061 APPLIES HERE TOO: the primary     │
// │ button never changes element type between steps, only its label, and     │
// │ every submit routes through `onFormSubmit`. Do not rewrite this as a     │
// │ ternary that swaps <button type="button"> for <button type="submit">.    │
// └─────────────────────────────────────────────────────────────────────────┘

import React, { useState } from 'react'
import { Copy, Check, Mail, ShieldCheck, AlertTriangle, Link2 } from 'lucide-react'
import { useInviteUser }     from '../../hooks/useInvitations.js'
import { buildInviteLink }   from '../../services/invitationService.js'
import { useWorkspaceUsers } from '../../hooks/useUserManagement.js'
import { ROLES }             from '../../lib/users.js'
import { Modal, ModalBody }  from '../ui/Modal.jsx'
import { Stepper, StepHeading } from '../ui/Stepper.jsx'
import { FormSection, FormField, FormError, ReviewRow } from '../ui/FormKit.jsx'

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: ROLES.ADMIN,     label: 'Admin',     desc: 'Full access to all records and settings'         },
  { value: ROLES.AGM,       label: 'AGM',       desc: 'Department-wide visibility and reporting access' },
  { value: ROLES.MANAGER,   label: 'Manager',   desc: 'Team visibility and task management'             },
  { value: ROLES.EXECUTIVE, label: 'Executive', desc: 'Own records and assigned work'                   },
  { value: ROLES.EMPLOYEE,  label: 'Employee',  desc: 'Basic CRM access'                                },
]

const DEPT_SUGGESTIONS = [
  'Sales', 'Business Development', 'Account Management',
  'Marketing', 'Operations', 'Finance', 'HR', 'Technology',
]

const STEPS = [
  { id: 'person', label: 'Person' },
  { id: 'role',   label: 'Role'   },
  { id: 'access', label: 'Access' },
]

const STEP_FIELDS = [
  ['email'],
  ['role'],
  [],
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
  const [step,    setStep]    = useState(0)

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

  const errorsForStep = (i) => {
    const all = validate(form)
    return Object.fromEntries(
      Object.entries(all).filter(([k]) => STEP_FIELDS[i].includes(k))
    )
  }

  const next = () => {
    const errs = errorsForStep(step)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const back = () => setStep((s) => Math.max(s - 1, 0))

  const handleSubmit = async () => {
    const errs = validate(form)
    if (Object.keys(errs).length) {
      setErrors(errs)
      const bad = STEP_FIELDS.findIndex((fields) => fields.some((f) => errs[f]))
      if (bad >= 0) setStep(bad)
      return
    }

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

  const isLast = step === STEPS.length - 1

  // See the header: the element type never changes, only the label.
  const onFormSubmit = (e) => {
    e.preventDefault()
    if (!isLast) { next(); return }
    handleSubmit()
  }

  const eligibleManagers = allUsers.filter((u) => u.isActive)
  const managerName      = eligibleManagers.find((u) => u.id === form.managerId)?.name

  // ── Success screen ────────────────────────────────────────────────────────
  // The admin sends the link themselves. No email is dispatched from here —
  // system email is step 18 and belongs on a transactional provider, not on
  // whichever mailbox this admin happens to have connected.
  if (invited) {
    const link = buildInviteLink(invited.email)

    return (
      <Modal
        open
        onClose={onClose}
        title="Invitation created"
        size="md"
        footer={<button onClick={onClose} className="btn-primary ml-auto">Done</button>}
      >
        <ModalBody className="space-y-4">
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="w-11 h-11 rounded-lg border border-gray-200 flex items-center justify-center">
              <Mail size={18} className="text-gray-500" />
            </div>
            <div className="text-center">
              <p className="font-display font-semibold text-gray-900 text-sm">{invited.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 border border-gray-200 text-gray-600 text-[11px] rounded-md">
                {invited.role}
              </span>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-3 space-y-2.5">
            <div className="flex items-start gap-2">
              <ShieldCheck size={14} className="text-gray-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-900">Send them this link</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                  They sign up with this email address and choose their own password.
                  Signing up with a different address will not join them to the team.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-md border border-gray-200 px-2.5 py-1.5">
              <Link2 size={12} className="text-gray-400 shrink-0" />
              <code className="flex-1 text-[11px] font-mono text-gray-800 truncate select-all">{link}</code>
              <button
                onClick={() => handleCopy(link, 'link')}
                className="text-gray-400 hover:text-gray-900 p-0.5 transition-colors duration-120"
                title="Copy link"
              >
                {copied === 'link' ? <Check size={13} className="text-gray-900" /> : <Copy size={13} />}
              </button>
            </div>

            <button
              onClick={() => handleCopy(
                `You have been invited to Accord CRM.\n\n` +
                `Sign up here using ${invited.email}:\n${link}\n\n` +
                `You will choose your own password.`,
                'message',
              )}
              className="btn-secondary w-full text-xs"
            >
              {copied === 'message'
                ? <><Check size={12} /> Message copied</>
                : <><Copy size={12} /> Copy a ready-made message</>}
            </button>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-gray-500">
            <AlertTriangle size={12} className="shrink-0 mt-0.5 text-gray-400" />
            <span>
              The invitation expires in 14 days, and they will not appear in the member
              list until they have signed up.
            </span>
          </div>
        </ModalBody>
      </Modal>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <Modal
      open
      onClose={onClose}
      title="Invite someone"
      size="md"
      toolbar={<Stepper steps={STEPS} current={step} onStepClick={setStep} />}
      footer={
        <>
          {step > 0 && (
            <button type="button" onClick={back} className="btn-secondary mr-auto"
                    disabled={inviteMutation.isPending}>
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`btn-secondary ${step === 0 ? 'mr-auto' : ''}`}
            disabled={inviteMutation.isPending}
          >
            Cancel
          </button>
          <button type="submit" form="invite-form" className="btn-primary"
                  disabled={inviteMutation.isPending}>
            {!isLast
              ? 'Continue'
              : inviteMutation.isPending ? 'Inviting…' : 'Create invitation'}
          </button>
        </>
      }
    >
      <form id="invite-form" onSubmit={onFormSubmit} className="flex-1 min-h-0 flex flex-col">
        <ModalBody>
          <FormError>{errors.submit}</FormError>

          {step === 0 && (
            <FormSection first>
              <StepHeading
                title="Person"
                description="The address they will sign up with."
              />

              {/* Email — this IS the invitation. The trigger matches on the
                  address they sign up with, so a typo here means they join
                  nothing. */}
              <FormField
                label="Work email"
                error={errors.email}
                required
                hint="They must sign up with this exact address. Their name is whatever they enter at signup."
              >
                <input
                  type="email"
                  className="input-base"
                  placeholder="farhan@company.com"
                  value={form.email}
                  onChange={field('email')}
                  autoComplete="off"
                  autoFocus
                />
              </FormField>
            </FormSection>
          )}

          {step === 1 && (
            <FormSection first>
              <StepHeading
                title="Role"
                description="What they can see and do. Enforced by RLS, not by this list."
              />

              <div className="space-y-1.5">
                {ROLE_OPTIONS.map(({ value, label, desc }) => (
                  <label
                    key={value}
                    className={`flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer
                                transition-colors duration-120
                      ${form.role === value
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={value}
                      checked={form.role === value}
                      onChange={field('role')}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900 leading-tight">{label}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {errors.role && <p className="text-[11px] text-red-500 mt-1.5">{errors.role}</p>}
            </FormSection>
          )}

          {step === 2 && (
            <FormSection first>
              <StepHeading
                title="Access"
                description="Optional. Both can be changed later from Edit user."
              />

              <FormField label="Reports to (manager)">
                <select className="input-base" value={form.managerId} onChange={field('managerId')}>
                  <option value="">— No manager —</option>
                  {eligibleManagers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Department">
                <input
                  className="input-base"
                  list="dept-suggestions-create"
                  placeholder="e.g. Sales"
                  value={form.department}
                  onChange={field('department')}
                />
              </FormField>
              <datalist id="dept-suggestions-create">
                {DEPT_SUGGESTIONS.map((d) => <option key={d} value={d} />)}
              </datalist>

              <div className="rounded-md border border-gray-200 px-3 py-1">
                <ReviewRow label="Work email" value={form.email} />
                <ReviewRow label="Role"       value={form.role} />
                <ReviewRow label="Reports to" value={managerName} />
                <ReviewRow label="Department" value={form.department} />
              </div>
            </FormSection>
          )}
        </ModalBody>
      </form>
    </Modal>
  )
}

export default UserCreateModal
