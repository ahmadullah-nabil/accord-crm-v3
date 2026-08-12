import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore.js'
import { PageSpinner }  from '../components/ui/Spinner.jsx'

export function ProtectedRoute({ children, allowedRoles = null }) {
  const { isAuthenticated, isLoading, user } = useAuthStore()
  const location = useLocation()

  // Show full-page spinner during initial auth hydration
  if (isLoading) {
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
