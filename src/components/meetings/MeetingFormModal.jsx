import React, { useState, useEffect } from 'react'
import {
  X, Calendar, Clock, MapPin, Users, Link2,
  FileText, Tag, Plus, Trash2,
} from 'lucide-react'
import { useMeetingsStore }                               from '../../stores/meetingsStore.js'
import { useMeeting, useCreateMeeting, useUpdateMeeting } from '../../hooks/useMeetings.js'
import {
  MEETING_STATUSES, MEETING_TYPES,
  RELATED_TYPES, LOCATION_TYPES, DURATION_OPTIONS,
} from '../../lib/meetingsData.js'
import { useAssignableMembers } from '../../hooks/useTeam.js'

const EMPTY = {
  title:        '',
  description:  '',
  status:       'Scheduled',
  type:         'Discovery',
  scheduledDate:'',
  scheduledTime:'09:00',
  durationMins: 60,
  location:     'Google Meet',
  locationUrl:  '',
  organizer:    '',
  participants: [],
  relatedType:  'None',
  relatedId:    '',
  relatedLabel: '',
  notes:        '',
  tags:         '',
}

export function MeetingFormModal() {
  const {
    addModalOpen, editModalOpen,
    closeAddModal, closeEditModal,
    selectedMeetingId,
    prefillData,
  } = useMeetingsStore()

  const isOpen = addModalOpen || editModalOpen
  const isEdit = editModalOpen

  const { data: existingMeeting } = useMeeting(isEdit ? selectedMeetingId : null)
  const { names: organizerNames } = useAssignableMembers()
  const createMutation = useCreateMeeting()
  const updateMutation = useUpdateMeeting()

  const [form, setForm]           = useState(EMPTY)
  const [errors, setErrors]       = useState({})
  const [participantInput, setParticipantInput] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (isEdit && existingMeeting) {
        setForm({
          ...existingMeeting,
          tags: (existingMeeting.tags || []).join(', '),
          participants: existingMeeting.participants || [],
          durationMins: existingMeeting.durationMins ?? 60,
        })
      } else {
        // For new meetings: apply any prefill data supplied by the caller
        // (e.g. from LeadDetailPanel's "Schedule Meeting" button).
        setForm(prefillData ? { ...EMPTY, ...prefillData } : EMPTY)
      }
      setErrors({})
      setParticipantInput('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEdit, existingMeeting?.id])

  const close = () => { isEdit ? closeEditModal() : closeAddModal() }

  const validate = () => {
    const e = {}
    if (!form.title.trim())    e.title        = 'Title is required'
    if (!form.organizer)       e.organizer    = 'Organizer is required'
    if (!form.scheduledDate)   e.scheduledDate = 'Date is required'
    if (!form.scheduledTime)   e.scheduledTime = 'Time is required'
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const payload = {
      ...form,
      durationMins: Number(form.durationMins),
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      relatedType:  form.relatedType === 'None' ? 'None' : form.relatedType,
      relatedId:    form.relatedType === 'None' ? '' : form.relatedId,
      relatedLabel: form.relatedType === 'None' ? '' : form.relatedLabel,
    }

    if (isEdit) {
      updateMutation.mutate({ id: existingMeeting.id, data: payload }, { onSuccess: close })
    } else {
      createMutation.mutate(payload, { onSuccess: close })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  const setField = (field) => (e) => {
    const val = e.target.value
    setForm((f) => ({ ...f, [field]: val }))
    setErrors((err) => { const next = { ...err }; delete next[field]; return next })
  }

  const addParticipant = () => {
    const name = participantInput.trim()
    if (!name || form.participants.includes(name)) return
    setForm((f) => ({ ...f, participants: [...f.participants, name] }))
    setParticipantInput('')
  }

  const removeParticipant = (name) => {
    setForm((f) => ({ ...f, participants: f.participants.filter((p) => p !== name) }))
  }

  const handleParticipantKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addParticipant() }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-card-lg w-full max-w-[600px]
        max-h-[90vh] flex flex-col animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-display font-bold text-gray-900 text-lg">
            {isEdit ? 'Edit Meeting' : 'Schedule Meeting'}
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
            <Field label="Meeting Title" error={errors.title} required>
              <input
                className="input-base"
                placeholder="e.g. ERP Demo — GreenTech BD"
                value={form.title}
                onChange={setField('title')}
              />
            </Field>

            {/* Status + Type */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select className="input-base" value={form.status} onChange={setField('status')}>
                  {MEETING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Type">
                <select className="input-base" value={form.type} onChange={setField('type')}>
                  {MEETING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>

            {/* Date + Time + Duration */}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Date" error={errors.scheduledDate} icon={Calendar} required>
                <input
                  type="date"
                  className="input-base"
                  value={form.scheduledDate}
                  onChange={setField('scheduledDate')}
                />
              </Field>
              <Field label="Time" error={errors.scheduledTime} icon={Clock} required>
                <input
                  type="time"
                  className="input-base"
                  value={form.scheduledTime}
                  onChange={setField('scheduledTime')}
                />
              </Field>
              <Field label="Duration">
                <select
                  className="input-base"
                  value={form.durationMins}
                  onChange={setField('durationMins')}
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d} min</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Location + URL */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Location" icon={MapPin}>
                <select className="input-base" value={form.location} onChange={setField('location')}>
                  {LOCATION_TYPES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </Field>
              <Field label="Meeting URL / Address">
                <input
                  className="input-base"
                  placeholder="https://meet.google.com/…"
                  value={form.locationUrl}
                  onChange={setField('locationUrl')}
                />
              </Field>
            </div>

            {/* Organizer */}
            <Field label="Organizer" error={errors.organizer} icon={Users} required>
              <select className="input-base" value={form.organizer} onChange={setField('organizer')}>
                <option value="">Select organizer…</option>
                {organizerNames.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>

            {/* Participants */}
            <div>
              <label className="label-base">Participants</label>
              {/* Participant chips */}
              {form.participants.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.participants.map((name) => (
                    <span key={name}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 text-teal-700
                        border border-teal-200 rounded-full text-xs font-medium">
                      {name}
                      <button
                        type="button"
                        onClick={() => removeParticipant(name)}
                        className="text-teal-400 hover:text-teal-700 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {/* Add participant input */}
              <div className="flex gap-2">
                <input
                  className="input-base flex-1"
                  placeholder="Type a name and press Enter or Add…"
                  value={participantInput}
                  onChange={(e) => setParticipantInput(e.target.value)}
                  onKeyDown={handleParticipantKeyDown}
                />
                <button
                  type="button"
                  onClick={addParticipant}
                  className="btn-secondary px-3 py-2 flex-shrink-0"
                >
                  <Plus size={14} />
                </button>
              </div>
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

            {/* Description */}
            <Field label="Description" icon={FileText}>
              <textarea
                className="input-base resize-none"
                rows={2}
                placeholder="Agenda or purpose of this meeting…"
                value={form.description}
                onChange={setField('description')}
              />
            </Field>

            {/* Notes */}
            <Field label="Notes">
              <textarea
                className="input-base resize-none"
                rows={2}
                placeholder="Pre-meeting prep notes or post-meeting follow-up…"
                value={form.notes}
                onChange={setField('notes')}
              />
            </Field>

            {/* Tags */}
            <Field label="Tags (comma-separated)" icon={Tag}>
              <input
                className="input-base"
                placeholder="Demo, Enterprise, Q2"
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
                ? (isEdit ? 'Saving…' : 'Scheduling…')
                : (isEdit ? 'Save Changes' : 'Schedule Meeting')
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
