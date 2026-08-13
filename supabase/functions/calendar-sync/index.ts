// ─── calendar-sync ────────────────────────────────────────────────────────────
//
// PHASE 2. Pushes a CRM meeting to the organiser's connected calendar and
// invites the attendees named on it.
//
//   POST { meetingId, action: 'sync' | 'cancel', sendNotifications? }
//
// ONE-WAY ONLY: create, update, cancel. There is no read path, no RSVP and no
// inbound sync — those need webhook channels (Google expires them in ~7 days,
// Graph in ~3), a renewal cron, delta tokens, loop prevention and conflict
// resolution. `etag` is stored so that work is additive later.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ WHY OWNERSHIP IS RE-CHECKED HERE                                        │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ 005 grants every authenticated user FOR ALL on meetings — anyone can    │
// │ edit anyone's meeting, including its `attendees`. This function MAILS   │
// │ whoever is in that column, from the organiser's own mailbox.            │
// │                                                                          │
// │ So the caller must BE the organiser. Without that check, user A could   │
// │ add themselves (or anyone) to user B's meeting and cause an invitation  │
// │ to go out over B's identity. The RLS grant is pre-existing and too      │
// │ broad to rely on; the check belongs here, where the consequence is.     │
// └─────────────────────────────────────────────────────────────────────────┘
//
// SYNC vs CANCEL is decided by `external_event_id`, not by the caller: present
// means update, absent means create. Trusting a client-supplied verb would let
// a retry after a timeout create a duplicate event and re-invite everyone.

import { requireUser, adminClient } from '../_shared/supabase.ts'
import { corsHeaders, json, errorResponse } from '../_shared/http.ts'
import { getTokenForCapability, authHeader, type ValidToken } from '../_shared/tokens.ts'
import { getAdapter } from '../_shared/providers/index.ts'
import {
  IntegrationError,
  type ProviderAuth,
  type CalendarAttendee,
  type CalendarEventInput,
} from '../_shared/types.ts'

interface SyncRequest {
  meetingId: string
  action?: 'sync' | 'cancel'
  /** False when only internal fields changed and attendees need not be re-mailed. */
  sendNotifications?: boolean
}

/** Guard against a runaway invite. Providers cap this anyway, less kindly. */
const MAX_ATTENDEES = 100

interface MeetingRow {
  id: string
  title: string
  description: string | null
  location: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  duration_mins: number | null
  timezone: string
  attendees: CalendarAttendee[] | null
  organizer_id: string | null
  provider: string | null
  external_event_id: string | null
  sync_status: string
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'), req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const user = await requireUser(req)
    const admin = adminClient()

    let body: SyncRequest
    try {
      body = await req.json()
    } catch {
      throw new IntegrationError('bad_request', 'Expected a JSON body.', 400)
    }

    if (!body.meetingId) {
      throw new IntegrationError('bad_request', 'meetingId is required.', 400)
    }

    const { data: meeting, error: mErr } = await admin
      .from('meetings')
      .select(
        'id, title, description, location, scheduled_date, scheduled_time, ' +
        'duration_mins, timezone, attendees, organizer_id, provider, ' +
        'external_event_id, sync_status',
      )
      .eq('id', body.meetingId)
      .maybeSingle<MeetingRow>()

    if (mErr) throw mErr
    if (!meeting) {
      throw new IntegrationError('bad_request', 'Meeting not found.', 404)
    }

    // ── Ownership ─────────────────────────────────────────────────────────────
    // See the box above. An unclaimed meeting (organizer_id NULL — every row
    // created before 020) cannot sync: we have no account to send it from.
    if (!meeting.organizer_id) {
      throw new IntegrationError(
        'bad_request',
        'This meeting has no organizer set, so it cannot be added to a calendar. Reopen and save it to claim it.',
        409,
      )
    }
    if (meeting.organizer_id !== user.id) {
      throw new IntegrationError(
        'unauthorized',
        'Only the meeting organizer can sync it to a calendar.',
        403,
      )
    }

    // ── Cancel ────────────────────────────────────────────────────────────────
    if (body.action === 'cancel') {
      if (!meeting.external_event_id || !meeting.provider) {
        // Never synced, so there is nothing at the provider to cancel. Report
        // success: the desired end state — no external event — already holds.
        await admin.from('meetings')
          .update({ sync_status: 'not_synced', sync_error: null })
          .eq('id', meeting.id)
        return json({ status: 'not_synced', cancelled: false }, 200, cors)
      }

      const token = await getTokenForCapability(user.id, 'calendar')
      const adapter = getAdapter(token.provider)
      const auth = toProviderAuth(token)

      const ok = await adapter.cancelEvent(auth, meeting.external_event_id)

      await admin.from('meetings').update({
        sync_status:    ok ? 'cancelled' : 'failed',
        sync_error:     ok ? null : 'The provider did not confirm cancellation.',
        last_synced_at: new Date().toISOString(),
        // external_event_id is deliberately KEPT on failure so a retry still
        // knows what to cancel. Clearing it would orphan a live event that
        // attendees can still see, with no local record of it.
        ...(ok ? { external_event_id: null, meeting_url: null } : {}),
      }).eq('id', meeting.id)

      return json({ status: ok ? 'cancelled' : 'failed', cancelled: ok }, 200, cors)
    }

    // ── Validate before touching the provider ─────────────────────────────────
    if (!meeting.scheduled_date || !meeting.scheduled_time) {
      throw new IntegrationError(
        'bad_request',
        'A date and time are required before this meeting can be added to a calendar.',
        400,
      )
    }

