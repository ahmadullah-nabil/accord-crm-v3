import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle, AlertTriangle } from 'lucide-react'
import { supabase }       from '../../lib/supabaseClient.js'
import { useAuthStore }   from '../../stores/authStore.js'
import {
  PasswordField, AuthAlert, AuthSubmitButton,
  PasswordStrengthMeter,
} from '../../components/auth/AuthShared.jsx'
import { Spinner } from '../../components/ui/Spinner.jsx'

export function ResetPasswordPage() {
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [success,     setSuccess]     = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  // null = still checking, true = valid recovery session, false = invalid/expired
  const [sessionReady, setSessionReady] = useState(null)

  const { resetPassword, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()

  // ── Detect the Supabase PASSWORD_RECOVERY session from the URL fragment ──────
  // Supabase sets detectSessionInUrl: true, which processes the
  // #access_token=...&type=recovery fragment and fires PASSWORD_RECOVERY.
  // We listen for that event (or an already-active recovery session) to confirm
  // the link is valid before showing the form.
  useEffect(() => {
    // Check if a recovery session is already active (page loaded from valid link)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Session is present — Supabase already processed the recovery token
        setSessionReady(true)
      }
      // If no session yet, wait for the PASSWORD_RECOVERY event below
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      } else if (event === 'SIGNED_OUT') {
        setSessionReady(false)
      }
    })

    // Timeout: if no recovery session arrives within 4 s, the link is stale
    const timeout = setTimeout(() => {
      setSessionReady((current) => {
        if (current === null) return false   // still waiting → invalid
        return current
      })
    }, 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const validate = () => {
    const errs = {}
    if (!password)                errs.password = 'Password is required.'
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters.'
    if (!confirm)                 errs.confirm  = 'Please confirm your password.'
    else if (password !== confirm) errs.confirm = 'Passwords do not match.'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearError()
    const errs = validate()
    if (Object.keys(errs).length) { setFieldErrors(errs); return }

    // authStore.resetPassword ignores the first arg (token) and calls
    // supabase.auth.updateUser — the session is already active from the link
    const result = await resetPassword(null, password)
    if (result.success) {
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2500)
    }
  }

  // ── Loading: checking session ────────────────────────────────────────────
  if (sessionReady === null) {
    return (
      <div className="p-8 text-center">
        <div className="flex justify-center mb-4">
          <Spinner size="md" />
        </div>
        <p className="text-sm text-gray-500">Verifying your reset link…</p>
      </div>
    )
  }

  // ── Invalid / expired link ────────────────────────────────────────────────
  if (sessionReady === false) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <h2 className="font-display font-bold text-2xl text-gray-900 mb-2">Link expired</h2>
        <p className="text-sm text-gray-500 mb-6">
          This password reset link is invalid or has expired. Reset links are
          single-use and expire after 60 minutes.
        </p>
        <Link to="/forgot-password" className="btn-primary inline-flex">
          Request a new link
        </Link>
      </div>
    )
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-1 ring-teal-200">
          <CheckCircle size={28} className="text-teal-500" />
        </div>
        <h2 className="font-display font-bold text-2xl text-gray-900 mb-2">
          Password updated
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Your password has been changed. Redirecting to sign in…
        </p>
        <div className="flex justify-center">
          <Spinner size="sm" />
        </div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-8">
      {/* Heading */}
      <div className="mb-7">
        <h2 className="font-display font-bold text-2xl text-gray-900 mb-1.5">
          Set new password
        </h2>
        <p className="text-sm text-gray-500">
          Choose a strong, unique password for your account.
        </p>
      </div>

      {/* Error from store */}
      {error && <AuthAlert type="error" message={error} className="mb-4" />}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* New password */}
        <div>
          <PasswordField
            label="New password"
            id="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setFieldErrors((fe) => { const n = { ...fe }; delete n.password; return n })
              clearError()
            }}
            error={fieldErrors.password}
            placeholder="Minimum 8 characters"
            disabled={isLoading}
            autoComplete="new-password"
          />
          <PasswordStrengthMeter password={password} />
        </div>

        {/* Confirm password */}
        <PasswordField
          label="Confirm password"
          id="confirm"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value)
            setFieldErrors((fe) => { const n = { ...fe }; delete n.confirm; return n })
          }}
          error={fieldErrors.confirm}
          placeholder="Repeat your new password"
          disabled={isLoading}
          autoComplete="new-password"
        />

        {/* Password rules hint */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
          {[
            { rule: password.length >= 8,           text: 'At least 8 characters' },
            { rule: /[A-Z]/.test(password),          text: 'One uppercase letter'  },
            { rule: /[0-9]/.test(password),          text: 'One number'            },
          ].map(({ rule, text }) => (
            <p key={text} className={`text-xs flex items-center gap-2
              ${rule ? 'text-emerald-600' : 'text-gray-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0
                ${rule ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              {text}
            </p>
          ))}
        </div>

        <AuthSubmitButton
          isLoading={isLoading}
          label="Update password"
          loadingLabel="Updating…"
        />
      </form>

      <div className="mt-6 text-center">
        <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700 font-medium">
          Back to sign in
        </Link>
      </div>
    </div>
  )
}

export default ResetPasswordPage
