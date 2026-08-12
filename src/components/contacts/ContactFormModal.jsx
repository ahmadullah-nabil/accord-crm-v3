import React, { useState, useEffect } from 'react'
import { X, User, Building2, Mail, Phone, Briefcase, Globe, MapPin, Tag, AlertCircle } from 'lucide-react'
import { useContactsStore }           from '../../stores/contactsStore.js'
import { useCreateContact, useUpdateContact, useContact } from '../../hooks/useContacts.js'
import {
  CONTACT_TYPES, CONTACT_STATUSES,
} from '../../lib/contactsData.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'

const EMPTY = {
  name: '', company: '', designation: '', email: '', phone: '',
  type: 'Prospect', status: 'Active', assignee: '',
  website: '', address: '', tags: '', notes: '',
}

export function ContactFormModal() {
  const {
    addModalOpen, editModalOpen,
    closeAddModal, closeEditModal,
    selectedContactId,
  } = useContactsStore()

  // Use full member objects so we can filter to real Supabase profiles.
  // Real profiles have a proper UUID id (36 chars with hyphens).
  // This prevents any legacy static fallback data from appearing in the dropdown.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const { members: allMembers } = useAssignableMembers()
  const assigneeNames = allMembers
    .filter((m) => UUID_RE.test(m.id ?? ''))
    .map((m) => m.name)
    .filter(Boolean)

  const isOpen = addModalOpen || editModalOpen
  const isEdit = editModalOpen

  const { data: existingContact } = useContact(isEdit ? selectedContactId : null)

  const createMutation = useCreateContact()
  const updateMutation = useUpdateContact()

  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})

  // Populate form when editing
  useEffect(() => {
    if (isOpen) {
      if (isEdit && existingContact) {
        setForm({
          ...existingContact,
          tags: (existingContact.tags || []).join(', '),
        })
      } else {
        setForm(EMPTY)
      }
      setErrors({})
      // Reset any previous mutation errors when the modal opens
      createMutation.reset()
      updateMutation.reset()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEdit, existingContact?.id])

  const close = () => {
    isEdit ? closeEditModal() : closeAddModal()
    createMutation.reset()
    updateMutation.reset()
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim())    e.name    = 'Name is required'
    if (!form.company.trim()) e.company = 'Company is required'
    if (!form.email.trim())   e.email   = 'Email is required'
    if (!form.assignee)       e.assignee = 'Assignee is required'
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const payload = {
      ...form,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    }

    if (isEdit) {
      updateMutation.mutate(
        { id: existingContact.id, data: payload },
        { onSuccess: close }
      )
    } else {
      createMutation.mutate(payload, { onSuccess: close })
    }
  }

  const isPending   = createMutation.isPending || updateMutation.isPending
  // Surface the Supabase error message if either mutation failed
  const mutationError = createMutation.error?.message || updateMutation.error?.message

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setErrors((err) => { const next = { ...err }; delete next[field]; return next })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-card-lg w-full max-w-[580px]
        max-h-[90vh] flex flex-col animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-display font-bold text-gray-900 text-lg">
            {isEdit ? 'Edit Contact' : 'Add New Contact'}
          </h2>
          <button
            onClick={close}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            {/* Mutation error banner */}
            {mutationError && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm animate-fade-in">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{mutationError}</span>
              </div>
            )}

            {/* Name + Company */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name" error={errors.name} icon={User}>
                <input
                  className="input-base"
                  placeholder="Farhan Hossain"
                  value={form.name}
                  onChange={setField('name')}
                />
              </Field>
              <Field label="Company" error={errors.company} icon={Building2}>
                <input
                  className="input-base"
                  placeholder="GreenTech BD"
                  value={form.company}
                  onChange={setField('company')}
                />
              </Field>
            </div>

            {/* Designation */}
            <Field label="Designation / Role" icon={Briefcase}>
              <input
                className="input-base"
                placeholder="Chief Executive Officer"
                value={form.designation}
                onChange={setField('designation')}
              />
            </Field>

            {/* Email + Phone */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email" error={errors.email} icon={Mail}>
                <input
                  type="email"
                  className="input-base"
                  placeholder="name@company.com"
                  value={form.email}
                  onChange={setField('email')}
                />
              </Field>
              <Field label="Phone" icon={Phone}>
                <input
                  type="tel"
                  className="input-base"
                  placeholder="+880 17XX-XXXXXX"
                  value={form.phone}
                  onChange={setField('phone')}
                />
              </Field>
            </div>

            {/* Type + Status */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact Type">
                <select className="input-base" value={form.type} onChange={setField('type')}>
                  {CONTACT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className="input-base" value={form.status} onChange={setField('status')}>
                  {CONTACT_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>

            {/* Assignee */}
            <Field label="Assignee" error={errors.assignee}>
              <select className="input-base" value={form.assignee} onChange={setField('assignee')}>
                <option value="">Select assignee…</option>
                {assigneeNames.map((a) => <option key={a}>{a}</option>)}
              </select>
            </Field>

            {/* Website + Address */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Website" icon={Globe}>
                <input
                  className="input-base"
                  placeholder="company.com"
                  value={form.website}
                  onChange={setField('website')}
                />
              </Field>
              <Field label="Address" icon={MapPin}>
                <input
                  className="input-base"
                  placeholder="Dhaka, Bangladesh"
                  value={form.address}
                  onChange={setField('address')}
                />
              </Field>
            </div>

            {/* Tags */}
            <Field label="Tags (comma-separated)" icon={Tag}>
              <input
                className="input-base"
                placeholder="Enterprise, VIP, Q2"
                value={form.tags}
                onChange={setField('tags')}
              />
            </Field>

            {/* Notes */}
            <Field label="Notes">
              <textarea
                className="input-base resize-none"
                rows={3}
                placeholder="Any relevant context about this contact…"
                value={form.notes}
                onChange={setField('notes')}
              />
            </Field>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100
            bg-gray-50/50 rounded-b-2xl flex-shrink-0">
            <button type="button" onClick={close} className="btn-secondary" disabled={isPending}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending
                ? (isEdit ? 'Saving…' : 'Adding…')
                : (isEdit ? 'Save Changes' : 'Add Contact')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, error, icon: Icon, children }) {
  const child = React.Children.only(children)
  return (
    <div>
      <label className="label-base">{label}</label>
      <div className="relative">
        {Icon && (
          <Icon
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
          />
        )}
        {React.cloneElement(child, {
          className: [
            child.props.className || 'input-base',
            Icon ? 'pl-9' : '',
            error ? 'border-red-300 focus:border-red-400 focus:ring-red-400/20' : '',
          ].join(' ').trim(),
        })}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
