// ─── OppFormModal ─────────────────────────────────────────────────────────────
//
// step059. Chrome and fields now come from `ui/Modal.jsx` and `ui/FormKit.jsx`.
// The stage → probability auto-set, the prefill path, the mutations and the
// payload shape are UNCHANGED.
//
// TWO FIXES BEYOND STYLING, both visible in the old file above:
//
//   1. The footer's submit was a plain <button onClick={handleSubmit}> sitting
//      OUTSIDE the <form>, so pressing Enter in any field did nothing. It is a
//      real submit button bound to the form by id now, and Enter works.
//
//   2. There was no error surface at all. `createMutation.error` had nowhere
//      to render, so a failed insert left the dialog open with a button that
//      looked like it had not been pressed — the step038 wound. `FormError`
//      renders it.
//
// The `$` glyph inside the Deal Value input is gone with the other field
// icons: the field is labelled in taka everywhere else in the app, and a
// dollar sign on a BDT figure was actively wrong.

import React, { useState, useEffect } from 'react'
import {
  useOpportunitiesStore, OPPORTUNITY_STAGES, PROBABILITY_BY_STAGE,
} from '../../stores/opportunitiesStore.js'
import {
  useCreateOpportunity, useUpdateOpportunity, useOpportunity,
} from '../../hooks/useOpportunities.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'
import { Modal, ModalBody }     from '../ui/Modal.jsx'
import { FormSection, FormRow, FormField, FormError } from '../ui/FormKit.jsx'

const EMPTY = {
  title: '', company: '', email: '', phone: '',
  stage: 'New', value: '', probability: 50,
  expectedCloseDate: '', assignee: '', notes: '', tags: '',
}

export function OppFormModal() {
  const {
    addModalOpen, editModalOpen, closeAddModal, closeEditModal,
    selectedOppId, prefillData,
  } = useOpportunitiesStore()

  const isOpen = addModalOpen || editModalOpen
  const isEdit = editModalOpen

  const { data: existing } = useOpportunity(isEdit ? selectedOppId : null)
  const { names: assigneeNames } = useAssignableMembers()
  const createMutation = useCreateOpportunity()
  const updateMutation = useUpdateOpportunity()

  const [form, setForm]     = useState(EMPTY)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isOpen) {
      if (isEdit && existing) {
        setForm({
          ...existing,
          value: String(existing.value),
          probability: existing.probability ?? 50,
          tags: (existing.tags || []).join(', '),
        })
      } else {
        setForm(prefillData ? { ...EMPTY, ...prefillData } : EMPTY)
      }
      setErrors({})
      createMutation.reset()
      updateMutation.reset()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEdit, existing?.id])

  const close = isEdit ? closeEditModal : closeAddModal

  const set = (field) => (e) => {
    const val = e.target.value
    setForm((f) => {
      const next = { ...f, [field]: val }
      // Auto-set probability when stage changes
      if (field === 'stage' && PROBABILITY_BY_STAGE[val] !== undefined) {
        next.probability = PROBABILITY_BY_STAGE[val]
      }
      return next
    })
    setErrors((err) => { const next = { ...err }; delete next[field]; return next })
  }

  const validate = () => {
    const e = {}
    if (!form.title.trim())   e.title    = 'Title is required'
    if (!form.company.trim()) e.company  = 'Company is required'
    if (!form.assignee)       e.assignee = 'Assignee is required'
    if (form.value !== '' && isNaN(Number(form.value))) e.value = 'Must be a number'
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const payload = {
      ...form,
      value: Number(form.value) || 0,
      probability: Number(form.probability) ?? 50,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    }

    if (isEdit) {
      updateMutation.mutate({ id: existing.id, data: payload }, { onSuccess: close })
    } else {
      createMutation.mutate(payload, { onSuccess: close })
    }
  }

  const isPending     = createMutation.isPending || updateMutation.isPending
  const mutationError = createMutation.error?.message || updateMutation.error?.message

  return (
    <Modal
      open={isOpen}
      onClose={close}
      title={isEdit ? 'Edit deal' : 'New deal'}
      size="md"
      footer={
        <>
          <button type="button" onClick={close} className="btn-secondary" disabled={isPending}>
            Cancel
          </button>
          <button type="submit" form="opp-form" className="btn-primary" disabled={isPending}>
            {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create deal'}
          </button>
        </>
      }
    >
      <form id="opp-form" onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
        <ModalBody>
          <FormError>{mutationError}</FormError>

          <FormSection label="Deal" first>
            <FormField label="Title" error={errors.title} required>
              <input className="input-base" placeholder="Deal name…"
                     value={form.title} onChange={set('title')} />
            </FormField>

            <FormField label="Company" error={errors.company} required>
              <input className="input-base" placeholder="Company name…"
                     value={form.company} onChange={set('company')} />
            </FormField>

            <FormRow>
              <FormField label="Deal value (BDT)" error={errors.value}>
                <input type="text" className="input-base tabular-nums" placeholder="0"
                       value={form.value} onChange={set('value')} />
              </FormField>
              <FormField label="Expected close">
                <input type="date" className="input-base"
                       value={form.expectedCloseDate} onChange={set('expectedCloseDate')} />
              </FormField>
            </FormRow>

            <FormRow cols={3}>
              <FormField label="Stage" required>
                <select className="input-base" value={form.stage} onChange={set('stage')}>
                  {OPPORTUNITY_STAGES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="Probability" hint="Follows the stage unless you change it">
                <input type="number" min="0" max="100" className="input-base tabular-nums"
                       value={form.probability} onChange={set('probability')} />
              </FormField>
              <FormField label="Assignee" error={errors.assignee} required>
                <select className="input-base" value={form.assignee} onChange={set('assignee')}>
                  <option value="">Select…</option>
                  {assigneeNames.map((n) => <option key={n}>{n}</option>)}
                </select>
              </FormField>
            </FormRow>
          </FormSection>

          <FormSection label="Contact">
            <FormRow>
              <FormField label="Email">
                <input type="email" className="input-base" placeholder="contact@company.com"
                       value={form.email} onChange={set('email')} />
              </FormField>
              <FormField label="Phone">
                <input type="tel" className="input-base" placeholder="+880…"
                       value={form.phone} onChange={set('phone')} />
              </FormField>
            </FormRow>
          </FormSection>

          <FormSection label="Details">
            <FormField label="Tags" hint="Comma-separated">
              <input className="input-base" placeholder="tag1, tag2…"
                     value={form.tags} onChange={set('tags')} />
            </FormField>

            <FormField label="Notes">
              <textarea className="input-base resize-none" rows={3} placeholder="Deal notes…"
                        value={form.notes} onChange={set('notes')} />
            </FormField>
          </FormSection>
        </ModalBody>
      </form>
    </Modal>
  )
}

export default OppFormModal
