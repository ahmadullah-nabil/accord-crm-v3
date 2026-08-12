// ─── Email Hooks ──────────────────────────────────────────────────────────────
//
// React Query wrappers for send-email and the composer's supporting reads.
// Follows the pattern in useIntegrations.js: keys namespaced by user id, every
// query gated on an authenticated session, so signing out and back in as
// someone else can never serve the previous user's mail from the cache.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore.js'
import { useIntegrations } from './useIntegrations.js'
import {
  sendEmail,
  getSentEmailsForEntity,
  getThreadAnchor,
  getEmailSettings,
  saveEmailSettings,
} from '../services/emailService.js'

export const emailKeys = {
  all:      ()                => ['email'],
  sent:     (type, id)        => ['email', 'sent', type, id],
  thread:   (type, id)        => ['email', 'thread', type, id],
  settings: (userId)          => ['email', 'settings', userId ?? 'anon'],
}

// ── Can this user send at all? ────────────────────────────────────────────────

/**
 * Whether the signed-in user has a connected account that can send mail.
 *
 * Derived from the integrations list the Settings page already loads, rather
 * than a new endpoint: the composer needs to know BEFORE the user writes a
 * message, so it can prompt them to connect instead of letting them type for
 * five minutes and then fail at Send.
 *
 * `reauth_required` accounts are deliberately excluded. They exist, but they
 * cannot send, and treating them as usable produces exactly the "wrote it,
 * lost it" experience this check is meant to prevent.
 */
export function useEmailAccount() {
  const { data, isLoading, isError } = useIntegrations()

  const account = (data?.accounts ?? []).find(
    (a) => a.status === 'connected' && (a.capabilities ?? []).includes('email'),
  ) ?? null

  const needsReconnect = !account && (data?.accounts ?? []).some(
    (a) => (a.capabilities ?? []).includes('email') && a.status === 'reauth_required',
  )

  return { account, canSend: Boolean(account), needsReconnect, isLoading, isError }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export function useSentEmails(relatedType, relatedId) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey: emailKeys.sent(relatedType, relatedId),
    queryFn:  () => getSentEmailsForEntity(relatedType, relatedId),
    enabled:  isAuthenticated && Boolean(relatedType) && Boolean(relatedId),
    staleTime: 1000 * 60,
    placeholderData: [],
  })
}

/**
 * The message a new send should chain onto, if any.
 *
 * Fetched when the composer opens rather than at send time so the subject can
 * be pre-filled with "Re: …" and the user can see they are continuing a
 * conversation rather than starting one.
 */
export function useThreadAnchor(relatedType, relatedId, enabled = true) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey: emailKeys.thread(relatedType, relatedId),
    queryFn:  () => getThreadAnchor(relatedType, relatedId),
    enabled:  enabled && isAuthenticated && Boolean(relatedType) && Boolean(relatedId),
    staleTime: 1000 * 30,
  })
}

export function useEmailSettings() {
  const userId          = useAuthStore((s) => s.user?.id ?? null)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey: emailKeys.settings(userId),
    queryFn:  getEmailSettings,
    enabled:  isAuthenticated && Boolean(userId),
    staleTime: 1000 * 60 * 5,
    retry: false,
  })
}

export function useSaveEmailSettings() {
  const qc     = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id ?? null)

  return useMutation({
    mutationFn: saveEmailSettings,
    onSuccess: (settings) => {
      qc.setQueryData(emailKeys.settings(userId), settings)
    },
  })
}

// ── Send ──────────────────────────────────────────────────────────────────────

/**
 * Send a message and refresh everything it changed.
 *
 * Three caches move on success:
 *   • the record's timeline, because send-email wrote an activity row
 *   • the sent list for that record
 *   • the thread anchor, so the NEXT message chains onto this one
 *
 * Timeline keys are ['timeline', entityType, entityId, linkedId] and the
 * composer does not know linkedId, so this invalidates on the three-element
 * prefix — React Query matches keys by prefix, which covers both the plain and
 * the converted-lead variants.
 */
export function useSendEmail(relatedType, relatedId) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: sendEmail,
    onSuccess: () => {
      if (relatedType && relatedId) {
        qc.invalidateQueries({ queryKey: ['timeline', relatedType, relatedId] })
        qc.invalidateQueries({ queryKey: emailKeys.sent(relatedType, relatedId) })
        qc.invalidateQueries({ queryKey: emailKeys.thread(relatedType, relatedId) })
      }
    },
    onError: (err) => console.error('[useEmail] send failed:', err?.code, err?.message),
  })
}
