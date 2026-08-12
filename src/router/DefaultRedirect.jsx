// ─── Default Landing Route ────────────────────────────────────────────────────
//
// Honours Settings → Preferences → "Default module on login".
//
// Mounted at "/". Login and the guest redirect both send the user here rather
// than hardcoding /dashboard, so the stored preference actually decides where
// the session starts. Falls back to /dashboard while preferences load, if the
// stored value is unknown, or if the user lacks access to it.

import React from 'react'
import { Navigate } from 'react-router-dom'
import { usePreferencesSettings } from '../hooks/useSettings.js'
import { useAuthStore } from '../stores/authStore.js'
import { PageSpinner } from '../components/ui/Spinner.jsx'

// Only routes that exist in App.jsx and are reachable by every role
const MODULE_ROUTES = {
  dashboard:     '/dashboard',
  leads:         '/leads',
  contacts:      '/contacts',
  tasks:         '/tasks',
  meetings:      '/meetings',
  opportunities: '/opportunities',
  analytics:     '/analytics',
  notifications: '/notifications',
}

export function DefaultRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { data: prefs, isLoading } = usePreferencesSettings()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  // Brief spinner rather than a visible bounce through /dashboard
  if (isLoading) return <PageSpinner />

  const target = MODULE_ROUTES[prefs?.defaultModule] ?? '/dashboard'
  return <Navigate to={target} replace />
}

export default DefaultRedirect
