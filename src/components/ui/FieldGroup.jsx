// ─── FieldGroup / RecordField ─────────────────────────────────────────────────
//
// step042. The collapsible field blocks on a record surface — General,
// Business, Contact, System — as seen in the reference UX.
//
// WHY COLLAPSIBLE AT ALL
// ──────────────────────
// A lead has ~14 fields and only three or four matter at any moment. The old
// panel showed every one, always, in a single scroll: to reach Meetings you
// scrolled past Tags and Notes whether or not you cared. Groups let the rarely
// useful ones (System: created date, record id) stay shut without being hidden,
// which is different from deleting them.
//
// COLLAPSE STATE IS LOCAL AND NOT PERSISTED. Deliberate for now: persisting it
// per user per object is a real preference needing a real store, and guessing
// at that shape before anyone has asked is how you end up migrating it twice.
// Groups open by default except where the caller says otherwise.
//
// EMPTY FIELDS RENDER AS PLACEHOLDER TEXT, NOT AS NOTHING. A field that
// vanishes when empty makes the form shift as data arrives, and — worse — hides
// the fact that it is fillable. The reference UI shows the field label in grey
// where the value is absent; so does this.

import React, { useState } from 'react'
import { ChevronUp } from 'lucide-react'

/**
 * @param {string}  title
 * @param {boolean} [defaultOpen=true]
 * @param {ReactNode} [action]  small control on the header row
 */
export function FieldGroup({ title, defaultOpen = true, action, children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div className="flex items-center justify-between gap-2 px-1 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1 text-xs font-semibold text-gray-500
                     hover:text-gray-900 transition-colors duration-120"
        >
          {title}
          <ChevronUp
            size={13}
            className={`text-gray-400 transition-transform duration-120
              ${open ? '' : 'rotate-180'}`}
          />
        </button>
        {action}
      </div>

      {open && <div className="pb-2 space-y-0.5">{children}</div>}
    </div>
  )
}

/**
 * One label/value row.
 *
 * @param {ReactNode} [children]  the rendered value; falls back to `placeholder`
 * @param {string}    [placeholder]  grey text shown when there is no value
 * @param {ReactNode} [action]  appears on row hover — the inline-edit affordance
 *                              slot. step042 leaves this unused for leads; see
 *                              the note in LeadRecordContent about why editing
 *                              is its own batch.
 */
export function RecordField({ label, icon: Icon, children, placeholder, action, mono }) {
  const empty = children === null || children === undefined || children === ''

  return (
    <div className="group flex items-start gap-2 px-1 py-1 rounded-md
                    hover:bg-gray-50 transition-colors duration-120">
      <span className="flex items-center gap-1.5 w-[112px] flex-shrink-0 pt-0.5
                       text-xs text-gray-500">
        {Icon && <Icon size={12} className="text-gray-400 flex-shrink-0" />}
        <span className="truncate">{label}</span>
      </span>

      <span className={`flex-1 min-w-0 text-sm break-words
        ${empty ? 'text-gray-300' : 'text-gray-900'} ${mono ? 'tnum' : ''}`}>
        {empty ? (placeholder ?? label) : children}
      </span>

      {action && (
        <span className="flex-shrink-0 opacity-0 group-hover:opacity-100
                         transition-opacity duration-120">
          {action}
        </span>
      )}
    </div>
  )
}

export default FieldGroup
