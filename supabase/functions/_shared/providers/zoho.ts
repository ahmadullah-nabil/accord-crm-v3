// ─── Zoho adapter ─────────────────────────────────────────────────────────────
//
// Zoho Mail (send) + Zoho Calendar.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ DATA CENTRES — the thing that breaks naive Zoho integrations            │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ Zoho runs regionally isolated data centres, each with its own accounts  │
// │ host and its own API host. An account in the EU DC is INVISIBLE to      │
// │ accounts.zoho.com — tokens are not portable between DCs.                │
// │                                                                          │
// │ So nothing here hardcodes `.com`:                                        │
// │   1. The callback carries a `location` (and `accounts-server`) param     │
// │      telling us which DC the user actually authorised in.                │
// │   2. The token response carries `api_domain` for that DC.                │
// │   3. We persist api_domain on the account row and use it for every       │
// │      later call — refresh, identity and revoke included.                 │
// └─────────────────────────────────────────────────────────────────────────┘
//
// `access_type=offline` is mandatory. Without it Zoho defaults to online and
// issues NO refresh token — the single most common Zoho integration failure.

import type {
  AuthUrlParams, CallbackContext, Capability, ProviderAdapter, ProviderAuth,
  ProviderIdentity, SendEmailInput, SendEmailResult, TokenSet,
} from '../types.ts'
import { IntegrationError } from '../types.ts'
import { postForm, expiresAtFrom } from '../http.ts'

/** Region code → accounts host. Zoho's published data-centre list. */
const ACCOUNTS_HOSTS: Record<string, string> = {
  us: 'https://accounts.zoho.com',
  eu: 'https://accounts.zoho.eu',
  in: 'https://accounts.zoho.in',
  au: 'https://accounts.zoho.com.au',
  jp: 'https://accounts.zoho.jp',
  ca: 'https://accounts.zohocloud.ca',
  sa: 'https://accounts.zoho.sa',
}

const DEFAULT_ACCOUNTS = ACCOUNTS_HOSTS.us

/**
 * Resolve the accounts host for this callback.
 * Zoho sends `accounts-server` (a full URL) and/or `location` (a region code).
 * We trust the explicit server when present, fall back to the region code, and
 * only then to the US default.
 */
