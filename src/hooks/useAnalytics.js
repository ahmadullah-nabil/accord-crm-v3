import { useQuery } from '@tanstack/react-query'
import {
  fetchKpiSummary,
  fetchRevenueTimeSeries,
  fetchLeadFunnel,
  fetchLeadsBySource,
  fetchLeadStats,
  fetchTaskStats,
  fetchMeetingStats,
  fetchTeamPerformance,
  fetchRecentActivity,
} from '../lib/analyticsData.js'

// ── Query keys ────────────────────────────────────────────────────────────────
export const analyticsKeys = {
  kpi:      (range) => ['analytics', 'kpi',      range],
  revenue:  (range) => ['analytics', 'revenue',  range],
  funnel:   (range) => ['analytics', 'funnel',   range],
  sources:  (range) => ['analytics', 'sources',  range],
  leads:    (range) => ['analytics', 'leads',    range],
  tasks:    (range) => ['analytics', 'tasks',    range],
  meetings: (range) => ['analytics', 'meetings', range],
  team:     (range) => ['analytics', 'team',     range],
  activity: (range) => ['analytics', 'activity', range],
}

const STALE = 1000 * 60 * 3 // 3 minutes

// ── The `enabled` gate ────────────────────────────────────────────────────────
//
// step056. Every hook below now takes an optional { enabled }, defaulting to
// true so no existing call site changes behaviour.
//
// This is the same lesson useDashboard.js already carries, and the reason is
// worth repeating because it is not visible in the JSX: A HOOK FETCHES WHEREVER
// IT IS CALLED. Rendering it behind a condition stops the markup and nothing
// else. AnalyticsPage called all nine of these unconditionally and drew eleven
// charts in one column, so every visit fired nine queries to fill a page most
// of which was below the fold. The gate has to be on the QUERY, not the render.

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useAnalyticsKpi(range, { enabled = true } = {}) {
  return useQuery({
    queryKey: analyticsKeys.kpi(range),
    queryFn:  () => fetchKpiSummary(range),
    staleTime: STALE,
    enabled,
  })
}

export function useAnalyticsRevenue(range, { enabled = true } = {}) {
  return useQuery({
    queryKey: analyticsKeys.revenue(range),
    queryFn:  () => fetchRevenueTimeSeries(range),
    staleTime: STALE,
    enabled,
  })
}

export function useAnalyticsFunnel(range, { enabled = true } = {}) {
  return useQuery({
    queryKey: analyticsKeys.funnel(range),
    queryFn:  () => fetchLeadFunnel(range),
    staleTime: STALE,
    enabled,
  })
}

export function useAnalyticsSources(range, { enabled = true } = {}) {
  return useQuery({
    queryKey: analyticsKeys.sources(range),
    queryFn:  () => fetchLeadsBySource(range),
    staleTime: STALE,
    enabled,
  })
}

export function useAnalyticsLeads(range, { enabled = true } = {}) {
  return useQuery({
    queryKey: analyticsKeys.leads(range),
    queryFn:  () => fetchLeadStats(range),
    staleTime: STALE,
    enabled,
  })
}

export function useAnalyticsTasks(range, { enabled = true } = {}) {
  return useQuery({
    queryKey: analyticsKeys.tasks(range),
    queryFn:  () => fetchTaskStats(range),
    staleTime: STALE,
    enabled,
  })
}

export function useAnalyticsMeetings(range, { enabled = true } = {}) {
  return useQuery({
    queryKey: analyticsKeys.meetings(range),
    queryFn:  () => fetchMeetingStats(range),
    staleTime: STALE,
    enabled,
  })
}

export function useAnalyticsTeam(range, { enabled = true } = {}) {
  return useQuery({
    queryKey: analyticsKeys.team(range),
    queryFn:  () => fetchTeamPerformance(range),
    staleTime: STALE,
    enabled,
  })
}

export function useAnalyticsActivity(range, { enabled = true } = {}) {
  return useQuery({
    queryKey: analyticsKeys.activity(range),
    queryFn:  () => fetchRecentActivity(range),
    staleTime: STALE,
    enabled,
  })
}
