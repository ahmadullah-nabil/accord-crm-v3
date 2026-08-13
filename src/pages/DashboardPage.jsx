// ─── DashboardPage ────────────────────────────────────────────────────────────
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ step053 — THE OVERVIEW TAB IS GONE. ONE SURFACE, NOT TWO.               │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ The Dashboard was two dashboards behind a tab strip. The tab, the ?tab  │
// │ param and the six analytics queries went with it.                       │
// │                                                                          │
// │ NOTHING WAS DELETED FROM THE REPO. KpiCard, RevenueChart,               │
// │ PipelineFunnel, ActivityTimeline, TopPerformers, LeadsChart,            │
// │ MyWorkspace, QuickActions and LeadOverview all still exist, unimported. │
// │ Unmounting is reversible and deleting is not.                            │
// └─────────────────────────────────────────────────────────────────────────┘
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ step054 — ONE PAGE, NO SCROLL. FOUR BANDS.                              │
// ├─────────────────────────────────────────────────────────────────────────┤
// │   figures  →  pipeline  →  month  →  recent deals                       │
// │                                                                          │
// │ The constraint is the design: everything has to land inside one 1080p   │
// │ viewport, roughly 830px of content. That is what decides every size      │
// │ here, and it is why NONE of the old Overview components came back.       │
// │ KpiCard is a 110px card with an icon tile; four of them plus the         │
// │ calendar and a table do not fit. The blocks below are written to the     │
// │ budget instead: 64px of figures, a 44px pipeline strip, the calendar,    │
// │ and five deal rows.                                                      │
// │                                                                          │
// │ THEY ARE LOCAL ON PURPOSE. Each is presentational, reads one query and   │
// │ has no state. Extract them when a second page wants one — not before;    │
// │ a shared component that exists for one caller is just a file boundary.   │
// │                                                                          │
// │ TWO QUERIES CAME BACK: useDashboardKpi and useDashboardPipeline. The     │
// │ other four (revenue, performers, activity, leads) did not, and the       │
// │ charts that consumed them stay unmounted. `enabled` gating is no longer  │
// │ needed on either — there is no tab left to hide behind, so they run on   │
// │ the only view there is.                                                  │
// │                                                                          │
// │ THE FIGURES ARE THE ONES THE SERVICE ACTUALLY RETURNS. getKpiSummary     │
// │ has no "open deals" and no "won this month" — it has pipelineValue,      │
// │ activeLeads, dealsWon and totalRevenue over a fixed 30-day range. Those  │
// │ are the four shown. Do not relabel one of them into a figure it is not.  │
// └─────────────────────────────────────────────────────────────────────────┘

import React from 'react'
import { useNavigate }       from 'react-router-dom'
import { ArrowRight }        from 'lucide-react'
import { useAuthStore }      from '../stores/authStore.js'
import { ActivityCalendar }  from '../components/dashboard/ActivityCalendar.jsx'
import { useCalendarFilters } from '../hooks/useCalendarFilters.js'
import { useDashboardKpi, useDashboardPipeline } from '../hooks/useDashboard.js'
import { useOpportunities }  from '../hooks/useOpportunities.js'
import { useLeadsStore }     from '../stores/leadsStore.js'
// Mounted here so clicking a date can CREATE without navigating away — leaving
// the Dashboard to make a meeting would lose the month you were looking at.
import { MeetingFormModal } from '../components/meetings/MeetingFormModal.jsx'
import { TaskFormModal }    from '../components/tasks/TaskFormModal.jsx'

/** Taka, shortened. A pipeline figure is read for its magnitude, and the exact
 *  digits of ৳12,483,900 are noise at this size. */
function money(v) {
  const n = Number(v ?? 0)
  if (n >= 10_000_000) return `৳${(n / 10_000_000).toFixed(2)}Cr`
  if (n >= 100_000)    return `৳${(n / 100_000).toFixed(2)}L`
  if (n >= 1_000)      return `৳${(n / 1_000).toFixed(0)}K`
  return `৳${n}`
}

const FIGURES = [
  { key: 'pipelineValue', label: 'Pipeline value', money: true  },
  { key: 'totalRevenue',  label: 'Revenue',        money: true  },
  { key: 'activeLeads',   label: 'Active leads',   money: false },
  { key: 'dealsWon',      label: 'Deals won',      money: false },
]

/** Four figures on one 64px line. No icon tiles, no trend arrows: every
 *  trend getKpiSummary returns is hardcoded 0, so an arrow here would be
 *  decoration claiming to be data. */
function FigureStrip({ data, isLoading }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {FIGURES.map((f) => {
        const entry = data?.[f.key]
        return (
          <div key={f.key}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">{f.label}</p>
            <p className="font-display font-semibold text-gray-900 text-lg leading-tight tabular-nums">
              {isLoading || !entry
                ? <span className="text-gray-300">—</span>
                : f.money ? money(entry.value) : Number(entry.value ?? 0)}
            </p>
          </div>
        )
      })}
    </div>
  )
}

