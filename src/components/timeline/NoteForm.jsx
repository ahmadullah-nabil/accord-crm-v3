import React, { useState } from 'react'
import { X, StickyNote } from 'lucide-react'
import { useAddNote } from '../../hooks/useTimeline.js'

export function NoteForm({ entityType, entityId, entityLabel, onClose }) {
  const [body, setBody]           = useState('')
  const [visibility, setVisibility] = useState('internal')
  const mutation = useAddNote(entityType, entityId, entityLabel)

  const handleSubmit = () => {
    if (!body.trim()) return
    mutation.mutate(
      { body: body.trim(), visibility },
      {
        onSuccess: () => {
          setBody('')
          onClose()
        },
      }
    )
  }

  return (
    <div className="mb-3 bg-yellow-50 border border-yellow-100 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-yellow-700 flex items-center gap-1">
          <StickyNote size={10} /> Add note
        </span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={12} />
        </button>
      </div>
      <textarea
        className="w-full text-xs rounded-lg border border-yellow-200 bg-white p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-300 placeholder-gray-400"
        rows={3}
        placeholder="Add an internal note…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        autoFocus
      />
      <div className="flex items-center justify-between mt-2">
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          className="text-[10px] text-gray-500 bg-transparent border-none outline-none cursor-pointer"
        >
          <option value="internal">Internal only</option>
          <option value="shared">Shared</option>
        </select>
        <button
          onClick={handleSubmit}
          disabled={!body.trim() || mutation.isPending}
          className="text-xs font-semibold px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving…' : 'Save note'}
        </button>
      </div>
    </div>
  )
}
