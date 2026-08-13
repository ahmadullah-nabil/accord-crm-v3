// ─── FacetChips ───────────────────────────────────────────────────────────────
//
// step036. The counts-that-are-also-filters row, as chips.
//
// WHAT IT REPLACES
// ────────────────
// A six-across grid of KPI cards, each ~72px tall with a shadow, a hover lift,
// an uppercase micro-label, a large display number and a percentage nobody
// acts on. Roughly 100px of vertical space to say "there are 2 contacts, 2 of
// them prospects" — on a screen whose job is showing rows.
//
// The information is kept. The furniture is not. Each chip is still a filter
// toggle, still reads the same store, still highlights when active.
//
// THE PERCENTAGES ARE GONE ON PURPOSE. "100%" under a count of 2 out of 2 is
// arithmetic, not insight, and it was the second line on every card.

import React from 'react'

/**
 * @param {Array<{key: string, label: string, count: number, dotClass?: string}>} items
 * @param {string}   value     currently selected key ('All' when nothing is filtered)
 * @param {Function} onChange  (key) => void — receives 'All' when a chip is toggled off
 */
export function FacetChips({ items, value, onChange }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {items.map((item) => {
        const active = value === item.key
        return (
          <button
            key={item.key}
            onClick={() => onChange(active && item.key !== 'All' ? 'All' : item.key)}
            className={`
              inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg border text-sm
              transition-colors duration-120
              ${active
                ? 'bg-teal-500/10 border-teal-500/40 text-teal-800 font-medium'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'
              }
            `}
          >
            {item.dotClass && (
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.dotClass}`} />
            )}
            {item.label}
            <span className={`tnum text-xs px-1 rounded
              ${active ? 'bg-teal-500/15 text-teal-800' : 'bg-gray-100 text-gray-500'}`}>
              {item.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default FacetChips
