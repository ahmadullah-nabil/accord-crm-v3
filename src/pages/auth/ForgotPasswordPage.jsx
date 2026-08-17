import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore.js'
import {
  AuthField, AuthAlert, AuthSubmitButton,
} from '../../components/auth/AuthShared.jsx'

export function ForgotPasswordPage() {
  const [email,     setEmail]     = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState('')

  const { forgotPassword, isLoading, error, clearError } = useAuthStore()

  // ── The bug this page was reported for ────────────────────────────────────
  // "the mail comes but it reloads back to the forgot-password form."
  //
  // Nothing was wrong HERE. `forgotPassword` always returns { success: true }
  // and this always called setSubmitted(true). The problem was that
  // GuestRoute read the same `isLoading` flag the store sets while the request
  // is in flight, so it swapped this whole page for a spinner — UNMOUNTING it
  // — and remounted it fresh when the request resolved. `submitted` was being
  // set on a component that no longer existed.
  //
  // Fixed in step068 by splitting the store flag: GuestRoute now reads
  // `isBootstrapping`, which only initialize() writes. See authStore.js.
  // This page is unchanged in behaviour; only its styling moved.
  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    if (!email.trim()) { setFormError('Email is required.'); return }
    if (!/\S+@\S+\.\S+/.test(email)) { setFormError('Enter a valid email address.'); return }

    const result = await forgotPassword(email.trim().toLowerCase())
    if (result.success) setSubmitted(true)
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div>
        <div className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center mb-4">
          <CheckCircle size={18} className="text-emerald-600" />
        </div>
        <h1 className="font-display font-semibold text-gray-900 text-[22px] leading-tight tracking-tight">
          Check your inbox
        </h1>
        <p className="text-[13px] text-gray-500 mt-1.5 leading-relaxed">
          If an account exists for <span className="text-gray-900 font-medium">{email}</span>,
          a password reset link is on its way. It expires in one hour.
        </p>
        <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
          Nothing after a few minutes? Check spam, and confirm the address is
          the one your workspace was set up with.
        </p>

        <div className="space-y-2 mt-6">
          <Link to="/login" className="btn-primary inline-flex w-full justify-center">
            Back to sign in
          </Link>
          <button
            type="button"
            onClick={() => { setSubmitted(false); setEmail(''); clearError() }}
            className="btn-secondary w-full text-sm"
          >
            Try a different email
          </button>
        </div>
      </div>
    )
  }

  const displayError = formError || error

  return (
    <div>
      {/* Heading */}
      <div className="mb-6">
        <h1 className="font-display font-semibold text-gray-900 text-[22px] leading-tight tracking-tight">
          Reset your password
        </h1>
        <p className="text-[13px] text-gray-500 mt-1.5">
          Enter your work email and we&apos;ll send you a reset link.
        </p>
      </div>

      {/* Error */}
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

        <AuthSubmitButton
          isLoading={isLoading}
          label="Send reset link"
          loadingLabel="Sending…"
        />
      </form>

      {/* Back link */}
      <div className="mt-6">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-900 font-medium"
        >
          <ArrowLeft size={14} />
          Back to sign in
        </Link>
      </div>
    </div>
  )
}

export default ForgotPasswordPage
