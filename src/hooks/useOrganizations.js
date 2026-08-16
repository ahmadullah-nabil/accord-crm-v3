// ─── useOrganizations ─────────────────────────────────────────────────────────
//
// step066. Everything the org switcher and the pending-invitation surface need,
// over the four RPCs 030 added: my_organizations, set_current_org,
// my_pending_invitations, accept_invitation.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ SWITCHING IS TWO STEPS AND BOTH ARE REQUIRED                            │
// ├─────────────────────────────────────────────────────────────────────────┤
// │   1. set_current_org(id)          writes the selection row               │
// │   2. supabase.auth.refreshSession() mints a token carrying the new claim │
// │                                                                          │
// │ Skip step 2 and the row changes while every query keeps filtering by the │
// │ OLD org, because current_org_id() reads the JWT claim first and the old  │
// │ token is still in hand. Nothing errors. The UI shows the new org name    │
// │ over the old org's data, which is the worst possible outcome for a       │
// │ control whose entire job is telling you whose data you are looking at.   │
// │                                                                          │
// │ Then the whole React Query cache is dropped. Not invalidated — REMOVED.  │
// │ Invalidation refetches in the background and leaves the previous org's   │
// │ rows on screen until each query resolves; for a tenant boundary that is  │
// │ a cross-tenant flash, however brief. clear() means the new workspace     │
// │ renders from empty.                                                      │
// └─────────────────────────────────────────────────────────────────────────┘

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient.js'

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(error.message)
  return data
}

/** Every organisation the signed-in user can act in, with `is_current`. */
export function useMyOrganizations() {
  return useQuery({
    queryKey: ['my-organizations'],
    queryFn:  () => rpc('my_organizations'),
    staleTime: 60_000,
  })
}

/** Pending invitations addressed to this account's email, excluding orgs they
 *  are already a member of. */
export function useMyPendingInvitations() {
  return useQuery({
    queryKey: ['my-pending-invitations'],
    queryFn:  () => rpc('my_pending_invitations'),
    staleTime: 60_000,
  })
}

export function useSwitchOrg() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (orgId) => {
      const result = await rpc('set_current_org', { p_org_id: orgId })

      // Step 2. Without this the claim is stale — see the header.
      const { error } = await supabase.auth.refreshSession()
      if (error) {
        throw new Error(
          'Switched workspace, but the session could not be refreshed. ' +
          'Please sign out and back in.',
        )
      }
      return result?.[0] ?? null
    },
    onSuccess: () => {
      // Drop everything. See the header for why this is clear() and not
      // invalidateQueries().
      qc.clear()
    },
  })
}

export function useAcceptInvitation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (invitationId) => rpc('accept_invitation', { p_invitation_id: invitationId }),
    onSuccess: () => {
      // Accepting adds a membership; it deliberately does NOT switch you into
      // the new org (030 section 4). So only the two lists that changed are
      // refetched — the CRM data on screen still belongs to the org you are
      // still in, and dropping it would be wrong here.
      qc.invalidateQueries({ queryKey: ['my-organizations'] })
      qc.invalidateQueries({ queryKey: ['my-pending-invitations'] })
    },
  })
}
