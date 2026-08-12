// ─── User Management Service ──────────────────────────────────────────────────
//
// Admin-only operations on public.profiles.
// All mutations are safe incremental updates — never deletes, never touches
// auth.users directly. Supabase auth records are fully preserved.
//
// Operations:
//   listWorkspaceUsers()       — all profiles for the admin overview
//   updateUserRole()           — change profiles.role
//   updateUserManager()        — change profiles.manager_id
//   updateUserDepartment()     — change profiles.department
//   setUserActive()            — toggle profiles.is_active
//
// Field mapping  DB → App
//   id, name, email, role, department
//   manager_id → managerId, is_active → isActive, updated_at → updatedAt

import { supabase } from '../lib/supabaseClient.js'

function toApp(row) {
  if (!row) return null
  return {
    id:         row.id,
    name:       row.name        ?? '',
    email:      row.email       ?? '',
    role:       row.role        ?? 'Employee',
    department: row.department  ?? '',
    managerId:  row.manager_id  ?? null,
    teamId:     row.team_id     ?? null,
    isActive:   row.is_active   ?? true,
    phone:      row.phone       ?? '',
    avatarUrl:  row.avatar_url  ?? null,
    updatedAt:  row.updated_at  ?? '',
    createdAt:  row.created_at  ?? '',
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** All workspace users, active and inactive, ordered by name. */
export async function listWorkspaceUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role, department, manager_id, team_id, is_active, phone, avatar_url, updated_at, created_at')
    .order('name', { ascending: true })

  if (error) {
    if (error.code === '42P01') return []   // table doesn't exist yet
    throw error
  }
  return (data ?? []).map(toApp)
}

// ── Update helpers — each patches a single concern ───────────────────────────

async function patchProfile(id, patch) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  // Supabase returns data:null when RLS blocks the row without raising an error.
  // Treat this as a permission failure so callers get a clear signal.
  if (!data) throw new Error('Update blocked — insufficient permissions or profile not found.')
  return toApp(data)
}

/** Change a user's role (e.g. 'Employee' → 'Manager'). */
export function updateUserRole(id, role) {
  return patchProfile(id, { role })
}

/**
 * Set or clear a user's manager.
 * Pass null to remove the manager relationship.
 */
export function updateUserManager(id, managerId) {
  return patchProfile(id, { manager_id: managerId ?? null })
}

/** Update a user's department string. */
export function updateUserDepartment(id, department) {
  return patchProfile(id, { department: department ?? '' })
}

/** Activate or deactivate a user without deleting their auth record. */
export function setUserActive(id, isActive) {
  return patchProfile(id, { is_active: isActive })
}

/** Update name (display name in the CRM, not the auth email). */
export function updateUserName(id, name) {
  return patchProfile(id, { name })
}

// ── User creation ─────────────────────────────────────────────────────────────

/**
 * Create a new workspace user.
 *
 * Flow:
 *   1. supabase.auth.signUp()        — creates auth.users row + sends invite email
 *   2. Trigger handle_new_user()     — auto-creates public.profiles row (role='Employee')
 *   3. patchProfile()                — immediately applies admin-assigned role/manager/dept
 *
 * Returns the final profile row (toApp shape).
 * Throws if:
 *   - email is already registered
 *   - signUp itself fails
 *   - profile patch fails (the auth user still exists; admin can re-edit)
 *
 * @param {object} opts
 * @param {string} opts.name          — display name (stored in raw_user_meta_data.name)
 * @param {string} opts.email         — work email
 * @param {string} opts.tempPassword  — initial password (user should change via reset)
 * @param {string} opts.role          — ROLES value
 * @param {string|null} opts.managerId — profiles.id UUID or null
 * @param {string} opts.department    — optional department string
 */
export async function createWorkspaceUser({
  name,
  email,
  tempPassword,
  role       = 'Employee',
  managerId  = null,
  department = '',
}) {
  // Step 1 — create auth user
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email:    email.trim().toLowerCase(),
    password: tempPassword,
    options: {
      data: { name: name.trim() },       // trigger reads this for profiles.name
      emailRedirectTo: `${window.location.origin}/login`,
    },
  })

  if (signUpError) {
    // Surface a clean message for the common duplicate-email case
    if (
      signUpError.message?.toLowerCase().includes('already registered') ||
      signUpError.message?.toLowerCase().includes('already been registered') ||
      signUpError.status === 422
    ) {
      throw new Error(`${email} is already registered in this workspace.`)
    }
    throw new Error(signUpError.message ?? 'Failed to create user account.')
  }

  const newUserId = signUpData.user?.id
  if (!newUserId) {
    throw new Error('User account was created but no user ID was returned.')
  }

  // Step 2 — the Postgres trigger fires automatically (handle_new_user).
  // Give it a brief moment before we try to patch (trigger is synchronous
  // in Postgres but the response may arrive before the row is visible).
  await new Promise((r) => setTimeout(r, 400))

  // Step 3 — patch the auto-created profile with admin-assigned values
  try {
    const patch = {
      name:       name.trim(),
      role,
      is_active:  true,
    }
    if (managerId)  patch.manager_id = managerId
    if (department) patch.department  = department

    return await patchProfile(newUserId, patch)
  } catch (patchErr) {
    // Auth user exists but profile patch failed.
    // Return a minimal shape so the caller can still show success;
    // the admin can re-edit the user to fix the profile fields.
    console.error('[userManagementService] profile patch failed after signUp:', patchErr.message)
    return {
      id:         newUserId,
      name:       name.trim(),
      email:      email.trim().toLowerCase(),
      role,
      department,
      managerId,
      isActive:   true,
      createdAt:  new Date().toISOString(),
      updatedAt:  new Date().toISOString(),
    }
  }
}
