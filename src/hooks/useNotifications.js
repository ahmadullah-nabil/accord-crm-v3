// ─── Notification React Query Hooks ──────────────────────────────────────────
//
// All hooks read from notificationsService.js (real Supabase).
// RLS scopes every query to the authenticated user — no client-side filtering.
//
// staleTime: 30 s — notifications should feel live without hammering Supabase.
// The Realtime subscription in AppLayout handles instant badge updates.

import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore.js'
import {
  getNotifications,
  getUnreadCount,
  getNotificationById,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  toggleNotificationPin,
  deleteNotification,
  deleteAllReadNotifications,
  subscribeToNotifications,
} from '../services/notificationsService.js'

// ── Query keys ────────────────────────────────────────────────────────────────
export const notifKeys = {
  all:        () => ['notifications'],
  unreadCount:() => ['notifications', 'unread_count'],
  detail:     (id) => ['notifications', id],
}

const STALE = 1000 * 30   // 30 seconds

// ── Read hooks ────────────────────────────────────────────────────────────────

/** Full notification list for the current user. */
export function useNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey:        notifKeys.all(),
    queryFn:         getNotifications,
    staleTime:       STALE,
    enabled:         isAuthenticated,
    placeholderData: [],
  })
}

/**
 * Lightweight unread badge count — uses a COUNT query, not a full fetch.
 * Used by Navbar to avoid fetching all notifications just for the red dot.
 */
export function useUnreadCount() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey:        notifKeys.unreadCount(),
    queryFn:         getUnreadCount,
    staleTime:       STALE,
    enabled:         isAuthenticated,
    placeholderData: 0,
  })
}

/** Single notification detail. */
export function useNotification(id) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey: notifKeys.detail(id),
    queryFn:  () => getNotificationById(id),
    enabled:  isAuthenticated && Boolean(id),
    staleTime: STALE,
  })
}

// ── Mutation hooks ────────────────────────────────────────────────────────────

/** Mark one notification read — optimistic update. */
export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: notifKeys.all() })
      const prev = qc.getQueryData(notifKeys.all())
      qc.setQueryData(notifKeys.all(), (old = []) =>
        old.map((n) => n.id === id ? { ...n, isRead: true } : n)
      )
      return { prev }
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(notifKeys.all(), ctx.prev) },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notifKeys.all() })
      qc.invalidateQueries({ queryKey: notifKeys.unreadCount() })
    },
  })
}

/** Mark one notification unread — optimistic update. */
export function useMarkUnread() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markNotificationUnread,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: notifKeys.all() })
      const prev = qc.getQueryData(notifKeys.all())
      qc.setQueryData(notifKeys.all(), (old = []) =>
        old.map((n) => n.id === id ? { ...n, isRead: false } : n)
      )
      return { prev }
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(notifKeys.all(), ctx.prev) },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notifKeys.all() })
      qc.invalidateQueries({ queryKey: notifKeys.unreadCount() })
    },
  })
}

/** Mark all as read. */
export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: notifKeys.all() })
      const prev = qc.getQueryData(notifKeys.all())
      qc.setQueryData(notifKeys.all(), (old = []) =>
        old.map((n) => ({ ...n, isRead: true }))
      )
      qc.setQueryData(notifKeys.unreadCount(), 0)
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(notifKeys.all(), ctx.prev) },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notifKeys.all() })
      qc.invalidateQueries({ queryKey: notifKeys.unreadCount() })
    },
  })
}

/** Toggle pinned state. */
export function useTogglePin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: toggleNotificationPin,
    onSuccess: (updated) => {
      qc.setQueryData(notifKeys.all(), (old = []) =>
        old.map((n) => n.id === updated.id ? updated : n)
      )
    },
    onSettled: () => qc.invalidateQueries({ queryKey: notifKeys.all() }),
  })
}

/** Delete one notification — optimistic. */
export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteNotification,
    // Callers invoke this as mutate(id) with a plain string, so onMutate receives
    // that string directly. It previously destructured `{ id }` from it, which
    // yielded undefined and made the optimistic removal silently do nothing —
    // the row only disappeared later, on invalidation.
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: notifKeys.all() })
      const prev = qc.getQueryData(notifKeys.all())
      qc.setQueryData(notifKeys.all(), (old = []) => old.filter((n) => n.id !== id))
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(notifKeys.all(), ctx.prev) },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notifKeys.all() })
      qc.invalidateQueries({ queryKey: notifKeys.unreadCount() })
    },
  })
}

/** Delete all read non-pinned notifications. */
export function useClearAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteAllReadNotifications,
    onMutate: async () => {
      const prev = qc.getQueryData(notifKeys.all())
      qc.setQueryData(notifKeys.all(), (old = []) =>
        old.filter((n) => !n.isRead || n.isPinned)
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(notifKeys.all(), ctx.prev) },
    onSettled: () => qc.invalidateQueries({ queryKey: notifKeys.all() }),
  })
}

// ── Realtime ──────────────────────────────────────────────────────────────────

/**
 * Live notification updates for the signed-in user.
 *
 * MOUNT THIS EXACTLY ONCE, in AppLayout. Mounting it in a page or a component
 * would open a second channel on the same topic.
 *
 * Responsibilities:
 *   • subscribe only once an authenticated user id exists
 *   • re-subscribe when the user changes (login → logout → login as someone else)
 *   • unsubscribe on unmount and on logout
 *   • drop the previous user's cached notifications so nothing leaks across
 *     an in-session account switch, where React Query would otherwise keep
 *     serving the old user's rows from memory until the next refetch
 *   • keep the list and the unread badge in sync via cache invalidation
 */
export function useNotificationsRealtime() {
  const qc              = useQueryClient()
  const userId          = useAuthStore((s) => s.user?.id ?? null)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const subRef          = useRef(null)

  useEffect(() => {
    // Signed out (or not yet resolved): make sure nothing is left subscribed and
    // no previous user's data survives in the cache. notifKeys.all() is the
    // prefix ['notifications'], so this also clears the unread count and any
    // cached detail queries.
    if (!isAuthenticated || !userId) {
      qc.removeQueries({ queryKey: notifKeys.all() })
      return undefined
    }

    // Fresh data for whoever just signed in.
    qc.invalidateQueries({ queryKey: notifKeys.all() })

    const refresh = () => {
      qc.invalidateQueries({ queryKey: notifKeys.all() })
      qc.invalidateQueries({ queryKey: notifKeys.unreadCount() })
    }

    subRef.current = subscribeToNotifications(userId, { onChange: refresh })

    return () => {
      subRef.current?.unsubscribe()
      subRef.current = null
    }
  }, [userId, isAuthenticated, qc])
}

// ── Aliases for component compatibility ───────────────────────────────────────
export const useMarkAsRead        = useMarkRead
export const useMarkAsUnread      = useMarkUnread
export const useMarkAllAsRead     = useMarkAllRead
export const useClearNotification = useDeleteNotification
export const useClearAll          = useClearAllRead
