// ─── TasksTable ───────────────────────────────────────────────────────────────
//
// step047. 280 lines → this. The header markup, sort chevrons, row hover, row
// action menu, skeleton and footer count are all DataTable's job now.
//
// THREE THINGS HERE ARE LOAD-BEARING
// ──────────────────────────────────
// 1. THE COMPLETION CHECKBOX is a control inside a cell, like Leads' stage
//    dropdown. It needs stopPropagation on the WRAPPER div, not the button —
//    a click landing on the cell padding would otherwise reach the row and
//    open the panel behind the toggle. DataTable stays read-only as a stance;
//    a cell rendering its own control is not a violation of it.
//
// 2. COMPLETED TASKS STAY VISIBLE, dimmed and struck through. They are not
//    filtered out and must not be: a completed task disappearing from the list
//    is indistinguishable from one that was deleted.
//
// 3. OVERDUE IS DERIVED. Nothing writes 'Overdue' — the red styling below comes
//    from daysUntilDue(), never from `status === 'Overdue'`, which reads zero
//    forever.
//
// PERMISSIONS ARE UNCHANGED, WHICH MEANS THERE ARE NONE
// ─────────────────────────────────────────────────────
// getTaskPermissions() and useBatchTaskPermissions() both exist and NOTHING in
// the app calls them — not this table, not the detail panel. Edit, Delete and
// the completion toggle are open to every authenticated user on both surfaces.
// That is preserved here exactly and NOT tightened: applying a gate is a
// permissions change, and burying one in a UI diff is how it ships unreviewed
// (same reasoning as the sidebar admin gating and Contacts). It needs its own
// decision — see the batch notes.
//
// THE RELATED COLUMN NO LONGER PRINTS A RAW UUID. It rendered
// `task.relatedId` as its value, which is a 36-character identifier nobody
// reads, while `relatedLabel` — the human name for the same link — was shown
// as a subtitle under the title instead. They have swapped: the label is the
// value, and the id is the fallback for rows that never got one.

import React from 'react'
import {
  CheckSquare, Circle, CheckCircle2, AlertCircle,
  Tag, Flag, Calendar, User, Link2, Eye, Pencil, Trash2,
} from 'lucide-react'
import { useTasksStore }                            from '../../stores/tasksStore.js'
import { useDeleteTask, useToggleTaskComplete }     from '../../hooks/useTasks.js'
import { STATUS_CONFIG, PRIORITY_CONFIG, daysUntilDue } from '../../lib/tasksData.js'
import { formatLocalDate, isTaskOverdue }           from '../../lib/dates.js'
import { Avatar }                                   from '../ui/Avatar.jsx'
import { DataTable }                                from '../ui/DataTable.jsx'

// step045 added 'Opportunity' to the vocabulary. The old cell coloured Lead
// blue and EVERYTHING ELSE purple, so Contact, Meeting and Opportunity were
// indistinguishable. One colour per type, matching each module's own accent.
const RELATED_COLORS = {
  Lead:        'text-blue-500',
  Contact:     'text-purple-500',
  Opportunity: 'text-emerald-600',
  Meeting:     'text-teal-600',
}

