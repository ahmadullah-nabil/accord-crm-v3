import { create } from 'zustand'
import { useAuthStore } from './authStore.js'
import {
  getLeads,
  insertLead,
  patchLead,
  patchLeadStage,
  removeLead,
} from '../services/leadsService.js'
import { logActivity, ACTIVITY_TYPES } from '../services/activityService.js'
import {
  notifyLeadAssignment,
  resolveNotificationRecipient,
} from '../services/notificationsService.js'
import { ownershipStamp, TEAM_MEMBER_NAMES } from '../lib/users.js'

// ─── Store ────────────────────────────────────────────────────────────────────
//
// Architecture note
// ─────────────────
// The Leads module uses Zustand as both UI state and server cache — unlike
// Contacts/Tasks/Meetings which use React Query for server state.
// This store preserves the identical public API the UI components depend on
// (leads array, addLead, updateLead, updateStage, deleteLead, getFilteredLeads,
// getSelectedLead, plus all filter/sort/UI state actions).
//
// Supabase integration is wired in the four mutating actions (addLead,
// updateLead, updateStage, deleteLead) and the new initialize() action.
// All operations are optimistic: state updates happen immediately so the UI
// feels instant, then the Supabase call is awaited. On failure, isLoading
// is cleared and a console error is logged (errors propagate to callers).

