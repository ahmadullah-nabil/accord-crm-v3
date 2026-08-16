// ─── _shared/tenancy.ts ───────────────────────────────────────────────────────
//
// step065. The tenant boundary for the service-role layer, in one file.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ WHY THIS EXISTS AT ALL                                                  │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Every Edge Function runs as the service role. The service role BYPASSES │
// │ ROW LEVEL SECURITY. Every policy in 022, 023, 026, 028 and 030 is inert │
// │ on this side of the wall — not weakened, not partially applied: inert.  │
// │                                                                          │
// │ Until now the only tenant check in the whole functions directory was a  │
// │ private `assertOwnership()` inside send-email/attachments.ts. It was     │
// │ correct, and it protected exactly one code path. The other five         │
// │ functions scoped their queries by `user_id` and nothing else, which is  │
// │ sound only while every user belongs to exactly one organisation.        │
// │                                                                          │
// │ 028 gave integration_accounts an org_id precisely because that          │
// │ assumption is ending. This file is what makes the functions read it.     │
// └─────────────────────────────────────────────────────────────────────────┘
//
// THREE RULES, and they are not interchangeable:
//
//   activeOrgIds()   — every org the user may act in. Use when checking that
//                      something they already reference is theirs.
//   assertOrgAccess()— throws unless EVERY supplied org_id is in that set.
//   callerOrgId()    — the ONE org they are acting in right now. Use when
//                      CREATING a row that needs an org_id stamped on it.
//
// Using activeOrgIds where callerOrgId is meant is the subtle failure: it will
// happily accept a row belonging to any of the user's orgs, which is right for
// a read and wrong for a write.
//
// NEVER call current_org_id() from here. It resolves through the JWT claim,
// and a service-role connection carries no JWT — it would evaluate to NULL,
// match nothing, and then get "fixed" by someone deleting the check.
// `resolve_acting_org(user_id)` (030) is the service-role-safe equivalent and
// is what callerOrgId() uses.

import { adminClient } from './supabase.ts'
import { IntegrationError } from './types.ts'

type Admin = ReturnType<typeof adminClient>

/**
 * Every organisation this user is an active member of.
 *
 * Read from `memberships` directly. Fails CLOSED: an unreadable membership
 * list means we cannot establish what the user may touch, and "cannot
 * establish" must never resolve to "allow" on a path that reads other
 * tenants' data.
 */
export async function activeOrgIds(admin: Admin, userId: string): Promise<Set<string>> {
  const { data, error } = await admin
    .from('memberships')
    .select('org_id')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error) {
    console.error('[tenancy] membership lookup failed:', error.message)
    throw new IntegrationError(
      'tenant_check_failed',
      'Could not verify your workspace access. Please try again.',
      500,
    )
  }

  return new Set((data ?? []).map((r: { org_id: string }) => r.org_id))
}

/**
 * Throws unless every org id supplied belongs to the user.
 *
 * `subject` names what was being reached for, in the user's language, because
 * this message is shown to them. It deliberately reads as "gone", not as
 * "forbidden" — telling someone a record exists but belongs to another tenant
 * confirms the record exists, which is itself a cross-tenant disclosure.
 */
export async function assertOrgAccess(
  admin: Admin,
  userId: string,
  orgIds: Array<string | null | undefined>,
  subject = 'One of the items you referenced',
): Promise<void> {
  const allowed = await activeOrgIds(admin, userId)

  for (const id of orgIds) {
    if (!id || !allowed.has(id)) {
      console.warn(`[tenancy] cross-tenant access refused: user=${userId} org=${id}`)
      throw new IntegrationError(
        'not_found',
        `${subject} no longer exists.`,
        404,
      )
    }
  }
}

/**
 * The single organisation this user is acting in.
 *
 * Delegates to resolve_acting_org() (030), so the answer here is byte-for-byte
 * the answer current_org_id() gives on the RLS side. If these two ever drift,
 * a function writes a row into an org the user's own queries then filter out.
 */
export async function callerOrgId(admin: Admin, userId: string): Promise<string> {
  const { data, error } = await admin.rpc('resolve_acting_org', { p_user_id: userId })

  if (error) {
    console.error('[tenancy] resolve_acting_org failed:', error.message)
    throw new IntegrationError(
      'tenant_check_failed',
      'Could not determine your current workspace. Please try again.',
      500,
    )
  }

  if (!data) {
    // No membership at all, or every org suspended. Not an error the user can
    // fix by retrying, so say what it is.
    throw new IntegrationError(
      'no_organization',
      'Your account is not a member of any active workspace.',
      403,
    )
  }

  return data as string
}
