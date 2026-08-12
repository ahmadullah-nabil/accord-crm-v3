// ─── Activity Intelligence Hook ───────────────────────────────────────────────
//
// Scans the user's own records for operational issues and creates system
// notifications when problems are found:
//
//   • Overdue tasks      — task.dueDate < today && status !== 'Completed'
//   • Stale opportunities — last_activity > STALE_OPP_DAYS with active stage
//   • Inactive leads     — last_activity > INACTIVE_LEAD_DAYS with active stage
//
// Architecture
// ────────────
// This hook is mounted ONCE in AppLayout.jsx (not per-page). It runs once on
// mount, then every SCAN_INTERVAL ms. It debounces itself so it never creates
// duplicate notifications within a session.
//
// The notification creation is fire-and-forget. If the Supabase write fails,
// the scan silently moves on — primary CRM operations are never blocked.
//
// RBAC note: all queries go through RLS so users only scan their own records.
// Managers can be extended here later to also scan subordinate records.

import { useEffect, useRef }  from 'react'
import { useQueryClient }     from '@tanstack/react-query'
import { useAuthStore }       from '../stores/authStore.js'
import { notifKeys }          from './useNotifications.js'
import { supabase }           from '../lib/supabaseClient.js'
import {
  notifyOverdueTask,
  notifyStaleOpportunity,
  notifyInactiveLead,
} from '../services/notificationsService.js'

// ── Thresholds ────────────────────────────────────────────────────────────────
const STALE_OPP_DAYS     = 14    // opportunity with no activity for 14 days
const INACTIVE_LEAD_DAYS = 21    // lead with no activity for 21 days
const SCAN_INTERVAL      = 1000 * 60 * 30  // run every 30 minutes
const DEDUP_KEY          = 'accord_intel_last_scan'  // sessionStorage key

// ── Helpers ───────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split('T')[0]
}

function daysBetween(dateStr, referenceStr) {
  const ref  = new Date(referenceStr)
  const date = new Date(dateStr)
  return Math.floor((ref - date) / (1000 * 60 * 60 * 24))
}

function alreadyScannedToday() {
  try {
    const last = sessionStorage.getItem(DEDUP_KEY)
    return last === today()
  } catch {
    return false
  }
}

function markScannedToday() {
  try {
    sessionStorage.setItem(DEDUP_KEY, today())
  } catch { /* ignore */ }
}

// ── Main scan function ────────────────────────────────────────────────────────

async function runIntelligenceScan(userId, qc) {
  if (!userId) return
  if (alreadyScannedToday()) return

  const todayStr = today()

  // Gather existing notification types created today to avoid duplicates
  const { data: existing } = await supabase
    .from('notifications')
    .select('type, entity_id')
    .eq('user_id', userId)
    .gte('created_at', `${todayStr}T00:00:00`)
  const existingSet = new Set(
    (existing ?? []).map((n) => `${n.type}:${n.entity_id}`)
  )

  const skip = (type, entityId) => existingSet.has(`${type}:${entityId}`)

  let created = 0

  // ── Overdue tasks ─────────────────────────────────────────────────────────
  try {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, due_date, assignee')
      .neq('status', 'Completed')
      .lt('due_date', todayStr)
      .not('due_date', 'is', null)

    for (const task of tasks ?? []) {
      if (skip('task_overdue', task.id)) continue
      const daysOverdue = daysBetween(task.due_date, todayStr)
      await notifyOverdueTask({
        recipientId: userId,
        taskTitle:   task.title,
        taskId:      task.id,
        dueDate:     task.due_date,
        daysOverdue,
      })
      created++
    }
  } catch (err) {
    console.warn('[intelligence] overdue tasks scan failed:', err.message)
  }

  // ── Stale opportunities ────────────────────────────────────────────────────
  try {
    const staleDate = (() => {
      const d = new Date(); d.setDate(d.getDate() - STALE_OPP_DAYS)
      return d.toISOString().split('T')[0]
    })()

    const { data: opps } = await supabase
      .from('opportunities')
      .select('id, title, stage, last_activity, assignee')
      .not('stage', 'in', '("Won","Lost")')
      .lt('last_activity', staleDate)

    for (const opp of opps ?? []) {
      if (skip('opportunity_stale', opp.id)) continue
      const daysSince = daysBetween(opp.last_activity, todayStr)
      await notifyStaleOpportunity({
        recipientId:      userId,
        oppTitle:         opp.title,
        oppId:            opp.id,
        daysSinceActivity: daysSince,
        stage:            opp.stage,
      })
      created++
    }
  } catch (err) {
    console.warn('[intelligence] stale opportunities scan failed:', err.message)
  }

  // ── Inactive leads ─────────────────────────────────────────────────────────
  try {
    const inactiveDate = (() => {
      const d = new Date(); d.setDate(d.getDate() - INACTIVE_LEAD_DAYS)
      return d.toISOString().split('T')[0]
    })()

    const { data: leads } = await supabase
      .from('leads')
      .select('id, name, company, stage, last_activity, assignee')
      .not('stage', 'in', '("Won","Lost")')
      .lt('last_activity', inactiveDate)

    for (const lead of leads ?? []) {
      if (skip('lead_inactive', lead.id)) continue
      const daysSince = daysBetween(lead.last_activity, todayStr)
      await notifyInactiveLead({
        recipientId:      userId,
        leadName:         lead.company || lead.name,
        leadId:           lead.id,
        daysSinceActivity: daysSince,
        stage:            lead.stage,
      })
      created++
    }
  } catch (err) {
    console.warn('[intelligence] inactive leads scan failed:', err.message)
  }

  if (created > 0) {
    // Invalidate notification queries so the bell badge updates
    qc.invalidateQueries({ queryKey: notifKeys.all() })
    qc.invalidateQueries({ queryKey: notifKeys.unreadCount() })
  }

  markScannedToday()
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Mount once in AppLayout. Runs the intelligence scan on load and every 30 min.
 */
export function useIntelligence() {
  const user  = useAuthStore((s) => s.user)
  const isAuth = useAuthStore((s) => s.isAuthenticated)
  const qc    = useQueryClient()
  const timer = useRef(null)

  useEffect(() => {
    if (!isAuth || !user?.id) return

    // Initial scan after a 10-second delay (let the app fully load first)
    const initialTimer = setTimeout(() => {
      runIntelligenceScan(user.id, qc)
    }, 10_000)

    // Periodic scan
    timer.current = setInterval(() => {
      runIntelligenceScan(user.id, qc)
    }, SCAN_INTERVAL)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(timer.current)
    }
  }, [isAuth, user?.id, qc])
}
