import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
// One shared instance, so leadsStore can invalidate from outside the React tree.
import { queryClient } from './lib/queryClient.js'
import App from './App.jsx'
import './index.css'
import { useAuthStore }    from './stores/authStore.js'
import { onAuthStateChange } from './services/authService.js'

// ── React Query client ────────────────────────────────────────────────────────
// queryClient now lives in lib/queryClient.js — see the note there.

// ── Boot auth ─────────────────────────────────────────────────────────────────
// 1. Wire the Supabase auth state listener so the store stays in sync with
//    token refreshes, tab switches, and session expiry — for the lifetime of
//    the app.
const { handleAuthEvent, initialize } = useAuthStore.getState()

onAuthStateChange((event, session) => {
  handleAuthEvent(event, session)
})

// 2. Restore any existing session from Supabase localStorage on first load.
initialize()

// ── Render ────────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
