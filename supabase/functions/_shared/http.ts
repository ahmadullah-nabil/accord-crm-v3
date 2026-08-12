// ─── Edge Function HTTP helpers ───────────────────────────────────────────────

import { IntegrationError } from './types.ts'

// ─── Allowed origins ──────────────────────────────────────────────────────────
//
// ONE allow-list governs both CORS and the post-OAuth return redirect, so the
// two can never drift apart.
//
//   APP_URL          the primary origin. Also the fallback whenever the caller's
//                    origin is missing or not permitted.
//   APP_URL_ALLOWED  optional, comma-separated additional origins.
//
// Example — production primary, local dev permitted:
//   APP_URL=https://crm.example.com
//   APP_URL_ALLOWED=http://localhost:5173,https://staging.example.com
//
// This exists because APP_URL used to be the ONLY origin: a single Supabase
// project could serve either localhost or production, never both, and the
// OAuth return trip always landed on whichever one the secret named.
//
// Security: origins are matched EXACTLY against this server-side list. A caller
// cannot introduce a new one by sending a different Origin header — an
// unrecognised origin falls back to APP_URL, so this can never become an open
// redirect. Origin comparison is scheme + host + port; paths are never part of it.

/** Primary origin. Every fallback path uses this. */
export function primaryOrigin(): string {
  return (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')
}

/** Full set of permitted origins, primary first. */
export function allowedOrigins(): string[] {
  const extra = (Deno.env.get('APP_URL_ALLOWED') ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean)
  return [primaryOrigin(), ...extra].filter(Boolean)
}

/** True only for an exact match against the configured list. */
export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false
  let normalised: string
  try {
    normalised = new URL(origin).origin   // rejects malformed values outright
  } catch {
    return false
  }
  return allowedOrigins().includes(normalised)
}

/**
 * Resolve the origin a request may be answered on / returned to.
 * Falls back to APP_URL when the caller's origin is absent or not permitted.
 */
export function resolveOrigin(origin: string | null | undefined): string {
  return isAllowedOrigin(origin) ? new URL(origin!).origin : primaryOrigin()
}

/**
 * Headers we always permit, whether or not the browser asks for them.
 *
 * `x-app-name` is on this list because src/lib/supabaseClient.js sets
 * X-App-Name on EVERY Supabase request. Same-origin calls never notice, but an
 * Edge Function is cross-origin, so the browser preflights it — and a hardcoded
 * allow-list that omitted it caused every invoke to fail with:
 *   "Request header field x-app-name is not allowed by
 *    Access-Control-Allow-Headers in preflight response"
 */
const BASE_ALLOWED_HEADERS = [
  'authorization',
  'x-client-info',
  'apikey',
  'content-type',
  'x-app-name',      // set by this project's Supabase client
  'x-region',        // supabase-js sends this when a function region is pinned
  'x-supabase-api-version',
]

/**
 * CORS headers for a caller, reflecting their origin only if it is allowed.
 *
 * Allow-Headers ECHOES whatever the browser asked for in
 * Access-Control-Request-Headers, merged with the base list. A fixed list is
 * brittle: any custom header added to the Supabase client later — or any header
 * a future supabase-js version introduces — would silently break every call
 * with a CORS error that looks like a deployment problem.
 *
 * Echoing is safe. Access-Control-Allow-Headers only tells the browser which
 * request headers it may SEND; it grants no authority. Authentication is still
 * decided by requireUser() validating the caller's token server-side, and the
 * ORIGIN remains strictly allow-listed above — that is the control that matters.
 */
export function corsHeaders(origin: string | null, req?: Request): Record<string, string> {
  const requested = (req?.headers.get('Access-Control-Request-Headers') ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)

  const allowHeaders = Array.from(new Set([...BASE_ALLOWED_HEADERS, ...requested])).join(', ')

  return {
    'Access-Control-Allow-Origin': resolveOrigin(origin),
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',   // cache the preflight for a day
    'Vary': 'Origin, Access-Control-Request-Headers',
  }
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  })
}

export function errorResponse(err: unknown, extra: Record<string, string> = {}) {
  if (err instanceof IntegrationError) {
    console.error(`[integration] ${err.code}: ${err.message}`)
    return json({ error: { code: err.code, message: err.message } }, err.status, extra)
  }
  // Never leak an internal message to the client — log it, return a generic code.
  console.error('[integration] unexpected error:', err)
  return json(
    { error: { code: 'provider_error', message: 'Something went wrong. Please try again.' } },
    500,
    extra,
  )
}

/** POST a form-encoded body to a token endpoint and parse the JSON reply. */
export async function postForm(url: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(params).toString(),
  })

  const text = await res.text()
  let body: any
  try { body = JSON.parse(text) } catch { body = { raw: text } }

  if (!res.ok || body.error) {
    const detail = body.error_description ?? body.error ?? text.slice(0, 300)
    throw new IntegrationError('exchange_failed', `Token endpoint rejected the request: ${detail}`, 400)
  }
  return body
}

export async function getJson(url: string, accessToken: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new IntegrationError(
      'identity_failed',
      `Provider identity call failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
      502,
    )
  }
  return res.json()
}

/** Seconds-from-now → absolute ISO timestamp, so expiry survives storage. */
export function expiresAtFrom(expiresIn: unknown): string | null {
  const secs = Number(expiresIn)
  if (!Number.isFinite(secs) || secs <= 0) return null
  return new Date(Date.now() + secs * 1000).toISOString()
}
