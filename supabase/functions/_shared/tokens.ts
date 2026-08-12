// ─── Token Lifecycle ──────────────────────────────────────────────────────────
//
// PHASE 0. Every feature built on an integration — sending mail, pushing a
// calendar event — needs a token that is valid *right now*. Access tokens live
// about an hour on all three providers, so without this module every connection
// is functionally dead an hour after the user clicks Connect.
//
// This is the ONLY place a provider access token is read, refreshed or written.
// Nothing outside `_shared/` should touch `integration_credentials` directly.
//
//   const token = await getValidAccessToken(accountId)
//   fetch(url, { headers: { Authorization: `${token.tokenType} ${token.accessToken}` } })
//
// Zoho is the exception to that header line — it requires `Zoho-oauthtoken`,
// never `Bearer`. `authHeader()` below returns the right one per provider, so
// callers never have to remember which.
//
// WHY THIS RUNS SERVER-SIDE ONLY
// ──────────────────────────────
// It uses the service-role client, which bypasses RLS, because
// `integration_credentials` has RLS enabled with ZERO policies — no browser can
// read a row from it under any query. That is deliberate and load-bearing.
// Every function here takes an accountId that the CALLER must already have
// authorised; see requireAccountOwner() for the guard.

import { adminClient } from './supabase.ts'
import { getAdapter } from './providers/index.ts'
import { IntegrationError, type ProviderId, type TokenSet } from './types.ts'

/**
 * Refresh this far ahead of the stated expiry.
 *
 * A token that is technically valid for another 30 seconds is not useful: the
 * request still has to travel, and a large send can take longer than that. Five
 * minutes costs one extra refresh per hour at worst and removes a whole class
 * of intermittent 401s that would otherwise be near-impossible to reproduce.
 */
const EXPIRY_SKEW_MS = 5 * 60 * 1000

/**
 * Provider error codes that mean the REFRESH TOKEN ITSELF is dead, not that the
 * provider is having a bad minute. These are the only conditions under which we
 * mark an account `reauth_required` — anything else is treated as transient and
 * left alone, because wrongly telling a user to reconnect is worse than a
 * retryable failure they never see.
 *
 * How each provider signals it:
 *   Google     invalid_grant — revoked, expired (7 days while the app is in
 *              Testing mode), or the user changed their password with Gmail
 *              scopes attached
 *   Microsoft  invalid_grant / interaction_required — also fires when the
 *              rotated refresh token was superseded
 *   Zoho       invalid_code / invalid_client — refresh tokens are permanent
 *              unless explicitly revoked, so this is nearly always a real revoke
 */
const PERMANENT_REFRESH_FAILURES = new Set([
  'invalid_grant',
  'invalid_code',
  'unauthorized_client',
  'interaction_required',
  'consent_required',
  'invalid_request',
])

export interface ValidToken {
  accountId: string
  provider: ProviderId
  accessToken: string
  tokenType: string
  /** Zoho's data-centre host. Null for Google and Microsoft. */
  apiDomain: string | null
  /** True when this call performed a refresh rather than reusing a stored token. */
  refreshed: boolean
  expiresAt: string | null
}

interface AccountRow {
  id: string
  user_id: string
  provider: ProviderId
  api_domain: string | null
  status: string
  capabilities: string[]
}

interface CredentialRow {
  access_token: string
  refresh_token: string | null
  token_type: string
  expires_at: string | null
}

// ── Concurrency ───────────────────────────────────────────────────────────────
//
// Two sends firing at once would both see an expired token and both refresh.
// For Google and Zoho that is merely wasteful — their refresh tokens are not
// rotated, so both calls succeed. For MICROSOFT it is a correctness bug: it
// rotates the refresh token on every use, so the slower of two concurrent
// refreshes can invalidate the token the faster one just stored, and the
// account dies for no reason the user could ever explain.
//
// This map coalesces concurrent refreshes for the same account **within one
// isolate**, which covers the common case (a burst of sends handled by the same
// warm Edge Function instance). It is not a distributed lock — two separate
// isolates can still race. The recovery path in refreshAndStore() handles that
// residual case by re-reading the stored credential before giving up, so a lost
// race self-heals instead of marking a live account dead.
const inFlight = new Map<string, Promise<ValidToken>>()

