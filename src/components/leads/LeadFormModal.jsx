// ─── LeadFormModal ────────────────────────────────────────────────────────────
//
// step059. Chrome, field wrapper and section grouping now come from
// `ui/Modal.jsx` and `ui/FormKit.jsx`. The store calls, the validation and the
// payload shape are UNCHANGED — this batch moved markup, not behaviour.
//
// Three sections, in the order a person actually knows the answers: who they
// are, where the deal stands, and everything optional.
//
// `addLead` / `updateLead` are Zustand actions and return nothing, so there is
// no pending or error state to render here — Leads is the last module still on
// a Zustand array rather than React Query (backlog item 10). When it moves,
// give this form the `FormError` banner and a disabled submit, the way Contact
// and Opportunity have them.

import React, { useState, useEffect } from 'react'
import { useLeadsStore, STAGES, PRIORITIES, SOURCES } from '../../stores/leadsStore.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'
import { Modal, ModalBody }     from '../ui/Modal.jsx'
import { FormSection, FormRow, FormField } from '../ui/FormKit.jsx'

const EMPTY = {
  name: '', company: '', email: '', phone: '',
  value: '', stage: 'New', priority: 'Medium',
  source: 'Website', assignee: '', notes: '', tags: '',
}

export function LeadFormModal() {
  const {
    addModalOpen, editModalOpen, closeAddModal, closeEditModal,
    addLead, updateLead, getSelectedLead,
  } = useLeadsStore()

  const { names: assigneeNames } = useAssignableMembers()

  const isOpen = addModalOpen || editModalOpen
  const isEdit = editModalOpen
  const existingLead = isEdit ? getSelectedLead() : null

  const [form, setForm]     = useState(EMPTY)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isOpen) {
      if (isEdit && existingLead) {
        setForm({
          ...existingLead,
          tags: (existingLead.tags || []).join(', '),
          value: String(existingLead.value),
        })
      } else {
        setForm(EMPTY)
      }
      setErrors({})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEdit, existingLead?.id])

  const close = () => { isEdit ? closeEditModal() : closeAddModal() }

  const validate = () => {
    const e = {}
    if (!form.name.trim())    e.name    = 'Name is required'
    if (!form.company.trim()) e.company = 'Company is required'
    if (!form.email.trim())   e.email   = 'Email is required'
    if (!form.assignee)       e.assignee = 'Assignee is required'
    if (!form.value || isNaN(Number(form.value))) e.value = 'Valid deal value required'
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const payload = {
      ...form,
      value: Number(form.value),
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    }

    if (isEdit) {
      updateLead(existingLead.id, payload)
    } else {
      addLead(payload)
    }
  }

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setErrors((err) => { const next = { ...err }; delete next[field]; return next })
  }

  return (
    <Modal
      open={isOpen}
      onClose={close}
      title={isEdit ? 'Edit lead' : 'New lead'}
      size="md"
      footer={
        <>
          <button type="button" onClick={close} className="btn-secondary">Cancel</button>
          <button type="submit" form="lead-form" className="btn-primary">
            {isEdit ? 'Save changes' : 'Create lead'}
          </button>
        </>
      }
    >
      {/* The submit button lives in the footer, OUTSIDE this <form>, and is
          bound back to it by `form="lead-form"`. Nesting the footer inside the
          form instead would put the scrolling boundary in the wrong place —
          the footer would scroll away with the fields. */}
      <form id="lead-form" onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
        <ModalBody>
          <FormSection label="Contact" first>
            <FormRow>
              <FormField label="Full name" error={errors.name} required>
                <input className="input-base" placeholder="Farhan Hossain"
                       value={form.name} onChange={set('name')} />
              </FormField>
              <FormField label="Company" error={errors.company} required>
                <input className="input-base" placeholder="GreenTech BD"
                       value={form.company} onChange={set('company')} />
              </FormField>
            </FormRow>

            <FormRow>
              <FormField label="Email" error={errors.email} required>
                <input type="email" className="input-base" placeholder="name@company.com"
                       value={form.email} onChange={set('email')} />
              </FormField>
              <FormField label="Phone">
                <input type="tel" className="input-base" placeholder="+880 17XX-XXXXXX"
                       value={form.phone} onChange={set('phone')} />
              </FormField>
            </FormRow>
          </FormSection>

          <FormSection label="Deal">
            <FormRow cols={3}>
              <FormField label="Stage">
                <select className="input-base" value={form.stage} onChange={set('stage')}>
                  {STAGES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="Priority">
                <select className="input-base" value={form.priority} onChange={set('priority')}>
                  {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </FormField>
              <FormField label="Source">
                <select className="input-base" value={form.source} onChange={set('source')}>
                  {SOURCES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </FormField>
            </FormRow>

            <FormRow>
              <FormField label="Deal value (BDT)" error={errors.value} required>
                <input type="number" className="input-base tabular-nums" placeholder="500000"
                       value={form.value} onChange={set('value')} />
              </FormField>
              <FormField label="Assignee" error={errors.assignee} required>
                <select className="input-base" value={form.assignee} onChange={set('assignee')}>
                  <option value="">Select assignee…</option>
                  {assigneeNames.map((a) => <option key={a}>{a}</option>)}
                </select>
              </FormField>
            </FormRow>
          </FormSection>

          <FormSection label="Details">
            <FormField label="Tags" hint="Comma-separated">
              <input className="input-base" placeholder="Enterprise, Q2, Healthcare"
                     value={form.tags} onChange={set('tags')} />
            </FormField>

            <FormField label="Notes">
              <textarea
                className="input-base resize-none"
                rows={3}
                placeholder="Any relevant context about this lead…"
                value={form.notes}
                onChange={set('notes')}
              />
            </FormField>
          </FormSection>
        </ModalBody>
      </form>
    </Modal>
  )
}

export default LeadFormModal
