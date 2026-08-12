// ─── CRM Permission Helpers ───────────────────────────────────────────────────
//
// Single source of truth for all action-level RBAC.
// No role checks should be scattered across components — import from here.
//
// Usage pattern
// ─────────────
// In components, use the hooks from hooks/usePermissions.js:
//   const { canEdit, canDelete } = useLeadPermissions(lead)
//
// The pure functions here are safe to unit-test independently.
//
// Ownership matching
// ──────────────────
// Records carry two ownership signals:
//   ownerId   — Supabase UUID (string), most reliable, set on creation
//   assignee  — display name string, always present for all record types
//   createdBy — display name string, present on all migrated records
//   organizer — display name string, specific to meetings
//
// We match on any of these signals. For records created before the
// ownership patch, ownerId may be null — name matching is the fallback.

import { ROLES, ROLE_HIERARCHY } from './users.js'

// ── Role rank helpers ─────────────────────────────────────────────────────────

function rank(role) {
  return ROLE_HIERARCHY[role] ?? 0
}

export function isAdmin(user) {
  return user?.role === ROLES.ADMIN
}

export function isAgm(user) {
  return user?.role === ROLES.AGM
}

export function isSuperUser(user) {
  return isAdmin(user) || isAgm(user)
}

export function isManager(user) {
  return rank(user?.role) >= rank(ROLES.MANAGER)
}

// ── Ownership check ───────────────────────────────────────────────────────────

/**
 * Returns true if `user` is a direct owner of the record.
 * Checks ownerId (UUID), assignee (name), createdBy (name), organizer (name).
 */
export function isOwner(user, record) {
  if (!user || !record) return false
  if (record.ownerId   && record.ownerId   === user.id)   return true
  if (record.assignee  && record.assignee  === user.name) return true
  if (record.createdBy && record.createdBy === user.name) return true
  if (record.organizer && record.organizer === user.name) return true
  return false
}

/**
 * Returns true if the record belongs to any member in `subordinateNames`.
 * Checked before granting manager-level edit/delete rights.
 */
export function isSubordinateRecord(record, subordinateNames = []) {
  if (!record || !subordinateNames.length) return false
  const names = new Set(subordinateNames)
  if (record.assignee  && names.has(record.assignee))  return true
  if (record.createdBy && names.has(record.createdBy)) return true
  if (record.organizer && names.has(record.organizer)) return true
  return false
}

// ── Core permission functions ─────────────────────────────────────────────────
// All accept (user, record, subordinateNames?) and return boolean.
// subordinateNames is the array of display names of all the user's subordinates.

/**
 * Can the user view this record?
 * (Frontend hint — real enforcement is via RLS. Returns true for any
 * authenticated user if called without subordinate info.)
 */
export function canView(user, record, subordinateNames = []) {
  if (!user) return false
  if (isSuperUser(user)) return true
  if (isOwner(user, record)) return true
  if (isManager(user) && isSubordinateRecord(record, subordinateNames)) return true
  return false
}

/**
 * Can the user edit (update) this record?
 */
export function canEdit(user, record, subordinateNames = []) {
  if (!user) return false
  if (isSuperUser(user)) return true
  if (isOwner(user, record)) return true
  if (isManager(user) && isSubordinateRecord(record, subordinateNames)) return true
  return false
}

/**
 * Can the user delete this record?
 * Employees can only delete records they personally own (ownerId match).
 * Managers can delete subordinate records.
 * Admins/AGMs can delete anything.
 */
export function canDelete(user, record, subordinateNames = []) {
  if (!user) return false
  if (isSuperUser(user)) return true
  // Managers can delete subordinate records
  if (isManager(user) && isSubordinateRecord(record, subordinateNames)) return true
  // Any role can delete their own record (strict UUID match preferred)
  if (record?.ownerId && record.ownerId === user.id) return true
  // Name-match fallback for older records without ownerId
  if (!record?.ownerId && isOwner(user, record)) return true
  return false
}

/**
 * Can the user change the stage/status of this record?
 * Same rules as edit.
 */
export function canChangeStage(user, record, subordinateNames = []) {
  return canEdit(user, record, subordinateNames)
}

/**
 * Can the user assign this record to someone?
 * Managers can reassign subordinate records; employees can only self-assign.
 */
