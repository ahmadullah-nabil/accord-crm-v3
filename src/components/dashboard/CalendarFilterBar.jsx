// ─── CalendarFilterBar ────────────────────────────────────────────────────────
//
// Type / status / user filters for the Dashboard's activity calendar.
//
// Purely presentational and fully controlled: every value comes down as a prop
// and every change goes back up. The state lives in the URL (useCalendarFilters)
// and the filtering itself happens in memory (calendarActivityService), so this
// component owns neither — it only renders what is selected and reports clicks.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ WHY THE COUNTS SAY "SHOWING n OF m"                                     │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ The legend deliberately counts the WHOLE month, before filters, so the  │
// │ numbers stay a fixed reference instead of shifting as the view narrows. │
// │ That is right, but it leaves a filtered calendar showing "Pending 14"   │
// │ above four visible chips. This line closes that gap: the legend says    │
// │ what the month holds, this says how much of it survived the filter.     │
// └─────────────────────────────────────────────────────────────────────────┘

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { SlidersHorizontal, Check, ChevronDown, Search, X, User } from 'lucide-react'

import { CALENDAR_TYPES, CALENDAR_STATUSES } from '../../services/calendarActivityService.js'
import { STATUS_STYLE, STATUS_LABEL, TYPE_ICON } from '../../lib/calendarStyles.js'

/** A filter button plus its panel. Closes on outside click and on Escape —
 *  Escape matters because these sit above a grid whose cells are themselves
 *  buttons, so an open panel swallows the click you meant for a date.
 *
 *  Exported because LeadOverview sits on the same tab and needs an identical
 *  control; two hand-rolled popovers side by side drift apart within a session.
 *  If a THIRD surface wants it, that is the moment to move it to a shared
 *  components/ui/ file — the same rule that moved STATUS_STYLE into
 *  lib/calendarStyles.js. Until then it lives with its first user. */
export function FilterPopover({ label, summary, active, children, widthClass = 'w-52' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey  = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5
                    border outline-none transition-all duration-150
                    ${active
                      ? 'bg-teal-50 border-teal-300 text-teal-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
      >
        {label}
        {summary && <span className="text-gray-400">·</span>}
        {summary && <span className="max-w-[130px] truncate">{summary}</span>}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute z-30 left-0 top-9 ${widthClass} rounded-xl border border-gray-100
                      bg-white shadow-card-lg py-1 animate-fade-in`}
        >
          {children}
        </div>
      )}
    </div>
  )
}

function CheckRow({ checked, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitemcheckbox"
      aria-checked={checked}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left
                 text-gray-700 hover:bg-gray-50"
    >
      <span
        className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0
                    ${checked ? 'bg-teal-500 border-teal-500' : 'border-gray-300 bg-white'}`}
      >
        {checked && <Check size={10} className="text-white" strokeWidth={3} />}
      </span>
      {children}
    </button>
  )
}

