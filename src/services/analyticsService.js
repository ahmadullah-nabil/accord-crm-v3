// ─── Analytics Service ────────────────────────────────────────────────────────
//
// Real Supabase aggregation queries that replace the mock data in analyticsData.js.
// Called exclusively by analyticsData.js — no component imports this directly.
//
// Design principles
// ─────────────────
// • Every function returns the EXACT same shape as the mock it replaces —
//   the hook and component layers require zero changes.
// • Queries are scoped by `created_at` >= dateFrom using the range param.
// • On any Supabase error the function logs the error and returns the same
//   shape with zeroes/empty arrays so the UI never crashes on empty DB.
// • Computation happens in-memory from raw rows — no Postgres RPC/aggregate
//   functions needed, avoiding permission issues with non-admin roles.
//
// Range → dateFrom mapping
// ──────────────────────────────────────────────────────────
//  '7d'  → 7 days ago    '30d' → 30 days ago
//  '90d' → 90 days ago   '1y'  → 365 days ago

import { supabase } from '../lib/supabaseClient.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function rangeToDate(range) {
  const d = new Date()
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

// Group an array by a key-function, applying a value-function to each element
function groupBy(arr, keyFn, valFn = (x) => x) {
  return arr.reduce((acc, item) => {
    const k = keyFn(item)
    if (!acc[k]) acc[k] = []
    acc[k].push(valFn(item))
    return acc
  }, {})
}

// Summarise counts per group
function countBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const k = keyFn(item)
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})
}

// ── KPI Summary ───────────────────────────────────────────────────────────────

export async function getKpiSummary(range) {
  const dateFrom = rangeToDate(range)
  const zeros = () => ({ value: 0, trend: 0 })

  try {
    const [oppsRes, leadsRes, tasksRes, meetingsRes] = await Promise.all([
      supabase.from('opportunities').select('stage, value, created_at').gte('created_at', dateFrom),
      supabase.from('leads').select('stage, value, created_at').gte('created_at', dateFrom),
      supabase.from('tasks').select('status, created_at').gte('created_at', dateFrom),
      supabase.from('meetings').select('status, created_at').gte('created_at', dateFrom),
    ])

    const opps     = oppsRes.data     ?? []
    const leads    = leadsRes.data    ?? []
    const tasks    = tasksRes.data    ?? []
    const meetings = meetingsRes.data ?? []

    const wonOpps      = opps.filter((o) => o.stage === 'Won')
    const activeLeads  = leads.filter((l) => !['Won','Lost'].includes(l.stage))
    const pipelineOpps = opps.filter((o) => !['Won','Lost'].includes(o.stage))
    const totalRevenue = wonOpps.reduce((s, o) => s + Number(o.value || 0), 0)
    const pipelineVal  = pipelineOpps.reduce((s, o) => s + Number(o.value || 0), 0)
    const allDeals     = opps.length
    const convRate     = allDeals > 0 ? (wonOpps.length / allDeals) * 100 : 0
    const completedT   = tasks.filter((t) => t.status === 'Completed').length
    const taskRate     = tasks.length > 0 ? (completedT / tasks.length) * 100 : 0
    const completedM   = meetings.filter((m) => m.status === 'Completed').length
    const avgDeal      = wonOpps.length > 0
      ? Math.round(totalRevenue / wonOpps.length)
      : 0

    return {
      totalRevenue:       { value: totalRevenue,             trend: 0, label: 'Total Revenue',     suffix: '' },
      activeLeads:        { value: activeLeads.length,       trend: 0, label: 'Active Leads',      suffix: '' },
      conversionRate:     { value: parseFloat(convRate.toFixed(1)), trend: 0, label: 'Conversion Rate', suffix: '%' },
      dealsWon:           { value: wonOpps.length,           trend: 0, label: 'Deals Won',          suffix: '' },
      taskCompletionRate: { value: parseFloat(taskRate.toFixed(1)),  trend: 0, label: 'Task Completion', suffix: '%' },
      meetingsConducted:  { value: completedM,               trend: 0, label: 'Meetings Conducted', suffix: '' },
      avgDealSize:        { value: avgDeal,                  trend: 0, label: 'Avg Deal Size',      suffix: '' },
      pipelineValue:      { value: pipelineVal,              trend: 0, label: 'Pipeline Value',     suffix: '' },
    }
  } catch (err) {
    console.error('[analyticsService] getKpiSummary:', err.message)
    return {
      totalRevenue: zeros(), activeLeads: zeros(), conversionRate: zeros(),
      dealsWon: zeros(), taskCompletionRate: zeros(), meetingsConducted: zeros(),
      avgDealSize: zeros(), pipelineValue: zeros(),
    }
  }
}

