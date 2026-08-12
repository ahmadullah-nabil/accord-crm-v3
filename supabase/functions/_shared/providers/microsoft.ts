// ─── Microsoft adapter ────────────────────────────────────────────────────────
//
// Outlook Mail (send) + Outlook Calendar via Microsoft Graph.
//
// MULTI-TENANT: uses the `common` endpoint so both work/school (Entra ID) and
// personal Microsoft accounts can connect.
//
// Graph keeps mail and calendar permissions separate, so a calendar-only
// connection never requests a Mail.* scope — capability isolation needs no
// workaround here.
//
// `offline_access` is mandatory on the v2.0 endpoint: without it Microsoft
// issues no refresh token at all and the connection dies after ~1 hour.
// `User.Read` is the minimum needed to label the connected account.

import type {
  AuthUrlParams, CallbackContext, Capability, ProviderAdapter, ProviderAuth,
  ProviderIdentity, SendEmailInput, SendEmailResult, TokenSet,
} from '../types.ts'
import { IntegrationError } from '../types.ts'
import { postForm, getJson, expiresAtFrom } from '../http.ts'
import { buildMimeMessage, base64EncodeText } from '../mime.ts'

const TENANT     = 'common'   // multi-tenant, per decision
const AUTH_URL   = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`
const TOKEN_URL  = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`
const GRAPH_ME   = 'https://graph.microsoft.com/v1.0/me'
const GRAPH_SEND = 'https://graph.microsoft.com/v1.0/me/sendMail'

const BASE_SCOPES = ['openid', 'profile', 'offline_access', 'User.Read']

const CAPABILITY_SCOPES: Record<Capability, string[]> = {
  email:    ['Mail.Send'],
  calendar: ['Calendars.ReadWrite'],
}

export const microsoftAdapter: ProviderAdapter = {
  id: 'microsoft',
  label: 'Microsoft',
  capabilities: ['email', 'calendar'],

  // DOCUMENTED. Graph's sendMail takes a saveToSentItems flag whose default is
  // true; the docs say to specify it only when you want false. We send MIME
  // rather than a JSON message resource, and the MIME form takes no parameters
  // at all — so the default is not just what we choose, it is all that is
  // reachable on this path. A copy is filed in Sent Items either way.
  sentCopy: 'native',

  scopesFor(capability) {
    return [...BASE_SCOPES, ...CAPABILITY_SCOPES[capability]]
  },

  buildAuthUrl({ state, codeChallenge, redirectUri, capability, loginHint }: AuthUrlParams) {
    const params = new URLSearchParams({
      client_id:     Deno.env.get('MICROSOFT_CLIENT_ID')!,
      response_type: 'code',
      redirect_uri:  redirectUri,
      response_mode: 'query',
      scope:         this.scopesFor(capability).join(' '),
      state,
      code_challenge:        codeChallenge,
      code_challenge_method: 'S256',
      // Force the account picker so a user with several Microsoft accounts is
      // not silently connected to the wrong mailbox.
      prompt: 'select_account',
    })
    if (loginHint) params.set('login_hint', loginHint)
    return `${AUTH_URL}?${params.toString()}`
  },

  async exchangeCode(code, codeVerifier, redirectUri, _ctx: CallbackContext): Promise<TokenSet> {
    let body: any
    try {
      body = await postForm(TOKEN_URL, {
        client_id:     Deno.env.get('MICROSOFT_CLIENT_ID')!,
        client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET')!,
        code,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
        code_verifier: codeVerifier,
        scope:         this.scopesFor('email').join(' '),
      })
    } catch (err) {
      // Tenant policy can require an administrator to consent first — surface
      // that distinctly so the UI can tell the user to contact their admin
      // rather than showing a generic failure they cannot act on.
      const msg = err instanceof Error ? err.message : String(err)
      if (/AADSTS65001|admin_consent|consent_required/i.test(msg)) {
        throw new IntegrationError(
          'admin_consent_required',
          'Your Microsoft administrator must approve Accord CRM before you can connect this account.',
        )
      }
      throw err
    }

    if (!body.refresh_token) {
      throw new IntegrationError(
        'no_refresh_token',
        'Microsoft did not return a refresh token. Confirm the offline_access permission is granted on the app registration.',
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
      client_id:     Deno.env.get('MICROSOFT_CLIENT_ID')!,
      client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    })
    return {
      accessToken: body.access_token,
      // Microsoft DOES rotate refresh tokens — the new one must be persisted
      // or the next refresh fails.
      refreshToken:  body.refresh_token,
      tokenType:     body.token_type ?? 'Bearer',
      expiresAt:     expiresAtFrom(body.expires_in),
      grantedScopes: String(body.scope ?? '').split(' ').filter(Boolean),
      apiDomain:     null,
    }
  },

  async fetchIdentity(accessToken): Promise<ProviderIdentity> {
    const me = await getJson(GRAPH_ME, accessToken)
    if (!me.id) throw new IntegrationError('identity_failed', 'Microsoft Graph returned no account id.')
    return {
      accountId: me.id,
      email:     me.mail ?? me.userPrincipalName ?? '',
      name:      me.displayName ?? '',
    }
  },

  /**
   * UNTESTED. There is no Microsoft app registration for Accord CRM yet, so no
   * account can connect and this code has never executed against Graph. It is
   * written to the documented contract and to the same shape as the two proven
   * adapters; treat the first live run as the real test.
   *
   * WHY MIME AND NOT THE JSON MESSAGE RESOURCE
   * Graph accepts either. JSON looks friendlier, but its internetMessageHeaders
   * property only permits custom `x-` headers — In-Reply-To and References
   * cannot be set through it. Threading would silently not work. MIME accepts
   * them, and reuses the same builder as Gmail, so there is one body format to
   * reason about instead of two.
   */
  async sendEmail(auth: ProviderAuth, input: SendEmailInput): Promise<SendEmailResult> {
    const { raw, messageId } = buildMimeMessage(input)

    const res = await fetch(GRAPH_SEND, {
      method: 'POST',
      headers: {
        Authorization: auth.authorization,
        // Not a typo. text/plain is how Graph is told the body is base64 MIME;
        // application/json would make it expect a message resource instead.
        'Content-Type': 'text/plain',
      },
      body: base64EncodeText(raw),
    })

    if (!res.ok) {
      const text = await res.text()
      let payload: any = null
      try { payload = JSON.parse(text) } catch { /* non-JSON error body */ }
      const detail = payload?.error?.message ?? text.slice(0, 300)
      const code   = payload?.error?.code ?? String(res.status)
      console.error(`[microsoft] send failed ${res.status} ${code}: ${detail}`)

      // Graph caps a sendMail request at roughly 4 MB. Phase 1 sends no
      // attachments so this cannot fire yet, but Phase 1b will need the
      // createUploadSession path for anything larger, and a clear error here
      // is what will point at it.
      throw new IntegrationError(
        'send_failed',
        `Microsoft rejected the message: ${detail}`,
        res.status === 429 || res.status >= 500 ? 502 : 400,
        code,
      )
    }

    // A successful sendMail returns 202 Accepted with an EMPTY body — no id of
    // any kind. Note what that means: 202 says Graph accepted the request, not
    // that the message was delivered. There is nothing further to record, and
    // no provider id to store, without a read scope we do not hold.
    return {
      providerMessageId: null,
      providerThreadId:  null,
      messageId,
    }
  },

  async revoke(): Promise<boolean> {
    // Microsoft exposes no per-application delegated revocation endpoint.
    // Users revoke from myaccount.microsoft.com; the UI says so on disconnect.
    // We return false honestly rather than pretending revocation happened.
    return false
  },
}
