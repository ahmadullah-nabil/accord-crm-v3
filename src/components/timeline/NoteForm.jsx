// ─── NoteForm ─────────────────────────────────────────────────────────────────
//
// step062. The tinted-card era ends here. This was a yellow panel, the
// follow-up form was purple and the meeting note form was blue — three colours
// for three things that are all "type something into the timeline".
//
// The colour was not encoding anything. Nothing else in the app tells you a
// note is yellow; the timeline entry it produces is not yellow either. It was
// three separate authors each picking a highlight, and it is the last thing in
// the record panel that still looks like the pre-step033 app.
//
// Flat now: white, one hairline, the shared `input-base` and `btn-primary`.
// Same three files, one language.
//
// Enter-to-save (Ctrl/Cmd+Enter) is new — a note is one field and reaching for
// the mouse for a two-word note is the whole cost of writing it.

import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useAddNote } from '../../hooks/useTimeline.js'

export function NoteForm({ entityType, entityId, entityLabel, onClose }) {
  const [body, setBody]             = useState('')
  const [visibility, setVisibility] = useState('internal')
  const mutation = useAddNote(entityType, entityId, entityLabel)

  const handleSubmit = () => {
    if (!body.trim()) return
    mutation.mutate(
      { body: body.trim(), visibility },
      { onSuccess: () => { setBody(''); onClose() } },
    )
  }

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleSubmit() }
  }

  return (
    <div className="mb-3 bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wide text-gray-400">Add note</span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-0.5 rounded text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-120"
        >
          <X size={13} />
        </button>
      </div>

      <textarea
        className="input-base resize-none text-xs"
        rows={3}
        placeholder="Add an internal note…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        autoFocus
      />

      {mutation.isError && (
        <p className="text-[11px] text-red-500 mt-1.5">
          {mutation.error?.message || 'Could not save the note.'}
        </p>
      )}

      <div className="flex items-center gap-2 mt-2">
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          className="input-base text-xs w-auto py-1"
        >
          <option value="internal">Internal only</option>
          <option value="shared">Shared</option>
        </select>

        <button
          onClick={handleSubmit}
          disabled={!body.trim() || mutation.isPending}
          className="btn-primary text-xs ml-auto"
        >
          {mutation.isPending ? 'Saving…' : 'Save note'}
        </button>
      </div>
    </div>
  )
}

export default NoteForm
