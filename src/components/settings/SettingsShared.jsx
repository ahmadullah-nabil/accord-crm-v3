import React from 'react'
import { Check, Loader2, AlertCircle, Info } from 'lucide-react'

// ── Section card wrapper ──────────────────────────────────────────────────────
export function SettingCard({ title, description, children, action, className = '' }) {
  return (
    <div className={`card p-5 sm:p-6 ${className}`}>
      {(title || description) && (
        <div className="mb-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && (
              <h3 className="font-display font-bold text-gray-900 text-base leading-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

// ── Stored-preference notice ──────────────────────────────────────────────────
// Used where a control is saved but NOT enforced by the backend. Being explicit
// beats implying a security control exists when it does not.
export function StoredPreferenceNote({ children }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 mb-4">
      <Info size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
      <p className="text-[11px] text-gray-500 leading-relaxed">{children}</p>
    </div>
  )
}

// ── Two-column form grid ──────────────────────────────────────────────────────
export function FieldGrid({ children, cols = 2 }) {
  const gridClass = cols === 1 ? '' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'
  return <div className={gridClass}>{children}</div>
}

// ── Field wrapper (label + input slot + optional hint) ────────────────────────
export function Field({ label, hint, error, required, children }) {
  const child     = React.Children.only(children)
  const isTextarea = child.type === 'textarea'

  return (
    <div>
      <label className="label-base">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {React.cloneElement(child, {
        className: [
          child.props.className || 'input-base',
          error ? 'border-red-300 focus:border-red-400 focus:ring-red-400/20' : '',
        ].filter(Boolean).join(' '),
      })}
      {hint  && !error && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
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
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 flex-shrink-0
        focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-1
        ${checked ? 'bg-teal-500' : 'bg-gray-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200
          ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
      />
    </button>
  )
}

// ── Toggle row (label + description + toggle) ─────────────────────────────────
export function ToggleRow({ label, description, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

// ── Info row (read-only label + value) ────────────────────────────────────────
export function InfoRow({ label, value, badge }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        {badge && (
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badge.className}`}>
            {badge.label}
          </span>
        )}
        <span className="text-sm font-medium text-gray-900">{value}</span>
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
//   saved    → green confirmation for 2.5s, then back to clean
//   error    → red message with the real reason; the form stays dirty so the
//              user can retry or cancel. A failed save is never silent.
//
// The previous version rendered nothing when clean, awaited onSave() without a
// catch (so a rejected save still showed "Changes saved"), and left the Save
// button enabled with nothing to save.
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
    <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-gray-100 flex-wrap">
      <div className="min-w-0 flex-1">
        {status === 'saved' && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <Check size={13} /> {savedText}
          </span>
        )}
        {status === 'error' && (
          <span className="flex items-start gap-1.5 text-xs text-red-500 font-medium">
            <AlertCircle size={13} className="mt-px flex-shrink-0" /> {errorMsg}
          </span>
        )}
        {status === 'idle' && (
          <span className="text-xs text-gray-400">
            {isPending ? 'Saving…' : isDirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={handleCancel}
          className="btn-secondary py-2 text-sm"
          disabled={isPending || !isDirty}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="btn-primary py-2 text-sm min-w-[120px]"
          disabled={isPending || !isDirty}
        >
          {isPending ? (
            <><Loader2 size={14} className="animate-spin" /> Saving…</>
          ) : (
            'Save changes'
          )}
        </button>
      </div>
    </div>
  )
}

// ── Section divider ───────────────────────────────────────────────────────────
export function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-gray-100" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        {label}
      </span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

// ── Danger zone card ──────────────────────────────────────────────────────────
export function DangerCard({ title, description, buttonLabel, onAction, isPending }) {
  return (
    <div className="card border-red-200 bg-red-50/30 p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-red-700">{title}</p>
          {description && (
            <p className="text-xs text-red-500/80 mt-0.5">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onAction}
          disabled={isPending}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl
            text-sm font-medium text-red-600 bg-white border border-red-200
            hover:bg-red-50 hover:border-red-300 transition-colors duration-200
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}
