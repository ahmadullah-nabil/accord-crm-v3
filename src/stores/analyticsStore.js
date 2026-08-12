import { create } from 'zustand'

// UI-only state for the Analytics module.
// All data/server state lives in React Query (useAnalytics.js hooks).
export const useAnalyticsStore = create((set) => ({
  // ── Date range ─────────────────────────────────────────────────────────────
  selectedRange: '30d',
  setRange: (range) => set({ selectedRange: range }),
}))
