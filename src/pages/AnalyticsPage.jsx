// ─── AnalyticsPage ────────────────────────────────────────────────────────────
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ step056 — FOUR SECTIONS, NOT ONE COLUMN OF ELEVEN CHARTS                │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ This page drew eleven charts stacked vertically and fired NINE queries  │
// │ to fill them, on every visit, regardless of which two the user had come │
// │ to look at. Most of it was below the fold and some of it was three      │
// │ scrolls down.                                                            │
// │                                                                          │
// │ It is now four named sections behind one control, and the queries are   │
// │ gated to the section that is showing — kpi/revenue/funnel for Overview, │
// │ leads/sources for Leads, and so on. A visit costs two or three queries  │
// │ instead of nine. useAnalytics.js grew an { enabled } option in the same │
// │ batch for exactly this; the gate is on the QUERY, not the render,       │
// │ because a hook fetches wherever it is called.                            │
// │                                                                          │
// │ THE SECTION IS IN THE URL, the range is not, and that split is          │
// │ deliberate. A section is what you are looking at — shareable, worth      │
// │ surviving a refresh and a back button, and the same reason every module │
// │ filter should be in the URL. The range is already persisted in          │
// │ analyticsStore and shared with anything else reading it; moving it to   │
// │ the URL would give one value two owners, which is how the ?leadOwner /  │
// │ ?owner tangle started on the dashboard.                                  │
// │                                                                          │
// │ WHY NOT ViewHeader. It is the list primitive: its shape is              │
// │ "title · count of total" plus search and filters, and it renders the    │
// │ count unconditionally. Analytics has no rows to count. Two `Segmented`  │
// │ controls on one line is the same visual language without pretending     │
// │ this page is a list. `Segmented` is shared and unchanged.                │
// │                                                                          │
// │ TWO AXES, TWO CONTROLS — the invariant from handover #2. Section and    │
// │ range are independent: picking Leads must not reset the range, and       │
// │ changing the range must not move you to another section. Each control   │
// │ reads only its own state.                                                │
// └─────────────────────────────────────────────────────────────────────────┘
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ step057 — THE PAGE FITS THE VIEWPORT. HEIGHT IS PASSED DOWN, NOT PICKED │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ step056's last note said the chart components were its own batch. This  │
// │ is that batch, and it is the step055 pattern one level lower:            │
// │                                                                          │
// │   root      `h-full flex flex-col min-h-0`                               │
// │   header    `shrink-0`   — one line, always                              │
// │   figures   `shrink-0`   — one or two 46px lines                         │
// │   charts    `flex-1 min-h-0` — the one region that flexes                │
// │                                                                          │
// │ `AppLayout` already passes `h-full` down (step055), so this page can ask │
// │ for the height that is left. Nothing here is sized to fit: no            │
// │ `max-h-[Npx]`, no `height={280}`. The four heights the calendar burned   │
// │ through are the reason.                                                  │
// │                                                                          │
// │ ONE FLOOR, NOT A HEIGHT. Each chart wrapper carries `min-h-[240px]` and  │
// │ the region scrolls. A floor and a fixed height are not the same thing —  │
// │ a floor says "below this an axis is unreadable" and lets the chart grow  │
// │ past it; a height says "be exactly this" and loses to a bookmarks bar.   │
// │ Same distinction as handover #4 invariant 4: the calendar cell had a     │
// │ floor because it had to hold a title.                                    │
// │                                                                          │
// │ ONLY OVERVIEW IS ON `fill` IN THIS BATCH. `ChartCard`'s `fill` prop      │
// │ defaults to false, so Leads / Activity / Team render exactly as they did │
// │ — they keep their own heights and their region scrolls. They pick up the │
// │ theming for free (it lives in ChartShared), and converting them is       │
// │ step058. Do not convert them here just because it looks easy: five more  │
// │ files in this batch is five more things a screenshot has to disprove.    │
// └─────────────────────────────────────────────────────────────────────────┘

import React from 'react'
import { useSearchParams } from 'react-router-dom'

import { useAnalyticsStore }        from '../stores/analyticsStore.js'
import { DATE_RANGES }              from '../lib/analyticsData.js'
import { Segmented, SegButton }     from '../components/ui/Segmented.jsx'
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

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'leads',    label: 'Leads'    },
  { id: 'activity', label: 'Activity' },
  { id: 'team',     label: 'Team'     },
]

const SECTION_IDS = SECTIONS.map((s) => s.id)

/** Short labels for a control that sits on one line beside four others. The
 *  long forms stay in DATE_RANGES because the store and anything else reading
 *  it should keep the readable name. */
const RANGE_SHORT = { '7d': '7d', '30d': '30d', '90d': '90d', '1y': 'Year' }

