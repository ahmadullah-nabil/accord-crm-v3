// ─── LeadFormModal ────────────────────────────────────────────────────────────
//
// step060. Three steps — Contact → Deal → Summary — on the shared `Stepper`.
// The store actions, the validation rules and the payload shape are UNCHANGED.
//
// Per-step validation via `STEP_FIELDS`, and a failed final submit jumps back
// to the step that owns the offending field. See OppFormModal's header for the
// full reasoning; it is the same machinery in all four dialogs.
//
// `addLead` / `updateLead` are Zustand actions and return nothing, so there is
// still no pending or error state to render — Leads is the last module on a
// Zustand array (backlog item 10). When it moves to React Query, add the
// `FormError` banner and a disabled submit the way Contact and Opportunity
// have them.

import React, { useState, useEffect } from 'react'
import { useLeadsStore, STAGES, PRIORITIES, SOURCES } from '../../stores/leadsStore.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'
import { Modal, ModalBody }     from '../ui/Modal.jsx'
import { Stepper, StepHeading } from '../ui/Stepper.jsx'
import { FormSection, FormRow, FormField, ReviewRow } from '../ui/FormKit.jsx'

const EMPTY = {
  name: '', company: '', email: '', phone: '',
  value: '', stage: 'New', priority: 'Medium',
  source: 'Website', assignee: '', notes: '', tags: '',
}

const STEPS = [
  { id: 'contact', label: 'Contact' },
  { id: 'deal',    label: 'Deal'    },
  { id: 'summary', label: 'Summary' },
]

const STEP_FIELDS = [
  ['name', 'company', 'email'],
  ['value', 'assignee'],
  [],
]

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
  const [step, setStep]     = useState(0)

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
      setStep(0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEdit, existingLead?.id])

  const close = () => { isEdit ? closeEditModal() : closeAddModal() }

  const validate = () => {
    const e = {}
    if (!form.name.trim())    e.name     = 'Name is required'
    if (!form.company.trim()) e.company  = 'Company is required'
    if (!form.email.trim())   e.email    = 'Email is required'
    if (!form.assignee)       e.assignee = 'Assignee is required'
    if (!form.value || isNaN(Number(form.value))) e.value = 'Valid deal value required'
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

  const isLast = step === STEPS.length - 1

  // ── WHY THE PRIMARY BUTTON IS ALWAYS type="submit" ────────────────────────
  //
  // step061 fixes a bug that skipped the Summary step entirely: clicking
  // Continue on step 2 saved the record instead of advancing to step 3.
  //
  // The cause was DOM NODE REUSE. The footer rendered
  //   {isLast ? <button type="submit" form="..."> : <button type="button">}
  // and React reconciles those two as the SAME <button> element — same tag,
  // same position — so it patches the attributes rather than replacing the
  // node. The click handler ran, `next()` set step to the last one, React
  // flushed that update synchronously (a click is a discrete event), and by
  // the time the browser got round to performing the click's DEFAULT ACTION
  // the very button that had just been clicked was now `type="submit"`
  // pointing at the form. The browser submitted it. One physical button,
  // mutated mid-click.
  //
  // A second, independent path to the same symptom: pressing Enter in ANY
  // field fired the form's onSubmit from ANY step, which ran the full
  // validate() and saved.
  //
  // BOTH ARE CLOSED BY THE SAME CHANGE. The button never changes type — only
  // its label — so there is nothing to mutate mid-click, and every submit
  // (button or Enter) is routed through `onFormSubmit`, which advances the
  // step unless this is the last one. Enter now means Continue, which is what
  // a person expects it to mean.
  //
  // Do not "tidy" this back into a ternary that swaps the element type.
  const onFormSubmit = (e) => {
    e.preventDefault()
    if (!isLast) { next(); return }
    handleSubmit(e)
  }

  return (
    <Modal
      open={isOpen}
      onClose={close}
      title={isEdit ? 'Edit lead' : 'Create new lead'}
      size="md"
      toolbar={
        <Stepper steps={STEPS} current={step} onStepClick={setStep} allowForward={isEdit} />
      }
      footer={
        <>
          {step > 0 && (
            <button type="button" onClick={back} className="btn-secondary mr-auto">Back</button>
          )}
          <button
            type="button"
            onClick={close}
            className={`btn-secondary ${step === 0 ? 'mr-auto' : ''}`}
          >
            Cancel
          </button>
          <button type="submit" form="lead-form" className="btn-primary">
            {isLast ? (isEdit ? 'Save changes' : 'Create lead') : 'Continue'}
          </button>
        </>
      }
    >
      <form id="lead-form" onSubmit={onFormSubmit} className="flex-1 min-h-0 flex flex-col">
        <ModalBody>
          {step === 0 && (
            <FormSection first>
              <StepHeading
                title="Contact"
                description="Who the lead is and how to reach them."
              />

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
          )}

          {step === 1 && (
            <FormSection first>
              <StepHeading
                title="Deal"
                description="Where this sits in the pipeline, and who owns it."
              />

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

              <FormField label="Tags" hint="Comma-separated">
                <input className="input-base" placeholder="Enterprise, Q2, Healthcare"
                       value={form.tags} onChange={set('tags')} />
              </FormField>
            </FormSection>
          )}

          {step === 2 && (
            <FormSection first>
              <StepHeading
                title="Summary"
                description="Check this over, then create the lead."
              />

              <div className="rounded-md border border-gray-200 px-3 py-1">
                <ReviewRow label="Full name"  value={form.name} />
                <ReviewRow label="Company"    value={form.company} />
                <ReviewRow label="Email"      value={form.email} />
                <ReviewRow label="Phone"      value={form.phone} />
                <ReviewRow label="Stage"      value={form.stage} />
                <ReviewRow label="Priority"   value={form.priority} />
                <ReviewRow label="Source"     value={form.source} />
                <ReviewRow label="Deal value" value={form.value ? `৳${form.value}` : ''} />
                <ReviewRow label="Assignee"   value={form.assignee} />
                <ReviewRow label="Tags"       value={form.tags} />
              </div>

              <FormField label="Notes">
                <textarea
                  className="input-base resize-none"
                  rows={4}
                  placeholder="Any relevant context about this lead…"
                  value={form.notes}
                  onChange={set('notes')}
                />
              </FormField>
            </FormSection>
          )}
        </ModalBody>
      </form>
    </Modal>
  )
}

export default LeadFormModal
