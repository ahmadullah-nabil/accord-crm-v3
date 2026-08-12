import React from 'react'
import { BarChart2 } from 'lucide-react'

import { useAnalyticsStore }        from '../stores/analyticsStore.js'
import { DATE_RANGES }              from '../lib/analyticsData.js'
import {
  useAnalyticsKpi,
  useAnalyticsRevenue,
  useAnalyticsFunnel,
  useAnalyticsSources,
  useAnalyticsLeads,
  useAnalyticsTasks,
  useAnalyticsMeetings,
  useAnalyticsTeam,
  useAnalyticsActivity,
} from '../hooks/useAnalytics.js'

import { AnalyticsKpiGrid }        from '../components/analytics/AnalyticsKpiGrid.jsx'
import { AnalyticsRevenueChart }   from '../components/analytics/AnalyticsRevenueChart.jsx'
import { AnalyticsPipelineChart }  from '../components/analytics/AnalyticsPipelineChart.jsx'
import { LeadStatsChart, LeadSourceChart } from '../components/analytics/LeadAnalyticsCharts.jsx'
import { TaskCompletionTrendChart, TaskBreakdownChart } from '../components/analytics/TaskAnalyticsCharts.jsx'
import { MeetingStatusChart, MeetingTypeChart }        from '../components/analytics/MeetingAnalyticsCharts.jsx'
import { TeamPerformanceTable }    from '../components/analytics/TeamPerformanceTable.jsx'
import { RecentActivityFeed }      from '../components/analytics/RecentActivityFeed.jsx'

export function AnalyticsPage() {
  const { selectedRange, setRange } = useAnalyticsStore()
  const range = selectedRange

  const kpi      = useAnalyticsKpi(range)
  const revenue  = useAnalyticsRevenue(range)
  const funnel   = useAnalyticsFunnel(range)
  const sources  = useAnalyticsSources(range)
  const leads    = useAnalyticsLeads(range)
  const tasks    = useAnalyticsTasks(range)
  const meetings = useAnalyticsMeetings(range)
  const team     = useAnalyticsTeam(range)
  const activity = useAnalyticsActivity(range)

  return (
    <div className="space-y-5 max-w-[1600px]">
      {/* Page heading + date range selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center ring-1 ring-indigo-200">
            <BarChart2 size={18} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="font-display font-bold text-gray-900 text-xl leading-tight">Analytics</h1>
            <p className="text-xs text-gray-500">Performance insights across all modules</p>
          </div>
        </div>

        {/* Date range selector */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {DATE_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
                ${selectedRange === r.value
                  ? 'bg-white text-gray-900 shadow-card'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <AnalyticsKpiGrid data={kpi.data} isLoading={kpi.isLoading} />

      {/* ── Revenue + Pipeline ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3">
          <AnalyticsRevenueChart data={revenue.data || []} isLoading={revenue.isLoading} />
        </div>
        <div className="xl:col-span-2">
          <AnalyticsPipelineChart data={funnel.data || []} isLoading={funnel.isLoading} />
        </div>
      </div>

      {/* ── Lead Stats + Sources ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3">
          <LeadStatsChart data={leads.data || []} isLoading={leads.isLoading} />
        </div>
        <div className="xl:col-span-2">
          <LeadSourceChart data={sources.data || []} isLoading={sources.isLoading} />
        </div>
      </div>

      {/* ── Tasks + Meetings ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <TaskCompletionTrendChart data={tasks.data} isLoading={tasks.isLoading} />
        <TaskBreakdownChart       data={tasks.data} isLoading={tasks.isLoading} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <MeetingStatusChart data={meetings.data} isLoading={meetings.isLoading} />
        <MeetingTypeChart   data={meetings.data} isLoading={meetings.isLoading} />
      </div>

      {/* ── Team + Activity ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3">
          <TeamPerformanceTable data={team.data} isLoading={team.isLoading} />
        </div>
        <div className="xl:col-span-2">
          <RecentActivityFeed data={activity.data} isLoading={activity.isLoading} />
        </div>
      </div>
    </div>
  )
}

export default AnalyticsPage
