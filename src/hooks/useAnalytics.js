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

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useAnalyticsKpi(range) {
  return useQuery({
    queryKey: analyticsKeys.kpi(range),
    queryFn:  () => fetchKpiSummary(range),
    staleTime: STALE,
  })
}

export function useAnalyticsRevenue(range) {
  return useQuery({
    queryKey: analyticsKeys.revenue(range),
    queryFn:  () => fetchRevenueTimeSeries(range),
    staleTime: STALE,
  })
}

export function useAnalyticsFunnel(range) {
  return useQuery({
    queryKey: analyticsKeys.funnel(range),
    queryFn:  () => fetchLeadFunnel(range),
    staleTime: STALE,
  })
}

export function useAnalyticsSources(range) {
  return useQuery({
    queryKey: analyticsKeys.sources(range),
    queryFn:  () => fetchLeadsBySource(range),
    staleTime: STALE,
  })
}

export function useAnalyticsLeads(range) {
  return useQuery({
    queryKey: analyticsKeys.leads(range),
    queryFn:  () => fetchLeadStats(range),
    staleTime: STALE,
  })
}

export function useAnalyticsTasks(range) {
  return useQuery({
    queryKey: analyticsKeys.tasks(range),
    queryFn:  () => fetchTaskStats(range),
    staleTime: STALE,
  })
}

export function useAnalyticsMeetings(range) {
  return useQuery({
    queryKey: analyticsKeys.meetings(range),
    queryFn:  () => fetchMeetingStats(range),
    staleTime: STALE,
  })
}

export function useAnalyticsTeam(range) {
  return useQuery({
    queryKey: analyticsKeys.team(range),
    queryFn:  () => fetchTeamPerformance(range),
    staleTime: STALE,
  })
}

export function useAnalyticsActivity(range) {
  return useQuery({
    queryKey: analyticsKeys.activity(range),
    queryFn:  () => fetchRecentActivity(range),
    staleTime: STALE,
  })
}
