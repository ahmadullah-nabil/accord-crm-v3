import React, { useState, useEffect } from 'react'
import { X, FileText, Calendar, User, Link2, Tag } from 'lucide-react'
import { useTasksStore }                             from '../../stores/tasksStore.js'
import { useTask, useCreateTask, useUpdateTask }     from '../../hooks/useTasks.js'
import {
  TASK_STATUSES, TASK_PRIORITIES, RELATED_TYPES,
} from '../../lib/tasksData.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'

const EMPTY = {
  title:        '',
  description:  '',
  status:       'Todo',
  priority:     'Medium',
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

  const { data: existingTask } = useTask(isEdit ? selectedTaskId : null)
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEdit, existingTask?.id])

  const close = () => { isEdit ? closeEditModal() : closeAddModal() }

  const validate = () => {
    const e = {}
    if (!form.title.trim())  e.title    = 'Title is required'
    if (!form.assignee)      e.assignee = 'Assignee is required'
    if (!form.dueDate)       e.dueDate  = 'Due date is required'
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

  const isPending = createMutation.isPending || updateMutation.isPending

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
      <div className="relative bg-white rounded-2xl shadow-card-lg w-full max-w-[560px]
        max-h-[90vh] flex flex-col animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-display font-bold text-gray-900 text-lg">
            {isEdit ? 'Edit Task' : 'Add New Task'}
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

            {/* Title */}
            <Field label="Task Title" error={errors.title} required>
              <input
                className="input-base"
                placeholder="e.g. Send proposal to GreenTech BD"
                value={form.title}
                onChange={setField('title')}
              />
            </Field>

            {/* Description */}
            <Field label="Description" icon={FileText}>
              <textarea
                className="input-base resize-none"
                rows={3}
                placeholder="Additional context or instructions…"
                value={form.description}
                onChange={setField('description')}
              />
            </Field>

            {/* Status + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select className="input-base" value={form.status} onChange={setField('status')}>
                  {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Priority">
                <select className="input-base" value={form.priority} onChange={setField('priority')}>
                  {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
            </div>

            {/* Due date + Assignee */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Due Date" error={errors.dueDate} icon={Calendar} required>
                <input
                  type="date"
                  className="input-base"
                  value={form.dueDate}
                  onChange={setField('dueDate')}
                />
              </Field>
              <Field label="Assignee" error={errors.assignee} icon={User} required>
                <select className="input-base" value={form.assignee} onChange={setField('assignee')}>
                  <option value="">Select assignee…</option>
                  {assigneeNames.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
            </div>

            {/* Related entity */}
            <div className="space-y-3">
              <Field label="Related To" icon={Link2}>
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
              </Field>

              {form.relatedType !== 'None' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label={`${form.relatedType} ID`}>
                    <input
                      className="input-base"
                      placeholder={form.relatedType === 'Lead' ? 'L-001' : 'C-001'}
                      value={form.relatedId}
                      onChange={setField('relatedId')}
                    />
                  </Field>
                  <Field label="Display Label">
                    <input
                      className="input-base"
                      placeholder="Name — Company"
                      value={form.relatedLabel}
                      onChange={setField('relatedLabel')}
                    />
                  </Field>
                </div>
              )}
            </div>

            {/* Tags */}
            <Field label="Tags (comma-separated)" icon={Tag}>
              <input
                className="input-base"
                placeholder="Proposal, Follow-up, Enterprise"
                value={form.tags}
                onChange={setField('tags')}
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
                : (isEdit ? 'Save Changes' : 'Add Task')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, error, icon: Icon, required, children }) {
  const child = React.Children.only(children)
  const isTextarea = child.type === 'textarea'
  return (
    <div>
      <label className="label-base">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <div className="relative">
        {Icon && !isTextarea && (
          <Icon
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
          />
        )}
        {React.cloneElement(child, {
          className: [
            child.props.className || 'input-base',
            Icon && !isTextarea ? 'pl-9' : '',
            error ? 'border-red-300 focus:border-red-400 focus:ring-red-400/20' : '',
          ].filter(Boolean).join(' '),
        })}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
