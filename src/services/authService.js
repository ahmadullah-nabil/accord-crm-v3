// ─── Auth Service ─────────────────────────────────────────────────────────────
//
// Pure Supabase Auth operations. This layer:
//   • has NO knowledge of the Zustand store
//   • has NO mock data
//   • is called exclusively by authStore.js
//
// All functions throw on error so authStore can catch and set error state.

import { supabase } from '../lib/supabaseClient.js'

// ── Sign in with email + password ─────────────────────────────────────────────
export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data // { user, session }
}

// ── Sign up new user ──────────────────────────────────────────────────────────
// Creates the Supabase Auth user. The profile row is created by a Postgres
// trigger (on_auth_user_created). See SUPABASE_MIGRATION.md for the SQL.
export async function signUpWithEmail({ email, password, name, company = '' }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, company },                           // stored in raw_user_meta_data
      emailRedirectTo: `${import.meta.env.VITE_APP_URL ?? window.location.origin}/verify-email`,
    },
  })
  if (error) throw error
  return data // { user, session }
}

// ── Sign out ──────────────────────────────────────────────────────────────────
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// ── Get current session (restored from localStorage) ─────────────────────────
// Returns null if no session exists or it has expired.
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session // Session | null
}

// ── Get current user (re-validates against Supabase) ─────────────────────────
export async function getUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user // User | null
}

// ── Fetch user profile from the profiles table ────────────────────────────────
// Falls back gracefully if the profiles table doesn't exist yet.
export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    // PGRST116 = row not found; 42P01 = table does not exist
    if (error.code === 'PGRST116' || error.code === '42P01') return null
    throw error
  }
  return data
}

// ── Create or update the user's profile row ───────────────────────────────────
// Called after signup when the trigger isn't set up yet, or to patch data.
export async function upsertProfile({ id, name, company, email }) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      { id, name, department: company || null, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
    .select()
    .single()

  if (error) {
    // If the profiles table doesn't exist, fail silently
    if (error.code === '42P01') return null
    throw error
  }
  return data
}

// ── Send password reset email ─────────────────────────────────────────────────
export async function sendPasswordResetEmail(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${import.meta.env.VITE_APP_URL ?? window.location.origin}/reset-password`,
  })
  if (error) throw error
  // Intentionally no return value — avoid user enumeration in calling code
}

// ── Update password (requires active session) ─────────────────────────────────
export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
  return data.user
}

// ── Resend verification email ─────────────────────────────────────────────────
export async function resendVerificationEmail(email) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${import.meta.env.VITE_APP_URL ?? window.location.origin}/verify-email`,
    },
  })
  if (error) throw error
}

// ── Subscribe to auth state changes ──────────────────────────────────────────
// Returns an unsubscribe function. Call this once in main.jsx.
// Events fired: INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED,
//               USER_UPDATED, PASSWORD_RECOVERY
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback)
  return () => subscription.unsubscribe()
}