/**
 * Return an access token for this integration account that is valid now,
 * refreshing it first if necessary.
 *
 * @throws IntegrationError
 *   `refresh_failed` (401)  the refresh token is dead; the account has been
 *                           marked reauth_required and the user must reconnect
 *   `refresh_failed` (502)  the provider failed transiently; safe to retry
 *   `bad_request`   (404)   no such account, or it has no stored credentials
 */
export async function getValidAccessToken(
  accountId: string,
  opts: { forceRefresh?: boolean } = {},
): Promise<ValidToken> {
  if (!accountId) {
    throw new IntegrationError('bad_request', 'accountId is required.', 400)
  }

  const existing = inFlight.get(accountId)
  if (existing && !opts.forceRefresh) return existing

  const work = resolveToken(accountId, opts).finally(() => {
    inFlight.delete(accountId)
  })
  inFlight.set(accountId, work)
  return work
}

async function resolveToken(
  accountId: string,
  opts: { forceRefresh?: boolean },
): Promise<ValidToken> {
  const admin = adminClient()

  const { data: account, error: accErr } = await admin
    .from('integration_accounts')
    .select('id, user_id, provider, api_domain, status, capabilities')
    .eq('id', accountId)
    .maybeSingle<AccountRow>()

  if (accErr) throw accErr
  if (!account) {
    throw new IntegrationError('bad_request', 'Integration account not found.', 404)
  }

  const { data: cred, error: credErr } = await admin
    .from('integration_credentials')
    .select('access_token, refresh_token, token_type, expires_at')
    .eq('account_id', accountId)
    .maybeSingle<CredentialRow>()

  if (credErr) throw credErr
  if (!cred) {
    // The account row exists but its credentials do not. Not recoverable by
    // refreshing — there is nothing to refresh with.
    await markReauthRequired(accountId, 'No stored credentials for this account.')
    throw new IntegrationError(
      'refresh_failed',
      'This account has no stored credentials. Please reconnect it.',
      401,
    )
  }

  // ── Fast path: the stored token is still good ───────────────────────────────
  // A NULL expires_at means the provider did not tell us when it expires. We
  // deliberately treat that as "refresh now" rather than "valid forever": being
  // wrong in that direction costs one network call, the other costs a 401 in
  // the middle of a user action.
  if (!opts.forceRefresh && cred.expires_at) {
    const msLeft = new Date(cred.expires_at).getTime() - Date.now()
    if (msLeft > EXPIRY_SKEW_MS) {
      return {
        accountId,
        provider: account.provider,
        accessToken: cred.access_token,
        tokenType: cred.token_type || 'Bearer',
        apiDomain: account.api_domain,
        refreshed: false,
        expiresAt: cred.expires_at,
      }
    }
  }

  return refreshAndStore(account, cred)
}

