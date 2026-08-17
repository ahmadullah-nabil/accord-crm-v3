import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore.js'
import { PageSpinner }  from '../components/ui/Spinner.jsx'

// GuestRoute: only accessible to unauthenticated users.
// Shows a spinner while the initial Supabase session is being restored.
export function GuestRoute({ children }) {
  const { isAuthenticated, isBootstrapping } = useAuthStore()

  // Wait for initialize() to complete before making a routing decision.
  // Without this, a logged-in user with a valid Supabase session would flash
  // the login page before being redirected.
  //
  // step068 — READS isBootstrapping, NOT isLoading, and the distinction is
  // load-bearing. isLoading is also set by login/signup/forgotPassword, and
  // returning a spinner here on those unmounts the page the user is filling
  // in: its useState is destroyed, and when the request resolves the page
  // remounts blank. That was the "reset email sent but the form comes back"
  // bug. Only the initial session restore may gate routing.
  if (isBootstrapping) {
    return <PageSpinner />
  }

  // "/" resolves the user's preferred default module (DefaultRedirect)
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}

export default GuestRoute