function accountsHostFrom(ctx: CallbackContext): string {
  const server = ctx['accounts-server'] ?? ctx.accounts_server
  if (server) {
    try {
      const url = new URL(server)
      // Only accept hosts that are actually Zoho, never an attacker-supplied one.
      if (/\.zoho\.[a-z.]+$|\.zohocloud\.ca$/i.test(url.hostname)) return url.origin
    } catch { /* fall through */ }
  }
  const loc = (ctx.location ?? '').toLowerCase()
  return ACCOUNTS_HOSTS[loc] ?? DEFAULT_ACCOUNTS
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ SCOPES — SEND ONLY. NO INBOX ACCESS.                                    │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ ZohoMail.messages.CREATE                                                 │
// │   Send mail. CREATE only — not READ, not UPDATE, not ALL.                │
// │                                                                          │
// │ ZohoMail.accounts.READ  ← account identity + send target, NOT the inbox  │
// │   Zoho separates these into two distinct scope namespaces:               │
// │     ZohoMail.accounts.*   account information                            │
// │     ZohoMail.messages.*   message content                                │
// │   `accounts.READ` grants only the former: accountId, zuid, mailbox       │
// │   address, aliases, timezone, storage. Reading an email — listing, its   │
// │   metadata, or its original content — requires ZohoMail.messages.READ    │
// │   (or .ALL), which this application NEVER requests. A token holding      │
// │   accounts.READ alone is rejected by every message-reading endpoint.     │
// │                                                                          │
// │   It is also not optional. Zoho's send endpoint is                       │
// │     POST /api/accounts/{accountId}/messages                              │
// │   and that accountId is obtainable ONLY from the accounts API. Without   │
// │   accounts.READ we could not send at all, let alone label the account.   │
// │                                                                          │
// │ NEVER add ZohoMail.messages.READ / .UPDATE / .ALL here. Inbox reading    │
// │ is explicitly out of scope, and adding it would change what the consent  │
// │ screen asks the user to approve.                                         │
// └─────────────────────────────────────────────────────────────────────────┘
const CAPABILITY_SCOPES: Record<Capability, string[]> = {
  email:    ['ZohoMail.messages.CREATE', 'ZohoMail.accounts.READ'],
  // Calendar carries NO mail scope at all — a calendar-only connection cannot
  // touch the mailbox in any way. Identity for those connections is resolved
  // via the accounts-server userinfo endpoint instead (see fetchIdentity), and
  // that endpoint is itself gated behind AaaServer.profile.READ. Without it the
  // connection has no way to learn the account's email and fails at the
  // identity step even though the token exchange succeeded.
  //
  // AaaServer.profile.READ grants name/email/ZUID only. It confers NO access to
  // mail, calendar data, or any other Zoho service.
  calendar: ['ZohoCalendar.event.ALL', 'AaaServer.profile.READ'],
}

export const zohoAdapter: ProviderAdapter = {
  id: 'zoho',
  label: 'Zoho',
  capabilities: ['email', 'calendar'],

  // ┌───────────────────────────────────────────────────────────────────────┐
  // │ UNVERIFIED — and deliberately not assumed either way.                 │
  // ├───────────────────────────────────────────────────────────────────────┤
  // │ Zoho's send API documents fromAddress, toAddress, subject, content,   │
  // │ mailFormat, askReceipt, encoding, attachments and the scheduling      │
  // │ fields. It says NOTHING about the Sent folder, and exposes no flag to │
  // │ control it — unlike Graph, which has saveToSentItems.                 │
  // │                                                                       │
  // │ The endpoint is /api/accounts/{accountId}/messages: an operation on   │
  // │ the mailbox itself, not an SMTP relay, which makes a native Sent copy │
  // │ very likely. Likely is not verified, so this reads 'unverified' until │
  // │ someone sends from a live Zoho account and looks.                     │
  // │                                                                       │
  // │ IF IT TURNS OUT NOT TO: the fallback is not free. Filing a copy would │
  // │ mean listing folders to find the Sent folder id, which needs          │
  // │ ZohoMail.folders.READ — a new scope on the consent screen — and then  │
  // │ a second create-in-folder call per send. That is a scope decision,    │
  // │ not a bug fix, and it should be made deliberately rather than         │
  // │ reflexively.                                                          │
  // └───────────────────────────────────────────────────────────────────────┘
  sentCopy: 'unverified',

  scopesFor(capability) {
    return [...CAPABILITY_SCOPES[capability]]
  },

  buildAuthUrl({ state, codeChallenge, redirectUri, capability }: AuthUrlParams) {
    // The authorization request always starts at the configured home DC; Zoho
    // itself redirects the user to their own DC and reports it back on the
    // callback via `location` / `accounts-server`.
    const host = Deno.env.get('ZOHO_ACCOUNTS_HOST') ?? DEFAULT_ACCOUNTS
    const params = new URLSearchParams({
      client_id:     Deno.env.get('ZOHO_CLIENT_ID')!,
      response_type: 'code',
      redirect_uri:  redirectUri,
      scope:         this.scopesFor(capability).join(','),   // Zoho uses commas
      state,
      code_challenge:        codeChallenge,
      code_challenge_method: 'S256',
      // Without offline there is no refresh token at all.
      access_type: 'offline',
      // Force the consent screen so a reconnect reliably re-issues a refresh
      // token instead of returning only an access token.
      prompt: 'consent',
    })
    return `${host}/oauth/v2/auth?${params.toString()}`
  },

  async exchangeCode(code, codeVerifier, redirectUri, ctx: CallbackContext): Promise<TokenSet> {
    const host = accountsHostFrom(ctx)

    const body = await postForm(`${host}/oauth/v2/token`, {
      code,
      client_id:     Deno.env.get('ZOHO_CLIENT_ID')!,
      client_secret: Deno.env.get('ZOHO_CLIENT_SECRET')!,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
      code_verifier: codeVerifier,
    })

    if (!body.refresh_token) {
      throw new IntegrationError(
        'no_refresh_token',
        'Zoho did not return a refresh token. Ensure access_type=offline and that Accord CRM is removed from your Zoho connected apps before retrying.',
      )
    }

    return {
      accessToken:   body.access_token,
      refreshToken:  body.refresh_token,
      tokenType:     body.token_type ?? 'Bearer',
      expiresAt:     expiresAtFrom(body.expires_in),
      grantedScopes: String(body.scope ?? '').split(/[,\s]+/).filter(Boolean),
      // The DC-specific API host. Everything later depends on persisting this.
      apiDomain:     body.api_domain ?? host,
    }
  },

  async refresh(refreshToken, apiDomain): Promise<TokenSet> {
    // Refresh must go to the SAME data centre that issued the token.
    const host = zohoAccountsFromApiDomain(apiDomain)
    const body = await postForm(`${host}/oauth/v2/token`, {
      refresh_token: refreshToken,
      client_id:     Deno.env.get('ZOHO_CLIENT_ID')!,
      client_secret: Deno.env.get('ZOHO_CLIENT_SECRET')!,
      grant_type:    'refresh_token',
    })
    return {
      accessToken: body.access_token,
      // Zoho refresh tokens are long-lived and not rotated on refresh.
      refreshToken:  undefined,
      tokenType:     body.token_type ?? 'Bearer',
      expiresAt:     expiresAtFrom(body.expires_in),
      grantedScopes: String(body.scope ?? '').split(/[,\s]+/).filter(Boolean),
      apiDomain:     body.api_domain ?? apiDomain ?? null,
    }
  },

  async fetchIdentity(accessToken, apiDomain): Promise<ProviderIdentity> {
    const accountsHost = zohoAccountsFromApiDomain(apiDomain)
    // Zoho Mail is NOT served from zohoapis.<tld> — that host serves CRM, Desk,
    // Books and friends. The mailbox API lives on mail.zoho.<tld>/api/accounts.
    // The token response's api_domain therefore identifies the DATA CENTRE, not
    // the mail host, so we derive the mail host from the accounts host instead.
    const mailHost = accountsHost.replace('//accounts.', '//mail.')

    // Ordered candidates. The first that yields an identity wins. Each is
    // logged with status and body so a failure is diagnosable from the function
    // log alone rather than needing another round trip.
    const candidates: Array<{ url: string; kind: 'mail' | 'userinfo' }> = [
      { url: `${mailHost}/api/accounts`,        kind: 'mail' },
      { url: `${apiDomain ?? ''}/mail/v1/accounts`, kind: 'mail' },
      { url: `${accountsHost}/oauth/user/info`, kind: 'userinfo' },
    ].filter((c) => !c.url.startsWith('/'))

    const attempts: string[] = []

    for (const { url, kind } of candidates) {
      let status = 0
      let text = ''
      try {
        // EVERY Zoho API call uses this header scheme. Plain `Bearer` is
        // rejected outright — that is why the old userinfo fallback, which went
        // through getJson(), could never have succeeded.
        const res = await fetch(url, {
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            Accept: 'application/json',
          },
        })
        status = res.status
        text = await res.text()
      } catch (err) {
        attempts.push(`${url} → network error: ${String(err).slice(0, 120)}`)
        continue
      }

      console.log(`[zoho] identity ${url} → ${status} ${text.slice(0, 400)}`)
      attempts.push(`${url} → ${status}`)

      let payload: any = null
      try { payload = JSON.parse(text) } catch { /* non-JSON body */ }
      if (!payload) continue

      if (kind === 'mail') {
        const acc = Array.isArray(payload?.data) ? payload.data[0] : null
        if (acc) {
          return {
            accountId: String(acc.zuid ?? acc.accountId ?? ''),
            email:     acc.primaryEmailAddress ?? acc.mailboxAddress ?? '',
            name:      acc.displayName ?? acc.accountDisplayName ?? '',
          }
        }
      } else {
        // Calendar-only connections deliberately hold NO mail scope, so the
        // mailbox endpoints legitimately fail for them. userinfo is the correct
        // identity source in that case, not an error path.
        if (payload?.ZUID || payload?.sub) {
          return {
            accountId: String(payload.ZUID ?? payload.sub),
            email:     payload.Email ?? payload.email ?? '',
            name:      payload.Display_Name ?? payload.name ?? '',
          }
        }
      }
    }

    throw new IntegrationError(
      'identity_failed',
      `Could not read the Zoho account identity. Attempts: ${attempts.join(' | ')}`,
    )
  },

  /**
   * Send through Zoho Mail.
   *
   * ┌───────────────────────────────────────────────────────────────────────┐
   * │ THIS ENDPOINT DOES NOT TAKE MIME. It takes a JSON object.             │
   * ├───────────────────────────────────────────────────────────────────────┤
   * │ Google and Microsoft both accept a raw RFC 2822 message, so both use  │
   * │ buildMimeMessage() unchanged. Zoho has no raw-message endpoint at     │
   * │ all: you hand it fromAddress / toAddress / subject / content and it   │
   * │ assembles the message itself. Three consequences, all of them real:   │
   * │                                                                       │
   * │ 1. THE PLAIN-TEXT ALTERNATIVE IS NOT OURS TO SEND. mailFormat picks   │
   * │    html OR plaintext; there is no way to supply both parts. We send   │
   * │    html and Zoho derives its own text alternative. input.text is      │
   * │    still generated and still stored in email_messages — the CRM's     │
   * │    own record of what went out stays consistent across providers      │
   * │    even though the wire format differs.                               │
   * │                                                                       │
   * │ 2. THREADING HEADERS CANNOT BE SET. The send endpoint has no          │
   * │    In-Reply-To or References parameter. Zoho's separate reply         │
   * │    endpoint would thread, but it is addressed by the ORIGINAL Zoho    │
   * │    messageId — a value obtainable only by reading the mailbox, which  │
   * │    ZohoMail.messages.CREATE deliberately does not permit. So replies  │
   * │    sent from the CRM through Zoho arrive unthreaded. That is a        │
   * │    provider limitation under send-only scope, not a bug to hunt.      │
   * │                                                                       │
   * │ 3. accountId IS NOT provider_account_id. fetchIdentity() stores the   │
   * │    ZUID on integration_accounts, because that is the stable identity. │
   * │    This endpoint needs the MAIL accountId, a different field of the   │
   * │    same accounts response, so it has to be resolved separately —      │
   * │    see resolveMailAccount() below.                                    │
   * └───────────────────────────────────────────────────────────────────────┘
   */
  async sendEmail(auth: ProviderAuth, input: SendEmailInput): Promise<SendEmailResult> {
    const mailHost = zohoMailFromApiDomain(auth.apiDomain)
    const account  = await resolveMailAccount(auth, mailHost)

    // Zoho takes recipients as ONE comma-separated string per field, not an
    // array. Display names are dropped: the endpoint documents these as plain
    // address fields, and a "Name <addr>" value is rejected by some DCs.
    const addresses = (list?: { email: string }[]) =>
      (list ?? []).map((a) => a.email.trim()).filter(Boolean).join(',')

    const body: Record<string, unknown> = {
      // MUST be an address the authenticated account is allowed to send as.
      // resolveMailAccount picks a validated one rather than trusting the
      // stored account_email, which can drift from the mailbox's send
      // identities after an alias change.
      fromAddress: account.fromAddress,
      toAddress:   addresses(input.to),
      subject:     input.subject,
      content:     input.html,
      mailFormat:  'html',
      encoding:    'UTF-8',
    }
    if (input.cc?.length)  body.ccAddress  = addresses(input.cc)
    if (input.bcc?.length) body.bccAddress = addresses(input.bcc)

    const res = await fetch(`${mailHost}/api/accounts/${account.accountId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: auth.authorization,   // Zoho-oauthtoken, never Bearer
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })

    const text = await res.text()
    let payload: any = null
    try { payload = JSON.parse(text) } catch { /* non-JSON error body */ }

    // Zoho reports failure in TWO places and they do not always agree: the HTTP
    // status, and a status.code inside a 200 response. Checking only res.ok
    // would record a failed send as successful.
    const apiCode = Number(payload?.status?.code ?? (res.ok ? 200 : res.status))
    if (!res.ok || apiCode !== 200) {
      const detail =
        payload?.data?.moreInfo ??
        payload?.status?.description ??
        text.slice(0, 300)
      console.error(`[zoho] send failed http=${res.status} api=${apiCode}: ${detail}`)
      throw new IntegrationError(
        'send_failed',
        `Zoho rejected the message: ${detail}`,
        res.status === 429 || res.status >= 500 ? 502 : 400,
        String(apiCode),
      )
    }

    return {
      // Zoho's own id for the stored message. Not an RFC Message-ID.
      providerMessageId: payload?.data?.messageId != null
        ? String(payload.data.messageId)
        : null,
      providerThreadId: null,   // no thread concept on this endpoint
      messageId: input.messageId ?? '',
    }
  },

  async revoke(token, apiDomain): Promise<boolean> {
    const host = zohoAccountsFromApiDomain(apiDomain)
    try {
      const res = await fetch(
        `${host}/oauth/v2/token/revoke?${new URLSearchParams({ token }).toString()}`,
        { method: 'POST' },
      )
      return res.ok
    } catch (err) {
      console.error('[zoho] revoke failed:', err)
      return false
    }
  },
}

/** Map a stored api_domain back to the matching accounts host in the same DC. */
function zohoAccountsFromApiDomain(apiDomain?: string | null): string {
  if (!apiDomain) return DEFAULT_ACCOUNTS
  try {
    const host = new URL(apiDomain).hostname          // e.g. www.zohoapis.eu
    const tld  = host.replace(/^.*?zohoapis\./i, '')  // e.g. eu | com | com.au
    const match = Object.values(ACCOUNTS_HOSTS).find((a) => a.endsWith(`.${tld}`))
    return match ?? DEFAULT_ACCOUNTS
  } catch {
    return DEFAULT_ACCOUNTS
  }
}

/** Map a stored api_domain to the MAIL host in the same data centre.
 *  Not zohoapis.<tld> — that host serves CRM, Desk and Books, never Mail. */
function zohoMailFromApiDomain(apiDomain?: string | null): string {
  return zohoAccountsFromApiDomain(apiDomain).replace('//accounts.', '//mail.')
}

// ── Mail account resolution ───────────────────────────────────────────────────
//
// The send endpoint is addressed by Zoho's MAIL accountId, which we do not
// store: integration_accounts.provider_account_id holds the ZUID, because that
// is the identity that survives an address change. Both values come from the
// same GET /api/accounts response, so one extra call per send resolves it.
//
// Cached in-isolate to keep that off the hot path for a burst of sends handled
// by the same warm instance — the same pragmatic scope as the refresh
// coalescing map in tokens.ts. It is not shared between isolates and does not
// need to be: a miss costs one cheap GET, never a wrong answer.
//
// TEN MINUTES, not indefinite. A mailbox's send identities change when an alias
// is added or verified, and a stale fromAddress is rejected outright by the
// send endpoint.
//
// If this call ever becomes a measurable cost, the durable fix is a
// provider_metadata JSONB column on integration_accounts — a schema change to
// the proven integration layer, so it needs a decision rather than a commit.

interface ZohoMailAccount {
  accountId: string
  fromAddress: string
}

const MAIL_ACCOUNT_TTL_MS = 10 * 60 * 1000
const mailAccountCache = new Map<string, { value: ZohoMailAccount; expiresAt: number }>()

async function resolveMailAccount(
  auth: ProviderAuth,
  mailHost: string,
): Promise<ZohoMailAccount> {
  const key = `${mailHost}|${auth.accountEmail.toLowerCase()}`
  const hit = mailAccountCache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value

  const res = await fetch(`${mailHost}/api/accounts`, {
    headers: { Authorization: auth.authorization, Accept: 'application/json' },
  })
  const text = await res.text()

  if (!res.ok) {
    console.error(`[zoho] accounts lookup failed ${res.status}: ${text.slice(0, 300)}`)
    throw new IntegrationError(
      'send_failed',
      'Could not read the Zoho mailbox details needed to send. Please reconnect the account.',
      res.status >= 500 ? 502 : 400,
      String(res.status),
    )
  }

  let payload: any = null
  try { payload = JSON.parse(text) } catch { /* handled below */ }
  const accounts: any[] = Array.isArray(payload?.data) ? payload.data : []

  if (accounts.length === 0) {
    throw new IntegrationError(
      'send_failed',
      'Zoho returned no mailbox for this account.',
      400,
    )
  }

  const wanted = auth.accountEmail.trim().toLowerCase()
  const matches = (acc: any) =>
    [acc?.primaryEmailAddress, acc?.mailboxAddress, acc?.incomingUserName]
      .filter(Boolean)
      .some((addr: string) => String(addr).toLowerCase() === wanted)

  // Prefer the mailbox we actually connected. A user can have several accounts
  // on one Zoho login — including IMAP_ACCOUNT entries for external mailboxes —
  // and sending from the wrong one would work, which is what makes it dangerous.
  const account =
    accounts.find(matches) ??
    accounts.find((acc) => acc?.type === 'ZOHO_ACCOUNT') ??
    accounts[0]

  const accountId = account?.accountId != null ? String(account.accountId) : ''
  if (!accountId) {
    throw new IntegrationError(
      'send_failed',
      'Zoho returned a mailbox with no account id.',
      400,
    )
  }

  // sendMailDetails lists every identity this mailbox may send as. Prefer a
  // live one that matches the connected address; mode 'mailbox' is the account's
  // own address, 'extfrom' is an external identity that may not be validated.
  const identities: any[] = Array.isArray(account?.sendMailDetails)
    ? account.sendMailDetails
    : []
  const usable = identities.filter((d) => d?.status !== false && d?.fromAddress)

  const fromAddress =
    usable.find((d) => String(d.fromAddress).toLowerCase() === wanted)?.fromAddress ??
    usable.find((d) => d.mode === 'mailbox')?.fromAddress ??
    account?.primaryEmailAddress ??
    account?.mailboxAddress ??
    auth.accountEmail

  const value: ZohoMailAccount = { accountId, fromAddress: String(fromAddress) }
  mailAccountCache.set(key, { value, expiresAt: Date.now() + MAIL_ACCOUNT_TTL_MS })
  return value
}
