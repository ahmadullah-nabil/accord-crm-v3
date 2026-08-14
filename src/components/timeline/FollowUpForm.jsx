// ─── FollowUpForm ─────────────────────────────────────────────────────────────
//
// step062. Purple tinted panel → flat white, matching NoteForm and
// MeetingNoteForm. See NoteForm's header for why the three colours went.
//
// The hand-rolled Log/Schedule toggle is now the shared `Segmented`, the same
// control the Analytics sections, the Members tabs and the leads view switcher
// use. It was a private two-button pill with its own active state — a fourth
// dialect of "pick one of these".
//
// Mutation errors surface now. Both mutations could fail silently: the form
// checked `isPending` for the button label and never read `.error`, so a failed
// follow-up looked like a click that did nothing — the step038 wound again.

import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useLogFollowUp, useScheduleFollowUp } from '../../hooks/useTimeline.js'
import { FOLLOWUP_TYPES } from '../../services/timelineService.js'
import { Segmented, SegButton } from '../ui/Segmented.jsx'

export function FollowUpForm({ entityType, entityId, entityLabel, onClose }) {
  const [mode, setMode]                   = useState('log')  // 'log' | 'schedule'
  const [followupType, setFollowupType]   = useState('Call')
  const [outcome, setOutcome]             = useState('')
  const [nextDate, setNextDate]           = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [notes, setNotes]                 = useState('')

  const logMutation      = useLogFollowUp(entityType, entityId, entityLabel)
  const scheduleMutation = useScheduleFollowUp(entityType, entityId, entityLabel)

  const isPending = logMutation.isPending || scheduleMutation.isPending
  const errorMsg  = logMutation.error?.message || scheduleMutation.error?.message

  const handleSubmit = () => {
    if (mode === 'log') {
      if (!outcome.trim()) return
      logMutation.mutate(
        { followupType, outcome: outcome.trim(), nextFollowupDate: nextDate || null },
        { onSuccess: () => { setOutcome(''); setNextDate(''); onClose() } },
      )
    } else {
      if (!scheduledDate) return
      scheduleMutation.mutate(
        { followupType, scheduledDate, notes: notes.trim() },
        { onSuccess: () => { setScheduledDate(''); setNotes(''); onClose() } },
      )
    }
  }

  const disabled = isPending || (mode === 'log' ? !outcome.trim() : !scheduledDate)

  return (
    <div className="mb-3 bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wide text-gray-400">Follow-up</span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-0.5 rounded text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-120"
        >
          <X size={13} />
        </button>
      </div>

      <div className="mb-2">
        <Segmented>
          <SegButton active={mode === 'log'}      onClick={() => setMode('log')}>Log completed</SegButton>
          <SegButton active={mode === 'schedule'} onClick={() => setMode('schedule')}>Schedule next</SegButton>
        </Segmented>
      </div>

      <select
        value={followupType}
        onChange={(e) => setFollowupType(e.target.value)}
        className="input-base text-xs mb-2"
      >
        {FOLLOWUP_TYPES.map((t) => <option key={t}>{t}</option>)}
      </select>

      {mode === 'log' ? (
        <>
          <textarea
            className="input-base resize-none text-xs mb-2"
            rows={2}
            placeholder="What happened? Outcome, key points…"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-400 shrink-0">Next follow-up</label>
            <input
              type="date"
              className="input-base text-xs flex-1"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
            />
          </div>
        </>
      ) : (
        <>
          <input
            type="date"
            className="input-base text-xs mb-2"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            autoFocus
          />
          <textarea
            className="input-base resize-none text-xs"
            rows={2}
            placeholder="Notes about this follow-up (optional)…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </>
      )}

      {errorMsg && <p className="text-[11px] text-red-500 mt-1.5">{errorMsg}</p>}

      <div className="flex justify-end mt-2">
        <button onClick={handleSubmit} disabled={disabled} className="btn-primary text-xs">
          {isPending ? 'Saving…' : mode === 'log' ? 'Log follow-up' : 'Schedule'}
        </button>
      </div>
    </div>
  )
}

export default FollowUpForm
