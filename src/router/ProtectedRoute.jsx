import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore.js'
import { PageSpinner } from '../components/ui/Spinner.jsx'

export function ProtectedRoute({ children, allowedRoles = null }) {
  const { isAuthenticated, isBootstrapping, user } = useAuthStore()
  const location = useLocation()

  // step068 — wait for the session restore before deciding.
  //
  // This guard never checked. On a hard refresh of a protected route
  // isAuthenticated is false until initialize() resolves, so it redirected to
  // /login — and it only LOOKED fine because GuestRoute then showed a spinner
  // and bounced back once the session landed. Two redirects and a URL change
  // to arrive where you already were. With GuestRoute now gated on
  // isBootstrapping instead of isLoading, that accidental recovery is gone and
  // this has to be explicit.
  if (isBootstrapping) {
    return <PageSpinner />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default ProtectedRoute
