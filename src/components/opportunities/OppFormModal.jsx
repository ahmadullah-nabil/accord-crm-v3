import React, { useState, useEffect } from 'react'
import { X, DollarSign, TrendingUp, Building2, Calendar, User, Tag } from 'lucide-react'
import { useOpportunitiesStore, OPPORTUNITY_STAGES, PROBABILITY_BY_STAGE } from '../../stores/opportunitiesStore.js'
import { useCreateOpportunity, useUpdateOpportunity, useOpportunity } from '../../hooks/useOpportunities.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'

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
  }

  const validate = () => {
    const e = {}
    if (!form.title.trim())    e.title    = 'Title is required'
    if (!form.company.trim())  e.company  = 'Company is required'
    if (!form.assignee)        e.assignee = 'Assignee is required'
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

    const mutation = isEdit
      ? updateMutation.mutate({ id: existing.id, data: payload }, { onSuccess: close })
      : createMutation.mutate(payload, { onSuccess: close })
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-display font-bold text-gray-900">
            {isEdit ? 'Edit Deal' : 'New Deal'}
          </h2>
          <button onClick={close} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <Field label="Title" error={errors.title} required>
            <input className="input-base" placeholder="Deal name…" value={form.title} onChange={set('title')} />
          </Field>

          <Field label="Company" error={errors.company} required>
            <input className="input-base" placeholder="Company name…" value={form.company} onChange={set('company')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <input className="input-base" type="email" placeholder="contact@company.com" value={form.email} onChange={set('email')} />
            </Field>
            <Field label="Phone">
              <input className="input-base" type="tel" placeholder="+880…" value={form.phone} onChange={set('phone')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Stage" required>
              <select className="input-base" value={form.stage} onChange={set('stage')}>
                {OPPORTUNITY_STAGES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Probability">
              <div className="flex items-center gap-2">
                <input
                  className="input-base flex-1"
                  type="number" min="0" max="100"
                  value={form.probability}
                  onChange={set('probability')}
                />
                <span className="text-sm text-gray-500 font-medium">%</span>
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Deal Value" error={errors.value}>
              <div className="relative">
                <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input-base pl-8" type="text" placeholder="0" value={form.value} onChange={set('value')} />
              </div>
            </Field>
            <Field label="Expected Close">
              <input className="input-base" type="date" value={form.expectedCloseDate} onChange={set('expectedCloseDate')} />
            </Field>
          </div>

          <Field label="Assignee" error={errors.assignee} required>
            <select className="input-base" value={form.assignee} onChange={set('assignee')}>
              <option value="">Select assignee…</option>
              {assigneeNames.map((n) => <option key={n}>{n}</option>)}
            </select>
          </Field>

          <Field label="Notes">
            <textarea className="input-base resize-none h-20" placeholder="Deal notes…" value={form.notes} onChange={set('notes')} />
          </Field>

          <Field label="Tags">
            <input className="input-base" placeholder="tag1, tag2…" value={form.tags} onChange={set('tags')} />
          </Field>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={close} className="btn-secondary">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="btn-primary disabled:opacity-60"
          >
            {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Deal'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, error, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
