// ─── SettingsShared ───────────────────────────────────────────────────────────
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ step063 — THE CARD COMES OFF EVERY SETTINGS SECTION                     │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Seven section files import from here, so this file is the whole visual  │
// │ surface of Settings. Change `SettingCard` and all seven change at once, │
// │ with no edits to any of them.                                            │
// │                                                                          │
// │ THE SHAPE. Settings was cards inside a pane inside a page: three nested │
// │ boxes to say "here is a heading and some fields". The reference layout   │
// │ has no card at all — a 15px heading, a muted line under it, the control, │
// │ and whitespace between blocks. Whitespace groups as well as a border     │
// │ does and costs nothing, and dropping the border means the content column │
// │ finally lines up with the breadcrumb above it.                           │
// │                                                                          │
// │ `SettingCard` KEEPS ITS NAME even though it is no longer a card. Seven   │
// │ files import that identifier; renaming it is a rename batch, not a       │
// │ styling one, and mixing the two is how a styling change breaks a page.   │
// │ `SettingsBlock` is exported as the name to use going forward and         │
// │ `SettingCard` is an alias of it.                                         │
// │                                                                          │
// │ TWO NEW PRIMITIVES, both taken from the reference screens:               │
// │   ChoiceCard — a large preview tile with a check badge (theme pickers)   │
// │   RadioRow   — labelled radio rows sharing one bordered container        │
// │                                                                          │
// │ EVERYTHING ELSE HERE IS FLATTENED, NOT REWRITTEN. rounded-xl → rounded-  │
// │ md, `card` → hairline, the bold-16px headings → 15px medium. The props,  │
// │ the SaveBar state machine and the RLS error message are unchanged.       │
// │                                                                          │
// │ DARK MODE. Nothing in this file carries a `dark:` variant and nothing    │
// │ should. step063 routed red/amber/emerald/blue/purple/orange through CSS  │
// │ variables in tailwind.config.js and inverted them in index.css, so       │
// │ `DangerCard`'s `bg-red-50 text-red-700` is a deep red block with light   │
// │ text in dark mode and identical to before in light mode.                 │
// └─────────────────────────────────────────────────────────────────────────┘

import React from 'react'
import { Check, Loader2, AlertCircle, Info } from 'lucide-react'

