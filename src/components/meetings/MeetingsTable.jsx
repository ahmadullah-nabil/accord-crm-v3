// ─── MeetingsTable ────────────────────────────────────────────────────────────
//
// step048. 332 lines → this. The header markup, sort chevrons, row hover, row
// action menu, skeleton and footer count are all DataTable's job now.
//
// ROW ACTIONS ARE NOW PERMISSION-GATED, AND THAT IS NOT A NEW POLICY
// ──────────────────────────────────────────────────────────────────
// MeetingDetailPanel has always gated Edit and Delete through
// useMeetingPermissions — it passes `null` handlers and the buttons do not
// render. This table never did, so the row menu offered a delete that the panel
// refused on the very same meeting. useBatchMeetingPermissions existed for
// exactly this case and had ZERO callers.
//
// This applies the module's OWN existing policy to the surface that skipped it.
// It does not invent one. Same move as step044 made for Opportunities, and the
// opposite of the Tasks and Contacts decision — those modules gate NOWHERE, so
// there is no existing policy to apply and adding one would be a real
// permissions change.
//
// An action the user cannot perform is ABSENT, not disabled: a disabled item
// still advertises a capability they do not have.
//
// CANCELLED MEETINGS STAY VISIBLE, dimmed and struck through — the same rule
// completed tasks follow. A row that disappears when cancelled is
// indistinguishable from one that was deleted.

import React from 'react'
import {
  Calendar, Clock, Tag, Users, Link2, MapPin,
  Eye, Pencil, Trash2,
} from 'lucide-react'
import { useMeetingsStore }                    from '../../stores/meetingsStore.js'
import { useDeleteMeeting }                    from '../../hooks/useMeetings.js'
import { useBatchMeetingPermissions }          from '../../hooks/usePermissions.js'
import { STATUS_CONFIG, TYPE_CONFIG, daysFromToday } from '../../lib/meetingsData.js'
import { formatLocalDate }                     from '../../lib/dates.js'
import { Avatar }                              from '../ui/Avatar.jsx'
import { DataTable }                           from '../ui/DataTable.jsx'