async function refreshAndStore(
  account: AccountRow,
  cred: CredentialRow,
): Promise<ValidToken> {
  const admin = adminClient()

  if (!cred.refresh_token) {
    // Connect-time should have rejected this — every adapter throws
    // `no_refresh_token` when the provider issues none — but an older row or a
    // provider change could leave one here. Nothing can revive it.
    await markReauthRequired(account.id, 'No refresh token stored for this account.')
    throw new IntegrationError(
      'refresh_failed',
      'This connection cannot be renewed automatically. Please reconnect the account.',
      401,
    )
  }

  const adapter = getAdapter(account.provider)
  let tokens: TokenSet

  try {
    tokens = await adapter.refresh(cred.refresh_token, account.api_domain)
  } catch (err) {
    return handleRefreshFailure(account, cred, err)
  }

  if (!tokens?.accessToken) {
    throw new IntegrationError(
      'refresh_failed',
      `${adapter.label} returned no access token.`,
      502,
    )
  }

  // ── Persist ─────────────────────────────────────────────────────────────────
  // refresh_token is written ONLY when the provider issued a new one. Microsoft
  // rotates on every refresh; Google and Zoho return undefined and the original
  // stays valid. Writing `null` for those would destroy a working connection —
  // hence the conditional rather than a blanket assignment.
  const patch: Record<string, unknown> = {
    access_token: tokens.accessToken,
    token_type: tokens.tokenType || 'Bearer',
    expires_at: tokens.expiresAt,
    updated_at: new Date().toISOString(),
  }
  if (tokens.refreshToken) patch.refresh_token = tokens.refreshToken

  const { error: writeErr } = await admin
    .from('integration_credentials')
    .update(patch)
    .eq('account_id', account.id)

  if (writeErr) {
    // The refresh succeeded but we could not store it. Returning the token is
    // still correct — the caller's request should proceed — but log loudly,
    // because every subsequent call will refresh again.
    console.error('[tokens] refreshed but could not persist:', writeErr.message)
  }

  // Zoho can report a different DC than the one we had recorded. Persist it, or
  // every later refresh, revoke and API call goes to the wrong data centre.
  const nextApiDomain = tokens.apiDomain ?? account.api_domain
  const accountPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (nextApiDomain !== account.api_domain) accountPatch.api_domain = nextApiDomain

  // A successful refresh means the connection is healthy again. Clear any stale
  // failure state so the UI stops telling the user to reconnect.
  if (account.status !== 'connected') {
    accountPatch.status = 'connected'
    accountPatch.last_error = null
    accountPatch.last_error_at = null
  }

  if (Object.keys(accountPatch).length > 1) {
    const { error } = await admin
      .from('integration_accounts')
      .update(accountPatch)
      .eq('id', account.id)
    if (error) console.error('[tokens] could not update account after refresh:', error.message)
  }

  return {
    accountId: account.id,
    provider: account.provider,
    accessToken: tokens.accessToken,
    tokenType: tokens.tokenType || 'Bearer',
    apiDomain: nextApiDomain,
    refreshed: true,
    expiresAt: tokens.expiresAt,
  }
}

/**
 * Decide whether a failed refresh means "the user must reconnect" or "try again
 * later", and act accordingly.
 *
 * Getting this wrong in either direction is costly: marking a live account dead
 * sends the user through an unnecessary OAuth dance, while treating a genuinely
 * revoked token as transient means silent, permanent failure with no prompt.
 */
async function handleRefreshFailure(
  account: AccountRow,
  cred: CredentialRow,
  err: unknown,
): Promise<ValidToken> {
  // Read providerError structurally rather than via `instanceof IntegrationError`.
  // Class identity depends on both sides resolving the same module instance; if
  // that ever fails, instanceof returns false, providerCode comes back empty,
  // and a genuinely revoked token would be misclassified as transient — the
  // account would fail forever while the UI kept insisting it was connected.
  // Duck-typing the field cannot fail that way.
  const providerCode = (err as { providerError?: string })?.providerError ?? ''
  const message = err instanceof Error ? err.message : String(err)

  const isPermanent = PERMANENT_REFRESH_FAILURES.has(providerCode)

  if (isPermanent) {
    // ── Lost-race recovery ────────────────────────────────────────────────────
    // Before declaring the account dead, check whether another isolate already
    // rotated the refresh token while this call was in flight. If the stored
    // token differs from the one we just used, ours was simply superseded — the
    // account is fine. This is the residual case the in-isolate coalescing map
    // cannot cover, and it matters most for Microsoft, which rotates on every
    // refresh.
    const admin = adminClient()
    const { data: fresh } = await admin
      .from('integration_credentials')
      .select('access_token, refresh_token, token_type, expires_at')
      .eq('account_id', account.id)
      .maybeSingle<CredentialRow>()

    if (fresh && fresh.refresh_token && fresh.refresh_token !== cred.refresh_token) {
      console.warn(
        `[tokens] refresh raced for account ${account.id}; using the token stored by the winner.`,
      )
      const msLeft = fresh.expires_at
        ? new Date(fresh.expires_at).getTime() - Date.now()
        : 0
      if (msLeft > EXPIRY_SKEW_MS) {
        return {
          accountId: account.id,
          provider: account.provider,
          accessToken: fresh.access_token,
          tokenType: fresh.token_type || 'Bearer',
          apiDomain: account.api_domain,
          refreshed: false,
          expiresAt: fresh.expires_at,
        }
      }
      // The winner's token is itself already stale — retry once with it.
      return refreshAndStore(account, fresh)
    }

    await markReauthRequired(
      account.id,
      `Authorisation was revoked or expired (${providerCode || 'invalid_grant'}).`,
    )
    throw new IntegrationError(
      'refresh_failed',
      'This connection is no longer authorised. Please reconnect the account.',
      401,
      providerCode,
    )
  }

  // Transient: network blip, 5xx, rate limit. Do NOT touch account status —
  // the connection is presumed healthy and the caller may retry.
  console.error(
    `[tokens] transient refresh failure for account ${account.id} (${account.provider}):`,
    providerCode || message,
  )
  throw new IntegrationError(
    'refresh_failed',
    'Could not renew access with the provider. Please try again shortly.',
    502,
    providerCode || undefined,
  )
}

