// ─── Integrations Service ─────────────────────────────────────────────────────
//
// Thin client for the integration Edge Functions. Called only by
// hooks/useIntegrations.js — components never import this directly.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ WHAT THIS FILE CAN AND CANNOT SEE                                       │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ It never handles an access token, a refresh token, an OAuth client      │
// │ secret or a PKCE verifier. Those exist only inside Edge Functions and   │
// │ inside two Postgres tables that have RLS enabled with ZERO policies —   │
// │ meaning the anon/authenticated roles this browser uses cannot read a    │
// │ single row from them under any query.                                    │
// │                                                                          │
// │ The browser's entire view of an integration is: provider, account       │
// │ email, capabilities, status, timestamps.                                 │
// └─────────────────────────────────────────────────────────────────────────┘
//
// Auth: supabase.functions.invoke() attaches the current session JWT
// automatically, which is how each function identifies the caller.

import { supabase } from '../lib/supabaseClient.js'

/** Normalise an Edge Function error into something the UI can act on. */
/**
 * Normalise an Edge Function error into something the UI can act on.
 *
 * Distinguishes a genuine provider failure from "the Edge Functions were never
 * deployed", which are completely different problems with completely different
 * fixes. Previously both surfaced as `provider_error` — "Something went wrong
 * connecting to the provider" — which is actively misleading when no provider
 * was ever contacted and the request never left the Supabase project.
 */
function toError(error, data) {
  const payload = data?.error
  const message = payload?.message || error?.message || 'Integration request failed.'
  const err = new Error(message)

  if (payload?.code) {
    // The function ran and returned a structured error — trust its code.
    err.code = payload.code
  } else if (isNotDeployed(error)) {
    err.code = 'not_deployed'
  } else {
    err.code = 'provider_error'
  }
  return err
}

/**
 * True when the failure looks like the Edge Function is absent or unreachable
 * rather than the function itself reporting a problem.
 *
 * supabase-js surfaces this as a FunctionsFetchError / FunctionsHttpError with
 * a 404, or as a bare network failure. We match loosely on purpose: the exact
 * shape differs between supabase-js versions, and a false positive here only
 * changes which help text is shown, never any security behaviour.
 */
function isNotDeployed(error) {
  if (!error) return false
  const status = error.status ?? error.context?.status
  if (status === 404) return true

  const name = String(error.name ?? '')
  const msg  = String(error.message ?? '').toLowerCase()
  return (
    name.includes('FunctionsFetchError') ||
    name.includes('FunctionsRelayError') ||
    msg.includes('failed to fetch') ||
    msg.includes('failed to send a request') ||
    msg.includes('networkerror') ||
    msg.includes('not found')
  )
}

/**
 * The same normalisation, exported for other integration-backed services.
 *
 * emailService.js calls send-email and needs identical error handling — a
 * second private copy of toError() would drift the first time one of them
 * learned about a new failure code.
 */
export function normaliseIntegrationError(error, data) {
  return toError(error, data)
}

/**
 * List the signed-in user's connected accounts.
 * Returns metadata only — see the note above.
 */
export async function listIntegrations() {
  const { data, error } = await supabase.functions.invoke('integration-list', { method: 'POST' })
  if (error || data?.error) throw toError(error, data)
  return {
    accounts:  data?.accounts  ?? [],
    catalogue: data?.catalogue ?? [],
  }
}

/**
 * Begin a connection.
 *
 * Returns the provider's authorization URL; the caller navigates the browser
 * to it. The authorization code comes back to the oauth-callback Edge Function
 * rather than to this app, so no code or token ever enters React state, the
 * URL bar of the SPA, or browser history.
 *
 * @param {'google'|'microsoft'|'zoho'} provider
 * @param {'email'|'calendar'} capability
 */
export async function startConnection(provider, capability) {
  const { data, error } = await supabase.functions.invoke('oauth-start', {
    method: 'POST',
    body:   { provider, capability, redirectTo: '/settings' },
  })
  if (error || data?.error) throw toError(error, data)
  if (!data?.authUrl) throw new Error('No authorization URL was returned.')
  return data.authUrl
}