export function TasksTable({ tasks, isLoading }) {
  const {
    sortField, sortDir, setSort,
    openDetail, openEditModal, openAddModal,
  } = useTasksStore()
  const deleteMutation = useDeleteTask()
  const toggleMutation = useToggleTaskComplete()

  const columns = [
    {
      key: 'done',
      label: '',
      sortable: false,
      width: '44px',
      render: (t) => {
        const isComplete = t.status === 'Completed'
        return (
          // stopPropagation on the WRAPPER, not the button — see note 1.
          <div onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => toggleMutation.mutate({ id: t.id, currentStatus: t.status })}
              aria-label={isComplete ? `Reopen ${t.title}` : `Complete ${t.title}`}
              title={isComplete ? 'Mark as Todo' : 'Mark as Completed'}
              className={`transition-colors duration-120
                ${isComplete
                  ? 'text-emerald-500 hover:text-emerald-600'
                  : 'text-gray-300 hover:text-teal-500'}`}
            >
              {isComplete ? <CheckCircle2 size={17} /> : <Circle size={17} />}
            </button>
          </div>
        )
      },
    },
    {
      key: 'title',
      label: 'Task',
      icon: CheckSquare,
      sortable: true,
      width: '300px',
      render: (t) => (
        <span className={`font-medium truncate
          ${t.status === 'Completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {t.title}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      icon: Tag,
      sortable: true,
      width: '130px',
      render: (t) => {
        const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG['Todo']
        return (
          <span className={`badge ${sc.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mr-1 ${sc.dot}`} />
            {sc.label}
          </span>
        )
      },
    },
    {
      key: 'priority',
      label: 'Priority',
      icon: Flag,
      sortable: true,
      width: '110px',
      render: (t) => {
        const pc = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG['Low']
        return <span className={`badge ${pc.color}`}>{pc.label}</span>
      },
    },
    {
      key: 'dueDate',
      label: 'Due',
      icon: Calendar,
      sortable: true,
      width: '130px',
      render: (t) => <DueCell task={t} />,
    },
    {
      key: 'assignee',
      label: 'Assignee',
      icon: User,
      width: '150px',
      render: (t) => (
        t.assignee ? (
          <span className="flex items-center gap-1.5 min-w-0">
            <Avatar name={t.assignee} size="xs" />
            <span className="text-gray-600 truncate">{t.assignee}</span>
          </span>
        ) : <span className="text-gray-300">Unassigned</span>
      ),
    },
    {
      key: 'relatedLabel',
      label: 'Related',
      icon: Link2,
      width: '190px',
      render: (t) => {
        if (!t.relatedType || t.relatedType === 'None' || !t.relatedId) {
          return <span className="text-gray-300">—</span>
        }
        return (
          <span className="flex flex-col min-w-0">
            <span className={`text-[10px] font-semibold uppercase tracking-wide
              ${RELATED_COLORS[t.relatedType] ?? 'text-gray-400'}`}>
              {t.relatedType}
            </span>
            <span className="text-gray-600 truncate">
              {t.relatedLabel || t.relatedId}
            </span>
          </span>
        )
      },
    },
  ]

  // Counts only. Summing anything on a task would be inventing a metric.
  const overdue   = tasks.filter(isTaskOverdue).length
  const completed = tasks.filter((t) => t.status === 'Completed').length

  return (
    <DataTable
      columns={columns}
      rows={tasks}
      isLoading={isLoading}
      sort={{ field: sortField, dir: sortDir }}
      onSort={setSort}
      onRowClick={(t) => openDetail(t.id)}
      onAddNew={openAddModal}
      rowActions={(t) => [
        { label: 'Open',   icon: Eye,    onClick: () => openDetail(t.id) },
        { label: 'Edit',   icon: Pencil, onClick: () => openEditModal(t.id) },
        {
          label: 'Delete',
          icon: Trash2,
          danger: true,
          onClick: () => {
            if (confirm(`Delete task "${t.title}"?`)) deleteMutation.mutate(t.id)
          },
        },
      ]}
      aggregates={[
        { label: 'Tasks',     value: tasks.length },
        { label: 'Overdue',   value: overdue },
        { label: 'Completed', value: completed },
      ]}
      empty={{
        icon: CheckSquare,
        title: 'No tasks found',
        description: 'Try adjusting your search or filter criteria, or add a new task.',
      }}
    />
  )
}

// ── Due date cell ─────────────────────────────────────────────────────────────
//
// formatLocalDate, not new Date(dueDate).toLocaleDateString(): a bare
// YYYY-MM-DD is parsed as UTC, so the old call could render the wrong day.
// See the read-side note in lib/dates.js.
function DueCell({ task }) {
  const isComplete = task.status === 'Completed'
  const days  = daysUntilDue(task.dueDate)
  const label = formatLocalDate(task.dueDate)

  if (!label) return <span className="text-gray-300">No due date</span>

  const cls =
    isComplete    ? 'text-gray-400' :
    days === null ? 'text-gray-400' :
    days <   0    ? 'text-red-600 font-medium' :
    days === 0    ? 'text-orange-600 font-medium' :
    days <=  2    ? 'text-amber-600' :
                    'text-gray-600'

  const note =
    isComplete    ? null :
    days === null ? null :
    days <   0    ? `${Math.abs(days)}d overdue` :
    days === 0    ? 'Today' :
    days === 1    ? 'Tomorrow' :
                    null

  return (
    <span className="flex flex-col">
      <span className={`tnum ${cls}`}>{label}</span>
      {note && (
        <span className={`text-[10px] flex items-center gap-0.5
          ${days < 0 ? 'text-red-500' : 'text-amber-500'}`}>
          {days < 0 && <AlertCircle size={9} />}
          {note}
        </span>
      )}
    </span>
  )
}

export default TasksTable
