// ─── Global Search ────────────────────────────────────────────────────────────
//
// Universal search field + results dropdown for the Navbar. Replaces the
// previous non-functional <input>. Uses existing design tokens, existing routes
// and the existing per-entity Zustand stores — no new UI framework, no Navbar
// redesign, no new routes.
//
// DEEP LINKING
// ────────────
// This CRM has no /leads/:id style detail routes — each list page mounts a
// detail slide-over driven by its store's openDetail(id). Selecting a result
// therefore sets that store's selected id and navigates to the page the panel
// is mounted on, which is the app's existing deep-link mechanism rather than an
// invented one.
//
// KEYBOARD
// ────────
// The project had no shortcut system, so Cmd/Ctrl+K is introduced here and
// conflicts with nothing. ↑/↓ move, Enter opens, Esc closes.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Loader2, X, Target, Users, Briefcase, Calendar, CheckSquare, AlertCircle,
} from 'lucide-react'
import { useGlobalSearch } from '../../hooks/useGlobalSearch.js'
import { MIN_QUERY_LENGTH } from '../../services/searchService.js'
import { useLeadsStore }         from '../../stores/leadsStore.js'
import { useContactsStore }      from '../../stores/contactsStore.js'
import { useOpportunitiesStore } from '../../stores/opportunitiesStore.js'
import { useMeetingsStore }      from '../../stores/meetingsStore.js'
import { useTasksStore }         from '../../stores/tasksStore.js'

// type → icon, existing route, and the store that owns its detail panel
const ENTITY_UI = {
  lead:        { icon: Target,      route: '/leads',         store: useLeadsStore },
  contact:     { icon: Users,       route: '/contacts',      store: useContactsStore },
  opportunity: { icon: Briefcase,   route: '/opportunities', store: useOpportunitiesStore },
  meeting:     { icon: Calendar,    route: '/meetings',      store: useMeetingsStore },
  task:        { icon: CheckSquare, route: '/tasks',         store: useTasksStore },
}

