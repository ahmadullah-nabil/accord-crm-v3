// ─── TaskFormModal ────────────────────────────────────────────────────────────
//
// step060. Three steps — Task → Scheduling → Summary — on the shared `Stepper`.
// The prefill path (MeetingDetailPanel's "Create follow-up task"), the
// relatedType reset, the mutations and the payload shape are UNCHANGED.
//
// The portal and the body scroll lock live in `Modal`; this file discovered
// both and its comments explaining them now sit there, where every dialog
// benefits instead of the two that remembered.
//
// Per-step validation via `STEP_FIELDS`; a failed final submit jumps back to
// the step owning the offending field.

import React, { useState, useEffect } from 'react'
import { useTasksStore }                         from '../../stores/tasksStore.js'
import { useTask, useCreateTask, useUpdateTask } from '../../hooks/useTasks.js'
import {
  TASK_STATUSES, TASK_PRIORITIES, TASK_TYPES, RELATED_TYPES,
} from '../../lib/tasksData.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'
import { Modal, ModalBody }     from '../ui/Modal.jsx'
import { Stepper, StepHeading } from '../ui/Stepper.jsx'
import { FormSection, FormRow, FormField, FormError, ReviewRow } from '../ui/FormKit.jsx'

const EMPTY = {
  title:        '',
  description:  '',
  status:       'Todo',
  priority:     'Medium',
  // 021. Drives the Dashboard calendar's type filter. 'Task' is the neutral
  // default — a Call or Deadline is a deliberate choice, not something to
  // guess from the title.
  type:         'Task',
  dueDate:      '',
  assignee:     '',
  relatedType:  'None',
  relatedId:    '',
  relatedLabel: '',
  tags:         '',
}

const STEPS = [
  { id: 'task',       label: 'Task'       },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'summary',    label: 'Summary'    },
]

const STEP_FIELDS = [
  ['title'],
  ['dueDate', 'assignee'],
  [],
]

