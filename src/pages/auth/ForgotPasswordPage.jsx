import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore.js'
import {
  AuthField, AuthAlert, AuthSubmitButton,
} from '../../components/auth/AuthShared.jsx'

export function ForgotPasswordPage() {
  const [email,     setEmail]     = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState('')

  const { forgotPassword, isLoading, error, clearError } = useAuthStore()

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
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-1 ring-teal-200">
          <CheckCircle size={28} className="text-teal-500" />
        </div>
        <h2 className="font-display font-bold text-2xl text-gray-900 mb-2">Check your inbox</h2>
        <p className="text-sm text-gray-500 mb-1">
          If an account exists for
        </p>
        <p className="text-sm font-semibold text-gray-800 mb-5">{email}</p>
        <p className="text-sm text-gray-500 mb-6">
          you'll receive a password reset link shortly.
        </p>

        <div className="space-y-3">
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
    <div className="p-8">
      {/* Heading */}
      <div className="mb-7">
        <h2 className="font-display font-bold text-2xl text-gray-900 mb-1.5">
          Forgot your password?
        </h2>
        <p className="text-sm text-gray-500">
          No worries — enter your work email and we'll send a reset link.
        </p>
      </div>

      {/* Error */}
      {displayError && (
        <AuthAlert type="error" message={displayError} className="mb-4" />
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <AuthField label="Email address" id="email" icon={Mail}>
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
      <div className="mt-6 text-center">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium"
        >
          <ArrowLeft size={14} />
          Back to sign in
        </Link>
      </div>
    </div>
  )
}

export default ForgotPasswordPage
