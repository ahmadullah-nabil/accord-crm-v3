// ─── ViewHeader ───────────────────────────────────────────────────────────────
//
// step036. The single row that sits above every table: which view you are
// looking at and how many rows are in it on the left, the controls that change
// that on the right.
//
// WHAT IT REPLACES
// ────────────────
// Each module had a `card` containing two stacked rows — a search field with
// action buttons, then a second row of filter selects. Two rows, a card border,
// a shadow and ~90px of vertical space before the data started. This is one
// row, no card, no shadow, sitting directly on the page.
//
// WHY THE SEARCH FIELD SHRANK
// ───────────────────────────
// It was `flex-1`, so it took every spare pixel and read as the most important
// control on the page. It is a filter, not the subject. Fixed width, right
// group, same behaviour.
//
// NOT HERE YET
// ────────────
// No "Sort" button — sorting is on the column headers, and a second way to do
// it that disagrees with the first is worse than one way. No "Options" until
// column show/hide is real, for the same reason DataTable's add-column "+"
// does not render.

import React from 'react'
import { Search, X, SlidersHorizontal } from 'lucide-react'

export function ViewHeader({
  title,                 // 'All contacts'
  count,                 // rows after filtering
  total,                 // rows before filtering — shown only when they differ
  search,                // { value, onChange, placeholder }
  filters = [],          // [{ label, value, onChange, options: string[] }]
  onClearFilters,        // shown only when hasFilters is true
  hasFilters = false,
  actions,               // ReactNode — Import / Export / primary button
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap py-1">
      {/* ── Left: what you are looking at ─────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-sm font-medium text-gray-900">{title}</span>
        <span className="text-sm text-gray-400 tnum">
          · {count}
          {total !== undefined && total !== count && (
            <span className="text-gray-300"> of {total}</span>
          )}
        </span>
      </div>

      {/* ── Right: what changes it ────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-wrap ml-auto">
        {search && (
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder || 'Search'}
              className="w-[200px] pl-7 pr-6 py-1 bg-white border border-gray-200 rounded-lg text-sm
                         text-gray-900 placeholder-gray-400 outline-none
                         transition-colors duration-120 focus:border-teal-500"
            />
            {search.value && (
              <button
                onClick={() => search.onChange('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {filters.length > 0 && (
          <>
            <SlidersHorizontal size={13} className="text-gray-400 flex-shrink-0 ml-0.5" />
            {filters.map((f) => (
              <FilterSelect key={f.label} {...f} />
            ))}
          </>
        )}

        {hasFilters && onClearFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1 px-1.5 py-1 text-xs font-medium text-gray-500
                       hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors duration-120"
          >
            <X size={11} /> Clear
          </button>
        )}

        {actions && <div className="flex items-center gap-1.5 ml-1">{actions}</div>}
      </div>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  const set = value !== 'All'
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={`text-sm rounded-lg px-1.5 py-1 border outline-none cursor-pointer
        transition-colors duration-120
        ${set
          ? 'bg-teal-500/10 border-teal-500/40 text-teal-700 font-medium'
          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
        }`}
    >
      <option value="All">{label}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

export default ViewHeader
