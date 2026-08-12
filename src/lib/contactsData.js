// ─── Mock Data ────────────────────────────────────────────────────────────────
// This file acts as the data-access layer. When Supabase is wired up, replace
// the fetch functions below — the React Query hooks in useContacts.js need
// no changes because they call these functions, not the store directly.

let _contacts = [
  {
    id: 'C-001', name: 'Farhan Hossain', company: 'GreenTech BD',
    designation: 'Chief Executive Officer', email: 'farhan@greentech.bd',
    phone: '+880 1711-234567', type: 'Client', status: 'Active',
    assignee: 'Taylor Brooks', linkedLeadId: 'L-001',
    address: 'Dhaka, Bangladesh', website: 'greentech.bd',
    createdAt: '2026-01-15', lastActivity: '2026-05-05',
    tags: ['Enterprise', 'VIP'], notes: 'Key decision maker. Prefers morning calls.',
    avatar: null,
  },
  {
    id: 'C-002', name: 'Sadia Islam', company: 'Nova Logistics',
    designation: 'Head of Procurement', email: 'sadia@novalogistics.com',
    phone: '+880 1812-345678', type: 'Prospect', status: 'Active',
    assignee: 'Morgan Chen', linkedLeadId: 'L-002',
    address: 'Chittagong, Bangladesh', website: 'novalogistics.com',
    createdAt: '2026-02-03', lastActivity: '2026-05-06',
    tags: ['SME', 'Q2'], notes: 'Budget approved. Needs detailed proposal.',
    avatar: null,
  },
  {
    id: 'C-003', name: 'Tanvir Ahmed', company: 'Prime Pharma',
    designation: 'VP of Operations', email: 'tanvir@primepharma.bd',
    phone: '+880 1911-456789', type: 'Client', status: 'Active',
    assignee: 'Jordan Kim', linkedLeadId: 'L-003',
    address: 'Dhaka, Bangladesh', website: 'primepharma.bd',
    createdAt: '2025-11-20', lastActivity: '2026-05-07',
    tags: ['Enterprise', 'Healthcare'], notes: 'IT team heavily involved in evaluation.',
    avatar: null,
  },
  {
    id: 'C-004', name: 'Maliha Chowdhury', company: 'Apex Retail',
    designation: 'Chief Financial Officer', email: 'maliha@apexretail.bd',
    phone: '+880 1612-567890', type: 'Prospect', status: 'Active',
    assignee: 'Taylor Brooks', linkedLeadId: 'L-004',
    address: 'Sylhet, Bangladesh', website: 'apexretail.bd',
    createdAt: '2026-03-10', lastActivity: '2026-05-04',
    tags: ['Retail', 'Q2'], notes: 'Decision expected by end of May.',
    avatar: null,
  },
  {
    id: 'C-005', name: 'Rafiq Uddin', company: 'Sigma Textiles',
    designation: 'Managing Director', email: 'rafiq@sigmatex.com',
    phone: '+880 1755-678901', type: 'Client', status: 'Active',
    assignee: 'Morgan Chen', linkedLeadId: 'L-005',
    address: 'Gazipur, Bangladesh', website: 'sigmatex.com',
    createdAt: '2025-09-05', lastActivity: '2026-05-08',
    tags: ['Manufacturing', 'Enterprise'], notes: 'Negotiating final pricing.',
    avatar: null,
  },
  {
    id: 'C-006', name: 'Nusrat Jahan', company: 'BlueStar Finance',
    designation: 'Director of Technology', email: 'nusrat@bluestar.bd',
    phone: '+880 1833-789012', type: 'Client', status: 'Active',
    assignee: 'Alex Rivera', linkedLeadId: 'L-006',
    address: 'Dhaka, Bangladesh', website: 'bluestar.bd',
    createdAt: '2025-07-22', lastActivity: '2026-04-30',
    tags: ['Finance', 'Enterprise', 'VIP'], notes: 'Contract signed. Onboarding in June.',
    avatar: null,
  },
  {
    id: 'C-007', name: 'Kabir Hasan', company: 'Dhaka Motors',
    designation: 'General Manager', email: 'kabir@dhakamotors.com',
    phone: '+880 1944-890123', type: 'Churned', status: 'Inactive',
    assignee: 'Taylor Brooks', linkedLeadId: 'L-007',
    address: 'Dhaka, Bangladesh', website: 'dhakamotors.com',
    createdAt: '2025-12-01', lastActivity: '2026-04-20',
    tags: ['Auto'], notes: 'Went with competitor. Re-engage in Q4.',
    avatar: null,
  },
  {
    id: 'C-008', name: 'Sharmin Akter', company: 'EduNet Bangladesh',
    designation: 'Co-Founder & CTO', email: 'sharmin@edunet.bd',
    phone: '+880 1677-901234', type: 'Prospect', status: 'Active',
    assignee: 'Jordan Kim', linkedLeadId: 'L-008',
    address: 'Dhaka, Bangladesh', website: 'edunet.bd',
    createdAt: '2026-04-28', lastActivity: '2026-05-08',
    tags: ['Education', 'Startup'], notes: 'Early-stage startup. Budget-conscious.',
    avatar: null,
  },
  {
    id: 'C-009', name: 'Imran Karim', company: 'Harbor Shipping',
    designation: 'Supply Chain Director', email: 'imran@harborshipping.com',
    phone: '+880 1722-012345', type: 'Prospect', status: 'Active',
    assignee: 'Morgan Chen', linkedLeadId: 'L-009',
    address: 'Chittagong, Bangladesh', website: 'harborshipping.com',
    createdAt: '2026-04-20', lastActivity: '2026-05-06',
    tags: ['Logistics'], notes: 'Follow-up call scheduled next week.',
    avatar: null,
  },
  {
    id: 'C-010', name: 'Parveen Sultana', company: 'National Ceramics',
    designation: 'Head of IT', email: 'parveen@natcer.bd',
    phone: '+880 1855-123456', type: 'Client', status: 'Active',
    assignee: 'Alex Rivera', linkedLeadId: 'L-010',
    address: 'Rajshahi, Bangladesh', website: 'natcer.bd',
    createdAt: '2026-03-15', lastActivity: '2026-05-05',
    tags: ['Manufacturing', 'Q2'], notes: 'Needs inventory + procurement integration.',
    avatar: null,
  },
  {
    id: 'C-011', name: 'Alamgir Hossain', company: 'Pinnacle Insurance',
    designation: 'Chief Operating Officer', email: 'alamgir@pinnacle.bd',
    phone: '+880 1733-234567', type: 'Partner', status: 'Active',
    assignee: 'Alex Rivera', linkedLeadId: null,
    address: 'Dhaka, Bangladesh', website: 'pinnacle.bd',
    createdAt: '2025-06-10', lastActivity: '2026-05-01',
    tags: ['Finance', 'Partner'], notes: 'Strategic referral partner. Monthly sync.',
    avatar: null,
  },
  {
    id: 'C-012', name: 'Roksana Begum', company: 'Sunrise Agro',
    designation: 'Executive Director', email: 'roksana@sunriseagro.bd',
    phone: '+880 1866-345678', type: 'Prospect', status: 'Active',
    assignee: 'Jordan Kim', linkedLeadId: null,
    address: 'Mymensingh, Bangladesh', website: 'sunriseagro.bd',
    createdAt: '2026-05-02', lastActivity: '2026-05-08',
    tags: ['Agriculture'], notes: 'Inbound inquiry via website. Early stage.',
    avatar: null,
  },
]

