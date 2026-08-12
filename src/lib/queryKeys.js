// ─── Centralised Query Key Registry ──────────────────────────────────────────
//
// All React Query query keys live here.
// This prevents key collisions across modules and makes cache invalidation
// surgical and predictable. Every hook file imports from this registry
// instead of defining its own keys.
//
// Naming convention:
//   queryKeys.<module>.all()          → the entire list
//   queryKeys.<module>.detail(id)     → single record by id
//   queryKeys.<module>.filtered(args) → filtered/paginated list
//
// Usage in hooks:
//   import { queryKeys } from '@/lib/queryKeys.js'
//   useQuery({ queryKey: queryKeys.contacts.all(), queryFn: ... })

export const queryKeys = {
  // ── Auth ────────────────────────────────────────────────────────────────────
  auth: {
    session: () => ['auth', 'session'],
    user:    () => ['auth', 'user'],
  },

  // ── Contacts ────────────────────────────────────────────────────────────────
  contacts: {
    all:      ()     => ['contacts'],
    detail:   (id)   => ['contacts', id],
    filtered: (args) => ['contacts', 'filtered', args],
  },

  // ── Leads ────────────────────────────────────────────────────────────────────
  leads: {
    all:      ()     => ['leads'],
    detail:   (id)   => ['leads', id],
    filtered: (args) => ['leads', 'filtered', args],
  },

  // ── Tasks ────────────────────────────────────────────────────────────────────
  tasks: {
    all:      ()     => ['tasks'],
    detail:   (id)   => ['tasks', id],
    filtered: (args) => ['tasks', 'filtered', args],
  },

  // ── Meetings ────────────────────────────────────────────────────────────────
  meetings: {
    all:      ()     => ['meetings'],
    detail:   (id)   => ['meetings', id],
    filtered: (args) => ['meetings', 'filtered', args],
  },

  // ── Notifications ───────────────────────────────────────────────────────────
  notifications: {
    all:    ()   => ['notifications'],
    detail: (id) => ['notifications', id],
    unread: ()   => ['notifications', 'unread'],
  },

  // ── Analytics ───────────────────────────────────────────────────────────────
  analytics: {
    kpi:      (range) => ['analytics', 'kpi',      range],
    revenue:  (range) => ['analytics', 'revenue',  range],
    funnel:   (range) => ['analytics', 'funnel',   range],
    sources:  (range) => ['analytics', 'sources',  range],
    leads:    (range) => ['analytics', 'leads',    range],
    tasks:    (range) => ['analytics', 'tasks',    range],
    meetings: (range) => ['analytics', 'meetings', range],
    team:     (range) => ['analytics', 'team',     range],
    activity: (range) => ['analytics', 'activity', range],
  },

  // ── Settings ────────────────────────────────────────────────────────────────
  settings: {
    profile:       () => ['settings', 'profile'],
    company:       () => ['settings', 'company'],
    notifications: () => ['settings', 'notifications'],
    appearance:    () => ['settings', 'appearance'],
    security:      () => ['settings', 'security'],
    preferences:   () => ['settings', 'preferences'],
  },

  // ── Dashboard ───────────────────────────────────────────────────────────────
  dashboard: {
    kpis:       () => ['dashboard', 'kpis'],
    pipeline:   () => ['dashboard', 'pipeline'],
    activity:   () => ['dashboard', 'activity'],
    performers: () => ['dashboard', 'performers'],
    revenue:    () => ['dashboard', 'revenue'],
  },
}