/**
 * Flag an account as needing user reconnection.
 *
 * NOTE the value: `reauth_required`, not `needs_reconnect`. The CHECK
 * constraint on integration_accounts.status permits exactly
 * ('connected','reauth_required','revoked','error'), ConnectionStatus in
 * types.ts declares the same set, and the UI's STATUS_STYLE map already renders
 * `reauth_required` as "Reconnect needed". Writing an out-of-set value would
 * raise a constraint violation *inside the error path*, so the one thing this
 * function exists to record would be the thing that fails to record.
 */
export async function markReauthRequired(accountId: string, reason: string): Promise<void> {
  try {
    const admin = adminClient()
    const { error } = await admin
      .from('integration_accounts')
      .update({
        status: 'reauth_required',
        last_error: reason.slice(0, 500),
        last_error_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId)
    if (error) console.error('[tokens] could not mark reauth_required:', error.message)
  } catch (err) {
    // Never let bookkeeping mask the original failure the caller is about to see.
    console.error('[tokens] markReauthRequired threw:', err)
  }
}

/**
 * The Authorization header value for this token.
 *
 * Zoho uses its own scheme — `Zoho-oauthtoken <token>` — and rejects `Bearer`
 * outright. Centralising it here means no caller has to remember, and a future
 * provider with its own scheme changes one line rather than every call site.
 */
export function authHeader(token: ValidToken): string {
  if (token.provider === 'zoho') return `Zoho-oauthtoken ${token.accessToken}`
  return `${token.tokenType || 'Bearer'} ${token.accessToken}`
}

/**
 * Assert that `userId` owns `accountId`, and return the account.
 *
 * getValidAccessToken deliberately does NOT check ownership — it is a low-level
 * helper and some callers (a future cron job) legitimately act without a user.
 * Any function serving a browser request must call this first, because the
 * admin client bypasses RLS and would otherwise happily hand one user a token
 * belonging to another.
 */
export async function requireAccountOwner(
  accountId: string,
  userId: string,
): Promise<AccountRow> {
  const admin = adminClient()
  const { data, error } = await admin
    .from('integration_accounts')
    .select('id, user_id, provider, api_domain, status, capabilities')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle<AccountRow>()

  if (error) throw error
  if (!data) {
    // Same response whether it does not exist or belongs to someone else —
    // do not confirm the existence of another user's integration.
    throw new IntegrationError('bad_request', 'Integration account not found.', 404)
  }
  return data
}

/**
 * Find the caller's account for a capability and return a live token for it.
 * The convenience wrapper Phase 1's send-email function will use.
 *
 * Picks the most recently connected healthy account when several qualify.
 * Accounts already known to need reconnection are excluded, so a stale
 * connection does not shadow a working one.
 */
export async function getTokenForCapability(
  userId: string,
  capability: 'email' | 'calendar',
): Promise<ValidToken> {
  const admin = adminClient()
  const { data, error } = await admin
    .from('integration_accounts')
    .select('id, connected_at, status')
    .eq('user_id', userId)
    .eq('status', 'connected')
    .contains('capabilities', [capability])
    .order('connected_at', { ascending: false })
    .limit(1)

  if (error) throw error

  const account = data?.[0]
  if (!account) {
    throw new IntegrationError(
      'bad_request',
      `No connected account with ${capability} access. Connect one in Settings → Integrations.`,
      409,
    )
  }
  return getValidAccessToken(account.id)
}
