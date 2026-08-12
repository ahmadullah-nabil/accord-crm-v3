// ─── Opportunities UI Store ───────────────────────────────────────────────────
// UI-only state — all server data lives in React Query (useOpportunities hooks).
import { create } from 'zustand'

export const OPPORTUNITY_STAGES = ['New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']

export const OPP_STAGE_COLORS = {
  New:         { bg: 'bg-blue-500',    light: 'bg-blue-50 text-blue-700'       },
  Qualified:   { bg: 'bg-teal-500',    light: 'bg-teal-50 text-teal-700'       },
  Proposal:    { bg: 'bg-amber-500',   light: 'bg-amber-50 text-amber-700'     },
  Negotiation: { bg: 'bg-orange-500',  light: 'bg-orange-50 text-orange-700'   },
  Won:         { bg: 'bg-emerald-500', light: 'bg-emerald-50 text-emerald-700' },
  Lost:        { bg: 'bg-red-500',     light: 'bg-red-50 text-red-700'         },
}

export const PROBABILITY_BY_STAGE = {
  New: 10, Qualified: 30, Proposal: 50, Negotiation: 70, Won: 100, Lost: 0,
}

export const useOpportunitiesStore = create((set, get) => ({
  // Filters
  searchQuery:    '',
  stageFilter:    'All',
  assigneeFilter: 'All',
  sortField:      'lastActivity',
  sortDir:        'desc',
  viewMode:       'kanban',   // 'kanban' | 'table'

  // UI state
  selectedOppId:  null,
  detailPanelOpen: false,
  addModalOpen:    false,
  editModalOpen:   false,
  prefillData:     null,

  // Filter actions
  setSearchQuery:    (q) => set({ searchQuery: q }),
  setStageFilter:    (s) => set({ stageFilter: s }),
  setAssigneeFilter: (a) => set({ assigneeFilter: a }),
  setViewMode:       (m) => set({ viewMode: m }),
  setSort: (field) =>
    set((s) => ({
      sortField: field,
      sortDir: s.sortField === field && s.sortDir === 'asc' ? 'desc' : 'asc',
    })),
  clearFilters: () => set({ searchQuery: '', stageFilter: 'All', assigneeFilter: 'All' }),

  // Panel / modal
  openDetail:     (id) => set({ selectedOppId: id, detailPanelOpen: true }),
  closeDetail:    ()   => set({ detailPanelOpen: false, selectedOppId: null }),
  openAddModal:   ()   => set({ addModalOpen: true, prefillData: null }),
  closeAddModal:  ()   => set({ addModalOpen: false, prefillData: null }),
  openEditModal:  (id) => set({ editModalOpen: true, selectedOppId: id }),
  closeEditModal: ()   => set({ editModalOpen: false }),
  openAddModalWithPrefill: (data) => set({ addModalOpen: true, prefillData: data }),

  // Client-side filter
  applyFilters: (opps = []) => {
    const { searchQuery, stageFilter, assigneeFilter, sortField, sortDir } = get()
    let result = opps.filter((o) => {
      const q = searchQuery.toLowerCase()
      if (q && !o.title.toLowerCase().includes(q) &&
          !o.company.toLowerCase().includes(q)) return false
      if (stageFilter    !== 'All' && o.stage    !== stageFilter)    return false
      if (assigneeFilter !== 'All' && o.assignee !== assigneeFilter) return false
      return true
    })
    result.sort((a, b) => {
      let av = a[sortField] ?? '', bv = b[sortField] ?? ''
      if (sortField === 'value' || sortField === 'probability') {
        av = Number(av); bv = Number(bv)
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1  : -1
      return 0
    })
    return result
  },
}))
