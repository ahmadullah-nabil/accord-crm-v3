// ─── Mock Data ────────────────────────────────────────────────────────────────
// Data-access layer. Replace these async functions with Supabase calls;
// useMeetings.js hooks require zero changes because they call only these functions.
import { TEAM_MEMBER_NAMES as _MTG_MEMBER_NAMES } from './users.js'

let _meetings = [
  {
    id: 'M-001',
    title: 'ERP Demo — GreenTech BD',
    description: 'Full product walkthrough of the ERP suite with key stakeholders. Cover finance, HR, and procurement modules.',
    status: 'Scheduled',
    type: 'Demo',
    scheduledDate: '2026-05-13',
    scheduledTime: '10:00',
    durationMins: 90,
    location: 'Google Meet',
    locationUrl: 'https://meet.google.com/abc-defg-hij',
    organizer: 'Taylor Brooks',
    participants: ['Farhan Hossain', 'Tanvir Ahmed', 'Jordan Kim'],
    relatedType: 'Lead',
    relatedId: 'L-001',
    relatedLabel: 'Farhan Hossain — GreenTech BD',
    notes: 'Prepare custom demo environment. Client wants to see payroll integration specifically.',
    createdAt: '2026-05-05',
    tags: ['Enterprise', 'Demo', 'Q2'],
  },
  {
    id: 'M-002',
    title: 'Discovery Call — Nova Logistics',
    description: 'Initial discovery session to understand logistics module requirements.',
    status: 'Completed',
    type: 'Discovery',
    scheduledDate: '2026-05-06',
    scheduledTime: '14:30',
    durationMins: 45,
    location: 'Zoom',
    locationUrl: 'https://zoom.us/j/123456789',
    organizer: 'Morgan Chen',
    participants: ['Sadia Islam', 'Morgan Chen'],
    relatedType: 'Contact',
    relatedId: 'C-002',
    relatedLabel: 'Sadia Islam — Nova Logistics',
    notes: 'Client confirmed Q3 budget approval. Needs deep dive on route optimisation and shipment tracking.',
    createdAt: '2026-05-01',
    tags: ['Discovery', 'SME'],
  },
  {
    id: 'M-003',
    title: 'Compliance Module Review — Prime Pharma',
    description: 'Technical review session with Prime Pharma IT team on compliance tracking requirements.',
    status: 'Scheduled',
    type: 'Technical Review',
    scheduledDate: '2026-05-15',
    scheduledTime: '11:00',
    durationMins: 60,
    location: 'Microsoft Teams',
    locationUrl: '',
    organizer: 'Jordan Kim',
    participants: ['Tanvir Ahmed', 'Jordan Kim', 'Alex Rivera'],
    relatedType: 'Lead',
    relatedId: 'L-003',
    relatedLabel: 'Tanvir Ahmed — Prime Pharma',
    notes: 'IT team will be present. Prepare technical architecture diagram for compliance module.',
    createdAt: '2026-05-07',
    tags: ['Technical', 'Healthcare', 'Enterprise'],
  },
  {
    id: 'M-004',
    title: 'Pricing Negotiation — Apex Retail',
    description: 'Final pricing discussion with CFO to close the deal before end of month.',
    status: 'Rescheduled',
    type: 'Negotiation',
    scheduledDate: '2026-05-14',
    scheduledTime: '15:00',
    durationMins: 60,
    location: 'On-site — Apex Retail HQ, Sylhet',
    locationUrl: '',
    organizer: 'Taylor Brooks',
    participants: ['Maliha Chowdhury', 'Taylor Brooks'],
    relatedType: 'Lead',
    relatedId: 'L-004',
    relatedLabel: 'Maliha Chowdhury — Apex Retail',
    notes: 'Originally scheduled for May 9. Client requested reschedule due to CFO travel. Confirm agenda before attending.',
    createdAt: '2026-04-30',
    tags: ['Negotiation', 'Retail', 'Q2'],
  },
  {
    id: 'M-005',
    title: 'Discount Counteroffer — Sigma Textiles',
    description: 'Address Rafiq\'s 15% discount request with a value-added services counter-proposal.',
    status: 'Scheduled',
    type: 'Negotiation',
    scheduledDate: '2026-05-12',
    scheduledTime: '09:30',
    durationMins: 45,
    location: 'Google Meet',
    locationUrl: 'https://meet.google.com/klm-nopq-rst',
    organizer: 'Morgan Chen',
    participants: ['Rafiq Uddin', 'Morgan Chen', 'Alex Rivera'],
    relatedType: 'Lead',
    relatedId: 'L-005',
    relatedLabel: 'Rafiq Uddin — Sigma Textiles',
    notes: 'Prepare value-add package: free onboarding, extended support, training sessions.',
    createdAt: '2026-05-08',
    tags: ['Negotiation', 'Manufacturing'],
  },
  {
    id: 'M-006',
    title: 'Onboarding Kickoff — BlueStar Finance',
    description: 'Project kickoff meeting to align on implementation timeline, team assignments, and deliverables.',
    status: 'Completed',
    type: 'Kickoff',
    scheduledDate: '2026-05-02',
    scheduledTime: '10:00',
    durationMins: 120,
    location: 'On-site — BlueStar HQ, Dhaka',
    locationUrl: '',
    organizer: 'Alex Rivera',
    participants: ['Nusrat Jahan', 'Alex Rivera', 'Morgan Chen', 'Jordan Kim'],
    relatedType: 'Contact',
    relatedId: 'C-006',
    relatedLabel: 'Nusrat Jahan — BlueStar Finance',
    notes: 'Kickoff successful. Go-live target set for June 30. Weekly progress calls on Fridays.',
    createdAt: '2026-04-25',
    tags: ['Kickoff', 'Finance', 'Enterprise'],
  },
  {
    id: 'M-007',
    title: 'Intro Call — EduNet Bangladesh',
    description: 'First meeting with EduNet co-founders to understand student management and billing needs.',
    status: 'Scheduled',
    type: 'Discovery',
    scheduledDate: '2026-05-17',
    scheduledTime: '16:00',
    durationMins: 30,
    location: 'Zoom',
    locationUrl: 'https://zoom.us/j/987654321',
    organizer: 'Jordan Kim',
    participants: ['Sharmin Akter', 'Jordan Kim'],
    relatedType: 'Lead',
    relatedId: 'L-008',
    relatedLabel: 'Sharmin Akter — EduNet Bangladesh',
    notes: 'Startup — be mindful of budget constraints. Explore SaaS pricing tiers.',
    createdAt: '2026-05-08',
    tags: ['Education', 'Startup', 'Discovery'],
  },
  {
    id: 'M-008',
    title: 'Logistics Module Walkthrough — Harbor Shipping',
    description: 'Product demo focused on route optimisation, shipment tracking, and customs documentation.',
    status: 'Scheduled',
    type: 'Demo',
    scheduledDate: '2026-05-16',
    scheduledTime: '13:00',
    durationMins: 60,
    location: 'Google Meet',
    locationUrl: 'https://meet.google.com/uvw-xyz-abc',
    organizer: 'Morgan Chen',
    participants: ['Imran Karim', 'Morgan Chen'],
    relatedType: 'Contact',
    relatedId: 'C-009',
    relatedLabel: 'Imran Karim — Harbor Shipping',
    notes: 'Send agenda 48 hours in advance. Imran wants to see real-time shipment tracking.',
    createdAt: '2026-05-07',
    tags: ['Demo', 'Logistics'],
  },
  {
    id: 'M-009',
    title: 'Partner Sync — Pinnacle Insurance',
    description: 'Monthly alignment call with Pinnacle referral partner to review pipeline and commissions.',
    status: 'Cancelled',
    type: 'Partner Sync',
    scheduledDate: '2026-05-05',
    scheduledTime: '11:00',
    durationMins: 30,
    location: 'Microsoft Teams',
    locationUrl: '',
    organizer: 'Alex Rivera',
    participants: ['Alamgir Hossain', 'Alex Rivera'],
    relatedType: 'Contact',
    relatedId: 'C-011',
    relatedLabel: 'Alamgir Hossain — Pinnacle Insurance',
    notes: 'Cancelled by client due to internal board meeting. Reschedule for first week of June.',
    createdAt: '2026-04-28',
    tags: ['Partner', 'Finance'],
  },
  {
    id: 'M-010',
    title: 'Technical Requirements — National Ceramics',
    description: 'Deep-dive technical session on inventory and procurement integration architecture.',
    status: 'Scheduled',
    type: 'Technical Review',
    scheduledDate: '2026-05-20',
    scheduledTime: '10:30',
    durationMins: 90,
    location: 'On-site — National Ceramics, Rajshahi',
    locationUrl: '',
    organizer: 'Alex Rivera',
    participants: ['Parveen Sultana', 'Alex Rivera', 'Jordan Kim'],
    relatedType: 'Lead',
    relatedId: 'L-010',
    relatedLabel: 'Parveen Sultana — National Ceramics',
    notes: 'On-site visit. Coordinate travel arrangements. Bring technical spec documents.',
    createdAt: '2026-05-06',
    tags: ['Technical', 'Manufacturing'],
  },
  {
    id: 'M-011',
    title: 'Qualification Call — Sunrise Agro',
    description: 'Initial qualification call to assess fit and understand agro-business management needs.',
    status: 'Scheduled',
    type: 'Discovery',
    scheduledDate: '2026-05-21',
    scheduledTime: '14:00',
    durationMins: 30,
    location: 'Zoom',
    locationUrl: 'https://zoom.us/j/112233445',
    organizer: 'Jordan Kim',
    participants: ['Roksana Begum', 'Jordan Kim'],
    relatedType: 'Contact',
    relatedId: 'C-012',
    relatedLabel: 'Roksana Begum — Sunrise Agro',
    notes: 'Inbound lead from website. Explore ERP needs for agricultural supply chain.',
    createdAt: '2026-05-08',
    tags: ['Agriculture', 'Discovery'],
  },
  {
    id: 'M-012',
    title: 'Proposal Presentation — GreenTech BD',
    description: 'Formal proposal walkthrough with full leadership team post-demo.',
    status: 'Rescheduled',
    type: 'Proposal',
    scheduledDate: '2026-05-19',
    scheduledTime: '10:00',
    durationMins: 60,
    location: 'On-site — GreenTech HQ, Dhaka',
    locationUrl: '',
    organizer: 'Taylor Brooks',
    participants: ['Farhan Hossain', 'Taylor Brooks', 'Alex Rivera'],
    relatedType: 'Lead',
    relatedId: 'L-001',
    relatedLabel: 'Farhan Hossain — GreenTech BD',
    notes: 'Rescheduled from May 16. Full board will attend. Prepare executive summary slides.',
    createdAt: '2026-05-08',
    tags: ['Proposal', 'Enterprise', 'Q2'],
  },
]

