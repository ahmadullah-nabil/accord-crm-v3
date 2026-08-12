import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, CheckCircle, RefreshCw, ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore.js'
import { AuthAlert }    from '../../components/auth/AuthShared.jsx'
import { Spinner }      from '../../components/ui/Spinner.jsx'

export function EmailVerificationPage() {
  const {
    pendingVerificationEmail,
    isAuthenticated,
    verifyEmail,
    resendVerification,
    clearPendingVerification,
    isLoading,
  } = useAuthStore()

  const [resent,   setResent]   = useState(false)
  const [verified, setVerified] = useState(false)
  const [alert,    setAlert]    = useState(null)
  const navigate = useNavigate()

  // If Supabase already verified the email (user clicked the link and
  // detectSessionInUrl picked up the token), the store will have
  // isAuthenticated=true. Redirect them straight into the app.
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  // Periodically poll for session in case the user verifies in another tab.
  // verifyEmail() calls getSession() and hydrates the store if found.
  useEffect(() => {
    if (!pendingVerificationEmail || verified) return

    const poll = setInterval(async () => {
      const result = await verifyEmail(pendingVerificationEmail)
      if (result.success) {
        setVerified(true)
        clearInterval(poll)
        setTimeout(() => navigate('/dashboard', { replace: true }), 1500)
      }
    }, 3000) // check every 3 seconds

    return () => clearInterval(poll)
  }, [pendingVerificationEmail, verified, verifyEmail, navigate])

  // If no pending email and not authenticated, user navigated here directly
  if (!pendingVerificationEmail && !verified) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-gray-500 mb-4">No pending verification found.</p>
        <Link to="/login" className="btn-primary inline-flex">
          Back to login
        </Link>
      </div>
    )
  }

  const handleResend = async () => {
    setAlert(null)
    setResent(false)
    const result = await resendVerification(pendingVerificationEmail)
    if (result.success) {
      setResent(true)
      setTimeout(() => setResent(false), 5000)
    } else {
      setAlert({ type: 'error', message: 'Could not resend. Please try again.' })
    }
  }

  // Shown briefly after the poll detects a verified session
  if (verified) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-1 ring-teal-200">
          <CheckCircle size={30} className="text-teal-500" />
        </div>
        <h2 className="font-display font-bold text-2xl text-gray-900 mb-2">Email verified!</h2>
        <p className="text-sm text-gray-500 mb-1">Your account is ready. Taking you in…</p>
        <div className="flex justify-center mt-4">
          <Spinner size="sm" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Icon */}
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center ring-1 ring-teal-200">
          <Mail size={28} className="text-teal-500" />
        </div>
      </div>

      {/* Heading */}
      <div className="text-center mb-6">
        <h2 className="font-display font-bold text-2xl text-gray-900 mb-1.5">
          Check your email
        </h2>
        <p className="text-sm text-gray-500">
          We sent a verification link to
        </p>
        <p className="text-sm font-semibold text-gray-800 mt-0.5">
          {pendingVerificationEmail}
        </p>
      </div>

      {/* Steps */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
        {[
          'Open the email from Accord CRM',
          'Click the "Verify email" link',
          'You\'ll be automatically signed in',
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs font-bold
              flex items-center justify-center flex-shrink-0">
              {i + 1}
            </span>
            <span className="text-sm text-gray-700">{step}</span>
          </div>
        ))}
      </div>

      {/* Waiting indicator */}
      <div className="flex items-center justify-center gap-2 mb-5 text-xs text-gray-400">
        <Spinner size="xs" color="gray" />
        <span>Waiting for verification…</span>
      </div>

      {/* Alerts */}
      {alert && <AuthAlert type={alert.type} message={alert.message} className="mb-4" />}
      {resent && (
        <AuthAlert type="success" message="Verification email resent! Check your inbox." className="mb-4" />
      )}

      {/* Resend */}
      <button
        type="button"
        onClick={handleResend}
        disabled={isLoading || resent}
        className="btn-secondary w-full mb-3 text-sm gap-1.5"
      >
        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        Resend verification email
      </button>

      {/* Back + change email */}
      <div className="flex items-center justify-between text-sm text-gray-500 mt-4">
        <button
          type="button"
          onClick={() => { clearPendingVerification(); navigate('/login') }}
          className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={13} /> Back to login
        </button>
        <Link to="/signup" className="text-teal-600 hover:text-teal-700 font-medium">
          Use different email
        </Link>
      </div>
    </div>
  )
}

export default EmailVerificationPage
