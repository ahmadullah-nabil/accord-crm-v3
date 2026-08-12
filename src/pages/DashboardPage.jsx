import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore }     from '../stores/authStore.js'
import { ActivityCalendar } from '../components/dashboard/ActivityCalendar.jsx'
// Mounted here so clicking a date can CREATE without navigating away — leaving
// the Dashboard to make a meeting would lose the month you were looking at.
// Both read their own store, so mounting them twice across pages is safe.
import { MeetingFormModal } from '../components/meetings/MeetingFormModal.jsx'
import { TaskFormModal }    from '../components/tasks/TaskFormModal.jsx'
import { KpiCard }          from '../components/dashboard/KpiCard.jsx'
import { RevenueChart }     from '../components/dashboard/RevenueChart.jsx'
import { PipelineFunnel }   from '../components/dashboard/PipelineFunnel.jsx'
import { ActivityTimeline } from '../components/dashboard/ActivityTimeline.jsx'
import { TopPerformers }    from '../components/dashboard/TopPerformers.jsx'
import { QuickActions }     from '../components/dashboard/QuickActions.jsx'
import { LeadsChart }       from '../components/dashboard/LeadsChart.jsx'
import { MyWorkspace }      from '../components/dashboard/MyWorkspace.jsx'
import {
  useDashboardKpi,
  useDashboardRevenue,
  useDashboardPipeline,
  useDashboardPerformers,
  useDashboardActivity,
  useDashboardLeads,
} from '../hooks/useDashboard.js'
import {
  DollarSign, Target, TrendingUp, CheckSquare,
  Calendar, Layers, BarChart2, Users,
} from 'lucide-react'

// Maps KPI keys → card display config
const KPI_CONFIG = [
  { key: 'totalRevenue',       icon: DollarSign,  color: 'teal',    format: 'currency' },
  { key: 'activeLeads',        icon: Target,      color: 'blue',    format: 'num'      },
  { key: 'conversionRate',     icon: TrendingUp,  color: 'emerald', format: 'pct'      },
  { key: 'dealsWon',           icon: BarChart2,   color: 'purple',  format: 'num'      },
  { key: 'taskCompletionRate', icon: CheckSquare, color: 'amber',   format: 'pct'      },
  { key: 'meetingsConducted',  icon: Calendar,    color: 'indigo',  format: 'num'      },
  { key: 'avgDealSize',        icon: Layers,      color: 'teal',    format: 'currency' },
  { key: 'pipelineValue',      icon: Users,       color: 'blue',    format: 'currency' },
]

function fmtKpiValue(raw, format) {
  const v = Number(raw ?? 0)
  if (format === 'currency') {
    if (v >= 1_000_000) return `৳${(v / 1_000_000).toFixed(2)}M`
    if (v >= 1_000)     return `৳${(v / 1_000).toFixed(0)}K`
    return `৳${v}`
  }
  if (format === 'pct') return `${v.toFixed(1)}%`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)

  const kpi        = useDashboardKpi()
  const revenue    = useDashboardRevenue()
  const pipeline   = useDashboardPipeline()
  const performers = useDashboardPerformers()
  const activity   = useDashboardActivity()
  const leads      = useDashboardLeads()

  // Build KPI cards from real query data
  const kpiCards = kpi.data
    ? KPI_CONFIG.map((cfg) => {
        const entry = kpi.data[cfg.key] ?? { value: 0, trend: 0, label: cfg.key }
        return {
          id:     cfg.key,
          label:  entry.label,
          value:  fmtKpiValue(entry.value, cfg.format),
          trend:  Number(entry.trend ?? 0),
          period: 'Last 30 days',
          icon:   cfg.icon,
          color:  cfg.color,
        }
      })
    : []

  const anyLoading = kpi.isLoading || revenue.isLoading || pipeline.isLoading

  // Tab lives in the URL so a refresh, a back button, or a shared link all land
  // where the user was. Component state would silently reset every one of those.
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'overview' ? 'overview' : 'today'

  const setTab = (next) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'today') params.delete('tab')   // keep the default URL clean
    else params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="space-y-5 max-w-[1600px]">
      {/* Welcome bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-gray-900 text-xl leading-tight">
            {user?.name ? `Welcome back, ${user.name.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {tab === 'today'
              ? 'What is happening this month'
              : 'Your CRM at a glance · Last 30 days'}
          </p>
        </div>
        {/* QuickActions renders as a full card. In the header of a calendar view
            it dominates the fold and leaves a void beside the title, so it is
            shown only on Overview where a dense card block belongs. The
            calendar has its own create affordance — clicking a date. */}
        {tab === 'overview' && <QuickActions />}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────
          Named for the QUESTION each answers rather than what it contains:
          "Today" and "Overview" beat "Calendar" and "Analytics", and make the
          default feel deliberate instead of arbitrary.

          Today is first and default because it answers the daily question. The
          analytics remain one click away rather than deleted — if nobody opens
          them in a month, that is the evidence for removing them. */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {[
          { id: 'today',    label: 'Today' },
          { id: 'overview', label: 'Overview' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition
              ${tab === t.id
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'today' && (
        <>
          <ActivityCalendar />
          <MeetingFormModal />
          <TaskFormModal />
        </>
      )}

      {/* Everything below is the original Overview, unchanged. Kept mounted
          only when selected so its six dashboard queries do not run on every
          Dashboard visit just to sit behind a tab nobody opened. */}
      {tab === 'overview' && (
      <>

      {/* KPI Cards — real data */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {kpi.isLoading || kpiCards.length === 0
          ? KPI_CONFIG.map((cfg) => (
              <KpiCard
                key={cfg.key}
                label={cfg.key}
                value="—"
                trend={0}
                period="Last 30 days"
                icon={cfg.icon}
                color={cfg.color}
                isLoading={kpi.isLoading}
              />
            ))
          : kpiCards.map((kpi) => (
              <KpiCard
                key={kpi.id}
                label={kpi.label}
                value={kpi.value}
                trend={kpi.trend}
                period={kpi.period}
                icon={kpi.icon}
                color={kpi.color}
                isLoading={false}
              />
            ))
        }
      </div>

      {/* My Workspace (personalized — uses its own hooks) */}
      <MyWorkspace isLoading={anyLoading} />

      {/* Revenue + Pipeline — real data */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3">
          <RevenueChart data={revenue.data ?? []} isLoading={revenue.isLoading} />
        </div>
        <div className="xl:col-span-2">
          <PipelineFunnel data={pipeline.data ?? []} isLoading={pipeline.isLoading} />
        </div>
      </div>

      {/* Activity + Performers + Leads — real data */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-1">
          <ActivityTimeline data={activity.data ?? []} isLoading={activity.isLoading} />
        </div>
        <div className="xl:col-span-2 flex flex-col gap-4">
          <TopPerformers data={performers.data ?? []} isLoading={performers.isLoading} />
          <LeadsChart data={leads.data ?? []} isLoading={leads.isLoading} />
        </div>
      </div>
      </>
      )}
    </div>
  )
}

export default DashboardPage