let _nextId = 13

// ── Simulate network latency ──────────────────────────────────────────────────
const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms))

// ── Data Access Functions (replace with Supabase calls later) ─────────────────
export async function fetchContacts() {
  await delay()
  return [..._contacts]
}

export async function fetchContactById(id) {
  await delay(200)
  return _contacts.find((c) => c.id === id) ?? null
}

export async function createContact(data) {
  await delay(500)
  const id = `C-${String(_nextId++).padStart(3, '0')}`
  const contact = {
    ...data,
    id,
    createdAt: new Date().toISOString().split('T')[0],
    lastActivity: new Date().toISOString().split('T')[0],
    tags: data.tags || [],
    notes: data.notes || '',
    avatar: data.avatar || null,
  }
  _contacts = [contact, ..._contacts]
  return contact
}

export async function updateContact(id, data) {
  await delay(400)
  _contacts = _contacts.map((c) =>
    c.id === id
      ? { ...c, ...data, lastActivity: new Date().toISOString().split('T')[0] }
      : c
  )
  return _contacts.find((c) => c.id === id)
}

export async function deleteContact(id) {
  await delay(300)
  _contacts = _contacts.filter((c) => c.id !== id)
  return { id }
}

// ── Domain Constants ──────────────────────────────────────────────────────────
export const CONTACT_TYPES    = ['Client', 'Prospect', 'Partner', 'Churned']
export const CONTACT_STATUSES = ['Active', 'Inactive']
export const CONTACT_ASSIGNEES = ['Alex Rivera', 'Jordan Kim', 'Morgan Chen', 'Taylor Brooks']

export const TYPE_COLORS = {
  Client:   'bg-teal-50 text-teal-700',
  Prospect: 'bg-blue-50 text-blue-700',
  Partner:  'bg-purple-50 text-purple-700',
  Churned:  'bg-gray-100 text-gray-500',
}

export const STATUS_COLORS = {
  Active:   'bg-emerald-50 text-emerald-700',
  Inactive: 'bg-red-50 text-red-600',
}