// ── Revenue Time Series ───────────────────────────────────────────────────────
// Buckets won opportunities by their close period to build the revenue trend.

export async function getRevenueTimeSeries(range) {
  const dateFrom = rangeToDate(range)

  try {
    const { data, error } = await supabase
      .from('opportunities')
      .select('value, last_activity, created_at, stage')
      .gte('created_at', dateFrom)
      .eq('stage', 'Won')

    if (error) throw error
    const rows = data ?? []

    // Build buckets based on range
    const buckets = buildTimeBuckets(range)
    rows.forEach((o) => {
      const dateStr = o.last_activity || o.created_at
      if (!dateStr) return
      const bucketLabel = dateToBucket(dateStr, range)
      const b = buckets.find((bk) => bk.label === bucketLabel)
      if (b) {
        b.revenue += Number(o.value || 0)
        b.deals   += 1
      }
    })

    return buckets.map((b) => ({
      label:   b.label,
      revenue: b.revenue,
      target:  b.target,
      deals:   b.deals,
    }))
  } catch (err) {
    console.error('[analyticsService] getRevenueTimeSeries:', err.message)
    return []
  }
}

function buildTimeBuckets(range) {
  const today = new Date()
  if (range === '7d') {
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    return days.map((label, i) => ({
      label, revenue: 0, deals: 0, target: 7500,
      date: (() => { const d = new Date(today); d.setDate(d.getDate() - (6 - i)); return d })(),
    }))
  }
  if (range === '30d') {
    return ['W1','W2','W3','W4'].map((label, i) => ({
      label, revenue: 0, deals: 0, target: 30000,
      weekOffset: i,
    }))
  }
  if (range === '90d') {
    const months = []
    for (let i = 2; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      months.push({
        label: d.toLocaleString('en', { month: 'short' }),
        month: d.getMonth(),
        year: d.getFullYear(),
        revenue: 0, deals: 0, target: 40000,
      })
    }
    return months
  }
  // 1y — monthly
  const months = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    months.push({
      label: d.toLocaleString('en', { month: 'short' }),
      month: d.getMonth(),
      year: d.getFullYear(),
      revenue: 0, deals: 0, target: 50000,
    })
  }
  return months
}

function dateToBucket(dateStr, range) {
  const d = new Date(dateStr)
  if (range === '7d') {
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]
  }
  if (range === '30d') {
    const day = d.getDate()
    if (day <= 7)  return 'W1'
    if (day <= 14) return 'W2'
    if (day <= 21) return 'W3'
    return 'W4'
  }
  // 90d and 1y — use month short name
  return d.toLocaleString('en', { month: 'short' })
}

// ── Lead Funnel ───────────────────────────────────────────────────────────────

export async function getLeadFunnel(range) {
  const dateFrom = rangeToDate(range)
  const STAGE_COLORS = {
    New: '#3b82f6', Contacted: '#8b5cf6', Qualified: '#14b8a6',
    Proposal: '#f59e0b', Negotiation: '#f97316', Won: '#10b981', Lost: '#f87171',
  }
  const stages = Object.keys(STAGE_COLORS)

  try {
    const { data, error } = await supabase
      .from('leads')
      .select('stage, created_at')
      .gte('created_at', dateFrom)
    if (error) throw error

    const counts = countBy(data ?? [], (r) => r.stage)
    return stages.map((stage) => ({
      stage,
      count: counts[stage] ?? 0,
      color: STAGE_COLORS[stage],
    }))
  } catch (err) {
    console.error('[analyticsService] getLeadFunnel:', err.message)
    return stages.map((stage) => ({ stage, count: 0, color: STAGE_COLORS[stage] }))
  }
}

// ── Lead Source Breakdown ─────────────────────────────────────────────────────

export async function getLeadsBySource(range) {
  const dateFrom = rangeToDate(range)
  const SOURCE_COLORS = {
    Referral: '#14b8a6', Website: '#6366f1', LinkedIn: '#0ea5e9',
    'Cold Call': '#f59e0b', Partner: '#8b5cf6', 'Trade Show': '#f97316',
  }

  try {
    const { data, error } = await supabase
      .from('leads')
      .select('source, created_at')
      .gte('created_at', dateFrom)
    if (error) throw error

    const counts = countBy(data ?? [], (r) => r.source || 'Other')
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: SOURCE_COLORS[name] ?? '#94a3b8',
    })).sort((a, b) => b.value - a.value)
  } catch (err) {
    console.error('[analyticsService] getLeadsBySource:', err.message)
    return []
  }
}

// ── Lead Stats Monthly ────────────────────────────────────────────────────────

