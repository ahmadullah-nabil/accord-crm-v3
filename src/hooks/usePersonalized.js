// ─── Personalized / Ownership-Aware Views ────────────────────────────────────
//
// Derives "My" views from the existing React Query caches using `select`.
// Zero extra Supabase queries — automatically in sync with base caches.
//
// Filtering uses assignee/organizer === user.name (the stored display string).
// Future RBAC upgrade: swap user.name → user.id and compare against ownerId.

import { useQuery }         from '@tanstack/react-query'
import { useAuthStore }     from '../stores/authStore.js'
import { useLeadsStore }    from '../stores/leadsStore.js'
import { getTasks }         from '../services/tasksService.js'
import { getMeetings }      from '../services/meetingsService.js'
import { taskKeys }         from './useTasks.js'
import { meetingKeys }      from './useMeetings.js'

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function daysFromNow(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ── My Tasks ──────────────────────────────────────────────────────────────────

/** Incomplete tasks assigned to the current user */
export function useMyTasks() {
  const user            = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey: taskKeys.all(),
    queryFn:  getTasks,
    staleTime: 1000 * 60 * 2,
    enabled:   isAuthenticated && Boolean(user?.name),
    select: (tasks) =>
      tasks.filter((t) => t.assignee === user.name && t.status !== 'Completed'),
  })
}

/** Overdue tasks: past due date, not completed, assigned to current user */
export function useMyOverdueTasks() {
  const user            = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const now             = todayStr()

  return useQuery({
    queryKey: taskKeys.all(),
    queryFn:  getTasks,
    staleTime: 1000 * 60 * 2,
    enabled:   isAuthenticated && Boolean(user?.name),
    select: (tasks) =>
      tasks.filter(
        (t) =>
          t.assignee === user.name &&
          t.status   !== 'Completed' &&
          t.dueDate  &&
          t.dueDate  <  now,
      ),
  })
}

/** Tasks due within 7 days, not overdue, assigned to current user */
export function useMyUpcomingTasks() {
  const user            = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const now             = todayStr()
  const in7             = daysFromNow(7)

  return useQuery({
    queryKey: taskKeys.all(),
    queryFn:  getTasks,
    staleTime: 1000 * 60 * 2,
    enabled:   isAuthenticated && Boolean(user?.name),
    select: (tasks) =>
      tasks
        .filter(
          (t) =>
            t.assignee === user.name &&
            t.status   !== 'Completed' &&
            t.dueDate  &&
            t.dueDate  >= now &&
            t.dueDate  <= in7,
        )
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
  })
}

// ── My Meetings ───────────────────────────────────────────────────────────────

/** Upcoming scheduled meetings organised by current user */
export function useMyUpcomingMeetings() {
  const user            = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const now             = todayStr()

  return useQuery({
    queryKey: meetingKeys.all(),
    queryFn:  getMeetings,
    staleTime: 1000 * 60 * 2,
    enabled:   isAuthenticated && Boolean(user?.name),
    select: (meetings) =>
      meetings
        .filter(
          (m) =>
            m.organizer     === user.name &&
            m.status        === 'Scheduled' &&
            m.scheduledDate &&
            m.scheduledDate >= now,
        )
        .sort((a, b) => {
          const at = `${a.scheduledDate}T${a.scheduledTime || ''}`
          const bt = `${b.scheduledDate}T${b.scheduledTime || ''}`
          return at.localeCompare(bt)
        })
        .slice(0, 5),
  })
}

// ── My Pipeline ───────────────────────────────────────────────────────────────
// Reads directly from leadsStore (Zustand) so it stays in sync without an
// extra Supabase query. leadsStore.initialize() is called by LeadsPage on mount.
export function useMyPipeline() {
  const user   = useAuthStore((s) => s.user)
  const leads  = useLeadsStore((s) => s.leads)

  if (!user?.name) return { myLeads: [], totalValue: 0, byStage: {} }

  const myLeads = leads.filter((l) => l.assignee === user.name && l.stage !== 'Lost')
  const totalValue = myLeads.reduce((sum, l) => sum + (Number(l.value) || 0), 0)

  const byStage = myLeads.reduce((acc, l) => {
    acc[l.stage] = (acc[l.stage] || 0) + 1
    return acc
  }, {})

  return { myLeads, totalValue, byStage }
}