    const attendees = (meeting.attendees ?? []).filter((a) => a?.email)
    if (attendees.length > MAX_ATTENDEES) {
      throw new IntegrationError(
        'bad_request',
        `A meeting cannot have more than ${MAX_ATTENDEES} attendees.`,
        400,
      )
    }

    const { start, end } = localWindow(
      meeting.scheduled_date,
      meeting.scheduled_time,
      meeting.duration_mins ?? 60,
    )

    const input: CalendarEventInput = {
      title:       meeting.title,
      description: meeting.description ?? '',
      location:    meeting.location ?? '',
      start,
      end,
      timezone:    meeting.timezone || 'Asia/Dhaka',
      attendees,
      addConferencing:   false,
      sendNotifications: body.sendNotifications !== false,
    }

    // Mark in-flight FIRST. If the provider call times out, the row says
    // 'pending' rather than silently reading 'synced' over an event that may or
    // may not exist.
    await admin.from('meetings')
      .update({ sync_status: 'pending', sync_error: null })
      .eq('id', meeting.id)

    const token = await getTokenForCapability(user.id, 'calendar')
    const adapter = getAdapter(token.provider)
    const auth = toProviderAuth(token)

    // Update only when the SAME provider holds the event. If the organiser has
    // since switched providers, the stored id is meaningless to the new one —
    // creating fresh is correct, and the old event is left for an explicit
    // cancel rather than silently abandoned under a new id.
    const canUpdate = Boolean(meeting.external_event_id) && meeting.provider === token.provider

    try {
      const result = canUpdate
        ? await adapter.updateEvent(auth, meeting.external_event_id!, input)
        : await adapter.createEvent(auth, input)

      if (!result.externalEventId) {
        throw new IntegrationError(
          'calendar_failed',
          'The provider accepted the event but returned no id, so it cannot be updated later.',
          502,
        )
      }

      await admin.from('meetings').update({
        provider:          token.provider,
        external_event_id: result.externalEventId,
        etag:              result.etag ?? null,
        meeting_url:       result.meetingUrl ?? null,
        sync_status:       'synced',
        sync_error:        null,
        last_synced_at:    new Date().toISOString(),
      }).eq('id', meeting.id)

      return json({
        status:          'synced',
        provider:        token.provider,
        externalEventId: result.externalEventId,
        meetingUrl:      result.meetingUrl ?? null,
        htmlLink:        result.htmlLink ?? null,
        updated:         canUpdate,
        invited:         input.sendNotifications ? attendees.length : 0,
      }, 200, cors)
    } catch (err) {
      // Record the reason on the row. A meeting that failed to reach the
      // calendar must SAY so — silence reads as success, and the organiser
      // assumes their client was invited.
      const message = err instanceof Error ? err.message : String(err)
      await admin.from('meetings').update({
        sync_status:    'failed',
        sync_error:     message.slice(0, 500),
        last_synced_at: new Date().toISOString(),
      }).eq('id', meeting.id)
      throw err
    }
  } catch (err) {
    return errorResponse(err, corsHeaders(req.headers.get('Origin'), req))
  }
})

/**
 * Build the provider auth envelope.
 *
 * authHeader() is the single place that knows Zoho needs `Zoho-oauthtoken`
 * rather than `Bearer`. Its output is now passed through WHOLE.
 *
 * It used to be split back apart into { accessToken, tokenType } and cast
 * `as ProviderAuth` — an object the declared type did not describe. Every
 * calendar method then reassembled the same header from the pieces, so a
 * quirk that lives in one file was being re-derived in nine places, and the
 * cast is what let that compile. ProviderAuth now carries the finished header
 * and nothing else, so there is nothing left to split and nothing to cast.
 */
function toProviderAuth(token: ValidToken): ProviderAuth {
  return {
    authorization: authHeader(token),
    apiDomain:     token.apiDomain,
  }
}

/**
 * Local wall-clock start and end, as 'YYYY-MM-DDTHH:mm:ss'.
 *
 * NO timezone conversion happens here, and that is the point. The provider is
 * told the local time AND the IANA zone separately, and does the conversion
 * itself per attendee. Converting to UTC here would discard the zone, so an
 * event booked for 3pm Dhaka would silently move if that zone's rules ever
 * changed — and each attendee would lose the "3pm in the organiser's zone"
 * meaning the invitation is supposed to carry.
 *
 * Arithmetic is done on a UTC-anchored Date purely to roll minutes over hours
 * and days correctly; the result is read back with the UTC getters, so no zone
 * is ever applied.
 */
function localWindow(
  date: string,
  time: string,
  durationMins: number,
): { start: string; end: string } {
  const hhmmss = time.length === 5 ? `${time}:00` : time
  const start = `${date}T${hhmmss}`

  const anchor = new Date(`${start}Z`)
  if (Number.isNaN(anchor.getTime())) {
    throw new IntegrationError(
      'bad_request',
      `Could not read the meeting's date and time (${date} ${time}).`,
      400,
    )
  }

  const endAnchor = new Date(anchor.getTime() + Math.max(1, durationMins) * 60_000)
  const p = (n: number) => String(n).padStart(2, '0')
  const end =
    `${endAnchor.getUTCFullYear()}-${p(endAnchor.getUTCMonth() + 1)}-${p(endAnchor.getUTCDate())}` +
    `T${p(endAnchor.getUTCHours())}:${p(endAnchor.getUTCMinutes())}:${p(endAnchor.getUTCSeconds())}`

  return { start, end }
}