/**
 * Disconnect an account: revoke at the provider where supported, then delete.
 * `revokedAtProvider` is reported honestly — false means the user still has to
 * remove the app in their provider account settings, and the UI says so.
 */
export async function disconnectIntegration(accountId) {
  const { data, error } = await supabase.functions.invoke('integration-disconnect', {
    method: 'POST',
    body:   { accountId },
  })
  if (error || data?.error) throw toError(error, data)
  return {
    disconnected:      data?.disconnected ?? false,
    revokedAtProvider: data?.revokedAtProvider ?? false,
    note:              data?.note ?? null,
  }
}

// ── Presentation catalogue ────────────────────────────────────────────────────
//
// The server (integration-list → catalogue) remains the AUTHORITATIVE list, so
// registering a new adapter still surfaces it without a frontend release.
//
// LOCAL_CATALOGUE below is a render-time fallback only, used when the server is
// unreachable. Without it the Integrations page rendered an empty card whenever
// the Edge Functions were not deployed — the three providers are already known
// to this file, so there was never a reason to show nothing. The fallback lets
// the page render honestly (every capability "Not connected") instead of blank.
export const PROVIDER_META = {
  google: {
    label: 'Google',
    capabilityLabels: { email: 'Gmail', calendar: 'Google Calendar' },
    note: 'Send email on your behalf and manage calendar events.',
  },
  microsoft: {
    label: 'Microsoft',
    capabilityLabels: { email: 'Outlook Mail', calendar: 'Outlook Calendar' },
    note: 'Works with both work/school and personal Microsoft accounts.',
  },
  zoho: {
    label: 'Zoho',
    capabilityLabels: { email: 'Zoho Mail', calendar: 'Zoho Calendar' },
    note: 'Your Zoho data centre is detected automatically.',
  },
}

/**
 * Fallback provider list, used only when the server catalogue is unavailable.
 * Mirrors the adapters registered in supabase/functions/_shared/providers/index.ts.
 * If those two ever diverge, the SERVER wins — this is presentation only, and a
 * provider listed here that the server does not implement will simply fail on
 * Connect with a clear error rather than doing anything unsafe.
 */
export const LOCAL_CATALOGUE = [
  { id: 'google',    label: 'Google',    capabilities: ['email', 'calendar'] },
  { id: 'microsoft', label: 'Microsoft', capabilities: ['email', 'calendar'] },
  { id: 'zoho',      label: 'Zoho',      capabilities: ['email', 'calendar'] },
]

/** Human text for every failure code the Edge Functions can return. */
export const ERROR_MESSAGES = {
  access_denied:          'Connection cancelled — permission was not granted.',
  invalid_state:          'That connection link expired. Please try connecting again.',
  state_replayed:         'That connection link was already used. Please start again.',
  no_refresh_token:       'The provider did not issue a long-lived token. Remove Accord CRM from your provider account settings, then reconnect.',
  scope_denied:           'The required permission was not granted, so the account was not connected.',
  exchange_failed:        'The provider rejected the authorization. Please try again.',
  refresh_failed:         'Access expired. Please reconnect this account.',
  identity_failed:        'Connected, but the account details could not be read. Please reconnect.',
  admin_consent_required: 'Your Microsoft administrator must approve Accord CRM before this account can be connected.',
  unauthorized:           'Your session expired. Please sign in again.',
  bad_request:            'That request was not valid.',
  no_email_account:       'No mailbox is connected yet. Connect one in Settings to send email.',
  send_failed:            'The provider would not send that message. The details are below.',
  invalid_recipient:      'One of the email addresses is not valid. Check the recipients and try again.',
  provider_error:         'Something went wrong connecting to the provider. Please try again.',
  not_deployed:           'Integration service unavailable — the Accord CRM integration functions have not been deployed to this Supabase project yet. Connecting accounts will not work until they are.',
}
