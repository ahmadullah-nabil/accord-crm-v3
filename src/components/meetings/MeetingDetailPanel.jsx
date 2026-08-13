// ─── MeetingDetailPanel ───────────────────────────────────────────────────────
//
// step048. The one-long-scroll panel is now a tabbed record surface. Last of
// the five.
//
// WHAT CHANGED
// ────────────
// Before: a 420px panel with eleven stacked blocks — Date & Time, Location,
// Organizer, Participants, the calendar sync card, Related, Description, Notes,
// Tags, Follow-up Tasks, Files — plus a timeline and a Details block at the
// bottom. Reaching the timeline meant scrolling past all of it every time.
//
// Now: fields in collapsible groups, and the three things a meeting relates to
// (activity, follow-up tasks, attachments) as tabs.
//
// CALENDAR SYNC STAYS ABOVE THE TABS AND OUT OF THEM. It is the only path in
// this app that creates an external event or mails an invitation, so it goes in
// RecordShell's `children` slot — under the fields, above the tab bar, visible
// whichever tab is open. See the fuller note in MeetingRecordContent.
//
// RECORD NAVIGATION IS SUPPLIED BY THE CALLER, NOT FETCHED HERE
// ─────────────────────────────────────────────────────────────
// This panel is mounted on SIX pages — Leads, Contacts, Opportunities and their
// three record pages — because a meeting can be opened from any of them.
// Calling useMeetings() here would put a meetings query on the Leads page,
// which has no meeting list on it and never asked for one. `records` is the
// caller's already-filtered array; MeetingsPage passes `filtered`, everyone else
// passes nothing and gets no arrows — correct, because there is no visible list
// for the arrows to walk. Same shape as TaskDetailPanel in step047.
//
// EVERY PERMISSION GATE IS CARRIED OVER UNCHANGED: canEdit, canDelete and
// canFollowUp, gating the same three affordances they gated before.

import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar } from 'lucide-react'

import { useMeetingsStore }        from '../../stores/meetingsStore.js'
import { useMeeting, useDeleteMeeting } from '../../hooks/useMeetings.js'
import { useMeetingPermissions }   from '../../hooks/usePermissions.js'
import { useRoleByName }           from '../../hooks/useTeam.js'
import { RecordShell }             from '../ui/RecordShell.jsx'
import { CalendarSyncCard }        from './CalendarSyncCard.jsx'
import {
  MeetingFields, MeetingBadges, MeetingActions, useMeetingTabs,
} from './MeetingRecordContent.jsx'

export function MeetingDetailPanel({ records = null }) {
  const navigate = useNavigate()
  const {
    detailPanelOpen, closeDetail, openDetail, selectedMeetingId, openEditModal,
  } = useMeetingsStore()

  const { data: meeting, isLoading } = useMeeting(
    detailPanelOpen ? selectedMeetingId : null
  )
  const deleteMutation = useDeleteMeeting()

  const perms = useMeetingPermissions(meeting)
  const tabs  = useMeetingTabs(meeting, perms)
  const organizerRole = useRoleByName(meeting?.organizer)

  const nav = useMemo(() => {
    if (!records) return null
    const index = records.findIndex((m) => m.id === selectedMeetingId)
    if (index === -1) return null
    return {
      index,
      total: records.length,
      onPrev: () => index > 0 && openDetail(records[index - 1].id),
      onNext: () => index < records.length - 1 && openDetail(records[index + 1].id),
    }
  }, [records, selectedMeetingId, openDetail])

  const handleDelete = () => {
    if (!meeting) return
    if (window.confirm(`Delete meeting "${meeting.title}"?`)) {
      deleteMutation.mutate(meeting.id, { onSuccess: closeDetail })
    }
  }

  const isCancelled = meeting?.status === 'Cancelled'

  return (
    <RecordShell
      variant="panel"
      open={detailPanelOpen}
      onClose={closeDetail}
      onExpand={meeting ? () => { closeDetail(); navigate(`/meetings/${meeting.id}`) } : undefined}
      isLoading={isLoading}
      avatar={
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
          ${isCancelled ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'}`}>
          <Calendar size={15} />
        </span>
      }
      title={meeting?.title ?? 'Loading…'}
      subtitle={meeting?.relatedLabel || null}
      badges={meeting ? <MeetingBadges meeting={meeting} /> : null}
      nav={nav}
      actions={
        <MeetingActions
          meeting={meeting}
          perms={perms}
          onEdit={() => openEditModal(meeting.id)}
          onDelete={handleDelete}
        />
      }
      fields={<MeetingFields meeting={meeting} organizerRole={organizerRole} />}
      tabs={tabs}
    >
      {/* The only caller of the calendar sync path — see the header note. */}
      {meeting && (
        <div className="py-2">
          <CalendarSyncCard meeting={meeting} />
        </div>
      )}
    </RecordShell>
  )
}

export default MeetingDetailPanel