// ── Section block ─────────────────────────────────────────────────────────────
export function SettingsBlock({ title, description, children, action, className = '' }) {
  return (
    <section className={`pb-7 ${className}`}>
      {(title || description) && (
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && (
              <h3 className="font-display font-medium text-gray-900 text-[15px] leading-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

/** Kept so the seven section files do not have to change in a styling batch.
 *  Prefer `SettingsBlock` in new code. */
export const SettingCard = SettingsBlock

// ── Stored-preference notice ──────────────────────────────────────────────────
// Used where a control is saved but NOT enforced by the backend. Being explicit
// beats implying a security control exists when it does not.
export function StoredPreferenceNote({ children }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-gray-50 border border-gray-200 px-3 py-2 mb-3">
      <Info size={13} className="text-gray-400 mt-0.5 shrink-0" />
      <p className="text-[11px] text-gray-500 leading-relaxed">{children}</p>
    </div>
  )
}

// ── Two-column form grid ──────────────────────────────────────────────────────
export function FieldGrid({ children, cols = 2 }) {
  const gridClass = cols === 1 ? 'space-y-3' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'
  return <div className={gridClass}>{children}</div>
}

// ── Field wrapper (label + input slot + optional hint) ────────────────────────
export function Field({ label, hint, error, required, children }) {
  const child = React.Children.only(children)

  return (
    <div>
      <label className="label-base">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {React.cloneElement(child, {
        className: [
          child.props.className || 'input-base',
          error ? 'border-red-300 focus:border-red-400' : '',
        ].filter(Boolean).join(' '),
      })}
      {hint  && !error && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[18px] w-8 items-center rounded-full shrink-0
        transition-colors duration-150
        ${checked ? 'bg-teal-500' : 'bg-gray-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-150
          ${checked ? 'translate-x-[17px]' : 'translate-x-[3px]'}`}
      />
    </button>
  )
}

// ── Grouped container ─────────────────────────────────────────────────────────
// One hairline box around a run of rows, instead of a border per row floating
// on the page. ToggleRow / RadioRow / InfoRow are all designed to sit in one.
export function SettingsGroup({ children, className = '' }) {
  return (
    <div className={`border border-gray-200 rounded-md divide-y divide-gray-100 ${className}`}>
      {children}
    </div>
  )
}

// ── Toggle row (label + description + toggle) ─────────────────────────────────
export function ToggleRow({ label, description, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] text-gray-900">{label}</p>
        {description && <p className="text-[11px] text-gray-500 mt-0.5">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

// ── Radio row ─────────────────────────────────────────────────────────────────
// The reference's "Side panel / Full page" pattern: an optional glyph, a label
// and a description on the left, the radio on the right, rows sharing one box.
export function RadioRow({ label, description, icon: Icon, checked, onChange, disabled }) {
  return (
    <label
      className={`flex items-center gap-3 px-3 py-2.5 transition-colors duration-120
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}
    >
      {Icon && (
        <span className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center shrink-0">
          <Icon size={14} className="text-gray-500" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-gray-900">{label}</span>
        {description && (
          <span className="block text-[11px] text-gray-500 mt-0.5">{description}</span>
        )}
      </span>
      <input
        type="radio"
        checked={checked}
        onChange={() => onChange?.()}
        disabled={disabled}
        className="shrink-0"
      />
    </label>
  )
}

// ── Choice card ───────────────────────────────────────────────────────────────
// A large preview tile with its label underneath and a check badge when
// selected — the theme picker shape. `preview` is whatever should be rendered
// inside the tile, so the caller owns what the preview actually looks like.
export function ChoiceCard({ label, selected, onClick, preview, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-2 text-left group ${className}`}
    >
      <span
        className={`relative block rounded-md overflow-hidden border transition-colors duration-150
          ${selected ? 'border-teal-500' : 'border-gray-200 group-hover:border-gray-300'}`}
      >
        {preview}
        {selected && (
          <span className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full bg-teal-500
                           flex items-center justify-center">
            <Check size={10} strokeWidth={3} className="text-white" />
          </span>
        )}
      </span>
      <span className={`text-xs ${selected ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
        {label}
      </span>
    </button>
  )
}

// ── Info row (read-only label + value) ────────────────────────────────────────
export function InfoRow({ label, value, badge }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <span className="text-[13px] text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        {badge && (
          <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${badge.className}`}>
            {badge.label}
          </span>
        )}
        <span className="text-[13px] text-gray-900">{value}</span>
      </div>
    </div>
  )
}

// ── Save / Cancel action bar ──────────────────────────────────────────────────
//
// One bar, four states, always visible so the controls never jump around:
//   clean    → status "All changes saved", Save disabled
//   dirty    → status "Unsaved changes", Save enabled
//   saving   → spinner, both buttons disabled
//   saved    → confirmation for 2.5s, then back to clean
//   error    → red message with the real reason; the form stays dirty so the
//              user can retry or cancel. A failed save is never silent.
//
// The state machine is untouched by step063 — only the chrome around it.
export function SaveBar({ onSave, onCancel, isPending, isDirty, savedText = 'Changes saved' }) {
  const [status, setStatus] = React.useState('idle') // 'idle' | 'saved' | 'error'
  const [errorMsg, setErrorMsg] = React.useState('')
  const timerRef = React.useRef(null)

  React.useEffect(() => () => clearTimeout(timerRef.current), [])

  // Editing again clears a stale confirmation or error
  React.useEffect(() => {
    if (isDirty && status !== 'idle') setStatus('idle')
  }, [isDirty]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setStatus('idle')
    setErrorMsg('')
    try {
      await onSave()
      setStatus('saved')
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setStatus('idle'), 2500)
    } catch (err) {
      setStatus('error')
      setErrorMsg(
        err?.message?.includes('row-level security') || err?.code === '42501'
          ? 'You do not have permission to change this.'
          : err?.message || 'Could not save. Please try again.',
      )
    }
  }

  const handleCancel = () => {
    setStatus('idle')
    setErrorMsg('')
    onCancel()
  }

  return (
    <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
      <div className="min-w-0 flex-1">
        {status === 'saved' && (
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-600">
            <Check size={12} /> {savedText}
          </span>
        )}
        {status === 'error' && (
          <span className="flex items-start gap-1.5 text-[11px] text-red-500">
            <AlertCircle size={12} className="mt-px shrink-0" /> {errorMsg}
          </span>
        )}
        {status === 'idle' && (
          <span className="text-[11px] text-gray-400">
            {isPending ? 'Saving…' : isDirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleCancel}
          className="btn-secondary text-sm"
          disabled={isPending || !isDirty}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="btn-primary text-sm min-w-[104px]"
          disabled={isPending || !isDirty}
        >
          {isPending ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

// ── Section divider ───────────────────────────────────────────────────────────
export function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-2.5 mt-5 mb-3">
      <span className="text-[10px] uppercase tracking-wide text-gray-400 shrink-0">
        {label}
      </span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

// ── Danger zone ───────────────────────────────────────────────────────────────
// No tinted panel. The reference states the heading, the consequence and one
// red outline button — the colour belongs on the ACTION, not on a block of
// background behind an explanation.
export function DangerCard({ title, description, buttonLabel, onAction, isPending }) {
  return (
    <div>
      <p className="font-display font-medium text-gray-900 text-[15px] leading-tight">{title}</p>
      {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
      <button
        type="button"
        onClick={onAction}
        disabled={isPending}
        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                   text-sm font-medium text-red-600 bg-white border border-red-200
                   hover:bg-red-50 hover:border-red-300 transition-colors duration-120
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? <Loader2 size={13} className="animate-spin" /> : null}
        {buttonLabel}
      </button>
    </div>
  )
}
