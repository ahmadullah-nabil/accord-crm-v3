// ─── Timeline React Query Hooks ───────────────────────────────────────────────
//
// Provides the unified timeline, notes, and follow-up feeds for any entity.
// All hooks share the queryKey structure:
//   ['timeline', entityType, entityId]
//
// This means:
//   • Adding a note invalidates the timeline → timeline re-fetches instantly
//   • All write mutations optimistically prepend the new event
//   • staleTime: 60s — timeline is append-only, changes only from mutations

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore.js'
import {
  getTimelineForEntity,
  getNotesForEntity,
  getFollowUpsForEntity,
  addNote,
  logFollowUp,
  scheduleFollowUp,
  addMeetingNote,
} from '../services/timelineService.js'

// ── Query keys ────────────────────────────────────────────────────────────────
export const timelineKeys = {
  // linkedId is null for non-converted entities — distinct cache entries
  entity:   (type, id, linkedId = null) => ['timeline', type, id, linkedId],
  notes:    (type, id) => ['timeline', 'notes', type, id],
  followups:(type, id) => ['timeline', 'followups', type, id],
}

const STALE = 1000 * 60  // 60s — append-only data stays fresh long

// ── Read hooks ────────────────────────────────────────────────────────────────

/**
 * Full chronological timeline for any entity.
 * Pass linkedEntityType + linkedEntityId to merge a related entity's history
 * (e.g. lead + its originating contact after conversion).
 */
export function useTimeline(
  entityType,
  entityId,
  linkedEntityType = null,
  linkedEntityId   = null,
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey: timelineKeys.entity(entityType, entityId, linkedEntityId ?? null),
    queryFn:  () => getTimelineForEntity(
      entityType,
      entityId,
      50,
      linkedEntityType,
      linkedEntityId,
    ),
    enabled:  isAuthenticated && Boolean(entityType) && Boolean(entityId),
    staleTime: STALE,
    placeholderData: [],
  })
}

/** Notes-only feed for an entity */
export function useEntityNotes(entityType, entityId) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey: timelineKeys.notes(entityType, entityId),
    queryFn:  () => getNotesForEntity(entityType, entityId),
    enabled:  isAuthenticated && Boolean(entityType) && Boolean(entityId),
    staleTime: STALE,
    placeholderData: [],
  })
}

/** Follow-up log feed for an entity */
export function useEntityFollowUps(entityType, entityId) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey: timelineKeys.followups(entityType, entityId),
    queryFn:  () => getFollowUpsForEntity(entityType, entityId),
    enabled:  isAuthenticated && Boolean(entityType) && Boolean(entityId),
    staleTime: STALE,
    placeholderData: [],
  })
}

// ── Write hooks ───────────────────────────────────────────────────────────────

/** Add an internal note — optimistic prepend */
export function useAddNote(entityType, entityId, entityLabel = '') {
  const qc   = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: ({ body, visibility = 'internal', label = entityLabel }) =>
      addNote({
        entityType,
        entityId,
        entityLabel: label,
        body,
        visibility,
        actorName: user?.name ?? '',
        actorId:   user?.id   ?? null,
      }),
    onSuccess: (newEvent) => {
      // Prepend to the full timeline cache
      qc.setQueryData(timelineKeys.entity(entityType, entityId), (old = []) =>
        [newEvent, ...old]
      )
      // Also prepend to notes-only cache
      qc.setQueryData(timelineKeys.notes(entityType, entityId), (old = []) =>
        [newEvent, ...old]
      )
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: timelineKeys.entity(entityType, entityId) })
    },
  })
}

/** Log a completed follow-up — optimistic prepend */
export function useLogFollowUp(entityType, entityId, entityLabel = '') {
  const qc   = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: ({ followupType, outcome, nextFollowupDate, label = entityLabel }) =>
      logFollowUp({
        entityType,
        entityId,
        entityLabel: label,
        followupType,
        outcome,
        nextFollowupDate: nextFollowupDate || null,
        actorName: user?.name ?? '',
        actorId:   user?.id   ?? null,
      }),
    onSuccess: (newEvent) => {
      qc.setQueryData(timelineKeys.entity(entityType, entityId), (old = []) =>
        [newEvent, ...old]
      )
      qc.setQueryData(timelineKeys.followups(entityType, entityId), (old = []) =>
        [newEvent, ...old]
      )
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: timelineKeys.entity(entityType, entityId) })
    },
  })
}

/** Schedule a follow-up — optimistic prepend */
export function useScheduleFollowUp(entityType, entityId, entityLabel = '') {
  const qc   = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: ({ followupType, scheduledDate, notes, label = entityLabel }) =>
      scheduleFollowUp({
        entityType,
        entityId,
        entityLabel: label,
        followupType,
        scheduledDate,
        notes: notes || '',
        actorName: user?.name ?? '',
        actorId:   user?.id   ?? null,
      }),
    onSuccess: (newEvent) => {
      qc.setQueryData(timelineKeys.entity(entityType, entityId), (old = []) =>
        [newEvent, ...old]
      )
      qc.setQueryData(timelineKeys.followups(entityType, entityId), (old = []) =>
        [newEvent, ...old]
      )
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: timelineKeys.entity(entityType, entityId) })
    },
  })
}

/** Add meeting notes — optimistic prepend */
export function useAddMeetingNote(meetingId) {
  const qc   = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: ({ summary, decisions, nextActions, attendees }) =>
      addMeetingNote({
        entityId:    meetingId,
        summary,
        decisions:   decisions  || '',
        nextActions: nextActions || '',
        attendees:   attendees  || [],
        actorName:   user?.name ?? '',
        actorId:     user?.id   ?? null,
      }),
    onSuccess: (newEvent) => {
      qc.setQueryData(timelineKeys.entity('meeting', meetingId), (old = []) =>
        [newEvent, ...old]
      )
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: timelineKeys.entity('meeting', meetingId) })
    },
  })
}
