// ─── Global Search Hook ───────────────────────────────────────────────────────
//
// Debounced, cached universal search for the Navbar. Uses the project's existing
// React Query setup — no new state library, no new fetching layer.
//
// PERFORMANCE
// ───────────
//   • 250 ms debounce — typing "meeting" fires ONE search round, not seven
//   • MIN_QUERY_LENGTH (2) gate — a single character never reaches Supabase
//   • 5 rows per entity
//   • React Query caches by term, so retyping a recent term is instant
//
// STALE-RESULT PROTECTION
// ───────────────────────
// The query key includes the debounced term, so a slow response for "ac" can
// never overwrite the rendered results for "accord" — React Query keys them
// separately and only renders the active key's data. AbortSignal is forwarded
// to Supabase as well, so superseded requests are cancelled in flight.

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore.js'
import { searchAll, MIN_QUERY_LENGTH, sanitizeQuery } from '../services/searchService.js'

export const searchKeys = {
  all:   ()      => ['global-search'],
  query: (term)  => ['global-search', term],
}

const DEBOUNCE_MS = 250

/** Delay a rapidly-changing value so downstream effects run once it settles. */
export function useDebouncedValue(value, delay = DEBOUNCE_MS) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  return debounced
}

/**
 * @param {string} rawTerm  Live input value.
 * @returns {{
 *   term: string, isTooShort: boolean, isSearching: boolean,
 *   groups: Array, total: number, errors: Array, isError: boolean,
 * }}
 */
export function useGlobalSearch(rawTerm) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const debouncedRaw    = useDebouncedValue(rawTerm)
  const term            = sanitizeQuery(debouncedRaw)

  const isTooShort = term.length < MIN_QUERY_LENGTH
  const enabled    = isAuthenticated && !isTooShort

  const query = useQuery({
    queryKey:  searchKeys.query(term),
    queryFn:   ({ signal }) => searchAll(term, { signal }),
    enabled,
    staleTime: 1000 * 30,
    retry:     false,          // a failed search should surface, not hang retrying
    placeholderData: undefined, // never show a previous term's hits as current
  })

  // Typing again after the debounce has fired but before results land should
  // still read as "searching", so the spinner does not flicker off and on.
  const pendingDebounce = enabled && sanitizeQuery(rawTerm) !== term

  return {
    term,
    isTooShort,
    isSearching: enabled && (query.isFetching || pendingDebounce),
    groups:      query.data?.groups ?? [],
    total:       query.data?.total  ?? 0,
    errors:      query.data?.errors ?? [],
    isError:     query.isError,
  }
}
