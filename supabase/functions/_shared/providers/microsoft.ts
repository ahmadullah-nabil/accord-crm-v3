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
  CalendarEventInput,
  CalendarEventResult,
  AuthUrlParams, CallbackContext, Capability, ProviderAdapter, ProviderAuth,
  ProviderIdentity, SendEmailInput, SendEmailResult, TokenSet, MailboxAuth,
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
  async sendEmail(auth: MailboxAuth, input: SendEmailInput): Promise<SendEmailResult> {
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

      // ┌─────────────────────────────────────────────────────────────────┐
      // │ 413 — the request was over Graph's ~4 MB sendMail ceiling.      │
      // │                                                                  │
      // │ send-email validates sizes before writing anything, so this      │
      // │ should be unreachable. It is handled anyway because the check    │
      // │ uses a static limit and Exchange Online lets an administrator    │
      // │ set a SMALLER message size for their tenant — a customer can     │
      // │ therefore have a lower real ceiling than our table knows about.  │
      // │                                                                  │
      // │ The message says what to do instead of implying a retry. Graph's │
      // │ documented way past this is createUploadSession, which must      │
      // │ create a draft first and therefore needs Mail.ReadWrite; this    │
      // │ adapter holds Mail.Send only. Raising the ceiling is a consent-  │
      // │ screen change every Microsoft user would have to re-approve, not │
      // │ something to reach for on a failed send.                         │
      // └─────────────────────────────────────────────────────────────────┘
      if (res.status === 413) {
        throw new IntegrationError(
          'attachment_too_large',
          'Outlook rejected the message as too large. Send the file as a link instead.',
          400,
          code,
        )
      }

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

  // ── Calendar ────────────────────────────────────────────────────────────────
  //
  // Graph events on /me/events. Scope is Calendars.ReadWrite — Graph has no
  // write-only calendar permission, so read access comes along unavoidably.
  // The adapter simply never reads.

  async createEvent(auth, input): Promise<CalendarEventResult> {
    const res = await graphFetch(auth, 'https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      body: JSON.stringify(graphEventBody(input)),
    })
    return graphEventResult(res)
  },

  async updateEvent(auth, externalEventId, input): Promise<CalendarEventResult> {
    // PATCH preserves the event identity, so attendees receive an update rather
    // than a second invitation and their existing RSVPs survive.
    const res = await graphFetch(
      auth,
      `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(externalEventId)}`,
      { method: 'PATCH', body: JSON.stringify(graphEventBody(input)) },
    )
    return graphEventResult(res)
  },

  async cancelEvent(auth, externalEventId): Promise<boolean> {
    // /cancel notifies attendees; a plain DELETE removes it from the
    // organiser's calendar and leaves everyone else holding a meeting that no
    // longer exists.
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(externalEventId)}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: auth.authorization,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ Comment: 'This meeting has been cancelled.' }),
      },
    )
    if (res.ok || res.status === 404) return true

    // /cancel is organiser-only. On someone else's event Graph refuses, and
    // DELETE (removing it from this calendar) is the most we can honestly do.
    if (res.status === 403) {
      const del = await fetch(
        `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(externalEventId)}`,
        { method: 'DELETE', headers: { Authorization: auth.authorization } },
      )
      return del.ok || del.status === 404
    }
    console.error('[microsoft] cancelEvent failed:', res.status, (await res.text()).slice(0, 300))
    return false
  },
}

// ── Calendar helpers ──────────────────────────────────────────────────────────

function graphEventBody(input: CalendarEventInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    subject: input.title,
    body:    { contentType: 'HTML', content: input.description ?? '' },
    start:   { dateTime: input.start, timeZone: input.timezone },
    end:     { dateTime: input.end,   timeZone: input.timezone },
    location: { displayName: input.location ?? '' },
    attendees: input.attendees.map((a) => ({
      emailAddress: { address: a.email, name: a.name || a.email },
      type: 'required',
    })),
  }

  if (input.addConferencing) {
    body.isOnlineMeeting = true
    body.onlineMeetingProvider = 'teamsForBusiness'
  }
  return body
}

async function graphFetch(
  auth: ProviderAuth,
  url: string,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: auth.authorization,
      'Content-Type': 'application/json',
      // Graph accepts naive dateTime + timeZone in the body; this header only
      // governs how it formats times back to us. Asking for UTC keeps the
      // response predictable without affecting what was stored.
      Prefer: 'outlook.timezone="UTC"',
    },
  })
  const text = await res.text()
  if (!res.ok) {
    console.error('[microsoft] calendar call failed:', res.status, text.slice(0, 400))
    throw new IntegrationError(
      'calendar_failed',
      `Microsoft Graph rejected the request (${res.status}).`,
      res.status >= 500 || res.status === 429 ? 502 : 400,
    )
  }
  return JSON.parse(text)
}

function graphEventResult(res: Record<string, unknown>): CalendarEventResult {
  const online = res.onlineMeeting as { joinUrl?: string } | undefined
  return {
    externalEventId: String(res.id ?? ''),
    // Graph returns @odata.etag, not etag.
    etag:            (res['@odata.etag'] as string) ?? null,
    meetingUrl:      online?.joinUrl ?? null,
    htmlLink:        (res.webLink as string) ?? null,
  }
}
