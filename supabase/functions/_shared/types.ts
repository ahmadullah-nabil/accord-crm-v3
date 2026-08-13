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

// ─── Email sending (Phase 1) ──────────────────────────────────────────────────

export interface EmailAddress {
  email: string
  name?: string
}

/** One file on an outgoing message. Declared now; populated in Phase 1b. */
export interface EmailAttachment {
  filename: string
  mimeType: string
  /** Base64 of the file bytes (NOT base64url, NOT a data: URL). */
  contentBase64: string
  /** Set only for images referenced inline from the HTML body via cid:. */
  contentId?: string
}

/**
 * A message to send, in provider-neutral form.
 *
 * Both the HTML and the plain-text body are REQUIRED, not optional. Making the
 * text part optional would mean the first caller that forgot it silently ships
 * html-only mail, which is the single easiest way to land in a spam folder.
 * send-email derives the text part automatically, so no caller has to write it.
 */
/** One invitation recipient. `source` records where the address came from so
 *  the UI can distinguish a CRM contact from a hand-typed address. */
export interface CalendarAttendee {
  email: string
  name?: string
  source?: 'internal' | 'external' | 'contact'
}

export interface CalendarEventInput {
  title: string
  description?: string
  location?: string

  /**
   * Local wall-clock start/end, paired with an IANA `timezone`.
   *
   * NOT a UTC instant. Providers store the zone alongside the time so that an
   * event booked for 3pm Dhaka stays 3pm Dhaka if the zone's rules change, and
   * so each attendee sees it converted into their own zone. Collapsing to UTC
   * here would throw away the information needed to do either.
   */
  start: string          // 'YYYY-MM-DDTHH:mm:ss'
  end: string            // 'YYYY-MM-DDTHH:mm:ss'
  timezone: string       // IANA, e.g. 'Asia/Dhaka' — never an offset

  attendees: CalendarAttendee[]

  /** Ask the provider to attach a Meet/Teams link. Zoho has no equivalent. */
  addConferencing?: boolean

  /** False suppresses attendee email. Used when only internal fields changed. */
  sendNotifications?: boolean
}

export interface CalendarEventResult {
  externalEventId: string
  /** Provider version marker, stored for later inbound sync. */
  etag?: string | null
  /** Meet/Teams join URL, when the provider created one. */
  meetingUrl?: string | null
  /** Provider's own web link to the event. */
  htmlLink?: string | null
}

export interface SendEmailInput {
  from: EmailAddress
  to: EmailAddress[]
  cc?: EmailAddress[]
  bcc?: EmailAddress[]
  replyTo?: EmailAddress
  subject: string
  html: string
  text: string

  /** Pre-generated Message-ID, so the stored value and the sent header match. */
  messageId?: string
  /** Message-ID of the message being replied to. */
  inReplyTo?: string | null
  /** Full chain, oldest first. Sent as the References header. */
  references?: string[]
  /**
   * Provider-side conversation id, when we have one from an earlier send.
   * Only Gmail consumes this today (threadId on messages.send).
   */
  providerThreadId?: string | null

  attachments?: EmailAttachment[]
}

export interface SendEmailResult {
  /** The provider's own id for the sent message. Null when it returns none. */
  providerMessageId: string | null
  /** The provider's conversation id, where the concept exists. */
  providerThreadId: string | null
  /** The Message-ID header actually written into the message we submitted. */
  messageId: string
}

/**
 * Whether a provider files its own copy of a sent message in the user's Sent
 * folder. Declared per adapter rather than assumed, because a user who sends
 * from the CRM, opens their mailbox and finds nothing in Sent concludes the
 * mail was never sent — the failure mode looks identical to a real failure.
 *
 *   native      documented to save a copy with no extra call from us
 *   unverified  no documented statement either way; must be confirmed against
 *               a live account before the UI promises anything
 *   none        confirmed not to; would need an explicit append after sending
 */
export type SentCopyBehaviour = 'native' | 'unverified' | 'none'

/**
 * What an adapter needs to authenticate one API call.
 *
 * Deliberately NOT the ValidToken from tokens.ts: types.ts is imported BY
 * tokens.ts, so depending on it here would make the module graph circular.
 * The caller builds this from a ValidToken — `authorization` comes from
 * authHeader(), which is the one place that knows Zoho needs its own scheme.
 */
export interface ProviderAuth {
  /** Complete Authorization header value, scheme included. */
  authorization: string
  /** Zoho's data-centre API host. Null for Google and Microsoft. */
  apiDomain: string | null
  /** The connected mailbox address (integration_accounts.account_email). */
  accountEmail: string
  accountName: string
}

export interface ProviderAdapter {
  readonly id: ProviderId
  readonly label: string
  /** Capabilities this adapter can serve. Not every provider offers both. */
  readonly capabilities: Capability[]
  /** See SentCopyBehaviour. Read by the UI before it claims anything. */
  readonly sentCopy: SentCopyBehaviour

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

  /**
   * Send one message from the connected mailbox.
   *
   * Implementations MUST throw IntegrationError('send_failed', …) on a provider
   * rejection, with status 502 for anything retryable (5xx, throttling) and 400
   * for anything the caller could fix (bad address, oversized body). send-email
   * records the distinction, and Phase 3's retry logic will act on it.
   *
   * Only present on adapters whose `capabilities` include 'email'.
   */
  sendEmail(auth: ProviderAuth, input: SendEmailInput): Promise<SendEmailResult>

  // ── Calendar (Phase 2) ────────────────────────────────────────────────────
  //
  // One-way push only: the CRM is the source of truth and these three verbs
  // are the whole surface. There is deliberately no read/list — RSVP and
  // inbound sync need webhook channels, a renewal cron and delta tokens, and
  // are out of scope until users ask for them.
  //
  // Implementations MUST throw IntegrationError('calendar_failed', …) with
  // status 502 for retryable provider faults and 400 for caller-fixable ones,
  // matching sendEmail's contract so Phase 3 retry logic treats both alike.
  //
  // Only present on adapters whose `capabilities` include 'calendar'.

  /** Create the event and invite `attendees`. Returns the provider's id. */
  createEvent(auth: ProviderAuth, input: CalendarEventInput): Promise<CalendarEventResult>

  /**
   * Update an existing event in place.
   *
   * MUST update rather than delete-and-recreate: recreating issues fresh
   * invitations, so every attendee is re-mailed and any RSVP they already gave
   * is discarded. A time change should reach them as an update, not as a second
   * meeting.
   */
  updateEvent(
    auth: ProviderAuth,
    externalEventId: string,
    input: CalendarEventInput,
  ): Promise<CalendarEventResult>

  /**
   * Cancel the event, notifying attendees.
   *
   * Returns true when the event is gone at the provider — INCLUDING when it was
   * already absent (404). A cancel whose target no longer exists has achieved
   * its purpose, and treating that as failure would strand the local row in
   * 'failed' forever with nothing to retry.
   */
  cancelEvent(auth: ProviderAuth, externalEventId: string): Promise<boolean>
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
      | 'no_email_account'       // no connected account can send mail (Phase 1)
      | 'send_failed'            // the provider rejected the message (Phase 1)
      | 'calendar_failed'        // provider rejected an event create/update/cancel
      | 'invalid_recipient'      // a recipient address is malformed (Phase 1)
      | 'attachment_too_large'   // over the sending provider's ceiling (1b)
      | 'attachment_failed'      // could not read or upload a file (Phase 1b)
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