export function CalendarFilterBar({
  filters      = { types: [], statuses: [], owner: 'all' },
  owners       = [],
  activeCount  = 0,
  shownCount   = 0,
  totalCount   = 0,
  onToggleType = () => {},
  onToggleStatus = () => {},
  onSetOwner   = () => {},
  onClear      = () => {},
}) {
  const [ownerQuery, setOwnerQuery] = useState('')

  // Read defensively rather than destructuring: a caller can legitimately pass
  // a partial object (ActivityCalendar's own default is `{}`), and a default
  // parameter only covers a MISSING prop, not a present one with missing keys.
  const types    = filters.types    ?? []
  const statuses = filters.statuses ?? []
  const owner    = filters.owner    ?? 'all'

  const ownerOptions = useMemo(() => {
    const q = ownerQuery.trim().toLowerCase()
    return q ? owners.filter((o) => o.toLowerCase().includes(q)) : owners
  }, [owners, ownerQuery])

  // A name can be selected and yet absent from this month's list — page back a
  // month and the person simply has nothing scheduled. Dropping the option
  // would make the filter look cleared while it is still narrowing the view, so
  // it is kept and labelled instead.
  const selectedOwnerMissing = owner !== 'all' && !owners.includes(owner)

  const typeSummary =
    types.length === 0 ? '' : types.length === 1 ? types[0] : `${types.length} selected`
  const statusSummary =
    statuses.length === 0 ? '' :
    statuses.length === 1 ? STATUS_LABEL[statuses[0]] : `${statuses.length} selected`

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <SlidersHorizontal size={13} className="text-gray-400 shrink-0" />

      {/* ── Type ──────────────────────────────────────────────────────────── */}
      <FilterPopover label="Type" summary={typeSummary} active={types.length > 0}>
        {CALENDAR_TYPES.map((t) => {
          const Icon = TYPE_ICON[t] ?? User
          return (
            <CheckRow key={t} checked={types.includes(t)} onClick={() => onToggleType(t)}>
              <Icon size={12} className="text-gray-400 shrink-0" />
              {t}
            </CheckRow>
          )
        })}
      </FilterPopover>

      {/* ── Status ────────────────────────────────────────────────────────── */}
      <FilterPopover label="Status" summary={statusSummary} active={statuses.length > 0}>
        {CALENDAR_STATUSES.map((s) => (
          <CheckRow key={s} checked={statuses.includes(s)} onClick={() => onToggleStatus(s)}>
            {/* Same dot as the legend and the same colour as the chip, so the
                filter, the count and the item on the grid are visibly one thing. */}
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_STYLE[s].dot}`} />
            {STATUS_LABEL[s]}
          </CheckRow>
        ))}
      </FilterPopover>

      {/* ── User ──────────────────────────────────────────────────────────────
          Single-select, and by NAME. Tasks store an assignee name and have no
          user id; meetings have organizer_id. Filtering the two differently
          would silently drop every task from a per-user view. */}
      <FilterPopover
        label="User"
        summary={owner === 'all' ? '' : owner}
        active={owner !== 'all'}
        widthClass="w-60"
      >
        <div className="px-2 pt-1 pb-2">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              autoFocus
              value={ownerQuery}
              onChange={(e) => setOwnerQuery(e.target.value)}
              placeholder="Search people…"
              className="input-base pl-7 pr-2 py-1.5 text-xs rounded-lg"
            />
          </div>
        </div>

        <div className="max-h-56 overflow-y-auto">
          <button
            type="button"
            onClick={() => { onSetOwner('all'); setOwnerQuery('') }}
            className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50
                        ${owner === 'all' ? 'text-teal-700 font-medium' : 'text-gray-700'}`}
          >
            Everyone
          </button>

          {selectedOwnerMissing && (
            <button
              type="button"
              onClick={() => { onSetOwner('all'); setOwnerQuery('') }}
              className="w-full px-3 py-1.5 text-xs text-left text-teal-700 font-medium
                         hover:bg-gray-50 flex items-center justify-between gap-2"
            >
              <span className="truncate">{owner}</span>
              <span className="text-[10px] text-gray-400 shrink-0">nothing this month</span>
            </button>
          )}

          {/* Options come from the items actually loaded for this month, so the
              list never offers a name that would return an empty calendar. */}
          {ownerOptions.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => { onSetOwner(o); setOwnerQuery('') }}
              className={`w-full px-3 py-1.5 text-xs text-left truncate hover:bg-gray-50
                          ${owner === o ? 'text-teal-700 font-medium' : 'text-gray-700'}`}
            >
              {o}
            </button>
          ))}

          {ownerOptions.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-gray-400">
              {owners.length === 0
                ? 'Nobody has anything scheduled this month.'
                : 'No match.'}
            </p>
          )}
        </div>
      </FilterPopover>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium ml-1"
        >
          <X size={11} /> Clear
        </button>
      )}

      {activeCount > 0 && (
        <span className="text-[11px] text-gray-400 ml-auto tabular-nums">
          Showing {shownCount} of {totalCount}
        </span>
      )}
    </div>
  )
}

export default CalendarFilterBar
