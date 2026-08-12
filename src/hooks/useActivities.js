// ─── Activity React Query Hooks ───────────────────────────────────────────────
//
// Read-only hooks — activities are written by logActivity() calls inside
// leadsStore, useMeetings, and useTasks after their primary mutations succeed.
//
// Cache keys:
//   activityKeys.global()              → full recent feed (dashboard)
//   activityKeys.entity(type, id)      → per-entity timeline (lead panel)
//
// Both keys are invalidated after any mutation that calls logActivity().

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore }             from '../stores/authStore.js'
import {
  getActivities,
  getActivitiesForEntity,
} from '../services/activityService.js'

// ── Query keys ────────────────────────────────────────────────────────────────
export const activityKeys = {
  global:  ()               => ['activities'],
  entity:  (type, id)       => ['activities', type, id],
}

// ── Helper called by mutation hooks after logActivity() ───────────────────────
// Invalidates both the global feed and the per-entity timeline so they
// refetch and show the new event.
export function useInvalidateActivities() {
  const qc = useQueryClient()
  return (entityType, entityId) => {
    qc.invalidateQueries({ queryKey: activityKeys.global() })
    if (entityType && entityId) {
      qc.invalidateQueries({ queryKey: activityKeys.entity(entityType, entityId) })
    }
  }
}

// ── Global activity feed (dashboard) ─────────────────────────────────────────
export function useActivities(limit = 50) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey: activityKeys.global(),
    queryFn:  () => getActivities(limit),
    staleTime: 1000 * 30,     // 30 s — activities are time-sensitive
    enabled:   isAuthenticated,
  })
}

// ── Per-entity activity timeline (lead panel, etc.) ───────────────────────────
export function useEntityActivities(entityType, entityId, limit = 30) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey: activityKeys.entity(entityType, entityId),
    queryFn:  () => getActivitiesForEntity(entityType, entityId, limit),
    staleTime: 1000 * 30,
    enabled:   isAuthenticated && Boolean(entityType) && Boolean(entityId),
  })
}
