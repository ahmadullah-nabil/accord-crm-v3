// ─── MeetingsToolbar ──────────────────────────────────────────────────────────
//
// step048. The three-row card becomes one ViewHeader row.
//
// EVERY FUNCTIONAL DETAIL IS CARRIED OVER: search and its clear button, the
// Type and Organizer selects, the organizer list from useAssignableMembers,
// Add Meeting, clearFilters, and the All / Mine toggle.
//
// THE "MINE" HIGHLIGHT IS SIMPLER AND MORE HONEST NOW. It read
//
//     organizerFilter === user.name && statusFilter === 'All'
//       && typeFilter === 'All' && searchQuery === ''
//
// so filtering to your own meetings AND then picking a type turned Mine OFF
// while the organizer filter was still applied — the same lie the Notifications
// Unread pill told in step046. A segment that changes WHICH ROWS should read
// only the filter it sets; the other three are independent axes that compose
// with it rather than cancelling it.
//
// The Status select is gone from here because the chip row above IS the status
// filter now — two controls for one filter is one more than can be right.

import React from 'react'
import { Plus, User } from 'lucide-react'
import { useMeetingsStore }        from '../../stores/meetingsStore.js'
import { useAuthStore }            from '../../stores/authStore.js'
import { MEETING_TYPES }           from '../../lib/meetingsData.js'
import { useAssignableMembers }    from '../../hooks/useTeam.js'
import { ViewHeader }              from '../ui/ViewHeader.jsx'
import { Segmented, SegButton }    from '../ui/Segmented.jsx'

export function MeetingsToolbar({ total, filtered }) {
  const {
    searchQuery,     setSearchQuery,
    statusFilter,
    typeFilter,      setTypeFilter,
    organizerFilter, setOrganizerFilter,
    openAddModal,    clearFilters,
  } = useMeetingsStore()

  const user = useAuthStore((s) => s.user)
  const { names: assigneeNames } = useAssignableMembers()

  const myName = user?.name ?? ''
  const isMine = Boolean(myName) && organizerFilter === myName

  const hasFilters =
    Boolean(searchQuery) || statusFilter !== 'All' ||
    typeFilter !== 'All' || organizerFilter !== 'All'

  return (
    <ViewHeader
      title="All meetings"
      count={filtered}
      total={total}
      leading={
        <Segmented>
          <SegButton active={!isMine} onClick={() => clearFilters()}>
            All
          </SegButton>
          <SegButton
            active={isMine}
            onClick={() => { clearFilters(); setOrganizerFilter(myName || 'All') }}
          >
            <User size={11} /> Mine
          </SegButton>
        </Segmented>
      }
      search={{
        value: searchQuery,
        onChange: setSearchQuery,
        placeholder: 'Search meetings',
      }}
      filters={[
        { label: 'Type',      value: typeFilter,      onChange: setTypeFilter,      options: MEETING_TYPES },
        { label: 'Organizer', value: organizerFilter, onChange: setOrganizerFilter, options: assigneeNames },
      ]}
      hasFilters={hasFilters}
      onClearFilters={clearFilters}
      actions={
        <button onClick={openAddModal} className="btn-primary py-1 text-sm">
          <Plus size={14} /> Add Meeting
        </button>
      }
    />
  )
}

export default MeetingsToolbar
