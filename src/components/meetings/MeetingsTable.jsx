import React from 'react'
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  MoreHorizontal, Eye, Pencil, Trash2,
  MapPin, Clock, Users, Link2,
} from 'lucide-react'
import { useMeetingsStore }                        from '../../stores/meetingsStore.js'
import { useDeleteMeeting }                        from '../../hooks/useMeetings.js'
import { STATUS_CONFIG, TYPE_CONFIG, daysFromToday } from '../../lib/meetingsData.js'
import { Avatar }                                  from '../ui/Avatar.jsx'
import { Skeleton }                                from '../ui/Skeleton.jsx'
import { EmptyState }                              from '../ui/EmptyState.jsx'
import { Calendar }                                from 'lucide-react'

const COLS = [
  { key: 'title',         label: 'Meeting',    sortable: true  },
  { key: 'status',        label: 'Status',     sortable: true,  width: 'w-28' },
  { key: 'type',          label: 'Type',       sortable: true,  width: 'w-32' },
  { key: 'scheduledDate', label: 'Date & Time',sortable: true,  width: 'w-40' },
  { key: 'durationMins',  label: 'Duration',   sortable: false, width: 'w-24' },
  { key: 'organizer',     label: 'Organizer',  sortable: false, width: 'w-32' },
  { key: 'participants',  label: 'Participants',sortable: false, width: 'w-32' },
  { key: 'actions',       label: '',           sortable: false, width: 'w-12' },
]

