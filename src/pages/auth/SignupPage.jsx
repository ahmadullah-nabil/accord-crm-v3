import React, { useState } from 'react'
import { Link, useNavigate }  from 'react-router-dom'
import { User, Mail, Building2, ArrowRight } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore.js'
import {
  AuthField, PasswordField, AuthAlert, AuthDivider,
  PasswordStrengthMeter, AuthSubmitButton,
} from '../../components/auth/AuthShared.jsx'

// ── Inline validation ─────────────────────────────────────────────────────────
function validate(form) {
  const errors = {}
  if (!form.name.trim())         errors.name     = 'Full name is required.'
  if (!form.email.trim())        errors.email    = 'Email is required.'
  else if (!/\S+@\S+\.\S+/.test(form.email)) errors.email = 'Enter a valid email address.'
  if (!form.password)            errors.password = 'Password is required.'
  else if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.'
  if (!form.agree)               errors.agree    = 'You must accept the terms to continue.'
  return errors
}

export function SignupPage() {
  const { signup, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name:     '',
    email:    '',
    company:  '',
    password: '',
    agree:    false,
  })
  const [fieldErrors, setFieldErrors] = useState({})

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [field]: val }))
    setFieldErrors((fe) => { const next = { ...fe }; delete next[field]; return next })
    if (error) clearError()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errors = validate(form)
    if (Object.keys(errors).length) { setFieldErrors(errors); return }

    const result = await signup({
      name:     form.name,
      email:    form.email,
      password: form.password,
      company:  form.company,
    })

    if (result.success) {
      navigate('/verify-email')
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-7">
        <h2 className="font-display font-bold text-2xl text-gray-900 mb-1.5">
          Create your account
        </h2>
        <p className="text-sm text-gray-500">
          Get started with Accord CRM — no credit card required.
        </p>
      </div>

      {/* Server error */}
      {error && <AuthAlert type="error" message={error} className="mb-4" />}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Full name */}
        <AuthField label="Full name" id="name" error={fieldErrors.name} icon={User}>
          <input
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={set('name')}
            placeholder="Alex Rivera"
            disabled={isLoading}
          />
        </AuthField>

        {/* Work email */}
        <AuthField label="Work email" id="email" error={fieldErrors.email} icon={Mail}>
          <input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
            placeholder="you@company.com"
            disabled={isLoading}
          />
        </AuthField>

        {/* Company (optional) */}
        <AuthField
          label="Company name"
          id="company"
          icon={Building2}
          hint="Optional — helps us personalise your experience."
        >
          <input
            type="text"
            autoComplete="organization"
            value={form.company}
            onChange={set('company')}
            placeholder="Accord Technologies"
            disabled={isLoading}
          />
        </AuthField>

        {/* Password */}
        <div>
          <PasswordField
            label="Password"
            id="password"
            value={form.password}
            onChange={set('password')}
            error={fieldErrors.password}
            placeholder="Minimum 8 characters"
            disabled={isLoading}
            autoComplete="new-password"
            hint="Use letters, numbers, and symbols for a stronger password."
          />
          <PasswordStrengthMeter password={form.password} />
        </div>

        {/* Terms checkbox */}
        <div>
          <label className="flex items-start gap-2.5 cursor-pointer select-none group">
            <div className="relative flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={form.agree}
                onChange={set('agree')}
                disabled={isLoading}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded border-2 transition-all duration-150 flex items-center justify-center
                ${form.agree ? 'bg-teal-500 border-teal-500' : 'bg-white border-gray-300 group-hover:border-teal-400'}
                ${fieldErrors.agree ? 'border-red-400' : ''}`}>
                {form.agree && (
                  <svg viewBox="0 0 10 8" className="w-2.5 h-2" fill="none" stroke="white" strokeWidth="2">
                    <path d="M1 4l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-gray-600 leading-snug">
              I agree to the{' '}
              <a href="#" onClick={(e) => e.preventDefault()} className="text-teal-600 hover:text-teal-700 font-medium">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" onClick={(e) => e.preventDefault()} className="text-teal-600 hover:text-teal-700 font-medium">
                Privacy Policy
              </a>
            </span>
          </label>
          {fieldErrors.agree && (
            <p className="text-xs text-red-500 mt-1 ml-6">{fieldErrors.agree}</p>
          )}
        </div>

        {/* Submit */}
        <AuthSubmitButton
          isLoading={isLoading}
          label="Create account"
          loadingLabel="Creating account…"
          icon={ArrowRight}
        />
      </form>

      <AuthDivider label="already have an account?" />

      <p className="text-center text-sm text-gray-500">
        <Link to="/login" className="text-teal-600 hover:text-teal-700 font-semibold">
          Sign in instead
        </Link>
      </p>
    </div>
  )
}

export default SignupPage
