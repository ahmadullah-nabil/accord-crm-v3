// ─── Opportunities React Query Hooks ─────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore }         from '../stores/authStore.js'
import { useInvalidateActivities } from './useActivities.js'
import {
  getOpportunities, getOpportunityById,
  insertOpportunity, patchOpportunity,
  patchOpportunityStage, removeOpportunity,
} from '../services/opportunitiesService.js'
import { logActivity, ACTIVITY_TYPES } from '../services/activityService.js'
import {
  notifyOpportunityStageChange,
  resolveNotificationRecipient,
} from '../services/notificationsService.js'
import { ownershipStamp }              from '../lib/users.js'

export const oppKeys = {
  all:    () => ['opportunities'],
  detail: (id) => ['opportunities', id],
}

// ── useOpportunities ──────────────────────────────────────────────────────────
export function useOpportunities() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey: oppKeys.all(),
    queryFn:  getOpportunities,
    staleTime: 1000 * 60 * 2,
    enabled:   isAuthenticated,
  })
}

// ── useOpportunity ────────────────────────────────────────────────────────────
export function useOpportunity(id) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey: oppKeys.detail(id),
    queryFn:  () => getOpportunityById(id),
    enabled:  isAuthenticated && Boolean(id),
    staleTime: 1000 * 60 * 2,
  })
}

// ── Stage-change notification ─────────────────────────────────────────────────
//
// Shared by the two mutations that can move an opportunity's stage, so the
// recipient rules and payload stay identical between them. This is a thin
// dispatcher around the existing notifyOpportunityStageChange helper — it is
// deliberately NOT a second notification helper and creates nothing itself.
//
// Fire-and-forget: a notification failure never surfaces to the user.
function notifyOppStageChange(updated, oldStage) {
  const authUser = useAuthStore.getState().user
  const actorId  = authUser?.id   ?? null
  const actor    = authUser?.name ?? 'Unknown'

  resolveNotificationRecipient(updated.assignee, actorId)
    .then((recipientId) => {
      if (!recipientId) return          // unassigned, unknown, or own deal
      return notifyOpportunityStageChange({
        recipientId,
        actorName: actor,
        actorId,
        oppTitle:  updated.title,
        oppId:     updated.id,
        newStage:  updated.stage,
        oldStage,
      })
    })
    .catch((err) => console.warn('[useOpportunities] stage change notify failed:', err?.message))
}

// ── useCreateOpportunity ──────────────────────────────────────────────────────
export function useCreateOpportunity() {
  const qc            = useQueryClient()
  const invalidateAct = useInvalidateActivities()

  return useMutation({
    mutationFn: (payload) => {
      const authUser = useAuthStore.getState().user
      const { createdBy, ownerId } = ownershipStamp(authUser)
      return insertOpportunity({ ...payload, createdBy, ownerId })
    },
    onSuccess: (opp) => {
      qc.setQueryData(oppKeys.all(), (old = []) => [opp, ...old])
      const authUser = useAuthStore.getState().user
      logActivity({
        type:        ACTIVITY_TYPES.LEAD_CREATED,  // reuse closest type
        actor:       authUser?.name  ?? 'Unknown',
        actorId:     authUser?.id    ?? null,
        action:      'created opportunity',
        subject:     opp.company || opp.title,
        detail:      `${opp.title} · ${opp.stage}`,
        entityType:  'opportunity',
        entityId:    opp.id,
        entityLabel: opp.title,
      }).then(() => invalidateAct('opportunity', opp.id))
    },
    onError: () => { qc.invalidateQueries({ queryKey: oppKeys.all() }) },
  })
}

// ── useUpdateOpportunity ──────────────────────────────────────────────────────
export function useUpdateOpportunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => patchOpportunity(id, data),
    onSuccess: (updated) => {
      // The edit modal exposes a stage <select>, so this generic patch is a
      // SECOND path that can move an opportunity's stage — the kanban drag
      // (useUpdateOpportunityStage) is the first. Both are wired, both compare
      // against the real previous stage, and createNotification's duplicate
      // guard catches any overlap.
      const previousStage =
        (qc.getQueryData(oppKeys.all()) ?? []).find((o) => o.id === updated.id)?.stage ?? null

      qc.setQueryData(oppKeys.all(), (old = []) =>
        old.map((o) => (o.id === updated.id ? updated : o))
      )
      qc.setQueryData(oppKeys.detail(updated.id), updated)

      if (previousStage && updated.stage !== previousStage) {
        notifyOppStageChange(updated, previousStage)
      }
    },
    onError: () => { qc.invalidateQueries({ queryKey: oppKeys.all() }) },
  })
}

// ── useUpdateOpportunityStage ─────────────────────────────────────────────────
export function useUpdateOpportunityStage() {
  const qc            = useQueryClient()
  const invalidateAct = useInvalidateActivities()
  return useMutation({
    mutationFn: ({ id, stage }) => patchOpportunityStage(id, stage),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: oppKeys.all() })
      const previous = qc.getQueryData(oppKeys.all())
      qc.setQueryData(oppKeys.all(), (old = []) =>
        old.map((o) => o.id === id ? { ...o, stage } : o)
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(oppKeys.all(), ctx.previous)
    },
    onSuccess: (updated, _vars, ctx) => {
      qc.setQueryData(oppKeys.all(), (old = []) =>
        old.map((o) => (o.id === updated.id ? updated : o))
      )
      const authUser = useAuthStore.getState().user
      logActivity({
        type:        ACTIVITY_TYPES.LEAD_STAGE_CHANGED,
        actor:       authUser?.name ?? 'Unknown',
        actorId:     authUser?.id   ?? null,
        action:      `moved to ${updated.stage}`,
        subject:     updated.company || updated.title,
        detail:      `${updated.title} · stage: ${updated.stage}`,
        entityType:  'opportunity',
        entityId:    updated.id,
        entityLabel: updated.title,
      }).then(() => invalidateAct('opportunity', updated.id))

      // onMutate already painted the new stage into the list cache, so the old
      // value has to come from the snapshot it stashed in context.
      const previousStage =
        (ctx?.previous ?? []).find((o) => o.id === updated.id)?.stage ?? null

      if (previousStage && updated.stage !== previousStage) {
        notifyOppStageChange(updated, previousStage)
      }
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: oppKeys.all() }) },
  })
}

// ── useDeleteOpportunity ──────────────────────────────────────────────────────
export function useDeleteOpportunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: removeOpportunity,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: oppKeys.all() })
      const previous = qc.getQueryData(oppKeys.all())
      qc.setQueryData(oppKeys.all(), (old = []) => old.filter((o) => o.id !== id))
      return { previous }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(oppKeys.all(), ctx.previous)
    },
    onSettled: (_d, _e, id) => {
      qc.removeQueries({ queryKey: oppKeys.detail(id) })
      qc.invalidateQueries({ queryKey: oppKeys.all() })
    },
  })
}
