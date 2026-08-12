// ─── oauth-callback ───────────────────────────────────────────────────────────
//
// The provider redirects the BROWSER here after consent. This function is the
// security boundary of the whole feature.
//
// It is intentionally the redirect_uri itself rather than a React route: the
// authorization code is consumed server-side and never enters the SPA, so it
// cannot be read from the address bar, history, or a referrer header by
// anything running in the page.
//
// Guarantees:
//   • state must exist, be unexpired, and be UNCONSUMED — checked with an
//     atomic compare-and-set, so a replayed callback is rejected even under a
//     concurrent double-submit
//   • the account is bound to the user who STARTED the flow, not whoever is
//     holding the browser now
//   • the row is written as `connected` only after the token exchange AND the
//     identity fetch have both succeeded — a partial failure never displays as
//     connected
//
// Always ends in a redirect back to the app with a machine-readable status, so
// the user is never left staring at raw JSON.
//
// verify_jwt MUST be false for this function (see config.toml): the provider
// calls it, and the provider has no Supabase session. Authenticity comes from
// the single-use state, not from a JWT.

import { adminClient } from '../_shared/supabase.ts'
import { getAdapter }  from '../_shared/providers/index.ts'
import { primaryOrigin, isAllowedOrigin } from '../_shared/http.ts'
import type { CallbackContext } from '../_shared/types.ts'

/** Fallback used before a state row is resolved, or if its value is unusable. */
const DEFAULT_RETURN = `${primaryOrigin()}/settings`

/**
 * Re-validate the return target stored by oauth-start.
 *
 * That value was already checked against the allow-list at start time and lives
 * on a table the browser cannot touch, so this is defence in depth rather than
 * the primary control — but a redirect is exactly the wrong place to trust a
 * stored string without re-checking it.
 *
 * Anything absent, malformed, or pointing at an origin no longer on the
 * allow-list falls back to APP_URL.
 */
function safeReturnTarget(stored?: string | null): string {
  if (!stored) return DEFAULT_RETURN
  try {
    const url = new URL(stored)
    return isAllowedOrigin(url.origin) ? url.toString() : DEFAULT_RETURN
  } catch {
    return DEFAULT_RETURN
  }
}

/** Send the browser back to the app with a status the UI can render. */
function redirect(target: string, params: Record<string, string>) {
  const url = new URL(target)
  url.searchParams.set('section', 'integrations')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Response(null, { status: 302, headers: { Location: url.toString() } })
}

