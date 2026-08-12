// ─── Analytics Data Layer ─────────────────────────────────────────────────────
//
// Public API used by useAnalytics.js hooks.
// Each function delegates to analyticsService.js (real Supabase queries).
// If the DB is empty, analyticsService returns zeroes/empty arrays — the UI
// renders empty states rather than crashing.
//
// DO NOT import analyticsService directly in components or hooks —
// always use these wrappers so the contract is preserved.

import {
  getKpiSummary,
  getRevenueTimeSeries,
  getLeadFunnel,
  getLeadsBySource,
  getLeadStats,
  getTaskStats,
  getMeetingStats,
  getTeamPerformance,
  getRecentActivity,
} from '../services/analyticsService.js'

// ── Public fetch functions (same signatures as the previous mock versions) ────

export async function fetchKpiSummary(range) {
  return getKpiSummary(range)
}

export async function fetchRevenueTimeSeries(range) {
  return getRevenueTimeSeries(range)
}

export async function fetchLeadFunnel(range) {
  return getLeadFunnel(range)
}

export async function fetchLeadsBySource(range) {
  return getLeadsBySource(range)
}

export async function fetchLeadStats(range) {
  return getLeadStats(range)
}

export async function fetchTaskStats(range) {
  return getTaskStats(range)
}

export async function fetchMeetingStats(range) {
  return getMeetingStats(range)
}

export async function fetchTeamPerformance(range) {
  return getTeamPerformance(range)
}

export async function fetchRecentActivity(range) {
  return getRecentActivity(range)
}

// ── Date Range Constants ──────────────────────────────────────────────────────

export const DATE_RANGES = [
  { value: '7d',  label: 'Last 7 days'  },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y',  label: 'This year'    },
]

// ── Format helpers ────────────────────────────────────────────────────────────

export function fmtCurrency(v) {
  if (v >= 1_000_000) return `৳${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000)     return `৳${(v / 1_000).toFixed(0)}K`
  return `৳${v}`
}

export function fmtNum(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}
