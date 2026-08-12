import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  signInWithPassword,
  signUpWithEmail,
  signOut        as supabaseSignOut,
  getSession,
  fetchProfile,
  upsertProfile,
  sendPasswordResetEmail,
  updatePassword,
  resendVerificationEmail,
} from '../services/authService.js'

// ─── Helper: map Supabase user + profile → our app user shape ─────────────────
function buildUser(supabaseUser, profile) {
  return {
    id:            supabaseUser.id,
    email:         supabaseUser.email,
    name:          profile?.name
                    ?? supabaseUser.user_metadata?.name
                    ?? supabaseUser.email?.split('@')[0]
                    ?? 'User',
    role:          profile?.role          ?? supabaseUser.user_metadata?.role ?? 'Executive',
    avatar:        profile?.avatar_url    ?? supabaseUser.user_metadata?.avatar_url ?? null,
    department:    profile?.department    ?? supabaseUser.user_metadata?.company ?? '',
    // Hierarchy fields — present after profiles_team_patch.sql is applied
    managerId:     profile?.manager_id    ?? null,
    teamId:        profile?.team_id       ?? null,
    emailVerified: supabaseUser.email_confirmed_at !== null,
    createdAt:     supabaseUser.created_at?.split('T')[0] ?? '',
  }
}