export async function getLeadStats(range) {
  const dateFrom = rangeToDate(range)

  try {
    const { data, error } = await supabase
      .from('leads')
      .select('stage, created_at')
      .gte('created_at', dateFrom)
    if (error) throw error

    const rows = data ?? []
    const buckets = buildTimeBuckets(range)
    rows.forEach((r) => {
      const label = dateToBucket(r.created_at, range)
      const b = buckets.find((bk) => bk.label === label)
      if (!b) return
      b.new  = (b.new  || 0) + 1
      if (r.stage === 'Won')  b.won  = (b.won  || 0) + 1
      if (r.stage === 'Lost') b.lost = (b.lost || 0) + 1
    })
    return buckets.map((b) => ({ label: b.label, new: b.new || 0, won: b.won || 0, lost: b.lost || 0 }))
  } catch (err) {
    console.error('[analyticsService] getLeadStats:', err.message)
    return []
  }
}

// ── Task Statistics ───────────────────────────────────────────────────────────

export async function getTaskStats(range) {
  const dateFrom = rangeToDate(range)

  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('status, priority, created_at')
      .gte('created_at', dateFrom)
    if (error) throw error

    const rows = data ?? []
    const statusCounts    = countBy(rows, (r) => r.status)
    const priorityCounts  = countBy(rows, (r) => r.priority)
    const total           = rows.length
    const completed       = statusCounts['Completed'] || 0
    const overdue         = statusCounts['Overdue']   || 0
    const completionRate  = total > 0 ? parseFloat(((completed / total) * 100).toFixed(1)) : 0

    // Weekly completion trend over last 8 weeks
    const now = new Date()
    const completionTrend = Array.from({ length: 8 }, (_, i) => {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - (7 - i) * 7)
      const weekEnd   = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      const inWeek  = rows.filter((r) => {
        const d = new Date(r.created_at)
        return d >= weekStart && d < weekEnd
      })
      return {
        label:     `W${i + 1}`,
        total:     inWeek.length,
        completed: inWeek.filter((r) => r.status === 'Completed').length,
      }
    })

    return {
      byStatus: [
        { name: 'Completed',   value: statusCounts['Completed']   || 0, color: '#10b981' },
        { name: 'In Progress', value: statusCounts['In Progress'] || 0, color: '#3b82f6' },
        { name: 'Todo',        value: statusCounts['Todo']        || 0, color: '#94a3b8' },
        { name: 'Overdue',     value: overdue,                         color: '#f87171' },
      ],
      byPriority: [
        { name: 'Urgent', value: priorityCounts['Urgent'] || 0, color: '#ef4444' },
        { name: 'High',   value: priorityCounts['High']   || 0, color: '#f97316' },
        { name: 'Medium', value: priorityCounts['Medium'] || 0, color: '#f59e0b' },
        { name: 'Low',    value: priorityCounts['Low']    || 0, color: '#94a3b8' },
      ],
      completionTrend,
      totalTasks: total,
      completionRate,
      overdueCount: overdue,
    }
  } catch (err) {
    console.error('[analyticsService] getTaskStats:', err.message)
    return {
      byStatus: [], byPriority: [], completionTrend: [],
      totalTasks: 0, completionRate: 0, overdueCount: 0,
    }
  }
}

// ── Meeting Statistics ────────────────────────────────────────────────────────

export async function getMeetingStats(range) {
  const dateFrom = rangeToDate(range)

  try {
    const { data, error } = await supabase
      .from('meetings')
      .select('status, type, duration_mins, created_at')
      .gte('created_at', dateFrom)
    if (error) throw error

    const rows    = data ?? []
    const statusC = countBy(rows, (r) => r.status)
    const typeC   = countBy(rows, (r) => r.type)
    const total   = rows.length
    const completed = statusC['Completed'] || 0
    const avgDur  = rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + Number(r.duration_mins || 60), 0) / rows.length)
      : 0

    const TYPE_COLORS = [
      '#14b8a6','#6366f1','#f97316','#8b5cf6','#10b981','#0ea5e9','#ec4899','#94a3b8',
    ]

    return {
      byStatus: [
        { name: 'Completed',   value: statusC['Completed']   || 0, color: '#10b981' },
        { name: 'Scheduled',   value: statusC['Scheduled']   || 0, color: '#3b82f6' },
        { name: 'Rescheduled', value: statusC['Rescheduled'] || 0, color: '#f59e0b' },
        { name: 'Cancelled',   value: statusC['Cancelled']   || 0, color: '#f87171' },
      ],
      byType: Object.entries(typeC).map(([label, count], i) => ({
        label, count, color: TYPE_COLORS[i % TYPE_COLORS.length],
      })),
      totalMeetings: total,
      completionRate: total > 0 ? parseFloat(((completed / total) * 100).toFixed(1)) : 0,
      avgDurationMins: avgDur,
    }
  } catch (err) {
    console.error('[analyticsService] getMeetingStats:', err.message)
    return { byStatus: [], byType: [], totalMeetings: 0, completionRate: 0, avgDurationMins: 0 }
  }
}