export function GlobalSearch() {
  const navigate = useNavigate()
  const [term, setTerm]       = useState('')
  const [open, setOpen]       = useState(false)
  const [cursor, setCursor]   = useState(0)

  const wrapRef  = useRef(null)
  const inputRef = useRef(null)
  const listRef  = useRef(null)

  const { isTooShort, isSearching, groups, total, errors } = useGlobalSearch(term)

  // Flattened view of the grouped results — what ↑/↓ actually walks
  const flat = useMemo(
    () => groups.flatMap((g) => g.items.map((item) => ({ ...item, groupLabel: g.label }))),
    [groups],
  )

  // Reset the highlight whenever the result set changes
  useEffect(() => { setCursor(0) }, [total, term])

  // Close on outside click
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Cmd/Ctrl + K focuses search from anywhere
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Keep the highlighted row in view during keyboard navigation
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const close = () => {
    setOpen(false)
    inputRef.current?.blur()
  }

  const openResult = (result) => {
    const ui = ENTITY_UI[result.type]
    if (!ui) return

    // Set the selected record BEFORE navigating so the destination page's
    // detail panel is already open on first render.
    ui.store.getState().openDetail(result.id)
    navigate(ui.route)

    setTerm('')
    close()
  }

  /** "View all" — hand the term to the page's own existing search filter. */
  const viewAllIn = (type) => {
    const ui = ENTITY_UI[type]
    if (!ui) return
    ui.store.getState().setSearchQuery(term)
    navigate(ui.route)
    setTerm('')
    close()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape')          { close(); return }
    if (!open && e.key !== 'Tab')      setOpen(true)
    if (flat.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => (c + 1) % flat.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => (c - 1 + flat.length) % flat.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const picked = flat[cursor]
      if (picked) openResult(picked)
    }
  }

  const showDropdown = open

  return (
    <div ref={wrapRef} className="relative flex-1 max-w-xs hidden md:block">
      <Search
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="global-search-results"
        aria-label="Search the CRM"
        placeholder="Search leads, contacts…"
        className="input-base pl-9 pr-16 py-2 text-xs h-9 bg-gray-50 border-gray-100"
        value={term}
        onChange={(e) => { setTerm(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {/* Right-hand affordance: spinner while searching, clear when there is
          text, otherwise the keyboard hint. */}
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {isSearching && <Loader2 size={13} className="animate-spin text-gray-400" />}
        {!isSearching && term && (
          <button
            type="button"
            onClick={() => { setTerm(''); inputRef.current?.focus() }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Clear search"
          >
            <X size={13} />
          </button>
        )}
        {!term && (
          <kbd className="hidden lg:inline-block text-[10px] font-medium text-gray-400
                          bg-white border border-gray-200 rounded px-1.5 py-0.5 leading-none">
            ⌘K
          </kbd>
        )}
      </div>

      {showDropdown && (
        <div
          id="global-search-results"
          role="listbox"
          ref={listRef}
          className="absolute left-0 right-0 mt-2 card shadow-card-lg overflow-hidden
                     max-h-[70vh] overflow-y-auto z-50 min-w-[320px]"
        >
          {/* Before typing */}
          {isTooShort && !isSearching && (
            <div className="px-4 py-6 text-center">
              <Search size={20} className="mx-auto text-gray-300 mb-2" />
              <p className="text-xs text-gray-500">
                Search leads, contacts, opportunities, meetings and tasks
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Type at least {MIN_QUERY_LENGTH} characters
              </p>
            </div>
          )}

          {/* Loading */}
          {isSearching && (
            <div className="px-4 py-6 flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin text-gray-400" />
              <span className="text-xs text-gray-500">Searching…</span>
            </div>
          )}

          {/* No results */}
          {!isTooShort && !isSearching && total === 0 && errors.length === 0 && (
            <div className="px-4 py-6 text-center">
              <p className="text-xs font-medium text-gray-700">No results for “{term}”</p>
              <p className="text-[11px] text-gray-400 mt-1">
                Try a name, company, email or title
              </p>
            </div>
          )}

          {/* Results, grouped by entity */}
          {!isSearching && groups.map((group) => {
            const Icon = ENTITY_UI[group.type]?.icon ?? Search
            return (
              <div key={group.type} className="border-b border-gray-50 last:border-0">
                <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {group.label}
                  </span>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => viewAllIn(group.type)}
                    className="text-[10px] font-medium text-teal-600 hover:text-teal-700 transition-colors"
                  >
                    View all
                  </button>
                </div>

                {group.items.map((item) => {
                  const index    = flat.findIndex((f) => f.type === item.type && f.id === item.id)
                  const isActive = index === cursor
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-index={index}
                      onMouseEnter={() => setCursor(index)}
                      onMouseDown={(e) => e.preventDefault()}  // keep focus for Enter
                      onClick={() => openResult(item)}
                      className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors
                        ${isActive ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                    >
                      <Icon size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium text-gray-900 truncate">
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span className="block text-[11px] text-gray-500 truncate">
                            {item.subtitle}
                          </span>
                        )}
                      </span>
                      {item.meta && (
                        <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5 whitespace-nowrap">
                          {item.meta}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}

          {/* Partial failure — show what worked, name what did not */}
          {!isSearching && errors.length > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-gray-50 border-t border-gray-100">
              <AlertCircle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-gray-500">
                Could not search {errors.map((e) => e.label).join(', ')}. Other results are shown.
              </p>
            </div>
          )}

          {/* Keyboard hint */}
          {!isSearching && total > 0 && (
            <div className="flex items-center gap-3 px-3 py-1.5 border-t border-gray-50 bg-gray-50/50">
              <span className="text-[10px] text-gray-400">↑↓ navigate</span>
              <span className="text-[10px] text-gray-400">↵ open</span>
              <span className="text-[10px] text-gray-400">esc close</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default GlobalSearch
