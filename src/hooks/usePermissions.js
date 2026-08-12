// ─── Permission Hooks ─────────────────────────────────────────────────────────
//
// React hooks that wrap the pure permission functions from lib/permissions.js.
// Components call these hooks — they never call permission functions directly.
//
// All hooks:
//   1. Read the current user from authStore (reactive, always fresh)
//   2. Read subordinate names from useMySubordinates (from team hierarchy)
//   3. Return a stable permissions object
//
// Performance: useMySubordinates reads from the team members React Query cache
// (staleTime: 10 min) — no extra Supabase queries per component.

import { useAuthStore }      from '../stores/authStore.js'
import { useMySubordinates } from './useTeam.js'
import {
  getLeadPermissions,
  getTaskPermissions,
  getMeetingPermissions,
  getOpportunityPermissions,
  getContactPermissions,
  getSettingsPermissions,
  canManageUser,
  isSuperUser,
  isManager,
} from '../lib/permissions.js'

// ── Shared subordinate name resolver ─────────────────────────────────────────
// Returns the display names of all subordinates for the current user.
// Memoised by React Query — one cache entry, zero extra fetches.
function useSubordinateNames() {
  const subs = useMySubordinates()   // returns Member[]
  return subs.map((m) => m.name).filter(Boolean)
}

// ── Module-level permission hooks ─────────────────────────────────────────────

/** Permissions for a single lead record */
export function useLeadPermissions(lead) {
  const user  = useAuthStore((s) => s.user)
  const subs  = useSubordinateNames()
  return getLeadPermissions(user, lead, subs)
}

/** Permissions for a single task record */
export function useTaskPermissions(task) {
  const user  = useAuthStore((s) => s.user)
  const subs  = useSubordinateNames()
  return getTaskPermissions(user, task, subs)
}

/** Permissions for a single meeting record */
export function useMeetingPermissions(meeting) {
  const user  = useAuthStore((s) => s.user)
  const subs  = useSubordinateNames()
  return getMeetingPermissions(user, meeting, subs)
}

/** Permissions for a single opportunity record */
export function useOpportunityPermissions(opp) {
  const user  = useAuthStore((s) => s.user)
  const subs  = useSubordinateNames()
  return getOpportunityPermissions(user, opp, subs)
}

/** Permissions for a single contact record */
export function useContactPermissions(contact) {
  const user  = useAuthStore((s) => s.user)
  const subs  = useSubordinateNames()
  return getContactPermissions(user, contact, subs)
}

/** Global settings/admin permissions — no record needed */
export function useSettingsPermissions() {
  const user = useAuthStore((s) => s.user)
  return getSettingsPermissions(user)
}

/** Whether the current user can manage another team member */
export function useCanManageUser(targetMember) {
  const user = useAuthStore((s) => s.user)
  return canManageUser(user, targetMember)
}

/** True if current user is Admin or AGM */
export function useIsSuperUser() {
  const user = useAuthStore((s) => s.user)
  return isSuperUser(user)
}

/** True if current user is Manager or above */
export function useIsManager() {
  const user = useAuthStore((s) => s.user)
  return isManager(user)
}

// ── Batch permission hook — avoids calling useMySubordinates N times ──────────
// Use this in list/table components where you need permissions for many records.
//
// Usage:
//   const { canEditRecord, canDeleteRecord } = useBatchLeadPermissions()
//   rows.map(lead => ({ ...lead, canEdit: canEditRecord(lead) }))
export function useBatchLeadPermissions() {
  const user  = useAuthStore((s) => s.user)
  const subs  = useSubordinateNames()
  return {
    canEditRecord:   (lead)    => getLeadPermissions(user, lead, subs).canEdit,
    canDeleteRecord: (lead)    => getLeadPermissions(user, lead, subs).canDelete,
    canChangeStage:  (lead)    => getLeadPermissions(user, lead, subs).canChangeStage,
    getPermissions:  (lead)    => getLeadPermissions(user, lead, subs),
  }
}

export function useBatchTaskPermissions() {
  const user  = useAuthStore((s) => s.user)
  const subs  = useSubordinateNames()
  return {
    canEditRecord:   (task) => getTaskPermissions(user, task, subs).canEdit,
    canDeleteRecord: (task) => getTaskPermissions(user, task, subs).canDelete,
    canToggle:       (task) => getTaskPermissions(user, task, subs).canToggle,
    getPermissions:  (task) => getTaskPermissions(user, task, subs),
  }
}

export function useBatchMeetingPermissions() {
  const user  = useAuthStore((s) => s.user)
  const subs  = useSubordinateNames()
  return {
    canEditRecord:   (m) => getMeetingPermissions(user, m, subs).canEdit,
    canDeleteRecord: (m) => getMeetingPermissions(user, m, subs).canDelete,
    getPermissions:  (m) => getMeetingPermissions(user, m, subs),
  }
}

export function useBatchOpportunityPermissions() {
  const user  = useAuthStore((s) => s.user)
  const subs  = useSubordinateNames()
  return {
    canEditRecord:   (o) => getOpportunityPermissions(user, o, subs).canEdit,
    canDeleteRecord: (o) => getOpportunityPermissions(user, o, subs).canDelete,
    canChangeStage:  (o) => getOpportunityPermissions(user, o, subs).canChangeStage,
    getPermissions:  (o) => getOpportunityPermissions(user, o, subs),
  }
}
