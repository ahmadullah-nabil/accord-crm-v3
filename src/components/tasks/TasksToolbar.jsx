// ─── TasksToolbar ─────────────────────────────────────────────────────────────
//
// step047. The three-row card (quick tabs, search row, filter row) becomes one
// ViewHeader row.
//
// EVERY FUNCTIONAL DETAIL IS CARRIED OVER: search and its clear button, the
// Priority and Assignee selects, the assignee list from useAssignableMembers,
// Add Task, clearFilters, and the All / Mine quick tabs including the way the
// active tab is DERIVED from filter state rather than stored separately — two
// sources for one truth is how a highlighted tab ends up disagreeing with the
// rows behind it.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ THE "UPCOMING" TAB WAS A FAKE CONTROL AND IS REMOVED                    │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ QUICK_TABS listed four tabs. applyQuickTab() handled 'mine' and         │
// │ 'overdue', with 'all' served by the clearFilters() at the top. There    │
// │ was no branch for 'upcoming' — so pressing it cleared your filters and  │
// │ did nothing else. And activeQuickTab derived only 'overdue', 'mine' or  │
// │ 'all', so it could NEVER return 'upcoming': the tab was incapable of    │
// │ highlighting itself even in principle.                                   │
// │                                                                          │
// │ Same class as Leads' Win Rate pill and Opportunities' Exp. Revenue pill:│
// │ shaped exactly like the working controls beside it, does nothing when   │
// │ pressed. Removed rather than faked.                                     │
// │                                                                          │
// │ It is NOT reimplemented here. "Upcoming" means due within N days and    │
// │ not completed — a new filter axis, which needs a new store field, a     │
// │ decision about N, and a decision about whether it composes with the     │
// │ status chips or replaces them. That is a behaviour change, and burying  │
// │ one in a UI batch is how it ships unreviewed. Its own batch, if wanted. │
// └─────────────────────────────────────────────────────────────────────────┘
//
// The Status select is gone from here because the chip row above IS the status
// filter now — two controls for one filter is one more than can be right.

import React from 'react'
import { Plus, User } from 'lucide-react'
import { useTasksStore }           from '../../stores/tasksStore.js'
import { useAuthStore }            from '../../stores/authStore.js'
import { TASK_PRIORITIES }         from '../../lib/tasksData.js'
import { useAssignableMembers }    from '../../hooks/useTeam.js'
import { ViewHeader }              from '../ui/ViewHeader.jsx'
import { Segmented, SegButton }    from '../ui/Segmented.jsx'

export function TasksToolbar({ total, filtered }) {
  const {
    searchQuery,    setSearchQuery,
    statusFilter,   setStatusFilter,
    priorityFilter, setPriorityFilter,
    assigneeFilter, setAssigneeFilter,
    openAddModal,   clearFilters,
  } = useTasksStore()

  const user = useAuthStore((s) => s.user)
  const { names: assigneeNames } = useAssignableMembers()

  const myName = user?.name ?? ''

  // Derived from filter state, not stored. Carried over unchanged.
  const isMine = Boolean(myName) && assigneeFilter === myName

  const hasFilters =
    Boolean(searchQuery) || statusFilter !== 'All' ||
    priorityFilter !== 'All' || assigneeFilter !== 'All'

  return (
    <ViewHeader
      title="All tasks"
      count={filtered}
      total={total}
      leading={
        <Segmented>
          <SegButton active={!isMine} onClick={() => clearFilters()}>
            All
          </SegButton>
          <SegButton
            active={isMine}
            onClick={() => { clearFilters(); setAssigneeFilter(myName || 'All') }}
          >
            <User size={11} /> Mine
          </SegButton>
        </Segmented>
      }
      search={{
        value: searchQuery,
        onChange: setSearchQuery,
        placeholder: 'Search tasks',
      }}
      filters={[
        {
          label: 'Priority',
          value: priorityFilter,
          onChange: setPriorityFilter,
          options: TASK_PRIORITIES,
        },
        {
          label: 'Assignee',
          value: assigneeFilter,
          onChange: setAssigneeFilter,
          options: assigneeNames,
        },
      ]}
      hasFilters={hasFilters}
      onClearFilters={clearFilters}
      actions={
        <button onClick={openAddModal} className="btn-primary py-1 text-sm">
          <Plus size={14} /> Add Task
        </button>
      }
    />
  )
}

export default TasksToolbar
