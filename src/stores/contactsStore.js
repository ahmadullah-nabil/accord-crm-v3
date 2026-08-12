import { create } from 'zustand'

// UI-only state for the Contacts module.
// Server data lives in React Query (useContacts / useContact hooks).
export const useContactsStore = create((set, get) => ({
  // ── Filters ────────────────────────────────────────────────────────────────
  searchQuery:    '',
  typeFilter:     'All',
  statusFilter:   'All',
  assigneeFilter: 'All',
  sortField:      'lastActivity',
  sortDir:        'desc',

  // ── UI state ───────────────────────────────────────────────────────────────
  selectedContactId: null,
  detailPanelOpen:   false,
  addModalOpen:      false,
  editModalOpen:     false,

  // ── Filter actions ─────────────────────────────────────────────────────────
  setSearchQuery:    (q) => set({ searchQuery: q }),
  setTypeFilter:     (t) => set({ typeFilter: t }),
  setStatusFilter:   (s) => set({ statusFilter: s }),
  setAssigneeFilter: (a) => set({ assigneeFilter: a }),

  setSort: (field) =>
    set((s) => ({
      sortField: field,
      sortDir: s.sortField === field && s.sortDir === 'asc' ? 'desc' : 'asc',
    })),

  clearFilters: () =>
    set({ searchQuery: '', typeFilter: 'All', statusFilter: 'All', assigneeFilter: 'All' }),

  // ── Panel / modal actions ──────────────────────────────────────────────────
  openDetail:  (id) => set({ selectedContactId: id, detailPanelOpen: true }),
  closeDetail: ()   => set({ detailPanelOpen: false, selectedContactId: null }),

  openAddModal:  ()   => set({ addModalOpen: true }),
  closeAddModal: ()   => set({ addModalOpen: false }),

  openEditModal:  (id) => set({ editModalOpen: true, selectedContactId: id }),
  closeEditModal: ()   => set({ editModalOpen: false }),

  // ── Client-side filter + sort (applied over React Query data) ─────────────
  applyFilters: (contacts = []) => {
    const { searchQuery, typeFilter, statusFilter, assigneeFilter, sortField, sortDir } = get()

    let result = contacts.filter((c) => {
      const q = searchQuery.toLowerCase()
      if (
        q &&
        !c.name.toLowerCase().includes(q) &&
        !c.company.toLowerCase().includes(q) &&
        !c.email.toLowerCase().includes(q) &&
        !(c.designation || '').toLowerCase().includes(q)
      ) return false
      if (typeFilter     !== 'All' && c.type     !== typeFilter)     return false
      if (statusFilter   !== 'All' && c.status   !== statusFilter)   return false
      if (assigneeFilter !== 'All' && c.assignee !== assigneeFilter) return false
      return true
    })

    result.sort((a, b) => {
      let av = a[sortField] ?? ''
      let bv = b[sortField] ?? ''
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1  : -1
      return 0
    })

    return result
  },
}))
