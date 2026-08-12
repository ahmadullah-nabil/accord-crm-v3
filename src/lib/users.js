// ─── CRM Users / Team Members ─────────────────────────────────────────────────
//
// Single source of truth for the team roster used across:
//   • Lead assignee, Task assignee, Meeting organizer dropdowns
//   • Filter selectors in toolbars
//   • Activity actor defaults
//   • usePersonalized.js ownership filtering
//   • MyWorkspace dashboard widget
//
// Static roster = safe fallback when Supabase is not yet connected.
// Live roster   = useTeamMembers() React Query hook (src/hooks/useTeam.js)
//                 reads from the Supabase profiles table.
//
// Role hierarchy
// ──────────────
// Admin    → full access, can manage all records and users
// Manager  → can see subordinates' records, run team analytics
// Employee → sees own records; limited to assigned items
// (AGM is an alias for a senior Manager role)

// ── Role constants ────────────────────────────────────────────────────────────
export const ROLES = {
  ADMIN:    'Admin',
  AGM:      'AGM',       // Assistant General Manager — senior manager alias
  MANAGER:  'Manager',
  EMPLOYEE: 'Employee',
  EXECUTIVE: 'Executive', // Individual contributor alias for Employee
}

export const ROLE_HIERARCHY = {
  [ROLES.ADMIN]:     4,
  [ROLES.AGM]:       3,
  [ROLES.MANAGER]:   2,
  [ROLES.EMPLOYEE]:  1,
  [ROLES.EXECUTIVE]: 1,
}

/** True if the role has manager-level or higher access */
export function isManagerRole(role) {
  return (ROLE_HIERARCHY[role] ?? 0) >= ROLE_HIERARCHY[ROLES.MANAGER]
}

/** True if the role has admin access */
export function isAdminRole(role) {
  return role === ROLES.ADMIN
}

// ── Department constants ──────────────────────────────────────────────────────
export const DEPARTMENTS = {
  LEADERSHIP:   'Leadership',
  SALES:        'Sales',
  ENGINEERING:  'Engineering',
  OPERATIONS:   'Operations',
}

// ── Static team roster ────────────────────────────────────────────────────────
// Full member shape matches the Supabase profiles table columns:
//   id, name, email, role, department, managerId, teamId, isActive
//
// managerId references another member's id in this same array.
// When live profiles are loaded, this array is the fallback.
export const TEAM_MEMBERS = [
  {
    id:           '1',
    name:         'Alex Rivera',
    email:        'admin@nexuscrm.io',
    role:         ROLES.ADMIN,
    department:   DEPARTMENTS.LEADERSHIP,
    managerId:    null,   // top of hierarchy
    teamId:       null,
    isActive:     true,
    phone:        '',
    avatarUrl:    null,
  },
  {
    id:           '2',
    name:         'Jordan Kim',
    email:        'agm@nexuscrm.io',
    role:         ROLES.AGM,
    department:   DEPARTMENTS.SALES,
    managerId:    '1',    // reports to Alex Rivera
    teamId:       null,
    isActive:     true,
    phone:        '',
    avatarUrl:    null,
  },
  {
    id:           '3',
    name:         'Morgan Chen',
    email:        'manager@nexuscrm.io',
    role:         ROLES.MANAGER,
    department:   DEPARTMENTS.SALES,
    managerId:    '2',    // reports to Jordan Kim
    teamId:       null,
    isActive:     true,
    phone:        '',
    avatarUrl:    null,
  },
  {
    id:           '4',
    name:         'Taylor Brooks',
    email:        'exec@nexuscrm.io',
    role:         ROLES.EXECUTIVE,
    department:   DEPARTMENTS.SALES,
    managerId:    '3',    // reports to Morgan Chen
    teamId:       null,
    isActive:     true,
    phone:        '',
    avatarUrl:    null,
  },
]

// ── Derived lists used by existing UI dropdowns ───────────────────────────────
export const TEAM_MEMBER_NAMES   = TEAM_MEMBERS.map((m) => m.name)
export const ACTIVE_TEAM_MEMBERS = TEAM_MEMBERS.filter((m) => m.isActive)

// ── Lookup helpers ────────────────────────────────────────────────────────────
export function getMemberByName(name) {
  return TEAM_MEMBERS.find((m) => m.name === name) ?? null
}

export function getMemberById(id) {
  return TEAM_MEMBERS.find((m) => m.id === String(id)) ?? null
}

export function getMemberByEmail(email) {
  return TEAM_MEMBERS.find((m) => m.email === email) ?? null
}

// ── Hierarchy helpers ─────────────────────────────────────────────────────────

/**
 * Returns the direct reports (subordinates) of a member by id.
 * Works on both the static array and any live-loaded array of the same shape.
 */
export function getDirectReports(memberId, members = TEAM_MEMBERS) {
  return members.filter((m) => m.managerId === String(memberId))
}

/**
 * Returns all descendants (direct + indirect) of a member.
 * Uses BFS to avoid stack overflows on deep hierarchies.
 */
export function getAllSubordinates(memberId, members = TEAM_MEMBERS) {
  const result   = []
  const queue    = [String(memberId)]
  const visited  = new Set()

  while (queue.length) {
    const current = queue.shift()
    if (visited.has(current)) continue
    visited.add(current)

    const reports = members.filter((m) => m.managerId === current)
    result.push(...reports)
    queue.push(...reports.map((m) => m.id))
  }

  return result
}

/**
 * Returns the full chain of managers above a member (nearest first).
 */
export function getManagerChain(memberId, members = TEAM_MEMBERS) {
  const chain  = []
  let   current = getMemberById(memberId)

  while (current?.managerId) {
    const manager = members.find((m) => m.id === current.managerId) ?? null
    if (!manager || chain.includes(manager)) break   // cycle guard
    chain.push(manager)
    current = manager
  }

  return chain
}

/**
 * Returns all member ids visible to a given role for data-scoping purposes.
 * Admin / AGM → all members.
 * Manager     → self + direct reports + their descendants.
 * Employee    → self only.
 *
 * This is a FRONTEND HINT for UI filtering. Real access control lives in
 * Supabase RLS policies.
 */
export function getVisibleMemberIds(member, members = TEAM_MEMBERS) {
  if (!member) return []
  if (isAdminRole(member.role) || member.role === ROLES.AGM) {
    return members.map((m) => m.id)
  }
  if (isManagerRole(member.role)) {
    const subs = getAllSubordinates(member.id, members)
    return [member.id, ...subs.map((m) => m.id)]
  }
  return [member.id]
}

// ── Ownership stamp ───────────────────────────────────────────────────────────
// Extracts ownership metadata from the Zustand auth user object.
// Called in leadsStore.addLead(), useCreateMeeting, useCreateTask.
export function ownershipStamp(user) {
  if (!user) return { createdBy: '', ownerId: null, ownerName: '' }
  return {
    createdBy: user.name ?? '',
    ownerId:   user.id   ?? null,
    ownerName: user.name ?? '',
  }
}
