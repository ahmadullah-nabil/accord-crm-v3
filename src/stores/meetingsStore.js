import { create } from 'zustand'

// UI-only state for the Meetings module.
// All server/data state lives in React Query (useMeetings / useMeeting hooks).
export const useMeetingsStore = create((set, get) => ({
  // ── Filters ────────────────────────────────────────────────────────────────
  searchQuery:     '',
  statusFilter:    'All',
  typeFilter:      'All',
  organizerFilter: 'All',
  sortField:       'scheduledDate',
  sortDir:         'asc',

  // ── UI state ───────────────────────────────────────────────────────────────
  selectedMeetingId: null,
  detailPanelOpen:   false,
  addModalOpen:      false,
  editModalOpen:     false,

  // ── Prefill: used when opening the add modal from another module ───────────
  // MeetingFormModal reads this when it resets for a new meeting (isEdit=false).
  // Set by openAddModalWithPrefill(), cleared by closeAddModal().
  prefillData: null,

  // ── Filter actions ─────────────────────────────────────────────────────────
  setSearchQuery:     (q) => set({ searchQuery: q }),
  setStatusFilter:    (s) => set({ statusFilter: s }),
  setTypeFilter:      (t) => set({ typeFilter: t }),
  setOrganizerFilter: (o) => set({ organizerFilter: o }),

  setSort: (field) =>
    set((s) => ({
      sortField: field,
      sortDir: s.sortField === field && s.sortDir === 'asc' ? 'desc' : 'asc',
    })),

  clearFilters: () =>
    set({
      searchQuery:     '',
      statusFilter:    'All',
      typeFilter:      'All',
      organizerFilter: 'All',
    }),

  // ── Panel / modal actions ──────────────────────────────────────────────────
  openDetail:     (id) => set({ selectedMeetingId: id, detailPanelOpen: true }),
  closeDetail:    ()   => set({ detailPanelOpen: false, selectedMeetingId: null }),

  openAddModal:   ()   => set({ addModalOpen: true, prefillData: null }),
  closeAddModal:  ()   => set({ addModalOpen: false, prefillData: null }),

  openEditModal:  (id) => set({ editModalOpen: true, selectedMeetingId: id }),
  closeEditModal: ()   => set({ editModalOpen: false }),

  // ── openAddModalWithPrefill ────────────────────────────────────────────────
  // Opens the "Schedule Meeting" modal pre-populated with data from another
  // module (e.g. a Lead). The MeetingFormModal reads prefillData in its
  // useEffect when it resets for a new meeting.
  //
  // Usage:
  //   useMeetingsStore.getState().openAddModalWithPrefill({
  //     relatedType:  'Lead',
  //     relatedId:    lead.id,
  //     relatedLabel: `${lead.name} — ${lead.company}`,
  //     participants: [lead.name],
  //     title:        `Meeting — ${lead.company}`,
  //   })
  openAddModalWithPrefill: (data) =>
    set({ addModalOpen: true, prefillData: data }),

  // ── Client-side filter + sort (applied over React Query data) ─────────────
  applyFilters: (meetings = []) => {
    const {
      searchQuery, statusFilter, typeFilter, organizerFilter, sortField, sortDir,
    } = get()

    let result = meetings.filter((m) => {
      const q = searchQuery.toLowerCase()
      if (
        q &&
        !m.title.toLowerCase().includes(q) &&
        !(m.relatedLabel || '').toLowerCase().includes(q) &&
        !(m.organizer || '').toLowerCase().includes(q) &&
        !(m.location || '').toLowerCase().includes(q) &&
        !(m.description || '').toLowerCase().includes(q)
      ) return false
      if (statusFilter    !== 'All' && m.status    !== statusFilter)    return false
      if (typeFilter      !== 'All' && m.type       !== typeFilter)      return false
      if (organizerFilter !== 'All' && m.organizer  !== organizerFilter) return false
      return true
    })

    result.sort((a, b) => {
      let av = a[sortField] ?? ''
      let bv = b[sortField] ?? ''
      if (sortField === 'scheduledDate') {
        av = `${a.scheduledDate || ''}T${a.scheduledTime || '00:00'}`
        bv = `${b.scheduledDate || ''}T${b.scheduledTime || '00:00'}`
        if (!a.scheduledDate) return 1
        if (!b.scheduledDate) return -1
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1  : -1
      return 0
    })

    return result
  },
}))
