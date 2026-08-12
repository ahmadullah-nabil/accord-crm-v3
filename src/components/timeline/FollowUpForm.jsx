import React, { useState } from 'react'
import { X, Phone } from 'lucide-react'
import { useLogFollowUp, useScheduleFollowUp } from '../../hooks/useTimeline.js'
import { FOLLOWUP_TYPES } from '../../services/timelineService.js'

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

  const handleSubmit = () => {
    if (mode === 'log') {
      if (!outcome.trim()) return
      logMutation.mutate(
        { followupType, outcome: outcome.trim(), nextFollowupDate: nextDate || null },
        { onSuccess: () => { setOutcome(''); setNextDate(''); onClose() } }
      )
    } else {
      if (!scheduledDate) return
      scheduleMutation.mutate(
        { followupType, scheduledDate, notes: notes.trim() },
        { onSuccess: () => { setScheduledDate(''); setNotes(''); onClose() } }
      )
    }
  }

  return (
    <div className="mb-3 bg-purple-50 border border-purple-100 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-purple-700 flex items-center gap-1">
          <Phone size={10} /> Follow-up
        </span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={12} />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 mb-3 bg-white rounded-lg p-0.5 border border-purple-100">
        {['log', 'schedule'].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 text-[10px] font-semibold py-1 rounded-md transition-colors
              ${mode === m ? 'bg-purple-500 text-white' : 'text-gray-500 hover:text-purple-600'}`}
          >
            {m === 'log' ? 'Log completed' : 'Schedule next'}
          </button>
        ))}
      </div>

      {/* Type selector */}
      <select
        value={followupType}
        onChange={(e) => setFollowupType(e.target.value)}
        className="w-full text-xs rounded-lg border border-purple-100 bg-white p-1.5 mb-2 outline-none focus:ring-1 focus:ring-purple-300"
      >
        {FOLLOWUP_TYPES.map((t) => <option key={t}>{t}</option>)}
      </select>

      {mode === 'log' ? (
        <>
          <textarea
            className="w-full text-xs rounded-lg border border-purple-100 bg-white p-2.5 resize-none outline-none focus:ring-1 focus:ring-purple-300 placeholder-gray-400 mb-2"
            rows={2}
            placeholder="What happened? Outcome, key points…"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-500 flex-shrink-0">Next follow-up:</label>
            <input
              type="date"
              className="flex-1 text-xs rounded-lg border border-purple-100 bg-white px-2 py-1 outline-none focus:ring-1 focus:ring-purple-300"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
            />
          </div>
        </>
      ) : (
        <>
          <input
            type="date"
            className="w-full text-xs rounded-lg border border-purple-100 bg-white p-1.5 mb-2 outline-none focus:ring-1 focus:ring-purple-300"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            autoFocus
          />
          <textarea
            className="w-full text-xs rounded-lg border border-purple-100 bg-white p-2.5 resize-none outline-none focus:ring-1 focus:ring-purple-300 placeholder-gray-400"
            rows={2}
            placeholder="Notes about this follow-up (optional)…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </>
      )}

      <div className="flex justify-end mt-2">
        <button
          onClick={handleSubmit}
          disabled={isPending || (mode === 'log' ? !outcome.trim() : !scheduledDate)}
          className="text-xs font-semibold px-3 py-1.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Saving…' : mode === 'log' ? 'Log follow-up' : 'Schedule'}
        </button>
      </div>
    </div>
  )
}
