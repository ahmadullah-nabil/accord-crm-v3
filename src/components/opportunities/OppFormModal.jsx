// ─── OppFormModal ─────────────────────────────────────────────────────────────
//
// step060. Three-step wizard — Basic Info → Details → Summary — on the shared
// `Stepper`. The mutations, the stage → probability auto-set, the prefill path
// and the payload shape are UNCHANGED from step059.
//
// VALIDATION IS PER STEP. `STEP_FIELDS` names which required fields belong to
// which step, and Continue validates only those. Without that, either the
// button blocks on a field two steps ahead that nobody has seen yet, or it
// waves everything through and the final submit fails on a step the user has
// already left behind. The final submit still runs the full `validate()`, so
// the last step cannot be reached with something missing — and if it somehow
// is, `goToFirstError` jumps back to the step that owns the offending field
// instead of showing an error on a screen that does not contain it.
//
// SUMMARY IS NOT FILLER. It reads the record back — every field that will be
// written, including the ones auto-derived like probability — and carries the
// two long free-text fields. A three-step form whose last step is empty is
// worse than two steps.

import React, { useState, useEffect } from 'react'
import {
  useOpportunitiesStore, OPPORTUNITY_STAGES, PROBABILITY_BY_STAGE,
} from '../../stores/opportunitiesStore.js'
import {
  useCreateOpportunity, useUpdateOpportunity, useOpportunity,
} from '../../hooks/useOpportunities.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'
import { Modal, ModalBody }     from '../ui/Modal.jsx'
import { Stepper, StepHeading } from '../ui/Stepper.jsx'
import { FormSection, FormRow, FormField, FormError, ReviewRow } from '../ui/FormKit.jsx'

const EMPTY = {
  title: '', company: '', email: '', phone: '',
  stage: 'New', value: '', probability: 50,
  expectedCloseDate: '', assignee: '', notes: '', tags: '',
}

const STEPS = [
  { id: 'basic',   label: 'Basic info' },
  { id: 'details', label: 'Details'    },
  { id: 'summary', label: 'Summary'    },
]

/** Which required fields each step owns. Drives per-step validation AND the
 *  jump-back-to-the-offending-step behaviour. */
const STEP_FIELDS = [
  ['title', 'company', 'assignee'],
  ['value'],
  [],
]

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
  const [step, setStep]     = useState(0)

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
      setStep(0)
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

  /** Errors belonging to one step only. */
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
      // Send the user to the step that actually contains the problem.
      const bad = STEP_FIELDS.findIndex((fields) => fields.some((f) => errs[f]))
      if (bad >= 0) setStep(bad)
      return
    }

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
  const isLast        = step === STEPS.length - 1

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
      title={isEdit ? 'Edit deal' : 'Create new deal'}
      size="md"
      toolbar={
        <Stepper
          steps={STEPS}
          current={step}
          onStepClick={setStep}
          allowForward={isEdit}
        />
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
          <button type="submit" form="opp-form" className="btn-primary" disabled={isPending}>
            {!isLast
              ? 'Continue'
              : isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create deal'}
          </button>
        </>
      }
    >
      <form id="opp-form" onSubmit={onFormSubmit} className="flex-1 min-h-0 flex flex-col">
        <ModalBody>
          <FormError>{mutationError}</FormError>

          {step === 0 && (
            <FormSection first>
              <StepHeading
                title="Basic info"
                description="Enter basic information about this deal."
              />

              <FormField label="Deal name" error={errors.title} required>
                <input className="input-base" placeholder="e.g. ERP rollout — GreenTech BD"
                       value={form.title} onChange={set('title')} />
              </FormField>

              <FormField label="Related to" error={errors.company} required>
                <input className="input-base" placeholder="Company name…"
                       value={form.company} onChange={set('company')} />
              </FormField>

              <FormField label="Deal owner" error={errors.assignee} required>
                <select className="input-base" value={form.assignee} onChange={set('assignee')}>
                  <option value="">Select owner…</option>
                  {assigneeNames.map((n) => <option key={n}>{n}</option>)}
                </select>
              </FormField>

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
          )}

          {step === 1 && (
            <FormSection first>
              <StepHeading
                title="Details"
                description="Where the deal stands and what it is worth."
              />

              <FormRow>
                <FormField label="Stage" required>
                  <select className="input-base" value={form.stage} onChange={set('stage')}>
                    {OPPORTUNITY_STAGES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </FormField>
                <FormField label="Probability" hint="Follows the stage unless you change it">
                  <input type="number" min="0" max="100" className="input-base tabular-nums"
                         value={form.probability} onChange={set('probability')} />
                </FormField>
              </FormRow>

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

              <FormField label="Tags" hint="Comma-separated">
                <input className="input-base" placeholder="Enterprise, Q3, ERP"
                       value={form.tags} onChange={set('tags')} />
              </FormField>
            </FormSection>
          )}

          {step === 2 && (
            <FormSection first>
              <StepHeading
                title="Summary"
                description="Check this over, then create the deal."
              />

              <div className="rounded-md border border-gray-200 px-3 py-1">
                <ReviewRow label="Deal name"     value={form.title} />
                <ReviewRow label="Related to"    value={form.company} />
                <ReviewRow label="Deal owner"    value={form.assignee} />
                <ReviewRow label="Stage"         value={form.stage} />
                <ReviewRow label="Probability"   value={`${form.probability}%`} />
                <ReviewRow label="Deal value"    value={form.value ? `৳${form.value}` : ''} />
                <ReviewRow label="Expected close" value={form.expectedCloseDate} />
                <ReviewRow label="Email"         value={form.email} />
                <ReviewRow label="Phone"         value={form.phone} />
                <ReviewRow label="Tags"          value={form.tags} />
              </div>

              <FormField label="Notes">
                <textarea className="input-base resize-none" rows={4} placeholder="Deal notes…"
                          value={form.notes} onChange={set('notes')} />
              </FormField>
            </FormSection>
          )}
        </ModalBody>
      </form>
    </Modal>
  )
}

export default OppFormModal
