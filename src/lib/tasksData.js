// ─── Mock Data ────────────────────────────────────────────────────────────────
// Data-access layer. Replace these async functions with Supabase calls and the
// React Query hooks (useTasks.js) require zero changes.
import { TEAM_MEMBER_NAMES as _TASK_MEMBER_NAMES } from './users.js'

let _tasks = [
  {
    id: 'T-001',
    title: 'Send proposal to GreenTech BD',
    description: 'Prepare and send the full ERP proposal including pricing tiers and implementation timeline.',
    status: 'In Progress',
    priority: 'High',
    dueDate: '2026-05-12',
    assignee: 'Taylor Brooks',
    relatedType: 'Lead',
    relatedId: 'L-001',
    relatedLabel: 'Farhan Hossain — GreenTech BD',
    createdAt: '2026-05-01',
    completedAt: null,
    tags: ['Proposal', 'Enterprise'],
  },
  {
    id: 'T-002',
    title: 'Follow-up call with Nova Logistics',
    description: 'Schedule and conduct follow-up call to discuss Q3 demo requirements.',
    status: 'Todo',
    priority: 'Medium',
    dueDate: '2026-05-14',
    assignee: 'Morgan Chen',
    relatedType: 'Contact',
    relatedId: 'C-002',
    relatedLabel: 'Sadia Islam — Nova Logistics',
    createdAt: '2026-05-03',
    completedAt: null,
    tags: ['Call', 'SME'],
  },
  {
    id: 'T-003',
    title: 'Prepare compliance module demo for Prime Pharma',
    description: 'Customise demo environment to showcase compliance tracking features for healthcare vertical.',
    status: 'Todo',
    priority: 'High',
    dueDate: '2026-05-10',
    assignee: 'Jordan Kim',
    relatedType: 'Lead',
    relatedId: 'L-003',
    relatedLabel: 'Tanvir Ahmed — Prime Pharma',
    createdAt: '2026-05-04',
    completedAt: null,
    tags: ['Demo', 'Healthcare'],
  },
  {
    id: 'T-004',
    title: 'Get CFO sign-off on Apex Retail proposal',
    description: 'Coordinate with Maliha to get the CFO approval before end of May.',
    status: 'Overdue',
    priority: 'Urgent',
    dueDate: '2026-05-07',
    assignee: 'Taylor Brooks',
    relatedType: 'Contact',
    relatedId: 'C-004',
    relatedLabel: 'Maliha Chowdhury — Apex Retail',
    createdAt: '2026-04-28',
    completedAt: null,
    tags: ['Approval'],
  },
  {
    id: 'T-005',
    title: 'Negotiate final pricing for Sigma Textiles',
    description: 'Counter the 15% discount request with value-added services instead.',
    status: 'In Progress',
    priority: 'Urgent',
    dueDate: '2026-05-11',
    assignee: 'Morgan Chen',
    relatedType: 'Lead',
    relatedId: 'L-005',
    relatedLabel: 'Rafiq Uddin — Sigma Textiles',
    createdAt: '2026-05-05',
    completedAt: null,
    tags: ['Negotiation', 'Manufacturing'],
  },
  {
    id: 'T-006',
    title: 'Schedule onboarding kickoff for BlueStar Finance',
    description: 'Coordinate onboarding timeline with Nusrat and internal delivery team for June start.',
    status: 'Completed',
    priority: 'High',
    dueDate: '2026-05-02',
    assignee: 'Alex Rivera',
    relatedType: 'Contact',
    relatedId: 'C-006',
    relatedLabel: 'Nusrat Jahan — BlueStar Finance',
    createdAt: '2026-04-25',
    completedAt: '2026-05-02',
    tags: ['Onboarding', 'Finance'],
  },
  {
    id: 'T-007',
    title: 'Document loss reasons for Dhaka Motors',
    description: 'Record why the deal was lost and identify lessons for future automotive sector outreach.',
    status: 'Completed',
    priority: 'Low',
    dueDate: '2026-04-25',
    assignee: 'Taylor Brooks',
    relatedType: 'Lead',
    relatedId: 'L-007',
    relatedLabel: 'Kabir Hasan — Dhaka Motors',
    createdAt: '2026-04-21',
    completedAt: '2026-04-24',
    tags: ['Post-mortem'],
  },
  {
    id: 'T-008',
    title: 'Intro call with EduNet Bangladesh',
    description: 'First contact call to understand requirements around student management and billing modules.',
    status: 'Todo',
    priority: 'Low',
    dueDate: '2026-05-16',
    assignee: 'Jordan Kim',
    relatedType: 'Lead',
    relatedId: 'L-008',
    relatedLabel: 'Sharmin Akter — EduNet Bangladesh',
    createdAt: '2026-05-06',
    completedAt: null,
    tags: ['Education', 'Intro'],
  },
  {
    id: 'T-009',
    title: 'Send product brochure to Harbor Shipping',
    description: 'Share logistics module brochure and case studies ahead of next week\'s call.',
    status: 'In Progress',
    priority: 'Medium',
    dueDate: '2026-05-13',
    assignee: 'Morgan Chen',
    relatedType: 'Contact',
    relatedId: 'C-009',
    relatedLabel: 'Imran Karim — Harbor Shipping',
    createdAt: '2026-05-07',
    completedAt: null,
    tags: ['Materials', 'Logistics'],
  },
  {
    id: 'T-010',
    title: 'Technical requirements review — National Ceramics',
    description: 'Deep dive on inventory and procurement integration spec with Parveen\'s IT team.',
    status: 'Todo',
    priority: 'Medium',
    dueDate: '2026-05-15',
    assignee: 'Alex Rivera',
    relatedType: 'Lead',
    relatedId: 'L-010',
    relatedLabel: 'Parveen Sultana — National Ceramics',
    createdAt: '2026-05-06',
    completedAt: null,
    tags: ['Technical', 'Manufacturing'],
  },
  {
    id: 'T-011',
    title: 'Monthly sync with Pinnacle Insurance',
    description: 'Regular partner alignment call — discuss referral pipeline and commission structure.',
    status: 'Overdue',
    priority: 'Medium',
    dueDate: '2026-05-05',
    assignee: 'Alex Rivera',
    relatedType: 'Contact',
    relatedId: 'C-011',
    relatedLabel: 'Alamgir Hossain — Pinnacle Insurance',
    createdAt: '2026-04-28',
    completedAt: null,
    tags: ['Partner', 'Sync'],
  },
  {
    id: 'T-012',
    title: 'Qualify Sunrise Agro inquiry',
    description: 'Review inbound website inquiry and schedule discovery call to determine fit.',
    status: 'Todo',
    priority: 'Low',
    dueDate: '2026-05-20',
    assignee: 'Jordan Kim',
    relatedType: 'Contact',
    relatedId: 'C-012',
    relatedLabel: 'Roksana Begum — Sunrise Agro',
    createdAt: '2026-05-08',
    completedAt: null,
    tags: ['Agriculture', 'Qualification'],
  },
]

