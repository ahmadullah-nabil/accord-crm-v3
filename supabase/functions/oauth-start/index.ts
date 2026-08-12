// ─── oauth-start ──────────────────────────────────────────────────────────────
//
// Begins a connection. Called by the browser with the user's Supabase JWT.
//
// Returns ONLY an authorization URL. No client id, no secret, no token ever
// crosses this boundary — the URL contains the public client_id by necessity
// (it appears in the address bar during consent), and nothing else sensitive.
//
// The single-use `state` and the PKCE `code_verifier` are written to
// integration_oauth_states, which the browser cannot read (RLS, zero policies).

import { requireUser, adminClient } from '../_shared/supabase.ts'
import { getAdapter, supportsCapability } from '../_shared/providers/index.ts'
import { randomToken, createCodeVerifier, codeChallengeS256 } from '../_shared/crypto.ts'
import { corsHeaders, json, errorResponse, resolveOrigin } from '../_shared/http.ts'
import { IntegrationError } from '../_shared/types.ts'

/** State lifetime. Long enough to complete consent, short enough to limit replay. */
const STATE_TTL_MINUTES = 10

/** Only in-app PATHS may be returned to — never an arbitrary URL. */
const ALLOWED_PATHS = new Set(['/settings'])

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'), req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    if (req.method !== 'POST') {
      throw new IntegrationError('bad_request', 'POST required.', 405)
    }

    // 1. The caller must be a real, signed-in CRM user.
    const user = await requireUser(req)

    const { provider, capability, redirectTo } = await req.json().catch(() => ({}))

    if (!provider || !capability) {
      throw new IntegrationError('bad_request', 'provider and capability are required.')
    }
    if (capability !== 'email' && capability !== 'calendar') {
      throw new IntegrationError('bad_request', `Unknown capability: ${capability}`)
    }
    if (!supportsCapability(provider, capability)) {
      throw new IntegrationError('bad_request', `${provider} does not offer ${capability}.`)
    }

    const adapter = getAdapter(provider)
    const admin   = adminClient()

    // 2. Opportunistic cleanup of expired state rows.
    admin.rpc('purge_expired_oauth_states').then(
      () => {},
      (e: unknown) => console.error('[oauth-start] state purge failed:', e),
    )

    // 3. Mint single-use state + PKCE verifier.
    const state        = randomToken(32)
    const codeVerifier = createCodeVerifier()
    const challenge    = await codeChallengeS256(codeVerifier)

    // Return target = allowed ORIGIN + allowed PATH, both validated server-side.
    //
    // The origin comes from the caller's Origin header but is only honoured if
    // it matches the APP_URL / APP_URL_ALLOWED list; anything else silently
    // falls back to APP_URL. That is what lets one Supabase project serve
    // localhost and production at once without becoming an open redirect.
    //
    // The resolved absolute URL is stored on the state row, which the browser
    // can neither read nor write (RLS enabled, zero policies), so it cannot be
    // tampered with between here and the callback.
    const safePath   = ALLOWED_PATHS.has(redirectTo) ? redirectTo : '/settings'
    const safeOrigin = resolveOrigin(req.headers.get('Origin'))
    const safeReturn = `${safeOrigin}${safePath}`

    const { error: stateErr } = await admin.from('integration_oauth_states').insert({
      state,
      user_id:       user.id,
      provider,
      capability,
      code_verifier: codeVerifier,
      redirect_to:   safeReturn,
      expires_at:    new Date(Date.now() + STATE_TTL_MINUTES * 60_000).toISOString(),
    })
    if (stateErr) {
      console.error('[oauth-start] could not persist state:', stateErr)
      throw new IntegrationError('provider_error', 'Could not start the connection.', 500)
    }

    // 4. Build the provider URL. redirect_uri points at oauth-callback, so the
    //    authorization code is delivered server-side and never touches React.
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`

    const authUrl = adapter.buildAuthUrl({
      state,
      codeChallenge: challenge,
      redirectUri,
      capability,
    })

    return json({ authUrl, provider, capability, expiresInMinutes: STATE_TTL_MINUTES }, 200, cors)
  } catch (err) {
    return errorResponse(err, corsHeaders(req.headers.get('Origin'), req))
  }
})