export function TaskFormModal() {
  const {
    addModalOpen, editModalOpen,
    closeAddModal, closeEditModal,
    selectedTaskId,
    prefillData,
  } = useTasksStore()

  const isOpen = addModalOpen || editModalOpen
  const isEdit = editModalOpen

  const { data: existingTask }   = useTask(isEdit ? selectedTaskId : null)
  const { names: assigneeNames } = useAssignableMembers()

  const createMutation = useCreateTask()
  const updateMutation = useUpdateTask()

  const [form, setForm]     = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [step, setStep]     = useState(0)

  useEffect(() => {
    if (isOpen) {
      if (isEdit && existingTask) {
        setForm({
          ...existingTask,
          tags: (existingTask.tags || []).join(', '),
        })
      } else {
        // For new tasks: apply prefill data supplied by the caller
        // (e.g. from MeetingDetailPanel's "Create Follow-up Task" button).
        setForm(prefillData ? { ...EMPTY, ...prefillData } : EMPTY)
      }
      setErrors({})
      setStep(0)
      createMutation.reset()
      updateMutation.reset()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEdit, existingTask?.id])

  const close = () => { isEdit ? closeEditModal() : closeAddModal() }

  const validate = () => {
    const e = {}
    if (!form.title.trim()) e.title    = 'Title is required'
    if (!form.assignee)     e.assignee = 'Assignee is required'
    if (!form.dueDate)      e.dueDate  = 'Due date is required'
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
      relatedType:  form.relatedType === 'None' ? 'None' : form.relatedType,
      relatedId:    form.relatedType === 'None' ? '' : form.relatedId,
      relatedLabel: form.relatedType === 'None' ? '' : form.relatedLabel,
    }

    if (isEdit) {
      updateMutation.mutate({ id: existingTask.id, data: payload }, { onSuccess: close })
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

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setErrors((err) => { const next = { ...err }; delete next[field]; return next })
  }

  return (
    <Modal
      open={isOpen}
      onClose={close}
      title={isEdit ? 'Edit task' : 'Create new task'}
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
          <button type="submit" form="task-form" className="btn-primary" disabled={isPending}>
            {!isLast
              ? 'Continue'
              : isPending
                ? (isEdit ? 'Saving…' : 'Adding…')
                : (isEdit ? 'Save changes' : 'Create task')}
          </button>
        </>
      }
    >
      <form id="task-form" onSubmit={onFormSubmit} className="flex-1 min-h-0 flex flex-col">
        <ModalBody>
          <FormError>{mutationError}</FormError>

          {step === 0 && (
            <FormSection first>
              <StepHeading
                title="Task"
                description="What needs doing, and any context for whoever picks it up."
              />

              <FormField label="Task title" error={errors.title} required>
                <input className="input-base" placeholder="e.g. Send proposal to GreenTech BD"
                       value={form.title} onChange={setField('title')} />
              </FormField>

              <FormField label="Description">
                <textarea className="input-base resize-none" rows={4}
                          placeholder="Additional context or instructions…"
                          value={form.description} onChange={setField('description')} />
              </FormField>
            </FormSection>
          )}

          {step === 1 && (
            <FormSection first>
              <StepHeading
                title="Scheduling"
                description="When it is due and who is doing it."
              />

              <FormRow cols={3}>
                <FormField label="Type">
                  <select className="input-base" value={form.type} onChange={setField('type')}>
                    {TASK_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </FormField>
                <FormField label="Status">
                  <select className="input-base" value={form.status} onChange={setField('status')}>
                    {TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </FormField>
                <FormField label="Priority">
                  <select className="input-base" value={form.priority} onChange={setField('priority')}>
                    {TASK_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </FormField>
              </FormRow>

              <FormRow>
                <FormField label="Due date" error={errors.dueDate} required>
                  <input type="date" className="input-base"
                         value={form.dueDate} onChange={setField('dueDate')} />
                </FormField>
                <FormField label="Assignee" error={errors.assignee} required>
                  <select className="input-base" value={form.assignee} onChange={setField('assignee')}>
                    <option value="">Select…</option>
                    {assigneeNames.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </FormField>
              </FormRow>
            </FormSection>
          )}

          {step === 2 && (
            <FormSection first>
              <StepHeading
                title="Summary"
                description="Link it to a record if it belongs to one, then create it."
              />

              <FormField label="Related to">
                <select
                  className="input-base"
                  value={form.relatedType}
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      relatedType:  e.target.value,
                      relatedId:    '',
                      relatedLabel: '',
                    }))
                  }}
                >
                  {RELATED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>

              {form.relatedType !== 'None' && (
                <FormRow>
                  <FormField label={`${form.relatedType} ID`}>
                    <input
                      className="input-base"
                      placeholder={form.relatedType === 'Lead' ? 'L-001' : 'C-001'}
                      value={form.relatedId}
                      onChange={setField('relatedId')}
                    />
                  </FormField>
                  <FormField label="Display label">
                    <input
                      className="input-base"
                      placeholder="Name — Company"
                      value={form.relatedLabel}
                      onChange={setField('relatedLabel')}
                    />
                  </FormField>
                </FormRow>
              )}

              <FormField label="Tags" hint="Comma-separated">
                <input className="input-base" placeholder="Proposal, Follow-up, Enterprise"
                       value={form.tags} onChange={setField('tags')} />
              </FormField>

              <div className="rounded-md border border-gray-200 px-3 py-1">
                <ReviewRow label="Title"    value={form.title} />
                <ReviewRow label="Type"     value={form.type} />
                <ReviewRow label="Status"   value={form.status} />
                <ReviewRow label="Priority" value={form.priority} />
                <ReviewRow label="Due date" value={form.dueDate} />
                <ReviewRow label="Assignee" value={form.assignee} />
                <ReviewRow
                  label="Related to"
                  value={form.relatedType === 'None' ? '' : `${form.relatedType} · ${form.relatedLabel || form.relatedId}`}
                />
              </div>
            </FormSection>
          )}
        </ModalBody>
      </form>
    </Modal>
  )
}

export default TaskFormModal
