// ─── Google adapter ───────────────────────────────────────────────────────────
//
// Gmail (SEND ONLY) + Google Calendar.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ WHY SEND-ONLY, AND WHY IT MUST STAY THAT WAY                            │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Google tiers OAuth scopes, and an application's overall classification  │
// │ is set by its MOST RESTRICTIVE scope. `gmail.readonly` and              │
// │ `gmail.modify` are Restricted-tier: adding either one makes the entire  │
// │ Accord CRM project Restricted, triggering a CASA third-party security   │
// │ assessment plus annual re-audit.                                        │
// │                                                                          │
// │ `gmail.send` is Sensitive-tier, not Restricted, and is the only Gmail   │
// │ scope combination that avoids that burden.                              │
// │                                                                          │
// │ DO NOT add a read scope here without an explicit business decision —    │
// │ it is a compliance change, not a code change.                           │
// └─────────────────────────────────────────────────────────────────────────┘
//
// Calendar uses `calendar.events` rather than the broader `calendar`: it grants
// event read/write without the ability to create, delete or reconfigure whole
// calendars, which the CRM does not need.

import type {
  AuthUrlParams, CallbackContext, Capability, ProviderAdapter, ProviderIdentity, TokenSet,
} from '../types.ts'
import { IntegrationError } from '../types.ts'
import { postForm, getJson, expiresAtFrom } from '../http.ts'

const AUTH_URL   = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL  = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const USERINFO   = 'https://www.googleapis.com/oauth2/v3/userinfo'

// Identity scopes only — needed to label the connected account in the UI.
const BASE_SCOPES = ['openid', 'email', 'profile']

const CAPABILITY_SCOPES: Record<Capability, string[]> = {
  email:    ['https://www.googleapis.com/auth/gmail.send'],
  calendar: ['https://www.googleapis.com/auth/calendar.events'],
}

export const googleAdapter: ProviderAdapter = {
  id: 'google',
  label: 'Google',
  capabilities: ['email', 'calendar'],

  scopesFor(capability) {
    return [...BASE_SCOPES, ...CAPABILITY_SCOPES[capability]]
  },

  buildAuthUrl({ state, codeChallenge, redirectUri, capability, loginHint }: AuthUrlParams) {
    const params = new URLSearchParams({
      client_id:     Deno.env.get('GOOGLE_CLIENT_ID')!,
      redirect_uri:  redirectUri,
      response_type: 'code',
      scope:         this.scopesFor(capability).join(' '),
      state,
      code_challenge:        codeChallenge,
      code_challenge_method: 'S256',
      // offline is what produces a refresh token at all
      access_type: 'offline',
      // Google only re-issues a refresh token on an explicit consent prompt;
      // without this a re-connect silently yields none and the integration
      // dies at the first token expiry.
      prompt: 'consent',
      // Incremental authorization: connecting Calendar after Mail keeps the
      // Mail grant instead of replacing it.
      include_granted_scopes: 'true',
    })
    if (loginHint) params.set('login_hint', loginHint)
    return `${AUTH_URL}?${params.toString()}`
  },

  async exchangeCode(code, codeVerifier, redirectUri, _ctx: CallbackContext): Promise<TokenSet> {
    const body = await postForm(TOKEN_URL, {
      code,
      client_id:     Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
      code_verifier: codeVerifier,
    })

    if (!body.refresh_token) {
      // Almost always a re-consent that Google treated as already-granted.
      throw new IntegrationError(
        'no_refresh_token',
        'Google did not return a refresh token. Remove Accord CRM from your Google account permissions and connect again.',
      )
    }

    return {
      accessToken:   body.access_token,
      refreshToken:  body.refresh_token,
      tokenType:     body.token_type ?? 'Bearer',
      expiresAt:     expiresAtFrom(body.expires_in),
      grantedScopes: String(body.scope ?? '').split(' ').filter(Boolean),
      apiDomain:     null,
    }
  },

  async refresh(refreshToken): Promise<TokenSet> {
    const body = await postForm(TOKEN_URL, {
      refresh_token: refreshToken,
      client_id:     Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      grant_type:    'refresh_token',
    })
    return {
      accessToken:   body.access_token,
      // Google does not re-issue on refresh — the original stays valid.
      refreshToken:  undefined,
      tokenType:     body.token_type ?? 'Bearer',
      expiresAt:     expiresAtFrom(body.expires_in),
      grantedScopes: String(body.scope ?? '').split(' ').filter(Boolean),
      apiDomain:     null,
    }
  },

  async fetchIdentity(accessToken): Promise<ProviderIdentity> {
    const me = await getJson(USERINFO, accessToken)
    if (!me.sub) throw new IntegrationError('identity_failed', 'Google returned no account id.')
    return { accountId: me.sub, email: me.email ?? '', name: me.name ?? '' }
  },

  async revoke(token): Promise<boolean> {
    try {
      const res = await fetch(REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }).toString(),
      })
      // 400 usually means already revoked — still a success from our side.
      return res.ok || res.status === 400
    } catch (err) {
      console.error('[google] revoke failed:', err)
      return false
    }
  },
}