export const useLeadsStore = create((set, get) => ({
  // ── Server state ───────────────────────────────────────────────────────────
  leads:     [],
  isLoading: false,
  error:     null,

  // ── Filter state ───────────────────────────────────────────────────────────
  searchQuery:    '',
  stageFilter:    'All',
  priorityFilter: 'All',
  sourceFilter:   'All',
  assigneeFilter: 'All',
  sortField:      'lastActivity',
  sortDir:        'desc',

  // ── UI state ───────────────────────────────────────────────────────────────
  viewMode:      'table',   // 'table' | 'kanban'
  selectedLeadId: null,
  detailPanelOpen: false,
  addModalOpen:    false,
  editModalOpen:   false,

  // ── Initialize — fetch all leads from Supabase ─────────────────────────────
  // Called once from LeadsPage on mount (after auth is confirmed).
  initialize: async () => {
    const { isAuthenticated } = useAuthStore.getState()
    if (!isAuthenticated) return

    set({ isLoading: true, error: null })
    try {
      const leads = await getLeads()
      set({ leads, isLoading: false })
    } catch (err) {
      console.error('[leadsStore] initialize failed:', err)
      set({ isLoading: false, error: err.message ?? 'Failed to load leads.' })
    }
  },

  // ── Filter actions ─────────────────────────────────────────────────────────
  setSearchQuery:    (q) => set({ searchQuery: q }),
  setStageFilter:    (s) => set({ stageFilter: s }),
  setPriorityFilter: (p) => set({ priorityFilter: p }),
  setSourceFilter:   (s) => set({ sourceFilter: s }),
  setAssigneeFilter: (a) => set({ assigneeFilter: a }),
  setViewMode:       (m) => set({ viewMode: m }),

  setSort: (field) =>
    set((s) => ({
      sortField: field,
      sortDir: s.sortField === field && s.sortDir === 'asc' ? 'desc' : 'asc',
    })),

  // ── Panel / modal actions ──────────────────────────────────────────────────
  openDetail:     (id) => set({ selectedLeadId: id, detailPanelOpen: true }),
  closeDetail:    ()   => set({ detailPanelOpen: false, selectedLeadId: null }),
  openAddModal:   ()   => set({ addModalOpen: true }),
  closeAddModal:  ()   => set({ addModalOpen: false }),
  openEditModal:  (id) => set({ editModalOpen: true, selectedLeadId: id }),
  closeEditModal: ()   => set({ editModalOpen: false }),

  clearFilters: () =>
    set({
      searchQuery:    '',
      stageFilter:    'All',
      priorityFilter: 'All',
      sourceFilter:   'All',
      assigneeFilter: 'All',
    }),

  // ── addLead ────────────────────────────────────────────────────────────────
  // Optimistic: close modal and prepend a placeholder immediately.
  // On Supabase success: replace the placeholder with the real row (with UUID).
  addLead: async (data) => {
    set({ addModalOpen: false })

    try {
      const authUser = useAuthStore.getState().user
      const { createdBy, ownerId } = ownershipStamp(authUser)

      const created = await insertLead({
        ...data,
        tags:      data.tags  || [],
        notes:     data.notes || '',
        createdBy,
        ownerId,
      })
      // Prepend the real row returned by Supabase (has the real UUID)
      set((s) => ({ leads: [created, ...s.leads] }))

      // Fire-and-forget activity log — never blocks or rolls back on failure
      const actor = useAuthStore.getState().user?.name ?? 'Unknown'
      const actorId = useAuthStore.getState().user?.id ?? null
      logActivity({
        type:        ACTIVITY_TYPES.LEAD_CREATED,
        actor,
        actorId,
        action:      'created lead',
        subject:     created.company || created.name,
        detail:      `${created.name} · ${created.stage}`,
        entityType:  'lead',
        entityId:    created.id,
        entityLabel: created.name,
      })

      // Notify the assignee. Runs only after the Supabase insert resolved, so a
      // failed create can never produce a notification. Fire-and-forget: a
      // notification failure must not surface as a lead-creation failure.
      resolveNotificationRecipient(created.assignee, actorId)
        .then((recipientId) => {
          if (!recipientId) return          // unassigned, unknown, or self
          return notifyLeadAssignment({
            recipientId,
            actorName: actor,
            actorId,
            leadName:  created.company || created.name,
            leadId:    created.id,
          })
        })
        .catch((err) => console.warn('[leadsStore] lead assignment notify failed:', err?.message))
    } catch (err) {
      console.error('[leadsStore] addLead failed:', err)
      // Re-open the modal so the user can retry
      set({ addModalOpen: true, error: err.message ?? 'Failed to create lead.' })
    }
  },

  // ── updateLead ────────────────────────────────────────────────────────────
  // Optimistic: update in-place immediately, then persist to Supabase.
  updateLead: async (id, data) => {
    const today = new Date().toISOString().split('T')[0]

    // Captured BEFORE the optimistic write so the post-save comparison sees the
    // true previous assignee, not the one we just painted into local state.
    const previousAssignee = get().leads.find((l) => l.id === id)?.assignee ?? ''

    // Optimistic update — UI reflects change immediately
    set((s) => ({
      leads: s.leads.map((l) =>
        l.id === id ? { ...l, ...data, lastActivity: today } : l
      ),
      editModalOpen: false,
    }))

    try {
      const updated = await patchLead(id, data)
      // Replace the optimistic record with the Supabase-confirmed version
      set((s) => ({
        leads: s.leads.map((l) => (l.id === id ? updated : l)),
      }))

      // Reassignment is the notifiable event. An edit that leaves the assignee
      // untouched (renaming the company, changing priority) notifies nobody.
      if (updated.assignee && updated.assignee !== previousAssignee) {
        const authUser = useAuthStore.getState().user
        const actorId  = authUser?.id   ?? null
        const actor    = authUser?.name ?? 'Unknown'

        resolveNotificationRecipient(updated.assignee, actorId)
          .then((recipientId) => {
            if (!recipientId) return
            return notifyLeadAssignment({
              recipientId,
              actorName: actor,
              actorId,
              leadName:  updated.company || updated.name,
              leadId:    updated.id,
            })
          })
          .catch((err) => console.warn('[leadsStore] lead reassignment notify failed:', err?.message))
      }
    } catch (err) {
      console.error('[leadsStore] updateLead failed:', err)
      // Reload to restore accurate state
      try {
        const leads = await getLeads()
        set({ leads, editModalOpen: true, error: err.message ?? 'Failed to update lead.' })
      } catch { /* ignore secondary failure */ }
    }
  },

  // ── updateStage ───────────────────────────────────────────────────────────
  // Called from the inline stage dropdown and kanban drag-drop.
  // Optimistic: update in-place, then persist.
  updateStage: async (id, stage) => {
    const today = new Date().toISOString().split('T')[0]

    // Optimistic
    set((s) => ({
      leads: s.leads.map((l) =>
        l.id === id ? { ...l, stage, lastActivity: today } : l
      ),
    }))

    try {
      const updated = await patchLeadStage(id, stage)
      set((s) => ({
        leads: s.leads.map((l) => (l.id === id ? updated : l)),
      }))

      // Fire-and-forget activity log
      const actor = useAuthStore.getState().user?.name ?? 'Unknown'
      const actorId = useAuthStore.getState().user?.id ?? null
      logActivity({
        type:        ACTIVITY_TYPES.LEAD_STAGE_CHANGED,
        actor,
        actorId,
        action:      `moved to ${stage}`,
        subject:     updated.company || updated.name,
        detail:      `${updated.name} · stage: ${stage}`,
        entityType:  'lead',
        entityId:    id,
        entityLabel: updated.name,
      })
    } catch (err) {
      console.error('[leadsStore] updateStage failed:', err)
      // Reload to restore the actual stage from DB
      try {
        const leads = await getLeads()
        set({ leads })
      } catch { /* ignore */ }
    }
  },

  // ── deleteLead ────────────────────────────────────────────────────────────
  // Optimistic: remove immediately, then delete from Supabase.
  deleteLead: async (id) => {
    // Snapshot for rollback
    const previous = get().leads

    // Optimistic removal + close detail panel if it was open for this lead
    set((s) => ({
      leads: s.leads.filter((l) => l.id !== id),
      detailPanelOpen: s.selectedLeadId === id ? false : s.detailPanelOpen,
      selectedLeadId:  s.selectedLeadId === id ? null  : s.selectedLeadId,
    }))

    try {
      await removeLead(id)
    } catch (err) {
      console.error('[leadsStore] deleteLead failed:', err)
      // Roll back — restore the snapshot
      set({ leads: previous })
    }
  },

  // ── Derived: filtered + sorted leads ──────────────────────────────────────
  // Pure selector — reads from the store, returns a derived array.
  getFilteredLeads: () => {
    const {
      leads, searchQuery, stageFilter, priorityFilter,
      sourceFilter, assigneeFilter, sortField, sortDir,
    } = get()

    let result = leads.filter((l) => {
      const q = searchQuery.toLowerCase()
      if (q && !l.name.toLowerCase().includes(q) &&
          !l.company.toLowerCase().includes(q) &&
          !l.email.toLowerCase().includes(q)) return false
      if (stageFilter    !== 'All' && l.stage    !== stageFilter)    return false
      if (priorityFilter !== 'All' && l.priority !== priorityFilter) return false
      if (sourceFilter   !== 'All' && l.source   !== sourceFilter)   return false
      if (assigneeFilter !== 'All' && l.assignee !== assigneeFilter) return false
      return true
    })

    result.sort((a, b) => {
      let av = a[sortField] ?? ''
      let bv = b[sortField] ?? ''
      if (sortField === 'value') { av = Number(av); bv = Number(bv) }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1  : -1
      return 0
    })

    return result
  },

  getSelectedLead: () => {
    const { leads, selectedLeadId } = get()
    return leads.find((l) => l.id === selectedLeadId) || null
  },
}))

