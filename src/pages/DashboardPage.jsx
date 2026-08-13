// ─── DashboardPage ────────────────────────────────────────────────────────────
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ step053 — THE OVERVIEW TAB IS GONE. ONE SURFACE, NOT TWO.               │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ The Dashboard was two dashboards behind a tab strip: "Today" (the       │
// │ calendar) and "Overview" (eight KPI cards, a revenue chart, a funnel, a │
// │ timeline, a performers table and a leads chart). Removed on request.    │
// │                                                                          │
// │ WHAT WENT WITH IT, AND WHY THAT MATTERS MORE THAN THE MARKUP:           │
// │ the six analytics queries — useDashboardKpi / Revenue / Pipeline /      │
// │ Performers / Activity / Leads — are no longer called from this page at  │
// │ all. They were already gated behind `{ enabled: tab === 'overview' }`,  │
// │ so this is not a performance win on the default view; it is one less    │
// │ thing that can be un-gated by accident later.                           │
// │                                                                          │
// │ The ?tab param goes with them. A bare /dashboard URL is now the only    │
// │ state this page has.                                                     │
// │                                                                          │
// │ NOTHING WAS DELETED FROM THE REPO. KpiCard, RevenueChart,               │
// │ PipelineFunnel, ActivityTimeline, TopPerformers, LeadsChart,            │
// │ MyWorkspace, QuickActions, LeadOverview and hooks/useDashboard.js all   │
// │ still exist, unimported. Unmounting is reversible and deleting is not;  │
// │ if they are still unmounted in a month, that is the evidence for        │
// │ removing the files. Do not delete them as a side effect of another      │
// │ batch.                                                                   │
// └─────────────────────────────────────────────────────────────────────────┘

import React from 'react'
import { useAuthStore }       from '../stores/authStore.js'
import { ActivityCalendar }   from '../components/dashboard/ActivityCalendar.jsx'
import { useCalendarFilters } from '../hooks/useCalendarFilters.js'
// Mounted here so clicking a date can CREATE without navigating away — leaving
// the Dashboard to make a meeting would lose the month you were looking at.
// Both read their own store, so mounting them twice across pages is safe.
import { MeetingFormModal } from '../components/meetings/MeetingFormModal.jsx'
import { TaskFormModal }    from '../components/tasks/TaskFormModal.jsx'

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)

  // Filter state lives in the URL so a filtered month survives a refresh,
  // survives the back button after opening a task, and can be shared as a
  // link. Owned here rather than inside the calendar so the URL has one owner.
  const calendarFilters = useCalendarFilters()

  return (
    <div className="space-y-4 max-w-[1600px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-gray-900 text-xl leading-tight">
            {user?.name ? `Welcome back, ${user.name.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            What is happening this month
          </p>
        </div>
      </div>

      <ActivityCalendar
        filters={calendarFilters.filters}
        activeFilterCount={calendarFilters.activeCount}
        onToggleType={calendarFilters.toggleType}
        onToggleStatus={calendarFilters.toggleStatus}
        onSetOwner={calendarFilters.setOwner}
        onClearFilters={calendarFilters.clear}
      />

      <MeetingFormModal />
      <TaskFormModal />
    </div>
  )
}

export default DashboardPage