/** Lead stages as one strip. This is the same data LeadOverview showed as a
 *  row of cards; the cards were 120px and this is 44, which is the whole
 *  reason it can be on the page at all. Colours come from the service as hex
 *  and are applied inline — they are data, not theme, and the ramp in
 *  tailwind.config has no per-stage entry to map them onto. */
function PipelineStrip({ data, isLoading, onOpenStage }) {
  const stages = Array.isArray(data) ? data : []
  const total  = stages.reduce((sum, s) => sum + Number(s.count ?? 0), 0)

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2
                    flex items-center gap-2 flex-wrap">
      <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-1">Leads</span>
      {isLoading && <span className="text-xs text-gray-400">Loading…</span>}
      {!isLoading && stages.map((s) => (
        <button key={s.stage} type="button" onClick={() => onOpenStage(s.stage)}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg
                     hover:bg-gray-50 transition">
          <span className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: s.color }} />
          <span className="text-[11px] text-gray-600">{s.stage}</span>
          <span className="text-[11px] font-semibold text-gray-900 tabular-nums">
            {s.count ?? 0}
          </span>
        </button>
      ))}
      {!isLoading && (
        <span className="ml-auto text-[11px] text-gray-400 tabular-nums">
          {total} total
        </span>
      )}
    </div>
  )
}

/** Five most recent deals. Newest by createdAt — opportunitiesService does not
 *  map updated_at, so "recently touched" is not available without a schema
 *  read this batch does not need. Sorted here rather than in the query because
 *  useOpportunities is the shared list cache and must not be re-keyed for one
 *  caller's ordering. */
function RecentDeals({ rows, isLoading, onOpen }) {
  const recent = (rows ?? [])
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 5)

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Recent deals
        </span>
        <button type="button" onClick={() => onOpen(null)}
          className="text-[11px] text-teal-700 hover:text-teal-800 font-medium
                     inline-flex items-center gap-1">
          All opportunities <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {isLoading && <p className="px-3 py-4 text-xs text-gray-400">Loading deals…</p>}

      {!isLoading && recent.length === 0 && (
        <p className="px-3 py-4 text-xs text-gray-400">
          No opportunities yet. Create one from the Opportunities page.
        </p>
      )}

      {!isLoading && recent.length > 0 && (
        <table className="w-full">
          <tbody className="divide-y divide-gray-100">
            {recent.map((o) => (
              <tr key={o.id}
                onClick={() => onOpen(o.id)}
                className="cursor-pointer hover:bg-gray-50 transition">
                <td className="px-3 py-1.5 text-xs text-gray-900 truncate max-w-[220px]">
                  {o.title || 'Untitled'}
                </td>
                <td className="px-3 py-1.5 text-xs text-gray-500 truncate max-w-[180px]">
                  {o.company || '—'}
                </td>
                <td className="px-3 py-1.5 text-xs text-gray-900 tabular-nums text-right
                               whitespace-nowrap">
                  {money(o.value)}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full
                                   border border-gray-200 text-gray-600 whitespace-nowrap">
                    {o.stage}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function DashboardPage() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  // Filter state lives in the URL so a filtered month survives a refresh,
  // survives the back button after opening a task, and can be shared as a
  // link. Owned here rather than inside the calendar so the URL has one owner.
  const calendarFilters = useCalendarFilters()

  // A stage click deep-links into the EXISTING Leads page through its store,
  // not through a URL param. LeadsPage reads no search params at all, so
  // navigate('/leads?stage=X') would land on an unfiltered list while looking
  // like a filter had been applied — the silent-wrong-answer shape this
  // project keeps hitting. This is the same path the old LeadOverview used.
  const setStageFilter = useLeadsStore((s) => s.setStageFilter)
  const clearFilters   = useLeadsStore((s) => s.clearFilters)

  const openStage = (stage) => {
    clearFilters()
    if (stage) setStageFilter(stage)
    navigate('/leads')
  }

  const kpi      = useDashboardKpi()
  const pipeline = useDashboardPipeline()
  const opps     = useOpportunities()

  return (
    <div className="space-y-3 max-w-[1600px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-gray-900 text-lg leading-tight">
            {user?.name ? `Welcome back, ${user.name.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p className="text-[11px] text-gray-500">What is happening this month</p>
        </div>
      </div>

      <FigureStrip data={kpi.data} isLoading={kpi.isLoading} />

      {/* Stage → the existing Leads page, pre-filtered. Not a second lead
          surface: this counts, Leads manages. */}
      <PipelineStrip
        data={pipeline.data}
        isLoading={pipeline.isLoading}
        onOpenStage={openStage}
      />

      <ActivityCalendar
        filters={calendarFilters.filters}
        activeFilterCount={calendarFilters.activeCount}
        onToggleType={calendarFilters.toggleType}
        onToggleStatus={calendarFilters.toggleStatus}
        onSetOwner={calendarFilters.setOwner}
        onClearFilters={calendarFilters.clear}
      />

      <RecentDeals
        rows={opps.data}
        isLoading={opps.isLoading}
        onOpen={() => navigate('/opportunities')}
      />

      <MeetingFormModal />
      <TaskFormModal />
    </div>
  )
}

export default DashboardPage