// ─── Domain Constants ─────────────────────────────────────────────────────────
// Kept here so all components can import from a single location.

export const STAGES     = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']
export const PRIORITIES = ['High', 'Medium', 'Low']
export const SOURCES    = ['Referral', 'Website', 'Cold Call', 'LinkedIn', 'Partner', 'Trade Show']
// Derived from the central team registry in lib/users.js
export const ASSIGNEES  = TEAM_MEMBER_NAMES

export const STAGE_COLORS = {
  New:         { badge: 'New',         bg: 'bg-blue-500',    light: 'bg-blue-50 text-blue-700'       },
  Contacted:   { badge: 'Contacted',   bg: 'bg-indigo-500',  light: 'bg-indigo-50 text-indigo-700'   },
  Qualified:   { badge: 'Qualified',   bg: 'bg-teal-500',    light: 'bg-teal-50 text-teal-700'       },
  Proposal:    { badge: 'Proposal',    bg: 'bg-amber-500',   light: 'bg-amber-50 text-amber-700'     },
  Negotiation: { badge: 'Negotiation', bg: 'bg-orange-500',  light: 'bg-orange-50 text-orange-700'   },
  Won:         { badge: 'Won',         bg: 'bg-emerald-500', light: 'bg-emerald-50 text-emerald-700' },
  Lost:        { badge: 'Lost',        bg: 'bg-red-500',     light: 'bg-red-50 text-red-700'         },
}

export const PRIORITY_COLORS = {
  High:   'bg-red-50 text-red-700',
  Medium: 'bg-amber-50 text-amber-700',
  Low:    'bg-gray-100 text-gray-600',
}
