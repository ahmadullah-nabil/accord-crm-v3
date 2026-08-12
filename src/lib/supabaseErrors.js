// ─── Supabase Error Utilities ─────────────────────────────────────────────────
//
// Centralises error classification so every service can give the UI a
// consistent, actionable message instead of a raw Supabase error string.
//
// React Query surfaces these via isError / error.message.
// The page-level error boundaries (ContactsPage, TasksPage, etc.) already
// render a "Retry" button on isError — no UI changes needed.

// ── Error codes / messages Supabase uses for RLS rejections ──────────────────
const RLS_CODES  = new Set(['42501'])                       // permission denied
const RLS_HINTS  = /row-level security|insufficient_privilege|permission denied/i

// ── Classify a Supabase PostgREST error ───────────────────────────────────────
export function classifyError(err) {
  if (!err) return { type: 'unknown', message: 'An unexpected error occurred.' }

  const code    = err.code    ?? ''
  const message = err.message ?? String(err)
  const hint    = err.hint    ?? ''

  // RLS / permission errors
  if (
    RLS_CODES.has(code) ||
    RLS_HINTS.test(message) ||
    RLS_HINTS.test(hint)   ||
    err.status === 403
  ) {
    return {
      type: 'unauthorized',
      message: 'You do not have permission to view these records.',
      isUnauthorized: true,
    }
  }

  // Row not found (PGRST116) — not an error, just empty
  if (code === 'PGRST116') {
    return { type: 'not_found', message: 'Record not found.', isNotFound: true }
  }

  // Table / column does not exist — migration not yet applied
  if (code === '42P01' || code === '42703') {
    return {
      type: 'schema_missing',
      message: 'Database setup is incomplete. Please contact your administrator.',
      isSchema: true,
    }
  }

  // Network / timeout
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return {
      type: 'network',
      message: 'Network error. Please check your connection and try again.',
      isNetwork: true,
    }
  }

  return { type: 'unknown', message }
}

// ── Wraps a Supabase error and throws with a clean message ────────────────────
// Usage: if (error) throwClassified(error)
export function throwClassified(err) {
  const classified = classifyError(err)
  const out = new Error(classified.message)
  out.type           = classified.type
  out.isUnauthorized = classified.isUnauthorized ?? false
  out.isNotFound     = classified.isNotFound     ?? false
  out.isSchema       = classified.isSchema       ?? false
  out.isNetwork      = classified.isNetwork      ?? false
  out.originalError  = err
  throw out
}