let _nextId = 13

// ── Simulate latency ──────────────────────────────────────────────────────────
const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms))

// ── Data-access functions ─────────────────────────────────────────────────────

export async function fetchMeetings() {
  await delay()
  return [..._meetings]
}

export async function fetchMeetingById(id) {
  await delay(200)
  return _meetings.find((m) => m.id === id) ?? null
}

export async function createMeeting(data) {
  await delay(450)
  const id = `M-${String(_nextId++).padStart(3, '0')}`
  const meeting = {
    ...data,
    id,
    createdAt: new Date().toISOString().split('T')[0],
    tags: data.tags || [],
    description: data.description || '',
    notes: data.notes || '',
    participants: data.participants || [],
    locationUrl: data.locationUrl || '',
  }
  _meetings = [meeting, ..._meetings]
  return meeting
}

export async function updateMeeting(id, data) {
  await delay(350)
  _meetings = _meetings.map((m) =>
    m.id === id ? { ...m, ...data } : m
  )
  return _meetings.find((m) => m.id === id)
}

export async function deleteMeeting(id) {
  await delay(300)
  _meetings = _meetings.filter((m) => m.id !== id)
  return { id }
}

// ── Domain constants ──────────────────────────────────────────────────────────

export const MEETING_STATUSES  = ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled']
export const MEETING_TYPES     = ['Demo', 'Discovery', 'Negotiation', 'Technical Review', 'Kickoff', 'Proposal', 'Partner Sync', 'Follow-up']
// Derived from the central team registry in lib/users.js
export const MEETING_ORGANIZERS = _MTG_MEMBER_NAMES
export const RELATED_TYPES     = ['Lead', 'Contact', 'None']
export const LOCATION_TYPES    = ['Google Meet', 'Zoom', 'Microsoft Teams', 'On-site', 'Phone Call', 'Other']
export const DURATION_OPTIONS  = [15, 30, 45, 60, 90, 120]