/** The floor, in one place. Below this an axis stops being readable, so the
 *  region scrolls instead of squashing. Not a height — see the header. */
const CHART_FLOOR = 'min-h-[240px]'

/** Sections that are not yet on `fill` scroll their own region rather than the
 *  window, so the header and the section control never leave the screen. */
const SCROLL_REGION = 'flex-1 min-h-0 overflow-y-auto'

export function AnalyticsPage() {
  const { selectedRange, setRange } = useAnalyticsStore()
  const range = selectedRange

  const [searchParams, setSearchParams] = useSearchParams()
  const raw     = searchParams.get('section')
  const section = SECTION_IDS.includes(raw) ? raw : 'overview'

  const setSection = (next) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'overview') params.delete('section')   // keep the default URL clean
    else params.set('section', next)
    setSearchParams(params, { replace: true })
  }

  // One object per section so the nine gates cannot drift out of step with
  // what is rendered below. Add a chart to a section, add its hook here.
  const on = (id) => ({ enabled: section === id })

  const kpi      = useAnalyticsKpi(range,      on('overview'))
  const revenue  = useAnalyticsRevenue(range,  on('overview'))
  const funnel   = useAnalyticsFunnel(range,   on('overview'))
  const leads    = useAnalyticsLeads(range,    on('leads'))
  const sources  = useAnalyticsSources(range,  on('leads'))
  const tasks    = useAnalyticsTasks(range,    on('activity'))
  const meetings = useAnalyticsMeetings(range, on('activity'))
  const team     = useAnalyticsTeam(range,     on('team'))
  const activity = useAnalyticsActivity(range, on('team'))

  return (
    <div className="h-full min-h-0 flex flex-col gap-2 max-w-[1600px]">
      {/* ── One line: what you are looking at, and over what period ───────
          The icon tile and the subtitle are gone. A 36px indigo square next
          to the word "Analytics" on the Analytics page labels nothing, and
          the subtitle described the page to someone already on it. */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        <h1 className="font-display font-bold text-gray-900 text-base leading-tight shrink-0">
          Analytics
        </h1>

        <Segmented>
          {SECTIONS.map((s) => (
            <SegButton key={s.id} active={section === s.id} onClick={() => setSection(s.id)}>
              {s.label}
            </SegButton>
          ))}
        </Segmented>

        <div className="ml-auto">
          <Segmented>
            {DATE_RANGES.map((r) => (
              <SegButton key={r.value} active={range === r.value} onClick={() => setRange(r.value)}>
                {RANGE_SHORT[r.value] ?? r.label}
              </SegButton>
            ))}
          </Segmented>
        </div>
      </div>

      {section === 'overview' && (
        <>
          {/* Figures are chrome: two 46px lines at most, never flexing. */}
          <div className="shrink-0">
            <AnalyticsKpiGrid data={kpi.data} isLoading={kpi.isLoading} />
          </div>

          {/* The one region that flexes. */}
          <div className={`grid grid-cols-1 xl:grid-cols-5 gap-2 ${SCROLL_REGION}`}>
            <div className={`xl:col-span-3 h-full ${CHART_FLOOR}`}>
              <AnalyticsRevenueChart data={revenue.data || []} isLoading={revenue.isLoading} fill />
            </div>
            <div className={`xl:col-span-2 h-full ${CHART_FLOOR}`}>
              <AnalyticsPipelineChart data={funnel.data || []} isLoading={funnel.isLoading} fill />
            </div>
          </div>
        </>
      )}

      {section === 'leads' && (
        <div className={SCROLL_REGION}>
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-2">
            <div className="xl:col-span-3">
              <LeadStatsChart data={leads.data || []} isLoading={leads.isLoading} />
            </div>
            <div className="xl:col-span-2">
              <LeadSourceChart data={sources.data || []} isLoading={sources.isLoading} />
            </div>
          </div>
        </div>
      )}

      {section === 'activity' && (
        <div className={`${SCROLL_REGION} space-y-2`}>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            <TaskCompletionTrendChart data={tasks.data} isLoading={tasks.isLoading} />
            <TaskBreakdownChart       data={tasks.data} isLoading={tasks.isLoading} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            <MeetingStatusChart data={meetings.data} isLoading={meetings.isLoading} />
            <MeetingTypeChart   data={meetings.data} isLoading={meetings.isLoading} />
          </div>
        </div>
      )}

      {section === 'team' && (
        <div className={SCROLL_REGION}>
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-2">
            <div className="xl:col-span-3">
              <TeamPerformanceTable data={team.data} isLoading={team.isLoading} />
            </div>
            <div className="xl:col-span-2">
              <RecentActivityFeed data={activity.data} isLoading={activity.isLoading} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnalyticsPage
