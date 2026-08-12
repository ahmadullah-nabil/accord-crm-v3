// ─── Dashboard React Query Hooks ──────────────────────────────────────────────
//
// Provides the main dashboard with real Supabase-backed data.
// Uses the same analyticsService.js functions as the /analytics page so
// there is one query cache entry per data type (shared between dashboard
// and analytics — React Query deduplicates identical queryKeys).
//
// staleTime: 60 s — fresh enough for a live ops dashboard without
// hammering Supabase on every render or navigation.
//
// All queries are scoped by the logged-in user's JWT → RLS applies
// automatically (employees see own data, managers see subordinates).
//
// Every hook takes an optional { enabled } and ANDs it with the auth check.
// It defaults to true, so an existing call site keeps its behaviour; callers
// that render behind a tab pass `enabled: tab === '…'`. Gating the render
// alone does not stop the fetch — the hook runs wherever it is called, so six
// analytics queries fired on every Dashboard visit to fill a tab nobody had
// opened. The gate has to be on the query, not the JSX.

import { useQuery }     from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore.js'
import {
  getKpiSummary,
  getRevenueTimeSeries,
  getLeadFunnel,
  getTeamPerformance,
  getRecentActivity,
  getLeadStats,
} from '../services/analyticsService.js'

const STALE = 1000 * 60   // 1 minute — dashboard should feel live
const RANGE = '30d'        // dashboard always shows last 30 days

export const dashboardKeys = {
  kpi:        () => ['dashboard', 'kpi'],
  revenue:    () => ['dashboard', 'revenue'],
  pipeline:   () => ['dashboard', 'pipeline'],
  performers: () => ['dashboard', 'performers'],
  activity:   () => ['dashboard', 'activity'],
  leads:      () => ['dashboard', 'leads'],
}

function useEnabled() {
  return useAuthStore((s) => s.isAuthenticated)
}

// ── KPI cards ─────────────────────────────────────────────────────────────────
export function useDashboardKpi({ enabled = true } = {}) {
  const authed = useEnabled()
  return useQuery({
    queryKey: dashboardKeys.kpi(),
    queryFn:  () => getKpiSummary(RANGE),
    staleTime: STALE,
    enabled: authed && enabled,
    placeholderData: null,
  })
}

// ── Revenue chart ─────────────────────────────────────────────────────────────
export function useDashboardRevenue({ enabled = true } = {}) {
  const authed = useEnabled()
  return useQuery({
    queryKey: dashboardKeys.revenue(),
    queryFn:  () => getRevenueTimeSeries('1y'),   // dashboard shows full year
    staleTime: STALE,
    enabled: authed && enabled,
    placeholderData: [],
  })
}

// ── Pipeline funnel ───────────────────────────────────────────────────────────
export function useDashboardPipeline({ enabled = true } = {}) {
  const authed = useEnabled()
  return useQuery({
    queryKey: dashboardKeys.pipeline(),
    queryFn:  () => getLeadFunnel(RANGE),
    staleTime: STALE,
    enabled: authed && enabled,
    placeholderData: [],
  })
}

// ── Top performers ────────────────────────────────────────────────────────────
export function useDashboardPerformers({ enabled = true } = {}) {
  const authed = useEnabled()
  return useQuery({
    queryKey: dashboardKeys.performers(),
    queryFn:  () => getTeamPerformance(RANGE),
    staleTime: STALE,
    enabled: authed && enabled,
    placeholderData: [],
  })
}

// ── Recent activity ───────────────────────────────────────────────────────────
export function useDashboardActivity({ enabled = true } = {}) {
  const authed = useEnabled()
  return useQuery({
    queryKey: dashboardKeys.activity(),
    queryFn:  () => getRecentActivity(RANGE),
    staleTime: STALE,
    enabled: authed && enabled,
    placeholderData: [],
  })
}

// ── Leads chart ───────────────────────────────────────────────────────────────
export function useDashboardLeads({ enabled = true } = {}) {
  const authed = useEnabled()
  return useQuery({
    queryKey: dashboardKeys.leads(),
    queryFn:  () => getLeadStats(RANGE),
    staleTime: STALE,
    enabled: authed && enabled,
    placeholderData: [],
  })
}
