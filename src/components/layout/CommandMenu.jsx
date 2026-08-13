// ─── Command Menu ─────────────────────────────────────────────────────────────
//
// step034. Ctrl/Cmd+K, or `/` from anywhere that is not a text field.
//
// WHAT IT RUNS ON
// ───────────────
// Nothing new. Records come from useGlobalSearch → searchService, which queries
// the five entities in parallel on the ordinary authenticated client, so RLS
// still does the filtering in Postgres exactly as it did in the navbar
// dropdown. No RPC, no service role, no schema change, no new route.
//
// WHAT IT DOES NOT DO YET
// ───────────────────────
// No "Create lead" / "Create contact" commands. Every create modal in this app
// is local component state inside its page — there is no store action a command
// could call, and inventing one here would mean editing six pages inside a
// layout batch. Create commands land with the module batches, when each page's
// modal is lifted into its store.
//
// DEEP LINKING
// ────────────
// Same mechanism GlobalSearch used, and for the same reason: this CRM has no
// /leads/:id routes. Opening a result sets the owning store's selected id and
// then navigates, so the destination page mounts with its detail panel already
// open.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Loader2, AlertCircle, CornerDownLeft,
  Target, Users, Briefcase, Calendar, CheckSquare,
  LayoutDashboard, BarChart2, Bell, Settings, UserCog,
} from 'lucide-react'
import { useUiStore }       from '../../stores/uiStore.js'
import { useGlobalSearch }  from '../../hooks/useGlobalSearch.js'
import { MIN_QUERY_LENGTH } from '../../services/searchService.js'
import { useLeadsStore }         from '../../stores/leadsStore.js'
import { useContactsStore }      from '../../stores/contactsStore.js'
import { useOpportunitiesStore } from '../../stores/opportunitiesStore.js'
import { useMeetingsStore }      from '../../stores/meetingsStore.js'
import { useTasksStore }         from '../../stores/tasksStore.js'

// type → icon, existing route, and the store that owns its detail panel.
const ENTITY_UI = {
  lead:        { icon: Target,      route: '/leads',         store: useLeadsStore },
  contact:     { icon: Users,       route: '/contacts',      store: useContactsStore },
  opportunity: { icon: Briefcase,   route: '/opportunities', store: useOpportunitiesStore },
  meeting:     { icon: Calendar,    route: '/meetings',      store: useMeetingsStore },
  task:        { icon: CheckSquare, route: '/tasks',         store: useTasksStore },
}

const NAV_COMMANDS = [
  { label: 'Dashboard',     to: '/dashboard',     icon: LayoutDashboard },
  { label: 'Leads',         to: '/leads',         icon: Target },
  { label: 'Contacts',      to: '/contacts',      icon: Users },
  { label: 'Opportunities', to: '/opportunities', icon: Briefcase },
  { label: 'Tasks',         to: '/tasks',         icon: CheckSquare },
  { label: 'Meetings',      to: '/meetings',      icon: Calendar },
  { label: 'Notifications', to: '/notifications', icon: Bell },
  { label: 'Analytics',     to: '/analytics',     icon: BarChart2 },
  { label: 'Members',       to: '/users',         icon: UserCog },
  { label: 'Settings',      to: '/settings',      icon: Settings },
]

