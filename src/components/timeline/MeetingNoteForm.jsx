import React, { useState } from 'react'
import { X, Users } from 'lucide-react'
import { useAddMeetingNote } from '../../hooks/useTimeline.js'

export function MeetingNoteForm({ meetingId, meetingTitle, onClose }) {
  const [summary,     setSummary]     = useState('')
  const [decisions,   setDecisions]   = useState('')
  const [nextActions, setNextActions] = useState('')
  const mutation = useAddMeetingNote(meetingId)

  const handleSubmit = () => {
    if (!summary.trim()) return
    mutation.mutate(
      { summary: summary.trim(), decisions: decisions.trim(), nextActions: nextActions.trim() },
      { onSuccess: () => { setSummary(''); setDecisions(''); setNextActions(''); onClose() } }
    )
  }

  return (
    <div className="mb-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-blue-700 flex items-center gap-1">
          <Users size={10} /> Meeting notes
        </span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={12} />
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-[10px] font-semibold text-blue-600 mb-1">Summary *</p>
          <textarea
            className="w-full text-xs rounded-lg border border-blue-100 bg-white p-2.5 resize-none outline-none focus:ring-1 focus:ring-blue-300 placeholder-gray-400"
            rows={3}
            placeholder="What was discussed? Key outcomes…"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-blue-600 mb-1">Decisions made</p>
          <textarea
            className="w-full text-xs rounded-lg border border-blue-100 bg-white p-2.5 resize-none outline-none focus:ring-1 focus:ring-blue-300 placeholder-gray-400"
            rows={2}
            placeholder="Any decisions reached…"
            value={decisions}
            onChange={(e) => setDecisions(e.target.value)}
          />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-blue-600 mb-1">Next actions</p>
          <textarea
            className="w-full text-xs rounded-lg border border-blue-100 bg-white p-2.5 resize-none outline-none focus:ring-1 focus:ring-blue-300 placeholder-gray-400"
            rows={2}
            placeholder="Agreed follow-up actions…"
            value={nextActions}
            onChange={(e) => setNextActions(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end mt-3">
        <button
          onClick={handleSubmit}
          disabled={!summary.trim() || mutation.isPending}
          className="text-xs font-semibold px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving…' : 'Save notes'}
        </button>
      </div>
    </div>
  )
}
