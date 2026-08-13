// ─── ContactFormModal ─────────────────────────────────────────────────────────
//
// step059. Chrome and fields now come from `ui/Modal.jsx` and `ui/FormKit.jsx`.
// The mutations, the UUID assignee filter, the validation and the payload shape
// are UNCHANGED.
//
// Four sections. Eleven fields in one undifferentiated stack was the longest
// form in the app and read as a wall; "Website" and "Address" sitting directly
// under "Assignee" implied they were part of the same decision.
//
// The mutation error banner is kept and moved to the shared `FormError` — it
// was one of only two forms that had one at all.

import React, { useState, useEffect } from 'react'
import { useContactsStore }           from '../../stores/contactsStore.js'
import { useCreateContact, useUpdateContact, useContact } from '../../hooks/useContacts.js'
import { CONTACT_TYPES, CONTACT_STATUSES } from '../../lib/contactsData.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'
import { Modal, ModalBody }     from '../ui/Modal.jsx'
import { FormSection, FormRow, FormField, FormError } from '../ui/FormKit.jsx'

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

  const [form, setForm]     = useState(EMPTY)
  const [errors, setErrors] = useState({})

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
      updateMutation.mutate({ id: existingContact.id, data: payload }, { onSuccess: close })
    } else {
      createMutation.mutate(payload, { onSuccess: close })
    }
  }

  const isPending     = createMutation.isPending || updateMutation.isPending
  const mutationError = createMutation.error?.message || updateMutation.error?.message

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setErrors((err) => { const next = { ...err }; delete next[field]; return next })
  }

  return (
    <Modal
      open={isOpen}
      onClose={close}
      title={isEdit ? 'Edit contact' : 'New contact'}
      size="md"
      footer={
        <>
          <button type="button" onClick={close} className="btn-secondary" disabled={isPending}>
            Cancel
          </button>
          <button type="submit" form="contact-form" className="btn-primary" disabled={isPending}>
            {isPending
              ? (isEdit ? 'Saving…' : 'Creating…')
              : (isEdit ? 'Save changes' : 'Create contact')}
          </button>
        </>
      }
    >
      <form id="contact-form" onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
        <ModalBody>
          <FormError>{mutationError}</FormError>

          <FormSection label="Person" first>
            <FormRow>
              <FormField label="Full name" error={errors.name} required>
                <input className="input-base" placeholder="Farhan Hossain"
                       value={form.name} onChange={setField('name')} />
              </FormField>
              <FormField label="Company" error={errors.company} required>
                <input className="input-base" placeholder="GreenTech BD"
                       value={form.company} onChange={setField('company')} />
              </FormField>
            </FormRow>

            <FormField label="Designation / role">
              <input className="input-base" placeholder="Chief Executive Officer"
                     value={form.designation} onChange={setField('designation')} />
            </FormField>

            <FormRow>
              <FormField label="Email" error={errors.email} required>
                <input type="email" className="input-base" placeholder="name@company.com"
                       value={form.email} onChange={setField('email')} />
              </FormField>
              <FormField label="Phone">
                <input type="tel" className="input-base" placeholder="+880 17XX-XXXXXX"
                       value={form.phone} onChange={setField('phone')} />
              </FormField>
            </FormRow>
          </FormSection>

          <FormSection label="Classification">
            <FormRow cols={3}>
              <FormField label="Type">
                <select className="input-base" value={form.type} onChange={setField('type')}>
                  {CONTACT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="Status">
                <select className="input-base" value={form.status} onChange={setField('status')}>
                  {CONTACT_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="Assignee" error={errors.assignee} required>
                <select className="input-base" value={form.assignee} onChange={setField('assignee')}>
                  <option value="">Select…</option>
                  {assigneeNames.map((a) => <option key={a}>{a}</option>)}
                </select>
              </FormField>
            </FormRow>
          </FormSection>

          <FormSection label="Company details">
            <FormRow>
              <FormField label="Website">
                <input className="input-base" placeholder="company.com"
                       value={form.website} onChange={setField('website')} />
              </FormField>
              <FormField label="Address">
                <input className="input-base" placeholder="Dhaka, Bangladesh"
                       value={form.address} onChange={setField('address')} />
              </FormField>
            </FormRow>
          </FormSection>

          <FormSection label="Details">
            <FormField label="Tags" hint="Comma-separated">
              <input className="input-base" placeholder="Enterprise, VIP, Q2"
                     value={form.tags} onChange={setField('tags')} />
            </FormField>

            <FormField label="Notes">
              <textarea
                className="input-base resize-none"
                rows={3}
                placeholder="Any relevant context about this contact…"
                value={form.notes}
                onChange={setField('notes')}
              />
            </FormField>
          </FormSection>
        </ModalBody>
      </form>
    </Modal>
  )
}

export default ContactFormModal