// ── Team Performance ──────────────────────────────────────────────────────────
// Aggregates across leads, opportunities, tasks, and meetings by assignee name.

export async function getTeamPerformance(range) {
  const dateFrom = rangeToDate(range)

  try {
    // Fetch real profile names first so we can filter performers to only
    // people who exist in public.profiles. This eliminates any orphaned
    // demo-name rows (e.g. "Alex Rivera") that were inserted into
    // opportunities/tasks/meetings before real auth users were set up.
    const { data: profiles } = await supabase
      .from('profiles')
      .select('name, role')
      .eq('is_active', true)

    // Build a Set of real display names for fast lookup.
    // If the profiles query fails or returns nothing, fall back to showing
    // all unique assignee names so the widget still works on a fresh DB.
    const realNames = profiles && profiles.length > 0
      ? new Set(profiles.map((p) => p.name).filter(Boolean))
      : null   // null = no filtering (fresh DB, no profiles yet)

    const roleByName = profiles
      ? Object.fromEntries(profiles.map((p) => [p.name, p.role]))
      : {}

    const [oppsRes, tasksRes, meetingsRes] = await Promise.all([
      supabase.from('opportunities').select('assignee, value, stage, created_at').gte('created_at', dateFrom),
      supabase.from('tasks').select('assignee, status, created_at').gte('created_at', dateFrom),
      supabase.from('meetings').select('organizer, status, created_at').gte('created_at', dateFrom),
    ])

    const opps     = oppsRes.data     ?? []
    const tasks    = tasksRes.data    ?? []
    const meetings = meetingsRes.data ?? []

    // Collect unique assignee names from DB records,
    // then filter to only real profile names (removes orphaned demo rows).
    const allNames = new Set([
      ...opps.map((o) => o.assignee),
      ...tasks.map((t) => t.assignee),
      ...meetings.map((m) => m.organizer),
    ].filter(Boolean))

    const filteredNames = realNames
      ? Array.from(allNames).filter((n) => realNames.has(n))
      : Array.from(allNames)

    if (filteredNames.length === 0) return []

    return filteredNames.map((name) => {
      const myOpps     = opps.filter((o) => o.assignee === name)
      const myWon      = myOpps.filter((o) => o.stage === 'Won')
      const myTasks    = tasks.filter((t) => t.assignee === name)
      const myMeetings = meetings.filter((m) => m.organizer === name)
      const revenue    = myWon.reduce((s, o) => s + Number(o.value || 0), 0)
      const deals      = myWon.length
      const quota      = myOpps.length > 0 ? Math.round((myWon.length / myOpps.length) * 100) : 0

      return {
        name,
        role:     roleByName[name] ?? '',
        deals,
        revenue,
        meetings: myMeetings.length,
        tasks:    myTasks.length,
        quota,
      }
    }).sort((a, b) => b.revenue - a.revenue)
  } catch (err) {
    console.error('[analyticsService] getTeamPerformance:', err.message)
    return []
  }
}

// ── Recent Activity ───────────────────────────────────────────────────────────
// Reads from the activities table (already populated by the activity system).

export async function getRecentActivity(range) {
  const dateFrom = rangeToDate(range)

  try {
    const { data, error } = await supabase
      .from('activities')
      .select('id, type, actor, action, subject, detail, occurred_at')
      .gte('occurred_at', `${dateFrom}T00:00:00`)
      .order('occurred_at', { ascending: false })
      .limit(15)

    if (error) throw error
    const rows = data ?? []

    const TYPE_MAP = {
      lead_created:       'lead_new',
      lead_stage_changed: 'lead_moved',
      meeting_scheduled:  'meeting',
      meeting_completed:  'meeting',
      task_created:       'task_done',
      task_completed:     'task_done',
    }

    return rows.map((r) => ({
      id:      r.id,
      type:    TYPE_MAP[r.type] ?? r.type,
      user:    r.actor   ?? '',
      action:  r.action  ?? '',
      subject: r.subject ?? '',
      detail:  r.detail  ?? '',
      time:    relativeTime(r.occurred_at),
    }))
  } catch (err) {
    console.error('[analyticsService] getRecentActivity:', err.message)
    return []
  }
}

function relativeTime(iso) {
  if (!iso) return ''
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60)        return 'just now'
  if (diff < 3600)      return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400)     return `${Math.floor(diff / 3600)} hr ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} day ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
