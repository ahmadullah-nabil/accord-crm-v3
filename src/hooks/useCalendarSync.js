// ─── useCalendarSync ──────────────────────────────────────────────────────────
//
// PHASE 2. Pushing a meeting to the organiser's connected calendar.
//
// Kept OUT of useCreateMeeting / useUpdateMeeting on purpose. Saving a meeting
// and mailing calendar invitations to a client are different acts with very
// different consequences, and coupling them would mean every typo fix in the
// notes field re-invited everyone. The user asks for the sync explicitly.

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys }        from '../lib/queryKeys.js'
import { getMeetingById }   from '../services/meetingsService.js'
import {
  syncMeetingToCalendar,
  cancelMeetingCalendarEvent,
} from '../services/calendarService.js'

const meetingKeys = queryKeys.meetings

/**
 * Re-read the meeting and refresh both caches.
 *
 * The Edge Function writes provider, external_event_id, sync_status,
 * meeting_url and last_synced_at directly to the row — the client never sends
 * them, so the mutation's own response is not enough to bring the cache back in
 * step. Re-reading is the only way to see what the server actually recorded.
 */
async function refreshMeeting(qc, meetingId) {
  try {
    const fresh = await getMeetingById(meetingId)
    if (!fresh) return
    qc.setQueryData(meetingKeys.detail(meetingId), fresh)
    qc.setQueryData(meetingKeys.all(), (old = []) =>
      old.map((m) => (m.id === meetingId ? fresh : m)),
    )
  } catch (err) {
    // A failed refresh must not surface as a failed sync — the event may well
    // have been created. Invalidate and let the next read settle it.
    console.warn('[useCalendarSync] could not refresh meeting:', err?.message)
    qc.invalidateQueries({ queryKey: meetingKeys.all() })
  }
}

/**
 * Create or update the external calendar event.
 *
 * mutate({ meetingId, sendNotifications })
 *
 * `sendNotifications: false` updates the provider event without mailing
 * attendees — for edits that do not change what they need to know.
 */
export function useSyncMeetingToCalendar() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ meetingId, sendNotifications }) =>
      syncMeetingToCalendar(meetingId, { sendNotifications }),

    onSuccess: (_result, { meetingId }) => refreshMeeting(qc, meetingId),

    // On failure the server has already written sync_status='failed' and a
    // sync_error onto the row. Refreshing surfaces that reason in the UI
    // instead of leaving a stale 'pending' badge over a meeting whose
    // invitations never went out.
    onError: (_err, { meetingId }) => refreshMeeting(qc, meetingId),
  })
}

/**
 * Cancel the external event and notify attendees.
 *
 * Does NOT delete the CRM meeting. A cancelled meeting is history worth
 * keeping, and the Dashboard activity calendar is meant to show cancelled items
 * rather than silently drop them.
 */
export function useCancelMeetingCalendarEvent() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ meetingId }) => cancelMeetingCalendarEvent(meetingId),
    onSuccess: (_result, { meetingId }) => refreshMeeting(qc, meetingId),
    onError:   (_err, { meetingId })    => refreshMeeting(qc, meetingId),
  })
}
