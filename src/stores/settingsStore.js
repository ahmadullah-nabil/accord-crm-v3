import { create } from 'zustand'

// UI-only state for the Settings module.
// All server/settings data lives in React Query (useSettings.js hooks).
export const useSettingsStore = create((set) => ({
  // ── Active section ─────────────────────────────────────────────────────────
  activeSection: 'profile',
  setActiveSection: (section) => set({ activeSection: section }),
}))