export const STATUS_CONFIG = {
  'Scheduled':   { label: 'Scheduled',   color: 'bg-blue-50 text-blue-700',       dot: 'bg-blue-500'     },
  'Completed':   { label: 'Completed',   color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500'  },
  'Cancelled':   { label: 'Cancelled',   color: 'bg-red-50 text-red-600',         dot: 'bg-red-500'      },
  'Rescheduled': { label: 'Rescheduled', color: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-500'    },
}

export const TYPE_CONFIG = {
  'Demo':            { color: 'bg-teal-50 text-teal-700'     },
  'Discovery':       { color: 'bg-blue-50 text-blue-700'     },
  'Negotiation':     { color: 'bg-orange-50 text-orange-700' },
  'Technical Review':{ color: 'bg-purple-50 text-purple-700' },
  'Kickoff':         { color: 'bg-emerald-50 text-emerald-700'},
  'Proposal':        { color: 'bg-indigo-50 text-indigo-700' },
  'Partner Sync':    { color: 'bg-pink-50 text-pink-700'     },
  'Follow-up':       { color: 'bg-gray-100 text-gray-600'    },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format a scheduledDate + scheduledTime into a readable string */
export function formatMeetingDateTime(date, time) {
  if (!date) return '—'
  const d = new Date(`${date}T${time || '00:00'}`)
  return d.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: '2-digit',
  }) + (time ? ` · ${time}` : '')
}

/** Days from today to meeting date (negative = past) */
export function daysFromToday(date) {
  if (!date) return null
  const today = new Date(new Date().toDateString())
  const d     = new Date(date)
  return Math.round((d - today) / 86400000)
}
