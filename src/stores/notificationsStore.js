import { create } from 'zustand'

// UI-only state for the Notifications module.
// All notification data lives in React Query (useNotifications hooks).
export const useNotificationsStore = create((set, get) => ({
  // ── Filters ────────────────────────────────────────────────────────────────
  searchQuery:      '',
  categoryFilter:   'All',
  readFilter:       'All',   // 'All' | 'Unread' | 'Read'

  // ── UI state ───────────────────────────────────────────────────────────────
  selectedNotifId:  null,
  detailPanelOpen:  false,

  // ── Filter actions ─────────────────────────────────────────────────────────
  setSearchQuery:    (q) => set({ searchQuery: q }),
  setCategoryFilter: (c) => set({ categoryFilter: c }),
  setReadFilter:     (r) => set({ readFilter: r }),

  clearFilters: () =>
    set({ searchQuery: '', categoryFilter: 'All', readFilter: 'All' }),

  // ── Panel actions ──────────────────────────────────────────────────────────
  openDetail:  (id) => set({ selectedNotifId: id, detailPanelOpen: true }),
  closeDetail: ()   => set({ detailPanelOpen: false, selectedNotifId: null }),

  // ── Client-side filter (applied over React Query data) ────────────────────
  applyFilters: (notifications = []) => {
    const { searchQuery, categoryFilter, readFilter } = get()

    return notifications.filter((n) => {
      const q = searchQuery.toLowerCase()
      // Search across the fields the Supabase row actually provides. `subject`
      // was referenced here but is not part of the notifications schema or the
      // service mapper, so every keystroke threw a TypeError on undefined.
      // Every field is coalesced so a NULL column can never crash the filter.
      if (
        q &&
        !String(n.title ?? '').toLowerCase().includes(q) &&
        !String(n.body  ?? '').toLowerCase().includes(q) &&
        !String(n.actor ?? '').toLowerCase().includes(q)
      ) return false

      if (categoryFilter !== 'All' && n.category !== categoryFilter) return false

      if (readFilter === 'Unread' && n.isRead)  return false
      if (readFilter === 'Read'   && !n.isRead) return false

      return true
    })
  },
}))
