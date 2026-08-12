// ─── Settings React Query Hooks ───────────────────────────────────────────────
//
// Every Settings section now reads and writes real Supabase state through
// services/settingsService.js. The in-memory mock store that used to back
// Company, Notifications, Appearance, Security and Preferences is gone.
//
// The exported hook names and their return shapes are unchanged, so no Settings
// component needed editing — the UI and UX are exactly as before.
//
// WHERE EACH SECTION LIVES
// ────────────────────────
//   Profile (name, phone, department) → public.profiles      (via useTeam)
//   Profile (bio, locale)             → user_preferences.preferences.profile
//   Company                           → public.company_settings   (Admin/AGM)
//   Notifications                     → user_preferences.notifications
//   Appearance                        → user_preferences.appearance
//   Security                          → user_preferences.security
//   Preferences                       → user_preferences.preferences
//
// USER ISOLATION
// ──────────────
// Every query key is namespaced by the signed-in user id, and every query is
// gated on an authenticated session. Combined with the RLS on user_preferences
// (auth.uid() = user_id) one user can neither read nor cache another's settings.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore.js'
import {
  useMyProfileData,
  useUpdateProfile as useUpdateTeamProfile,
  teamKeys,
} from './useTeam.js'
import {
  getCompanySettings,
  saveCompanySettings,
  getNotificationPrefs,
  saveNotificationPrefs,
  getAppearancePrefs,
  saveAppearancePrefs,
  getSecuritySettings,
  saveSecuritySettings,
  getPreferencesSettings,
  savePreferencesSettings,
  getProfileExtras,
  saveProfileExtras,
  changePasswordService,
} from '../services/settingsService.js'

// ── Query keys ────────────────────────────────────────────────────────────────
// User-scoped so a logout → login as someone else can never serve the previous
// user's settings out of the React Query cache.
export const settingsKeys = {
  all:           ()       => ['settings'],
  profile:       ()       => ['settings', 'profile'],
  profileExtras: (userId) => ['settings', 'profile-extras', userId ?? 'anon'],
  company:       ()       => ['settings', 'company'],
  notifications: (userId) => ['settings', 'notifications', userId ?? 'anon'],
  appearance:    (userId) => ['settings', 'appearance',    userId ?? 'anon'],
  security:      (userId) => ['settings', 'security',      userId ?? 'anon'],
  preferences:   (userId) => ['settings', 'preferences',   userId ?? 'anon'],
}

const STALE = 1000 * 60 * 5 // 5 minutes — settings change rarely

// ── Shared auth accessor ──────────────────────────────────────────────────────
function useSettingsAuth() {
  const userId          = useAuthStore((s) => s.user?.id ?? null)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return { userId, enabled: isAuthenticated && Boolean(userId) }
}

// ── Profile ───────────────────────────────────────────────────────────────────
//
// Composed from two sources: the real profiles row (name, email, phone,
// department, role) and the locale/bio extras stored in user_preferences.
// ProfileSection receives one merged object and is unchanged.
export function useProfileSettings() {
  const { userId, enabled } = useSettingsAuth()
  const base = useMyProfileData()

  const extras = useQuery({
    queryKey:  settingsKeys.profileExtras(userId),
    queryFn:   () => getProfileExtras(userId),
    enabled,
    staleTime: STALE,
  })

  return {
    ...base,
    data: base.data ? { ...base.data, ...(extras.data ?? {}) } : base.data,
    isLoading: base.isLoading || extras.isLoading,
    isError:   base.isError   || extras.isError,
  }
}

/**
 * Save the Profile section.
 * Splits the single form across its two real destinations:
 *   name / department / phone → public.profiles
 *   bio / timezone / language / dateFormat → user_preferences.preferences.profile
 * Email and role stay read-only in the UI and are never written here.
 */
export function useUpdateProfile() {
  const { userId } = useSettingsAuth()
  const teamMutation = useUpdateTeamProfile()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data) => {
      if (!userId) throw new Error('Not authenticated')

      const profileRow = await teamMutation.mutateAsync({
        id: userId,
        data: {
          name:       data.name,
          department: data.department,
          phone:      data.phone,
        },
      })

      const extras = await saveProfileExtras(userId, {
        bio:        data.bio,
        timezone:   data.timezone,
        language:   data.language,
        dateFormat: data.dateFormat,
      })

      return { ...profileRow, ...extras }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.myProfile(userId) })
      qc.invalidateQueries({ queryKey: teamKeys.members() })
      qc.invalidateQueries({ queryKey: settingsKeys.profileExtras(userId) })
      // Preferences shares the JSONB column with profile extras
      qc.invalidateQueries({ queryKey: settingsKeys.preferences(userId) })
    },
    onError: (err) => console.error('[useSettings] profile save failed:', err?.message),
  })
}

