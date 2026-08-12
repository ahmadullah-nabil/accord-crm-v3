// ─── integration-token-check ──────────────────────────────────────────────────
//
// ⚠️ TEMPORARY DIAGNOSTIC — delete once Phase 1 (send-email) exists.
//
// Phase 0 built _shared/tokens.ts, but nothing imports it yet, and Supabase
// bundles each Edge Function from its own entrypoint. Without a caller the
// module is never compiled, never deployed and never exercised — so there is
// no way to prove a refresh actually works against live Google/Zoho.
//
// This endpoint is that caller. For each of the signed-in user's integration
// accounts it:
//   1. asks getValidAccessToken() for a live token (refreshing if needed)
//   2. calls the provider's identity endpoint WITH that token
//
// Step 2 is the part that matters: it proves the token is accepted by the
// provider, not merely that a refresh returned 200.
//
// SECURITY
// ────────
// Returns NO token material — no access token, no refresh token, not even a
// prefix. Only booleans, timestamps and the account email the provider itself
// reports back. Scoped to the caller: the admin client bypasses RLS, so every
// query filters on the authenticated user id.

import { requireUser, adminClient } from '../_shared/supabase.ts'
import { getValidAccessToken, authHeader } from '../_shared/tokens.ts'
import { getAdapter } from '../_shared/providers/index.ts'
import { corsHeaders, json, errorResponse } from '../_shared/http.ts'

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'), req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const user  = await requireUser(req)
    const admin = adminClient()

    const { data: accounts, error } = await admin
      .from('integration_accounts')
      .select('id, provider, account_email, capabilities, status, api_domain, user_id')
      .eq('user_id', user.id)          // the isolation boundary — admin bypasses RLS
      .order('connected_at', { ascending: false })

    if (error) throw error

    const results = []

    for (const account of accounts ?? []) {
      const row: Record<string, unknown> = {
        accountId:    account.id,
        provider:     account.provider,
        accountEmail: account.account_email,
        capabilities: account.capabilities,
        statusBefore: account.status,
        apiDomain:    account.api_domain,
      }

      try {
        const token = await getValidAccessToken(account.id)

        row.tokenObtained = true
        row.refreshed     = token.refreshed      // true = a refresh just happened
        row.expiresAt     = token.expiresAt
        row.authScheme    = authHeader(token).split(' ')[0]   // Bearer | Zoho-oauthtoken

        // Prove the token is actually accepted by the provider.
        try {
          const identity = await getAdapter(account.provider)
            .fetchIdentity(token.accessToken, token.apiDomain)
          row.providerCallOk    = true
          row.providerReportsAs = identity.email || identity.name || identity.accountId
        } catch (err) {
          row.providerCallOk = false
          row.providerError  = err instanceof Error ? err.message.slice(0, 300) : String(err)
        }
      } catch (err) {
        row.tokenObtained = false
        row.errorCode     = (err as { code?: string })?.code ?? 'unknown'
        row.errorStatus   = (err as { status?: number })?.status ?? 500
        row.errorMessage  = err instanceof Error ? err.message : String(err)
      }

      // Re-read: a failed refresh should have flipped this to reauth_required.
      const { data: after } = await admin
        .from('integration_accounts')
        .select('status, last_error')
        .eq('id', account.id)
        .maybeSingle()

      row.statusAfter = after?.status
      row.lastError   = after?.last_error

      results.push(row)
    }

    return json({
      // Included to diagnose the "connected in DB but Not connected in UI"
      // issue: if accountsFound is 0 while rows exist in the table, those rows
      // belong to a different CRM login than the one calling this.
      callerUserId:  user.id,
      callerEmail:   user.email,
      accountsFound: results.length,
      accounts:      results,
    }, 200, cors)
  } catch (err) {
    return errorResponse(err, corsHeaders(req.headers.get('Origin'), req))
  }
})