export function canAssign(user, record, subordinateNames = []) {
  if (!user) return false
  if (isSuperUser(user)) return true
  if (isManager(user)) return true   // managers can assign freely within their scope
  // Employees can edit their own record's assignee
  return isOwner(user, record)
}

// ── Module-level permission sets ──────────────────────────────────────────────
// Returns a permission object for a record — use to conditionally render UI.

/**
 * Permissions object for a lead record.
 * @param {object} user — authStore.user
 * @param {object} lead — lead record from React Query / leadsStore
 * @param {string[]} subordinateNames — useMySubordinates().map(m => m.name)
 */
export function getLeadPermissions(user, lead, subordinateNames = []) {
  return {
    canView:        canView(user, lead, subordinateNames),
    canEdit:        canEdit(user, lead, subordinateNames),
    canDelete:      canDelete(user, lead, subordinateNames),
    canChangeStage: canChangeStage(user, lead, subordinateNames),
    canAssign:      canAssign(user, lead, subordinateNames),
    canConvert:     canEdit(user, lead, subordinateNames),  // convert = edit-level
    canSchedule:    canEdit(user, lead, subordinateNames),  // schedule meeting
  }
}

export function getTaskPermissions(user, task, subordinateNames = []) {
  return {
    canView:   canView(user, task, subordinateNames),
    canEdit:   canEdit(user, task, subordinateNames),
    canDelete: canDelete(user, task, subordinateNames),
    canToggle: canEdit(user, task, subordinateNames),  // complete/reopen
    canAssign: canAssign(user, task, subordinateNames),
  }
}

export function getMeetingPermissions(user, meeting, subordinateNames = []) {
  return {
    canView:     canView(user, meeting, subordinateNames),
    canEdit:     canEdit(user, meeting, subordinateNames),
    canDelete:   canDelete(user, meeting, subordinateNames),
    canAssign:   canAssign(user, meeting, subordinateNames),
    canFollowUp: canEdit(user, meeting, subordinateNames),  // create follow-up task
  }
}

export function getOpportunityPermissions(user, opp, subordinateNames = []) {
  return {
    canView:        canView(user, opp, subordinateNames),
    canEdit:        canEdit(user, opp, subordinateNames),
    canDelete:      canDelete(user, opp, subordinateNames),
    canChangeStage: canChangeStage(user, opp, subordinateNames),
    canAssign:      canAssign(user, opp, subordinateNames),
  }
}

export function getContactPermissions(user, contact, subordinateNames = []) {
  return {
    canView:   canView(user, contact, subordinateNames),
    canEdit:   canEdit(user, contact, subordinateNames),
    canDelete: canDelete(user, contact, subordinateNames),
    canAssign: canAssign(user, contact, subordinateNames),
  }
}

// ── Settings / admin permissions ──────────────────────────────────────────────

export function getSettingsPermissions(user) {
  const adminLevel = isSuperUser(user)
  const managerLevel = isManager(user)
  return {
    canEditProfile:       Boolean(user),          // everyone edits own profile
    canEditCompany:       adminLevel,              // only admin/AGM
    canManageUsers:       adminLevel,              // only admin/AGM
    canViewTeam:          managerLevel,            // manager+ sees team view
    canEditSecurity:      Boolean(user),           // everyone edits own password
    canEditNotifications: Boolean(user),           // everyone edits own prefs
    canEditAppearance:    Boolean(user),           // everyone edits own theme
    canAccessAdminPanel:  adminLevel,              // admin-only sections
  }
}

// ── canManageUser — hierarchy-aware user management ───────────────────────────

/**
 * Can `actor` manage (edit role/settings of) `targetMember`?
 * Admins can manage anyone.
 * AGMs can manage everyone below Admin.
 * Managers can only manage direct subordinates.
 * Employees cannot manage anyone.
 */
export function canManageUser(actor, targetMember) {
  if (!actor || !targetMember) return false
  if (actor.id === targetMember.id) return false  // can't manage yourself
  if (isAdmin(actor)) return true
  if (isAgm(actor) && !isAdmin(targetMember)) return true
  if (isManager(actor) && rank(targetMember.role) < rank(actor.role)) return true
  return false
}