Deno.serve(async (req) => {
  const url    = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries()) as CallbackContext

  const admin = adminClient()
  // Until the state row is read we do not yet know which origin started this
  // flow, so early failures return to the primary origin.
  let returnTarget = DEFAULT_RETURN

  try {
    // ── 1. The user declined, or the provider refused ────────────────────────
    if (params.error) {
      console.error('[oauth-callback] provider returned error:', params.error, params.error_description ?? '')
      const code = params.error === 'access_denied' ? 'access_denied' : 'provider_error'
      return redirect(returnTarget, { integration: 'error', reason: code })
    }

    const { code, state } = params
    if (!code || !state) {
      return redirect(returnTarget, { integration: 'error', reason: 'bad_request' })
    }

    // ── 2. Atomically consume the state ─────────────────────────────────────
    // The UPDATE ... WHERE consumed_at IS NULL is the replay guard: the second
    // request to arrive with the same state matches zero rows and is rejected.
    // Doing this as a conditional update rather than SELECT-then-UPDATE closes
    // the race between two concurrent callbacks.
    const nowIso = new Date().toISOString()
    const { data: stateRows, error: stateErr } = await admin
      .from('integration_oauth_states')
      .update({ consumed_at: nowIso })
      .eq('state', state)
      .is('consumed_at', null)
      .gt('expires_at', nowIso)
      .select('state, user_id, provider, capability, code_verifier, redirect_to')

    const stateRow = stateRows?.[0]
    if (stateErr || !stateRow) {
      console.error('[oauth-callback] state rejected (unknown, expired, or replayed):', state)
      return redirect(returnTarget, { integration: 'error', reason: 'invalid_state' })
    }
    returnTarget = safeReturnTarget(stateRow.redirect_to)

    const adapter    = getAdapter(stateRow.provider)
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`

    // ── 3. Exchange the code (server-side only) ─────────────────────────────
    const tokens = await adapter.exchangeCode(code, stateRow.code_verifier, redirectUri, params)

    // ── 4. Confirm the granted scopes actually cover the capability ─────────
    // Providers may grant less than requested. Storing a "connected" account
    // that cannot do the thing it claims is worse than failing here.
    // Identity/housekeeping scopes are not capabilities — they exist so we can
    // name the account and keep the token alive. Zoho's AaaServer.profile.READ
    // is the counterpart to Microsoft's User.Read and OIDC's openid/profile.
    const required = adapter.scopesFor(stateRow.capability as 'email' | 'calendar')
      .filter((s) => !['openid', 'email', 'profile', 'offline_access', 'User.Read', 'AaaServer.profile.READ'].includes(s))

    const granted = tokens.grantedScopes.map((s) => s.toLowerCase())
    const missing = required.filter(
      (s) => !granted.some((g) => g === s.toLowerCase() || g.endsWith(s.toLowerCase())),
    )
    // Only enforced when the provider actually reported scopes back.
    if (granted.length > 0 && missing.length > 0) {
      console.error('[oauth-callback] scope denied. missing:', missing.join(', '))
      return redirect(returnTarget, { integration: 'error', reason: 'scope_denied' })
    }

    // ── 5. Identify the account ─────────────────────────────────────────────
    const identity = await adapter.fetchIdentity(tokens.accessToken, tokens.apiDomain)

    // ── 6. Persist. Metadata and secrets go to different tables. ────────────
    const capabilities = [stateRow.capability]

    // Reconnecting an already-linked account merges capabilities rather than
    // dropping the other one (connect Calendar without losing Mail).
    const { data: existing } = await admin
      .from('integration_accounts')
      .select('id, capabilities')
      .eq('user_id', stateRow.user_id)
      .eq('provider', stateRow.provider)
      .eq('provider_account_id', identity.accountId)
      .maybeSingle()

    const mergedCaps = existing
      ? Array.from(new Set([...(existing.capabilities ?? []), ...capabilities]))
      : capabilities

    const { data: account, error: accErr } = await admin
      .from('integration_accounts')
      .upsert({
        ...(existing ? { id: existing.id } : {}),
        user_id:             stateRow.user_id,
        provider:            stateRow.provider,
        provider_account_id: identity.accountId,
        account_email:       identity.email,
        account_name:        identity.name,
        capabilities:        mergedCaps,
        granted_scopes:      tokens.grantedScopes,
        status:              'connected',
        api_domain:          tokens.apiDomain ?? null,
        last_error:          null,
        last_error_at:       null,
        connected_at:        nowIso,
        updated_at:          nowIso,
      }, { onConflict: 'user_id,provider,provider_account_id' })
      .select('id')
      .single()

    if (accErr || !account) {
      console.error('[oauth-callback] could not persist account:', accErr)
      return redirect(returnTarget, { integration: 'error', reason: 'provider_error' })
    }

    const { error: credErr } = await admin
      .from('integration_credentials')
      // Keyed by (account_id, capability) since 019. Before that the PK was
      // account_id alone, so connecting calendar OVERWROTE the mail token while
      // `capabilities` merged to claim both — the row asserted email access it
      // could no longer exercise. Reconnecting a capability now replaces only
      // its own token and leaves the sibling grant untouched.
      .upsert({
        account_id:    account.id,
        capability:    stateRow.capability,
        access_token:  tokens.accessToken,
        refresh_token: tokens.refreshToken ?? null,
        token_type:    tokens.tokenType,
        expires_at:    tokens.expiresAt,
        revoke_domain: tokens.apiDomain ?? null,
        updated_at:    nowIso,
      }, { onConflict: 'account_id,capability' })

    if (credErr) {
      // Credentials failed to save → the account cannot work. Mark it, do not
      // leave a green "Connected" badge over a broken integration.
      console.error('[oauth-callback] could not persist credentials:', credErr)
      await admin.from('integration_accounts')
        .update({ status: 'error', last_error: 'Could not store credentials.', last_error_at: nowIso })
        .eq('id', account.id)
      return redirect(returnTarget, { integration: 'error', reason: 'provider_error' })
    }

    return redirect(returnTarget, {
      integration: 'connected',
      provider:    stateRow.provider,
      capability:  stateRow.capability,
    })
  } catch (err) {
    const code = (err as { code?: string })?.code ?? 'provider_error'
    console.error('[oauth-callback] failed:', code, err)
    return redirect(returnTarget, { integration: 'error', reason: String(code) })
  }
})
