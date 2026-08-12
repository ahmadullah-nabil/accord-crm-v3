// ─── Contacts React Query Hooks ───────────────────────────────────────────────
//
// All data operations for the Contacts module go through these hooks.
// They call contactsService.js (Supabase) — the UI is unchanged.
//
// Auth guard
// ──────────
// Every hook checks isAuthenticated before enabling its query.
// This ensures no request is made before the Supabase session is restored,
// which would cause RLS to reject it with a 403.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore.js'
import {
  getContacts,
  getContactById,
  insertContact,
  patchContact,
  removeContact,
} from '../services/contactsService.js'

// ── Stable query keys ─────────────────────────────────────────────────────────
export const contactKeys = {
  all:    () => ['contacts'],
  detail: (id) => ['contacts', id],
}

// ── useContacts — fetch list ───────────────────────────────────────────────────
export function useContacts() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey: contactKeys.all(),
    queryFn:  getContacts,
    staleTime: 1000 * 60 * 2,   // 2 minutes
    enabled:   isAuthenticated,  // don't query until JWT is ready
  })
}

// ── useContact — fetch one ────────────────────────────────────────────────────
export function useContact(id) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey: contactKeys.detail(id),
    queryFn:  () => getContactById(id),
    enabled:  isAuthenticated && Boolean(id),
    staleTime: 1000 * 60 * 2,
  })
}

// ── useCreateContact ──────────────────────────────────────────────────────────
export function useCreateContact() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: insertContact,
    onSuccess: (newContact) => {
      // Prepend to the list cache immediately — no extra round-trip
      qc.setQueryData(contactKeys.all(), (old = []) => [newContact, ...old])
    },
    onError: () => {
      // Ensure cache is accurate if insert failed
      qc.invalidateQueries({ queryKey: contactKeys.all() })
    },
  })
}

// ── useUpdateContact ──────────────────────────────────────────────────────────
export function useUpdateContact() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }) => patchContact(id, data),
    onSuccess: (updated) => {
      // Patch list cache in place
      qc.setQueryData(contactKeys.all(), (old = []) =>
        old.map((c) => (c.id === updated.id ? updated : c))
      )
      // Also update the detail cache so the drawer refreshes without a fetch
      qc.setQueryData(contactKeys.detail(updated.id), updated)
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: contactKeys.all() })
    },
  })
}

// ── useDeleteContact ──────────────────────────────────────────────────────────
export function useDeleteContact() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: removeContact,

    // Optimistic: remove from list immediately so the UI feels instant
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: contactKeys.all() })
      const previous = qc.getQueryData(contactKeys.all())
      qc.setQueryData(contactKeys.all(), (old = []) =>
        old.filter((c) => c.id !== id)
      )
      return { previous }   // snapshot for rollback
    },

    // Roll back on Supabase error
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(contactKeys.all(), context.previous)
      }
    },

    // Always clean up detail cache and re-sync list
    onSettled: (_data, _err, id) => {
      qc.removeQueries({ queryKey: contactKeys.detail(id) })
      qc.invalidateQueries({ queryKey: contactKeys.all() })
    },
  })
}
