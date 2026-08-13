// ─── CalendarSyncCard ─────────────────────────────────────────────────────────
//
// The control that actually creates the external calendar event and sends the
// invitations. Lives on the meeting detail panel, NOT in the form, because
// saving a meeting and mailing a client are different acts — coupling them
// would re-invite everyone on every typo fix.
//
// Two things this component insists on saying out loud:
//
//   • WHEN IT FAILS, IT SAYS SO. A meeting whose invitations never went out
//     must not look identical to one that succeeded. Silence reads as success
//     and the organiser assumes their client was invited.
//
//   • DRIFT IS VISIBLE. Sync is one-way, so an edit made inside Google or
//     Outlook never reaches the CRM. `last synced` is shown rather than hidden,
//     because "we cannot know" is honest and "3:00 PM" stated confidently is
//     not.

// step050: every colour in this file was on the fixed `slate` ramp. This card
// is the only caller of the calendar sync path and is mounted on both the
// meeting panel and /meetings/:id, so it was the largest unthemed surface
// left in the app. Swept onto `gray` — same ramp step, no visual change in
// light mode, correct in dark mode and under a non-teal accent.

import React from 'react'
import {
  CalendarPlus, CalendarCheck, CalendarX, AlertTriangle,
  RefreshCw, Loader2, Video, Users,
} from 'lucide-react'

import { useAuthStore } from '../../stores/authStore.js'
import {
  useSyncMeetingToCalendar,
  useCancelMeetingCalendarEvent,
} from '../../hooks/useCalendarSync.js'
import { canSyncToCalendar, calendarSyncBlockers } from '../../services/calendarService.js'

const PROVIDER_LABEL = {
  google:    'Google Calendar',
  microsoft: 'Outlook Calendar',
  zoho:      'Zoho Calendar',
}

function relativeTime(iso) {
  if (!iso) return null
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24)  return `${hrs} hr ago`
  return `${Math.round(hrs / 24)} d ago`
}

export function CalendarSyncCard({ meeting }) {
  const currentUserId = useAuthStore((st) => st.user?.id) ?? null
  const syncMutation   = useSyncMeetingToCalendar()
  const cancelMutation = useCancelMeetingCalendarEvent()

  if (!meeting) return null

  const status    = meeting.syncStatus ?? 'not_synced'
  const isSynced  = status === 'synced'
  const isFailed  = status === 'failed'
  const busy      = syncMutation.isPending || cancelMutation.isPending
  const canSync   = canSyncToCalendar(meeting, currentUserId)
  const blockers  = calendarSyncBlockers(meeting, currentUserId)
  const attendees = Array.isArray(meeting.attendees) ? meeting.attendees : []

  const sync = () =>
    syncMutation.mutate({ meetingId: meeting.id, sendNotifications: true })

  // Updating without re-mailing. Offered separately rather than as the default
  // because the honest choice depends on what changed, and only the user knows.
  const syncQuietly = () =>
    syncMutation.mutate({ meetingId: meeting.id, sendNotifications: false })

  const cancel = () => cancelMutation.mutate({ meetingId: meeting.id })

  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            {isSynced
              ? <CalendarCheck className="w-4 h-4 text-emerald-600" />
              : isFailed
                ? <AlertTriangle className="w-4 h-4 text-rose-600" />
                : <CalendarPlus className="w-4 h-4 text-gray-400" />}
            External calendar
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {isSynced
              ? `On ${PROVIDER_LABEL[meeting.provider] ?? meeting.provider}`
              : status === 'cancelled'
                ? 'Cancelled at the provider'
                : 'Not added to a calendar yet'}
          </p>
        </div>

        {isSynced && meeting.lastSyncedAt && (
          // Shown because one-way sync cannot detect a change made on the
          // provider's side. Age is the only honest signal available.
          <span className="text-[11px] text-gray-400 shrink-0">
            synced {relativeTime(meeting.lastSyncedAt)}
          </span>
        )}
      </div>

      {/* ── Failure ──────────────────────────────────────────────────────────
          The provider's own words, not a generic apology. When Zoho or Google
          rejects something the reason is usually actionable, and hiding it
          costs a support round trip. */}
      {isFailed && meeting.syncError && (
        <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2">
          <p className="text-xs text-rose-800 font-medium">Invitations were not sent.</p>
          <p className="text-xs text-rose-700 mt-0.5 break-words">{meeting.syncError}</p>
        </div>
      )}

      {/* ── Who gets invited ─────────────────────────────────────────────── */}
      {attendees.length > 0 ? (
        <p className="text-xs text-gray-600 flex items-start gap-1.5">
          <Users className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" />
          <span>
            {isSynced ? 'Invited: ' : 'Will invite: '}
            {attendees.map((a) => a.name || a.email).join(', ')}
          </span>
        </p>
      ) : (
        <p className="text-xs text-gray-500">
          No attendees — this will be added to your own calendar only.
        </p>
      )}

      {meeting.meetingUrl && (
        <a
          href={meeting.meetingUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-teal-700 hover:underline inline-flex items-center gap-1.5"
        >
          <Video className="w-3.5 h-3.5" /> Join link
        </a>
      )}

      {/* ── Why the button is disabled ───────────────────────────────────── */}
      {!canSync && blockers.length > 0 && (
        <ul className="text-xs text-gray-500 space-y-0.5">
          {blockers.map((b) => <li key={b}>• {b}</li>)}
        </ul>
      )}

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 pt-1">
        {!isSynced ? (
          <button
            type="button"
            className="btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1.5"
            onClick={sync}
            disabled={!canSync || busy}
          >
            {busy
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <CalendarPlus className="w-3.5 h-3.5" />}
            {isFailed ? 'Try again' : 'Add to calendar'}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1.5"
              onClick={sync}
              disabled={!canSync || busy}
              title="Push the current details and notify attendees"
            >
              {busy
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
              Update &amp; notify
            </button>

            <button
              type="button"
              className="btn-secondary text-xs px-3 py-1.5"
              onClick={syncQuietly}
              disabled={!canSync || busy}
              title="Update the event without emailing attendees again"
            >
              Update quietly
            </button>

            <button
              type="button"
              className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1.5
                         text-rose-700 border-rose-200 hover:bg-rose-50"
              onClick={cancel}
              disabled={busy}
              title="Cancel the event and notify attendees. The CRM meeting is kept."
            >
              <CalendarX className="w-3.5 h-3.5" />
              Cancel event
            </button>
          </>
        )}
      </div>

      {/* One-way sync is a design decision, not a limitation to hide. Saying it
          here costs one line and prevents the assumption that the CRM knows
          about changes made in Google or Outlook. */}
      <p className="text-[11px] text-gray-400 leading-relaxed">
        Changes made in {PROVIDER_LABEL[meeting.provider] ?? 'your calendar'} do
        not come back to the CRM. Edit here and update to keep them in step.
      </p>
    </div>
  )
}

export default CalendarSyncCard
