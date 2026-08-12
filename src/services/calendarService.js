// ─── Calendar sync service ────────────────────────────────────────────────────
//
// PHASE 2. Pushes a CRM meeting to the organiser's connected calendar and
// invites its attendees, via the calendar-sync Edge Function.
//
// ONE-WAY. Create, update, cancel. There is no read path: RSVP status and edits
// made inside Google/Outlook/Zoho do NOT flow back. `lastSyncedAt` is surfaced
// in the UI precisely because of that — drift should be visible rather than
// silently assumed away.
//
// Auth: supabase.functions.invoke() attaches the session JWT, and the function
// re-checks that the caller is the meeting's organizer_id. The client never
// names an integration account, so it cannot send an invitation over someone
// else's identity by guessing an id.

import { supabase } from '../lib/supabaseClient.js'
import { normaliseIntegrationError } from './integrationsService.js'

/**
 * Create or update the external calendar event for a meeting.
 *
 * Create vs update is decided SERVER-SIDE by whether the meeting already has an
 * external_event_id — not by this call. That is deliberate: a retry after a
 * network timeout must not create a second event and re-invite everyone.
 *
 * @param {string}  meetingId
 * @param {object}  [opts]
 * @param {boolean} [opts.sendNotifications=true]
 *        False updates the provider event WITHOUT mailing attendees. Use it
 *        when only internal fields changed — re-mailing people about a note
 *        edit trains them to ignore the invitations that matter.
 *
 * Resolves to { status, provider, externalEventId, meetingUrl, htmlLink,
 *               updated, invited }.
 */
export async function syncMeetingToCalendar(meetingId, opts = {}) {
  const { data, error } = await supabase.functions.invoke('calendar-sync', {
    method: 'POST',
    body: {
      meetingId,
      action: 'sync',
      sendNotifications: opts.sendNotifications !== false,
    },
  })
  if (error || data?.error) throw normaliseIntegrationError(error, data)
  return data
}

/**
 * Cancel the external event and notify attendees.
 *
 * Not the same as deleting the CRM meeting: the meeting record survives with
 * sync_status='cancelled'. A meeting that happened and was then called off is
 * history worth keeping, and the Dashboard's activity calendar is meant to show
 * cancelled items rather than silently drop them.
 *
 * Succeeds when the event is already absent at the provider — the desired end
 * state is "not on the calendar", which is satisfied either way.
 */
export async function cancelMeetingCalendarEvent(meetingId) {
  const { data, error } = await supabase.functions.invoke('calendar-sync', {
    method: 'POST',
    body: { meetingId, action: 'cancel' },
  })
  if (error || data?.error) throw normaliseIntegrationError(error, data)
  return data
}

// ── Presentation helpers ──────────────────────────────────────────────────────

export const SYNC_STATUS_LABEL = {
  not_synced: 'Not on calendar',
  pending:    'Adding to calendar…',
  synced:     'On calendar',
  failed:     'Calendar sync failed',
  cancelled:  'Cancelled on calendar',
}

export const SYNC_STATUS_TONE = {
  not_synced: 'muted',
  pending:    'info',
  synced:     'success',
  failed:     'danger',
  cancelled:  'muted',
}

/**
 * Can this meeting be pushed to a calendar, and if not, why?
 *
 * Checked client-side purely so the button can explain itself instead of
 * failing on click. The Edge Function re-checks every one of these — this is a
 * courtesy, not a control.
 */
export function calendarSyncBlockers(meeting, currentUserId) {
  const blockers = []
  if (!meeting) return ['Meeting not found.']

  if (!meeting.scheduledDate || !meeting.scheduledTime) {
    blockers.push('Set a date and time first.')
  }
  if (!meeting.organizerId) {
    // Every meeting created before 020 has a NULL organizer_id. Saving the
    // meeting once claims it, which is why the message says to reopen and save.
    blockers.push('This meeting has no organizer account. Reopen and save it to claim it.')
  } else if (currentUserId && meeting.organizerId !== currentUserId) {
    blockers.push('Only the organizer can add this meeting to a calendar.')
  }
  if (!Array.isArray(meeting.attendees) || meeting.attendees.length === 0) {
    // Not fatal — an event with no attendees is a valid personal calendar
    // entry. Worth saying out loud, though, because "added to calendar" with
    // nobody invited is a plausible misreading of what just happened.
    blockers.push('No attendees will be invited.')
  }
  return blockers
}

/** True when the blockers are advisory rather than disqualifying. */
export function canSyncToCalendar(meeting, currentUserId) {
  if (!meeting?.scheduledDate || !meeting?.scheduledTime) return false
  if (!meeting?.organizerId) return false
  if (currentUserId && meeting.organizerId !== currentUserId) return false
  return true
}
