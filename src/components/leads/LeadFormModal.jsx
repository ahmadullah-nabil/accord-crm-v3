import React, { useState, useEffect } from 'react'
import { X, User, Building2, Mail, Phone, DollarSign, Tag } from 'lucide-react'
import { useLeadsStore, STAGES, PRIORITIES, SOURCES } from '../../stores/leadsStore.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'

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

  const [form, setForm] = useState(EMPTY)
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-card-lg w-full max-w-[560px] max-h-[90vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-display font-bold text-gray-900 text-lg">
            {isEdit ? 'Edit Lead' : 'Add New Lead'}
          </h2>
          <button onClick={close} className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            {/* Row: name + company */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name" error={errors.name} icon={User}>
                <input className="input-base" placeholder="Farhan Hossain" value={form.name} onChange={set('name')} />
              </Field>
              <Field label="Company" error={errors.company} icon={Building2}>
                <input className="input-base" placeholder="GreenTech BD" value={form.company} onChange={set('company')} />
              </Field>
            </div>

            {/* Row: email + phone */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email" error={errors.email} icon={Mail}>
                <input type="email" className="input-base" placeholder="name@company.com" value={form.email} onChange={set('email')} />
              </Field>
              <Field label="Phone">
                <input type="tel" className="input-base" placeholder="+880 17XX-XXXXXX" value={form.phone} onChange={set('phone')} />
              </Field>
            </div>

            {/* Row: stage + priority */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stage">
                <select className="input-base" value={form.stage} onChange={set('stage')}>
                  {STAGES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Priority">
                <select className="input-base" value={form.priority} onChange={set('priority')}>
                  {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
            </div>

            {/* Row: value + source */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Deal Value (BDT)" error={errors.value} icon={DollarSign}>
                <input type="number" className="input-base" placeholder="500000" value={form.value} onChange={set('value')} />
              </Field>
              <Field label="Source">
                <select className="input-base" value={form.source} onChange={set('source')}>
                  {SOURCES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>

            {/* Assignee */}
            <Field label="Assignee" error={errors.assignee}>
              <select className="input-base" value={form.assignee} onChange={set('assignee')}>
                <option value="">Select assignee…</option>
                {assigneeNames.map((a) => <option key={a}>{a}</option>)}
              </select>
            </Field>

            {/* Tags */}
            <Field label="Tags (comma-separated)" icon={Tag}>
              <input className="input-base" placeholder="Enterprise, Q2, Healthcare" value={form.tags} onChange={set('tags')} />
            </Field>

            {/* Notes */}
            <Field label="Notes">
              <textarea
                className="input-base resize-none"
                rows={3}
                placeholder="Any relevant context about this lead…"
                value={form.notes}
                onChange={set('notes')}
              />
            </Field>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <button type="button" onClick={close} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">
              {isEdit ? 'Save Changes' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, error, icon: Icon, children }) {
  return (
    <div>
      <label className="label-base">{label}</label>
      <div className="relative">
        {Icon && (
          <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
        )}
        {React.cloneElement(children, {
          className: `${children.props.className || 'input-base'} ${Icon ? 'pl-9' : ''} ${error ? 'border-red-300 focus:border-red-400 focus:ring-red-400/20' : ''}`,
        })}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