// ── Company ───────────────────────────────────────────────────────────────────
// Readable by any authenticated user; writable only by Admin/AGM, enforced by
// RLS on public.company_settings. A rejected write surfaces as a mutation error
// rather than a silent no-op.
export function useCompanySettings() {
  const { enabled } = useSettingsAuth()
  return useQuery({
    queryKey:  settingsKeys.company(),
    queryFn:   getCompanySettings,
    enabled,
    staleTime: STALE,
  })
}

export function useUpdateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveCompanySettings,
    onSuccess: (updated) => {
      qc.setQueryData(settingsKeys.company(), updated)
    },
    onError: (err) => console.error('[useSettings] company save failed:', err?.message),
  })
}

// ── Notifications ─────────────────────────────────────────────────────────────
export function useNotificationSettings() {
  const { userId, enabled } = useSettingsAuth()
  return useQuery({
    queryKey:  settingsKeys.notifications(userId),
    queryFn:   () => getNotificationPrefs(userId),
    enabled,
    staleTime: STALE,
  })
}

export function useUpdateNotifications() {
  const { userId } = useSettingsAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => saveNotificationPrefs(userId, payload),
    onSuccess: (updated) => {
      qc.setQueryData(settingsKeys.notifications(userId), updated)
    },
    onError: (err) => console.error('[useSettings] notification prefs save failed:', err?.message),
  })
}

// ── Appearance ────────────────────────────────────────────────────────────────
export function useAppearanceSettings() {
  const { userId, enabled } = useSettingsAuth()
  return useQuery({
    queryKey:  settingsKeys.appearance(userId),
    queryFn:   () => getAppearancePrefs(userId),
    enabled,
    staleTime: STALE,
  })
}

export function useUpdateAppearance() {
  const { userId } = useSettingsAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => saveAppearancePrefs(userId, payload),
    onSuccess: (updated) => {
      qc.setQueryData(settingsKeys.appearance(userId), updated)
    },
    onError: (err) => console.error('[useSettings] appearance save failed:', err?.message),
  })
}

// ── Security ──────────────────────────────────────────────────────────────────
export function useSecuritySettings() {
  const { userId, enabled } = useSettingsAuth()
  return useQuery({
    queryKey:  settingsKeys.security(userId),
    queryFn:   () => getSecuritySettings(userId),
    enabled,
    staleTime: STALE,
  })
}

export function useUpdateSecurity() {
  const { userId } = useSettingsAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => saveSecuritySettings(userId, payload),
    onSuccess: (updated) => {
      qc.setQueryData(settingsKeys.security(userId), updated)
    },
    onError: (err) => console.error('[useSettings] security prefs save failed:', err?.message),
  })
}

// ── Preferences ───────────────────────────────────────────────────────────────
export function usePreferencesSettings() {
  const { userId, enabled } = useSettingsAuth()
  return useQuery({
    queryKey:  settingsKeys.preferences(userId),
    queryFn:   () => getPreferencesSettings(userId),
    enabled,
    staleTime: STALE,
  })
}

export function useUpdatePreferences() {
  const { userId } = useSettingsAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => savePreferencesSettings(userId, payload),
    onSuccess: (updated) => {
      qc.setQueryData(settingsKeys.preferences(userId), updated)
      // Profile locale/bio lives in the same JSONB column
      qc.invalidateQueries({ queryKey: settingsKeys.profileExtras(userId) })
    },
    onError: (err) => console.error('[useSettings] preferences save failed:', err?.message),
  })
}

// ── Password ──────────────────────────────────────────────────────────────────
// Verifies the current password before applying the new one, then records the
// change date in the security preferences.
export function useChangePassword() {
  const { userId } = useSettingsAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }) =>
      changePasswordService(currentPassword, newPassword),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.security(userId) })
    },
  })
}
