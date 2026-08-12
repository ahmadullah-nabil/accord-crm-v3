// ─── Integrations Hooks ───────────────────────────────────────────────────────
//
// React Query wrappers for the integration Edge Functions, following the same
// pattern as every other domain in this codebase.
//
// User isolation: the query key is namespaced by user id and every query is
// gated on an authenticated session, so a logout → login as someone else can
// never serve the previous user's integrations from the cache. The server also
// scopes every query to the caller, and RLS scopes it again in Postgres.

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore.js'
import {
  listIntegrations,
  startConnection,
  disconnectIntegration,
} from '../services/integrationsService.js'

export const integrationKeys = {
  all:  ()       => ['integrations'],
  list: (userId) => ['integrations', 'list', userId ?? 'anon'],
}

export function useIntegrations() {
  const userId          = useAuthStore((s) => s.user?.id ?? null)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey:  integrationKeys.list(userId),
    queryFn:   listIntegrations,
    enabled:   isAuthenticated && Boolean(userId),
    staleTime: 1000 * 60,
    retry:     false,
  })
}

/**
 * Start an OAuth connection.
 *
 * On success the browser is navigated to the provider. This is a full-page
 * navigation rather than a popup: the callback lands on an Edge Function, and
 * a redirect chain is more reliable across mobile browsers and popup blockers.
 */
export function useConnectIntegration() {
  return useMutation({
    mutationFn: ({ provider, capability }) => startConnection(provider, capability),
    onSuccess: (authUrl) => {
      window.location.assign(authUrl)
    },
    onError: (err) => console.error('[useIntegrations] connect failed:', err?.code, err?.message),
  })
}

export function useDisconnectIntegration() {
  const qc     = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id ?? null)

  return useMutation({
    mutationFn: (accountId) => disconnectIntegration(accountId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: integrationKeys.list(userId) })
    },
    onError: (err) => console.error('[useIntegrations] disconnect failed:', err?.code, err?.message),
  })
}

/**
 * Read the ?integration=… result the oauth-callback function redirects back
 * with, then strip it from the URL so a refresh does not replay the banner.
 *
 * Returns { status, reason, provider, capability } or null.
 */
export function useOAuthCallbackResult() {
  const qc     = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const params = new URLSearchParams(window.location.search)
  const status = params.get('integration')

  const result = status
    ? {
        status,
        reason:     params.get('reason'),
        provider:   params.get('provider'),
        capability: params.get('capability'),
      }
    : null

  useEffect(() => {
    if (!status) return
    // A fresh connection changes server state — refetch before clearing.
    qc.invalidateQueries({ queryKey: integrationKeys.list(userId) })

    const url = new URL(window.location.href)
    for (const k of ['integration', 'reason', 'provider', 'capability', 'section']) {
      url.searchParams.delete(k)
    }
    window.history.replaceState({}, '', url.pathname + url.search)
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  return result
}
