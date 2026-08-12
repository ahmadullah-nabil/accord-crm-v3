// ─── Supabase Client ──────────────────────────────────────────────────────────
//
// Single source of truth for the Supabase client instance.
// All services and the auth store import `supabase` from here.
// Never call createClient() anywhere else.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[Accord CRM] Missing Supabase environment variables.\n' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
  )
}

// ── Singleton ─────────────────────────────────────────────────────────────────
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession:    true,   // keep session in localStorage across refreshes
    autoRefreshToken:  true,   // silently refresh the JWT before expiry
    detectSessionInUrl: true,  // pick up the token from the URL after email links
    storageKey: 'accord-crm-auth', // localStorage key for the session
  },
  global: {
    headers: { 'X-App-Name': 'AccordCRM' },
  },
})

// ── Utility: check if Supabase is configured with real values ─────────────────
export function isSupabaseConfigured() {
  return (
    !!supabaseUrl &&
    !!supabaseKey &&
    supabaseUrl.includes('.supabase.co') &&
    supabaseKey.length > 20
  )
}
