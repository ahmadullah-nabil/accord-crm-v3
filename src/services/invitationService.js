// ─── invitationService ────────────────────────────────────────────────────────
//
// Adding someone to the CRM is an INVITATION, not an account creation.
//
// The old flow called supabase.auth.signUp() from the admin's browser, which
// broke the moment tenancy landed: signUp creates auth.users and a profile, and
// nothing creates a MEMBERSHIP. A user with no membership has no org — every
// policy denies, they log in to an empty CRM, and the admin who "created" them
// cannot even see them, because they share no org.
//
// So the admin writes a row to org_invitations instead. The person then signs
// up themselves, and the on_auth_user_created_membership trigger (024) turns
// that invitation into a membership BEFORE their first token is minted — which
// matters, because custom_access_token_hook reads memberships to write the
// org_id claim. Create the membership a moment later and their first session
// has no org.
//
// Consequence, deliberate: the admin no longer sets anyone's password. The
// person sets their own at signup. An admin-chosen password had to be relayed
// over WhatsApp anyway, and was usually never changed.

import { supabase } from '../lib/supabaseClient.js'

// ── Shape mapping ─────────────────────────────────────────────────────────────

function toApp(row) {
  if (!row) return null
  return {
    id:         row.id,
    orgId:      row.org_id,
    email:      row.email,
    role:       row.role,
    managerId:  row.manager_id,
    department: row.department ?? '',
    invitedBy:  row.invited_by,
    status:     row.status,
    expiresAt:  row.expires_at,
    acceptedAt: row.accepted_at,
    createdAt:  row.created_at,
    // Derived, never stored — same rule as overdue tasks. A stored flag would
    // be wrong the moment it is read a day later.
    isExpired:  row.status === 'pending' && new Date(row.expires_at) < new Date(),
  }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/**
 * All invitations for the caller's org.
 *
 * No org filter here: the RLS policy on org_invitations already restricts this
 * to `org_id = current_org_id()` AND Admin/AGM. Filtering again in the client
 * would be a second copy of a rule that has one source of truth.
 */
export async function listInvitations() {
  const { data, error } = await supabase
    .from('org_invitations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(toApp)
}

/**
 * The caller's own membership situation.
 *
 * Answers "am I in any organisation at all", which is the one question a user
 * with no org still needs answered. It is a SECURITY DEFINER function and
 * needs no org to run — that is the point.
 */
export async function getMembershipStatus() {
  const { data, error } = await supabase.rpc('my_membership_status')
  if (error) throw new Error(error.message)

  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { hasMembership: false, orgCount: 0, pendingInvite: false }

  return {
    hasMembership:  row.has_membership,
    orgCount:       row.org_count,
    currentOrg:     row.current_org,
    currentOrgName: row.current_org_name,
    pendingInvite:  row.pending_invite,
  }
}

// ── Writes ────────────────────────────────────────────────────────────────────

/**
 * Invite someone into the caller's organisation.
 *
 * org_id is NOT passed. The column defaults to current_org_id(), and the RLS
 * WITH CHECK rejects anything else — so an admin cannot invite into another
 * org even by editing the request. Sending it from the client would add a
 * value the server is going to overrule anyway.
 *
 * Re-inviting the same address UPDATES the existing row rather than adding a
 * second one. Two pending invitations for one email that disagree about the
 * role is a question with no correct answer.
 */
export async function inviteUser({
  email,
  role       = 'Employee',
  managerId  = null,
  department = '',
}) {
  const clean = email.trim().toLowerCase()

  const { data: me } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('org_invitations')
    .upsert(
      {
        email:      clean,
        role,
        manager_id: managerId || null,
        department: department.trim(),
        invited_by: me?.user?.id ?? null,
        // Re-inviting a revoked or expired person must reopen the invitation,
        // not leave it closed with a fresh timestamp.
        status:     'pending',
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: 'org_id,email' },
    )
    .select()
    .single()

  if (error) {
    // The most likely failure by far, and the least self-explanatory error.
    if (error.message?.includes('row-level security')) {
      throw new Error('Only an Admin or AGM can invite people to this organisation.')
    }
    throw new Error(error.message)
  }
  return toApp(data)
}

/**
 * Withdraw a pending invitation.
 *
 * Marked 'revoked' rather than deleted. "Who invited this person, and who
 * changed their mind" is what an audit asks, and a deleted row cannot answer.
 * Revoked rows are also what let a later re-invite reuse the same (org, email)
 * slot cleanly.
 */
export async function revokeInvitation(id) {
  const { error } = await supabase
    .from('org_invitations')
    .update({ status: 'revoked' })
    .eq('id', id)

  if (error) throw new Error(error.message)
  return true
}

/** Push a pending invitation's expiry out by another 14 days. */
export async function renewInvitation(id) {
  const { data, error } = await supabase
    .from('org_invitations')
    .update({
      status:     'pending',
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return toApp(data)
}

/**
 * The signup URL to hand to the invited person.
 *
 * Carries the email as a hint only — it prefills the field. It is NOT the
 * authorisation: the invitation row is. Someone who edits this URL to another
 * address gets an account with no membership, because the trigger matches on
 * the address they actually sign up with.
 */
export function buildInviteLink(email) {
  const base = `${window.location.origin}/signup`
  return `${base}?email=${encodeURIComponent(email)}`
}