export function MeetingsTable({ meetings, isLoading }) {
  const {
    sortField, sortDir, setSort,
    openDetail, openEditModal, openAddModal,
  } = useMeetingsStore()
  const deleteMutation = useDeleteMeeting()
  const { getPermissions } = useBatchMeetingPermissions()

  const columns = [
    {
      key: 'title',
      label: 'Meeting',
      icon: Calendar,
      sortable: true,
      width: '280px',
      render: (m) => (
        <span className="flex flex-col min-w-0">
          <span className={`font-medium truncate
            ${m.status === 'Cancelled' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {m.title}
          </span>
          {(m.relatedLabel || m.location) && (
            <span className="flex items-center gap-2 text-[11px] text-gray-400 truncate">
              {m.relatedLabel && (
                <span className="flex items-center gap-0.5 truncate">
                  <Link2 size={9} className="flex-shrink-0" /> {m.relatedLabel}
                </span>
              )}
              {m.location && (
                <span className="flex items-center gap-0.5 truncate">
                  <MapPin size={9} className="flex-shrink-0" /> {m.location}
                </span>
              )}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      icon: Tag,
      sortable: true,
      width: '130px',
      render: (m) => {
        const sc = STATUS_CONFIG[m.status] || STATUS_CONFIG['Scheduled']
        return (
          <span className={`badge ${sc.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mr-1 ${sc.dot}`} />
            {sc.label}
          </span>
        )
      },
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      width: '140px',
      render: (m) => {
        const tc = TYPE_CONFIG[m.type] || { color: 'bg-gray-100 text-gray-600' }
        return m.type ? <span className={`badge ${tc.color}`}>{m.type}</span>
                      : <span className="text-gray-300">—</span>
      },
    },
    {
      key: 'scheduledDate',
      label: 'When',
      icon: Clock,
      sortable: true,
      width: '150px',
      render: (m) => <WhenCell meeting={m} />,
    },
    {
      key: 'durationMins',
      label: 'Duration',
      align: 'right',
      width: '90px',
      render: (m) => (
        m.durationMins
          ? <span className="tnum text-gray-600">{m.durationMins} min</span>
          : <span className="text-gray-300">—</span>
      ),
    },
    {
      key: 'organizer',
      label: 'Organizer',
      icon: Users,
      width: '150px',
      render: (m) => (
        m.organizer ? (
          <span className="flex items-center gap-1.5 min-w-0">
            <Avatar name={m.organizer} size="xs" />
            <span className="text-gray-600 truncate">{m.organizer}</span>
          </span>
        ) : <span className="text-gray-300">—</span>
      ),
    },
    {
      key: 'participants',
      label: 'Participants',
      width: '130px',
      render: (m) => <ParticipantsAvatars participants={m.participants || []} />,
    },
  ]

  const scheduled = meetings.filter((m) => m.status === 'Scheduled').length
  const cancelled = meetings.filter((m) => m.status === 'Cancelled').length

  return (
    <DataTable
      columns={columns}
      rows={meetings}
      isLoading={isLoading}
      sort={{ field: sortField, dir: sortDir }}
      onSort={setSort}
      onRowClick={(m) => openDetail(m.id)}
      onAddNew={openAddModal}
      rowActions={(m) => {
        const perms = getPermissions(m)
        return [
          { label: 'Open', icon: Eye, onClick: () => openDetail(m.id) },
          perms.canEdit && {
            label: 'Edit', icon: Pencil, onClick: () => openEditModal(m.id),
          },
          perms.canDelete && {
            label: 'Delete',
            icon: Trash2,
            danger: true,
            onClick: () => {
              if (window.confirm(`Delete meeting "${m.title}"?`)) {
                deleteMutation.mutate(m.id)
              }
            },
          },
        ].filter(Boolean)
      }}
      aggregates={[
        { label: 'Meetings',  value: meetings.length },
        { label: 'Scheduled', value: scheduled },
        { label: 'Cancelled', value: cancelled },
      ]}
      empty={{
        icon: Calendar,
        title: 'No meetings found',
        description: 'Try adjusting your search or filter criteria, or schedule a new meeting.',
      }}
    />
  )
}

// ── When cell ─────────────────────────────────────────────────────────────────
//
// formatLocalDate, not new Date(scheduledDate).toLocaleDateString(): a bare
// YYYY-MM-DD is parsed as UTC and could render the wrong day. See the read-side
// note in lib/dates.js.
//
// A meeting HAS a time — unlike a task, which is all-day — so the time is shown
// beside the date rather than omitted.
function WhenCell({ meeting }) {
  const label = formatLocalDate(meeting.scheduledDate)
  if (!label) return <span className="text-gray-300">Unscheduled</span>

  const days = daysFromToday(meeting.scheduledDate)
  const settled = meeting.status === 'Completed' || meeting.status === 'Cancelled'

  const note =
    settled       ? null :
    days === null ? null :
    days <   0    ? `${Math.abs(days)}d ago` :
    days === 0    ? 'Today' :
    days === 1    ? 'Tomorrow' :
                    null

  const noteClass =
    days === 0 ? 'text-orange-600' :
    days === 1 ? 'text-amber-600' :
                 'text-gray-400'

  return (
    <span className="flex flex-col">
      <span className={`tnum ${settled ? 'text-gray-400' : 'text-gray-700'}`}>
        {label}{meeting.scheduledTime ? ` · ${meeting.scheduledTime}` : ''}
      </span>
      {note && <span className={`text-[10px] font-medium ${noteClass}`}>{note}</span>}
    </span>
  )
}

// ── Participant avatar stack ──────────────────────────────────────────────────
function ParticipantsAvatars({ participants }) {
  if (!participants.length) return <span className="text-gray-300">—</span>

  const visible  = participants.slice(0, 3)
  const overflow = participants.length - 3

  return (
    <span className="flex items-center" title={participants.join(', ')}>
      <span className="flex -space-x-1.5">
        {visible.map((name, i) => (
          <span key={i} className="ring-2 ring-white rounded-full">
            <Avatar name={name} size="xs" />
          </span>
        ))}
      </span>
      {overflow > 0 && (
        <span className="ml-1.5 text-[10px] font-medium text-gray-400 tnum">+{overflow}</span>
      )}
    </span>
  )
}

export default MeetingsTable