export function MeetingsTable({ meetings, isLoading }) {
  const { sortField, sortDir, setSort, openDetail, openEditModal } = useMeetingsStore()
  const deleteMutation = useDeleteMeeting()

  if (isLoading) return <TableSkeleton />

  if (!meetings.length) {
    return (
      <div className="card">
        <EmptyState
          icon={Calendar}
          title="No meetings found"
          description="Try adjusting your search or filter criteria, or schedule a new meeting."
        />
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              {COLS.map((col) => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => setSort(col.key) : undefined}
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-500
                    uppercase tracking-wider whitespace-nowrap ${col.width || ''}
                    ${col.sortable ? 'cursor-pointer select-none hover:text-gray-700 group' : ''}`}
                >
                  {col.label && (
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && (
                        sortField === col.key
                          ? sortDir === 'asc'
                            ? <ChevronUp size={12} className="text-teal-500" />
                            : <ChevronDown size={12} className="text-teal-500" />
                          : <ChevronsUpDown size={11} className="text-gray-300 group-hover:text-gray-400" />
                      )}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {meetings.map((meeting) => (
              <MeetingRow
                key={meeting.id}
                meeting={meeting}
                onOpen={() => openDetail(meeting.id)}
                onEdit={() => openEditModal(meeting.id)}
                onDelete={() => {
                  if (window.confirm(`Delete meeting "${meeting.title}"?`)) {
                    deleteMutation.mutate(meeting.id)
                  }
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 border-t border-gray-50 bg-gray-50/40">
        <p className="text-xs text-gray-400">
          {meetings.length} meeting{meetings.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────
function MeetingRow({ meeting, onOpen, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const sc  = STATUS_CONFIG[meeting.status] || STATUS_CONFIG['Scheduled']
  const tc  = TYPE_CONFIG[meeting.type]     || { color: 'bg-gray-100 text-gray-600' }
  const days = daysFromToday(meeting.scheduledDate)

  const isCompleted  = meeting.status === 'Completed'
  const isCancelled  = meeting.status === 'Cancelled'
  const isPast       = !isCompleted && !isCancelled && days !== null && days < 0
  const isToday      = days === 0
  const isSoon       = days !== null && days > 0 && days <= 2

  // Date + time display
  const dateLabel = meeting.scheduledDate
    ? new Date(meeting.scheduledDate).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: '2-digit',
      })
    : '—'

  const dateBadge =
    isToday ? 'Today' :
    days === 1 ? 'Tomorrow' :
    isPast ? `${Math.abs(days)}d ago` :
    null

  const dateBadgeClass =
    isToday ? 'text-orange-600 bg-orange-50' :
    days === 1 ? 'text-amber-600 bg-amber-50' :
    isPast ? 'text-gray-400 bg-gray-50' :
    ''

  const rowOpacity = isCancelled ? 'opacity-60' : ''

  return (
    <tr
      onClick={onOpen}
      className={`transition-colors duration-100 cursor-pointer group ${rowOpacity}
        ${isCompleted || isCancelled ? 'bg-gray-50/20 hover:bg-gray-50/50' : 'hover:bg-gray-50/60'}`}
    >
      {/* Title + related + location */}
      <td className="px-4 py-3 min-w-[200px] max-w-[300px]">
        <p className={`font-medium text-sm leading-tight truncate
          ${isCancelled ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {meeting.title}
        </p>
        {meeting.relatedLabel && (
          <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1 truncate">
            <Link2 size={10} className="flex-shrink-0" />
            {meeting.relatedLabel}
          </p>
        )}
        {meeting.location && (
          <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1 truncate">
            <MapPin size={10} className="flex-shrink-0" />
            {meeting.location}
          </p>
        )}
      </td>

      {/* Status badge */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />
          {sc.label}
        </span>
      </td>

      {/* Type badge */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tc.color}`}>
          {meeting.type}
        </span>
      </td>

      {/* Date + time */}
      <td className="px-4 py-3">
        <div>
          <p className="text-xs text-gray-700 font-medium">{dateLabel}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {meeting.scheduledTime && (
              <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                <Clock size={9} />
                {meeting.scheduledTime}
              </span>
            )}
            {dateBadge && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${dateBadgeClass}`}>
                {dateBadge}
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Duration */}
      <td className="px-4 py-3">
        <span className="text-xs text-gray-500">
          {meeting.durationMins ? `${meeting.durationMins} min` : '—'}
        </span>
      </td>

      {/* Organizer */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Avatar name={meeting.organizer} size="xs" />
          <span className="text-xs text-gray-600 truncate max-w-[72px]">
            {meeting.organizer?.split(' ')[0]}
          </span>
        </div>
      </td>

      {/* Participants avatars */}
      <td className="px-4 py-3">
        <ParticipantsAvatars participants={meeting.participants || []} />
      </td>

      {/* Actions */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100
              transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <RowMenu
              onOpen={() => { onOpen(); setMenuOpen(false) }}
              onEdit={() => { onEdit(); setMenuOpen(false) }}
              onDelete={() => { onDelete(); setMenuOpen(false) }}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Participant avatar stack ───────────────────────────────────────────────────
function ParticipantsAvatars({ participants }) {
  const visible = participants.slice(0, 3)
  const overflow = participants.length - 3

  if (!participants.length) {
    return <span className="text-xs text-gray-300">—</span>
  }

  return (
    <div className="flex items-center">
      <div className="flex -space-x-1.5">
        {visible.map((name, i) => (
          <div key={i} className="ring-2 ring-white rounded-full">
            <Avatar name={name} size="xs" />
          </div>
        ))}
      </div>
      {overflow > 0 && (
        <span className="ml-1.5 text-[10px] font-medium text-gray-400">
          +{overflow}
        </span>
      )}
    </div>
  )
}

// ── Row dropdown menu ─────────────────────────────────────────────────────────
function RowMenu({ onOpen, onEdit, onDelete, onClose }) {
  React.useEffect(() => {
    const handler = () => onClose()
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [onClose])

  return (
    <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-card-lg border
      border-gray-100 py-1 min-w-[130px] animate-fade-in">
      <MenuItem icon={Eye}    label="View"   onClick={onOpen}   />
      <MenuItem icon={Pencil} label="Edit"   onClick={onEdit}   />
      <MenuItem icon={Trash2} label="Delete" onClick={onDelete} danger />
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors
        ${danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="divide-y divide-gray-50">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-4">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-52" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-5 w-22 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-6 w-6 rounded-full" />
            <div className="flex -space-x-1">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
