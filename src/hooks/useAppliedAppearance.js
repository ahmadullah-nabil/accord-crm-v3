// ─── Applied Appearance ───────────────────────────────────────────────────────
//
// Bridges the persisted appearance preference to the live DOM.
//
// Mounted ONCE, in AppLayout — the same place useIntelligence and
// useNotificationsRealtime mount. Do not mount it anywhere else; a second mount
// would register a duplicate OS-theme listener.
//
// Responsibilities
//   • apply theme / accent / font size / density / hover / animations after login
//   • re-apply the moment the user saves a change (React Query cache → DOM)
//   • mirror to localStorage so the next cold start paints without a flash
//   • keep 'system' live by listening to prefers-color-scheme
//   • reset to defaults and clear the mirror on logout, so the next user on this
//     browser never inherits the previous user's theme

import { useEffect, useRef } from 'react'
import { useAuthStore } from '../stores/authStore.js'
import { useAppearanceSettings } from './useSettings.js'
import {
  applyAppearance,
  cacheAppearance,
  clearAppearance,
  watchSystemTheme,
  normalizeAppearance,
} from '../lib/appearance.js'

export function useAppliedAppearance() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const userId          = useAuthStore((s) => s.user?.id ?? null)
  const { data: appearance } = useAppearanceSettings()

  // Read by the media-query listener without re-subscribing on every change
  const themePrefRef = useRef('light')

  // Apply whenever the stored preference resolves or changes
  useEffect(() => {
    if (!isAuthenticated) return
    if (!appearance) return

    const applied = applyAppearance(appearance)
    themePrefRef.current = applied.theme
    // Scoped to the owning user so the next cold start cannot paint someone
    // else's theme (see readCachedAppearance in lib/appearance.js).
    cacheAppearance(applied, userId)
  }, [isAuthenticated, userId, appearance])

  // Reset on logout
  useEffect(() => {
    if (isAuthenticated) return
    themePrefRef.current = 'light'
    clearAppearance()
  }, [isAuthenticated])

  // Live OS theme following for 'system' mode — registered once
  useEffect(() => watchSystemTheme(() => themePrefRef.current), [])
}

/**
 * Apply an appearance object immediately without saving it.
 * Used by AppearanceSection so Light/Dark/System, accent, font size and density
 * take effect the instant they are clicked — Cancel restores the saved values.
 */
export function previewAppearance(partial) {
  return applyAppearance(normalizeAppearance(partial))
}
