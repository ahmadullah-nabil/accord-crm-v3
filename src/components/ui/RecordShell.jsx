// ─── RecordShell ──────────────────────────────────────────────────────────────
//
// step042. The tabbed record surface, in two layouts, from ONE component.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ WHY PANEL AND PAGE ARE THE SAME COMPONENT                               │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ The reference UX shows a record twice: as a right-hand panel over the   │
// │ list, and as a full page at its own URL. Those are the same record with │
// │ the same tabs and the same field groups — only the frame differs.       │
// │                                                                          │
// │ Building them as two components means every future field, tab or        │
// │ permission gate has to be added twice, and the day someone adds it once │
// │ the two surfaces disagree. Nobody notices, because you rarely open both │
// │ in the same minute. So `variant` picks the frame and everything inside  │
// │ is shared by construction rather than by two files agreeing.            │
// └─────────────────────────────────────────────────────────────────────────┘
//
// TABS ARE DRIVEN BY DATA, NOT HARDCODED
// ──────────────────────────────────────
// `tabs` is [{ key, label, icon, count, render }]. A caller omits a tab it has
// no table for rather than shipping one that is permanently empty — Notes has
// no backing table in this schema, so no module passes it. `count` renders as a
// badge when it is a number, including zero: "Tasks 0" is information, whereas
// a bare "Tasks" that turns out empty on click is a wasted click.
//
// Overflow follows the reference: the first N tabs are visible and the rest go
// behind a "+n More" menu. The active tab is ALWAYS visible even when it would
// have overflowed, because a tab bar that hides the thing you are looking at is
// worse than one that reorders.
//
// RECORD NAVIGATION
// ─────────────────
// `nav` is { index, total, onPrev, onNext } and walks the CALLER'S CURRENTLY
// FILTERED LIST, not the whole table. "3 of 7" has to agree with the seven rows
// behind the panel, or the arrows walk into records the user filtered out.

import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  X, ChevronUp, ChevronDown, ChevronDown as Caret,
  Maximize2, ArrowLeft,
} from 'lucide-react'

const VISIBLE_TABS = 4

