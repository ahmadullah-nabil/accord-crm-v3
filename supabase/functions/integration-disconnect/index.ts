// ─── integration-disconnect ───────────────────────────────────────────────────
//
// Revokes at the provider where supported, THEN deletes locally.
//
// Order matters: revoking first means a failure part-way leaves a row we can
// retry. Deleting first would orphan a live grant at the provider with no
// record of it — the user would believe access was withdrawn when it was not.
//
// Local deletion proceeds even when remote revocation fails, because the user
// asked to disconnect and must not be trapped. The response reports honestly
// whether the provider-side grant was actually revoked, and the UI tells the
// user when they need to finish the job in their provider's account settings.

import { requireUser, adminClient } from '../_shared/supabase.ts'
import { assertOrgAccess } from '../_shared/tenancy.ts'
import { getAdapter } from '../_shared/providers/index.ts'
import { corsHeaders, json, errorResponse } from '../_shared/http.ts'
import { IntegrationError } from '../_shared/types.ts'

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'), req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    if (req.method !== 'POST') {
      throw new IntegrationError('bad_request', 'POST required.', 405)
    }

    const user = await requireUser(req)
    const { accountId } = await req.json().catch(() => ({}))
    if (!accountId) throw new IntegrationError('bad_request', 'accountId is required.')

    const admin = adminClient()

    // OWNERSHIP CHECK. The service-role client bypasses RLS, so this filter is
    // the only thing stopping User A disconnecting User B's mailbox. It is not
    // optional and it is not decoration.
    const { data: account, error: accErr } = await admin
      .from('integration_accounts')
      .select('id, user_id, org_id, provider, api_domain, account_email')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (accErr) throw accErr
    if (!account) {
      // Deliberately the same response as a non-existent id — do not confirm
      // that someone else's account exists.
      throw new IntegrationError('bad_request', 'Integration not found.', 404)
    }

    // step065 — and it must belong to an org this user is actually in.
    // user_id alone stopped User A disconnecting User B's mailbox. It does not
    // stop the same human, acting in workspace B, from revoking a grant that
    // belongs to workspace A. assertOrgAccess throws a 404 with the same
    // wording as the branch above, on purpose: "belongs to another tenant" and
    // "does not exist" must be indistinguishable from outside.
    await assertOrgAccess(admin, user.id, [account.org_id], 'That integration')

    // Credentials are read here and NOWHERE else outside this server boundary.
    //
    // Plural since 019: an account holds one credential PER CAPABILITY, so this
    // was .maybeSingle() and would now throw outright on any account connected
    // for both email and calendar — turning disconnect into a hard error for
    // exactly the accounts most likely to be disconnected.
    const { data: credRows } = await admin
      .from('integration_credentials')
      .select('capability, access_token, refresh_token, revoke_domain')
      .eq('account_id', account.id)

    const creds = credRows?.[0] ?? null

    // ── Revoke at the provider ──────────────────────────────────────────────
    let revoked = false
    let revokeNote: string | null = null

    if (creds) {
      const adapter = getAdapter(account.provider)
      // Revoking the refresh token invalidates the whole grant on Google and
      // Zoho; the access token alone would leave the grant alive.
      //
      // Each capability may hold a DISTINCT refresh token, so revoke every one.
      // Deduplicated because Google's include_granted_scopes can legitimately
      // leave the same token under both capabilities, and revoking it twice
      // makes the second call fail and look like an error.
      const tokens = Array.from(new Set(
        (credRows ?? []).map((c) => c.refresh_token ?? c.access_token).filter(Boolean),
      )) as string[]

      // All must succeed. One surviving grant means the provider still believes
      // Accord CRM has access after the user asked us to remove it.
      revoked = tokens.length > 0
      for (const token of tokens) {
        try {
          const ok = await adapter.revoke(token, creds.revoke_domain ?? account.api_domain)
          if (!ok) revoked = false
        } catch (err) {
          console.error('[integration-disconnect] revoke threw:', err)
          revoked = false
        }
      }
      if (!revoked) {
        revokeNote = account.provider === 'microsoft'
          ? 'Microsoft does not support app-initiated revocation. Remove Accord CRM at myaccount.microsoft.com to fully withdraw access.'
          : 'The provider did not confirm revocation. Review connected apps in your provider account settings.'
      }
    }

    // ── Delete locally (credentials cascade with the account) ───────────────
    const { error: delErr } = await admin
      .from('integration_accounts')
      .delete()
      .eq('id', account.id)
      .eq('user_id', user.id)

    if (delErr) {
      console.error('[integration-disconnect] delete failed:', delErr)
      throw delErr
    }

    return json({ disconnected: true, revokedAtProvider: revoked, note: revokeNote }, 200, cors)
  } catch (err) {
    return errorResponse(err, corsHeaders(req.headers.get('Origin'), req))
  }
})
