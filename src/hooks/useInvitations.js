// ─── Invitation hooks ─────────────────────────────────────────────────────────
//
// queryKey: ['invitations'] and ['membership', 'status']
//
// Adding someone to the CRM writes an invitation; the person signs up and a
// database trigger turns it into a membership. See invitationService.js for
// why it is not a direct signUp any more.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore.js'
import {
  listInvitations,
  inviteUser,
  revokeInvitation,
  renewInvitation,
  getMembershipStatus,
} from '../services/invitationService.js'
import { userMgmtKeys } from './useUserManagement.js'
import { teamKeys }     from './useTeam.js'

export const invitationKeys = {
  all:              () => ['invitations'],
  membershipStatus: () => ['membership', 'status'],
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export function useInvitations() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey: invitationKeys.all(),
    queryFn:  listInvitations,
    enabled:  isAuthenticated,
    staleTime: 30_000,
    // RLS returns nothing for a non-admin rather than erroring, so a plain
    // empty list is the correct result for most users — no error state needed.
    placeholderData: [],
  })
}

/**
 * Whether the current user belongs to any organisation.
 *
 * `retry: false` is deliberate. If this fails there is no org and no amount of
 * retrying produces one; retrying just delays the screen that explains the
 * situation, which is the only useful thing left to show.
 *
 * staleTime is short because the fix for "no membership" is usually an admin
 * inviting you and you signing out and in — a stale cached "no" would survive
 * the fix and look like it did not work.
 */
export function useMembershipStatus() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey:  invitationKeys.membershipStatus(),
    queryFn:   getMembershipStatus,
    enabled:   isAuthenticated,
    staleTime: 10_000,
    retry:     false,
  })
}

// ── Writes ────────────────────────────────────────────────────────────────────

export function useInviteUser() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: inviteUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invitationKeys.all() })
      // The invited person is NOT a user yet — no auth account exists until
      // they sign up. The user list and assignee roster deliberately do not
      // change here. Invalidating them would be a lie that resolves to the
      // same data and teaches nobody anything.
    },
  })
}

export function useRevokeInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: revokeInvitation,
    onSuccess: () => qc.invalidateQueries({ queryKey: invitationKeys.all() }),
  })
}

export function useRenewInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: renewInvitation,
    onSuccess: () => qc.invalidateQueries({ queryKey: invitationKeys.all() }),
  })
}

/**
 * Called after a person accepts and appears for real. Not wired to anything
 * automatic: nothing in the browser can observe someone else completing a
 * signup, so the roster refreshes when an admin reloads or on staleTime.
 * Exported so the Users page can offer a refresh that actually refreshes.
 */
export function useRefreshRoster() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: userMgmtKeys.workspace() })
    qc.invalidateQueries({ queryKey: teamKeys.members() })
    qc.invalidateQueries({ queryKey: invitationKeys.all() })
  }
}
