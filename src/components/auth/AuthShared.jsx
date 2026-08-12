import React, { useState } from 'react'
import {
  Eye, EyeOff, AlertCircle, CheckCircle, Info,
} from 'lucide-react'
import { Spinner } from '../ui/Spinner.jsx'

// ── Auth field with optional leading icon ──────────────────────────────────────
export function AuthField({ label, id, error, hint, icon: Icon, children }) {
  const child = React.Children.only(children)
  return (
    <div>
      {label && (
        <label htmlFor={id} className="label-base">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
          />
        )}
        {React.cloneElement(child, {
          id,
          className: [
            'input-base',
            Icon ? 'pl-10' : '',
            error ? 'border-red-300 focus:border-red-400 focus:ring-red-400/20' : '',
            child.props.className || '',
          ].filter(Boolean).join(' '),
        })}
      </div>
      {hint  && !error && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
      {error && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <AlertCircle size={11} className="flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

// ── Password input with show/hide toggle ──────────────────────────────────────
export function PasswordField({ label, id, value, onChange, error, placeholder, disabled, autoComplete, hint }) {
  const [show, setShow] = useState(false)

  return (
    <div>
      {label && (
        <label htmlFor={id} className="label-base">{label}</label>
      )}
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder || '••••••••'}
          disabled={disabled}
          autoComplete={autoComplete || 'current-password'}
          className={[
            'input-base pr-11',
            error ? 'border-red-300 focus:border-red-400 focus:ring-red-400/20' : '',
          ].filter(Boolean).join(' ')}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hint  && !error && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
      {error && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <AlertCircle size={11} className="flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

// ── Alert banner (error / success / info / warning) ───────────────────────────
const ALERT_STYLES = {
  error:   'bg-red-50 border-red-100 text-red-700',
  success: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  info:    'bg-blue-50 border-blue-100 text-blue-700',
  warning: 'bg-amber-50 border-amber-100 text-amber-700',
}

const ALERT_ICONS = {
  error:   AlertCircle,
  success: CheckCircle,
  info:    Info,
  warning: AlertCircle,
}

export function AuthAlert({ type = 'error', message, className = '' }) {
  if (!message) return null
  const Icon = ALERT_ICONS[type] || AlertCircle
  return (
    <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm animate-fade-in
      ${ALERT_STYLES[type]} ${className}`}>
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <span className="leading-snug">{message}</span>
    </div>
  )
}

// ── Remember-me checkbox ──────────────────────────────────────────────────────
export function RememberMe({ checked, onChange }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group select-none">
      <div className="relative flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-4 h-4 rounded border-2 transition-all duration-150 flex items-center justify-center
          ${checked ? 'bg-teal-500 border-teal-500' : 'bg-white border-gray-300 group-hover:border-teal-400'}`}>
          {checked && (
            <svg viewBox="0 0 10 8" className="w-2.5 h-2" fill="none" stroke="white" strokeWidth="2">
              <path d="M1 4l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>
      <span className="text-sm text-gray-600">Remember me for 30 days</span>
    </label>
  )
}

// ── Divider with centre label ─────────────────────────────────────────────────
export function AuthDivider({ label = 'or' }) {
  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-gray-200" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-white px-3 text-xs text-gray-400">{label}</span>
      </div>
    </div>
  )
}

// ── Password strength meter ───────────────────────────────────────────────────
function getStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8)          score++
  if (pw.length >= 12)         score++
  if (/[A-Z]/.test(pw))        score++
  if (/[0-9]/.test(pw))        score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'Weak',   color: 'bg-red-400'    }
  if (score <= 2) return { score, label: 'Fair',   color: 'bg-amber-400'  }
  if (score <= 3) return { score, label: 'Good',   color: 'bg-teal-400'   }
  return              { score, label: 'Strong', color: 'bg-emerald-500' }
}

export function PasswordStrengthMeter({ password }) {
  const { score, label, color } = getStrength(password)
  if (!password) return null
  const textColor =
    score <= 1 ? 'text-red-500' :
    score <= 2 ? 'text-amber-500' :
    score <= 3 ? 'text-teal-500' :
                 'text-emerald-600'

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300
              ${i < score ? color : 'bg-gray-100'}`}
          />
        ))}
      </div>
      {label && (
        <p className={`text-[11px] font-medium ${textColor}`}>{label}</p>
      )}
    </div>
  )
}

// ── Submit button with spinner ─────────────────────────────────────────────────
export function AuthSubmitButton({ isLoading, label, loadingLabel, icon: Icon, disabled }) {
  return (
    <button
      type="submit"
      disabled={isLoading || disabled}
      className="btn-primary w-full"
    >
      {isLoading ? (
        <>
          <Spinner size="sm" color="white" />
          <span>{loadingLabel || 'Please wait…'}</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          {Icon && <Icon size={16} />}
        </>
      )}
    </button>
  )
}
