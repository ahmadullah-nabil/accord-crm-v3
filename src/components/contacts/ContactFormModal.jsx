// ─── ContactFormModal ─────────────────────────────────────────────────────────
//
// step060. Three steps — Person → Details → Summary — on the shared `Stepper`.
// The mutations, the UUID assignee filter, the validation rules and the payload
// shape are UNCHANGED.
//
// Per-step validation via `STEP_FIELDS`; a failed final submit jumps back to
// the step owning the offending field. Same machinery as the other three.

import React, { useState, useEffect } from 'react'
import { useContactsStore }           from '../../stores/contactsStore.js'
import { useCreateContact, useUpdateContact, useContact } from '../../hooks/useContacts.js'
import { CONTACT_TYPES, CONTACT_STATUSES } from '../../lib/contactsData.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'
import { Modal, ModalBody }     from '../ui/Modal.jsx'
import { Stepper, StepHeading } from '../ui/Stepper.jsx'
import { FormSection, FormRow, FormField, FormError, ReviewRow } from '../ui/FormKit.jsx'

const EMPTY = {
  name: '', company: '', designation: '', email: '', phone: '',
  type: 'Prospect', status: 'Active', assignee: '',
  website: '', address: '', tags: '', notes: '',
}

const STEPS = [
  { id: 'person',  label: 'Person'  },
  { id: 'details', label: 'Details' },
  { id: 'summary', label: 'Summary' },
]

const STEP_FIELDS = [
  ['name', 'company', 'email'],
  ['assignee'],
  [],
]

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
  const [step, setStep]     = useState(0)

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
      setStep(0)
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
    if (!form.name.trim())    e.name     = 'Name is required'
    if (!form.company.trim()) e.company  = 'Company is required'
    if (!form.email.trim())   e.email    = 'Email is required'
    if (!form.assignee)       e.assignee = 'Assignee is required'
    return e
  }

  const errorsForStep = (i) => {
    const all = validate()
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

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      const bad = STEP_FIELDS.findIndex((fields) => fields.some((f) => errs[f]))
      if (bad >= 0) setStep(bad)
      return
    }

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
  const isLast        = step === STEPS.length - 1

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setErrors((err) => { const next = { ...err }; delete next[field]; return next })
  }

  return (
    <Modal
      open={isOpen}
      onClose={close}
      title={isEdit ? 'Edit contact' : 'Create new contact'}
      size="md"
      toolbar={
        <Stepper steps={STEPS} current={step} onStepClick={setStep} allowForward={isEdit} />
      }
      footer={
        <>
          {step > 0 && (
            <button type="button" onClick={back} className="btn-secondary mr-auto" disabled={isPending}>
              Back
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className={`btn-secondary ${step === 0 ? 'mr-auto' : ''}`}
            disabled={isPending}
          >
            Cancel
          </button>
          {isLast
            ? (
              <button type="submit" form="contact-form" className="btn-primary" disabled={isPending}>
                {isPending
                  ? (isEdit ? 'Saving…' : 'Creating…')
                  : (isEdit ? 'Save changes' : 'Create contact')}
              </button>
            )
            : (
              <button type="button" onClick={next} className="btn-primary">Continue</button>
            )
          }
        </>
      }
    >
      <form id="contact-form" onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
        <ModalBody>
          <FormError>{mutationError}</FormError>

          {step === 0 && (
            <FormSection first>
              <StepHeading
                title="Person"
                description="Who they are and how to reach them."
              />

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
          )}

          {step === 1 && (
            <FormSection first>
              <StepHeading
                title="Details"
                description="How this contact is classified, and where they are."
              />

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

              <FormField label="Tags" hint="Comma-separated">
                <input className="input-base" placeholder="Enterprise, VIP, Q2"
                       value={form.tags} onChange={setField('tags')} />
              </FormField>
            </FormSection>
          )}

          {step === 2 && (
            <FormSection first>
              <StepHeading
                title="Summary"
                description="Check this over, then create the contact."
              />

              <div className="rounded-md border border-gray-200 px-3 py-1">
                <ReviewRow label="Full name"   value={form.name} />
                <ReviewRow label="Company"     value={form.company} />
                <ReviewRow label="Designation" value={form.designation} />
                <ReviewRow label="Email"       value={form.email} />
                <ReviewRow label="Phone"       value={form.phone} />
                <ReviewRow label="Type"        value={form.type} />
                <ReviewRow label="Status"      value={form.status} />
                <ReviewRow label="Assignee"    value={form.assignee} />
                <ReviewRow label="Website"     value={form.website} />
                <ReviewRow label="Address"     value={form.address} />
                <ReviewRow label="Tags"        value={form.tags} />
              </div>

              <FormField label="Notes">
                <textarea
                  className="input-base resize-none"
                  rows={4}
                  placeholder="Any relevant context about this contact…"
                  value={form.notes}
                  onChange={setField('notes')}
                />
              </FormField>
            </FormSection>
          )}
        </ModalBody>
      </form>
    </Modal>
  )
}

export default ContactFormModal
