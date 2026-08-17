// ─── LoginPage ────────────────────────────────────────────────────────────────
//
// step068. Revamped onto the two-pane AuthLayout, and the signup route is open.
//
// SIGNUP WAS UNREACHABLE. `/signup` has existed as a route the whole time, with
// a complete page behind it, and nothing anywhere linked to it — the only thing
// at the bottom of this form was "Access restricted to authorised workspace
// members", which is a statement, not a route. Anyone who needed to sign up had
// to be sent the URL by hand.
//
// That notice was not wrong when it was written: before 024's invitation flow
// existed, self-signup produced a user with no membership, who logged in to an
// empty CRM that every policy denied. It is wrong NOW. Since 024 a signup
// matching a pending invitation becomes a membership before the first token is
// minted, and since 030 an invitation arriving later can be accepted from the
// banner. The route is safe to surface, so it is surfaced.
//
// The heading no longer says "Welcome back" above a form that is now also the
// door for people who have never been here.

import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore.js'
import {
  AuthField, PasswordField, AuthAlert, RememberMe, AuthSubmitButton,
} from '../../components/auth/AuthShared.jsx'

export function LoginPage() {
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [formError,  setFormError]  = useState('')

  const { login, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  // '/' resolves the stored default-module preference via DefaultRedirect
  const from     = location.state?.from?.pathname || '/'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    if (!email.trim())    { setFormError('Email is required.');    return }
    if (!password.trim()) { setFormError('Password is required.'); return }

    const result = await login(email.trim().toLowerCase(), password, rememberMe)

    if (result.success) {
      navigate(from, { replace: true })
    } else if (result.needsVerification) {
      navigate('/verify-email')
    }
  }

  const displayError = formError || error

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-semibold text-gray-900 text-[22px] leading-tight tracking-tight">
          Sign in
        </h1>
        <p className="text-[13px] text-gray-500 mt-1.5">
          Use the email address your workspace was set up with.
        </p>
      </div>

      {displayError && (
        <AuthAlert type="error" message={displayError} className="mb-4" />
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
        <AuthField label="Email address" id="email">
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFormError(''); clearError() }}
            placeholder="you@company.com"
            disabled={isLoading}
          />
        </AuthField>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="label-base mb-0">Password</label>
            <Link
              to="/forgot-password"
              className="text-[11px] text-gray-500 hover:text-gray-900 font-medium"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordField
            id="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setFormError(''); clearError() }}
            disabled={isLoading}
            autoComplete="current-password"
          />
        </div>

        <RememberMe checked={rememberMe} onChange={setRememberMe} />

        <AuthSubmitButton
          isLoading={isLoading}
          label="Sign in"
          loadingLabel="Signing in…"
          icon={ArrowRight}
        />
      </form>

      {/* See the header: the route was always there, nothing linked to it. */}
      <p className="text-[13px] text-gray-500 mt-6">
        Don&apos;t have an account?{' '}
        <Link to="/signup" className="text-gray-900 font-medium hover:underline">
          Create one
        </Link>
      </p>
    </div>
  )
}

export default LoginPage