let _nextId = 13

// ── Simulate latency ──────────────────────────────────────────────────────────
const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms))

// ── Data-access functions ─────────────────────────────────────────────────────

export async function fetchTasks() {
  await delay()
  return [..._tasks]
}

export async function fetchTaskById(id) {
  await delay(200)
  return _tasks.find((t) => t.id === id) ?? null
}

export async function createTask(data) {
  await delay(450)
  const id = `T-${String(_nextId++).padStart(3, '0')}`
  const task = {
    ...data,
    id,
    createdAt: new Date().toISOString().split('T')[0],
    completedAt: data.status === 'Completed' ? new Date().toISOString().split('T')[0] : null,
    tags: data.tags || [],
    description: data.description || '',
  }
  _tasks = [task, ..._tasks]
  return task
}

export async function updateTask(id, data) {
  await delay(350)
  _tasks = _tasks.map((t) => {
    if (t.id !== id) return t
    const updated = { ...t, ...data }
    // Auto-set completedAt
    if (data.status === 'Completed' && !t.completedAt) {
      updated.completedAt = new Date().toISOString().split('T')[0]
    } else if (data.status && data.status !== 'Completed') {
      updated.completedAt = null
    }
    return updated
  })
  return _tasks.find((t) => t.id === id)
}

export async function deleteTask(id) {
  await delay(300)
  _tasks = _tasks.filter((t) => t.id !== id)
  return { id }
}

// ── Domain constants ──────────────────────────────────────────────────────────

export const TASK_STATUSES   = ['Todo', 'In Progress', 'Completed', 'Overdue']
export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']
// Derived from the central team registry in lib/users.js
export const TASK_ASSIGNEES  = _TASK_MEMBER_NAMES
export const RELATED_TYPES   = ['Lead', 'Contact', 'Meeting', 'None']

export const STATUS_CONFIG = {
  'Todo':        { label: 'Todo',        color: 'bg-gray-100 text-gray-600',      dot: 'bg-gray-400',     icon: '○' },
  'In Progress': { label: 'In Progress', color: 'bg-blue-50 text-blue-700',       dot: 'bg-blue-500',     icon: '◑' },
  'Completed':   { label: 'Completed',   color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500',  icon: '●' },
  'Overdue':     { label: 'Overdue',     color: 'bg-red-50 text-red-600',         dot: 'bg-red-500',      icon: '!' },
}

export const PRIORITY_CONFIG = {
  'Low':    { label: 'Low',    color: 'bg-gray-100 text-gray-500',    bar: 'bg-gray-300'    },
  'Medium': { label: 'Medium', color: 'bg-amber-50 text-amber-700',   bar: 'bg-amber-400'   },
  'High':   { label: 'High',   color: 'bg-orange-50 text-orange-700', bar: 'bg-orange-500'  },
  'Urgent': { label: 'Urgent', color: 'bg-red-50 text-red-700',       bar: 'bg-red-500'     },
}

// Helper: is a task overdue (dueDate passed, not completed)?
export function isTaskOverdue(task) {
  if (task.status === 'Completed') return false
  if (!task.dueDate) return false
  return new Date(task.dueDate) < new Date(new Date().toDateString())
}

// Helper: days until due (negative = overdue)
export function daysUntilDue(dueDate) {
  if (!dueDate) return null
  const today = new Date(new Date().toDateString())
  const due   = new Date(dueDate)
  return Math.round((due - today) / 86400000)
}