export function RecordShell({
  variant = 'panel',        // 'panel' | 'page'
  open = true,              // panel only — drives the slide transition
  onClose,                  // panel only
  onExpand,                 // panel only — go to the full record page
  onBack,                   // page only — return to the list

  breadcrumb,               // page only — e.g. 'Leads'
  avatar,                   // ReactNode
  title,
  subtitle,                 // ReactNode
  badges,                   // ReactNode — stage / priority pills
  actions,                  // ReactNode — Email / Convert / Edit / Delete
  nav,                      // { index, total, onPrev, onNext }

  fields,                   // ReactNode — FieldGroup stack
  tabs = [],                // [{ key, label, icon, count, render }]
  isLoading = false,
  children,                 // rendered under the field stack, above the tabs
}) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key)
  const [overflowOpen, setOverflowOpen] = useState(false)

  // A tab can disappear between renders — a permission change, or a caller that
  // drops Emails when no mailbox is connected. Falling back to the first tab
  // stops the body going blank with no way back.
  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0]

  const { visible, overflow } = useMemo(() => {
    if (tabs.length <= VISIBLE_TABS) return { visible: tabs, overflow: [] }
    const head = tabs.slice(0, VISIBLE_TABS)
    const tail = tabs.slice(VISIBLE_TABS)
    // Keep the active tab on screen by swapping it into the last visible slot.
    if (active && tail.some((t) => t.key === active.key)) {
      return {
        visible: [...head.slice(0, VISIBLE_TABS - 1), active],
        overflow: tabs.filter((t) => t.key !== active.key).slice(VISIBLE_TABS - 1),
      }
    }
    return { visible: head, overflow: tail }
  }, [tabs, active])

  const isPage = variant === 'page'

  const body = (
    <>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 px-4 py-3
                      border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {isPage && onBack && (
            <button
              onClick={onBack}
              className="p-1.5 -ml-1 rounded-md text-gray-400 hover:text-gray-900
                         hover:bg-gray-100 transition-colors duration-120"
              title="Back to list"
            >
              <ArrowLeft size={15} />
            </button>
          )}
          {avatar}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              {isPage && breadcrumb && (
                <span className="text-sm text-gray-400 flex-shrink-0">
                  {breadcrumb} /
                </span>
              )}
              <h3 className="font-display font-semibold text-gray-900 text-base
                             leading-tight truncate">
                {title}
              </h3>
              {nav && nav.total > 1 && (
                <span className="text-xs text-gray-400 tnum flex-shrink-0">
                  ({nav.index + 1}/{nav.total})
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {actions}

          {nav && nav.total > 1 && (
            <>
              <IconBtn onClick={nav.onPrev} title="Previous record" disabled={nav.index <= 0}>
                <ChevronUp size={15} />
              </IconBtn>
              <IconBtn onClick={nav.onNext} title="Next record" disabled={nav.index >= nav.total - 1}>
                <ChevronDown size={15} />
              </IconBtn>
            </>
          )}

          {!isPage && onExpand && (
            <IconBtn onClick={onExpand} title="Open full record">
              <Maximize2 size={14} />
            </IconBtn>
          )}
          {!isPage && onClose && (
            <IconBtn onClick={onClose} title="Close">
              <X size={15} />
            </IconBtn>
          )}
        </div>
      </div>

      {/* ── Badges ──────────────────────────────────────────────────────── */}
      {badges && (
        <div className="px-4 py-2.5 border-b border-gray-100 flex-shrink-0">
          {badges}
        </div>
      )}

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      {tabs.length > 0 && (
        <div className="flex items-center gap-0.5 px-3 border-b border-gray-100
                        flex-shrink-0 relative">
          {visible.map((t) => (
            <TabButton
              key={t.key}
              tab={t}
              active={active?.key === t.key}
              onClick={() => setActiveKey(t.key)}
            />
          ))}

          {overflow.length > 0 && (
            <OverflowMenu
              items={overflow}
              open={overflowOpen}
              setOpen={setOverflowOpen}
              onPick={(key) => { setActiveKey(key); setOverflowOpen(false) }}
            />
          )}
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex-1 p-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-100 rounded animate-pulse"
                 style={{ width: `${60 + (i % 3) * 12}%` }} />
          ))}
        </div>
      ) : isPage ? (
        // Page: fields in a left rail, tab body beside it. Same content, more
        // room — which is the only reason to open the page at all.
        <div className="flex-1 min-h-0 flex">
          <div className="w-[340px] flex-shrink-0 border-r border-gray-100
                          overflow-y-auto px-4 py-2">
            {fields}
            {children}
          </div>
          <div className="flex-1 min-w-0 overflow-y-auto p-4">
            {active?.render?.()}
          </div>
        </div>
      ) : (
        // Panel: one scroll — fields, then the active tab.
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {fields}
          {children}
          <div className="pt-3">{active?.render?.()}</div>
        </div>
      )}
    </>
  )

  if (isPage) {
    return (
      <div className="flex flex-col h-[calc(100vh-96px)] bg-white
                      border border-gray-200 rounded-xl overflow-hidden">
        {body}
      </div>
    )
  }

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/20 z-30" onClick={onClose} />}
      <div
        className={`fixed inset-y-0 right-0 z-40 w-[440px] max-w-full bg-white
                    shadow-card-lg flex flex-col
                    transition-transform duration-200 ease-out
                    ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {open && body}
      </div>
    </>
  )
}

function IconBtn({ onClick, title, disabled, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="p-1.5 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100
                 transition-colors duration-120
                 disabled:opacity-30 disabled:hover:bg-transparent
                 disabled:hover:text-gray-400"
    >
      {children}
    </button>
  )
}

function TabButton({ tab, active, onClick }) {
  const { label, icon: Icon, count } = tab
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-2 text-sm border-b-2 -mb-px
                  transition-colors duration-120
        ${active
          ? 'border-teal-500 text-gray-900 font-medium'
          : 'border-transparent text-gray-500 hover:text-gray-900'
        }`}
    >
      {Icon && <Icon size={13} className={active ? 'text-teal-600' : 'text-gray-400'} />}
      {label}
      {typeof count === 'number' && (
        <span className={`tnum text-xs px-1 rounded
          ${active ? 'bg-teal-500/15 text-teal-800' : 'bg-gray-100 text-gray-500'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

function OverflowMenu({ items, open, setOpen, onPick }) {
  const ref = useRef(null)

  // Close on any outside click. Capture phase, so a click on another control
  // closes this AND operates that control — a menu that swallows the first
  // click outside itself reads as unresponsive.
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [open, setOpen])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-2 text-sm text-gray-500
                   hover:text-gray-900 transition-colors duration-120"
      >
        +{items.length} More
        <Caret size={12} className="text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-0.5 min-w-[170px]
                        bg-white rounded-lg shadow-card-lg border border-gray-100 py-1">
          {items.map((t) => (
            <button
              key={t.key}
              onClick={() => onPick(t.key)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm
                         text-gray-700 hover:bg-gray-50 transition-colors duration-120"
            >
              {t.icon && <t.icon size={13} className="text-gray-400" />}
              <span className="flex-1 text-left">{t.label}</span>
              {typeof t.count === 'number' && (
                <span className="tnum text-xs text-gray-400">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default RecordShell