// ─── Store ─────────────────────────────────────────────────────────────────────
export const useAuthStore = create(
  persist(
    (set, get) => ({
      // ── State ─────────────────────────────────────────────────────────────
      user:            null,
      isAuthenticated: false,
      isLoading:       false,  // covers both initial hydration and action loading
      error:           null,

      // ── Auth flow UI states ────────────────────────────────────────────────
      pendingVerificationEmail: null,
      rememberMe: false,

      // ── initialize ────────────────────────────────────────────────────────
      // Called once from main.jsx on app boot. Restores session from
      // localStorage (Supabase handles that automatically) and hydrates the
      // store if a valid session is found.
      initialize: async () => {
        set({ isLoading: true })
        try {
          const session = await getSession()
          if (session?.user) {
            const profile = await fetchProfile(session.user.id)
            const user    = buildUser(session.user, profile)
            set({ user, isAuthenticated: true, isLoading: false })
          } else {
            set({ user: null, isAuthenticated: false, isLoading: false })
          }
        } catch {
          // Network failure, expired session etc. — clear and let user log in again
          set({ user: null, isAuthenticated: false, isLoading: false })
        }
      },

      // ── handleAuthEvent ───────────────────────────────────────────────────
      // Wired to supabase.auth.onAuthStateChange in main.jsx.
      // Keeps the store in sync when Supabase fires TOKEN_REFRESHED,
      // SIGNED_OUT, PASSWORD_RECOVERY, etc.
      handleAuthEvent: async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          if (session?.user) {
            try {
              const profile = await fetchProfile(session.user.id)
              const user    = buildUser(session.user, profile)
              set({ user, isAuthenticated: true, error: null })
            } catch {
              // Profile fetch failed — set minimal user from session
              set({ user: buildUser(session.user, null), isAuthenticated: true, error: null })
            }
          }
        } else if (event === 'SIGNED_OUT') {
          set({ user: null, isAuthenticated: false, pendingVerificationEmail: null })
        } else if (event === 'PASSWORD_RECOVERY') {
          // Token is in the URL; ResetPasswordPage calls authStore.resetPassword()
          // No state change needed here — the page handles it
        } else if (event === 'USER_UPDATED') {
          if (session?.user) {
            const profile = await fetchProfile(session.user.id).catch(() => null)
            const user    = buildUser(session.user, profile)
            set({ user })
          }
        }
      },

      // ── login ─────────────────────────────────────────────────────────────
      login: async (email, password, rememberMe = false) => {
        set({ isLoading: true, error: null })
        try {
          const { user: sbUser } = await signInWithPassword(
            email.trim().toLowerCase(),
            password,
          )

          // Check email verification
          if (!sbUser.email_confirmed_at) {
            set({
              isLoading: false,
              error: null,
              pendingVerificationEmail: sbUser.email,
            })
            return { success: false, needsVerification: true, email: sbUser.email }
          }

          const profile = await fetchProfile(sbUser.id)
          const user    = buildUser(sbUser, profile)
          set({ user, isAuthenticated: true, isLoading: false, rememberMe,
                pendingVerificationEmail: null })
          return { success: true }

        } catch (err) {
          const msg = parseAuthError(err)
          set({ isLoading: false, error: msg })
          return { success: false }
        }
      },

      // ── signup ────────────────────────────────────────────────────────────
      signup: async ({ name, email, password, company = '' }) => {
        set({ isLoading: true, error: null })
        try {
          const { user: sbUser } = await signUpWithEmail({
            email: email.trim().toLowerCase(),
            password,
            name:  name.trim(),
            company: company.trim(),
          })

          // Supabase returns a user object even when email confirmation is required.
          // If the user is null it means email confirmation is required.
          const targetEmail = sbUser?.email ?? email.trim().toLowerCase()

          // Attempt to upsert the profile row in case the DB trigger isn't set up
          if (sbUser?.id) {
            await upsertProfile({
              id:      sbUser.id,
              name:    name.trim(),
              company: company.trim(),
              email:   targetEmail,
            }).catch(() => {
              // Silently ignore profile creation failures here — trigger will handle it
            })
          }

          set({
            isLoading: false,
            error: null,
            pendingVerificationEmail: targetEmail,
          })
          return { success: true, email: targetEmail }

        } catch (err) {
          const msg = parseAuthError(err)
          set({ isLoading: false, error: msg })
          return { success: false }
        }
      },

      // ── verifyEmail ───────────────────────────────────────────────────────
      // Called after the user clicks the Supabase verification link and lands
      // on /verify-email. By that point Supabase has already verified the
      // email via the URL token — we just need to refresh the session.
      verifyEmail: async (_email) => {
        set({ isLoading: true, error: null })
        try {
          const session = await getSession()
          if (session?.user) {
            const profile = await fetchProfile(session.user.id).catch(() => null)
            const user    = buildUser(session.user, profile)
            set({ user, isAuthenticated: true, isLoading: false, pendingVerificationEmail: null })
            return { success: true }
          }
          // No session — verification link not yet clicked
          set({ isLoading: false })
          return { success: false }
        } catch (err) {
          set({ isLoading: false, error: parseAuthError(err) })
          return { success: false }
        }
      },

      // ── resendVerification ────────────────────────────────────────────────
      resendVerification: async (email) => {
        set({ isLoading: true, error: null })
        try {
          await resendVerificationEmail(email)
          set({ isLoading: false })
          return { success: true }
        } catch (err) {
          set({ isLoading: false, error: parseAuthError(err) })
          return { success: false }
        }
      },

      // ── forgotPassword ────────────────────────────────────────────────────
      forgotPassword: async (email) => {
        set({ isLoading: true, error: null })
        try {
          await sendPasswordResetEmail(email.trim().toLowerCase())
          set({ isLoading: false })
          return { success: true }
        } catch (err) {
          // Always report success to avoid user enumeration
          set({ isLoading: false })
          return { success: true }
        }
      },

      // ── resetPassword ─────────────────────────────────────────────────────
      // Called from ResetPasswordPage after the user sets a new password.
      // The session is automatically restored from the URL token by Supabase
      // detectSessionInUrl, so we just call updateUser.
      resetPassword: async (_token, newPassword) => {
        set({ isLoading: true, error: null })
        try {
          await updatePassword(newPassword)
          set({ isLoading: false })
          return { success: true }
        } catch (err) {
          set({ isLoading: false, error: parseAuthError(err) })
          return { success: false }
        }
      },

      // ── logout ────────────────────────────────────────────────────────────
      logout: async () => {
        set({ isLoading: true })
        try {
          await supabaseSignOut()
        } catch {
          // Ignore sign-out errors — clear local state regardless
        }
        set({
          user:            null,
          isAuthenticated: false,
          error:           null,
          isLoading:       false,
          pendingVerificationEmail: null,
        })
      },

      // ── helpers ───────────────────────────────────────────────────────────
      clearError:               () => set({ error: null }),
      clearPendingVerification: () => set({ pendingVerificationEmail: null }),
      setRememberMe:            (val) => set({ rememberMe: val }),

      updateUser: (updates) => {
        const current = get().user
        if (current) set({ user: { ...current, ...updates } })
      },
    }),

    // ── Persistence ──────────────────────────────────────────────────────────
    // Only persist the minimal user shape so the UI can render immediately on
    // refresh. Supabase's own localStorage handles the real session token.
    {
      name: 'nexus-auth',
      partialize: (state) => ({
        user:            state.user,
        isAuthenticated: state.isAuthenticated,
        rememberMe:      state.rememberMe,
      }),
    },
  ),
)

// ─── Error message normaliser ─────────────────────────────────────────────────
function parseAuthError(err) {
  if (!err) return 'Something went wrong. Please try again.'
  const msg = err.message ?? String(err)
  // Map Supabase error strings to user-friendly messages
  if (msg.includes('Invalid login credentials'))    return 'Invalid email or password.'
  if (msg.includes('Email not confirmed'))          return 'Please verify your email before signing in.'
  if (msg.includes('User already registered'))      return 'An account with this email already exists.'
  if (msg.includes('Password should be at least'))  return 'Password must be at least 6 characters.'
  if (msg.includes('rate limit'))                   return 'Too many attempts. Please wait a moment.'
  if (msg.includes('network'))                      return 'Network error. Please check your connection.'
  return msg
}
