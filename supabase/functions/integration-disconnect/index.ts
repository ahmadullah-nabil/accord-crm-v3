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
      .select('id, user_id, provider, api_domain, account_email')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (accErr) throw accErr
    if (!account) {
      // Deliberately the same response as a non-existent id — do not confirm
      // that someone else's account exists.
      throw new IntegrationError('bad_request', 'Integration not found.', 404)
    }

    // Credentials are read here and NOWHERE else outside this server boundary.
    const { data: creds } = await admin
      .from('integration_credentials')
      .select('access_token, refresh_token, revoke_domain')
      .eq('account_id', account.id)
      .maybeSingle()

    // ── Revoke at the provider ──────────────────────────────────────────────
    let revoked = false
    let revokeNote: string | null = null

    if (creds) {
      const adapter = getAdapter(account.provider)
      // Revoking the refresh token invalidates the whole grant on Google and
      // Zoho; the access token alone would leave the grant alive.
      const token = creds.refresh_token ?? creds.access_token
      try {
        revoked = await adapter.revoke(token, creds.revoke_domain ?? account.api_domain)
      } catch (err) {
        console.error('[integration-disconnect] revoke threw:', err)
        revoked = false
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
