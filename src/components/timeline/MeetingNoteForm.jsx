// ─── MeetingNoteForm ──────────────────────────────────────────────────────────
//
// step062. Blue tinted panel → flat white, matching NoteForm and FollowUpForm.
// See NoteForm's header for why the three colours went.
//
// The three field labels were `text-[10px] font-semibold text-blue-600`, a
// fourth label style in an app that already has `label-base`. They use it now,
// so the required marker on Summary looks like every other required marker.
//
// Mutation errors surface — the form read `isPending` and never `.error`.

import React, { useState } from 'react'
import { X } from 'lucide-react'
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
      { onSuccess: () => { setSummary(''); setDecisions(''); setNextActions(''); onClose() } },
    )
  }

  return (
    <div className="mb-3 bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] uppercase tracking-wide text-gray-400">Meeting notes</span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-0.5 rounded text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-120"
        >
          <X size={13} />
        </button>
      </div>

      <div className="space-y-2.5">
        <div>
          <label className="label-base">
            Summary<span className="text-red-400 ml-0.5">*</span>
          </label>
          <textarea
            className="input-base resize-none text-xs"
            rows={3}
            placeholder="What was discussed? Key outcomes…"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="label-base">Decisions made</label>
          <textarea
            className="input-base resize-none text-xs"
            rows={2}
            placeholder="Any decisions reached…"
            value={decisions}
            onChange={(e) => setDecisions(e.target.value)}
          />
        </div>

        <div>
          <label className="label-base">Next actions</label>
          <textarea
            className="input-base resize-none text-xs"
            rows={2}
            placeholder="Agreed follow-up actions…"
            value={nextActions}
            onChange={(e) => setNextActions(e.target.value)}
          />
        </div>
      </div>

      {mutation.isError && (
        <p className="text-[11px] text-red-500 mt-2">
          {mutation.error?.message || 'Could not save the meeting notes.'}
        </p>
      )}

      <div className="flex justify-end mt-3">
        <button
          onClick={handleSubmit}
          disabled={!summary.trim() || mutation.isPending}
          className="btn-primary text-xs"
        >
          {mutation.isPending ? 'Saving…' : 'Save notes'}
        </button>
      </div>
    </div>
  )
}

export default MeetingNoteForm
