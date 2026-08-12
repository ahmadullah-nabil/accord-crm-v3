// ─── Team Service ─────────────────────────────────────────────────────────────
//
// Supabase queries for the profiles and teams tables.
// Called by useTeam.js React Query hooks — UI components never import this.
//
// Field mapping
// ─────────────
// DB uses snake_case:   manager_id, team_id, is_active, avatar_url, updated_at
// App uses camelCase:   managerId,  teamId,  isActive,  avatarUrl,  updatedAt
//
// No static fallback data — the app reflects the real Supabase state only.
// If the profiles table is missing/empty, dropdowns show empty and the user
// sees a prompt to set up their profile.

import { supabase } from '../lib/supabaseClient.js'

// ── Field mapper: Supabase profile row → app member shape ────────────────────
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
  }
}

// ── Fetch all active profiles (team members) ──────────────────────────────────
// Defensive: if is_active column doesn't exist (table created by auth trigger
// before profiles_foundation.sql was run), fall back to a query without
// the is_active filter rather than silently returning [].
export async function getTeamMembers() {
  // Primary query: filter by is_active = true
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role, department, manager_id, team_id, is_active, phone, avatar_url, updated_at')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (!error) {
    return (data ?? []).map(toApp)
  }

  // Column doesn't exist yet — table created before profiles_foundation.sql
  if (error.code === '42703') {
    console.warn('[teamService] is_active column missing — querying without filter. Run profiles_foundation.sql.')
    const { data: allData, error: allError } = await supabase
      .from('profiles')
      .select('id, name, email, role, department, manager_id, team_id, phone, avatar_url, updated_at')
      .order('name', { ascending: true })

    if (allError) {
      console.error('[teamService] getTeamMembers fallback failed:', allError)
      throw allError
    }
    return (allData ?? []).map((row) => toApp({ ...row, is_active: true }))
  }

  // Table missing entirely
  if (error.code === '42P01') {
    console.warn('[teamService] profiles table does not exist. Run profiles_foundation.sql.')
    return []
  }

  // RLS block or other error — log and throw so React Query sets isError
  console.error('[teamService] getTeamMembers error:', error.code, error.message)
  throw error
}

// ── Fetch a single profile by id ──────────────────────────────────────────────
export async function getProfileById(id) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role, department, manager_id, team_id, is_active, phone, avatar_url, updated_at')
    .eq('id', id)
    .single()

  if (!error) return toApp(data)

  // Row not found — normal for new users before trigger fires
  if (error.code === 'PGRST116') return null
  // Schema issues — safe to return null
  if (error.code === '42703' || error.code === '42P01') {
    console.warn('[teamService] getProfileById schema issue:', error.code)
    return null
  }
  console.error('[teamService] getProfileById error:', error.code, error.message)
  throw error
}

// ── Fetch the current user's own profile ──────────────────────────────────────
export async function getMyProfile(userId) {
  if (!userId) return null
  return getProfileById(userId)
}

// ── Fetch all teams ────────────────────────────────────────────────────────────
export async function getTeams() {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, description, created_at')
    .order('name', { ascending: true })

  if (error) {
    if (error.code === '42P01') return []
    throw error
  }
  return data ?? []
}

// ── Update a profile ──────────────────────────────────────────────────────────
export async function updateProfile(id, payload) {
  const row = {}
  if (payload.name       !== undefined) row.name       = payload.name
  if (payload.role       !== undefined) row.role       = payload.role
  if (payload.department !== undefined) row.department = payload.department
  if (payload.managerId  !== undefined) row.manager_id = payload.managerId
  if (payload.teamId     !== undefined) row.team_id    = payload.teamId
  if (payload.phone      !== undefined) row.phone      = payload.phone
  if (payload.avatarUrl  !== undefined) row.avatar_url = payload.avatarUrl
  row.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('profiles')
    .update(row)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return toApp(data)
}
