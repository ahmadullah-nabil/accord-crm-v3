// ─── Team / Hierarchy React Query Hooks ──────────────────────────────────────
//
// All hooks read from teamService.js which queries public.profiles.
// useAssignableMembers() is the single source of truth for all dropdowns.
// useMyProfileData()    is the single source of truth for the settings page.
//
// Cache strategy: 10-minute staleTime — team structure changes rarely.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore }   from '../stores/authStore.js'
import {
  getTeamMembers,
  getProfileById,
  getMyProfile,
  getTeams,
  updateProfile,
} from '../services/teamService.js'
import {
  getAllSubordinates,
  getDirectReports,
  getManagerChain,
  getVisibleMemberIds,
  isManagerRole,
} from '../lib/users.js'

// ── Query keys ────────────────────────────────────────────────────────────────
export const teamKeys = {
  members:   () => ['team', 'members'],
  member:    (id) => ['team', 'member', id],
  teams:     () => ['team', 'teams'],
  myProfile: (id) => ['team', 'myProfile', id],
}

const STALE = 1000 * 60 * 10  // 10 minutes

// ── All team members ──────────────────────────────────────────────────────────
export function useTeamMembers() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey:       teamKeys.members(),
    queryFn:        getTeamMembers,
    // placeholderData (not initialData) — shown while loading but does NOT
    // prevent the query from firing. initialData was the bug: it told React
    // Query the cache was already populated and fresh, so getTeamMembers()
    // was never called.
    placeholderData: [],
    staleTime:      0,             // always re-fetch on mount so dropdowns populate
    gcTime:         1000 * 60 * 10, // keep in memory for 10 min after last subscriber
    retry:          2,
    enabled:        isAuthenticated,
  })
}

// ── useAssignableMembers — single source for all assignment dropdowns ──────────
// Returns { members: Member[], names: string[], isLoading: boolean }
// All form modals call this instead of importing static constants.
export function useAssignableMembers() {
  const { data: members = [], isLoading } = useTeamMembers()
  return {
    members,
    names:     members.map((m) => m.name).filter(Boolean),
    isLoading,
  }
}

// ── useMyProfileData — real Supabase profile for the settings page ────────────
// Reads the currently authenticated user's own profile from public.profiles.
// The select() maps it to the shape ProfileSection already expects.
export function useMyProfileData() {
  const user            = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return useQuery({
    queryKey: teamKeys.myProfile(user?.id),
    queryFn:  () => getMyProfile(user?.id),
    enabled:   isAuthenticated && Boolean(user?.id),
    staleTime: STALE,
    select: (profile) => profile ? {
      name:       profile.name       || user?.name       || '',
      email:      profile.email      || user?.email      || '',
      phone:      profile.phone      || '',
      title:      profile.role       || user?.role       || 'Employee',
      department: profile.department || user?.department || '',
      bio:        '',
      timezone:   'Asia/Dhaka',
      language:   'English',
      dateFormat: 'DD/MM/YYYY',
      // extra fields
      role:      profile.role     || 'Employee',
      avatarUrl: profile.avatarUrl || null,
      managerId: profile.managerId || null,
      _id:       profile.id,
    } : null,
  })
}

// ── Single member profile ──────────────────────────────────────────────────────
export function useTeamMember(id) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey: teamKeys.member(id),
    queryFn:  () => getProfileById(id),
    staleTime: STALE,
    enabled:   isAuthenticated && Boolean(id),
  })
}

// ── All teams (org units) ─────────────────────────────────────────────────────
export function useTeams() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey: teamKeys.teams(),
    queryFn:  getTeams,
    staleTime: STALE,
    enabled:   isAuthenticated,
  })
}

// ── Derived hierarchy hooks ───────────────────────────────────────────────────

export function useMyDirectReports() {
  const user              = useAuthStore((s) => s.user)
  const { data: members } = useTeamMembers()
  if (!user?.id || !members?.length) return []
  return getDirectReports(user.id, members)
}

export function useMySubordinates() {
  const user              = useAuthStore((s) => s.user)
  const { data: members } = useTeamMembers()
  if (!user?.id || !members?.length) return []
  return getAllSubordinates(user.id, members)
}

export function useMyManagerChain() {
  const user              = useAuthStore((s) => s.user)
  const { data: members } = useTeamMembers()
  if (!user?.id || !members?.length) return []
  return getManagerChain(user.id, members)
}

export function useVisibleMemberIds() {
  const user              = useAuthStore((s) => s.user)
  const { data: members } = useTeamMembers()
  if (!user || !members?.length) return []
  const me = members.find((m) => m.id === user.id || m.name === user.name) ?? null
  return getVisibleMemberIds(me, members)
}

// ── useRoleByName — look up a member's real role from the team cache ──────────
// Returns the real role string ('Admin', 'Manager', 'Employee', etc.) for a
// given display name, or null if the member isn't found in the cache.
// Used by detail panels to replace hardcoded static role labels with real data.
export function useRoleByName(name) {
  const { data: members = [] } = useTeamMembers()
  if (!name) return null
  const found = members.find((m) => m.name === name)
  return found?.role ?? null   // null = not found; caller renders nothing
}

export function useIsManager() {
  const user = useAuthStore((s) => s.user)
  return isManagerRole(user?.role ?? '')
}

// ── Update profile mutation ───────────────────────────────────────────────────
export function useUpdateProfile() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }) => updateProfile(id, data),
    onSuccess: (updated, { id }) => {
      if (updated) {
        qc.setQueryData(teamKeys.member(id), updated)
        qc.setQueryData(teamKeys.members(), (old = []) =>
          old.map((m) => (m.id === id ? updated : m))
        )
        qc.invalidateQueries({ queryKey: teamKeys.myProfile(id) })
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: teamKeys.members() })
    },
  })
}
