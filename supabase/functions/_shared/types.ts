// ─── Integration Contract ─────────────────────────────────────────────────────
//
// The provider-agnostic interface every adapter implements. Adding a provider
// (IMAP/SMTP, CalDAV, Fastmail, …) means writing one new file that satisfies
// ProviderAdapter and registering it — no change to the Edge Functions, the
// database, or the UI wiring.
//
// Email and Calendar are SEPARATE capabilities throughout. A provider account
// may hold one, the other, or both; nothing assumes both are present.

/** A distinct thing the CRM can do with an external account. */
export type Capability = 'email' | 'calendar'

/** Providers implemented in this phase. */
export type ProviderId = 'google' | 'microsoft' | 'zoho'

export type ConnectionStatus = 'connected' | 'reauth_required' | 'revoked' | 'error'

/** Identity of the external account, fetched after a successful exchange. */
export interface ProviderIdentity {
  /** Stable provider-side id — Google `sub`, Microsoft `id`, Zoho `ZUID`.
   *  Deliberately NOT the email address, which can change. */
  accountId: string
  email: string
  name: string
}

/** Normalised result of an authorization-code or refresh-token exchange. */
export interface TokenSet {
  accessToken: string
  /** Absent when the provider declines to issue one — treated as a hard error
   *  at connect time, since the integration could not survive an hour. */
  refreshToken?: string
  tokenType: string
  expiresAt: string | null
  /** Scopes the provider ACTUALLY granted, which may be fewer than requested. */
  grantedScopes: string[]
  /** Zoho returns the data-centre API host here. Null for global providers. */
  apiDomain?: string | null
}

export interface AuthUrlParams {
  state: string
  codeChallenge: string
  redirectUri: string
  capability: Capability
  /** Optional login hint so re-auth lands on the right account. */
  loginHint?: string
}

/** Extra provider-specific data carried on the callback query string.
 *  Zoho uses this to tell us which data centre the user actually authorised. */
export type CallbackContext = Record<string, string>

export interface ProviderAdapter {
  readonly id: ProviderId
  readonly label: string
  /** Capabilities this adapter can serve. Not every provider offers both. */
  readonly capabilities: Capability[]

  /** Minimum scopes for ONE capability. Never a union "just in case". */
  scopesFor(capability: Capability): string[]

  /** Full provider authorization URL to redirect the browser to. */
  buildAuthUrl(params: AuthUrlParams): string

  /** Exchange the authorization code for tokens. */
  exchangeCode(
    code: string,
    codeVerifier: string,
    redirectUri: string,
    ctx: CallbackContext,
  ): Promise<TokenSet>

  /** Trade a refresh token for a fresh access token. */
  refresh(refreshToken: string, apiDomain?: string | null): Promise<TokenSet>

  /** Who does this token belong to? */
  fetchIdentity(accessToken: string, apiDomain?: string | null): Promise<ProviderIdentity>

  /** Revoke at the provider. Returns false when unsupported or already gone —
   *  never throws, because local cleanup must proceed regardless. */
  revoke(token: string, apiDomain?: string | null): Promise<boolean>
}

/** Raised with a stable machine-readable code so the UI can react precisely
 *  instead of pattern-matching on English. */
export class IntegrationError extends Error {
  constructor(
    public code:
      | 'access_denied'          // user cancelled or declined at the provider
      | 'invalid_state'          // unknown, expired, or already-used state
      | 'state_replayed'         // second use of a single-use state
      | 'no_refresh_token'       // provider issued none — connection unusable
      | 'scope_denied'           // required scope not granted
      | 'exchange_failed'        // token endpoint rejected the code
      | 'refresh_failed'         // refresh token no longer valid
      | 'identity_failed'        // could not read the account identity
      | 'admin_consent_required' // Microsoft tenant policy
      | 'provider_error'
      | 'unauthorized'
      | 'bad_request',
    message: string,
    public status = 400,
    /**
     * The provider's own machine-readable error code, verbatim — e.g. Google's
     * `invalid_grant`, Zoho's `invalid_code`, Microsoft's `AADSTS700082`.
     *
     * Exists because `message` prefers the provider's human-readable
     * error_description, which discards the code. Token refresh has to tell a
     * DEAD refresh token (permanent — the user must reconnect) from a provider
     * hiccup (transient — retry later), and that distinction lives in the code,
     * not the prose. Classifying on English text would break the moment a
     * provider rewords a message.
     */
    public providerError?: string,
  ) {
    super(message)
    this.name = 'IntegrationError'
  }
}
