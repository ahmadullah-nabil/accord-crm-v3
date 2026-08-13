// ─── Shared QueryClient ───────────────────────────────────────────────────────
//
// The client was constructed inline in main.jsx, where nothing outside the
// React tree could reach it. That is fine while every mutation lives in a hook
// — `useQueryClient()` covers those — and a problem the moment a Zustand store
// mutates server data, because a store is not a component and cannot call a
// hook.
//
// leadsStore is exactly that case. It owns its own `leads` array and writes to
// Supabase directly, while the Dashboard's Lead Overview reads the same data
// through React Query under ['leads', 'stage-facets']. Nothing connected the
// two, so a lead added on the Leads page did not appear in the Overview counts
// until staleTime expired.
//
// Exporting the instance is the smallest fix that works from both sides.
// main.jsx passes this to QueryClientProvider, so there is still exactly ONE
// client — a second instance would give the store a cache the UI never reads,
// which fails silently and looks identical to the bug it was meant to fix.

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

export default queryClient
