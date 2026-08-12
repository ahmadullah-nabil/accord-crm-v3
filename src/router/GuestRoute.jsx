import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore.js'
import { PageSpinner }  from '../components/ui/Spinner.jsx'

// GuestRoute: only accessible to unauthenticated users.
// Shows a spinner while the initial Supabase session is being restored.
export function GuestRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  // Wait for initialize() to complete before making a routing decision.
  // Without this, a logged-in user with a valid Supabase session would flash
  // the login page before being redirected.
  if (isLoading) {
    return <PageSpinner />
  }

  // "/" resolves the user's preferred default module (DefaultRedirect)
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}

export default GuestRoute
