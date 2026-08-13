// ─── TaskFormModal ────────────────────────────────────────────────────────────
//
// step059. Chrome and fields now come from `ui/Modal.jsx` and `ui/FormKit.jsx`.
// The prefill path (MeetingDetailPanel's "Create follow-up task"), the
// relatedType reset, the mutations and the payload shape are UNCHANGED.
//
// The portal and the body scroll lock moved INTO `Modal` — this file discovered
// both problems and its comments explaining them now live in that file, where
// every dialog gets the fix instead of the two that remembered it.
//
// `FormError` is new here: the old footer disabled its button while pending but
// had nowhere to render `createMutation.error`, so a failed insert looked like
// a click that never registered.

import React, { useState, useEffect } from 'react'
import { useTasksStore }                         from '../../stores/tasksStore.js'
import { useTask, useCreateTask, useUpdateTask } from '../../hooks/useTasks.js'
import {
  TASK_STATUSES, TASK_PRIORITIES, TASK_TYPES, RELATED_TYPES,
} from '../../lib/tasksData.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'
import { Modal, ModalBody }     from '../ui/Modal.jsx'
import { FormSection, FormRow, FormField, FormError } from '../ui/FormKit.jsx'

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

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

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

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setErrors((err) => { const next = { ...err }; delete next[field]; return next })
  }

  return (
    <Modal
      open={isOpen}
      onClose={close}
      title={isEdit ? 'Edit task' : 'New task'}
      size="md"
      footer={
        <>
          <button type="button" onClick={close} className="btn-secondary" disabled={isPending}>
            Cancel
          </button>
          <button type="submit" form="task-form" className="btn-primary" disabled={isPending}>
            {isPending
              ? (isEdit ? 'Saving…' : 'Adding…')
              : (isEdit ? 'Save changes' : 'Create task')}
          </button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
        <ModalBody>
          <FormError>{mutationError}</FormError>

          <FormSection label="Task" first>
            <FormField label="Title" error={errors.title} required>
              <input className="input-base" placeholder="e.g. Send proposal to GreenTech BD"
                     value={form.title} onChange={setField('title')} />
            </FormField>

            <FormField label="Description">
              <textarea className="input-base resize-none" rows={3}
                        placeholder="Additional context or instructions…"
                        value={form.description} onChange={setField('description')} />
            </FormField>
          </FormSection>

          <FormSection label="Scheduling">
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

          <FormSection label="Link">
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
          </FormSection>

          <FormSection label="Details">
            <FormField label="Tags" hint="Comma-separated">
              <input className="input-base" placeholder="Proposal, Follow-up, Enterprise"
                     value={form.tags} onChange={setField('tags')} />
            </FormField>
          </FormSection>
        </ModalBody>
      </form>
    </Modal>
  )
}

export default TaskFormModal