export function CommandMenu() {
  const { commandMenuOpen, closeCommandMenu } = useUiStore()
  const navigate = useNavigate()

  const [term, setTerm]     = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)
  const listRef  = useRef(null)

  const { isTooShort, isSearching, groups, total, errors } = useGlobalSearch(term)

  // Navigation commands filter on the raw term, locally. They are ten strings —
  // routing them through the debounce that exists to protect Postgres would
  // make the app's own menu feel slower than its search.
  const navMatches = useMemo(() => {
    const q = term.trim().toLowerCase()
    if (!q) return NAV_COMMANDS
    return NAV_COMMANDS.filter((c) => c.label.toLowerCase().includes(q))
  }, [term])

  // One flat list is what ↑/↓ actually walks, in render order.
  const flat = useMemo(() => {
    const nav = navMatches.map((c) => ({ kind: 'nav', ...c }))
    const rec = groups.flatMap((g) =>
      g.items.map((item) => ({ kind: 'record', groupLabel: g.label, ...item })),
    )
    return [...nav, ...rec]
  }, [navMatches, groups])

  // Reset when the menu opens, not when it closes: clearing on close would
  // wipe the term while the exit is still painting.
  useEffect(() => {
    if (commandMenuOpen) {
      setTerm('')
      setCursor(0)
      // Focus after paint, or the input is not in the document yet.
      const id = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
    return undefined
  }, [commandMenuOpen])

  useEffect(() => { setCursor(0) }, [total, term])

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (!commandMenuOpen) return null

  const run = (entry) => {
    if (!entry) return
    if (entry.kind === 'nav') {
      navigate(entry.to)
      closeCommandMenu()
      return
    }
    const ui = ENTITY_UI[entry.type]
    if (!ui) return
    ui.store.getState().openDetail(entry.id)
    navigate(ui.route)
    closeCommandMenu()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeCommandMenu(); return }
    if (flat.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => (c + 1) % flat.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => (c - 1 + flat.length) % flat.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(flat[cursor])
    }
  }

  // Index into `flat` as the list renders, so the highlight and the keyboard
  // walk cannot disagree.
  let index = -1

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-gray-950/30"
      onMouseDown={closeCommandMenu}
      role="presentation"
    >
      <div
        className="w-full max-w-[560px] bg-white border border-gray-200 rounded-xl shadow-card-lg overflow-hidden animate-fade-in"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
      >
        {/* ── Input ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 h-11 border-b border-gray-100">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search records or jump to a page"
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400 focus-custom"
          />
          {isSearching && <Loader2 size={15} className="text-gray-400 animate-spin flex-shrink-0" />}
        </div>

        {/* ── Results ──────────────────────────────────────────────────── */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1">
          {navMatches.length > 0 && (
            <>
              <GroupLabel>Jump to</GroupLabel>
              {navMatches.map((c) => {
                index += 1
                return (
                  <Row
                    key={`nav-${c.to}`}
                    index={index}
                    active={index === cursor}
                    icon={c.icon}
                    title={c.label}
                    onSelect={() => run({ kind: 'nav', ...c })}
                    onHover={setCursor}
                  />
                )
              })}
            </>
          )}

          {groups.map((g) => (
            <React.Fragment key={g.type}>
              <GroupLabel>{g.label}</GroupLabel>
              {g.items.map((item) => {
                index += 1
                const Icon = ENTITY_UI[item.type]?.icon ?? Search
                return (
                  <Row
                    key={`${item.type}-${item.id}`}
                    index={index}
                    active={index === cursor}
                    icon={Icon}
                    title={item.title}
                    subtitle={item.subtitle}
                    meta={item.meta}
                    onSelect={() => run({ kind: 'record', ...item })}
                    onHover={setCursor}
                  />
                )
              })}
            </React.Fragment>
          ))}

          {/* Empty states say which case this is rather than one vague line. */}
          {!isSearching && isTooShort && navMatches.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-gray-400">
              Type at least {MIN_QUERY_LENGTH} characters to search records.
            </p>
          )}
          {!isSearching && !isTooShort && total === 0 && navMatches.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-gray-400">
              Nothing matches that.
            </p>
          )}

          {/* Partial failure is reported, never hidden. searchService uses
              allSettled precisely so one unreachable table still returns the
              rest — saying nothing here would turn that into silent data loss. */}
          {errors.length > 0 && (
            <div className="flex items-start gap-2 px-3 py-2 mt-1 border-t border-gray-100 text-xs text-gray-500">
              <AlertCircle size={13} className="text-gray-400 mt-px flex-shrink-0" />
              <span>Could not search: {errors.map((e) => e.entity || 'unknown').join(', ')}</span>
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-3 h-8 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
          <span className="flex items-center gap-1"><Kbd><CornerDownLeft size={9} /></Kbd> open</span>
          <span className="flex items-center gap-1"><Kbd>Esc</Kbd> close</span>
        </div>
      </div>
    </div>
  )
}

function GroupLabel({ children }) {
  return (
    <p className="px-3 pt-2 pb-1 text-[11px] font-medium text-gray-400 select-none">
      {children}
    </p>
  )
}

function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 border border-gray-200 rounded bg-white text-gray-500">
      {children}
    </kbd>
  )
}

function Row({ index, active, icon: Icon, title, subtitle, meta, onSelect, onHover }) {
  return (
    <button
      data-index={index}
      onClick={onSelect}
      onMouseMove={() => onHover(index)}
      className={`
        w-full flex items-center gap-2.5 px-3 py-1.5 text-left
        transition-colors duration-120 focus-custom
        ${active ? 'bg-gray-100' : ''}
      `}
    >
      <Icon size={15} className="text-gray-400 flex-shrink-0" />
      <span className="text-sm text-gray-900 truncate">{title}</span>
      {subtitle && (
        <span className="text-xs text-gray-400 truncate min-w-0">{subtitle}</span>
      )}
      {meta && (
        <span className="ml-auto text-xs text-gray-400 flex-shrink-0 pl-2">{meta}</span>
      )}
    </button>
  )
}

export default CommandMenu
