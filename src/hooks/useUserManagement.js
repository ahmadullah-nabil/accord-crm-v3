// ─── User Management React Query Hooks ───────────────────────────────────────
//
// Admin-only hooks. Components must be behind an Admin ProtectedRoute guard.
// All mutations optimistically update the local cache, then confirm from DB.
//
// queryKey: ['users', 'workspace']

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore.js'
import {
  listWorkspaceUsers,
  updateUserRole,
  updateUserManager,
  updateUserDepartment,
  setUserActive,
  updateUserName,
  createWorkspaceUser,
} from '../services/userManagementService.js'
import { teamKeys } from './useTeam.js'

export const userMgmtKeys = {
  workspace: () => ['users', 'workspace'],
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function useWorkspaceUsers() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey:    userMgmtKeys.workspace(),
    queryFn:     listWorkspaceUsers,
    staleTime:   1000 * 60,    // 1 min
    enabled:     isAuthenticated,
    placeholderData: [],
  })
}

// ── Shared optimistic patch helper ────────────────────────────────────────────
function usePatchUser(mutationFn) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn,
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: userMgmtKeys.workspace() })
      const previous = qc.getQueryData(userMgmtKeys.workspace())

      qc.setQueryData(userMgmtKeys.workspace(), (old = []) =>
        old.map((u) => u.id === id ? { ...u, ...patch } : u)
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(userMgmtKeys.workspace(), ctx.previous)
    },
    onSuccess: (updated, { id }) => {
      if (updated) {
        qc.setQueryData(userMgmtKeys.workspace(), (old = []) =>
          old.map((u) => u.id === id ? updated : u)
        )
      }
    },
    onSettled: () => {
      // Sync the shared team cache so dropdowns update immediately
      qc.invalidateQueries({ queryKey: userMgmtKeys.workspace() })
      qc.invalidateQueries({ queryKey: teamKeys.members() })
    },
  })
}

// ── Individual mutation hooks ─────────────────────────────────────────────────

export function useUpdateUserRole() {
  return usePatchUser(({ id, role }) => updateUserRole(id, role))
}

export function useUpdateUserManager() {
  return usePatchUser(({ id, managerId }) => updateUserManager(id, managerId))
}

export function useUpdateUserDepartment() {
  return usePatchUser(({ id, department }) => updateUserDepartment(id, department))
}

export function useSetUserActive() {
  return usePatchUser(({ id, isActive }) => setUserActive(id, isActive))
}

export function useUpdateUserName() {
  return usePatchUser(({ id, name }) => updateUserName(id, name))
}

// ── useCreateUser ─────────────────────────────────────────────────────────────
// Creates a new auth user + profile, then prepends them to both workspace
// and team caches so they appear immediately everywhere.
export function useCreateUser() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (payload) => createWorkspaceUser(payload),
    onSuccess: (newUser) => {
      if (!newUser) return
      // Prepend to workspace cache
      qc.setQueryData(userMgmtKeys.workspace(), (old = []) => {
        const without = old.filter((u) => u.id !== newUser.id)
        return [newUser, ...without]
      })
    },
    onSettled: () => {
      // Full re-fetch so both caches are consistent
      qc.invalidateQueries({ queryKey: userMgmtKeys.workspace() })
      qc.invalidateQueries({ queryKey: teamKeys.members() })
    },
  })
}
