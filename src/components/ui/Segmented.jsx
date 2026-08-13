// ─── Segmented ────────────────────────────────────────────────────────────────
//
// step044. Graduated out of LeadsToolbar, exactly as step041's note said it
// would: "It graduates when Opportunities needs the same Kanban toggle — one
// more caller is the point at which a shared component stops being a guess."
//
// Opportunities needs both of its callers — All/Mine and Kanban/Table — so this
// is that point. Markup is UNCHANGED from step041.
//
// WHAT THIS IS FOR
// ────────────────
// A small pill group of mutually exclusive choices that change WHICH ROWS or
// WHAT FRAME you are looking at. It belongs in ViewHeader's `leading` slot, on
// the left beside the count, because that is where the header already states
// what you are looking at. It is not an `action`: an action does something to
// the data, and these only change how you view it.
//
// Not a general tab bar. Three or four items is the practical ceiling before
// the group stops reading as a toggle and should become a filter select.

import React from 'react'

export function Segmented({ children }) {
  return (
    <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
      {children}
    </div>
  )
}

export function SegButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium
        transition-colors duration-120
        ${active
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-500 hover:text-gray-900'
        }`}
    >
      {children}
    </button>
  )
}

export default Segmented
