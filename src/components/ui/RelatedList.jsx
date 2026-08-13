// ─── RelatedList / EmptyBlock ─────────────────────────────────────────────────
//
// step043. Lifted verbatim out of LeadRecordContent, where step042 defined them
// privately.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ WHY EXTRACT NOW RATHER THAN LATER                                       │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Every module's record surface renders the same two shapes: "a list of   │
// │ related things, with an add affordance, a loading skeleton and an empty │
// │ state", and "nothing here yet". Contacts is the SECOND module to need   │
// │ them. Opportunities, Tasks and Meetings are the third, fourth and fifth.│
// │                                                                          │
// │ Extracting at copy #1 is an import and a deletion. Extracting at copy   │
// │ #5 is a refactor across five modules that nobody schedules, so instead  │
// │ the empty-state padding gets fixed in one of them and quietly disagrees │
// │ with the other four. This is the cheapest moment it will ever be.       │
// └─────────────────────────────────────────────────────────────────────────┘
//
// The markup is UNCHANGED from step042. If a lead's Tasks tab looks different
// after this batch, that is a bug in the extraction and not a decision.

import React from 'react'
import { Plus } from 'lucide-react'

/**
 * @param {boolean}  isLoading
 * @param {Array}    items
 * @param {string}   emptyLabel
 * @param {Function} [onAdd]      omit (or pass null) to hide the add affordance
 * @param {string}   [addLabel]
 * @param {Function} renderItem   (item) => ReactNode — must set its own key
 */
export function RelatedList({ isLoading, items = [], emptyLabel, onAdd, addLabel, renderItem }) {
  return (
    <div className="space-y-2">
      {onAdd && (
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs font-medium text-teal-700
                     hover:text-teal-900 transition-colors duration-120"
        >
          <Plus size={12} /> {addLabel}
        </button>
      )}

      {isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-11 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyBlock label={emptyLabel} />
      ) : (
        <div className="space-y-1.5">{items.map(renderItem)}</div>
      )}
    </div>
  )
}

export function EmptyBlock({ label }) {
  return (
    <div className="px-3 py-6 text-center rounded-lg border border-dashed border-gray-200">
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  )
}

export default RelatedList
