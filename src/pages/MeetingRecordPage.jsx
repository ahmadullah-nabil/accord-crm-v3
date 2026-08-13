// ─── MeetingRecordPage ────────────────────────────────────────────────────────
//
// step048. /meetings/:id — the fifth and last record route. Every module in
// this CRM now has one.
//
// COLD ARRIVAL IS READ, NOT INFERRED. Meetings is on React Query, so
// useMeeting(id) fetches that one row and a pasted link in a fresh tab is an
// ordinary query with an ordinary loading state. "Not found" comes from
// PostgREST's PGRST116 via error.isNotFound rather than being inferred from an
// empty store. Same shape as Contacts, Opportunities and Tasks.
//
// THE CALENDAR SYNC CARD IS HERE TOO, in the same `children` slot the panel
// uses. That is the point of sharing MeetingRecordContent: this page is a
// legitimate place to run the create → Add to calendar → Update & notify →
// Cancel event sequence, and a surface that silently dropped the only control
// that mails invitations would be worse than no surface at all.
//
// MODALS ARE MOUNTED HERE. Edit opens MeetingFormModal; the Tasks tab opens the
// task modals. A modal whose page never mounted it simply does not appear.

import React, { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Calendar, RefreshCw } from 'lucide-react'

import { useMeetingsStore }   from '../stores/meetingsStore.js'
import {
  useMeeting, useMeetings, useDeleteMeeting,
} from '../hooks/useMeetings.js'
import { useMeetingPermissions } from '../hooks/usePermissions.js'
import { useRoleByName }      from '../hooks/useTeam.js'
import { RecordShell }        from '../components/ui/RecordShell.jsx'
import { UnauthorizedState }  from '../components/ui/UnauthorizedState.jsx'
import { CalendarSyncCard }   from '../components/meetings/CalendarSyncCard.jsx'
import {
  MeetingFields, MeetingBadges, MeetingActions, useMeetingTabs,
} from '../components/meetings/MeetingRecordContent.jsx'

import { MeetingFormModal } from '../components/meetings/MeetingFormModal.jsx'
import { TaskFormModal }    from '../components/tasks/TaskFormModal.jsx'
import { TaskDetailPanel }  from '../components/tasks/TaskDetailPanel.jsx'

export function MeetingRecordPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { openEditModal, applyFilters } = useMeetingsStore()
  const { data: meeting, isLoading, isError, error, refetch } = useMeeting(id)
  const deleteMutation = useDeleteMeeting()

  const perms = useMeetingPermissions(meeting)
  const tabs  = useMeetingTabs(meeting, perms)
  const organizerRole = useRoleByName(meeting?.organizer)

  // Same filtered ordering the list and panel use. On a cold arrival the list
  // query is still in flight, so `ordered` is empty and nav is null — the
  // arrows appear once it lands rather than pointing at a one-item universe.
  const { data: allMeetings = [] } = useMeetings()
  const ordered = applyFilters(allMeetings)

  const nav = useMemo(() => {
    const index = ordered.findIndex((m) => m.id === id)
    if (index === -1) return null
    return {
      index,
      total: ordered.length,
      onPrev: () => index > 0 && navigate(`/meetings/${ordered[index - 1].id}`),
      onNext: () => index < ordered.length - 1 && navigate(`/meetings/${ordered[index + 1].id}`),
    }
  }, [ordered, id, navigate])

  const handleDelete = () => {
    if (!meeting) return
    if (window.confirm(`Delete meeting "${meeting.title}"?`)) {
      // The record no longer exists, so this route no longer resolves.
      deleteMutation.mutate(meeting.id, { onSuccess: () => navigate('/meetings') })
    }
  }

  if (isError && error?.isUnauthorized) {
    return <UnauthorizedState message={error.message} onRetry={refetch} />
  }

  if (isError && error?.isNotFound) {
    return (
      <CentredState
        title="Meeting not found"
        detail="It may have been deleted, or you may not have access to it."
        actionLabel="Back to meetings"
        onAction={() => navigate('/meetings')}
      />
    )
  }

  if (isError) {
    return (
      <CentredState
        title="Could not load meeting"
        detail={error?.message ?? 'Something went wrong. Try again.'}
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    )
  }

  const isCancelled = meeting?.status === 'Cancelled'

  return (
    <>
      <RecordShell
        variant="page"
        breadcrumb="Meetings"
        onBack={() => navigate('/meetings')}
        isLoading={isLoading || !meeting}
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
        {meeting && (
          <div className="py-2">
            <CalendarSyncCard meeting={meeting} />
          </div>
        )}
      </RecordShell>

      <MeetingFormModal />
      <TaskFormModal />
      <TaskDetailPanel />
    </>
  )
}

function CentredState({ title, detail, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3">
      <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
        <Calendar size={18} className="text-red-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900 mb-0.5">{title}</p>
        <p className="text-xs text-gray-500 max-w-xs">{detail}</p>
      </div>
      <button onClick={onAction} className="btn-secondary">
        <RefreshCw size={13} /> {actionLabel}
      </button>
    </div>
  )
}

export default MeetingRecordPage
